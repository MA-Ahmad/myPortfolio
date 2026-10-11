import { cn } from 'lib/cn';

export function IconTile({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div
      data-slot="icon-tile"
      className={cn(
        'flex size-6 shrink-0 items-center justify-center rounded-md select-none',
        'bg-muted text-muted-foreground',
        'border border-[color-mix(in_oklab,var(--muted-foreground)_15%,transparent)]',
        'ring-1 ring-offset-1 ring-[color-mix(in_oklab,var(--border)_50%,transparent)] ring-offset-[var(--background)] dark:ring-[var(--line)]',
        '[&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0',
        className
      )}
      {...props}
    />
  );
}
