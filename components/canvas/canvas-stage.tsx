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
import { useRouter } from 'next/router';
import type { Activity } from 'lib/github-contributions';
import {
  type Point,
  distance,
  easeInOutCubic,
  easeOutBack,
  easeOutCubic,
  lerp
} from 'lib/canvas/geometry';
import { pixelNavigate } from 'lib/pixel-transition';
import styles from './canvas.module.css';
import { DisplayNode, type DisplayState } from './display-node';
import { NodeCard } from './node-card';
import {
  CARDS,
  type CardId,
  DESIGN,
  type Layout,
  NEAR_RADIUS,
  type NodeId,
  SNAP_RADIUS,
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

type Phase = 'drag' | 'near' | 'snapping' | 'snapped' | 'retract';
type WireState = { from: CardId; tip: Point; phase: Phase };
type View = { layout: Layout; scale: number; ox: number; oy: number; width: number; height: number };

const BAR_H = 56;
const MOBILE_BREAKPOINT = 768;
const OPEN_DELAY_MS = 620;

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

  const viewRef = useRef(view);
  const positionsRef = useRef(positions);
  const wireRef = useRef(wire);
  viewRef.current = view;
  positionsRef.current = positions;
  wireRef.current = wire;

  const frameRef = useRef(0);
  const releaseRef = useRef<(() => void) | null>(null);
  const timerRef = useRef<number | undefined>(undefined);
  const reducedRef = useRef(false);

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
  }, [router]);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    reducedRef.current = query.matches;
    const onChange = () => (reducedRef.current = query.matches);
    query.addEventListener('change', onChange);
    return () => {
      query.removeEventListener('change', onChange);
      cancelAnimationFrame(frameRef.current);
      releaseRef.current?.();
      window.clearTimeout(timerRef.current);
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

  const snap = (from: CardId, tip: Point) => {
    releaseRef.current?.();
    const done = () => {
      setWire({ from, tip: target(from)(), phase: 'snapped' });
      setBurst(Date.now());
      timerRef.current = window.setTimeout(() => open(from), reducedRef.current ? 200 : OPEN_DELAY_MS);
    };
    if (reducedRef.current) return done();
    setWire({ from, tip, phase: 'snapping' });
    animate(tip, target(from), 220, easeOutBack, (p) => setWire({ from, tip: p, phase: 'snapping' }), done);
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
      () => setWire(null)
    );
  };

  const moveTip = (from: CardId, tip: Point) => {
    const gap = distance(tip, target(from)());
    if (gap < SNAP_RADIUS) return snap(from, tip);
    setWire({ from, tip, phase: gap < NEAR_RADIUS ? 'near' : 'drag' });
  };

  const busy = wire !== null && wire.phase !== 'drag' && wire.phase !== 'near';

  const listen = (onMove: (event: globalThis.PointerEvent) => void, onEnd: (cancelled: boolean) => void) => {
    const move = (event: globalThis.PointerEvent) => onMove(event);
    const up = () => end(false);
    const cancel = () => end(true);
    const key = (event: KeyboardEvent) => event.key === 'Escape' && end(true);
    const release = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('keydown', key);
      releaseRef.current = null;
    };
    const end = (cancelled: boolean) => {
      release();
      onEnd(cancelled);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('keydown', key);
    releaseRef.current = release;
  };

  const startWire = (id: CardId) => (event: PointerEvent) => {
    if (event.button !== 0 || wireRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    moveTip(id, toWorld(event.clientX, event.clientY));
    listen(
      (move) => {
        const current = wireRef.current;
        if (current?.phase === 'drag' || current?.phase === 'near') moveTip(id, toWorld(move.clientX, move.clientY));
      },
      (cancelled) => {
        const current = wireRef.current;
        if (!current || (current.phase !== 'drag' && current.phase !== 'near')) return;
        if (!cancelled && current.phase === 'near') snap(id, current.tip);
        else retract(id, current.tip);
      }
    );
  };

  const connect = (id: CardId) => {
    if (wireRef.current) return;
    const from = outputPort(id, positionsRef.current[id], viewRef.current!.layout);
    if (reducedRef.current) return snap(id, from);
    setWire({ from: id, tip: from, phase: 'drag' });
    animate(
      from,
      target(id),
      760,
      easeInOutCubic,
      (p) => {
        if (wireRef.current?.phase === 'drag' || wireRef.current?.phase === 'near') moveTip(id, p);
      }
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
  const draggable = layout === 'desktop';
  const port = wire ? inputPort(positions.display, inputSide(wire.from, layout)) : null;
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
    home: <HomePreview />,
    terminal: <TerminalPreview contributions={contributions} />,
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
        <svg className={styles.layer} width={design.w} height={design.h} aria-hidden>
          {wire && (
            <Wire
              source={wire.from}
              from={outputPort(wire.from, positions[wire.from], layout)}
              fromDir={direction(portSide(wire.from, layout))}
              to={wire.phase === 'snapped' && port ? port : wire.tip}
              toDir={direction(inputSide(wire.from, layout))}
              lit={wire.phase === 'snapped'}
            />
          )}
        </svg>

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
            busy={wire !== null}
            onGrab={grab(card.id)}
            onWire={startWire(card.id)}
            onConnect={() => connect(card.id)}
          >
            {previews[card.id]}
          </NodeCard>
        ))}

        <DisplayNode
          at={positions.display}
          z={order.indexOf('display') + 1}
          draggable={draggable}
          dragging={grabbed === 'display'}
          source={plugged ?? nearSource}
          state={displayState}
          inputs={inputs}
          side={wire ? inputSide(wire.from, layout) : inputs[0]}
          onGrab={grab('display')}
        />

        <svg className={styles.layer} width={design.w} height={design.h} style={{ zIndex: 10 }} aria-hidden>
          {wire && wire.phase !== 'snapped' && (
            <circle className={styles.tip} cx={wire.tip.x} cy={wire.tip.y} r={4} />
          )}
          {(wire?.phase === 'near' || wire?.phase === 'snapping') && port && !reducedRef.current && (
            <Spark source={wire.from} tip={wire.tip} port={port} />
          )}
          {plugged && burst && port && (
            <g key={burst} style={{ '--accent': `var(--accent-${plugged})` } as CSSProperties}>
              <circle className={styles.burst} cx={port.x} cy={port.y} r={6} />
            </g>
          )}
        </svg>
      </div>
    </div>
  );
}
