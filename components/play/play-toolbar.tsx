import { useEffect, useId, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { AnimatePresence, MotionConfig, motion, useReducedMotion } from 'framer-motion';
import { Check, ChevronDown, Link, RotateCcw, SwatchBook, X } from 'lucide-react';
import {
  ACCENT_SWATCHES,
  PLAY_DEFAULTS,
  PLAY_EXIT_EVENT,
  PLAY_KEYS,
  PLAY_OPTIONS,
  type PlayKey,
  type PlaySettings,
  parsePlay,
  playQuery
} from 'lib/play';
import { cn } from 'lib/cn';

// Matches the transition on html[data-play-ready] in styles/globals.css.
const LOOK_MS = 500;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const PILL = { type: 'spring', duration: 0.35, bounce: 0.15 } as const;

const LABELS: Record<PlayKey, string> = {
  lines: 'Lines',
  sep: 'Separators',
  width: 'Width',
  accent: 'Accent'
};

const datasetKey = (key: PlayKey) => `play${key[0].toUpperCase()}${key.slice(1)}`;

function applyLook(root: HTMLElement, settings: PlaySettings) {
  for (const key of PLAY_KEYS) root.dataset[datasetKey(key)] = settings[key];
}

/**
 * The play-mode panel for the home page. It writes the look onto <html> as data attributes and
 * the CSS in styles/globals.css does the rest; the URL is the source of truth, so a look can be
 * shared, and closing the panel eases the page back to its defaults before dropping `?play`.
 */
export default function PlayToolbar() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [ready, setReady] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<number>(undefined);
  const contentId = useId();

  const settings = leaving ? PLAY_DEFAULTS : parsePlay(router.query);
  const isDefault = PLAY_KEYS.every((key) => settings[key] === PLAY_DEFAULTS[key]);

  useEffect(() => {
    const root = document.documentElement;
    root.dataset.play = '';
    applyLook(root, PLAY_DEFAULTS);
    // Read a style back so the defaults land first: they match the page, so switching the
    // transitions on afterwards eases into the chosen look instead of in from nothing.
    getComputedStyle(root).getPropertyValue('--play-frame');
    root.dataset.playReady = '';
    setReady(true);
    return () => {
      for (const key of Object.keys(root.dataset)) {
        if (key.startsWith('play')) delete root.dataset[key];
      }
    };
  }, []);

  useEffect(() => {
    if (ready) applyLook(document.documentElement, settings);
  });

  const replace = (query: Record<string, string>) =>
    router.replace({ pathname: '/', query }, undefined, { shallow: true, scroll: false });

  const set = <K extends PlayKey>(key: K, value: PlaySettings[K]) =>
    replace(playQuery({ ...settings, [key]: value }));

  const exit = () => {
    if (leaving) return;
    setLeaving(true);
    window.setTimeout(() => replace({}), reduced || isDefault ? 0 : LOOK_MS);
  };

  const exitRef = useRef(exit);
  useEffect(() => {
    exitRef.current = exit;
  });
  useEffect(() => {
    const onExit = () => exitRef.current();
    window.addEventListener(PLAY_EXIT_EVENT, onExit);
    return () => window.removeEventListener(PLAY_EXIT_EVENT, onExit);
  }, []);

  useEffect(() => () => window.clearTimeout(copiedTimer.current), []);

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(copiedTimer.current);
    copiedTimer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <MotionConfig reducedMotion="user">
      <div className="play-rails" aria-hidden />

      <div className="pointer-events-none fixed inset-x-0 bottom-0 z-[70] flex justify-center p-2 lg:inset-x-auto lg:left-0 lg:p-6">
        <AnimatePresence>
          {!leaving && (
            <motion.section
              aria-label="Play mode"
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.3, ease: EASE_OUT }}
              className="pointer-events-auto w-full max-w-[24rem] origin-bottom overflow-hidden rounded-2xl border border-border bg-popover/95 text-popover-foreground shadow-[0_1px_2px_rgb(0_0_0/0.04),0_16px_40px_-16px_rgb(0_0_0/0.3)] backdrop-blur-md lg:origin-bottom-left"
            >
              <header className="flex h-11 items-center gap-1 pl-3 pr-1.5">
                <button
                  type="button"
                  onClick={() => setCollapsed((value) => !value)}
                  aria-expanded={!collapsed}
                  aria-controls={contentId}
                  className="-ml-1 mr-auto flex h-8 items-center gap-2 rounded-lg px-1 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
                >
                  <SwatchBook className="size-4 text-muted-foreground" aria-hidden />
                  Play mode
                  <motion.span
                    animate={{ rotate: collapsed ? 180 : 0 }}
                    transition={{ duration: 0.25, ease: EASE_OUT }}
                    className="inline-flex text-muted-foreground"
                  >
                    <ChevronDown className="size-3.5" aria-hidden />
                  </motion.span>
                </button>
                <IconButton label="Reset to default" onClick={() => replace(playQuery(PLAY_DEFAULTS))} disabled={isDefault}>
                  <RotateCcw className="size-3.5" />
                </IconButton>
                <IconButton label={copied ? 'Link copied' : 'Copy link to this look'} onClick={copyLink}>
                  <AnimatePresence mode="popLayout" initial={false}>
                    <motion.span
                      key={copied ? 'copied' : 'link'}
                      initial={{ opacity: 0, scale: 0.6, filter: 'blur(2px)' }}
                      animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
                      exit={{ opacity: 0, scale: 0.6, filter: 'blur(2px)' }}
                      transition={{ duration: 0.18, ease: EASE_OUT }}
                      className="inline-flex"
                    >
                      {copied ? <Check className="size-3.5" /> : <Link className="size-3.5" />}
                    </motion.span>
                  </AnimatePresence>
                </IconButton>
                <IconButton label="Exit play mode" onClick={exit}>
                  <X className="size-4" />
                </IconButton>
              </header>

              <AnimatePresence initial={false}>
                {!collapsed && (
                  <motion.div
                    id={contentId}
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.28, ease: EASE_OUT }}
                  >
                    <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-2.5 border-t border-border px-3 pb-3.5 pt-3">
                      <Row name="lines" value={settings.lines} onChange={(value) => set('lines', value)} />
                      <Row name="sep" value={settings.sep} onChange={(value) => set('sep', value)} />
                      {/* The column only has a max width from the md breakpoint up. */}
                      <div className="hidden md:contents">
                        <Row name="width" value={settings.width} onChange={(value) => set('width', value)} />
                      </div>
                      <Label name="accent" />
                      <Swatches value={settings.accent} onChange={(value) => set('accent', value)} />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.section>
          )}
        </AnimatePresence>
      </div>
    </MotionConfig>
  );
}

function IconButton({
  label,
  className,
  ...props
}: React.ComponentProps<'button'> & { label: string }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground outline-none transition-[color,background-color,opacity,transform] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.94] disabled:pointer-events-none disabled:opacity-40',
        className
      )}
      {...props}
    />
  );
}

function Label({ name }: { name: PlayKey }) {
  return (
    <span id={`play-label-${name}`} className="text-xs text-muted-foreground">
      {LABELS[name]}
    </span>
  );
}

function Row<K extends Exclude<PlayKey, 'accent'>>({
  name,
  value,
  onChange
}: {
  name: K;
  value: PlaySettings[K];
  onChange: (value: PlaySettings[K]) => void;
}) {
  return (
    <>
      <Label name={name} />
      <div
        role="radiogroup"
        aria-labelledby={`play-label-${name}`}
        className="flex w-fit gap-0.5 rounded-[10px] bg-muted p-0.5"
      >
        {PLAY_OPTIONS[name].map((option) => {
          const checked = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={checked}
              onClick={() => onChange(option.value as PlaySettings[K])}
              className={cn(
                'relative h-7 rounded-lg px-2.5 text-xs font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-foreground/30',
                checked ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {checked && (
                <motion.span
                  layoutId={`play-pill-${name}`}
                  transition={PILL}
                  className="absolute inset-0 rounded-lg bg-background shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border"
                />
              )}
              <span className="relative">{option.label}</span>
            </button>
          );
        })}
      </div>
    </>
  );
}

function Swatches({
  value,
  onChange
}: {
  value: PlaySettings['accent'];
  onChange: (value: PlaySettings['accent']) => void;
}) {
  return (
    <div role="radiogroup" aria-labelledby="play-label-accent" className="flex gap-1.5 px-1">
      {PLAY_OPTIONS.accent.map((option) => {
        const checked = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={checked}
            aria-label={option.label}
            title={option.label}
            onClick={() => onChange(option.value)}
            className="relative grid size-7 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-foreground/30"
          >
            {checked && (
              <motion.span
                layoutId="play-pill-accent"
                transition={PILL}
                className="absolute inset-0 rounded-full ring-[1.5px] ring-foreground/60"
              />
            )}
            <span
              className="size-[1.125rem] rounded-full ring-1 ring-inset ring-black/10 transition-transform duration-150 ease-out active:scale-90 dark:ring-white/15"
              style={{ background: ACCENT_SWATCHES[option.value] }}
            />
          </button>
        );
      })}
    </div>
  );
}
