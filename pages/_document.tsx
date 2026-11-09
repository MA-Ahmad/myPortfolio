import Document, { Html, Head, Main, NextScript } from 'next/document';
import { useHtmlContext } from 'next/dist/shared/lib/html-context.shared-runtime';
import Metrics from 'components/metrics';
import { THEME_FONTS } from 'themes/fonts';

/**
 * Preloads a theme page's own fonts. Next looks a page's fonts up in its font manifest by the
 * requested path (`/themes/panorama`), but the manifest keys them by route (`/themes/[theme]`), so
 * a theme page preloads only `_app`'s fonts. Its own are found late, from the CSS, and swap in after
 * the first paint, rewrapping the text. This adds the ones the theme lists in `themes/fonts.ts`.
 */
function ThemeFontPreloads() {
  const {
    nextFontManifest,
    __NEXT_DATA__,
    dangerousAsPath,
    assetPrefix = '',
    assetQueryString
  } = useHtmlContext();
  const theme = /^\/themes\/([^/?#]+)/.exec(dangerousAsPath)?.[1];
  const prefixes = theme ? THEME_FONTS[theme] : undefined;
  if (!nextFontManifest || !prefixes) return null;
  const app = new Set(nextFontManifest.pages['/_app'] ?? []);
  const files = (nextFontManifest.pages[__NEXT_DATA__.page] ?? []).filter((file) => {
    const name = file.split('/').pop()!;
    return !app.has(file) && prefixes.some((prefix) => name.startsWith(prefix));
  });
  return (
    <>
      {files.map((file) => (
        <link
          key={file}
          rel="preload"
          href={`${assetPrefix}/_next/${encodeURI(file)}${assetQueryString}`}
          as="font"
          type={`font/${file.split('.').pop()}`}
          crossOrigin="anonymous"
          data-next-font={file.includes('-s') ? 'size-adjust' : ''}
        />
      ))}
    </>
  );
}

class MyDocument extends Document {
  render() {
    return (
      <Html lang="en">
        <Head>
          <link rel="icon" href="/favicon.ico" />
          <ThemeFontPreloads />
          <Metrics />
        </Head>
        <body>
          <Main />
          <NextScript />
        </body>
      </Html>
    );
  }
}

export default MyDocument;
