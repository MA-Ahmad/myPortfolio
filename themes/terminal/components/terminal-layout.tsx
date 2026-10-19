import { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { JetBrains_Mono } from 'next/font/google';
import { ArrowUp } from 'lucide-react';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { TERMINAL_CONTENT } from '../content';
import styles from '../terminal.module.css';

const mono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  display: 'swap'
});

export function TerminalLayout({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // The shared body background follows the main site's light/dark mode; match it
  // to this palette so overscroll doesn't flash a different color.
  useEffect(() => {
    const bg = getComputedStyle(rootRef.current!).getPropertyValue('--term-bg');
    const previous = document.body.style.background;
    document.body.style.background = bg;
    return () => {
      document.body.style.background = previous;
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(
        styles.root,
        mono.className,
        'flex min-h-screen flex-col bg-term-bg text-term-fg antialiased'
      )}
    >
      <header className="fixed inset-x-0 top-0 z-50 border-b border-term-border/50 bg-term-bg/80 backdrop-blur-md">
        <nav className="mx-auto flex max-w-4xl items-center justify-between gap-2 px-4 py-3 sm:px-6">
          <Link
            href="/themes/terminal"
            className={cn(
              styles.glow,
              'shrink-0 text-sm font-semibold tracking-wider !text-term-accent transition-opacity hover:opacity-80'
            )}
          >
            {TERMINAL_CONTENT.handle}
          </Link>
          <div
            className={cn(styles.noScrollbar, 'flex items-center gap-2.5 overflow-x-auto sm:gap-4')}
          >
            {TERMINAL_CONTENT.nav.map((item) => (
              <Link
                key={item.label}
                href={item.href}
                className="whitespace-nowrap text-xs !text-term-muted transition-colors duration-150 hover:!text-term-fg"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </nav>
      </header>

      <main>{children}</main>

      <footer className="mx-auto mt-auto w-full max-w-4xl border-t border-term-border/30 px-6 pb-4 pt-3">
        <div className="flex items-center justify-between text-xs text-term-dim">
          <LocalTime />
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            aria-label="Back to top"
            className="inline-flex items-center gap-1 text-term-muted transition-colors duration-150 hover:text-term-accent"
          >
            top <ArrowUp className="size-3.5" />
          </button>
        </div>
      </footer>
    </div>
  );
}

function LocalTime() {
  const [time, setTime] = useState('');

  useEffect(() => {
    const format = () =>
      new Intl.DateTimeFormat('en-GB', {
        timeZone: PROFILE.timeZone,
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date());

    setTime(format());
    const interval = window.setInterval(() => setTime(format()), 30_000);
    return () => window.clearInterval(interval);
  }, []);

  return (
    <span className="tabular-nums" suppressHydrationWarning>
      {time} {TERMINAL_CONTENT.timeZoneLabel}
    </span>
  );
}
