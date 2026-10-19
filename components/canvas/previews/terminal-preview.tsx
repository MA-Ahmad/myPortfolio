import { useEffect, useState } from 'react';
import { JetBrains_Mono } from 'next/font/google';
import { cn } from 'lib/cn';
import type { Activity } from 'lib/github-contributions';
import { TERMINAL_CONTENT } from 'themes/terminal/content';
import terminal from 'themes/terminal/terminal.module.css';
import styles from '../canvas.module.css';

// Same options as the terminal layout, so both share one set of font files.
const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap'
});

const COMMAND = 'whoami';
const TYPE_MS = 90;
const HOLD_MS = 5200;

/** `whoami` typed into the prompt on a loop, the answer, and the last `weeks` of commits. */
export function TerminalPreview({ contributions, weeks }: { contributions: Activity[]; weeks: number }) {
  const [typed, setTyped] = useState(COMMAND.length);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const run = (count: number) => {
      setTyped(count);
      const next = count >= COMMAND.length ? 0 : count + 1;
      timer = window.setTimeout(() => run(next), count >= COMMAND.length ? HOLD_MS : count === 0 ? 600 : TYPE_MS);
    };
    run(0);
    return () => window.clearTimeout(timer);
  }, []);

  const done = typed >= COMMAND.length;
  const days = contributions.slice(-weeks * 7);
  const cells = days.length ? days : Array.from({ length: weeks * 7 }, () => ({ level: 0 }));

  return (
    <div
      className={cn(
        terminal.root,
        mono.className,
        'flex size-full flex-col bg-term-bg px-3 pb-2.5 pt-2.5 text-[11px] leading-[18px] text-term-fg'
      )}
    >
      <p className="text-term-muted">
        <span className="mr-1.5 text-term-accent">~</span>
        {COMMAND.slice(0, typed)}
        <span className={styles.caret} aria-hidden />
      </p>
      <div className={cn('transition-opacity duration-300', done ? 'opacity-100' : 'opacity-0')}>
        <p className="mt-1 text-[15px] font-bold leading-5 tracking-tight">{TERMINAL_CONTENT.handle}</p>
        <p className="truncate text-term-muted">
          <span className="mr-1.5 text-term-accent">▸</span>
          {TERMINAL_CONTENT.currently.label}{' '}
          <span className="font-semibold text-term-yellow">{TERMINAL_CONTENT.currently.highlight}</span>
        </p>
      </div>
      <div
        className="mt-auto grid grid-flow-col grid-rows-7 gap-[2px] self-start"
        aria-hidden
      >
        {cells.map((day, i) => (
          <span
            key={i}
            className="size-1 rounded-[1px]"
            style={{ background: `var(--term-level-${day.level})` }}
          />
        ))}
      </div>
    </div>
  );
}
