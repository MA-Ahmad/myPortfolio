import { memo, useEffect, useRef } from 'react';
import { GAP, type SeamState, type Sheet } from './sheet';
import { freeCursor, holdCursor } from './stick';
import { type Axis, type Point, xAt } from './tear';
import { isZip, pinchedAt, taperOf, timeAtReach, type WeldKind } from './welds';
import styles from './torn.module.css';

/** Inside this the seam's spark has the pointer (attract.tsx's NEAR), and the threads let go. */
export const NEAR = GAP + 10;
/** How far from the tear the threads first reach the pointer, px. */
export const REACH = 90;
/** Threads per seam, spread along it either side of the pointer, alternating edges. */
export const THREADS = 7;
export const SPACING = 26;
/** How fast the threads come up and let go, per ms. */
export const RISE = 1 / 140;
export const FALL = 1 / 220;
/** A press becomes a pull once it has moved this far the way it pulls, px. */
export const START = 6;
/** A pull gives less with each px, at this scale (px), like the welded seam's grip. */
const RESIST = 110;
/** Let go once the pull has reached this far, and the seam welds from where it was grabbed. */
const JOIN_AT = 0.5;
/** How much of the seam a full pull has narrowed, either side of where it was grabbed, px. */
const PINCH = 140;
/** How long a pull let go too soon takes to spring back open, ms. */
export const SPRING_MS = 240;
/**
 * How far the hand holding the threads can be drawn out from where it grabbed, px: across the
 * seam, and along it.
 */
export const HAND_OUT = 93;
export const HAND_ALONG = 36;
/** The threads' start trails where it is headed by about this long, ms, so it never jumps. */
export const FOLLOW_MS = 45;
/** How long the threads take to go taut on a pull, and to slacken when let go, ms. */
export const TAUT_MS = 140;

/** `d` eased toward `max` and never past it: the further the pointer goes, the less it follows. */
const eased = (d: number, max: number) =>
  Math.sign(d) * max * (1 - Math.exp(-Math.abs(d) / max));

/*
 * One press pulls one thing. Columns can be narrow enough for a press to be in reach of two seams
 * (or a seam and the sheet's corner), so everything in reach bids for the press with its distance,
 * and only the nearest of those pulled the same way may take it; once one has, the rest stand down.
 */
type Way = 'join' | 'part' | 'peel';
let pressed: Event | null = null;
let taken: object | null = null;
const nearest = new Map<Way, { distance: number; who: object }>();

/** Bids for the press `event`, `distance` px away, to be pulled `way`. */
export function bid(event: Event, way: Way, distance: number, who: object) {
  if (event !== pressed) {
    pressed = event;
    taken = null;
    nearest.clear();
  }
  const best = nearest.get(way);
  if (!best || distance < best.distance) nearest.set(way, { distance, who });
}

/** Takes the press for `who`, if it was the nearest pulled its way and no one has it yet. */
export function take(way: Way, who: object) {
  if (taken && taken !== who) return false;
  if (nearest.get(way)?.who !== who) return false;
  taken = who;
  return true;
}

/**
 * Where the hand is, for a pointer at `here` in a pull grabbed at `grab`: it follows the pointer
 * less and less and stops short, so the threads keep their shape however far the pointer goes.
 */
export const handAt = (
  here: { offset: number; at: number },
  grab: { offset: number; at: number }
) => ({
  offset: grab.offset + eased(here.offset - grab.offset, HAND_OUT),
  at: grab.at + eased(here.at - grab.at, HAND_ALONG)
});

/**
 * A torn seam near the pointer: a few threads run from the pointer to points on both torn edges,
 * each marked with a small square, as if the pieces had hold of it. They brighten as the pointer
 * closes in, and let go where the seam's spark takes over (see Attract). Nothing runs until the
 * pointer is in reach, and the loop stops once the threads have faded. The threads can be pulled:
 * press near the seam and drag left (up, stacked): the threads start from a hand that follows the
 * pointer less and less and stops short, while the crack narrows where it was grabbed (it never
 * shuts); let go past halfway and the seam welds shut from there, sooner and it springs back open.
 * It stays while the seam welds, only to let its threads fade rather than vanish.
 */
export const Tether = memo(function Tether({
  sheet,
  index,
  kind,
  tear,
  length,
  axis,
  state,
  onJoin
}: {
  sheet: Sheet;
  index: number;
  kind: WeldKind;
  tear: Point[];
  length: number;
  axis: Axis;
  /** 'torn' while it can be pulled; 'welding' while its threads fade out. */
  state: SeamState;
  /** Welds the seam from this point along it. */
  onJoin: (along: number) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const join = useRef(onJoin);
  useEffect(() => {
    join.current = onJoin;
  }, [onJoin]);
  const seam = useRef(state);
  useEffect(() => {
    seam.current = state;
  }, [state]);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = svgRef.current!;
    const sheetEl = svg.closest<HTMLElement>('[data-skin]')!;
    const groups = Array.from(svg.querySelectorAll('g'));
    const ring = svg.querySelector('circle')!;
    const middle = (THREADS - 1) / 2;
    let pointer: { offset: number; at: number } | null = null;
    let want = 0;
    let power = 0;
    let frame = 0;
    let last = 0;
    const zip = isZip(kind) ? kind : null;
    // Where the seam was pressed.
    let grab: { offset: number; at: number } | null = null;
    let down = false;
    let pulling = false;
    let amount = 0;
    let spring = 0;
    // Where the threads start and where they are centred along the seam, as drawn: each trails
    // its target, so going from the pointer to the hand and back is a glide, not a jump.
    let hand: { offset: number; at: number } | null = null;
    let mid = 0;
    // How taut the threads are, 0 to 1: eased, so the ring and the outer threads come up smoothly.
    let taut = 0;
    // Where the pointer really is, which a pull's hand is not: it stops short and can be far behind.
    let seen: { offset: number; at: number } | null = null;
    // How strongly the threads reach for a pointer at `p`: nothing out of reach or inside the spark.
    const reachFor = ({ offset, at }: { offset: number; at: number }) => {
      const d = Math.abs(offset - xAt(tear, at));
      if (at <= 0 || at >= length || d >= REACH) return 0;
      return (
        Math.min(1, (REACH - d) / (REACH - NEAR)) *
        Math.min(1, Math.max(0, (d - NEAR * 0.5) / (NEAR * 0.5)))
      );
    };

    // While this seam has hold of the pointer it carries data-tethered; other overlays read it to step aside.
    // Both are written only when they change: the cursor's :has() rules read data-grab, so a
    // rewrite of the same value would have the sheet's styles worked out again on every move.
    let tethered = false;
    let grabbing = '';
    const sync = () => {
      const held = want > 0;
      if (held !== tethered) {
        tethered = held;
        svg.toggleAttribute('data-tethered', held);
      }
      const grip = pulling ? 'pulling' : zip && want >= 0.5 ? 'ready' : '';
      if (grip !== grabbing) {
        grabbing = grip;
        if (grip) svg.setAttribute('data-grab', grip);
        else svg.removeAttribute('data-grab');
      }
    };
    const hide = () => {
      groups.forEach((group) => group.setAttribute('opacity', '0'));
      ring.setAttribute('opacity', '0');
    };
    // Where the seam's drawing space is in the window, and whether the cursor is stuck to the hand.
    let base: DOMRect | null = null;
    let stuck = false;
    const locate = (event: PointerEvent) => {
      // The seam's drawing space starts at its centre line; stacked, it is turned on its side.
      const origin = svg.parentElement!.getBoundingClientRect();
      base = origin;
      return axis === 'v'
        ? { offset: event.clientX - origin.left, at: event.clientY - origin.top }
        : { offset: event.clientY - origin.top, at: event.clientX - origin.left };
    };
    // A pull of `a` (0 to 1) is as far into a weld from the grab as its fronts having run this far.
    const timeOf = (a: number) =>
      zip ? timeAtReach(zip, a * (taperOf(zip) + PINCH) - taperOf(zip), length) : 0;
    const pinch = (a: number) => {
      amount = a;
      if (grab) sheet.pinch(index, a > 0 ? { t: timeOf(a), at: grab.at } : null);
    };

    const tick = (now: number) => {
      const dt = Math.min(48, now - (last || now));
      last = now;
      const fresh = power === 0;
      power =
        power < want ? Math.min(want, power + RISE * dt) : Math.max(want, power - FALL * dt);
      const held = seam.current === 'torn' && (pulling || amount > 0);
      taut += ((pulling ? 1 : 0) - taut) * (1 - Math.exp(-dt / TAUT_MS));
      if (!pulling && taut < 0.01) taut = 0;
      if (pointer) {
        const centre = grab && held ? grab.at : pointer.at;
        const follow = 1 - Math.exp(-dt / FOLLOW_MS);
        if (!hand || fresh) {
          hand = { ...pointer };
          mid = centre;
        } else {
          hand.offset += (pointer.offset - hand.offset) * follow;
          hand.at += (pointer.at - hand.at) * follow;
          mid += (centre - mid) * follow;
        }
        const { offset, at } = hand;
        // Pulled, the mouse is drawn on the hand, where the threads end (stick.ts).
        if (pulling && base) {
          stuck = true;
          if (axis === 'v') holdCursor(base.left + offset, base.top + at);
          else holdCursor(base.left + at, base.top + offset);
        } else if (stuck) {
          stuck = false;
          freeCursor();
        }
        groups.forEach((group, i) => {
          const along = mid + (i - middle) * SPACING;
          if (along < 4 || along > length - 4) return group.setAttribute('opacity', '0');
          const side = i % 2 ? 1 : -1;
          const open =
            zip && grab && amount > 0 ? pinchedAt(zip, timeOf(amount), along, length, grab.at) : 1;
          const x = xAt(tear, along) + side * GAP * open;
          const line = group.children[0];
          const mark = group.children[1];
          line.setAttribute('x1', offset.toFixed(1));
          line.setAttribute('y1', at.toFixed(1));
          line.setAttribute('x2', x.toFixed(1));
          line.setAttribute('y2', along.toFixed(1));
          mark.setAttribute('x', (x - 2.5).toFixed(1));
          mark.setAttribute('y', (along - 2.5).toFixed(1));
          const fade = 1 - ((0.4 - 0.25 * taut) * Math.abs(i - middle)) / middle;
          group.setAttribute('opacity', (power * fade).toFixed(2));
        });
        ring.setAttribute('cx', offset.toFixed(1));
        ring.setAttribute('cy', at.toFixed(1));
        ring.setAttribute('opacity', (power * taut).toFixed(2));
      }
      if (power > 0 || want > 0 || held || taut > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
        hide();
      }
    };

    const onMove = (event: PointerEvent) => {
      seen = locate(event);
      // Welding: the threads only fade.
      if (seam.current !== 'torn') {
        want = 0;
        return sync();
      }
      if (down && grab) {
        const here = locate(event);
        // Only a pull back toward the open section (left, or up when stacked) draws the pieces
        // together; the other way does nothing.
        const away = grab.offset - here.offset;
        if (!pulling && away > START) {
          if (take('join', svg)) {
            pulling = true;
            // A drag that began on text would otherwise select it.
            window.getSelection()?.removeAllRanges();
          } else {
            // A nearer seam has this press.
            down = false;
          }
        }
        if (pulling) {
          pointer = handAt(here, grab);
          want = 1;
          pinch(1 - Math.exp(-Math.max(0, away - START) / RESIST));
          sync();
          if (!frame) frame = requestAnimationFrame(tick);
          return;
        }
      }
      if ((event.buttons !== 0 && !down) || !sheetEl.contains(event.target as Node)) {
        want = 0;
      } else {
        const here = locate(event);
        // Grows as the pointer closes in, and is gone once the spark has it.
        want = reachFor(here);
        if (want > 0) pointer = here;
      }
      sync();
      if (want > 0 && !frame) frame = requestAnimationFrame(tick);
    };
    const onLeave = () => {
      want = 0;
      sync();
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || !zip || want <= 0 || seam.current !== 'torn') return;
      cancelAnimationFrame(spring);
      spring = 0;
      const here = locate(event);
      bid(event, 'join', Math.abs(here.offset - xAt(tear, here.at)), svg);
      grab = here;
      down = true;
    };
    // The crack springs back open on a short ease-out.
    const release = () => {
      const from = amount;
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / SPRING_MS);
        pinch(t < 1 ? from * (1 - t) ** 3 : 0);
        spring = t < 1 ? requestAnimationFrame(step) : 0;
      };
      spring = requestAnimationFrame(step);
    };
    const onUp = (event: PointerEvent) => {
      if (!down) return;
      down = false;
      if (!pulling) return;
      pulling = false;
      // The press that ends a pull is not a click on whatever is under it.
      const swallow = (click: MouseEvent) => {
        click.preventDefault();
        click.stopPropagation();
      };
      window.addEventListener('click', swallow, { capture: true, once: true });
      window.setTimeout(() => window.removeEventListener('click', swallow, true), 0);
      if (event.type === 'pointerup' && amount >= JOIN_AT && grab) {
        // The weld carries on from where the pull had the seam; the pinch stays until it starts.
        sheet.hold(index, timeOf(amount));
        want = 0;
        sync();
        return join.current(grab.at);
      }
      // Let go short of a weld, the threads go back to the pointer where it really is, and let go of
      // it if that is out of reach: the hand they were pulled to is no reason to stay.
      want = seen ? reachFor(seen) : 0;
      if (want > 0) pointer = seen;
      release();
      sync();
    };

    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerdown', onDown, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
    document.documentElement.addEventListener('pointerleave', onLeave);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerdown', onDown);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('pointercancel', onUp);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      cancelAnimationFrame(spring);
      svg.removeAttribute('data-tethered');
      svg.removeAttribute('data-grab');
      if (stuck) freeCursor(true);
      // Unmounted mid-pull while still torn (a resize): let the seam go.
      if (sheet.get()[index] === 'torn' && sheet.pinchOf(index)) sheet.pinch(index, null);
    };
  }, [sheet, index, kind, tear, length, axis]);

  return (
    <svg ref={svgRef} className={styles.tether} aria-hidden>
      {Array.from({ length: THREADS }, (_, i) => (
        <g key={i} opacity={0}>
          <line className={styles.tetherLine} />
          <rect className={styles.tetherMark} width={5} height={5} />
        </g>
      ))}
      <circle className={styles.tetherMark} r={3.5} opacity={0} />
    </svg>
  );
});
