export type Point = { x: number; y: number };

export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);

export const lerp = (a: Point, b: Point, t: number): Point => ({
  x: a.x + (b.x - a.x) * t,
  y: a.y + (b.y - a.y) * t
});

/**
 * A wire leaves its output straight out of the port's edge and enters its input the same way,
 * like a node editor: `fromDir` and `toDir` are +1 for a port on a right edge, -1 for a left one.
 * The handles grow with the gap, and more when the input sits behind the output, so the wire
 * loops back instead of folding over itself.
 */
export function wirePath(from: Point, fromDir: number, to: Point, toDir: number) {
  const ahead = (to.x - from.x) * fromDir;
  const reach =
    ahead >= 0 ? Math.max(36, ahead * 0.5) : Math.max(80, -ahead * 0.6 + Math.abs(to.y - from.y) * 0.2);
  return `M${from.x} ${from.y} C${from.x + reach * fromDir} ${from.y} ${to.x + reach * toDir} ${to.y} ${to.x} ${to.y}`;
}

/**
 * A jagged bolt from `from` to `to`: each inner point is pushed sideways by up to `amplitude`,
 * most in the middle and none at the ends, so the bolt stays pinned to both.
 */
export function boltPoints(from: Point, to: Point, amplitude: number, segments = 8) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;
  const nx = -dy / length;
  const ny = dx / length;
  const points: Point[] = [from];
  for (let i = 1; i < segments; i++) {
    const t = i / segments;
    const push = (Math.random() * 2 - 1) * amplitude * Math.sin(Math.PI * t);
    points.push({ x: from.x + dx * t + nx * push, y: from.y + dy * t + ny * push });
  }
  points.push(to);
  return points;
}

export const pointsAttribute = (points: Point[]) =>
  points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');

export const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
export const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);
/** Settles past the target and back, for the snap onto a port. */
export const easeOutBack = (t: number) => 1 + 2.2 * (t - 1) ** 3 + 1.2 * (t - 1) ** 2;
