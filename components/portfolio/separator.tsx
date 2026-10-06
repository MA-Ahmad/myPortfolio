import { cn } from 'lib/cn';

export function StripeSeparator({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'stripe-divider h-[var(--separator-height)] w-full border-x border-line',
        className
      )}
    />
  );
}

export function VerticalDivider({ className }: { className?: string }) {
  return (
    <span
      className={cn('inline-block h-4 w-px self-center bg-line', className)}
      aria-hidden
    />
  );
}
