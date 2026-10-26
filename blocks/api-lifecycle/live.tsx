import * as React from 'react';
import { artOf } from './art';
import { geometryOf, type Geometry } from './geometry';
import { iso, translateAlong, type Point3, type Projection } from './iso-kit';
import { IsoFigure, follow, useInView, useLoop, useReadout } from './iso-react';
import {
  PROFILES,
  REST_SCENE,
  STATUS_TEXT,
  STOP,
  drawerOf,
  ms,
  planOf,
  pocketOf,
  readoutOf,
  sceneAt,
  type Anchor,
  type Plan,
  type Request,
  type Scene
} from './model';
import { orderOf, type Apart, type Item } from './order';
import { Screen, type ScreenHandle } from './screen';
import {
  ANCHOR_POINT,
  AZIMUTH,
  AZIMUTH_MAX,
  AZIMUTH_MIN,
  CASE,
  CASE_FRONT,
  CASE_H,
  CABINET,
  CABINET_H,
  CACHE_BOX,
  CACHE_H,
  CACHE_SPLIT,
  CHASSIS,
  DB_X,
  DIAL_C,
  DIAL_R,
  DIAL_TOP,
  DRAWER_H,
  DRAWER_OUT,
  DRAWER_REACH,
  DRAWER_STAIR,
  DRAWER_Z,
  GATE_LIFT,
  HEIGHT,
  LID_LIFT,
  P0,
  SCREEN,
  UNITS,
  UNIT_GAP,
  UNIT_H,
  WHEEL_R,
  WIDTH,
  liftOf,
  projectionAt,
  unitZ
} from './view';
import styles from './api-lifecycle.module.css';

const LABEL =
  'A request bench that fetches a user profile. A shuttle on a rail leaves the client terminal with a request ticket and a token key, stops at a gate whose reader checks the token, rides on to an app server whose router dial swings to /users/:id, asks a cache box with two pockets, and on a miss pulls a drawer of the users filing cabinet and lifts the row card onto its tray beside the ticket. It brings the card back past the cache, which keeps a copy, through the gate to the terminal, whose screen shows the profile.';

/** The tour a visitor sees when nobody is touching the bench: a miss, the same user from cache, an expired token, a missing user. */
const TOUR: Request[] = [
  { id: 42, token: 'valid' },
  { id: 42, token: 'valid' },
  { id: 108, token: 'expired' },
  { id: 77, token: 'valid' },
  { id: 108, token: 'valid' },
  { id: 108, token: 'valid' }
];
const TOUR_FIRST = 1.4;
const TOUR_GAP = 1.8;
const TOUR_BACK = 3.6;

/** Degrees the camera turns per CSS pixel of drag, how far a press may move and still count as a click, and easing times. */
const DRAG_RATE = 0.2;
const CLICK_SLOP = 4;
const TURN_EASE = 0.16;
const ZOOM_EASE = 0.3;
/** Close to the monitor, the camera turns almost square to the glass. */
const ZOOM_AZIMUTH = 84;
const FULL = [0, 0, WIDTH, HEIGHT];
/** The hand-over to the terminal: by these shares of it the card is lined up with the floppy slot and level
 * with it, and this is how high it lifts on the way. Its back edge reaches the face at about 0.75. */
const SLOT_ALIGN = 0.6;
const SLOT_LEVEL = 0.65;
const SLOT_LIFT = 14;
const SLOT_CLIP = 'api-lifecycle-slot';
/** The + and − buttons multiply the view's scale by this, between 1× and the most. */
export const SCALE_STEP = 1.5;
export const SCALE_MOST = 4;
const SCALE_EASE = 0.22;
/** How fast a machine comes apart and goes back together. */
const APART_EASE = 0.2;

/** The machines that come apart when clicked. */
export type Station = keyof Apart;
const STATIONS: Station[] = ['server', 'cache', 'db'];

const cornersAt = (plan: { x: number; y: number; w: number; d: number }, z: number): Point3[] =>
  [plan.x, plan.x + plan.w].flatMap((x) => [plan.y, plan.y + plan.d].map((y): Point3 => [x, y, z]));

const CAB_FRONT = CABINET.y + CABINET.d;
/** `state.drawer` while the cabinet is apart and every drawer is out. */
const ALL_DRAWERS = -2;
const DRAWER_ROWS = ['1–99', '100–199', '200+'];

/** The users filed in a drawer, for its label. */
const filedIn = (drawer: number) => {
  const ids = PROFILES.filter((profile) => drawerOf(profile.id) === drawer).map((profile) => profile.id);
  return ids.length ? `user ${ids.join(', ')} filed here` : 'no users filed yet';
};

interface Part {
  name: string;
  note: string;
  /** World points on the part's outline when the machine is `apart` (0..1) and its drawers are `outs` out; its
   * label's leader starts at the outermost. */
  points: (apart: number, outs: number[]) => Point3[];
}

/** What each part of a machine taken apart does, bottom to top. */
const PARTS: Record<Station, Part[]> = {
  server: [
    ...[
      { name: 'Worker pool', note: '4 processes share the load' },
      { name: 'Middleware', note: 'parses, logs, rate-limits' },
      { name: 'Handler', note: 'loads the user, builds JSON' }
    ].map((part, unit) => ({ ...part, points: (apart: number) => cornersAt(CHASSIS, unitZ(unit) + (UNIT_H - UNIT_GAP) / 2 + liftOf(unit, apart)) })),
    {
      name: 'Router',
      note: 'matches GET /users/:id',
      points: (apart) =>
        Array.from({ length: 48 }, (_, index): Point3 => {
          const angle = (index / 48) * Math.PI * 2;
          return [DIAL_C[0] + Math.cos(angle) * DIAL_R, DIAL_C[1] + Math.sin(angle) * DIAL_R, DIAL_TOP - 2 + liftOf(UNITS, apart)];
        })
    }
  ],
  cache: [
    { name: 'Memory', note: 'values held in RAM', points: (apart) => cornersAt(CACHE_BOX, (2 + CACHE_SPLIT) / 2 + liftOf(0, apart)) },
    { name: 'Keys', note: 'user:<id>, kept for 60 s', points: (apart) => cornersAt(CACHE_BOX, (CACHE_SPLIT + CACHE_H) / 2 + liftOf(1, apart)) }
  ],
  db: [
    ...DRAWER_ROWS.map((rows, drawer) => ({
      name: `Rows ${rows}`,
      note: filedIn(drawer),
      points: (_: number, outs: number[]) => cornersAt({ x: DB_X - 33, y: CAB_FRONT, w: 66, d: 2.4 + outs[drawer] }, DRAWER_Z[drawer] + (DRAWER_H - 1) / 2)
    })),
    {
      name: 'Table: users',
      note: 'the index on id picks the drawer',
      points: (apart) => cornersAt({ x: CABINET.x - 1, y: CABINET.y - 1, w: CABINET.w + 2, d: CABINET.d + 2 }, CABINET_H + 1 + LID_LIFT * apart)
    }
  ]
};

/** The box a machine fills, as tall and as deep as it is taken apart, for the click that opens it. */
function boxOf(station: Station, apart: number) {
  if (station === 'server') return { plan: CHASSIS, top: DIAL_TOP + liftOf(UNITS, apart) };
  if (station === 'cache') return { plan: CACHE_BOX, top: CACHE_H + liftOf(1, apart) };
  return { plan: { ...CABINET, d: CABINET.d + 5 + DRAWER_REACH * apart }, top: CABINET_H + 2 + LID_LIFT * apart };
}

const cross = (o: [number, number], a: [number, number], b: [number, number]) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);

/** Whether a view-box point lies on a machine's picture: inside the outline of its box as this camera sees it. */
function onStation(P: Projection, station: Station, apart: number, point: [number, number]) {
  const { plan, top } = boxOf(station, apart);
  const flat = [...cornersAt(plan, 0), ...cornersAt(plan, top)].map((corner) => iso(corner, P)).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // The convex hull, by the monotone chain, then the point must lie on the same side of every edge.
  const half = (points: [number, number][]) => {
    const chain: [number, number][] = [];
    for (const p of points) {
      while (chain.length >= 2 && cross(chain[chain.length - 2], chain[chain.length - 1], p) <= 0) chain.pop();
      chain.push(p);
    }
    return chain.slice(0, -1);
  };
  const hull = [...half(flat), ...half([...flat].reverse())];
  return hull.every((corner, index) => cross(corner, hull[(index + 1) % hull.length], point) >= 0);
}

/** Room between a machine's edge and its labels, in view-box units, and the widest a label runs. */
const CALLOUT_GAP = 16;
const CALLOUT_ROOM = 118;
/** The least height between two labels' leaders: a name, its note and some air. */
const CALLOUT_SPACING = 24;

const GEOMETRY_0 = geometryOf(P0);
const ART_0 = artOf(GEOMETRY_0);

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

const clampAzimuth = (azimuth: number) => Math.min(AZIMUTH_MAX, Math.max(AZIMUTH_MIN, azimuth));

/** Keep a zoomed view inside the drawing: its centre may move only as far as its edges can. */
function clampPan(camera: { scaleTarget: number; panXTarget: number; panYTarget: number }) {
  const x = (WIDTH / 2) * (1 - 1 / camera.scaleTarget);
  const y = (HEIGHT / 2) * (1 - 1 / camera.scaleTarget);
  camera.panXTarget = Math.min(x, Math.max(-x, camera.panXTarget));
  camera.panYTarget = Math.min(y, Math.max(-y, camera.panYTarget));
}

export interface BenchHandle {
  send: (request: Request) => void;
  flush: () => void;
  /** The visitor did something: stop the tour until they have been idle for a while. */
  touch: () => void;
  /** Turn the camera by `degrees`. */
  turn: (degrees: number) => void;
  /** Back to the resting camera: its angle, 1×, centred, out of the monitor. */
  home: () => void;
  /** Zoom the whole view by `factor` about its centre (the + and − buttons). */
  scaleBy: (factor: number) => void;
  /** Move in to the monitor (true), out (false), or toggle. */
  zoom: (on?: boolean) => void;
  /** Take a machine apart (true), put it back together (false), or toggle; one is apart at a time. */
  apart: (station: Station, on?: boolean) => void;
}

interface Props {
  onBusy: (busy: boolean) => void;
  onCache: (ids: number[]) => void;
  onTour: (request: Request) => void;
  onSend: () => void;
  onZoom: (zoomed: boolean) => void;
  onScale: (scale: number) => void;
  onApart: (open: Station | null) => void;
}

/** The view-box rectangle that frames the terminal's screen for this camera. */
function focusOf(P: Projection) {
  const x0 = SCREEN.x;
  const x1 = SCREEN.x + SCREEN.w;
  const z0 = SCREEN.z - SCREEN.h;
  const z1 = SCREEN.z;
  const corners = [
    [x0, CASE_FRONT, z0],
    [x1, CASE_FRONT, z0],
    [x1, CASE_FRONT, z1],
    [x0, CASE_FRONT, z1]
  ].map((point) => iso(point as Point3, P));
  const xs = corners.map(([x]) => x);
  const ys = corners.map(([, y]) => y);
  const left = Math.min(...xs);
  const right = Math.max(...xs);
  const up = Math.min(...ys);
  const down = Math.max(...ys);
  let w = (right - left) * 1.7;
  let h = (down - up) * 1.7;
  if (w / h < WIDTH / HEIGHT) w = (h * WIDTH) / HEIGHT;
  else h = (w * HEIGHT) / WIDTH;
  return [(left + right) / 2 - w / 2, (up + down) / 2 - h / 2, w, h];
}

/** Whether a view-box point lies on the terminal, for the click that moves in to the monitor. */
function onTerminal(P: Projection, [px, py]: [number, number]) {
  let left = Infinity;
  let right = -Infinity;
  let up = Infinity;
  let down = -Infinity;
  for (const x of [CASE.x, CASE.x + CASE.w]) {
    for (const y of [CASE.y, CASE_FRONT]) {
      for (const z of [0, CASE_H]) {
        const [sx, sy] = iso([x, y, z], P);
        left = Math.min(left, sx);
        right = Math.max(right, sx);
        up = Math.min(up, sy);
        down = Math.max(down, sy);
      }
    }
  }
  return px >= left && px <= right && py >= up && py <= down;
}

const show = (node: Element | null, shown: boolean) => {
  if (!node) return;
  if (shown) node.removeAttribute('data-hidden');
  else node.setAttribute('data-hidden', '');
};

const html = (node: Element | null, markup: string) => {
  if (node && node.innerHTML !== markup) node.innerHTML = markup;
};

type Groups = Record<
  | 'base'
  | 'client'
  | 'screen'
  | 'server'
  | 'serverArt'
  | 'dialArt'
  | 'callouts'
  | 'gateBack'
  | 'cache'
  | 'db'
  | 'dbArt'
  | 'drawers'
  | 'rail'
  | 'shuttle'
  | 'shuttleBody'
  | 'slip'
  | 'slipArt'
  | 'carried'
  | 'carriedArt'
  | 'gatePlate'
  | 'gatePlateArt'
  | 'gateBeam'
  | 'gateFront'
  | 'gateFrontArt'
  | 'card'
  | 'cardArt',
  SVGGElement | null
>;

/** The bench itself. It never re-renders: every frame, and every turn of the camera, writes through refs. */
export const Bench = React.memo(
  React.forwardRef<BenchHandle, Props>(function Bench({ onBusy, onCache, onTour, onSend, onZoom, onScale, onApart }, handle) {
    const { anchor, say } = useReadout<HTMLDivElement>();
    const inView = useInView(anchor);
    const screen = React.useRef<ScreenHandle>(null);
    const announce = React.useRef<HTMLSpanElement>(null);
    const needle = React.useRef<SVGPathElement>(null);
    const reader = React.useRef<SVGCircleElement>(null);
    const slotClip = React.useRef<SVGPathElement>(null);
    const groups = React.useRef({} as Groups);
    const drawerOut = React.useRef<(SVGGElement | null)[]>([]);
    const drawerFront = React.useRef<(SVGGElement | null)[]>([]);
    /** The server's layers, bottom to top: three units, then the dial with its needle. */
    const serverLayer = React.useRef<(SVGGElement | null)[]>([]);
    const callouts = React.useRef<Partial<Record<Station, SVGGElement | null>>>({});
    const drag = React.useRef<{ id: number; x: number; y: number; azimuth: number; panX: number; panY: number; pan: boolean; moved: boolean } | null>(null);
    const live = React.useRef({
      plan: null as Plan | null,
      t: 0,
      finished: true,
      scene: REST_SCENE,
      /** The plan the bench last showed, so a redraw replays exactly what is on screen. */
      shown: null as Plan | null,
      cached: new Set<number>(),
      screen: 'idle',
      drawer: -1,
      order: '',
      tour: { index: 0, wait: TOUR_FIRST, hovering: false, idle: TOUR_BACK },
      camera: {
        azimuth: AZIMUTH,
        target: AZIMUTH,
        home: AZIMUTH,
        drawn: AZIMUTH,
        zoom: 0,
        zoomTarget: 0,
        // The +/− zoom of the whole view and where it is panned to, in view-box units from the centre.
        scale: 1,
        scaleTarget: 1,
        panX: 0,
        panY: 0,
        panXTarget: 0,
        panYTarget: 0,
        shown: ''
      },
      /** How far each machine is taken apart (0..1), where it is heading, and what was last placed. */
      apart: { server: 0, cache: 0, db: 0 } as Apart,
      apartTarget: { server: 0, cache: 0, db: 0 } as Apart,
      apartShown: { server: 0, cache: 0, db: 0 } as Apart,
      /** How far each drawer of a cabinet taken apart is out. */
      outs: [0, 0, 0],
      P: P0,
      geometry: GEOMETRY_0 as Geometry
    });
    const callbacks = React.useRef({ onBusy, onCache, onTour, onSend, onZoom, onScale, onApart });
    callbacks.current = { onBusy, onCache, onTour, onSend, onZoom, onScale, onApart };

    const ref = (key: keyof Groups) => (node: SVGGElement | null) => {
      groups.current[key] = node;
    };

    /** Put the groups back to front for this camera; the flying card always goes last. */
    const sort = React.useCallback((scene: Scene) => {
      const state = live.current;
      const g = groups.current;
      const order = orderOf(state.P, scene.x, scene.gate, state.apart);
      const key = order.join();
      if (key === state.order) return;
      state.order = key;
      const svg = g.base?.parentNode;
      if (!svg) return;
      const nodesOf: Record<Item, (SVGGElement | null)[]> = {
        client: [g.client, g.screen],
        server: [g.server],
        gateBack: [g.gateBack],
        cache: [g.cache],
        db: [g.db],
        rail: [g.rail],
        shuttle: [g.shuttle],
        gatePlate: [g.gatePlate],
        gateBeam: [g.gateBeam],
        gateFront: [g.gateFront]
      };
      for (const item of order) for (const node of nodesOf[item]) if (node) svg.appendChild(node);
      if (g.card) svg.appendChild(g.card);
      // The labels of a machine taken apart lie over everything.
      if (g.callouts) svg.appendChild(g.callouts);
    }, []);

    /** Lift a machine's parts apart as far as `apart` says, and lay their labels out beside it. */
    const placeStation = React.useCallback((station: Station) => {
      const state = live.current;
      const g = groups.current;
      const P = state.P;
      const apart = state.apart[station];
      state.apartShown[station] = apart;
      const lift = (node: Element | null | undefined, z: number) => node?.setAttribute('transform', translateAlong(P, [0, 0, z]));
      if (station === 'server') serverLayer.current.forEach((layer, index) => lift(layer, liftOf(index, apart)));
      if (station === 'cache') {
        // At rest the case is drawn whole; apart, as its two pieces.
        show(g.cache?.querySelector('[data-whole]') ?? null, apart === 0);
        show(g.cache?.querySelector('[data-split]') ?? null, apart > 0);
        g.cache?.querySelectorAll('[data-split] [data-layer]').forEach((layer, index) => lift(layer, liftOf(index, apart)));
      }
      if (station === 'db') lift(g.dbArt?.querySelector('[data-layer="lid"]'), LID_LIFT * apart);

      const node = callouts.current[station] ?? null;
      show(node, apart > 0.5);
      if (!node || apart <= 0.5) return;
      node.setAttribute('opacity', `${Math.round(smooth((apart - 0.5) / 0.5) * 100) / 100}`);
      const flat = PARTS[station].map((part) => part.points(apart, state.outs).map((point) => iso(point, P)));
      const xs = flat.flat().map(([x]) => x);
      // Labels go on the right, unless they would run off the drawing there.
      const side = Math.max(...xs) + CALLOUT_GAP + CALLOUT_ROOM <= WIDTH ? 1 : -1;
      const x = side > 0 ? Math.max(...xs) + CALLOUT_GAP : Math.min(...xs) - CALLOUT_GAP;
      // What a label must not lie on: the other machines and the terminal, as this camera sees them.
      const obstacles = [
        ...STATIONS.filter((other) => other !== station).map((other) => boxOf(other, state.apart[other])),
        { plan: CASE, top: CASE_H }
      ].map(({ plan, top }) => {
        const corners = [...cornersAt(plan, 0), ...cornersAt(plan, top)].map((corner) => iso(corner, P));
        return {
          left: Math.min(...corners.map(([cx]) => cx)),
          right: Math.max(...corners.map(([cx]) => cx)),
          up: Math.min(...corners.map(([, cy]) => cy)),
          down: Math.max(...corners.map(([, cy]) => cy))
        };
      });
      // Labels go bottom to top. One that would crowd the label below it, or lie on another machine, moves up, and
      // its leader turns up to reach it; leaders of higher parts turn further out, so no two cross.
      let below = Infinity;
      flat.forEach((points, index) => {
        const part = node.children[index];
        if (!part) return;
        const [ax, ay] = points.reduce((best, point) => (point[0] * side > best[0] * side ? point : best));
        const width = Math.max(...Array.from(part.querySelectorAll('text'), (text) => text.getComputedTextLength())) + 3;
        const [from, to] = side > 0 ? [x, x + width] : [x - width, x];
        let ly = Math.min(ay, below - CALLOUT_SPACING);
        for (let pass = 0; pass < 4; pass++) {
          // A label runs from its name above the leader to its note below it.
          const blocking = obstacles.filter((box) => from < box.right + 2 && to > box.left - 2 && ly - 9 < box.down && ly + 11 > box.up);
          if (!blocking.length) break;
          ly = Math.min(...blocking.map((box) => box.up)) - 12;
        }
        below = ly;
        const turn = x - side * (3 + 3 * index);
        part.querySelector('circle')?.setAttribute('cx', `${ax}`);
        part.querySelector('circle')?.setAttribute('cy', `${ay}`);
        part.querySelector('path')?.setAttribute('d', ly === ay ? `M${ax} ${ay}H${x}` : `M${ax} ${ay}H${turn}V${ly}H${x}`);
        part.querySelectorAll('text').forEach((text, line) => {
          text.setAttribute('x', `${x + 3 * side}`);
          text.setAttribute('y', `${ly + (line ? 7.2 : -1.8)}`);
          text.setAttribute('text-anchor', side > 0 ? 'start' : 'end');
        });
      });
    }, []);

    /** Slide a drawer out by `out` world units: its front moves, and the part out of the cabinet is rebuilt. */
    const drawOut = React.useCallback((drawer: number, out: number) => {
      const { P, geometry } = live.current;
      drawerFront.current[drawer]?.setAttribute('transform', translateAlong(P, [0, out, 0]));
      const part = geometry.drawerOutOf(drawer, out);
      const list = part ? [part.box.fill, ...part.box.shades, part.box.top, part.box.crease, part.rim, part.tabs, part.box.outline] : [];
      drawerOut.current[drawer]?.querySelectorAll('path').forEach((path, index) => path.setAttribute('d', list[index] ?? ''));
    }, []);

    const placeDrawers = React.useCallback(
      (scene: Scene, plan: Plan | null) => {
        const g = groups.current;
        const state = live.current;
        const drawer = plan ? drawerOf(plan.request.id) : -1;
        const out = scene.drawer * DRAWER_OUT;
        const apart = state.apart.db;
        if (apart > 0) {
          // Taken apart, the drawers step out like stairs, and a fetch eases its own out to the reach, so its open
          // end shows past the drawer above. Drawn bottom to top, each drawer hides what lies under the one above it.
          if (state.drawer !== ALL_DRAWERS) {
            drawerOut.current.forEach((node) => {
              const group = node?.parentNode;
              if (group && g.drawers) g.drawers.appendChild(group);
            });
            state.drawer = ALL_DRAWERS;
          }
          const reach = DRAWER_OUT + (DRAWER_REACH - DRAWER_OUT) * apart;
          const outs = DRAWER_STAIR.map((stair, index) => stair * apart + (index === drawer ? (reach - stair * apart) * scene.drawer : 0));
          outs.forEach((value, index) => drawOut(index, value));
          if (outs.some((value, index) => value !== state.outs[index])) {
            state.outs = outs;
            placeStation('db');
          }
          return;
        }
        // The drawer for this id slides out; it is drawn last so it sits in front of the others.
        if (drawer !== state.drawer) {
          const group = drawerOut.current[drawer]?.parentNode;
          if (group && g.drawers) g.drawers.appendChild(group);
          drawerFront.current.forEach((node, index) => {
            if (index !== drawer) node?.removeAttribute('transform');
          });
          drawerOut.current.forEach((node, index) => {
            if (index !== drawer) node?.querySelectorAll('path').forEach((path) => path.setAttribute('d', ''));
          });
          state.drawer = drawer;
        }
        if (drawer >= 0) drawOut(drawer, out);
      },
      [drawOut, placeStation]
    );

    const apply = React.useCallback(
      (scene: Scene, plan: Plan | null) => {
        const g = groups.current;
        const state = live.current;
        const { P, geometry } = state;
        state.scene = scene;
        state.shown = plan;
        g.shuttle?.setAttribute('transform', translateAlong(P, [scene.x, 0, 0]));
        g.gatePlate?.setAttribute('transform', translateAlong(P, [0, 0, scene.gate * GATE_LIFT]));
        reader.current?.setAttribute('data-state', scene.reader);
        if (scene.busy) g.server?.setAttribute('data-busy', '');
        else g.server?.removeAttribute('data-busy');
        needle.current?.setAttribute('d', geometry.needleOf(scene.dial));

        show(g.slip, scene.slip !== 'none');
        g.slip?.setAttribute('data-state', scene.slip);
        const card = scene.card;
        const riding = Boolean(card && card.from === 'shuttle' && card.to === 'shuttle');
        show(g.carried, riding);
        const flying = Boolean(plan && card && card.from !== card.to);
        show(g.card, flying);
        g.shuttleBody?.querySelector('[data-spokes]')?.setAttribute('d', geometry.wheelSpokesOf(-scene.x / WHEEL_R));
        if (plan && card && flying) {
          const anchorPoint = (where: Anchor): Point3 => {
            if (where === 'drawer') {
              // In a cabinet taken apart, a fetch pulls its drawer out to the reach instead of the usual distance.
              const [x, y, z] = ANCHOR_POINT.drawer(drawerOf(plan.request.id));
              return [x, y + (DRAWER_REACH - DRAWER_OUT) * state.apart.db, z];
            }
            if (where === 'pocket') {
              // The pockets ride on the cache's plate, which rises when the cache is taken apart.
              const [x, y, z] = ANCHOR_POINT.pocket(Math.max(0, pocketOf(plan.request.id)));
              return [x, y, z + liftOf(1, state.apart.cache)];
            }
            if (where === 'terminal') return ANCHOR_POINT.terminal();
            return ANCHOR_POINT.shuttle(scene.x);
          };
          const a = anchorPoint(card.from);
          const b = anchorPoint(card.to);
          const between = (from: Point3, to: Point3, u: number): Point3 => [from[0] + (to[0] - from[0]) * u, from[1] + (to[1] - from[1]) * u, from[2] + (to[2] - from[2]) * u];
          let point: Point3;
          if (card.to === 'terminal') {
            // One smooth hop from the tray into the floppy slot, driven by the step's single eased clock: the card
            // lines up with the slot and settles to its height early, while it travels in steadily, so it reaches
            // the face level and square and slides straight in. Every term starts and ends with zero slope.
            const s = card.t;
            const along = smooth(s / SLOT_ALIGN);
            const settle = smooth(s / SLOT_LEVEL);
            const u = Math.min(1, s / SLOT_LEVEL);
            point = [
              a[0] + (b[0] - a[0]) * along,
              a[1] + (b[1] - a[1]) * s,
              b[2] + (a[2] - b[2]) * (1 - settle) + SLOT_LIFT * 16 * u * u * (1 - u) * (1 - u)
            ];
            // The line where the face meets the card's underside: anything of the card behind the face draws above it.
            // That holds only at slot height, so the cut starts once the card has settled there (before it reaches
            // the face); higher up in its lift, the card would be cut off in mid-air.
            if (s >= SLOT_LEVEL) {
              const z = b[2];
              const left = iso([-4000, CASE_FRONT, z], P);
              const right = iso([4000, CASE_FRONT, z], P);
              const origin = iso([0, CASE_FRONT, z], P);
              const ahead = iso([0, CASE_FRONT + 4000, z], P);
              const toward = [ahead[0] - origin[0], ahead[1] - origin[1]];
              slotClip.current?.setAttribute(
                'd',
                `M${left[0]} ${left[1]}L${right[0]} ${right[1]}L${right[0] + toward[0]} ${right[1] + toward[1]}L${left[0] + toward[0]} ${left[1] + toward[1]}Z`
              );
              g.card?.setAttribute('clip-path', `url(#${SLOT_CLIP})`);
            } else g.card?.removeAttribute('clip-path');
          } else {
            point = between(a, b, card.t);
            point[2] += 14 * Math.sin(Math.PI * card.t);
            g.card?.removeAttribute('clip-path');
          }
          g.cardArt?.setAttribute('transform', translateAlong(P, point));
          const enter = card.from === 'drawer' ? smooth(card.t / 0.2) : 1;
          g.card?.setAttribute('opacity', `${Math.round(enter * 100) / 100}`);
        }

        placeDrawers(scene, plan);

        const holds = new Set(state.cached);
        if (plan && scene.stored) holds.add(plan.request.id);
        g.cache?.querySelectorAll<SVGElement>('[data-pocket]').forEach((node) => {
          const index = Number(node.dataset.pocket);
          if (node.tagName === 'circle') node.toggleAttribute('data-on', scene.pocket === index);
          else show(node, holds.has(PROFILES[index]?.id));
        });

        sort(scene);
        say(readoutOf(plan, scene));
        if (scene.screen !== state.screen) {
          state.screen = scene.screen;
          screen.current?.show(scene.screen, plan);
        }
      },
      [placeDrawers, say, sort]
    );

    /** Draw the whole bench again for a camera at `azimuth`, then put every moving part back where it was. */
    const redraw = React.useCallback(
      (azimuth: number) => {
        const state = live.current;
        const g = groups.current;
        const P = projectionAt(azimuth);
        const geometry = geometryOf(P);
        const art = artOf(geometry);
        state.P = P;
        state.geometry = geometry;
        state.camera.drawn = azimuth;
        html(g.base, art.base);
        html(g.client, art.client);
        html(g.serverArt, art.server);
        art.serverUnits.forEach((markup, index) => html(serverLayer.current[index], markup));
        html(g.dialArt, art.serverDial);
        html(g.gateBack, art.gateBack);
        html(g.cache, art.cache);
        html(g.dbArt, art.db);
        art.drawerFronts.forEach((markup, index) => html(drawerFront.current[index], markup));
        html(g.rail, art.rail);
        html(g.shuttleBody, art.shuttle);
        html(g.slipArt, art.slip);
        html(g.carriedArt, art.card);
        g.carriedArt?.setAttribute('transform', translateAlong(P, ANCHOR_POINT.shuttle(0)));
        html(g.gatePlateArt, art.gatePlate);
        html(g.gateBeam, art.gateBeam);
        html(g.gateFrontArt, art.gateFront);
        html(g.cardArt, art.card);
        reader.current?.setAttribute('cx', `${geometry.GATE_ART.led[0]}`);
        reader.current?.setAttribute('cy', `${geometry.GATE_ART.led[1]}`);
        screen.current?.place(geometry);
        // A new camera can change who is in front of whom even if nothing moved.
        state.order = '';
        apply(state.scene, state.shown);
        STATIONS.forEach(placeStation);
      },
      [apply, placeStation]
    );

    const frame = React.useCallback(() => {
      const state = live.current;
      const camera = state.camera;
      // The +/− view first, then the monitor's close-up blended over it.
      const w = WIDTH / camera.scale;
      const h = HEIGHT / camera.scale;
      const view = [WIDTH / 2 + camera.panX - w / 2, HEIGHT / 2 + camera.panY - h / 2, w, h];
      const box = camera.zoom ? focusOf(state.P).map((value, index) => view[index] + (value - view[index]) * camera.zoom) : view;
      const svg = groups.current.base?.ownerSVGElement;
      svg?.setAttribute('viewBox', box.map((value) => Math.round(value * 100) / 100).join(' '));
    }, []);

    const finish = React.useCallback((plan: Plan) => {
      const state = live.current;
      state.finished = true;
      // A miss has stored its row by now (see `tick`); this only covers a plan cut short by reduced motion.
      if (plan.outcome === 'miss') state.cached.add(plan.request.id);
      callbacks.current.onBusy(false);
      callbacks.current.onCache(Array.from(state.cached));
      const tag = plan.outcome === 'hit' ? ', from the cache' : plan.outcome === 'miss' ? ', from the database' : '';
      if (announce.current) announce.current.textContent = `${STATUS_TEXT[plan.outcome === 'expired' ? 401 : plan.outcome === 'missing' ? 404 : 200]} in ${ms(plan.ms)}${tag}`;
    }, []);

    const start = React.useCallback((request: Request) => {
      const state = live.current;
      if (!state.finished) return false;
      state.plan = planOf(request, state.cached.has(request.id));
      state.t = 0;
      state.finished = false;
      callbacks.current.onBusy(true);
      return true;
    }, []);

    const tick = (dt: number, calm: boolean) => {
      const state = live.current;
      const camera = state.camera;
      camera.azimuth = follow(camera.azimuth, camera.target, dt, TURN_EASE, calm);
      camera.zoom = follow(camera.zoom, camera.zoomTarget, dt, ZOOM_EASE, calm);
      camera.scale = follow(camera.scale, camera.scaleTarget, dt, SCALE_EASE, calm);
      camera.panX = follow(camera.panX, camera.panXTarget, dt, SCALE_EASE, calm);
      camera.panY = follow(camera.panY, camera.panYTarget, dt, SCALE_EASE, calm);
      for (const station of STATIONS) {
        state.apart[station] = follow(state.apart[station], state.apartTarget[station], dt, APART_EASE, calm);
        if (state.apart[station] === state.apartShown[station]) continue;
        placeStation(station);
        if (station === 'db') placeDrawers(state.scene, state.shown);
        sort(state.scene);
      }
      const turned = Math.abs(camera.azimuth - camera.drawn) > 0.01;
      if (turned) redraw(camera.azimuth);
      const shown = `${camera.zoom} ${camera.scale} ${camera.panX} ${camera.panY}`;
      if (turned || shown !== camera.shown) {
        camera.shown = shown;
        frame();
      }
      const moving =
        camera.azimuth !== camera.target ||
        camera.zoom !== camera.zoomTarget ||
        camera.scale !== camera.scaleTarget ||
        camera.panX !== camera.panXTarget ||
        camera.panY !== camera.panYTarget ||
        STATIONS.some((station) => state.apart[station] !== state.apartTarget[station]);

      const plan = state.plan;
      if (plan && !state.finished) {
        state.t = calm ? plan.secs : state.t + dt;
        const scene = sceneAt(plan, state.t);
        apply(scene, plan);
        // The cache holds the row from the moment the SET runs, not from when the response lands.
        if (scene.stored && !state.cached.has(plan.request.id)) {
          state.cached.add(plan.request.id);
          callbacks.current.onCache(Array.from(state.cached));
        }
        if (scene.done) finish(plan);
      }
      // The tour runs only while the bench is idle, in view, not hovered, and the visitor has left it alone.
      const tour = state.tour;
      if (calm) return moving || !state.finished;
      tour.idle += dt;
      if (state.finished && !tour.hovering && tour.idle >= TOUR_BACK) {
        tour.wait -= dt;
        if (tour.wait <= 0) {
          if (tour.index === 0) {
            state.cached.clear();
            callbacks.current.onCache([]);
            apply({ ...REST_SCENE, screen: state.screen as Scene['screen'] }, null);
          }
          const request = TOUR[tour.index];
          tour.index = (tour.index + 1) % TOUR.length;
          tour.wait = TOUR_GAP;
          callbacks.current.onTour(request);
          start(request);
        }
      }
      return true;
    };

    const kick = useLoop(tick, inView);

    const touch = React.useCallback(() => {
      live.current.tour.idle = 0;
      kick();
    }, [kick]);

    const zoom = React.useCallback(
      (on?: boolean) => {
        const camera = live.current.camera;
        const want = on ?? camera.zoomTarget === 0;
        if (want === (camera.zoomTarget === 1)) return;
        if (want) {
          camera.home = camera.target;
          camera.target = ZOOM_AZIMUTH;
        } else camera.target = camera.home;
        camera.zoomTarget = want ? 1 : 0;
        callbacks.current.onZoom(want);
        touch();
      },
      [touch]
    );

    const apart = React.useCallback(
      (station: Station, on?: boolean) => {
        const state = live.current;
        const want = on ?? state.apartTarget[station] === 0;
        if (want === (state.apartTarget[station] === 1)) return;
        // One machine is apart at a time, so their labels never crowd each other.
        for (const other of STATIONS) state.apartTarget[other] = 0;
        state.apartTarget[station] = want ? 1 : 0;
        callbacks.current.onApart(want ? station : null);
        touch();
      },
      [touch]
    );

    const setScale = React.useCallback(
      (scale: number) => {
        const camera = live.current.camera;
        camera.scaleTarget = Math.min(SCALE_MOST, Math.max(1, Math.round(scale * 1000) / 1000));
        if (camera.scaleTarget === 1) {
          camera.panXTarget = 0;
          camera.panYTarget = 0;
        } else clampPan(camera);
        callbacks.current.onScale(camera.scaleTarget);
        touch();
      },
      [touch]
    );

    React.useImperativeHandle(
      handle,
      () => ({
        send: (request) => {
          live.current.tour.idle = 0;
          live.current.tour.wait = TOUR_GAP;
          if (start(request)) kick();
        },
        flush: () => {
          const state = live.current;
          // A request in flight has already asked the cache; flushing under it would contradict what it found.
          if (!state.finished) return;
          state.tour.idle = 0;
          state.cached.clear();
          callbacks.current.onCache([]);
          apply({ ...REST_SCENE, screen: state.screen as Scene['screen'] }, null);
          kick();
        },
        touch,
        turn: (degrees) => {
          const camera = live.current.camera;
          camera.target = clampAzimuth(camera.target + degrees);
          touch();
        },
        home: () => {
          const camera = live.current.camera;
          camera.home = AZIMUTH;
          if (camera.zoomTarget) zoom(false);
          camera.target = AZIMUTH;
          setScale(1);
          STATIONS.forEach((station) => apart(station, false));
          touch();
        },
        scaleBy: (factor) => {
          // The buttons zoom the bench, so they first step back out of the monitor.
          if (live.current.camera.zoomTarget) zoom(false);
          setScale(live.current.camera.scaleTarget * factor);
        },
        zoom,
        apart
      }),
      [apart, apply, kick, setScale, start, touch, zoom]
    );

    const hover = (hovering: boolean) => () => {
      live.current.tour.hovering = hovering;
      if (!hovering) live.current.tour.idle = 0;
      kick();
    };

    // At 1× a drag turns the camera; zoomed in with +, it pans. A press that barely moves is a click.
    const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
      if (event.button !== 0) return;
      const camera = live.current.camera;
      drag.current = {
        id: event.pointerId,
        x: event.clientX,
        y: event.clientY,
        azimuth: camera.target,
        panX: camera.panXTarget,
        panY: camera.panYTarget,
        pan: camera.scaleTarget > 1 && !camera.zoomTarget,
        moved: false
      };
    };
    const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
      const held = drag.current;
      if (!held || held.id !== event.pointerId) return;
      const dx = event.clientX - held.x;
      const dy = event.clientY - held.y;
      if (!held.moved && Math.hypot(dx, held.pan ? dy : 0) > CLICK_SLOP) {
        held.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (!held.moved) return;
      const camera = live.current.camera;
      if (held.pan) {
        // The bench follows the hand: one CSS pixel is this many view-box units at the current scale.
        const width = groups.current.base?.ownerSVGElement?.getBoundingClientRect().width || WIDTH;
        const units = WIDTH / camera.scaleTarget / width;
        camera.panXTarget = held.panX - dx * units;
        camera.panYTarget = held.panY - dy * units;
        clampPan(camera);
      } else {
        // The bench's front follows the hand.
        camera.target = clampAzimuth(held.azimuth + dx * DRAG_RATE);
      }
      touch();
    };
    const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
      const held = drag.current;
      drag.current = null;
      if (!held || held.id !== event.pointerId) return;
      if (held.moved) {
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
        return;
      }
      if (live.current.camera.zoomTarget) return zoom(false);
      const svg = groups.current.base?.ownerSVGElement;
      const matrix = svg?.getScreenCTM();
      if (svg && matrix) {
        const point = new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse());
        if (onTerminal(live.current.P, [point.x, point.y])) return zoom(true);
        // Of the machines under the point, the one drawn last is in front.
        const state = live.current;
        const order = state.order.split(',');
        const hit = STATIONS.filter((station) => onStation(state.P, station, state.apart[station], [point.x, point.y])).sort(
          (a, b) => order.indexOf(b) - order.indexOf(a)
        )[0];
        if (hit) return apart(hit);
      }
      callbacks.current.onSend();
    };
    const onPointerCancel = () => {
      drag.current = null;
    };

    return (
      <div
        ref={anchor}
        className={styles.stage}
        onPointerEnter={hover(true)}
        onPointerLeave={hover(false)}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <IsoFigure width={WIDTH} height={HEIGHT} label={LABEL}>
          <g ref={ref('base')} dangerouslySetInnerHTML={{ __html: ART_0.base }} />
          <g ref={ref('client')} dangerouslySetInnerHTML={{ __html: ART_0.client }} />
          <g ref={ref('screen')}>
            <Screen ref={screen} geometry={GEOMETRY_0} />
          </g>
          <g ref={ref('server')} className={styles.server}>
            <g ref={ref('serverArt')} dangerouslySetInnerHTML={{ __html: ART_0.server }} />
            {ART_0.serverUnits.map((markup, index) => (
              <g key={index} ref={(node) => void (serverLayer.current[index] = node)} dangerouslySetInnerHTML={{ __html: markup }} />
            ))}
            <g ref={(node) => void (serverLayer.current[UNITS] = node)}>
              <g ref={ref('dialArt')} dangerouslySetInnerHTML={{ __html: ART_0.serverDial }} />
              <path ref={needle} className="iso-line" data-tone="lit" data-free="start" strokeWidth={1.1} d={GEOMETRY_0.needleOf(0)} />
            </g>
          </g>
          <g ref={ref('gateBack')} dangerouslySetInnerHTML={{ __html: ART_0.gateBack }} />
          <g ref={ref('cache')} dangerouslySetInnerHTML={{ __html: ART_0.cache }} />
          <g ref={ref('db')}>
            <g ref={ref('dbArt')} dangerouslySetInnerHTML={{ __html: ART_0.db }} />
            <g ref={ref('drawers')}>
              {ART_0.drawerFronts.map((markup, index) => (
                <g key={index}>
                  <g ref={(node) => void (drawerOut.current[index] = node)} className="iso-solid">
                    <path className="iso-fill" />
                    {[0, 1, 2, 3].map((shade) => (
                      <path key={shade} className="iso-shade" data-shade={shade} />
                    ))}
                    <path className="iso-top" />
                    <path className="iso-line" data-tone="faint" />
                    <path className="iso-line" data-tone="lo" />
                    <path className="iso-line" data-tone="faint" />
                    <path className="iso-line iso-edge" data-tone="mid" />
                  </g>
                  <g ref={(node) => void (drawerFront.current[index] = node)} dangerouslySetInnerHTML={{ __html: markup }} />
                </g>
              ))}
            </g>
          </g>
          <g ref={ref('rail')} dangerouslySetInnerHTML={{ __html: ART_0.rail }} />
          <g ref={ref('shuttle')} transform={translateAlong(P0, [STOP.client, 0, 0])}>
            <g ref={ref('shuttleBody')} dangerouslySetInnerHTML={{ __html: ART_0.shuttle }} />
            <g ref={ref('slip')} className={styles.slip} data-hidden="">
              <g ref={ref('slipArt')} dangerouslySetInnerHTML={{ __html: ART_0.slip }} />
            </g>
            <g ref={ref('carried')} className={styles.carried} data-hidden="">
              <g ref={ref('carriedArt')} transform={translateAlong(P0, ANCHOR_POINT.shuttle(0))} dangerouslySetInnerHTML={{ __html: ART_0.card }} />
            </g>
          </g>
          <g ref={ref('gatePlate')}>
            <g ref={ref('gatePlateArt')} dangerouslySetInnerHTML={{ __html: ART_0.gatePlate }} />
          </g>
          <g ref={ref('gateFront')}>
            <g ref={ref('gateFrontArt')} dangerouslySetInnerHTML={{ __html: ART_0.gateFront }} />
            <circle ref={reader} className={styles.led} data-state="idle" cx={GEOMETRY_0.GATE_ART.led[0]} cy={GEOMETRY_0.GATE_ART.led[1]} r={0.9} />
          </g>
          <g ref={ref('gateBeam')} dangerouslySetInnerHTML={{ __html: ART_0.gateBeam }} />
          {/* Hides the part of the card that has gone into the floppy slot: everything behind the case's front face. */}
          <clipPath id={SLOT_CLIP}>
            <path ref={slotClip} />
          </clipPath>
          <g ref={ref('card')} className={styles.carried} data-hidden="">
            <g ref={ref('cardArt')} dangerouslySetInnerHTML={{ __html: ART_0.card }} />
          </g>
          <g ref={ref('callouts')} aria-hidden>
            {STATIONS.map((station) => (
              <g key={station} ref={(node) => void (callouts.current[station] = node)} className={styles.callouts} data-hidden="">
                {PARTS[station].map((part) => (
                  <g key={part.name}>
                    <path className="iso-line" data-tone="lo" data-free="end" />
                    <g className="iso-dots" data-tone="mid">
                      <circle r={0.7} />
                    </g>
                    <text className={styles.calloutName}>{part.name}</text>
                    <text className={styles.calloutNote}>{part.note}</text>
                  </g>
                ))}
              </g>
            ))}
          </g>
        </IsoFigure>
        <span ref={announce} className={styles.hidden} aria-live="polite" />
      </div>
    );
  })
);
