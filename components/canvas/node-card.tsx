import type { CSSProperties, MouseEvent, PointerEvent, ReactNode } from 'react';
import { Columns4, Pilcrow, GripVertical, House, Moon, NotebookPen, SquareTerminal } from 'lucide-react';
import type { Point } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import { CARD_HEADER_H, type CardDef, type CardId, type Layout, cardHeight } from './nodes';

const ICONS: Record<CardId, typeof House> = {
  home: House,
  terminal: SquareTerminal,
  notebook: NotebookPen,
  midnight: Moon,
  panorama: Columns4,
  marginalia: Pilcrow
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
  busy: boolean;
  /** Slots from the one under the display; undefined outside the carousel. */
  slot?: number;
  onGrab?: (event: PointerEvent) => void;
  onConnect: () => void;
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
  busy,
  slot,
  onGrab,
  onConnect,
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
      data-slot={slot === undefined ? undefined : Math.min(2, Math.abs(slot))}
      data-active={slot === 0 || undefined}
      data-linked={slot === 0 || undefined}
      aria-current={slot === 0 ? 'true' : undefined}
      aria-label={`${card.title} theme`}
      style={
        {
          '--accent': `var(--accent-${card.id})`,
          width: card.width[layout],
          height,
          zIndex: z,
          transform: `translate3d(${at.x}px, ${at.y}px, 0)${slot !== undefined && slot !== 0 ? ' scale(0.94)' : ''}`
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

      {/* The card's way in: a click, tap or Enter selects it or, once connected, opens it. Clicks
          with a modifier, and anything without JavaScript, just follow the link. */}
      <a
        href={card.href}
        className={styles.open}
        style={{ top: CARD_HEADER_H }}
        aria-label={slot !== undefined && slot !== 0 ? `Select ${card.title} theme` : `Open ${card.title} theme`}
        aria-disabled={busy || undefined}
        draggable={false}
        // The whole card can be picked up on desktop, or swiped aside on a phone; a press that never
        // moves stays a click.
        onPointerDown={onGrab}
        onClick={(event: MouseEvent) => {
          if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
          event.preventDefault();
          if (!busy) onConnect();
        }}
        onPointerLeave={(event) => event.pointerType !== 'touch' && onLeave()}
        onBlur={onLeave}
      />
    </article>
  );
}
