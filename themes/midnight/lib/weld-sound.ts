import type { WeldKind } from '../components/welds';

/**
 * Sounds for the pipeline, synthesized with the Web Audio API (no files). Every hit of a weld is
 * scheduled in one go on the audio clock, at the same offsets the CSS animation uses, so sound and
 * picture stay locked. The context is created on the click that starts the pipeline, so browsers
 * allow it to play.
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

/** Create or wake the audio context. Call it from a click handler. */
export function unlockAudio() {
  if (typeof window === 'undefined') return;
  const Ctor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
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
  return off;
}

type Nodes = { ctx: AudioContext; out: GainNode; noise: AudioBuffer };
const ready = (): Nodes | null => (!muted && ctx && ctx.state === 'running' && master && noise ? { ctx, out: master, noise } : null);

/** A burst of filtered noise: band-passed, its centre sweeping from `from` to `to` Hz. */
function hiss(n: Nodes, at: number, length: number, peak: number, from: number, to: number, q = 1.2, type: BiquadFilterType = 'bandpass') {
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
function tone(n: Nodes, at: number, length: number, peak: number, from: number, to: number, type: OscillatorType = 'sine') {
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

/** Steady noise, level-wobbling at `rate` Hz by `depth`: a flame's roar rather than a hiss. */
function roar(n: Nodes, at: number, length: number, peak: number, freq: number, rate: number, depth: number, attack = 0.05, release = 0.12) {
  const source = n.ctx.createBufferSource();
  source.buffer = n.noise;
  source.loop = true;
  const filter = n.ctx.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = freq;
  filter.Q.value = 0.7;
  const level = n.ctx.createGain();
  level.gain.setValueAtTime(0.0001, at);
  level.gain.exponentialRampToValueAtTime(peak, at + attack);
  level.gain.setValueAtTime(peak, at + length - release);
  level.gain.exponentialRampToValueAtTime(0.0001, at + length);
  const wobble = n.ctx.createGain();
  wobble.gain.value = 1 - depth;
  const lfo = n.ctx.createOscillator();
  lfo.frequency.value = rate;
  const lfoDepth = n.ctx.createGain();
  lfoDepth.gain.value = depth;
  lfo.connect(lfoDepth).connect(wobble.gain);
  source.connect(filter).connect(level).connect(wobble).connect(n.out);
  source.start(at, Math.random() * 0.5);
  lfo.start(at);
  source.stop(at + length + 0.05);
  lfo.stop(at + length + 0.05);
}

/** Tiny random ticks, like sparks hitting metal. */
function crackle(n: Nodes, at: number, length: number, count: number, peak: number) {
  for (let i = 0; i < count; i++) {
    const t = at + Math.random() * length;
    hiss(n, t, 0.012 + Math.random() * 0.02, peak * (0.4 + Math.random() * 0.6), 2400 + Math.random() * 4000, 1200, 3);
  }
}

/**
 * A rigid plate cracking: a hard transient, a handful of tiny secondary cracks as the fracture runs
 * through, a short grainy crunch and a ring from the plate. No low thump: four of them in a row
 * sounded like a drum.
 * Each tile is a little different (`pitch`), so the four do not sound identical.
 */
export function playTear(delayMs = 0, pitch = 1) {
  const n = ready();
  if (!n) return;
  const t = n.ctx.currentTime + delayMs / 1000 + 0.01;
  hiss(n, t, 0.014, 0.34, 7000 * pitch, 2400, 0.8, 'highpass');
  for (let i = 0; i < 5; i++) {
    hiss(n, t + 0.012 + i * 0.011 + Math.random() * 0.008, 0.01, 0.1 + Math.random() * 0.1, (2600 + Math.random() * 3600) * pitch, 1400, 2.5);
  }
  ring(n, t, 0.28, 0.32, 1180 * pitch, 26);
  ring(n, t, 0.18, 0.22, 2750 * pitch, 32);
}

/** One weld, starting now. Offsets match the CSS in midnight.module.css, which runs 1300ms per tile. */
export function playWeld(kind: WeldKind) {
  const n = ready();
  if (!n) return;
  const now = n.ctx.currentTime + 0.01;

  if (kind === 'torch') {
    // Fine crackle for as long as the bead runs down the seam (260-900ms), then one small tick as it
    // shuts. Everything sits above ~2 kHz and nothing wobbles. The continuous layers (a very high thin
    // hiss, then a light 2.8-4.2 kHz fizz under the crackle) were both removed on request, the fizz as
    // a test: to bring it back, add hiss(n, now + 0.26, 0.66, 0.03, 2800, 4200, 2) before the crackle.
    crackle(n, now + 0.27, 0.62, 28, 0.05);
    hiss(n, now + 0.9, 0.012, 0.09, 3200, 2200, 2);
  } else if (kind === 'spot') {
    // Four zaps, 180ms apart, each a crack and a falling buzz; a heavy clunk when the halves meet.
    for (let i = 0; i < 4; i++) {
      const t = now + 0.15 + i * 0.18;
      hiss(n, t, 0.07, 0.17, 4200, 1400, 1.2);
      tone(n, t, 0.09, 0.07, 1100 - i * 80, 190, 'square');
      crackle(n, t + 0.02, 0.1, 3, 0.05);
    }
  } else if (kind === 'arc') {
    // Electrical crackle while the arcs jump, in short bright bursts with gaps between (no low buzz,
    // which droned like a drum), then a sharp crack as the halves slam shut (520ms).
    [0, 0.07, 0.12, 0.2, 0.26, 0.37, 0.43, 0.49].forEach((offset, i) => {
      hiss(n, now + offset, 0.035 + (i % 3) * 0.012, 0.05, 3400 + (i % 4) * 700, 6200, 1.6);
    });
    crackle(n, now, 0.5, 14, 0.05);
    hiss(n, now + 0.52, 0.12, 0.26, 5200, 800, 0.7);
    crackle(n, now + 0.54, 0.3, 10, 0.08);
  } else {
    // Molten metal: a low pour that climbs with the front (300-800ms), with glugging bubbles.
    roar(n, now + 0.28, 0.58, 0.22, 320, 7, 0.35, 0.08, 0.2);
    hiss(n, now + 0.3, 0.52, 0.05, 220, 420, 1.2, 'lowpass');
    for (let i = 0; i < 8; i++) {
      const t = now + 0.33 + (i / 8) * 0.46 + Math.random() * 0.04;
      const base = 110 + (i / 8) * 150 + Math.random() * 40;
      tone(n, t, 0.07 + Math.random() * 0.04, 0.12, base, base * 2.6);
    }
    crackle(n, now + 0.42, 0.5, 8, 0.04);
  }
}
