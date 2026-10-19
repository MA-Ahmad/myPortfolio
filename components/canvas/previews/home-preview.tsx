import { PROFILE } from 'data/profile';
import { MarkIsometric } from 'components/portfolio/mark-isometric';
import PixelAvatar from 'components/portfolio/pixel-avatar';

/** The main site's masthead in miniature: avatar, the isometric mark, name and tagline on hairlines. */
export function HomePreview() {
  return (
    <div className="flex size-full flex-col bg-background text-foreground">
      <div className="grid h-[104px] flex-none grid-cols-[92px_1fr]">
        <div className="grid place-items-center border-r border-line">
          <div className="relative size-[68px] rounded-full">
            <PixelAvatar src={`${PROFILE.avatar}&s=160`} alt="" cell={3} hoverCell={2} />
            <div className="pointer-events-none absolute inset-0 rounded-[inherit] ring-1 ring-inset ring-foreground/30 dark:ring-foreground/10" />
          </div>
        </div>
        <div className="grid place-items-center overflow-hidden px-3">
          <div className="w-[150px]">
            <MarkIsometric />
          </div>
        </div>
      </div>
      <div className="flex h-[34px] flex-none items-center border-t border-line pl-3 text-[17px] font-medium leading-none tracking-tight">
        {PROFILE.displayName}
      </div>
      <div className="flex h-6 flex-none items-center truncate border-t border-line pl-3 text-[11px] text-muted-foreground">
        {PROFILE.flipSentences[0]}
      </div>
      <div className="diagonal-stripes flex-1 border-t border-line" />
    </div>
  );
}
