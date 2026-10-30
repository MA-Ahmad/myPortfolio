import { cn } from 'lib/cn';
import { MIDNIGHT_CONTENT } from '../content';
import { Logo } from './logo';
import { PixelHeading } from './pixel-heading';
import styles from '../midnight.module.css';

export function WorkList() {
  return (
    <>
      <PixelHeading subtitle="Where I’ve been building">Work</PixelHeading>
      <div className={styles.jobs}>
        {MIDNIGHT_CONTENT.work.map((job) => (
          <article key={job.id} className={styles.job}>
            <div className={styles.jobHead}>
              <Logo src={job.logo} name={job.company} className={styles.jobLogo} />
              <div className={styles.jobWho}>
                <div className={styles.jobName}>
                  {job.company}
                  {job.badge ? <span className={cn(styles.badge, styles.mono)}>{job.badge}</span> : null}
                </div>
                <div className={styles.jobRole}>{job.role}</div>
              </div>
              <span className={styles.jobRule} aria-hidden />
              <div className={cn(styles.jobWhen, styles.mono)}>
                <span className={styles.jobPeriod}>
                  {job.current ? <i className={styles.live} aria-hidden /> : null}
                  {job.period}
                </span>
                {job.location !== job.badge ? <span>{job.location}</span> : null}
              </div>
            </div>
            <ul className={styles.bullets}>
              {job.bullets.map((bullet) => (
                <li key={bullet}>{bullet}</li>
              ))}
            </ul>
            <ul className={styles.tags} aria-label="Stack">
              {job.stack.map((name) => (
                <li key={name} className={cn(styles.tag, styles.mono)}>
                  {name}
                </li>
              ))}
            </ul>
          </article>
        ))}
      </div>
    </>
  );
}
