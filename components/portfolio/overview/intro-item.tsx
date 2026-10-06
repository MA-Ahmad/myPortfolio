import { cn } from 'lib/cn';
import { IconTile } from '../icon-tile';

export { IconTile as IntroItemIcon };

export function IntroItem({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  return (
    <div
      className={cn('flex items-center gap-4 font-mono text-sm', className)}
      {...props}
    />
  );
}

export function IntroItemContent({
  className,
  ...props
}: React.ComponentProps<'p'>) {
  return <p className={cn('text-balance', className)} {...props} />;
}

export function IntroItemLink({
  className,
  ...props
}: React.ComponentProps<'a'>) {
  return (
    <a
      className={cn('link text-foreground no-underline hover:underline', className)}
      {...props}
    />
  );
}
