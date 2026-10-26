import { depthOf, iso, type Projection } from './iso-kit';

/**
 * Painter's order for any number of boxed items under any camera. Where two items overlap on
 * screen, an axis plane that separates their boxes in the world says which one is nearer; a
 * topological sort turns those pairs into one order. Ties keep the order the items were given in,
 * which is also the fallback if the pairs ever form a cycle.
 */

/** A world box: [x0, x1, y0, y1, z0, z1]. */
export type Box = [number, number, number, number, number, number];

type Bounds = { left: number; right: number; up: number; down: number };

function screenBounds([x0, x1, y0, y1, z0, z1]: Box, P: Projection): Bounds {
  let left = Infinity;
  let right = -Infinity;
  let up = Infinity;
  let down = -Infinity;
  for (const x of [x0, x1]) {
    for (const y of [y0, y1]) {
      for (const z of [z0, z1]) {
        const [sx, sy] = iso([x, y, z], P);
        if (sx < left) left = sx;
        if (sx > right) right = sx;
        if (sy < up) up = sy;
        if (sy > down) down = sy;
      }
    }
  }
  return { left, right, up, down };
}

const EPS = 1e-6;

/** −1: draw `a` first; 1: draw `b` first; 0: either way. */
function compare(a: Box, b: Box, sa: Bounds, sb: Bounds, view: [number, number, number]) {
  if (sa.right <= sb.left || sb.right <= sa.left || sa.down <= sb.up || sb.down <= sa.up) return 0;
  let verdict = 0;
  for (let axis = 0; axis < 3; axis++) {
    const toward = view[axis];
    if (Math.abs(toward) < 1e-9) continue;
    let side = 0;
    if (a[axis * 2 + 1] <= b[axis * 2] + EPS) side = 1;
    else if (b[axis * 2 + 1] <= a[axis * 2] + EPS) side = -1;
    if (!side) continue;
    const here = side * toward > 0 ? -1 : 1;
    if (verdict && verdict !== here) return 0;
    verdict = here;
  }
  return verdict;
}

/** Indices of `boxes`, back to front. */
export function orderOf(boxes: Box[], P: Projection): number[] {
  const origin = depthOf([0, 0, 0], P);
  const view: [number, number, number] = [depthOf([1, 0, 0], P) - origin, depthOf([0, 1, 0], P) - origin, depthOf([0, 0, 1], P) - origin];
  const count = boxes.length;
  const bounds = boxes.map((box) => screenBounds(box, P));
  const after: number[][] = Array.from({ length: count }, () => []);
  const before = new Array<number>(count).fill(0);
  for (let i = 0; i < count; i++) {
    for (let j = i + 1; j < count; j++) {
      const verdict = compare(boxes[i], boxes[j], bounds[i], bounds[j], view);
      if (verdict < 0) {
        after[i].push(j);
        before[j]++;
      } else if (verdict > 0) {
        after[j].push(i);
        before[i]++;
      }
    }
  }
  const order: number[] = [];
  const ready: number[] = [];
  for (let i = 0; i < count; i++) if (!before[i]) ready.push(i);
  while (ready.length) {
    let pick = 0;
    for (let k = 1; k < ready.length; k++) if (ready[k] < ready[pick]) pick = k;
    const item = ready.splice(pick, 1)[0];
    order.push(item);
    for (const next of after[item]) if (--before[next] === 0) ready.push(next);
  }
  return order.length === count ? order : boxes.map((_, index) => index);
}
