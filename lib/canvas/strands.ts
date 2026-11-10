import type { Point } from 'lib/canvas/geometry';

export type Rgb = [number, number, number];

/** Gold, orange, red, magenta, violet: across the bundle, as lit strands on a dark page. */
export const PALETTE_DARK: Rgb[] = [
  [246, 211, 101],
  [240, 138, 75],
  [229, 72, 77],
  [214, 64, 159],
  [142, 78, 198]
];
/** The same run, deep enough to read as ink on a light page. */
export const PALETTE_LIGHT: Rgb[] = [
  [180, 83, 9],
  [194, 65, 12],
  [190, 18, 60],
  [162, 28, 175],
  [109, 40, 217]
];

/** One end of the bundle: where it attaches, which way it leaves, and the edge it fans along. */
export type StrandEnd = { at: Point; dir: Point; perp: Point; half: number };

export type Strand = {
  /** Place across the bundle, -1 to 1. */
  u: number;
  /** Added to the waist, so neighbours cross a little where the bundle is narrowest. */
  waist: number;
  /** 0.35 to 1: some strands are fainter than others. */
  level: number;
  /** A small head start or delay for every band of light on this strand. */
  lag: number;
};

/** The bundle's width at its middle, as a share of the fan, measured across the way it is flowing. */
const MID = 0.2;
/** The same for a wire that loops back on itself, where the inner control points sit across its ends' edge. */
/** The inner control points carry 0.75 of the middle between them, so this share moves it one for one. */
const SWAY_SHARE = 1 / 0.75;
const LOOP_WAIST = -0.12;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Deterministic, so the server, the client and every remount agree. */
export function createStrands(count: number, seed = 7): Strand[] {
  const rand = mulberry32(seed);
  const strands: Strand[] = [];
  for (let i = 0; i < count; i++) {
    strands.push({
      u: -1 + (2 * (i + 0.5 + (rand() - 0.5) * 0.7)) / count,
      waist: (rand() - 0.5) * 0.2,
      level: 0.35 + rand() * 0.65,
      lag: (rand() - 0.5) * 0.03
    });
  }
  return strands;
}

/** Linear interpolation along the palette for `t` in 0..1, written into `out`. */
export function paletteAt(palette: Rgb[], t: number, out: Rgb): Rgb {
  const x = Math.min(1, Math.max(0, t)) * (palette.length - 1);
  const i = Math.min(palette.length - 2, Math.floor(x));
  const f = x - i;
  const p = palette[i];
  const q = palette[i + 1];
  out[0] = p[0] + (q[0] - p[0]) * f;
  out[1] = p[1] + (q[1] - p[1]) * f;
  out[2] = p[2] + (q[2] - p[2]) * f;
  return out;
}

/** Half the width of the fan at a card edge; it grows with the wire, up to `max`. */
export function fanHalf(length: number, max: number) {
  return Math.min(max, Math.max(6, length * 0.26));
}

/**
 * Samples one strand's cubic bezier at `segments + 1` points into `out` as x0, y0, x1, y1, ...
 * `flip` is -1 when both ends leave the same way (a wire looping out of and back into right edges),
 * so a strand on the outside at one end stays outside at the other. `lane` is 0 for an ordinary wire
 * and +/-1 for a looping one, so outer strands swing wider than inner ones instead of crossing them.
 * The middle of an ordinary bundle is spread across its flow (not along the card edge), so a slanted run
 * stays a ribbon of separate strands instead of collapsing to a line. `swayX`/`swayY` is how far the
 * bundle's middle currently hangs behind where it would rest.
 */
export function strandPoints(
  out: Float32Array,
  a: StrandEnd,
  b: StrandEnd,
  strand: Strand,
  reach: number,
  flip: 1 | -1,
  lane: number,
  segments: number,
  swayX = 0,
  swayY = 0
): void {
  const ua = strand.u * a.half;
  const ub = strand.u * flip * b.half;
  const r = Math.max(4, reach + lane * strand.u * a.half);
  const x0 = a.at.x + a.perp.x * ua;
  const y0 = a.at.y + a.perp.y * ua;
  let x1: number;
  let y1: number;
  let x2: number;
  let y2: number;
  if (flip === 1) {
    // The chord from end to end, and the unit normal to it on the same side as a's edge direction.
    const cx = b.at.x - a.at.x;
    const cy = b.at.y - a.at.y;
    const len = Math.hypot(cx, cy) || 1;
    let nx = -cy / len;
    let ny = cx / len;
    let cos = nx * a.perp.x + ny * a.perp.y;
    if (cos < 0) {
      nx = -nx;
      ny = -ny;
      cos = -cos;
    }
    // A strand's offset at the middle is 0.25 of its end offsets (seen at `cos` across the flow) plus
    // 0.75 of its inner ones; solve for the inner share that leaves MID of the fan there.
    const w = (MID - 0.25 * cos) / 0.75 + strand.waist * 0.6;
    x1 = a.at.x + a.dir.x * r + nx * ua * w;
    y1 = a.at.y + a.dir.y * r + ny * ua * w;
    x2 = b.at.x + b.dir.x * r + nx * ub * w;
    y2 = b.at.y + b.dir.y * r + ny * ub * w;
  } else {
    // P1 and P2 are pulled across the centre line (w is negative), which pinches the middle of the bundle.
    const w = LOOP_WAIST + strand.waist;
    x1 = a.at.x + a.dir.x * r + a.perp.x * ua * w;
    y1 = a.at.y + a.dir.y * r + a.perp.y * ua * w;
    x2 = b.at.x + b.dir.x * r + b.perp.x * ub * w;
    y2 = b.at.y + b.dir.y * r + b.perp.y * ub * w;
  }
  // The middle trails the ends when they move; fainter strands trail a little less, so the ribbon
  // twists as it swings instead of sliding as one sheet.
  const trail = SWAY_SHARE * (0.8 + 0.4 * strand.level);
  x1 += swayX * trail;
  y1 += swayY * trail;
  x2 += swayX * trail;
  y2 += swayY * trail;
  const x3 = b.at.x + b.perp.x * ub;
  const y3 = b.at.y + b.perp.y * ub;
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const m = 1 - t;
    const c0 = m * m * m;
    const c1 = 3 * m * m * t;
    const c2 = 3 * m * t * t;
    const c3 = t * t * t;
    out[i * 2] = c0 * x0 + c1 * x1 + c2 * x2 + c3 * x3;
    out[i * 2 + 1] = c0 * y0 + c1 * y1 + c2 * y2 + c3 * y3;
  }
}
