import { flushSync } from 'react-dom';
import { type TimeOfDay, pickTime, timeAt } from '../time';

/**
 * Peeling the sheet off by its top left corner to the other time of day: night comes away to show
 * the day under it, and day to show the night. The pull (peel.tsx) lifts the corner by hand; let
 * go far enough, this carries the fold on across the whole sheet.
 *
 * It is a view transition in three layers, bottom to top: the new sheet, still; the turned-over
 * flap, a lit band that rides the fold; and the old sheet, cut back along the fold. The flap only
 * ever moves by a transform, which the compositor runs by itself, so the fold keeps its pace
 * whatever the page is doing; the old sheet's cut is the one shape that changes. Both are keyed
 * from one list of frames, so they cannot drift apart. The page round the sheet cross-fades.
 */

/** What the sheet's underside looks like, lit at the fold and falling off, and what a lifted corner shows. */
export const PEEL_TONES = {
  night: { flap: ['#7b8497', '#323845', '#1a1d25'], under: '#e6edf4' },
  day: { flap: ['#ffffff', '#ebe6de', '#c9c2b6'], under: '#0c0d11' }
} as const;

export const tonesOf = (time: TimeOfDay) => PEEL_TONES[time === 'night' ? 'night' : 'day'];

/** The time of day under the sheet: by night the day it is (or an afternoon), by day the night. */
export function underneath(time: TimeOfDay): TimeOfDay {
  if (time !== 'night') return 'night';
  const now = timeAt(new Date());
  return now === 'night' ? 'afternoon' : now;
}

const SHEET = 'panorama-sheet';
const UNDER = 'panorama-sheet-under';
const FLAP = 'panorama-flap';
const THREADS = 'panorama-threads';
const DURATION_MS = 1050;
const FRAMES = 64;
/**
 * How the fold's speed runs over the peel. It leaves at the speed the hand let it go at, picks up
 * over this share of the time, and from the start is also falling off toward the far corner (the
 * higher the power, the earlier it slows). Leaving at full speed instead put a quarter of the sheet
 * behind it in the first 100ms, from a standstill: a jump, not a peel.
 */
const PICK_UP = 0.42;
const FALL_OFF = 1.3;
/** The slowest and fastest the fold may leave at, px/s of x + y: never dead still, never a lurch. */
const LEAVE = { min: 120, max: 2600 };
/** The curve is worked out at this many steps and read off at each frame. */
const STEPS = 400;
/** How wide the turned-over flap settles to as the fold runs, in px of x + y. */
const FLAP_WIDE = 150;
/** How deep the band the flap is drawn on is, px: enough for the deepest corner the pull can lift. */
const BAND = 180;
const FAR = 20000;

let running = false;
export const peeling = () => running;

/**
 * How far along the fold is (0 to 1) at each of FRAMES + 1 moments, for a fold that leaves at
 * `speed` px/s and has `travel` px to go. The speed is the pick-up times the fall-off; the
 * pick-up's starting level is found so that the first moment's speed is `speed`.
 */
function progress(speed: number, travel: number) {
  const want = (Math.min(LEAVE.max, Math.max(LEAVE.min, speed)) * DURATION_MS) / 1000 / travel;
  const shape = new Float64Array(STEPS + 1);
  let level = 0.05;
  let total = 1;
  for (let pass = 0; pass < 8; pass++) {
    total = 0;
    for (let i = 0; i <= STEPS; i++) {
      const p = i / STEPS;
      const up = Math.min(1, p / PICK_UP);
      shape[i] = (level + (1 - level) * up * up * (3 - 2 * up)) * (1 - p) ** FALL_OFF;
      if (i) total += (shape[i] + shape[i - 1]) / 2 / STEPS;
    }
    // The first moment's speed, as a share of the whole travel per whole duration, is level / total.
    level = Math.min(1, Math.max(0.01, want * total));
  }
  const at = new Float64Array(FRAMES + 1);
  let done = 0;
  for (let i = 1, frame = 1; i <= STEPS; i++) {
    done += (shape[i] + shape[i - 1]) / 2 / STEPS / total;
    while (frame <= FRAMES && i >= (frame / FRAMES) * STEPS) at[frame++] = Math.min(1, done);
  }
  at[FRAMES] = 1;
  return at;
}

/**
 * Carries a corner lifted to `fold` (the fold line is x + y = fold, px from the sheet's own top
 * left, `inset` in from `sheet`'s) on across the sheet, to `next`, starting at the `speed` (px/s of
 * x + y) the hand was lifting it at when it let go. `flap` is the element the band
 * is drawn in and `threads` the layer the pull's threads are on, which fades off. `before` runs
 * just ahead of the new sheet's snapshot, to clear the hand-drawn fold away. Without view
 * transitions, or mid-transition, the time just changes.
 */
export async function peelTo(
  sheet: HTMLElement,
  flap: HTMLElement,
  threads: SVGElement,
  inset: number,
  fold: number,
  speed: number,
  from: TimeOfDay,
  next: TimeOfDay,
  before: () => void
) {
  if (running || !document.startViewTransition) {
    before();
    return flushSync(() => pickTime(next));
  }

  running = true;
  const root = document.documentElement;
  // Measured before anything is written, so nothing is laid out twice on the way to the first frame.
  const box = sheet.getBoundingClientRect();
  const width = box.width - 2 * inset;
  const height = box.height - inset;
  // The band lies across the flap's layer and is turned onto the fold; scaled up where the sheet
  // is too narrow for it to span the longest fold.
  const scale = Math.max(1, (Math.min(width, height) * Math.SQRT2 + 2 * BAND) / width);
  const [lit, mid, dark] = tonesOf(from).flap;
  root.dataset.peel = '';
  root.style.setProperty('--peel-lit', lit);
  root.style.setProperty('--peel-mid', mid);
  root.style.setProperty('--peel-dark', dark);
  root.style.setProperty('--peel-band', `${BAND / scale}px`);
  sheet.style.viewTransitionName = SHEET;
  threads.style.viewTransitionName = THREADS;

  const transition = document.startViewTransition(() => {
    before();
    flushSync(() => pickTime(next));
    // The new sheet is a layer of its own, under the flap and the old one.
    sheet.style.viewTransitionName = UNDER;
    flap.style.display = 'block';
    flap.style.viewTransitionName = FLAP;
  });

  try {
    await transition.ready;
    const end = width + height + FLAP_WIDE;
    const px = (v: number) => `${v.toFixed(1)}px`;
    const cut: Keyframe[] = [];
    const band: Keyframe[] = [];
    // On from the hand's own pace, gathering speed, then easing out to the far corner.
    const along = progress(speed, end - fold);
    for (let i = 0; i <= FRAMES; i++) {
      const eased = along[i];
      const c = fold + (end - fold) * eased;
      // The flap is the lifted part mirrored over the fold, up to its full width.
      const w = Math.min(c, fold + (FLAP_WIDE - fold) * Math.min(1, eased * 2.5));
      // The old sheet: everything past the fold but the flap lying on it.
      cut.push({
        clipPath: `polygon(${px(c + inset)} 0, ${FAR}px 0, ${FAR}px ${FAR}px, 0 ${FAR}px, 0 ${px(c)}, ${px(w + inset)} ${px(c)}, ${px(c + inset)} ${px(w)})`
      });
      // The fold crosses the sheet from its top (or right) edge to its left (or bottom) one; the
      // band is carried to the middle of that stretch.
      const ax = Math.min(c, width);
      const ay = Math.max(0, c - width);
      const bx = Math.max(0, c - height);
      const by = Math.min(c, height);
      band.push({
        transform: `translate(${px((ax + bx - width) / 2)}, ${px((ay + by - height) / 2)}) rotate(-45deg) scale(${scale.toFixed(4)})`
      });
    }
    const timing = { duration: DURATION_MS, easing: 'linear', fill: 'both' as const };
    const moving = [
      root.animate(cut, { ...timing, pseudoElement: `::view-transition-old(${SHEET})` }),
      root.animate(band, { ...timing, pseudoElement: `::view-transition-new(${FLAP})` })
    ];
    // Started on one tick of the page's clock: left to start by themselves, the one the
    // compositor runs can begin a frame after the other.
    const now = document.timeline.currentTime;
    moving.forEach((animation) => (animation.startTime = now));
    await transition.finished;
  } catch {
    // A skipped transition (a hidden tab) has still changed the time.
  } finally {
    sheet.style.viewTransitionName = '';
    threads.style.viewTransitionName = '';
    flap.style.viewTransitionName = '';
    flap.style.display = '';
    delete root.dataset.peel;
    for (const name of ['--peel-lit', '--peel-mid', '--peel-dark', '--peel-band'])
      root.style.removeProperty(name);
    running = false;
  }
}
