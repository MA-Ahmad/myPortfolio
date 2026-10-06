import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useSwitchSound } from 'lib/use-switch-sound';
import { AnimatePresence } from 'framer-motion';
import { MotionBox } from '../shared/animations/motion';

export const ColorModeSwitcher = () => {
  const { setTheme, resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const play = useSwitchSound();

  const isDark = mounted && resolvedTheme === 'dark';

  const handleClick = () => {
    const next = isDark ? 'light' : 'dark';
    isDark ? play('off') : play('on');
    setTheme(next);
  };

  return (
    <AnimatePresence mode="wait" initial={false}>
      <MotionBox
        onClick={handleClick}
        key={isDark ? 'dark-icon' : 'light-icon'}
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 20, opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="cursor-pointer text-xl"
        role="button"
        aria-label="Toggle color mode"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            handleClick();
          }
        }}
      >
        {isDark ? '🌤' : '🌙'}
      </MotionBox>
    </AnimatePresence>
  );
};
