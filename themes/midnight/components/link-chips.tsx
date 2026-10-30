import type { ComponentType } from 'react';
import { Code, FileText } from 'lucide-react';
import { PROFILE } from 'data/profile';
import { GithubIcon, LinkedinIcon, XIcon } from './icons';
import styles from '../midnight.module.css';

const ICONS: Record<string, ComponentType> = {
  github: GithubIcon,
  twitter: XIcon,
  linkedin: LinkedinIcon,
  devto: Code
};

const LABELS: Record<string, string> = { twitter: 'Twitter', github: 'Github', linkedin: 'Linkedin', devto: 'Dev.to' };

export function LinkChips() {
  const socials = PROFILE.socials.filter((social) => social.name !== 'email');
  return (
    <>
      <p className={styles.sectionLine}>
        Find me <span className={styles.strong}>elsewhere</span>
      </p>
      <div className={styles.chips}>
        <a className={styles.chipLink} href={PROFILE.resumeUrl} target="_blank" rel="noreferrer">
          <FileText /> Resume
        </a>
        {socials.map((social) => {
          const Icon = ICONS[social.name] ?? Code;
          return (
            <a
              key={social.name}
              className={styles.chipLink}
              href={social.href}
              target="_blank"
              rel="noreferrer"
            >
              <Icon />
              {LABELS[social.name] ?? social.title}
            </a>
          );
        })}
      </div>
    </>
  );
}
