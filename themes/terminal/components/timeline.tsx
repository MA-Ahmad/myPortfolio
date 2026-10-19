import { ReactNode } from 'react';
import { cn } from 'lib/cn';

const COLORS = [
  { dot: 'bg-term-accent', text: 'text-term-accent' },
  { dot: 'bg-term-aqua', text: 'text-term-aqua' },
  { dot: 'bg-term-yellow', text: 'text-term-yellow' },
  { dot: 'bg-term-orange', text: 'text-term-orange' },
  { dot: 'bg-term-purple', text: 'text-term-purple' }
];

export type TimelineEntry = {
  id: string;
  title: string;
  meta?: string;
  body: ReactNode;
};

export function Timeline({ entries }: { entries: TimelineEntry[] }) {
  return (
    <ol className="relative ml-3">
      {entries.map((entry, index) => {
        const color = COLORS[index % COLORS.length];
        const isLast = index === entries.length - 1;
        return (
          <li key={entry.id} className="relative flex gap-4 pb-6">
            {!isLast && (
              <div
                aria-hidden
                className="absolute -bottom-[9px] left-[5px] top-3 w-px bg-term-border"
              />
            )}
            <div
              aria-hidden
              className={cn(
                'relative z-10 mt-1 size-[11px] shrink-0 rounded-full border-2 border-term-bg',
                color.dot
              )}
            />
            <div className="min-w-0 flex-1">
              <h3 className={cn('text-xs font-medium', color.text)}>
                {entry.title}
                {entry.meta && (
                  <span className="ml-2 font-normal tabular-nums text-term-dim">{entry.meta}</span>
                )}
              </h3>
              <div className="mt-0.5 text-sm leading-relaxed text-term-fg">{entry.body}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
