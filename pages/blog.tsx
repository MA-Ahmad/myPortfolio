import { Fragment } from "react";
import { Stack } from "@chakra-ui/react";
// import { articles } from "../../data/posts/articles";
import PostCard from "../components/blog/card";
import {
  PageSlideFade,
  StaggerChildren
} from "../components/ui/page-transitions";
import Header from "../components/layout/header";
import { MotionBox } from "../components/ui/motion";
import Meta from "../components/layout/meta";
import { GetStaticProps } from "next";
import { getAllBlogArticles } from "../lib/devto";
import fs from "fs";
import path from "path";
import matter from "gray-matter";

const TURQUOISE = "#06b6d4";

const Posts = ({ posts }) => {
  return (
    <Fragment>
      <Meta title="Blog" description="A list of all articles and posts!" />
      <PageSlideFade>
        <Header underlineColor={TURQUOISE} mt={0} mb={0}>
          Featured Articles
        </Header>
        <StaggerChildren>
          <Stack spacing={4} mt={12}>
            {posts.map((post, index) => (
              <MotionBox whileHover={{ y: -5 }} key={index}>
                <PostCard post={post} />
              </MotionBox>
            ))}
          </Stack>
        </StaggerChildren>
      </PageSlideFade>
    </Fragment>
  );
};

const root = process.cwd();

// export const getStaticProps: GetStaticProps = async () => {
//   const paths = fs
//     .readdirSync(path.join(root, "data", "articles"))
//     .map(p => p.replace(/\.mdx/, ""));
//   console.log(paths);

//   const articlesLocal = [];
//   paths.map(p => {
//     const markdownWithMeta = fs.readFileSync(
//       path.join(root, "data", "articles", `${p}.mdx`),
//       "utf-8"
//     );
//     const { data: frontmatter, content } = matter(markdownWithMeta);
//     articlesLocal.push({
//       slug: `blog/${p}`,
//       title: frontmatter.title,
//       description: frontmatter.description,
//       publishedAt: frontmatter.date,
//       tags: frontmatter.tags,
//       devToURL: null
//     });
//   });

//   const articlesDevto = await getAllBlogArticles();
//   const articles = [ ...articlesLocal, ...articlesDevto ]

//   return { props: { articles } };
// };

const getPosts = async () => {
  const res = await fetch("https://dev.to/api/articles?username=m_ahmad");
  const posts = await res.json();

  return posts;
};

export const getStaticProps: GetStaticProps = async () => {
  const paths = fs
    .readdirSync(path.join(root, "data", "posts"))
    .map(p => p.replace(/\.mdx/, ""));

  const localPosts = [];
  paths.map(p => {
    const markdownWithMeta = fs.readFileSync(
      path.join(root, "data", "posts", `${p}.mdx`),
      "utf-8"
    );
    const { data: frontmatter } = matter(markdownWithMeta);
    localPosts.push({
      slug: p,
      title: frontmatter.title,
      description: frontmatter.description,
      published_at: frontmatter.published_at,
      comments_count: frontmatter.comments_count,
      public_reactions_count: frontmatter.public_reactions_count,
      tag_list: frontmatter.tags,
      url: null
    });
  });

  const devtoPosts = await getPosts();
  const posts = [...localPosts, ...devtoPosts];

  if (!posts) {
    return {
      notFound: true
    };
  }

  return {
    props: { posts }, // will be passed to the page component as props
    revalidate: 1
  };
};

export default Posts;
