import {
  circleRing,
  cylinder,
  dotsSvg,
  extrude,
  fitProjection,
  iso,
  knurl,
  lineSvg,
  onTop,
  pathOf,
  radialTicks,
  ring,
  sideArc,
  slabOf,
  solidSvg,
  type Flat,
  type Point3,
  type Projection
} from './iso-kit';
import { CENTER, COLUMN_TOP, CRADLE_BASE, LIFT, PLATE, R, RING_H, RING_IN, RING_OUT, add, basisOf, dot, frameOf, norm, scale, type Vec } from './globe';

/**
 * The desk stand, drawn once with the Anatomy kit: four bun feet, a turned plinth with a compass rose,
 * a baluster column with a knurled lock collar, and a cradle whose two cheeks hold the meridian ring.
 * The ring and the pole hardware depend on the tilt, so they are built per tilt and sorted with the plates.
 */

export const WIDTH = 720;
export const HEIGHT = 780;

const PLINTH_R = 64;
const STEP_R = 54;
const CHEEK = { x: -13, w: 26, y: RING_H / 2, d: 4 };
const CHEEK_TOP = COLUMN_TOP + CRADLE_BASE + 10;

/** One camera for every tilt and every plate pulled out, so nothing moves when the ring slides. */
export const P: Projection = (() => {
  const unit: Projection = { origin: [0, 0], scale: 1 };
  const { right, up } = basisOf(unit);
  const reach = R + PLATE + LIFT + 2;
  const points: Point3[] = [];
  for (let i = 0; i < 24; i++) {
    const t = (i / 24) * Math.PI * 2;
    points.push([Math.cos(t) * PLINTH_R, Math.sin(t) * PLINTH_R, 0]);
    points.push([CENTER[0] + Math.cos(t) * (RING_OUT + 8), 0, CENTER[2] + Math.sin(t) * (RING_OUT + 8)]);
  }
  for (const axis of [right, up]) for (const sign of [1, -1]) points.push(add(CENTER as Vec, scale(axis, sign * reach)) as Point3);
  return fitProjection(points, WIDTH, HEIGHT, { pad: 18 });
})();

const BASIS = basisOf(P);
/** Light from the upper left, a little toward the viewer: the side tones of round parts come from it. */
const LIGHT = norm(add(add(scale(BASIS.toward, 0.55), scale(BASIS.up, 0.7)), scale(BASIS.right, -0.45)));
const bucket = (normal: Vec) => Math.max(0, Math.min(3, Math.floor(((dot(normal, LIGHT) + 1) / 2) * 4)));

export const at = (point: Vec | Point3): Flat => iso(point as Point3, P);
const k = (Math.sqrt(1.6) * P.scale);
/** Screen units per world unit. */
export const K = k;
export const CENTER_FLAT = at(CENTER);

// ── Round parts along any axis ───────────────────────────────────────────────

function hull(points: Flat[]): Flat[] {
  const sorted = [...points].sort((p, q) => p[0] - q[0] || p[1] - q[1]);
  const turn = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: Flat[] = [];
  for (const p of sorted) {
    while (lower.length >= 2 && turn(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: Flat[] = [];
  for (const p of sorted.reverse()) {
    while (upper.length >= 2 && turn(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/** Two unit vectors square to `axis`. */
function across(axis: Vec): [Vec, Vec] {
  const helper: Vec = Math.abs(axis[2]) < 0.9 ? [0, 0, 1] : [1, 0, 0];
  const u = norm([axis[1] * helper[2] - axis[2] * helper[1], axis[2] * helper[0] - axis[0] * helper[2], axis[0] * helper[1] - axis[1] * helper[0]]);
  const w: Vec = [axis[1] * u[2] - axis[2] * u[1], axis[2] * u[0] - axis[0] * u[2], axis[0] * u[1] - axis[1] * u[0]];
  return [u, w];
}

const circleAt = (center: Vec, u: Vec, w: Vec, radius: number, steps = 40): Flat[] =>
  Array.from({ length: steps }, (_, i) => {
    const t = (i / steps) * Math.PI * 2;
    return at(add(center, add(scale(u, Math.cos(t) * radius), scale(w, Math.sin(t) * radius))));
  });

/**
 * A disc, boss, nut or rod turned on `axis` from `s0` to `s1` past `origin`: the side as the hull of
 * its two end circles, toned by how the side faces the light, and the end that faces the viewer.
 */
export function discAlong(origin: Vec, axis: Vec, radius: number, s0: number, s1: number, { tone = 'mid', dot: center = false } = {}) {
  const [u, w] = across(axis);
  const a = add(origin, scale(axis, s0));
  const b = add(origin, scale(axis, s1));
  const outline = pathOf(hull([...circleAt(a, u, w, radius), ...circleAt(b, u, w, radius)]), true);
  const front = dot(axis, BASIS.toward) >= 0 ? b : a;
  const cap = pathOf(circleAt(front, u, w, radius), true);
  // The side's tone: the radial direction that faces the light most.
  const side = norm(add(LIGHT, scale(axis, -dot(LIGHT, axis))));
  const shade = Math.max(0, bucket(side) - 1);
  const capShade = bucket(dot(axis, BASIS.toward) >= 0 ? axis : scale(axis, -1));
  return (
    `<g class="iso-solid"><path class="iso-fill" d="${outline}"/><path class="iso-shade" data-shade="${shade}" d="${outline}"/>` +
    `<path class="iso-shade" data-shade="${capShade}" d="${cap}"/><path class="iso-line iso-crease" data-tone="faint" d="${cap}"/>` +
    `<path class="iso-line iso-edge" data-tone="${tone}" d="${outline}"/></g>` +
    (center ? dotsSvg([at(front)], { size: 0.5, tone: 'mid' }) : '')
  );
}

// ── The stand ────────────────────────────────────────────────────────────────

const screw = (x: number, y: number, z: number) => lineSvg(ring(x, y, 1.15, z, P, 14), { tone: 'lo' }) + dotsSvg([at([x, y, z])], { size: 0.5, tone: 'mid' });

function labelPlate() {
  const angle = Math.atan2(BASIS.toward[1], BASIS.toward[0]);
  const radial: Vec = [Math.cos(angle), Math.sin(angle), 0];
  const tangent: Vec = [-radial[1], radial[0], 0];
  const middle = scale(radial, (PLINTH_R + STEP_R) / 2);
  const corner = (t: number, r: number): [number, number] => {
    const p = add(middle, add(scale(tangent, t), scale(radial, r)));
    return [p[0], p[1]];
  };
  const z = 14;
  const plate = extrude([corner(-8, -2.8), corner(8, -2.8), corner(8, 2.8), corner(-8, 2.8)], z, 0.8, P, { bevel: 0.4 });
  const rule = (r: number, from: number, to: number) => {
    const [x0, y0] = corner(from, r);
    const [x1, y1] = corner(to, r);
    return lineSvg(pathOf([at([x0, y0, z + 0.8]), at([x1, y1, z + 0.8])]), { tone: 'lo', free: true });
  };
  const screws = [corner(-6.6, 0), corner(6.6, 0)].map(([x, y]) => dotsSvg([at([x, y, z + 0.8])], { size: 0.45, tone: 'hi' }));
  return solidSvg(plate, { tone: 'mid' }) + rule(-1.2, -4.6, 4.6) + rule(0, -4.6, 2.4) + rule(1.2, -4.6, 3.6) + screws.join('');
}

function cheek(y: number) {
  return slabOf({ x: CHEEK.x, y, w: CHEEK.w, d: CHEEK.d, r: 1.2 }, COLUMN_TOP + CRADLE_BASE, CHEEK_TOP - COLUMN_TOP - CRADLE_BASE, P, 3, 0.5);
}

/** Everything below the ball that never moves, back to front, ending with the cradle's back cheek. */
export const STAND_BACK = (() => {
  const parts: string[] = [];
  parts.push(`<path class="iso-halo" d="${cylinder(0, 0, PLINTH_R + 4, 0, 2, P, 72).fill}"/>`);
  const feet = [0, 1, 2, 3]
    .map((i) => [Math.cos((i * Math.PI) / 2) * 50, Math.sin((i * Math.PI) / 2) * 50])
    .sort((p, q) => p[0] + p[1] - (q[0] + q[1]));
  for (const [x, y] of feet) parts.push(solidSvg(cylinder(x, y, 6, 0, 4, P, 24, 0.4), { tone: 'lo' }));
  parts.push(solidSvg(cylinder(0, 0, PLINTH_R, 4, 10, P, 72, 1.2), { tone: 'mid', inner: lineSvg(sideArc(0, 0, PLINTH_R, 9, P, 40), { tone: 'faint' }) }));
  for (const angle of [135, 225, 315]) {
    const t = (angle * Math.PI) / 180;
    parts.push(screw(Math.cos(t) * 59, Math.sin(t) * 59, 14));
  }
  parts.push(labelPlate());
  parts.push(solidSvg(cylinder(0, 0, STEP_R, 14, 5, P, 64, 0.8), { tone: 'mid' }));
  const rose = radialTicks(0, 0, 51, 72, 9, 19, [1.8, 3.8], P);
  parts.push(lineSvg(onTop(circleRing(0, 0, 51, 96), 19, P, true), { tone: 'lo' }), lineSvg(onTop(circleRing(0, 0, 43.5, 96), 19, P, true), { tone: 'faint' }));
  parts.push(lineSvg(rose.minor, { tone: 'lo', free: 'start' }), lineSvg(rose.major, { tone: 'mid', free: 'start' }));
  // A baluster: foot collar, waist, knurled lock collar, neck and top collar under the cradle.
  parts.push(solidSvg(cylinder(0, 0, 18, 19, 6, P, 48, 0.8), { tone: 'mid', inner: lineSvg(sideArc(0, 0, 18, 22, P), { tone: 'faint' }) }));
  parts.push(solidSvg(cylinder(0, 0, 8.5, 25, 7, P, 32, 0.5), { tone: 'mid' }));
  parts.push(solidSvg(cylinder(0, 0, 6, 32, 28, P, 28), { tone: 'mid' }));
  parts.push(solidSvg(cylinder(0, 0, 9.5, 60, 8, P, 36, 0.4), { tone: 'mid', inner: lineSvg(knurl(0, 0, 9.5, 60, 68, 40, P), { tone: 'faint' }) }));
  parts.push(solidSvg(cylinder(0, 0, 6, 68, 30, P, 28), { tone: 'mid' }));
  parts.push(solidSvg(cylinder(0, 0, 7.5, 98, 6, P, 28, 0.4), { tone: 'mid' }));
  parts.push(solidSvg(cylinder(0, 0, 10.5, 104, COLUMN_TOP - 104, P, 36, 0.6), { tone: 'mid', inner: lineSvg(sideArc(0, 0, 10.5, 108, P), { tone: 'faint' }) }));
  parts.push(solidSvg(slabOf({ x: CHEEK.x, y: -CHEEK.y - CHEEK.d, w: CHEEK.w, d: (CHEEK.y + CHEEK.d) * 2, r: 1.2 }, COLUMN_TOP, CRADLE_BASE, P, 3, 0.6), { tone: 'mid' }));
  parts.push(solidSvg(cheek(-CHEEK.y - CHEEK.d), { tone: 'mid' }));
  parts.push(screw(-9, -CHEEK.y - CHEEK.d / 2, CHEEK_TOP), screw(9, -CHEEK.y - CHEEK.d / 2, CHEEK_TOP));
  return parts.join('');
})();

/** The cradle's front cheek and its clamp screw, in front of the ring where it sits in the slot. */
export const STAND_FRONT = (() => {
  const parts: string[] = [];
  parts.push(solidSvg(cheek(CHEEK.y), { tone: 'mid' }));
  parts.push(screw(-9, CHEEK.y + CHEEK.d / 2, CHEEK_TOP), screw(9, CHEEK.y + CHEEK.d / 2, CHEEK_TOP));
  const face: Vec = [0, CHEEK.y + CHEEK.d, (COLUMN_TOP + CRADLE_BASE + CHEEK_TOP) / 2];
  parts.push(discAlong(face, [0, 1, 0], 2.2, 0, 2.2));
  parts.push(discAlong(face, [0, 1, 0], 4.2, 2.2, 5.4, { dot: true }));
  return parts.join('');
})();

// ── The meridian ring ────────────────────────────────────────────────────────

export interface Piece {
  svg: string;
  /** Nearness to the viewer, measured from the ball's centre. */
  depth: number;
  /** Where the piece is around the ring, from the North Pole toward `b`, in degrees. */
  theta: number;
}

const SPAN = 5;
const SUB = 4;
const C = CENTER as Vec;

function ringPoint(tilt: number, theta: number, radius: number, side: number): Vec {
  const { a, b, n } = frameOf(tilt);
  const t = (theta * Math.PI) / 180;
  return add(C, add(add(scale(a, Math.cos(t) * radius), scale(b, Math.sin(t) * radius)), scale(n, (side * RING_H) / 2)));
}

const arc = (tilt: number, radius: number, side: number, from: number, to: number) =>
  Array.from({ length: SUB + 1 }, (_, i) => at(ringPoint(tilt, from + ((to - from) * i) / SUB, radius, side)));

/**
 * The ring as 72 pieces of 5°, each drawn on its own so it can sort with the plates: its flat face
 * (always toward the viewer), the outer or inner rim where that faces the viewer, and a degree scale of
 * latitude, longest at the poles and the equator, longer every 15°.
 */
export function ringPieces(tilt: number): Piece[] {
  const { a, b, n } = frameOf(tilt);
  const faceShade = bucket(n);
  const pieces: Piece[] = [];
  for (let i = 0; i < 360 / SPAN; i++) {
    const t0 = i * SPAN;
    const t1 = t0 + SPAN;
    const middle = ((t0 + SPAN / 2) * Math.PI) / 180;
    const radial = add(scale(a, Math.cos(middle)), scale(b, Math.sin(middle)));
    const outward = dot(radial, BASIS.toward) > 0;
    const rimR = outward ? RING_OUT : RING_IN;
    const rimShade = bucket(outward ? radial : scale(radial, -1));
    // Fills overlap their neighbours by a hair so no seam shows between pieces.
    const face = [...arc(tilt, RING_OUT, 1, t0 - 0.3, t1 + 0.3), ...arc(tilt, RING_IN, 1, t1 + 0.3, t0 - 0.3)];
    const rim = [...arc(tilt, rimR, 1, t0 - 0.3, t1 + 0.3), ...arc(tilt, rimR, -1, t1 + 0.3, t0 - 0.3)];
    const latitude = 90 - Math.min(t0, 360 - t0);
    const length = latitude % 90 === 0 ? 6 : latitude % 15 === 0 ? 4 : 2.2;
    const tick = pathOf([at(ringPoint(tilt, t0, RING_OUT, 1)), at(ringPoint(tilt, t0, RING_OUT - length, 1))]);
    const svg =
      `<g class="iso-solid"><path class="iso-shade" data-shade="${rimShade}" d="${pathOf(rim, true)}"/>` +
      `<path class="iso-shade" data-shade="${faceShade}" d="${pathOf(face, true)}"/></g>` +
      lineSvg(tick, { tone: length > 3 ? 'mid' : 'lo', free: 'end' }) +
      lineSvg(pathOf(arc(tilt, rimR, -1, t0, t1)), { tone: 'lo' }) +
      lineSvg(pathOf(arc(tilt, RING_IN, 1, t0, t1)), { tone: 'mid' }) +
      lineSvg(pathOf(arc(tilt, RING_OUT, 1, t0, t1)), { tone: 'mid' });
    pieces.push({ svg, depth: dot(radial, BASIS.toward) * ((RING_IN + RING_OUT) / 2), theta: t0 + SPAN / 2 });
  }
  return pieces;
}

// ── Pole hardware ────────────────────────────────────────────────────────────

export const DIAL_R = 15;
const DIAL_FACE = RING_OUT + 3.4;

/**
 * The pins at each pole, in two parts: what sits between the ball and the ring (a collar on the ball,
 * the axle and an inner boss), and what sits outside it (a boss on the rim, the hour circle at the
 * North Pole, and a cap nut). Each list runs from far to near.
 */
export function poleParts(tilt: number) {
  const { a } = frameOf(tilt);
  const south = scale(a, -1);
  // The South Pole's pins face away from the viewer, so the inner boss is drawn first and the collar last.
  const southInner =
    discAlong(C, south, 4.4, RING_IN - 2, RING_IN) + discAlong(C, south, 1.5, R + 1.4, RING_IN - 2) + discAlong(C, south, 3.4, R - 0.6, R + 1.4);
  const dialTicks = (() => {
    const [u, w] = across(a);
    const face = add(C, scale(a, DIAL_FACE));
    const minor: string[] = [];
    const major: string[] = [];
    for (let hour = 0; hour < 24; hour++) {
      const t = (hour / 24) * Math.PI * 2;
      const dir = add(scale(u, Math.cos(t)), scale(w, Math.sin(t)));
      const long = hour % 6 === 0;
      (long ? major : minor).push(pathOf([at(add(face, scale(dir, DIAL_R))), at(add(face, scale(dir, DIAL_R - (long ? 3.4 : 1.8))))]));
    }
    return lineSvg(minor.join(''), { tone: 'lo' }) + lineSvg(major.join(''), { tone: 'mid' });
  })();
  return {
    northInner: discAlong(C, a, 3.4, R - 0.6, R + 1.4, { dot: true }) + discAlong(C, a, 1.5, R + 1.4, RING_IN - 2) + discAlong(C, a, 4.4, RING_IN - 2, RING_IN),
    northOuter: discAlong(C, a, 5.5, RING_OUT, RING_OUT + 2) + discAlong(C, a, DIAL_R, RING_OUT + 2, DIAL_FACE) + dialTicks,
    northCap: discAlong(C, a, 3.2, DIAL_FACE, DIAL_FACE + 3, { dot: true, tone: 'hi' }),
    southInner,
    southOuter: discAlong(C, south, 3.2, RING_OUT + 2, RING_OUT + 5) + discAlong(C, south, 5.5, RING_OUT, RING_OUT + 2)
  };
}

/** The hour circle's pointer, fixed to the axle so it turns with the ball: it points at the Greenwich meridian. */
export function pointerPath(tilt: number, greenwich: Vec) {
  const { a } = frameOf(tilt);
  const face = add(C, scale(a, DIAL_FACE));
  const dir = norm(add(greenwich, scale(a, -dot(greenwich, a))));
  return pathOf([at(add(face, scale(dir, 3.4))), at(add(face, scale(dir, DIAL_R - 4.4)))]);
}
