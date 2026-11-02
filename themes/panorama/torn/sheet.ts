import { tearOf, type Point } from './tear';

/** A seam is torn open, being welded, welded shut with a faint scar left, or tearing apart again. */
export type SeamState = 'torn' | 'welding' | 'welded' | 'tearing';

export type Seam = {
  seed: number;
  /** The tear down a vertical seam (side by side sections) and across a horizontal one (stacked). */
  v: Point[];
  h: Point[];
};

/** How far each torn edge stands back from its seam's centre line, px: the gap is twice this. */
export const GAP = 6;

/** Tearing is sudden: the seam springs open in this long, on a strong ease-out. */
export const TEAR_MS = 260;
export const openingAt = (t: number) => 1 - (1 - Math.max(0, Math.min(1, t / TEAR_MS))) ** 3;

/**
 * The sheet the sections are cut from: one seam between each pair of neighbours, and the state of
 * each. The pieces read it with useSyncExternalStore; SheetRunner moves it as sections open.
 */
export function createSheet(count: number) {
  const seams: Seam[] = Array.from({ length: count - 1 }, (_, i) => {
    const seed = 11 + i * 17;
    return { seed, v: tearOf(seed), h: tearOf(seed + 5, 760) };
  });
  const initial: SeamState[] = seams.map(() => 'torn');
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
    get: () => states,
    getInitial: () => initial,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    set(index: number, state: SeamState) {
      const now = performance.now();
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
      states = initial;
      notify();
    }
  };
}

export type Sheet = ReturnType<typeof createSheet>;
