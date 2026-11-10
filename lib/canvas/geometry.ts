export type Point = { x: number; y: number };

/** How far a wire's bezier handles reach out of its two ports. See `wirePath`. */
export function wireReach(from: Point, fromDir: number, to: Point, reachCap = Infinity) {
  const along = to.y - from.y;
  const across = to.x - from.x;
  const ahead = along * fromDir;
  const length = Math.hypot(along, across);
  return Math.min(
    ahead >= 0 ? Math.max(36, ahead * 0.5) : Math.max(80, -ahead * 0.6 + Math.abs(across) * 0.2),
    length * (ahead >= 0 ? 0.5 : 0.25),
    reachCap
  );
}

/**
 * A wire runs up and down: it leaves its output straight out of the port's edge and enters its
 * input the same way, like a node editor. `fromDir` and `toDir` are +1 for a port on a bottom edge,
 * -1 for one on a top edge.
 * The handles grow with the gap, and more when the input sits behind the output, so the wire
 * loops back instead of folding over itself. They never outgrow the distance between the ends,
 * so a short wire is a short line rather than a hook, and a wire pulled behind its port bends only
 * slightly that way. `reachCap` limits the handles further; a peer's wire may carry one.
 */
export function wirePath(from: Point, fromDir: number, to: Point, toDir: number, reachCap = Infinity) {
  const reach = wireReach(from, fromDir, to, reachCap);
  return `M${from.x} ${from.y} C${from.x} ${from.y + reach * fromDir} ${to.x} ${to.y + reach * toDir} ${to.x} ${to.y}`;
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
