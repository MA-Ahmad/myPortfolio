import { depthOf, iso, type Projection } from './iso-kit';
import { GATE_X } from './model';
import {
  BEAM_H,
  BEAM_Z,
  CABINET,
  CABINET_H,
  CACHE_BOX,
  CACHE_H,
  CASE,
  CASE_H,
  CHASSIS,
  DECK_TOP,
  DIAL_TOP,
  DRAWER_OUT,
  DRAWER_REACH,
  GATE_LIFT,
  GATE_PLATE,
  GATE_PLATE_H,
  GATE_Z,
  KEYBOARD,
  LID_LIFT,
  POST,
  POST_BACK_Y,
  POST_FRONT_Y,
  POST_H,
  RAIL,
  RAIL_H,
  SHUTTLE,
  UNITS,
  liftOf
} from './view';

/**
 * Painter's order of the bench's groups for any camera. Each group is boxed in the world; where two
 * boxes overlap on screen, a plane that separates them in the world says which is nearer, and a
 * topological sort turns those pairs into one order. This is what lets the camera turn without a
 * station drawing over the one in front of it.
 */

export type Item = 'client' | 'server' | 'gateBack' | 'cache' | 'db' | 'rail' | 'shuttle' | 'gatePlate' | 'gateBeam' | 'gateFront';

/** The order used to break ties, and the fallback if the pairs ever formed a cycle. */
export const ITEMS: Item[] = ['client', 'server', 'gateBack', 'cache', 'db', 'rail', 'shuttle', 'gatePlate', 'gateBeam', 'gateFront'];

type Box = [number, number, number, number, number, number];

const box = (plan: { x: number; y: number; w: number; d: number }, z0: number, z1: number): Box => [plan.x, plan.x + plan.w, plan.y, plan.y + plan.d, z0, z1];

/** How far each machine is taken apart, 0..1. */
export interface Apart {
  server: number;
  cache: number;
  db: number;
}

const TOGETHER: Apart = { server: 0, cache: 0, db: 0 };

const STATIC: Record<Exclude<Item, 'shuttle' | 'gatePlate' | 'server' | 'cache' | 'db'>, Box> = {
  // The keyboard sits in front of the case, so the client's box reaches to its front edge.
  client: [CASE.x, CASE.x + CASE.w, CASE.y, KEYBOARD.y + KEYBOARD.d, 0, CASE_H + 1],
  // The posts' feet are left out: they are low, and the plate and the rail never reach down to them.
  gateBack: [GATE_X - POST / 2 - 3, GATE_X + POST / 2 + 3, POST_BACK_Y, POST_BACK_Y + POST, 0, POST_H],
  // The track only: its end stops stand where nothing else reaches.
  rail: box(RAIL, 0, RAIL_H),
  gateBeam: [GATE_X - 5, GATE_X + 5, POST_BACK_Y - 1, POST_FRONT_Y + POST + 1, BEAM_Z, BEAM_Z + BEAM_H],
  gateFront: [GATE_X - POST / 2 - 3, GATE_X + POST / 2 + 3, POST_FRONT_Y, POST_FRONT_Y + POST + 4, 0, POST_H]
};

function boxesAt(shuttleX: number, gate: number, apart: Apart): Record<Item, Box> {
  const lift = gate * GATE_LIFT;
  return {
    ...STATIC,
    // Taken apart, a machine stands taller by its top's rise, and the cabinet reaches as far as its drawers come out.
    server: box(CHASSIS, 0, DIAL_TOP + liftOf(UNITS, apart.server)),
    cache: box(CACHE_BOX, 0, CACHE_H + 1 + liftOf(1, apart.cache)),
    // Room for a drawer pulled all the way out, with its front and handle.
    db: [CABINET.x, CABINET.x + CABINET.w, CABINET.y, CABINET.y + CABINET.d + Math.max(DRAWER_OUT, DRAWER_REACH * apart.db) + 5, 0, CABINET_H + 2 + LID_LIFT * apart.db],
    shuttle: [shuttleX + SHUTTLE.x - 2, shuttleX + SHUTTLE.x + SHUTTLE.w + 2, SHUTTLE.y, SHUTTLE.y + SHUTTLE.d, 1, DECK_TOP + 4],
    gatePlate: box(GATE_PLATE, GATE_Z + lift, GATE_Z + GATE_PLATE_H + lift)
  };
}

function screenBounds([x0, x1, y0, y1, z0, z1]: Box, P: Projection) {
  let left = Infinity;
  let right = -Infinity;
  let up = Infinity;
  let down = -Infinity;
  for (const x of [x0, x1]) {
    for (const y of [y0, y1]) {
      for (const z of [z0, z1]) {
        const [sx, sy] = iso([x, y, z], P);
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        up = Math.min(up, sy);
        down = Math.max(down, sy);
      }
    }
  }
  return { left, right, up, down };
}

const EPS = 1e-6;

/**
 * Whether `a` must be drawn before `b` (−1), after it (1), or either way (0): their pictures don't
 * overlap, or no plane separates them in a way that agrees.
 */
function compare(a: Box, b: Box, view: [number, number, number], P: Projection) {
  const sa = screenBounds(a, P);
  const sb = screenBounds(b, P);
  if (sa.right <= sb.left || sb.right <= sa.left || sa.down <= sb.up || sb.down <= sa.up) return 0;
  let verdict = 0;
  for (let axis = 0; axis < 3; axis++) {
    const toward = view[axis];
    if (Math.abs(toward) < 1e-9) continue;
    let side = 0;
    if (a[axis * 2 + 1] <= b[axis * 2] + EPS) side = 1; // b lies on the + side of a
    else if (b[axis * 2 + 1] <= a[axis * 2] + EPS) side = -1;
    if (!side) continue;
    const here = side * toward > 0 ? -1 : 1; // the one on the side facing the viewer is drawn later
    if (verdict && verdict !== here) return 0;
    verdict = here;
  }
  return verdict;
}

/** The groups back to front for this camera, with the shuttle at `shuttleX`, the gate lifted by `gate` (0..1) and the machines `apart`. */
export function orderOf(P: Projection, shuttleX: number, gate: number, apart: Apart = TOGETHER): Item[] {
  const origin = depthOf([0, 0, 0], P);
  const view: [number, number, number] = [depthOf([1, 0, 0], P) - origin, depthOf([0, 1, 0], P) - origin, depthOf([0, 0, 1], P) - origin];
  const boxes = boxesAt(shuttleX, gate, apart);
  const after = new Map<Item, Set<Item>>(ITEMS.map((item) => [item, new Set<Item>()]));
  const before = new Map<Item, number>(ITEMS.map((item) => [item, 0]));
  const edge = (from: Item, to: Item) => {
    const set = after.get(from)!;
    if (set.has(to)) return;
    set.add(to);
    before.set(to, before.get(to)! + 1);
  };
  // The shuttle rides over the track, so no plane separates them; it is always drawn after it.
  edge('rail', 'shuttle');
  for (let i = 0; i < ITEMS.length; i++) {
    for (let j = i + 1; j < ITEMS.length; j++) {
      const a = ITEMS[i];
      const b = ITEMS[j];
      if ((a === 'rail' && b === 'shuttle') || (a === 'shuttle' && b === 'rail')) continue;
      const verdict = compare(boxes[a], boxes[b], view, P);
      if (verdict < 0) edge(a, b);
      else if (verdict > 0) edge(b, a);
    }
  }
  const order: Item[] = [];
  const ready = ITEMS.filter((item) => before.get(item) === 0);
  while (ready.length) {
    ready.sort((a, b) => ITEMS.indexOf(a) - ITEMS.indexOf(b));
    const item = ready.shift()!;
    order.push(item);
    after.get(item)!.forEach((next) => {
      before.set(next, before.get(next)! - 1);
      if (before.get(next) === 0) ready.push(next);
    });
  }
  return order.length === ITEMS.length ? order : ITEMS;
}
