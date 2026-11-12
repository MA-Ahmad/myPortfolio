// PROTOTYPE: thrown away once a direction is chosen. Draws the pixel field on the sheet and the
// pixel welds over its seams. Only pages/proto/panorama-pixels.tsx imports it.

export const DEFAULTS = {
  // Which pieces are on.
  bloom: 1,
  lattice: 0,
  blocks: 0,
  hop: 1,
  sweep: 0,
  cursor: 0,
  keepSky: 0,
  /** 0 current, 1 zip-evaporate, 2 condense, 3 pixel sparks. */
  weld: 1,
  // The numbers.
  cell: 6,
  size: 4,
  reach: 0.42,
  density: 0.62,
  brightness: 0.55,
  glow: 6,
  hops: 14,
  drift: 0.12,
  sweepEvery: 7,
  speed: 1
};
export type Values = typeof DEFAULTS;

/** The live values, written by the panel and read by the draw loops each frame. */
export const live: Values = { ...DEFAULTS };

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
const smooth = (a: number, b: number, x: number) => {
  const t = clamp((x - a) / (b - a));
  return t * t * (3 - 2 * t);
};

/* Ordered dither: a level turns into the checkers and diamonds the reference is made of. */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map((v) => (v + 0.5) / 16);
const bayer = (gx: number, gy: number) => BAYER[(gy & 3) * 4 + (gx & 3)];

type Block = { x: number; y: number; w: number; h: number; level: number; seed: number };

/** A bar of outlined blocks out of each corner, as in the reference, in cells. */
function blocksOf(cols: number, rows: number): Block[] {
  const out: Block[] = [];
  const h = 14;
  const widths = [26, 12, 20, 9, 16, 5, 11];
  let x = 3;
  widths.forEach((w, i) => {
    out.push({ x, y: 3, w, h, level: 0.75 - i * 0.09, seed: 11 + i });
    x += w;
  });
  x = cols - 3;
  widths.forEach((w, i) => {
    x -= w;
    out.push({ x, y: rows - 3 - h, w, h, level: 0.75 - i * 0.09, seed: 41 + i });
  });
  return out;
}

type Hop = { gx: number; gy: number; born: number; life: number };

/**
 * The field: one canvas inside the sheet's surface, under the page's content. Everything sits on
 * one grid and only around the top left and bottom right corners; the middle stays clear.
 */
export function startField(canvas: HTMLCanvasElement, root: HTMLElement) {
  const ctx = canvas.getContext('2d')!;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let width = 0;
  let height = 0;
  let frame = 0;
  let hops: Hop[] = [];
  const pointer = { x: -9999, y: -9999 };
  const started = performance.now();

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    width = canvas.clientWidth;
    height = canvas.clientHeight;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  const observer = new ResizeObserver(resize);
  observer.observe(canvas);
  resize();

  const onMove = (event: PointerEvent) => {
    const box = canvas.getBoundingClientRect();
    pointer.x = event.clientX - box.left;
    pointer.y = event.clientY - box.top;
  };
  window.addEventListener('pointermove', onMove, { passive: true });

  const draw = (now: number) => {
    frame = reduced ? 0 : requestAnimationFrame(draw);
    const v = live;
    ctx.clearRect(0, 0, width, height);
    if (!v.bloom && !v.lattice && !v.blocks) return;

    const night = root.dataset.time === 'night';
    const ink = night ? '255,255,255' : '24,30,48';
    const strength = v.brightness * (night ? 1.6 : 1);
    const cell = v.cell;
    const px = Math.min(v.size, cell);
    const inset = (cell - px) / 2;
    const cols = Math.ceil(width / cell);
    const rows = Math.ceil(height / cell);
    const t = reduced ? 0 : ((now - started) / 1000) * v.speed;
    const reach = Math.hypot(width, height) * v.reach;
    const paint = (alpha: number) => `rgba(${ink},${Math.min(1, alpha * strength).toFixed(3)})`;

    // A diagonal shine from the top left to the bottom right, now and then.
    const sweepAt =
      v.sweep && !reduced ? ((t % v.sweepEvery) / 1.6) * (width + height + 400) - 200 : -9999;

    const lit: number[] = [];
    for (let gy = 0; gy < rows; gy++) {
      const y = gy * cell;
      for (let gx = 0; gx < cols; gx++) {
        const x = gx * cell;
        // How deep into a corner's field this cell is, with a ragged edge.
        const near = Math.min(Math.hypot(x, y * 1.25), Math.hypot(width - x, (height - y) * 1.25));
        const depth = 1 - near / reach;
        const field = clamp(depth + (noise(gx / 9, gy / 9, 0, 5) * 0.45 - 0.2) * (depth + 0.3));
        if (field <= 0.01) continue;

        let alpha = 0;
        let small = false;
        if (v.lattice) {
          alpha = 0.07 * smooth(0, 0.35, field);
          small = true;
        }
        if (v.bloom) {
          const level = field ** 1.5 * v.density * (0.35 + 1.1 * noise(gx / 7, gy / 7, t * v.drift, 9));
          if (bayer(gx, gy) < level) {
            alpha = (0.2 + 0.55 * hash(gx, gy, 3)) * (0.45 + 0.55 * field);
            small = false;
            lit.push(gx, gy);
          }
        }
        if (v.cursor) {
          const d = Math.hypot(x - pointer.x, y - pointer.y);
          if (d < 110) {
            alpha += (1 - d / 110) ** 2 * 0.8;
            small = false;
          }
        }
        const behind = sweepAt - (x + y);
        if (behind > 0 && behind < 220 && alpha > 0) {
          alpha += (1 - behind / 220) ** 2 * (behind < 36 ? 1.4 : 0.7);
          small = false;
        }
        if (alpha <= 0.004) continue;
        ctx.fillStyle = paint(alpha);
        if (small) ctx.fillRect(x + cell / 2 - 0.75, y + cell / 2 - 0.75, 1.5, 1.5);
        else ctx.fillRect(x + inset, y + inset, px, px);
      }
    }

    if (v.blocks) {
      for (const block of blocksOf(cols, rows)) {
        const bx = block.x * cell;
        const by = block.y * cell;
        const bw = block.w * cell;
        const bh = block.h * cell;
        ctx.fillStyle = paint(0.035);
        ctx.fillRect(bx, by, bw, bh);
        for (let gy = 0; gy < block.h; gy++) {
          for (let gx = 0; gx < block.w; gx++) {
            const cx = block.x + gx;
            const cy = block.y + gy;
            const level =
              block.level * v.density * (0.3 + 1.2 * noise(cx / 5, cy / 5, t * v.drift * 1.6, block.seed));
            const on = bayer(cx, cy) < level;
            const behind = sweepAt - (cx + cy) * cell;
            const shine = behind > 0 && behind < 220 ? (1 - behind / 220) ** 2 : 0;
            ctx.fillStyle = paint((on ? 0.5 + 0.4 * hash(cx, cy, 3) : 0.09) + shine);
            ctx.fillRect(cx * cell + inset, cy * cell + inset, px, px);
            if (on) lit.push(cx, cy);
          }
        }
        ctx.save();
        ctx.shadowColor = `rgba(${ink},${Math.min(1, 0.45 * strength).toFixed(3)})`;
        ctx.shadowBlur = v.glow * 1.5;
        ctx.strokeStyle = paint(0.35 + block.level * 0.5);
        ctx.lineWidth = 1;
        ctx.strokeRect(bx + 0.5, by + 0.5, bw - 1, bh - 1);
        ctx.restore();
      }
    }

    // The white-hot cells: a few lit cells flare, hold, and go out as others take over.
    if (v.hop && lit.length) {
      hops = hops.filter((hop) => now - hop.born < hop.life);
      let guard = 0;
      while (hops.length < v.hops && guard++ < 40) {
        const pick = Math.floor(Math.random() * (lit.length / 2)) * 2;
        const life = reduced ? 1e12 : (500 + Math.random() * 1500) / v.speed;
        hops.push({ gx: lit[pick], gy: lit[pick + 1], born: now, life });
      }
      ctx.save();
      ctx.shadowColor = `rgba(${ink},0.9)`;
      ctx.shadowBlur = v.glow;
      for (const hop of hops.slice(0, v.hops)) {
        const age = reduced ? 0.5 : (now - hop.born) / hop.life;
        ctx.fillStyle = `rgba(${ink},${Math.min(1, Math.sin(Math.PI * age) ** 0.6).toFixed(3)})`;
        ctx.fillRect(hop.gx * cell + inset, hop.gy * cell + inset, px, px);
      }
      ctx.restore();
    }
  };
  frame = requestAnimationFrame(draw);

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('pointermove', onMove);
  };
}

type Mote = {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  born: number;
  life: number;
  /** Pulled in to its seam's line (it joins) rather than drifting away. */
  joins: boolean;
  gravity: number;
  /** Its seam: x is measured from the seam's line, which moves while the sections resize. */
  run: Run;
};

type Run = {
  seam: HTMLElement;
  x: number;
  top: number;
  length: number;
  started: number;
  kind: number;
  spawned: number;
};

const WELD_MS = 1400;
const FRONT_FROM = 150;
const FRONT_TO = 1000;
const TAPER = 72;

/**
 * The pixel welds: one canvas over the window. It watches the page's seams, and when one starts to
 * weld it plays the chosen effect down that seam, in time with the page's own front.
 */
export function startWelds(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d')!;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return () => {};
  let frame = 0;
  let runs: Run[] = [];
  let motes: Mote[] = [];

  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.round(innerWidth * dpr);
    canvas.height = Math.round(innerHeight * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  window.addEventListener('resize', resize);
  resize();

  const draw = (now: number) => {
    const rate = live.speed;
    ctx.clearRect(0, 0, innerWidth, innerHeight);
    runs = runs.filter((run) => (now - run.started) * rate < WELD_MS + 200);

    for (const run of runs) {
      run.x = run.seam.getBoundingClientRect().left;
      const t = (now - run.started) * rate;
      // The page's own front, which starts a taper's length above the seam.
      const front = (run.length + TAPER) * clamp((t - FRONT_FROM) / (FRONT_TO - FRONT_FROM)) - TAPER;

      if (run.kind === 1 || run.kind === 3) {
        // Cells come off both torn edges as the front passes them.
        while (run.spawned < Math.min(front, run.length)) {
          run.spawned += run.kind === 1 ? 2.2 : 7;
          const side = Math.random() < 0.5 ? -1 : 1;
          const y = run.top + run.spawned;
          if (run.kind === 1) {
            const joins = Math.random() < 0.5;
            motes.push({
              x: side * (4 + Math.random() * 22),
              y: y + (Math.random() - 0.5) * 14,
              vx: joins ? 0 : side * (6 + Math.random() * 26),
              vy: joins ? 0 : -(22 + Math.random() * 70),
              size: 2 + Math.random() * 2.5,
              born: now,
              life: (joins ? 260 : 380) + Math.random() * 320,
              joins,
              gravity: 0,
              run
            });
          } else {
            const angle = (-150 + Math.random() * 120) * (Math.PI / 180);
            const speed = 60 + Math.random() * 150;
            motes.push({
              x: 0,
              y,
              vx: Math.cos(angle) * speed * side,
              vy: Math.sin(angle) * speed,
              size: 2 + Math.random() * 2,
              born: now,
              life: 320 + Math.random() * 360,
              joins: false,
              gravity: 380,
              run
            });
          }
        }
      }

      if (run.kind === 2) {
        // Sparse pixels gather in the gap, thicken to solid from the top down, and melt away.
        const grid = 4;
        const fade = clamp(1 - (t - 1050) / 350);
        for (let y = 0; y < run.length; y += grid) {
          const level = clamp((t - 80 - (y / run.length) * 620) / 420);
          if (level <= 0) continue;
          const half = 10 * (1 - 0.75 * smooth(0.55, 1, level)) * (0.6 + 0.4 * fade);
          for (let x = -Math.ceil(half / grid) * grid; x <= half; x += grid) {
            const gx = Math.round(x / grid);
            const gy = Math.round(y / grid);
            if (bayer(gx, gy) >= level * (0.55 + 0.9 * hash(gx, gy, 77))) continue;
            const hot = level > 0.4 && level < 0.75;
            ctx.fillStyle = `rgba(255,255,255,${((hot ? 0.95 : 0.55) * fade).toFixed(3)})`;
            ctx.fillRect(run.x + x - 1.5, run.top + y, 3, 3);
          }
        }
      }
    }

    motes = motes.filter((mote) => (now - mote.born) * rate < mote.life);
    for (const mote of motes) {
      const age = ((now - mote.born) * rate) / mote.life;
      const s = (age * mote.life) / 1000;
      let x = mote.x + mote.vx * s * (1 - 0.35 * age);
      const y = mote.y + mote.vy * s * (1 - 0.35 * age) + 0.5 * mote.gravity * s * s;
      let size = mote.size * (1 - 0.6 * age);
      let alpha = age < 0.15 ? age / 0.15 : 1 - ((age - 0.15) / 0.85) ** 1.6;
      if (mote.joins) {
        // Holds on its edge for a beat, then snaps in to the line and is gone into it.
        const pull = smooth(0.25, 1, age) ** 2;
        x = mote.x * (1 - pull);
        size = mote.size * (1 - 0.5 * pull);
        alpha = age < 0.12 ? age / 0.12 : 1 - smooth(0.8, 1, age);
      }
      ctx.fillStyle = `rgba(255,255,255,${clamp(alpha).toFixed(3)})`;
      ctx.fillRect(mote.run.x + x - size / 2, y - size / 2, size, size);
    }

    frame = runs.length || motes.length ? requestAnimationFrame(draw) : 0;
  };

  const observer = new MutationObserver((records) => {
    if (!live.weld) return;
    for (const record of records) {
      const seam = record.target as HTMLElement;
      const { state, axis, side } = seam.dataset;
      if (state !== 'welding' || axis !== 'v' || side !== 'end') continue;
      const box = seam.getBoundingClientRect();
      if (!box.height) continue;
      const now = performance.now();
      if (runs.some((run) => Math.abs(run.x - box.left) < 4 && now - run.started < 400)) continue;
      runs.push({
        seam,
        x: box.left,
        top: box.top,
        length: box.height,
        started: now,
        kind: live.weld,
        spawned: 0
      });
      if (!frame) frame = requestAnimationFrame(draw);
    }
  });
  observer.observe(document.body, { subtree: true, attributes: true, attributeFilter: ['data-state'] });

  return () => {
    cancelAnimationFrame(frame);
    observer.disconnect();
    window.removeEventListener('resize', resize);
  };
}
