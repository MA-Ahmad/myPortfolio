import {
  type CSSProperties,
  type ReactNode,
  memo,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import { GAP, INTRO_TEAR_MS, type Seam, type SeamState, type Sheet, TEAR_MS } from './sheet';
import { Welder } from './welder';
import { ditherStore, drawDitherSky } from './dither-sky';
import { drawPixelSky, skyStore } from './pixel-sky';
import { playTear, playWeld } from './sound';
import { type Axis, type Edge, fibresOf, gapShape, pointsOf, type Point } from './tear';
import { gapAt, isZip, shutAt, taperOf, track, Weld, WELD_MS, type WeldKind } from './welds';
import styles from './torn.module.css';

/** How far a piece reaches past a seam's centre line, for the tear to wander into. */
const REACH = 32;
/** A weld starts a beat after the click. */
const DELAY = 220;
/** On load the sheet shows whole this long before its seams crack open, left to right. */
const INTRO_HOLD = 650;
const INTRO_STAGGER = 140;

const narrow = '(max-width: 719px)';
const subscribeTo = (query: string) => (listener: () => void) => {
  const list = window.matchMedia(query);
  list.addEventListener('change', listener);
  return () => list.removeEventListener('change', listener);
};
const useMedia = (query: string) =>
  useSyncExternalStore(
    subscribeTo(query),
    () => window.matchMedia(query).matches,
    () => false
  );

const useSheet = (sheet: Sheet) =>
  useSyncExternalStore(sheet.subscribe, sheet.get, sheet.getInitial);

/**
 * Moves the sheet as sections open: every seam left of the open section is welded shut, every
 * seam right of it is torn. Opening a section further right welds the seam beside it, and shuts any
 * it skipped past at once; opening one further left tears the seams past it apart again, right to
 * left.
 * Under reduced motion seams simply switch. Stacked on a phone, the sheet stays whole: every seam
 * is welded shut, whichever section is open, so the rows read as one sheet with fine healed seams
 * rather than a stack of open cracks.
 */
export function SheetRunner({ sheet, weld, open }: { sheet: Sheet; weld: WeldKind; open: number }) {
  const reduced = useMedia('(prefers-reduced-motion: reduce)');
  const stacked = useMedia(narrow);
  const starts = useRef<number[]>([]);
  const finishes = useRef<number[]>([]);
  const mounted = useRef<number | null>(null);

  useEffect(
    () => () => {
      [...starts.current, ...finishes.current].forEach(clearTimeout);
      sheet.reset();
    },
    [sheet]
  );

  useEffect(() => {
    starts.current.forEach(clearTimeout);
    starts.current = [];
    const states = sheet.get();
    if (stacked) {
      states.forEach((state, i) => state !== 'welded' && sheet.set(i, 'welded'));
      return;
    }
    if (reduced) {
      states.forEach((_, i) => sheet.set(i, i < open ? 'welded' : 'torn'));
      return;
    }
    mounted.current ??= performance.now();

    // Each step ends only if nothing has moved the seam on since it started.
    const run = (i: number, state: 'welding' | 'tearing', done: SeamState, ms: number) => {
      sheet.set(i, state, ms);
      const started = sheet.started[i];
      finishes.current.push(
        window.setTimeout(() => {
          if (sheet.get()[i] === state && sheet.started[i] === started) sheet.set(i, done);
        }, ms)
      );
    };
    const at = (ms: number, step: () => void) => starts.current.push(window.setTimeout(step, ms));

    // On load the sheet is whole. After a beat its seams crack and ease apart, left to right; any
    // left of a section opened meanwhile simply stay shut.
    const hold = Math.max(0, mounted.current + INTRO_HOLD - performance.now());
    states
      .map((state, i) => ({ state, i }))
      .filter(({ state }) => state === 'sealed')
      .forEach(({ i }, k) =>
        i < open
          ? sheet.set(i, 'welded')
          : at(hold + k * INTRO_STAGGER, () => {
              if (sheet.get()[i] === 'sealed') run(i, 'tearing', 'torn', INTRO_TEAR_MS);
            })
      );

    const tear = states
      .map((state, i) => ({ state, i }))
      .filter(({ state, i }) => i >= open && (state === 'welded' || state === 'welding'))
      .map(({ i }) => i)
      .reverse();
    if (tear.length) playTear();
    tear.forEach((i, k) => at(k * 50, () => run(i, 'tearing', 'torn', TEAR_MS)));

    const join = states
      .map((state, i) => ({ state, i }))
      .filter(({ state, i }) => i < open && (state === 'torn' || state === 'tearing'))
      .map(({ i }) => i);
    // A seam still springing open finishes tearing before it welds, so its gap never jumps.
    const start = (i: number) => {
      // Welded by hand: the bead is already laid, so it simply shuts.
      if (sheet.takeByHand(i)) return sheet.set(i, 'welded');
      if (sheet.get()[i] === 'tearing') {
        const left = sheet.started[i] + sheet.span(i) - performance.now();
        if (left > 0) return at(left + 16, () => start(i));
      }
      run(i, 'welding', 'welded', WELD_MS);
      playWeld(weld);
    };
    // Only the seam beside the opened section is welded on screen; any it skipped past shut at once.
    // A seam clicked at a point welds at once, from there, taking over from its spark.
    join.forEach((i) =>
      i === open - 1 ? at(sheet.aimed(i) ? 0 : DELAY, () => start(i)) : sheet.set(i, 'welded')
    );
  }, [sheet, weld, reduced, stacked, open]);

  return null;
}

/**
 * The sheet's surface, drawn once under all the pieces: the torn gaps are cut over it, so its light
 * runs straight across the seams, and nothing about it changes while the sections resize, except
 * the moon, which moves over to the open section on the columns' own timing.
 */
export function SheetSurface({ open, count }: { open: number; count: number }) {
  return (
    <div
      className={`${styles.torn} ${styles.surface}`}
      style={{ '--open': open, '--count': count } as CSSProperties}
      aria-hidden
    >
      {/* The night sky's dithered band and pixels, the moon in its glow, faded out by day; the day's clouds on top. */}
      <DitherSky />
      <PixelSky />
      <div className={styles.glow} />
      <div className={styles.moon} />
      <div className={`${styles.sky} ${styles.clouds}`} />
    </div>
  );
}

/**
 * A dithered band of colour across the night sky (see dither-sky.ts), off unless its config turns
 * it on; redrawn when the sheet resizes.
 */
function DitherSky() {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useSyncExternalStore(
    ditherStore.subscribe,
    ditherStore.get,
    ditherStore.getServer
  );
  const on = config.enabled > 0;
  useEffect(() => {
    if (!on) return;
    const canvas = ref.current!;
    const surface = canvas.parentElement!;
    let size = '';
    const draw = () => {
      const next = `${surface.clientWidth}x${surface.clientHeight}`;
      if (next === size) return;
      size = next;
      drawDitherSky(canvas, surface.clientWidth, surface.clientHeight, config);
    };
    draw();
    canvas.dataset.drawn = '';
    // A draw takes tens of ms, too long for every frame of a window resize: the drawn canvas
    // stretches meanwhile, and it's redrawn once the size settles.
    let timer = 0;
    const observer = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(draw, 150);
    });
    observer.observe(surface);
    return () => {
      observer.disconnect();
      window.clearTimeout(timer);
    };
  }, [config, on]);
  if (!on) return null;
  return (
    <canvas
      ref={ref}
      // With cards on, the panes put their text on glass cards over the sky (see .group).
      data-dither-sky={config.cards > 0 ? '' : undefined}
      className={`${styles.sky} ${styles.ditherSky}`}
      style={{ '--dither': config.opacity } as CSSProperties}
    />
  );
}

/**
 * The night sky's pixels along the top, faded out by day, redrawn when the sheet resizes
 * or its config changes.
 */
function PixelSky() {
  const ref = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<HTMLDivElement>(null);
  const config = useSyncExternalStore(skyStore.subscribe, skyStore.get, skyStore.getServer);
  useEffect(() => {
    const canvas = ref.current!;
    const stars = starsRef.current!;
    const surface = canvas.parentElement!;
    const draw = () => {
      const twinkling = drawPixelSky(canvas, surface.clientWidth, surface.clientHeight, config);
      // Each twinkle is a static glow whose opacity loops, on its own period and phase, so only a
      // few are ever lit at once.
      stars.replaceChildren(
        ...twinkling.map(({ x, y, size, pick }) => {
          const star = document.createElement('span');
          const period = config.period * (0.7 + 0.6 * ((pick * 7919) % 1));
          star.className = styles.twinkle;
          star.style.cssText = `left:${x}px;top:${y}px;width:${size}px;height:${size}px;--period:${period.toFixed(2)}s;--delay:${(-period * ((pick * 104729) % 1)).toFixed(2)}s`;
          return star;
        })
      );
    };
    draw();
    // Drawn only once the page runs, so the field fades in rather than popping onto the sky.
    canvas.dataset.drawn = '';
    stars.dataset.drawn = '';
    const observer = new ResizeObserver(draw);
    observer.observe(surface);
    return () => observer.disconnect();
  }, [config]);
  return (
    <>
      <canvas
        ref={ref}
        className={`${styles.sky} ${styles.pixelSky}`}
        style={{ '--sky-night': config.night } as CSSProperties}
      />
      <div
        ref={starsRef}
        className={`${styles.sky} ${styles.twinkles}`}
        style={{ '--glow': `${config.glow}px`, '--sparkle': config.sparkle } as CSSProperties}
      />
    </>
  );
}

/** A pull gives less with each px, at this scale (px), so the weld feels like it's holding. */
const RESIST = 110;
/** Let go once the pull has reached this far, and the seam tears open. */
const TEAR_AT = 0.55;
/** Past FULL the crack is a full gap wide; pulled on, it keeps opening, slower, up to WIDEST. */
const FULL = 0.8;
const FULL_PX = -RESIST * Math.log(1 - FULL);
const WIDEST = 2.4;
const STRETCH = 300;

/**
 * How far a drag of `distance` px has pulled a welded seam: rising quickly at first and easing
 * off, to FULL; beyond that it keeps going, slowly, for pulls well past the tearing point.
 */
function pullOf(distance: number) {
  const d = Math.max(0, distance);
  if (d <= FULL_PX) return 1 - Math.exp(-d / RESIST);
  return FULL + FULL * (1 - Math.exp(-(d - FULL_PX) / STRETCH));
}

/**
 * A welded seam being pulled open, at `along`, as a share of the full gap: a crack from the point
 * it was grabbed (`at`), widest there and tapering out, running further along the seam the
 * harder it is pulled. Up to FULL it opens to one gap; pulled further it widens on to WIDEST.
 */
function crackAt(pull: number, at: number, length: number, along: number) {
  const reach = 40 + Math.min(1, pull) * length;
  const f = 1 - Math.abs(along - at) / reach;
  if (f <= 0) return 0;
  const width = pull <= FULL ? pull / FULL : 1 + ((WIDEST - 1) * (pull - FULL)) / FULL;
  return width * f ** 1.6;
}

/** How open a seam is at `along`, `at` ms on the performance clock, in px from its centre line. */
function gapOf(sheet: Sheet, kind: WeldKind, states: SeamState[], index: number, length: number) {
  const state = states[index];
  const started = sheet.started[index];
  const from = sheet.from[index];
  const origin = sheet.origin[index];
  const crack = sheet.crack[index];
  return (at: number) => (along: number) => {
    if (state === 'torn') return GAP;
    if (state === 'welded' || state === 'sealed') return 0;
    if (state === 'welding') return GAP * gapAt(kind, at - started, along, length, origin);
    const before = crack
      ? crack(along)
      : from === null
        ? 0
        : gapAt(kind, from, along, length, origin);
    return GAP * (before + (1 - before) * sheet.opening(index, at - started));
  };
}

type PieceProps = {
  sheet: Sheet;
  index: number;
  weld: WeldKind;
  /** Welds the piece's end seam, by opening the section past it. */
  onJoin: () => void;
  /** Tears the piece's end seam open, by opening this piece's section. */
  onTear: () => void;
};

/**
 * One section's piece of the sheet: its surface, cut along the tears it shares with its
 * neighbours. Both neighbours draw a seam's tear from its centre line with the same gap, so their
 * edges always match; welding closes the gap. The piece also draws the weld on its end seam, over
 * both neighbours.
 */
export function TornPiece({ sheet, index, weld, onJoin, onTear }: PieceProps) {
  const states = useSheet(sheet);
  const h = useMedia(narrow);
  const axis: Axis = h ? 'h' : 'v';
  const boxRef = useRef<HTMLDivElement>(null);
  const gapRefs = useRef<Partial<Record<Axis, HTMLDivElement | null>>>({});
  const [size, setSize] = useState({ v: 0, h: 0 });

  const first = index === 0;
  const last = index === sheet.count - 1;
  const startSeam = first ? null : sheet.seams[index - 1];
  const endSeam = last ? null : sheet.seams[index];
  const reach: [number, number] = [first ? 0 : REACH, last ? 0 : REACH];
  // The seam's length: the piece's height when sections sit side by side, its width when stacked.
  const lengths = { v: size.v || 1600, h: size.h || 760 };

  // Only the seam length on the current layout: the other one changes on every frame while the
  // columns resize, and nothing needs it.
  useLayoutEffect(() => {
    const box = boxRef.current!;
    const measure = () => {
      const length = Math.round(axis === 'v' ? box.offsetHeight : box.offsetWidth);
      setSize((size) => (size[axis] === length ? size : { ...size, [axis]: length }));
    };
    const observer = new ResizeObserver(measure);
    observer.observe(box);
    return () => observer.disconnect();
  }, [axis]);

  // The gap in the end seam: page showing through the sheet, between the two torn edges.
  const endState = endSeam ? states[index] : 'welded';
  const startState = startSeam ? states[index - 1] : 'welded';
  const gap = (on: Axis, at: number) => {
    if (!endSeam) return 'none';
    const length = lengths[on];
    const edge: Edge = { tear: endSeam[on], gap: gapOf(sheet, weld, states, index, length)(at) };
    return gapShape(edge, length);
  };

  // While the seam welds or tears, its gap follows frame by frame.
  // gap reads states, axis and the measured lengths, all listed.
  /* eslint-disable react-hooks/exhaustive-deps */
  useEffect(() => {
    if (endState !== 'welding' && endState !== 'tearing') return;
    const now = performance.now();
    const duration =
      sheet.started[index] + (endState === 'welding' ? WELD_MS : sheet.span(index)) - now;
    if (duration <= 0) return;
    const animation = gapRefs.current[axis]!.animate(
      track(duration, (t) => ({ clipPath: gap(axis, now + t) })),
      { duration, fill: 'forwards' }
    );
    return () => animation.cancel();
  }, [endState, axis, lengths[axis]]);

  // At rest it changes only when the seam changes state or the piece resizes.
  const gapV = useMemo(() => gap('v', 0), [endState, lengths.v]);
  const gapH = useMemo(() => gap('h', 0), [endState, lengths.h]);
  /* eslint-enable react-hooks/exhaustive-deps */

  // A welded seam being pulled: its gap follows the pointer as a crack, written straight to the
  // strip. Once the seam moves on, React's clip takes over again.
  const pull = (amount: number, at: number) => {
    const element = gapRefs.current[axis];
    if (!element || !endSeam) return;
    const length = lengths[axis];
    element.dataset.pull = '';
    element.style.clipPath = gapShape(
      { tear: endSeam[axis], gap: (along) => GAP * crackAt(amount, at, length, along) },
      length
    );
  };
  const settle = () => {
    const element = gapRefs.current[axis];
    if (!element) return;
    delete element.dataset.pull;
    element.style.clipPath = gap(axis, 0);
  };
  const tear = (amount: number, at: number) => {
    const length = lengths[axis];
    sheet.pulled(index, (along) => crackAt(amount, at, length, along));
    onTear();
    // Stacked, the seam stays welded while the section opens, so the pulled crack closes again.
    if (h) settle();
  };

  useEffect(() => {
    if (endState === 'welded') return;
    Object.values(gapRefs.current).forEach((element) => {
      if (element) delete element.dataset.pull;
    });
  }, [endState]);

  const style = {
    '--rs': `${reach[0]}px`,
    '--re': `${reach[1]}px`,
    // A seam's centre line is the middle of the grid gap, half of it past the section's edge.
    '--fs': first ? '0px' : `calc(var(--pn-gap) / 2 + ${REACH}px)`,
    '--fe': last ? '0px' : `calc(var(--pn-gap) / 2 + ${REACH}px)`,
    '--length-h': `${lengths.h}px`
  } as CSSProperties;

  const edgeProps = { kind: weld, sheet };

  return (
    <div
      className={styles.torn}
      data-weld={weld}
      data-first={first ? '' : undefined}
      data-last={last ? '' : undefined}
      style={style}
    >
      <div ref={boxRef} className={`${styles.frame} ${styles.box}`}>
        {startSeam && (
          <Seams side="start" seam={index - 1} state={startState} intro={sheet.intro(index - 1)}>
            {(on) => (
              <Edges
                {...edgeProps}
                seam={startSeam}
                index={index - 1}
                state={startState}
                on={on}
                length={lengths[on]}
                side={1}
              />
            )}
          </Seams>
        )}
        {endSeam && (
          <Seams side="end" seam={index} state={endState} intro={sheet.intro(index)}>
            {(on) => (
              <Edges
                {...edgeProps}
                seam={endSeam}
                index={index}
                state={endState}
                on={on}
                length={lengths[on]}
                side={-1}
              />
            )}
          </Seams>
        )}
      </div>

      {endSeam && (
        <div className={`${styles.frame} ${styles.gaps}`}>
          <Seams side="end" seam={index} state={endState} intro={sheet.intro(index)}>
            {(on) => (
              <div
                ref={(element) => {
                  gapRefs.current[on] = element;
                }}
                className={styles.gap}
                data-gap
                style={{ clipPath: on === 'v' ? gapV : gapH }}
              />
            )}
          </Seams>
        </div>
      )}

      {endSeam && (
        <div className={`${styles.frame} ${styles.overlay}`}>
          <Seams side="end" seam={index} state={endState} intro={sheet.intro(index)}>
            {(on) => (
              <>
                {/* An interrupted weld stays to fade out while the seam tears open. */}
                {(endState === 'welding' ||
                  (endState === 'tearing' && sheet.from[index] !== null)) &&
                  on === axis && (
                    <div className={styles.fading}>
                      <Weld
                        kind={weld}
                        tear={endSeam[on]}
                        seed={endSeam.seed}
                        length={lengths[on]}
                        origin={sheet.origin[index]}
                      />
                    </div>
                  )}
                {endState === 'welded' && on === axis && (
                  <Grip axis={on} onPull={pull} onSettle={settle} onTear={tear} />
                )}
                {/* Torn, the seam can be welded by hand; shut, the bead laid by hand stays drawn. */}
                {on === axis &&
                  axis === 'v' &&
                  (endState === 'torn' || (endState === 'welded' && sheet.bead(index))) && (
                    <Welder
                      sheet={sheet}
                      index={index}
                      tear={endSeam[on]}
                      length={lengths[on]}
                      live={endState === 'torn'}
                      onDone={(along) => {
                        sheet.aim(index, along);
                        onJoin();
                      }}
                    />
                  )}
              </>
            )}
          </Seams>
        </div>
      )}
    </div>
  );
}

/**
 * A grab strip over a welded seam. Pressed and dragged across the seam (right, or down when the
 * sections stack), the seam cracks open from where it was grabbed, giving less the further it goes;
 * let go past TEAR_AT and it tears open, otherwise the crack closes up again. It adds a gesture
 * for opening the section, which the section's own button and the arrow keys already do, so it is
 * hidden from assistive tech.
 */
function Grip({
  axis,
  onPull,
  onSettle,
  onTear
}: {
  axis: Axis;
  onPull: (amount: number, at: number) => void;
  onSettle: () => void;
  onTear: (amount: number, at: number) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const handlers = useRef({ onPull, onSettle, onTear });
  useEffect(() => {
    handlers.current = { onPull, onSettle, onTear };
  }, [onPull, onSettle, onTear]);

  useEffect(() => {
    const grip = ref.current!;
    let start: { x: number; y: number; at: number } | null = null;
    let amount = 0;
    let frame = 0;
    let lastAt = 0;

    const release = () => {
      start = null;
      delete grip.dataset.pulling;
      const from = amount;
      const at = lastAt;
      if (from <= 0) return handlers.current.onSettle();
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        amount = 0;
        return handlers.current.onSettle();
      }
      // The crack closes on a short ease-out, as if the weld pulled it back together.
      const began = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - began) / 240);
        amount = from * (1 - t) ** 3;
        if (t < 1) {
          handlers.current.onPull(amount, at);
          frame = requestAnimationFrame(step);
        } else {
          amount = 0;
          handlers.current.onSettle();
        }
      };
      frame = requestAnimationFrame(step);
    };

    const onDown = (event: PointerEvent) => {
      if (event.button !== 0) return;
      event.preventDefault();
      cancelAnimationFrame(frame);
      grip.setPointerCapture(event.pointerId);
      const box = grip.getBoundingClientRect();
      lastAt = axis === 'v' ? event.clientY - box.top : event.clientX - box.left;
      start = { x: event.clientX, y: event.clientY, at: lastAt };
      grip.dataset.pulling = '';
    };
    // The glint on the scar follows the pointer along the seam.
    const glint = grip
      .closest('[data-weld]')
      ?.querySelector<HTMLElement>(`[data-side='end'][data-axis='${axis}'] [data-glint]`);
    const onMove = (event: PointerEvent) => {
      const box = grip.getBoundingClientRect();
      const along = axis === 'v' ? event.clientY - box.top : event.clientX - box.left;
      glint?.style.setProperty('--grip-y', `${(start ? start.at : along).toFixed(1)}px`);
      if (!start) return;
      const distance = axis === 'v' ? event.clientX - start.x : event.clientY - start.y;
      amount = pullOf(distance);
      handlers.current.onPull(amount, start.at);
    };
    const onUp = () => {
      if (!start) return;
      if (amount >= TEAR_AT) {
        start = null;
        delete grip.dataset.pulling;
        return handlers.current.onTear(amount, lastAt);
      }
      release();
    };

    grip.addEventListener('pointerdown', onDown);
    grip.addEventListener('pointermove', onMove);
    grip.addEventListener('pointerup', onUp);
    grip.addEventListener('pointercancel', release);
    return () => {
      grip.removeEventListener('pointerdown', onDown);
      grip.removeEventListener('pointermove', onMove);
      grip.removeEventListener('pointerup', onUp);
      grip.removeEventListener('pointercancel', release);
      cancelAnimationFrame(frame);
    };
  }, [axis]);

  return <div ref={ref} className={styles.grip} aria-hidden />;
}

/**
 * A seam's drawing space, twice: down the seam when sections sit side by side, and across it when
 * they stack (CSS shows the one that applies). Inside, x is across the seam from its centre line
 * and y runs along it, so everything on a seam is drawn once in seam space.
 */
function Seams({
  side,
  seam,
  state,
  intro,
  children
}: {
  side: 'start' | 'end';
  /** Which seam this is, so the hand welder can find its gap and edges. */
  seam: number;
  state: SeamState;
  /** On its first tear the seam was never welded, so it has no scar to show. */
  intro: boolean;
  children: (on: Axis) => ReactNode;
}) {
  return (
    <>
      {(['v', 'h'] as const).map((on) => (
        <div
          key={on}
          className={styles.seam}
          data-axis={on}
          data-side={side}
          data-seam-index={seam}
          data-state={state}
          data-intro={intro && state === 'tearing' ? '' : undefined}
        >
          {children(on)}
        </div>
      ))}
    </>
  );
}

type EdgeProps = {
  kind: WeldKind;
  sheet: Sheet;
  seam: Seam;
  index: number;
  state: SeamState;
  on: Axis;
  length: number;
  /** Which side of the seam the piece is on: 1 after it, -1 before it. */
  side: 1 | -1;
};

/**
 * One piece's torn edge: a narrow band of torn core with a few fibres, standing back from the
 * centre line by the gap while the seam is open, and following it in as the seam welds; the gap,
 * drawn over it, hides the half that lies in the gap. Once shut, all that's left is a faint scar on
 * the line itself. Memoized: a piece re-renders whenever any seam moves, its edges only when theirs
 * does.
 */
const Edges = memo(function Edges({
  kind,
  sheet,
  seam,
  index,
  state,
  on,
  length,
  side
}: EdgeProps) {
  const ref = useRef<HTMLDivElement>(null);
  const tear: Point[] = seam[on];
  const points = pointsOf(tear);

  useEffect(() => {
    if (state !== 'welding' && state !== 'tearing') return;
    const elapsed = performance.now() - sheet.started[index];
    if (state === 'tearing') {
      const from = sheet.from[index];
      const before = from === null || isZip(kind) ? 0 : gapAt(kind, from, 0, length);
      const span = sheet.span(index);
      const frames = track(span, (t) => {
        const gap = before + (1 - before) * sheet.opening(index, t);
        return { transform: `translateX(${(side * GAP * gap).toFixed(2)}px)`, opacity: gap };
      });
      const animation = ref.current!.animate(frames, {
        duration: span,
        delay: -elapsed,
        fill: 'forwards'
      });
      return () => animation.cancel();
    }

    // Zip welds close behind their fronts, so the band is cut out where the seam has shut, just
    // ahead of each front; started midway, that leaves a stretch above and one below. The others
    // close all along at once, so the band moves in with the gap.
    const origin = sheet.origin[index];
    const frames = track(WELD_MS, (t) => {
      if (!isZip(kind)) {
        const gap = gapAt(kind, t, 0, length);
        const opacity = Math.min(1, Math.max(0, gap / 0.3));
        return { transform: `translateX(${(side * GAP * gap).toFixed(2)}px)`, opacity };
      }
      const [a, b] = shutAt(kind, t, length, origin, 0.7 * taperOf(kind)).map((v) => v.toFixed(1));
      return {
        transform: `translateX(${side * GAP}px)`,
        clipPath: `polygon(0 0, 100% 0, 100% ${a}px, 0 ${a}px, 0 ${b}px, 100% ${b}px, 100% 100%, 0 100%)`,
        opacity: 1
      };
    });
    const animation = ref.current!.animate(frames, {
      duration: WELD_MS,
      delay: -elapsed,
      fill: 'forwards'
    });
    return () => animation.cancel();
  }, [kind, sheet, index, state, length, side]);

  return (
    <>
      <div
        ref={ref}
        className={`${styles.plane} ${styles.open}`}
        data-edge
        style={{ '--side': side } as CSSProperties}
        aria-hidden
      >
        <svg className={styles.drawing}>
          <polyline points={points} className={styles.band} />
          <polyline points={points} className={styles.hair} />
          <path d={fibresOf(seam.seed + (on === 'h' ? 7 : 0), tear)} className={styles.fibre} />
        </svg>
      </div>
      {/* The scar lies on the centre line: the piece before the seam draws it for both. */}
      {side < 0 && (
        <div className={`${styles.plane} ${styles.scar}`} data-scar aria-hidden>
          <svg className={styles.drawing}>
            <polyline points={points} className={styles.scarShadow} />
            <polyline points={points} className={styles.scarBead} />
            <polyline points={points} className={styles.scarLight} />
          </svg>
        </div>
      )}
      {side < 0 && (
        <div className={`${styles.plane} ${styles.glint}`} data-glint aria-hidden>
          <svg className={styles.drawing}>
            <polyline points={points} className={styles.glintHalo} />
            <polyline points={points} />
          </svg>
        </div>
      )}
    </>
  );
});
