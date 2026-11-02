import { type CSSProperties, type ReactNode, useEffect, useState } from 'react';
import { SECTIONS } from '../content';
import styles from '../panorama.module.css';

export type Section = (typeof SECTIONS)[number] & { body: ReactNode };

/** What a background gets to draw with: which section is open, and each section's own art slot. */
export type Backdrop = {
  /** Drawn once behind every section, across the whole strip. */
  behind?: (open: number) => ReactNode;
  /**
   * Drawn under one section's window, without its clip, so it can reach a little past the edge.
   * `select` opens a section, for art that can be clicked.
   */
  under?: (index: number, open: boolean, select: (index: number) => void) => ReactNode;
  /** Set when `under` draws the section's surface itself. */
  skin?: 'torn';
};

const OPEN = 9; // fr of the open section; closed ones get 1fr
/** --pn-switch: how long the columns take to settle after a section opens. */
const SWITCH_MS = 760;

/**
 * Every section on one screen, side by side. One is open; clicking another opens it. The columns
 * are a CSS grid whose fr values transition; the backdrop decides what the windows look onto.
 */
export function Sections({
  sections,
  backdrop = {}
}: {
  sections: Section[];
  backdrop?: Backdrop;
}) {
  const [open, setOpen] = useState(0);
  // The section that was open stays live until the columns settle. Making a section inert restyles
  // everything inside it, so it waits for the end of the move rather than landing on its first frame,
  // when the columns move fastest. It can't be clicked meanwhile: a closed body takes no pointer.
  const [settled, setSettled] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => setSettled(open), SWITCH_MS);
    return () => window.clearTimeout(timer);
  }, [open]);

  const columns = sections.map((_, i) => (i === open ? `${OPEN}fr` : '1fr')).join(' ');

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      const step =
        event.key === 'ArrowRight' || event.key === 'ArrowDown'
          ? 1
          : event.key === 'ArrowLeft' || event.key === 'ArrowUp'
            ? -1
            : 0;
      if (!step) return;
      event.preventDefault();
      setOpen((current) => Math.max(0, Math.min(sections.length - 1, current + step)));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [sections.length]);

  return (
    <div
      className={styles.sections}
      data-skin={backdrop.skin}
      style={{ '--columns': columns } as CSSProperties}
    >
      {backdrop.behind?.(open)}
      {sections.map((section, i) => {
        const isOpen = i === open;
        return (
          <section
            key={section.id}
            id={section.id}
            className={styles.section}
            data-open={isOpen ? '' : undefined}
            aria-label={section.label}
          >
            {backdrop.under?.(i, isOpen, setOpen)}
            <div className={styles.window}>
              <button
                type="button"
                className={styles.face}
                onClick={() => setOpen(i)}
                aria-label={section.label}
                aria-expanded={isOpen}
                aria-controls={`${section.id}-body`}
                tabIndex={isOpen ? -1 : 0}
              />

              <div id={`${section.id}-body`} className={styles.body} inert={!isOpen && i !== settled}>
                <div className={styles.sectionNameSpace} />
                <div className={styles.content}>{section.body}</div>
              </div>

              {/* One heading for both states: down the edge while closed, turned to the title as it opens. */}
              <h2 className={styles.sectionName}>{section.label}</h2>
            </div>
          </section>
        );
      })}
    </div>
  );
}
