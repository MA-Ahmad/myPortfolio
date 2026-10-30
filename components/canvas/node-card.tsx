import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react';
import { GripVertical, House, Moon, NotebookPen, SquareTerminal } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import {
  CARD_HEADER_H,
  type CardDef,
  type CardId,
  type Layout,
  type Side,
  cardHeight,
  portY
} from './nodes';

const ICONS: Record<CardId, typeof House> = {
  home: House,
  terminal: SquareTerminal,
  notebook: NotebookPen,
  midnight: Moon
};

type Props = {
  card: CardDef;
  layout: Layout;
  /** The edge the port is on: the one facing the display, wherever the card has been moved. */
  side: Side;
  at: Point;
  z: number;
  draggable: boolean;
  dragging: boolean;
  lit: boolean;
  shake: boolean;
  /** Which way to jolt when a wire is pushed off this card or off another one; `count` restarts it. */
  repel: { x: number; y: number; count: number } | null;
  busy: boolean;
  onGrab: (event: PointerEvent) => void;
  onWire: (event: PointerEvent) => void;
  onConnect: () => void;
  /** The pointer reached the port or card, or focus reached the card, so a connect may follow. */
  onPrepare: () => void;
  onLeave: () => void;
  children: ReactNode;
};

export function NodeCard({
  card,
  layout,
  side,
  at,
  z,
  draggable,
  dragging,
  lit,
  shake,
  repel,
  busy,
  onGrab,
  onWire,
  onConnect,
  onPrepare,
  onLeave,
  children
}: Props) {
  const Icon = ICONS[card.id];
  const height = cardHeight(card, layout);

  return (
    <article
      className={styles.node}
      data-dragging={dragging || undefined}
      data-lit={lit || undefined}
      data-shake={shake || undefined}
      data-repel={repel ? (repel.count % 2 ? 'a' : 'b') : undefined}
      aria-label={`${card.title} theme`}
      style={
        {
          '--accent': `var(--accent-${card.id})`,
          '--rx': repel?.x ?? 0,
          '--ry': repel?.y ?? 0,
          width: card.width[layout],
          height,
          zIndex: z,
          transform: `translate3d(${at.x}px, ${at.y}px, 0)`
        } as CSSProperties
      }
    >
      <header
        className={styles.header}
        style={{ height: CARD_HEADER_H - 1 }}
        data-draggable={draggable || undefined}
        onPointerDown={draggable ? onGrab : undefined}
      >
        {draggable && (
          <span className={styles.grip} aria-hidden>
            <GripVertical className="size-3.5" />
          </span>
        )}
        <span className={styles.icon} aria-hidden>
          <Icon className="size-3.5" />
        </span>
        {card.title}
        <span className={styles.meta}>theme</span>
      </header>

      <div className={styles.preview} style={{ height: card.previewHeight[layout] }}>
        {children}
      </div>

      {/* The card's way in without a drag: a click, tap or Enter plays the same connect. Clicks
          with a modifier, and anything without JavaScript, just follow the link. */}
      <a
        href={card.href}
        className={styles.open}
        style={{ top: CARD_HEADER_H }}
        aria-label={`Open ${card.title} theme`}
        aria-disabled={busy || undefined}
        onClick={(event: MouseEvent) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          if (!busy) onConnect();
        }}
        // A finger lands on the cards whenever the phone stack is scrolled, so only a hovering
        // pointer loads the theme ahead; a tap's connect loads it anyway.
        onPointerEnter={(event) => event.pointerType !== 'touch' && onPrepare()}
        onFocus={onPrepare}
        onPointerLeave={(event) => event.pointerType !== 'touch' && onLeave()}
        onBlur={onLeave}
      />

      {/* Only for dragging a wire; the link above is the keyboard and screen reader path. */}
      <span
        className={`${styles.port} ${styles.output}`}
        data-lit={lit || undefined}
        aria-hidden
        style={{ left: side === 'left' ? -1 : 'calc(100% + 1px)', top: portY(card, layout) - 1 }}
        onPointerDown={onWire}
        onPointerEnter={onPrepare}
        onPointerLeave={onLeave}
      />
    </article>
  );
}
