import React from 'react';
import { ColorKeys, accentKeys } from 'components/theme';
import { useLocalSetting } from 'components/hooks/useLocalSetting';
import { colorScales, getTagBackgroundDark } from 'components/theme/colors';

export const AccentPickerIcon = ({ className = '' }: { className?: string }) => {
  return (
    <svg viewBox="0 0 200 200" className={`h-[1.3em] w-[1.3em] ${className}`} aria-hidden>
      <path
        fill="currentColor"
        d="M 100, 100 m -75, 0 a 75,75 0 1,0 150,0 a 75,75 0 1,0 -150,0"
      />
    </svg>
  );
};

export const AccentPicker = ({
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement>) => {
  const [key, setAccentKey] = useLocalSetting<ColorKeys>('accent', 'defaultAccent');

  const update = React.useCallback(() => {
    let index = accentKeys.indexOf(key);
    index = (index + 1) % accentKeys.length;
    setAccentKey(accentKeys[index]);
  }, [key, setAccentKey]);

  return (
    <button
      type="button"
      className={`inline-flex items-center justify-center rounded-full p-1 text-[var(--link-color)] ${className}`}
      onMouseDown={update}
      {...props}
    >
      <AccentPickerIcon />
    </button>
  );
};

export const AccentGlobal: React.FC = () => {
  const [accentKey] = useLocalSetting<ColorKeys>('accent', 'defaultAccent');

  React.useEffect(() => {
    const accent = colorScales[accentKey] || colorScales.defaultAccent;
    const root = document.documentElement;
    ([50, 100, 200, 300, 400, 500, 600, 700, 800, 900] as const).forEach((step) => {
      root.style.setProperty(`--colors-accent-${step}`, accent[step]);
    });
    root.style.setProperty('--colors-accent-tag-bg-dark', getTagBackgroundDark(accentKey));
  }, [accentKey]);

  return null;
};
