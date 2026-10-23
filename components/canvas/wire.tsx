import type { CSSProperties } from 'react';
import { type Point, wirePath } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import type { CardId } from './nodes';

type Props = {
  source: CardId;
  from: Point;
  fromDir: number;
  to: Point;
  toDir: number;
  lit: boolean;
};

export function Wire({ source, from, fromDir, to, toDir, lit }: Props) {
  const d = wirePath(from, fromDir, to, toDir);
  return (
    <g style={{ '--accent': `var(--accent-${source})` } as CSSProperties}>
      {/* data-wire: the stage redraws these each frame while the display swells. */}
      <path className={styles.wireGlow} data-lit={lit || undefined} data-wire d={d} />
      <path className={styles.wire} data-lit={lit || undefined} data-wire d={d} />
    </g>
  );
}
