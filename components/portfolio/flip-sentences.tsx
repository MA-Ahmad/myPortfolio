import { useEffect, useState } from 'react';
import { cn } from 'lib/cn';

export function FlipSentences({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & { children: string[] }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (children.length < 2) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % children.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [children.length]);

  return (
    <div
      className={cn(
        'flex items-center font-mono text-sm text-muted-foreground',
        className
      )}
      {...props}
    >
      <span key={index}>{children[index]}</span>
    </div>
  );
}
