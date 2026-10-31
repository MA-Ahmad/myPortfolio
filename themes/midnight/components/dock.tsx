import Link from 'next/link';
import { useRouter } from 'next/router';
import { Briefcase, Feather, House } from 'lucide-react';
import { MIDNIGHT_CONTENT } from '../content';
import styles from '../midnight.module.css';

const ICONS = { Home: House, Work: Briefcase, Skills: Feather };

export function Dock() {
  const { asPath } = useRouter();
  const path = asPath.split(/[?#]/)[0].replace(/\/$/, '');

  return (
    <>
      <div className={styles.fade} aria-hidden />
      <nav className={styles.dock} aria-label="Pages">
        {(['Tl', 'Tr', 'Bl', 'Br'] as const).map((corner) => (
          <span key={corner} className={`${styles.bracket} ${styles[`bracket${corner}`]}`} aria-hidden />
        ))}
        {MIDNIGHT_CONTENT.nav.map(({ label, href }) => {
          const Icon = ICONS[label as keyof typeof ICONS];
          return (
            <Link
              key={href}
              href={href}
              className={styles.dockItem}
              aria-current={path === href ? 'page' : undefined}
            >
              <Icon size={18} strokeWidth={1.6} />
              {label}
            </Link>
          );
        })}
      </nav>
    </>
  );
}
