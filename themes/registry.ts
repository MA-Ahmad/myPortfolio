import type { ComponentType, ReactNode } from 'react';
import type { Activity } from 'lib/github-contributions';
import type { BlogListPost } from 'components/blog/post-item';
import { TerminalHome, TerminalLayout } from './terminal';
import { NotebookHome, NotebookLayout } from './notebook';
import { MidnightHome, MidnightLayout, MidnightSkills, MidnightWork } from './midnight';

export type ThemeHomeProps = {
  contributions: Activity[];
  posts: BlogListPost[];
};

type Theme = {
  title: string;
  Home: ComponentType<ThemeHomeProps>;
  Layout: ComponentType<{ children: ReactNode }>;
  /** Extra pages, served at /themes/<key>/<page>. They share the theme's Layout with Home. */
  pages?: Record<string, { title: string; Page: ComponentType<ThemeHomeProps> }>;
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
  },
  midnight: {
    title: 'Muhammad Ahmad - Full Stack Developer',
    Home: MidnightHome,
    Layout: MidnightLayout,
    pages: {
      work: { title: 'Work - Muhammad Ahmad', Page: MidnightWork },
      skills: { title: 'Skills - Muhammad Ahmad', Page: MidnightSkills }
    }
  }
} satisfies Record<string, Theme>;

/** `THEMES` is typed as a literal, so read the optional `pages` through the wider type. */
export function themePages(theme: ThemeName): NonNullable<Theme['pages']> {
  return (THEMES[theme] as Theme).pages ?? {};
}

export type ThemeName = keyof typeof THEMES;

export const THEME_NAMES = Object.keys(THEMES) as ThemeName[];

export function isThemeName(value: unknown): value is ThemeName {
  return typeof value === 'string' && value in THEMES;
}
