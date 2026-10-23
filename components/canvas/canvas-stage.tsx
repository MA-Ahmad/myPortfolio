import {
  type CSSProperties,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { flushSync } from 'react-dom';
import { useRouter } from 'next/router';
import type { Activity } from 'lib/github-contributions';
import {
  type Point,
  distance,
  easeInOutCubic,
  easeOutCubic,
  lerp,
  outside,
  wirePath
} from 'lib/canvas/geometry';
import { pixelNavigate } from 'lib/pixel-transition';
import { type Screen, createScreen } from 'lib/canvas/screen';
import styles from './canvas.module.css';
import { DisplayNode, type DisplayState } from './display-node';
import { NodeCard } from './node-card';
import { Packets, packetIcon } from './packets';
import {
  CARDS,
  type CardId,
  DESIGN,
  type Layout,
  NEAR_RADIUS,
  type NodeId,
  cardById,
  direction,
  initialPositions,
  inputPort,
  inputSide,
  nodeSize,
  outputPort,
  portSide
} from './nodes';
import { HomePreview } from './previews/home-preview';
import { NotebookPreview } from './previews/notebook-preview';
import { TerminalPreview } from './previews/terminal-preview';
import { Spark } from './spark';
import { Wire } from './wire';

type Phase = 'drag' | 'near' | 'snapped' | 'retract';
type WireState = { from: CardId; tip: Point; phase: Phase };
type View = { layout: Layout; scale: number; ox: number; oy: number; width: number; height: number };

const BAR_H = 56;
const MOBILE_BREAKPOINT = 768;
const DRAG_THRESHOLD = 3;
// Other theme cards push a wire tip away: their body keeps it outside a padded outline, their
// port adds a soft field, and every fresh reach for the port earns a kick that grows each time.
const BODY_PAD = 16;
const FIELD_RADIUS = 40;
const REPEL_RADIUS = 30;
const REARM_RADIUS = 42;
const KICK = 60;
const KICK_GROWTH = 0.18;
const KICK_MAX = 1.6;
const KICK_MS = 650;
const ZAP_MS = 380;
// The screen grows out of the display once the last packet's swell has peaked.
const LIFT_DELAY_MS = 220;
// Each packet that lands swells the display about its center by this much, on a bouncy spring.
const SWELL_STEP = 0.014;
const SWELL_SPRING = { stiffness: 380, damping: 14 };
// A screen loaded ahead for a port the pointer left is dropped after this, unless a wire is out.
const PREPARE_IDLE_MS = 2000;

type Repel = { source: CardId; target: CardId; dir: Point; count: number };
type Zap = { source: CardId; target: CardId; port: Point; key: number };

function measure(stage: HTMLElement): View {
  const width = stage.clientWidth;
  const height = window.innerHeight;
  if (width < MOBILE_BREAKPOINT) {
    const scale = Math.min(1, (width - 32) / DESIGN.mobile.w);
    return { layout: 'mobile', scale, ox: (width - DESIGN.mobile.w * scale) / 2, oy: BAR_H + 16, width, height };
  }
  const scale = Math.max(0.5, Math.min(1, (width - 96) / DESIGN.desktop.w, (height - BAR_H - 72) / DESIGN.desktop.h));
  return {
    layout: 'desktop',
    scale,
    ox: (width - DESIGN.desktop.w * scale) / 2,
    oy: BAR_H + (height - BAR_H - DESIGN.desktop.h * scale) / 2,
    width,
    height
  };
}

/** The colors each page paints first, so the pixel transition hands over without a flash. */
function transitionColors(id: CardId) {
  if (id === 'terminal') return { edge: '#b8c572', background: '#0d0e0f' };
  const dark = document.documentElement.classList.contains('dark');
  if (id === 'notebook') {
    return {
      edge: dark ? 'oklch(94% 0.004 80)' : 'oklch(21% 0.006 70)',
      background: dark ? 'oklch(15.5% 0.004 70)' : 'oklch(98.4% 0.0025 95)'
    };
  }
  const root = getComputedStyle(document.documentElement);
  return {
    edge: root.getPropertyValue('--foreground').trim(),
    background: root.getPropertyValue('--background').trim()
  };
}

export function CanvasStage({ contributions }: { contributions: Activity[] }) {
  const router = useRouter();
  const stageRef = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View | null>(null);
  const [positions, setPositions] = useState(() => initialPositions('desktop'));
  const [order, setOrder] = useState<NodeId[]>(['notebook', 'home', 'terminal', 'display']);
  const [grabbed, setGrabbed] = useState<NodeId | null>(null);
  const [wire, setWire] = useState<WireState | null>(null);
  const [burst, setBurst] = useState<number | null>(null);
  const [repel, setRepel] = useState<Repel | null>(null);
  const [zap, setZap] = useState<Zap | null>(null);
  // The theme whose packets are on the wire, and whether its screen has grown out of the display.
  const [booting, setBooting] = useState<CardId | null>(null);
  const [lifted, setLifted] = useState(false);
  const [arrivals, setArrivals] = useState(0);

  const viewRef = useRef(view);
  const positionsRef = useRef(positions);
  const wireRef = useRef(wire);
  viewRef.current = view;
  positionsRef.current = positions;
  wireRef.current = wire;

  const frameRef = useRef(0);
  const releaseRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const swellRef = useRef({ x: 1, v: 0, target: 1, frame: 0 });
  const screenRef = useRef<Screen | null>(null);
  const preparedRef = useRef<CardId | null>(null);
  const discardRef = useRef<number | undefined>(undefined);
  const displayRef = useRef<HTMLElement>(null);
  const layerRef = useRef<SVGSVGElement>(null);
  const reducedRef = useRef(false);
  const pointerRef = useRef<Point | null>(null);
  const kickRef = useRef<{ vec: Point; start: number } | null>(null);
  const kickFrameRef = useRef(0);
  const armedRef = useRef<Partial<Record<CardId, boolean>>>({});
  const repelCountRef = useRef(0);
  const strikesRef = useRef(0);
  const zapTimerRef = useRef<number | undefined>(undefined);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const next = measure(stage);
      if (next.layout !== viewRef.current?.layout) setPositions(initialPositions(next.layout));
      setView(next);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(stage);
    window.addEventListener('resize', update);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  useEffect(() => {
    CARDS.forEach((card) => router.prefetch(card.href));
    // Decoded ahead, so no icon pops in partway down the wire.
    CARDS.forEach((card) => card.packets.forEach((icon) => (new Image().src = packetIcon(icon))));
  }, [router]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = query.matches;
    const onChange = () => (reducedRef.current = query.matches);
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
      cancelAnimationFrame(frameRef.current);
      cancelAnimationFrame(kickFrameRef.current);
      releaseRef.current?.();
      window.clearTimeout(zapTimerRef.current);
      window.clearTimeout(timerRef.current);
      window.clearTimeout(discardRef.current);
      cancelAnimationFrame(swellRef.current.frame);
      screenRef.current?.destroy();
    };
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    const { ox, oy, scale } = viewRef.current!;
    return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
  }, []);

  const animate = (
    from: Point,
    to: () => Point,
    duration: number,
    ease: (t: number) => number,
    onFrame: (p: Point) => void,
    onDone?: () => void
  ) => {
    cancelAnimationFrame(frameRef.current);
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      onFrame(lerp(from, to(), ease(t)));
      if (t < 1) frameRef.current = requestAnimationFrame(step);
      else onDone?.();
    };
    frameRef.current = requestAnimationFrame(step);
  };

  const target = (from: CardId) => () =>
    inputPort(positionsRef.current.display, inputSide(from, viewRef.current!.layout));

  const open = (id: CardId) => {
    const stage = stageRef.current;
    const current = viewRef.current;
    if (!stage || !current) return;
    const port = target(id)();
    const rect = stage.getBoundingClientRect();
    pixelNavigate(router, cardById(id).href, {
      origin: { x: rect.left + current.ox + port.x * current.scale, y: rect.top + current.oy + port.y * current.scale },
      ...transitionColors(id)
    });
  };

  const screenColors = (id: CardId) => {
    const css = getComputedStyle(stageRef.current!);
    const token = (name: string) => css.getPropertyValue(name).trim();
    return {
      card: token('--cv-card'),
      border: token('--cv-border'),
      text: token('--cv-text'),
      muted: token('--cv-muted'),
      backdrop: `color-mix(in oklab, ${token('--cv-bg')} 70%, transparent)`,
      accent: token(`--accent-${id}`)
    };
  };

  /**
   * Plugs the wire in at once: the cards vibrate, the glow runs round the display and the theme's
   * packets ride the wire in. Meanwhile the theme's page starts loading in a screen that grows out
   * of the display once the last packet lands (see `lift`). Reduced motion opens the page at once.
   */
  const snap = (from: CardId) => {
    releaseRef.current?.();
    cancelAnimationFrame(frameRef.current);
    // Usually loaded ahead already; this only catches a connect nothing announced.
    prepare(from);
    flushSync(() => {
      setWire({ from, tip: target(from)(), phase: 'snapped' });
      setBurst(Date.now());
    });
    if (reducedRef.current) return open(from);
    setBooting(from);
  };

  /**
   * Starts loading a theme's page in a hidden screen as soon as a connect looks likely: the
   * pointer or focus reaching its port. The page's own startup work runs on this thread, so done
   * this early it finishes before the packets fly instead of stuttering them.
   */
  const prepare = (id: CardId) => {
    const current = wireRef.current;
    if (reducedRef.current || (current && (current.from !== id || current.phase === 'snapped'))) return;
    window.clearTimeout(discardRef.current);
    if (screenRef.current && preparedRef.current === id) return;
    screenRef.current?.destroy();
    const card = cardById(id);
    screenRef.current = createScreen(router, {
      href: card.href,
      title: card.title,
      route: card.route,
      colors: screenColors(id)
    });
    preparedRef.current = id;
  };

  /** Drops a screen loaded ahead that went unused, so its hidden page doesn't keep running. */
  const discardSoon = () => {
    window.clearTimeout(discardRef.current);
    discardRef.current = window.setTimeout(() => {
      if (wireRef.current || !screenRef.current?.destroy()) return;
      screenRef.current = null;
      preparedRef.current = null;
    }, PREPARE_IDLE_MS);
  };

  /** Where the input port is drawn while the display is swollen about its center by `scale`. */
  const swollenPort = (from: CardId, scale: number): Point => {
    const layout = viewRef.current!.layout;
    const at = positionsRef.current.display;
    const size = nodeSize('display', layout);
    const p = inputPort(at, inputSide(from, layout));
    const cx = at.x + size.w / 2;
    const cy = at.y + size.h / 2;
    return { x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale };
  };

  /**
   * Swells the display and moves the wire's end with it, straight on the elements: a React render
   * per frame would redraw every card and preview. Renders in between read the same scale.
   */
  const applySwell = (scale: number) => {
    const current = wireRef.current;
    const display = displayRef.current;
    if (!current || !display) return;
    const layout = viewRef.current!.layout;
    const at = positionsRef.current.display;
    display.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) scale(${scale})`;
    const port = swollenPort(current.from, scale);
    const from = outputPort(current.from, positionsRef.current[current.from], layout);
    const d = wirePath(from, direction(portSide(current.from, layout)), port, direction(inputSide(current.from, layout)));
    const layer = layerRef.current;
    layer?.querySelectorAll('[data-wire]').forEach((path) => path.setAttribute('d', d));
    layer?.querySelectorAll('[data-port]').forEach((circle) => {
      circle.setAttribute('cx', String(port.x));
      circle.setAttribute('cy', String(port.y));
    });
  };

  /**
   * Springs the display toward `target` scale. It runs here rather than in CSS so the wire's end
   * can follow the input port as the display swells.
   */
  const swellTo = (target: number) => {
    const swell = swellRef.current;
    swell.target = target;
    if (swell.frame) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      swell.v += (SWELL_SPRING.stiffness * (swell.target - swell.x) - SWELL_SPRING.damping * swell.v) * dt;
      swell.x += swell.v * dt;
      const settled = Math.abs(swell.target - swell.x) < 0.0005 && Math.abs(swell.v) < 0.005;
      if (settled) swell.x = swell.target;
      applySwell(swell.x);
      swell.frame = settled ? 0 : requestAnimationFrame(step);
    };
    swell.frame = requestAnimationFrame(step);
  };

  const lift = () => {
    timerRef.current = window.setTimeout(() => {
      const display = displayRef.current;
      if (!screenRef.current || !display) return;
      screenRef.current.run(display.getBoundingClientRect());
      setLifted(true);
    }, LIFT_DELAY_MS);
  };

  const retract = (from: CardId, tip: Point) => {
    releaseRef.current?.();
    if (reducedRef.current) return setWire(null);
    const home = () => outputPort(from, positionsRef.current[from], viewRef.current!.layout);
    const reach = distance(tip, home());
    animate(
      tip,
      home,
      Math.min(520, 260 + reach * 0.5),
      easeOutCubic,
      (p) => setWire({ from, tip: p, phase: 'retract' }),
      () => {
        setWire(null);
        discardSoon();
      }
    );
  };

  // Only arms the wire; it plugs in on release, never while the pointer is still held.
  const moveTip = (from: CardId, tip: Point) => {
    const gap = distance(tip, target(from)());
    setWire({ from, tip, phase: gap < NEAR_RADIUS ? 'near' : 'drag' });
  };

  const busy = wire !== null && wire.phase !== 'drag' && wire.phase !== 'near';

  /**
   * Follows one pointer until it is released. The pressed element captures that pointer, so only
   * its own release ends the drag; anything that takes the pointer away first (a native drag, a
   * system gesture, Escape) cancels instead.
   */
  const listen = (
    event: PointerEvent,
    onMove: (event: globalThis.PointerEvent) => void,
    onEnd: (cancelled: boolean) => void
  ) => {
    const { pointerId } = event;
    const element = event.currentTarget as Element;
    element.setPointerCapture(pointerId);
    const ours = (e: globalThis.PointerEvent) => e.pointerId === pointerId;
    const move = (e: globalThis.PointerEvent) => ours(e) && onMove(e);
    const up = (e: globalThis.PointerEvent) => ours(e) && end(false);
    const cancel = (e: globalThis.PointerEvent) => ours(e) && end(true);
    const key = (e: KeyboardEvent) => e.key === 'Escape' && end(true);
    const block = (e: Event) => e.preventDefault();
    const release = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      element.removeEventListener('lostpointercapture', cancel);
      window.removeEventListener('keydown', key);
      document.removeEventListener('selectstart', block);
      document.removeEventListener('dragstart', block);
      if (element.hasPointerCapture(pointerId)) element.releasePointerCapture(pointerId);
      releaseRef.current = null;
    };
    const end = (cancelled: boolean) => {
      release();
      onEnd(cancelled);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    element.addEventListener('lostpointercapture', cancel);
    window.addEventListener('keydown', key);
    document.addEventListener('selectstart', block);
    document.addEventListener('dragstart', block);
    releaseRef.current = release;
  };

  const center = (id: NodeId): Point => {
    const at = positionsRef.current[id];
    const size = nodeSize(id, viewRef.current!.layout);
    return { x: at.x + size.w / 2, y: at.y + size.h / 2 };
  };

  /**
   * How far the last kick still pushes the tip: out fast, then easing back while it trembles.
   * The tremble stays on the far side, so the tip never swings back onto the port.
   */
  const kickOffset = (now: number): Point => {
    const kick = kickRef.current;
    if (!kick) return { x: 0, y: 0 };
    const s = (now - kick.start) / 1000;
    if (s * 1000 >= KICK_MS) {
      kickRef.current = null;
      return { x: 0, y: 0 };
    }
    const f = (1 - Math.exp(-s / 0.025)) * Math.exp(-s / 0.14) * (0.75 + 0.25 * Math.cos(s * 45));
    return { x: kick.vec.x * f, y: kick.vec.y * f };
  };

  const kick = (id: CardId, target: CardId, port: Point, tip: Point, now: number) => {
    armedRef.current[target] = false;
    const dx = tip.x - port.x;
    const dy = tip.y - port.y;
    const length = Math.hypot(dx, dy);
    const away =
      length > 0.5
        ? { x: dx / length, y: dy / length }
        : { x: direction(portSide(target, viewRef.current!.layout)), y: 0 };
    const strength = KICK * Math.min(KICK_MAX, 1 + strikesRef.current * KICK_GROWTH);
    strikesRef.current += 1;
    kickRef.current = { vec: { x: away.x * strength, y: away.y * strength }, start: now };

    const a = center(id);
    const b = center(target);
    const apart = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    repelCountRef.current += 1;
    setRepel({ source: id, target, dir: { x: (b.x - a.x) / apart, y: (b.y - a.y) / apart }, count: repelCountRef.current });
    setZap({ source: id, target, port, key: now });
    window.clearTimeout(zapTimerRef.current);
    zapTimerRef.current = window.setTimeout(() => setZap(null), ZAP_MS);

    cancelAnimationFrame(kickFrameRef.current);
    const step = (time: number) => {
      if (!kickRef.current || !pointerRef.current) return;
      aim(id, time);
      kickFrameRef.current = requestAnimationFrame(step);
    };
    kickFrameRef.current = requestAnimationFrame(step);
  };

  /**
   * Places the tip at the pointer, kept outside every other theme card and pushed off its port.
   * A kick rearms once it has settled and the pointer has backed off the port a little.
   */
  const aim = (id: CardId, now = performance.now()) => {
    const pointer = pointerRef.current;
    const current = wireRef.current;
    if (!pointer || (current && current.phase !== 'drag' && current.phase !== 'near')) return;
    const layout = viewRef.current!.layout;
    let tip = pointer;
    for (const card of CARDS) {
      if (card.id === id) continue;
      tip = outside(tip, positionsRef.current[card.id], nodeSize(card.id, layout), BODY_PAD);
      const port = outputPort(card.id, positionsRef.current[card.id], layout);
      const gap = distance(tip, port);
      if (gap > REARM_RADIUS && !kickRef.current) armedRef.current[card.id] = true;
      if (gap < REPEL_RADIUS && armedRef.current[card.id] !== false && !reducedRef.current)
        kick(id, card.id, port, tip, now);
      if (gap < FIELD_RADIUS) {
        const away =
          gap > 0.5
            ? { x: (tip.x - port.x) / gap, y: (tip.y - port.y) / gap }
            : { x: direction(portSide(card.id, layout)), y: 0 };
        const pushed = FIELD_RADIUS - (FIELD_RADIUS - gap) * 0.3;
        tip = { x: port.x + away.x * pushed, y: port.y + away.y * pushed };
      }
    }
    const offset = kickOffset(now);
    moveTip(id, { x: tip.x + offset.x, y: tip.y + offset.y });
  };

  // The wire only appears once the pointer actually moves, and plugs in only on release.
  const startWire = (id: CardId) => (event: PointerEvent) => {
    if (event.button !== 0 || wireRef.current) return;
    prepare(id);
    event.preventDefault();
    event.stopPropagation();
    const press = { x: event.clientX, y: event.clientY };
    let dragging = false;
    armedRef.current = {};
    strikesRef.current = 0;
    listen(
      event,
      (move) => {
        if (!dragging) {
          if (Math.hypot(move.clientX - press.x, move.clientY - press.y) < DRAG_THRESHOLD) return;
          dragging = true;
        }
        pointerRef.current = toWorld(move.clientX, move.clientY);
        aim(id);
      },
      (cancelled) => {
        pointerRef.current = null;
        kickRef.current = null;
        cancelAnimationFrame(kickFrameRef.current);
        // The stacked phone layout puts the display far below most ports, so a tap wires it up.
        if (!dragging && !cancelled && viewRef.current?.layout === 'mobile') return connect(id);
        const current = wireRef.current;
        if (!current || (current.phase !== 'drag' && current.phase !== 'near')) return;
        if (!cancelled && current.phase === 'near') snap(id);
        else retract(id, current.tip);
      }
    );
  };

  const connect = (id: CardId) => {
    if (wireRef.current) return;
    prepare(id);
    const from = outputPort(id, positionsRef.current[id], viewRef.current!.layout);
    if (reducedRef.current) return snap(id);
    setWire({ from: id, tip: from, phase: 'drag' });
    animate(
      from,
      target(id),
      760,
      easeInOutCubic,
      (p) => moveTip(id, p),
      () => snap(id)
    );
  };

  const grab = (id: NodeId) => (event: PointerEvent) => {
    if (event.button !== 0 || viewRef.current?.layout !== 'desktop') return;
    event.preventDefault();
    const start = toWorld(event.clientX, event.clientY);
    const origin = positionsRef.current[id];
    const size = nodeSize(id, 'desktop');
    setOrder((current) => [...current.filter((node) => node !== id), id]);
    setGrabbed(id);
    listen(
      event,
      (move) => {
        const { ox, oy, scale, width, height } = viewRef.current!;
        const p = toWorld(move.clientX, move.clientY);
        const minX = (8 - ox) / scale;
        const maxX = (width - 8 - ox) / scale - size.w;
        const minY = (BAR_H - oy) / scale;
        const maxY = (height - 8 - oy) / scale - size.h;
        setPositions((current) => ({
          ...current,
          [id]: {
            x: Math.min(maxX, Math.max(minX, origin.x + p.x - start.x)),
            y: Math.min(maxY, Math.max(minY, origin.y + p.y - start.y))
          }
        }));
      },
      () => setGrabbed(null)
    );
  };

  const layout = view?.layout ?? 'desktop';
  const draggable = layout === 'desktop' && !booting;
  const source = wire ? outputPort(wire.from, positions[wire.from], layout) : null;
  // The display swells about its center as packets land; the input port is drawn where it ends up.
  const displayScale = swellRef.current.x;
  const port = wire ? swollenPort(wire.from, displayScale) : null;
  const inputs = Array.from(new Set(CARDS.map((card) => inputSide(card.id, layout))));
  const plugged = wire?.phase === 'snapped' ? wire.from : null;
  const nearSource = wire && wire.phase !== 'drag' && wire.phase !== 'retract' ? wire.from : null;
  const displayState: DisplayState = plugged
    ? 'open'
    : nearSource
      ? 'near'
      : wire?.phase === 'drag'
        ? 'armed'
        : 'idle';
  const design = DESIGN[layout];
  const stageHeight = layout === 'mobile' && view ? view.oy + design.h * view.scale + 40 : undefined;

  const previews: Record<CardId, ReactNode> = {
    home: <HomePreview avatar={layout === 'desktop' ? 84 : 68} />,
    terminal: <TerminalPreview contributions={contributions} weeks={layout === 'desktop' ? 49 : 43} />,
    notebook: <NotebookPreview />
  };

  return (
    <div ref={stageRef} className={styles.stage} style={{ height: stageHeight }}>
      <div
        className={styles.world}
        style={{
          width: design.w,
          height: design.h,
          visibility: view ? undefined : 'hidden',
          transform: view ? `translate3d(${view.ox}px, ${view.oy}px, 0) scale(${view.scale})` : undefined
        }}
      >
        {CARDS.map((card) => (
          <NodeCard
            key={card.id}
            card={card}
            layout={layout}
            at={positions[card.id]}
            z={order.indexOf(card.id) + 1}
            draggable={draggable}
            dragging={grabbed === card.id}
            lit={plugged === card.id}
            shake={plugged === card.id}
            repel={
              repel && (repel.source === card.id || repel.target === card.id)
                ? {
                    x: repel.source === card.id ? -repel.dir.x : repel.dir.x,
                    y: repel.source === card.id ? -repel.dir.y : repel.dir.y,
                    count: repel.count
                  }
                : null
            }
            busy={wire !== null}
            onGrab={grab(card.id)}
            onWire={startWire(card.id)}
            onConnect={() => connect(card.id)}
            onPrepare={() => prepare(card.id)}
            onLeave={discardSoon}
          >
            {previews[card.id]}
          </NodeCard>
        ))}

        <DisplayNode
          ref={displayRef}
          at={positions.display}
          z={order.indexOf('display') + 1}
          draggable={draggable}
          dragging={grabbed === 'display'}
          source={plugged ?? nearSource}
          state={displayState}
          inputs={inputs}
          side={wire ? inputSide(wire.from, layout) : inputs[0]}
          swell={arrivals}
          scale={displayScale}
          lifted={lifted}
          onGrab={grab('display')}
        />

        <svg ref={layerRef} className={styles.layer} width={design.w} height={design.h} style={{ zIndex: 10 }} aria-hidden>
          {wire && source && (
            <>
              <Wire
                source={wire.from}
                from={source}
                fromDir={direction(portSide(wire.from, layout))}
                to={wire.phase === 'snapped' && port ? port : wire.tip}
                toDir={direction(inputSide(wire.from, layout))}
                lit={wire.phase === 'snapped'}
              />
              <g style={{ '--accent': `var(--accent-${wire.from})` } as CSSProperties}>
                <circle className={styles.cap} data-lit={plugged || undefined} cx={source.x} cy={source.y} r={5} />
                {plugged && port && (
                  <circle className={styles.cap} data-lit data-port cx={port.x} cy={port.y} r={6} />
                )}
              </g>
            </>
          )}
          {wire && wire.phase !== 'snapped' && (
            <circle className={styles.tip} cx={wire.tip.x} cy={wire.tip.y} r={4} />
          )}
          {wire?.phase === 'near' && port && !reducedRef.current && (
            <Spark source={wire.from} tip={wire.tip} port={port} />
          )}
          {zap && wire && (wire.phase === 'drag' || wire.phase === 'near') && (
            <g key={zap.key}>
              <Spark source={zap.source} tip={wire.tip} port={zap.port} />
              <g style={{ '--accent': `var(--accent-${zap.target})` } as CSSProperties}>
                <circle className={styles.burst} cx={zap.port.x} cy={zap.port.y} r={6} />
              </g>
            </g>
          )}
          {booting && plugged && source && port && (
            <Packets
              source={plugged}
              from={source}
              fromDir={direction(portSide(plugged, layout))}
              to={port}
              toDir={direction(inputSide(plugged, layout))}
              onArrive={() => {
                setBurst(Date.now());
                setArrivals((count) => count + 1);
                swellTo(swellRef.current.target + SWELL_STEP);
              }}
              onDone={lift}
            />
          )}
          {plugged && burst && port && (
            <g key={burst} style={{ '--accent': `var(--accent-${plugged})` } as CSSProperties}>
              <circle className={styles.burst} data-port cx={port.x} cy={port.y} r={6} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
