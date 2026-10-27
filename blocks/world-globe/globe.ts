import { geoArea, geoCentroid } from 'd3-geo';
import type { Feature, Geometry } from 'geojson';
import { feature } from 'topojson-client';
import type { GeometryCollection, Topology } from 'topojson-specification';
import world from 'world-atlas/countries-110m.json';
import { cameraOf, type Point3, type Projection } from './iso-kit';

/**
 * The model behind the globe: its size, its stand, the countries cut from Natural Earth's 1:110m
 * outlines, and the camera maths that turns the kit's isometric view into a d3 orthographic rotation.
 * Everything the figure draws or reads out comes from here.
 */

/** Radius of the ocean ball, in world units. */
export const R = 100;
/** How thick each country's plate is. */
export const PLATE = 3.2;
/** The meridian ring: a flat brass band around the ball, in the plane y = 0. */
export const RING_IN = R + 12;
export const RING_OUT = R + 20;
export const RING_H = 5;
/** The top of the stand's column, the cradle that holds the ring, and the ball's centre above it. */
export const COLUMN_TOP = 112;
export const CRADLE_BASE = 6;
export const CENTER: Point3 = [0, 0, COLUMN_TOP + CRADLE_BASE + RING_OUT];

/** How far a plate rises: a hover, and pulled out or broken apart (clear of the ring and the pole caps). */
export const HOVER = 2.4;
export const LIFT = 34;

/** The axis tilt the ring can slide through in its cradle, and Earth's own. */
export const TILT_MIN = 12;
export const TILT_MAX = 50;
export const EARTH_TILT = 23.44;

const EARTH_KM = 6371.0088;
const RADIANS = Math.PI / 180;

export type Vec = [number, number, number];

export interface Country {
  index: number;
  name: string;
  feature: Feature<Geometry>;
  /** Centroid in degrees, and as a unit vector in the globe's own frame (d3: x to 0°E, z to the North Pole). */
  lon: number;
  lat: number;
  dir: Vec;
  /** Every vertex as a unit vector, xyz in a row, for the ring clearance test. */
  points: Float64Array;
  /** Area in km², from the 1:110m outline, so about right rather than official. */
  area: number;
}

const unit = (lon: number, lat: number): Vec => {
  const l = lon * RADIANS;
  const p = lat * RADIANS;
  return [Math.cos(p) * Math.cos(l), Math.cos(p) * Math.sin(l), Math.sin(p)];
};

function verticesOf(geometry: Geometry): number[] {
  const out: number[] = [];
  const rings =
    geometry.type === 'Polygon' ? geometry.coordinates : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat() : [];
  for (const ring of rings) for (const [lon, lat] of ring) out.push(...unit(lon, lat));
  return out;
}

const topology = world as unknown as Topology<{ countries: GeometryCollection<{ name: string }> }>;

export const COUNTRIES: Country[] = feature(topology, topology.objects.countries).features.map((shape, index) => {
  const [lon, lat] = geoCentroid(shape);
  return {
    index,
    name: shape.properties?.name ?? 'Unknown',
    feature: shape as Feature<Geometry>,
    lon,
    lat,
    dir: unit(lon, lat),
    points: new Float64Array(verticesOf(shape.geometry)),
    area: geoArea(shape) * EARTH_KM * EARTH_KM
  };
});

export const BY_NAME = [...COUNTRIES].sort((a, b) => a.name.localeCompare(b.name));

// ── Vectors ──────────────────────────────────────────────────────────────────

export const dot = (a: Vec, b: Vec) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a: Vec, b: Vec): Vec => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const scale = (a: Vec, k: number): Vec => [a[0] * k, a[1] * k, a[2] * k];
export const add = (a: Vec, b: Vec): Vec => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const norm = (a: Vec): Vec => scale(a, 1 / (Math.hypot(a[0], a[1], a[2]) || 1));

/** The kit camera as three world directions: toward the viewer, screen right and screen up. */
export function basisOf(P: Projection) {
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  return {
    toward: [cosA * cosE, sinA * cosE, sinE] as Vec,
    right: [sinA, -cosA, 0] as Vec,
    up: [-cosA * sinE, -sinA * sinE, cosE] as Vec
  };
}

/**
 * The ball's frame in the world for a tilt (degrees): the axis `a` leans toward +x inside the ring's
 * plane, `b` is the equator's direction in that plane, and `n` is the ring's normal (+y).
 */
export function frameOf(tilt: number) {
  const t = tilt * RADIANS;
  return { a: [Math.sin(t), 0, Math.cos(t)] as Vec, b: [Math.cos(t), 0, -Math.sin(t)] as Vec, n: [0, 1, 0] as Vec };
}

/**
 * A globe direction (d3's frame) in the world, after spinning the ball east by `spin` degrees. The kit
 * draws a mirror image of a right-handed world, so the map goes on mirrored (east along −n) to read true.
 */
export function worldOf(g: Vec, spin: number, tilt: number): Vec {
  const { a, b, n } = frameOf(tilt);
  const s = spin * RADIANS;
  const x = g[0] * Math.cos(s) - g[1] * Math.sin(s);
  const y = g[0] * Math.sin(s) + g[1] * Math.cos(s);
  return [b[0] * x - n[0] * y + a[0] * g[2], b[1] * x - n[1] * y + a[1] * g[2], b[2] * x - n[2] * y + a[2] * g[2]];
}

/** A world direction back in the globe's frame: the inverse of `worldOf`. */
export function globeOf(w: Vec, spin: number, tilt: number): Vec {
  const { a, b, n } = frameOf(tilt);
  const x = dot(w, b);
  const y = -dot(w, n);
  const s = spin * RADIANS;
  return [x * Math.cos(s) + y * Math.sin(s), -x * Math.sin(s) + y * Math.cos(s), dot(w, a)];
}

export type Matrix = number[]; // 3 × 3, row major

/** The ball's orientation on the stand: globe directions to world directions, column by column. */
export function standMatrix(spin: number, tilt: number): Matrix {
  const [x, y, z] = [worldOf([1, 0, 0], spin, tilt), worldOf([0, 1, 0], spin, tilt), worldOf([0, 0, 1], spin, tilt)];
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

export const apply = (M: Matrix, [x, y, z]: Vec): Vec => [M[0] * x + M[1] * y + M[2] * z, M[3] * x + M[4] * y + M[5] * z, M[6] * x + M[7] * y + M[8] * z];
export const applyT = (M: Matrix, [x, y, z]: Vec): Vec => [M[0] * x + M[3] * y + M[6] * z, M[1] * x + M[4] * y + M[7] * z, M[2] * x + M[5] * y + M[8] * z];

export function multiply(A: Matrix, B: Matrix): Matrix {
  const out: Matrix = new Array(9);
  for (let r = 0; r < 3; r++) for (let c = 0; c < 3; c++) out[r * 3 + c] = A[r * 3] * B[c] + A[r * 3 + 1] * B[3 + c] + A[r * 3 + 2] * B[6 + c];
  return out;
}

const transpose = (M: Matrix): Matrix => [M[0], M[3], M[6], M[1], M[4], M[7], M[2], M[5], M[8]];

/** Rotation about a unit axis by `angle` radians (Rodrigues). */
export function rotationAbout([x, y, z]: Vec, angle: number): Matrix {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const t = 1 - c;
  return [t * x * x + c, t * x * y - s * z, t * x * z + s * y, t * x * y + s * z, t * y * y + c, t * y * z - s * x, t * x * z - s * y, t * y * z + s * x, t * z * z + c];
}

/** The world rotation that takes orientation `from` to `to`, as an axis and an angle in radians. */
export function turnBetween(from: Matrix, to: Matrix): { axis: Vec; angle: number } {
  const D = multiply(to, transpose(from));
  const angle = Math.acos(Math.max(-1, Math.min(1, (D[0] + D[4] + D[8] - 1) / 2)));
  const axis: Vec = [D[7] - D[5], D[2] - D[6], D[3] - D[1]];
  return { axis: norm(axis), angle: Math.hypot(...axis) < 1e-9 ? 0 : angle };
}

/** Squares an orientation up again after many small turns, keeping it the mirror the map needs. */
export function tidy(M: Matrix): Matrix {
  const x = norm([M[0], M[3], M[6]]);
  const yRaw: Vec = [M[1], M[4], M[7]];
  const y = norm(add(yRaw, scale(x, -dot(yRaw, x))));
  const z = scale(cross(x, y), -1);
  return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
}

/**
 * The d3 `rotate([λ, φ, γ])` that shows the ball in orientation `M` as the kit camera sees it, optionally
 * with one plate turned on the sphere by `extra` first. d3's orthographic view looks down its x axis
 * with y to the right and z up, and its rotation is Rγ·Rφ·Rλ, so the angles come straight out of the matrix.
 */
export function rotationFrom(P: Projection, M: Matrix, extra?: Matrix): [number, number, number] {
  const { toward, right, up } = basisOf(P);
  const full = extra ? multiply(M, extra) : M;
  const q = [toward, right, up].map((axis) => [0, 1, 2].map((c) => axis[0] * full[c] + axis[1] * full[3 + c] + axis[2] * full[6 + c]));
  const phi = -Math.asin(Math.max(-1, Math.min(1, q[0][2])));
  const gamma = Math.atan2(-q[1][2], q[2][2]);
  const lambda = Math.atan2(-q[0][1], q[0][0]);
  return [lambda / RADIANS, phi / RADIANS, gamma / RADIANS];
}

export const rotationOf = (P: Projection, spin: number, tilt: number, extra?: Matrix) => rotationFrom(P, standMatrix(spin, tilt), extra);

/** Latitude and longitude of the point of the ball nearest the viewer. */
export function facingPoint(P: Projection, M: Matrix) {
  const [x, y, z] = applyT(M, basisOf(P).toward);
  return { lat: Math.asin(Math.max(-1, Math.min(1, z))) / RADIANS, lon: Math.atan2(y, x) / RADIANS };
}

/** The spin that turns a longitude to face the viewer. */
export function spinToFace(P: Projection, lon: number, tilt: number) {
  const { toward } = basisOf(P);
  const { b, n } = frameOf(tilt);
  return Math.atan2(-dot(n, toward), dot(b, toward)) / RADIANS - lon;
}

/** The longitude that faces the viewer at this spin. */
export function facing(P: Projection, spin: number, tilt: number) {
  return wrap(spinToFace(P, 0, tilt) - spin);
}

export const wrap = (degrees: number) => ((((degrees + 180) % 360) + 360) % 360) - 180;

// ── Words ────────────────────────────────────────────────────────────────────

export const lonText = (lon: number) => `${Math.abs(lon).toFixed(0)}°${Math.round(lon) === 0 || Math.round(Math.abs(lon)) === 180 ? '' : lon > 0 ? 'E' : 'W'}`;
export const latText = (lat: number) => `${Math.abs(lat).toFixed(0)}°${Math.round(lat) === 0 ? '' : lat > 0 ? 'N' : 'S'}`;

export function areaText(km2: number) {
  if (km2 >= 1e6) return `${(km2 / 1e6).toFixed(km2 >= 1e7 ? 1 : 2)}M km²`;
  if (km2 >= 1e3) return `${Math.round(km2 / 1e3)}k km²`;
  return `${Math.round(km2 / 10) * 10} km²`;
}

export const describe = (country: Country) => `${country.name} · ${areaText(country.area)} · ${latText(country.lat)} ${lonText(country.lon)}`;
