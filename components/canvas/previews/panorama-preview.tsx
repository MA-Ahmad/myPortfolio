import { useEffect, useRef } from 'react';
import { PROFILE } from 'data/profile';
import type { Activity } from 'lib/github-contributions';
import { SECTIONS } from 'themes/panorama/content';
import moon from 'themes/panorama/torn/moon.png';
import { SKY_DEFAULTS, drawPixelSky } from 'themes/panorama/torn/pixel-sky';
import { fibresOf, noise, tearOf } from 'themes/panorama/torn/tear';
import styles from './panorama-preview.module.css';

// The page's sheet is drawn here at about this share of its size: tears, their gap and the sky's grid.
const SCALE = 0.3;
// Half the crack between two torn edges, in the page's own px (GAP in themes/panorama/torn/sheet.ts).
const GAP = 3.4;
// The seams' seeds, as the page's sheet numbers them (createSheet in torn/sheet.ts).
const SEEDS = [11, 28, 45];
// Each seam's strip is this wide; the tear wanders well inside it.
const STRIP = 16;
// Tall enough for the card at either layout's height.
const TEAR_LENGTH = 220 / SCALE;
// The page's own field of pixels on a finer grid, and stronger, so it reads at this size.
const SKY = { ...SKY_DEFAULTS, cell: 3, size: 1, reach: 0.62, brightness: 0.55, twinkles: 0 };
const WEEKS = 30;
// Shown when the contributions could not be fetched: a plausible, mostly quiet half year.
const QUIET = Array.from({ length: WEEKS * 7 }, (_, i) => ({ level: Math.max(0, Math.floor(noise(i, 3) * 7) - 2) }));

const SEAMS = SEEDS.map((seed) => {
  const tear = tearOf(seed, TEAR_LENGTH);
  const edge = (side: 1 | -1) => tear.map(([x, y]) => `${(x + side * GAP).toFixed(1)},${y.toFixed(1)}`);
  return { seed, crack: [...edge(-1), ...edge(1).reverse()].join(' '), fibres: fibresOf(seed, tear) };
});

/**
 * The panorama page in miniature, built from the page's own parts: one near-black sheet torn into
 * its four sections along the same tears (the crack showing the page behind, fibres standing off
 * the edges), the night's field of pixels gathered along the top, the moon, and the open Intro with
 * the name over the last weeks of contributions in the page's cells.
 */
export function PanoramaPreview({ contributions }: { contributions: Activity[] }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const skyRef = useRef<HTMLCanvasElement>(null);
  const [open, ...closed] = SECTIONS;
  const days = contributions.slice(-WEEKS * 7);
  const total = contributions.reduce((sum, day) => sum + day.count, 0);

  useEffect(() => {
    const sheet = sheetRef.current;
    const sky = skyRef.current;
    if (!sheet || !sky) return;
    const draw = () => drawPixelSky(sky, sheet.clientWidth, sheet.clientHeight, SKY);
    draw();
    const observer = new ResizeObserver(draw);
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  return (
    <div className={styles.root}>
      <div ref={sheetRef} className={styles.sheet}>
        <canvas ref={skyRef} className={styles.sky} />
        <i className={styles.moon} style={{ backgroundImage: `url(${moon.src})` }} />

        <span className={styles.open}>{open.label}</span>
        <div className={styles.intro}>
          <span className={styles.name}>{PROFILE.displayName}</span>
          <div className={styles.cells} style={{ gridTemplateColumns: `repeat(${WEEKS}, 4px)` }}>
            {(days.length ? days : QUIET).map(
              (day, i) => (
                <i key={i} data-level={day.level} />
              )
            )}
          </div>
          {total > 0 && <span className={styles.caption}>{total.toLocaleString('en-US')} contributions in the last year</span>}
        </div>

        {closed.map((section, i) => (
          <span key={section.id} className={styles.closed} style={{ left: `${(9.5 + i) * (100 / 12)}%` }}>
            {section.label}
          </span>
        ))}

        {SEAMS.map(({ seed, crack, fibres }, i) => (
          <svg
            key={seed}
            className={styles.seam}
            style={{ left: `calc(${(9 + i) * (100 / 12)}% - ${STRIP / 2}px)` }}
            width={STRIP}
            height="100%"
            aria-hidden
          >
            <g transform={`translate(${STRIP / 2} 0) scale(${SCALE})`}>
              <polygon points={crack} className={styles.crack} />
              <path d={fibres} className={styles.fibre} />
            </g>
          </svg>
        ))}
      </div>
    </div>
  );
}
