import { cn } from 'lib/cn';
import styles from '../midnight.module.css';

export function Logo({ src, name, className }: { src?: string; name: string; className?: string }) {
  return (
    <span className={cn(styles.logo, className)} aria-hidden>
      {src ? <img src={src} alt="" loading="lazy" /> : name.charAt(0)}
    </span>
  );
}
