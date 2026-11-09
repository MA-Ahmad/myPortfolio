import type { WeldKind } from './welds';

/**
 * Sounds for the torn panels, synthesized with the Web Audio API (no files). Every hit of a weld is
 * scheduled in one go on the audio clock, at the same offsets the CSS animation uses, so sound and
 * picture stay locked. Adapted from the Midnight
 * theme's weld sounds, with one more for the snap weld.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let noise: AudioBuffer | null = null;
let muted = false;
const LEVEL = 0.55;

export const isMuted = () => muted;

/** Silence everything now, including sounds already scheduled; or let it through again. */
export function setMuted(value: boolean) {
  muted = value;
  if (ctx && master) {
    master.gain.cancelScheduledValues(ctx.currentTime);
    master.gain.setTargetAtTime(value ? 0 : LEVEL, ctx.currentTime, 0.015);
  }
}

/**
 * Create or wake the audio context. Call it from a click handler.
 *
 * Never inside a frame: the Theme Studio loads this page ahead, hidden in a frame, while its
 * display grows into a screen, and that copy must stay silent.
 */
export function unlockAudio() {
  if (typeof window === 'undefined' || window.self !== window.top) return;
  const Ctor =
    window.AudioContext ||
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return;
  if (!ctx) {
    ctx = new Ctor();
    master = ctx.createGain();
    master.gain.value = muted ? 0 : LEVEL;
    // A gentle limiter, so the loudest hits (the crack, the arc) never clip when layers stack.
    const limiter = ctx.createDynamicsCompressor();
    limiter.threshold.value = -12;
    limiter.knee.value = 8;
    limiter.ratio.value = 8;
    limiter.attack.value = 0.002;
    limiter.release.value = 0.12;
    master.connect(limiter).connect(ctx.destination);
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = noise.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  }
  if (ctx.state === 'suspended') void ctx.resume();
}

/**
 * Sound is on by default, but browsers only let audio start after a visit has had a click, tap or
 * key press. Try straight away (this works when the visitor just clicked through to this page) and
 * otherwise wake the context on the first gesture anywhere, so the sounds start with the first
 * interaction instead of waiting for a click on the tiles.
 *
 * The returned cleanup belongs to the page: it stops listening and closes the audio context, so
 * hits already scheduled on the audio clock don't carry on playing on the next page.
 */
export function armAudio() {
  if (typeof window === 'undefined') return () => {};
  unlockAudio();
  const events = ['pointerdown', 'keydown', 'touchend'] as const;
  const wake = () => {
    unlockAudio();
    if (ctx && ctx.state === 'running') off();
  };
  const off = () => events.forEach((event) => window.removeEventListener(event, wake, true));
  events.forEach((event) => window.addEventListener(event, wake, true));
  return () => {
    off();
    releaseAudio();
  };
}

/** Close the audio context and drop everything scheduled on it. The next unlock starts afresh. */
function releaseAudio() {
  const closing = ctx;
  ctx = null;
  master = null;
  noise = null;
  if (closing && closing.state !== 'closed') void closing.close();
}

type Nodes = { ctx: AudioContext; out: GainNode; noise: AudioBuffer };
const ready = (): Nodes | null =>
  !muted && ctx && ctx.state === 'running' && master && noise ? { ctx, out: master, noise } : null;

/** A burst of filtered noise: band-passed, its centre sweeping from `from` to `to` Hz. */
function hiss(
  n: Nodes,
  at: number,
  length: number,
  peak: number,
  from: number,
  to: number,
  q = 1.2,
  type: BiquadFilterType = 'bandpass'
) {
  const source = n.ctx.createBufferSource();
  source.buffer = n.noise;
  source.loop = true;
  const filter = n.ctx.createBiquadFilter();
  filter.type = type;
  filter.Q.value = q;
  filter.frequency.setValueAtTime(from, at);
  filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), at + length);
  const gain = n.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + Math.min(0.02, length / 4));
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(gain).connect(n.out);
  source.start(at, Math.random() * 0.5);
  source.stop(at + length + 0.05);
}

/** A tone whose pitch glides from `from` to `to` Hz while its level decays. */
function tone(
  n: Nodes,
  at: number,
  length: number,
  peak: number,
  from: number,
  to: number,
  type: OscillatorType = 'sine'
) {
  const osc = n.ctx.createOscillator();
  osc.type = type;
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(Math.max(20, to), at + length);
  const gain = n.ctx.createGain();
  gain.gain.setValueAtTime(0.0001, at);
  gain.gain.exponentialRampToValueAtTime(peak, at + 0.006);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  osc.connect(gain).connect(n.out);
  osc.start(at);
  osc.stop(at + length + 0.05);
}

/** A ringing resonance, like a struck plate: a narrow band-pass excited by a short click. */
function ring(n: Nodes, at: number, length: number, peak: number, freq: number, q = 30) {
  const source = n.ctx.createBufferSource();
  source.buffer = n.noise;
  const filter = n.ctx.createBiquadFilter();
  filter.type = 'bandpass';
  filter.frequency.value = freq;
  filter.Q.value = q;
  const gain = n.ctx.createGain();
  gain.gain.setValueAtTime(peak, at);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + length);
  source.connect(filter).connect(gain).connect(n.out);
  source.start(at, Math.random() * 0.5);
  source.stop(at + 0.012);
  // The click only lasts a few ms; the filter's own ringing carries the tail.
}

/** Tiny random ticks, like sparks hitting metal. */
function crackle(n: Nodes, at: number, length: number, count: number, peak: number) {
  for (let i = 0; i < count; i++) {
    const t = at + Math.random() * length;
    hiss(
      n,
      t,
      0.012 + Math.random() * 0.02,
      peak * (0.4 + Math.random() * 0.6),
      2400 + Math.random() * 4000,
      1200,
      3
    );
  }
}

/**
 * A rigid plate cracking: a hard transient, a handful of tiny secondary cracks as the fracture runs
 * through, a short grainy crunch and a ring from the plate. No low thump: four of them in a row
 * sounded like a drum.
 * `pitch` lets callers vary it, so repeated tears do not sound identical.
 */
export function playTear(delayMs = 0, pitch = 1) {
  const n = ready();
  if (!n) return;
  const t = n.ctx.currentTime + delayMs / 1000 + 0.01;
  hiss(n, t, 0.014, 0.34, 7000 * pitch, 2400, 0.8, 'highpass');
  for (let i = 0; i < 5; i++) {
    hiss(
      n,
      t + 0.012 + i * 0.011 + Math.random() * 0.008,
      0.01,
      0.1 + Math.random() * 0.1,
      (2600 + Math.random() * 3600) * pitch,
      1400,
      2.5
    );
  }
  ring(n, t, 0.28, 0.32, 1180 * pitch, 26);
  ring(n, t, 0.18, 0.22, 2750 * pitch, 32);
}

/** One weld, starting now. Offsets match the keyframes in torn.module.css, which run WELD_MS (1400ms). */
export function playWeld(kind: WeldKind) {
  const n = ready();
  if (!n) return;
  const now = n.ctx.currentTime + 0.01;

  if (kind === 'torch') {
    // Fine crackle for as long as the bead runs down the seam (150-1000ms), then one small tick.
    crackle(n, now + 0.15, 0.85, 46, 0.05);
    hiss(n, now + 1.0, 0.012, 0.09, 3200, 2200, 2);
  } else if (kind === 'spot') {
    // Seven zaps 120ms apart, each a crack and a falling buzz.
    for (let i = 0; i < 7; i++) {
      const t = now + 0.12 + i * 0.12;
      hiss(n, t, 0.06, 0.15, 4200, 1400, 1.2);
      tone(n, t, 0.08, 0.06, 1100 - i * 60, 220, 'square');
      crackle(n, t + 0.02, 0.08, 3, 0.05);
    }
  } else if (kind === 'arc') {
    // Short bright bursts while the arcs jump, then a sharp crack as the halves slam shut (560ms).
    [0, 0.07, 0.12, 0.2, 0.26, 0.37, 0.43, 0.5].forEach((offset, i) => {
      hiss(n, now + offset, 0.035 + (i % 3) * 0.012, 0.05, 3400 + (i % 4) * 700, 6200, 1.6);
    });
    crackle(n, now, 0.54, 14, 0.05);
    hiss(n, now + 0.56, 0.12, 0.26, 5200, 800, 0.7);
    crackle(n, now + 0.58, 0.3, 10, 0.08);
  } else if (kind === 'molten') {
    // A soft pour that climbs with the front (200-1000ms), with bubbles rising in pitch. No level
    // wobble: a pulsing roar read as a drum roll.
    hiss(n, now + 0.2, 0.8, 0.08, 260, 520, 1.1, 'lowpass');
    for (let i = 0; i < 9; i++) {
      const t = now + 0.22 + (i / 9) * 0.74 + Math.random() * 0.04;
      const base = 120 + (i / 9) * 160 + Math.random() * 40;
      tone(n, t, 0.07 + Math.random() * 0.04, 0.1, base, base * 2.6);
    }
    crackle(n, now + 0.4, 0.55, 8, 0.04);
  } else {
    // Snap: a charge that rises as the pieces are pulled in (280-520ms), a bright clack as they
    // meet, and the ripple settling. No low thump.
    hiss(n, now + 0.06, 0.46, 0.03, 900, 5200, 1.2);
    hiss(n, now + 0.52, 0.016, 0.3, 6400, 2400, 0.8, 'highpass');
    ring(n, now + 0.52, 0.16, 0.2, 1650, 22);
    ring(n, now + 0.52, 0.1, 0.14, 3100, 30);
    hiss(n, now + 0.54, 0.45, 0.025, 2400, 900, 0.8, 'lowpass');
  }
}

/**
 * A stick-welding arc for as long as it burns: the steady frying crackle of the arc (band-passed
 * noise whose level jitters) over a faint mains-like buzz, with sharp spatter pops scheduled as
 * `pop` is called. `stop` fades it out. Silent, and a no-op, while sound is off.
 */
export function startArc() {
  const n = ready();
  if (!n) return { pop: () => {}, flutter: () => {}, stop: () => {} };
  const now = n.ctx.currentTime;
  const out = n.ctx.createGain();
  out.gain.setValueAtTime(0.0001, now);
  out.gain.exponentialRampToValueAtTime(1, now + 0.04);
  out.connect(n.out);

  const fry = n.ctx.createBufferSource();
  fry.buffer = n.noise;
  fry.loop = true;
  const band = n.ctx.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 3200;
  band.Q.value = 0.55;
  const fryGain = n.ctx.createGain();
  fryGain.gain.value = 0.07;
  fry.connect(band).connect(fryGain).connect(out);
  fry.start(now, Math.random() * 0.5);

  const hum = n.ctx.createOscillator();
  hum.type = 'sawtooth';
  hum.frequency.value = 100;
  const humFilter = n.ctx.createBiquadFilter();
  humFilter.type = 'lowpass';
  humFilter.frequency.value = 420;
  const humGain = n.ctx.createGain();
  humGain.gain.value = 0.018;
  hum.connect(humFilter).connect(humGain).connect(out);
  hum.start(now);

  let stopped = false;
  return {
    /** The arc's level wavers as its length changes. Call every frame. */
    flutter() {
      if (stopped) return;
      fryGain.gain.setTargetAtTime(0.04 + Math.random() * 0.07, n.ctx.currentTime, 0.012);
    },
    /** A spatter pop: a short, bright crack. */
    pop() {
      if (stopped) return;
      const t = n.ctx.currentTime + 0.005;
      hiss(
        n,
        t,
        0.012 + Math.random() * 0.02,
        0.05 + Math.random() * 0.07,
        3000 + Math.random() * 4500,
        1600,
        2.5
      );
    },
    stop() {
      if (stopped) return;
      stopped = true;
      const t = n.ctx.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setValueAtTime(out.gain.value || 1, t);
      out.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      fry.stop(t + 0.1);
      hum.stop(t + 0.1);
    }
  };
}
