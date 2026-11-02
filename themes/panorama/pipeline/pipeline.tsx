import {
  type CSSProperties,
  type KeyboardEvent,
  memo,
  useCallback,
  useEffect,
  useRef,
  useState
} from 'react';
import { FlaskConical, Hammer, PenTool, Rocket } from 'lucide-react';
import { cn } from 'lib/cn';
import { noise } from '../torn/tear';
import { TileWeld, type TileWeldKind } from './tile-welds';
import styles from './pipeline.module.css';

const NODES = [
  { id: 'design', label: 'Design', Icon: PenTool },
  { id: 'build', label: 'Build', Icon: Hammer },
  { id: 'test', label: 'Test', Icon: FlaskConical },
  { id: 'ship', label: 'Ship', Icon: Rocket }
] as const;

/** One loop of the animation, in ms: a box is welded, the glow line crosses to the next, and so on. */
const WELD_MS = 1300;
const PULSE_MS = 560;
const HOLD_MS = 1600;
const BREAK_MS = 900;
const START_MS = 250;

type NodeState = 'broken' | 'welding' | 'fixed';

/**
 * One weld per tile. `joinAt` is when the halves have fully met (the torn edges fade from then);
 * `closeMs` is how long they take when they simply slide shut.
 */
const WELDS: { kind: TileWeldKind; joinAt: number; closeMs: number }[] = [
  { kind: 'torch', joinAt: 900, closeMs: 260 },
  { kind: 'spot', joinAt: 730, closeMs: 0 },
  { kind: 'arc', joinAt: 520, closeMs: 0 },
  { kind: 'molten', joinAt: 820, closeMs: 300 }
];

/**
 * A tear down the middle of a 46px tile: a slow wander across the centre, an irregular zigzag on
 * top (runs of one to four steps, each its own depth), and fibre jitter on top of that.
 */
function tearOf(seed: number): [number, number][] {
  const points: [number, number][] = [];
  const wanders = Array.from({ length: 7 }, (_, k) => (noise(seed, k) - 0.5) * 7);
  let dir = 1;
  let run = 0;
  let len = 1;
  for (let y = -1, i = 0; y <= 47; i++) {
    const t = Math.max(0, Math.min(5.999, (y / 46) * 6));
    const k = Math.floor(t);
    const f = t - k;
    const ease = f * f * (3 - 2 * f);
    const wander = wanders[k] * (1 - ease) + wanders[k + 1] * ease;
    if (run >= len) {
      dir = -dir;
      run = 0;
      len = 1 + Math.floor(noise(seed, 80 + i) * 4);
    }
    run++;
    const zig = dir * (0.25 + noise(seed, 50 + i) * 1.5) * (run / len);
    const fibre = (noise(seed, 200 + i) - 0.5) * 0.7;
    points.push([23 + wander + zig + fibre, y]);
    y += 0.7 + noise(seed, 300 + i) * 1.1;
  }
  return points;
}

/** Fine fibres standing off the exposed edge, as on torn card. */
function fibresOf(seed: number, tear: [number, number][]) {
  return tear.flatMap(([x, y], i) => {
    if (i % 3 || noise(seed, 400 + i) < 0.45) return [];
    const length = 0.6 + noise(seed, 420 + i) * 1.2;
    const angle = (noise(seed, 440 + i) - 0.5) * 1.2;
    return [{ x1: x, y1: y, x2: x + Math.cos(angle) * length, y2: y + Math.sin(angle) * length }];
  });
}

const TEARS = NODES.map((_, index) => {
  const tear = tearOf(index);
  const points = tear.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
  return { tear, points, fibres: fibresOf(index, tear) };
});

/**
 * One tile, torn down the middle into two halves that are each a clipped copy of the same tile,
 * both showing the same torn edge, kept inside the tile's outline. While whole, the halves close
 * and the edges fade. It never changes, so it renders once.
 */
const TornTile = memo(function TornTile({ index }: { index: number }) {
  const { Icon } = NODES[index];
  const { tear, points, fibres } = TEARS[index];
  const name = `pn-tile-${index}`;
  return (
    <svg className={styles.tile} viewBox="0 0 46 46" width={46} height={46} aria-hidden>
      <defs>
        <linearGradient id={`${name}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" className={styles.tileTop} />
          <stop offset="1" className={styles.tileBottom} />
        </linearGradient>
        <clipPath id={`${name}-l`}>
          <polygon points={`-8,-8 ${points} -8,54`} />
        </clipPath>
        <clipPath id={`${name}-r`}>
          <polygon points={`54,-8 ${points} 54,54`} />
        </clipPath>
        {/* The torn edge stays on the tile: nothing it draws reaches past the tile's outline. */}
        <clipPath id={`${name}-shape`}>
          <rect x=".5" y=".5" width="45" height="45" rx="10.5" />
        </clipPath>
        <g id={`${name}-edge`} className={styles.edge} clipPath={`url(#${name}-shape)`}>
          <polyline points={points} className={styles.edgeBand} />
          <polyline points={points} className={styles.edgeHair} />
          {fibres.map((f, i) => (
            <line key={i} {...f} className={styles.edgeFibre} />
          ))}
        </g>
        <g id={`${name}-art`}>
          <rect
            x=".5"
            y=".5"
            width="45"
            height="45"
            rx="10.5"
            fill={`url(#${name}-fill)`}
            className={styles.tileBody}
          />
          <rect x="1.5" y="1.5" width="43" height="43" rx="9.5" className={styles.tileInner} />
          <circle cx="38" cy="8" r="2.1" className={styles.tileLed} />
          <Icon x={8} y={25} size={14} strokeWidth={1.7} className={styles.tileIcon} />
        </g>
      </defs>
      <g className={styles.halfL}>
        <g clipPath={`url(#${name}-l)`}>
          <use href={`#${name}-art`} />
          <use href={`#${name}-edge`} />
        </g>
      </g>
      <g className={styles.halfR}>
        <g clipPath={`url(#${name}-r)`}>
          <use href={`#${name}-art`} />
          <use href={`#${name}-edge`} />
        </g>
      </g>
      {/* Once the halves meet, one unclipped tile fades in over them, so no seam is left behind. */}
      <use href={`#${name}-art`} className={styles.joined} />
      <TileWeld kind={WELDS[index].kind} tear={tear} seed={index + 1} shape={`${name}-shape`} />
    </svg>
  );
});

function Node({ index, state, run }: { index: number; state: NodeState; run: boolean }) {
  const last = index === NODES.length - 1;
  return (
    <div
      className={styles.node}
      data-state={state}
      data-weld={WELDS[index].kind}
      style={
        {
          // Tiles tear apart right to left, a beat apart.
          '--break-delay': `${(NODES.length - 1 - index) * 50}ms`,
          '--join-at': `${WELDS[index].joinAt}ms`,
          '--close-ms': `${WELDS[index].closeMs}ms`
        } as CSSProperties
      }
    >
      <span className={styles.label}>{NODES[index].label}</span>
      <span className={styles.tileRow}>
        <span className={styles.boxWrap}>
          <TornTile index={index} />
          <span className={styles.dot} aria-hidden />
          <span
            className={cn(styles.port, styles.port_l)}
            aria-hidden
            data-hide={index === 0 || undefined}
          />
          <span
            className={cn(styles.port, styles.port_r)}
            aria-hidden
            data-hide={last || undefined}
          />
        </span>
        {last ? null : (
          <span className={styles.wire} aria-hidden>
            <i className={styles.spark} data-run={run || undefined} />
          </span>
        )}
      </span>
    </div>
  );
}

const useReducedMotion = () => {
  const [reduced, setReduced] = useState<boolean | null>(null);
  useEffect(() => {
    const list = window.matchMedia('(prefers-reduced-motion: reduce)');
    const update = () => setReduced(list.matches);
    update();
    list.addEventListener('change', update);
    return () => list.removeEventListener('change', update);
  }, []);
  return reduced;
};

/**
 * Design, build, test, ship, as on the Midnight theme. Every tile starts torn down the middle and
 * dimmed; the tiles weld shut one at a time, with a glow line running along the wire to the next.
 * When the last is whole they all tear again and the loop restarts. It makes no sound. It only runs
 * while its section is open; clicking it starts it again from the top.
 */
export function Pipeline() {
  const reduced = useReducedMotion();
  const [states, setStates] = useState<NodeState[]>(() => NODES.map(() => 'broken'));
  const [pulse, setPulse] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
  const [shown, setShown] = useState(false);
  const flowRef = useRef<HTMLDivElement>(null);
  const timers = useRef<number[]>([]);

  const clear = () => {
    timers.current.forEach((timer) => window.clearTimeout(timer));
    timers.current = [];
  };
  const at = (ms: number, fn: () => void) => {
    timers.current.push(window.setTimeout(fn, ms));
  };
  useEffect(() => clear, []);

  // The glow line travels the full width of a wire; every wire is the same width.
  useEffect(() => {
    const wire = flowRef.current?.querySelector<HTMLElement>(`.${styles.wire}`);
    if (!wire) return;
    const observer = new ResizeObserver(() => setWidth(wire.offsetWidth));
    observer.observe(wire);
    return () => observer.disconnect();
  }, []);

  // Whether its section is the open one.
  useEffect(() => {
    const section = flowRef.current?.closest('section');
    if (!section) return;
    const update = () => setShown(section.hasAttribute('data-open'));
    update();
    const observer = new MutationObserver(update);
    observer.observe(section, { attributes: true, attributeFilter: ['data-open'] });
    return () => observer.disconnect();
  }, []);

  const set = useCallback((index: number | 'all', state: NodeState) => {
    setStates((current) =>
      current.map((value, i) => (index === 'all' || i === index ? state : value))
    );
  }, []);

  const loop = useCallback(() => {
    const round = () => {
      let t = START_MS;
      NODES.forEach((_, index) => {
        at(t, () => set(index, 'welding'));
        at(t + WELD_MS, () => set(index, 'fixed'));
        t += WELD_MS;
        if (index < NODES.length - 1) {
          at(t - 120, () => setPulse(index));
          t += PULSE_MS - 120;
          at(t, () => setPulse(null));
        }
      });
      at(t + HOLD_MS, () => set('all', 'broken'));
      at(t + HOLD_MS + BREAK_MS, round);
    };
    round();
  }, [set]);

  // Runs while the section is open, a beat after it opens; closing it stops the loop and tears
  // the tiles again, ready for next time.
  useEffect(() => {
    if (reduced !== false || !shown) return;
    const timer = window.setTimeout(loop, 600);
    return () => {
      window.clearTimeout(timer);
      clear();
      setPulse(null);
      set('all', 'broken');
    };
  }, [reduced, shown, loop, set]);

  const replay = () => {
    clear();
    setPulse(null);
    if (reduced) {
      // No loop for reduced motion: the click just makes the boxes whole, or tears them again.
      set('all', states.every((state) => state === 'fixed') ? 'broken' : 'fixed');
      return;
    }
    set('all', 'broken');
    at(BREAK_MS, loop);
  };

  return (
    <div
      ref={flowRef}
      className={styles.flow}
      style={{ '--w': `${width}px` } as CSSProperties}
      role="button"
      tabIndex={0}
      aria-label="Replay the weld animation: design, build, test, ship"
      onClick={replay}
      onKeyDown={(event: KeyboardEvent) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          replay();
        }
      }}
    >
      {NODES.map((node, index) => (
        <Node key={node.id} index={index} state={states[index]} run={pulse === index} />
      ))}
    </div>
  );
}
