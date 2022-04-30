import { Fragment } from 'react';
import { Box } from '@chakra-ui/react';
import TopNav from '../shared/top-nav';
import Footer from '../shared/footer';
import styles from './appLayout.module.css';

function AppLayout(props) {
  return (
    <Fragment>
      <TopNav />
      <DottedSvgs />
      <Box textAlign="center" fontSize="xl" w={['90%', '85%', '80%']} maxW={800} mx="auto">
        <Box pt={'7rem'} pb={10}>
          {props.children}
        </Box>
      </Box>
      <Footer />
    </Fragment>
  );
}

function DottedSvgs() {
  return (
    <Box
      position="absolute"
      height="50rem"
      width="100%"
      overflow="hidden"
      display={['none', 'none', 'block']}
      zIndex={-1}
    >
      <Box position="relative" height="full" mx="auto" maxW="940px">
        <Box position="absolute" left="100%">
          <svg
            className={`${styles.dottedRightTransform} ${styles.dottedColor}`}
            color="rgba(55,65,81, 1)"
            width="404"
            height="784"
            fill="none"
            viewBox="0 0 404 784"
          >
            <defs>
              <pattern
                id="5d0dd344-b041-4d26-bec4-8d33ea57ec9b"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="0" y="0" width="4" height="4" fill="currentColor"></rect>
              </pattern>
            </defs>
            <rect width="404" height="784" fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9b)"></rect>
          </svg>
        </Box>
        <Box position="absolute" right="100%">
          <svg
            className={`${styles.dottedLeftTransform}`}
            color="rgba(55,65,81, 1)"
            width="404"
            height="784"
            fill="none"
            viewBox="0 0 404 784"
          >
            <defs>
              <pattern
                id="5d0dd344-b041-4d26-bec4-8d33ea57ec9b"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
              >
                <rect x="0" y="0" width="4" height="4" fill="currentColor"></rect>
              </pattern>
            </defs>
            <rect width="404" height="784" fill="url(#5d0dd344-b041-4d26-bec4-8d33ea57ec9b)"></rect>
          </svg>
        </Box>
      </Box>
    </Box>
  );
}

export default AppLayout;
