import type { ParsedUrlQuery } from 'querystring';

/**
 * Play mode (`/?play=1`): visitors restyle the home page's frame. Every setting lives in the
 * query string, so a look can be shared as a link and a plain `/` is always the default page.
 */
export const PLAY_OPTIONS = {
  lines: [
    { value: 'guides', label: 'Guides' },
    { value: 'plain', label: 'Plain' },
    { value: 'none', label: 'None' }
  ],
  sep: [
    { value: 'stripes', label: 'Stripes' },
    { value: 'dots', label: 'Dots' },
    { value: 'solid', label: 'Solid' },
    { value: 'none', label: 'None' }
  ],
  width: [
    { value: 'narrow', label: 'Narrow' },
    { value: 'wide', label: 'Wide' }
  ],
  accent: [
    { value: 'mono', label: 'Mono' },
    { value: 'blue', label: 'Blue' },
    { value: 'violet', label: 'Violet' },
    { value: 'emerald', label: 'Emerald' },
    { value: 'amber', label: 'Amber' },
    { value: 'rose', label: 'Rose' }
  ]
} as const;

export type PlayKey = keyof typeof PLAY_OPTIONS;
export type PlaySettings = { [K in PlayKey]: (typeof PLAY_OPTIONS)[K][number]['value'] };

export const PLAY_KEYS = Object.keys(PLAY_OPTIONS) as PlayKey[];

/** The page as it ships; play mode with these values looks exactly like the normal page. */
export const PLAY_DEFAULTS: PlaySettings = {
  lines: 'guides',
  sep: 'stripes',
  width: 'narrow',
  accent: 'mono'
};

/** Swatches for the accent picker; the page colors live in styles/globals.css. */
export const ACCENT_SWATCHES: Record<PlaySettings['accent'], string> = {
  mono: 'var(--foreground)',
  blue: '#3b82f6',
  violet: '#8b5cf6',
  emerald: '#10b981',
  amber: '#f59e0b',
  rose: '#f43f5e'
};

export const isPlaying = (query: ParsedUrlQuery) => query.play === '1';

export function parsePlay(query: ParsedUrlQuery): PlaySettings {
  const settings = { ...PLAY_DEFAULTS };
  for (const key of PLAY_KEYS) {
    const value = query[key];
    if (PLAY_OPTIONS[key].some((option) => option.value === value)) {
      (settings as Record<PlayKey, string>)[key] = value as string;
    }
  }
  return settings;
}

/** The query for a look, keeping only what differs from the default so links stay short. */
export function playQuery(settings: PlaySettings): Record<string, string> {
  const query: Record<string, string> = { play: '1' };
  for (const key of PLAY_KEYS) {
    if (settings[key] !== PLAY_DEFAULTS[key]) query[key] = settings[key];
  }
  return query;
}

/** Asks an open toolbar to ease the page back to its defaults before play mode closes. */
export const PLAY_EXIT_EVENT = 'play:exit';
