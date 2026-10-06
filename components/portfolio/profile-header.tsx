import { PROFILE } from 'data/profile';
import { FlipSentences } from './flip-sentences';
import { HandwrittenArrow, HandwrittenNote } from './handwritten-note';
import { MarkIsometric } from './mark-isometric';

export function ProfileHeader() {
  return (
    <div className="screen-line-bottom grid grid-cols-[auto_1fr] grid-rows-[1fr_auto] overflow-y-clip border-x border-line screen-line-bottom-border after:z-[1]">
      <figure className="relative col-span-2 p-2 sm:col-span-1 sm:col-start-2 sm:p-4">
        <div className="sm:-translate-x-16">
          <MarkIsometric />
        </div>

        <HandwrittenNote
          className="bottom-20 left-full hidden w-36 flex-col items-start xl:flex"
          aria-hidden
        >
          <HandwrittenArrow className="-scale-y-100 -rotate-6" />
          <span className="ml-3 -rotate-6">
            follows your cursor
            <span className="block" />
            click for a sound
          </span>
        </HandwrittenNote>

        <figcaption className="pointer-events-none absolute right-2 bottom-2 text-sm leading-none tracking-wide text-muted-foreground/60 tabular-nums select-none sm:right-4 sm:bottom-4">
          Fig. 1.
        </figcaption>
      </figure>

      <div className="flex flex-col sm:row-span-2 sm:row-start-1">
        <div className="screen-line-top mt-auto shrink-0 border-r border-line">
          <div className="mx-0.5 my-[3px] flex outline-none">
            <div className="relative size-32 rounded-full sm:size-40">
              <img
                className="block size-full rounded-[inherit] object-cover select-none"
                src={PROFILE.avatar}
                alt={PROFILE.displayName}
              />
              <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-foreground/30 dark:ring-foreground/10" />
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col">
        <div className="z-[1] mt-auto border-t border-line">
          <div className="flex -translate-x-px items-center gap-2 pl-4">
            <h1 className="-translate-y-px text-[2rem] leading-none font-medium tracking-tight">
              {PROFILE.displayName}
            </h1>
          </div>

          <FlipSentences className="h-12 border-t border-line py-1 pl-4 sm:h-9">
            {PROFILE.flipSentences}
          </FlipSentences>
        </div>
      </div>
    </div>
  );
}
