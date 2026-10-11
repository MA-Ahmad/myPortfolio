import { useEffect, useRef, useState } from 'react';
import {
  AnimatePresence,
  motion,
  useInView,
  useReducedMotion,
  type Variants
} from 'framer-motion';
import { cn } from 'lib/cn';

const defaultVariants: Variants = {
  initial: { y: '-20%', opacity: 0, filter: 'blur(1px)' },
  animate: {
    y: '0%',
    opacity: 1,
    filter: 'blur(0px)'
  },
  exit: {
    y: '40%',
    opacity: 0,
    filter: 'blur(1px)',
    transition: { ease: 'easeOut' }
  }
};

const reducedVariants: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 }
};

export function FlipSentences({
  children,
  className,
  ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & { children: string[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);
  const reducedMotion = useReducedMotion();
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!isInView || children.length < 2) {
      return;
    }
    const id = window.setInterval(() => {
      setIndex((current) => (current + 1) % children.length);
    }, 3000);
    return () => window.clearInterval(id);
  }, [isInView, children.length]);

  return (
    <div
      ref={ref}
      className={cn('flex items-center overflow-hidden', className)}
      {...props}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.p
          key={index}
          className="min-w-0 w-full font-mono text-sm text-balance text-muted-foreground"
          initial="initial"
          animate="animate"
          exit="exit"
          transition={{ duration: 0.3 }}
          variants={reducedMotion ? reducedVariants : defaultVariants}
        >
          {children[index]}
        </motion.p>
      </AnimatePresence>
    </div>
  );
}
