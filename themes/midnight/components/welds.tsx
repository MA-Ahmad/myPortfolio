import type { CSSProperties } from 'react';
import styles from '../midnight.module.css';

/**
 * Four ways to weld a torn tile back together, one per tile so they can be compared side by side.
 * Every part is drawn once and animated in CSS (transform, opacity and stroke offsets only) while
 * its tile is `welding`; the whole sequence fits inside WELD_MS in pipeline.tsx.
 */
export type WeldKind = 'torch' | 'spot' | 'arc' | 'molten';

type Point = [number, number];

/** Deterministic noise in [0, 1), so every tear and spark is identical on the server and in the browser. */
export function noise(a: number, b: number) {
  let h = (Math.imul(a + 1, 374761393) + Math.imul(b + 1, 668265263)) >>> 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const at = (tear: Point[], fraction: number) => tear[Math.round(fraction * (tear.length - 1))];
const toPoints = (tear: Point[]) => tear.map(([x, y]) => `${x.toFixed(2)},${y.toFixed(2)}`).join(' ');

type SparkOptions = {
  seed: number;
  x: number;
  y: number;
  count: number;
  /** When the burst starts, in ms from the start of the weld. */
  delay: number;
  /** Launch angles in degrees; 0 is right, -90 straight up, 90 straight down. */
  spread?: [number, number];
  speed?: [number, number];
  /** How far below its peak each spark falls. */
  fall?: [number, number];
  life?: [number, number];
};

/**
 * A burst of sparks. Each one flies out on its own angle (an ease-out in x), rises and then falls
 * under gravity (an ease-out to its peak, then an ease-in), cools from white to orange and fades.
 */
function Sparks({
  seed,
  x,
  y,
  count,
  delay,
  spread = [-165, -15],
  speed = [6, 13],
  fall = [9, 16],
  life = [460, 720]
}: SparkOptions) {
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => noise(seed, i * 11 + k);
        const angle = ((spread[0] + (spread[1] - spread[0]) * r(1)) * Math.PI) / 180;
        const velocity = speed[0] + (speed[1] - speed[0]) * r(2);
        const dx = Math.cos(angle) * velocity;
        const up = Math.min(0, Math.sin(angle) * velocity * 0.7);
        const down = Math.max(up, Math.sin(angle) * velocity) + fall[0] + (fall[1] - fall[0]) * r(3);
        const tail = 1 + r(6) * 1.3;
        const style = {
          '--dx': `${dx.toFixed(2)}px`,
          '--up': `${up.toFixed(2)}px`,
          '--down': `${down.toFixed(2)}px`,
          '--t': `${Math.round(life[0] + (life[1] - life[0]) * r(4))}ms`,
          '--d': `${Math.round(delay + r(5) * 70)}ms`
        } as CSSProperties;
        return (
          <g key={i} className={styles.sparkX} style={style}>
            <g className={styles.sparkY}>
              <line
                className={styles.sparkLine}
                x1="0"
                y1="0"
                x2={(-Math.cos(angle) * tail).toFixed(2)}
                y2={(-Math.sin(angle) * tail).toFixed(2)}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}

type WeldProps = { kind: WeldKind; tear: Point[]; seed: number; shape: string };

/** The weld drawn over a tile. `shape` is the id of the tile's clip path, which keeps seams on the tile. */
export function Weld({ kind, tear, seed, shape }: WeldProps) {
  const points = toPoints(tear);
  const clip = `url(#${shape})`;

  if (kind === 'torch') {
    // A white-hot bead runs down the seam, throwing sparks as it goes; the seam behind it glows
    // orange and cools to nothing.
    const emitters = [0.08, 0.25, 0.42, 0.58, 0.75, 0.92];
    return (
      <g className={styles.weld} aria-hidden>
        <g clipPath={clip}>
          <polyline points={points} pathLength={100} className={styles.torchHeat} />
          <polyline points={points} pathLength={100} className={styles.torchHalo} />
          <polyline points={points} pathLength={100} className={styles.torchHead} />
        </g>
        {emitters.map((f, i) => {
          const [x, y] = at(tear, f);
          return <Sparks key={i} seed={seed * 31 + i} x={x} y={y} count={4} delay={260 + f * 640} />;
        })}
      </g>
    );
  }

  if (kind === 'spot') {
    // Four spot welds fire down the seam; each one pulls the halves a step closer and leaves a
    // rivet mark that cools from white to iron.
    const spots = [0.15, 0.38, 0.62, 0.85];
    return (
      <g className={styles.weld} aria-hidden>
        {spots.map((f, i) => {
          const [x, y] = at(tear, f);
          const delay = 150 + i * 180;
          return (
            <g key={i}>
              <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`} style={{ '--d': `${delay}ms` } as CSSProperties}>
                <circle r="1.1" className={styles.spotMark} />
                <circle r="3" className={styles.spotRing} />
                <circle r="2.2" className={styles.spotFlash} />
              </g>
              <Sparks seed={seed * 37 + i} x={x} y={y} count={5} delay={delay} spread={[-180, 0]} speed={[5, 10]} fall={[7, 12]} life={[380, 560]} />
            </g>
          );
        })}
      </g>
    );
  }

  if (kind === 'arc') {
    // Electric arcs flicker across the gap and drag the halves together, with a jitter; they snap
    // shut in a blue-white flash and a spray of sparks.
    const bolts = [0.18, 0.34, 0.5, 0.66, 0.82].map((f, i) => {
      const [cx, cy] = at(tear, f);
      const pts: Point[] = Array.from({ length: 8 }, (_, k) => [
        cx - 6 + (12 * k) / 7,
        cy + (k === 0 || k === 7 ? 0 : (noise(seed * 41 + i, k) - 0.5) * 5)
      ]);
      return { points: toPoints(pts), delay: i * 37 };
    });
    const [mx, my] = at(tear, 0.5);
    return (
      <g className={styles.weld} aria-hidden>
        {bolts.map((bolt, i) => (
          <polyline
            key={i}
            points={bolt.points}
            className={styles.arcBolt}
            style={{ '--d': `${bolt.delay}ms` } as CSSProperties}
          />
        ))}
        <rect x=".5" y=".5" width="45" height="45" rx="10.5" className={styles.arcFlash} />
        <Sparks seed={seed * 43} x={mx} y={my} count={9} delay={500} spread={[-180, 0]} speed={[8, 15]} fall={[10, 16]} />
      </g>
    );
  }

  // Molten: the halves close, then the seam fills with molten metal from the bottom up behind a
  // white-hot front, a few drops fall from the bottom, and the seam cools from orange to iron.
  const rising = toPoints([...tear].reverse());
  const [bx, by] = at(tear, 0.97);
  return (
    <g className={styles.weld} aria-hidden>
      <g clipPath={clip}>
        <polyline points={rising} pathLength={100} className={styles.moltenGlow} />
        <polyline points={rising} pathLength={100} className={styles.moltenCore} />
        <polyline points={rising} pathLength={100} className={styles.moltenFront} />
      </g>
      <Sparks seed={seed * 47} x={bx} y={by} count={3} delay={340} spread={[70, 110]} speed={[1.5, 4]} fall={[8, 14]} life={[560, 760]} />
    </g>
  );
}
