import { useEffect, useRef } from 'react';
import type { TimeOfDay } from '../time';
import { peelTo, peeling, tonesOf, underneath } from './peel-transition';
import { freeCursor, holdCursor } from './stick';
import { bid, FALL, FOLLOW_MS, RISE, SPRING_MS, START, take, TAUT_MS } from './tether';
import styles from './torn.module.css';

/** How near the sheet's top left corner the pointer comes before its threads reach it, px. */
const REACH = 130;
/** The points on the corner the threads hold: its tip, and these far along each edge from it, px. */
const HOLDS = [0, 30, 62];
/** A pull gives less with each px, at this scale (px), and lifts the corner at most this far. */
const RESIST = 170;
const LIFT = 230;
/** Let go once the corner is lifted this far (0 to 1), and the sheet peels away. */
const PEEL_AT = 0.4;
/** How far the hand holding the threads can be drawn out from where it grabbed, px. */
const HAND = 300;
/** How far ahead of the lifted corner's tip the hand is kept at a full pull, px. */
const LEAD = 130;

/** A corner not moved for this long before it is let go counts as held still, ms. */
const STILL_MS = 90;

/** How far the lifted corner's shadow reaches past its edges, px. */
const SHADE = 16;

const THREADS = HOLDS.length * 2 - 1;

type XY = { x: number; y: number };

/**
 * The sheet's top left corner near the pointer: threads run from the pointer to the corner and a
 * little way along both of its edges. Pressed there and pulled in toward the sheet, they lift the
 * corner: it folds back on a diagonal, its underside showing, with the other time of day in the
 * triangle it uncovers. Let go past PEEL_AT and the whole sheet peels away to that time of day
 * (peel-transition.ts); sooner, and the corner lies back down. A gesture on top of the header's
 * time buttons, so it is hidden from assistive tech; fine pointers only, and not under reduced
 * motion.
 */
export function Peel() {
  const svgRef = useRef<SVGSVGElement>(null);
  const threadsRef = useRef<SVGSVGElement>(null);
  const flapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const svg = svgRef.current!;
    const sheetEl = svg.closest<HTMLElement>('[data-skin]')!;
    const timed = svg.closest<HTMLElement>('[data-time]')!;
    const fold = svg.querySelector<SVGGElement>('[data-fold]')!;
    const [under, flap] = Array.from(fold.querySelectorAll('polygon'));
    const [shadeRight, shadeBelow, shadeCorner] = Array.from(fold.querySelectorAll('rect'));
    const crease = fold.querySelector('line')!;
    const grad = svg.querySelector('linearGradient')!;
    const stops = Array.from(grad.querySelectorAll('stop'));
    const threads = threadsRef.current!;
    const groups = Array.from(threads.querySelectorAll<SVGGElement>('[data-thread]'));
    const ring = threads.querySelector('circle')!;

    let pointer: XY | null = null;
    // Where the threads start, as drawn. Pulled, it is the hand itself; otherwise it trails the
    // pointer, so letting go is a glide back to it and not a jump.
    let hand: XY | null = null;
    let want = 0;
    let power = 0;
    let taut = 0;
    let frame = 0;
    let last = 0;
    let grab: XY | null = null;
    let down = false;
    let pulling = false;
    // How far the corner is lifted, 0 to 1. It is drawn exactly where the pull has it: a fold
    // that trailed the hand would feel late.
    let amount = 0;
    let spring = 0;
    let leaving = false;
    // How fast the fold is being lifted, px/s of x + y, and when it last moved: the peel carries on
    // at this pace (peel-transition.ts).
    let lifting = 0;
    let lifted = 0;

    const time = () => (timed.getAttribute('data-time') ?? 'night') as TimeOfDay;
    // Where the corner is in the window, and whether the cursor is stuck to the hand.
    let base: DOMRect | null = null;
    let stuck = false;
    const locate = (event: PointerEvent): XY => {
      const box = svg.getBoundingClientRect();
      base = box;
      return { x: event.clientX - box.left, y: event.clientY - box.top };
    };
    // The sheet has hold of the pointer: other overlays read data-tethered to step aside.
    // Written only when they change: the cursor's :has() rules read them, so a rewrite of the
    // same value would have the sheet's styles worked out again on every move.
    let tethered = false;
    let grabbing = '';
    const sync = () => {
      const held = want > 0;
      if (held !== tethered) {
        tethered = held;
        svg.toggleAttribute('data-tethered', held);
      }
      const grip = pulling ? 'pulling' : want >= 0.5 ? 'ready' : '';
      if (grip !== grabbing) {
        grabbing = grip;
        if (grip) svg.setAttribute('data-grab', grip);
        else svg.removeAttribute('data-grab');
      }
    };
    const tone = () => {
      const { flap: tones, under: beneath } = tonesOf(time());
      stops.forEach((stop, i) => stop.setAttribute('stop-color', tones[i]));
      under.setAttribute('fill', beneath);
    };
    const clear = () => {
      fold.setAttribute('opacity', '0');
      groups.forEach((group) => group.setAttribute('opacity', '0'));
      ring.setAttribute('opacity', '0');
    };

    const tick = (now: number) => {
      const dt = Math.min(48, now - (last || now));
      last = now;
      const fresh = power === 0;
      power = power < want ? Math.min(want, power + RISE * dt) : Math.max(want, power - FALL * dt);
      const follow = 1 - Math.exp(-dt / FOLLOW_MS);
      taut += ((pulling ? 1 : 0) - taut) * (1 - Math.exp(-dt / TAUT_MS));
      if (!pulling && taut < 0.01) taut = 0;
      const l = amount * LIFT;

      if (l > 0.5) {
        const at = l.toFixed(1);
        // The corner folds back on the line x + y = l: what it uncovers, and the flap, its mirror.
        under.setAttribute('points', `0,0 ${at},0 0,${at}`);
        flap.setAttribute('points', `${at},0 0,${at} ${at},${at}`);
        // Its shadow falls just past its two free edges, each strip as long as its edge, and turns
        // the flap's corner as a quarter round. Strips that ran on past the corner would lie over
        // each other there and leave a dark square.
        shadeRight.setAttribute('x', at);
        shadeRight.setAttribute('height', at);
        shadeBelow.setAttribute('y', at);
        shadeBelow.setAttribute('width', at);
        shadeCorner.setAttribute('x', at);
        shadeCorner.setAttribute('y', at);
        crease.setAttribute('x1', at);
        crease.setAttribute('y2', at);
        grad.setAttribute('x1', (l / 2).toFixed(1));
        grad.setAttribute('y1', (l / 2).toFixed(1));
        grad.setAttribute('x2', at);
        grad.setAttribute('y2', at);
        fold.setAttribute('opacity', '1');
      } else {
        fold.setAttribute('opacity', '0');
      }

      if (pointer) {
        if (!hand || fresh || pulling) hand = { ...pointer };
        else {
          hand.x += (pointer.x - hand.x) * follow;
          hand.y += (pointer.y - hand.y) * follow;
        }
        const { x, y } = hand;
        // Pulled, the mouse is drawn on the hand, where the threads end (stick.ts).
        if (pulling && base) {
          stuck = true;
          holdCursor(base.left + x, base.top + y);
        } else if (stuck) {
          stuck = false;
          // The sheet is about to be snapshot for the peel: the drawn cursor must not be in it.
          freeCursor(leaving);
        }
        groups.forEach((group, i) => {
          // The tip, then pairs out along the top edge and down the left one.
          const s = HOLDS[Math.ceil(i / 2)];
          const top = i % 2 === 1;
          // A hold the fold has passed is on the flap, mirrored over the fold line.
          const on = s < l;
          const hx = i === 0 ? (on ? l : 3) : top ? (on ? l : s) : on ? l - s : 1;
          const hy = i === 0 ? (on ? l : 3) : top ? (on ? l - s : 1) : on ? l : s;
          const line = group.children[0];
          const mark = group.children[1];
          line.setAttribute('x1', x.toFixed(1));
          line.setAttribute('y1', y.toFixed(1));
          line.setAttribute('x2', hx.toFixed(1));
          line.setAttribute('y2', hy.toFixed(1));
          mark.setAttribute('x', (hx - 2.5).toFixed(1));
          mark.setAttribute('y', (hy - 2.5).toFixed(1));
          const fade = 1 - ((0.4 - 0.25 * taut) * Math.ceil(i / 2)) / (HOLDS.length - 1);
          group.setAttribute('opacity', (power * fade).toFixed(2));
        });
        ring.setAttribute('cx', x.toFixed(1));
        ring.setAttribute('cy', y.toFixed(1));
        ring.setAttribute('opacity', (power * taut).toFixed(2));
      }

      if (power > 0 || want > 0 || amount > 0 || taut > 0) {
        frame = requestAnimationFrame(tick);
      } else {
        frame = 0;
        last = 0;
        clear();
      }
    };
    const run = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      if (leaving || peeling()) return;
      if (down && grab) {
        const here = locate(event);
        // Only a pull in toward the sheet, down and to the right, lifts the corner.
        const inward = (here.x - grab.x + (here.y - grab.y)) / Math.SQRT2;
        if (!pulling && inward > START) {
          if (take('peel', svg)) {
            pulling = true;
            tone();
            // A drag that began on text would otherwise select it.
            window.getSelection()?.removeAllRanges();
          } else {
            // A seam has this press.
            down = false;
          }
        }
        if (pulling) {
          // The hand follows the pointer less and less and stops short, so the threads keep shape.
          const dx = here.x - grab.x;
          const dy = here.y - grab.y;
          const far = Math.hypot(dx, dy) || 1;
          const out = (HAND * (1 - Math.exp(-far / HAND))) / far;
          pointer = { x: grab.x + dx * out, y: grab.y + dy * out };
          want = 1;
          const before = amount;
          amount = 1 - Math.exp(-Math.max(0, inward - START) / RESIST);
          // Smoothed over a few moves, so one late or early event does not set the pace.
          const since = event.timeStamp - lifted;
          if (lifted && since > 0) lifting += ((((amount - before) * LIFT) / since) * 1000 - lifting) * 0.35;
          lifted = event.timeStamp;
          // The hand stays ahead of the lifted corner, so the threads never bunch up on it.
          const short = amount * (LIFT * Math.SQRT2 + LEAD) - (pointer.x + pointer.y) / Math.SQRT2;
          if (short > 0) {
            pointer.x += short / Math.SQRT2;
            pointer.y += short / Math.SQRT2;
          }
          sync();
          return run();
        }
      }
      if ((event.buttons !== 0 && !down) || !sheetEl.contains(event.target as Node)) {
        want = 0;
      } else {
        const here = locate(event);
        const d = Math.hypot(here.x, here.y);
        if (here.x < 0 || here.y < 0 || d >= REACH) {
          want = 0;
        } else {
          pointer = here;
          want = Math.min(1, (REACH - d) / (REACH * 0.6));
        }
      }
      sync();
      if (want > 0) run();
    };
    const onLeave = () => {
      if (pulling) return;
      want = 0;
      sync();
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || want <= 0 || leaving || peeling()) return;
      cancelAnimationFrame(spring);
      spring = 0;
      grab = locate(event);
      lifting = 0;
      lifted = 0;
      bid(event, 'peel', Math.hypot(grab.x, grab.y), svg);
      down = true;
    };
    // The corner lies back down on a short ease-out.
    const release = () => {
      const from = amount;
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / SPRING_MS);
        amount = t < 1 ? from * (1 - t) ** 3 : 0;
        spring = t < 1 ? requestAnimationFrame(step) : 0;
      };
      spring = requestAnimationFrame(step);
      run();
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
      if (event.type !== 'pointerup' || amount < PEEL_AT) {
        release();
        return sync();
      }
      // The sheet peels on from that fold at once; the threads, a layer of their own, fade off it.
      leaving = true;
      want = 0;
      sync();
      const from = time();
      const inset = svg.getBoundingClientRect().left - sheetEl.getBoundingClientRect().left;
      void peelTo(
        sheetEl,
        flapRef.current!,
        threads,
        inset,
        amount * LIFT,
        // A corner held still before it is let go has no pace to carry on.
        event.timeStamp - lifted < STILL_MS ? Math.max(0, lifting) : 0,
        from,
        underneath(from),
        () => {
          amount = 0;
          power = 0;
          taut = 0;
          hand = null;
          clear();
        }
      ).finally(() => {
        leaving = false;
      });
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
    };
  }, []);

  return (
    <>
      <svg ref={svgRef} className={`${styles.torn} ${styles.peel} ${styles.peelFold}`} aria-hidden>
        <defs>
          <linearGradient id="peel-flap" gradientUnits="userSpaceOnUse">
            <stop offset="0" />
            <stop offset="0.18" />
            <stop offset="1" />
          </linearGradient>
          <linearGradient id="peel-shade-right">
            <stop offset="0" stopColor="#000" stopOpacity="0.34" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="peel-shade-below" x2="0" y2="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.34" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </linearGradient>
          {/* Centred on the flap's corner, so it meets both strips with the same falloff. */}
          <radialGradient id="peel-shade-corner" cx="0" cy="0" r="1">
            <stop offset="0" stopColor="#000" stopOpacity="0.34" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
        </defs>
        <g data-fold opacity={0}>
          <polygon />
          <rect fill="url(#peel-shade-right)" y={0} width={SHADE} />
          <rect fill="url(#peel-shade-below)" x={0} height={SHADE} />
          <rect fill="url(#peel-shade-corner)" width={SHADE} height={SHADE} />
          <polygon fill="url(#peel-flap)" />
          <line className={styles.peelCrease} y1={0} x2={0} />
        </g>
      </svg>
      {/* The threads are a layer of their own, so they can fade off the sheet as it peels. */}
      <svg
        ref={threadsRef}
        className={`${styles.torn} ${styles.peel} ${styles.peelThreads}`}
        aria-hidden
      >
        {Array.from({ length: THREADS }, (_, i) => (
          <g key={i} data-thread opacity={0}>
            <line className={styles.tetherLine} />
            <rect className={styles.tetherMark} width={5} height={5} />
          </g>
        ))}
        <circle className={styles.tetherMark} r={3.5} opacity={0} />
      </svg>
      {/* The turned-over flap that rides the fold as the sheet peels (peel-transition.ts). */}
      <div ref={flapRef} className={`${styles.torn} ${styles.peelFlap}`} aria-hidden>
        <div className={styles.peelBand} />
      </div>
    </>
  );
}
