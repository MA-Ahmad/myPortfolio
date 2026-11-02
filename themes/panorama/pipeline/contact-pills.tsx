import type { ReactNode } from 'react';
import { FileText, Mail } from 'lucide-react';
import { PROFILE } from 'data/profile';
import { TornPill } from './torn-pill';
import styles from './pipeline.module.css';

const twitter = PROFILE.socials.find((social) => social.name === 'twitter')!;

const XLogo = () => (
  <svg width={12} height={12} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
  </svg>
);

const GitHubLogo = () => (
  <svg width={14} height={14} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M12 .5C5.65.5.5 5.65.5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.56v-2c-3.2.7-3.87-1.37-3.87-1.37-.53-1.33-1.28-1.69-1.28-1.69-1.05-.72.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.55-.29-5.24-1.28-5.24-5.68 0-1.26.45-2.28 1.18-3.09-.12-.29-.51-1.46.11-3.04 0 0 .97-.31 3.17 1.18a11 11 0 0 1 5.77 0c2.2-1.49 3.17-1.18 3.17-1.18.62 1.58.23 2.75.11 3.04.74.81 1.18 1.83 1.18 3.09 0 4.41-2.69 5.38-5.25 5.67.41.36.78 1.06.78 2.14v3.17c0 .31.21.67.8.56A11.5 11.5 0 0 0 23.5 12C23.5 5.65 18.35.5 12 .5Z" />
  </svg>
);

const LinkedInLogo = () => (
  <svg width={13} height={13} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
    <path d="M20.45 20.45h-3.56v-5.57c0-1.33-.02-3.04-1.85-3.04-1.85 0-2.14 1.45-2.14 2.94v5.67H9.34V9h3.42v1.56h.05c.48-.9 1.64-1.85 3.37-1.85 3.6 0 4.27 2.37 4.27 5.46v6.28ZM5.34 7.43a2.06 2.06 0 1 1 0-4.13 2.06 2.06 0 0 1 0 4.13ZM7.12 20.45H3.56V9h3.56v11.45ZM22.22 0H1.77C.79 0 0 .77 0 1.73v20.54C0 23.23.79 24 1.77 24h20.45c.98 0 1.78-.77 1.78-1.73V1.73C24 .77 23.2 0 22.22 0Z" />
  </svg>
);

const ICONS: Record<string, ReactNode> = {
  github: <GitHubLogo />,
  linkedin: <LinkedInLogo />,
  resume: <FileText size={13} strokeWidth={1.75} aria-hidden />
};

type Link = { id: string; label: string; href: string };

/**
 * The two ways to reach me, as torn pills that join under the pointer, then the other links in
 * the same skin, each as its icon alone: GitHub, LinkedIn, résumé.
 */
export function ContactPills({ links }: { links: Link[] }) {
  return (
    <div className={styles.pillRow}>
      <TornPill seed={11} href={twitter.href} target="_blank" rel="noreferrer">
        <XLogo /> Message me on X
      </TornPill>
      {/* OR stays with the second pill, so a narrow row wraps as "X" then "OR email". */}
      <span className={styles.pillPair}>
        <span className={styles.or}>OR</span>
        <TornPill seed={17} href={`mailto:${PROFILE.email}`}>
          <Mail size={13} strokeWidth={1.75} /> Send an email
        </TornPill>
      </span>
      <ul className={styles.socials}>
        {links.map((link) => (
          <li key={link.id}>
            <a
              href={link.href}
              target="_blank"
              rel="noreferrer"
              className={styles.social}
              aria-label={link.label}
              title={link.label}
            >
              {ICONS[link.id]}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
