import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { Activity } from 'lib/github-contributions';
import { cn } from 'lib/cn';
import styles from '../midnight.module.css';

/** Weeks run newest first, as in the recording, so the months read right to left in time. */
export function Heatmap({ contributions }: { contributions: Activity[] }) {
  const { weeks, months, total } = useMemo(() => build(contributions), [contributions]);
  if (!weeks.length) return null;

  return (
    <figure className={styles.heat}>
      <div className={cn(styles.months, styles.mono)} aria-hidden>
        {months.map(({ label, week }) => (
          <span key={`${label}-${week}`} style={{ left: `${(week / weeks.length) * 100}%` }}>
            {label}
          </span>
        ))}
      </div>
      <div
        className={styles.cells}
        role="img"
        aria-label={`${total} GitHub contributions in the last year`}
        style={{ gridTemplateColumns: `repeat(${weeks.length}, 1fr)` }}
      >
        {weeks.flatMap((week, weekIndex) =>
          week.map((day, dayIndex) =>
            day ? (
              <span
                key={day.date}
                className={styles.cell}
                data-level={day.level}
                title={`${day.count} contribution${day.count === 1 ? '' : 's'} on ${format(parseISO(day.date), 'd MMM yyyy')}`}
                style={{ gridColumn: weekIndex + 1, gridRow: dayIndex + 1 }}
              />
            ) : null
          )
        )}
      </div>
      <figcaption className={cn(styles.caption, styles.mono)}>
        Total {total} contributions in the last year
      </figcaption>
    </figure>
  );
}

function build(contributions: Activity[]) {
  if (!contributions.length) return { weeks: [], months: [], total: 0 };

  const days: (Activity | null)[] = [
    ...Array(parseISO(contributions[0].date).getDay()).fill(null),
    ...contributions
  ];
  const chronological: (Activity | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) chronological.push(days.slice(i, i + 7));
  const weeks = chronological.reverse();

  const months: { label: string; week: number }[] = [];
  weeks.forEach((week, index) => {
    const first = week.find(Boolean);
    if (!first) return;
    const label = format(parseISO(first.date), 'MMM');
    if (months[months.length - 1]?.label !== label) months.push({ label, week: index });
  });
  if (months.length > 1 && months[1].week - months[0].week < 3) months.shift();
  // A year spans 13 months, so the oldest week repeats the newest month's name.
  if (months.length > 1 && months[months.length - 1].label === months[0].label) months.pop();

  return { weeks, months, total: contributions.reduce((sum, day) => sum + day.count, 0) };
}
