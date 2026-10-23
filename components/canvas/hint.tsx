import { type CSSProperties, useEffect, useRef } from 'react';
import { type Point, wirePath } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import { type CardId, cardById } from './nodes';
import { GLYPHS, GLYPH_FLICKER_MS, PacketToken, across, easeInOutSine, packetIcon } from './packets';

// The ghost wire draws in first, then a token glides down it, rests a moment, and comes again.
const FIRST_MS = 380;
const GLIDE_MS = 1300;
const REST_MS = 450;
const TRAIL = 2;
const TRAIL_GAP = 13;
const TOKEN_SCALE = 0.8;
// The token comes on at 90% of its size, and is drawn into the display's input over the last
// quarter of its glide, shrinking to this as it fades.
const ENTER = 0.15;
const ABSORB = 0.25;
const ABSORBED_SCALE = 0.45;
// The ghost wire meets the edge of both ports' rings, 7px out (12px across plus a 1px ring),
// rather than running over the circles.
const PORT_GAP = 7;
// The input's answer when a token lands: a ring opening out and fading, on a strong ease-out.
const PULSE_MS = 560;
const PULSE_AT = 0.88;
const EASE_OUT_EXPO = 'cubic-bezier(0.19, 1, 0.22, 1)';

const smoothstep = (x: number) => {
  const t = Math.min(1, Math.max(0, x));
  return t * t * (3 - 2 * t);
};

type Props = {
  source: CardId;
  from: Point;
  fromDir: number;
  to: Point;
  toDir: number;
  /** Fades out before it is removed. */
  leaving: boolean;
};

/**
 * What plugging a theme in would do, shown while its port is hovered or focused: a faint wire to
 * the display, and one of its skill icons gliding down it on a loop, a different one each time,
 * with a little of its ASCII behind.
 */
export function Hint({ source, from, fromDir, to, toDir, leaving }: Props) {
  const icons = cardById(source).packets;
  const pathRef = useRef<SVGPathElement>(null);
  const pulseRef = useRef<SVGCircleElement>(null);
  const tokenRef = useRef<SVGGElement>(null);
  const imageRef = useRef<SVGImageElement>(null);
  const glyphRefs = useRef<(SVGTextElement | null)[]>([]);
  // The token rides from port center to port center; the wire you see stops at the rings.
  const d = wirePath(from, fromDir, to, toDir);
  const shown = wirePath(
    { x: from.x + fromDir * PORT_GAP, y: from.y },
    fromDir,
    { x: to.x + toDir * PORT_GAP, y: to.y },
    toDir
  );

  useEffect(() => {
    const path = pathRef.current!;
    const token = tokenRef.current!;
    const image = imageRef.current!;
    const pulse = pulseRef.current!;
    const charset = GLYPHS[source];
    const start = performance.now();
    let lap = -1;
    let landed = true;
    let frame = 0;

    const step = (now: number) => {
      const elapsed = now - start - FIRST_MS;
      const length = path.getTotalLength();
      const cycle = elapsed < 0 ? -1 : Math.floor(elapsed / (GLIDE_MS + REST_MS));
      const t = elapsed < 0 ? 0 : Math.min(1, (elapsed % (GLIDE_MS + REST_MS)) / GLIDE_MS);
      if (cycle !== lap && cycle >= 0) {
        lap = cycle;
        image.setAttribute('href', packetIcon(icons[lap % icons.length]));
        landed = false;
      }
      const along = easeInOutSine(t) * length;
      // In: up from 90% as it leaves the card. Out: drawn into the input as it slows into it.
      const enter = smoothstep(t / ENTER);
      const absorb = smoothstep((t - (1 - ABSORB)) / ABSORB);
      const opacity = elapsed < 0 ? 0 : enter * (1 - absorb);
      const scale = TOKEN_SCALE * (0.9 + 0.1 * enter) * (1 - (1 - ABSORBED_SCALE) * absorb);
      const at = path.getPointAtLength(along);
      token.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${scale.toFixed(3)})`);
      token.setAttribute('opacity', (opacity * 0.9).toFixed(3));
      // Fired while the token is still being drawn in, and eased up from nothing, so the ring
      // carries on from the token instead of popping after it.
      if (t >= PULSE_AT && !landed) {
        landed = true;
        pulse.animate(
          [
            { opacity: 0, transform: 'scale(1)' },
            { opacity: 0.5, transform: 'scale(1.3)', offset: 0.18 },
            { opacity: 0, transform: 'scale(2.4)' }
          ],
          { duration: PULSE_MS, easing: EASE_OUT_EXPO }
        );
      }

      const tick = Math.floor(now / GLYPH_FLICKER_MS);
      glyphRefs.current.forEach((glyph, k) => {
        if (!glyph) return;
        const back = along - 12 - TRAIL_GAP * (k + 0.6);
        if (opacity <= 0 || back <= 0) return glyph.setAttribute('opacity', '0');
        const sway = (k % 2 ? 1 : -1) * 3 * Math.sin(now / 160 + k);
        const p = across(path, back, length, sway);
        glyph.setAttribute('x', p.x.toFixed(1));
        glyph.setAttribute('y', p.y.toFixed(1));
        glyph.setAttribute('opacity', (opacity * (0.7 - k * 0.25)).toFixed(3));
        const char = charset[(tick + k * 5) % charset.length];
        if (glyph.textContent !== char) glyph.textContent = char;
      });
      frame = requestAnimationFrame(step);
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // One hint per hover; a new source mounts a new one.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g
      className={styles.hint}
      data-leaving={leaving || undefined}
      style={{ '--accent': `var(--accent-${source})` } as CSSProperties}
    >
      <path className={styles.hintWire} d={shown} pathLength={1} />
      <path ref={pathRef} d={d} fill="none" stroke="none" />
      <circle ref={pulseRef} className={styles.hintPulse} cx={to.x} cy={to.y} r={7} opacity={0} />
      <g className={styles.packets} data-theme={source}>
        {Array.from({ length: TRAIL }, (_, k) => (
          <text
            key={k}
            ref={(node) => void (glyphRefs.current[k] = node)}
            className={styles.packetGlyph}
            textAnchor="middle"
            dominantBaseline="central"
            opacity={0}
          />
        ))}
        <g ref={tokenRef} opacity={0}>
          <PacketToken source={source} icon={icons[0]} imageRef={imageRef} />
        </g>
      </g>
    </g>
  );
}
