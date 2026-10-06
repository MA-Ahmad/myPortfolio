import React from 'react';
import { cn } from 'lib/cn';

function Panel({ className, ...props }: React.ComponentProps<'section'>) {
  return (
    <section
      data-slot="panel"
      className={cn(
        'screen-line-top screen-line-bottom border-x border-line screen-line-bottom-border',
        className
      )}
      {...props}
    />
  );
}

function PanelHeader({ className, ...props }: React.ComponentProps<'header'>) {
  return (
    <header
      data-slot="panel-header"
      className={cn('screen-line-bottom px-4 py-1', className)}
      {...props}
    />
  );
}

function PanelTitle({
  as: Comp = 'h2',
  className,
  ...props
}: React.ComponentProps<'h2'> & { as?: 'h2' | 'div' }) {
  return (
    <Comp
      data-slot="panel-title"
      className={cn(
        'text-3xl font-medium tracking-tight text-balance',
        className
      )}
      {...props}
    />
  );
}

function PanelTitleSup({ className, ...props }: React.ComponentProps<'sup'>) {
  return (
    <sup
      className={cn(
        'top-[-0.75em] ml-1 text-sm font-medium tracking-normal text-muted-foreground',
        className
      )}
      {...props}
    />
  );
}

function PanelContent({ className, ...props }: React.ComponentProps<'div'>) {
  return (
    <div data-slot="panel-body" className={cn('p-4', className)} {...props} />
  );
}

export { Panel, PanelContent, PanelHeader, PanelTitle, PanelTitleSup };
