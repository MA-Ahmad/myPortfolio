import React from 'react';
import { cn } from 'lib/cn';

export const Container = ({ className, ...props }: React.ComponentProps<'div'>) => (
  <div
    className={cn(
      'mx-auto w-[90%] max-w-[800px] text-center text-xl min-[480px]:w-[85%] md:w-[80%]',
      className
    )}
    {...props}
  />
);

export default Container;
