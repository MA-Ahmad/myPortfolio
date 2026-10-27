// Builds the province pieces a country plate splits into: `node blocks/world-globe/divisions/build.mjs <admin1.geojson>`.
//
// The input is Natural Earth's 1:10m admin-1 layer (public domain):
// https://github.com/nvkelso/natural-earth-vector/blob/master/geojson/ne_10m_admin_1_states_provinces.geojson
//
// The pieces must tile the globe's own 1:110m plate exactly, or the plate would change shape when it
// cracks. So each province is clipped to the 1:110m outline, slivers the 1:10m lines leave uncovered go
// to the province nearest them, and only the borders between provinces are simplified: every point on
// the outline is kept. Names and units are brought up to date where Natural Earth lags (see COUNTRIES).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import polygonClipping from 'polygon-clipping';
import polylabel from 'polylabel';
import { geoArea } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import { feature, quantize } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const EARTH_KM = 6371.0088;

/**
 * For each country: its name in world-atlas, its ISO code in Natural Earth, and the units it splits into.
 * Each unit lists the Natural Earth names it is made of, its name today, what kind of unit it is, and
 * optionally a shorter label for its plate.
 */
const COUNTRIES = {
  pakistan: {
    name: 'Pakistan',
    iso: 'PAK',
    units: [
      { from: ['Baluchistan'], name: 'Balochistan', kind: 'Province' },
      // F.A.T.A. merged into Khyber Pakhtunkhwa under the 25th Amendment (2018).
      { from: ['K.P.', 'F.A.T.A.'], name: 'Khyber Pakhtunkhwa', kind: 'Province' },
      { from: ['Punjab'], name: 'Punjab', kind: 'Province' },
      { from: ['Sind'], name: 'Sindh', kind: 'Province' },
      { from: ['F.C.T.'], name: 'Islamabad Capital Territory', kind: 'Federal territory', label: 'Islamabad' },
      // Renamed from the Northern Areas in 2009.
      { from: ['Northern Areas'], name: 'Gilgit-Baltistan', kind: 'Administrative territory' },
      { from: ['Azad Kashmir'], name: 'Azad Jammu and Kashmir', kind: 'Administrative territory', label: 'Azad Jammu & Kashmir' }
    ]
  }
};

const source = process.argv[2];
if (!source) {
  console.error('usage: node build.mjs <ne_10m_admin_1_states_provinces.geojson>');
  process.exit(1);
}
const admin1 = JSON.parse(fs.readFileSync(source, 'utf8'));
const world = require('world-atlas/countries-110m.json');
const countries = feature(world, world.objects.countries).features;

const asMulti = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates);

/** Planar area of one polygon in square degrees, enough to rank slivers. */
function planarArea(polygon) {
  let total = 0;
  polygon.forEach((ring, index) => {
    let sum = 0;
    for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) sum += (ring[j][0] - ring[i][0]) * (ring[j][1] + ring[i][1]);
    total += (index === 0 ? 1 : -1) * Math.abs(sum / 2);
  });
  return total;
}

function centroidOf(polygon) {
  const ring = polygon[0];
  const [x, y] = ring.reduce(([sx, sy], [px, py]) => [sx + px, sy + py], [0, 0]);
  return [x / ring.length, y / ring.length];
}

/** Squared distance from a point to a multipolygon's edges, or 0 inside it. */
function distanceTo(point, multi) {
  let best = Infinity;
  for (const polygon of multi) {
    for (const ring of polygon) {
      let inside = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[j];
        if (ay > point[1] !== by > point[1] && point[0] < ((bx - ax) * (point[1] - ay)) / (by - ay) + ax) inside = !inside;
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, (ax + t * dx - point[0]) ** 2 + (ay + t * dy - point[1]) ** 2);
      }
      if (inside && ring === polygon[0]) return 0;
    }
  }
  return best;
}

/**
 * Where a unit's name goes: the point deepest inside its largest part (its pole of inaccessibility),
 * measured with longitude scaled by the cosine of latitude so the shape is not stretched sideways.
 */
function anchorOf(multi) {
  const largest = multi.reduce((best, polygon) => (planarArea(polygon) > planarArea(best) ? polygon : best));
  const k = Math.cos((centroidOf(largest)[1] * Math.PI) / 180);
  const [x, y] = polylabel(largest.map((ring) => ring.map(([lon, lat]) => [lon * k, lat])), 0.005);
  return [Math.round((x / k) * 1e4) / 1e4, Math.round(y * 1e4) / 1e4];
}

/** d3 wants each polygon wound so that its area is the small side of the sphere. */
function windForD3(geometry) {
  const multi = asMulti(geometry).map((polygon) => polygon.map((ring) => [...ring]));
  for (const polygon of multi) {
    if (geoArea({ type: 'Polygon', coordinates: polygon }) > 2 * Math.PI) polygon.forEach((ring) => ring.reverse());
  }
  return multi.length === 1 ? { type: 'Polygon', coordinates: multi[0] } : { type: 'MultiPolygon', coordinates: multi };
}

for (const [key, country] of Object.entries(COUNTRIES)) {
  const outline = countries.find((shape) => shape.properties.name === country.name);
  const plate = asMulti(outline.geometry);
  const parts = admin1.features.filter((shape) => shape.properties.adm0_a3 === country.iso);

  // Join the Natural Earth units into today's, and clip each to the plate.
  const minimum = 0.004; // square degrees: smaller fragments of a clip are slivers, not land
  let units = country.units.map((unit) => {
    const sources = unit.from.map((name) => {
      const found = parts.find((shape) => shape.properties.name === name);
      if (!found) throw new Error(`${country.name}: no Natural Earth unit named ${name}`);
      return asMulti(found.geometry);
    });
    const joined = polygonClipping.union(...sources);
    const clipped = polygonClipping.intersection(joined, plate).filter((polygon) => planarArea(polygon) > minimum);
    return { ...unit, shape: clipped };
  });

  // Whatever of the plate no unit covers goes to the unit nearest it, so the pieces tile the plate.
  const covered = polygonClipping.union(...units.map((unit) => unit.shape));
  const gaps = polygonClipping.difference(plate, covered);
  for (const gap of gaps) {
    const at = centroidOf(gap);
    const nearest = units.reduce((best, unit) => (distanceTo(at, unit.shape) < distanceTo(at, best.shape) ? unit : best));
    nearest.shape = polygonClipping.union(nearest.shape, [gap]);
  }

  const collection = {
    type: 'FeatureCollection',
    features: units.map((unit) => ({
      type: 'Feature',
      properties: { name: unit.name, kind: unit.kind, label: unit.label ?? unit.name, anchor: anchorOf(unit.shape) },
      geometry: windForD3({ type: 'MultiPolygon', coordinates: unit.shape })
    }))
  };

  // One topology, so neighbours share their border; then thin the inner borders only.
  let topo = topology({ units: collection }, 1e6);
  topo = presimplify(topo);
  const uses = new Map();
  for (const geometry of topo.objects.units.geometries) {
    const arcs = geometry.type === 'Polygon' ? geometry.arcs.flat() : geometry.arcs.flat(2);
    for (const arc of arcs) {
      const index = arc < 0 ? ~arc : arc;
      uses.set(index, (uses.get(index) ?? 0) + 1);
    }
  }
  // Points on the plate's own outline (arcs only one unit uses) are kept whatever their weight.
  topo.arcs.forEach((arc, index) => {
    if (uses.get(index) === 1) for (const point of arc) point[2] = Infinity;
  });
  // Inner borders keep about as much detail as the 1:110m outline they meet: `quantile` is the share of points kept.
  topo = simplify(topo, quantile(topo, 0.12));
  for (const arc of topo.arcs) for (const point of arc) point.length = 2;
  topo = quantize(topo, 1e5);

  // Check the pieces add up to the plate.
  const pieces = feature(topo, topo.objects.units).features;
  const total = pieces.reduce((sum, piece) => sum + geoArea(piece), 0);
  const whole = geoArea(outline);
  for (const piece of pieces) {
    console.log(`  ${piece.properties.name.padEnd(30)} ${Math.round(geoArea(piece) * EARTH_KM * EARTH_KM).toLocaleString('en').padStart(9)} km²`);
  }
  console.log(`${country.name}: ${pieces.length} units, pieces ${(((total - whole) / whole) * 100).toFixed(3)}% off the plate's area`);

  const out = path.join(here, `${key}.json`);
  fs.writeFileSync(out, JSON.stringify(topo));
  console.log(`wrote ${path.relative(process.cwd(), out)} (${fs.statSync(out).size.toLocaleString('en')} bytes)`);
}
