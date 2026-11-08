import saved from './trails-sky.json';
import { BAYER, hash, rgb, toLinear, toSrgb } from './dither-sky';

/**
 * Star trails across the night sky, as in a long exposure: while the shutter is open the sky turns
 * about the celestial pole, so every star draws an arc around that one centre, and every arc sweeps
 * the same angle (the same exposure), outer ones longer. Drawn on the sheet's one surface, they run
 * across every torn section, broken only by the gaps between them.
 *
 * Fixed, because they make it star trails: one pole, one sweep, light that adds (dense trails glow
 * brighter), a brightness spread like star magnitudes (mostly faint, a few bright, the bright ones
 * whiter and a little thicker), mostly blue with a few warm trails, ends that fade in and out, and a
 * soft blue haze under the dense band. Everything else is a knob, tuned at /dev/trails.
 *
 * Pure: every random choice comes from a PRNG seeded by `seed`, so a saved config redraws the same
 * sky exactly.
 */
export type TrailsConfig = {
  /** 1 to draw it on the theme page (night only), 0 for off. */
  enabled: number;
  seed: number;
  /** 0: smooth, like the photograph; 1: ordered-dithered on square cells, like the dithered sky. */
  dither: number;
  opacity: number;
  /** The pole, as a share of the sheet's width (x) and height (y); usually off the sheet. */
  poleX: number;
  poleY: number;
  /** The band of trails: inner and outer radius (shares of the sheet's width), and how softly it thins at both edges. */
  inner: number;
  outer: number;
  edge: number;
  count: number;
  /** The exposure: the angle every trail sweeps (deg). */
  sweep: number;
  /** Where the trails sit around the pole (deg, 0 to the right, negative up), and how far they scatter from there. */
  rotation: number;
  spread: number;
  /** Line width of an average trail (CSS px), and how bright the trails are overall. */
  thickness: number;
  brightness: number;
  /** The share of trails that are warm (red, magenta) rather than blue. */
  warmShare: number;
  /** How much of each trail fades in at its start and out at its end (share of its length). */
  fade: number;
  /** The soft blue glow under the band. */
  haze: number;
  /** Point stars scattered over the sky. */
  stars: number;
  /** Faint trails' blue, bright trails' near white, and the warm trails' colour. */
  cool: string;
  white: string;
  warm: string;
};

export const TRAILS_DEFAULTS: TrailsConfig = saved;

/* A tiny store, so the tuning page (/dev/trails) can redraw the live sheet as its knobs move. */
let current: TrailsConfig = TRAILS_DEFAULTS;
const listeners = new Set<() => void>();
export const trailsStore = {
  get: () => current,
  getServer: () => TRAILS_DEFAULTS,
  set(next: TrailsConfig) {
    current = next;
    listeners.forEach((listener) => listener());
  },
  subscribe(listener: () => void) {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }
};

/** mulberry32: a small, fast seeded PRNG returning [0, 1). */
function prng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mix = (a: number[], b: number[], t: number) => a.map((v, i) => v + (b[i] - v) * t);
const css = (c: number[], alpha: number) =>
  `rgba(${c.map((v) => Math.round(v * 255)).join(',')},${alpha.toFixed(3)})`;

/** Arcs are drawn in this many pieces, so each can carry its own fade. */
const PIECES = 14;

/**
 * Draws the trails onto `ctx`, in a space `width` × `height` px, scaled by `scale` (device pixels
 * per px). Light adds: every stroke is drawn with the `lighter` composite.
 */
function paint(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  scale: number,
  config: TrailsConfig
) {
  const random = prng(config.seed);
  ctx.save();
  ctx.scale(scale, scale);
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';

  const cx = width * config.poleX;
  const cy = height * config.poleY;
  const inner = width * Math.min(config.inner, config.outer);
  const outer = width * Math.max(config.inner, config.outer);
  const band = Math.max(1, outer - inner);
  const deg = Math.PI / 180;
  const cool = rgb(config.cool);
  const white = rgb(config.white);
  const warm = rgb(config.warm);

  // The haze: a soft glow of the trails' blue across the band, strongest in its middle, fading out
  // towards both ends of the band too, so it has no edge anywhere (dithering would show one). Drawn
  // in slices, each as bright as its place along the band.
  if (config.haze > 0) {
    const mid = (inner + outer) / 2;
    const r0 = Math.max(0, inner - band * 0.3);
    const r1 = outer + band * 0.6;
    const from = (config.rotation - config.spread - config.sweep / 2) * deg;
    const to = (config.rotation + config.spread + config.sweep / 2) * deg;
    const slices = 180;
    const span = (to - from) / slices;
    for (let k = 0; k < slices; k++) {
      const t = (k + 0.5) / slices;
      const ends = Math.min(1, t / 0.3, (1 - t) / 0.3);
      const strength = 0.28 * config.haze * ends * ends * (3 - 2 * ends);
      const glow = ctx.createRadialGradient(cx, cy, r0, cx, cy, r1);
      glow.addColorStop(0, css(cool, 0));
      glow.addColorStop(Math.max(0, Math.min(1, (mid - r0) / (r1 - r0))), css(cool, strength));
      // A long, faint tail to the outer edge, so the haze dies away instead of stopping.
      glow.addColorStop(0.82, css(cool, strength * 0.12));
      glow.addColorStop(1, css(cool, 0));
      ctx.beginPath();
      ctx.arc(cx, cy, r1, from + k * span, from + (k + 1) * span);
      ctx.arc(cx, cy, r0, from + (k + 1) * span, from + k * span, true);
      ctx.closePath();
      ctx.fillStyle = glow;
      ctx.fill();
    }
  }

  // The trails. Each star's radius is picked from the band, thinned at both edges; its start
  // angle scatters around `rotation`; every one sweeps the same `sweep`.
  const count = Math.max(0, Math.round(config.count));
  const sweep = config.sweep * deg;
  for (let i = 0; i < count; i++) {
    let r = 0;
    for (let tries = 0; tries < 8; tries++) {
      const u = random();
      const edge = Math.max(0.01, config.edge);
      const keep = Math.min(1, Math.min(u, 1 - u) / (edge / 2));
      if (random() < keep * keep * (3 - 2 * keep)) {
        r = inner + u * band;
        break;
      }
      r = inner + u * band;
    }
    const start = (config.rotation + (random() * 2 - 1) * config.spread) * deg - sweep / 2;
    // Magnitudes: mostly faint, a few bright, the bright ones whiter and a little thicker.
    const m = random() ** 3.2;
    const isWarm = random() < config.warmShare;
    const colour = isWarm ? mix(warm, white, m * 0.4) : mix(cool, white, Math.min(1, m * 1.4));
    const alpha = Math.min(1, config.brightness * (0.12 + 0.88 * m));
    ctx.lineWidth = config.thickness * (0.55 + 0.9 * m);
    const step = sweep / PIECES;
    for (let k = 0; k < PIECES; k++) {
      const t = (k + 0.5) / PIECES;
      const fade = config.fade > 0 ? Math.min(1, t / config.fade, (1 - t) / config.fade) : 1;
      ctx.strokeStyle = css(colour, alpha * fade);
      ctx.beginPath();
      ctx.arc(cx, cy, r, start + k * step, start + (k + 1) * step + step * 0.02);
      ctx.stroke();
    }
  }

  // Point stars, scattered over the whole sky.
  ctx.globalCompositeOperation = 'lighter';
  const stars = Math.max(0, Math.round(config.stars));
  for (let i = 0; i < stars; i++) {
    const x = random() * width;
    const y = random() * height;
    const m = random() ** 4;
    ctx.fillStyle = css(mix(white, [1, 1, 1], m), 0.25 + 0.6 * m);
    const size = 0.6 + 1.2 * m;
    ctx.fillRect(x - size / 2, y - size / 2, size, size);
  }
  ctx.restore();
}

/**
 * Draws the trails onto `canvas` at whole device pixels. With `dither` on, they are drawn at one
 * device pixel per `cell` and quantised through the same ordered (Bayer) matrix and curve as the
 * dithered sky, then scaled up by whole pixels with no smoothing.
 */
export function drawTrailsSky(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  config: TrailsConfig,
  dither: { cell: number; levels: number; curve: number; chroma: number; noise: number }
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx || !width || !height) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (!config.dither) {
    paint(ctx, width, height, dpr, config);
    return;
  }

  const step = Math.max(1, Math.round(dither.cell * dpr));
  const cols = Math.ceil(canvas.width / step);
  const rows = Math.ceil(canvas.height / step);
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  const sctx = small.getContext('2d')!;
  paint(sctx, width, height, cols / width, config);
  const image = sctx.getImageData(0, 0, cols, rows);
  const data = image.data;
  const top = Math.max(2, Math.round(dither.levels)) - 1;
  const curve = Math.max(0.5, dither.curve);
  for (let gy = 0; gy < rows; gy++)
    for (let gx = 0; gx < cols; gx++) {
      const i = (gy * cols + gx) * 4;
      const a = data[i + 3] / 255;
      const shared = BAYER[gy & 7][gx & 7] + (hash(gx, gy) - 0.5) * dither.noise;
      for (let ch = 0; ch < 3; ch++) {
        // Canvas pixels are premultiplied by alpha on the way out; the light is colour × alpha.
        const v = toLinear(data[i + ch] / 255) * a;
        const threshold = shared + (hash(gx, gy, ch + 1) - 0.5) * dither.chroma;
        const level = Math.max(0, Math.min(top, Math.floor(v ** (1 / curve) * top + threshold)));
        data[i + ch] = Math.round(toSrgb((level / top) ** curve) * 255);
      }
      data[i + 3] = 255;
    }
  sctx.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(small, 0, 0, cols * step, rows * step);
}
