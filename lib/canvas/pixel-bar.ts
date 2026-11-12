/**
 * A progress bar made of pixels: a track of faint dots that fills, from the left, with coloured
 * segments of cells on one strict grid. Which cells are lit is an ordered dither of drifting noise,
 * so they gather into checkers and diamonds that keep shifting; a few flare white-hot; the leading
 * edge is solid white with a bloom, cooling to the segment's colour behind it.
 */

/** The segments, left to right: a colour and a share of the bar. */
export const SEGMENTS: { color: string; share: number }[] = [
  { color: '#4a98f0', share: 16 },
  { color: '#4fd373', share: 10.5 },
  { color: '#ec5aa5', share: 17 },
  { color: '#9d6cf0', share: 12.5 },
  { color: '#2acbe8', share: 12 },
  { color: '#f5c938', share: 4 },
  { color: '#b0b4c0', share: 9.5 },
  { color: '#f28530', share: 14 },
  { color: '#e84846', share: 9.5 }
];

/** Grid pitch, a lit cell, a dim cell and a track dot, px. */
const PITCH = 6;
const LIT = 4;
const DIM = 1.5;
const DOT = 2;
/** Rows of cells; the first and last sit on the bar's top and bottom edges, cut in half by them. */
export const ROWS = 23;
/** Room round the bar for its glow, px. */
export const BLEED = 36;
/** Corner radius at the bar's start and at its leading end, px. */
const RADIUS = 9;
const HEAD_RADIUS = 3;
/** How far behind the leading edge the cells stay white-hot, in cells. */
const HEAT = 13;
/** Head follows its target at this rate (1/s), and the heat fades over this long once it's done, ms. */
const FOLLOW = 9;
const COOL_MS = 520;

export const barHeight = (ROWS - 1) * PITCH;
/** The bar's own width for a box `width` px wide: a whole number of cells. */
export const barWidth = (width: number) => Math.floor(width / PITCH) * PITCH;

type Rgb = [number, number, number];
const rgb = (hex: string): Rgb => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16)) as Rgb;
const mix = (a: Rgb, b: Rgb, k: number): Rgb => [
  a[0] + (b[0] - a[0]) * k,
  a[1] + (b[1] - a[1]) * k,
  a[2] + (b[2] - a[2]) * k
];
const css = (c: Rgb, alpha = 1) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${alpha.toFixed(3)})`;
const WHITE: Rgb = [255, 255, 255];
const COLORS = SEGMENTS.map((segment) => rgb(segment.color));

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
const smooth = (v: number) => v * v * (3 - 2 * v);

/* Ordered dither: a level becomes the checkers and diamonds the bar is made of. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);

/** The bar's outline from its start to `end`: round at the start, barely round at the leading end. */
function outline(ctx: CanvasRenderingContext2D, end: number, height: number) {
  const r = Math.min(RADIUS, end / 2);
  const h = Math.min(HEAD_RADIUS, end / 2);
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(end - h, 0);
  ctx.arcTo(end, 0, end, h, h);
  ctx.lineTo(end, height - h);
  ctx.arcTo(end, height, end - h, height, h);
  ctx.lineTo(r, height);
  ctx.arcTo(0, height, 0, height - r, r);
  ctx.lineTo(0, r);
  ctx.arcTo(0, 0, r, 0, r);
  ctx.closePath();
}

export type Hop = { col: number; row: number; born: number; life: number };

export type BarFrame = {
  /** The bar's width, px (a whole number of cells), and how far it has filled, px. */
  width: number;
  head: number;
  /** How hot the leading edge is, 0 to 1. */
  heat: number;
  /** Seconds, for the drift, and ms, for the white-hot cells. */
  time: number;
  now: number;
  hops: Hop[];
};

/** Each segment's first column, and one past the last. */
function bounds(cols: number) {
  const total = SEGMENTS.reduce((sum, segment) => sum + segment.share, 0);
  let run = 0;
  return SEGMENTS.map((segment) => {
    run += segment.share;
    return Math.round((run / total) * cols);
  });
}

/**
 * Draws one frame, on a context already scaled to CSS px and moved to the bar's top left corner.
 * Pure: the same frame always draws the same pixels.
 */
export function drawPixelBar(ctx: CanvasRenderingContext2D, frame: BarFrame) {
  const { width, heat, time, now } = frame;
  const height = barHeight;
  const cols = Math.round(width / PITCH);
  const head = Math.max(0, Math.min(width, frame.head));
  const ends = bounds(cols);
  const segmentOf = (col: number) => Math.max(0, ends.findIndex((end) => col <= end));
  const hot = (x: number) => clamp(1 - (head - x) / (HEAT * PITCH)) * heat;

  // The track: a hairline and a dot in every cell still to fill.
  ctx.save();
  outline(ctx, width, height);
  ctx.strokeStyle = 'rgba(255,255,255,0.055)';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.clip();
  ctx.fillStyle = 'rgba(255,255,255,0.05)';
  for (let col = Math.max(1, Math.ceil(head / PITCH)); col < cols; col++) {
    for (let row = 1; row < ROWS - 1; row++) {
      ctx.fillRect(col * PITCH - DOT / 2, row * PITCH - DOT / 2, DOT, DOT);
    }
  }
  ctx.restore();
  if (head < 1) return;

  const last = COLORS[segmentOf(Math.floor(head / PITCH))];

  // The bloom round the leading edge, under everything: drawn as a shadow whose box is off canvas.
  if (heat > 0.01) {
    const scale = ctx.getTransform().a;
    const away = 4000;
    ctx.save();
    ctx.shadowOffsetX = away * scale;
    ctx.shadowBlur = 26 * scale;
    ctx.shadowColor = css(mix(last, WHITE, 0.8), 0.85 * heat);
    ctx.fillStyle = '#fff';
    const reach = Math.min(head, HEAT * PITCH * 0.75);
    ctx.fillRect(head - reach - away, 0, reach, height);
    ctx.restore();
  }

  ctx.save();
  outline(ctx, head, height);
  ctx.clip();

  // Each segment's tint, then the heat's wash over the leading stretch.
  let start = 0;
  ends.forEach((end, i) => {
    const from = start * PITCH;
    start = end;
    if (from >= head) return;
    ctx.fillStyle = css(mix([22, 23, 26], COLORS[i], 0.24));
    ctx.fillRect(from, 0, Math.min(head, end * PITCH) - from, height);
  });
  if (heat > 0.01) {
    const wash = ctx.createLinearGradient(head - HEAT * PITCH * 1.4, 0, head, 0);
    wash.addColorStop(0, 'rgba(255,255,255,0)');
    wash.addColorStop(1, `rgba(255,255,255,${(0.42 * heat).toFixed(3)})`);
    ctx.fillStyle = wash;
    ctx.fillRect(head - HEAT * PITCH * 1.4, 0, HEAT * PITCH * 1.4, height);
  }

  // The cells.
  const filled = Math.min(cols, Math.floor(head / PITCH + 0.5));
  for (let col = 0; col <= filled; col++) {
    const x = col * PITCH;
    const color = COLORS[segmentOf(col)];
    const e = hot(x);
    const white = clamp(e * 1.5);
    const lit = css(mix(color, WHITE, white));
    const dim = css(mix(color, WHITE, white), 0.17 + 0.5 * white);
    for (let row = 0; row < ROWS; row++) {
      const y = row * PITCH;
      const edge = row === 0 || row === ROWS - 1;
      const n = noise(col / 5, row / 5, time * 0.3, 17);
      // At most a checker: the bar never fills solid away from its leading edge.
      let level = edge ? (col & 1 ? 0 : 1) : Math.min(0.5, Math.max(0, 1.5 * n - 0.42));
      level += (1 - level) * smooth(clamp(e * 1.35));
      if (BAYER[(row & 3) * 4 + (col & 3)] < level) {
        ctx.fillStyle = lit;
        ctx.fillRect(x - LIT / 2, y - LIT / 2, LIT, LIT);
      } else {
        ctx.fillStyle = dim;
        ctx.fillRect(x - DIM / 2, y - DIM / 2, DIM, DIM);
      }
    }
  }

  // The white-hot cells.
  for (const hop of frame.hops) {
    if (hop.col * PITCH > head - PITCH) continue;
    const age = (now - hop.born) / hop.life;
    if (age < 0 || age > 1) continue;
    ctx.fillStyle = css(mix(COLORS[segmentOf(hop.col)], WHITE, 0.78), Math.sin(Math.PI * age) ** 0.5);
    ctx.fillRect(hop.col * PITCH - LIT / 2, hop.row * PITCH - LIT / 2, LIT, LIT);
  }

  // The lines between segments.
  ctx.fillStyle = 'rgba(255,255,255,0.5)';
  for (const end of ends.slice(0, -1)) {
    if (end * PITCH < head - 1) ctx.fillRect(end * PITCH - 0.5, 0, 1, height);
  }
  ctx.restore();

  // Each segment's stretch of the outline in its own colour: a soft glow, then the line.
  start = 0;
  ends.forEach((end, i) => {
    const from = start * PITCH;
    start = end;
    if (from >= head) return;
    const to = Math.min(head, end * PITCH);
    const leading = to === head;
    const color = leading ? mix(COLORS[i], WHITE, 0.55 * heat) : COLORS[i];
    ctx.save();
    ctx.beginPath();
    ctx.rect(from - (i === 0 ? BLEED : 0), -BLEED, to - from + (i === 0 ? BLEED : 0) + (leading ? BLEED : 0), height + BLEED * 2);
    ctx.clip();
    outline(ctx, head, height);
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = css(color);
    ctx.shadowColor = css(color, 0.75);
    ctx.shadowBlur = 7 * ctx.getTransform().a;
    ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.stroke();
    ctx.restore();
  });
}

export type PixelBar = {
  /** Where the bar should fill to, 0 to 1; it follows smoothly. `jump` puts it there at once. */
  set: (progress: number, jump?: boolean) => void;
  /** Whether the bar has reached 1 and stopped. */
  settled: () => boolean;
  stop: () => void;
};

/**
 * Runs the bar on `canvas`, which is BLEED px larger than the bar on every side. The leading edge
 * stays hot while the bar is short of full, and cools once it gets there.
 */
export function runPixelBar(canvas: HTMLCanvasElement): PixelBar {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const started = performance.now();
  let ctx: CanvasRenderingContext2D | null = null;
  let width = 0;
  let target = 0;
  let head = 0;
  let heat = 1;
  let arrived = 0;
  let last = started;
  let frame = 0;
  let hops: Hop[] = [];

  const draw = (now: number) => {
    frame = requestAnimationFrame(draw);
    if (!ctx || !width) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const goal = target * width;
    head = reduced ? goal : head + (goal - head) * (1 - Math.exp(-dt * FOLLOW));
    if (Math.abs(goal - head) < 0.3) head = goal;
    const full = target >= 1 && head >= width;
    if (!full) arrived = 0;
    else if (!arrived) arrived = now;
    heat = full ? 1 - smooth(clamp((now - arrived) / COOL_MS)) : 1;

    const cols = Math.floor(head / PITCH) - 1;
    hops = hops.filter((hop) => now - hop.born < hop.life && hop.col <= cols);
    const want = reduced ? 0 : Math.round((cols * ROWS) / 130);
    while (hops.length < want) {
      hops.push({
        col: 1 + Math.floor(Math.random() * cols),
        row: 1 + Math.floor(Math.random() * (ROWS - 2)),
        born: now,
        life: 350 + Math.random() * 1100
      });
    }

    const dpr = window.devicePixelRatio || 1;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, BLEED * dpr, BLEED * dpr);
    drawPixelBar(ctx, { width, head, heat, time: reduced ? 0 : (now - started) / 1000, now, hops });
  };

  const observer = new ResizeObserver(() => {
    const dpr = window.devicePixelRatio || 1;
    const before = width;
    width = barWidth(canvas.clientWidth - BLEED * 2);
    canvas.width = Math.round(canvas.clientWidth * dpr);
    canvas.height = Math.round(canvas.clientHeight * dpr);
    ctx = canvas.getContext('2d');
    if (before) head = (head / before) * width;
  });
  observer.observe(canvas);
  frame = requestAnimationFrame(draw);

  return {
    set(progress, jump) {
      target = clamp(progress);
      if (jump) {
        head = target * width;
        hops = [];
      }
    },
    settled: () => target >= 1 && head >= width && width > 0,
    stop() {
      cancelAnimationFrame(frame);
      observer.disconnect();
    }
  };
}
