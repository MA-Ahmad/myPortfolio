import { AnimatePresence, motion } from 'framer-motion';
import { RotateCcw, X } from 'lucide-react';
import { cn } from 'lib/cn';

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

const kbd = 'rounded border border-line px-1 font-mono text-[10px] leading-4 text-foreground';

/**
 * The control strip shown while the spider answers to the keyboard: what the keys do,
 * what the spider can do right where it stands, and the speed.
 */
export function SpiderHud({
  open,
  hint,
  speed,
  onSpeed,
  canReset,
  onReset,
  onClose
}: {
  open: boolean;
  hint: string;
  speed: Speed;
  onSpeed: (speed: Speed) => void;
  canReset: boolean;
  onReset: () => void;
  onClose: () => void;
}) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.2, ease: [0.23, 1, 0.32, 1] }}
          className="fixed bottom-6 left-6 z-[54] flex max-w-[calc(100vw-3rem)] items-center gap-3 whitespace-nowrap rounded-full border border-line bg-background/90 py-1 pl-4 pr-1 text-xs text-muted-foreground shadow-[0_12px_32px_-14px_rgb(0_0_0/0.35)] backdrop-blur"
          role="toolbar"
          aria-label="Spider controls"
        >
          <span className="font-mono text-foreground" aria-live="polite">
            {hint}
          </span>
          <span className="hidden h-4 w-px bg-line lg:block" aria-hidden />
          <span className="hidden items-center gap-1.5 lg:flex">
            <kbd className={kbd}>←↑↓→</kbd> move
            <kbd className={kbd}>Space</kbd> thread
            <kbd className={kbd}>Z</kbd> undo
            <kbd className={kbd}>O</kbd> orb
            <kbd className={kbd}>G</kbd> grab
            <kbd className={kbd}>Shift</kbd> dash
          </span>
          <button
            type="button"
            disabled={!canReset}
            onClick={(event) => {
              onReset();
              event.currentTarget.blur();
            }}
            title="Put everything back (R)"
            className="inline-flex items-center gap-1 rounded-full border border-line px-2 py-0.5 font-mono text-[11px] transition-colors hover:text-foreground disabled:pointer-events-none disabled:opacity-40"
          >
            <RotateCcw className="size-3" aria-hidden />
            Reset
          </button>
          <span className="flex items-center rounded-full border border-line p-0.5" role="group" aria-label="Speed">
            {SPEEDS.map((value, i) => (
              <button
                key={value}
                type="button"
                aria-pressed={speed === value}
                title={`Speed ${value}× (key ${i + 1})`}
                onClick={(event) => {
                  onSpeed(value);
                  event.currentTarget.blur(); // Space must stay with the spider
                }}
                className={cn(
                  'rounded-full px-2 py-0.5 font-mono text-[11px] transition-colors',
                  speed === value ? 'bg-foreground text-background' : 'hover:text-foreground'
                )}
              >
                {value}×
              </button>
            ))}
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Let go (Esc)"
            aria-label="Let go of the spider"
            className="inline-flex size-7 items-center justify-center rounded-full hover:bg-muted hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}
