import { type ReactNode, useState } from 'react';
import styles from '../relay.module.css';

/**
 * A word with a small drawing after it that acts out the word when pointed at: the paper plane
 * flies off and comes back, the database's discs stack, the pixels light, the heart beats. On
 * touch, a tap plays it. They are decoration for the sentence, never its only meaning.
 */

type Kind = 'plane' | 'stack' | 'pixels' | 'heart';

// The pixel grid lights in this order, not left to right.
const PIXEL_ORDER = [4, 0, 7, 2, 5, 8, 1, 6, 3];

const ICONS: Record<Kind, ReactNode> = {
  plane: (
    <svg viewBox="0 0 16 16" className={styles.microIcon}>
      <g className={styles.plane}>
        <path d="M14.5 1.5 1.5 7l5 1.6L8.2 14l2.1-4.4 4.2-8.1Z" />
        <path d="m6.5 8.6 8-7.1" />
      </g>
    </svg>
  ),
  stack: (
    <svg viewBox="0 0 16 16" className={styles.microIcon}>
      {[11.5, 8, 4.5].map((y, i) => (
        <ellipse key={y} cx="8" cy={y} rx="5.5" ry="2" className={styles.disc} style={{ '--i': i } as React.CSSProperties} />
      ))}
    </svg>
  ),
  pixels: (
    <svg viewBox="0 0 16 16" className={styles.microIcon}>
      {Array.from({ length: 9 }, (_, i) => (
        <rect
          key={i}
          x={2 + (i % 3) * 4.3}
          y={2 + Math.floor(i / 3) * 4.3}
          width="3.4"
          height="3.4"
          className={styles.pixel}
          style={{ '--i': PIXEL_ORDER.indexOf(i) } as React.CSSProperties}
        />
      ))}
    </svg>
  ),
  heart: (
    <svg viewBox="0 0 16 16" className={styles.microIcon}>
      <path
        className={styles.heart}
        d="M8 13.6S2 10.2 2 6.1A3.1 3.1 0 0 1 8 4.7a3.1 3.1 0 0 1 6 1.4c0 4.1-6 7.5-6 7.5Z"
      />
    </svg>
  )
};

export function Micro({ kind, children }: { kind: Kind; children: ReactNode }) {
  // Each tap restarts the drawing's animation by remounting it.
  const [play, setPlay] = useState(0);
  return (
    <span
      className={styles.micro}
      data-kind={kind}
      data-play={play > 0 || undefined}
      onPointerDown={(event) => event.pointerType !== 'mouse' && setPlay((p) => p + 1)}
    >
      {children}
      <span key={play} className={styles.microSlot} aria-hidden="true">
        {ICONS[kind]}
      </span>
    </span>
  );
}
