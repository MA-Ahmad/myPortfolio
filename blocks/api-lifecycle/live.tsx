import * as React from 'react';
import {
  BASE,
  CACHE,
  CARD,
  CLIENT,
  DB,
  DRAWER_FRONTS,
  GATE_BACK,
  GATE_BEAM,
  GATE_FRONT,
  GATE_PLATE,
  POCKET_CARDS,
  POCKET_LEDS,
  RAIL,
  SERVER,
  SERVER_LEDS,
  SHUTTLE_BODY,
  SLIP
} from './art';
import { GATE_ART, drawerOutOf, needleOf } from './geometry';
import { translateAlong, type Point3 } from './iso-kit';
import { IsoFigure, useInView, useLoop, useReadout } from './iso-react';
import {
  GATE_X,
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
import { Screen, type ScreenHandle } from './screen';
import { ANCHOR_POINT, DRAWER_OUT, GATE_LIFT, HEIGHT, P, SHUTTLE, WIDTH } from './view';
import styles from './api-lifecycle.module.css';

const LABEL =
  'A request bench that fetches a user profile. A shuttle on a rail leaves the client terminal with a request slip and a token key, stops at a gate whose reader checks the token, rides on to an app server whose router dial swings to /users/:id, asks a cache box with three pockets, and on a miss pulls a drawer of the users filing cabinet and lifts the row card onto its tray. It brings the card back past the cache, which keeps a copy, through the gate to the terminal, whose screen shows the profile.';

/** The tour a visitor sees when nobody is touching the bench: a miss, the same user from cache, an expired token, a missing user. */
const TOUR: Request[] = [
  { id: 42, token: 'valid' },
  { id: 42, token: 'valid' },
  { id: 256, token: 'expired' },
  { id: 77, token: 'valid' },
  { id: 108, token: 'valid' },
  { id: 108, token: 'valid' }
];
const TOUR_FIRST = 1.4;
const TOUR_GAP = 1.8;
const TOUR_BACK = 3.6;

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

export interface BenchHandle {
  send: (request: Request) => void;
  flush: () => void;
  /** The visitor did something: stop the tour until they have been idle for a while. */
  touch: () => void;
}

interface Props {
  onBusy: (busy: boolean) => void;
  onCache: (ids: number[]) => void;
  onTour: (request: Request) => void;
}

interface Nodes {
  shuttle: SVGGElement | null;
  before: SVGGElement | null;
  after: SVGGElement | null;
  plate: SVGGElement | null;
  reader: SVGCircleElement | null;
  server: SVGGElement | null;
  needle: SVGPathElement | null;
  slip: SVGGElement | null;
  shuttleCard: SVGGElement | null;
  card: SVGGElement | null;
  drawers: SVGGElement | null;
  pockets: SVGGElement | null;
}

const anchorPoint = (anchor: Anchor, plan: Plan, scene: Scene): Point3 => {
  if (anchor === 'drawer') return ANCHOR_POINT.drawer(drawerOf(plan.request.id));
  if (anchor === 'pocket') return ANCHOR_POINT.pocket(Math.max(0, pocketOf(plan.request.id)));
  if (anchor === 'terminal') return ANCHOR_POINT.terminal();
  return ANCHOR_POINT.shuttle(scene.x);
};

const show = (node: Element | null, shown: boolean) => {
  if (!node) return;
  if (shown) node.removeAttribute('data-hidden');
  else node.setAttribute('data-hidden', '');
};

/** The bench itself. It never re-renders while a request plays: every frame writes through refs. */
export const Bench = React.memo(
  React.forwardRef<BenchHandle, Props>(function Bench({ onBusy, onCache, onTour }, handle) {
    const { anchor, say } = useReadout<HTMLDivElement>();
    const inView = useInView(anchor);
    const screen = React.useRef<ScreenHandle>(null);
    const announce = React.useRef<HTMLSpanElement>(null);
    const nodes = React.useRef<Nodes>({
      shuttle: null,
      before: null,
      after: null,
      plate: null,
      reader: null,
      server: null,
      needle: null,
      slip: null,
      shuttleCard: null,
      card: null,
      drawers: null,
      pockets: null
    });
    const drawerOut = React.useRef<(SVGGElement | null)[]>([]);
    const drawerFront = React.useRef<(SVGGElement | null)[]>([]);
    const live = React.useRef({
      plan: null as Plan | null,
      t: 0,
      finished: true,
      cached: new Set<number>(),
      screen: 'idle',
      drawer: -1,
      tour: { index: 0, wait: TOUR_FIRST, hovering: false, idle: TOUR_BACK }
    });
    const callbacks = React.useRef({ onBusy, onCache, onTour });
    callbacks.current = { onBusy, onCache, onTour };

    const apply = React.useCallback(
      (scene: Scene, plan: Plan | null) => {
        const n = nodes.current;
        const state = live.current;
        n.shuttle?.setAttribute('transform', translateAlong(P, [scene.x, 0, 0]));
        // The shuttle is drawn behind the gate plate while it is on the client's side of it.
        const slot = scene.x + SHUTTLE.x + SHUTTLE.w < GATE_X ? n.before : n.after;
        if (n.shuttle && slot && n.shuttle.parentNode !== slot) slot.appendChild(n.shuttle);
        n.plate?.setAttribute('transform', translateAlong(P, [0, 0, scene.gate * GATE_LIFT]));
        n.reader?.setAttribute('data-state', scene.reader);
        if (scene.busy) n.server?.setAttribute('data-busy', '');
        else n.server?.removeAttribute('data-busy');
        n.needle?.setAttribute('d', needleOf(scene.dial));

        show(n.slip, scene.slip !== 'none');
        n.slip?.setAttribute('data-state', scene.slip);
        const card = scene.card;
        const riding = Boolean(card && card.from === 'shuttle' && card.to === 'shuttle');
        show(n.shuttleCard, riding);
        const flying = Boolean(plan && card && card.from !== card.to);
        show(n.card, flying);
        if (plan && card && flying) {
          const a = anchorPoint(card.from, plan, scene);
          const b = anchorPoint(card.to, plan, scene);
          const lift = (card.to === 'terminal' ? 20 : 14) * Math.sin(Math.PI * card.t);
          const point: Point3 = [a[0] + (b[0] - a[0]) * card.t, a[1] + (b[1] - a[1]) * card.t, a[2] + (b[2] - a[2]) * card.t + lift];
          n.card?.setAttribute('transform', translateAlong(P, point));
          const enter = card.from === 'drawer' ? smooth(card.t / 0.2) : 1;
          const leave = card.to === 'terminal' ? 1 - smooth((card.t - 0.75) / 0.25) : 1;
          n.card?.setAttribute('opacity', `${Math.round(enter * leave * 100) / 100}`);
        }

        // The drawer for this id slides out; it is drawn last so it sits in front of the others.
        const drawer = plan ? drawerOf(plan.request.id) : -1;
        const out = scene.drawer * DRAWER_OUT;
        if (drawer !== state.drawer) {
          const group = drawerOut.current[drawer]?.parentNode;
          if (group && n.drawers) n.drawers.appendChild(group);
          drawerFront.current.forEach((node, index) => {
            if (index !== drawer) node?.removeAttribute('transform');
          });
          state.drawer = drawer;
        }
        if (drawer >= 0) {
          drawerFront.current[drawer]?.setAttribute('transform', translateAlong(P, [0, out, 0]));
          const part = drawerOutOf(drawer, out);
          const target = drawerOut.current[drawer];
          if (target) {
            const paths = target.querySelectorAll('path');
            const list = part ? [part.box.fill, ...part.box.shades, part.box.top, part.box.crease, part.rim, part.tabs, part.box.outline] : [];
            paths.forEach((path, index) => path.setAttribute('d', list[index] ?? ''));
          }
        }

        const holds = new Set(state.cached);
        if (plan && scene.stored) holds.add(plan.request.id);
        n.pockets?.querySelectorAll<SVGGElement>('[data-pocket]').forEach((node) => {
          const index = Number(node.dataset.pocket);
          const id = PROFILES[index]?.id;
          if (node.tagName === 'circle') node.toggleAttribute('data-on', scene.pocket === index);
          else show(node, holds.has(id));
        });

        say(readoutOf(plan, scene));
        if (scene.screen !== state.screen) {
          state.screen = scene.screen;
          screen.current?.show(scene.screen, plan);
        }
      },
      [say]
    );

    const finish = React.useCallback((plan: Plan) => {
      const state = live.current;
      state.finished = true;
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
      const plan = state.plan;
      if (plan && !state.finished) {
        state.t = calm ? plan.secs : state.t + dt;
        const scene = sceneAt(plan, state.t);
        apply(scene, plan);
        if (scene.done) finish(plan);
      }
      // The tour runs only while the bench is idle, in view, not hovered, and the visitor has left it alone.
      const tour = state.tour;
      if (calm) return !state.finished;
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
          state.tour.idle = 0;
          state.cached.clear();
          callbacks.current.onCache([]);
          if (state.finished) apply({ ...REST_SCENE, screen: state.screen as Scene['screen'] }, null);
          kick();
        },
        touch: () => {
          live.current.tour.idle = 0;
          kick();
        }
      }),
      [apply, kick, start]
    );

    const hover = (hovering: boolean) => () => {
      live.current.tour.hovering = hovering;
      if (!hovering) live.current.tour.idle = 0;
      kick();
    };

    return (
      <div ref={anchor} className={styles.stage} onPointerEnter={hover(true)} onPointerLeave={hover(false)}>
        <IsoFigure width={WIDTH} height={HEIGHT} label={LABEL}>
          {BASE}
          {CLIENT}
          <Screen ref={screen} />
          <g ref={(node) => void (nodes.current.server = node)} className={styles.server}>
            {SERVER}
            {SERVER_LEDS}
            <path ref={(node) => void (nodes.current.needle = node)} className="iso-line" data-tone="lit" data-free="start" strokeWidth={1.1} d={needleOf(0)} />
          </g>
          {GATE_BACK}
          <g ref={(node) => void (nodes.current.pockets = node)}>
            {CACHE}
            {POCKET_CARDS}
            {POCKET_LEDS}
          </g>
          {DB}
          <g ref={(node) => void (nodes.current.drawers = node)}>
            {DRAWER_FRONTS.map((front, index) => (
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
                <g ref={(node) => void (drawerFront.current[index] = node)}>{front}</g>
              </g>
            ))}
          </g>
          {RAIL}
          <g ref={(node) => void (nodes.current.before = node)}>
            <g ref={(node) => void (nodes.current.shuttle = node)} transform={translateAlong(P, [STOP.client, 0, 0])}>
              {SHUTTLE_BODY}
              <g ref={(node) => void (nodes.current.slip = node)} className={styles.slip} data-hidden="">
                {SLIP}
              </g>
              <g ref={(node) => void (nodes.current.shuttleCard = node)} className={styles.carried} data-hidden="">
                <g transform={translateAlong(P, ANCHOR_POINT.shuttle(0))}>{CARD}</g>
              </g>
            </g>
          </g>
          <g ref={(node) => void (nodes.current.plate = node)}>{GATE_PLATE}</g>
          {GATE_BEAM}
          <g ref={(node) => void (nodes.current.after = node)} />
          {GATE_FRONT}
          <circle ref={(node) => void (nodes.current.reader = node)} className={styles.led} data-state="idle" cx={GATE_ART.led[0]} cy={GATE_ART.led[1]} r={0.9} />
          <g ref={(node) => void (nodes.current.card = node)} className={styles.carried} data-hidden="">
            {CARD}
          </g>
        </IsoFigure>
        <span ref={announce} className={styles.hidden} aria-live="polite" />
      </div>
    );
  })
);
