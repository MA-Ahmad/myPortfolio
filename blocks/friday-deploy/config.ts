import saved from './blast.json';

/**
 * Every taste decision in the blast, saved from the tuning page at /dev/friday-deploy into
 * `blast.json`. With the same config, including the seed, the blast is the same frame for frame.
 */
export type BlastConfig = {
  seed: number;
  /** From the click to the bang: the progress bar, the cracks and the split. */
  deployMs: number;
  rewindMs: number;
  shardCount: number;
  /** Multiplies the shards' launch speed. */
  shardSpeed: number;
  /** How hard the air slows the shards; higher stops them sooner and closer in. */
  shardDrag: number;
  shardSpin: number;
  /** Spread in depth: how far shards grow toward the viewer or sink behind the page. */
  shardDepth: number;
  /** Seconds before the shards start to fade. */
  shardHold: number;
  /** How wide each crack opens before the bang, in px at `--s: 1`. */
  crackGap: number;
  /** How far the two sides of a crack turn apart, in degrees. */
  crackTwist: number;
  /** How far a crack wanders off a straight line, in px at `--s: 1`. */
  crackJag: number;
  glint: number;
  fireSize: number;
  fireSeconds: number;
  ringReach: number;
  ringSeconds: number;
  smoke: number;
  sparks: number;
  embers: number;
  flash: number;
};

export const BLAST_CONFIG: BlastConfig = saved;

/** A seeded random number generator (mulberry32), so a config always draws the same blast. */
export function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Seconds until nothing of the blast is left to draw. */
export const blastSeconds = (config: BlastConfig) => Math.max(2.6, config.shardHold + 1.4);
