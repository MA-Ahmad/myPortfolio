import { useMemo } from 'react';
import { format, parseISO } from 'date-fns';
import type { Activity } from 'lib/github-contributions';
import styles from '../panorama.module.css';

/**
 * The last year of GitHub contributions, one cell a day, oldest week on the left. On a narrow
 * screen the grid keeps its cell size and the oldest weeks fall off the left edge.
 */
export function Contributions({ contributions }: { contributions: Activity[] }) {
  const { weeks, total } = useMemo(() => build(contributions), [contributions]);
  if (!weeks.length) return null;

  return (
    <figure className={styles.contrib}>
      <div
        className={styles.contribGrid}
        role="img"
        aria-label={`${total} GitHub contributions in the last year`}
        style={{ gridTemplateColumns: `repeat(${weeks.length}, var(--cell))` }}
      >
        {weeks.flatMap((week, w) =>
          week.map((day, d) =>
            day ? (
              <span
                key={day.date}
                data-level={day.level}
                title={`${day.count} contribution${day.count === 1 ? '' : 's'} on ${format(parseISO(day.date), 'd MMM yyyy')}`}
                style={{ gridColumn: w + 1, gridRow: d + 1 }}
              />
            ) : null
          )
        )}
      </div>
      <figcaption className={styles.contribCaption}>
        <span>{total.toLocaleString('en-US')} contributions in the last year</span>
        <span className={styles.contribLegend} aria-hidden>
          Less
          {[0, 1, 2, 3, 4].map((level) => (
            <span key={level} data-level={level} />
          ))}
          More
        </span>
      </figcaption>
    </figure>
  );
}

function build(contributions: Activity[]) {
  if (!contributions.length) return { weeks: [], total: 0 };
  // Pad the first week so every column starts on a Sunday.
  const days: (Activity | null)[] = [
    ...Array(parseISO(contributions[0].date).getDay()).fill(null),
    ...contributions
  ];
  const weeks: (Activity | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  return { weeks, total: contributions.reduce((sum, day) => sum + day.count, 0) };
}
