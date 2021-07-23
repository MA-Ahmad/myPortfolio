import fs from "fs";
import path from "path";
import matter from "gray-matter";
import html from "remark-html";
import {
  Box,
  Heading,
  VStack,
  Text,
  HStack,
  Tag,
  Image
} from "@chakra-ui/react";
import remark from "remark";
import prism from "remark-prism";
import { getTagColor } from "../../components/ui/theme";
import dayjs from "dayjs";
import localizedFormat from "dayjs/plugin/localizedFormat";

dayjs.extend(localizedFormat);

const ArticlePage = ({
  frontmatter: { title, date, description, category, tags, coverImage },
  slug,
  remarkContent
}) => {
  return (
    <Box>
      <VStack marginBottom="5" alignItems="left" textAlign="left">
        {coverImage ? (
          <Image src={coverImage} layout="fixed" rounded="md" />
        ) : (
          ""
        )}
        <Heading as="h1" size="lg">
          {title}
        </Heading>
        <HStack spacing={1} alignItems="center" d={["none", "none", "flex"]}>
          {tags.map(tag => (
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
        <HStack spacing={2} alignItems="left">
          <Text fontSize="xs">Published on</Text>
          <Text fontSize="xs" fontWeight="bold">
            {dayjs(date).format("LL")}
          </Text>
        </HStack>
      </VStack>
      <Box className="article">
        <div dangerouslySetInnerHTML={{ __html: remarkContent }} />
      </Box>
    </Box>
  );
};

export async function markdownToHtml(markdown) {
  const result = await remark()
    .use(html)
    .use(prism)
    .process(markdown);
  return result.toString();
}

const root = process.cwd();

export async function getStaticPaths() {
  return {
    fallback: false,
    paths: fs.readdirSync(path.join(root, "data", "articles")).map(p => ({
      params: {
        slug: p.replace(/\.mdx/, "")
      }
    }))
  };
}

export async function getStaticProps({ params: { slug } }) {
  const markdownWithMeta = fs.readFileSync(
    path.join(root, "data", "articles", `${slug}.mdx`),
    "utf-8"
  );

  const { data: frontmatter, content } = matter(markdownWithMeta);

  const remarkContent = await markdownToHtml(content);

  return {
    props: {
      frontmatter,
      slug,
      remarkContent
    }
  };
}

export default ArticlePage;
