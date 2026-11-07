import saved from './dither-sky.json';

/**
 * A dithered band across the night sky: a smooth gradient (black, green, yellow, black, across a
 * tilted band) quantised through an ordered (Bayer) threshold matrix and drawn on a grid of square
 * cells, so it reads as fine pixels, like an LED panel.
 *
 * It is quantised close to linear light (`curve`), which is what gives the look: near black the
 * first step up is already a visible grey, so the dark dithers into sparse, distinct dots, while in
 * the bright band neighbouring levels are close and the dither is a fine checker texture. The channels share one
 * threshold, so dots are grey; a little independent jitter per channel (`chroma`) leaves the odd
 * red, green or yellow speck where they disagree.
 */
export type DitherConfig = {
  /** 1 to draw it (night only), 0 for off. */
  enabled: number;
  opacity: number;
  /** Cell size in CSS px, snapped to whole device pixels, and the dark gap between cells (device px). */
  cell: number;
  gap: number;
  /** Levels per channel: fewer is coarser, with brighter, sparser dots in the dark. */
  levels: number;
  /**
   * The space the levels are spaced in: linear light raised to 1/curve. 1 is linear (bright dots,
   * smooth band), 2.4 is about sRGB (dim dots, coarse band); between, both ends look right.
   */
  curve: number;
  /** Jitter on each channel's own threshold: the odd coloured speck where channels disagree. */
  chroma: number;
  /** Jitter on the shared threshold, in levels, so the dots aren't a perfect lattice. */
  noise: number;
  /** A faint grey everywhere, as a share of a level: about the share of dark cells lit as dots. */
  floor: number;
  /** How much of `floor` is left far from the band (1: dots everywhere, 0: only around the band). */
  farDots: number;
  /** The band: its tilt (deg), where its centre crosses the sheet's middle (share of height), its width. */
  angle: number;
  offset: number;
  width: number;
  /** How smoothly the colours blend into each other (0: hard steps, 1: smooth). */
  softness: number;
  /** A wide soft halo of the band's colours past its edges. */
  glow: number;
  /** The band's colours from its top edge to its bottom edge, and where green and yellow peak (0–1). */
  top: string;
  green: string;
  yellow: string;
  bottom: string;
  greenAt: number;
  yellowAt: number;
};

export const DITHER_DEFAULTS: DitherConfig = saved;

/* A tiny store, so the tuning page (/dev/dither) can redraw the live sheet as its sliders move. */
let current: DitherConfig = DITHER_DEFAULTS;
const listeners = new Set<() => void>();
export const ditherStore = {
  get: () => current,
  getServer: () => DITHER_DEFAULTS,
  set(next: DitherConfig) {
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

/** The 8×8 Bayer matrix, as thresholds in (0, 1). */
const BAYER = (() => {
  const m = [[0]];
  let size = 1;
  let out = m;
  while (size < 8) {
    const next: number[][] = Array.from({ length: size * 2 }, () => []);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const v = out[y][x] * 4;
        next[y][x] = v;
        next[y][x + size] = v + 2;
        next[y + size][x] = v + 3;
        next[y + size][x + size] = v + 1;
      }
    out = next;
    size *= 2;
  }
  return out.map((row) => row.map((v) => (v + 0.5) / 64));
})();

function hash(x: number, y: number, salt = 0) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(salt + 1, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

const rgb = (hex: string): [number, number, number] => {
  const n = parseInt(hex.replace('#', ''), 16);
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};

const toLinear = (c: number) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toSrgb = (c: number) => (c <= 0.0031308 ? c * 12.92 : 1.055 * c ** (1 / 2.4) - 0.055);

const smooth = (t: number, softness: number) => {
  const s = t * t * (3 - 2 * t);
  return t + (s - t) * softness;
};

/**
 * Draws the band onto `canvas`, cell by cell at whole device pixels, so every cell is crisp. Pure:
 * the same config and size always draw the same pixels.
 */
export function drawDitherSky(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  config: DitherConfig
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx || !width || !height) return;

  const step = Math.max(1, Math.round(config.cell * dpr));
  const cols = Math.ceil(canvas.width / step);
  const rows = Math.ceil(canvas.height / step);
  const image = new ImageData(cols, rows);
  const data = image.data;

  const stops: [number, [number, number, number]][] = [
    [0, rgb(config.top)],
    [Math.min(config.greenAt, config.yellowAt), rgb(config.green)],
    [Math.max(config.greenAt, config.yellowAt), rgb(config.yellow)],
    [1, rgb(config.bottom)]
  ];
  const colourAt = (u: number): [number, number, number] => {
    for (let i = 1; i < stops.length; i++) {
      const [at, c] = stops[i];
      const [from, p] = stops[i - 1];
      if (u <= at) {
        const t = smooth(at > from ? (u - from) / (at - from) : 1, config.softness);
        return [p[0] + (c[0] - p[0]) * t, p[1] + (c[1] - p[1]) * t, p[2] + (c[2] - p[2]) * t];
      }
    }
    return stops[stops.length - 1][1];
  };

  // The band in sheet px: a line through (middle, offset) tilted by `angle`; u runs 0 to 1 across it.
  const angle = (config.angle * Math.PI) / 180;
  const nx = -Math.sin(angle);
  const ny = Math.cos(angle);
  const cx = width / 2;
  const cy = height * config.offset;
  const band = Math.max(1, height * config.width);
  const peak = colourAt((config.greenAt + config.yellowAt) / 2);
  const levels = Math.max(2, Math.round(config.levels));
  const top = levels - 1;
  const curve = Math.max(0.5, config.curve);

  for (let gy = 0; gy < rows; gy++) {
    const y = ((gy + 0.5) * step) / dpr;
    for (let gx = 0; gx < cols; gx++) {
      const x = ((gx + 0.5) * step) / dpr;
      const d = (x - cx) * nx + (y - cy) * ny;
      const u = d / band + 0.5;
      const c: [number, number, number] = u > 0 && u < 1 ? colourAt(u) : [0, 0, 0];
      // The halo: the band's own colour, falling off past its edges.
      const out = u < 0 ? -u : u > 1 ? u - 1 : 0;
      const halo = config.glow * Math.exp(-((out / 0.6) ** 2)) * (out > 0 ? 1 : 0);
      // The dark dots thin out away from the band, so the text below sits on a quieter sky.
      const near = Math.exp(-((out / 1.2) ** 2));
      const floor = (config.floor / top) * (config.farDots + (1 - config.farDots) * near);
      const shared = BAYER[gy & 7][gx & 7] + (hash(gx, gy) - 0.5) * config.noise;
      const i = (gy * cols + gx) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = Math.min(
          1,
          toLinear(Math.min(1, c[ch] + peak[ch] * halo)) ** (1 / curve) + floor
        );
        const threshold = shared + (hash(gx, gy, ch + 1) - 0.5) * config.chroma;
        const level = Math.max(0, Math.min(top, Math.floor(v * top + threshold)));
        data[i + ch] = Math.round(toSrgb((level / top) ** curve) * 255);
      }
      data[i + 3] = 255;
    }
  }

  // Drawn at one device pixel per cell, then scaled up by whole pixels with no smoothing.
  const small = document.createElement('canvas');
  small.width = cols;
  small.height = rows;
  small.getContext('2d')!.putImageData(image, 0, 0);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(small, 0, 0, cols * step, rows * step);

  // A dot-matrix look: cut a dark line between cells.
  const gap = Math.min(step - 1, Math.round(config.gap));
  if (gap > 0) {
    ctx.fillStyle = '#000';
    for (let x = step - gap; x < canvas.width; x += step) ctx.fillRect(x, 0, gap, canvas.height);
    for (let y = step - gap; y < canvas.height; y += step) ctx.fillRect(0, y, canvas.width, gap);
  }
}
