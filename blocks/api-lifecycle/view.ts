import { boxCorners, iso, type Plan, type Point3, type Projection } from './iso-kit';
import { GATE_X, STOP } from './model';

/**
 * World layout of the bench, in units of about 1 px: x runs along the rail, y toward the viewer,
 * z up. Stations stand behind the rail; the gate straddles it.
 */

export const WIDTH = 760;
export const HEIGHT = 380;
export const AZIMUTH = 62;
/** The camera turns between these azimuths: past 90 the bench's far side, which has no detail, would face the viewer. */
export const AZIMUTH_MIN = 22;
export const AZIMUTH_MAX = 88;
const PAD = 30;

export const BASE: Plan = { x: -292, y: -76, w: 524, d: 146, r: 10 };
export const BASE_H = 10;
export const FOOT_H = 5;

// Rail: a flat track on the bench, with the shuttle riding over it.
export const RAIL_Y = 40;
export const RAIL: Plan = { x: -272, y: RAIL_Y - 4, w: 488, d: 8, r: 2 };
export const RAIL_H = 3;
export const STRIP: Plan = { x: -262, y: 59, w: 470, d: 6, r: 1 };

// Shuttle, built at x = 0 and moved along x.
export const SHUTTLE: Plan = { x: -15, y: RAIL_Y - 7, w: 30, d: 14, r: 2.5 };
export const SKIRT_Z = 1;
export const DECK_Z = 6.5;
export const DECK_H = 3;
export const DECK_TOP = DECK_Z + DECK_H;

// The card a row travels as: a flat index card.
export const CARD: Plan = { x: -8, y: -5.5, w: 16, d: 11, r: 1 };
export const CARD_H = 0.8;
/** The request ticket: narrow, beside the card's seat, so the card is added next to it and never replaces it. */
export const SLIP: Plan = { x: 9.8, y: -4.5, w: 4.2, d: 9, r: 0.8 };

// Client terminal.
export const CLIENT_X = STOP.client;
export const CASE: Plan = { x: CLIENT_X - 33, y: -58, w: 66, d: 56, r: 4 };
export const CASE_H = 52;
export const CASE_FRONT = CASE.y + CASE.d;
export const SCREEN = { x: CLIENT_X - 26, z: 46, w: 52, h: 32 };
export const KEYBOARD: Plan = { x: CLIENT_X - 27, y: 6, w: 54, d: 18, r: 2 };
export const READER_SLOT: Plan = { x: CLIENT_X - 10, y: -36, w: 20, d: 3, r: 1.2 };

// Gate: two posts straddling the rail, a beam, and a plate that lifts.
export const POST = 8;
export const POST_BACK_Y = 22;
export const POST_FRONT_Y = 48;
export const POST_H = 66;
export const BEAM_Z = POST_H;
export const BEAM_H = 6;
export const GATE_PLATE: Plan = { x: GATE_X - 2, y: POST_BACK_Y + POST, w: 4, d: POST_FRONT_Y - POST_BACK_Y - POST, r: 0.6 };
export const GATE_Z = RAIL_H + 0.6;
export const GATE_PLATE_H = 26;
export const GATE_LIFT = 30;

// App server: a short rack of three units with a router dial on top.
export const SERVER_X = STOP.server;
export const CHASSIS: Plan = { x: SERVER_X - 36, y: -62, w: 72, d: 62, r: 3 };
export const PLINTH_H = 2;
export const UNIT_H = 16;
export const UNIT_GAP = 0.6;
export const UNITS = 3;
export const unitZ = (unit: number) => PLINTH_H + unit * UNIT_H;
export const SERVER_TOP = unitZ(UNITS) - UNIT_GAP;
export const DIAL_C: [number, number] = [SERVER_X, CHASSIS.y + 26];
export const DIAL_R = 15;
export const DIAL_H = 5;
export const DIAL_TOP = SERVER_TOP + DIAL_H;
/** Routes engraved round the dial, clockwise from the top; the needle swings to `/users/:id`. */
export const ROUTES = 5;
export const ROUTE = 2;

// Cache: a box with two pockets, a card lying in each cached one.
export const CACHE_X = STOP.cache;
export const CACHE_BOX: Plan = { x: CACHE_X - 34, y: -38, w: 68, d: 40, r: 3 };
export const CACHE_H = 18;
export const POCKET_Y = -17;
/** One pocket per profile in PROFILES. */
export const POCKET_X = [CACHE_X - 11, CACHE_X + 11];

// Database: a filing cabinet with three drawers that slide toward the viewer.
export const DB_X = STOP.db;
export const CABINET: Plan = { x: DB_X - 36, y: -64, w: 72, d: 64, r: 2 };
export const CABINET_H = 74;
export const DRAWER_H = 22;
export const DRAWER_Z = [4, 27, 50];
export const DRAWER_OUT = 22;
export const DRAWER_BOX: Plan = { x: DB_X - 31, y: -48, w: 62, d: 48, r: 1.5 };

const EXTREMES: Point3[] = [
  ...boxCorners(BASE, -BASE_H - FOOT_H, 0),
  ...boxCorners(CABINET, 0, CABINET_H),
  ...boxCorners({ x: GATE_X - POST / 2, y: POST_BACK_Y, w: POST, d: POST_FRONT_Y + POST - POST_BACK_Y, r: 0 }, 0, BEAM_Z + BEAM_H)
];

function boundsAt(azimuth: number) {
  const flat = EXTREMES.map((point) => iso(point, { origin: [0, 0], scale: 1, azimuth }));
  const xs = flat.map(([x]) => x);
  const ys = flat.map(([, y]) => y);
  return { left: Math.min(...xs), right: Math.max(...xs), up: Math.min(...ys), down: Math.max(...ys) };
}

/** One scale for every azimuth, so turning the camera never zooms it. */
const SCALE = (() => {
  let scale = Infinity;
  for (let azimuth = AZIMUTH_MIN; azimuth <= AZIMUTH_MAX; azimuth += 1) {
    const { left, right, up, down } = boundsAt(azimuth);
    scale = Math.min(scale, (WIDTH - PAD * 2) / (right - left), (HEIGHT - PAD * 2) / (down - up));
  }
  return scale;
})();

/** The camera at this azimuth, with the bench centred in the view box. */
export function projectionAt(azimuth: number): Projection {
  const { left, right, up, down } = boundsAt(azimuth);
  return {
    origin: [WIDTH / 2 - ((left + right) / 2) * SCALE, HEIGHT / 2 - ((up + down) / 2) * SCALE],
    scale: SCALE,
    azimuth
  };
}

/** The resting camera, which the server renders. */
export const P0 = projectionAt(AZIMUTH);

/** Card anchors, as world points of the card's centre. */
export const ANCHOR_POINT = {
  drawer: (drawer: number): Point3 => [DB_X, -10 + DRAWER_OUT, DRAWER_Z[drawer] + DRAWER_H - 4],
  pocket: (pocket: number): Point3 => [POCKET_X[pocket], POCKET_Y, CACHE_H + 2.2],
  shuttle: (x: number): Point3 => [x, RAIL_Y, DECK_TOP],
  terminal: (): Point3 => [CLIENT_X, READER_SLOT.y + READER_SLOT.d / 2, CASE_H]
};
