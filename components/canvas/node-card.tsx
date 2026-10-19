import type { CSSProperties, PointerEvent, ReactNode } from 'react';
import { GripVertical, House, NotebookPen, SquareTerminal } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import {
  CARD_FOOTER_H,
  CARD_HEADER_H,
  CARD_W,
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
  busy: boolean;
  onGrab: (event: PointerEvent) => void;
  onWire: (event: PointerEvent) => void;
  onConnect: () => void;
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
  busy,
  onGrab,
  onWire,
  onConnect,
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
      aria-label={`${card.title} theme`}
      style={
        {
          '--accent': `var(--accent-${card.id})`,
          width: CARD_W,
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

      <footer className={styles.footer} style={{ height: CARD_FOOTER_H - 1 }}>
        <span className={styles.route}>{card.route}</span>
        <button type="button" className={styles.connect} onClick={onConnect} disabled={busy}>
          Connect<span className="sr-only"> {card.title} to display</span>
        </button>
      </footer>

      <span
        className={`${styles.port} ${styles.output}`}
        data-lit={lit || undefined}
        aria-hidden
        style={{ left: side === 'left' ? -1 : '100%', top: portY(card, layout) - 1 }}
        onPointerDown={onWire}
      />
    </article>
  );
}
