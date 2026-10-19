import { type CSSProperties, useEffect, useRef } from 'react';
import { type Point, boltPoints, distance, pointsAttribute } from 'lib/canvas/geometry';
import styles from './canvas.module.css';
import { type CardId, NEAR_RADIUS, SNAP_RADIUS } from './nodes';

const PARTICLES = 18;
const FLICKER_MS = 45;
const PARTICLE_LIFE_MS = 420;

type Particle = { x: number; y: number; vx: number; vy: number; born: number };

type Props = {
  source: CardId;
  tip: Point;
  port: Point;
};

/**
 * Lightning between the wire tip and the input it is about to plug into: a bolt re-drawn every
 * few frames, a thin fork off it, sparks thrown from the port, and rings pulsing out of the port.
 * Everything gets brighter and busier the closer the tip is.
 */
export function Spark({ source, tip, port }: Props) {
  const glowRef = useRef<SVGPolylineElement>(null);
  const coreRef = useRef<SVGPolylineElement>(null);
  const whiteRef = useRef<SVGPolylineElement>(null);
  const forkRef = useRef<SVGPolylineElement>(null);
  const particlesRef = useRef<SVGGElement>(null);
  const live = useRef({ tip, port });
  live.current = { tip, port };

  useEffect(() => {
    const particles: Particle[] = [];
    let frame = 0;
    let lastFlicker = 0;
    let lastEmit = 0;

    const tick = (now: number) => {
      frame = requestAnimationFrame(tick);
      const { tip, port } = live.current;
      const gap = distance(tip, port);
      const closeness = 1 - Math.min(1, Math.max(0, (gap - SNAP_RADIUS) / (NEAR_RADIUS - SNAP_RADIUS)));

      if (now - lastFlicker > FLICKER_MS) {
        lastFlicker = now;
        const amplitude = 3 + gap * 0.18;
        const bolt = pointsAttribute(boltPoints(tip, port, amplitude, Math.max(4, Math.round(gap / 7))));
        glowRef.current?.setAttribute('points', bolt);
        coreRef.current?.setAttribute('points', bolt);
        whiteRef.current?.setAttribute('points', bolt);

        const start = boltPoints(tip, port, amplitude, 4)[1 + Math.floor(Math.random() * 2)];
        const angle = Math.atan2(port.y - tip.y, port.x - tip.x) + (Math.random() < 0.5 ? -1 : 1) * (0.6 + Math.random() * 0.6);
        const reach = 6 + gap * 0.3 * Math.random();
        const end = { x: start.x + Math.cos(angle) * reach, y: start.y + Math.sin(angle) * reach };
        forkRef.current?.setAttribute('points', pointsAttribute(boltPoints(start, end, 3, 3)));
        forkRef.current?.setAttribute('opacity', String(Math.random() < 0.6 ? 0.8 : 0));

        const flare = 0.55 + 0.45 * closeness;
        const flicker = 0.75 + Math.random() * 0.25;
        coreRef.current?.setAttribute('opacity', String(flare * flicker));
        glowRef.current?.setAttribute('opacity', String(0.5 * flare * flicker));
      }

      if (now - lastEmit > 70 - closeness * 40) {
        lastEmit = now;
        for (let i = 0; i < 2; i++) {
          if (particles.length >= PARTICLES) particles.shift();
          const angle = Math.random() * Math.PI * 2;
          const speed = 0.04 + Math.random() * 0.08 * (0.5 + closeness);
          particles.push({ x: port.x, y: port.y, vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed, born: now });
        }
      }

      const dots = particlesRef.current?.children;
      if (!dots) return;
      for (let i = 0; i < PARTICLES; i++) {
        const dot = dots[i] as SVGCircleElement;
        const particle = particles[i];
        const age = particle ? (now - particle.born) / PARTICLE_LIFE_MS : 1;
        if (!particle || age >= 1) {
          dot.setAttribute('opacity', '0');
          continue;
        }
        const t = now - particle.born;
        dot.setAttribute('cx', (particle.x + particle.vx * t).toFixed(1));
        dot.setAttribute('cy', (particle.y + particle.vy * t + 0.00004 * t * t).toFixed(1));
        dot.setAttribute('r', (1.4 * (1 - age) + 0.3).toFixed(2));
        dot.setAttribute('opacity', (1 - age).toFixed(2));
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <g style={{ '--accent': `var(--accent-${source})` } as CSSProperties}>
      <circle className={styles.ring} cx={port.x} cy={port.y} r={7} />
      <circle className={styles.ring} cx={port.x} cy={port.y} r={7} />
      <polyline ref={glowRef} className={styles.boltGlow} />
      <polyline ref={coreRef} className={styles.boltCore} />
      <polyline ref={whiteRef} className={styles.boltCoreWhite} />
      <polyline ref={forkRef} className={styles.fork} />
      <g ref={particlesRef}>
        {Array.from({ length: PARTICLES }, (_, i) => (
          <circle key={i} className={styles.spark} r={0} opacity={0} />
        ))}
      </g>
    </g>
  );
}
