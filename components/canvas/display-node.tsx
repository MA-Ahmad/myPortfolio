import { type CSSProperties, type PointerEvent, type Ref, useState } from 'react';
import { GripVertical, Monitor } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import {
  type CardId,
  DISPLAY_FOOTER_H,
  DISPLAY_HEADER_H,
  DISPLAY_SCREEN_H,
  type Layout,
  type Side,
  cardById,
  displaySize
} from './nodes';

// Each input sits 1px out past the border on whichever edge it is on.
const inputStyle = (side: Side, w: number, h: number): CSSProperties =>
  ({
    left: { left: -1, top: h / 2 - 1 },
    right: { left: w + 1, top: h / 2 - 1 },
    top: { left: w / 2, top: -1 },
    bottom: { left: w / 2, top: h + 1 }
  })[side];

// The page in the display's screen is laid out this wide and scaled down to fit, so it shows the
// theme as a desktop visitor gets it.
const PAGE_W: Record<Layout, number> = { desktop: 1200, mobile: 390 };

export type DisplayState = 'idle' | 'armed' | 'near' | 'open' | 'ready';

type Props = {
  ref?: Ref<HTMLElement>;
  layout: Layout;
  /**
   * The theme whose page plays in the screen (desktop): the one connected, scrollable like the page
   * itself. Without it the body is the rows of readouts.
   */
  page?: CardId | null;
  at: Point;
  z: number;
  draggable: boolean;
  dragging: boolean;
  /** Set while the carousel slides, so a display that was moved glides home with the cards. */
  gliding?: boolean;
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
  onGrab?: (event: PointerEvent) => void;
  /** Opens the connected theme from the footer. */
  onOpen?: () => void;
  /** A press on the plugged-in input, which pulls the wire back out. */
  onUnplug: (event: PointerEvent) => void;
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
  inputs,
  side,
  swell,
  scale,
  lifted,
  powerOff,
  onGrab,
  onOpen,
  onUnplug
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

  const status =
    state === 'open' && card
      ? `Opening ${card.title}…`
      : ready && card
        ? `${card.title} connected`
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
      {(state === 'near' || open) && <Trace key={state} side={side} loop={!open} w={w} h={h} />}

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
        {/* On desktop the header carries the way in, so the screen runs to the display's bottom edge
            and the bundle below it has the room a footer would take. */}
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

      {shown ? (
        <div className={styles.screen} style={{ height: screenH }}>
          {/* Keyed by page, so each theme starts from the top with a dark screen. */}
          <iframe
            key={shown.href}
            className={styles.page}
            data-on={loaded === shown.href || undefined}
            src={shown.href}
            title={`${shown.title} theme, live`}
            style={{ width: pageW, height: screenH / pageScale, transform: `scale(${pageScale})` }}
            onLoad={() => setLoaded(shown.href)}
          />
        </div>
      ) : (
        <div className={styles.rows}>
          <div className={styles.row}>
            source
            <span className={styles.value}>
              {(open || ready) && card ? (
                <>
                  {card.title.toLowerCase()}
                  {open && (
                    <svg className={styles.check} viewBox="0 0 16 16" fill="none" aria-hidden>
                      <path
                        d="M3.5 8.5l3 3 6-7"
                        stroke="currentColor"
                        strokeWidth="1.75"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </>
              ) : (
                '—'
              )}
            </span>
          </div>
          <div className={styles.row}>
            route
            <span className={styles.value}>{(open || ready) && card ? card.route : '—'}</span>
          </div>
          <div className={styles.row}>
            transition
            <span className={styles.value}>pixel</span>
          </div>
        </div>
      )}

      {shown ? (
        // Still said aloud, and still the footer the growing screen copies, but it takes no room.
        <div className="sr-only" role="status">
          {status}
        </div>
      ) : (
        <div className={styles.status} style={{ height: DISPLAY_FOOTER_H - 1 }} data-state={state} role="status">
          <span className={styles.dot} aria-hidden />
          {status}
        </div>
      )}

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
            style={inputStyle(input, w, h)}
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

/**
 * Light running from the input around the border both ways, meeting on the far side. It loops
 * while a wire is close enough to plug in and runs once when it does.
 */
function Trace({ side, loop, w, h }: { side: Side; loop: boolean; w: number; h: number }) {
  // The right and bottom inputs mirror the left and top ones.
  const flip = side === 'right' ? `matrix(-1 0 0 1 ${w} 0)` : side === 'bottom' ? `matrix(1 0 0 -1 0 ${h})` : undefined;
  return (
    <svg
      className={styles.trace}
      data-loop={loop || undefined}
      width={w}
      height={h}
      viewBox={`0 0 ${w} ${h}`}
      aria-hidden
    >
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
