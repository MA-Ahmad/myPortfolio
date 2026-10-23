import { type CSSProperties, type Ref, useEffect, useRef } from 'react';
import { type Point, wirePath } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import { type CardId, cardById } from './nodes';

// Plugging in sends this many of the theme's icons; the hover hint cycles through them all.
const TRANSFER_COUNT = 4;
const START_MS = 60;
// A packet covers the wire in about this long per pixel, within these bounds.
const MS_PER_PX = 2.4;
const TRAVEL_MS = { min: 560, max: 800 };
// Packets leave at least this often, and further apart on a short wire, so they never overlap.
const STAGGER_MS = { min: 150, max: 260 };
const SPACING = 46;
// Each packet is a white token with the skill's icon on it, so dark and colored logos both read.
const TOKEN = 30;
const ICON = 19;

export const packetIcon = (file: string) => `/assets/images/skills/${file}`;

// ASCII riding the wire with the icons, in each theme's own characters, flickering through the
// set as it goes: a short trail behind every icon, and a few strays trickling between them.
export const GLYPHS: Record<CardId, string> = {
  home: '</>{}();=*+',
  terminal: '$>_/~|01#{}',
  notebook: "aeiou·.,'~*"
};
export const GLYPH_FLICKER_MS = 90;
// Each trail glyph follows this far behind the one before, swaying across the wire.
const TRAIL = 3;
const TRAIL_GAP = 13;
const TRAIL_SWAY = 4;
const STRAY_COUNT = 10;
const STRAY_DRIFT = 12;

type Stray = { delay: number; pace: number; side: number };

/** `at` on the wire moved `offset` across it, square to the wire's direction there. */
export function across(path: SVGPathElement, along: number, length: number, offset: number) {
  const at = path.getPointAtLength(along);
  const ahead = path.getPointAtLength(Math.min(length, along + 1));
  const behind = path.getPointAtLength(Math.max(0, along - 1));
  const dx = ahead.x - behind.x;
  const dy = ahead.y - behind.y;
  const norm = Math.hypot(dx, dy) || 1;
  return { x: at.x - (dy / norm) * offset, y: at.y + (dx / norm) * offset };
}

export const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

type Props = {
  source: CardId;
  from: Point;
  fromDir: number;
  to: Point;
  toDir: number;
  /** Set when the wire is pulled out: everything stops where it is and fades. */
  stopped: boolean;
  /** Each time a packet reaches the display. */
  onArrive: () => void;
  onDone: () => void;
};

/** A skill icon on its white token, centered on the origin. */
export function PacketToken({ source, icon, imageRef }: { source: CardId; icon: string; imageRef?: Ref<SVGImageElement> }) {
  return (
    <>
      <rect
        className={styles.packetHalo}
        x={-TOKEN / 2 - 4}
        y={-TOKEN / 2 - 4}
        width={TOKEN + 8}
        height={TOKEN + 8}
        rx={source === 'terminal' ? 9 : TOKEN / 2 + 4}
      />
      <rect
        className={styles.packetToken}
        x={-TOKEN / 2}
        y={-TOKEN / 2}
        width={TOKEN}
        height={TOKEN}
        rx={source === 'terminal' ? 6 : TOKEN / 2}
      />
      <image ref={imageRef} href={packetIcon(icon)} x={-ICON / 2} y={-ICON / 2} width={ICON} height={ICON} />
    </>
  );
}

/**
 * The theme's skill icons riding the plugged-in wire into the display, one after another: they
 * fade in off the card's port, ease along the wire, and shrink into the display's input.
 * Positions are set per frame on the elements, so React renders them once.
 */
export function Packets({ source, from, fromDir, to, toDir, stopped, onArrive, onDone }: Props) {
  const icons = cardById(source).packets.slice(0, TRANSFER_COUNT);
  const pathRef = useRef<SVGPathElement>(null);
  const packetRefs = useRef<(SVGGElement | null)[]>([]);
  const glyphRefs = useRef<(SVGTextElement | null)[]>([]);
  const callbacks = useRef({ onArrive, onDone });
  callbacks.current = { onArrive, onDone };
  const stoppedRef = useRef(stopped);
  stoppedRef.current = stopped;
  const d = wirePath(from, fromDir, to, toDir);

  useEffect(() => {
    const path = pathRef.current!;
    // The display swells as packets land, so the wire's end moves; this length only paces them.
    const length = path.getTotalLength();
    const travel = Math.min(TRAVEL_MS.max, Math.max(TRAVEL_MS.min, length * MS_PER_PX));
    const stagger = Math.min(STAGGER_MS.max, Math.max(STAGGER_MS.min, (SPACING * travel) / length));
    const total = START_MS + (icons.length - 1) * stagger + travel;
    const arrived = new Set<number>();
    const charset = GLYPHS[source];
    // Strays leave evenly over the transfer, each landing before the last icon does.
    const strays: Stray[] = Array.from({ length: STRAY_COUNT }, (_, i) => {
      const pace = travel * (0.8 + Math.random() * 0.3);
      return {
        pace,
        delay: START_MS + (i / (STRAY_COUNT - 1)) * Math.max(0, total - pace - START_MS),
        // Well out to one side, so none sits on the line itself.
        side: (i % 2 ? -1 : 1) * STRAY_DRIFT * (0.6 + Math.random() * 0.4)
      };
    });
    const glyphAt = (i: number) => glyphRefs.current[i];
    const hide = (glyph: SVGTextElement) => glyph.setAttribute('opacity', '0');
    const show = (glyph: SVGTextElement, p: Point, opacity: number, char: string) => {
      glyph.setAttribute('x', p.x.toFixed(1));
      glyph.setAttribute('y', p.y.toFixed(1));
      glyph.setAttribute('opacity', opacity.toFixed(3));
      if (glyph.textContent !== char) glyph.textContent = char;
    };
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      // Pulled out: leave everything where it is, mid-wire, while it fades.
      if (stoppedRef.current) return;
      const elapsed = now - start;
      const current = path.getTotalLength();
      const tick = Math.floor(elapsed / GLYPH_FLICKER_MS);
      packetRefs.current.forEach((packet, i) => {
        if (!packet) return;
        const t = Math.min(1, Math.max(0, (elapsed - START_MS - i * stagger) / travel));
        const along = easeInOutSine(t) * current;
        const at = path.getPointAtLength(along);
        const opacity = t <= 0 ? 0 : Math.min(1, t / 0.1, (1 - t) / 0.1);

        // The trail: fainter the further back, swaying across the wire, and never ahead of the
        // card's port or past the icon's own landing.
        for (let k = 0; k < TRAIL; k++) {
          const glyph = glyphAt(i * TRAIL + k);
          if (!glyph) continue;
          const back = along - TOKEN / 2 - TRAIL_GAP * (k + 0.6);
          if (opacity <= 0 || back <= 0) {
            hide(glyph);
            continue;
          }
          const sway = (k % 2 ? 1 : -1) * TRAIL_SWAY * Math.sin(elapsed / 160 + i * 1.7 + k);
          const char = charset[(tick + i * 3 + k * 5) % charset.length];
          show(glyph, across(path, back, current, sway), opacity * (0.9 - k * 0.25), char);
        }
        const scale = t < 0.1 ? 0.75 + (t / 0.1) * 0.25 : t > 0.9 ? 1 - ((t - 0.9) / 0.1) * 0.5 : 1;
        packet.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${scale.toFixed(3)})`);
        packet.setAttribute('opacity', opacity.toFixed(3));
        if (t >= 1 && !arrived.has(i)) {
          arrived.add(i);
          callbacks.current.onArrive();
        }
      });
      strays.forEach(({ delay, pace, side }, j) => {
        const glyph = glyphAt(icons.length * TRAIL + j);
        if (!glyph) return;
        const t = (elapsed - delay) / pace;
        if (t <= 0 || t >= 1) return hide(glyph);
        // Off to one side of the wire, pulled back onto it at both ends.
        const p = across(path, t * current, current, side * Math.sin(Math.PI * t));
        show(glyph, p, Math.min(1, t / 0.15, (1 - t) / 0.2) * 0.6, charset[(tick + j * 7) % charset.length]);
      });
      if (elapsed < total) frame = requestAnimationFrame(step);
      else callbacks.current.onDone();
    };
    frame = requestAnimationFrame(step);
    return () => cancelAnimationFrame(frame);
    // The wire stays put while plugged in, so one run follows the path it started on.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <g className={styles.packets} data-theme={source} data-stopped={stopped || undefined} style={{ '--accent': `var(--accent-${source})` } as CSSProperties}>
      <path ref={pathRef} d={d} fill="none" stroke="none" data-wire />
      {Array.from({ length: icons.length * TRAIL + STRAY_COUNT }, (_, i) => (
        <text
          key={i}
          ref={(node) => void (glyphRefs.current[i] = node)}
          className={styles.packetGlyph}
          textAnchor="middle"
          dominantBaseline="central"
          opacity={0}
        />
      ))}
      {icons.map((icon, i) => (
        <g key={icon} ref={(node) => void (packetRefs.current[i] = node)} opacity={0}>
          <PacketToken source={source} icon={icon} />
        </g>
      ))}
    </g>
  );
}
