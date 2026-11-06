export type SoundKind = 'type' | 'place' | 'pop' | 'start' | 'done';

/** What made a sound: how big it is (√area, px) and where on screen, -1 left to 1 right. */
export type SoundDetail = { size: number; pan: number };

/**
 * The redraw's sound: soft and barely there, synthesized with Web Audio so there is nothing to
 * download. Off by default; the toolbar's speaker turns it on.
 *
 * - start: a low, slow swell as the page goes dark.
 * - pop: a quiet sine plink when a part is finished, at most about three a second, stepping
 *   through a pentatonic scale so overlapping notes stay in key, and placed left or right where
 *   it happened.
 * - done: two soft notes when the page is back.
 * - Typing and items being set down make no sound: with a dozen agents at work it would be a
 *   rattle.
 *
 * Everything runs through one lowpass and a fixed gain into a gentle tanh limiter (a compressor
 * adds its own make-up gain and lets the first hit after silence through boosted), peaking near
 * -15 dB and sitting around -36 dB RMS while drawing: under the page, never over it.
 */

export type SoundChoice = 'soft' | 'off';

/** Anything saved by an earlier version ('1', or one of the old presets) means sound was on. */
export const parseSoundChoice = (value: string | null): SoundChoice =>
  value && value !== 'off' && value !== '0' ? 'soft' : 'off';

const SCALE = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
const LEVEL = 2.9;
const GAP = 0.3;

export class RedrawSound {
  private ctx: AudioContext | null = null;
  private out: AudioNode | null = null;
  private lastPop = -Infinity;
  private step = 2;
  choice: SoundChoice = 'off';

  setChoice(choice: SoundChoice) {
    this.choice = choice;
    if (choice === 'soft' && !this.ctx) this.init();
    if (choice === 'soft') void this.ctx?.resume();
  }

  private init() {
    try {
      const ctx = new AudioContext();
      const warm = ctx.createBiquadFilter();
      warm.type = 'lowpass';
      warm.frequency.value = 6000;
      warm.Q.value = 0.5;
      const level = ctx.createGain();
      level.gain.value = LEVEL;
      const safety = ctx.createWaveShaper();
      const curve = new Float32Array(1024);
      for (let i = 0; i < curve.length; i += 1) {
        curve[i] = Math.tanh(((i / (curve.length - 1)) * 2 - 1) * 1.2) / Math.tanh(1.2);
      }
      safety.curve = curve;
      warm.connect(level).connect(safety).connect(ctx.destination);
      this.ctx = ctx;
      this.out = warm;
    } catch {
      this.choice = 'off';
    }
  }

  play(kind: SoundKind, detail: SoundDetail = { size: 120, pan: 0 }, at?: number) {
    const ctx = this.ctx;
    if (this.choice === 'off' || !ctx) return;
    if (ctx.state !== 'running') {
      // A fresh context can still be waking up; the start and the end are worth waiting for.
      if (kind === 'start' || kind === 'done')
        void ctx.resume().then(() => this.play(kind, detail));
      return;
    }
    const time = at ?? ctx.currentTime;
    if (kind === 'start') {
      this.tone(time, 110, 0.03, 0.35, 1.2);
      this.tone(time, 164.8, 0.018, 0.45, 1.1);
    } else if (kind === 'pop') {
      if (time - this.lastPop < GAP) return;
      this.lastPop = time;
      // A neighbouring note each time: a slow, wandering line rather than random dice.
      this.step = Math.max(
        0,
        Math.min(SCALE.length - 1, this.step + (Math.random() < 0.5 ? -1 : 1))
      );
      this.tone(time, SCALE[this.step], 0.022, 0.01, 0.32, detail.pan);
    } else if (kind === 'done') {
      this.tone(time, SCALE[0], 0.03, 0.02, 0.9);
      this.tone(time + 0.12, SCALE[3], 0.026, 0.02, 1.1);
    }
  }

  private tone(at: number, freq: number, gain: number, attack: number, decay: number, pan = 0) {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    osc.frequency.value = freq;
    const envelope = ctx.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(gain, at + attack);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + attack + decay);
    let node: AudioNode = osc.connect(envelope);
    if (pan && 'createStereoPanner' in ctx) {
      const panner = ctx.createStereoPanner();
      panner.pan.value = Math.max(-0.6, Math.min(0.6, pan * 0.6));
      node = node.connect(panner);
    }
    node.connect(this.out!);
    osc.start(at);
    osc.stop(at + attack + decay + 0.05);
  }

  /** A short taste when the sound is switched on: the swell, a few plinks, the end. */
  preview() {
    const ctx = this.ctx;
    if (this.choice === 'off' || !ctx) return;
    void ctx.resume().then(() => {
      const t = ctx.currentTime + 0.05;
      this.play('start', undefined, t);
      [0.5, 0.85, 1.2].forEach((offset, index) =>
        this.play('pop', { size: 60, pan: -0.4 + index * 0.4 }, t + offset)
      );
      this.play('done', undefined, t + 1.6);
      this.lastPop = -Infinity;
    });
  }

  dispose() {
    void this.ctx?.close();
    this.ctx = null;
    this.out = null;
  }
}
