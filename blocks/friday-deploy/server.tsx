import { forwardRef, useEffect, useId, useRef } from 'react';
import styles from './friday-deploy.module.css';

export type ServerMood = 'idle' | 'alarmed' | 'flinch' | 'stunned';

const EYES = [47, 73];

/**
 * Production itself: a small graphite server, in the key's material, whose LED eyes follow the
 * pointer (the parent sets `--lx` and `--ly` on it). Green while healthy; amber, with its drive
 * lights busy, while it stares at the key; x x at the bang; then red, dazed and smoking from its
 * vents until the rollback. `--heat` on an ancestor lights it from below.
 */
export const Server = forwardRef<HTMLDivElement, { mood: ServerMood; smoking: boolean }>(
  function Server({ mood, smoking }, ref) {
    // Unique gradient ids, so two servers on one page never paint with each other's fills.
    const uid = useId().replace(/[^\w-]/g, '');
    const svgRef = useRef<SVGSVGElement>(null);

    // Blinks at uneven intervals, from a timer rather than an endless CSS animation, so an idle
    // server costs nothing between blinks.
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
        className={styles.server}
        data-mood={mood}
        data-smoking={smoking || undefined}
        aria-hidden
      >
        <svg ref={svgRef} viewBox="0 0 120 100" className={styles.serverSvg}>
          <defs>
            <linearGradient id={`${uid}-case`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2c2c31" />
              <stop offset="1" stopColor="#111113" />
            </linearGradient>
            <linearGradient id={`${uid}-glass`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#1c1c20" />
              <stop offset="1" stopColor="#0b0b0d" />
            </linearGradient>
            <radialGradient id={`${uid}-under`} cx="50%" cy="100%" r="90%">
              <stop offset="0" stopColor="#ffd6a0" />
              <stop offset="0.5" stopColor="#ff8a2a" />
              <stop offset="1" stopColor="#ff6a00" stopOpacity="0" />
            </radialGradient>
            <filter id={`${uid}-soft`} x="-30%" y="-30%" width="160%" height="160%">
              <feGaussianBlur stdDeviation="3" />
            </filter>
            <filter id={`${uid}-glow`} x="-100%" y="-60%" width="300%" height="220%">
              <feGaussianBlur stdDeviation="2.6" />
            </filter>
          </defs>

          <ellipse
            cx="60"
            cy="92"
            rx="42"
            ry="4"
            fill="#000"
            opacity="0.6"
            filter={`url(#${uid}-soft)`}
          />

          <rect x="14" y="8" width="92" height="80" rx="16" fill={`url(#${uid}-case)`} />
          <rect
            x="14.5"
            y="8.5"
            width="91"
            height="79"
            rx="15.5"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.07"
          />
          <path d="M28 8.6 H92" stroke="#fff" strokeOpacity="0.16" strokeLinecap="round" />

          <rect x="21" y="15" width="78" height="44" rx="10" fill={`url(#${uid}-glass)`} />
          <rect
            x="21.5"
            y="15.5"
            width="77"
            height="43"
            rx="9.5"
            fill="none"
            stroke="#fff"
            strokeOpacity="0.05"
          />

          <g className={styles.eyes}>
            {EYES.map((x) => (
              <g key={x} className={styles.eye} style={{ transformOrigin: `${x}px 34px` }}>
                <g className={styles.pupil}>
                  <rect
                    className={styles.led}
                    x={x - 5}
                    y="26"
                    width="10"
                    height="16"
                    rx="5"
                    filter={`url(#${uid}-glow)`}
                    opacity="0.75"
                  />
                  <rect className={styles.led} x={x - 4} y="27" width="8" height="14" rx="4" />
                  <rect x={x - 2.2} y="29" width="2" height="5" rx="1" fill="#fff" opacity="0.5" />
                </g>
              </g>
            ))}
          </g>
          <g className={styles.shut} fill="none" strokeWidth="2.4" strokeLinecap="round">
            {EYES.map((x) => (
              <path
                key={x}
                d={`M${x - 4.5} 29.5 L${x + 4.5} 38.5 M${x + 4.5} 29.5 L${x - 4.5} 38.5`}
              />
            ))}
          </g>

          <g
            className={styles.mouth}
            fill="none"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path className={styles.smile} d="M54 47 Q60 51.5 66 47" />
            <path className={styles.flat} d="M55 49 H65" />
            <path className={styles.zigzag} d="M52 49 L55 46.5 L58 50 L61 46.5 L64 50 L68 48" />
          </g>

          <g stroke="#000" strokeOpacity="0.55" strokeWidth="2" strokeLinecap="round">
            {Array.from({ length: 9 }, (_, i) => 26 + i * 5.5).map((x) => (
              <path key={x} d={`M${x} 68 V77`} />
            ))}
          </g>
          <g stroke="#fff" strokeOpacity="0.06" strokeWidth="1" strokeLinecap="round">
            {Array.from({ length: 9 }, (_, i) => 27 + i * 5.5).map((x) => (
              <path key={x} d={`M${x} 68.5 V77.5`} />
            ))}
          </g>
          {[82, 88, 94].map((x, i) => (
            <circle
              key={x}
              className={styles.activity}
              style={{ animationDelay: `${i * 55}ms` }}
              cx={x}
              cy="72.5"
              r="1.5"
            />
          ))}

          {/* The blast's light from below, then its soot and smoke. */}
          <rect
            className={styles.underlight}
            x="14"
            y="8"
            width="92"
            height="80"
            rx="16"
            fill={`url(#${uid}-under)`}
          />
          <g className={styles.soot} fill="#000" filter={`url(#${uid}-soft)`}>
            <ellipse cx="44" cy="84" rx="20" ry="5" opacity="0.6" />
            <ellipse cx="88" cy="78" rx="11" ry="6" opacity="0.5" />
            <ellipse cx="20" cy="46" rx="5" ry="9" opacity="0.45" />
            <ellipse cx="94" cy="14" rx="8" ry="4" opacity="0.4" />
          </g>
          <g className={styles.smoke} fill="#55504c" filter={`url(#${uid}-soft)`}>
            {[46, 60, 74].map((x, i) => (
              <circle key={x} cx={x} cy="4" r="5.5" style={{ animationDelay: `${i * 0.6}s` }} />
            ))}
          </g>
        </svg>
      </div>
    );
  }
);
