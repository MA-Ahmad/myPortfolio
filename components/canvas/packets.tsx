import { type CSSProperties, useEffect, useRef } from 'react';
import { type Point, wirePath } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import { type CardId, cardById } from './nodes';

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

const easeInOutSine = (t: number) => -(Math.cos(Math.PI * t) - 1) / 2;

type Props = {
  source: CardId;
  from: Point;
  fromDir: number;
  to: Point;
  toDir: number;
  /** Each time a packet reaches the display. */
  onArrive: () => void;
  onDone: () => void;
};

/**
 * The theme's skill icons riding the plugged-in wire into the display, one after another: they
 * fade in off the card's port, ease along the wire, and shrink into the display's input.
 * Positions are set per frame on the elements, so React renders them once.
 */
export function Packets({ source, from, fromDir, to, toDir, onArrive, onDone }: Props) {
  const icons = cardById(source).packets;
  const pathRef = useRef<SVGPathElement>(null);
  const packetRefs = useRef<(SVGGElement | null)[]>([]);
  const callbacks = useRef({ onArrive, onDone });
  callbacks.current = { onArrive, onDone };
  const d = wirePath(from, fromDir, to, toDir);

  useEffect(() => {
    const path = pathRef.current!;
    // The display swells as packets land, so the wire's end moves; this length only paces them.
    const length = path.getTotalLength();
    const travel = Math.min(TRAVEL_MS.max, Math.max(TRAVEL_MS.min, length * MS_PER_PX));
    const stagger = Math.min(STAGGER_MS.max, Math.max(STAGGER_MS.min, (SPACING * travel) / length));
    const total = START_MS + (icons.length - 1) * stagger + travel;
    const arrived = new Set<number>();
    const start = performance.now();
    let frame = 0;

    const step = (now: number) => {
      const elapsed = now - start;
      const current = path.getTotalLength();
      packetRefs.current.forEach((packet, i) => {
        if (!packet) return;
        const t = Math.min(1, Math.max(0, (elapsed - START_MS - i * stagger) / travel));
        const at = path.getPointAtLength(easeInOutSine(t) * current);
        const opacity = t <= 0 ? 0 : Math.min(1, t / 0.1, (1 - t) / 0.1);
        const scale = t < 0.1 ? 0.75 + (t / 0.1) * 0.25 : t > 0.9 ? 1 - ((t - 0.9) / 0.1) * 0.5 : 1;
        packet.setAttribute('transform', `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${scale.toFixed(3)})`);
        packet.setAttribute('opacity', opacity.toFixed(3));
        if (t >= 1 && !arrived.has(i)) {
          arrived.add(i);
          callbacks.current.onArrive();
        }
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
    <g className={styles.packets} data-theme={source} style={{ '--accent': `var(--accent-${source})` } as CSSProperties}>
      <path ref={pathRef} d={d} fill="none" stroke="none" data-wire />
      {icons.map((icon, i) => (
        <g key={icon} ref={(node) => void (packetRefs.current[i] = node)} opacity={0}>
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
          <image href={packetIcon(icon)} x={-ICON / 2} y={-ICON / 2} width={ICON} height={ICON} />
        </g>
      ))}
    </g>
  );
}
