import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'framer-motion';
import { cn } from 'lib/cn';
import { poseLegs, SpiderArt, type Vec } from './art';
import { boxAt, collectBoxes, railGutter } from './boxes';
import { SpiderHud, SPEEDS, type Speed } from './hud';
import { buildWeb, cmd, LAYERS, pointAt, type Layer, type WebPlan } from './web';

/**
 * A small black spider living on the home page.
 *
 * On its own it lowers itself down the middle of the left guide rail, walks over the avatar
 * to its top, ties a line there and climbs straight up paying out silk (the avatar stays in
 * its place, now hanging), glues the line, then climbs down onto the stripe band and patrols
 * it slowly. Anything left hanging can be dragged sideways with the pointer: it swings on
 * its line and slowly comes to rest. Click it and it answers to the keyboard: arrows/WASD walk it
 * anywhere on the page, Space ties a thread on where it stands and Space again ties it off
 * (snapping onto nearby threads, so lines build into a web; Z undoes), O spins a whole orb
 * web in the box it stands in (or clears it),
 * G throws a line onto the avatar or the Theme Studio dock and, pressed again, glues that line
 * where the spider stands so the thing stays hanging there. R (or Reset) puts everything back.
 * Shift dashes, 1/2/3 set the speed, Esc lets go.
 *
 * Render it inside a `relative` element that also contains `.site-frame`, the
 * `[data-spider-avatar]` and a `.stripe-divider`. One requestAnimationFrame loop writes
 * attributes directly; React only renders when webs or the HUD change.
 */

type WebState = 'weaving' | 'done' | 'fading';
type Web = {
  id: number;
  key: string;
  seed: number;
  host: HTMLElement | null; // element boxes draw inside their element
  x: number;
  y: number;
  w: number;
  h: number;
  plan: WebPlan;
  state: WebState;
};

/** Something the spider has a line on: held, left hanging, or on its way home after a reset. */
type Hang = {
  el: HTMLElement;
  label: string;
  fixed: boolean;
  local: Vec; // attach point inside the element
  homeVP: Vec; // the element's untransformed corner (viewport) when first grabbed
  layerAtGrab: Vec;
  P: Vec; // attach point, layer coordinates
  V: Vec;
  rope: number;
  mode: 'held' | 'hanging' | 'returning';
  anchor: Vec; // where the line is glued while hanging
  reel?: number; // the line length it is being reeled in (or springing back) to
  reelRate: number; // 1/s
  restRope: number; // its line's length at rest while hanging (0 until it hangs)
  raise: boolean; // lift it above the guide rails while it is off its spot
  swing: number; // degrees: hanging, it turns to follow its line
  drag: Vec | null; // pointer target while someone is holding it by hand
  unclip: HTMLElement | null;
  line: SVGPathElement;
  knot: SVGCircleElement;
};

const START_DELAY = 1600; // let the avatar's pixel intro finish first
const DROP_MS = 4200;
const PATROL_SPEED = 22; // px/s at 1×, deliberately slow
const MOVE_SPEED = 64; // px/s at 1× under the keyboard
const TURN_MS = 1400;
const SCALE = 0.82;
const EDGE = 22;
const NAV = 64; // the sticky top bar
const GRAB_REACH = 24;
const MIN_LINE = 56; // a little silk between the spider and what it carries
const HANG_LINE = 72; // the line the intro leaves the avatar hanging on
const STRETCH = 60; // px: how far silk gives (rubber-banded) when pulled past its length
const MAX_THROW = 1500; // px/s: a flick can't fling it further than a frame can show smoothly
// Silk is elastic: a hanging thing rides a stiff, slightly damped spring, not a rigid rod.
const SILK_K = 500; // 1/s² per px of stretch
const SILK_C = 2 * Math.sqrt(SILK_K) * 0.75; // damping along the line: gives, then settles, no twang
const SUBSTEP = 1 / 240; // s
const MAX_TILT = 30; // degrees
const RAILS_Z = 51; // the guide rails (globals.css .guide-rails)
// Damping (1/s): a held thing is steadied by the spider; a hanging one swings on, slowly.
const DAMP_HELD = 1.6;
const DAMP_HANGING = 0.7;
const GRAVITY = 1600;
const SVG_NS = 'http://www.w3.org/2000/svg';

const TOKENS =
  '[--spider-body:#0a0a0b] [--spider-leg:#18181b] [--spider-rim:transparent] [--spider-silk:color-mix(in_oklab,var(--foreground)_32%,transparent)] [--spider-web:color-mix(in_oklab,var(--foreground)_24%,transparent)] [--spider-web-soft:color-mix(in_oklab,var(--foreground)_16%,transparent)] [--spider-dew:color-mix(in_oklab,var(--foreground)_40%,transparent)] dark:[--spider-body:#030304] dark:[--spider-leg:color-mix(in_oklab,var(--foreground)_38%,var(--background))] dark:[--spider-rim:color-mix(in_oklab,var(--foreground)_26%,transparent)] dark:[--spider-dew:color-mix(in_oklab,var(--foreground)_55%,transparent)]';

const LAYER = 'pointer-events-none absolute -left-2 top-0 h-full w-[calc(100%+1rem)] overflow-hidden print:hidden';

const STROKES: Record<Layer, { stroke: string; width: number }> = {
  radial: { stroke: 'var(--spider-web)', width: 0.6 },
  frame: { stroke: 'var(--spider-web)', width: 0.7 },
  hub: { stroke: 'var(--spider-web)', width: 0.5 },
  spiral: { stroke: 'var(--spider-web-soft)', width: 0.55 }
};

const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
const angleDiff = (a: number, b: number) => ((((b - a) % 360) + 540) % 360) - 180;
const heading = (dx: number, dy: number) => (Math.atan2(dy, dx) * 180) / Math.PI + 90;

const DIRS: Record<string, 'up' | 'down' | 'left' | 'right'> = {
  arrowup: 'up',
  w: 'up',
  arrowdown: 'down',
  s: 'down',
  arrowleft: 'left',
  a: 'left',
  arrowright: 'right',
  d: 'right'
};

/** A thread the visitor spun by hand: tied on at `a`, tied off at `b` (layer coordinates). */
type Thread = { id: number; a: Vec; b: Vec };

const SNAP = 10;

/** The closest point on any thread within SNAP of `p`, so new threads tie onto old ones. */
function snapTo(threads: Thread[], p: Vec): Vec {
  let best: Vec = p;
  let bestD = SNAP;
  for (const { a, b } of threads) {
    const ab: Vec = [b[0] - a[0], b[1] - a[1]];
    const len2 = ab[0] * ab[0] + ab[1] * ab[1] || 1;
    const f = clamp(((p[0] - a[0]) * ab[0] + (p[1] - a[1]) * ab[1]) / len2, 0, 1);
    // Ends are stickier than the middle, so threads meet at their knots when close.
    for (const q of [a, b, [a[0] + ab[0] * f, a[1] + ab[1] * f] as Vec]) {
      const d = Math.hypot(q[0] - p[0], q[1] - p[1]) - (q === a || q === b ? 3 : 0);
      if (d < bestD) {
        best = q;
        bestD = d;
      }
    }
  }
  return best;
}

type PathRefs = Map<number, Partial<Record<Layer, SVGPathElement | null>>>;
type RegisterPath = (id: number, layer: Layer, el: SVGPathElement | null) => void;

function WebPaths({ web, onPath }: { web: Web; onPath: RegisterPath }) {
  const weaving = web.state === 'weaving';
  return (
    <g
      fill="none"
      strokeLinejoin="round"
      strokeLinecap="round"
      style={{ opacity: web.state === 'fading' ? 0 : 1, transition: 'opacity 500ms ease' }}
    >
      {LAYERS.map((layer) => (
        <path
          key={layer}
          ref={(el) => onPath(web.id, layer, el)}
          // While weaving the loop grows these itself; React hands over the full web after.
          d={weaving ? '' : web.plan.d[layer]}
          stroke={STROKES[layer].stroke}
          strokeWidth={STROKES[layer].width}
        />
      ))}
      {weaving ? null : (
        <motion.g
          fill="var(--spider-dew)"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.2, delay: 0.2 }}
        >
          {web.plan.dew.map(([cx, cy, r], i) => (
            <circle key={i} cx={cx} cy={cy} r={r} />
          ))}
        </motion.g>
      )}
    </g>
  );
}

export function Spider() {
  const layerRef = useRef<SVGSVGElement>(null);
  const bodyRef = useRef<SVGGElement>(null);
  const hitRef = useRef<SVGCircleElement>(null);
  const threadRef = useRef<SVGLineElement>(null);
  const ropesRef = useRef<SVGGElement>(null);
  const liveRef = useRef<SVGGElement>(null);
  const legRefs = useRef<(SVGPathElement | null)[]>([]);
  const pathRefs = useRef<PathRefs>(new Map());
  const api = useRef<{ activate: () => void; release: () => void; reset: () => void } | null>(null);

  const [webs, setWebs] = useState<Web[]>([]);
  const websRef = useRef(webs);
  const [hangCount, setHangCount] = useState(0);
  const [threads, setThreads] = useState<Thread[]>([]);
  const threadsRef = useRef(threads);
  const [threadsFading, setThreadsFading] = useState(false);
  const [controlled, setControlled] = useState(false);
  const [speed, setSpeed] = useState<Speed>(1);
  const speedRef = useRef<Speed>(speed);
  const [hint, setHint] = useState('');

  useEffect(() => {
    websRef.current = webs;
  }, [webs]);
  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);
  useEffect(() => {
    speedRef.current = speed;
  }, [speed]);

  useEffect(() => {
    const layer = layerRef.current;
    const root = layer?.parentElement;
    const body = bodyRef.current;
    const thread = threadRef.current;
    const ropes = ropesRef.current;
    const hit = hitRef.current;
    const live = liveRef.current;
    const liveLine = live?.querySelector('line');
    const liveKnot = live?.querySelector('circle');
    if (!layer || !root || !body || !thread || !ropes || !hit || !live || !liveLine || !liveKnot) return;
    const avatar = root.querySelector<HTMLElement>('[data-spider-avatar]');
    const band = root.querySelector<HTMLElement>('.stripe-divider');
    if (!avatar || !band) return;

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const fine = matchMedia('(pointer: fine)').matches;

    // ── layout ──────────────────────────────────────────────────────────────
    let patrol = { ax: 0, r: 0, top: 0, right: 0, dropX: 0, landY: 0, bandY: 0, minX: 0, maxX: 0 };
    const frameEl = root.querySelector<HTMLElement>('.site-frame');
    const measure = () => {
      const L = layer.getBoundingClientRect();
      const a = avatar.getBoundingClientRect();
      const b = band.getBoundingClientRect();
      const r = a.width / 2;
      patrol = {
        ax: a.left - L.left + r,
        r,
        top: a.top - L.top,
        right: a.right - L.left,
        // Down the middle of the hatched guide rail left of the column, beside the avatar.
        dropX: (frameEl?.getBoundingClientRect().left ?? a.left) - L.left - railGutter() / 2,
        landY: a.top - L.top + r,
        bandY: b.top - L.top + b.height / 2,
        minX: b.left - L.left + EDGE,
        maxX: b.right - L.left - EDGE
      };
      // Cell webs follow their cell when the page reflows.
      const boxes = collectBoxes(layer);
      setWebs((list) => {
        let changed = false;
        const next = list.flatMap((web) => {
          if (web.host || web.state === 'weaving') return [web];
          const box = boxes.find((b) => b.key === web.key);
          if (!box) {
            changed = true;
            return [];
          }
          if (box.x === web.x && box.y === web.y && box.w === web.w && box.h === web.h) return [web];
          changed = true;
          const resized = box.w !== web.w || box.h !== web.h;
          return [{ ...web, x: box.x, y: box.y, w: box.w, h: box.h, plan: resized ? buildWeb(box.w, box.h, web.seed) : web.plan }];
        });
        return changed ? next : list;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(layer);

    // ── state ───────────────────────────────────────────────────────────────
    type Phase = 'wait' | 'drop' | 'cross' | 'tie' | 'climb' | 'leave' | 'descend' | 'walk' | 'turn' | 'pause' | 'idle' | 'player' | 'weave';
    let phase: Phase = 'wait';
    let phaseStart = 0;
    let x = 0;
    let y = -30;
    let rot = 180;
    let restRot: number | null = null;
    let gait = 0;
    let dir = 1;
    let descendX = 0;
    let turnFrom = 0;
    let turnTo = 0;
    let pauseFor = 0;
    let nextPauseAt = 0;
    let threadAlpha = 1;
    let elapsed = 0;
    let last = 0;
    let raf = 0;
    let isControlled = false;
    let boost = false;
    let hangs: Hang[] = [];
    type Weave = {
      web: Web;
      start: Vec;
      approach: number;
      t: number;
      rate: number;
      k: number; // current step
      acc: number; // distance at the start of step k
      built: Record<Layer, string>;
    };
    let weave: Weave | null = null;
    let layerRect: DOMRect | null = null;
    let drawing: Vec | null = null; // where the thread being spun is tied on
    let nextThread = 0;
    let lastHint = '';
    let hintAt = -Infinity;
    let nextId = 0;
    const keys = new Set<string>();

    const go = (p: Phase) => {
      phase = p;
      phaseStart = elapsed;
    };
    const show = () => {
      layer.style.opacity = '1';
      if (fine) hit.style.pointerEvents = 'auto';
    };

    const place = (bob = 0) =>
      body.setAttribute(
        'transform',
        `translate(${x.toFixed(2)} ${(y + bob).toFixed(2)}) rotate(${rot.toFixed(2)}) scale(${SCALE})`
      );

    const stepToward = (tx: number, ty: number, dt: number, speed: number) => {
      const dx = tx - x;
      const dy = ty - y;
      const dist = Math.hypot(dx, dy);
      const step = Math.min(dist, speed * dt);
      if (dist > 0.01) {
        x += (dx / dist) * step;
        y += (dy / dist) * step;
        rot += angleDiff(rot, heading(dx, dy)) * Math.min(1, dt * 3);
      }
      gait += step * 0.55;
      return dist - step;
    };

    const scheduleWalkPause = () => {
      nextPauseAt = elapsed + 7000 + Math.random() * 9000;
    };

    // ── webs ────────────────────────────────────────────────────────────────
    const hostOrigin = (web: Web, L: DOMRect): Vec => {
      if (!web.host) return [web.x, web.y];
      const E = web.host.getBoundingClientRect();
      return [E.left - L.left, E.top - L.top];
    };

    const fadeWebs = (match: (web: Web) => boolean) => {
      const ids = new Set(websRef.current.filter(match).map((w) => w.id));
      if (!ids.size) return;
      setWebs((list) => list.map((w) => (ids.has(w.id) ? { ...w, state: 'fading' } : w)));
      window.setTimeout(() => setWebs((list) => list.filter((w) => !ids.has(w.id))), 520);
    };

    const finishWeave = () => {
      if (!weave) return;
      const id = weave.web.id;
      weave = null;
      setWebs((list) => list.map((w) => (w.id === id ? { ...w, state: 'done' } : w)));
      restRot = 180; // orb weavers wait at the hub, head down
      go(isControlled ? 'player' : 'idle');
    };

    // ── hand-spun threads ───────────────────────────────────────────────────
    const showLive = (on: boolean) => {
      live.style.opacity = on ? '1' : '0';
    };
    const tieOnOrOff = () => {
      if (weave) return;
      if (!drawing) {
        drawing = snapTo(threadsRef.current, [x, y]);
        liveKnot.setAttribute('cx', drawing[0].toFixed(1));
        liveKnot.setAttribute('cy', drawing[1].toFixed(1));
        showLive(true);
        return;
      }
      const a = drawing;
      const b = snapTo(threadsRef.current, [x, y]);
      drawing = null;
      showLive(false);
      if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 6) return;
      const t: Thread = { id: ++nextThread, a, b };
      threadsRef.current = [...threadsRef.current, t];
      setThreads(threadsRef.current);
    };
    const cancelThread = () => {
      drawing = null;
      showLive(false);
    };
    const undo = () => {
      if (drawing) return cancelThread();
      threadsRef.current = threadsRef.current.slice(0, -1);
      setThreads(threadsRef.current);
    };

    const weaveOrClear = () => {
      if (weave || drawing) return;
      const box = boxAt(collectBoxes(layer), x, y);
      if (!box) return;
      const existing = websRef.current.find((w) => w.key === box.key);
      if (existing) {
        if (existing.state === 'done') fadeWebs((w) => w.id === existing.id);
        return;
      }
      const seed = (Math.random() * 2 ** 31) | 0;
      const plan = buildWeb(box.w, box.h, seed);
      const web: Web = {
        id: ++nextId,
        key: box.key,
        seed,
        host: box.el ?? null,
        x: box.x,
        y: box.y,
        w: box.w,
        h: box.h,
        plan,
        state: 'weaving'
      };
      websRef.current = [...websRef.current, web];
      setWebs((list) => [...list, web]);
      const start: Vec = [x - box.x, y - box.y];
      const approach = Math.hypot(plan.start[0] - start[0], plan.start[1] - start[1]);
      // About eight seconds for any box at 1×; it is a show, not a chore.
      const rate = reduce ? 1e9 : clamp((plan.total + approach) / 8, 200, 1400);
      weave = { web, start, approach, t: 0, rate, k: 0, acc: 0, built: { radial: '', frame: '', hub: '', spiral: '' } };
      go('weave');
    };

    // ── lines on things ─────────────────────────────────────────────────────
    const grabbables = () => Array.from(document.querySelectorAll<HTMLElement>('[data-spider-grab]'));

    const nearGrab = (L: DOMRect) => {
      const sx = L.left + x;
      const sy = L.top + y;
      let best: HTMLElement | null = null;
      let bestD = GRAB_REACH;
      for (const el of grabbables()) {
        const E = el.getBoundingClientRect();
        if (!E.width) continue;
        const d = Math.hypot(Math.max(E.left - sx, 0, sx - E.right), Math.max(E.top - sy, 0, sy - E.bottom));
        if (d <= bestD) {
          best = el;
          bestD = d;
        }
      }
      return best;
    };

    const home = (h: Hang, L: DOMRect): Vec =>
      h.fixed
        ? [h.homeVP[0] + h.local[0] - L.left, h.homeVP[1] + h.local[1] - L.top]
        : [h.homeVP[0] + h.local[0] - h.layerAtGrab[0], h.homeVP[1] + h.local[1] - h.layerAtGrab[1]];

    const settle = (h: Hang) => {
      Object.assign(h.el.style, {
        transform: '',
        transition: '',
        transformOrigin: '',
        willChange: '',
        cursor: '',
        zIndex: '',
        touchAction: ''
      });
      h.line.remove();
      h.knot.remove();
      hangs = hangs.filter((other) => other !== h);
      if (h.unclip && !hangs.some((other) => other.unclip === h.unclip)) h.unclip.style.overflow = '';
      setHangCount(hangs.length);
    };

    const held = () => hangs.find((h) => h.mode === 'held');

    const toggleGrab = () => {
      const holding = held();
      if (holding) {
        // Glue the line here: it stays hanging where the spider leaves it.
        holding.mode = 'hanging';
        holding.anchor = [x, y];
        return;
      }
      const L = layer.getBoundingClientRect();
      const el = nearGrab(L);
      if (el) tieOn(el, L);
    };

    /** Throw a line onto `el` (or take up the line already on it). */
    const tieOn = (el: HTMLElement, L: DOMRect) => {
      const known = hangs.find((h) => h.el === el);
      if (known) {
        known.mode = 'held';
        known.reel = undefined;
        known.drag = null;
        known.rope = Math.max(MIN_LINE, Math.hypot(known.P[0] - x, known.P[1] - y));
        return known;
      }

      el.style.transition = 'none';
      el.style.transform = '';
      const E = el.getBoundingClientRect();
      // The line always ties on at the top centre, so things hang level.
      const local: Vec = [el.offsetWidth / 2, 0];
      el.style.transformOrigin = `${local[0]}px 0px`; // it swings about where the line ties on
      const unclip = el.parentElement?.closest<HTMLElement>('[data-spider-unclip]') ?? null;
      if (unclip) unclip.style.overflow = 'visible';
            el.style.willChange = 'transform';


      const line = document.createElementNS(SVG_NS, 'path');
      line.setAttribute('fill', 'none');
      line.setAttribute('stroke', 'var(--spider-silk)');
      line.setAttribute('stroke-width', '0.8');
      line.setAttribute('stroke-linecap', 'round');
      const knot = document.createElementNS(SVG_NS, 'circle');
      knot.setAttribute('r', '1.3');
      knot.setAttribute('fill', 'var(--spider-silk)');
      ropes.append(line, knot);

      const h: Hang = {
        el,
        label: el.dataset.spiderGrab || 'it',
        fixed: getComputedStyle(el).position === 'fixed',
        local,
        homeVP: [E.left, E.top],
        layerAtGrab: [L.left, L.top],
        P: [0, 0],
        V: [0, 0],
        rope: 0,
        mode: 'held',
        anchor: [x, y],
        swing: 0,
        drag: null,
        reelRate: 1.4,
        restRope: 0,
        raise: (parseInt(getComputedStyle(el).zIndex, 10) || 0) < RAILS_Z,
        unclip,
        line,
        knot
      };
      h.P = home(h, L);
      h.rope = Math.max(MIN_LINE, Math.hypot(h.P[0] - x, h.P[1] - y));
      hangs.push(h);
      setHangCount(hangs.length);
      return h;
    };
    let pulled: Hang | null = null;

    // A thing on a line swings from its anchor (the spider while held), hanging level
    // from its top centre, and rests on its own spot as a floor. After a reset it glides
    // home and lets go.
    const stepHang = (h: Hang, dt: number, L: DOMRect) => {
      const H = home(h, L);

      if (h.mode === 'returning') {
        const k = 1 - Math.exp(-dt * 7);
        h.P = [h.P[0] + (H[0] - h.P[0]) * k, h.P[1] + (H[1] - h.P[1]) * k];
        if (Math.hypot(h.P[0] - H[0], h.P[1] - H[1]) < 0.4) {
          settle(h);
          return;
        }
      } else {
        const A: Vec = h.mode === 'held' ? [x, y] : h.anchor;
        if (h.mode === 'hanging' && !h.restRope) h.restRope = h.rope;
        if (h.mode !== 'hanging') h.restRope = 0;
        if (h.reel !== undefined) {
          h.rope += (h.reel - h.rope) * (1 - Math.exp(-dt * h.reelRate));
          if (Math.abs(h.reel - h.rope) < 0.1) {
            h.rope = h.reel;
            h.reel = undefined;
          }
        }

        const holding = h.mode === 'hanging' && h.drag !== null;
        const swinging = h.mode === 'hanging' && !holding;
        if (holding && h.drag) {
          // Held by hand it tracks the pointer 1:1, anywhere inside its line's reach;
          // pulled past it, the silk gives with rubber-band resistance instead of a wall.
          const tx = h.drag[0] - A[0];
          const ty = h.drag[1] - A[1];
          const d = Math.hypot(tx, ty);
          const k = d > h.rope ? (h.rope + (1 - 1 / (((d - h.rope) * 0.55) / STRETCH + 1)) * STRETCH) / d : 1;
          h.P = [A[0] + tx * k, A[1] + ty * k];
        } else if (swinging) {
          // Integrated in small substeps, so a hard fall or a big stretch is caught over
          // several frames, never snapped in one. The spring's rest length allows for the
          // stretch gravity puts in it, so it still comes to rest exactly on its spot.
          const rest = Math.max(1, h.restRope - GRAVITY / SILK_K);
          const steps = Math.max(1, Math.ceil(dt / SUBSTEP));
          const sdt = dt / steps;
          const damp = Math.exp(-(reduce ? 8 : DAMP_HANGING) * sdt);
          for (let i = 0; i < steps; i++) {
            let ax = 0;
            let ay = GRAVITY;
            const dx = h.P[0] - A[0];
            const dy = h.P[1] - A[1];
            const d = Math.hypot(dx, dy);
            if (d > rest) {
              const n: Vec = [dx / d, dy / d];
              const pull = -SILK_K * (d - rest) - SILK_C * (h.V[0] * n[0] + h.V[1] * n[1]);
              ax += n[0] * pull;
              ay += n[1] * pull;
            }
            h.V = [(h.V[0] + ax * sdt) * damp, (h.V[1] + ay * sdt) * damp];
            h.P = [h.P[0] + h.V[0] * sdt, h.P[1] + h.V[1] * sdt];
            // Never below its own spot; no friction there, so a swing isn't braked.
            if (h.P[1] > H[1]) {
              h.P[1] = H[1];
              if (h.V[1] > 0) h.V[1] = 0;
            }
          }
        } else {
          const damp = Math.exp(-(h.mode === 'held' ? DAMP_HELD : reduce ? 8 : DAMP_HANGING) * dt);
          h.V = [h.V[0] * damp, (h.V[1] + GRAVITY * dt) * damp];
          h.P = [h.P[0] + h.V[0] * dt, h.P[1] + h.V[1] * dt];
        }

        const dx = h.P[0] - A[0];
        const dy = h.P[1] - A[1];
        const d = Math.hypot(dx, dy);
        if (!holding && !swinging && d > h.rope) {
          const n: Vec = [dx / d, dy / d];
          h.P = [A[0] + n[0] * h.rope, A[1] + n[1] * h.rope];
          const vr = h.V[0] * n[0] + h.V[1] * n[1];
          if (vr > 0) h.V = [h.V[0] - n[0] * vr, h.V[1] - n[1] * vr];
        }

        if (!swinging && h.P[1] >= H[1]) {
          h.P[1] = H[1];
          if (h.V[1] > 0) h.V[1] = 0;
          h.V[0] *= Math.exp(-dt * 12);
        }


        // The line: taut when stretched, sagging when there is slack.
        const span = Math.hypot(h.P[0] - A[0], h.P[1] - A[1]);
        const sag = Math.min(60, Math.sqrt(Math.max(0, h.rope * h.rope - span * span)) * 0.5);
        const mx = (A[0] + h.P[0]) / 2;
        const my = (A[1] + h.P[1]) / 2 + sag;
        h.line.setAttribute(
          'd',
          `M${A[0].toFixed(1)} ${A[1].toFixed(1)}Q${mx.toFixed(1)} ${my.toFixed(1)} ${h.P[0].toFixed(1)} ${h.P[1].toFixed(1)}`
        );
        h.knot.setAttribute('cx', A[0].toFixed(1));
        h.knot.setAttribute('cy', A[1].toFixed(1));
      }

      const visible = h.mode === 'returning' ? '0' : '1';
      h.line.style.opacity = visible;
      h.knot.style.opacity = h.mode === 'hanging' ? '1' : '0';
      // Hanging, it turns with its line, more the tauter the line; slack, it levels out.
      let swingTo = 0;
      if (h.mode === 'hanging') {
        const span = Math.hypot(h.P[0] - h.anchor[0], h.P[1] - h.anchor[1]);
        const taut = clamp((span - h.rope * 0.6) / (h.rope * 0.4), 0, 1);
        const angle = (-Math.atan2(h.P[0] - h.anchor[0], h.P[1] - h.anchor[1]) * 180) / Math.PI;
        // Capped, so passing up and over the anchor can't spin it round.
        swingTo = clamp(angle, -MAX_TILT, MAX_TILT) * taut;
      }
      h.swing += (swingTo - h.swing) * (1 - Math.exp(-dt * 12));
      const ox = h.P[0] - H[0];
      const oy = h.P[1] - H[1];
      h.el.style.transform = `translate(${ox.toFixed(2)}px, ${oy.toFixed(2)}px) rotate(${h.swing.toFixed(2)}deg)`;
      h.el.style.cursor = h.mode === 'hanging' ? (h.drag === null ? 'grab' : 'grabbing') : '';
      h.el.style.touchAction = h.mode === 'hanging' ? 'none' : '';
      // Off its spot it passes over the guide rails, but never over the sticky top bar.
      const away = Math.abs(ox) > 0.5 || Math.abs(oy) > 0.5;
      h.el.style.zIndex = h.raise && away && L.top + h.P[1] > NAV ? String(RAILS_Z) : '';
    };

    // ── control ─────────────────────────────────────────────────────────────
    const activate = () => {
      if (isControlled) return;
      isControlled = true;
      setControlled(true);
      show();
      lastHint = '';
      hintAt = -Infinity;
      if (phase !== 'weave') go('player');
    };
    const release = () => {
      if (!isControlled) return;
      isControlled = false;
      setControlled(false);
      keys.clear();
      boost = false;
      cancelThread();
      const holding = held();
      if (holding) {
        holding.mode = 'hanging';
        holding.anchor = [x, y];
      }
      if (phase === 'player') go('idle');
    };
    const reset = () => {
      for (const h of hangs) h.mode = 'returning';
      if (weave) {
        weave = null;
        go(isControlled ? 'player' : 'idle');
      }
      fadeWebs(() => true);
      cancelThread();
      if (threadsRef.current.length) {
        setThreadsFading(true);
        window.setTimeout(() => {
          threadsRef.current = [];
          setThreads([]);
          setThreadsFading(false);
        }, 520);
      }
      hintAt = -Infinity;
    };
    api.current = { activate, release, reset };

    const typing = (target: EventTarget | null) =>
      target instanceof HTMLElement && !!target.closest('input, textarea, select, [contenteditable="true"]');

    const onKeyDown = (event: KeyboardEvent) => {
      if (!isControlled || typing(event.target) || event.metaKey || event.ctrlKey || event.altKey) return;
      const key = event.key.toLowerCase();
      boost = event.shiftKey;
      const dirKey = DIRS[key];
      if (dirKey) {
        keys.add(dirKey);
      } else if (key === ' ' || key === 'spacebar') {
        if (!event.repeat) tieOnOrOff();
      } else if (key === 'o') {
        if (!event.repeat) weaveOrClear();
      } else if (key === 'z' || key === 'backspace') {
        if (!event.repeat) undo();
      } else if (key === 'g') {
        if (!event.repeat) toggleGrab();
      } else if (key === 'r') {
        if (!event.repeat) reset();
      } else if (key === '1' || key === '2' || key === '3') {
        setSpeed(SPEEDS[Number(key) - 1]);
      } else if (key === 'escape') {
        if (drawing) cancelThread();
        else release();
      } else {
        return;
      }
      event.preventDefault();
    };
    const onKeyUp = (event: KeyboardEvent) => {
      boost = event.shiftKey;
      const dirKey = DIRS[event.key.toLowerCase()];
      if (dirKey) keys.delete(dirKey);
    };
    const onBlur = () => {
      keys.clear();
      boost = false;
    };
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('blur', onBlur);

    // Swinging by hand: press on anything hanging on a line and drag it sideways.
    type Sample = { x: number; y: number; t: number };
    let drag: { h: Hang; offset: Vec; start: Vec; moved: boolean; id: number; samples: Sample[] } | null = null;
    let swallowClick = false;
    // The layer's rect from the last frame, so pointer events don't force a layout after
    // the loop's transform writes; scrolling invalidates it.
    const onScroll = () => {
      layerRect = null;
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    const pointerAt = (event: PointerEvent): Vec => {
      const L = layerRect ?? (layerRect = layer.getBoundingClientRect());
      return [event.clientX - L.left, event.clientY - L.top];
    };
    const onPointerDown = (event: PointerEvent) => {
      if (event.button !== 0 || !(event.target instanceof Element)) return;
      const el = event.target.closest<HTMLElement>('[data-spider-grab]');
      const h = el && hangs.find((other) => other.el === el && other.mode === 'hanging');
      if (!h) return;
      event.preventDefault(); // no text selection or image drag
      const at = pointerAt(event);
      // Hold it by the point you pressed: no jump to the cursor.
      drag = {
        h,
        offset: [at[0] - h.P[0], at[1] - h.P[1]],
        start: [event.clientX, event.clientY],
        moved: false,
        id: event.pointerId,
        samples: [{ x: at[0], y: at[1], t: event.timeStamp }]
      };
      h.reel = undefined;
      h.V = [0, 0];
      h.drag = [h.P[0], h.P[1]];
    };
    const onPointerMove = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      if (Math.hypot(event.clientX - drag.start[0], event.clientY - drag.start[1]) > 3) drag.moved = true;
      // Every coalesced point, so fast flicks keep their shape and their speed.
      const events = event.getCoalescedEvents?.() ?? [];
      for (const e of events.length ? events : [event]) {
        const at = pointerAt(e);
        drag.samples.push({ x: at[0], y: at[1], t: e.timeStamp });
      }
      const at = pointerAt(event);
      drag.h.drag = [at[0] - drag.offset[0], at[1] - drag.offset[1]];
      const cutoff = event.timeStamp - 100;
      while (drag.samples.length > 2 && drag.samples[0].t < cutoff) drag.samples.shift();
    };
    const onPointerUp = (event: PointerEvent) => {
      if (!drag || event.pointerId !== drag.id) return;
      const { h, samples } = drag;
      // Let go: hand over the pointer's velocity over the last ~100ms (zero if it had
      // stopped), and let stretched silk spring back to its length.
      const first = samples[0];
      const last = samples[samples.length - 1];
      const span = (last.t - first.t) / 1000;
      const still = event.timeStamp - last.t > 60;
      if (span > 0.008 && !still) {
        const v: Vec = [(last.x - first.x) / span, (last.y - first.y) / span];
        const speed = Math.hypot(v[0], v[1]);
        h.V = speed > MAX_THROW ? [(v[0] / speed) * MAX_THROW, (v[1] / speed) * MAX_THROW] : v;
      }
      // Stretched silk needs no special case: the elastic line pulls it back smoothly.
      h.drag = null;
      swallowClick = drag.moved;
      drag = null;
    };
    // A swing that ends over a link (Theme Studio) must not also follow it.
    const onClickCapture = (event: MouseEvent) => {
      if (!swallowClick) return;
      swallowClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
    document.addEventListener('click', onClickCapture, true);

    const updateHint = (L: DOMRect) => {
      if (elapsed - hintAt < 200) return;
      hintAt = elapsed;
      let next = 'Space to tie on a thread';
      const holding = held();
      if (weave) next = 'Spinning…';
      else if (drawing) next = 'Spinning a thread · Space to tie it off';
      else if (holding) next = `Holding ${holding.label} · G to leave it here`;
      else {
        const near = nearGrab(L);
        const box = boxAt(collectBoxes(layer), x, y);
        if (near) {
          const label = near.dataset.spiderGrab;
          next = hangs.some((h) => h.el === near && h.mode === 'hanging') ? `G to take ${label} again` : `G to grab ${label}`;
        } else if (box) {
          const has = websRef.current.some((w) => w.key === box.key && w.state === 'done');
          next = has ? 'Space: thread · O clears this web' : 'Space: thread · O: orb web here';
        }
      }
      if (next !== lastHint) {
        lastHint = next;
        setHint(next);
      }
    };

    // ── loop ────────────────────────────────────────────────────────────────
    if (reduce) {
      x = Math.min(patrol.ax + 60, patrol.maxX);
      y = patrol.bandY;
      rot = 90;
      threadAlpha = 0;
      show();
      go('idle');
    }

    const stepWeave = (w: Weave, dt: number, L: DOMRect) => {
      w.t += w.rate * speedRef.current * dt;
      const { web, start, approach } = w;
      const { steps, hub, start: rimStart } = web.plan;
      const origin = hostOrigin(web, L);
      let pos: Vec;
      let face: Vec;

      if (w.t < approach) {
        const f = w.t / approach;
        pos = [start[0] + (rimStart[0] - start[0]) * f, start[1] + (rimStart[1] - start[1]) * f];
        face = [rimStart[0] - start[0], rimStart[1] - start[1]];
      } else {
        const u = w.t - approach;
        const touched = new Set<Layer>();
        while (w.k < steps.length && w.acc + steps[w.k].len <= u) {
          const s = steps[w.k];
          if (s.layer) {
            w.built[s.layer] += cmd(s);
            touched.add(s.layer);
          }
          w.acc += s.len;
          w.k++;
        }
        const paths = pathRefs.current.get(web.id);
        if (w.k >= steps.length) {
          for (const layer of Array.from(touched)) paths?.[layer]?.setAttribute('d', w.built[layer]);
          x = origin[0] + hub[0];
          y = origin[1] + hub[1];
          finishWeave();
          return;
        }
        const s = steps[w.k];
        const f = (u - w.acc) / s.len;
        pos = pointAt(s, f);
        const ahead = pointAt(s, Math.min(1, f + 0.05));
        face = ahead[0] === pos[0] && ahead[1] === pos[1] ? [s.b[0] - s.a[0], s.b[1] - s.a[1]] : [ahead[0] - pos[0], ahead[1] - pos[1]];
        if (s.layer) touched.add(s.layer);
        for (const layer of Array.from(touched)) {
          paths?.[layer]?.setAttribute('d', w.built[layer] + (s.layer === layer ? cmd(s, f) : ''));
        }
      }

      x = origin[0] + pos[0];
      y = origin[1] + pos[1];
      if (face[0] || face[1]) rot += angleDiff(rot, heading(face[0], face[1])) * Math.min(1, dt * 14);
      gait += dt * 22;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, last ? (now - last) / 1000 : 0);
      last = now;
      elapsed += dt * 1000;
      const t = elapsed - phaseStart;
      const p = patrol;
      const mult = speedRef.current;
      const live = isControlled || hangs.length > 0 || weave;
      const L = live ? layer.getBoundingClientRect() : null;
      layerRect = L;

      let amp = 2;
      let tuck = 0;
      let bob = 0;

      switch (phase) {
        case 'wait':
          amp = 0;
          if (t > START_DELAY) {
            show();
            go('drop');
          }
          break;
        case 'drop': {
          const f = Math.min(1, t / DROP_MS);
          const settleT = t > DROP_MS ? (t - DROP_MS) / 1000 : 0;
          x = p.dropX + Math.sin(t / 650) * 3.5 * (1 - f);
          y = -30 + (p.landY + 30) * ease(f) + 3 * Math.sin(settleT * 10) * Math.exp(-settleT * 7);
          rot = 180 + Math.sin(t / 650) * 6 * (1 - f);
          tuck = 1 - Math.max(0, (f - 0.85) / 0.15);
          gait = t / 260;
          amp = 6 * tuck;
          // Down: the drop line goes at once and the spider walks on, no waiting.
          if (settleT > 0.3) go('cross');
          break;
        }
        case 'cross':
          // Over the avatar to the top of it.
          amp = 16;
          bob = Math.sin(gait * 2) * 0.25;
          if (stepToward(p.ax, p.top + 5, dt, PATROL_SPEED * 1.4 * mult) < 0.5) go('tie');
          break;
        case 'tie':
          // A beat to fix the line on, as if G were pressed.
          gait += dt * 0.8;
          rot += angleDiff(rot, 0) * Math.min(1, dt * 6);
          if (t > 450) {
            pulled = tieOn(avatar, layer.getBoundingClientRect());
            go('climb');
          }
          break;
        case 'climb': {
          // Straight up, paying out silk: the avatar stays exactly where it is.
          amp = 16;
          bob = Math.sin(gait * 2) * 0.25;
          const remaining = stepToward(p.ax, p.top - HANG_LINE, dt, PATROL_SPEED * 1.2 * mult);
          if (pulled && pulled.mode === 'held') {
            pulled.rope = Math.max(pulled.rope, Math.hypot(pulled.P[0] - x, pulled.P[1] - y));
          }
          if (remaining < 0.5) go('leave');
          break;
        }
        case 'leave':
          // Glue the line here and go: the avatar now hangs on it, in its own box.
          gait += dt * 0.8;
          if (t > 500) {
            if (pulled && pulled.mode === 'held') {
              pulled.mode = 'hanging';
              pulled.anchor = [x, y];
              pulled.rope = Math.hypot(pulled.P[0] - x, pulled.P[1] - y);
            }
            pulled = null;
            dir = 1;
            descendX = p.right + 18;
            go('descend');
          }
          break;
        case 'descend':
          amp = 16;
          bob = Math.sin(gait * 2) * 0.25;
          if (stepToward(descendX, p.bandY, dt, PATROL_SPEED * mult) < 0.5) {
            scheduleWalkPause();
            go('walk');
          }
          break;
        case 'walk': {
          amp = 16;
          bob = Math.sin(gait * 2) * 0.25;
          // A slight meander inside the band so the path never looks ruled.
          const ty = p.bandY + Math.sin(x / 38) * 2.5;
          if (stepToward(dir > 0 ? p.maxX : p.minX, ty, dt, PATROL_SPEED * mult) < 0.5) {
            turnFrom = rot;
            turnTo = rot + 180 * dir;
            dir = -dir;
            go('turn');
          } else if (elapsed > nextPauseAt) {
            pauseFor = 1400 + Math.random() * 2200;
            go('pause');
          }
          break;
        }
        case 'turn': {
          const f = Math.min(1, (t * mult) / TURN_MS);
          rot = turnFrom + (turnTo - turnFrom) * (0.5 - Math.cos(f * Math.PI) / 2);
          gait += dt * 6 * mult;
          amp = 10;
          if (f >= 1) {
            scheduleWalkPause();
            go('walk');
          }
          break;
        }
        case 'pause':
          gait += dt * 0.6;
          if (t > pauseFor) {
            scheduleWalkPause();
            go('walk');
          }
          break;
        case 'idle':
        case 'player': {
          const dx = phase === 'player' ? (keys.has('right') ? 1 : 0) - (keys.has('left') ? 1 : 0) : 0;
          const dy = phase === 'player' ? (keys.has('down') ? 1 : 0) - (keys.has('up') ? 1 : 0) : 0;
          if (dx || dy) {
            restRot = null;
            const n = Math.hypot(dx, dy);
            const v = MOVE_SPEED * mult * (boost ? 2.2 : 1) * (held() ? 0.7 : 1);
            x = clamp(x + (dx / n) * v * dt, 6, layer.clientWidth - 6);
            y = clamp(y + (dy / n) * v * dt, 6, layer.clientHeight - 6);
            rot += angleDiff(rot, heading(dx, dy)) * Math.min(1, dt * 10);
            gait += v * dt * 0.55;
            amp = 16;
            bob = Math.sin(gait * 2) * 0.25;
            // Keep it in view: the page follows the spider.
            if (L) {
              const vy = L.top + y;
              if (vy < NAV + 60) window.scrollBy(0, vy - NAV - 60);
              else if (vy > window.innerHeight - 60) window.scrollBy(0, vy - window.innerHeight + 60);
            }
          } else {
            if (restRot !== null) rot += angleDiff(rot, restRot) * Math.min(1, dt * 3);
            gait += dt * 0.7;
          }
          break;
        }
        case 'weave':
          amp = 14;
          if (weave && L) stepWeave(weave, dt, L);
          break;
      }

      // The drop line disappears the moment the spider lands.
      if (phase !== 'wait' && !(phase === 'drop' && t < DROP_MS)) {
        threadAlpha = Math.max(0, threadAlpha - dt * 5);
      }

      place(bob);
      poseLegs(legRefs.current, gait, amp, tuck);

      thread.setAttribute('x1', p.dropX.toFixed(2));
      thread.setAttribute('x2', x.toFixed(2));
      thread.setAttribute('y2', (y - 2).toFixed(2));
      thread.style.opacity = threadAlpha.toFixed(3);

      if (drawing) {
        liveLine.setAttribute('x1', drawing[0].toFixed(1));
        liveLine.setAttribute('y1', drawing[1].toFixed(1));
        liveLine.setAttribute('x2', x.toFixed(1));
        liveLine.setAttribute('y2', y.toFixed(1));
      }

      if (L) for (const h of [...hangs]) stepHang(h, dt, L);
      if (isControlled && L) updateHint(L);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
      document.removeEventListener('click', onClickCapture, true);
      for (const h of [...hangs]) settle(h);
      api.current = null;
    };
  }, []);

  const registerPath = useCallback<RegisterPath>((id, layer, el) => {
    const refs = pathRefs.current;
    const entry = refs.get(id) ?? {};
    entry[layer] = el;
    if (LAYERS.some((l) => entry[l])) refs.set(id, entry);
    else refs.delete(id);
  }, []);
  const activate = useCallback(() => api.current?.activate(), []);
  const release = useCallback(() => api.current?.release(), []);
  const reset = useCallback(() => api.current?.reset(), []);

  return (
    <>
      {/* Webs sit under the sticky top bar; the spider walks over everything. */}
      <svg aria-hidden className={cn(LAYER, TOKENS, 'z-[1]')}>
        {webs
          .filter((web) => !web.host)
          .map((web) => (
            <g key={web.id} transform={`translate(${web.x} ${web.y})`}>
              <WebPaths web={web} onPath={registerPath} />
            </g>
          ))}
        <g
          stroke="var(--spider-web)"
          strokeWidth={0.75}
          strokeLinecap="round"
          fill="var(--spider-web)"
          style={{ opacity: threadsFading ? 0 : 1, transition: 'opacity 500ms ease' }}
        >
          {threads.map(({ id, a, b }) => (
            <g key={id}>
              <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
              <circle cx={a[0]} cy={a[1]} r={1.1} stroke="none" />
              <circle cx={b[0]} cy={b[1]} r={1.1} stroke="none" />
            </g>
          ))}
        </g>
        {/* the thread being spun, trailing from its knot to the spider */}
        <g ref={liveRef} style={{ opacity: 0 }} stroke="var(--spider-silk)" fill="var(--spider-silk)">
          <line strokeWidth={0.75} strokeLinecap="round" />
          <circle r={1.4} stroke="none" />
        </g>
      </svg>

      {webs
        .filter((web) => web.host)
        .map((web) =>
          createPortal(
            <svg
              key={web.id}
              aria-hidden
              className={cn(TOKENS, 'pointer-events-none absolute left-0 top-0 z-[1] overflow-hidden rounded-[inherit]')}
              width={web.w}
              height={web.h}
            >
              <WebPaths web={web} onPath={registerPath} />
            </svg>,
            web.host as HTMLElement
          )
        )}

      <svg ref={layerRef} aria-hidden className={cn(LAYER, TOKENS, 'z-[53] opacity-0')}>
        <line ref={threadRef} y1={0} stroke="var(--spider-silk)" strokeWidth={0.75} style={{ opacity: 0 }} />
        <g ref={ropesRef} />
        <SpiderArt bodyRef={bodyRef} legRefs={legRefs} hitRef={hitRef} onActivate={activate} />
      </svg>

      <SpiderHud
        open={controlled}
        hint={hint}
        speed={speed}
        onSpeed={setSpeed}
        canReset={webs.length > 0 || hangCount > 0 || threads.length > 0}
        onReset={reset}
        onClose={release}
      />
    </>
  );
}
