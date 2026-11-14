import {
  type KeyboardEvent,
  type MouseEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import type { ThemeHomeProps } from 'themes/registry';
import { MARGINALIA_CONTENT as C, type NoteId, OPEN_AT_START, PARAGRAPH, SIDE } from '../content';
import { NOTE_TITLES, NoteBody } from './notes';
import styles from '../marginalia.module.css';

/** Notes in the order their words appear in the paragraph. */
const ORDER = PARAGRAPH.flatMap((run) => (typeof run === 'string' ? [] : [run.note]));

/**
 * Where the notes go, matching the breakpoints in marginalia.module.css: both margins, the right
 * margin only, or footnotes under the paragraph.
 */
type Mode = 'two' | 'one' | 'foot';
const TWO = '(min-width: 1280px)';
const ONE = '(min-width: 880px)';

function useMode(): Mode | null {
  const [mode, setMode] = useState<Mode | null>(null);
  useEffect(() => {
    const two = matchMedia(TWO);
    const one = matchMedia(ONE);
    const read = () => setMode(two.matches ? 'two' : one.matches ? 'one' : 'foot');
    read();
    two.addEventListener('change', read);
    one.addEventListener('change', read);
    return () => {
      two.removeEventListener('change', read);
      one.removeEventListener('change', read);
    };
  }, []);
  return mode;
}

type Placed = { y: number; side: 'left' | 'right'; wire: string };

/** Space between two notes stacked in the same margin. */
const GAP = 18;

export function Marginalia({ contributions, posts }: ThemeHomeProps) {
  const [open, setOpen] = useState<NoteId[]>(OPEN_AT_START);
  const [hot, setHot] = useState<NoteId | null>(null);
  const [placed, setPlaced] = useState<Partial<Record<NoteId, Placed>>>({});
  const [height, setHeight] = useState(0);
  const [settled, setSettled] = useState(false);
  const [tick, setTick] = useState(0);
  const mode = useMode();

  const stageRef = useRef<HTMLDivElement>(null);
  const paragraphRef = useRef<HTMLParagraphElement>(null);
  const anchors = useRef<Partial<Record<NoteId, HTMLAnchorElement | null>>>({});
  const notes = useRef<Partial<Record<NoteId, HTMLElement | null>>>({});

  // The note opened last, so a footnote that opens below the screen can be brought into view.
  // The note opened last (a new object each time), so a footnote that opens below the screen can
  // be brought into view.
  const [opened, setOpened] = useState<{ id: NoteId } | null>(null);
  const toggle = (id: NoteId) => {
    if (open.includes(id)) return setOpen(open.filter((n) => n !== id));
    setOpen([...open, id]);
    setOpened({ id });
  };

  // A link to a note (#note-web3) opens it. Before the script runs, a tapped phrase shows its note
  // through the hash (:target in the CSS); this keeps that note open once it has.
  useEffect(() => {
    const read = () => {
      const id = location.hash.replace('#note-', '') as NoteId;
      if (ORDER.includes(id)) setOpen((current) => (current.includes(id) ? current : [...current, id]));
    };
    const frame = requestAnimationFrame(read);
    window.addEventListener('hashchange', read);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('hashchange', read);
    };
  }, []);

  // On a phone the notes are footnotes under the paragraph: one opened from low in the paragraph
  // lands below the screen, so scroll it up into view (only as far as needed).
  useEffect(() => {
    if (mode !== 'foot' || !opened) return;
    const note = notes.current[opened.id];
    if (!note) return;
    const box = note.getBoundingClientRect();
    if (box.top >= 0 && box.bottom <= innerHeight) return;
    const smooth = !matchMedia('(prefers-reduced-motion: reduce)').matches;
    note.scrollIntoView({ block: box.height > innerHeight * 0.8 ? 'start' : 'nearest', behavior: smooth ? 'smooth' : 'auto' });
  }, [opened, mode]);

  // Stack the open notes in their margin, each as close to its word as the note above allows, and
  // draw a wire from the word's underline to the note.
  useLayoutEffect(() => {
    const stage = stageRef.current;
    const paragraph = paragraphRef.current;
    if (!stage || !paragraph || !mode || mode === 'foot') return;
    const box = stage.getBoundingClientRect();
    const text = paragraph.getBoundingClientRect();
    const bottoms = { left: 0, right: 0 };
    const next: Partial<Record<NoteId, Placed>> = {};
    for (const id of ORDER) {
      const anchor = anchors.current[id];
      const note = notes.current[id];
      if (!anchor || !note) continue;
      const side = mode === 'two' ? SIDE[id] : 'right';
      const rects = anchor.getClientRects();
      const word = side === 'left' ? rects[0] : rects[rects.length - 1];
      if (!word) continue;
      const isOpen = open.includes(id);
      const want = word.top - box.top - 4;
      const y = isOpen ? Math.max(want, bottoms[side] + GAP) : (placed[id]?.y ?? want);
      if (isOpen) bottoms[side] = y + note.offsetHeight;

      // The wire runs along the line gap under the word to the paragraph's edge, then turns in the
      // gutter, so it never cuts across the text.
      const x1 = (side === 'left' ? word.left : word.right) - box.left;
      const y1 = word.bottom - box.top + 3;
      const edge = (side === 'left' ? text.left - 12 : text.right + 12) - box.left;
      const x2 = side === 'left' ? note.offsetLeft + note.offsetWidth + 10 : note.offsetLeft - 10;
      const y2 = y + 11;
      const pull = (x2 - edge) * 0.5;
      const f = (n: number) => n.toFixed(1);
      next[id] = {
        y,
        side,
        wire: `M${f(x1)} ${f(y1)} L${f(edge)} ${f(y1)} C${f(edge + pull)} ${f(y1)} ${f(x2 - pull)} ${f(y2)} ${f(x2)} ${f(y2)}`
      };
    }
    setPlaced(next);
    setHeight(Math.max(bottoms.left, bottoms.right));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `placed` is read only for closed notes' resting place
  }, [open, mode, tick]);

  // Re-place on resize and once the fonts have loaded (both move the words).
  useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const bump = () => setTick((t) => t + 1);
    const observer = new ResizeObserver(bump);
    observer.observe(stage);
    Object.values(notes.current).forEach((note) => note && observer.observe(note));
    document.fonts?.ready.then(bump);
    return () => observer.disconnect();
  }, []);

  // Transitions start after the first placement, so notes don't slide in from the top.
  useEffect(() => {
    if (settled || !Object.keys(placed).length) return;
    const frame = requestAnimationFrame(() => setSettled(true));
    return () => cancelAnimationFrame(frame);
  }, [placed, settled]);

  // Escape folds the note opened last.
  useEffect(() => {
    const onKey = (event: globalThis.KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      setOpen((current) => current.slice(0, -1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const onAnchorClick = (id: NoteId) => (event: MouseEvent) => {
    event.preventDefault();
    toggle(id);
  };
  const onAnchorKey = (id: NoteId) => (event: KeyboardEvent) => {
    if (event.key !== ' ') return;
    event.preventDefault();
    toggle(id);
  };

  const allOpen = open.length === ORDER.length;

  return (
    <div className={styles.page}>
      <header className={styles.top}>
        <span>{C.name}</span>
        <span className={styles.dim}>{C.role}</span>
      </header>

      <div
        ref={stageRef}
        className={styles.stage}
        data-mode={mode ?? undefined}
        data-settled={settled ? '' : undefined}
        style={{ minHeight: mode && mode !== 'foot' ? height : undefined }}
      >
        <p ref={paragraphRef} className={styles.paragraph}>
          {PARAGRAPH.map((run, i) =>
            typeof run === 'string' ? (
              run
            ) : (
              <a
                key={i}
                ref={(el) => {
                  anchors.current[run.note] = el;
                }}
                href={`#note-${run.note}`}
                role="button"
                aria-expanded={open.includes(run.note)}
                aria-controls={`note-${run.note}`}
                className={styles.word}
                data-open={open.includes(run.note) ? '' : undefined}
                data-hot={hot === run.note ? '' : undefined}
                onClick={onAnchorClick(run.note)}
                onKeyDown={onAnchorKey(run.note)}
                onPointerEnter={() => setHot(run.note)}
                onPointerLeave={() => setHot(null)}
              >
                {run.text}
              </a>
            )
          )}
        </p>

        <svg className={styles.wires} aria-hidden="true">
          {ORDER.map((id) =>
            placed[id] ? (
              <path
                key={id}
                d={placed[id]!.wire}
                pathLength={1}
                data-open={open.includes(id) ? '' : undefined}
                data-hot={hot === id ? '' : undefined}
              />
            ) : null
          )}
        </svg>

        <div className={styles.notes}>
          {ORDER.map((id) => {
            const spot = placed[id];
            const isOpen = open.includes(id);
            return (
              <aside
                key={id}
                id={`note-${id}`}
                ref={(el) => {
                  notes.current[id] = el;
                }}
                className={styles.note}
                data-side={SIDE[id]}
                data-open={isOpen ? '' : undefined}
                data-placed={spot ? '' : undefined}
                data-hot={hot === id ? '' : undefined}
                aria-hidden={!isOpen}
                inert={!isOpen}
                style={{ '--y': `${spot?.y ?? 0}px` } as React.CSSProperties}
                onPointerEnter={() => setHot(id)}
                onPointerLeave={() => setHot(null)}
              >
                <div className={styles.noteHead}>
                  <h2>{NOTE_TITLES[id]}</h2>
                  <button
                    type="button"
                    className={styles.fold}
                    onClick={() => toggle(id)}
                    aria-label={`Close note: ${NOTE_TITLES[id]}`}
                  >
                    ×
                  </button>
                </div>
                <NoteBody id={id} contributions={contributions} posts={posts} />
              </aside>
            );
          })}
        </div>
      </div>

      <footer className={styles.foot}>
        <span className={styles.dim}>Every underlined phrase opens a note.</span>
        <button
          type="button"
          className={styles.all}
          onClick={() => setOpen(allOpen ? [] : ORDER)}
        >
          {allOpen ? 'Fold all notes' : 'Open all notes'}
        </button>
      </footer>
    </div>
  );
}
