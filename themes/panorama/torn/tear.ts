/**
 * A point on a tear, in seam space: `[offset, along]`, both in px. `offset` is across the seam,
 * from its centre line (the middle of the gap between two sections); `along` runs down a vertical
 * seam, or across a horizontal one on narrow screens.
 */
export type Point = [number, number];

/** Seams are drawn this long, so they cross any panel; the panel clips the rest. */
export const TEAR_H = 1600;
const OUT = 24; // how far an outer edge's clip reaches past the sheet
const FAR = 4000;

/** Deterministic noise in [0, 1), so a tear is identical on the server and in the browser. */
export function noise(a: number, b: number) {
  let h = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * A tear along a seam, built like Midnight's tiles at sheet scale: a slow wander across the centre
 * line, an irregular zigzag on top (runs of one to four steps, each its own depth) and fibre jitter
 * on that. Every number is in px, so the tear keeps its shape however the sections resize.
 */
export function tearOf(seed: number, length = TEAR_H): Point[] {
  const knots = Math.max(3, Math.round(length / 160));
  const wanders = Array.from({ length: knots + 1 }, (_, k) => (noise(seed, k) - 0.5) * 22);
  const points: Point[] = [];
  let dir = 1;
  let run = 0;
  let len = 1;
  for (let y = -6, i = 0; y <= length + 6; i++) {
    const t = Math.max(0, Math.min(knots - 0.001, (y / length) * knots));
    const k = Math.floor(t);
    const f = t - k;
    const ease = f * f * (3 - 2 * f);
    const wander = wanders[k] * (1 - ease) + wanders[k + 1] * ease;
    if (run >= len) {
      dir = -dir;
      run = 0;
      len = 1 + Math.floor(noise(seed, 80 + i) * 4);
    }
    run++;
    const zig = dir * (1.2 + noise(seed, 50 + i) * 5) * (run / len);
    const fibre = (noise(seed, 200 + i) - 0.5) * 1.4;
    points.push([wander + zig + fibre, y]);
    y += 4 + noise(seed, 300 + i) * 8;
  }
  return points;
}

const fixed = (value: number) => value.toFixed(2);

const fibresCache = new WeakMap<Point[], Map<number, string>>();

/** Fine fibres standing off the exposed edge, as on torn card, as one path. Built once per tear. */
export function fibresOf(seed: number, tear: Point[]) {
  let bySeed = fibresCache.get(tear);
  if (!bySeed) fibresCache.set(tear, (bySeed = new Map()));
  let path = bySeed.get(seed);
  if (path === undefined) {
    path = tear
      .flatMap(([x, y], i) => {
        if (i % 2 || noise(seed, 400 + i) < 0.5) return [];
        const length = 1.6 + noise(seed, 420 + i) * 3.4;
        const angle =
          (noise(seed, 440 + i) - 0.5) * 1.4 + (noise(seed, 460 + i) < 0.5 ? Math.PI : 0);
        const [x2, y2] = [x + Math.cos(angle) * length, y + Math.sin(angle) * length];
        return [`M${fixed(x)} ${fixed(y)}L${fixed(x2)} ${fixed(y2)}`];
      })
      .join('');
    bySeed.set(seed, path);
  }
  return path;
}

const pointsCache = new WeakMap<Point[], string>();

/** A tear as SVG points. Tears never change, so each is written out once and reused. */
export function pointsOf(tear: Point[]) {
  let points = pointsCache.get(tear);
  if (points === undefined) {
    points = tear.map(([x, y]) => `${fixed(x)},${fixed(y)}`).join(' ');
    pointsCache.set(tear, points);
  }
  return points;
}

/** Where the tear crosses `along`, in px from the seam's centre line. */
export function xAt(tear: Point[], along: number) {
  for (let i = 1; i < tear.length; i++) {
    const [x, y] = tear[i];
    if (y < along) continue;
    const [px, py] = tear[i - 1];
    return px + ((x - px) * (along - py)) / (y - py || 1);
  }
  return tear[tear.length - 1][0];
}

export type Axis = 'v' | 'h';

/**
 * One torn edge of a piece: its tear and how far the piece's edge stands back from the seam's
 * centre line (`gap(along)`, px). Two neighbours draw the same tear with the same gap, one on
 * each side, so their edges always match.
 */
export type Edge = { tear: Point[]; gap: (along: number) => number };

/** How far a seam's gap strip reaches either side of its centre line, px (see `.gap`). */
const PAD = 40;

/**
 * A seam's gap as a CSS clip path for its strip: the band between the two torn edges, each the
 * tear stood back from the centre line by the gap. It lies along the seam, in px from the strip's
 * own left and top, so it never changes while the sections resize and animates cheaply while the
 * seam welds; shut, it has no width at all.
 */
export function gapShape(edge: Edge, limit = TEAR_H) {
  const points = edge.tear.filter((_, i) => i === 0 || edge.tear[i - 1][1] <= limit + 12);
  const run = (side: 1 | -1) => {
    const [x0] = points[0];
    const [xn] = points[points.length - 1];
    const at = (x: number, along: number, y: number) =>
      `${fixed(PAD + x + side * edge.gap(along))}px ${fixed(y)}px`;
    return [at(x0, 0, -OUT), ...points.map(([x, y]) => at(x, y, y)), at(xn, limit, FAR)];
  };
  return `polygon(${[...run(-1), ...run(1).reverse()].join(', ')})`;
}
