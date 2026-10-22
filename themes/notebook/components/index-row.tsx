import { CSSProperties, ReactNode } from 'react';
import Link from 'next/link';
import { cn } from 'lib/cn';
import styles from '../notebook.module.css';

type Tone = 'ink' | 'body' | 'faint';

const TONE: Record<Tone, string> = {
  ink: styles.toneInk,
  body: styles.toneBody,
  faint: styles.toneFaint
};

export function IndexSection({
  id,
  label,
  more,
  children
}: {
  id?: string;
  label: string;
  more?: { href: string; label: string; context: string; external?: boolean };
  children: ReactNode;
}) {
  return (
    <section id={id} className={styles.section} aria-labelledby={id ? `${id}-label` : undefined}>
      <div className={styles.sectionHead}>
        <h2 id={id ? `${id}-label` : undefined} className={cn(styles.sectionLabel, styles.plate)}>
          {label}
        </h2>
        {more ? (
          <MaybeExternal
            href={more.href}
            external={more.external}
            className={cn(styles.more, styles.plate)}
          >
            {more.label}
            <span className={styles.srOnly}> {more.context}</span>
            <span aria-hidden className={styles.arrow}>
              {more.external ? '↗' : '→'}
            </span>
          </MaybeExternal>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function IndexList({
  lead = '10ch',
  leadMobile,
  children
}: {
  lead?: string;
  leadMobile?: string;
  children: ReactNode;
}) {
  const style = { '--c1': lead, '--c1m': leadMobile ?? lead } as CSSProperties;
  return (
    <ul className={styles.list} style={style}>
      {children}
    </ul>
  );
}

export function IndexRow({
  href,
  external,
  lead,
  main,
  trail,
  leadTone = 'faint',
  mainTone = 'ink',
  clip,
  stackTrail,
  detail,
  stack
}: {
  href?: string;
  external?: boolean;
  /** Omit to drop the lead column, so the row starts at the left edge. */
  lead?: ReactNode;
  main: ReactNode;
  trail?: ReactNode;
  leadTone?: Tone;
  mainTone?: Tone;
  clip?: boolean;
  stackTrail?: boolean;
  /** Put `main` on its own wrapping line under `lead`, which carries the external arrow. */
  detail?: boolean;
  /** Always show `trail` as a wrapping second line under `main`, on every width. */
  stack?: boolean;
}) {
  const className = cn(
    styles.row,
    (stackTrail || stack) && styles.stackTrail,
    stack && styles.stack,
    detail && styles.detail,
    lead == null && styles.noLead
  );
  const arrow = (
    <span aria-hidden className={styles.arrow}>
      ↗
    </span>
  );
  const cells = (
    <>
      {lead == null ? null : (
        <span className={cn(styles.lead, TONE[leadTone])}>
          {lead}
          {detail && external ? arrow : null}
        </span>
      )}
      <span className={cn(styles.mainCell, TONE[mainTone], clip && styles.clip)}>{main}</span>
      {detail ? null : (
        <span className={styles.trail}>
          {trail}
          {external ? arrow : null}
        </span>
      )}
    </>
  );

  return (
    <li>
      {href ? (
        <MaybeExternal href={href} external={external} className={className}>
          {cells}
        </MaybeExternal>
      ) : (
        <div className={className}>{cells}</div>
      )}
    </li>
  );
}

function MaybeExternal({
  href,
  external,
  className,
  children
}: {
  href: string;
  external?: boolean;
  className?: string;
  children: ReactNode;
}) {
  if (!external) {
    return (
      <Link href={href} className={className}>
        {children}
      </Link>
    );
  }
  return (
    <a href={href} target="_blank" rel="noopener noreferrer" className={className}>
      {children}
      <span className={styles.srOnly}> (opens in new tab)</span>
    </a>
  );
}
