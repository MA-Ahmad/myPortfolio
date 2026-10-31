import type { CSSProperties } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import styles from './midnight-preview.module.css';

const TILES = [0, 1, 2, 3];
const LEVELS = ['#1a1a1d', '#38383c', '#58585d', '#85858b'];

/** The four white corners of the dashed nav, as on the real page. */
const CORNERS: CSSProperties[] = [
  { left: -1, top: -1, borderWidth: '1px 0 0 1px' },
  { right: -1, top: -1, borderWidth: '1px 1px 0 0' },
  { left: -1, bottom: -1, borderWidth: '0 0 1px 1px' },
  { right: -1, bottom: -1, borderWidth: '0 1px 1px 0' }
];

/** A ragged tear down a 28px tile: the same zigzag in both halves, different for each tile. */
function tear(seed: number) {
  const xs = [14, 12.4, 15.6, 12.8, 15.2, 13.2, 14.6, 13, 14.4];
  return xs.map((x, i) => [x + ((seed * 7 + i * 3) % 5) * 0.3 - 0.6, (i * 28) / (xs.length - 1)] as const);
}

/**
 * The midnight home page in miniature, as it ships: the pixel name, the row of four tiles torn
 * down the middle and mended one after another, the heatmap and the dashed nav with its corners.
 */
export function MidnightPreview() {
  return (
    <div className={cn(styles.root, GeistMono.className)}>
      <span className={styles.eyebrow}>Nice to meet you</span>
      <span className={styles.name} style={{ fontFamily: GeistPixelSquare.style.fontFamily }}>
        {PROFILE.displayName.toUpperCase()}
      </span>
      <i className={styles.bar} style={{ top: 58, width: 232 }} />
      <i className={styles.bar} style={{ top: 66, width: 184 }} />

      <div className={styles.row}>
        {TILES.map((seed) => {
          const points = tear(seed)
            .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
            .join(' ');
          const id = `mn-prev-${seed}`;
          return (
            <span key={seed} style={{ display: 'contents', '--delay': `${seed * 0.9}s` } as CSSProperties}>
              <span className={styles.tile}>
                <svg viewBox="0 0 28 28" width={28} height={28} aria-hidden>
                  <defs>
                    <linearGradient id={`${id}-f`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0" stopColor="#25252a" />
                      <stop offset="1" stopColor="#17171a" />
                    </linearGradient>
                    <clipPath id={`${id}-l`}>
                      <polygon points={`-6,-6 ${points} -6,34`} />
                    </clipPath>
                    <clipPath id={`${id}-r`}>
                      <polygon points={`34,-6 ${points} 34,34`} />
                    </clipPath>
                  </defs>
                  <g className={styles.halfL}>
                    <rect clipPath={`url(#${id}-l)`} x=".5" y=".5" width="27" height="27" rx="7" fill={`url(#${id}-f)`} stroke="#2b2b30" />
                  </g>
                  <g className={styles.halfR}>
                    <rect clipPath={`url(#${id}-r)`} x=".5" y=".5" width="27" height="27" rx="7" fill={`url(#${id}-f)`} stroke="#2b2b30" />
                  </g>
                </svg>
                <i className={styles.dot} />
              </span>
              {seed < TILES.length - 1 ? <span className={styles.wire} /> : null}
            </span>
          );
        })}
      </div>

      <div className={styles.cells} style={{ gridTemplateColumns: 'repeat(26, 1fr)' }}>
        {Array.from({ length: 78 }, (_, i) => (
          <i key={i} style={{ background: LEVELS[(i * 7 + (i % 5)) % 4] }} />
        ))}
      </div>

      <div className={styles.dock}>
        <span>Home</span>
        <span>Work</span>
        <span>Skills</span>
        {CORNERS.map((corner, i) => (
          <i key={i} className={styles.corner} style={corner} />
        ))}
      </div>
    </div>
  );
}
