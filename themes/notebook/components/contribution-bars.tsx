import { CSSProperties } from 'react';
import { cn } from 'lib/cn';
import { MAX_VOXELS, type SkylineData, weeklyTotals } from '../lib/skyline-data';
import styles from '../notebook.module.css';

/** Flat weekly bars: the graph without JavaScript and the fallback without WebGL. */
export function ContributionBars({
  data,
  onHoverWeek
}: {
  data: SkylineData;
  onHoverWeek?: (week: number | null) => void;
}) {
  const weeks = weeklyTotals(data);
  const peak = Math.max(1, ...weeks);

  return (
    <div className={styles.bars} aria-hidden onPointerLeave={() => onHoverWeek?.(null)}>
      {weeks.map((total, week) => {
        const squares = total === 0 ? 0 : Math.max(1, Math.round((total / peak) * MAX_VOXELS));
        return (
          <div
            key={week}
            className={cn(styles.bar, squares === 0 && styles.barEmpty)}
            style={
              squares === 0
                ? undefined
                : ({ height: `calc(${squares} * (var(--sq) + var(--gap)) - var(--gap))` } as CSSProperties)
            }
            onPointerEnter={() => onHoverWeek?.(week)}
          />
        );
      })}
    </div>
  );
}
