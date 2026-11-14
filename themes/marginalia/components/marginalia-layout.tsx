import { type ReactNode, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useTheme } from 'next-themes';
import { ArrowLeft } from 'lucide-react';
import { cn } from 'lib/cn';
import { mono, serif } from '../fonts';
import styles from '../marginalia.module.css';

export function MarginaliaLayout({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLDivElement>(null);
  const { resolvedTheme } = useTheme();

  // The shared body follows the main site's mode; match it to this paper so overscroll doesn't
  // flash another colour.
  useEffect(() => {
    const bg = getComputedStyle(rootRef.current!).getPropertyValue('--mg-bg');
    const previous = document.body.style.background;
    document.body.style.background = bg;
    return () => {
      document.body.style.background = previous;
    };
  }, [resolvedTheme]);

  return (
    <div ref={rootRef} className={cn(styles.root, serif.variable, mono.variable)}>
      <Link href="/" className={styles.back} aria-label="Back to main site" title="Back to main site">
        <ArrowLeft size={16} />
      </Link>
      <main>{children}</main>
    </div>
  );
}
