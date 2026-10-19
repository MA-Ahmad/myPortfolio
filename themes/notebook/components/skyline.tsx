import { useEffect, useMemo, useRef, useState } from 'react';
import type { Activity } from 'lib/github-contributions';
import { buildSkylineData, formatCount, shortDate, weeklyTotals } from '../lib/skyline-data';
import { ContributionBars } from './contribution-bars';
import styles from '../notebook.module.css';

type Phase = 'loading' | 'ready' | 'fallback';

export function Skyline({ contributions }: { contributions: Activity[] }) {
  const data = useMemo(() => buildSkylineData(contributions), [contributions]);
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [hoveredDay, setHoveredDay] = useState<number | null>(null);
  const [hoveredWeek, setHoveredWeek] = useState<number | null>(null);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    let cancelled = false;
    let destroy: (() => void) | undefined;
    const scene = import('../lib/skyline-scene');

    // Mount once the chunk has loaded and the stage is near the viewport, so the city rises in view.
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return;
        observer.disconnect();
        scene
          .then(({ mountSkyline }) => {
            if (cancelled) return;
            destroy = mountSkyline(canvas, data, {
              tokenSource: stage,
              labelHost: stage,
              labelClass: styles.monthLabel,
              onHover: setHoveredDay,
              onReady: () => !cancelled && setPhase('ready')
            });
          })
          .catch(() => !cancelled && setPhase('fallback'));
      },
      { rootMargin: '200px' }
    );
    observer.observe(stage);

    return () => {
      cancelled = true;
      observer.disconnect();
      destroy?.();
    };
  }, [data]);

  const peak = data.peak;
  const label = `contributions per day over the past year: ${formatCount(data.total)} total${
    peak ? `, busiest day ${shortDate(peak.date)} with ${formatCount(peak.count)}` : ''
  }`;

  return (
    <div>
      {phase === 'fallback' ? (
        <div role="img" aria-label={label}>
          <ContributionBars data={data} onHoverWeek={setHoveredWeek} />
        </div>
      ) : (
        <div
          ref={stageRef}
          className={styles.stage}
          role="img"
          aria-label={label}
          tabIndex={0}
          data-ready={phase === 'ready' ? '' : undefined}
        >
          <canvas ref={canvasRef} />
          <div className={styles.noScriptBars}>
            <ContributionBars data={data} />
          </div>
        </div>
      )}

      <Caption data={data} phase={phase} hoveredDay={hoveredDay} hoveredWeek={hoveredWeek} />

      <table className={styles.srOnly}>
        <caption>contributions per month</caption>
        <thead>
          <tr>
            <th scope="col">month</th>
            <th scope="col">contributions</th>
          </tr>
        </thead>
        <tbody>
          {data.monthly.map((month) => (
            <tr key={month.label}>
              <th scope="row">{month.label}</th>
              <td>{formatCount(month.count)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Caption({
  data,
  phase,
  hoveredDay,
  hoveredWeek
}: {
  data: ReturnType<typeof buildSkylineData>;
  phase: Phase;
  hoveredDay: number | null;
  hoveredWeek: number | null;
}) {
  const day = hoveredDay === null ? null : data.days[hoveredDay];
  const weekStart =
    phase === 'fallback' && hoveredWeek !== null
      ? data.days.find((d) => d.week === hoveredWeek)
      : undefined;

  return (
    <div className={styles.caption} aria-hidden>
      <span>
        {day ? (
          <>
            <span className={styles.captionUnit}>{shortDate(day.date)} · </span>
            <span className={styles.captionNumber}>{formatCount(day.count)}</span>
            <span className={styles.captionUnit}> contributions</span>
          </>
        ) : weekStart ? (
          <>
            <span className={styles.captionUnit}>week of {shortDate(weekStart.date).slice(4)} · </span>
            <span className={styles.captionNumber}>
              {formatCount(weeklyTotals(data)[hoveredWeek!])}
            </span>
          </>
        ) : (
          <>
            <span className={styles.captionNumber}>{formatCount(data.total)}</span>
            <span className={styles.captionUnit}> contributions</span>
          </>
        )}
      </span>
      <span className={styles.captionUnit}>past year</span>
    </div>
  );
}
