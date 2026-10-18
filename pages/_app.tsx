import { useEffect } from 'react';
import { AppProps } from 'next/app';
import { Inter } from 'next/font/google';
import { ThemeProvider } from 'next-themes';
import { TooltipProvider } from '@radix-ui/react-tooltip';
import AppLayout from 'components/layouts/appLayout';
import { PrismGlobal } from 'components/theme/prism';
import { useRouter } from 'next/router';
import * as gtag from 'lib/gtag';
import { AnimatePresence } from 'framer-motion';
import { AccentGlobal } from 'components/theme/Accent';
import { Analytics } from '@vercel/analytics/react';
import { cn } from 'lib/cn';
import '../styles/globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
  variable: '--font-inter'
});

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter();
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
          <AccentGlobal />
          <PrismGlobal />
          <Analytics />
          <AppLayout>
            <AnimatePresence
              mode="wait"
              initial={false}
              onExitComplete={() => window.scrollTo(0, 0)}
            >
              <div key={router.route}>
                <Component {...pageProps} />
              </div>
            </AnimatePresence>
          </AppLayout>
        </TooltipProvider>
      </div>
    </ThemeProvider>
  );
}

export default MyApp;
