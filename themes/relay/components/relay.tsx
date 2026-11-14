import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import type { ThemeHomeProps } from 'themes/registry';
import { RELAY_CONTENT as C, SECTIONS, type SectionId } from '../content';
import { BURST_MS, PACKET_MS, type Scene, draw } from '../lib/burst';
import { GlimpseProvider } from './glimpse';
import { Section } from './sections';
import { Spec } from './spec';
import styles from '../relay.module.css';

/**
 * The card lives inside a fixed boundary, like a frame on a canvas: its right edge is pinned, and
 * it can be pulled out to the left, up and down, as far as the boundary and no smaller than MIN.
 */
const BOUNDS = { w: 720, h: 560 };
const START = { w: 580, h: 380 };
const MIN = { w: 420, h: 300 };
type Box = { top: number; w: number; h: number };
type Edge = 'left' | 'top' | 'bottom' | 'top-left' | 'bottom-left';
const EDGES: Edge[] = ['left', 'top', 'bottom', 'top-left', 'bottom-left'];
/** Room around the stage the canvas keeps, so nodes popping on the border aren't clipped. */
const BLEED = 24;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** From this width the nav stands beside the card, wired to it; below, it is a row above it. */
const SIDE = '(min-width: 1060px)';
const subscribeSide = (change: () => void) => {
  const query = matchMedia(SIDE);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
};
const useSide = () => useSyncExternalStore(subscribeSide, () => matchMedia(SIDE).matches, () => true);

export function Relay(props: ThemeHomeProps) {
  return (
    <GlimpseProvider>
      <Stage {...props} />
    </GlimpseProvider>
  );
}

function Stage({ contributions, posts }: ThemeHomeProps) {
  const [active, setActive] = useState<SectionId>('intro');
  // How the last switch happened: a click plays the relay, keys and reduced motion switch at once.
  const [instant, setInstant] = useState(true);
  const [box, setBox] = useState<Box>({ top: (BOUNDS.h - START.h) / 2, w: START.w, h: START.h });
  const [dragging, setDragging] = useState(false);
  const [shown, setShown] = useState({ w: START.w, h: START.h });
  const [pulse, setPulse] = useState(0);
  const [spec, setSpec] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const boundsRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLSpanElement>(null);
  const nodes = useRef<Partial<Record<SectionId, HTMLSpanElement | null>>>({});
  const activeRef = useRef(active);
  const side = useSide();
  useLayoutEffect(() => {
    activeRef.current = active;
  }, [active]);

  // The burst's clock: when it started and whether a packet leads it. `lit` stays true after the
  // first burst, so the resting frame keeps its faint spokes.
  const burst = useRef<{ start: number; packet: boolean } | null>(null);

  const lit = useRef(false);
  const frame = useRef(0);

  /** Where everything is, in the canvas's own px. */
  const scene = useCallback((): Scene | null => {
    const stage = stageRef.current;
    const card = cardRef.current;
    const hub = hubRef.current;
    if (!stage || !card || !hub) return null;
    const box = stage.getBoundingClientRect();
    const ox = box.left - BLEED;
    const oy = box.top - BLEED;
    const c = card.getBoundingClientRect();
    const h = hub.getBoundingClientRect();
    const n = nodes.current[activeRef.current]?.getBoundingClientRect();
    // On a phone the nav sits above the card in a row: there is no wire, the burst starts at the hub.
    const wired = n && stage.dataset.layout === 'side';
    return {
      card: { x: c.left - ox + 0.5, y: c.top - oy + 0.5, w: c.width - 1, h: c.height - 1 },
      hub: { x: h.left + h.width / 2 - ox, y: h.top + h.height / 2 - oy },
      node: wired ? { x: n.left + n.width / 2 - ox, y: n.top + n.height / 2 - oy } : null
    };
  }, []);

  const paint = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      const s = scene();
      if (!canvas || !stage || !s) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = stage.offsetWidth + BLEED * 2;
      const h = stage.offsetHeight + BLEED * 2;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const ink = getComputedStyle(stage).getPropertyValue('--rl-ink').trim() || '#fff';
      const b = burst.current;
      const t = b ? now - b.start : lit.current ? Infinity : null;
      draw(ctx, s, t, { ink, packet: b?.packet ?? false });
      return b !== null && t !== null && t < BURST_MS;
    },
    [scene]
  );

  /** Repaint now, and keep painting while a burst is running. */
  const run = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      if (paint(now)) frame.current = requestAnimationFrame(tick);
      else burst.current = null;
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  /** Plays the relay: the packet (if there's a wire), then the spokes and the ring. */
  const fire = useCallback(
    (packet: boolean) => {
      lit.current = true;
      if (reducedMotion()) {
        burst.current = null;
        run();
        return;
      }
      burst.current = { start: performance.now(), packet };
      run();
    },
    [run]
  );

  // The hub takes the packet with a small pop, when it arrives.
  const pulseTimer = useRef<number | undefined>(undefined);
  const go = (id: SectionId, how: 'click' | 'key') => {
    setActive(id);
    // In the phone's row of tabs, bring the picked one fully into view.
    if (stageRef.current?.dataset.layout === 'stack') {
      document
        .getElementById(`relay-tab-${id}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
    setInstant(how === 'key');
    window.clearTimeout(pulseTimer.current);
    if (how === 'key') {
      // Keys move fast: switch at once, no relay. The resting spokes follow on the next frame.
      lit.current = true;
      burst.current = null;
      requestAnimationFrame(() => run());
      return;
    }
    const wired = stageRef.current?.dataset.layout === 'side';
    requestAnimationFrame(() => fire(wired));
    pulseTimer.current = window.setTimeout(() => setPulse((p) => p + 1), wired ? PACKET_MS : 0);
  };

  // On arrival, once the fonts have set the text, the relay plays once, so the page shows what it
  // does. With reduced motion it simply rests, lit.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        fire(stageRef.current?.dataset.layout === 'side');
        if (!reducedMotion()) window.setTimeout(() => setPulse((p) => p + 1), PACKET_MS);
      }, 350);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [fire]);

  // Anything that moves the card or the hub repaints the resting frame (a running burst keeps
  // going on its own clock, against the new geometry).
  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    const observer = new ResizeObserver(() => {
      setShown({ w: Math.round(card.offsetWidth), h: Math.round(card.offsetHeight) });
      if (!burst.current) run();
    });
    observer.observe(stage);
    observer.observe(card);
    return () => observer.disconnect();
  }, [run]);

  useLayoutEffect(() => {
    if (!burst.current) run();
  }, [active, run]);

  // The nav reads as a list of tabs: arrows move through it without animation.
  const onNavKey = (event: KeyboardEvent) => {
    const i = SECTIONS.findIndex((s) => s.id === active);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = SECTIONS[(i + step + SECTIONS.length) % SECTIONS.length].id;
    go(next, 'key');
    document.getElementById(`relay-tab-${next}`)?.focus();
  };

  // The edges resize the card, like a frame in a design tool, inside its boundary.
  const drag = useRef<{ edge: Edge; x: number; y: number; from: Box; maxW: number } | null>(null);
  const resize = (edge: Edge, from: Box, dx: number, dy: number, maxW: number): Box => {
    let { top, w, h } = from;
    if (edge.includes('left')) w = Math.min(maxW, Math.max(MIN.w, from.w - dx));
    if (edge.includes('top')) {
      top = Math.min(from.top + from.h - MIN.h, Math.max(0, from.top + dy));
      h = from.h + from.top - top;
    }
    if (edge.includes('bottom')) h = Math.min(BOUNDS.h - from.top, Math.max(MIN.h, from.h + dy));
    return { top: Math.round(top), w: Math.round(w), h: Math.round(h) };
  };
  const onEdgeDown = (edge: Edge) => (event: PointerEvent<HTMLButtonElement>) => {
    const card = cardRef.current;
    const bounds = boundsRef.current;
    if (!card || !bounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    // The card can stand taller than set when its content needs it: start from what is drawn.
    drag.current = { edge, x: event.clientX, y: event.clientY, from: { ...box, h: card.offsetHeight }, maxW: bounds.offsetWidth };
    setDragging(true);
  };
  const onEdgeMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    setBox(resize(d.edge, d.from, event.clientX - d.x, event.clientY - d.y, d.maxW));
  };
  const onEdgeUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(false);
    fire(false);
  };
  // Arrow keys on a focused edge move that edge out or in by 10px (40 with Shift).
  const onEdgeKey = (edge: Edge) => (event: KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 10;
    const dx = { ArrowLeft: -step, ArrowRight: step }[event.key] ?? 0;
    const dy = { ArrowUp: -step, ArrowDown: step }[event.key] ?? 0;
    if (!dx && !dy) return;
    event.preventDefault();
    const maxW = boundsRef.current?.offsetWidth ?? BOUNDS.w;
    setBox((from) => resize(edge, { ...from, h: cardRef.current?.offsetHeight ?? from.h }, dx, dy, maxW));
  };

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span>{C.name}</span>
        <span className={styles.dim}>{C.role}</span>
        <button
          type="button"
          className={styles.specToggle}
          aria-pressed={spec}
          onClick={() => setSpec((s) => !s)}
        >
          {spec ? 'Hide the spec' : 'Show the spec'}
        </button>
      </header>

      <div ref={stageRef} className={styles.stage} data-layout={side ? 'side' : 'stack'} data-spec={spec || undefined}>
        <canvas ref={canvasRef} className={styles.canvas} style={{ left: -BLEED, top: -BLEED }} aria-hidden="true" />

        <nav className={styles.nav} aria-label="Sections">
          <div role="tablist" aria-orientation="vertical" className={styles.tabs} onKeyDown={onNavKey}>
            {SECTIONS.map((section) => {
              const selected = section.id === active;
              return (
                <button
                  key={section.id}
                  id={`relay-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="relay-card"
                  tabIndex={selected ? 0 : -1}
                  className={styles.tab}
                  onClick={(event) => go(section.id, event.detail === 0 ? 'key' : 'click')}
                >
                  <span>{section.label}</span>
                  <span
                    ref={(el) => {
                      nodes.current[section.id] = el;
                    }}
                    className={styles.node}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <Spec at="nav" />
        </nav>

        <div
          ref={boundsRef}
          className={styles.bounds}
          data-dragging={dragging || undefined}
          style={{ '--bounds-w': `${BOUNDS.w}px`, '--bounds-h': `${BOUNDS.h}px` } as CSSProperties}
        >
          <span className={styles.boundsLabel} aria-hidden="true">
            max {BOUNDS.w} × {BOUNDS.h}
          </span>
          <div className={styles.frame} style={{ top: box.top, width: box.w } as CSSProperties}>
            <div
              ref={cardRef}
              id="relay-card"
              role="tabpanel"
              aria-labelledby={`relay-tab-${active}`}
              className={styles.card}
              style={{ minHeight: box.h }}
            >
              <span key={pulse} ref={hubRef} className={styles.hub} data-pulse={pulse > 0 || undefined} aria-hidden="true" />
              <div key={active} className={styles.content} data-instant={instant || undefined}>
                <Section id={active} contributions={contributions} posts={posts} go={(id) => go(id, 'click')} />
              </div>
            </div>

            {EDGES.map((edge) => (
              <button
                key={edge}
                type="button"
                className={styles.edge}
                data-edge={edge}
                aria-label={`Resize from the ${edge.replace('-', ' ')} edge, now ${shown.w} by ${shown.h}`}
                onPointerDown={onEdgeDown(edge)}
                onPointerMove={onEdgeMove}
                onPointerUp={onEdgeUp}
                onPointerCancel={onEdgeUp}
                onKeyDown={onEdgeKey(edge)}
                onKeyUp={(event) => event.key.startsWith('Arrow') && fire(false)}
              />
            ))}
            <span className={styles.readout} aria-hidden="true">
              {shown.w} × {shown.h}
            </span>
            <Spec at="card" />
          </div>
        </div>
      </div>
    </div>
  );
}
