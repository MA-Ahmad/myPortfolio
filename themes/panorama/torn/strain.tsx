import { memo, useEffect, useRef } from 'react';
import type { SeamState } from './sheet';
import { freeCursor, holdCursor } from './stick';
import { type Axis, type Point, xAt } from './tear';
import {
  FALL,
  bid,
  FOLLOW_MS,
  handAt,
  NEAR,
  REACH,
  RISE,
  SPACING,
  SPRING_MS,
  START,
  take,
  TAUT_MS,
  THREADS
} from './tether';
import styles from './torn.module.css';

/** How long a thread takes to whip back to the pointer once the seam tears, ms. */
const SNAP_MS = 160;
/** The lag from one thread to the next as they whip back, ms. */
const SNAP_LAG = 18;

/** A welded seam's pull in progress: how far (see pullOf in torn-piece.tsx) and where along it. */
export type Strained = { amount: number; at: number };

type Props = {
  tear: Point[];
  length: number;
  axis: Axis;
  /** 'welded' while it can be pulled; 'tearing' while the threads snap. */
  state: SeamState;
  /** The seam's pull in progress, kept by the piece: set by this or by the grip strip. */
  live: { current: Strained | null };
  /** How far a drag of this many px pulls the seam, and past what share it tears. */
  pullOf: (distance: number) => number;
  tearAt: number;
  /** How far each edge of the crack stands from the centre line at `along`, px. */
  spread: (amount: number, at: number, along: number) => number;
  onPull: (amount: number, at: number) => void;
  onSettle: () => void;
  onTear: (amount: number, at: number) => void;
};

/**
 * A welded seam near the pointer: threads run from the pointer to the scar. Pressed there and
 * dragged right (down, stacked), they pull it: the seam cracks open (the piece draws the crack) with
 * the threads stretched to both of its edges. Let go past `tearAt` and the seam tears, the threads
 * whipping back to the pointer; let go sooner and the crack closes. The grip strip on the scar
 * pulls the same way, and the threads follow it. It adds to the section buttons and arrow keys,
 * so it is hidden from assistive tech.
 */
export const Strain = memo(
  function StrainSeam({
    tear,
    length,
    axis,
    state,
    live,
    pullOf,
    tearAt,
    spread,
    onPull,
    onSettle,
    onTear
  }: Props) {
    const svgRef = useRef<SVGSVGElement>(null);
    const props = useRef({ pullOf, spread, onPull, onSettle, onTear });
    useEffect(() => {
      props.current = { pullOf, spread, onPull, onSettle, onTear };
    });
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
      // Where the seam was pressed.
      let grab: { offset: number; at: number } | null = null;
      let down = false;
      let pulling = false;
      let amount = 0;
      let spring = 0;
      // When the threads began to snap back (0 if not), and each thread's far end as last drawn.
      let snapAt = 0;
      const ends: ({ x: number; y: number } | undefined)[] = [];
      // Where the threads start and where they are centred along the seam, as drawn: each trails
      // its target, so going from the pointer to the hand and back is a glide, not a jump.
      let hand: { offset: number; at: number } | null = null;
      let mid = 0;
      // How taut the threads are, 0 to 1: eased, so the ring and the outer threads come up smoothly.
      let taut = 0;

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
        const grip = pulling || live.current ? 'pulling' : want >= 0.5 ? 'ready' : '';
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
      // Where the seam's drawing space is in the window; whether the grip strip is held; and
      // whether the cursor is stuck to the hand.
      let base: DOMRect | null = null;
      let strip = false;
      let stuck = false;
      const locate = (event: PointerEvent) => {
        // The seam's drawing space starts at its centre line; stacked, it is turned on its side.
        const origin = svg.parentElement!.getBoundingClientRect();
        base = origin;
        return axis === 'v'
          ? { offset: event.clientX - origin.left, at: event.clientY - origin.top }
          : { offset: event.clientY - origin.top, at: event.clientX - origin.left };
      };

      const tick = (now: number) => {
        const dt = Math.min(48, now - (last || now));
        last = now;
        const fresh = power === 0;
        power =
          power < want ? Math.min(want, power + RISE * dt) : Math.max(want, power - FALL * dt);
        if (seam.current === 'tearing' && !snapAt && power > 0) snapAt = now;
        taut += ((live.current && !snapAt ? 1 : 0) - taut) * (1 - Math.exp(-dt / TAUT_MS));
        if (!live.current && taut < 0.01) taut = 0;
        if (pointer) {
          const strained = live.current;
          const centre = strained ? strained.at : pointer.at;
          const follow = 1 - Math.exp(-dt / FOLLOW_MS);
          if (!hand || fresh) {
            hand = { ...pointer };
            mid = centre;
          } else if (!snapAt) {
            hand.offset += (pointer.offset - hand.offset) * follow;
            hand.at += (pointer.at - hand.at) * follow;
            mid += (centre - mid) * follow;
          }
          const { offset, at } = hand;
          // Pulled, the mouse is drawn on the hand, where the threads end (stick.ts).
          if ((pulling || (live.current && strip)) && !snapAt && base) {
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
            let x: number;
            let y: number;
            let opacity: number;
            if (!snapAt) {
              x =
                xAt(tear, along) +
                (strained ? side * props.current.spread(strained.amount, strained.at, along) : 0);
              y = along;
              ends[i] = { x, y };
              opacity = power * (1 - ((0.4 - 0.25 * taut) * Math.abs(i - middle)) / middle);
            } else {
              const end = ends[i];
              if (!end) return group.setAttribute('opacity', '0');
              const p = Math.max(
                0,
                Math.min(1, (now - snapAt - SNAP_LAG * Math.abs(i - middle)) / SNAP_MS)
              );
              const e = 1 - (1 - p) ** 3;
              x = end.x + (offset - end.x) * e;
              y = end.y + (at - end.y) * e;
              opacity = 1 - p;
            }
            const line = group.children[0];
            const mark = group.children[1];
            line.setAttribute('x1', offset.toFixed(1));
            line.setAttribute('y1', at.toFixed(1));
            line.setAttribute('x2', x.toFixed(1));
            line.setAttribute('y2', y.toFixed(1));
            mark.setAttribute('x', (x - 2.5).toFixed(1));
            mark.setAttribute('y', (y - 2.5).toFixed(1));
            group.setAttribute('opacity', opacity.toFixed(2));
          });
          ring.setAttribute('cx', offset.toFixed(1));
          ring.setAttribute('cy', at.toFixed(1));
          ring.setAttribute('opacity', (power * taut).toFixed(2));
        }
        const snapping = snapAt && now - snapAt < SNAP_MS + SNAP_LAG * middle;
        if (snapAt && !snapping) {
          want = 0;
          power = 0;
        }
        if (power > 0 || want > 0 || live.current || snapping || taut > 0) {
          frame = requestAnimationFrame(tick);
        } else {
          frame = 0;
          last = 0;
          hide();
        }
      };

      const onMove = (event: PointerEvent) => {
        if (seam.current !== 'welded') {
          want = 0;
          sync();
          return;
        }
        if (down && grab) {
          const here = locate(event);
          // Only a pull the way the grip strip pulls (right, or down when stacked) parts the
          // pieces; the other way does nothing.
          const away = here.offset - grab.offset;
          if (!pulling && away > START) {
            if (take('part', svg)) {
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
            amount = props.current.pullOf(away - START);
            props.current.onPull(amount, grab.at);
            sync();
            if (!frame) frame = requestAnimationFrame(tick);
            return;
          }
        }
        // The grip strip is pulling: the threads follow the pointer.
        if (live.current) {
          strip = event.buttons !== 0;
          const from = { offset: xAt(tear, live.current.at), at: live.current.at };
          pointer = handAt(locate(event), from);
          want = 1;
          sync();
          if (!frame) frame = requestAnimationFrame(tick);
          return;
        }
        if ((event.buttons !== 0 && !down) || !sheetEl.contains(event.target as Node)) {
          want = 0;
        } else {
          const { offset, at } = locate(event);
          const d = Math.abs(offset - xAt(tear, at));
          if (at <= 0 || at >= length || d >= REACH) {
            want = 0;
          } else {
            pointer = { offset, at };
            // No spark on a welded seam, so the threads stay up right onto the scar.
            want = Math.min(1, (REACH - d) / (REACH - NEAR));
          }
        }
        sync();
        if (want > 0 && !frame) frame = requestAnimationFrame(tick);
      };
      const onLeave = () => {
        want = 0;
        sync();
      };

      const onDown = (event: PointerEvent) => {
        if (event.button !== 0 || seam.current !== 'welded' || want <= 0) return;
        // The grip strip pulls by itself.
        if ((event.target as Element).closest('[data-grip]')) return;
        cancelAnimationFrame(spring);
        spring = 0;
        const here = locate(event);
        bid(event, 'part', Math.abs(here.offset - xAt(tear, here.at)), svg);
        grab = here;
        down = true;
      };
      // The crack closes on a short ease-out, as the grip strip does.
      const release = () => {
        const from = amount;
        const at = grab!.at;
        const began = performance.now();
        const step = (now: number) => {
          const t = Math.min(1, (now - began) / SPRING_MS);
          amount = t < 1 ? from * (1 - t) ** 3 : 0;
          if (t < 1) {
            props.current.onPull(amount, at);
            spring = requestAnimationFrame(step);
          } else {
            spring = 0;
            props.current.onSettle();
            // The pull is over: the threads go back to following the pointer where it is now.
            if (pointer) {
              const d = Math.abs(pointer.offset - xAt(tear, pointer.at));
              want = d >= REACH ? 0 : Math.min(1, (REACH - d) / (REACH - NEAR));
            }
            sync();
          }
        };
        spring = requestAnimationFrame(step);
      };
      const onUp = (event: PointerEvent) => {
        strip = false;
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
        if (event.type === 'pointerup' && amount >= tearAt && grab) {
          sync();
          props.current.onTear(amount, grab.at);
          // If the seam did not tear after all, it must not be left pulled.
          window.setTimeout(() => {
            if (seam.current !== 'welded' || !live.current || pulling) return;
            props.current.onSettle();
            want = 0;
            sync();
          }, 400);
          return;
        }
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
        // Unmounted mid-pull (a resize): let the crack go.
        if (pulling) props.current.onSettle();
      };
    }, [tear, length, axis, live, tearAt]);

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
  },
  (a, b) =>
    a.tear === b.tear &&
    a.length === b.length &&
    a.axis === b.axis &&
    a.state === b.state &&
    a.live === b.live &&
    a.tearAt === b.tearAt
);
