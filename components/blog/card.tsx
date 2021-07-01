import {
  VStack,
  HStack,
  Heading,
  Text,
  Tag,
  Link,
  Tooltip,
  useColorModeValue,
  Icon,
  Flex,
  Image
} from "@chakra-ui/react";
import NextLink from "next/link";
import { AiOutlineLike } from "react-icons/ai";
import { FaRegCommentDots } from "react-icons/fa";
import { getTagColor } from "../ui/theme";
import { CardTransition } from "../ui/page-transitions";
import IArticle from "../../interfaces/IArticle";
import { convertCanonicalURLToRelative } from "../../lib/devto";
import moment from "moment";

interface IProps {
  article: IArticle;
}

const PostCard: React.SFC<IProps> = ({ article }) => {
  const textColor = useColorModeValue("gray.500", "gray.200");
  const devIcon = useColorModeValue(
    "/assets/images/logos/dev.png",
    "/assets/images/logos/dev_white.png"
  );

  return (
    <CardTransition>
      <VStack
        spacing={1}
        p={4}
        _hover={{ shadow: "md", textDecoration: "none" }}
        borderWidth="1px"
        position="relative"
        rounded="md"
        bg={useColorModeValue("white", "gray.800")}
        align="left"
      >
        <Tooltip hasArrow label="Dev.to" placement="top">
          <Image
            src={devIcon}
            width="2rem"
            height="2rem"
            position="absolute"
            color="#cbd5e0"
            right="0.5rem"
            top="-14px"
          />
        </Tooltip>

        <Heading fontSize="lg" align="left" mt={0}>
          {/* <NextLink href={article.devToURL} passHref> */}
          <NextLink
            href={`/blog${convertCanonicalURLToRelative(article.canonical)}`}
            passHref
          >
            <Text as={Link}>
              {article.title}
            </Text>
          </NextLink>
        </Heading>
        <HStack spacing={2} isInline>
          <Tooltip hasArrow label="Published" placement="top">
            <Text fontSize="sm" fontWeight="400" color={textColor}>
              {moment(article.publishedAt).format("Do MMMM YYYY")}
            </Text>
          </Tooltip>
          <Tooltip hasArrow label="Reactions" placement="top">
            <Flex alignItems="center">
              <Text
                fontSize="sm"
                noOfLines={1}
                fontWeight="400"
                align="left"
                color={textColor}
              >
                {article.publicReactionsCount}
              </Text>
              <Icon as={AiOutlineLike} ml={1} mb={1} color={textColor} />
            </Flex>
          </Tooltip>
          <Tooltip hasArrow label="Comments" placement="top">
            <Flex alignItems="center">
              <Text
                fontSize="sm"
                noOfLines={1}
                fontWeight="400"
                align="left"
                color={textColor}
              >
                {article.commentsCount}
              </Text>
              <Icon as={FaRegCommentDots} ml={1} mb={1} color={textColor} />
            </Flex>
          </Tooltip>
          <HStack spacing={1} alignItems="center" d={["none", "none", "flex"]}>
            {article.tags.map(tag => (
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
        </HStack>
        <HStack spacing={1} alignItems="center" d={["flex", "flex", "none"]}>
          {article.tags.map(tag => (
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
        <Text align="left" fontSize="md" noOfLines={4} color={textColor}>
          {article.description}
        </Text>
      </VStack>
    </CardTransition>
  );
};

export default PostCard;
