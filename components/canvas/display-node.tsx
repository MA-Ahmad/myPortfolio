import { type CSSProperties, type PointerEvent, type Ref, useState } from 'react';
import { GripVertical, Monitor } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import { SendProgress } from './send-progress';
import { type CardId, DISPLAY_HEADER_H, DISPLAY_SCREEN_H, type Layout, type Side, cardById, displaySize } from './nodes';

// The page in the display's screen is laid out this wide and scaled down to fit, so it shows the
// theme as a visitor on that kind of screen gets it.
const PAGE_W: Record<Layout, number> = { desktop: 1200, mobile: 390 };

/** Connected and waiting, sending its theme, or between themes while the carousel slides. */
export type DisplayState = 'ready' | 'open' | 'idle';

type Props = {
  ref?: Ref<HTMLElement>;
  layout: Layout;
  /**
   * The theme whose page plays in the screen: the one connected, scrollable like the page itself.
   * Without it the screen is dark.
   */
  page?: CardId | null;
  at: Point;
  z: number;
  draggable: boolean;
  dragging: boolean;
  /** Set while the carousel slides, so a display that was moved glides home with the cards. */
  gliding?: boolean;
  /** The card that is connected or being sent, which tints the node. */
  source: CardId | null;
  state: DisplayState;
  /** The edge the bundle lands on. */
  side: Side;
  /** How far the glow has come up as a send lands. */
  swell: number;
  /** The node's size about its center, as it swells with a send. */
  scale: number;
  /** Hidden under the screen that grows out of it. */
  lifted: boolean;
  /** Set when a send was just pulled out; `key` replays the power-down, tinted for `source`. */
  powerOff: { key: number; source: CardId } | null;
  /**
   * The theme being sent, while its progress shows on the screen: when the light lands, and
   * whether its page has loaded.
   */
  sending?: { id: CardId; landsAt: number; ready: boolean } | null;
  /** The send's progress bar is full: the screen may grow. */
  onSent?: () => void;
  onGrab?: (event: PointerEvent) => void;
  /** Opens the connected theme from the header. */
  onOpen?: () => void;
};

export function DisplayNode({
  ref,
  layout,
  page,
  at,
  z,
  draggable,
  dragging,
  gliding,
  source,
  state,
  side,
  swell,
  scale,
  lifted,
  powerOff,
  sending,
  onSent,
  onGrab,
  onOpen
}: Props) {
  const card = source ? cardById(source) : null;
  const open = state === 'open';
  const { w, h } = displaySize(layout);
  const shown = page ? cardById(page) : null;
  // The href whose page has finished loading; the screen stays dark until then.
  const [loaded, setLoaded] = useState<string | null>(null);
  const pageW = PAGE_W[layout];
  const screenH = DISPLAY_SCREEN_H[layout];
  const pageScale = (w - 2) / pageW;
  const ready = state === 'ready';

  const status = open && card ? `Opening ${card.title}…` : ready && card ? `${card.title} connected` : 'Awaiting input';

  return (
    <article
      ref={ref}
      className={styles.display}
      data-dragging={dragging || undefined}
      data-gliding={gliding || undefined}
      data-linked={(shown && (open || ready)) || undefined}
      data-lit={open || undefined}
      data-shake={open || undefined}
      data-side={side}
      data-lifted={lifted || undefined}
      aria-label="Display"
      style={
        {
          '--accent': card ? `var(--accent-${card.id})` : 'var(--cv-muted)',
          '--swell': swell,
          width: w,
          height: h,
          zIndex: z,
          // Scaled inside the transform, so it swells about its own center.
          transform: `translate3d(${at.x}px, ${at.y}px, 0) scale(${scale})`
        } as CSSProperties
      }
    >
      {open && <Trace side={side} w={w} h={h} />}

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
        {/* A phone's header has room for the name and the way in, not the route as well. */}
        {layout === 'desktop' && <span className={styles.meta}>{shown ? shown.route : 'full page'}</span>}
        {/* The header carries the way in, so the screen runs to the display's bottom edge and the
            bundle below it has the room a footer would take. */}
        {shown && card && onOpen && (ready || open) && (
          <button
            type="button"
            className={styles.openButton}
            style={{ marginLeft: layout === 'desktop' ? 12 : 'auto' }}
            disabled={open}
            // The header is the display's handle; a press on the button is not a grab.
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onOpen}
          >
            {open ? 'Opening…' : `Open ${card.title}`}
          </button>
        )}
      </header>

      <div className={styles.screen} style={{ height: screenH }}>
        {/* Keyed by page, so each theme starts from the top with a dark screen. */}
        {shown && (
          <iframe
            key={shown.href}
            className={styles.page}
            data-on={loaded === shown.href || undefined}
            src={shown.href}
            title={`${shown.title} theme, live`}
            style={{ width: pageW, height: screenH / pageScale, transform: `scale(${pageScale})` }}
            onLoad={() => setLoaded(shown.href)}
          />
        )}
        {sending && (
          <SendProgress
            key={sending.id}
            id={sending.id}
            layout={layout}
            // Inside the display's 1px border.
            width={w - 2}
            height={screenH}
            landsAt={sending.landsAt}
            ready={sending.ready}
            onDone={() => onSent?.()}
          />
        )}
      </div>

      {/* Said aloud, and the footer the growing screen copies, but it takes no room. */}
      <div className="sr-only" role="status">
        {status}
      </div>

      {/* An old set switching off: the picture squashes to a line, the line to a dot. A span, so
          the growing screen that copies this node's screen never mistakes it for that. */}
      {powerOff && (
        <span
          key={powerOff.key}
          className={styles.powerOff}
          style={{ '--off-accent': `var(--accent-${powerOff.source})`, top: DISPLAY_HEADER_H } as CSSProperties}
          aria-hidden
        />
      )}
    </article>
  );
}

// The node outline traced on its 1px border: half a pixel in, corner radius 14 less that half.
const E = 0.5;
const R = 13.5;

/** The two halves of the outline from an input round to the far side, for a display `w` by `h`. */
function tracePaths(side: Side, w: number, h: number) {
  const right = w - E;
  const bottom = h - E;
  if (side === 'top' || side === 'bottom') {
    // From the top input, one half goes round the left and the other round the right; they meet at
    // the bottom centre.
    const x = w / 2;
    return [
      `M${x} ${E} H${E + R} A${R} ${R} 0 0 0 ${E} ${E + R} V${bottom - R} A${R} ${R} 0 0 0 ${E + R} ${bottom} H${x}`,
      `M${x} ${E} H${right - R} A${R} ${R} 0 0 1 ${right} ${E + R} V${bottom - R} A${R} ${R} 0 0 1 ${right - R} ${bottom} H${x}`
    ];
  }
  // From the left input, one half goes up and over the top, the other down and under the bottom;
  // they meet on the right edge.
  const y = h / 2;
  return [
    `M${E} ${y} V${E + R} A${R} ${R} 0 0 1 ${E + R} ${E} H${right - R} A${R} ${R} 0 0 1 ${right} ${E + R} V${y}`,
    `M${E} ${y} V${bottom - R} A${R} ${R} 0 0 0 ${E + R} ${bottom} H${right - R} A${R} ${R} 0 0 0 ${right} ${bottom - R} V${y}`
  ];
}

const TRACE_LAYERS = [
  { className: styles.traceHalo, opacity: 0.7 },
  { className: styles.traceCore, opacity: 1 },
];

/** Light running once from where the bundle lands around the border both ways, meeting on the far side. */
function Trace({ side, w, h }: { side: Side; w: number; h: number }) {
  // The right and bottom inputs mirror the left and top ones.
  const flip = side === 'right' ? `matrix(-1 0 0 1 ${w} 0)` : side === 'bottom' ? `matrix(1 0 0 -1 0 ${h})` : undefined;
  return (
    <svg className={styles.trace} width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <g transform={flip}>
        {tracePaths(side, w, h).map((d) => (
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
