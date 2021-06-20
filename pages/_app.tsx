import App, { AppProps } from 'next/app'
import { ChakraProvider } from "@chakra-ui/react"
import Layout from '../components/layout/layout';
import { theme } from '../components/ui/theme';

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <ChakraProvider theme={theme} resetCSS={true}>
      <Layout>
        <Component {...pageProps} />
      </Layout>
    </ChakraProvider>
  )
}

MyApp.getInitialProps = async (appContext) => {
  const appProps = await App.getInitialProps(appContext);
  return { ...appProps };
};
export default MyApp
