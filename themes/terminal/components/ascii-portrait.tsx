import { useEffect, useRef, useState } from 'react';
import { cn } from 'lib/cn';

const SIZE = 480;
const STEP_X = 4;
const STEP_Y = 6;
// Densest to sparsest; brighter pixels get denser glyphs on the dark background.
const RAMP = "$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:,^`'.";
// Squared RGB distance from the corner color below which a pixel counts as background.
const BACKGROUND_TOLERANCE = 60 ** 2;
const REPEL_RADIUS_DESKTOP = 55;
const REPEL_RADIUS_TOUCH = 75;

type Particle = {
  char: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  density: number;
  tone: 'dark' | 'mid' | 'light';
};

type Props = {
  src: string;
  alt: string;
  className?: string;
};

export function AsciiPortrait({ src, alt, className }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pointerRef = useRef({ x: -9999, y: -9999 });
  const wakeRef = useRef<() => void>(() => {});
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d')!;
    canvas.width = SIZE;
    canvas.height = SIZE;

    const styles = getComputedStyle(canvas);
    const colors = {
      dark: styles.getPropertyValue('--term-portrait-dark').trim(),
      mid: styles.getPropertyValue('--term-portrait-mid').trim(),
      light: styles.getPropertyValue('--term-portrait-light').trim(),
      moved: styles.getPropertyValue('--term-portrait-moved').trim()
    };
    const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

    let particles: Particle[] = [];
    let raf = 0;
    let cancelled = false;

    const frame = () => {
      ctx.clearRect(0, 0, SIZE, SIZE);
      ctx.font = '8px monospace';
      ctx.textBaseline = 'alphabetic';

      const radius = window.innerWidth > 768 ? REPEL_RADIUS_DESKTOP : REPEL_RADIUS_TOUCH;
      const { x: px, y: py } = pointerRef.current;
      let moving = false;

      for (const p of particles) {
        const dx = px - p.x;
        const dy = py - p.y;
        const distSq = dx * dx + dy * dy;

        if (!reduceMotion && distSq < radius * radius && distSq > 0) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const force = (radius - dist) / radius;
          p.x -= (nx + ny * 1.5) * force * p.density;
          p.y -= (ny - nx * 1.5) * force * p.density;
          moving = true;
        } else {
          const ease = p.density * 0.85;
          const offX = p.x - p.baseX;
          const offY = p.y - p.baseY;
          if (Math.abs(offX) < 0.5) p.x = p.baseX;
          else p.x -= offX / ease;
          if (Math.abs(offY) < 0.5) p.y = p.baseY;
          else p.y -= offY / ease;
          if (p.x !== p.baseX || p.y !== p.baseY) moving = true;
        }

        const displaced = (p.x - p.baseX) ** 2 + (p.y - p.baseY) ** 2 > 2;
        ctx.fillStyle = displaced && p.tone === 'dark' ? colors.moved : colors[p.tone];
        ctx.fillText(p.char, p.x, p.y);
      }

      raf = moving ? requestAnimationFrame(frame) : 0;
    };

    wakeRef.current = () => {
      if (!raf && particles.length) raf = requestAnimationFrame(frame);
    };

    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      if (cancelled) return;
      try {
        particles = buildParticles(image, reduceMotion);
      } catch {
        setFailed(true);
        return;
      }
      wakeRef.current();
    };
    image.onerror = () => setFailed(true);
    image.src = src;

    return () => {
      cancelled = true;
      cancelAnimationFrame(raf);
    };
  }, [src]);

  const setPointer = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current!;
    const rect = canvas.getBoundingClientRect();
    pointerRef.current = {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height)
    };
    wakeRef.current();
  };

  const clearPointer = () => {
    pointerRef.current = { x: -9999, y: -9999 };
    wakeRef.current();
  };

  if (failed) {
    return <img src={src} alt={alt} className={cn('w-full rounded-full grayscale', className)} />;
  }

  return (
    <div className="flex w-full justify-center">
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={alt}
        onMouseMove={(e) => setPointer(e.clientX, e.clientY)}
        onMouseLeave={clearPointer}
        onTouchMove={(e) => setPointer(e.touches[0].clientX, e.touches[0].clientY)}
        onTouchEnd={clearPointer}
        onTouchCancel={clearPointer}
        className={cn('h-auto w-full max-w-xs cursor-default touch-none md:max-w-sm', className)}
      />
    </div>
  );
}

function buildParticles(image: HTMLImageElement, reduceMotion: boolean): Particle[] {
  const sample = document.createElement('canvas');
  sample.width = SIZE;
  sample.height = SIZE;
  const ctx = sample.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const bg = [data[0], data[1], data[2]];
  const center = SIZE / 2;
  const particles: Particle[] = [];

  for (let y = STEP_Y; y < SIZE; y += STEP_Y) {
    for (let x = 0; x < SIZE; x += STEP_X) {
      const sx = Math.min(SIZE - 1, x + STEP_X / 2);
      const sy = Math.max(0, y - STEP_Y / 2);
      const i = (sy * SIZE + sx) * 4;
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      if (data[i + 3] < 10) continue;
      if ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2 < BACKGROUND_TOLERANCE) continue;

      const luminance = (r + g + b) / 3;
      const char = RAMP[Math.round((1 - luminance / 255) * (RAMP.length - 1))];
      const tone = luminance < 140 ? 'dark' : luminance > 220 ? 'light' : 'mid';

      let startX = x;
      let startY = y;
      if (!reduceMotion) {
        const angle = Math.atan2(y - center, x - center) + Math.random() * 2;
        const distance = Math.hypot(x - center, y - center) + Math.random() * 350 + 150;
        startX = center + Math.cos(angle) * distance;
        startY = center + Math.sin(angle) * distance;
      }

      particles.push({
        char,
        x: startX,
        y: startY,
        baseX: x,
        baseY: y,
        density: Math.random() * 15 + 5,
        tone
      });
    }
  }

  return particles;
}
