import React from 'react';
import { cn } from 'lib/cn';

export const Container = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn(
      'mx-auto w-[90%] max-w-[800px] text-center text-xl sm:w-[85%] lg:w-[80%]',
      className
    )}
    {...props}
  />
);

export default Container;
