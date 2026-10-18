import { useEffect, useState } from 'react';
import { useTheme } from 'next-themes';
import { useSwitchSound } from 'lib/use-switch-sound';

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
    <button
      type="button"
      onClick={handleClick}
      className="cursor-pointer text-xl"
      aria-label="Toggle color mode"
    >
      {isDark ? '🌤' : '🌙'}
    </button>
  );
};
