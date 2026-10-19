import { ReactNode } from 'react';
import { cn } from 'lib/cn';

type Props = {
  id?: string;
  command?: string;
  headingClassName?: string;
  children: ReactNode;
};

export function Section({ id, command, headingClassName = 'mb-6', children }: Props) {
  return (
    <section id={id} className="mx-auto w-full max-w-4xl scroll-mt-14 px-4 py-6 sm:px-6">
      {command && (
        <h2 className={cn('flex items-center gap-2 text-xs text-term-muted', headingClassName)}>
          <span className="text-term-accent">$</span>
          {command}
        </h2>
      )}
      {children}
    </section>
  );
}
