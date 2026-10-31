import { Heart, Mail } from 'lucide-react';
import { PROFILE } from 'data/profile';
import type { Activity } from 'lib/github-contributions';
import { cn } from 'lib/cn';
import { MIDNIGHT_CONTENT } from '../content';
import { XIcon } from './icons';
import { ExperienceRail } from './experience-rail';
import { Heatmap } from './heatmap';
import { LinkChips } from './link-chips';
import { Pipeline } from './pipeline';
import { SoundToggle } from './sound-toggle';
import { TornPill } from './torn-pill';
import { PixelHeading } from './pixel-heading';
import { ProjectCards } from './project-cards';
import styles from '../midnight.module.css';

function Paragraph({ parts }: { parts: (string | [string])[] }) {
  return (
    <p className={styles.lead}>
      {parts.map((part, index) =>
        typeof part === 'string' ? (
          part
        ) : (
          <span key={index} className={styles.strong}>
            {part[0]}
          </span>
        )
      )}
    </p>
  );
}

const twitter = PROFILE.socials.find((social) => social.name === 'twitter')!;

export function HomePage({ contributions }: { contributions: Activity[] }) {
  const [first, second] = MIDNIGHT_CONTENT.intro;
  return (
    <>
      <div className={styles.heroHead}>
        <p className={cn(styles.eyebrow, styles.mono)}>{MIDNIGHT_CONTENT.greeting}</p>
        <PixelHeading subtitle={`/ ${MIDNIGHT_CONTENT.handle}`}>
          {PROFILE.displayName.toUpperCase()}
        </PixelHeading>
        <SoundToggle />
      </div>
      <Paragraph parts={first} />

      <div>
        <div>
          <Paragraph parts={second} />
          <div className={styles.pillRow}>
            <TornPill seed={11} href={twitter.href} target="_blank" rel="noreferrer">
              <XIcon width={12} height={12} /> Message me on X
            </TornPill>
            <span className={cn(styles.or, styles.mono)}>OR</span>
            <TornPill seed={17} href={`mailto:${PROFILE.email}`}>
              <Mail size={13} strokeWidth={1.75} /> Send an email
            </TornPill>
          </div>
        </div>
        <Pipeline />
      </div>

      <Heatmap contributions={contributions} />
      <ExperienceRail />
      <LinkChips />
      <ProjectCards />

      <footer className={styles.footer}>
        <Heart size={20} strokeWidth={1.5} />
        <p>Thanks for stopping by.</p>
        <p className={styles.subtitle}>
          © {new Date().getFullYear()} {PROFILE.displayName}. All rights reserved.
        </p>
      </footer>
    </>
  );
}
