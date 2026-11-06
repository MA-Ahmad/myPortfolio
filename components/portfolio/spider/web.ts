import type { Vec } from './art';

/**
 * An orb web for a w×h box, in the box's own coordinates, built the way an orb weaver
 * spins one and fitted inside the box (nothing runs out to the box edges):
 *
 * 1. the frame: the outer thread around the rim, laid first,
 * 2. radials from the frame in to the hub and back out (rim → hub → next rim), stepping
 *    along the frame between pairs so each radial is spun once,
 * 3. the hub: a small, tight, irregular mesh,
 * 4. a free zone, then the capture spiral from the outside in, each turn sagging a little
 *    between radials,
 * 5. back to the hub, where the spider settles head-down.
 *
 * The weave animation replays that walk: the spider follows `steps`, and each layer's path
 * is grown step by step (`cmd`). Everything comes from `seed`, so a web is reproducible.
 */

export type Layer = 'radial' | 'frame' | 'hub' | 'spiral';
export const LAYERS: Layer[] = ['radial', 'frame', 'hub', 'spiral'];

export type Step = {
  a: Vec;
  b: Vec;
  c?: Vec; // quadratic control point (sagging spiral threads)
  len: number;
  layer: Layer | null; // null: walking along silk that is already there
  move: boolean; // starts a new subpath in its layer
};

export type WebPlan = {
  steps: Step[];
  start: Vec; // where the spider begins: on the rim
  total: number;
  hub: Vec;
  d: Record<Layer, string>;
  dew: Array<[number, number, number]>; // x, y, r
};

const PAD = 6;

function random(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lerp = (a: Vec, b: Vec, f: number): Vec => [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
const dist = (a: Vec, b: Vec) => Math.hypot(b[0] - a[0], b[1] - a[1]);
const fmt = (p: Vec) => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`;

/** Point `f` of the way along a step (on the curve when it sags). */
export function pointAt(step: Step, f: number): Vec {
  if (!step.c) return lerp(step.a, step.b, f);
  return lerp(lerp(step.a, step.c, f), lerp(step.c, step.b, f), f);
}

/** The path command for the first `f` of a step (de Casteljau split for curves). */
export function cmd(step: Step, f = 1) {
  const head = step.move ? `M${fmt(step.a)}` : '';
  const end = f >= 1 ? step.b : pointAt(step, f);
  if (!step.c) return `${head}L${fmt(end)}`;
  return `${head}Q${fmt(lerp(step.a, step.c, f))} ${fmt(end)}`;
}

export function buildWeb(w: number, h: number, seed: number): WebPlan {
  const rand = random(seed);
  const jitter = (amount: number) => (rand() - 0.5) * 2 * amount;

  // Orbs sit a touch above centre and are a little wider than tall in a wide box.
  const hub: Vec = [w / 2 + jitter(w * 0.06), h / 2 - h * 0.03 + jitter(h * 0.04)];
  const base = Math.min(w, h) / 2 - PAD;
  const rx = Math.min(base * clampNum(w / h, 1, 1.35), hub[0] - PAD, w - PAD - hub[0]);
  const ry = Math.min(base * clampNum(h / w, 1, 1.2), hub[1] - PAD, h - PAD - hub[1]);
  const size = Math.min(rx, ry);

  // Even, so radials pair up rim → hub → rim.
  const n = clampNum(Math.round((Math.PI * (rx + ry)) / 24), 14, 32) & ~1;
  const offset = rand() * Math.PI * 2;
  const angles = Array.from({ length: n }, (_, i) => offset + ((i + jitter(0.28)) / n) * Math.PI * 2);
  const ellipse = (t: number) =>
    (rx * ry) / Math.hypot(ry * Math.cos(t), rx * Math.sin(t));
  const lengths = angles.map((t) => ellipse(t) * (0.9 + rand() * 0.1));
  const along = (i: number, r: number): Vec => [
    hub[0] + Math.cos(angles[i]) * r,
    hub[1] + Math.sin(angles[i]) * r
  ];
  const rim = angles.map((_, i) => along(i, lengths[i]));

  const steps: Step[] = [];
  let at: Vec = rim[0];
  const go = (b: Vec, layer: Layer | null, c?: Vec) => {
    const prev = steps[steps.length - 1];
    const len = c ? (dist(at, c) + dist(c, b) + dist(at, b)) / 2 : dist(at, b);
    if (len < 0.01) return;
    steps.push({ a: at, b, c, len, layer, move: !prev || prev.layer !== layer || prev.b !== at });
    at = b;
  };

  // 1. frame around the rim, outside first
  for (let i = 1; i <= n; i++) go(rim[i % n], 'frame');

  // 2. radials in pairs: rim → hub → next rim, then along the frame to the next pair
  for (let i = 0; i < n; i += 2) {
    if (i > 0) go(rim[i], null);
    go(hub, 'radial');
    go(rim[i + 1], 'radial');
  }
  go(hub, null);

  // 3. hub mesh
  const hubR = clampNum(size * 0.09, 4, 12);
  go(along(0, hubR * 0.3), null);
  const hubTurns = 3;
  for (let k = 1; k <= hubTurns * n; k++) {
    const i = k % n;
    go(along(i, hubR * (0.3 + (0.7 * k) / (hubTurns * n)) * (1 + jitter(0.15))), 'hub');
  }

  // 4. capture spiral, outside in, past a free zone around the hub
  const inner = hubR * 2.4;
  const outerFor = (i: number) => lengths[i] * 0.93;
  const spacing = clampNum(size / 16, 5, 9);
  const turns = clampNum(Math.round((size * 0.93 - inner) / spacing), 4, 22);
  const count = turns * n;
  go(along(0, outerFor(0)), null);
  for (let k = 1; k <= count; k++) {
    const i = k % n;
    const f = k / count;
    const r = outerFor(i) - (outerFor(i) - inner) * f;
    const b = along(i, Math.max(inner, r + jitter(spacing * 0.12)));
    // Each thread bows a little towards the hub between its two radials.
    const mid = lerp(at, b, 0.5);
    const c = lerp(mid, hub, 0.035);
    go(b, 'spiral', c);
  }

  // 5. home to the hub
  go(hub, null);

  const d = { radial: '', frame: '', hub: '', spiral: '' } as Record<Layer, string>;
  for (const step of steps) if (step.layer) d[step.layer] += cmd(step);

  // A few drops of dew caught on the capture threads.
  const spiralSteps = steps.filter((s) => s.layer === 'spiral');
  const dew = Array.from({ length: Math.round(spiralSteps.length / 14) }, () => {
    const step = spiralSteps[Math.floor(rand() * spiralSteps.length)];
    const [x, y] = pointAt(step, rand());
    return [x, y, 0.5 + rand() * 0.7] as [number, number, number];
  });

  return { steps, start: rim[0], total: steps.reduce((t, s) => t + s.len, 0), hub, d, dew };
}

function clampNum(v: number, lo: number, hi: number) {
  return Math.min(hi, Math.max(lo, v));
}
