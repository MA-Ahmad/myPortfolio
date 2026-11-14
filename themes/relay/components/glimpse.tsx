import {
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState
} from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import styles from '../relay.module.css';

/**
 * Glimpses: a small card that opens above a word or a row while it is pointed at, and shows what
 * is behind it (a map for the city, the X profile for the handle, a block's picture for its row).
 * One is open at a time. The first waits a beat so sweeping across the text doesn't flash cards;
 * once one is open, moving to the next swaps at once and the card glides over. On touch, a word
 * that isn't a link opens its glimpse with a tap; links just follow.
 */

const DWELL_MS = 140;
const GRACE_MS = 120;
const GAP = 10;
const EDGE = 12;
const EASE_OUT = [0.32, 0.72, 0, 1] as const;

type Open = { id: string; node: ReactNode; anchor: DOMRect };
type Api = {
  open: (id: string, node: ReactNode, anchor: DOMRect, now?: boolean) => void;
  close: (now?: boolean) => void;
  current: string | null;
};

const GlimpseContext = createContext<Api | null>(null);

export function GlimpseProvider({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState<Open | null>(null);
  const shown = useRef(false);
  const showTimer = useRef<number | undefined>(undefined);
  const hideTimer = useRef<number | undefined>(undefined);

  const close = useCallback((now?: boolean) => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    const hide = () => {
      shown.current = false;
      setOpen(null);
    };
    if (now) hide();
    else hideTimer.current = window.setTimeout(hide, GRACE_MS);
  }, []);

  const openCard = useCallback((id: string, node: ReactNode, anchor: DOMRect, now?: boolean) => {
    window.clearTimeout(showTimer.current);
    window.clearTimeout(hideTimer.current);
    const show = () => {
      shown.current = true;
      setOpen({ id, node, anchor });
    };
    if (now || shown.current) show();
    else showTimer.current = window.setTimeout(show, DWELL_MS);
  }, []);

  // Scrolling or resizing moves the words out from under their cards: let go of them.
  useEffect(() => {
    if (!open) return;
    const away = () => close(true);
    const onKey = (event: globalThis.KeyboardEvent) => event.key === 'Escape' && close(true);
    // A tap anywhere but on a word with a glimpse puts the open one away.
    const onDown = (event: globalThis.PointerEvent) => {
      if (!(event.target as Element).closest?.('[data-glimpse]')) close(true);
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('scroll', away, { passive: true });
    window.addEventListener('resize', away);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('scroll', away);
      window.removeEventListener('resize', away);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open, close]);

  const api = useMemo(() => ({ open: openCard, close, current: open?.id ?? null }), [openCard, close, open?.id]);

  return (
    <GlimpseContext.Provider value={api}>
      {children}
      <Layer open={open} />
    </GlimpseContext.Provider>
  );
}

/** The card itself, fixed to the window, above its word (or below, when there is no room). */
function Layer({ open }: { open: Open | null }) {
  const reduced = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [place, setPlace] = useState<{ left: number; top: number; origin: string; below: boolean } | null>(null);

  useLayoutEffect(() => {
    const card = ref.current;
    if (!open || !card) return;
    const { anchor } = open;
    const w = card.offsetWidth;
    const h = card.offsetHeight;
    const cx = anchor.left + anchor.width / 2;
    const left = Math.min(innerWidth - EDGE - w, Math.max(EDGE, cx - w / 2));
    const below = anchor.top - GAP - h < EDGE;
    const top = below ? anchor.bottom + GAP : anchor.top - GAP - h;
    // It grows out of the point nearest the word.
    setPlace({ left, top, origin: `${Math.round(cx - left)}px ${below ? 0 : h}px`, below });
  }, [open]);

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="glimpse"
          ref={ref}
          className={styles.glimpse}
          role="presentation"
          style={{ transformOrigin: place?.origin, visibility: place ? 'visible' : 'hidden' }}
          initial={
            reduced
              ? { opacity: 1, left: place?.left ?? 0, top: place?.top ?? 0 }
              : { opacity: 0, scale: 0.96, left: place?.left ?? 0, top: place?.top ?? 0 }
          }
          animate={{
            opacity: 1,
            scale: 1,
            left: place?.left ?? 0,
            top: place?.top ?? 0,
            transition: reduced
              ? { duration: 0 }
              : { duration: 0.18, ease: EASE_OUT, left: { duration: 0.22, ease: EASE_OUT }, top: { duration: 0.22, ease: EASE_OUT } }
          }}
          exit={reduced ? { opacity: 0, transition: { duration: 0 } } : { opacity: 0, scale: 0.98, transition: { duration: 0.11, ease: [0.4, 0, 1, 1] } }}
        >
          <AnimatePresence initial={false} mode="popLayout">
            <motion.div
              key={open.id}
              initial={reduced ? false : { opacity: 0 }}
              animate={{ opacity: 1, transition: { duration: reduced ? 0 : 0.15 } }}
              exit={{ opacity: 0, transition: { duration: reduced ? 0 : 0.08 } }}
            >
              {open.node}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

/** The line of the word under the pointer (a phrase can wrap), or its first line. */
function anchorOf(el: HTMLElement, y?: number) {
  const rects = Array.from(el.getClientRects());
  return (y !== undefined && rects.find((r) => y >= r.top - 2 && y <= r.bottom + 2)) || rects[0] || el.getBoundingClientRect();
}

/**
 * Wraps a word, a link or a row's title with a glimpse. `tap` makes a word that isn't a link a
 * button of its own: a tap or Enter opens its card, a second one closes it.
 */
export function Glimpse({ id, card, tap, children }: { id: string; card: ReactNode; tap?: boolean; children: ReactNode }) {
  const api = useContext(GlimpseContext);
  const ref = useRef<HTMLSpanElement>(null);
  const pointer = useRef('mouse');
  if (!api) return <>{children}</>;

  const enter = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse' || !ref.current) return;
    api.open(id, card, anchorOf(ref.current, event.clientY));
  };
  const toggle = () => {
    if (!ref.current) return;
    // A mouse already opened it by pointing: a click keeps it open rather than closing it.
    if (pointer.current === 'mouse' && api.current === id) return;
    if (api.current === id) api.close(true);
    else api.open(id, card, anchorOf(ref.current), true);
  };
  const onKey = (event: KeyboardEvent) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    toggle();
  };

  return (
    <span
      ref={ref}
      className={tap ? styles.glimpseWord : styles.glimpseTrigger}
      data-glimpse=""
      onPointerEnter={enter}
      onPointerLeave={(event) => event.pointerType === 'mouse' && api.close()}
      onPointerDown={(event) => {
        pointer.current = event.pointerType;
        if (event.pointerType === 'mouse' && !tap) api.close(true);
      }}
      // Keyboard focus opens it; focus that comes with a click or a tap doesn't (the click decides).
      onFocus={(event) => {
        if ((event.target as HTMLElement).matches(':focus-visible') && ref.current) {
          pointer.current = 'keyboard';
          api.open(id, card, anchorOf(ref.current), true);
        }
      }}
      onBlur={() => api.close()}
      {...(tap
        ? { role: 'button', tabIndex: 0, 'aria-expanded': api.current === id, onClick: toggle, onKeyDown: onKey }
        : {})}
    >
      {children}
    </span>
  );
}
