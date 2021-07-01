import fs from "fs";
import moment from "moment";
import Head from "next/head";
import { GetStaticPaths, GetStaticProps } from "next";
import path from "path";
import { ParsedUrlQuery } from "querystring";
import IArticle from "../../interfaces/IArticle";
import { getAllBlogArticles, getArticleFromCache } from "../../lib/devto";
import { Image } from "@chakra-ui/image";
import {
  Heading,
  HStack,
  VStack,
  Text,
  Avatar,
  Box,
  Tag,
  Flex,
  Icon,
  useColorModeValue
} from "@chakra-ui/react";
import { getTagColor } from "../../components/ui/theme";
import remark from "remark";
import prism from "remark-prism";
import remarkHtml from "remark-html";

const cacheFile = ".dev-to-cache.json";

interface IProps {
  article: IArticle;
  publishedDate: string;
  remarkContent: string;
}

interface IParams extends ParsedUrlQuery {
  slug: string;
}

const ArticlePage = ({ article, publishedDate, remarkContent }: IProps) => {
  const textColor = useColorModeValue("gray.500", "gray.200");

  return (
    <>
      <Head>
        <meta name="viewport" content="initial-scale=1.0, width=device-width" />
        <meta name="Description" content="Put your description here." />
        <link
          href="https://unpkg.com/prismjs@0.0.1/themes/prism-okaidia.css"
          rel="stylesheet"
        />
      </Head>
      <Box textAlign="left">
        {article?.coverImage && (
          <Image
            src={article.coverImage}
            objectFit="cover"
            borderRadius="5px"
            maxWidth="100%"
            height="auto"
            alt={`Cover for ${article.title}`}
          />
        )}
        <Heading as="h1" size="2xl" mt="15px">
          {article?.title}
        </Heading>
        <HStack
          spacing={2}
          mt="15px"
          isInline
          justify="space-between"
          align="center"
        >
          <HStack spacing={1} alignItems="center" d={["none", "flex", "flex"]}>
            {article?.tags.map(tag => (
              <Tag
                size="md"
                padding="0 3px"
                key={tag}
                colorScheme={getTagColor(tag)}
                fontWeight="500"
              >
                {`#${tag}`}
              </Tag>
            ))}
          </HStack>
          <HStack>
            <Flex alignItems="center">
              <Text
                fontSize="lg"
                noOfLines={1}
                fontWeight="400"
                align="left"
                color={textColor}
              >
                {article?.publicReactionsCount}&nbsp;
                <span role="img" aria-label="Heart">
                  💖
                </span>
              </Text>
            </Flex>
          </HStack>
        </HStack>

        <HStack mt="15px" width="100%" justify="space-between">
          <HStack>
            <Avatar
              size={"md"}
              src={"https://avatars2.githubusercontent.com/u/37842853?v=4"}
            />
            <VStack align="start" spacing="0" fontSize="sm">
              <Text fontWeight="bold">Muhammad Ahmad</Text>
              <Text>{publishedDate}</Text>
            </VStack>
          </HStack>
        </HStack>

        <Box mt="15px" maxW={800}>
          <Box
            as="article"
            width="100%"
            px="6"
            margin="0 auto"
            dangerouslySetInnerHTML={{ __html: article?.html }}
          />

          {/* <article
          className="prose dark:prose-dark lg:prose-lg w-full md:w-5/6 xl:w-9/12"
          dangerouslySetInnerHTML={{ __html: article?.html }}
        /> */}
        </Box>
      </Box>
    </>
  );
};

const markdownToHtml = async (markdown: string) => {
  const result = await remark()
    .use(remarkHtml)
    .use(prism)
    .process(markdown);
  return result.toString();
};

export const getStaticProps: GetStaticProps = async context => {
  const { slug } = context.params as IParams;
  console.log(slug);

  // Read cache and parse to object
  const cacheContents = fs.readFileSync(
    path.join(process.cwd(), cacheFile),
    "utf-8"
  );
  const cache = JSON.parse(cacheContents);

  // Fetch the article from the cache
  const article: IArticle = await getArticleFromCache(cache, slug);

  // const article: IArticle = await getAllArticles()

  const publishedDate = moment(article.publishedAt).format("Do MMMM YYYY");

  const remarkContent = await markdownToHtml(article.markdown);

  console.log(article);

  return { props: { article, publishedDate, remarkContent } };
};

export const getStaticPaths: GetStaticPaths = async () => {
  // Get the published articles and cache them for use in getStaticProps
  const articles: IArticle[] = await getAllBlogArticles();

  // Save article data to cache file
  fs.writeFileSync(
    path.join(process.cwd(), cacheFile),
    JSON.stringify(articles)
  );

  // Get the paths we want to pre-render based on posts
  const paths = articles.map(({ slug }) => {
    return {
      params: { slug }
    };
  });

  // We'll pre-render only these paths at build time.
  // { fallback: false } means other routes should 404.
  //   return { paths, fallback: false };
  return { paths, fallback: true };
};

export default ArticlePage;
