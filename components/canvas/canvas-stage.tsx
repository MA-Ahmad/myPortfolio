import {
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { flushSync } from 'react-dom';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useRouter } from 'next/router';
import type { Activity } from 'lib/github-contributions';
import type { Point } from 'lib/canvas/geometry';
import { pixelNavigate } from 'lib/pixel-transition';
import { type Screen, createScreen } from 'lib/canvas/screen';
import styles from './canvas.module.css';
import { DisplayNode, type DisplayState } from './display-node';
import { PeerLayer, type SharedWire } from './multiplayer';
import { NodeCard } from './node-card';
import {
  CARDS,
  type CardId,
  DEFAULT_ACTIVE,
  DESIGN,
  type Layout,
  type NodeId,
  ROW,
  cardById,
  direction,
  initialPositions,
  inputPort,
  inputSide,
  nodeSize,
  outputPort,
  portSide,
  slotOffset
} from './nodes';
import { HomePreview } from './previews/home-preview';
import { MidnightPreview } from './previews/midnight-preview';
import { NotebookPreview } from './previews/notebook-preview';
import { PanoramaPreview } from './previews/panorama-preview';
import { MarginaliaPreview } from './previews/marginalia-preview';
import { TerminalPreview } from './previews/terminal-preview';
import { Strands, type StrandsHandle } from './strands';

// The theme being sent to the display, from the press on Open until its page takes over.
type WireState = { from: CardId };
type View = { layout: Layout; scale: number; ox: number; oy: number; width: number; height: number };

const BAR_H = 56;
// Desktop hangs from the top: the display sits this far under the bar at any window height, and
// the world is scaled down until the cards clear the bottom of the window by the other.
const STAGE_TOP = 6;
const STAGE_BOTTOM = 16;
// The least width kept clear either side of the nodes' box, in all.
const SIDE_ROOM: Record<Layout, number> = { desktop: 96, mobile: 24 };
// A sideways drag on a phone's card this long turns the carousel.
const SWIPE_PX = 36;
const MOBILE_BREAKPOINT = 768;
// The display swells about its center on a bouncy spring.
const SWELL_SPRING = { stiffness: 380, damping: 14 };
// Pulled out, it settles back without the bounce.
const SHRINK_SPRING = { stiffness: 260, damping: 26 };
// A screen whose send was pulled back out is dropped after this, unless another send has started.
const PREPARE_IDLE_MS = 2000;
// Matches the transform transition on .node[data-slot].
const SLIDE_MS = 520;
// Sending a theme: when the first light lands on the display, how much the display swells and how
// far its glow comes up (the display's --swell). Its screen grows once the progress bar on it is
// full (see SendProgress).
const SEND_LANDS_MS = 320;
const SEND_SWELL = 0.035;
const SEND_GLOW = 3;
// A press that travels this far moves the node; less is a click.
const MOVE_THRESHOLD = 4;
// The bundle spans a card's top edge and the display's bottom edge, short of their round corners.
// The least height left between the display and the connected card while either is moved.
const BUNDLE_ROOM = 72;
const FAN_INSET = 20;
const FAN_CARD = 132;
const FAN_DISPLAY = 205;

function measure(stage: HTMLElement): View {
  const width = stage.clientWidth;
  const height = window.innerHeight;
  const layout: Layout = width < MOBILE_BREAKPOINT ? 'mobile' : 'desktop';
  const design = DESIGN[layout];
  // The display sits just under the bar and everything below it must fit above the window's edge.
  const room = height - BAR_H - STAGE_TOP - STAGE_BOTTOM;
  const scale = Math.max(0.5, Math.min(1, (width - SIDE_ROOM[layout]) / design.w, room / design.h));
  return { layout, scale, ox: (width - design.w * scale) / 2, oy: BAR_H + STAGE_TOP, width, height };
}

/** The colors each page paints first, so the pixel transition hands over without a flash. */
function transitionColors(id: CardId) {
  if (id === 'terminal') return { edge: '#b8c572', background: '#0d0e0f' };
  if (id === 'midnight') return { edge: '#f3f3f4', background: '#0b0b0d' };
  // --pn-ink and --pn-bg in themes/panorama/panorama.module.css.
  if (id === 'panorama') return { edge: '#f4f4f5', background: '#1c1f24' };
  const dark = document.documentElement.classList.contains('dark');
  // --mg-ink and --mg-bg in themes/marginalia/marginalia.module.css.
  if (id === 'marginalia') {
    return {
      edge: dark ? 'oklch(93% 0.008 265)' : 'oklch(23% 0.025 265)',
      background: dark ? 'oklch(17.5% 0.012 265)' : 'oklch(98.3% 0.004 255)'
    };
  }
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
  const [order, setOrder] = useState<NodeId[]>(['marginalia', 'notebook', 'midnight', 'panorama', 'home', 'terminal', 'display']);
  const [grabbed, setGrabbed] = useState<NodeId | null>(null);
  // The theme in the slot under the display, and whether the row is sliding to a new one.
  const [active, setActive] = useState<CardId>(DEFAULT_ACTIVE);
  const [swapping, setSwapping] = useState(false);
  const [wire, setWire] = useState<WireState | null>(null);
  // The theme being sent, and whether its screen has grown out of the display.
  const [booting, setBooting] = useState<CardId | null>(null);
  // Whether the page being sent has loaded, so its progress bar may finish.
  const [sendReady, setSendReady] = useState(false);
  const [lifted, setLifted] = useState(false);
  const [arrivals, setArrivals] = useState(0);
  const [powerOff, setPowerOff] = useState<{ key: number; source: CardId } | null>(null);
  // Read out by screen readers as a theme starts opening or is pulled back out.
  const [status, setStatus] = useState('');

  const viewRef = useRef(view);
  const positionsRef = useRef(positions);
  const wireRef = useRef(wire);
  viewRef.current = view;
  positionsRef.current = positions;
  wireRef.current = wire;
  const activeRef = useRef(active);
  const swapTimerRef = useRef<number | undefined>(undefined);
  const sendTimerRef = useRef<number | undefined>(undefined);
  // Set while a press on a card has turned into a drag, so the click that ends it opens nothing.
  const draggedRef = useRef(false);

  const releaseRef = useRef<(() => void) | null>(null);
  const swellRef = useRef({ x: 1, v: 0, target: 1, frame: 0, spring: SWELL_SPRING });
  const liftedRef = useRef(false);
  const screenRef = useRef<Screen | null>(null);
  const preparedRef = useRef<CardId | null>(null);
  const discardRef = useRef<number | undefined>(undefined);
  const displayRef = useRef<HTMLElement>(null);
  const strandsRef = useRef<StrandsHandle>(null);
  const reducedRef = useRef(false);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const update = () => {
      const next = measure(stage);
      if (next.layout !== viewRef.current?.layout) setPositions(initialPositions(next.layout, activeRef.current));
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
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    CARDS.forEach((card) => router.prefetch(card.href));
  }, [router]);

  // Esc pulls a theme back out while it is still being sent.
  useEffect(() => {
    if (!booting) return;
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && pullOut();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // pullOut reads everything it needs from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booting]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = query.matches;
    const onChange = () => (reducedRef.current = query.matches);
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
      releaseRef.current?.();
      window.clearTimeout(discardRef.current);
      window.clearTimeout(sendTimerRef.current);
      window.clearTimeout(swapTimerRef.current);
      cancelAnimationFrame(swellRef.current.frame);
      screenRef.current?.destroy();
    };
  }, []);

  const toWorld = useCallback((clientX: number, clientY: number): Point => {
    const rect = stageRef.current!.getBoundingClientRect();
    const { ox, oy, scale } = viewRef.current!;
    return { x: (clientX - rect.left - ox) / scale, y: (clientY - rect.top - oy) / scale };
  }, []);

  const target = (from: CardId) => () =>
    inputPort(
      positionsRef.current.display,
      inputSide(from, viewRef.current!.layout, positionsRef.current),
      viewRef.current!.layout
    );

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
      backdrop: `color-mix(in oklab, ${token('--cv-bg')} 70%, transparent)`,
      accent: token(`--accent-${id}`)
    };
  };

  /**
   * Sends a theme to the display: the card and the display vibrate, the glow runs round the display
   * and light races up the bundle while a progress bar fills on the display's screen. Meanwhile the
   * theme's page starts loading in a screen that grows out of the display once the bar is full (see
   * `lift`). Reduced motion opens the page at once.
   */
  const snap = (from: CardId) => {
    releaseRef.current?.();
    prepare(from);
    flushSync(() => setWire({ from }));
    const title = cardById(from).title;
    if (reducedRef.current) {
      setStatus(`Opening ${title} theme`);
      return open(from);
    }
    setStatus(`Opening ${title} theme. Press Escape to cancel.`);
    setBooting(from);
    setSendReady(false);
    const screen = screenRef.current;
    screen?.ready.then(() => {
      // Still this send, and not pulled out: the bar may finish (a page that timed out opens anyway).
      if (screenRef.current === screen && wireRef.current?.from === from) setSendReady(true);
    });
    // The bundle itself carries the send, a volley of light and sparks up the strands. The display
    // takes it in with one swell, then its screen grows.
    window.clearTimeout(sendTimerRef.current);
    sendTimerRef.current = window.setTimeout(() => {
      setArrivals(SEND_GLOW);
      swellTo(1 + SEND_SWELL);
    }, SEND_LANDS_MS);
  };

  /**
   * Switches the display back off when a theme is pulled out mid-send: the swell settles back, and
   * the display's screen collapses old-TV style.
   */
  const powerDown = (id: CardId) => {
    window.clearTimeout(sendTimerRef.current);
    setBooting(null);
    setArrivals(0);
    setPowerOff({ key: Date.now(), source: id });
    setStatus(`Stopped opening ${cardById(id).title} theme`);
    swellTo(1, SHRINK_SPRING);
  };

  /** Esc while a theme is being sent: power down and drop the send. */
  const pullOut = () => {
    const current = wireRef.current;
    if (!current || liftedRef.current) return;
    powerDown(current.from);
    retract();
  };

  /** Starts loading a theme's page in a hidden screen as its send begins. */
  const prepare = (id: CardId) => {
    if (reducedRef.current || wireRef.current) return;
    window.clearTimeout(discardRef.current);
    if (screenRef.current && preparedRef.current === id) return;
    screenRef.current?.destroy();
    const card = cardById(id);
    screenRef.current = createScreen(router, {
      href: card.href,
      title: card.title,
      colors: screenColors(id)
    });
    preparedRef.current = id;
  };

  /** Drops a screen that went unused, so its hidden page doesn't keep running. */
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
    const p = inputPort(at, inputSide(from, layout, positionsRef.current), layout);
    const cx = at.x + size.w / 2;
    const cy = at.y + size.h / 2;
    return { x: cx + (p.x - cx) * scale, y: cy + (p.y - cy) * scale };
  };

  /**
   * Swells the display and moves the bundle's end with it, straight on the elements: a React render
   * per frame would redraw every card and preview. Renders in between read the same scale.
   */
  const applySwell = (scale: number) => {
    const current = wireRef.current;
    const display = displayRef.current;
    if (!current || !display) return;
    const at = positionsRef.current.display;
    display.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) scale(${scale})`;
    strandsRef.current?.moveEnd(swollenPort(current.from, scale));
  };

  /**
   * Springs the display toward `target` scale. It runs here rather than in CSS so the bundle's end
   * can follow the input port as the display swells.
   */
  const swellTo = (target: number, spring = SWELL_SPRING) => {
    const swell = swellRef.current;
    swell.target = target;
    swell.spring = spring;
    if (swell.frame) return;
    let last = performance.now();
    const step = (now: number) => {
      const dt = Math.min(0.032, (now - last) / 1000);
      last = now;
      swell.v += (swell.spring.stiffness * (swell.target - swell.x) - swell.spring.damping * swell.v) * dt;
      swell.x += swell.v * dt;
      const settled = Math.abs(swell.target - swell.x) < 0.0005 && Math.abs(swell.v) < 0.005;
      if (settled) swell.x = swell.target;
      applySwell(swell.x);
      swell.frame = settled ? 0 : requestAnimationFrame(step);
    };
    swell.frame = requestAnimationFrame(step);
  };

  /** The send's progress bar is full: the screen grows out of the display and opens the page. */
  const lift = () => {
    const display = displayRef.current;
    if (!wireRef.current || liftedRef.current || !screenRef.current || !display) return;
    screenRef.current.run(display);
    liftedRef.current = true;
    setLifted(true);
  };

  const retract = () => {
    releaseRef.current?.();
    setWire(null);
    discardSoon();
  };

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

  /** A click on a card or on Open: a card waiting in the row is carried in, the connected one is sent. */
  const connect = (id: CardId) => {
    if (wireRef.current || draggedRef.current) return;
    if (id !== activeRef.current) return select(id);
    snap(id);
  };

  /**
   * Moves a node about the desktop by its header or, for a card, anywhere on it. The bundle between
   * the display and the connected card follows every frame. A press that never travels is left to
   * be the click it was.
   */
  const grab = (id: NodeId) => (event: PointerEvent) => {
    if (event.button !== 0 || wireRef.current) return;
    const layout = viewRef.current!.layout;
    if (layout === 'mobile') {
      // A phone's nodes stay put; a sideways swipe on a card turns the carousel instead.
      if (id === 'display') return;
      const from = event.clientX;
      let swiped = false;
      listen(
        event,
        (move) => {
          if (swiped || Math.abs(move.clientX - from) < SWIPE_PX) return;
          swiped = true;
          draggedRef.current = true;
          step(move.clientX < from ? 1 : -1);
        },
        () => window.setTimeout(() => (draggedRef.current = false), 0)
      );
      return;
    }
    event.preventDefault();
    const press = { x: event.clientX, y: event.clientY };
    const start = toWorld(event.clientX, event.clientY);
    const origin = positionsRef.current[id];
    const size = nodeSize(id, layout);
    let moving = false;
    listen(
      event,
      (move) => {
        if (!moving) {
          if (Math.hypot(move.clientX - press.x, move.clientY - press.y) < MOVE_THRESHOLD) return;
          moving = true;
          draggedRef.current = true;
          setOrder((current) => [...current.filter((node) => node !== id), id]);
          setGrabbed(id);
        }
        const { ox, oy, scale, width, height } = viewRef.current!;
        const p = toWorld(move.clientX, move.clientY);
        const minX = (8 - ox) / scale;
        const maxX = (width - 8 - ox) / scale - size.w;
        let minY = (BAR_H - oy) / scale;
        let maxY = (height - 8 - oy) / scale - size.h;
        // The connected card stays under the display with room for the bundle between them, so it
        // always runs the same way: out of the card's top, into the display's bottom.
        const displaySize = nodeSize('display', layout);
        if (id === activeRef.current) {
          minY = Math.max(minY, positionsRef.current.display.y + displaySize.h + BUNDLE_ROOM);
        } else if (id === 'display') {
          maxY = Math.min(maxY, positionsRef.current[activeRef.current].y - displaySize.h - BUNDLE_ROOM);
        }
        setPositions((current) => ({
          ...current,
          [id]: {
            x: Math.min(maxX, Math.max(minX, origin.x + p.x - start.x)),
            y: Math.min(maxY, Math.max(minY, origin.y + p.y - start.y))
          }
        }));
      },
      () => {
        setGrabbed(null);
        // The click that ends a drag comes right after this; anything later is a fresh press.
        window.setTimeout(() => (draggedRef.current = false), 0);
      }
    );
  };

  /**
   * Carries a theme into the slot under the display; its bundle fades out for the ride. Nodes that
   * were moved glide back to their places.
   */
  const select = (id: CardId) => {
    if (wireRef.current || id === activeRef.current) return;
    discardSoon();
    activeRef.current = id;
    setActive(id);
    setPositions(initialPositions(viewRef.current!.layout, id));
    setStatus(`${cardById(id).title} theme selected`);
    window.clearTimeout(swapTimerRef.current);
    if (reducedRef.current) return setSwapping(false);
    setSwapping(true);
    swapTimerRef.current = window.setTimeout(() => setSwapping(false), SLIDE_MS);
  };

  const step = (by: number) => {
    const next = ROW[ROW.indexOf(activeRef.current) + by];
    if (next) select(next);
  };

  const layout = view?.layout ?? 'desktop';

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      if (event.key === 'ArrowLeft') step(-1);
      else if (event.key === 'ArrowRight') step(1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // step reads everything from refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [layout]);

  const source = wire ? outputPort(wire.from, positions, layout) : null;
  // The display swells about its center as a send lands; the bundle ends where its edge ends up.
  const displayScale = swellRef.current.x;
  const port = wire ? swollenPort(wire.from, displayScale) : null;
  const plugged = wire ? wire.from : null;
  const resting = !wire && !swapping;
  const displayState: DisplayState = plugged ? 'open' : resting ? 'ready' : 'idle';
  const design = DESIGN[layout];
  const sharedWire: SharedWire | null =
    wire && source && port
      ? {
          source: wire.from,
          from: source,
          fromDir: direction(portSide(wire.from, layout, positions)),
          to: port,
          toDir: direction(inputSide(wire.from, layout, positions)),
          lit: true,
          reachCap: null
        }
      : null;

  const previews: Record<CardId, ReactNode> = {
    home: <HomePreview avatar={layout === 'desktop' ? 78 : 68} />,
    terminal: <TerminalPreview contributions={contributions} weeks={43} />,
    notebook: <NotebookPreview />,
    midnight: <MidnightPreview />,
    panorama: <PanoramaPreview contributions={contributions} />,
    marginalia: <MarginaliaPreview />
  };

  return (
    <div ref={stageRef} className={styles.stage}>
      <p className="sr-only" role="status" aria-live="polite">
        {status}
      </p>
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
            draggable={layout === 'desktop' && !wire}
            dragging={grabbed === card.id}
            onGrab={grab(card.id)}
            slot={slotOffset(card.id, active)}
            lit={plugged === card.id}
            shake={plugged === card.id}
            busy={wire !== null}
            onConnect={() => connect(card.id)}
            onLeave={discardSoon}
          >
            {previews[card.id]}
          </NodeCard>
        ))}

        <DisplayNode
          ref={displayRef}
          layout={layout}
          // Only once measured, in the browser: a frame in the server's markup can finish loading
          // before React is listening for it, and the screen would stay dark.
          page={view ? (wire?.from ?? active) : null}
          at={positions.display}
          z={order.indexOf('display') + 1}
          draggable={layout === 'desktop' && !wire}
          dragging={grabbed === 'display'}
          gliding={swapping}
          onGrab={grab('display')}
          source={plugged ?? (resting ? active : null)}
          state={displayState}
          side={wire ? inputSide(wire.from, layout, positions) : 'bottom'}
          swell={arrivals}
          scale={displayScale}
          lifted={lifted}
          powerOff={powerOff}
          sending={booting && wire ? { id: booting, landsAt: SEND_LANDS_MS, ready: sendReady } : null}
          onSent={lift}
          onOpen={() => connect(active)}
        />

        {([-1, 1] as const).map((by) => {
            // Clear of the card on desktop; on a phone, over its edge, where the next card's shows.
            const out = layout === 'desktop' ? 28 : 2;
            const edge = positions[active].x + (by < 0 ? -out : nodeSize(active, layout).w + out);
            return (
              <button
                key={by}
                type="button"
                className={styles.step}
                style={{ left: edge, top: positions[active].y + nodeSize(active, layout).h / 2, zIndex: 8 }}
                aria-label={by < 0 ? 'Previous theme' : 'Next theme'}
                disabled={!ROW[ROW.indexOf(active) + by] || wire !== null}
                onClick={() => step(by)}
              >
                {by < 0 ? <ChevronLeft className="size-4" /> : <ChevronRight className="size-4" />}
              </button>
            );
          })}

        {view && (
          <PeerLayer
            layout={layout}
            scale={view.scale}
            toWorld={toWorld}
            wire={sharedWire}
            width={design.w}
            height={design.h}
          />
        )}
      </div>

      {view && (
        <Strands
          ref={strandsRef}
          width={view.width}
          height={view.height}
          scale={view.scale}
          ox={view.ox}
          oy={view.oy}
          from={wire && source ? source : outputPort(active, positions, layout)}
          fromDir={direction(portSide(wire?.from ?? active, layout, positions))}
          to={port ?? inputPort(positions.display, inputSide(active, layout, positions), layout)}
          toDir={direction(inputSide(wire?.from ?? active, layout, positions))}
          fanFrom={Math.min(FAN_CARD, nodeSize(wire?.from ?? active, layout).w / 2 - FAN_INSET)}
          fanTo={Math.min(FAN_DISPLAY, nodeSize('display', layout).w / 2 - FAN_INSET)}
          mode={wire ? 'live' : swapping ? 'off' : 'idle'}
          compact={layout === 'mobile'}
          reduced={reducedRef.current}
        />
      )}
    </div>
  );
}
