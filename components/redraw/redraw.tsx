import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import {
  Check,
  FastForward,
  LocateFixed,
  LocateOff,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  Volume2,
  VolumeOff,
  X
} from 'lucide-react';
import { type RedrawOrigin, clearBlankPage } from 'lib/redraw';
import { cn } from 'lib/cn';
import { RedrawEngine, type RedrawStats } from './engine';
import { RedrawSound, type SoundChoice, parseSoundChoice } from './sound';
import styles from './redraw.module.css';

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const SPEEDS = [1, 2, 4] as const;
const SOUND_KEY = 'redraw:sound';
/** How long the "redrawn" summary stays before the toolbar goes away by itself. */
const DONE_LINGER_MS = 4500;
/** The toolbar and the crew perched on it leave together; an exit, so quick and quiet. */
const LEAVE_MS = 200;

const EMPTY: RedrawStats = {
  phase: 'scan',
  found: 0,
  done: 0,
  total: 0,
  agents: [],
  elapsed: 0,
  follow: true
};

// Toolbar controls grow to a 44px target on touch screens.
const CONTROL =
  'inline-flex size-8 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.94] [@media(pointer:coarse)]:size-11';

type RedrawProps = {
  origin?: RedrawOrigin;
  onClose: () => void;
  onRestart: () => void;
};

/**
 * The redraw run for the home page: mounts the overlay, the rulers canvas and the toolbar, and
 * hands them to the engine. Unmounting at any point puts the page back exactly as it was.
 */
export default function Redraw({ origin, onClose, onRestart }: RedrawProps) {
  const reduced = useReducedMotion() ?? false;
  // Loaded with `ssr: false`, so the document is always there.
  const host = typeof document === 'undefined' ? null : document.body;
  const overlayRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<RedrawEngine | null>(null);
  const soundRef = useRef<RedrawSound | null>(null);
  const [stats, setStats] = useState<RedrawStats>(EMPTY);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [paused, setPaused] = useState(false);
  const [sound, setSound] = useState<SoundChoice>(() => {
    try {
      return parseSoundChoice(window.localStorage.getItem(SOUND_KEY));
    } catch {
      // Storage can be blocked; sound just starts off.
      return 'off';
    }
  });
  const [leaving, setLeaving] = useState(false);
  // Hover or keyboard focus on the toolbar keeps the summary from closing under the visitor.
  const [hovered, setHovered] = useState(false);
  const toolbarRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!host) return;
    const root = document.querySelector<HTMLElement>('[data-redraw-scope]');
    const overlay = overlayRef.current;
    const canvas = canvasRef.current;
    if (!root || !overlay || !canvas) {
      clearBlankPage();
      return;
    }

    const audio = new RedrawSound();
    soundRef.current = audio;
    audio.setChoice(sound);

    const engine = new RedrawEngine({
      root,
      overlay,
      canvas,
      origin,
      reduced,
      onStats: setStats,
      onTick: (kind, detail) => audio.play(kind, detail),
      dock: () => toolbarRef.current?.getBoundingClientRect() ?? null
    });
    engineRef.current = engine;
    engine.start();
    return () => {
      engine.destroy();
      audio.dispose();
      // Closed before the engine took over the blank page: give the page back.
      clearBlankPage();
      engineRef.current = null;
    };
    // The run is fixed once it starts; a new run remounts this component.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host]);

  useEffect(() => engineRef.current?.setSpeed(speed), [speed]);
  useEffect(() => engineRef.current?.setPaused(paused), [paused]);
  useEffect(() => {
    soundRef.current?.setChoice(sound);
  }, [sound]);

  /**
   * Closing fades the toolbar and the agents perched on it out together, then unmounts (which
   * puts the page back). Reduced motion closes at once.
   */
  const leaveTimer = useRef(0);
  const close = () => {
    if (leaving) return;
    setLeaving(true);
    leaveTimer.current = window.setTimeout(onClose, reduced ? 0 : LEAVE_MS);
  };
  const closeRef = useRef(close);
  useEffect(() => {
    closeRef.current = close;
  });
  useEffect(() => () => window.clearTimeout(leaveTimer.current), []);

  const done = stats.phase === 'done';

  useEffect(() => {
    if (!done || hovered) return;
    let timer = 0;
    const later = () => {
      timer = window.setTimeout(() => {
        // A mouse click leaves focus on a button too; only a keyboard user's focus holds it open.
        const active = document.activeElement;
        if (active && toolbarRef.current?.contains(active) && active.matches(':focus-visible'))
          later();
        else closeRef.current();
      }, DONE_LINGER_MS);
    };
    later();
    return () => window.clearTimeout(timer);
  }, [done, hovered]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') closeRef.current();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const toggleSound = () => {
    const next: SoundChoice = sound === 'off' ? 'soft' : 'off';
    setSound(next);
    // Created inside the click, so the browser lets it play; a short taste when switched on.
    soundRef.current?.setChoice(next);
    soundRef.current?.preview();
    try {
      window.localStorage.setItem(SOUND_KEY, next);
    } catch {
      // Not remembered, still works for this run.
    }
  };

  if (!host) return null;

  const progress = stats.total ? stats.done / stats.total : 0;
  const shown = stats.agents.slice(-5);

  return createPortal(
    <MotionConfig reducedMotion="user">
      <div
        ref={overlayRef}
        className={styles.overlay}
        data-leaving={leaving || undefined}
        aria-hidden
      />
      <canvas ref={canvasRef} className={styles.guides} aria-hidden />

      <div
        data-redraw-ui
        className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex flex-col items-center gap-2 p-3 sm:p-5"
      >
        <motion.section
          ref={toolbarRef}
          aria-label="Redraw"
          layout
          initial={{ opacity: 0, y: 16, scale: 0.96 }}
          animate={leaving ? { opacity: 0, y: 8, scale: 0.98 } : { opacity: 1, y: 0, scale: 1 }}
          transition={{
            duration: leaving ? LEAVE_MS / 1000 : 0.35,
            ease: leaving ? [0.4, 0, 1, 1] : EASE_OUT,
            layout: { type: 'spring', duration: 0.4, bounce: 0.12 }
          }}
          onPointerEnter={() => setHovered(true)}
          onPointerLeave={() => setHovered(false)}
          style={{ borderRadius: 9999 }}
          className="pointer-events-auto flex h-11 max-w-full [@media(pointer:coarse)]:h-14 items-center gap-2 overflow-hidden border border-border bg-popover/95 pl-3 pr-1.5 text-sm text-popover-foreground shadow-[0_1px_2px_rgb(0_0_0/0.06),0_16px_40px_-16px_rgb(0_0_0/0.4)] backdrop-blur-md"
        >
          <span className="sr-only" aria-live="polite">
            {stats.phase === 'scan' ? 'Redrawing the page' : done ? 'Page redrawn' : ''}
          </span>
          <AnimatePresence mode="popLayout" initial={false}>
            {stats.phase === 'scan' ? (
              <Slot key="scan">
                <span className="relative flex size-2.5 shrink-0">
                  <span className="absolute inset-0 animate-ping rounded-full bg-sky-400/70" />
                  <span className="relative size-2.5 rounded-full bg-sky-400" />
                </span>
                <span className="font-medium">Scanning page</span>
                <span className="tabular-nums text-muted-foreground">{stats.found} layers</span>
              </Slot>
            ) : done ? (
              <Slot key="done">
                <Check className="size-4 shrink-0 text-emerald-500" aria-hidden />
                <span className="whitespace-nowrap">
                  <span className="font-medium">Redrawn</span>{' '}
                  <span className="text-muted-foreground">
                    {stats.total} layers{reduced ? '' : ` in ${stats.elapsed.toFixed(1)}s`}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={onRestart}
                  className="ml-1 inline-flex h-8 items-center gap-1.5 rounded-full bg-foreground px-3 text-xs font-medium text-background outline-none transition-[transform,opacity] duration-150 ease-out hover:opacity-90 focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.96]"
                >
                  <RotateCcw className="size-3.5" aria-hidden />
                  Again
                </button>
              </Slot>
            ) : (
              <Slot key="build">
                <span className="hidden shrink-0 items-center min-[420px]:flex" aria-hidden>
                  {shown.map((agent, index) => (
                    <motion.span
                      key={agent.name}
                      layout="position"
                      initial={{ scale: 0, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ type: 'spring', duration: 0.35, bounce: 0.3 }}
                      title={agent.name}
                      style={{ backgroundColor: agent.color, zIndex: index }}
                      className={cn(
                        'grid size-5 place-items-center rounded-full text-[10px] font-semibold text-[#0a0a0b] ring-2 ring-popover',
                        index > 0 && '-ml-1.5'
                      )}
                    >
                      {agent.name[0]}
                    </motion.span>
                  ))}
                </span>
                <span className="whitespace-nowrap tabular-nums">
                  <span className="font-medium">{stats.agents.length}</span>
                  <span className="hidden text-muted-foreground min-[420px]:inline"> agents</span>
                </span>
                <span className="h-4 w-px shrink-0 bg-border" aria-hidden />
                <span className="whitespace-nowrap tabular-nums text-muted-foreground">
                  <span className="text-foreground">{stats.done}</span> / {stats.total}
                  <span className="hidden sm:inline"> layers</span>
                </span>
                <span
                  className="relative hidden h-1 w-16 shrink-0 overflow-hidden rounded-full bg-muted sm:block"
                  role="progressbar"
                  aria-valuemin={0}
                  aria-valuemax={stats.total}
                  aria-valuenow={stats.done}
                  aria-label="Layers drawn"
                >
                  <span
                    className="absolute inset-y-0 left-0 w-full origin-left rounded-full bg-foreground transition-transform duration-200 ease-out"
                    style={{ transform: `scaleX(${progress})` }}
                  />
                </span>
                <span className="flex items-center">
                  <IconButton
                    label={paused ? 'Resume' : 'Pause'}
                    onClick={() => setPaused((value) => !value)}
                  >
                    {paused ? <Play className="size-3.5" /> : <Pause className="size-3.5" />}
                  </IconButton>
                  <IconButton
                    label="Follow the drawing"
                    pressed={stats.follow}
                    onClick={() => engineRef.current?.setFollow(!stats.follow)}
                    className={cn(reduced && 'hidden', stats.follow && 'text-foreground')}
                  >
                    {stats.follow ? (
                      <LocateFixed className="size-3.5" />
                    ) : (
                      <LocateOff className="size-3.5" />
                    )}
                  </IconButton>
                  <button
                    type="button"
                    onClick={() =>
                      setSpeed((value) => SPEEDS[(SPEEDS.indexOf(value) + 1) % SPEEDS.length])
                    }
                    aria-label={`Speed ${speed}x, change speed`}
                    title="Speed"
                    className={cn(
                      CONTROL,
                      'w-auto min-w-8 gap-0.5 px-1.5 text-xs font-medium tabular-nums [@media(pointer:coarse)]:w-auto [@media(pointer:coarse)]:min-w-11'
                    )}
                  >
                    <FastForward className="size-3" aria-hidden />
                    {speed}×
                  </button>
                  <IconButton
                    label="Sound"
                    pressed={sound !== 'off'}
                    onClick={toggleSound}
                    className={cn('hidden sm:inline-flex', sound !== 'off' && 'text-foreground')}
                  >
                    {sound === 'off' ? (
                      <VolumeOff className="size-3.5" />
                    ) : (
                      <Volume2 className="size-3.5" />
                    )}
                  </IconButton>
                  <IconButton label="Finish now" onClick={() => engineRef.current?.skip()}>
                    <SkipForward className="size-3.5" />
                  </IconButton>
                </span>
              </Slot>
            )}
          </AnimatePresence>
          <IconButton label="Close" onClick={close}>
            <X className="size-3.5" />
          </IconButton>
        </motion.section>
      </div>
    </MotionConfig>,
    host
  );
}

function Slot({ children }: { children: ReactNode }) {
  return (
    <motion.div
      layout="position"
      initial={{ opacity: 0, filter: 'blur(4px)' }}
      animate={{ opacity: 1, filter: 'blur(0px)' }}
      exit={{ opacity: 0, filter: 'blur(4px)' }}
      transition={{ duration: 0.25, ease: EASE_OUT }}
      className="flex min-w-0 items-center gap-2"
    >
      {children}
    </motion.div>
  );
}

function IconButton({
  label,
  onClick,
  pressed,
  className,
  children
}: {
  label: string;
  onClick: () => void;
  /** For toggles: announced as on/off instead of a label that flips. */
  pressed?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      aria-label={label}
      title={label}
      className={cn(CONTROL, className)}
    >
      {children}
    </button>
  );
}
