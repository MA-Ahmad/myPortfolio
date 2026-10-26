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
import { orderOf, type Item } from './order';
import { Screen, type ScreenHandle } from './screen';
import {
  ANCHOR_POINT,
  AZIMUTH,
  AZIMUTH_MAX,
  AZIMUTH_MIN,
  CASE,
  CASE_FRONT,
  CASE_H,
  DRAWER_OUT,
  GATE_LIFT,
  HEIGHT,
  P0,
  SCREEN,
  WIDTH,
  projectionAt
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
/** The + and − buttons multiply the view's scale by this, between 1× and the most. */
export const SCALE_STEP = 1.5;
export const SCALE_MOST = 4;
const SCALE_EASE = 0.22;

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
}

interface Props {
  onBusy: (busy: boolean) => void;
  onCache: (ids: number[]) => void;
  onTour: (request: Request) => void;
  onSend: () => void;
  onZoom: (zoomed: boolean) => void;
  onScale: (scale: number) => void;
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
  React.forwardRef<BenchHandle, Props>(function Bench({ onBusy, onCache, onTour, onSend, onZoom, onScale }, handle) {
    const { anchor, say } = useReadout<HTMLDivElement>();
    const inView = useInView(anchor);
    const screen = React.useRef<ScreenHandle>(null);
    const announce = React.useRef<HTMLSpanElement>(null);
    const needle = React.useRef<SVGPathElement>(null);
    const reader = React.useRef<SVGCircleElement>(null);
    const groups = React.useRef({} as Groups);
    const drawerOut = React.useRef<(SVGGElement | null)[]>([]);
    const drawerFront = React.useRef<(SVGGElement | null)[]>([]);
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
      P: P0,
      geometry: GEOMETRY_0 as Geometry
    });
    const callbacks = React.useRef({ onBusy, onCache, onTour, onSend, onZoom, onScale });
    callbacks.current = { onBusy, onCache, onTour, onSend, onZoom, onScale };

    const ref = (key: keyof Groups) => (node: SVGGElement | null) => {
      groups.current[key] = node;
    };

    /** Put the groups back to front for this camera; the flying card always goes last. */
    const sort = React.useCallback((scene: Scene) => {
      const state = live.current;
      const g = groups.current;
      const order = orderOf(state.P, scene.x, scene.gate);
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
    }, []);

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
        if (plan && card && flying) {
          const anchorPoint = (where: Anchor): Point3 => {
            if (where === 'drawer') return ANCHOR_POINT.drawer(drawerOf(plan.request.id));
            if (where === 'pocket') return ANCHOR_POINT.pocket(Math.max(0, pocketOf(plan.request.id)));
            if (where === 'terminal') return ANCHOR_POINT.terminal();
            return ANCHOR_POINT.shuttle(scene.x);
          };
          const a = anchorPoint(card.from);
          const b = anchorPoint(card.to);
          const lift = (card.to === 'terminal' ? 20 : 14) * Math.sin(Math.PI * card.t);
          const point: Point3 = [a[0] + (b[0] - a[0]) * card.t, a[1] + (b[1] - a[1]) * card.t, a[2] + (b[2] - a[2]) * card.t + lift];
          g.card?.setAttribute('transform', translateAlong(P, point));
          const enter = card.from === 'drawer' ? smooth(card.t / 0.2) : 1;
          const leave = card.to === 'terminal' ? 1 - smooth((card.t - 0.75) / 0.25) : 1;
          g.card?.setAttribute('opacity', `${Math.round(enter * leave * 100) / 100}`);
        }

        // The drawer for this id slides out; it is drawn last so it sits in front of the others.
        const drawer = plan ? drawerOf(plan.request.id) : -1;
        const out = scene.drawer * DRAWER_OUT;
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
        if (drawer >= 0) {
          drawerFront.current[drawer]?.setAttribute('transform', translateAlong(P, [0, out, 0]));
          const part = geometry.drawerOutOf(drawer, out);
          const list = part ? [part.box.fill, ...part.box.shades, part.box.top, part.box.crease, part.rim, part.tabs, part.box.outline] : [];
          drawerOut.current[drawer]?.querySelectorAll('path').forEach((path, index) => path.setAttribute('d', list[index] ?? ''));
        }

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
      [say, sort]
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
      },
      [apply]
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
        camera.panY !== camera.panYTarget;

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
          touch();
        },
        scaleBy: (factor) => {
          // The buttons zoom the bench, so they first step back out of the monitor.
          if (live.current.camera.zoomTarget) zoom(false);
          setScale(live.current.camera.scaleTarget * factor);
        },
        zoom
      }),
      [apply, kick, setScale, start, touch, zoom]
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
            <path ref={needle} className="iso-line" data-tone="lit" data-free="start" strokeWidth={1.1} d={GEOMETRY_0.needleOf(0)} />
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
          <g ref={ref('card')} className={styles.carried} data-hidden="">
            <g ref={ref('cardArt')} dangerouslySetInnerHTML={{ __html: ART_0.card }} />
          </g>
        </IsoFigure>
        <span ref={announce} className={styles.hidden} aria-live="polite" />
      </div>
    );
  })
);
