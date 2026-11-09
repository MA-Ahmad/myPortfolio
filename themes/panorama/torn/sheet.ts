import { TEAR_H, tearOf, type Point } from './tear';

/**
 * A seam is torn open, being welded, welded shut with a faint scar left, or tearing apart again.
 * Every seam starts sealed: the sheet is whole, with no scar, until it first cracks open on load.
 */
export type SeamState = 'sealed' | 'torn' | 'welding' | 'welded' | 'tearing';

export type Seam = {
  seed: number;
  /** The tear down a vertical seam (side by side sections) and across a horizontal one (stacked). */
  v: Point[];
  h: Point[];
};

/** How far each torn edge stands back from its seam's centre line, px: the gap is twice this. */
export const GAP = 3;
/** A hand-laid bead is kept in steps this long along the seam, px. */
export const BIN = 2.5;

/** Tearing is sudden: the seam springs open in this long, on a strong ease-out. */
export const TEAR_MS = 260;
export const openingAt = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t / TEAR_MS))) ** 3;

/**
 * The first tear, on load, is slow: a hairline crack runs open, holds a beat under strain, then the
 * pieces ease apart to the full gap.
 */
export const INTRO_TEAR_MS = 1500;
const CRACK_MS = 420;
const STRAIN_MS = 220;
const HAIRLINE = 0.2;
const STRAINED = 0.25;
const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export function introAt(t: number) {
  if (t < CRACK_MS) return HAIRLINE * (1 - (1 - clamp01(t / CRACK_MS)) ** 3);
  if (t < CRACK_MS + STRAIN_MS)
    return HAIRLINE + (STRAINED - HAIRLINE) * ((t - CRACK_MS) / STRAIN_MS);
  const x = clamp01((t - CRACK_MS - STRAIN_MS) / (INTRO_TEAR_MS - CRACK_MS - STRAIN_MS));
  const eased = x < 0.5 ? 4 * x ** 3 : 1 - (-2 * x + 2) ** 3 / 2;
  return STRAINED + (1 - STRAINED) * eased;
}

/**
 * The sheet the sections are cut from: one seam between each pair of neighbours, and the state of
 * each. The pieces read it with useSyncExternalStore; SheetRunner moves it as sections open.
 */
export function createSheet(count: number) {
  const seams: Seam[] = Array.from({ length: count - 1 }, (_, i) => {
    const seed = 11 + i * 17;
    return { seed, v: tearOf(seed), h: tearOf(seed + 5, 760) };
  });
  const initial: SeamState[] = seams.map(() => 'sealed');
  let states = initial;
  /** When each seam started welding or tearing, on the performance clock, so every part keys off one time. */
  const started = seams.map(() => 0);
  /**
   * How far into its weld a seam was when it started tearing (ms), or null if it was shut, so the
   * tear opens from the gap the weld had reached instead of snapping shut first.
   */
  const from: (number | null)[] = seams.map(() => null);
  /**
   * Where along each seam its weld starts (px), or null for where its kind of weld always starts.
   * A seam clicked at a point welds out from there; `aim` sets it for the seam's next weld only.
   */
  const origin: (number | null)[] = seams.map(() => null);
  const aims: (number | null)[] = seams.map(() => null);
  /**
   * How far a welded seam had been pulled open at each point along it (0 to 1 of the gap) when it
   * was let go past tearing, or null; the tear then opens from that crack.
   */
  const crack: (((along: number) => number) | null)[] = seams.map(() => null);
  /** How long each seam's current tear takes: TEAR_MS, or INTRO_TEAR_MS for the first one on load. */
  const spans = seams.map(() => TEAR_MS);
  /**
   * A bead welded by hand along each seam, or null: for each 2.5px of the seam, when it was welded
   * (performance clock), or 0 if it hasn't been yet. Kept while the seam stays shut, so the weld
   * stays where it was laid; cleared when the seam tears again.
   */
  const beads: (Float64Array | null)[] = seams.map(() => null);
  /** Set when a seam has just been welded shut by hand, so it shuts at once with no weld played. */
  const byHand: boolean[] = seams.map(() => false);
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((listener) => listener());

  return {
    count,
    seams,
    started,
    from,
    origin,
    crack,
    aim(index: number, along: number) {
      aims[index] = along;
    },
    /** Sets how far a seam was pulled open along its length, for its next tear to open from. */
    pulled(index: number, at: (along: number) => number) {
      crack[index] = at;
    },
    aimed: (index: number) => aims[index] !== null,
    /** The seam's hand-laid bead; with `create`, made on first use. */
    bead(index: number, create = false) {
      if (create && !beads[index]) beads[index] = new Float64Array(Math.ceil(TEAR_H / BIN));
      return beads[index];
    },
    /** Marks the seam as welded shut by hand, for the runner to close it without playing a weld. */
    weldedByHand(index: number) {
      byHand[index] = true;
    },
    takeByHand(index: number) {
      const was = byHand[index];
      byHand[index] = false;
      return was;
    },
    /** How long the seam's tear takes, ms. */
    span: (index: number) => spans[index],
    /** Whether the seam is (or last was) on its first, slow tear. */
    intro: (index: number) => spans[index] === INTRO_TEAR_MS,
    /** How far open the seam's tear is `t` ms in, 0 to 1. */
    opening: (index: number, t: number) =>
      spans[index] === INTRO_TEAR_MS ? introAt(t) : openingAt(t),
    get: () => states,
    getInitial: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(index: number, state: SeamState, span = TEAR_MS) {
      const now = performance.now();
      if (state === 'tearing') spans[index] = span;
      if (state === 'tearing') beads[index] = null;
      if (state === 'tearing')
        from[index] = states[index] === 'welding' ? now - started[index] : null;
      if (state === 'welding' || state === 'tearing') started[index] = now;
      if (state !== 'tearing') crack[index] = null;
      if (state === 'welding') {
        origin[index] = aims[index];
        aims[index] = null;
      }
      states = states.map((value, i) => (i === index ? state : value));
      notify();
    },
    reset() {
      aims.fill(null);
      crack.fill(null);
      beads.fill(null);
      byHand.fill(false);
      spans.fill(TEAR_MS);
      states = initial;
      notify();
    }
  };
}

export type Sheet = ReturnType<typeof createSheet>;
