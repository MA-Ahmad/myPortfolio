import type { CSSProperties, PointerEvent, Ref } from 'react';
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
  ref?: Ref<HTMLElement>;
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
  /** How many packets have landed; each one brightens the glow. */
  swell: number;
  /** The node's size about its center, as it swells with each packet. */
  scale: number;
  /** Hidden under the screen that grows out of it. */
  lifted: boolean;
  /** Set when a wire was just pulled out; `key` replays the power-down, tinted for `source`. */
  powerOff: { key: number; source: CardId } | null;
  onGrab: (event: PointerEvent) => void;
  /** A press on the plugged-in input, which pulls the wire back out. */
  onUnplug: (event: PointerEvent) => void;
};

export function DisplayNode({
  ref,
  at,
  z,
  draggable,
  dragging,
  source,
  state,
  inputs,
  side,
  swell,
  scale,
  lifted,
  powerOff,
  onGrab,
  onUnplug
}: Props) {
  const card = source ? cardById(source) : null;
  const open = state === 'open';

  const status =
    state === 'open' && card
      ? `Opening ${card.title}…`
      : state === 'near' && card
        ? `Release to open ${card.title}`
        : state === 'armed'
          ? 'Drop the wire on an input'
          : 'Awaiting input';

  return (
    <article
      ref={ref}
      className={styles.display}
      data-dragging={dragging || undefined}
      data-lit={open || undefined}
      data-shake={open || undefined}
      data-side={side}
      data-lifted={lifted || undefined}
      aria-label="Display"
      style={
        {
          '--accent': card ? `var(--accent-${card.id})` : 'var(--cv-muted)',
          '--swell': swell,
          width: DISPLAY_W,
          height: DISPLAY_H,
          zIndex: z,
          // Scaled inside the transform, so it swells about its own center.
          transform: `translate3d(${at.x}px, ${at.y}px, 0) scale(${scale})`
        } as CSSProperties
      }
    >
      {(state === 'near' || open) && <Trace key={state} side={side} loop={!open} />}

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

      {/* An old set switching off: the picture squashes to a line, the line to a dot. A span, so
          the screen that copies this node's rows never mistakes it for them. */}
      {powerOff && (
        <span
          key={powerOff.key}
          className={styles.powerOff}
          style={{ '--off-accent': `var(--accent-${powerOff.source})`, top: DISPLAY_HEADER_H } as CSSProperties}
          aria-hidden
        />
      )}

      {inputs.map((input) => {
        const plugged = open && input === side;
        return (
          <span
            key={input}
            className={`${styles.port} ${styles.input}`}
            data-side={input}
            data-near={(input === side && (state === 'near' || open)) || undefined}
            data-plugged={plugged || undefined}
            aria-hidden
            style={{ left: input === 'left' ? -1 : 'calc(100% + 1px)', top: DISPLAY_INPUT_Y - 1 }}
            onPointerDown={plugged ? onUnplug : undefined}
          />
        );
      })}
    </article>
  );
}

// The node outline traced on its 1px border: half a pixel in, corner radius 14 less that half.
const E = 0.5;
const R = 13.5;
const RIGHT = DISPLAY_W - E;
const BOTTOM = DISPLAY_H - E;
const Y = DISPLAY_INPUT_Y;
// From the left input, one half goes up and over the top, the other down and under the bottom;
// they meet on the right edge.
const UP = `M${E} ${Y} V${E + R} A${R} ${R} 0 0 1 ${E + R} ${E} H${RIGHT - R} A${R} ${R} 0 0 1 ${RIGHT} ${E + R} V${Y}`;
const DOWN = `M${E} ${Y} V${BOTTOM - R} A${R} ${R} 0 0 0 ${E + R} ${BOTTOM} H${RIGHT - R} A${R} ${R} 0 0 0 ${RIGHT} ${BOTTOM - R} V${Y}`;

const TRACE_LAYERS = [
  { className: styles.traceHalo, opacity: 0.7 },
  { className: styles.traceCore, opacity: 1 },
];

/**
 * Light running from the input around the border both ways, meeting on the far side. It loops
 * while a wire is close enough to plug in and runs once when it does.
 */
function Trace({ side, loop }: { side: Side; loop: boolean }) {
  return (
    <svg
      className={styles.trace}
      data-loop={loop || undefined}
      width={DISPLAY_W}
      height={DISPLAY_H}
      viewBox={`0 0 ${DISPLAY_W} ${DISPLAY_H}`}
      aria-hidden
    >
      <g transform={side === 'right' ? `matrix(-1 0 0 1 ${DISPLAY_W} 0)` : undefined}>
        {[UP, DOWN].map((d) => (
          <g key={d}>
            {TRACE_LAYERS.map(({ className, opacity }) => (
              <g key={className} opacity={opacity}>
                <path className={`${styles.traceLayer} ${className}`} d={d} pathLength={100} />
              </g>
            ))}
          </g>
        ))}
      </g>
    </svg>
  );
}
