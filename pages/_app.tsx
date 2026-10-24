import { ReactElement, ReactNode, useEffect } from 'react';
import { NextPage } from 'next';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import AppLayout from 'components/layouts/appLayout';
import { PrismGlobal } from 'components/theme/prism';
import { useRouter } from 'next/router';
import * as gtag from 'lib/gtag';
import { AnimatePresence } from 'framer-motion';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { cn } from 'lib/cn';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter'
});

export type NextPageWithLayout<P = object, IP = P> = NextPage<P, IP> & {
  getLayout?: (page: ReactElement) => ReactNode;
};

type AppPropsWithLayout = AppProps & {
  Component: NextPageWithLayout;
};

const defaultLayout = (page: ReactElement) => <AppLayout>{page}</AppLayout>;

function MyApp({ Component, pageProps }: AppPropsWithLayout) {
  const router = useRouter();
  const getLayout = Component.getLayout ?? defaultLayout;
  useEffect(() => {
    const handleRouteChange = (url) => {
      gtag.pageview(url);
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange);
    };
  }, [router.events]);

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem={false}
      storageKey="chakra-ui-color-mode"
    >
      <style jsx global>{`
        :root {
          --font-inter: ${inter.style.fontFamily};
        }
      `}</style>
      <div className={cn(inter.className, inter.variable)}>
        <TooltipProvider delayDuration={200}>
          <PrismGlobal />
          {/* Theme Studio previews a page in a frame before opening it; that isn't a visit. */}
          <Analytics beforeSend={(event) => (window.self === window.top ? event : null)} />
          <SpeedInsights />
          {getLayout(
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => window.scrollTo(0, 0)}
            >
              <div key={router.route}>
                <Component {...pageProps} />
              </div>
            </AnimatePresence>
          )}
        </TooltipProvider>
      </div>
    </ThemeProvider>
  );
}

export default MyApp;
