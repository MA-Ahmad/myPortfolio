import type { CSSProperties } from 'react';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { Pipeline } from 'themes/midnight/components/pipeline';
import styles from './midnight-preview.module.css';

const LEVELS = ['#1a1a1d', '#38383c', '#58585d', '#85858b'];

/** The four white corners of the dashed nav, as on the real page. */
const CORNERS: CSSProperties[] = [
  { left: -1, top: -1, borderWidth: '1px 0 0 1px' },
  { right: -1, top: -1, borderWidth: '1px 1px 0 0' },
  { left: -1, bottom: -1, borderWidth: '0 0 1px 1px' },
  { right: -1, bottom: -1, borderWidth: '0 1px 1px 0' }
];

/**
 * The midnight home page in miniature, as it ships: the pixel name, the row of four tiles torn
 * down the middle and welded one after another, by the page's own Pipeline, the heatmap and the dashed nav with its corners.
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

      {/* The real pipeline, as on the page, scaled down to 36px tiles and silent. */}
      <div className={styles.pipe}>
        <Pipeline preview />
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
