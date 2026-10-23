import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { GripVertical, House, NotebookPen, SquareTerminal } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import {
  CARD_HEADER_H,
  type CardDef,
  type CardId,
  type Layout,
  cardHeight,
  portSide,
  portY
} from './nodes';

const ICONS: Record<CardId, typeof House> = {
  home: House,
  terminal: SquareTerminal,
  notebook: NotebookPen
};

type Props = {
  card: CardDef;
  layout: Layout;
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
  /** The pointer or focus reached the port, so a connect may follow. */
  onPrepare: () => void;
  onLeave: () => void;
  children: ReactNode;
};

export function NodeCard({
  card,
  layout,
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
  const side = portSide(card.id, layout);

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

      {/* A pointer press on the port belongs to the wire drag; only a keyboard click (detail 0) connects. */}
      <button
        type="button"
        className={`${styles.port} ${styles.output}`}
        data-lit={lit || undefined}
        aria-label={`Connect ${card.title} to display`}
        aria-disabled={busy || undefined}
        style={{ left: side === 'left' ? -1 : 'calc(100% + 1px)', top: portY(card, layout) - 1 }}
        onPointerDown={onWire}
        onPointerEnter={onPrepare}
        onFocus={onPrepare}
        onPointerLeave={onLeave}
        onBlur={onLeave}
        onClick={(event) => event.detail === 0 && !busy && onConnect()}
      />
    </article>
  );
}
