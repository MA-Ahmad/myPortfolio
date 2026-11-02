import config from './pixel-sky.json';

/** A 0–1 value for a grid cell, fixed by the seed, so resizing never reshuffles the pixels. */
function cellRandom(x: number, y: number, seed: number, salt: number) {
  let h = Math.imul(x, 374761393) ^ Math.imul(y, 668265263) ^ Math.imul(seed + salt, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/**
 * The night sky's pixels: sparse squares on a grid across the top of the sheet. A cell is lit with
 * a chance that falls from `density` at the top edge to nothing at `fade` of the height, so only a
 * few show; most are dim, a share (`bright`) full. The numbers are pixel-sky.json, picked by eye,
 * and the drawing is a pure function of them and the size.
 */
export function drawPixelSky(canvas: HTMLCanvasElement, width: number, height: number) {
  const dpr = window.devicePixelRatio || 1;
  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, width, height);
  const { cell, size, density, fade, brightness, bright, seed } = config;
  const end = height * fade;
  const px = Math.min(size, cell);
  const inset = Math.floor((cell - px) / 2);
  for (let gy = 0; gy * cell < end; gy++) {
    const falloff = (1 - (gy * cell) / end) ** 1.6;
    for (let gx = 0; gx * cell < width; gx++) {
      if (cellRandom(gx, gy, seed, 0) >= density * falloff) continue;
      const full = cellRandom(gx, gy, seed, 1) < bright;
      const alpha = brightness * (full ? 1 : 0.3 + 0.4 * cellRandom(gx, gy, seed, 2));
      ctx.fillStyle = `rgba(228, 232, 242, ${alpha.toFixed(3)})`;
      ctx.fillRect(gx * cell + inset, gy * cell + inset, px, px);
    }
  }
}
