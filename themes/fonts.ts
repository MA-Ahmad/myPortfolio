/**
 * The font files each theme renders with, by the start of their built file name (from the font's
 * source file, e.g. geist's `Geist-Variable.woff2` builds to `Geist_Variable-…`). `_document`
 * preloads them on that theme's pages, which Next skips on the dynamic `/themes/[theme]` route.
 * Only a theme's own fonts: that route's manifest lists every theme's, and preloading those too
 * would hold up the page for fonts it never uses.
 */
export const THEME_FONTS: Record<string, string[]> = {
  panorama: ['Geist_Variable', 'GeistMono_Variable']
};
