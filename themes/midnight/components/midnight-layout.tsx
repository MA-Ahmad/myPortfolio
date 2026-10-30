import { MouseEvent, ReactNode, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { motion, useScroll } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import { GeistPixelSquare } from 'geist/font/pixel';
import { cn } from 'lib/cn';
import { pixelNavigate } from 'lib/pixel-transition';
import { StudioDock } from 'components/shared/studio-dock';
import { Dock } from './dock';
import styles from '../midnight.module.css';

export function MidnightLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll();

  // The shared body background follows the main site's mode; match it so overscroll
  // doesn't flash a different color.
  useEffect(() => {
    const bg = getComputedStyle(rootRef.current!).getPropertyValue('--mn-bg');
    const previous = document.body.style.background;
    document.body.style.background = bg;
    return () => {
      document.body.style.background = previous;
    };
  }, []);

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
      className={cn(
        styles.root,
        GeistSans.variable,
        GeistMono.variable,
        GeistPixelSquare.variable
      )}
    >
      <a href="#main" className={styles.skip}>
        Skip to content
      </a>
      <motion.div className={styles.progress} style={{ scaleX: scrollYProgress }} aria-hidden />
      <Link
        href="/"
        onClick={backToMainSite}
        className={styles.back}
        aria-label="Back to main site"
        title="Back to main site"
      >
        <ArrowLeft size={16} />
      </Link>
      <div className={styles.column}>
        <main id="main" tabIndex={-1} key={router.asPath} className={styles.page}>
          {children}
        </main>
      </div>
      <Dock />
      <StudioDock look="midnight" />
    </div>
  );
}
