import { forwardRef, useEffect, useId, useRef } from 'react';
import styles from './friday-deploy.module.css';

export type DuckMood = 'idle' | 'alarmed' | 'flinch' | 'stunned';

/**
 * The rubber duck every developer explains their bugs to. It watches the pointer (the parent sets
 * `--lx` and `--ly` on it), stares at the key while it charges, squeezes its eyes shut at the
 * bang and keeps the soot until the rollback. `--heat` on an ancestor lights it from below.
 */
export const Duck = forwardRef<HTMLDivElement, { mood: DuckMood; sooty: boolean }>(function Duck(
  { mood, sooty },
  ref
) {
  // Unique gradient ids, so two ducks on one page never paint with each other's fills.
  const uid = useId().replace(/[^\w-]/g, '');
  const svgRef = useRef<SVGSVGElement>(null);

  // Blinks at uneven intervals, from a timer rather than an endless CSS animation, so an idle duck
  // costs nothing between blinks.
  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    let timer = 0;
    const schedule = () => {
      timer = window.setTimeout(
        () => {
          svg.setAttribute('data-blink', '');
          timer = window.setTimeout(() => {
            svg.removeAttribute('data-blink');
            schedule();
          }, 120);
        },
        2500 + Math.random() * 3500
      );
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div
      ref={ref}
      className={styles.duck}
      data-mood={mood}
      data-sooty={sooty || undefined}
      aria-hidden
    >
      <svg ref={svgRef} viewBox="0 0 140 120" className={styles.duckSvg}>
        <defs>
          <radialGradient id={`${uid}-body`} cx="38%" cy="28%" r="80%">
            <stop offset="0" stopColor="#fff07a" />
            <stop offset="0.5" stopColor="#ffc81e" />
            <stop offset="1" stopColor="#d98a00" />
          </radialGradient>
          <radialGradient id={`${uid}-head`} cx="36%" cy="30%" r="78%">
            <stop offset="0" stopColor="#fff38a" />
            <stop offset="0.55" stopColor="#ffcb22" />
            <stop offset="1" stopColor="#dc9000" />
          </radialGradient>
          <linearGradient id={`${uid}-beak`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#ffab45" />
            <stop offset="1" stopColor="#f26a0f" />
          </linearGradient>
          <radialGradient id={`${uid}-under`} cx="50%" cy="100%" r="90%">
            <stop offset="0" stopColor="#ffd6a0" />
            <stop offset="0.5" stopColor="#ff8a2a" />
            <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
          </radialGradient>
          <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" />
          </filter>
        </defs>

        <ellipse
          cx="70"
          cy="113"
          rx="42"
          ry="5"
          fill="#000"
          opacity="0.55"
          filter={`url(#${uid}-soft)`}
        />

        <path d="M106 76 Q124 62 127 48 Q126 70 110 88 Z" fill="#e09a00" />
        <ellipse cx="70" cy="86" rx="47" ry="26" fill={`url(#${uid}-body)`} />
        <ellipse cx="29" cy="85" rx="11" ry="17" transform="rotate(28 29 85)" fill="#f0ad00" />
        <ellipse cx="111" cy="85" rx="11" ry="17" transform="rotate(-28 111 85)" fill="#e9a400" />
        <ellipse cx="50" cy="76" rx="11" ry="4" fill="#fff" opacity="0.32" />

        <circle cx="70" cy="44" r="30" fill={`url(#${uid}-head)`} />
        <path d="M66 15 Q70 4 80 8 Q72 9 72 16 Z" fill="#f2b100" />
        <ellipse
          cx="57"
          cy="27"
          rx="10"
          ry="5"
          transform="rotate(-28 57 27)"
          fill="#fff"
          opacity="0.55"
        />

        <ellipse cx="47" cy="56" rx="6" ry="3.4" fill="#ff7a2a" opacity="0.3" />
        <ellipse cx="93" cy="56" rx="6" ry="3.4" fill="#ff7a2a" opacity="0.3" />

        <g className={styles.eyes}>
          {[57, 83].map((x) => (
            <g key={x} className={styles.eye} style={{ transformOrigin: `${x}px 41px` }}>
              <ellipse
                cx={x}
                cy="41"
                rx="7.5"
                ry="8.5"
                fill="#fff"
                stroke="rgba(120,70,0,0.25)"
                strokeWidth="0.8"
              />
              <g className={styles.pupil}>
                <circle cx={x} cy="42" r="4" fill="#141418" />
                <circle cx={x + 1.4} cy="40.4" r="1.3" fill="#fff" />
              </g>
            </g>
          ))}
        </g>
        <g
          className={styles.shut}
          fill="none"
          stroke="#141418"
          strokeWidth="2.6"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M52 37 L60 41 L52 45" />
          <path d="M88 37 L80 41 L88 45" />
        </g>

        <ellipse cx="70" cy="61" rx="9" ry="4" fill="#d9560a" />
        <ellipse cx="70" cy="56" rx="14" ry="6" fill={`url(#${uid}-beak)`} />
        <ellipse cx="65" cy="54" rx="4.5" ry="1.6" fill="#fff" opacity="0.45" />

        <path className={styles.sweat} d="M104 22 Q110 31 104 35 Q98 31 104 22 Z" fill="#8fdcff" />

        {/* The blast's light from below, then its soot. */}
        <g className={styles.underlight}>
          <ellipse cx="70" cy="86" rx="47" ry="26" fill={`url(#${uid}-under)`} />
          <circle cx="70" cy="44" r="30" fill={`url(#${uid}-under)`} />
        </g>
        <g className={styles.soot} fill="#1a0e08" filter={`url(#${uid}-soft)`}>
          <ellipse cx="58" cy="100" rx="24" ry="8" opacity="0.7" />
          <ellipse cx="92" cy="96" rx="14" ry="7" opacity="0.6" />
          <ellipse cx="44" cy="60" rx="8" ry="6" opacity="0.45" />
          <ellipse cx="88" cy="24" rx="7" ry="5" opacity="0.35" />
          <ellipse cx="74" cy="62" rx="9" ry="4" opacity="0.4" />
        </g>
      </svg>
    </div>
  );
});
