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
  Image,
  Badge,
  Box
} from "@chakra-ui/react";
import NextLink from 'next/link'
import { FaEye } from "react-icons/fa";
import { getTagColor } from "../ui/theme";
import { CardTransition } from "../ui/page-transitions";

export interface PostCardProps {
  article: article;
}

const PostCard: React.SFC<PostCardProps> = ({ article }) => {
  const textColor = useColorModeValue("gray.500", "gray.200");
  const devIcon = useColorModeValue('/assets/images/logos/dev.png', '/assets/images/logos/dev_white.png');

  return (
    <CardTransition>
      <VStack
        spacing={1}
        p={4}
        isExternal
        _hover={{ shadow: "md", textDecoration: "none" }}
        borderWidth="1px"
        position="relative"
        rounded="md"
        bg={useColorModeValue("white", "gray.800")}
        align="left"
      >
        {article.external ? (
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
        ) : (
            <Tooltip hasArrow label="mahmad.me" placement="top">
              <Box position="absolute" color="#cbd5e0" right="0.5rem" top="-14px">
                <Badge ml="1" variant="solid" colorScheme="blackAlpha">
                  Website
              </Badge>
              </Box>
            </Tooltip>
          )}
        <Heading fontSize="lg" align="left" mt={0}>
          {article.external ? (
            <NextLink href={article.link} passHref>
              <Text as={Link} target="_blank">
                {article.title}
              </Text>
            </NextLink>
          ) : (
              <NextLink href={article.link} passHref>
                <Link>
                  {article.title}
                </Link>
              </NextLink>
            )}
          {article.isNew && (
            <Badge
              ml="1"
              mb="1"
              colorScheme="green"
              fontSize="0.7em"
              lineHeight={1.5}
            >
              New
            </Badge>
          )}
        </Heading>
        <HStack spacing={2} isInline>
          <Tooltip hasArrow label="Published" placement="top">
            <Text fontSize="sm" fontWeight="400" color={textColor}>
              {article.published}
            </Text>
          </Tooltip>
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
                {article.views}
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
              {article.readTime}
            </Text>
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
          {article.desc}
        </Text>
      </VStack>
    </CardTransition>
  );
};

export default PostCard;
