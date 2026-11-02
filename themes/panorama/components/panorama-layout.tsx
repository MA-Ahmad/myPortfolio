import { createContext, type ReactNode, useEffect, useLayoutEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Moon, Sun, Sunrise } from 'lucide-react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { cn } from 'lib/cn';
import { EARLY_TIME_SCRIPT, type TimeOfDay, TIMES, pickTime, useTimeOfDay } from '../time';
import styles from '../panorama.module.css';

/** The header's slot for a backdrop's own controls (the torn sheet's sound switch). */
export const ToolsSlot = createContext<HTMLElement | null>(null);

const ICONS = { morning: Sunrise, afternoon: Sun, night: Moon };
const LABELS: Record<TimeOfDay, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  night: 'Night'
};

export function PanoramaLayout({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { time, auto } = useTimeOfDay();
  const [tools, setTools] = useState<HTMLElement | null>(null);

  // A change of time snaps: for the frame it lands, no transition runs (see .root[data-switching]),
  // so no text fades from the old ink over the new sheet.
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    const root = rootRef.current!;
    root.dataset.switching = '';
    let frame = requestAnimationFrame(() => {
      frame = requestAnimationFrame(() => delete root.dataset.switching);
    });
    return () => {
      cancelAnimationFrame(frame);
      delete root.dataset.switching;
    };
  }, [time]);

  // The shared body follows the main site's mode, and the phone's status bar the page: match both
  // to the time of day.
  useEffect(() => {
    const previous = document.body.style.background;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const added = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    const previousColor = meta.content;
    const bg = getComputedStyle(rootRef.current!).getPropertyValue('--pn-bg');
    document.body.style.background = bg;
    meta.content = bg;
    return () => {
      document.body.style.background = previous;
      if (added) meta.remove();
      else meta.content = previousColor;
    };
  }, [time]);

  // An app shell, one screen tall: the page itself never rubber-bands or pulls to refresh.
  useEffect(() => {
    const html = document.documentElement;
    const previous = html.style.overscrollBehavior;
    html.style.overscrollBehavior = 'none';
    return () => {
      html.style.overscrollBehavior = previous;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      data-time={time}
      className={cn(styles.root, GeistSans.variable, GeistMono.variable)}
      suppressHydrationWarning
    >
      {/* Inside a div, so React leaves it alone: the browser runs it once while parsing the HTML. */}
      <div hidden dangerouslySetInnerHTML={{ __html: `<script>${EARLY_TIME_SCRIPT}</script>` }} />
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <header className={styles.bar}>
        <Link
          href="/"
          className={styles.back}
          aria-label="Back to main site"
          title="Back to main site"
        >
          <ArrowLeft size={16} />
        </Link>
        <span className={styles.hint}>Click a section, or use ← →</span>
        <div className={styles.controls}>
          <div ref={setTools} className={styles.tools} />
          <div className={styles.times} role="group" aria-label="Time of day">
            {TIMES.map((value) => {
              const Icon = ICONS[value];
              return (
                <button
                  key={value}
                  type="button"
                  className={styles.time}
                  aria-pressed={time === value}
                  aria-label={LABELS[value]}
                  title={
                    time === value && auto ? `${LABELS[value]}, from your clock` : LABELS[value]
                  }
                  onClick={() => pickTime(value)}
                >
                  <Icon size={14} strokeWidth={1.75} />
                </button>
              );
            })}
            {!auto && (
              <button
                type="button"
                className={styles.auto}
                onClick={() => pickTime(null)}
                title="Follow your clock again"
              >
                Auto
              </button>
            )}
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={styles.main}>
        <ToolsSlot.Provider value={tools}>{children}</ToolsSlot.Provider>
      </main>
    </div>
  );
}
