import { motion, useReducedMotion } from 'framer-motion';
import { PencilRulerIcon } from 'lucide-react';
import { preloadRedraw, requestRedraw } from 'lib/redraw';
import { cn } from 'lib/cn';

/**
 * The way into Redraw on larger screens: a button in the empty box beside the MA mark, with a
 * hand-drawn note and an arrow that draws itself in once it scrolls into view. It is a new
 * feature, so it gets a place on the page instead of an icon among the nav buttons (the nav
 * keeps one on phones, where this box doesn't exist).
 */
export function RedrawCallout({ className }: { className?: string }) {
  const reduced = useReducedMotion();
  const draw = reduced
    ? {}
    : {
        initial: { pathLength: 0 },
        whileInView: { pathLength: 1 },
        viewport: { once: true }
      };

  return (
    // Skipped by the redraw: it isn't drawn with the page, it comes back once the page is done.
    <div data-redraw-skip="fade" className={cn('relative h-48 w-full shrink-0', className)}>
      <button
        type="button"
        onClick={(event) => requestRedraw(event.currentTarget)}
        onPointerEnter={() => void preloadRedraw()}
        onFocus={() => void preloadRedraw()}
        aria-label="Redraw the page"
        title="Redraw the page"
        className="group/redraw absolute left-6 top-8 inline-flex size-11 items-center justify-center rounded-full border border-line bg-background text-foreground outline-none transition-[background-color,transform,box-shadow] duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.96]"
      >
        <PencilRulerIcon className="size-4 transition-transform duration-200 ease-out group-hover/redraw:-rotate-12" />
      </button>

      {/* The note sits under the button (the box is narrow, the M starts right beside it) and
          the arrow sweeps up from it; the stroke draws first, the head after. */}
      <svg
        aria-hidden
        className="pointer-events-none absolute left-5 top-20 size-14 text-muted-foreground"
        viewBox="0 0 56 56"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <motion.path
          d="M40 52C14 50 10 26 24 4"
          {...draw}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
        />
        <motion.path
          d="M16.5 8 24 4l2 8.5"
          {...draw}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1], delay: 0.95 }}
        />
      </svg>

      <span
        aria-hidden
        className="pointer-events-none absolute left-4 top-[8.5rem] -rotate-3 whitespace-nowrap font-handwritten text-lg leading-none text-muted-foreground select-none"
      >
        redraw page
      </span>
    </div>
  );
}
