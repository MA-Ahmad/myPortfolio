import React from 'react';
import Container from './container';
import { cn } from 'lib/cn';

const Section = (props) => {
  const { full, children, className, ...rest } = props;
  return (
    <section className={cn('flex w-full justify-center', className)} {...rest}>
      {full ? children : <Container>{children}</Container>}
    </section>
  );
};

export default Section;
