import type { ComponentType, ReactNode } from 'react';
import type { Activity } from 'lib/github-contributions';
import type { BlogListPost } from 'components/blog/post-item';
import { TerminalHome, TerminalLayout } from './terminal';
import { NotebookHome, NotebookLayout } from './notebook';

export type ThemeHomeProps = {
  contributions: Activity[];
  posts: BlogListPost[];
};

type Theme = {
  title: string;
  Home: ComponentType<ThemeHomeProps>;
  Layout: ComponentType<{ children: ReactNode }>;
};

// Each key is served at /themes/<key>. Add a theme by creating themes/<key>/ and listing it here.
export const THEMES = {
  terminal: {
    title: 'Muhammad Ahmad - Full Stack Developer',
    Home: TerminalHome,
    Layout: TerminalLayout
  },
  notebook: {
    title: 'Muhammad Ahmad',
    Home: NotebookHome,
    Layout: NotebookLayout
  }
} satisfies Record<string, Theme>;

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in THEMES;
}
