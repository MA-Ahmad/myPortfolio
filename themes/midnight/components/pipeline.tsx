import { CSSProperties, useCallback, useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { FlaskConical, Hammer, PenTool, Rocket } from 'lucide-react';
import { cn } from 'lib/cn';
import { PIPELINE_LABELS, type NodeKind } from '../content';
import styles from '../midnight.module.css';
import { Weld, noise, type WeldKind } from './welds';
import { playTear, playWeld, unlockAudio } from '../lib/weld-sound';

const NODES: NodeKind[] = ['design', 'build', 'test', 'ship'];

const ICONS = {
  design: PenTool,
  build: Hammer,
  test: FlaskConical,
  ship: Rocket
};

/** One loop of the animation, in ms: a box is welded, the glow line crosses to the next, and so on. */
const WELD_MS = 1300;
const PULSE_MS = 560;
const HOLD_MS = 1600;
const BREAK_MS = 900;
const START_MS = 250;

type NodeState = 'broken' | 'welding' | 'fixed';

/**
 * One weld per tile, to compare. `joinAt` is when the halves have fully met (the torn edges fade
 * from then); `closeMs` is how long they take when they simply slide shut. The torch and molten welds
 * zip instead: see "Zip" in midnight.module.css.
 */
const WELDS: { kind: WeldKind; joinAt: number; closeMs: number }[] = [
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
 * One tile, front on, as in the reference: torn down the middle into two halves that are each a
 * clipped copy of the same tile, and both show the same torn edge: a narrow band of the card's core
 * with a few fibres, kept inside the tile's outline. While `whole`, the halves close and the edges fade.
 */
function TornTile({ id, index }: { id: NodeKind; index: number }) {
  const Icon = ICONS[id];
  const { tear, points, fibres } = TEARS[index];
  const name = `mn-tile-${index}`;
  return (
    <svg className={styles.tile} viewBox="0 0 46 46" width={46} height={46} aria-hidden>
      <defs>
        <linearGradient id={`${name}-fill`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1d1d20" />
          <stop offset="1" stopColor="#141416" />
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
          <polyline
            points={points}
            fill="none"
            stroke="#2a2a2f"
            strokeWidth="2"
            strokeLinejoin="bevel"
          />
          <polyline
            points={points}
            fill="none"
            stroke="#3c3c43"
            strokeWidth=".5"
            strokeLinejoin="bevel"
          />
          {fibres.map((f, i) => (
            <line
              key={i}
              {...f}
              stroke="#45454c"
              strokeWidth=".35"
              strokeLinecap="round"
              opacity=".5"
            />
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
            stroke="#2b2b30"
          />
          <rect
            x="1.5"
            y="1.5"
            width="43"
            height="43"
            rx="9.5"
            fill="none"
            stroke="rgba(255,255,255,.035)"
          />
          <circle cx="38" cy="8" r="2.1" fill="#3a3a40" />
          <Icon x={8} y={25} size={14} strokeWidth={1.7} color="#5a5a62" />
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
      <Weld kind={WELDS[index].kind} tear={tear} seed={index + 1} shape={`${name}-shape`} />
    </svg>
  );
}

function Node({
  id,
  index,
  state,
  run
}: {
  id: NodeKind;
  index: number;
  state: NodeState;
  run: boolean;
}) {
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
      <span className={cn(styles.label, styles.mono)}>{PIPELINE_LABELS[id]}</span>
      <span className={styles.tileRow}>
        <span className={styles.boxWrap}>
          <TornTile id={id} index={index} />
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

/**
 * Hero illustration. Every tile starts torn down the middle and dimmed. Click and the tiles close
 * one at a time, with a glow line carrying on along the wire to the next. When the last is whole
 * they all tear again and the loop restarts. (The weld itself comes later.)
 */
export function Pipeline() {
  const reduced = useReducedMotion();
  const [states, setStates] = useState<NodeState[]>(() => NODES.map(() => 'broken'));
  const [pulse, setPulse] = useState<number | null>(null);
  const [width, setWidth] = useState(0);
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
    setWidth(wire.offsetWidth);
    return () => observer.disconnect();
  }, []);

  const set = useCallback((index: number | 'all', state: NodeState) => {
    setStates((current) =>
      current.map((value, i) => (index === 'all' || i === index ? state : value))
    );
  }, []);

  const loop = useCallback(() => {
    let t = START_MS;
    NODES.forEach((_, index) => {
      at(t, () => {
        set(index, 'welding');
        playWeld(WELDS[index].kind);
      });
      at(t + WELD_MS, () => set(index, 'fixed'));
      t += WELD_MS;
      if (index < NODES.length - 1) {
        at(t - 120, () => setPulse(index));
        t += PULSE_MS - 120;
        at(t, () => setPulse(null));
      }
    });
    at(t + HOLD_MS, () => {
      set('all', 'broken');
      playTear();
    });
    at(t + HOLD_MS + BREAK_MS, loop);
  }, [set]);

  // The animation starts as soon as the page is shown, tiles torn, and then loops. (Browsers keep
  // sound off until the first click, so the first loop plays silently.)
  useEffect(() => {
    if (reduced !== false) return;
    const timer = window.setTimeout(loop, 350);
    return () => {
      window.clearTimeout(timer);
      clear();
    };
  }, [reduced, loop]);

  const replay = () => {
    // A click is the gesture that lets the browser play sound.
    unlockAudio();
    clear();
    setPulse(null);
    if (reduced) {
      // No loop for reduced motion: the click just makes the boxes whole, or tears them again.
      const whole = states.every((state) => state === 'fixed');
      set('all', whole ? 'broken' : 'fixed');
      return;
    }
    // Start again from the top: tear everything, then weld the tiles one after another.
    if (states.some((state) => state !== 'broken')) playTear();
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
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          replay();
        }
      }}
    >
      {NODES.map((id, index) => (
        <Node key={id} id={id} index={index} state={states[index]} run={pulse === index} />
      ))}
    </div>
  );
}
