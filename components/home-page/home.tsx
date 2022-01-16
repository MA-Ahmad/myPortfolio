import {
  Flex,
  Avatar,
  Box,
  Text,
  Badge,
  Stack,
  Link,
  UnorderedList,
  ListItem,
  useColorModeValue
} from "@chakra-ui/react";
import { MotionBox, MotionFlex } from "components/ui/motion";
import Header from "components/layout/header";
import NextLink from 'next/link'
import { useLinkColor, useHoverLinkColor } from 'components/ui/theme'
import PopularArticles from "./PopularArticles";
import { Props } from "interfaces/interface";

const ANIMATION_DURATION = 0.5;
const ORANGE = "#ff9400";

const Home: React.FC<Props> = props => {
  const { posts } = props;

  const linkColor = useLinkColor();
  const hoverLinkColor = useHoverLinkColor();
  return (
    <Flex direction="column" align="center">
      <Flex direction={["column", "column", "row"]}>
        <MotionBox
          opacity="0"
          initial={{
            translateX: -150,
            opacity: 0
          }}
          animate={{
            translateX: 0,
            opacity: 1,
            transition: {
              duration: ANIMATION_DURATION
            }
          }}
          m="auto"
          mb={[16, 16, "auto"]}
        >
          <Avatar
            size={"2xl"}
            // src={UserIcon}
            src={"https://avatars2.githubusercontent.com/u/37842853?v=4"}
          />
        </MotionBox>
        <MotionFlex
          ml={["auto", "auto", 16]}
          m={["auto", "initial"]}
          w={["90%", "85%", "80%"]}
          maxW="800px"
          opacity="0"
          justify="center"
          direction="column"
          initial={{
            opacity: 0,
            translateX: 150
          }}
          animate={{
            opacity: 1,
            translateX: 0,
            transition: {
              duration: ANIMATION_DURATION
            }
          }}
        >
          <Header underlineColor={ORANGE} emoji="👋" mt={0}>
            Hey!
          </Header>
          <Box as="h2" fontSize="2xl" fontWeight="400" textAlign="left">
            My name is{" "}
            <Box as="strong" fontWeight="600">
              Ahmad
            </Box>{" "}
            and I&apos;m a{" "}
            <Box as="span" whiteSpace="nowrap">
              Full Stack Developer and
            </Box>{" "}
            <Box as="span" whiteSpace="nowrap">
              an open source lover&nbsp;
            </Box>
            from{" "}
            <Box as="span" whiteSpace="nowrap">
              Pakistan 🇵🇰
            </Box>
          </Box>
          <Box as="h2" fontSize="2xl" fontWeight="400" mt={5} textAlign="left">
            This is my digital garden, where I write about the things I&apos;m
            working on and share what I&apos;ve learned. 😊
          </Box>
        </MotionFlex>
      </Flex>
      <MotionBox
        w="100%"
        opacity="0"
        initial={{
          translateY: 80
        }}
        animate={{
          translateY: 0,
          opacity: 1,
          transition: {
            delay: ANIMATION_DURATION - 0.1,
            duration: ANIMATION_DURATION
          }
        }}
        zIndex={1}
      >
        <Box mt={10}>
          <Stack
            mb={10}
            mx={[0, 0, 10]}
            padding={4}
            align="start"
            borderLeft="4px solid"
            borderColor={"#53c8c4"}
            color={"whatsapp"}
            _hover={{ shadow: "lg" }}
            backgroundColor={useColorModeValue("gray.100", "#1e2533")}
            rounded="sm"
            fontSize="md"
          >
            <Text textAlign="center" color="#53c8c4" fontWeight="bold">
              New year, new content:
            </Text>
            <UnorderedList textAlign="left" paddingLeft={5} m={0}>
              <ListItem>
                <NextLink href={'/projects'} passHref>
                  <Link color={linkColor}>
                    Projects page
                    <Badge ml="1" colorScheme="green">
                      New
                    </Badge>
                  </Link>
                </NextLink>
              </ListItem>
              <ListItem>
                <NextLink href={'/'} passHref>
                  <Link color={linkColor}>
                    Updated portfolio home page
                  </Link>
                </NextLink>
              </ListItem>
            </UnorderedList>
          </Stack>
          <PopularArticles posts={posts} />
        </Box>
      </MotionBox>
    </Flex>
  );
};

export default Home;
