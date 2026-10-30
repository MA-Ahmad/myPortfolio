import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import { THEMES, isThemeName } from './registry';

/** `getLayout` doesn't receive page props, so the theme is read from the route. */
export function ThemeLayout({ children }: { children: ReactNode }) {
  const { query } = useRouter();
  if (!isThemeName(query.theme)) return <>{children}</>;
  const { Layout } = THEMES[query.theme];
  return <Layout>{children}</Layout>;
}
