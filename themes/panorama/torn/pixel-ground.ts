import saved from './pixel-ground.json';

/**
 * The ground's pixels: a dense, clumped field of squares on a fine grid along the bottom of the
 * sheet, thinning upward to a ragged edge. Drawn white; CSS turns it black by day.
 */
export type GroundConfig = {
  seed: number;
  /** Grid pitch and square size, px. */
  cell: number;
  size: number;
  /** How far up the sheet the field reaches, as a share of its height, and how fast it thins. */
  reach: number;
  curve: number;
  /** The chance a cell is lit at the very bottom, before clumping. */
  density: number;
  /** Clump size in cells, and how much the clumps decide where cells are lit (0: evenly). */
  clump: number;
  clumping: number;
  /** How much the field gathers into the bottom corners rather than running all the way across. */
  corners: number;
  /** The strongest alpha, the faintest lit cell (as a share of it), and the share drawn full. */
  brightness: number;
  floor: number;
  bright: number;
  /** Overall opacity at night (white) and by day (black). */
  night: number;
  day: number;
};

export const GROUND_DEFAULTS: GroundConfig = saved;

/* A tiny store, so the tuning page (/dev/grid) can redraw the live sheet as its sliders move. */
let current: GroundConfig = GROUND_DEFAULTS;
const listeners = new Set<() => void>();
export const groundStore = {
  get: () => current,
  getServer: () => GROUND_DEFAULTS,
  set(next: GroundConfig) {
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

function hash(x: number, y: number, seed: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** Smooth value noise in [0, 1], one lattice point every `scale` cells. */
function noise(x: number, y: number, scale: number, seed: number) {
  const fx = x / scale;
  const fy = y / scale;
  const ix = Math.floor(fx);
  const iy = Math.floor(fy);
  const sx = fx - ix;
  const sy = fy - iy;
  const u = sx * sx * (3 - 2 * sx);
  const v = sy * sy * (3 - 2 * sy);
  const a = hash(ix, iy, seed);
  const b = hash(ix + 1, iy, seed);
  const c = hash(ix, iy + 1, seed);
  const d = hash(ix + 1, iy + 1, seed);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/**
 * Draws the field. Rows count up from the bottom edge, so the pattern stays anchored there and a
 * resize never reshuffles it. Pure: the same config and size always draw the same pixels.
 */
export function drawPixelGround(
  canvas: HTMLCanvasElement,
  width: number,
  height: number,
  config: GroundConfig
) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);

  const { seed, cell, reach, curve, density, clump, clumping, corners } = config;
  const { brightness, floor, bright } = config;
  const px = Math.max(1, Math.min(config.size, cell));
  const inset = (cell - px) / 2;
  const rows = Math.ceil((height * reach) / cell);
  const cols = Math.ceil(width / cell);
  ctx.fillStyle = '#fff';

  for (let gy = 0; gy < rows; gy++) {
    const vertical = (1 - gy / rows) ** curve;
    const y = height - (gy + 1) * cell + inset;
    for (let gx = 0; gx < cols; gx++) {
      // 0 at the middle of the sheet, 1 at either side.
      const side = Math.abs((gx + 0.5) / cols - 0.5) * 2;
      const horizontal = 1 - corners + corners * side ** 1.4;
      const n = noise(gx, gy, clump, seed + 7);
      const clumped = 1 - clumping + clumping * 1.6 * smoothstep(0.3, 0.75, n);
      const chance = density * vertical * horizontal * clumped;
      if (hash(gx, gy, seed) >= chance) continue;
      const full = hash(gx, gy, seed + 1) < bright;
      // Cells in the thick of the field are a little stronger than strays at its edge.
      const depth = 0.55 + 0.45 * Math.min(1, chance / Math.max(density, 0.01));
      const level = full ? 1 : floor + (1 - floor) * 0.6 * hash(gx, gy, seed + 2) * depth;
      ctx.globalAlpha = Math.min(1, brightness * level);
      ctx.fillRect(gx * cell + inset, y, px, px);
    }
  }
  ctx.globalAlpha = 1;
}
