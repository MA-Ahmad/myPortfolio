import { memo, useEffect, useRef } from 'react';
import { boltPoints, pointsAttribute } from 'lib/canvas/geometry';
import { GAP } from './sheet';
import { type Axis, type Point, xAt } from './tear';
import styles from './torn.module.css';

/** How far either side of the tear the pointer still counts as on the seam, px. */
const NEAR = GAP + 10;
const PARTICLES = 24;
const PARTICLE_LIFE_MS = 460;
const FLICKER_MS = 45;
/** How fast the pull builds once the pointer is on the seam, and drops once it leaves, per ms. */
const RISE = 1 / 160;
const FALL = 1 / 120;
/** Each spark is pulled back toward the centre line, so the two edges' sparks reach for each other. */
const PULL = 0.0009;

type Particle = { x: number; y: number; vx: number; vy: number; born: number };

/**
 * A torn seam under the pointer: its two edges reach for each other right where the pointer is,
 * the way a wire's tip reaches for a port in the Theme Studio. A short bolt jumps the gap, and
 * sparks thrown off both edges curve back toward the centre line. Clicking there welds the seam
 * out from that point (`onJoin`), a shortcut for the section buttons beside it. Nothing runs until the pointer is on
 * the seam, and the loop stops once the last spark has died.
 */
export const Attract = memo(AttractSeam, (a, b) =>
  // onJoin is read through a ref, so a new one alone needs no render.
  a.id === b.id && a.tear === b.tear && a.length === b.length && a.axis === b.axis
);

function AttractSeam({
  id,
  tear,
  length,
  axis,
  onJoin
}: {
  id: number;
  tear: Point[];
  length: number;
  axis: Axis;
  /** Welds the seam from `along`, where it was clicked. */
  onJoin: (along: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const glowRef = useRef<SVGEllipseElement>(null);
  const haloRef = useRef<SVGPolylineElement>(null);
  const boltRef = useRef<SVGPolylineElement>(null);
  const whiteRef = useRef<SVGPolylineElement>(null);
  const forkRef = useRef<SVGPolylineElement>(null);
  const sparksRef = useRef<SVGGElement>(null);
  const join = useRef(onJoin);
  useEffect(() => {
    join.current = onJoin;
  }, [onJoin]);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = svgRef.current!;
    const sheetEl = svg.closest<HTMLElement>('[data-skin]')!;
    const particles: Particle[] = [];
    // Where the pointer is along the seam, or null when it is off it.
    let target: number | null = null;
    let along = 0;
    let power = 0;
    let frame = 0;
    let last = 0;
    let lastFlicker = 0;
    let lastEmit = 0;

    const locate = (event: PointerEvent) => {
      if (!sheetEl.contains(event.target as Node)) return (target = null);
      // The seam's drawing space starts at its centre line; stacked, it is turned on its side.
      const origin = svg.parentElement!.getBoundingClientRect();
      const [offset, at] =
        axis === 'v'
          ? [event.clientX - origin.left, event.clientY - origin.top]
          : [event.clientY - origin.top, event.clientX - origin.left];
      target = at > 0 && at < length && Math.abs(offset - xAt(tear, at)) < NEAR ? at : null;
      point();
    };

    // The sheet shows a pointer while the spark is up, whatever is under it; each seam clears only
    // its own mark, so moving from one seam to the next never drops it.
    const point = () => {
      if (target !== null) sheetEl.dataset.seam = String(id);
      else if (sheetEl.dataset.seam === String(id)) delete sheetEl.dataset.seam;
    };

    // Caught before the section underneath sees it, so the click welds instead of opening that one.
    const onClick = (event: MouseEvent) => {
      if (target === null) return;
      event.preventDefault();
      event.stopPropagation();
      const at = target;
      target = null;
      point();
      join.current(at);
    };

    const tick = (now: number) => {
      const dt = Math.min(48, now - (last || now));
      last = now;
      if (target !== null) along = power ? along + (target - along) * Math.min(1, dt / 40) : target;
      power = Math.max(0, Math.min(1, power + (target === null ? -FALL : RISE) * dt));
      const x = xAt(tear, along);
      const left = x - GAP;
      const right = x + GAP;

      if (now - lastFlicker > FLICKER_MS) {
        lastFlicker = now;
        // The bolt lands a little above or below the pointer each time, so it reads as arcing.
        const tilt = (Math.random() - 0.5) * 10;
        const bolt = pointsAttribute(
          boltPoints({ x: left, y: along - tilt }, { x: right, y: along + tilt }, 3, 5)
        );
        haloRef.current!.setAttribute('points', bolt);
        boltRef.current!.setAttribute('points', bolt);
        whiteRef.current!.setAttribute('points', bolt);
        const flicker = power * (0.7 + Math.random() * 0.3);
        haloRef.current!.setAttribute('opacity', (0.45 * flicker).toFixed(2));
        boltRef.current!.setAttribute('opacity', flicker.toFixed(2));
        whiteRef.current!.setAttribute('opacity', (0.85 * flicker).toFixed(2));

        const side = Math.random() < 0.5 ? -1 : 1;
        const from = { x: side < 0 ? left : right, y: along + (Math.random() - 0.5) * 16 };
        const to = { x: x, y: from.y + (Math.random() - 0.5) * 14 };
        forkRef.current!.setAttribute('points', pointsAttribute(boltPoints(from, to, 2, 3)));
        forkRef.current!.setAttribute(
          'opacity',
          Math.random() < 0.55 ? (0.8 * power).toFixed(2) : '0'
        );
      }

      const glow = glowRef.current!;
      glow.setAttribute('cx', x.toFixed(1));
      glow.setAttribute('cy', along.toFixed(1));
      glow.setAttribute('opacity', (power * (0.4 + Math.random() * 0.1)).toFixed(2));

      if (target !== null && now - lastEmit > 40) {
        lastEmit = now;
        for (const side of [-1, 1]) {
          if (particles.length >= PARTICLES) particles.shift();
          particles.push({
            x: side < 0 ? left : right,
            y: along + (Math.random() - 0.5) * 12,
            // Thrown out across the piece, then pulled back toward the other edge.
            vx: side * (0.04 + Math.random() * 0.08),
            vy: (Math.random() - 0.5) * 0.16,
            born: now
          });
        }
      }

      const dots = sparksRef.current!.children;
      let alive = 0;
      for (let i = 0; i < PARTICLES; i++) {
        const dot = dots[i] as SVGCircleElement;
        const particle = particles[i];
        const age = particle ? (now - particle.born) / PARTICLE_LIFE_MS : 1;
        if (!particle || age >= 1) {
          dot.setAttribute('opacity', '0');
          continue;
        }
        alive++;
        const t = now - particle.born;
        const toward = Math.sign(x - particle.x);
        dot.setAttribute(
          'cx',
          (particle.x + particle.vx * t + 0.5 * PULL * toward * t * t).toFixed(1)
        );
        dot.setAttribute('cy', (particle.y + particle.vy * t + 0.00004 * t * t).toFixed(1));
        dot.setAttribute('r', (1.3 * (1 - age) + 0.3).toFixed(2));
        dot.setAttribute('opacity', (1 - age).toFixed(2));
      }

      frame = power > 0 || alive > 0 ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };

    const onMove = (event: PointerEvent) => {
      locate(event);
      if (target !== null && !frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      target = null;
      point();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    document.documentElement.addEventListener('pointerleave', onLeave);
    sheetEl.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      sheetEl.removeEventListener('click', onClick, true);
      cancelAnimationFrame(frame);
      target = null;
      point();
    };
  }, [id, tear, length, axis]);

  return (
    <svg ref={svgRef} className={styles.attract} aria-hidden>
      <ellipse ref={glowRef} className={styles.attractGlow} rx={10} ry={16} opacity={0} />
      <polyline ref={haloRef} className={styles.attractHalo} opacity={0} />
      <polyline ref={boltRef} className={styles.attractBolt} opacity={0} />
      <polyline ref={whiteRef} className={styles.attractWhite} opacity={0} />
      <polyline ref={forkRef} className={styles.attractFork} opacity={0} />
      <g ref={sparksRef}>
        {Array.from({ length: PARTICLES }, (_, i) => (
          <circle key={i} className={styles.attractSpark} r={0} opacity={0} />
        ))}
      </g>
    </svg>
  );
}
