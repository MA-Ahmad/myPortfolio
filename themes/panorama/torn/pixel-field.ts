import saved from './pixel-field.json';

/**
 * The night sky's pixels: white squares on one strict grid along the top of the sheet, thinning
 * downward to a ragged edge. Which cells are lit is an ordered dither of a slowly drifting noise,
 * so they gather into checkers and diamonds that keep shifting; a few lit cells at a time flare
 * white-hot and go out as others take over. Night only: by day the sky has clouds instead.
 */
export type FieldConfig = {
  /** Grid pitch and square size, px. */
  cell: number;
  size: number;
  /** How far down the sheet the field reaches, as a share of its height. */
  reach: number;
  /** How much of the grid is lit at the very top, and the strongest alpha. */
  density: number;
  brightness: number;
  /** The white-hot cells: how many at once, and how far their glow spreads, px. */
  hops: number;
  glow: number;
  /** How fast the pattern drifts, in noise cells a second. */
  drift: number;
};

export const FIELD_DEFAULTS: FieldConfig = saved;

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1]; `z` slides it through time. */
function noise(x: number, y: number, z: number, seed: number) {
  const ix = Math.floor(x);
  const iy = Math.floor(y);
  const iz = Math.floor(z);
  const sx = x - ix;
  const sy = y - iy;
  const sz = z - iz;
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);
  const w = sz * sz * (3 - 2 * sz);
  const at = (dz: number) => {
    const s = seed + (iz + dz) * 101;
    const a = hash(ix, iy, s);
    const b = hash(ix + 1, iy, s);
    const c = hash(ix, iy + 1, s);
    const d = hash(ix + 1, iy + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  };
  const lo = at(0);
  return lo + (at(1) - lo) * w;
}

const clamp = (v: number) => Math.max(0, Math.min(1, v));

/* Ordered dither: a level becomes the checkers and diamonds the field is made of. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/**
 * Draws the field as it stands `t` seconds in, on a canvas already scaled to CSS px, and returns
 * its lit cells as grid x, y pairs. Rows count down from the top edge, so the pattern stays
 * anchored there. Pure: the same config, size and time always draw the same pixels.
 */
export function drawPixelField(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  config: FieldConfig,
  t = 0
): number[] {
  const { cell, reach, density, brightness, drift } = config;
  const px = Math.max(1, Math.min(config.size, cell));
  const inset = (cell - px) / 2;
  const band = height * reach * 1.1;
  const rows = Math.ceil(band / cell);
  const cols = Math.ceil(width / cell);
  const lit: number[] = [];
  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = '#fff';

  for (let gy = 0; gy < rows; gy++) {
    const depth = 1 - (gy * cell) / band;
    for (let gx = 0; gx < cols; gx++) {
      // How deep into the field this cell is, with a ragged lower edge.
      const field = clamp(depth + (noise(gx / 9, gy / 9, 0, 5) * 0.45 - 0.2) * (depth + 0.3));
      if (field <= 0.01) continue;
      const level = field ** 1.5 * density * (0.35 + 1.1 * noise(gx / 7, gy / 7, t * drift, 9));
      if (BAYER[(gy & 3) * 4 + (gx & 3)] >= level) continue;
      const alpha = (0.2 + 0.55 * hash(gx, gy, 3)) * (0.45 + 0.55 * field);
      ctx.globalAlpha = Math.min(1, alpha * brightness * 1.6);
      ctx.fillRect(gx * cell + inset, gy * cell + inset, px, px);
      lit.push(gx, gy);
    }
  }
  ctx.globalAlpha = 1;
  return lit;
}

/** Sizes a canvas's backing store to its box and returns its context, scaled to CSS px. */
export function fitCanvas(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

/** The pattern only drifts slowly, so the field is redrawn this often, ms, not every frame. */
const FRAME_MS = 1000 / 30;

/**
 * Runs the field on `canvas`, which fills the sheet: redrawn as it drifts, with its white-hot
 * cells, while `shown()` says the night sky is up. With reduced motion it is drawn once and stays.
 * Returns a stop.
 */
export function runPixelField(canvas: HTMLCanvasElement, config: FieldConfig, shown: () => boolean) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = performance.now();
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let height = 0;
  let frame = 0;
  let last = -Infinity;
  let hops: { gx: number; gy: number; born: number; life: number }[] = [];

  const draw = (now: number) => {
    if (!reduced) frame = requestAnimationFrame(draw);
    if (!ctx || now - last < FRAME_MS || !shown()) return;
    last = now;
    const lit = drawPixelField(ctx, width, height, config, reduced ? 0 : (now - started) / 1000);
    if (!lit.length) return;

    // The white-hot cells: each flares, holds a moment and goes out, and another lit cell takes over.
    hops = hops.filter((hop) => now - hop.born < hop.life);
    while (hops.length < config.hops) {
      const pick = Math.floor(Math.random() * (lit.length / 2)) * 2;
      const life = reduced ? Infinity : 500 + Math.random() * 1500;
      hops.push({ gx: lit[pick], gy: lit[pick + 1], born: now, life });
    }
    const px = Math.max(1, Math.min(config.size, config.cell));
    const inset = (config.cell - px) / 2;
    ctx.save();
    ctx.shadowColor = 'rgba(255,255,255,0.9)';
    ctx.shadowBlur = config.glow;
    for (const hop of hops) {
      ctx.globalAlpha = reduced ? 0.9 : Math.sin((Math.PI * (now - hop.born)) / hop.life) ** 0.6;
      ctx.fillRect(hop.gx * config.cell + inset, hop.gy * config.cell + inset, px, px);
    }
    ctx.restore();
  };

  const observer = new ResizeObserver(() => {
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    ctx = fitCanvas(canvas, width, height);
    hops = [];
    last = -Infinity;
    if (reduced) draw(performance.now());
  });
  observer.observe(canvas);
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
  };
}
