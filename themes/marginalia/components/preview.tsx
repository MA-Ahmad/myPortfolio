import {
  type PointerEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import {
  AnimatePresence,
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
  useTransform,
  useVelocity
} from 'framer-motion';
import styles from '../marginalia.module.css';

/**
 * A small card that follows the mouse over a phrase or a link and shows a glimpse of what is
 * behind it: a block's picture, a company's logo, the local time. Only on devices with a real
 * mouse; on touch the notes are the whole story.
 */

/** The card's width; its height follows its content. */
export const PREVIEW_W = 240;
/** How far the card sits from the cursor, and from the window's edges. */
const OFFSET = 18;
const EDGE = 12;
/** The first preview waits this long, so sweeping across the text doesn't flash cards. */
const DWELL_MS = 110;
/** Leaving a phrase waits this long before hiding, so moving to the next one swaps instantly. */
const GRACE_MS = 140;

/** Enter: a strong ease-out. Exit: quieter and quicker. */
const EASE_OUT = [0.32, 0.72, 0, 1] as const;
const ENTER = { duration: 0.2, ease: EASE_OUT };
const EXIT = { duration: 0.13, ease: [0.4, 0, 1, 1] as const };

type Preview = { key: string; node: ReactNode };
type Bind = (key: string, node: ReactNode) => {
  onPointerEnter: (event: PointerEvent) => void;
  onPointerMove: (event: PointerEvent) => void;
  onPointerLeave: () => void;
  onPointerDown: () => void;
};

const PreviewContext = createContext<{ bind: Bind; hide: () => void } | null>(null);

/** Handlers that show `node` beside the cursor while it is over the element they are spread on. */
export function usePreview() {
  return useContext(PreviewContext);
}

const FINE = '(hover: hover) and (pointer: fine)';
const subscribeFine = (change: () => void) => {
  const query = matchMedia(FINE);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
};

export function PreviewProvider({ children, preload }: { children: ReactNode; preload: string[] }) {
  const fine = useSyncExternalStore(subscribeFine, () => matchMedia(FINE).matches, () => false);
  const reduced = useReducedMotion();
  const [active, setActive] = useState<Preview | null>(null);

  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const origin = useMotionValue('0% 0%');
  // The card trails the cursor a little, and leans into fast sideways moves.
  const sx = useSpring(x, { stiffness: 520, damping: 42, mass: 0.6 });
  const sy = useSpring(y, { stiffness: 520, damping: 42, mass: 0.6 });
  const lean = useSpring(useTransform(useVelocity(sx), [-1800, 0, 1800], [-4, 0, 4]), {
    stiffness: 260,
    damping: 28
  });

  const cardRef = useRef<HTMLDivElement>(null);
  const pointer = useRef({ x: 0, y: 0 });
  const shown = useRef(false);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);

  // Beside the cursor, below and to the right; flipped when that would leave the window. The
  // card scales from the corner nearest the cursor.
  const place = useCallback(
    (jump: boolean) => {
      const h = cardRef.current?.offsetHeight ?? 180;
      let px = pointer.current.x + OFFSET;
      let py = pointer.current.y + OFFSET;
      let ox = '0%';
      let oy = '0%';
      if (px + PREVIEW_W > innerWidth - EDGE) {
        px = pointer.current.x - OFFSET - PREVIEW_W;
        ox = '100%';
      }
      if (py + h > innerHeight - EDGE) {
        py = pointer.current.y - OFFSET - h;
        oy = '100%';
      }
      x.set(px);
      y.set(py);
      origin.set(`${ox} ${oy}`);
      if (jump || reduced) {
        sx.jump(px);
        sy.jump(py);
      }
    },
    [x, y, origin, sx, sy, reduced]
  );

  const hide = useCallback(() => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    shown.current = false;
    setActive(null);
  }, []);

  const bind = useCallback<Bind>(
    (key, node) => ({
      onPointerEnter: (event) => {
        if (event.pointerType !== 'mouse' || !fine) return;
        pointer.current = { x: event.clientX, y: event.clientY };
        window.clearTimeout(hideTimer.current);
        window.clearTimeout(showTimer.current);
        const show = () => {
          // From hidden, the card appears where the cursor is rather than flying in from the last.
          place(!shown.current);
          shown.current = true;
          setActive({ key, node });
        };
        if (shown.current) show();
        else showTimer.current = window.setTimeout(show, DWELL_MS);
      },
      onPointerMove: (event) => {
        pointer.current = { x: event.clientX, y: event.clientY };
        if (shown.current) place(false);
      },
      onPointerLeave: () => {
        window.clearTimeout(showTimer.current);
        hideTimer.current = window.setTimeout(hide, GRACE_MS);
      },
      // A press opens the note or follows the link: the glimpse has done its job.
      onPointerDown: hide
    }),
    [fine, place, hide]
  );

  // The card's height changes with what it shows; keep it inside the window when it does.
  useEffect(() => {
    if (active) place(false);
  }, [active, place]);

  // Warm the images once the mouse first comes near, so the first card isn't empty.
  const [warm, setWarm] = useState(false);
  useEffect(() => {
    if (!fine || warm) return;
    const start = () => setWarm(true);
    window.addEventListener('pointermove', start, { once: true });
    return () => window.removeEventListener('pointermove', start);
  }, [fine, warm]);
  useEffect(() => {
    if (!warm) return;
    preload.forEach((srcSet) => {
      const img = new Image();
      const [first] = srcSet.split(', ');
      img.srcset = srcSet;
      img.src = first.split(' ')[0];
    });
  }, [warm, preload]);

  const value = useMemo(() => ({ bind, hide }), [bind, hide]);

  return (
    <PreviewContext.Provider value={value}>
      {children}
      {fine ? (
        <motion.div
          className={styles.previewAnchor}
          style={{ x: sx, y: sy }}
          aria-hidden="true"
        >
          <AnimatePresence initial={false}>
            {active ? (
              <motion.div
                key="card"
                ref={cardRef}
                // Swapping to a taller or shorter glimpse eases the card's size instead of snapping it.
                layout={reduced ? false : 'size'}
                transition={{ layout: { duration: 0.22, ease: EASE_OUT } }}
                className={styles.preview}
                style={{ width: PREVIEW_W, transformOrigin: origin, rotate: reduced ? 0 : lean }}
                initial={reduced ? { opacity: 1 } : { opacity: 0, scale: 0.96, filter: 'blur(4px)' }}
                animate={{ opacity: 1, scale: 1, filter: 'blur(0px)', transition: reduced ? { duration: 0 } : ENTER }}
                exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.97, transition: EXIT }}
              >
                {/* Moving from one phrase to the next swaps what the card shows with a quick crossfade. */}
                <AnimatePresence initial={false} mode="popLayout">
                  <motion.div
                    key={active.key}
                    layout={reduced ? false : 'size'}
                    initial={reduced ? false : { opacity: 0 }}
                    animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.16 } }}
                    exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.1 } }}
                  >
                    {active.node}
                  </motion.div>
                </AnimatePresence>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </motion.div>
      ) : null}
    </PreviewContext.Provider>
  );
}
