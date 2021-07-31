import { useEffect } from 'react'
import App, { AppProps } from "next/app";
import { ChakraProvider } from "@chakra-ui/react";
import Layout from "components/layout/layout";
import { theme } from "components/ui/theme";
import { PrismGlobal } from 'components/ui/prism'
import { useRouter } from 'next/router'
import * as gtag from 'lib/gtag'

function MyApp({ Component, pageProps }: AppProps) {
  const router = useRouter()
  useEffect(() => {
    const handleRouteChange = (url) => {
      gtag.pageview(url)
    }
    router.events.on('routeChangeComplete', handleRouteChange)
    return () => {
      router.events.off('routeChangeComplete', handleRouteChange)
    }
  }, [router.events])

  return (
    <ChakraProvider theme={theme} resetCSS={true}>
      <PrismGlobal />
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ChakraProvider>
  );
}

MyApp.getInitialProps = async appContext => {
  const appProps = await App.getInitialProps(appContext);
  return { ...appProps };
};
export default MyApp;
