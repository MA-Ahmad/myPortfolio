import { docRect, scanPage, type Layer, type Rect } from './scan';
import styles from './redraw.module.css';
import type { SoundDetail, SoundKind } from './sound';
import { Stash, developRaster, placeInSequence, traceVector, type MediaDrawing } from './media';

/**
 * The redraw run, outside React: one requestAnimationFrame loop moves every agent on springs,
 * writes transforms straight to the DOM and draws the rulers on a canvas. React only hears a
 * summary a few times a second (`onStats`) for the toolbar.
 *
 * A run goes scan -> build -> outro -> done. During the build each agent claims the best layer it
 * can reach (on screen first, near the agent, near a click), draws its box, then reveals it: a
 * frame fades in, pictures are traced or developed (media.ts), text is typed, lines and grids
 * are swept.
 * A layer is only drawn once the layer it sits in is done, so the page goes up outside in.
 */

export type Phase = 'scan' | 'build' | 'outro' | 'done';
export type AgentInfo = { name: string; color: string };
export type RedrawStats = {
  phase: Phase;
  found: number;
  done: number;
  total: number;
  agents: AgentInfo[];
  /** Seconds of build time, in run time (so 2x speed counts half). */
  elapsed: number;
  /** Whether the page scrolls itself to keep the drawing in view. */
  follow: boolean;
};

type Tool = 'arrow' | 'cross' | 'beam';
type Stage = 'roam' | 'idle' | 'travel' | 'drag' | 'draw' | 'hold' | 'sweep' | 'type' | 'leave';

type Box = { el: HTMLDivElement; size: HTMLSpanElement; label: string };

interface Agent {
  name: string;
  color: string;
  el: HTMLDivElement;
  tool: Tool;
  x: number;
  y: number;
  vx: number;
  vy: number;
  tx: number;
  ty: number;
  stiffness: number;
  damping: number;
  stage: Stage;
  /** Time in the current stage. */
  t: number;
  /** When a roaming or idle agent picks a new spot. */
  wander: number;
  /** Shows the name tag until this run time. */
  talkUntil: number;
  /** 0.8-1.25: some agents type and draw a little faster than others. */
  pace: number;
  task: Layer | null;
  box: Box | null;
  typing: Typing | null;
  drawing: MediaDrawing | null;
  /** Items of a sequence already put down, to click once per item. */
  placed: number;
  revealed: boolean;
  orbit: number;
  /** Work nobody can see goes faster: 1 on screen, OFFSCREEN_BOOST below or above it. */
  boost: number;
}

type Typing = { node: number; offset: number; budget: number; cps: number; ranges: Range[] };

export type EngineOptions = {
  root: HTMLElement;
  overlay: HTMLDivElement;
  canvas: HTMLCanvasElement;
  origin?: { x: number; y: number };
  reduced: boolean;
  onStats: (stats: RedrawStats) => void;
  onTick?: (kind: SoundKind, detail?: SoundDetail) => void;
  /** Where the crew gathers at the end: the toolbar, in screen coordinates. */
  dock?: () => DOMRect | null;
};

const PALETTE = [
  '#ff7a9a',
  '#ffd25e',
  '#5cd2ff',
  '#7ef0a0',
  '#b794ff',
  '#ffa462',
  '#52e5cc',
  '#f59bff',
  '#93b4ff',
  '#d8f36a'
];
const NAMES = [
  'Ada',
  'Linus',
  'Grace',
  'Alan',
  'Radia',
  'Ken',
  'Barbara',
  'Dennis',
  'Margaret',
  'Guido',
  'Frances',
  'Edsger',
  'Hedy',
  'Donald',
  'Sophie',
  'Brendan'
];
const HIGHLIGHT = 'redraw-pending';
const SCAN_TIME = 1.15;
/** The camera moves on once the drawing frontier is this far down the screen... */
const FOLLOW_TRIGGER = 0.4;
/** ...and brings it back up to here. */
const FOLLOW_TOP = 0.12;
/**
 * While following, agents only take work within this much of a screen below the frontier (the
 * highest part not yet drawn). The page goes up in order and all of it happens in view: a slow
 * picture holds the crew around it instead of letting them finish the next section unseen.
 */
const REACH = 0.55;
/** Keeps roaming agents a little clear of the screen edges. */
const MARGIN = 20;
const OFFSCREEN_BOOST = 4;
/** Spacing of the flock the crew forms on the toolbar at the end: tight, so they overlap. */
const FLOCK_SPACING = 7;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

const ICONS = {
  arrow:
    '<svg class="ARROW" width="18" height="18" viewBox="0 0 18 18"><path d="M3 2 16 8.6 10 10.4 7.3 16.2Z" fill="var(--c)" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/></svg>',
  cross:
    '<svg class="CROSS" width="16" height="16" viewBox="0 0 16 16"><path d="M8 1v14M1 8h14" stroke="#fff" stroke-width="3.6" stroke-linecap="round"/><path d="M8 1v14M1 8h14" stroke="var(--c)" stroke-width="1.6" stroke-linecap="round"/></svg>',
  beam: '<svg class="BEAM" width="16" height="16" viewBox="0 0 16 16"><path d="M5.5 1.5c1.4 0 2.5.6 2.5 2v9c0 1.4-1.1 2-2.5 2M10.5 1.5c-1.4 0-2.5.6-2.5 2v9c0 1.4 1.1 2 2.5 2M6 8h4" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round"/><path d="M5.5 1.5c1.4 0 2.5.6 2.5 2v9c0 1.4-1.1 2-2.5 2M10.5 1.5c-1.4 0-2.5.6-2.5 2v9c0 1.4 1.1 2 2.5 2M6 8h4" fill="none" stroke="var(--c)" stroke-width="1.4" stroke-linecap="round"/></svg>'
};

const supportsHighlights = () =>
  typeof CSS !== 'undefined' && 'highlights' in CSS && typeof Highlight !== 'undefined';

export class RedrawEngine {
  private opts: EngineOptions;
  private layers: Layer[] = [];
  private children: number[][] = [];
  private keep: Element[] = [];
  private ready = new Set<number>();
  private agents: Agent[] = [];
  private maxAgents: number;
  private phase: Phase = 'scan';
  private time = 0;
  private phaseTime = 0;
  private buildTime = 0;
  private spawnClock = 0;
  private done = 0;
  private found = 0;
  private speed = 1;
  private paused = false;
  private raf = 0;
  private last = 0;
  private statsClock = 0;
  private rectClock = 0;
  private rulerAlpha = 0;
  private scanY = 0;
  private pointer: { x: number; y: number } | null = null;
  private focus: { x: number; y: number; until: number } | null = null;
  private highlight: Highlight | null = null;
  private highlightStyle: HTMLStyleElement | null = null;
  /** The page's hatched gutters (the guide rails), where the rulers live. */
  private rails: HTMLElement | null = null;
  private gutters: { left: number; right: number; width: number } | null = null;
  private clips = new Map<Element, string>();
  private stash = new Stash();
  private colors = {
    panel: '#fff',
    page: '#fff',
    line: '#e4e4e7',
    text: '#71717a',
    ink: '#18181b'
  };
  private ctx: CanvasRenderingContext2D | null;
  private dpr = 1;
  private reducedQueue: Layer[] = [];
  private outroAt = 0;
  /** Each agent's place in the flock on the toolbar at the end (an index into the pattern). */
  private perches = new Map<Agent, number>();
  private destroyed = false;
  private follow = true;
  private cam = 0;
  private camVelocity = 0;
  private camTarget: number | null = null;
  /** Page y of the highest layer not yet drawn (fixed and sticky ones aside). */
  private frontier = 0;

  constructor(opts: EngineOptions) {
    this.opts = opts;
    this.ctx = opts.canvas.getContext('2d');
    const narrow = window.innerWidth < 768;
    this.maxAgents = narrow ? 7 : 16;
  }

  start() {
    const { root, reduced } = this.opts;
    // The press already blanked the page (lib/redraw.ts). Lift that, measure and hide again in
    // this same task, so no frame ever shows the page in between.
    document.documentElement.removeAttribute('data-redraw-pending');
    // Draw from the top. The page is blank, so the jump is never seen; reduced motion keeps the
    // visitor where they are.
    if (!reduced) window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    this.cam = window.scrollY;
    this.follow = !reduced;
    const { layers, keep } = scanPage(root);
    this.layers = layers;
    this.keep = keep;
    this.children = layers.map(() => []);
    for (const layer of layers) {
      if (layer.parent >= 0) this.children[layer.parent].push(layer.index);
      else this.ready.add(layer.index);
    }

    const style = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) =>
      style.getPropertyValue(name).trim() || fallback;
    this.colors = {
      panel: read('--popover', this.colors.panel),
      page: read('--background', this.colors.page),
      line: read('--border', this.colors.line),
      text: read('--muted-foreground', this.colors.text),
      ink: read('--foreground', this.colors.ink)
    };

    if (supportsHighlights()) {
      this.highlight = new Highlight();
      CSS.highlights.set(HIGHLIGHT, this.highlight);
      // The rule that paints untyped text transparent. Added here, not in globals.css, because
      // the build's CSS parser (Lightning CSS) doesn't know `::highlight()` yet and warns on it;
      // it is also only needed while a run is on.
      this.highlightStyle = document.createElement('style');
      this.highlightStyle.textContent = `::highlight(${HIGHLIGHT}) { color: transparent; text-decoration-color: transparent; }`;
      document.head.appendChild(this.highlightStyle);
    }

    this.rails = document.querySelector<HTMLElement>('[data-redraw-rails]');
    this.resize();
    window.addEventListener('resize', this.resize);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerdown', this.onPointerDown, { passive: true });
    window.addEventListener('wheel', this.onUserScroll, { passive: true });
    window.addEventListener('touchmove', this.onUserScroll, { passive: true });
    window.addEventListener('keydown', this.onKey);
    document.documentElement.addEventListener('pointerleave', this.onPointerLeave);

    this.hidePage();
    if (reduced) {
      // No crew and no travel: the page comes back in reading order.
      this.phase = 'build';
      this.reducedQueue = [...layers].sort((a, b) => a.rect.y - b.rect.y || a.depth - b.depth);
    } else {
      this.opts.onTick?.('start');
    }

    this.emit(true);
    this.last = performance.now();
    this.raf = requestAnimationFrame(this.frame);
  }

  setSpeed(speed: number) {
    this.speed = speed;
  }

  setPaused(paused: boolean) {
    this.paused = paused;
  }

  setFollow(follow: boolean) {
    if (this.opts.reduced) return;
    this.follow = follow;
    this.cam = window.scrollY;
    this.camVelocity = 0;
    this.camTarget = null;
    this.emit(true);
  }

  /** Finishes every layer at once and sends the crew home. */
  skip() {
    if (this.phase === 'done' || this.phase === 'outro') return;
    for (const agent of this.agents) this.release(agent);
    for (const layer of this.layers) {
      if (layer.status !== 'done') this.complete(layer, false);
    }
    this.beginOutro();
  }

  destroy() {
    if (this.destroyed) return;
    this.destroyed = true;
    cancelAnimationFrame(this.raf);
    window.removeEventListener('resize', this.resize);
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('wheel', this.onUserScroll);
    window.removeEventListener('touchmove', this.onUserScroll);
    window.removeEventListener('keydown', this.onKey);
    document.documentElement.removeEventListener('pointerleave', this.onPointerLeave);
    this.restorePage();
    this.opts.overlay.replaceChildren();
  }

  // ---------------------------------------------------------------------------------------------
  // The page

  private hidePage() {
    for (const el of this.keep) el.setAttribute('data-redraw-keep', '');
    for (const layer of this.layers) layer.el.setAttribute('data-rd', 'off');
    this.opts.root.setAttribute('data-redraw-root', '');
    document.documentElement.setAttribute('data-redraw', '');
  }

  private restorePage() {
    for (const [el, clip] of Array.from(this.clips)) (el as HTMLElement).style.clipPath = clip;
    this.clips.clear();
    this.stash.restoreAll();
    for (const layer of this.layers) layer.el.removeAttribute('data-rd');
    for (const el of this.keep) el.removeAttribute('data-redraw-keep');
    this.opts.root.removeAttribute('data-redraw-root');
    document.documentElement.removeAttribute('data-redraw');
    if (this.highlight && supportsHighlights()) {
      this.highlight.clear();
      CSS.highlights.delete(HIGHLIGHT);
    }
    this.highlightStyle?.remove();
    this.highlightStyle = null;
  }

  private reveal(layer: Layer, state: 'on' | 'type' | 'wipe' | 'done') {
    layer.el.setAttribute('data-rd', state);
  }

  private setClip(layer: Layer, progress: number) {
    const el = layer.el as HTMLElement;
    if (!this.clips.has(el)) this.clips.set(el, el.style.clipPath);
    // Generous outsets keep shadows and the full-width screen lines inside the clip.
    const rest = `${(1 - progress) * 100}%`;
    el.style.clipPath =
      layer.axis === 'x'
        ? `inset(-4px ${rest} -4px -100vw)`
        : `inset(-100vh -100vw ${rest} -100vw)`;
  }

  private clearClip(layer: Layer) {
    const el = layer.el as HTMLElement;
    if (!this.clips.has(el)) return;
    el.style.clipPath = this.clips.get(el) ?? '';
    this.clips.delete(el);
  }

  private complete(layer: Layer, animate: boolean) {
    if (layer.status === 'done') return;
    layer.status = 'done';
    this.ready.delete(layer.index);
    this.clearClip(layer);
    if (layer.el.getAttribute('data-rd') === 'off' || !animate) {
      this.reveal(layer, animate ? 'on' : 'done');
    }
    this.done += 1;
    for (const child of this.children[layer.index]) {
      if (this.layers[child].status === 'pending') this.ready.add(child);
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Events

  private resize = () => {
    const canvas = this.opts.canvas;
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    canvas.width = Math.round(width * this.dpr);
    canvas.height = Math.round(height * this.dpr);
    this.opts.overlay.style.height = `${document.documentElement.scrollHeight}px`;
    this.rectClock = 1;
    this.measureGutters();
  };

  private onPointerMove = (event: PointerEvent) => {
    if (event.pointerType === 'mouse') this.pointer = { x: event.pageX, y: event.pageY };
  };

  /** The visitor scrolled: they're driving now, so the camera lets go until asked again. */
  private onUserScroll = () => {
    if (this.follow && this.phase !== 'outro' && this.phase !== 'done') this.setFollow(false);
  };

  private onKey = (event: KeyboardEvent) => {
    if (['ArrowDown', 'ArrowUp', 'PageDown', 'PageUp', 'Home', 'End', ' '].includes(event.key)) {
      const target = event.target as Element | null;
      if (target?.closest('input, textarea, [contenteditable], [data-redraw-ui]')) return;
      this.onUserScroll();
    }
  };

  private onPointerLeave = () => {
    this.pointer = null;
  };

  /** A click asks the crew to come and draw that spot next. */
  private onPointerDown = (event: PointerEvent) => {
    if (this.phase !== 'build' || this.opts.reduced) return;
    if ((event.target as Element | null)?.closest('[data-redraw-ui]')) return;
    this.focus = { x: event.pageX, y: event.pageY, until: this.time + 3 };
    const ripple = document.createElement('div');
    ripple.className = styles.ripple;
    ripple.style.left = `${event.pageX}px`;
    ripple.style.top = `${event.pageY}px`;
    this.opts.overlay.appendChild(ripple);
    window.setTimeout(() => ripple.remove(), 700);
    for (const agent of this.agents) {
      if (agent.stage === 'idle' || agent.stage === 'roam') agent.wander = 0;
    }
  };

  // ---------------------------------------------------------------------------------------------
  // Loop

  private frame = (now: number) => {
    if (this.destroyed) return;
    const real = Math.min(0.05, (now - this.last) / 1000);
    this.last = now;
    const dt = this.paused ? 0 : real * this.speed;
    this.time += dt;
    this.phaseTime += dt;

    this.rectClock -= real;
    if (this.rectClock <= 0) {
      this.rectClock = 1;
      this.refreshRects();
    }

    if (this.phase === 'scan') this.updateScan(dt);
    else if (this.phase === 'build') this.updateBuild(dt);
    else if (this.phase === 'outro') this.updateOutro(dt);

    for (const agent of this.agents) this.moveAgent(agent, dt);
    this.draw();

    this.statsClock -= real;
    if (this.statsClock <= 0) this.emit();

    // After the run the crew still sits on the toolbar and follows it as it changes size, so the
    // loop keeps going (cheaply) until the toolbar closes and this is destroyed.
    if (this.phase === 'done') this.updatePerches();
    this.raf = requestAnimationFrame(this.frame);
  };

  /** A sound event, with how big the thing is and where on screen it happened. */
  private tick(kind: SoundKind, at: Layer | Rect) {
    const r = 'rect' in at ? at.rect : at;
    const center = r.x + r.w / 2 - window.scrollX;
    this.opts.onTick?.(kind, {
      size: Math.sqrt(Math.max(1, r.w * r.h)),
      pan: clamp((center / window.innerWidth) * 2 - 1, -1, 1)
    });
  }

  private emit(force = false) {
    if (!force && this.statsClock > 0) return;
    this.statsClock = 0.1;
    this.opts.onStats({
      phase: this.phase,
      found: this.found,
      done: this.done,
      total: this.layers.length,
      agents: this.agents.map(({ name, color }) => ({ name, color })),
      elapsed: this.buildTime,
      follow: this.follow
    });
  }

  private setPhase(phase: Phase) {
    this.phase = phase;
    this.phaseTime = 0;
    this.emit(true);
  }

  /** Layout moves (fonts, images, a resize): keep the targets honest. */
  private refreshRects() {
    for (const layer of this.layers) {
      if (layer.status !== 'done') layer.rect = docRect(layer.el);
    }
    this.opts.overlay.style.height = `${document.documentElement.scrollHeight}px`;
  }

  private viewport(): Rect {
    return { x: window.scrollX, y: window.scrollY, w: window.innerWidth, h: window.innerHeight };
  }

  private updateScan(dt: number) {
    const vp = this.viewport();
    const t = this.phaseTime;

    const initial = Math.min(this.maxAgents, 6);
    while (this.agents.length < initial && t > this.agents.length * 0.07) this.spawn();
    if (t > 0.25) this.rulerAlpha = Math.min(1, this.rulerAlpha + dt * 3);
    for (const agent of this.agents) {
      agent.wander -= dt;
      if (agent.wander <= 0) {
        agent.wander = 0.35 + Math.random() * 0.4;
        agent.tx = vp.x + MARGIN + Math.random() * (vp.w - MARGIN * 2);
        agent.ty = vp.y + MARGIN + Math.random() * (vp.h - MARGIN * 2);
      }
    }

    const sweep = clamp(t / (SCAN_TIME - 0.15), 0, 1);
    this.scanY = easeInOut(sweep) * (vp.h + 40);
    let found = 0;
    for (const layer of this.layers) {
      if (layer.rect.y - vp.y < this.scanY || layer.rect.y > vp.y + vp.h) found += 1;
    }
    this.found = Math.round(found * sweep);

    if (t >= SCAN_TIME) {
      for (const agent of this.agents) {
        agent.stage = 'idle';
        agent.wander = 0;
      }
      this.found = this.layers.length;
      this.setPhase('build');
    }
  }

  private updateBuild(dt: number) {
    this.buildTime += dt;
    this.rulerAlpha = Math.min(1, this.rulerAlpha + dt * 3);
    if (this.focus && this.time > this.focus.until) this.focus = null;

    if (this.opts.reduced) {
      const perFrame = Math.max(1, Math.ceil(this.layers.length / 50));
      for (let i = 0; i < perFrame && this.reducedQueue.length; i += 1) {
        this.complete(this.reducedQueue.shift()!, false);
      }
      if (!this.reducedQueue.length) this.beginOutro();
      return;
    }

    // The crew grows while there is more work ready than hands free.
    this.spawnClock -= dt;
    if (this.spawnClock <= 0 && this.agents.length < this.maxAgents) {
      const free = this.agents.filter((agent) => !agent.task).length;
      if (this.ready.size > free + 2) {
        this.spawn();
        this.spawnClock = 0.25;
      }
    }

    this.frontier = this.findFrontier();
    for (const agent of this.agents) this.think(agent, dt);
    this.updateCamera(dt);

    if (this.done >= this.layers.length && this.agents.every((agent) => !agent.task))
      this.beginOutro();
  }

  /**
   * The crew comes home: every agent flies down to the toolbar and joins one tight flock on
   * top of it, each cursor at its own angle, overlapping like a crowd. All targets sit on the
   * toolbar's edge, so no one ever heads up the page. They stay there and leave when the
   * toolbar does, fading out with it; the summary appears once they have all settled.
   */
  private beginOutro() {
    if (this.phase === 'outro' || this.phase === 'done') return;
    this.setPhase('outro');
    this.outroAt = this.time;
    this.opts.overlay.style.zIndex = '71';
    // Places in the flock: the agents nearest its centre take the inner places, so everyone
    // comes straight in and no one crosses the pack. Nearest first, a beat apart.
    const center = this.perchPoint(0);
    const order = [...this.agents].sort(
      (a, b) =>
        Math.hypot(a.x - center.x, a.y - center.y) - Math.hypot(b.x - center.x, b.y - center.y)
    );
    order.forEach((agent, index) => this.perches.set(agent, index));
    order.forEach((agent, index) => {
      this.release(agent);
      agent.stage = 'leave';
      agent.tool = 'arrow';
      agent.t = -index * 0.035;
      agent.tx = agent.x;
      agent.ty = agent.y;
      agent.stiffness = 140;
      agent.damping = 0.95;
      agent.boost = 1;
      // Shed most of the speed left from the last task, so nobody swings away before heading in.
      agent.vx *= 0.25;
      agent.vy *= 0.25;
      // Most of the flock faces the same way, each a few degrees off so it isn't a stamp; one in
      // four turns properly, so it reads as a crowd.
      const swing = index % 4 === 3 ? 25 + Math.random() * 30 : Math.random() * 7;
      agent.el.style.setProperty(
        '--tilt',
        `${Math.round(swing * (Math.random() < 0.5 ? -1 : 1))}deg`
      );
    });
    this.opts.onTick?.('done');
  }

  /**
   * A place in the flock on top of the toolbar, in page coordinates. Places follow a sunflower
   * pattern (each one a golden angle round from the last, a little further out), squashed flat
   * so the pack sits along the toolbar's top edge above its left side, close enough to overlap
   * like a crowd of cursors. Place 0 is the centre.
   */
  private perchPoint(index: number) {
    const rect = this.opts.dock?.();
    const vp = this.viewport();
    const centre = rect
      ? { x: vp.x + rect.left + Math.min(90, rect.width * 0.3), y: vp.y + rect.top - 26 }
      : { x: vp.x + vp.w / 2, y: vp.y + vp.h - 90 };
    const radius = FLOCK_SPACING * Math.sqrt(index);
    const angle = index * 2.39996;
    return {
      x: centre.x + Math.cos(angle) * radius * 1.6,
      // Never lower than the toolbar's edge: the pack grows upward and sideways from it.
      y: centre.y - Math.abs(Math.sin(angle) * radius * 0.8)
    };
  }

  /** Keeps the flock on the toolbar: it is fixed, so a scroll moves it on the page. */
  private updatePerches() {
    for (const agent of this.agents) {
      if (agent.t < 0) continue;
      const point = this.perchPoint(this.perches.get(agent) ?? 0);
      agent.tx = point.x;
      agent.ty = point.y;
    }
  }

  /**
   * Keeps the drawing in view. The frontier is the highest layer not yet drawn; once it sits
   * halfway down the screen, the page glides on (a damped spring, never a jump) until it is near
   * the top again, so the visitor watches it go up section by section. Any scroll of their own
   * hands control back to them.
   */
  private updateCamera(dt: number) {
    if (!this.follow || dt === 0) return;
    if (Math.abs(window.scrollY - this.cam) > 4) {
      // Moved by something other than the camera: a scrollbar drag, find in page, a jump link.
      this.setFollow(false);
      return;
    }
    const frontier = this.frontier;
    if (frontier === Infinity) return;
    const height = window.innerHeight;
    const max = Math.max(0, document.documentElement.scrollHeight - height);
    const offset = frontier - this.cam;
    if (offset > height * FOLLOW_TRIGGER || offset < 0) {
      this.camTarget = clamp(frontier - height * FOLLOW_TOP, 0, max);
    }
    if (this.camTarget === null) return;

    const k = 7;
    this.camVelocity +=
      (k * (this.camTarget - this.cam) - 2 * Math.sqrt(k) * this.camVelocity) * dt;
    this.camVelocity = clamp(this.camVelocity, -1800, 1800);
    this.cam += this.camVelocity * dt;
    if (Math.abs(this.camTarget - this.cam) < 0.5 && Math.abs(this.camVelocity) < 5) {
      this.cam = this.camTarget;
      this.camTarget = null;
      this.camVelocity = 0;
    }
    window.scrollTo({ top: this.cam, left: 0, behavior: 'instant' });
    // Browsers round the scroll position; track what actually happened.
    this.cam = window.scrollY;
  }

  private updateOutro(dt: number) {
    this.rulerAlpha = Math.max(0, this.rulerAlpha - dt * 2.5);
    for (const agent of this.agents) agent.t += dt;
    this.updatePerches();
    const settled = this.agents.every(
      (agent) =>
        agent.t >= 0 &&
        Math.hypot(agent.tx - agent.x, agent.ty - agent.y) < 3 &&
        Math.hypot(agent.vx, agent.vy) < 40
    );
    // Done once everyone has settled; a slow frame never holds the summary back for long.
    if (settled || this.time - this.outroAt > 2.4 || this.opts.reduced) {
      this.restorePage();
      this.draw();
      this.setPhase('done');
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Agents

  private spawn() {
    const index = this.agents.length;
    const color = PALETTE[index % PALETTE.length];
    const vp = this.viewport();
    const origin = this.opts.origin ?? { x: vp.w / 2, y: vp.h - 40 };
    const el = document.createElement('div');
    el.className = styles.agent;
    el.style.setProperty('--c', color);
    el.innerHTML =
      ICONS.arrow.replace('ARROW', styles.arrow) +
      ICONS.cross.replace('CROSS', styles.cross) +
      ICONS.beam.replace('BEAM', styles.beam);
    const name = document.createElement('span');
    name.className = styles.name;
    name.textContent = NAMES[index % NAMES.length];
    el.appendChild(name);
    el.dataset.tool = 'arrow';
    this.opts.overlay.appendChild(el);

    const agent: Agent = {
      name: NAMES[index % NAMES.length],
      color,
      el,
      tool: 'arrow',
      x: origin.x + vp.x,
      y: origin.y + vp.y,
      vx: (Math.random() - 0.5) * 900,
      vy: (Math.random() - 0.5) * 900,
      tx: origin.x + vp.x,
      ty: origin.y + vp.y,
      stiffness: 110,
      damping: 0.8,
      stage: this.phase === 'scan' ? 'roam' : 'idle',
      t: 0,
      wander: 0,
      talkUntil: this.time + 1.4,
      pace: 0.8 + Math.random() * 0.45,
      task: null,
      box: null,
      typing: null,
      drawing: null,
      placed: 0,
      revealed: false,
      orbit: Math.random() * Math.PI * 2,
      boost: 1
    };
    this.agents.push(agent);
    this.emit(true);
  }

  private moveAgent(agent: Agent, frameDt: number) {
    const dt = frameDt * agent.boost;
    if (dt > 0) {
      // Semi-implicit spring, in small steps so stiff springs stay stable at low frame rates.
      const steps = Math.ceil(dt / (1 / 120));
      const h = dt / steps;
      const k = agent.stiffness;
      const c = 2 * Math.sqrt(k) * agent.damping;
      for (let i = 0; i < steps; i += 1) {
        agent.vx += (k * (agent.tx - agent.x) - c * agent.vx) * h;
        agent.vy += (k * (agent.ty - agent.y) - c * agent.vy) * h;
        agent.x += agent.vx * h;
        agent.y += agent.vy * h;
      }
    }
    agent.el.style.transform = `translate3d(${agent.x.toFixed(1)}px, ${agent.y.toFixed(1)}px, 0)`;
    if (agent.el.dataset.tool !== agent.tool) agent.el.dataset.tool = agent.tool;
    const talking = this.time < agent.talkUntil && this.phase !== 'outro';
    if (talking !== agent.el.hasAttribute('data-talk'))
      agent.el.toggleAttribute('data-talk', talking);
  }

  private score(agent: Agent, layer: Layer, vp: Rect) {
    const r = layer.rect;
    const below = r.y - (vp.y + vp.h);
    const above = vp.y - (r.y + r.h);
    const offscreen = Math.max(0, below, above);
    // Reading order first, then whoever is closest; anything off screen waits its turn.
    let score =
      offscreen * 4 + Math.hypot(agent.x - r.x, agent.y - r.y) * 0.3 + r.y * 0.12 + layer.depth * 6;
    if (this.focus)
      score += Math.hypot(this.focus.x - (r.x + r.w / 2), this.focus.y - (r.y + r.h / 2)) * 1.6;
    return score;
  }

  private findFrontier() {
    let frontier = Infinity;
    for (const layer of this.layers) {
      if (layer.status !== 'done' && !layer.fixed && layer.rect.h > 0 && layer.rect.y < frontier) {
        frontier = layer.rect.y;
      }
    }
    return frontier;
  }

  private pick(agent: Agent): Layer | null {
    const vp = this.viewport();
    const reach = this.follow ? this.frontier + vp.h * REACH : Infinity;
    let best: Layer | null = null;
    let bestScore = Infinity;
    for (const index of Array.from(this.ready)) {
      const layer = this.layers[index];
      if (!layer.fixed && layer.rect.y > reach) continue;
      const score = this.score(agent, layer, vp);
      if (score < bestScore) {
        bestScore = score;
        best = layer;
      }
    }
    return best;
  }

  private think(agent: Agent, dt: number) {
    agent.boost = agent.task && this.isOffscreen(agent.task) ? OFFSCREEN_BOOST : 1;
    agent.t += dt * agent.boost * agent.pace;

    if (!agent.task) {
      const layer = this.pick(agent);
      if (layer) this.claim(agent, layer);
      else this.idle(agent, dt);
      if (!agent.task) return;
    }

    const layer = agent.task!;
    const r = layer.rect;

    switch (agent.stage) {
      case 'travel': {
        const near = Math.hypot(agent.tx - agent.x, agent.ty - agent.y) < 10;
        const slow = Math.hypot(agent.vx, agent.vy) < 220;
        if ((near && slow) || agent.t > 1.4) {
          if (layer.kind === 'wipe') {
            this.reveal(layer, 'wipe');
            this.setClip(layer, 0);
            this.enter(agent, 'sweep');
            agent.stiffness = 520;
            agent.damping = 1;
          } else {
            agent.box = this.makeBox(agent, layer);
            this.enter(agent, 'drag');
            agent.stiffness = 640;
            agent.damping = 1;
          }
        }
        break;
      }
      case 'drag': {
        // Time scales with size: an icon is a flick, a section is a deliberate drag.
        const duration = clamp(0.14 + Math.hypot(r.w, r.h) / 2400, 0.16, 0.55);
        const p = easeInOut(clamp(agent.t / duration, 0, 1));
        agent.tx = r.x + r.w * p;
        agent.ty = r.y + r.h * p;
        const w = clamp(agent.x - r.x, 0, r.w);
        const h = clamp(agent.y - r.y, 0, r.h);
        this.sizeBox(
          agent.box!,
          r.x,
          r.y,
          agent.t >= duration ? r.w : w,
          agent.t >= duration ? r.h : h
        );
        if (agent.t >= duration + 0.04) {
          this.sizeBox(agent.box!, r.x, r.y, r.w, r.h);
          if (layer.kind === 'media' || layer.kind === 'sequence') {
            this.startDrawing(agent, layer);
          } else if (layer.kind === 'text') {
            this.startTyping(agent, layer);
          } else {
            this.reveal(layer, 'on');
            this.tick('pop', layer);
            this.enter(agent, 'hold');
          }
        }
        break;
      }
      case 'draw': {
        const drawing = agent.drawing!;
        const p = clamp(agent.t / drawing.duration, 0, 1);
        const pen = drawing.step(p);
        if (drawing.placed !== undefined && drawing.placed > agent.placed) {
          agent.placed = drawing.placed;
          this.tick('place', { x: agent.x - 12, y: agent.y - 12, w: 24, h: 24 });
        }
        agent.tx = pen.x;
        agent.ty = pen.y;
        if (p >= 1) {
          this.stash.restoreWithin(layer.el);
          agent.drawing = null;
          this.reveal(layer, 'done');
          this.tick('pop', layer);
          this.enter(agent, 'hold');
        }
        break;
      }
      case 'hold':
        if (agent.t > 0.1) this.finish(agent);
        break;
      case 'sweep': {
        const length = layer.axis === 'x' ? r.w : r.h;
        const duration = clamp(length / 1400, 0.25, 0.8);
        const p = easeOut(clamp(agent.t / duration, 0, 1));
        this.setClip(layer, p);
        agent.tx = layer.axis === 'x' ? r.x + r.w * p : r.x + r.w / 2;
        agent.ty = layer.axis === 'x' ? r.y + r.h / 2 : r.y + r.h * p;
        if (agent.t >= duration) {
          this.tick('pop', layer);
          this.finish(agent);
        }
        break;
      }
      case 'type':
        this.type(agent, layer, dt);
        break;
    }
  }

  /** Work the visitor can't see goes faster. */
  private isOffscreen(layer: Layer) {
    const vp = this.viewport();
    const r = layer.rect;
    // Following, nothing below is ever out of reach of the camera, so only passed work hurries.
    if (this.follow) return r.y + r.h < vp.y - 40;
    return r.y > vp.y + vp.h + 40 || r.y + r.h < vp.y - 40;
  }

  private idle(agent: Agent, dt: number) {
    agent.stage = 'idle';
    agent.tool = 'arrow';
    agent.stiffness = 60;
    agent.damping = 0.85;
    agent.wander -= dt;
    if (agent.wander > 0) return;
    agent.wander = 0.7 + Math.random() * 0.8;
    const vp = this.viewport();
    const home = this.focus ?? this.pointer;
    if (home) {
      // Curious: they hang around the visitor's cursor while there is nothing to draw.
      agent.orbit += 0.9 + Math.random();
      const radius = 50 + Math.random() * 60;
      agent.tx = home.x + Math.cos(agent.orbit) * radius;
      agent.ty = home.y + Math.sin(agent.orbit) * radius;
    } else if (this.follow && this.frontier !== Infinity) {
      // Waiting their turn: they gather just below the part being drawn.
      agent.tx = clamp(agent.x + (Math.random() - 0.5) * 220, vp.x + MARGIN + 10, vp.x + vp.w - 20);
      agent.ty = clamp(
        this.frontier + Math.random() * vp.h * REACH,
        vp.y + MARGIN + 10,
        vp.y + vp.h - 80
      );
    } else {
      agent.tx = clamp(agent.x + (Math.random() - 0.5) * 140, vp.x + MARGIN + 10, vp.x + vp.w - 20);
      agent.ty = clamp(agent.y + (Math.random() - 0.5) * 140, vp.y + MARGIN + 10, vp.y + vp.h - 60);
    }
  }

  private enter(agent: Agent, stage: Stage) {
    agent.stage = stage;
    agent.t = 0;
  }

  private claim(agent: Agent, layer: Layer) {
    layer.status = 'active';
    this.ready.delete(layer.index);
    layer.rect = docRect(layer.el);
    if (layer.rect.w < 1 || layer.rect.h < 1) {
      // It collapsed since the scan; nothing to draw.
      this.complete(layer, false);
      return;
    }
    agent.task = layer;
    agent.revealed = false;
    agent.tool = 'cross';
    agent.stiffness = 230;
    agent.damping = 0.82;
    const r = layer.rect;
    if (layer.kind === 'wipe') {
      agent.tx = layer.axis === 'x' ? r.x : r.x + r.w / 2;
      agent.ty = layer.axis === 'x' ? r.y + r.h / 2 : r.y;
    } else {
      agent.tx = r.x;
      agent.ty = r.y;
    }
    this.enter(agent, 'travel');
  }

  private finish(agent: Agent) {
    const layer = agent.task;
    if (layer) this.complete(layer, true);
    this.release(agent);
    agent.stage = 'idle';
    agent.wander = 0;
  }

  /**
   * Pictures are drawn, never stamped: vector art is traced by the pen, rasters develop under a
   * print head. Both start fully hidden by their own inline styles before the layer turns visible.
   */
  private startDrawing(agent: Agent, layer: Layer) {
    const el = layer.el;
    let drawing: MediaDrawing | null = null;
    let pace = 380;
    if (layer.kind === 'sequence') {
      drawing = placeInSequence(layer.items, 'reading', this.stash);
      pace = 420;
    } else if (el instanceof SVGSVGElement) {
      const cells = Array.from(el.querySelectorAll('rect')).filter(
        (cell) => !cell.closest('defs, pattern, mask, clipPath')
      );
      if (cells.length >= 30) {
        // A calendar or a chart of cells: filled in cell by cell, week by week, with its
        // labels landing as their column arrives.
        const labels = Array.from(el.querySelectorAll('text'));
        drawing = placeInSequence([...cells, ...labels], 'columns', this.stash);
        pace = 300;
      } else {
        drawing = traceVector(el, this.stash);
        pace = 900;
      }
    } else if (el instanceof HTMLElement) {
      drawing = developRaster(el, layer.rect, this.stash);
    }
    if (!drawing) {
      // A dense chart or an empty mark: fade it in like a frame.
      this.reveal(layer, 'on');
      this.tick('pop', layer);
      this.enter(agent, 'hold');
      return;
    }
    agent.drawing = drawing;
    agent.placed = 0;
    agent.tool = 'cross';
    // The pen sits right on the line; the print head and the hand placing items lag a touch.
    agent.stiffness = pace;
    agent.damping = 1;
    this.reveal(layer, 'wipe');
    this.enter(agent, 'draw');
  }

  /** Lets go of the agent's task, done or not, and clears what it was drawing. */
  private release(agent: Agent) {
    if (agent.drawing) {
      if (agent.task) this.stash.restoreWithin(agent.task.el);
      agent.drawing = null;
    }
    if (agent.typing) {
      for (const range of agent.typing.ranges) this.highlight?.delete(range);
      agent.typing = null;
    }
    if (agent.task && agent.task.status === 'active') {
      // Put it back so someone (or skip) finishes it.
      agent.task.status = 'pending';
      this.clearClip(agent.task);
      const parent = agent.task.parent;
      if (parent < 0 || this.layers[parent].status === 'done') this.ready.add(agent.task.index);
    }
    agent.task = null;
    if (agent.box) {
      const box = agent.box.el;
      box.setAttribute('data-out', '');
      window.setTimeout(() => box.remove(), 420);
      agent.box = null;
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Boxes

  private makeBox(agent: Agent, layer: Layer): Box {
    const el = document.createElement('div');
    el.className = styles.box;
    el.dataset.kind = layer.kind;
    el.style.setProperty('--c', agent.color);
    el.innerHTML = `<i class="${styles.handle}"></i><i class="${styles.handle}"></i><i class="${styles.handle}"></i><i class="${styles.handle}"></i>`;
    const size = document.createElement('span');
    size.className = styles.size;
    el.appendChild(size);
    this.opts.overlay.appendChild(el);
    return { el, size, label: '' };
  }

  private sizeBox(box: Box, x: number, y: number, w: number, h: number) {
    box.el.style.transform = `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, 0)`;
    box.el.style.width = `${Math.max(1, w).toFixed(1)}px`;
    box.el.style.height = `${Math.max(1, h).toFixed(1)}px`;
    const label = `${Math.round(w)} × ${Math.round(h)}`;
    if (label !== box.label) {
      box.label = label;
      box.size.textContent = label;
      // A box that has not opened up yet has no size worth reading.
      box.size.style.opacity = w < 2 && h < 2 ? '0' : '';
    }
  }

  // ---------------------------------------------------------------------------------------------
  // Typing

  private startTyping(agent: Agent, layer: Layer) {
    agent.tool = 'beam';
    // Stiff enough that the I-beam sits on the caret instead of trailing it.
    agent.stiffness = 1600;
    agent.damping = 1;
    this.enter(agent, 'type');
    const cps = clamp(layer.chars / 0.75, 45, 900) * agent.pace;
    if (!this.highlight) {
      // No Custom Highlight API: fade the text in while the caret runs along it.
      this.reveal(layer, 'on');
      agent.typing = { node: layer.texts.length, offset: 0, budget: 0, cps, ranges: [] };
      return;
    }
    const ranges = layer.texts.map((text) => {
      const range = new Range();
      if (text.isConnected) range.selectNodeContents(text);
      this.highlight!.add(range);
      return range;
    });
    agent.typing = { node: 0, offset: 0, budget: 0, cps, ranges };
    this.reveal(layer, 'type');
  }

  private type(agent: Agent, layer: Layer, dt: number) {
    const typing = agent.typing!;
    const r = layer.rect;

    if (!typing.ranges.length) {
      const p = clamp(agent.t / 0.45, 0, 1);
      agent.tx = r.x + r.w * easeOut(p);
      agent.ty = r.y + Math.min(r.h, 18) / 2;
      if (p >= 1) this.endTyping(agent);
      return;
    }

    typing.budget += typing.cps * dt * agent.boost;
    let steps = Math.floor(typing.budget);
    typing.budget -= steps;
    const typed = steps > 0;

    while (steps > 0 && typing.node < layer.texts.length) {
      const text = layer.texts[typing.node];
      const length = text.isConnected ? text.data.length : 0;
      const take = Math.min(steps, length - typing.offset);
      typing.offset += Math.max(0, take);
      steps -= Math.max(0, take);
      if (typing.offset >= length) {
        this.highlight!.delete(typing.ranges[typing.node]);
        typing.node += 1;
        typing.offset = 0;
      }
    }

    if (typing.node >= layer.texts.length) {
      this.endTyping(agent);
      return;
    }

    const text = layer.texts[typing.node];
    const range = typing.ranges[typing.node];
    if (typed && text.isConnected) {
      const offset = Math.min(typing.offset, text.data.length);
      range.setStart(text, offset);
      // Re-adding makes every engine repaint the shrunken range.
      this.highlight!.delete(range);
      this.highlight!.add(range);
      this.tick('type', { x: agent.x - 8, y: agent.y - 8, w: 16, h: 16 });

      const caret = new Range();
      caret.setStart(text, Math.max(0, offset - 1));
      caret.setEnd(text, Math.max(1, offset));
      const rects = caret.getClientRects();
      const last = rects[rects.length - 1];
      if (last && last.height) {
        agent.tx = last.right + window.scrollX + 1;
        agent.ty = last.top + window.scrollY + last.height / 2;
      }
    }
  }

  private endTyping(agent: Agent) {
    const typing = agent.typing;
    if (typing) for (const range of typing.ranges) this.highlight?.delete(range);
    agent.typing = null;
    if (agent.task) this.reveal(agent.task, 'done');
    this.enter(agent, 'hold');
  }

  // ---------------------------------------------------------------------------------------------
  // Canvas: scan line, rulers, guides

  private draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const canvas = this.opts.canvas;
    const width = canvas.width / this.dpr;
    const height = canvas.height / this.dpr;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, width, height);
    if (this.phase === 'done') return;
    const sx = window.scrollX;
    const sy = window.scrollY;

    if (this.phase === 'scan') this.drawScan(ctx, width, height, sx, sy);
    else if (this.phase === 'build' && this.phaseTime < 0.5) {
      this.drawGhost(ctx, height, sx, sy, 1 - this.phaseTime / 0.5);
    }
    if (this.rulerAlpha > 0) this.drawRulers(ctx, width, height, sx, sy);
  }

  /** The sweep that finds the layers: each one flashes as the line passes, then stays as a faint
   * wireframe of the page that is about to be drawn. */
  private drawScan(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    sx: number,
    sy: number
  ) {
    const y = this.scanY;
    this.drawGhost(ctx, height, sx, sy, 1, y);
    if (y <= 0 || y >= height + 40) return;
    const band = ctx.createLinearGradient(0, y - 140, 0, y);
    band.addColorStop(0, 'rgba(92, 210, 255, 0)');
    band.addColorStop(1, 'rgba(92, 210, 255, 0.12)');
    ctx.fillStyle = band;
    ctx.fillRect(0, y - 140, width, 140);
    ctx.fillStyle = 'rgba(92, 210, 255, 0.85)';
    ctx.fillRect(0, y - 1, width, 1);
  }

  private drawGhost(
    ctx: CanvasRenderingContext2D,
    height: number,
    sx: number,
    sy: number,
    strength: number,
    scanY = Infinity
  ) {
    ctx.lineWidth = 1;
    for (const layer of this.layers) {
      const top = layer.rect.y - sy;
      const since = scanY - top;
      if (since < 0 || top > height || top + layer.rect.h < 0) continue;
      const flash = since < 220 ? (1 - since / 220) * 0.85 : 0;
      ctx.globalAlpha = Math.max(flash, 0.16) * strength;
      ctx.strokeStyle = PALETTE[layer.index % PALETTE.length];
      ctx.strokeRect(
        Math.round(layer.rect.x - sx) + 0.5,
        Math.round(top) + 0.5,
        Math.round(layer.rect.w),
        Math.round(layer.rect.h)
      );
    }
    ctx.globalAlpha = 1;
  }

  /**
   * The page's own hatched gutters become the instruments, instead of rulers bolted to the
   * screen edges: a matched pair of rulers for the page's height, one in each gutter, their
   * ticks hanging from the inner edge (the column's border) toward the content, their labels
   * reading along the gutter, the left one up and the right one down, so the two mirror each
   * other. Each box being drawn is measured on the gutter nearest to it, with a dimension mark in
   * its agent's colour (a line with a cap at each end, as on a drawing) and a dashed guide out
   * to its nearest edge. The hatching is dimmed under them while they're in use, never removed.
   */
  private drawRulers(
    ctx: CanvasRenderingContext2D,
    _width: number,
    height: number,
    sx: number,
    sy: number
  ) {
    const g = this.gutters;
    if (!g) return;
    const { page: paper, text } = this.colors;
    const alpha = easeOut(this.rulerAlpha);
    // The rails are fixed to the screen, so these are screen positions already.
    const sides = [
      { outer: g.left, inner: g.left + g.width, dir: -1 },
      { outer: g.right + g.width, inner: g.right, dir: 1 }
    ];
    const middle = (g.left + g.width + g.right) / 2;

    // Quiet the hatching so the marks read, without hiding it.
    ctx.globalAlpha = alpha * 0.6;
    ctx.fillStyle = paper;
    ctx.fillRect(g.left, 0, g.width, height);
    ctx.fillRect(g.right, 0, g.width, height);

    // The scales.
    ctx.fillStyle = text;
    ctx.globalAlpha = alpha;
    ctx.font = '9px ui-monospace, SFMono-Regular, Menlo, monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'center';
    for (const side of sides) {
      for (let y = Math.floor(sy / 10) * 10; y < sy + height; y += 10) {
        const py = Math.round(y - sy);
        const major = y % 100 === 0;
        const tick = major ? Math.round(g.width * 0.45) : y % 50 === 0 ? 6 : 3;
        ctx.fillRect(side.dir < 0 ? side.inner - tick : side.inner, py, tick, 1);
        if (!major || y <= 0) continue;
        // Read along the gutter on a chip of page colour, so the hatching can't cut it.
        const label = String(y);
        const length = ctx.measureText(label).width + 6;
        ctx.save();
        ctx.translate(side.outer - side.dir * g.width * 0.3, py - length / 2 - 3);
        ctx.rotate((side.dir * Math.PI) / 2);
        ctx.fillStyle = paper;
        ctx.fillRect(-length / 2, -6, length, 12);
        ctx.fillStyle = text;
        ctx.fillText(label, 0, 0.5);
        ctx.restore();
      }
    }

    // Each box being drawn, measured on its nearer gutter.
    ctx.lineWidth = 1;
    for (const agent of this.agents) {
      if (!agent.box || !agent.task) continue;
      const r = agent.task.rect;
      const top = Math.round(r.y - sy);
      const bottom = Math.round(r.y + r.h - sy);
      if (bottom < 0 || top > height) continue;
      const box = { left: r.x - sx, right: r.x + r.w - sx };
      const side = (box.left + box.right) / 2 < middle ? sides[0] : sides[1];
      // Inside the gutter, 6px out from its inner edge, capped at both ends.
      const line = side.inner + side.dir * 6;
      ctx.fillStyle = agent.color;
      ctx.globalAlpha = alpha;
      ctx.fillRect(line, top, 1, Math.max(1, bottom - top));
      ctx.fillRect(line - 3, top, 7, 1);
      ctx.fillRect(line - 3, bottom - 1, 7, 1);
      // The guide, from the ruler to the box's nearer edge.
      const edge = Math.round(side.dir < 0 ? box.left : box.right) + 0.5;
      ctx.strokeStyle = agent.color;
      ctx.globalAlpha = alpha * 0.4;
      ctx.setLineDash([3, 3]);
      ctx.beginPath();
      ctx.moveTo(side.inner, top + 0.5);
      ctx.lineTo(edge, top + 0.5);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.globalAlpha = 1;
  }

  /** The page's gutters, in screen coordinates (they're fixed); none when too narrow for a scale. */
  private measureGutters() {
    const rails = this.rails;
    if (!rails) {
      this.gutters = null;
      return;
    }
    const rect = rails.getBoundingClientRect();
    const width = parseFloat(getComputedStyle(rails, '::before').width) || 0;
    const left = rect.left - width;
    // On a narrow screen the rails run to the edges and the gutters fall off it: no rulers then.
    const fits = width >= 14 && left >= 0 && rect.right + width <= window.innerWidth;
    this.gutters = fits ? { left, right: rect.right, width } : null;
  }
}
