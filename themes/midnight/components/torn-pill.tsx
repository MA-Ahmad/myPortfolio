import type { CSSProperties, ReactNode } from 'react';
import styles from '../midnight.module.css';
import { noise } from './welds';

/** Height of a pill in px: the tear is drawn in this space. */
const HEIGHT = 26;
const OVER = 8; // the clip reaches past the pill so its shadow isn't cut

/**
 * A ragged tear down the middle of a pill, built like the tiles': a slow wander across the centre,
 * an irregular zigzag on top (runs of one to four steps, each its own depth) and fibre jitter.
 * Points are x offsets from the pill's centre and y in px.
 */
function tearOf(seed: number): [number, number][] {
  const points: [number, number][] = [];
  const wanders = Array.from({ length: 5 }, (_, k) => (noise(seed, k) - 0.5) * 4);
  let dir = 1;
  let run = 0;
  let len = 1;
  for (let y = -1, i = 0; y <= HEIGHT + 1; i++) {
    const t = Math.max(0, Math.min(3.999, (y / HEIGHT) * 4));
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
    const zig = dir * (0.2 + noise(seed, 50 + i) * 1.3) * (run / len);
    const fibre = (noise(seed, 200 + i) - 0.5) * 0.7;
    points.push([wander + zig + fibre, y]);
    y += 0.7 + noise(seed, 300 + i) * 1.1;
  }
  return points;
}

/** Fine fibres standing off the exposed edge. */
function fibresOf(seed: number, tear: [number, number][]) {
  return tear.flatMap(([x, y], i) => {
    if (i % 3 || noise(seed, 400 + i) < 0.45) return [];
    const length = 0.6 + noise(seed, 420 + i) * 1.2;
    const angle = (noise(seed, 440 + i) - 0.5) * 1.2;
    return [{ x1: x, y1: y, x2: x + Math.cos(angle) * length, y2: y + Math.sin(angle) * length }];
  });
}

function clips(seed: number) {
  const tear = tearOf(seed);
  const edge = tear.map(([x, y]) => `calc(50% + ${x.toFixed(2)}px) ${y.toFixed(2)}px`).join(', ');
  return {
    fibres: fibresOf(seed, tear),
    points: tear.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' '),
    left: `polygon(-${OVER}px -${OVER}px, ${edge}, -${OVER}px calc(100% + ${OVER}px))`,
    right: `polygon(calc(100% + ${OVER}px) -${OVER}px, ${edge}, calc(100% + ${OVER}px) calc(100% + ${OVER}px))`
  };
}

/** The torn edge, as on the tiles: a narrow core band, a hairline and a few fibres, inside the pill. */
function TornEdge({ points, fibres }: { points: string; fibres: ReturnType<typeof fibresOf> }) {
  return (
    <span className={styles.pillEdge} aria-hidden>
      <svg width="100%" height={HEIGHT}>
        <svg x="50%" y="0" overflow="visible">
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
        </svg>
      </svg>
    </span>
  );
}

/**
 * A link button that rests torn down the middle, each half pulled apart and twisted, and joins
 * back together on hover or keyboard focus, the way the pipeline tiles do (no sound).
 * The whole face stays in flow so the link keeps its size and its text; the halves are decoration.
 */
export function TornPill({
  seed,
  children,
  ...link
}: {
  seed: number;
  children: ReactNode;
  href: string;
  target?: string;
  rel?: string;
}) {
  const { left, right, points, fibres } = clips(seed);
  const edge = <TornEdge points={points} fibres={fibres} />;
  return (
    <a className={styles.tornPill} {...link}>
      <span className={styles.pillFace}>{children}</span>
      <span className={styles.pillHalfL} style={{ clipPath: left } as CSSProperties} aria-hidden>
        {children}
        {edge}
      </span>
      <span className={styles.pillHalfR} style={{ clipPath: right } as CSSProperties} aria-hidden>
        {children}
        {edge}
      </span>
    </a>
  );
}
