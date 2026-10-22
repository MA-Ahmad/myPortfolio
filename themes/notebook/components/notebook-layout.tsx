import { MouseEvent, ReactNode, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { pixelNavigate } from 'lib/pixel-transition';
import { NOTEBOOK_CONTENT } from '../content';
import { Backdrop } from './backdrop';
import { NotebookSearch } from './theme-search';
import styles from '../notebook.module.css';

export function NotebookLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const { resolvedTheme } = useTheme();
  const rootRef = useRef<HTMLDivElement>(null);

  // The shared body background follows the main site's mode; match it so overscroll
  // doesn't flash a different color.
  useEffect(() => {
    const bg = getComputedStyle(rootRef.current!).getPropertyValue('--nb-bg');
    const previous = document.body.style.background;
    document.body.style.background = bg;
    return () => {
      document.body.style.background = previous;
    };
  }, [resolvedTheme]);

  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  const backToMainSite = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    const arrow = event.currentTarget.getBoundingClientRect();
    const mainSite = getComputedStyle(document.documentElement);
    pixelNavigate(router, '/', {
      origin: { x: arrow.left + arrow.width / 2, y: arrow.top + arrow.height / 2 },
      edge: mainSite.getPropertyValue('--foreground').trim(),
      background: mainSite.getPropertyValue('--background').trim()
    });
  };

  return (
    <div
      ref={rootRef}
      className={cn(styles.root, GeistMono.variable, GeistPixelSquare.variable)}
    >
      <Backdrop />
      <a href="#main" className={styles.skip}>
        skip to content
      </a>
      <div className={styles.page}>
        <div className={styles.column}>
          <header className={styles.header}>
            <div className={cn(styles.brand, styles.plate)}>
              <Link
                href="/"
                onClick={backToMainSite}
                className={styles.back}
                aria-label="Back to main site"
                title="Back to main site"
              >
                ←
              </Link>
              <Link href="/themes/notebook" className={styles.name}>
                {PROFILE.displayName}
              </Link>
            </div>
            <nav className={cn(styles.nav, styles.plate)} aria-label="Sections">
              {NOTEBOOK_CONTENT.nav.map((item) => (
                <a key={item.href} href={item.href} className={styles.navLink}>
                  {item.label}
                </a>
              ))}
              <NotebookSearch />
            </nav>
          </header>
          <main id="main" tabIndex={-1} className={styles.main}>
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}
