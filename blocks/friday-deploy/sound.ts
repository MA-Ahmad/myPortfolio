/**
 * The blast's sound, synthesized with Web Audio, so there are no files to ship: a rising whine
 * while the key charges, a boom (noise through a closing filter, a falling sub thump, a crackle
 * and tinkling glass), and for the rollback the same boom played backwards, ending in the click
 * of the key snapping back together.
 *
 * The boom is rendered once into a buffer so it can be reversed. Nothing is created until sound
 * is first switched on, which is always a click, so browsers allow it to play.
 */

export type Sound = {
  /** Call from the click that turns sound on. */
  enable(): void;
  disable(): void;
  charge(seconds: number): void;
  boom(): void;
  rewind(seconds: number): void;
  dispose(): void;
};

const BOOM_SECONDS = 1.8;

function noise(ac: BaseAudioContext, seconds: number) {
  const buffer = ac.createBuffer(1, Math.ceil(ac.sampleRate * seconds), ac.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const source = ac.createBufferSource();
  source.buffer = buffer;
  return source;
}

function envelope(ac: BaseAudioContext, at: number, peak: number, decay: number) {
  const gain = ac.createGain();
  gain.gain.setValueAtTime(0, at);
  gain.gain.linearRampToValueAtTime(peak, at + 0.005);
  gain.gain.exponentialRampToValueAtTime(0.0001, at + decay);
  return gain;
}

function buildBoom(ac: BaseAudioContext, out: AudioNode) {
  // The body: white noise through a low-pass that closes, so it starts as a crack and ends a rumble.
  const body = noise(ac, BOOM_SECONDS);
  const lowpass = ac.createBiquadFilter();
  lowpass.type = 'lowpass';
  lowpass.frequency.setValueAtTime(4200, 0);
  lowpass.frequency.exponentialRampToValueAtTime(160, 0.9);
  body
    .connect(lowpass)
    .connect(envelope(ac, 0, 0.9, 1.6))
    .connect(out);
  body.start(0);

  // The thump you feel more than hear.
  const thump = ac.createOscillator();
  thump.frequency.setValueAtTime(120, 0);
  thump.frequency.exponentialRampToValueAtTime(34, 0.4);
  thump.connect(envelope(ac, 0, 1, 0.8)).connect(out);
  thump.start(0);
  thump.stop(0.85);

  const crackle = noise(ac, 0.4);
  const highpass = ac.createBiquadFilter();
  highpass.type = 'highpass';
  highpass.frequency.value = 2200;
  crackle
    .connect(highpass)
    .connect(envelope(ac, 0, 0.35, 0.25))
    .connect(out);
  crackle.start(0);

  // Glass: short bright pings, scattered in time and across the stereo field.
  for (let i = 0; i < 16; i++) {
    const at = 0.02 + Math.random() * 0.75;
    const ping = ac.createOscillator();
    ping.type = 'triangle';
    ping.frequency.value = 2400 + Math.random() * 4800;
    const pan = ac.createStereoPanner();
    pan.pan.value = Math.random() * 1.6 - 0.8;
    ping
      .connect(envelope(ac, at, 0.03 + Math.random() * 0.05, 0.08 + Math.random() * 0.14))
      .connect(pan)
      .connect(out);
    ping.start(at);
    ping.stop(at + 0.25);
  }
}

export function createSound(): Sound {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let boom: AudioBuffer | null = null;
  let reversed: AudioBuffer | null = null;
  let on = false;

  const render = async () => {
    const rate = 44100;
    const offline = new OfflineAudioContext(2, Math.ceil(rate * BOOM_SECONDS), rate);
    buildBoom(offline, offline.destination);
    boom = await offline.startRendering();
    reversed = new AudioBuffer({ numberOfChannels: 2, length: boom.length, sampleRate: rate });
    for (let c = 0; c < 2; c++) reversed.copyToChannel(boom.getChannelData(c).slice().reverse(), c);
  };

  const ready = () => {
    if (!on || !ac || !master) return null;
    return { ac, master };
  };

  const play = (buffer: AudioBuffer | null, offset = 0) => {
    const live = ready();
    if (!live || !buffer) return;
    const source = live.ac.createBufferSource();
    source.buffer = buffer;
    source.connect(live.master);
    source.start(0, offset);
  };

  return {
    enable() {
      on = true;
      if (ac) {
        void ac.resume();
        return;
      }
      ac = new AudioContext();
      master = ac.createGain();
      master.gain.value = 0.6;
      const limiter = ac.createDynamicsCompressor();
      master.connect(limiter).connect(ac.destination);
      void render();
    },

    charge(seconds) {
      const live = ready();
      if (!live) return;
      const { ac, master } = live;
      const now = ac.currentTime;
      const whine = ac.createOscillator();
      whine.type = 'sawtooth';
      whine.frequency.setValueAtTime(70, now);
      whine.frequency.exponentialRampToValueAtTime(340, now + seconds);
      const filter = ac.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(300, now);
      filter.frequency.exponentialRampToValueAtTime(2600, now + seconds);
      const gain = ac.createGain();
      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.07, now + seconds * 0.8);
      gain.gain.linearRampToValueAtTime(0, now + seconds);
      whine.connect(filter).connect(gain).connect(master);
      whine.start(now);
      whine.stop(now + seconds + 0.05);
    },

    disable() {
      on = false;
      void ac?.suspend();
    },

    boom() {
      play(boom);
    },

    rewind(seconds) {
      if (!reversed) return;
      // Start late enough that the reversed bang lands as the key snaps back.
      play(reversed, Math.max(0, reversed.duration - seconds));
      const live = ready();
      if (!live) return;
      const { ac, master } = live;
      const at = ac.currentTime + seconds;
      const click = ac.createOscillator();
      click.frequency.setValueAtTime(1100, at);
      click.frequency.exponentialRampToValueAtTime(420, at + 0.04);
      click.connect(envelope(ac, at, 0.25, 0.06)).connect(master);
      click.start(at);
      click.stop(at + 0.08);
    },

    dispose() {
      on = false;
      void ac?.close();
    }
  };
}
