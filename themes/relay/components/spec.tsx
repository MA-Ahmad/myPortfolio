import styles from '../relay.module.css';

/**
 * The designer's notes on the motion, in a marker hand, laid over the page by "Show the spec".
 * Each note sits around the element it describes, with a hand-drawn arrow pointing at it. They
 * are decoration: hidden from assistive tech, inert to the mouse, and only on wide screens.
 */

type Note = { id: string; text: string[]; arrow: string; className: string };

// Arrows are drawn in a 60×60 box, from the note toward its target.
const DOWN = 'M30 4 C 26 22, 22 38, 26 54 M18 46 L26 55 L32 45';
const UP = 'M30 56 C 26 40, 26 22, 30 6 M22 14 L30 5 L36 15';
const UP_RIGHT = 'M14 56 C 26 40, 40 24, 50 6 M38 8 L51 5 L50 18';
const RIGHT = 'M4 30 C 22 24, 38 26, 56 32 M46 22 L57 32 L45 39';
const LEFT = 'M56 26 C 40 22, 22 26, 6 34 M14 24 L5 34 L17 41';

const NOTES: Record<'nav' | 'card', Note[]> = {
  nav: [
    {
      id: 'nav',
      text: ['nav node: the active section,', 'a packet runs its wire to the bullet'],
      arrow: RIGHT,
      className: styles.noteNav
    }
  ],
  card: [
    { id: 'hub', text: ['hub: the card’s bullet.', 'every spoke starts here'], arrow: DOWN, className: styles.noteHub },
    { id: 'ring', text: ['hairline 1px, ring 60%,', 'at rest 16%'], arrow: DOWN, className: styles.noteRing },
    {
      id: 'spokes',
      text: ['12 hairlines to the border,', '460ms quad out,', 'longest = full time,', '35% alpha, settling', 'to 10%'],
      arrow: LEFT,
      className: styles.noteSpokes
    },
    {
      id: 'node',
      text: ['a 4px node pops at each impact:', 'scale 1.6 and out, 520ms'],
      arrow: UP,
      className: styles.noteNode
    },
    {
      id: 'slice',
      text: ['and each impact grows its slice', 'of the border: 1/12 of the perimeter,', '420ms expo out'],
      arrow: UP_RIGHT,
      className: styles.noteSlice
    }
  ]
};

export function Spec({ at }: { at: 'nav' | 'card' }) {
  return (
    <div className={styles.spec} aria-hidden="true">
      {NOTES[at].map((note, i) => (
        <div key={note.id} className={`${styles.note} ${note.className}`} style={{ '--i': i } as React.CSSProperties}>
          <p>
            {note.text.map((line) => (
              <span key={line}>{line}</span>
            ))}
          </p>
          <svg viewBox="0 0 60 60" className={styles.arrow}>
            <path d={note.arrow} />
          </svg>
        </div>
      ))}
    </div>
  );
}
