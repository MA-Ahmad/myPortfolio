import Header from "../../components/layout/header";
import {
  VStack,
  HStack,
  Heading,
  Text,
  Tag,
  Link,
  Tooltip,
  useColorModeValue,
  UnorderedList,
  ListItem,
  Icon,
  Flex,
  Box,
  Button,
  Divider
} from "@chakra-ui/react";
import { FaEye } from "react-icons/fa";
import { FiGithub } from "react-icons/fi";
import { BiLinkExternal } from "react-icons/bi";
import { articles } from "../../data/posts/articles";
import { getTagColor } from "../../components/ui/theme";
import Carousel from "../../components/blog/carousel";
import Meta from '../../components/layout/meta';

const NotebookPost = () => {
  const textColor = useColorModeValue("gray.500", "gray.200");
  const post = articles[4];

  return (
    <>
      <Meta title='Blog' description='create Notebook app with react and chakraUI' />
      <VStack mt={0} mb={6} spacing={1} align="start">
        <Heading as="h1" fontSize="3xl" lineHeight="shorter" fontWeight="bold">
          {post.title}
        </Heading>
        <Divider
          orientation="horizontal"
          opacity={1}
          borderBottomWidth={0}
          height={"1px"}
          bg={"gray.200"}
        />
      </VStack>
      <Flex
        justifyContent={"space-between"}
        flexDirection={["column", "row", "row"]}
      >
        <HStack spacing={2} isInline>
          <Text fontSize="sm" fontWeight="400" color={textColor}>
            {post.published}
          </Text>
          <Text fontSize="sm" fontWeight="400" color={textColor}>
            •
          </Text>
          <Tooltip hasArrow label="Views" placement="top">
            <Flex alignItems="center">
              <Text
                fontSize="sm"
                noOfLines={1}
                fontWeight="400"
                align="left"
                color={textColor}
              >
                {post.views}
              </Text>
              <Icon as={FaEye} ml={1} color={textColor} />
            </Flex>
          </Tooltip>

          <Text fontSize="sm" fontWeight="600" color={textColor}>
            •
          </Text>
          <Tooltip hasArrow label="Read time" placement="top">
            <Text
              fontSize="sm"
              noOfLines={1}
              fontWeight="400"
              align="left"
              color={textColor}
            >
              {post.readTime}
            </Text>
          </Tooltip>
        </HStack>
        <HStack spacing={1} alignItems="center">
          {post.tags.map(tag => (
            <Tag
              size="sm"
              padding="0 3px"
              key={tag}
              colorScheme={getTagColor(tag)}
            >
              {tag}
            </Tag>
          ))}
        </HStack>
      </Flex>
      <HStack align="end" mt={5}>
        <Link href={post.live} isExternal>
          <Button
            ml={2}
            variant="outline"
            size={"sm"}
            color={useColorModeValue("green.600", "green.200")}
            bg={useColorModeValue("white", "gray.800")}
            leftIcon={<BiLinkExternal size={18} />}
          >
            Demo
          </Button>
        </Link>
        <Link href={post.github_url} isExternal>
          <Button
            ml={2}
            variant="outline"
            size={"sm"}
            color={useColorModeValue("green.600", "green.200")}
            bg={useColorModeValue("white", "gray.800")}
            leftIcon={<FiGithub size={18} />}
          >
            Github link
          </Button>
        </Link>
      </HStack>

      <Box height={["35vh", "45vh", "55vh", "70vh"]} marginTop={5}>
        <Carousel images={post.images} />
      </Box>
      <VStack spacing={5} align={"start"} mt={6}>
        <Header fontSize={"xl"} mt={0} mb={0}>
          What will you learn?
        </Header>
        <Box fontSize="md">
          <UnorderedList textAlign="left" paddingLeft={5} m={0}>
            <ListItem>How to create a CRUD app with react</ListItem>
            <ListItem>How to create a responsive app using ChakraUi</ListItem>
            <ListItem>How to use animations with framer-motion</ListItem>
            <ListItem>How to create slider with framer-motion</ListItem>
          </UnorderedList>
        </Box>
      </VStack>
      <VStack spacing={5} align={"start"} mt={6}>
        <Header fontSize={"xl"} mt={0} mb={0}>
          Built with
        </Header>
        <Box fontSize="md">
          <UnorderedList textAlign="left" paddingLeft={5} m={0}>
            <ListItem>
              Programming language -{" "}
              <Link
                href="https://www.typescriptlang.org/"
                isExternal
                color={"blue.500"}
              >
                Typescript
              </Link>
            </ListItem>
            <ListItem>
              Front-end library -{" "}
              <Link
                href="https://github.com/facebook/react/"
                isExternal
                color={"blue.500"}
              >
                React
              </Link>
            </ListItem>
            <ListItem>
              UI components -{" "}
              <Link href="https://chakra-ui.com/" isExternal color={"blue.500"}>
                Chakra-ui
              </Link>
            </ListItem>
            <ListItem>
              Animation library -{" "}
              <Link
                href="https://www.framer.com/motion/"
                isExternal
                color={"blue.500"}
              >
                Framer motion
              </Link>
            </ListItem>
            <ListItem>
              Notes display -{" "}
              <Link
                href="https://github.com/tsuyoshiwada/react-stack-grid"
                isExternal
                color={"blue.500"}
              >
                react-stack-grid
              </Link>
            </ListItem>
            <ListItem>
              Forms Validation -{" "}
              <Link
                href="https://react-hook-form.com/"
                isExternal
                color={"blue.500"}
              >
                React hook form
              </Link>
            </ListItem>
            <ListItem>
              Icons -{" "}
              <Link
                href="https://react-icons.github.io/react-icons/"
                isExternal
                color={"blue.500"}
              >
                React icons
              </Link>
            </ListItem>
            <ListItem>
              Images placeholder -{" "}
              <Link href="https://blurha.sh/" isExternal color={"blue.500"}>
                blurhash
              </Link>
            </ListItem>
            <ListItem>
              Progressive image loading -{" "}
              <Link
                href="https://github.com/FormidableLabs/react-progressive-image"
                isExternal
                color={"blue.500"}
              >
                react-progressive-image
              </Link>
            </ListItem>
          </UnorderedList>
        </Box>
      </VStack>
    </>
  );
};

export default NotebookPost;
