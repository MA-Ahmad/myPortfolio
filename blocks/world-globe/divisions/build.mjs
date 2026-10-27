// Builds the pieces each country's plate splits into:
//   node blocks/world-globe/divisions/build.mjs <ne_10m_admin_1_states_provinces.geojson> <ne_110m_admin_0_countries.geojson>
//
// Inputs are Natural Earth's 1:10m admin-1 layer and 1:110m countries (public domain):
// https://github.com/nvkelso/natural-earth-vector/tree/master/geojson
//
// The pieces must tile the globe's own 1:110m plate exactly, or the plate would change shape when it
// cracks. So each unit is clipped to the 1:110m outline, slivers the 1:10m lines leave uncovered go to
// the unit nearest them, and only the borders between units are simplified: every point on the outline
// is kept. Each country is written to public/blocks/world-globe/divisions/<code>.json, fetched when it is
// first pulled out, and divisions/index.json lists them. A report of every unit left out is printed.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import ClipperLib from 'clipper-lib';
import polylabel from 'polylabel';
import { geoArea, geoDistance, geoInterpolate } from 'd3-geo';
import { topology } from 'topojson-server';
import { presimplify, quantile, simplify } from 'topojson-simplify';
import { feature, quantize } from 'topojson-client';

const require = createRequire(import.meta.url);
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, '../../..');
const OUT = path.join(root, 'public/blocks/world-globe/divisions');

/** world-atlas names that Natural Earth's current 1:110m table spells differently. */
const ALIASES = { Macedonia: 'North Macedonia' };

/**
 * Countries whose Natural Earth units are second-level (counties, provinces, municipalities): they are
 * joined by a field that holds the first-level unit, which gets the kind given here.
 */
const GROUPS = {
  GBR: { by: 'geonunit', kind: 'Country' },
  ITA: { by: 'region', kind: 'Region' },
  FRA: { by: 'region', kind: 'Region' },
  ESP: { by: 'region', kind: 'Autonomous community' },
  PHL: { by: 'region', kind: 'Region' },
  BFA: { by: 'region', kind: 'Region' },
  UGA: { by: 'region', kind: 'Region' },
  LVA: { by: 'region', kind: 'Planning region' },
  SVN: { by: 'region', kind: 'Statistical region' },
  MKD: { by: 'region', kind: 'Statistical region' },
  AZE: { by: 'region', kind: 'Economic region' },
  HUN: { by: 'region', kind: 'Region' },
  MLT: { by: 'region', kind: 'Region' }
};

/**
 * Countries whose units are brought up to date by hand where Natural Earth lags: each unit lists the
 * Natural Earth names it is made of, its name today, its kind, and optionally a shorter label.
 */
const CURATED = {
  PAK: [
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
};

/** Names longer than this lose any bracketed part on their plate (the full name stays in the readout). */
const SHORT = 30;

const [admin1Path, admin0Path] = process.argv.slice(2);
if (!admin1Path || !admin0Path) {
  console.error('usage: node build.mjs <ne_10m_admin_1_states_provinces.geojson> <ne_110m_admin_0_countries.geojson>');
  process.exit(1);
}
const admin1 = JSON.parse(fs.readFileSync(admin1Path, 'utf8')).features;
const admin0 = JSON.parse(fs.readFileSync(admin0Path, 'utf8')).features;
const world = require('world-atlas/countries-110m.json');
const countries = feature(world, world.objects.countries).features;

const asMulti = (geometry) => (geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.type === 'MultiPolygon' ? geometry.coordinates : []);

/**
 * Union, intersection and difference of multipolygons in degrees, with Clipper: it works on integers
 * (here 10⁻⁷°, about a centimetre), so near-coincident coastline points cannot make it fail.
 */
const SCALE = 1e7;
const { Clipper, ClipType, PolyFillType, PolyTree, PolyType } = ClipperLib;

function toPaths(multi) {
  const paths = [];
  for (const polygon of multi) {
    polygon.forEach((ring, index) => {
      const open = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring;
      if (open.length < 3) return;
      const path = open.map(([x, y]) => ({ X: Math.round(x * SCALE), Y: Math.round(y * SCALE) }));
      // Outer rings counter-clockwise and holes clockwise, so a non-zero fill reads them right.
      if (Clipper.Orientation(path) !== (index === 0)) path.reverse();
      paths.push(path);
    });
  }
  return paths;
}

function fromTree(tree) {
  const out = [];
  const ring = (path) => {
    const points = path.map(({ X, Y }) => [X / SCALE, Y / SCALE]);
    points.push(points[0]);
    return points;
  };
  const walk = (node) => {
    for (const child of node.Childs()) {
      if (child.IsHole()) continue;
      const polygon = [ring(child.Contour())];
      for (const hole of child.Childs()) {
        polygon.push(ring(hole.Contour()));
        walk(hole);
      }
      out.push(polygon);
    }
  };
  walk(tree);
  return out;
}

function overlay(type, subject, clip) {
  const clipper = new Clipper();
  clipper.AddPaths(toPaths(subject), PolyType.ptSubject, true);
  if (clip) clipper.AddPaths(toPaths(clip), PolyType.ptClip, true);
  const tree = new PolyTree();
  clipper.Execute(type, tree, PolyFillType.pftNonZero, PolyFillType.pftNonZero);
  return fromTree(tree);
}

const clipping = {
  union: (...multis) => overlay(ClipType.ctUnion, multis.flat(1)),
  intersection: (a, b) => overlay(ClipType.ctIntersection, a, b),
  difference: (a, b) => overlay(ClipType.ctDifference, a, b)
};

/** Planar area of one polygon in square degrees, enough to rank parts. */
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

const boxOf = (multi) => {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of multi.flat(2)) {
    box[0] = Math.min(box[0], x);
    box[1] = Math.min(box[1], y);
    box[2] = Math.max(box[2], x);
    box[3] = Math.max(box[3], y);
  }
  return box;
};

/** Squared distance from a point to a box (0 inside it): never more than to anything in the box. */
const boxDistance = ([x, y], [x0, y0, x1, y1]) => Math.max(x0 - x, 0, x - x1) ** 2 + Math.max(y0 - y, 0, y - y1) ** 2;

/** Squared distance from a point to a multipolygon's edges, or 0 inside it. */
function distanceTo(point, multi) {
  let best = Infinity;
  for (const polygon of multi) {
    let inside = false;
    polygon.forEach((ring, index) => {
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [ax, ay] = ring[i];
        const [bx, by] = ring[j];
        if (index === 0 && ay > point[1] !== by > point[1] && point[0] < ((bx - ax) * (point[1] - ay)) / (by - ay) + ax) inside = !inside;
        const dx = bx - ax;
        const dy = by - ay;
        const t = Math.max(0, Math.min(1, ((point[0] - ax) * dx + (point[1] - ay) * dy) / (dx * dx + dy * dy || 1)));
        best = Math.min(best, (ax + t * dx - point[0]) ** 2 + (ay + t * dy - point[1]) ** 2);
      }
    });
    if (inside) return 0;
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
function windForD3(multi) {
  const wound = multi.map((polygon) => polygon.map((ring) => [...ring]));
  for (const polygon of wound) {
    if (geoArea({ type: 'Polygon', coordinates: polygon }) > 2 * Math.PI) polygon.forEach((ring) => ring.reverse());
  }
  return wound.length === 1 ? { type: 'Polygon', coordinates: wound[0] } : { type: 'MultiPolygon', coordinates: wound };
}

/**
 * d3 draws every edge as a great circle, so a long straight edge of the 1:110m outline (the US border
 * along the 49th parallel is one of 28°) bows away from the parallel on the globe. Planar clipping
 * would follow the straight line instead, so the plate is given points along its great circles first,
 * at most a degree apart, and the pieces then tile the plate as it is drawn.
 */
function densify(multi, most = (1 * Math.PI) / 180) {
  return multi.map((polygon) =>
    polygon.map((ring) => {
      const out = [ring[0]];
      for (let i = 1; i < ring.length; i++) {
        const a = ring[i - 1];
        const b = ring[i];
        const steps = Math.ceil(geoDistance(a, b) / most);
        if (steps > 1) {
          const along = geoInterpolate(a, b);
          for (let k = 1; k < steps; k++) out.push(along(k / steps));
        }
        out.push(b);
      }
      return out;
    })
  );
}

/**
 * A country across the 180° meridian (Russia, Fiji, the Aleutians) is moved onto one side of it, the
 * side most of its points are on, so planar clipping sees one shape. d3 reads 190° as −170°.
 */
function unwrapper(plate) {
  const lons = plate.flat(2).map(([lon]) => lon);
  if (!(lons.some((lon) => lon > 170) && lons.some((lon) => lon < -170))) return (multi) => multi;
  const east = lons.filter((lon) => lon > 0).length >= lons.length / 2;
  const move = ([lon, lat]) => [east && lon < 0 ? lon + 360 : !east && lon > 0 ? lon - 360 : lon, lat];
  return (multi) => multi.map((polygon) => polygon.map((ring) => ring.map(move)));
}

const plural = (kind) => {
  const word = kind.toLowerCase();
  if (/(s|sh|ch|x)$/.test(word)) return `${word}es`;
  if (/[^aeiou]y$/.test(word)) return `${word.slice(0, -1)}ies`;
  return `${word}s`;
};

const byCode = new Map();
for (const shape of admin1) {
  const code = shape.properties.adm0_a3;
  if (!byCode.has(code)) byCode.set(code, []);
  byCode.get(code).push(shape);
}
const codeOf = new Map(admin0.map((shape) => [shape.properties.NAME, shape.properties.ADM0_A3]));

/**
 * A country's units simplified together, as one topology so neighbours keep sharing their borders,
 * keeping `share` of their points. Only used when clipping the full 1:10m detail fails.
 */
function thinned(parts, share) {
  const collection = { type: 'FeatureCollection', features: parts.map((shape, i) => ({ type: 'Feature', id: i, properties: shape.properties, geometry: shape.geometry })) };
  let topo = presimplify(topology({ parts: collection }, 1e6));
  topo = simplify(topo, quantile(topo, share));
  return feature(topo, topo.objects.parts).features.filter((shape) => shape.geometry);
}

function cut(country, code, given, grid, share) {
  const parts = share < 1 ? thinned(given, share) : given;
  const name = country.properties.name;
  const snap = (multi) => multi.map((polygon) => polygon.map((ring) => ring.map(([lon, lat]) => [Math.round(lon * grid) / grid, Math.round(lat * grid) / grid])));
  const unwrap = (multi) => snap(unwrapper(asMulti(country.geometry))(multi));
  const plate = unwrap(densify(asMulti(country.geometry)));

  // The units as given, joined into first-level ones where needed, or curated.
  let units;
  if (CURATED[code]) {
    units = CURATED[code].map((unit) => ({
      ...unit,
      shape: clipping.union(
        ...unit.from.map((from) => {
          const found = parts.find((shape) => shape.properties.name === from);
          if (!found) throw new Error(`${name}: no Natural Earth unit named ${from}`);
          return unwrap(asMulti(found.geometry));
        })
      )
    }));
  } else if (GROUPS[code]) {
    const { by, kind } = GROUPS[code];
    const groups = new Map();
    for (const shape of parts) {
      const key = shape.properties[by];
      if (!key) continue; // a unit with no group: its area goes to its neighbours below
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(unwrap(asMulti(shape.geometry)));
    }
    units = [...groups].map(([group, shapes]) => ({ name: group, kind, shape: clipping.union(...shapes) }));
  } else {
    units = parts.map((shape) => ({ name: shape.properties.name ?? '', kind: (shape.properties.type_en || 'Division').split('|')[0], shape: unwrap(asMulti(shape.geometry)) }));
  }

  // Clip each to the plate. A unit keeps its largest part however small; its other parts must be
  // land-sized, not slivers of a coastline. A unit wholly outside the 1:110m outline is left out.
  // Units can overlap in Natural Earth (US states over the Great Lakes), so each also gives up whatever
  // an earlier one already holds: the pieces never stack.
  const minimum = 0.004; // square degrees
  const left = [];
  let taken = [];
  units = units
    .map((unit) => {
      const inside = clipping.intersection(unit.shape, plate);
      const clipped = (taken.length ? clipping.difference(inside, taken) : inside).sort((a, b) => planarArea(b) - planarArea(a));
      taken = clipping.union(taken, inside);
      const kept = clipped.filter((polygon, i) => planarArea(polygon) > (i === 0 ? 1e-7 : minimum));
      if (!kept.length) left.push(unit.name || '(a unit with no name)');
      return { ...unit, shape: kept };
    })
    .filter((unit) => unit.shape.length);
  if (units.length < 2) return `${units.length} unit inside the 1:110m outline`;

  // Whatever of the plate no unit covers goes to the unit nearest it, so the pieces tile the plate.
  // Dust (under 10⁻⁷ square degrees, about a hectare) is not worth a union. Units are ranked by the
  // distance to their bounding box first, so only the near ones are measured exactly.
  const covered = clipping.union(...units.map((unit) => unit.shape));
  const boxes = units.map((unit) => boxOf(unit.shape));
  const adds = units.map(() => []);
  for (const gap of clipping.difference(plate, covered)) {
    if (planarArea(gap) < 1e-7) continue;
    const at = centroidOf(gap);
    const order = units.map((unit, k) => [boxDistance(at, boxes[k]), k]).sort((a, b) => a[0] - b[0]);
    let best = -1;
    let bestDistance = Infinity;
    for (const [near, k] of order) {
      if (near > bestDistance) break;
      const exact = distanceTo(at, units[k].shape);
      if (exact < bestDistance) {
        bestDistance = exact;
        best = k;
      }
    }
    adds[best].push(gap);
  }
  units.forEach((unit, k) => {
    if (adds[k].length) unit.shape = clipping.union(unit.shape, adds[k]);
  });

  const collection = {
    type: 'FeatureCollection',
    features: units.map((unit) => ({
      type: 'Feature',
      properties: {
        name: unit.name,
        kind: unit.kind,
        label: unit.label ?? (unit.name.length > SHORT ? unit.name.replace(/\s*\(.*\)\s*/g, ' ').trim() : unit.name),
        anchor: anchorOf(unit.shape)
      },
      geometry: windForD3(unit.shape)
    }))
  };

  return { units, left, collection };
}

fs.mkdirSync(OUT, { recursive: true });
if (!process.env.ONLY) for (const file of fs.readdirSync(OUT)) if (file.endsWith('.json')) fs.rmSync(path.join(OUT, file));

const index = {};
const report = [];
// ONLY=PAK,USA rebuilds just those countries (and leaves the others' files and index entries alone).
const only = process.env.ONLY ? new Set(process.env.ONLY.split(',')) : null;
if (only) Object.assign(index, JSON.parse(fs.readFileSync(path.join(here, 'index.json'), 'utf8')));

for (const country of countries) {
  const name = country.properties.name;
  if (only && !only.has(codeOf.get(ALIASES[name] ?? name))) continue;
  const code = codeOf.get(ALIASES[name] ?? name);
  const parts = code ? byCode.get(code) ?? [] : [];
  // Antarctica's units are territorial claims, not divisions of a country.
  if (code === 'ATA') {
    report.push(`${name}: not split (its units are territorial claims)`);
    continue;
  }
  if (!code || parts.length < 2) {
    report.push(`${name}: not split (${code ? `${parts.length} unit` : 'no Natural Earth code'})`);
    continue;
  }
  // Clipping can fail on near-coincident points (a known limit of floating-point clipping), so the
  // shapes are snapped to a grid first, and to a coarser one if that is not enough.
  let built = null;
  let failure = '';
  for (const [grid, share] of [
    [1e6, 1],
    [1e5, 0.3],
    [1e5, 0.1],
    [1e4, 0.04]
  ]) {
    try {
      built = cut(country, code, parts, grid, share);
      break;
    } catch (error) {
      failure = error.message;
    }
  }
  if (!built) {
    report.push(`${name}: not split (clipping failed: ${failure})`);
    continue;
  }
  if (typeof built === 'string') {
    report.push(`${name}: not split (${built})`);
    continue;
  }
  const { units, left, collection } = built;

  // One topology, so neighbours share their border; then thin the inner borders only.
  let topo = topology({ units: collection }, 1e6);
  topo = presimplify(topo);
  const uses = new Map();
  for (const geometry of topo.objects.units.geometries) {
    const arcs = geometry.type === 'Polygon' ? geometry.arcs.flat() : geometry.arcs.flat(2);
    for (const arc of arcs) {
      const at = arc < 0 ? ~arc : arc;
      uses.set(at, (uses.get(at) ?? 0) + 1);
    }
  }
  // Points on the plate's own outline (arcs only one unit uses) are kept whatever their weight.
  topo.arcs.forEach((arc, at) => {
    if (uses.get(at) === 1) for (const point of arc) point[2] = Infinity;
  });
  // Inner borders keep about as much detail as the 1:110m outline they meet: `quantile` is the share of points kept.
  topo = simplify(topo, quantile(topo, 0.12));
  for (const arc of topo.arcs) for (const point of arc) point.length = 2;
  topo = quantize(topo, 1e5);

  // Simplifying can leave dust: three- or four-point slivers where a coastline grazed the outline, some
  // turned inside out (d3 would read them as the whole sphere less a speck). They are dropped, though a
  // unit always keeps its largest part, and the topology is rebuilt from the cleaned, shared points.
  // A unit whose only part collapsed to nothing (a city district on a 1:110m plate) is left out too.
  const EARTH_KM = 6371.0088;
  const cleaned = feature(topo, topo.objects.units).features.map((piece) => {
    const polygons = asMulti(piece.geometry).filter((polygon) => polygon[0].length > 3);
    const sound = polygons.filter((polygon) => geoArea({ type: 'Polygon', coordinates: polygon }) < 2 * Math.PI && Math.abs(planarArea(polygon)) > 1e-6);
    const kept = sound.length ? sound : polygons.sort((a, b) => Math.abs(planarArea(b)) - Math.abs(planarArea(a))).slice(0, 1);
    return { ...piece, geometry: kept.length === 1 ? { type: 'Polygon', coordinates: kept[0] } : { type: 'MultiPolygon', coordinates: kept } };
  }).filter((piece) => {
    if (geoArea(piece) * EARTH_KM * EARTH_KM >= 1) return true;
    left.push(piece.properties.name);
    return false;
  });
  if (cleaned.length < 2) {
    report.push(`${name}: not split (${cleaned.length} unit large enough for the 1:110m plate)`);
    continue;
  }
  topo = topology({ units: { type: 'FeatureCollection', features: cleaned } }, 1e5);

  // Check the pieces add up to the plate.
  const pieces = feature(topo, topo.objects.units).features;
  const off = (pieces.reduce((sum, piece) => sum + geoArea(piece), 0) - geoArea(country)) / geoArea(country);
  const kinds = new Map();
  for (const unit of units) kinds.set(unit.kind, (kinds.get(unit.kind) ?? 0) + 1);
  const main = [...kinds].sort((a, b) => b[1] - a[1])[0][0];

  const file = `${code.toLowerCase()}.json`;
  fs.writeFileSync(path.join(OUT, file), JSON.stringify(topo));
  index[name] = { file, count: pieces.length, noun: plural(main) };
  report.push(
    `${name}: ${pieces.length} ${plural(main)}, ${(off * 100).toFixed(3)}% off the plate, ${fs.statSync(path.join(OUT, file)).size.toLocaleString('en')} bytes` +
      (left.length ? `; left out (too small for, or outside, the 1:110m outline): ${left.join(', ')}` : '')
  );
  if (Math.abs(off) > 0.005) report.push(`  ! ${name}: pieces are ${(off * 100).toFixed(2)}% off the plate's area`);
}

fs.writeFileSync(path.join(here, 'index.json'), `${JSON.stringify(index, null, 2)}\n`);
console.log(report.join('\n'));
const total = fs.readdirSync(OUT).reduce((sum, file) => sum + fs.statSync(path.join(OUT, file)).size, 0);
console.log(`\n${Object.keys(index).length} countries split, ${(total / 1024).toFixed(0)} KB in all`);
