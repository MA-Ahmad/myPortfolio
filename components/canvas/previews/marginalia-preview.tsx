import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import { cn } from 'lib/cn';
import { MARGINALIA_CONTENT as C, type NoteId, PARAGRAPH } from 'themes/marginalia/content';
import { mono, serif } from 'themes/marginalia/fonts';
import styles from './marginalia-preview.module.css';

/** The paragraph up to "Blocks": as much as fits the card. */
const RUNS = PARAGRAPH.slice(0, PARAGRAPH.findIndex((run) => typeof run !== 'string' && run.note === 'blocks') + 1);

/** The right margin opens these in turn; the left one keeps Pakistan open. */
const CYCLE: NoteId[] = ['web3', 'now', 'blocks'];
const CYCLE_MS = 2800;

const NOTES: Partial<Record<NoteId, { title: string; lines: string[] }>> = {
  place: { title: 'Pakistan', lines: ['Asia/Karachi', 'GMT+5'] },
  web3: { title: 'Web3 products', lines: C.web3.slice(0, 3).map((p) => p.title) },
  now: { title: C.career[0].title, lines: ['Senior engineer', `since ${C.career[0].period.split('–')[0]}`] },
  blocks: { title: 'Blocks', lines: C.blocks.slice(0, 3).map((b) => b.title) }
};

type Spot = { y: number; wire: string };

/**
 * The marginalia page in miniature: the paragraph in its serif with its underlined phrases, the
 * Pakistan note in the left margin, and the right margin opening one note after another, each
 * joined to its phrase by a wire drawn along the line gap and through the gutter, as on the page.
 */
export function MarginaliaPreview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLParagraphElement>(null);
  const anchors = useRef<Partial<Record<NoteId, HTMLSpanElement | null>>>({});
  const notes = useRef<Partial<Record<'left' | 'right', HTMLDivElement | null>>>({});
  const reduced = useReducedMotion();
  const [turn, setTurn] = useState(0);
  const [spots, setSpots] = useState<{ left?: Spot; right?: Spot }>({});
  const [tick, setTick] = useState(0);
  const right = CYCLE[turn % CYCLE.length];

  useEffect(() => {
    if (reduced) return;
    const timer = setInterval(() => setTurn((t) => t + 1), CYCLE_MS);
    return () => clearInterval(timer);
  }, [reduced]);

  useEffect(() => {
    const root = rootRef.current!;
    const bump = () => setTick((t) => t + 1);
    const observer = new ResizeObserver(bump);
    observer.observe(root);
    document.fonts?.ready.then(bump);
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const text = textRef.current;
    if (!root || !text || !root.offsetWidth) return;
    const box = root.getBoundingClientRect();
    // The card can be drawn scaled down; measure in the card's own px.
    const k = box.width / root.offsetWidth;
    const para = text.getBoundingClientRect();
    const place = (id: NoteId, side: 'left' | 'right'): Spot | undefined => {
      const rects = anchors.current[id]?.getClientRects();
      const note = notes.current[side];
      const word = rects && (side === 'left' ? rects[0] : rects[rects.length - 1]);
      if (!word || !note) return;
      const y = Math.min(Math.max((word.top - box.top) / k - 2, 6), root.offsetHeight - note.offsetHeight - 6);
      const x1 = ((side === 'left' ? word.left : word.right) - box.left) / k;
      const y1 = (word.bottom - box.top) / k + 1.5;
      const edge = ((side === 'left' ? para.left : para.right) - box.left) / k + (side === 'left' ? -5 : 5);
      const x2 = side === 'left' ? note.offsetLeft + note.offsetWidth + 4 : note.offsetLeft - 4;
      const y2 = y + 6;
      const pull = (x2 - edge) / 2;
      const f = (n: number) => n.toFixed(1);
      return {
        y,
        wire: `M${f(x1)} ${f(y1)} L${f(edge)} ${f(y1)} C${f(edge + pull)} ${f(y1)} ${f(x2 - pull)} ${f(y2)} ${f(x2)} ${f(y2)}`
      };
    };
    setSpots({ left: place('place', 'left'), right: place(right, 'right') });
  }, [right, tick]);

  return (
    <div ref={rootRef} className={cn(styles.root, serif.variable, mono.variable)} aria-hidden>
      <p ref={textRef} className={styles.paragraph}>
        {RUNS.map((run, i) =>
          typeof run === 'string' ? (
            run
          ) : (
            <span
              key={i}
              ref={(el) => {
                anchors.current[run.note] = el;
              }}
              className={styles.word}
              data-open={run.note === 'place' || run.note === right ? '' : undefined}
            >
              {run.text}
            </span>
          )
        )}
        .
      </p>

      <svg className={styles.wires}>
        {spots.left ? <path d={spots.left.wire} /> : null}
        {spots.right ? <path key={right} d={spots.right.wire} className={styles.draw} /> : null}
      </svg>

      <Note
        side="left"
        id="place"
        y={spots.left?.y}
        setRef={(el) => {
          notes.current.left = el;
        }}
      />
      <Note
        key={right}
        side="right"
        id={right}
        y={spots.right?.y}
        setRef={(el) => {
          notes.current.right = el;
        }}
      />
    </div>
  );
}

function Note({
  side,
  id,
  y,
  setRef
}: {
  side: 'left' | 'right';
  id: NoteId;
  y?: number;
  setRef: (el: HTMLDivElement | null) => void;
}) {
  const note = NOTES[id]!;
  return (
    <div
      ref={setRef}
      className={styles.note}
      data-side={side}
      data-placed={y !== undefined ? '' : undefined}
      style={{ top: y ?? 0 }}
    >
      <div className={styles.title}>{note.title}</div>
      {note.lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </div>
  );
}
