import { type ReactNode, useLayoutEffect, useRef } from 'react';
import Link from 'next/link';
import { Caveat } from 'next/font/google';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { ArrowLeft } from 'lucide-react';
import { cn } from 'lib/cn';
import styles from '../relay.module.css';

/** The spec's marker hand; its file only downloads once the spec is shown. */
const marker = Caveat({ subsets: ['latin'], weight: ['500'], variable: '--rl-font-hand', display: 'swap' });

export function RelayLayout({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);

  // The shared body follows the main site's mode, and the phone's status bar the page: paint both
  // this page's blue so overscroll and the bar don't show another colour.
  useLayoutEffect(() => {
    const bg = getComputedStyle(rootRef.current!).getPropertyValue('--rl-bg').trim();
    const previous = document.body.style.background;
    document.body.style.background = bg;
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
    const added = !meta;
    if (!meta) {
      meta = document.createElement('meta');
      meta.name = 'theme-color';
      document.head.append(meta);
    }
    const previousColor = meta.content;
    meta.content = bg;
    return () => {
      document.body.style.background = previous;
      if (added) meta!.remove();
      else meta!.content = previousColor;
    };
  }, []);

  return (
    <div ref={rootRef} className={cn(styles.root, GeistSans.variable, GeistMono.variable, marker.variable)}>
      <Link href="/" className={styles.back} aria-label="Back to main site" title="Back to main site">
        <ArrowLeft size={16} />
      </Link>
      <main>{children}</main>
    </div>
  );
}
