import { useEffect, useMemo, useRef } from 'react';
import { format, parseISO } from 'date-fns';
import { Activity } from 'lib/github-contributions';
import { cn } from 'lib/cn';
import styles from '../terminal.module.css';
import { Section } from './section';

// 12px blocks with 3px gaps keep a full 53-week year inside the max-w-4xl column.
const BLOCK = 12;
const STEP = 15;
const LABEL_HEIGHT = 20;

export function Contributions({ contributions }: { contributions: Activity[] }) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const { weeks, months, total } = useMemo(() => buildWeeks(contributions), [contributions]);

  // When the year doesn't fit, start at the most recent weeks.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollLeft = el.scrollWidth;
  }, []);

  if (!contributions?.length) {
    return null;
  }

  const width = weeks.length * STEP - (STEP - BLOCK);
  const height = LABEL_HEIGHT + 7 * STEP - (STEP - BLOCK);

  return (
    <Section>
      <figure className="flex w-full flex-col gap-2 rounded-sm border border-term-border p-4 text-xs">
        <div ref={scrollRef} className={cn(styles.noScrollbar, 'overflow-x-auto pt-0.5')}>
          <svg
            width={width}
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            className="mx-auto block overflow-visible"
            role="img"
            aria-label={`${total} GitHub contributions in the last year`}
          >
            <g aria-hidden>
              {months.map(({ label, week }) => (
                <text
                  key={`${label}-${week}`}
                  x={week * STEP}
                  y={0}
                  dominantBaseline="hanging"
                  fill="currentColor"
                >
                  {label}
                </text>
              ))}
            </g>
            {weeks.map((week, weekIndex) =>
              week.map((day, dayIndex) =>
                day ? (
                  <rect
                    key={day.date}
                    x={weekIndex * STEP}
                    y={LABEL_HEIGHT + dayIndex * STEP}
                    width={BLOCK}
                    height={BLOCK}
                    rx={2}
                    ry={2}
                    className={styles.cell}
                    data-level={day.level}
                  >
                    <title>
                      {`${day.count} contribution${day.count === 1 ? '' : 's'} on ${format(parseISO(day.date), 'd MMM yyyy')}`}
                    </title>
                  </rect>
                ) : null
              )
            )}
          </svg>
        </div>

        <figcaption
          className="mx-auto flex w-full flex-wrap gap-x-4 gap-y-1 whitespace-nowrap"
          style={{ maxWidth: width }}
        >
          <span>{total} contributions in the last year</span>
          <span className="ml-auto flex items-center gap-[3px]" aria-hidden>
            <span className="mr-[0.4em]">Less</span>
            {[0, 1, 2, 3, 4].map((level) => (
              <svg key={level} width={BLOCK} height={BLOCK}>
                <rect
                  width={BLOCK}
                  height={BLOCK}
                  rx={2}
                  ry={2}
                  className={styles.cell}
                  data-level={level}
                />
              </svg>
            ))}
            <span className="ml-[0.4em]">More</span>
          </span>
        </figcaption>
      </figure>
    </Section>
  );
}

function buildWeeks(contributions: Activity[]) {
  const days: (Activity | null)[] = [];
  if (contributions.length) {
    const firstWeekday = parseISO(contributions[0].date).getDay();
    days.push(...Array(firstWeekday).fill(null), ...contributions);
  }

  const weeks: (Activity | null)[][] = [];
  for (let i = 0; i < days.length; i += 7) {
    weeks.push(days.slice(i, i + 7));
  }

  const months: { label: string; week: number }[] = [];
  weeks.forEach((week, index) => {
    const firstDay = week.find(Boolean);
    if (!firstDay) return;
    const label = format(parseISO(firstDay.date), 'MMM');
    if (months[months.length - 1]?.label !== label) {
      months.push({ label, week: index });
    }
  });
  // A partial first month would collide with the next label.
  if (months.length > 1 && months[1].week - months[0].week < 3) {
    months.shift();
  }

  const total = contributions.reduce((sum, day) => sum + day.count, 0);
  return { weeks, months, total };
}
