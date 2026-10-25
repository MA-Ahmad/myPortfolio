import { type KeyboardEvent, type PointerEvent, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { BookmarkIcon, Layers3Icon, ShuffleIcon, SparklesIcon } from 'lucide-react';
import { MOVIES } from './movies';
import { type RackScene, createRackScene } from './rack-scene';
import styles from './movie-rack.module.css';

const COUNT = MOVIES.length;
const START = 6;

// The ruler is a tape of ticks sliding under a fixed needle: four ticks per film.
const TICKS_PER_MOVIE = 4;
const TICK_SPACING = 7;
const TICK_SLOTS = 91;
const HALF_SLOTS = (TICK_SLOTS - 1) / 2;
// Width of the swell of taller, brighter ticks around the needle, in px.
const BELL = 26;

const EASE_OUT = [0.22, 1, 0.36, 1] as const;

// The ruler's number rolls like an iOS picker: up when moving forward, down when moving back.
const ROLL = {
  enter: (direction: number) => ({ y: direction * 12, opacity: 0, filter: 'blur(2px)' }),
  center: { y: 0, opacity: 1, filter: 'blur(0px)' },
  exit: (direction: number) => ({ y: direction * -12, opacity: 0, filter: 'blur(2px)' })
};

/**
 * A rack of CD jewel cases you scroll through; the case in focus slides out to show its cover.
 * Rendered with three.js (lit, glossy cases with soft shadows and depth of field) and driven by a
 * single animation loop, so the rack, the ruler and the backdrop always move together.
 * Inspired by Breeje Anadkat's iOS movie picker.
 */
export default function MovieRack() {
  const reduced = useReducedMotion() ?? false;
  const rootRef = useRef<HTMLElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<RackScene | null>(null);
  const tickRefs = useRef<(HTMLSpanElement | null)[]>([]);

  const [index, setIndex] = useState(START);
  // Which way the counter rolls: the shorter way round the loop from the last film shown. Set in
  // the same update as the index, so the incoming number enters from the right side.
  const [direction, setDirection] = useState(1);
  const lastIndex = useRef(START);
  const [picking, setPicking] = useState(false);
  // False while the rack arrives or leaves; the title stays blurred until the focused case is out.
  const [revealed, setRevealed] = useState(false);
  const [picked, setPicked] = useState<number | null>(START);
  const [saved, setSaved] = useState<Set<string>>(() => new Set());
  const [failed, setFailed] = useState(false);

  const movie = MOVIES[index];

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return;

    const updateRuler = (position: number) => {
      const tape = position * TICKS_PER_MOVIE;
      const base = Math.round(tape);
      for (let j = 0; j < TICK_SLOTS; j++) {
        const tick = tickRefs.current[j];
        if (!tick) continue;
        const n = base + j - HALF_SLOTS;
        const x = (n - tape) * TICK_SPACING;
        const swell = Math.exp(-(x * x) / (2 * BELL * BELL));
        const major = ((n % TICKS_PER_MOVIE) + TICKS_PER_MOVIE) % TICKS_PER_MOVIE === 0;
        tick.style.transform = `translate3d(${x}px, 0, 0) scaleY(${0.28 + 0.72 * swell})`;
        tick.style.opacity = String((major ? 0.55 : 0.28) + 0.45 * swell);
      }
    };

    let scene: RackScene;
    try {
      scene = createRackScene({
        canvas,
        movies: MOVIES,
        start: START,
        reduced,
        onFrame: updateRuler,
        onReveal: setRevealed,
        onIndex: (next) => {
          const delta = (((next - lastIndex.current) % COUNT) + COUNT) % COUNT;
          if (delta) setDirection(delta <= COUNT / 2 ? 1 : -1);
          lastIndex.current = next;
          setIndex(next);
        }
      });
    } catch {
      setFailed(true);
      return;
    }
    sceneRef.current = scene;
    updateRuler(START);

    const observer = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      scene.resize(width, height);
    });
    observer.observe(root);

    // Wheel and trackpad scroll the rack while the pointer is over it.
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const scale = event.deltaMode === 1 ? 16 : 1;
      const delta = (Math.abs(event.deltaY) > Math.abs(event.deltaX) ? event.deltaY : event.deltaX) * scale;
      setPicking(false);
      // The cases slide out from under a still mouse, so drop the lift until it moves again.
      scene.hover(null);
      scene.wheel(delta / 110);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });

    return () => {
      observer.disconnect();
      canvas.removeEventListener('wheel', onWheel);
      scene.dispose();
      sceneRef.current = null;
    };
  }, [reduced]);

  // Pointer on the rack: a drag scrolls it along its diagonal, a tap brings that case forward.
  const press = useRef<{ x: number; y: number; dragging: boolean } | null>(null);

  const onPointerDown = (event: PointerEvent<HTMLCanvasElement>) => {
    press.current = { x: event.clientX, y: event.clientY, dragging: false };
  };

  const onPointerMove = (event: PointerEvent<HTMLCanvasElement>) => {
    const scene = sceneRef.current;
    const canvas = event.currentTarget;
    if (!scene) return;
    const state = press.current;
    if (!state) {
      // Hover lift is for a mouse only; on touch a tap would leave a case raised.
      if (event.pointerType !== 'mouse') return;
      const rect = canvas.getBoundingClientRect();
      const over = scene.hover({
        x: event.clientX - rect.left,
        y: event.clientY - rect.top,
        width: rect.width,
        height: rect.height
      });
      canvas.style.cursor = over ? 'pointer' : 'grab';
      return;
    }
    const dx = event.clientX - state.x;
    const dy = event.clientY - state.y;
    if (!state.dragging) {
      if (Math.hypot(dx, dy) < 4) return;
      state.dragging = true;
      scene.hover(null);
      canvas.setPointerCapture(event.pointerId);
      canvas.style.cursor = 'grabbing';
      setPicking(false);
      scene.dragStart();
    }
    scene.dragBy(dx, dy, canvas.clientWidth, canvas.clientHeight);
    state.x = event.clientX;
    state.y = event.clientY;
  };

  const onPointerUp = (event: PointerEvent<HTMLCanvasElement>) => {
    const scene = sceneRef.current;
    const state = press.current;
    press.current = null;
    if (!scene || !state) return;
    if (state.dragging) {
      scene.dragEnd();
      event.currentTarget.style.cursor = 'grab';
      return;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    const target = scene.hit(event.clientX - rect.left, event.clientY - rect.top, rect.width, rect.height);
    if (target !== null) {
      setPicking(false);
      scene.goTo(target);
    }
  };

  // The ruler scrubs like a tape: drag it and the rack follows, flick it and it coasts.
  const scrub = useRef<{ x: number } | null>(null);

  const onRulerDown = (event: PointerEvent<HTMLDivElement>) => {
    scrub.current = { x: event.clientX };
    event.currentTarget.setPointerCapture(event.pointerId);
    setPicking(false);
    sceneRef.current?.dragStart();
  };

  const onRulerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!scrub.current) return;
    const dx = event.clientX - scrub.current.x;
    scrub.current.x = event.clientX;
    sceneRef.current?.dragByCases(-dx / (TICK_SPACING * TICKS_PER_MOVIE));
  };

  const onRulerUp = () => {
    if (!scrub.current) return;
    scrub.current = null;
    sceneRef.current?.dragEnd();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    const keys: Record<string, number> = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 };
    if (!(event.key in keys) || (event.target as HTMLElement).closest('button')) return;
    event.preventDefault();
    setPicking(false);
    sceneRef.current?.step(keys[event.key]);
  };

  const pick = () => {
    const scene = sceneRef.current;
    if (!scene || picking) return;
    setPicking(true);
    scene.pick((landed) => {
      setPicking(false);
      setPicked(landed);
    });
  };

  const isSaved = saved.has(movie.id);
  const toggleSaved = () =>
    setSaved((current) => {
      const next = new Set(current);
      if (next.has(movie.id)) next.delete(movie.id);
      else next.add(movie.id);
      return next;
    });

  return (
    <section
      ref={rootRef}
      className={styles.root}
      tabIndex={0}
      onKeyDown={onKeyDown}
      aria-roledescription="carousel"
      aria-label="Movie rack. Drag, scroll or use the arrow keys to browse."
    >
      <canvas
        ref={canvasRef}
        className={styles.canvas}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={() => {
          if (!press.current && canvasRef.current) canvasRef.current.style.cursor = '';
          sceneRef.current?.hover(null);
        }}
        aria-hidden
      />
      {/* Softens only the far left and right edges of the screen; the cases themselves stay sharp. */}
      <div className={styles.edgeBlur} aria-hidden />
      {failed && <p className={styles.fallback}>This needs WebGL, which isn’t available in this browser.</p>}

      <header className={styles.header} data-picking={picking || !revealed || undefined}>
        <div className={styles.titleSlot} aria-live={picking ? 'off' : 'polite'}>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={movie.id}
              initial={{ opacity: 0, y: 6, filter: 'blur(4px)' }}
              animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -6, filter: 'blur(4px)' }}
              transition={{ duration: 0.22, ease: EASE_OUT }}
              className={styles.titleBlock}
            >
              <h2 className={styles.title}>{movie.title}</h2>
              <p className={styles.meta}>
                {movie.year} <span aria-hidden>·</span> {movie.genre} <span aria-hidden>·</span> {movie.runtime}
              </p>
            </motion.div>
          </AnimatePresence>
        </div>

        <div className={styles.pillSlot}>
          <AnimatePresence mode="popLayout" initial={false}>
            {(picking || picked === index) && (
              <motion.span
                key={picking ? 'picking' : 'picked'}
                className={`${styles.glass} ${styles.pill}`}
                initial={{ opacity: 0, scale: 0.94, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                exit={{ opacity: 0, scale: 0.94, filter: 'blur(4px)' }}
                transition={{ duration: 0.2, ease: EASE_OUT }}
              >
                <SparklesIcon className={styles.pillIcon} aria-hidden />
                {picking ? 'Picking…' : 'Tonight’s pick'}
              </motion.span>
            )}
          </AnimatePresence>
        </div>
      </header>

      <footer className={styles.footer}>
        <div
          className={styles.ruler}
          onPointerDown={onRulerDown}
          onPointerMove={onRulerMove}
          onPointerUp={onRulerUp}
          onPointerCancel={onRulerUp}
          role="slider"
          aria-label="Position in rack"
          aria-valuemin={1}
          aria-valuemax={COUNT}
          aria-valuenow={index + 1}
          aria-valuetext={movie.title}
        >
          <div className={styles.tape}>
            {Array.from({ length: TICK_SLOTS }, (_, j) => (
              <span
                key={j}
                ref={(el) => {
                  tickRefs.current[j] = el;
                }}
                className={styles.tick}
              />
            ))}
          </div>
          <div className={styles.needle} />
          <span className={`${styles.glass} ${styles.counter}`}>
            <AnimatePresence initial={false} custom={direction}>
              <motion.span
                key={index}
                custom={direction}
                variants={ROLL}
                initial="enter"
                animate="center"
                exit="exit"
                transition={{ duration: 0.18, ease: EASE_OUT }}
                className={styles.counterValue}
              >
                {index + 1}
              </motion.span>
            </AnimatePresence>
          </span>
        </div>

        <div className={styles.controls}>
          <button
            type="button"
            className={`${styles.glass} ${styles.iconButton}`}
            onClick={toggleSaved}
            aria-pressed={isSaved}
            aria-label={isSaved ? `Remove ${movie.title} from saved` : `Save ${movie.title}`}
          >
            <BookmarkIcon className={styles.icon} fill={isSaved ? 'currentColor' : 'none'} />
          </button>
          <button type="button" className={`${styles.glass} ${styles.primary}`} onClick={pick} disabled={picking}>
            <ShuffleIcon className={styles.icon} aria-hidden />
            Pick for me
          </button>
          <button
            type="button"
            className={`${styles.glass} ${styles.iconButton}`}
            onClick={() => sceneRef.current?.replay()}
            aria-label="Restack the rack"
          >
            <Layers3Icon className={styles.icon} />
          </button>
        </div>
      </footer>
    </section>
  );
}
