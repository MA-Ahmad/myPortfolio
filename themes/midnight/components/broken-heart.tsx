import { type CSSProperties, useId, useState } from 'react';
import styles from '../midnight.module.css';
import { Sparks, noise } from './welds';

type Point = [number, number];

/** lucide's heart, drawn here as a solid shape in its 24 unit box. Its point is at (12, 21.3). */
const HEART =
  'M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5';

/** The heart's top notch and point, between which the seam runs. */
const TOP = 5.6;
const TIP = 21.4;

/**
 * The tiles' tear, scaled to the heart: a slow wander across the middle, an irregular zigzag on top
 * (runs of one to four steps, each its own depth) and fibre jitter. It ends on the heart's point.
 */
function tearOf(seed: number): Point[] {
  const points: Point[] = [];
  const wanders = Array.from({ length: 6 }, (_, k) => (noise(seed, k) - 0.5) * 2.2);
  let dir = 1;
  let run = 0;
  let len = 1;
  for (let y = 0, i = 0; y <= 24; i++) {
    const t = Math.max(0, Math.min(4.999, (y / 24) * 5));
    const k = Math.floor(t);
    const f = t - k;
    const ease = f * f * (3 - 2 * f);
    // Pinned to the centre at the notch and the point, so both halves keep the heart's outline.
    const pin = Math.min(1, Math.abs(y - TOP) / 2, Math.abs(y - TIP) / 2);
    const wander = (wanders[k] * (1 - ease) + wanders[k + 1] * ease) * pin;
    if (run >= len) {
      dir = -dir;
      run = 0;
      len = 1 + Math.floor(noise(seed, 80 + i) * 4);
    }
    run++;
    const zig = dir * (0.12 + noise(seed, 50 + i) * 0.75) * (run / len) * pin;
    const fibre = (noise(seed, 200 + i) - 0.5) * 0.35 * pin;
    points.push([12 + wander + zig + fibre, y]);
    y += 0.38 + noise(seed, 300 + i) * 0.55;
  }
  return points;
}

function fibresOf(seed: number, tear: Point[]) {
  return tear.flatMap(([x, y], i) => {
    if (i % 3 || y < TOP || y > TIP || noise(seed, 400 + i) < 0.45) return [];
    const length = 0.3 + noise(seed, 420 + i) * 0.6;
    const angle = (noise(seed, 440 + i) - 0.5) * 1.2 + (noise(seed, 460 + i) < 0.5 ? Math.PI : 0);
    return [{ x1: x, y1: y, x2: x + Math.cos(angle) * length, y2: y + Math.sin(angle) * length }];
  });
}

const SEED = 5;
const TEAR = tearOf(SEED);
const POINTS = TEAR.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');
const FIBRES = fibresOf(SEED, TEAR);
/** The seam the weld runs up: only the part inside the heart, from the point to the notch. */
const SEAM_POINTS = TEAR.filter(([, y]) => y >= TOP - 0.6 && y <= TIP + 0.4)
  .reverse()
  .map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`)
  .join(' ');
/** Where along the seam (0 = point, 1 = notch) sparks are thrown, as the weld passes. */
const EMITTERS = [0.12, 0.34, 0.56, 0.78, 0.96];
/** The weld runs from the point to the notch in this long, in ms (the CSS uses the same). */
const ZIP_MS = 560;

function seamAt(fraction: number): Point {
  const y = TIP - (TIP - TOP) * fraction;
  return TEAR.reduce((best, p) => (Math.abs(p[1] - y) < Math.abs(best[1] - y) ? p : best));
}

const LABELS = [
  'Broken heart. Press to bring the halves closer.',
  'Halves closer. Press to bring them closer still.',
  'Almost together. Press to mend the heart.',
  'Heart mended. Press to break it again.'
];

/**
 * A heart torn in two, drawn and torn like the pipeline tiles: a solid bevelled heart, split down
 * the middle along a ragged tear, each half dimmed and twisted open about the heart's point. Each
 * press brings the halves closer. The third welds them: a white-hot bead runs up the seam from the
 * point to the notch, throwing sparks, the gap closing under it and the heart whole behind it.
 * Then the heart warms, grows and glows. One more press tears it again.
 */
export function BrokenHeart() {
  const id = useId().replace(/:/g, '');
  const [stage, setStage] = useState(0);
  const art = `${id}-art`;
  return (
    <button
      type="button"
      className={styles.heart}
      data-stage={stage}
      aria-label={LABELS[stage]}
      style={{ '--zip': `${ZIP_MS}ms` } as CSSProperties}
      onClick={() => setStage((current) => (current + 1) % 4)}
    >
      <svg viewBox="0 0 24 24" width={32} height={32} aria-hidden>
        <defs>
          <linearGradient id={`${id}-fill`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#222226" />
            <stop offset="1" stopColor="#141416" />
          </linearGradient>
          <linearGradient id={`${id}-lit`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a2614" />
            <stop offset="1" stopColor="#1f150c" />
          </linearGradient>
          <linearGradient id={`${id}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#fff" stopOpacity=".07" />
            <stop offset=".45" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`${id}-l`}>
            <polygon points={`-6,-6 ${POINTS} -6,30`} />
          </clipPath>
          <clipPath id={`${id}-r`}>
            <polygon points={`30,-6 ${POINTS} 30,30`} />
          </clipPath>
          {/* The torn edge stays on the heart: nothing it draws reaches past the outline. */}
          <clipPath id={`${id}-shape`}>
            <path d={HEART} />
          </clipPath>
          <g id={art}>
            <path d={HEART} fill={`url(#${id}-fill)`} stroke="#2e2e34" strokeWidth=".55" />
            <path d={HEART} fill={`url(#${id}-sheen)`} />
          </g>
          <g id={`${id}-edge`} clipPath={`url(#${id}-shape)`}>
            <polyline
              points={POINTS}
              fill="none"
              stroke="#2a2a2f"
              strokeWidth="1"
              strokeLinejoin="bevel"
            />
            <polyline
              points={POINTS}
              fill="none"
              stroke="#3c3c43"
              strokeWidth=".28"
              strokeLinejoin="bevel"
            />
            {FIBRES.map((f, i) => (
              <line
                key={i}
                {...f}
                stroke="#45454c"
                strokeWidth=".18"
                strokeLinecap="round"
                opacity=".5"
              />
            ))}
          </g>
        </defs>

        <g className={styles.heartL}>
          <g clipPath={`url(#${id}-l)`}>
            <use href={`#${art}`} />
            <use href={`#${id}-edge`} />
          </g>
        </g>
        <g className={styles.heartR}>
          <g clipPath={`url(#${id}-r)`}>
            <use href={`#${art}`} />
            <use href={`#${id}-edge`} />
          </g>
        </g>

        {/* Whole behind the weld: uncovered from the point up, level with the bead. */}
        <use href={`#${art}`} className={styles.heartWhole} />
        {/* Mended: the heart warms from inside. */}
        <path
          d={HEART}
          className={styles.heartLit}
          fill={`url(#${id}-lit)`}
          stroke="#f5a524"
          strokeOpacity=".7"
          strokeWidth=".6"
        />

        <g className={styles.heartWeld} clipPath={`url(#${id}-shape)`}>
          <polyline points={SEAM_POINTS} pathLength={100} className={styles.heartHeat} />
          <polyline points={SEAM_POINTS} pathLength={100} className={styles.heartBead} />
        </g>
        <g className={styles.heartWeld}>
          {EMITTERS.map((f, i) => {
            const [x, y] = seamAt(f);
            return (
              <Sparks
                key={i}
                seed={SEED * 31 + i}
                x={x}
                y={y}
                count={3}
                delay={f * ZIP_MS}
                speed={[2.4, 5]}
                fall={[3, 6]}
                life={[360, 560]}
              />
            );
          })}
        </g>
      </svg>
    </button>
  );
}
