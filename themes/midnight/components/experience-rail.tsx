import { useState } from 'react';
import Link from 'next/link';
import { ChevronsRight } from 'lucide-react';
import { EXPERIENCES } from 'data/profile';
import { cn } from 'lib/cn';
import { Logo } from './logo';
import styles from '../midnight.module.css';

const STOPS = EXPERIENCES.slice(0, 4);
/** The lit line always reaches this far (% of the rail) past the active stop, so it never vanishes. */
const LEAD = 14;

export function ExperienceRail() {
  const [active, setActive] = useState(0);
  const step = 100 / STOPS.length;

  return (
    <section
      className={styles.rail}
      aria-label="Experience"
      onMouseLeave={() => setActive(0)}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) setActive(0);
      }}
    >
      <div className={styles.railLine} aria-hidden>
        <span
          className={styles.railLit}
          style={{ transform: `scaleX(${(active * step + LEAD) / 100})` }}
        />
        {STOPS.map((stop, index) => (
          <span
            key={stop.id}
            className={styles.railDot}
            data-passed={index <= active}
            style={{ left: `${index * step}%` }}
          />
        ))}
        <span className={styles.railTrack} style={{ transform: `translateX(${active * step}%)` }}>
          <span className={styles.railRing} />
        </span>
      </div>
      <Link href="/themes/midnight/work" className={cn(styles.all, styles.mono)}>
        ALL <ChevronsRight size={14} />
      </Link>
      <div className={styles.stops}>
        {STOPS.map((stop, index) => {
          const { start, end } = stop.positions[0].employmentPeriod;
          return (
            <button
              key={stop.id}
              type="button"
              className={styles.stop}
              data-on={index === active}
              onMouseEnter={() => setActive(index)}
              onFocus={() => setActive(index)}
              onClick={() => setActive(index)}
            >
              <span className={styles.stopHead}>
                <Logo src={stop.companyLogo} name={stop.companyName} />
                <span>{stop.companyName}</span>
              </span>
              <span className={cn(styles.stopDates, styles.mono)} style={{ display: 'block' }}>
                {start} - {end ?? 'Now'}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
