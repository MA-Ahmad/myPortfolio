import { cylinder, depthOf, haloOf, insetPlan, iso, lineOnTop, lineSvg, pathOf, planOutline, ring, sideArc, slabOf, solidSvg, type Plan, type Projection } from './iso-kit';

/**
 * A robot tray: a round drive base (round, so it looks the same whichever way it faces) with a
 * bumper skirt and a lit status band, a lift column, and a square deck that stays square to the
 * floor grid while the base turns under it, like a warehouse drive unit under its pod. The slip it
 * carries lies on the deck. No wheels show: the drive is under the skirt.
 *
 * Built once per camera at the origin; each tray is the same markup moved into place.
 */

export const BODY_R = 7;
const SKIRT_Z = 0.6;
const SKIRT_H = 1.8;
const BODY_Z = SKIRT_Z + SKIRT_H;
const BODY_H = 3.6;
export const BODY_TOP = BODY_Z + BODY_H;
/** The deck rests just above the body and lifts this far to hand a slip into a machine. */
export const DECK_REST = BODY_TOP + 0.9;
export const DECK_LIFT = 5;
const DECK: Plan = { x: -6.4, y: -6.4, w: 12.8, d: 12.8, r: 1.4 };
const DECK_H = 1.2;
const SLIP: Plan = { x: -4, y: -3, w: 8, d: 6, r: 0.6 };
const SLIP_H = 0.5;
/** A join is a bundle: this many slips stacked. */
export const BUNDLE = 4;
/** Box of a tray for the painter's sort, at its highest lift. */
export const TRAY_TOP = DECK_REST + DECK_LIFT + DECK_H + SLIP_H * BUNDLE + 1;

export type RobotArt = {
  base: string;
  deck: string;
  slip: string;
  bundle: string;
};

export function robotArt(P: Projection): RobotArt {
  const skirt = solidSvg(cylinder(0, 0, BODY_R + 0.4, SKIRT_Z, SKIRT_H, P, 28, 0.3), { tone: 'lo', crease: 'none' });
  const body = solidSvg(cylinder(0, 0, BODY_R, BODY_Z, BODY_H, P, 32, 0.5), {
    tone: 'hi',
    inner: `<path class="iso-line cp-band" d="${sideArc(0, 0, BODY_R + 0.02, BODY_Z + BODY_H * 0.45, P, 24)}"/>`
  });
  const top = lineSvg(ring(0, 0, BODY_R - 1.6, BODY_TOP, P, 28), { tone: 'faint' });
  // A ring on the floor under the tray, lit in its lamp's colour when something is wrong.
  const status = `<path class="cp-tray-ring" d="${ring(0, 0, BODY_R + 2.6, 0.05, P, 32)}"/>`;
  const base = `${status}<path class="iso-halo" d="${haloOf({ x: -BODY_R, y: -BODY_R, w: BODY_R * 2, d: BODY_R * 2, r: BODY_R }, 0, 1, P)}"/>${skirt}${body}${top}`;
  const rim = insetPlan(DECK, 1.2);
  const deck = solidSvg(slabOf(DECK, DECK_REST, DECK_H, P, 4, 0.4), {
    tone: 'hi',
    inner:
      lineSvg(planOutline(rim, DECK_REST + DECK_H, P, 4), { tone: 'faint' }) +
      lineSvg(lineOnTop([DECK.x + 1.6, DECK.y + DECK.d - 2.2], [DECK.x + 4.4, DECK.y + DECK.d - 2.2], DECK_REST + DECK_H, P), { tone: 'lo', free: true })
  });
  const slipAt = (z: number) =>
    solidSvg(slabOf(SLIP, z, SLIP_H, P, 4, 0.1), {
      tone: 'hi',
      lit: true,
      inner: lineSvg(lineOnTop([SLIP.x + 1.4, 0], [SLIP.x + SLIP.w - 2.4, 0], z + SLIP_H, P), { tone: 'lo', free: true })
    });
  const slip = `<g class="cp-slip">${slipAt(DECK_REST + DECK_H)}</g>`;
  const bundle = `<g class="cp-slip">${Array.from({ length: BUNDLE }, (_, i) => `<g transform="${shift(P, i * 0.35, -i * 0.25)}">${slipAt(DECK_REST + DECK_H + i * SLIP_H)}</g>`).join('')}</g>`;
  return { base, deck, slip, bundle };
}

/** A small offset on the floor plane as a transform. */
function shift(P: Projection, dx: number, dy: number) {
  const a = iso([0, 0, 0], P);
  const b = iso([dx, dy, 0], P);
  return `translate(${(b[0] - a[0]).toFixed(2)} ${(b[1] - a[1]).toFixed(2)})`;
}

/** The lift column between body and deck, `lift` units out. */
export function columnOf(lift: number, P: Projection) {
  if (lift < 0.2) return '';
  return solidSvg(cylinder(0, 0, 2.2, BODY_TOP, lift + 0.9, P, 16, 0.2), { tone: 'mid', crease: 'none' });
}

/** Where the sensor eye on the band sits for a heading, and whether it faces the viewer. */
export function eyeOf(heading: number, P: Projection): { x: number; y: number; shown: boolean } {
  const nx = Math.cos(heading);
  const ny = Math.sin(heading);
  const [x, y] = iso([nx * (BODY_R + 0.05), ny * (BODY_R + 0.05), BODY_Z + BODY_H * 0.45], P);
  const facing = depthOf([nx, ny, 0], P) - depthOf([0, 0, 0], P) > 0.12;
  return { x, y, shown: facing };
}

/** A short arc of the band either side of the eye: the direction lamp. */
export function lampOf(heading: number, P: Projection) {
  const points = [];
  for (let i = -3; i <= 3; i++) {
    const a = heading + i * 0.12;
    const nx = Math.cos(a);
    const ny = Math.sin(a);
    if (depthOf([nx, ny, 0], P) - depthOf([0, 0, 0], P) <= 0.05) continue;
    points.push(iso([nx * (BODY_R + 0.05), ny * (BODY_R + 0.05), BODY_Z + BODY_H * 0.45], P));
  }
  return points.length > 1 ? pathOf(points) : '';
}
