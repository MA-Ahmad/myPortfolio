import { useEffect, useRef, useState } from 'react';
import { cn } from 'lib/cn';

const SIZE = 480;
const STEP_X = 4;
const STEP_Y = 6;
// Densest to sparsest; brighter cells get denser glyphs on the dark background.
// Stops at `;:` so even the deepest shadows keep a readable glyph.
const RAMP = '$@B%8&WM#*oahkbdpqwmZO0QLCJUYXzcvunxrjft/|()1{}[]?-_+~<>i!lI;:';
// Squared RGB distance from the corner color below which a pixel counts as background.
const BACKGROUND_TOLERANCE = 60 ** 2;
// Brightness is stretched between these percentiles of the subject, not the whole image.
const LOW_PERCENTILE = 0.02;
const HIGH_PERCENTILE = 0.98;
// < 1 lifts shadows so the shaded side of the face stays visible.
const GAMMA = 0.7;
// How strongly each cell is pushed away from its neighborhood average (keeps eyes, brows, edges).
const LOCAL_CONTRAST = 0.9;
const LOCAL_RADIUS = 3;
// Extra contrast against nearby skin only, so the nose ridge and the shadow under it stand out.
const SKIN_DETAIL = 1.5;
const SKIN_DETAIL_RADIUS = 2;
const SKIN_MIN_REDNESS = 40;
const SKIN_MIN_LUMINANCE = 85;
// Hair, beard, and mustache are much less red (red minus green) than skin and the jacket.
// Cells below HAIR_REDNESS get their tone scaled by HAIR_DARKEN, easing in over HAIR_FADE.
const HAIR_REDNESS = 35;
const HAIR_FADE = 10;
const HAIR_DARKEN = 0.82;
// Displaced glyphs darker than this are drawn in the "moved" color.
const SHADOW_THRESHOLD = 0.3;
const REPEL_RADIUS_DESKTOP = 55;
const REPEL_RADIUS_TOUCH = 75;

type Particle = {
  char: string;
  x: number;
  y: number;
  baseX: number;
  baseY: number;
  density: number;
  color: string;
  shadow: boolean;
};

type Palette = { dark: string; mid: string; light: string };

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
    const palette: Palette = {
      dark: styles.getPropertyValue('--term-portrait-dark').trim(),
      mid: styles.getPropertyValue('--term-portrait-mid').trim(),
      light: styles.getPropertyValue('--term-portrait-light').trim()
    };
    const movedColor = styles.getPropertyValue('--term-portrait-moved').trim();
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
        ctx.fillStyle = displaced && p.shadow ? movedColor : p.color;
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
        particles = buildParticles(image, palette, reduceMotion);
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

function buildParticles(
  image: HTMLImageElement,
  palette: Palette,
  reduceMotion: boolean
): Particle[] {
  const sample = document.createElement('canvas');
  sample.width = SIZE;
  sample.height = SIZE;
  const ctx = sample.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, 0, 0, SIZE, SIZE);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);

  const cols = SIZE / STEP_X;
  const rows = Math.floor(SIZE / STEP_Y);
  const { luminance, redness } = sampleCells(data, cols, rows);

  const subject = luminance.filter((value) => value >= 0).sort((a, b) => a - b);
  if (!subject.length) return [];
  const low = subject[Math.floor(subject.length * LOW_PERCENTILE)];
  const high = subject[Math.floor(subject.length * HIGH_PERCENTILE)];
  const range = Math.max(1, high - low);
  const normalized = luminance.map((value) => (value < 0 ? -1 : clamp((value - low) / range)));
  const neighborhood = localAverage(normalized, cols, rows, LOCAL_RADIUS);
  const skin = faceArea(
    Array.from(
      luminance,
      (value, index) => value > SKIN_MIN_LUMINANCE && redness[index] > SKIN_MIN_REDNESS
    ),
    cols,
    rows
  );
  const skinNeighborhood = localAverage(normalized, cols, rows, SKIN_DETAIL_RADIUS, skin);

  const stops = [hexToRgb(palette.dark), hexToRgb(palette.mid), hexToRgb(palette.light)];
  const center = SIZE / 2;
  const particles: Particle[] = [];

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      const base = normalized[index];
      if (base < 0) continue;

      let detail = clamp(base + LOCAL_CONTRAST * (base - neighborhood[index]));
      if (skin[index]) detail = clamp(detail + SKIN_DETAIL * (base - skinNeighborhood[index]));
      const hair = clamp((HAIR_REDNESS - redness[index]) / HAIR_FADE);
      const tone = detail ** GAMMA * (1 - (1 - HAIR_DARKEN) * hair);
      const x = col * STEP_X;
      const y = (row + 1) * STEP_Y;

      let startX = x;
      let startY = y;
      if (!reduceMotion) {
        const angle = Math.atan2(y - center, x - center) + Math.random() * 2;
        const distance = Math.hypot(x - center, y - center) + Math.random() * 350 + 150;
        startX = center + Math.cos(angle) * distance;
        startY = center + Math.sin(angle) * distance;
      }

      particles.push({
        char: RAMP[Math.round((1 - tone) * (RAMP.length - 1))],
        x: startX,
        y: startY,
        baseX: x,
        baseY: y,
        density: Math.random() * 15 + 5,
        color: mixStops(stops, tone),
        shadow: tone < SHADOW_THRESHOLD
      });
    }
  }

  return particles;
}

/**
 * Perceived luminance and redness (red minus green) per glyph cell, averaged over its
 * non-background pixels; luminance -1 marks background.
 */
function sampleCells(data: Uint8ClampedArray, cols: number, rows: number) {
  const bg = [data[0], data[1], data[2]];
  const luminance = new Float32Array(cols * rows);
  const redness = new Float32Array(cols * rows);

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let red = 0;
      let count = 0;
      let total = 0;
      for (let py = row * STEP_Y; py < (row + 1) * STEP_Y; py++) {
        for (let px = col * STEP_X; px < (col + 1) * STEP_X; px++) {
          const i = (py * SIZE + px) * 4;
          total++;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          if (data[i + 3] < 10) continue;
          if ((r - bg[0]) ** 2 + (g - bg[1]) ** 2 + (b - bg[2]) ** 2 < BACKGROUND_TOLERANCE) {
            continue;
          }
          sum += 0.299 * r + 0.587 * g + 0.114 * b;
          red += r - g;
          count++;
        }
      }
      const index = row * cols + col;
      luminance[index] = count * 2 > total ? sum / count : -1;
      redness[index] = count ? red / count : 0;
    }
  }

  return { luminance, redness };
}

/**
 * Keeps only the connected skin area with the most cells in the upper half of the image (the face),
 * so the bright, red jacket below is left alone.
 */
function faceArea(skin: boolean[], cols: number, rows: number) {
  const area = new Int32Array(skin.length).fill(-1);
  const upperCounts: number[] = [];

  for (let start = 0; start < skin.length; start++) {
    if (!skin[start] || area[start] >= 0) continue;
    const id = upperCounts.length;
    let upper = 0;
    const queue = [start];
    area[start] = id;
    while (queue.length) {
      const index = queue.pop()!;
      const row = Math.floor(index / cols);
      const col = index % cols;
      if (row < rows / 2) upper++;
      const neighbors = [
        row > 0 ? index - cols : -1,
        row < rows - 1 ? index + cols : -1,
        col > 0 ? index - 1 : -1,
        col < cols - 1 ? index + 1 : -1
      ];
      for (const next of neighbors) {
        if (next >= 0 && skin[next] && area[next] < 0) {
          area[next] = id;
          queue.push(next);
        }
      }
    }
    upperCounts.push(upper);
  }

  const face = upperCounts.indexOf(Math.max(...upperCounts));
  return Array.from(area, (id) => id >= 0 && id === face);
}

/** Box-blurred average of each cell's foreground neighbors, optionally only those in `mask`. */
function localAverage(
  values: Float32Array,
  cols: number,
  rows: number,
  radius: number,
  mask?: boolean[]
) {
  const out = new Float32Array(values.length);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      let sum = 0;
      let count = 0;
      for (let dy = -radius; dy <= radius; dy++) {
        const r = row + dy;
        if (r < 0 || r >= rows) continue;
        for (let dx = -radius; dx <= radius; dx++) {
          const c = col + dx;
          if (c < 0 || c >= cols) continue;
          const value = values[r * cols + c];
          if (value < 0 || (mask && !mask[r * cols + c])) continue;
          sum += value;
          count++;
        }
      }
      out[row * cols + col] = count ? sum / count : 0;
    }
  }
  return out;
}

function mixStops(stops: number[][], t: number) {
  const [dark, mid, light] = stops;
  const [from, to, k] = t < 0.5 ? [dark, mid, t / 0.5] : [mid, light, (t - 0.5) / 0.5];
  const channel = (i: number) => Math.round(from[i] + (to[i] - from[i]) * k);
  return `rgb(${channel(0)},${channel(1)},${channel(2)})`;
}

function hexToRgb(hex: string) {
  const value = parseInt(hex.replace('#', ''), 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function clamp(value: number) {
  return Math.min(1, Math.max(0, value));
}
