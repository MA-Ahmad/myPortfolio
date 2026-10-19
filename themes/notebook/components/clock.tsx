import { useEffect, useState } from 'react';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { NOTEBOOK_CONTENT } from '../content';
import styles from '../notebook.module.css';

function currentTime() {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PROFILE.timeZone,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(new Date());
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '--';
  return { hours: get('hour'), minutes: get('minute') };
}

export function Clock() {
  const [time, setTime] = useState({ hours: '--', minutes: '--' });

  useEffect(() => {
    let timer: number;
    const tick = () => {
      setTime(currentTime());
      timer = window.setTimeout(tick, 60_000 - (Date.now() % 60_000));
    };
    tick();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={cn(styles.clock, styles.plate)}>
      <time className={styles.clockTime} aria-label={`${time.hours}:${time.minutes}`}>
        {time.hours}
        <span className={styles.colon} aria-hidden>
          :
        </span>
        {time.minutes}
      </time>
      <span className={styles.clockLabel}>{NOTEBOOK_CONTENT.clockLabel}</span>
    </div>
  );
}
