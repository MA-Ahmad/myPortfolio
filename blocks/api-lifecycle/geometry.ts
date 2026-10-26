import {
  corners,
  cylinder,
  extrude,
  haloOf,
  insetPlan,
  iso,
  knurl,
  lineOnTop,
  pathOf,
  planOutline,
  radialTicks,
  ring,
  segment,
  sideArc,
  sideRing,
  sideSeam,
  slabOf,
  topMatrix,
  topTicks,
  type Flat,
  type Plan,
  type Point3,
  type Projection
} from './iso-kit';
import { GATE_X } from './model';
import {
  BASE,
  BASE_H,
  BEAM_H,
  BEAM_Z,
  CABINET,
  CABINET_H,
  CACHE_BOX,
  CACHE_H,
  CACHE_SPLIT,
  CARD,
  CARD_H,
  CASE,
  CASE_FRONT,
  CASE_H,
  CHASSIS,
  CLIENT_X,
  DB_X,
  DECK_H,
  DECK_TOP,
  DECK_Z,
  DIAL_C,
  DIAL_H,
  DIAL_R,
  DIAL_TOP,
  DRAWER_BOX,
  DRAWER_H,
  DRAWER_Z,
  FOOT_H,
  GATE_PLATE,
  GATE_PLATE_H,
  GATE_Z,
  KEYBOARD,
  PLINTH_H,
  POCKET_X,
  POCKET_Y,
  POST,
  POST_BACK_Y,
  POST_FRONT_Y,
  POST_H,
  RAIL,
  RAIL_H,
  RAIL_Y,
  FLOPPY,
  ROUTE,
  ROUTES,
  SCREEN,
  SERVER_TOP,
  SHUTTLE,
  WHEEL_BACK_Y,
  WHEEL_FRONT_Y,
  WHEEL_R,
  WHEEL_W,
  WHEEL_X,
  WHEEL_Z,
  SLIP,
  STRIP,
  UNITS,
  UNIT_GAP,
  UNIT_H,
  unitZ
} from './view';

/**
 * Every path of the bench, drawn for one camera. The live component calls this again whenever the
 * camera turns, so nothing here may hold on to a projection of its own.
 */
export function geometryOf(P: Projection) {
  const at = (point: Point3): Flat => iso(point, P);

  const RADIANS = Math.PI / 180;
  const solid = (plan: Plan, z: number, h: number, steps = 4, bevel = 0) => slabOf(plan, z, h, P, steps, bevel);
  const round = (cx: number, cy: number, r: number, z: number, h: number, steps = 28) => cylinder(cx, cy, r, z, h, P, steps);
  const line = (a: Point3, b: Point3) => segment(a, b, P);
  const join = (paths: string[]) => paths.join('');

  /** A closed rectangle on the face whose normal is +y, at `y`. */
  const faceRect = (x0: number, x1: number, z0: number, z1: number, y: number) =>
    pathOf([at([x0, y, z0]), at([x1, y, z0]), at([x1, y, z1]), at([x0, y, z1])], true);

  /** A closed rectangle on the face whose normal is +x, at `x`. */
  const sideRect = (y0: number, y1: number, z0: number, z1: number, x: number) =>
    pathOf([at([x, y0, z0]), at([x, y1, z0]), at([x, y1, z1]), at([x, y0, z1])], true);

  /** Three rule lines that stand for printed text on a label plate. */
  const rules = (plan: Plan, z: number, lengths = [0.78, 0.5, 0.66]) =>
    join(
      lengths.map((share, row) =>
        lineOnTop([plan.x + 3, plan.y + 2.4 + row * ((plan.d - 4.8) / 2)], [plan.x + 3 + (plan.w - 6) * share, plan.y + 2.4 + row * ((plan.d - 4.8) / 2)], z, P)
      )
    );

  const screwsOn = (plan: Plan, inset: number, z: number): Flat[] => corners(plan, inset).map(([x, y]) => at([x, y, z]));

  // ── Base ───────────────────────────────────────────────────────────────────────────────────────

  const FEET = corners(BASE, 20);
  const LABEL: Plan = { x: 150, y: 47, w: 56, d: 10, r: 1.6 };

  function ruler() {
    const ticks = topTicks(STRIP.x + 4, STRIP.x + STRIP.w - 4, 5, 5, STRIP.y, 0.6, [1.8, 3.4], P);
    return ticks;
  }
  const RULER = ruler();

  const BASE_ART = {
    halo: haloOf(BASE, -BASE_H - FOOT_H, BASE_H, P),
    feet: FEET.map(([x, y]) => [round(x, y, 8, -BASE_H - FOOT_H, 1.6, 32), round(x, y, 6.2, -BASE_H - FOOT_H + 1.6, FOOT_H - 1.6, 28)]),
    slab: solid(BASE, -BASE_H, BASE_H, 8, 1.6),
    seam: sideSeam(BASE, -BASE_H + 3, P, 8),
    groove: planOutline(insetPlan(BASE, 5), 0, P, 8),
    screws: screwsOn(BASE, 10, 0),
    screwRings: join(corners(BASE, 10).map(([x, y]) => ring(x, y, 2.2, 0, P, 16))),
    strip: solid(STRIP, 0, 0.6, 2),
    minor: RULER.minor,
    major: RULER.major,
    label: solid(LABEL, 0, 0.8, 3),
    labelLine: planOutline(insetPlan(LABEL, 1.4), 0.8, P, 3),
    labelRules: rules({ ...LABEL, x: LABEL.x + 5, w: LABEL.w - 10 }, 0.8),
    labelScrews: [at([LABEL.x + 3, LABEL.y + LABEL.d / 2, 0.8]), at([LABEL.x + LABEL.w - 3, LABEL.y + LABEL.d / 2, 0.8])]
  };

  // ── Rail ───────────────────────────────────────────────────────────────────────────────────────

  const STOPS: Plan[] = [RAIL.x - 2, RAIL.x + RAIL.w - 4].map((x) => ({ x, y: RAIL.y - 3, w: 6, d: RAIL.d + 6, r: 1.2 }));
  const RAIL_SCREWS: number[] = [];
  for (let x = RAIL.x + 24; x < RAIL.x + RAIL.w - 10; x += 48) RAIL_SCREWS.push(x);

  const RAIL_ART = {
    halo: haloOf(insetPlan(RAIL, -2), 0, 0.1, P),
    track: solid(RAIL, 0, RAIL_H, 3, 0.5),
    groove: lineOnTop([RAIL.x + 4, RAIL_Y], [RAIL.x + RAIL.w - 4, RAIL_Y], RAIL_H, P),
    screws: RAIL_SCREWS.map((x) => at([x, RAIL_Y - 2.4, RAIL_H])).concat(RAIL_SCREWS.map((x) => at([x, RAIL_Y + 2.4, RAIL_H]))),
    stops: STOPS.map((plan) => solid(plan, 0, 9, 3, 0.5)),
    stopScrews: STOPS.flatMap((plan) => [at([plan.x + 3, plan.y + 2.4, 9]), at([plan.x + 3, plan.y + plan.d - 2.4, 9])]),
    stopPads: STOPS.map((plan, index) =>
      sideRect(plan.y + 3, plan.y + plan.d - 3, 3.5, 7.5, index ? plan.x : plan.x + plan.w)
    )
  };

  // ── Shuttle (built at x = 0) ───────────────────────────────────────────────────────────────────

  /** A circle on a face whose normal is ±y, as screen points. */
  const circleY = (cx: number, y: number, cz: number, r: number, steps = 32): Flat[] =>
    Array.from({ length: steps }, (_, index) => {
      const angle = (index / steps) * Math.PI * 2;
      return at([cx + r * Math.cos(angle), y, cz + r * Math.sin(angle)]);
    });

  /** The convex hull of screen points (monotone chain), for the tread a wheel shows between its two faces. */
  const hullOf = (points: Flat[]): Flat[] => {
    const sorted = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const half = (list: Flat[]) => {
      const out: Flat[] = [];
      for (const point of list) {
        while (out.length >= 2 && cross(out[out.length - 2], out[out.length - 1], point) <= 0) out.pop();
        out.push(point);
      }
      out.pop();
      return out;
    };
    return [...half(sorted), ...half([...sorted].reverse())];
  };

  const TYRE = WHEEL_R * 0.7;
  const HUB = 0.55;

  /** A wheel turning about y, seen from the +y side: `face` is the y of the face toward the viewer. */
  const wheelOf = (cx: number, face: number, back: number) => ({
    tread: pathOf(hullOf([...circleY(cx, face, WHEEL_Z, WHEEL_R), ...circleY(cx, back, WHEEL_Z, WHEEL_R)]), true),
    face: pathOf(circleY(cx, face, WHEEL_Z, WHEEL_R), true),
    tyre: pathOf(circleY(cx, face, WHEEL_Z, TYRE, 28), true),
    hub: pathOf(circleY(cx, face, WHEEL_Z, HUB, 14), true),
    hubDot: at([cx, face, WHEEL_Z])
  });

  /** The front wheels' spokes, turned by `angle` (radians, counterclockwise as seen from the front). */
  const wheelSpokesOf = (angle: number) =>
    join(
      WHEEL_X.flatMap((cx) =>
        [0, 1, 2].map((spoke) => {
          const a = angle + (spoke * Math.PI * 2) / 3;
          const [c, s] = [Math.cos(a), Math.sin(a)];
          return pathOf([at([cx + HUB * c, WHEEL_FRONT_Y, WHEEL_Z + HUB * s]), at([cx + TYRE * c, WHEEL_FRONT_Y, WHEEL_Z + TYRE * s])]);
        })
      )
    );

  /** The housings that carry each axle down from the deck, between the front and back wheels. */
  const HANGERS: Plan[] = WHEEL_X.map((cx) => ({ x: cx - 1.3, y: WHEEL_BACK_Y + WHEEL_W + 0.3, w: 2.6, d: WHEEL_FRONT_Y - WHEEL_BACK_Y - WHEEL_W * 2 - 0.6, r: 0.6 }));
  const BUMPERS: Plan[] = [
    { x: SHUTTLE.x - 1.6, y: RAIL_Y - 3.5, w: 1.8, d: 7, r: 0.8 },
    { x: SHUTTLE.x + SHUTTLE.w - 0.2, y: RAIL_Y - 3.5, w: 1.8, d: 7, r: 0.8 }
  ];
  const KEY_C: [number, number] = [-11.6, RAIL_Y + 2.5];
  const SLIP_Z = DECK_TOP;

  const SHUTTLE_ART = {
    halo: haloOf(insetPlan(SHUTTLE, 1), RAIL_H, 0.1, P),
    // The back wheels show their inner face, toward the viewer; the front wheels their outer one.
    backWheels: WHEEL_X.map((cx) => wheelOf(cx, WHEEL_BACK_Y + WHEEL_W, WHEEL_BACK_Y)),
    hangers: HANGERS.map((plan) => solid(plan, WHEEL_Z - 1.2, DECK_Z - WHEEL_Z + 1.2, 2)),
    frontWheels: WHEEL_X.map((cx) => wheelOf(cx, WHEEL_FRONT_Y, WHEEL_FRONT_Y - WHEEL_W)),
    deck: solid(SHUTTLE, DECK_Z, DECK_H, 4, 0.6),
    seam: sideSeam(SHUTTLE, DECK_Z + 1.2, P, 4),
    seat: planOutline({ x: CARD.x - 1, y: RAIL_Y + CARD.y - 0.4, w: CARD.w + 2, d: CARD.d + 0.8, r: 1.2 }, DECK_TOP, P, 3),
    rivets: [-12, 12].flatMap((x) => [at([x, SHUTTLE.y + 0.9, DECK_TOP]), at([x, SHUTTLE.y + SHUTTLE.d - 0.9, DECK_TOP])]),
    bumpers: BUMPERS.map((plan) => solid(plan, DECK_Z - 1, DECK_H + 0.4, 2)),
    key: round(KEY_C[0], KEY_C[1], 2, DECK_TOP, 3.6, 20),
    keyKnurl: knurl(KEY_C[0], KEY_C[1], 2, DECK_TOP, DECK_TOP + 3.6, 16, P),
    keyBow: ring(KEY_C[0], KEY_C[1], 0.9, DECK_TOP + 3.6, P, 12),
    slip: solid({ ...SLIP, y: RAIL_Y + SLIP.y }, SLIP_Z, 0.5, 2),
    /** A punched hole at the back end and two lines of print along the ticket. */
    slipRules: join([
      ring(SLIP.x + SLIP.w / 2, RAIL_Y + SLIP.y + 1.8, 0.7, SLIP_Z + 0.5, P, 12),
      lineOnTop([SLIP.x + 1.3, RAIL_Y + SLIP.y + 3.6], [SLIP.x + 1.3, RAIL_Y + SLIP.y + SLIP.d - 1.2], SLIP_Z + 0.5, P),
      lineOnTop([SLIP.x + 2.9, RAIL_Y + SLIP.y + 3.6], [SLIP.x + 2.9, RAIL_Y + SLIP.y + SLIP.d - 3], SLIP_Z + 0.5, P)
    ])
  };

  // ── Card (built at the origin and moved to its anchor) ────────────────────────────────────────

  const CARD_ART = {
    body: solid(CARD, 0, CARD_H, 3),
    avatar: ring(CARD.x + 4.2, 0, 2.4, CARD_H, P, 18),
    rules: join(
      [
        [-1.6, 0.9],
        [0.4, 0.6],
        [2.6, 0.75]
      ].map(([y, share]) => lineOnTop([CARD.x + 8, y], [CARD.x + 8 + (CARD.w - 10) * share, y], CARD_H, P))
    )
  };

  // ── Client terminal ───────────────────────────────────────────────────────────────────────────

  const SX0 = SCREEN.x;
  const SX1 = SCREEN.x + SCREEN.w;
  const SZ1 = SCREEN.z;
  const SZ0 = SCREEN.z - SCREEN.h;
  const RECESS = 1.6;
  const BACK = CASE_FRONT - RECESS;
  const VENTS_Y = [CASE.y + 10, CASE.y + 18, CASE.y + 26, CASE.y + 34];
  const CASE_SIDE = CASE.x + CASE.w;

  function keys() {
    const rows: string[] = [];
    const pitch = 4.2;
    for (let row = 0; row < 3; row++) {
      for (let column = 0; column < 11; column++) {
        const x = KEYBOARD.x + 4 + column * pitch + (row === 1 ? 1 : row === 2 ? 2 : 0);
        if (x + 3.2 > KEYBOARD.x + KEYBOARD.w - 3) continue;
        rows.push(planOutline({ x, y: KEYBOARD.y + 3 + row * 3.8, w: 3.2, d: 2.8, r: 0.6 }, 3, P, 2));
      }
    }
    rows.push(planOutline({ x: KEYBOARD.x + 14, y: KEYBOARD.y + 14.2, w: 24, d: 2.6, r: 0.6 }, 3, P, 2));
    return join(rows);
  }

  const CLIENT_ART = {
    halo: haloOf(CASE, 0, 0.1, P),
    plinth: solid(insetPlan(CASE, 3), 0, 2, 4),
    body: solid(CASE, 2, CASE_H - 2, 6, 1.2),
    seam: sideSeam(CASE, 10, P, 6),
    bezel: faceRect(SX0 - 3, SX1 + 3, SZ0 - 3, SZ1 + 3, CASE_FRONT),
    window: faceRect(SX0, SX1, SZ0, SZ1, CASE_FRONT),
    /** The recess: its floor (seen from above) and its left wall (facing +x). */
    recessFloor: pathOf([at([SX0, CASE_FRONT, SZ0]), at([SX1, CASE_FRONT, SZ0]), at([SX1, BACK, SZ0]), at([SX0, BACK, SZ0])], true),
    recessWall: pathOf([at([SX0, CASE_FRONT, SZ0]), at([SX0, CASE_FRONT, SZ1]), at([SX0, BACK, SZ1]), at([SX0, BACK, SZ0])], true),
    glass: pathOf([at([SX0, BACK, SZ0]), at([SX1, BACK, SZ0]), at([SX1, BACK, SZ1]), at([SX0, BACK, SZ1])], true),
    /** Maps screen coordinates (u right, v down, in world units) onto the glass. */
    screenMatrix: `matrix(${faceAxes(SX0, BACK, SZ1)})`,
    power: sideRing([SX1 - 2, CASE_FRONT, 6], 1.8, 'y', P, 16),
    powerDot: at([SX1 - 2, CASE_FRONT, 6]),
    led: at([SX1 - 9, CASE_FRONT, 6]),
    vents: join(VENTS_Y.map((y) => sideRect(y, y + 4, 18, 40, CASE_SIDE))),
    /** The floppy slot: a bezel, the dark opening, its dust flap edge to edge, and an eject button. */
    floppyBezel: faceRect(FLOPPY.x - 1.6, FLOPPY.x + FLOPPY.w + 1.6, FLOPPY.z - 1.3, FLOPPY.z + FLOPPY.h + 1.3, CASE_FRONT),
    floppy: faceRect(FLOPPY.x, FLOPPY.x + FLOPPY.w, FLOPPY.z, FLOPPY.z + FLOPPY.h, CASE_FRONT),
    floppyFlap: line([FLOPPY.x, CASE_FRONT, FLOPPY.z + FLOPPY.h * 0.45], [FLOPPY.x + FLOPPY.w, CASE_FRONT, FLOPPY.z + FLOPPY.h * 0.45]),
    eject: faceRect(FLOPPY.x + FLOPPY.w + 3, FLOPPY.x + FLOPPY.w + 6.4, FLOPPY.z + 0.1, FLOPPY.z + FLOPPY.h - 0.1, CASE_FRONT),
    topScrews: screwsOn(CASE, 5, CASE_H),
    keyboard: solid(KEYBOARD, 0, 3, 3, 0.6),
    keys: keys(),
    cord: [at([CLIENT_X + 18, KEYBOARD.y, 1.6]), at([CLIENT_X + 18, CASE_FRONT, 4])] as [Flat, Flat]
  };

  /** The 2D matrix that lays (u, v) on a face whose normal is +y, with v pointing down. */
  function faceAxes(x: number, y: number, z: number) {
    const origin = at([x, y, z]);
    const u = at([x + 1, y, z]);
    const v = at([x, y, z - 1]);
    const f = (value: number) => Math.round(value * 1000) / 1000;
    return [u[0] - origin[0], u[1] - origin[1], v[0] - origin[0], v[1] - origin[1], origin[0], origin[1]].map(f).join(' ');
  }

  // ── Gate ──────────────────────────────────────────────────────────────────────────────────────

  const POSTS: Plan[] = [POST_BACK_Y, POST_FRONT_Y].map((y) => ({ x: GATE_X - POST / 2, y, w: POST, d: POST, r: 1.2 }));
  // The front foot reaches back only 1.5, to clear the track's front edge.
  const POST_FEET: Plan[] = [insetPlan(POSTS[0], -3), { ...insetPlan(POSTS[1], -3), y: POSTS[1].y - 1.5, d: POSTS[1].d + 4.5 }];
  const BEAM: Plan = { x: GATE_X - 5, y: POST_BACK_Y - 1, w: 10, d: POST_FRONT_Y + POST - POST_BACK_Y + 2, r: 1.4 };
  const READER: Plan = { x: GATE_X - 4.5, y: POST_FRONT_Y + POST, w: 9, d: 4, r: 1 };
  const READER_Z = 22;
  const READER_H = 14;

  const gatePost = (index: number) => ({
    foot: solid(POST_FEET[index], 0, 2, 3, 0.4),
    footScrews: [at([POST_FEET[index].x + 2, POST_FEET[index].y + 2, 2]), at([POST_FEET[index].x + POST_FEET[index].w - 2, POST_FEET[index].y + POST_FEET[index].d - 2, 2])],
    post: solid(POSTS[index], 2, POST_H - 2, 3, 0.5),
    seams: join([18, 42].map((z) => sideSeam(POSTS[index], z, P, 3)))
  });

  const GATE_ART = {
    back: gatePost(0),
    /** The groove the plate runs in, on the back post's face toward the rail. */
    guide: line([GATE_X, POST_BACK_Y + POST, 2], [GATE_X, POST_BACK_Y + POST, POST_H]),
    front: gatePost(1),
    frontGuide: line([GATE_X, POST_FRONT_Y + POST, 2], [GATE_X, POST_FRONT_Y + POST, READER_Z]),
    beam: solid(BEAM, BEAM_Z, BEAM_H, 3, 0.6),
    beamScrews: [POST_BACK_Y + POST / 2, POST_FRONT_Y + POST / 2].map((y) => at([GATE_X, y, BEAM_Z + BEAM_H])),
    beamSeam: sideSeam(BEAM, BEAM_Z + 2, P, 3),
    plate: solid(GATE_PLATE, GATE_Z, GATE_PLATE_H, 2, 0.4),
    plateRibs: join([7, 13, 19].map((rise) => line([GATE_X + 2, GATE_PLATE.y, GATE_Z + rise], [GATE_X + 2, GATE_PLATE.y + GATE_PLATE.d, GATE_Z + rise]))),
    plateHalo: haloOf(insetPlan({ ...GATE_PLATE, x: GATE_PLATE.x - 2, w: GATE_PLATE.w + 4 }, 0), RAIL_H, 0.1, P),
    reader: solid(READER, READER_Z, READER_H, 3, 0.5),
    readerSeam: sideSeam(READER, READER_Z + 4, P, 3),
    keyhole: sideRing([GATE_X, READER.y + READER.d, READER_Z + 8], 1.8, 'y', P, 16),
    keyway: line([GATE_X, READER.y + READER.d, READER_Z + 7.2], [GATE_X, READER.y + READER.d, READER_Z + 5.4]),
    led: at([GATE_X, READER.y + READER.d / 2, READER_Z + READER_H]),
    ledRing: ring(GATE_X, READER.y + READER.d / 2, 1.5, READER_Z + READER_H, P, 14)
  };

  // ── App server ───────────────────────────────────────────────────────────────────────────────

  const FACE_Y = CHASSIS.y + CHASSIS.d;
  const CX0 = CHASSIS.x;
  const CX1 = CHASSIS.x + CHASSIS.w;
  const SIDE_X = CX1;
  const BAYS = [0, 1, 2, 3].map((index) => CX0 + 10 + index * 14);

  function unitFace(unit: number) {
    const z0 = unitZ(unit);
    const z1 = z0 + UNIT_H - UNIT_GAP;
    if (unit === 0) {
      return {
        marks: join(BAYS.map((x) => faceRect(x, x + 12, z0 + 3, z1 - 3, FACE_Y))),
        leds: BAYS.map((x) => at([x + 10, FACE_Y, z1 - 5]))
      };
    }
    if (unit === 1) {
      const slots: string[] = [];
      for (let x = CX0 + 10; x + 3 <= CX1 - 10; x += 6) slots.push(faceRect(x, x + 3, z0 + 4, z1 - 4, FACE_Y));
      return { marks: join(slots), leds: [] as Flat[] };
    }
    return {
      marks: faceRect(CX0 + 10, CX0 + 34, z0 + 4, z1 - 4, FACE_Y),
      leds: [0, 1, 2, 3, 4].map((index) => at([CX1 - 30 + index * 4.4, FACE_Y, z0 + 8]))
    };
  }

  const DIAL_FROM = -120 * RADIANS;
  const DIAL_SPAN = 240 * RADIANS;
  const DIAL_STEPS = (ROUTES - 1) * 5;

  const UNIT_FACES = Array.from({ length: UNITS }, (_, unit) => unitFace(unit));
  const HANDLES: Plan[] = [CX0 + 3, CX1 - 6].map((x) => ({ x, y: FACE_Y, w: 3, d: 2.4, r: 0.8 }));

  const SERVER_ART = {
    halo: haloOf(CHASSIS, 0, 0.1, P),
    plinth: solid(insetPlan(CHASSIS, 2), 0, PLINTH_H, 4),
    units: Array.from({ length: UNITS }, (_, unit) => solid(CHASSIS, unitZ(unit), UNIT_H - UNIT_GAP, 4, 0.8)),
    unitMarks: UNIT_FACES.map((face) => face.marks),
    bayLeds: UNIT_FACES[0].leds,
    statusLeds: UNIT_FACES[2].leds,
    handles: Array.from({ length: UNITS }, (_, unit) => HANDLES.map((plan) => solid(plan, unitZ(unit) + 3, UNIT_H - UNIT_GAP - 6, 2))),
    /** Panel rule lines on the top unit, standing for printed text. */
    panelRules: join(
      [0.8, 0.5].map((share, row) => line([CX0 + 13, FACE_Y, unitZ(2) + 9 - row * 3], [CX0 + 13 + 18 * share, FACE_Y, unitZ(2) + 9 - row * 3]))
    ),
    vents: sideVents(),
    topScrews: screwsOn(CHASSIS, 5, SERVER_TOP),
    /** Screws on the tops of the lower units, hidden under the unit above until the server comes apart. */
    unitScrews: [0, 1].map((unit) => screwsOn(CHASSIS, 5, unitZ(unit) + UNIT_H - UNIT_GAP)),
    dialBase: round(DIAL_C[0], DIAL_C[1], DIAL_R + 2, SERVER_TOP, 1.6, 56),
    dial: round(DIAL_C[0], DIAL_C[1], DIAL_R, SERVER_TOP + 1.6, DIAL_H - 1.6, 64),
    dialKnurl: knurl(DIAL_C[0], DIAL_C[1], DIAL_R, DIAL_TOP - 2.6, DIAL_TOP, 72, P),
    dialBand: sideArc(DIAL_C[0], DIAL_C[1], DIAL_R, DIAL_TOP - 2.6, P, 40),
    bezel: ring(DIAL_C[0], DIAL_C[1], DIAL_R - 1.4, DIAL_TOP, P, 64),
    ...dialTicks(),
    hub: ring(DIAL_C[0], DIAL_C[1], 1.6, DIAL_TOP, P, 16)
  };

  /** The vent holes on the side, one list per unit, so each unit carries its own when the server comes apart. */
  function sideVents(): Flat[][] {
    return Array.from({ length: UNITS }, (_, unit) => {
      const dots: Flat[] = [];
      for (let row = 0; row < 2; row++) {
        for (let column = 0; column < 9; column++) {
          dots.push(at([SIDE_X, CHASSIS.y + 10 + column * 5, unitZ(unit) + 5.5 + row * 4.4]));
        }
      }
      return dots;
    });
  }

  function dialTicks() {
    const ticks = radialTicks(DIAL_C[0], DIAL_C[1], DIAL_R - 2.4, DIAL_STEPS, 5, DIAL_TOP, [1.3, 2.8], P, DIAL_FROM, DIAL_SPAN);
    const angle = DIAL_FROM + (ROUTE / (ROUTES - 1)) * DIAL_SPAN;
    const r = DIAL_R - 2.4;
    return {
      dialMinor: ticks.minor,
      dialMajor: ticks.major,
      routeMark: at([DIAL_C[0] + Math.sin(angle) * (r + 0.9), DIAL_C[1] - Math.cos(angle) * (r + 0.9), DIAL_TOP])
    };
  }

  /** The router needle, from its tail past the hub to its tip, at `dial` (0 at rest, 1 on `/users/:id`). */
  function needleOf(dial: number) {
    const angle = DIAL_FROM + dial * (ROUTE / (ROUTES - 1)) * DIAL_SPAN;
    const sx = Math.sin(angle);
    const sy = -Math.cos(angle);
    const [cx, cy] = DIAL_C;
    return lineOnTop([cx - sx * 3, cy - sy * 3], [cx + sx * (DIAL_R - 4.2), cy + sy * (DIAL_R - 4.2)], DIAL_TOP + 0.2, P);
  }

  // ── Cache ────────────────────────────────────────────────────────────────────────────────────

  const CACHE_FACE = CACHE_BOX.y + CACHE_BOX.d;
  const POCKET = (x: number): Plan => ({ x: x + CARD.x - 1.4, y: POCKET_Y + CARD.y - 1.4, w: CARD.w + 2.8, d: CARD.d + 2.8, r: 1.6 });
  const CACHE_LABEL: Plan = { x: CACHE_BOX.x + 6, y: CACHE_BOX.y + 3, w: 22, d: 5, r: 1 };
  const RAM_Y = [CACHE_BOX.y + 7, CACHE_BOX.y + 17, CACHE_BOX.y + 27];

  const CACHE_ART = {
    halo: haloOf(CACHE_BOX, 0, 0.1, P),
    plinth: solid(insetPlan(CACHE_BOX, 2), 0, 2, 4),
    box: solid(CACHE_BOX, 2, CACHE_H - 2, 4, 1),
    seam: sideSeam(CACHE_BOX, 8, P, 4),
    pockets: join(POCKET_X.map((x) => planOutline(POCKET(x), CACHE_H, P, 3))),
    pocketFloors: join(POCKET_X.map((x) => planOutline(insetPlan(POCKET(x), 0.9), CACHE_H, P, 3))),
    cards: POCKET_X.map((x) => solid({ ...CARD, x: x + CARD.x, y: POCKET_Y + CARD.y }, CACHE_H, CARD_H, 3)),
    cardMarks: POCKET_X.map(
      (x) =>
        ring(x + CARD.x + 4.2, POCKET_Y, 2.4, CACHE_H + CARD_H, P, 18) +
        join([-1.6, 0.4, 2.6].map((y, row) => lineOnTop([x + CARD.x + 8, POCKET_Y + y], [x + CARD.x + 8 + 6 * [0.9, 0.6, 0.75][row], POCKET_Y + y], CACHE_H + CARD_H, P)))
    ),
    leds: POCKET_X.map((x) => at([x, CACHE_FACE, 12.5])),
    ledRings: join(POCKET_X.map((x) => sideRing([x, CACHE_FACE, 12.5], 1.4, 'y', P, 14))),
    label: solid(CACHE_LABEL, CACHE_H, 0.5, 2),
    labelRules: rules({ ...CACHE_LABEL, d: 5 }, CACHE_H + 0.5, [0.7, 0.4, 0.55]),
    screws: [at([CACHE_BOX.x + CACHE_BOX.w - 4, CACHE_BOX.y + 4, CACHE_H]), at([CACHE_BOX.x + 4, CACHE_BOX.y + CACHE_BOX.d - 4, CACHE_H]), at([CACHE_BOX.x + CACHE_BOX.w - 4, CACHE_BOX.y + CACHE_BOX.d - 4, CACHE_H])],
    // Taken apart: the case as two pieces split at the seam, and what the plate covers on the body's top.
    body: solid(CACHE_BOX, 2, CACHE_SPLIT - 2, 4, 1),
    plate: solid(CACHE_BOX, CACHE_SPLIT, CACHE_H - CACHE_SPLIT, 4, 1),
    /** Three memory sticks lying across the body, each with a row of chips. */
    ramSticks: join(RAM_Y.map((y) => planOutline({ x: CACHE_BOX.x + 7, y, w: CACHE_BOX.w - 14, d: 6, r: 0.6 }, CACHE_SPLIT, P, 2))),
    ramChips: join(
      RAM_Y.flatMap((y) => Array.from({ length: 7 }, (_, chip) => planOutline({ x: CACHE_BOX.x + 10 + chip * 7.6, y: y + 1.5, w: 5.2, d: 3, r: 0.3 }, CACHE_SPLIT, P, 1)))
    ),
    bodyScrews: screwsOn(CACHE_BOX, 3.5, CACHE_SPLIT)
  };

  // ── Database: the filing cabinet ─────────────────────────────────────────────────────────────

  const CAB_FRONT = CABINET.y + CABINET.d;
  const LIP: Plan = insetPlan(CABINET, -1);
  const DRAWER_FRONT: Plan = { x: DB_X - 33, y: CAB_FRONT, w: 66, d: 2.4, r: 1 };
  const HANDLE: Plan = { x: DB_X - 10, y: CAB_FRONT + 2.4, w: 20, d: 2.2, r: 1 };
  const HOLDER = { x0: DB_X - 9, x1: DB_X + 9 };

  const drawerArt = (index: number) => {
    const z0 = DRAWER_Z[index];
    const z1 = z0 + DRAWER_H - 1;
    const front = DRAWER_FRONT.y + DRAWER_FRONT.d;
    return {
      front: solid(DRAWER_FRONT, z0, DRAWER_H - 1, 3, 0.5),
      handle: solid(HANDLE, z0 + 6, 2.6, 2, 0.3),
      handlePosts: [HANDLE.x + 2, HANDLE.x + HANDLE.w - 2].map((x) => at([x, HANDLE.y + HANDLE.d, z0 + 7.3])),
      holder: pathOf([at([HOLDER.x0, front, z1 - 3]), at([HOLDER.x1, front, z1 - 3]), at([HOLDER.x1, front, z1 - 8.5]), at([HOLDER.x0, front, z1 - 8.5])], true),
      holderCard: line([HOLDER.x0 + 2.5, front, z1 - 5.8], [HOLDER.x1 - 5, front, z1 - 5.8]),
      rivets: [HOLDER.x0 - 1.6, HOLDER.x1 + 1.6].map((x) => at([x, front, z1 - 5.75]))
    };
  };

  const DB_ART = {
    halo: haloOf(CABINET, 0, 0.1, P),
    plinth: solid(insetPlan(CABINET, 2), 0, 3, 4),
    body: solid(CABINET, 3, CABINET_H - 3, 3, 0.8),
    lip: solid(LIP, CABINET_H, 2, 3, 0.6),
    sideSeams: join([26, 49].map((z) => sideSeam(CABINET, z, P, 3))),
    /** Openings round each drawer front. */
    openings: join(DRAWER_Z.map((z0) => faceRect(DRAWER_FRONT.x - 0.8, DRAWER_FRONT.x + DRAWER_FRONT.w + 0.8, z0 - 0.6, z0 + DRAWER_H - 0.4, CAB_FRONT))),
    drawers: DRAWER_Z.map((_, index) => drawerArt(index)),
    topScrews: screwsOn(LIP, 4, CABINET_H + 2),
    /** The screws that hold the lid down, on the body's top under it. */
    bodyScrews: screwsOn(CABINET, 6, CABINET_H),
    label: topMatrix([DB_X, CABINET.y + CABINET.d - 12], CABINET_H + 2, P, 'x')
  };

  /** The part of a drawer that has slid out of the cabinet, rebuilt each frame from how far it is out. */
  function drawerOutOf(index: number, out: number) {
    if (out < 0.3) return null;
    const z0 = DRAWER_Z[index] + 1;
    const h = DRAWER_H - 4;
    const plan: Plan = { x: DRAWER_BOX.x, y: CAB_FRONT - 0.2, w: DRAWER_BOX.w, d: out + 0.2, r: 0 };
    const tabs: string[] = [];
    for (let y = CAB_FRONT + 3; y < CAB_FRONT + out - 1.5; y += 3) tabs.push(lineOnTop([DRAWER_BOX.x + 3, y], [DRAWER_BOX.x + DRAWER_BOX.w - 3, y], z0 + h - 1.6, P));
    return {
      box: extrude(
        [
          [plan.x, plan.y],
          [plan.x + plan.w, plan.y],
          [plan.x + plan.w, plan.y + plan.d],
          [plan.x, plan.y + plan.d]
        ],
        z0,
        h,
        P
      ),
      rim: planOutline(insetPlan({ ...plan, y: CAB_FRONT, d: out }, 1.6), z0 + h, P, 2),
      tabs: join(tabs)
    };
  }

  return { at, wheelSpokesOf, BASE_ART, RAIL_ART, SHUTTLE_ART, CARD_ART, CLIENT_ART, GATE_ART, SERVER_ART, needleOf, CACHE_ART, DB_ART, drawerOutOf };
}

export type Geometry = ReturnType<typeof geometryOf>;
