'use client';

// A client component: in the App Router (v0, `npx shadcn add`) it runs in the browser. The Pages Router ignores this.
import * as React from 'react';
import { useTheme } from 'next-themes';
import { HashIcon, InfoIcon, MaximizeIcon, MinimizeIcon, MinusIcon, PauseIcon, PlayIcon, PlusIcon, RotateCcwIcon } from 'lucide-react';
import { Bench, prepare, type BenchHandle } from './bench';
import { PUBLISHED, SOURCE, SUMMARY } from './facts';
import type { Lamp, Tray } from './fleet';
import { ISO_CSS } from './iso-kit';
import { Plate, follow, useInView, useLoop } from './iso-react';
import { listedParts } from './parts';
import { loadAt, scenarioOf, type Scenario, type ScenarioKey } from './scenarios';
import { DESIGNS, STANDBY_PROMOTION, STATUS_TEXT, settled, step, type Knobs, type SideKey, type SimState } from './sim';
import { AZIMUTH, AZIMUTH_MAX, AZIMUTH_MIN, HEIGHT, ROLES, WIDTH, WORLD, projectionAt, type Kind } from './world';
import { useFullscreen } from './use-fullscreen';
import styles from './chatgpt-postgres.module.css';

const SIDES: SideKey[] = ['before', 'after'];
const TABS: Record<SideKey, { name: string; sub: string; title: string }> = {
  before: { name: 'Initial design', sub: 'Reconstructed from the post', title: 'Initial design · reconstructed' },
  after: { name: 'Today', sub: 'As published, January 2026', title: 'Today' }
};
const LABELS: Record<SideKey, string> = {
  before:
    'The initial design, reconstructed from the post: apps connect straight to one PostgreSQL primary that takes every write and many reads, a few read replicas (three drawn), and a plain cache. Dashed outlines mark what it lacks.',
  after:
    'Today’s design: apps behind a rate-limit gate, a cache with leases, PgBouncer deployments behind a Kubernetes Service, one primary with a hot standby that only takes writes, Azure Cosmos DB for shardable writes, and high- and low-priority read replicas across regions (six drawn of nearly 50).'
};

/** What each role does, in each design, after the post. */
const ROLE_TEXT: Record<Kind, Record<SideKey, string>> = {
  apps: {
    before: 'ChatGPT and the API. Every query opens its own connection straight to the database.',
    after: 'ChatGPT and the API. Bugs that wrote twice are fixed, lazy writes smooth spikes, clients back off before retrying, and connections go through PgBouncer.'
  },
  gate: {
    before: 'Missing: nothing limits traffic, so a spike or a retry storm reaches the database whole.',
    after: 'Rate limits at four layers: application (this gate), connection pooler, proxy and query. Above a ceiling it sheds traffic, so a sudden spike cannot overwhelm the database.'
  },
  cache: {
    before: 'Serves most reads. When it fails, every miss goes straight to PostgreSQL.',
    after: 'Serves most reads. Cache locking and leasing: one request per missed key fetches from PostgreSQL; the rest wait for the refill.'
  },
  bouncer: {
    before: 'Missing: apps hold their own connections, up to the 5,000 an instance allows.',
    after: 'Each read replica has its own Kubernetes deployment of PgBouncer pods, all behind one Kubernetes Service, co-located with clients and replicas. Average connection time fell from 50 ms to 5 ms in OpenAI’s benchmarks.'
  },
  primary: {
    before: 'One Azure PostgreSQL flexible server: every write, many reads, every workload, every table. Scaled up by making the instance bigger. MVCC copies a whole row on every update, so write storms leave dead tuples and bloat behind.',
    after: 'Still one unsharded writer. It takes the writes and only the reads that are part of write transactions. The ORM can rate-limit or block an expensive query’s digest, and schema changes are lightweight only, with a 5-second timeout.'
  },
  standby: {
    before: 'Missing: if the single writer goes down, the whole service goes with it.',
    after: 'A hot standby, continuously synchronised, promoted quickly when the primary fails. Reads carry on from the replicas meanwhile.'
  },
  cosmos: {
    before: 'Missing: write-heavy workloads and new tables all land on the primary.',
    after: 'Azure Cosmos DB takes shardable, write-heavy workloads, and every new table: PostgreSQL accepts no new ones. Write-heavy workloads that are harder to shard are still being moved.'
  },
  replica: {
    before: 'Read replicas, each fed the write-ahead log by the primary; three are drawn. The design scaled out by adding more.',
    after: 'Nearly 50 across regions, several per region with headroom, split into high- and low-priority instances; products and services are kept apart the same way. Six are drawn. WAL from the primary, or through a relay with cascading replication (in testing).'
  },
  depot: {
    before: 'Each tray carries one query slip from the apps through the machines and back; one tray stands for many queries. Hover a tray to read its slip.',
    after: 'Each tray carries one query slip from the apps through the machines and back; one tray stands for many queries. Hover a tray to read its slip.'
  }
};

/** Three states, kept on until another is picked. Each changes the floor in a way you can see. */
const CHOICES: { key: ScenarioKey; label: string; hotkey: string }[] = [
  { key: 'normal', label: 'Normal traffic', hotkey: '1' },
  { key: 'cache', label: 'Cache misses spike', hotkey: '2' },
  { key: 'primary', label: 'Primary database goes down', hotkey: '3' }
];

const DRAG_RATE = 0.2;
const CLICK_SLOP = 4;
const TURN_EASE = 0.14;
const VIEW_EASE = 0.16;
/** How fast a machine comes apart and goes back together. */
const APART_EASE = 0.2;
const SCALE_STEP = 1.4;
const SCALE_MOST = 4;
const FOCUS_SCALE = 2.2;

const LAMP_TEXT: Record<Lamp, string> = {
  run: 'on its way',
  wait: 'waiting',
  lease: 'holds the cache lease',
  fail: 'failed',
  shed: 'shed by a rate limit',
  retry: 'a retry',
  charge: 'charging',
  idle: 'empty'
};

const ms = (value: number) => (value >= 1000 ? `${(value / 1000).toFixed(1)} s` : `${Math.round(value)} ms`);
const pct = (value: number) => (value < 0.001 ? '0%' : value < 0.1 ? `${(value * 100).toFixed(1)}%` : `${Math.round(value * 100)}%`);

/** A floor's view: where it is turned, zoomed and panned to, and where it is heading. */
type Camera = {
  azimuth: number;
  target: number;
  /** The whole degree the floor was last drawn at. */
  drawn: number;
  scale: number;
  scaleTarget: number;
  panX: number;
  panY: number;
  panXTarget: number;
  panYTarget: number;
  shown: string;
  /** How far the open machine is taken apart (0..1), where it is heading, and what was last drawn. */
  apart: number;
  apartTarget: number;
  apartShown: number;
};

const newCamera = (): Camera => ({ azimuth: AZIMUTH, target: AZIMUTH, drawn: NaN, scale: 1, scaleTarget: 1, panX: 0, panY: 0, panXTarget: 0, panYTarget: 0, shown: '', apart: 0, apartTarget: 0, apartShown: 0 });

type Hud = Partial<Record<'banner' | 'lead' | 'text', HTMLElement | null>>;

/** The post's own numbers, along the top. */
const HEADLINE = [
  { value: '800M', label: 'users' },
  { value: '1', label: 'primary' },
  { value: '~50', label: 'read replicas' },
  { value: 'Millions', label: 'of queries/s' },
  { value: 'Low double-digit ms', label: 'p99' },
  { value: '99.999%', label: 'available' },
  { value: '1', label: 'SEV-0 in 12 months' }
];

type Banner = { lead: string; text: string; tone: 'calm' | 'warn' | 'bad' | 'good' };

/** What is happening on a floor, in plain words, and how worried to be. */
function bannerOf(side: SideKey, scenario: Scenario, sim: SimState, t: number): Banner {
  const failing = `${pct(sim.errors)} of requests fail`;
  if (scenario.key === 'cache') {
    if (side === 'before') {
      return sim.status === 'sev0' || sim.status === 'sev'
        ? { lead: 'Primary overloaded', text: `Every miss lands on the primary and saturates its CPU: ${failing}, and retries add load.`, tone: 'bad' }
        : { lead: 'Cache misses', text: 'The cache misses almost every read, and each miss goes straight to the primary…', tone: 'warn' };
    }
    return { lead: 'Cache misses, handled', text: 'One request per missed key takes a lease and refills it; the rest wait. Far fewer reads reach the database.', tone: 'good' };
  }
  if (scenario.key === 'primary') {
    if (side === 'before') return { lead: 'Full outage', text: `The primary is down and everything needs it, reads included: ${failing}. Trays wait, give up and retry.`, tone: 'bad' };
    if (sim.promoting > 0) return { lead: `Failing over · ${Math.max(0, STANDBY_PROMOTION - t).toFixed(1)} s`, text: 'The primary is down. Reads carry on from the replicas; writes fail until the hot standby is promoted.', tone: 'warn' };
    return { lead: 'Recovered', text: 'The hot standby is the primary now and takes the writes; reads never stopped. Not a SEV0.', tone: 'good' };
  }
  return side === 'before'
    ? { lead: 'Normal traffic', text: 'Every query opens its own connection to the one primary, which takes all writes and many reads.', tone: 'calm' }
    : { lead: 'Normal traffic', text: 'The cache answers most reads, the rest go to replicas through PgBouncer, and the primary takes only writes.', tone: 'calm' };
}

const missing = (side: SideKey, kind: Kind) => WORLD[side].filter((m) => m.kind === kind).every((m) => m.ghost);

/**
 * How OpenAI scaled PostgreSQL for ChatGPT, after the post on its engineering blog: the initial
 * design and today's, one tab each, on one clock. Robot trays carry the queries; pick an incident
 * from the post and watch how each design takes it.
 */
export default function ChatgptPostgres() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const theme = mounted && resolvedTheme === 'dark' ? 'dark' : 'light';

  const root = React.useRef<HTMLElement>(null);
  const frameRef = React.useRef<HTMLDivElement>(null);
  const benches = React.useRef<Record<SideKey, BenchHandle | null>>({ before: null, after: null });
  const hud = React.useRef<Hud>({});
  const tabStatus = React.useRef<Record<SideKey, HTMLSpanElement | null>>({ before: null, after: null });
  const announce = React.useRef<HTMLSpanElement>(null);
  const tip = React.useRef<HTMLDivElement>(null);
  const inView = useInView(root);
  const stage = React.useRef<HTMLDivElement>(null);
  const { expanded, toggle: toggleFullscreen, mode } = useFullscreen(stage);

  const [tab, setTab] = React.useState<SideKey>('after');
  const [scenario, setScenario] = React.useState<ScenarioKey>('normal');
  const [paused, setPaused] = React.useState(false);
  const [selected, setSelected] = React.useState<Kind | null>(null);
  const [sources, setSources] = React.useState(false);
  const [pins, setPins] = React.useState(true);
  const [scale, setScale] = React.useState(1);

  const knobs = React.useRef<Knobs>({ replicas: PUBLISHED.replicaCount, cascading: false });

  const live = React.useRef({
    scenario: scenarioOf('normal'),
    t: 0,
    announced: true,
    sims: {
      before: settled(DESIGNS.before, knobs.current, loadAt(scenarioOf('normal'), 0)),
      after: settled(DESIGNS.after, knobs.current, loadAt(scenarioOf('normal'), 0))
    } as Record<SideKey, SimState>,
    worst: { before: 'ok', after: 'ok' } as Record<SideKey, SimState['status']>,
    hudIn: 0,
    // Each floor keeps its own camera: turning or zooming one leaves the other where it was.
    cameras: { before: newCamera(), after: newCamera() } as Record<SideKey, Camera>,
    get camera(): Camera {
      return this.cameras[this.tab];
    },
    paused: false,
    tab: 'after' as SideKey,
    /** The role whose machine is taken apart; it stays set while the machine goes back together. */
    apartKind: null as Kind | null,
    hovering: false
  });
  live.current.paused = paused;
  live.current.tab = tab;

  // ── Incidents ────────────────────────────────────────────────────────────

  const play = React.useCallback((key: ScenarioKey) => {
    const state = live.current;
    state.scenario = scenarioOf(key);
    state.t = 0;
    state.announced = false;
    state.worst = { before: 'ok', after: 'ok' };
    setScenario(key);
    if (announce.current) announce.current.textContent = `${scenarioOf(key).label}: running on both designs.`;
  }, []);

  // ── View: zoom, pan and turn ─────────────────────────────────────────────

  const clampPan = () => {
    const camera = live.current.camera;
    const maxX = (WIDTH - WIDTH / camera.scaleTarget) / 2;
    const maxY = (HEIGHT - HEIGHT / camera.scaleTarget) / 2;
    camera.panXTarget = Math.min(maxX, Math.max(-maxX, camera.panXTarget));
    camera.panYTarget = Math.min(maxY, Math.max(-maxY, camera.panYTarget));
  };

  const zoomTo = (next: number, at?: [number, number]) => {
    const camera = live.current.camera;
    const was = camera.scaleTarget;
    camera.scaleTarget = Math.min(SCALE_MOST, Math.max(1, next));
    // Keep the point under the pointer where it is.
    if (at) {
      const [x, y] = at;
      const cx = WIDTH / 2 + camera.panXTarget;
      const cy = HEIGHT / 2 + camera.panYTarget;
      const ratio = was / camera.scaleTarget;
      camera.panXTarget = x - (x - cx) * ratio - WIDTH / 2;
      camera.panYTarget = y - (y - cy) * ratio - HEIGHT / 2;
    }
    if (camera.scaleTarget === 1) {
      camera.panXTarget = 0;
      camera.panYTarget = 0;
    }
    clampPan();
    setScale(camera.scaleTarget);
    kick();
  };

  const resetView = () => {
    const camera = live.current.camera;
    camera.target = AZIMUTH;
    camera.scaleTarget = 1;
    camera.panXTarget = 0;
    camera.panYTarget = 0;
    camera.apartTarget = 0;
    setScale(1);
    setSelected(null);
    kick();
  };

  /** An open card belongs to the floor it was opened on: close it, and that view with it. */
  const switchTab = (next: SideKey | ((value: SideKey) => SideKey)) => {
    if (selected) {
      resetView();
      // Only the visible floor animates, so the one being left goes back together at once.
      const camera = live.current.camera;
      camera.apart = camera.apartShown = 0;
      benches.current[live.current.tab]?.apart(null, 0);
    }
    setTab(next);
  };

  /** Zoom to a role's machine and open its card. */
  const focusRole = (kind: Kind | null) => {
    setSelected(kind);
    if (!kind) return;
    const at = benches.current[live.current.tab]?.anchorOf(kind);
    if (!at) return;
    const camera = live.current.camera;
    // Take it apart; another machine that was apart goes back together at once.
    if (live.current.apartKind !== kind) {
      if (camera.apart > 0) benches.current[live.current.tab]?.apart(null, 0);
      camera.apart = camera.apartShown = 0;
      live.current.apartKind = kind;
    }
    camera.apartTarget = 1;
    camera.scaleTarget = Math.max(camera.scaleTarget, FOCUS_SCALE);
    camera.panXTarget = at[0] - WIDTH / 2;
    camera.panYTarget = at[1] + 30 - HEIGHT / 2;
    clampPan();
    setScale(camera.scaleTarget);
    kick();
  };

  // ── The loop ────────────────────────────────────────────────────────────

  // The floor is drawn at whole degrees, so a turn revisits drawings the bench has cached.
  const drawCamera = (azimuth: number) => {
    const at = Math.round(azimuth);
    benches.current[live.current.tab]?.draw(projectionAt(at));
    live.current.camera.drawn = at;
  };

  const writeHud = () => {
    const state = live.current;
    const text = (el: Element | null | undefined, value: string) => {
      if (el && el.textContent !== value) el.textContent = value;
    };
    for (const side of SIDES) {
      const sim = state.sims[side];
      const label = !sim.primaryUp && side === 'after' && sim.promoting > 0 ? 'Failing over' : STATUS_TEXT[sim.status];
      const node = tabStatus.current[side];
      if (node) {
        node.setAttribute('data-status', sim.status);
        text(node, label);
      }
      if (side !== state.tab) continue;
      const h = hud.current;
      const banner = bannerOf(side, state.scenario, sim, state.t);
      h.banner?.setAttribute('data-tone', banner.tone);
      text(h.lead, banner.lead);
      text(h.text, banner.text);
      // Every number on one line, in the figure's readout corner.
      const load = sim.primaryUp ? `${state.scenario.key === 'primary' ? 'standby' : 'primary'} ${pct(sim.cpu)}` : 'primary down';
      const readout = frameRef.current?.closest('.iso-plate')?.querySelector('[data-readout]');
      text(readout, `${label} · p99 ${ms(sim.p99)} · ${pct(sim.errors)} failed · ${load} · ${Math.round(sim.connections).toLocaleString('en-US')}/5,000 conns`);
    }
  };

  const RANK = { ok: 0, degraded: 1, sev: 2, sev0: 3 } as const;

  const tick = (dt: number, calm: boolean) => {
    const state = live.current;
    const camera = state.camera;
    camera.azimuth = follow(camera.azimuth, camera.target, dt, TURN_EASE, calm);
    camera.scale = follow(camera.scale, camera.scaleTarget, dt, VIEW_EASE, calm);
    camera.panX = follow(camera.panX, camera.panXTarget, dt, VIEW_EASE, calm);
    camera.panY = follow(camera.panY, camera.panYTarget, dt, VIEW_EASE, calm);
    if (Math.round(camera.azimuth) !== camera.drawn) drawCamera(camera.azimuth);
    const w = WIDTH / camera.scale;
    const h = HEIGHT / camera.scale;
    const box: [number, number, number, number] = [WIDTH / 2 + camera.panX - w / 2, HEIGHT / 2 + camera.panY - h / 2, w, h];
    const key = box.map((v) => v.toFixed(2)).join();
    if (key !== camera.shown) {
      camera.shown = key;
      benches.current[state.tab]?.view(box, camera.scale);
    }
    camera.apart = follow(camera.apart, camera.apartTarget, dt, APART_EASE, calm);
    if (camera.apart !== camera.apartShown) {
      camera.apartShown = camera.apart;
      benches.current[state.tab]?.apart(state.apartKind, camera.apart);
    }
    const moving =
      Math.abs(camera.azimuth - camera.target) > 0.04 ||
      Math.abs(camera.scale - camera.scaleTarget) > 1e-3 ||
      Math.abs(camera.panX - camera.panXTarget) > 0.05 ||
      Math.abs(camera.panY - camera.panYTarget) > 0.05 ||
      camera.apart !== camera.apartTarget;
    if (state.paused) return moving;

    state.t += dt;
    const scenario = state.scenario;
    // A state stays on: once it has eased in, it holds until another is picked.
    const load = loadAt(scenario, Math.min(state.t, scenario.ramp + 0.5));
    for (const side of SIDES) {
      const design = DESIGNS[side];
      const sim = step(state.sims[side], design, load, knobs.current, dt);
      if (RANK[sim.status] > RANK[state.worst[side]]) state.worst[side] = sim.status;
      const bench = benches.current[side];
      if (!bench) continue;
      bench.fleet().downReplica = load.replicaDown > 0.5 ? (side === 'before' ? 'replica-1' : 'replica-3') : null;
      bench.frame(calm ? 0 : dt, { sim, load, design, cascading: knobs.current.cascading });
    }

    state.hudIn -= dt;
    if (state.hudIn <= 0) {
      state.hudIn = 0.1;
      writeHud();
    }

    // A few seconds in, say how each design is taking it.
    if (!state.announced && state.t > 6) {
      state.announced = true;
      if (announce.current) announce.current.textContent = `${CHOICES.find((c) => c.key === scenario.key)?.label}. Initial design: ${STATUS_TEXT[state.worst.before]}. Today: ${STATUS_TEXT[state.worst.after]}.`;
    }
    return true;
  };

  const kick = useLoop(tick, inView && mounted);
  React.useEffect(() => {
    if (mounted) kick();
  }, [paused, mounted, kick]);

  // Switching tabs: draw the new floor for the current camera and view, and let it paint.
  React.useEffect(() => {
    if (!mounted) return;
    for (const side of SIDES) benches.current[side]?.setActive(side === tab);
    const camera = live.current.camera;
    drawCamera(camera.azimuth);
    camera.shown = '';
    setScale(camera.scaleTarget);
    writeHud();
    kick();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mounted, tab]);

  // Build the visible floor's other angles while the page is idle, nearest first, so turning only
  // swaps in drawings that are already made.
  React.useEffect(() => {
    if (!mounted) return;
    const from = Math.round(live.current.camera.azimuth);
    const angles: number[] = [];
    for (let d = 1; d <= AZIMUTH_MAX - AZIMUTH_MIN; d++) for (const a of [from + d, from - d]) if (a >= AZIMUTH_MIN && a <= AZIMUTH_MAX) angles.push(a);
    const idle = window.requestIdleCallback ?? ((run: IdleRequestCallback) => window.setTimeout(() => run({ didTimeout: false, timeRemaining: () => 8 }), 60));
    const cancel = window.cancelIdleCallback ?? window.clearTimeout;
    let handle = 0;
    const work: IdleRequestCallback = (deadline) => {
      // At least one angle per call: between animation frames the idle slots are short.
      do prepare(tab, angles.shift()!);
      while (angles.length && deadline.timeRemaining() > 6);
      if (angles.length) handle = idle(work);
    };
    handle = idle(work);
    return () => cancel(handle);
  }, [mounted, tab]);

  React.useEffect(() => {
    benches.current[tab]?.focus(selected);
  }, [selected, tab, mounted]);


  // ⌘ or Ctrl and the wheel zoom about the pointer; a plain wheel scrolls the page.
  React.useEffect(() => {
    const node = frameRef.current;
    if (!node) return;
    const onWheel = (event: WheelEvent) => {
      if (!event.ctrlKey && !event.metaKey) return;
      event.preventDefault();
      const svg = benches.current[live.current.tab]?.svg();
      const matrix = svg?.getScreenCTM();
      const at = matrix ? new DOMPoint(event.clientX, event.clientY).matrixTransform(matrix.inverse()) : null;
      zoomTo(live.current.camera.scaleTarget * Math.exp(-event.deltaY * 0.004), at ? [at.x, at.y] : undefined);
    };
    node.addEventListener('wheel', onWheel, { passive: false });
    return () => node.removeEventListener('wheel', onWheel);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Pointer: drag to turn (or pan when zoomed), click a machine, hover a tray ─

  const drag = React.useRef<{ id: number; x: number; y: number; azimuth: number; panX: number; panY: number; pan: boolean; moved: boolean } | null>(null);

  const onPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (event.button !== 0) return;
    const camera = live.current.camera;
    drag.current = { id: event.pointerId, x: event.clientX, y: event.clientY, azimuth: camera.target, panX: camera.panXTarget, panY: camera.panYTarget, pan: camera.scaleTarget > 1, moved: false };
  };
  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    live.current.hovering = true;
    if (held && held.id === event.pointerId) {
      const dx = event.clientX - held.x;
      const dy = event.clientY - held.y;
      if (!held.moved && Math.hypot(dx, held.pan ? dy : 0) > CLICK_SLOP) {
        held.moved = true;
        event.currentTarget.setPointerCapture(event.pointerId);
      }
      if (held.moved) {
        const camera = live.current.camera;
        if (held.pan) {
          const width = benches.current[live.current.tab]?.svg()?.getBoundingClientRect().width || WIDTH;
          const units = WIDTH / camera.scaleTarget / width;
          camera.panXTarget = held.panX - dx * units;
          camera.panYTarget = held.panY - dy * units;
          clampPan();
        } else camera.target = Math.min(AZIMUTH_MAX, Math.max(AZIMUTH_MIN, held.azimuth + dx * DRAG_RATE));
        kick();
      }
      return;
    }
    const bench = benches.current[live.current.tab];
    showTip(bench?.trayAt(event.clientX, event.clientY) ?? null, event);
  };
  const onPointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const held = drag.current;
    drag.current = null;
    if (!held || held.id !== event.pointerId) return;
    if (held.moved) {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId);
      return;
    }
    const bench = benches.current[live.current.tab];
    const kind = bench?.pinAt(event.clientX, event.clientY) ?? bench?.machineAt(event.clientX, event.clientY)?.kind ?? null;
    if (!kind || kind === selected) return resetView();
    focusRole(kind);
  };
  const onPointerLeave = () => {
    live.current.hovering = false;
    showTip(null);
  };

  const showTip = (tray: Tray | null, event?: React.PointerEvent) => {
    const node = tip.current;
    const frame = frameRef.current;
    if (!node) return;
    if (!tray || !tray.job || !event || !frame) {
      node.setAttribute('data-hidden', '');
      return;
    }
    const box = frame.getBoundingClientRect();
    node.removeAttribute('data-hidden');
    const x = Math.min(event.clientX - box.left + 14, box.width - 250);
    node.style.transform = `translate(${Math.round(x)}px, ${Math.round(event.clientY - box.top + 14)}px)`;
    const job = tray.job;
    const route = job.stops
      .slice(1)
      .map((stop) => stop.id.replace(/-\d+$/, ''))
      .join(' → ');
    node.innerHTML = `<code>${job.sql.replace(/</g, '&lt;')}</code><span>${job.kind === 'join' ? '12-table join' : job.kind} · ${job.tier} priority${job.retry ? ' · retry' : ''}</span><span>${route || 'cache'} · ${LAMP_TEXT[tray.lamp]}</span>`;
  };

  // ── Keyboard ─────────────────────────────────────────────────────────────

  const onKeyDown = (event: React.KeyboardEvent<HTMLElement>) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement) return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    if ((event.target as HTMLElement).getAttribute?.('role') === 'tab' && (event.key === 'ArrowLeft' || event.key === 'ArrowRight')) return;
    const turn = event.shiftKey ? 18 : 6;
    const found = CHOICES.find((choice) => choice.hotkey === event.key);
    const camera = live.current.camera;
    if (found) play(found.key);
    else if (event.key === ' ') setPaused((value) => !value);
    else if (event.key === 'ArrowLeft') camera.target = Math.max(AZIMUTH_MIN, camera.target - turn);
    else if (event.key === 'ArrowRight') camera.target = Math.min(AZIMUTH_MAX, camera.target + turn);
    else if (event.key === '+' || event.key === '=') zoomTo(camera.scaleTarget * SCALE_STEP);
    else if (event.key === '-' || event.key === '_') zoomTo(camera.scaleTarget / SCALE_STEP);
    else if (event.key === 'Home') resetView();
    else if (event.key === 't' || event.key === 'T') switchTab((value) => (value === 'before' ? 'after' : 'before'));
    else if (event.key === 'l' || event.key === 'L') setPins((value) => !value);
    else if (event.key === 'f' || event.key === 'F') void toggleFullscreen();
    else if (event.key === 'Escape' && selected) resetView();
    else if (event.key === 'Escape' && sources) setSources(false);
    else if (event.key === 'Escape' && camera.scaleTarget > 1) resetView();
    else return;
    kick();
    event.preventDefault();
  };

  const onTabKey = (event: React.KeyboardEvent<HTMLButtonElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const next = tab === 'before' ? 'after' : 'before';
    switchTab(next);
    root.current?.querySelector<HTMLButtonElement>(`#cp-tab-${next}`)?.focus();
  };

  const role = selected ? ROLES.find((r) => r.kind === selected) : null;
  const absent = role ? missing(tab, role.kind) : false;
  const stop = (event: React.PointerEvent) => event.stopPropagation();

  return (
    <section
      ref={root}
      className={`iso ${styles.root}`}
      data-theme={theme}
      data-pins={pins ? '' : undefined}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      aria-label="How ChatGPT’s PostgreSQL scaled: the initial design and today"
    >
      <style dangerouslySetInnerHTML={{ __html: ISO_CSS }} />
      <header className={styles.header}>
        <div className={styles.title}>
          <h2 className={styles.heading}>ChatGPT Postgres</h2>
          <ul className={styles.headline} aria-label="From the post">
            {HEADLINE.map((item) => (
              <li key={item.label}>
                <strong>{item.value}</strong> {item.label}
              </li>
            ))}
          </ul>
        </div>
        <div className={styles.actions}>
          <button type="button" className={styles.iconButton} onClick={() => setPaused((v) => !v)} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play (Space)' : 'Pause (Space)'}>
            {paused ? <PlayIcon aria-hidden="true" /> : <PauseIcon aria-hidden="true" />}
          </button>
          <button type="button" className={styles.iconButton} onClick={() => setSources((v) => !v)} aria-expanded={sources} aria-label="Sources" title="What the post says">
            <InfoIcon aria-hidden="true" />
          </button>
        </div>
      </header>

      {sources ? (
        <aside className={styles.sources} aria-label="Sources">
          <div className={styles.sourcesHead}>
            <strong>In short</strong>
          </div>
          <div className={styles.summary}>
            <section>
              <span className={styles.muted}>The problem</span>
              <p>{SUMMARY.problem}</p>
            </section>
            <section>
              <span className={styles.muted}>How they fixed it</span>
              <ul>
                {SUMMARY.fixes.map((fix) => (
                  <li key={fix}>{fix}</li>
                ))}
              </ul>
            </section>
          </div>
          <p className={styles.result}>
            <span className={styles.muted}>Result</span> {SUMMARY.result}
          </p>
        </aside>
      ) : null}

      <div ref={stage} className={styles.stage} data-expanded={expanded ? mode : undefined} tabIndex={-1}>
        <div className={styles.toolbar}>
          <div className={styles.tabs} role="tablist" aria-label="Design">
            {SIDES.map((side) => (
              <button
                key={side}
                id={`cp-tab-${side}`}
                type="button"
                role="tab"
                className={styles.tab}
                aria-selected={tab === side}
                aria-controls="cp-panel"
                tabIndex={tab === side ? 0 : -1}
                onClick={() => switchTab(side)}
                onKeyDown={onTabKey}
              >
                <span className={styles.tabName} title={TABS[side].sub}>
                  {TABS[side].name}
                </span>
                <span className={styles.tabStatus} ref={(node) => void (tabStatus.current[side] = node)} data-status="ok">
                  Healthy
                </span>
              </button>
            ))}
          </div>

          <div className={styles.choices} role="radiogroup" aria-label="What happens to the database">
            {CHOICES.map((choice) => (
              <button key={choice.key} type="button" role="radio" className={styles.choice} aria-checked={scenario === choice.key} onClick={() => play(choice.key)}>
                <span className={styles.hotkey}>{choice.hotkey}</span>
                {choice.label}
              </button>
            ))}
          </div>
        </div>

        <div id="cp-panel" role="tabpanel" aria-labelledby={`cp-tab-${tab}`} className={styles.panel}>
          <Plate fig="Fig 1" title={TABS[tab].title} hint={scale > 1 ? 'Drag to pan · tap a number' : 'Drag to turn · tap a number'} readout="">
            <div
              ref={frameRef}
              className={styles.stageFrame}
              data-panning={scale > 1 ? '' : undefined}
              role="group"
              tabIndex={0}
              aria-label="The floor. 1, 2 and 3 pick normal traffic, a spike of cache misses or the primary going down; T switches design; Space pauses; left and right arrows turn; plus and minus zoom; Home resets the view; L shows or hides the numbers; F goes full screen; Escape closes a card or zooms back out."
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={() => (drag.current = null)}
              onPointerLeave={onPointerLeave}
            >
              {SIDES.map((side) => (
                <div key={side} className={styles.floor} hidden={tab !== side}>
                  <Bench ref={(node) => void (benches.current[side] = node)} side={side} label={LABELS[side]} />
                </div>
              ))}
              <div className={styles.view} role="group" aria-label="View" onPointerDown={stop} onPointerUp={stop}>
                <button type="button" className={styles.viewButton} onClick={() => zoomTo(live.current.camera.scaleTarget * SCALE_STEP)} disabled={scale >= SCALE_MOST} aria-label="Zoom in" title="Zoom in (+)">
                  <PlusIcon aria-hidden="true" />
                </button>
                <button type="button" className={styles.viewButton} onClick={() => zoomTo(live.current.camera.scaleTarget / SCALE_STEP)} disabled={scale <= 1} aria-label="Zoom out" title="Zoom out (−)">
                  <MinusIcon aria-hidden="true" />
                </button>
                <button type="button" className={styles.viewButton} onClick={resetView} aria-label="Reset view" title="Reset view (Home)">
                  <RotateCcwIcon aria-hidden="true" />
                </button>
                <button type="button" className={styles.viewButton} onClick={() => setPins((v) => !v)} aria-pressed={pins} aria-label="Numbers" title="Numbers (L)">
                  <HashIcon aria-hidden="true" />
                </button>
                <button type="button" className={styles.viewButton} onClick={() => void toggleFullscreen()} aria-label={expanded ? 'Exit full screen' : 'Full screen'} title={expanded ? 'Exit full screen (F)' : 'Full screen (F)'}>
                  {expanded ? <MinimizeIcon aria-hidden="true" /> : <MaximizeIcon aria-hidden="true" />}
                </button>
              </div>
              {role ? (
                <div className={styles.card} role="note" onPointerDown={stop} onPointerUp={stop}>
                  <div className={styles.cardHead}>
                    <span className={styles.number} data-missing={absent ? '' : undefined}>
                      {role.n}
                    </span>
                    <strong>{role.name}</strong>
                    {absent ? <span className={styles.missingTag}>Not in this design</span> : null}
                  </div>
                  <p>{ROLE_TEXT[role.kind][tab]}</p>
                  {!absent ? (
                    <ol className={styles.parts}>
                      {listedParts(role.kind)
                        .filter((part) => tab === 'after' || (part.key !== 'digest' && part.key !== 'plaque' && part.key !== 'lock'))
                        .map((part) => (
                          <li key={part.key}>
                            <span>{part.name}</span>
                            {part.note}
                          </li>
                        ))}
                    </ol>
                  ) : null}
                  <button type="button" className={styles.cardClose} onClick={resetView} aria-label="Close">
                    ×
                  </button>
                </div>
              ) : null}
              <p className={styles.banner} ref={(node) => void (hud.current.banner = node)} data-tone="calm" aria-live="polite">
                <strong ref={(node) => void (hud.current.lead = node)} />
                <span ref={(node) => void (hud.current.text = node)} />
              </p>
              <div ref={tip} className={styles.tip} data-hidden="" aria-hidden="true" />
            </div>
          </Plate>
        </div>
      </div>

      <section className={styles.floorParts} aria-labelledby="cp-parts">
        <h3 id="cp-parts" className={styles.subhead}>
          What’s on the floor · {TABS[tab].name.toLowerCase()}
        </h3>
        <ol className={styles.cards}>
          {ROLES.map((r) => {
            const gone = missing(tab, r.kind);
            return (
              <li key={r.n}>
                <button type="button" className={styles.partCard} aria-pressed={selected === r.kind} onClick={() => (selected === r.kind ? resetView() : focusRole(r.kind))}>
                  <span className={styles.number} data-missing={gone ? '' : undefined}>
                    {r.n}
                  </span>
                  <span className={styles.partText}>
                    <strong>
                      {r.name}
                      {gone ? <span className={styles.missingTag}>Missing</span> : null}
                    </strong>
                    <span className={styles.partNote}>{ROLE_TEXT[r.kind][tab]}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </section>

      <footer className={styles.footnote}>
        <ul className={styles.keys} aria-label="Tray colours">
          <li data-mark="read">Read slip</li>
          <li data-mark="write">Write slip</li>
          <li data-mark="lease">Holds the cache lease</li>
          <li data-mark="wait">Waiting</li>
          <li data-mark="fail">Failed</li>
          <li data-mark="retry">Retry</li>
        </ul>
        <p className={styles.muted}>
          Based on “{SOURCE.title}” by {SOURCE.author}, {SOURCE.publisher}, {SOURCE.date}. The initial design is reconstructed from the post; latency, load, traffic and failover-time figures
          are illustrative. One tray stands for many queries.
        </p>
      </footer>

      <span ref={announce} className={styles.hidden} aria-live="polite" />
    </section>
  );
}
