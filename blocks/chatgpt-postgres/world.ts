import { boxCorners, iso, type Plan, type Point3, type Projection } from './iso-kit';
import type { SideKey } from './sim';

/**
 * The two floors, in world units of about 1 px: x runs left to right along the back row, y toward
 * the viewer, z up. Both floors share one plan so the designs line up machine for machine: what
 * the initial design lacks stands as a ghost outline where today's design has it.
 *
 * Robot trays run one way round a loop of painted lane: east along the back aisle past the apps,
 * cache, pooler, primary and Cosmos DB, down the east side, west along the front aisle past the
 * replicas and the depot, and back up to the apps. Each machine has a bay beside the lane that a
 * tray steps into to hand over its slip, so passing trays are never blocked by one being served.
 */

export const WIDTH = 640;
export const HEIGHT = 380;
export const AZIMUTH = 58;
export const AZIMUTH_MIN = 34;
export const AZIMUTH_MAX = 80;
const PAD = 8;

export const FLOOR: Plan = { x: -252, y: -168, w: 504, d: 300, r: 10 };
export const FLOOR_H = 8;
export const FOOT_H = 4;

/** The lane loop: back aisle at `back`, front aisle at `front`, turning at `west` and `east`. */
export const LANE = { west: -230, east: 230, back: -44, front: 22, width: 14, corner: 12 };

const straightX = LANE.east - LANE.west - LANE.corner * 2;
const straightY = LANE.front - LANE.back - LANE.corner * 2;
const quarter = (Math.PI / 2) * LANE.corner;
/** Lengths of the loop's pieces in order: back straight, corner, east straight, corner, front, corner, west, corner. */
const PIECES = [straightX, quarter, straightY, quarter, straightX, quarter, straightY, quarter];
export const LOOP = PIECES.reduce((sum, piece) => sum + piece, 0);

export type Pose = { x: number; y: number; heading: number };

/** Where a tray `s` units round the loop stands, and which way it faces (radians, 0 = +x). */
export function poseAt(s: number): Pose {
  let at = ((s % LOOP) + LOOP) % LOOP;
  const { west, east, back, front, corner } = LANE;
  const arc = (cx: number, cy: number, from: number, t: number): Pose => {
    const angle = from + (Math.PI / 2) * t;
    return { x: cx + corner * Math.cos(angle), y: cy + corner * Math.sin(angle), heading: angle + Math.PI / 2 };
  };
  for (let piece = 0; piece < PIECES.length; piece++) {
    const length = PIECES[piece];
    if (at > length && piece < PIECES.length - 1) {
      at -= length;
      continue;
    }
    const t = Math.min(1, at / length);
    switch (piece) {
      case 0:
        return { x: west + corner + straightX * t, y: back, heading: 0 };
      case 1:
        return arc(east - corner, back + corner, -Math.PI / 2, t);
      case 2:
        return { x: east, y: back + corner + straightY * t, heading: Math.PI / 2 };
      case 3:
        return arc(east - corner, front - corner, 0, t);
      case 4:
        return { x: east - corner - straightX * t, y: front, heading: Math.PI };
      case 5:
        return arc(west + corner, front - corner, Math.PI / 2, t);
      case 6:
        return { x: west, y: front - corner - straightY * t, heading: -Math.PI / 2 };
      default:
        return arc(west + corner, back + corner, Math.PI, t);
    }
  }
  return { x: west + corner, y: back, heading: 0 };
}

/** Distance round the loop to the point beside `x` on the back aisle. */
export const backS = (x: number) => x - (LANE.west + LANE.corner);
/** Distance round the loop to the point beside `x` on the front aisle. */
export const frontS = (x: number) => straightX + quarter * 2 + straightY + (LANE.east - LANE.corner - x);

/** How far a bay reaches from the lane's centre toward its machine. */
export const BAY_REACH = 18;

export type Kind = 'apps' | 'gate' | 'cache' | 'bouncer' | 'primary' | 'standby' | 'cosmos' | 'replica' | 'depot';
export type Tier = 'high' | 'low';

export type Machine = {
  id: string;
  kind: Kind;
  plan: Plan;
  /** Height of its body, without anything on top. */
  h: number;
  tier?: Tier;
  region?: number;
  /** Drawn as an outline only: the initial design doesn't have it. */
  ghost?: boolean;
  /** Where trays stop for it. */
  dock?: { s: number; bays: number };
};

// Back row: everything that faces the back aisle. Fronts sit just behind the bays.
const BACK_FACE = LANE.back - BAY_REACH - 8;

const APPS: Plan = { x: -236, y: -150, w: 66, d: BACK_FACE - -150, r: 3 };
const CACHE: Plan = { x: -146, y: -124, w: 58, d: BACK_FACE - -124, r: 3 };
const BOUNCER: Plan = { x: -60, y: -134, w: 78, d: BACK_FACE - -134, r: 3 };
const PRIMARY_BEFORE: Plan = { x: 34, y: -150, w: 84, d: BACK_FACE - -150, r: 2 };
const PRIMARY_AFTER: Plan = { x: 40, y: -146, w: 66, d: BACK_FACE - -146, r: 2 };
const STANDBY: Plan = { x: 114, y: -140, w: 40, d: BACK_FACE - -140, r: 2 };
const COSMOS: Plan = { x: 166, y: -150, w: 50, d: BACK_FACE - -150, r: 2 };

// Front row: replicas stand on region pads, backs toward the front aisle.
const FRONT_FACE = LANE.front + BAY_REACH + 8;
export const REPLICA = { w: 32, d: 44, h: 46 };
const replicaAt = (x: number): Plan => ({ x: x - REPLICA.w / 2, y: FRONT_FACE, w: REPLICA.w, d: REPLICA.d, r: 2 });

/** Region pads under the replicas: one region before, three after. */
export const REGIONS: Record<SideKey, Plan[]> = {
  before: [{ x: -14, y: FRONT_FACE - 6, w: 210, d: REPLICA.d + 26, r: 4 }],
  after: [
    { x: -150, y: FRONT_FACE - 6, w: 104, d: REPLICA.d + 26, r: 4 },
    { x: -36, y: FRONT_FACE - 6, w: 104, d: REPLICA.d + 26, r: 4 },
    { x: 78, y: FRONT_FACE - 6, w: 104, d: REPLICA.d + 26, r: 4 }
  ]
};

/** The depot: charging pads where idle trays wait, beside the front aisle on the west. */
export const DEPOT: Plan = { x: -240, y: LANE.front + LANE.width / 2 + 2, w: 66, d: 34, r: 3 };
export const DEPOT_PADS = 3;
export const DEPOT_X = -208;

/** The app layer's rate-limit gate straddles the back aisle. */
export const GATE_X = -164;

const back = (x: number, bays = 1) => ({ s: backS(x), bays });
const front = (x: number, bays = 1) => ({ s: frontS(x), bays });
const middle = (plan: Plan) => plan.x + plan.w / 2;

export const WORLD: Record<SideKey, Machine[]> = {
  before: [
    { id: 'apps', kind: 'apps', plan: APPS, h: 50, dock: back(middle(APPS) + 4, 3) },
    { id: 'gate', kind: 'gate', plan: { x: GATE_X - 5, y: LANE.back - 14, w: 10, d: 28, r: 1 }, h: 34, ghost: true },
    { id: 'cache', kind: 'cache', plan: CACHE, h: 24, dock: back(middle(CACHE), 2) },
    { id: 'bouncer', kind: 'bouncer', plan: BOUNCER, h: 18, ghost: true },
    { id: 'primary', kind: 'primary', plan: PRIMARY_BEFORE, h: 80, dock: back(middle(PRIMARY_BEFORE), 2) },
    { id: 'standby', kind: 'standby', plan: STANDBY, h: 60, ghost: true },
    { id: 'cosmos', kind: 'cosmos', plan: COSMOS, h: 62, ghost: true },
    { id: 'replica-0', kind: 'replica', plan: replicaAt(160), h: REPLICA.h, region: 0, dock: front(160) },
    { id: 'replica-1', kind: 'replica', plan: replicaAt(92), h: REPLICA.h, region: 0, dock: front(92) },
    { id: 'replica-2', kind: 'replica', plan: replicaAt(24), h: REPLICA.h, region: 0, dock: front(24) },
    { id: 'depot', kind: 'depot', plan: DEPOT, h: 3, dock: front(DEPOT_X, DEPOT_PADS) }
  ],
  after: [
    { id: 'apps', kind: 'apps', plan: APPS, h: 50, dock: back(middle(APPS) + 4, 3) },
    { id: 'gate', kind: 'gate', plan: { x: GATE_X - 5, y: LANE.back - 14, w: 10, d: 28, r: 1 }, h: 34 },
    { id: 'cache', kind: 'cache', plan: CACHE, h: 24, dock: back(middle(CACHE), 3) },
    { id: 'bouncer', kind: 'bouncer', plan: BOUNCER, h: 18, dock: back(middle(BOUNCER), 2) },
    { id: 'primary', kind: 'primary', plan: PRIMARY_AFTER, h: 74, dock: back(middle(PRIMARY_AFTER)) },
    { id: 'standby', kind: 'standby', plan: STANDBY, h: 60, dock: back(middle(STANDBY)) },
    { id: 'cosmos', kind: 'cosmos', plan: COSMOS, h: 62, dock: back(middle(COSMOS), 2) },
    { id: 'replica-0', kind: 'replica', plan: replicaAt(152), h: REPLICA.h, region: 2, tier: 'low', dock: front(152) },
    { id: 'replica-1', kind: 'replica', plan: replicaAt(108), h: REPLICA.h, region: 2, tier: 'high', dock: front(108) },
    { id: 'replica-2', kind: 'replica', plan: replicaAt(38), h: REPLICA.h, region: 1, tier: 'low', dock: front(38) },
    { id: 'replica-3', kind: 'replica', plan: replicaAt(-6), h: REPLICA.h, region: 1, tier: 'high', dock: front(-6) },
    { id: 'replica-4', kind: 'replica', plan: replicaAt(-76), h: REPLICA.h, region: 0, tier: 'low', dock: front(-76) },
    { id: 'replica-5', kind: 'replica', plan: replicaAt(-120), h: REPLICA.h, region: 0, tier: 'high', dock: front(-120) },
    { id: 'depot', kind: 'depot', plan: DEPOT, h: 3, dock: front(DEPOT_X, DEPOT_PADS) }
  ]
};

export const machineOf = (side: SideKey, id: string) => WORLD[side].find((machine) => machine.id === id);

/** Which way a bay steps from the lane: toward −y for the back row, +y for the front row. */
export const bayDirection = (s: number) => (s < LOOP / 2 ? -1 : 1);

// One scale for every azimuth and both floors, so turning never zooms and the two read at one size.
const EXTREMES: Point3[] = [
  ...boxCorners(FLOOR, -FLOOR_H - FOOT_H, 0),
  ...boxCorners(PRIMARY_BEFORE, 0, 92),
  ...boxCorners(COSMOS, 0, 70),
  ...boxCorners(APPS, 0, 56)
];

function boundsAt(azimuth: number) {
  const flat = EXTREMES.map((point) => iso(point, { origin: [0, 0], scale: 1, azimuth }));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  return { left: Math.min(...xs), right: Math.max(...xs), up: Math.min(...ys), down: Math.max(...ys) };
}

const SCALE = (() => {
  let scale = Infinity;
  for (let azimuth = AZIMUTH_MIN; azimuth <= AZIMUTH_MAX; azimuth += 1) {
    const { left, right, up, down } = boundsAt(azimuth);
    scale = Math.min(scale, (WIDTH - PAD * 2) / (right - left), (HEIGHT - PAD * 2) / (down - up));
  }
  return scale;
})();

/** The camera at this azimuth, with the floor centred in the view box. */
export function projectionAt(azimuth: number): Projection {
  const { left, right, up, down } = boundsAt(azimuth);
  return {
    origin: [WIDTH / 2 - ((left + right) / 2) * SCALE, HEIGHT / 2 - ((up + down) / 2) * SCALE],
    scale: SCALE,
    azimuth
  };
}

export const P0 = projectionAt(AZIMUTH);

/**
 * The numbered roles, the same number on both floors so they compare: what the initial design
 * lacks keeps its number and shows as missing. Each pin stands on the machine named by `pin`.
 */
export type Role = { n: number; kind: Kind; name: string; pin: Record<SideKey, string> };

export const ROLES: Role[] = [
  { n: 1, kind: 'apps', name: 'ChatGPT and API apps', pin: { before: 'apps', after: 'apps' } },
  { n: 2, kind: 'gate', name: 'Rate-limit gate', pin: { before: 'gate', after: 'gate' } },
  { n: 3, kind: 'cache', name: 'Cache', pin: { before: 'cache', after: 'cache' } },
  { n: 4, kind: 'bouncer', name: 'PgBouncer behind a Kubernetes Service', pin: { before: 'bouncer', after: 'bouncer' } },
  { n: 5, kind: 'primary', name: 'PostgreSQL primary', pin: { before: 'primary', after: 'primary' } },
  { n: 6, kind: 'standby', name: 'Hot standby', pin: { before: 'standby', after: 'standby' } },
  { n: 7, kind: 'cosmos', name: 'Azure Cosmos DB', pin: { before: 'cosmos', after: 'cosmos' } },
  { n: 8, kind: 'replica', name: 'Read replicas', pin: { before: 'replica-1', after: 'replica-3' } },
  { n: 9, kind: 'depot', name: 'Robot trays and depot', pin: { before: 'depot', after: 'depot' } }
];

/** Whether a machine id plays a role (every replica plays the replicas' role). */
export const playsRole = (machine: Machine, role: Role) => machine.kind === role.kind;
