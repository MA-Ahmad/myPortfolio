import saved from './dither-sky.json';

/**
 * A dithered glow across the night sky, like a sunrise seen from orbit: a sharp horizon with light
 * above it, quantised through an ordered (Bayer) threshold matrix and drawn on a grid of square
 * cells, so it reads as fine pixels, like an LED panel.
 *
 * It is quantised close to linear light (`curve`), which is what gives the look: near black the
 * first step up is already a visible grey, so the dark dithers into sparse, distinct dots, while in
 * the bright band neighbouring levels are close and the dither is a fine checker texture. The channels share one
 * threshold, so dots are grey; a little independent jitter per channel (`chroma`) leaves the odd
 * red, green or yellow speck where they disagree.
 *
 * The light is not a gradient between colour stops: it is three glows added together in linear
 * light, as light adds. A thin red rim on the horizon, a warm glow just above it, and a cool glow
 * higher up that fades out slowly to black. Where warm and cool overlap they add to a soft near
 * white, so the colours melt into each other with no seam, as in the reference this was fitted to
 * (each channel there is one smooth bump: red low, green in the middle, blue high). Below the
 * horizon it drops to dark at once.
 */
export type DitherConfig = {
  /** 1 to draw it (night only), 0 for off. */
  enabled: number;
  /** 1 to put each pane's blocks on frosted glass cards over it, 0 to leave the text on the sky. */
  cards: number;
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
  /**
   * The horizon: its tilt (deg), where it crosses the sheet's middle (share of height), and the
   * band's height (share of the sheet's), which every distance below is a share of.
   */
  angle: number;
  offset: number;
  width: number;
  /** How much dimmer the band's left end is than its right (0: even). */
  taper: number;
  /** The cool glow: colour, strength, peak height above the horizon, spread upward and downward. */
  cool: string;
  coolStrength: number;
  coolAt: number;
  coolUp: number;
  coolDown: number;
  /** The warm glow just above the horizon: colour, strength, peak height, spread. */
  warm: string;
  warmStrength: number;
  warmAt: number;
  warmWidth: number;
  /** The rim on the horizon: colour, strength, spread above it, and how far it reaches down below it. */
  rim: string;
  rimStrength: number;
  rimWidth: number;
  rimDown: number;
  /** Below the horizon: how far the horizon's light takes to fade, and the faint glow of it left under it. */
  edge: number;
  below: number;
  /** How far down that glow under the horizon reaches before it's gone (band heights). */
  belowSpread: number;
  /**
   * A second glow, mirroring the first from the other corner: brightest at and past its own line
   * (by default near the bottom right) and fading out towards the top left. Colour, strength, the
   * line's tilt (deg) and where it crosses the sheet's middle (share of height), and how far the
   * glow reaches across the sheet from it (band heights).
   */
  low: string;
  lowStrength: number;
  lowAngle: number;
  lowOffset: number;
  lowSpread: number;
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

  // Each glow's colour in linear light, scaled by its strength.
  const light = (hex: string, strength: number) => rgb(hex).map((c) => toLinear(c) * strength);
  const cool = light(config.cool, config.coolStrength);
  const warm = light(config.warm, config.warmStrength);
  const rim = light(config.rim, config.rimStrength);
  const low = light(config.low, config.lowStrength);
  const lowAngle = (config.lowAngle * Math.PI) / 180;
  const lowCos = Math.cos(lowAngle);
  const lowSin = Math.sin(lowAngle);
  const lowY = height * config.lowOffset;
  const gauss = (x: number, spread: number) => Math.exp(-((x / Math.max(spread, 1e-3)) ** 2));

  // The horizon in sheet px: a line through (middle, offset) tilted by `angle`. h is the height
  // above it, in band heights; s runs along it, 0 at the left end of the sheet and 1 at the right.
  const angle = (config.angle * Math.PI) / 180;
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  const cx = width / 2;
  const cy = height * config.offset;
  const band = Math.max(1, height * config.width);
  const levels = Math.max(2, Math.round(config.levels));
  const top = levels - 1;
  const curve = Math.max(0.5, config.curve);
  const lit: [number, number, number] = [0, 0, 0];

  for (let gy = 0; gy < rows; gy++) {
    const y = ((gy + 0.5) * step) / dpr;
    for (let gx = 0; gx < cols; gx++) {
      const x = ((gx + 0.5) * step) / dpr;
      const h = ((x - cx) * sin - (y - cy) * cos) / band;
      const along = Math.min(1, Math.max(0, ((x - cx) * cos + (y - cy) * sin) / width + 0.5));
      const even = 1 - config.taper * (1 - along * along * (3 - 2 * along));
      // Above the horizon the glows add. Below it, the light at the horizon fades out over `edge`,
      // the rim's own red over `rimDown`, and a faint glow of the horizon's light carries on under
      // both, dying away over `belowSpread`.
      const above = Math.max(0, h);
      const under = Math.max(0, -h);
      const cut = h >= 0 ? 1 : gauss(under, config.edge);
      const glowUnder =
        h >= 0 ? 0 : config.below * Math.exp(-under / Math.max(0.01, config.belowSpread));
      const cg =
        above > config.coolAt
          ? gauss(above - config.coolAt, config.coolUp)
          : gauss(above - config.coolAt, config.coolDown);
      const wg = gauss(above - config.warmAt, config.warmWidth);
      const rg = h >= 0 ? gauss(above, config.rimWidth) : gauss(under, config.rimDown);
      // The second glow: full past its line, fading with the height above it.
      const lowH = ((x - cx) * lowSin - (y - lowY) * lowCos) / band;
      const lg = gauss(Math.max(0, lowH), config.lowSpread);
      for (let ch = 0; ch < 3; ch++)
        // The rim burns brightest at the bright end, like the sun about to come up there.
        lit[ch] =
          ((cool[ch] * cg + warm[ch] * wg) * (cut + glowUnder) +
            rim[ch] * (rg + glowUnder) * even * even) *
            even +
          low[ch] * lg;
      // The dark dots thin out away from the band, so the text below sits on a quieter sky.
      const out = h > 1.4 ? h - 1.4 : h < 0 ? under * 3 : 0;
      const near = Math.exp(-((out / 1.2) ** 2));
      const floor = (config.floor / top) * (config.farDots + (1 - config.farDots) * near);
      const shared = BAYER[gy & 7][gx & 7] + (hash(gx, gy) - 0.5) * config.noise;
      const i = (gy * cols + gx) * 4;
      for (let ch = 0; ch < 3; ch++) {
        const v = Math.min(1, Math.min(1, lit[ch]) ** (1 / curve) + floor);
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
