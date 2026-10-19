import type { CSSProperties, PointerEvent } from 'react';
import { GripVertical, Monitor } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import {
  type CardId,
  DISPLAY_FOOTER_H,
  DISPLAY_H,
  DISPLAY_HEADER_H,
  DISPLAY_INPUT_Y,
  DISPLAY_W,
  type Side,
  cardById
} from './nodes';

export type DisplayState = 'idle' | 'armed' | 'near' | 'open';

type Props = {
  at: Point;
  z: number;
  draggable: boolean;
  dragging: boolean;
  /** The card whose wire is near or plugged in, which tints the node. */
  source: CardId | null;
  state: DisplayState;
  /** The inputs cards can reach in this layout. */
  inputs: Side[];
  /** The input the current source plugs into. */
  side: Side;
  onGrab: (event: PointerEvent) => void;
};

export function DisplayNode({ at, z, draggable, dragging, source, state, inputs, side, onGrab }: Props) {
  const card = source ? cardById(source) : null;
  const open = state === 'open';

  const status =
    state === 'open' && card
      ? `Opening ${card.title}…`
      : state === 'near' && card
        ? `Signal from ${card.title}`
        : state === 'armed'
          ? 'Drop the wire on source'
          : 'Awaiting input';

  return (
    <article
      className={styles.display}
      data-dragging={dragging || undefined}
      data-lit={open || undefined}
      data-side={side}
      aria-label="Display"
      style={
        {
          '--accent': card ? `var(--accent-${card.id})` : 'var(--cv-muted)',
          width: DISPLAY_W,
          height: DISPLAY_H,
          zIndex: z,
          transform: `translate3d(${at.x}px, ${at.y}px, 0)`
        } as CSSProperties
      }
    >
      <header
        className={styles.header}
        style={{ height: DISPLAY_HEADER_H - 1 }}
        data-draggable={draggable || undefined}
        onPointerDown={draggable ? onGrab : undefined}
      >
        {draggable && (
          <span className={styles.grip} aria-hidden>
            <GripVertical className="size-3.5" />
          </span>
        )}
        <span className={styles.icon} aria-hidden>
          <Monitor className="size-3.5" />
        </span>
        Display
        <span className={styles.meta}>full page</span>
      </header>

      <div className={styles.rows}>
        <div className={styles.row}>
          source
          <span className={styles.value}>
            {open && card ? (
              <>
                {card.title.toLowerCase()}
                <svg className={styles.check} viewBox="0 0 16 16" fill="none" aria-hidden>
                  <path
                    d="M3.5 8.5l3 3 6-7"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </>
            ) : (
              '—'
            )}
          </span>
        </div>
        <div className={styles.row}>
          route
          <span className={styles.value}>{open && card ? card.route : '—'}</span>
        </div>
        <div className={styles.row}>
          transition
          <span className={styles.value}>pixel</span>
        </div>
      </div>

      <div
        className={styles.status}
        style={{ height: DISPLAY_FOOTER_H - 1 }}
        data-state={state}
        role="status"
      >
        <span className={styles.dot} aria-hidden />
        {status}
      </div>

      {inputs.map((input) => (
        <span
          key={input}
          className={`${styles.port} ${styles.input}`}
          data-side={input}
          data-near={(input === side && (state === 'near' || open)) || undefined}
          aria-hidden
          style={{ left: input === 'left' ? -1 : '100%', top: DISPLAY_INPUT_Y - 1 }}
        />
      ))}
    </article>
  );
}
