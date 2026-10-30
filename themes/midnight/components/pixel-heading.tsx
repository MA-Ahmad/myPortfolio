import { ReactNode } from 'react';
import { cn } from 'lib/cn';
import styles from '../midnight.module.css';

export function PixelHeading({
  children,
  subtitle,
  mono = true
}: {
  children: ReactNode;
  subtitle?: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className={styles.headingRow}>
      <h1 className={styles.pixel}>{children}</h1>
      {subtitle ? <span className={cn(styles.subtitle, mono && styles.mono)}>{subtitle}</span> : null}
    </div>
  );
}
