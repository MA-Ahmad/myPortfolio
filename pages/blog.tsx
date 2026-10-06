import { useState } from 'react';
import PostCard from 'components/blog/card';
import { PageSlideFade, StaggerChildren } from 'components/shared/animations/page-transitions';
import Header from 'components/shared/header';
import { MotionBox } from 'components/shared/animations/motion';
import { GetServerSideProps } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { motion, AnimatePresence } from 'framer-motion';
import PageLayout from 'components/layouts/pageLayout';
import { BiSearch } from 'react-icons/bi';
import { getDbPosts, getDevtoPosts } from 'lib/fetchPosts';

const TURQUOISE = '#06b6d4';

const Posts = ({ posts }) => {
  const [searchValue, setSearchValue] = useState('');
  const { dbPosts, isLoading } = getDbPosts();

  const filteredBlogPosts = posts.filter((data) => {
    const searchContent = data.title + data.description;
    return searchContent.toLowerCase().includes(searchValue.toLowerCase());
  });
  filteredBlogPosts?.sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));

  const getPostLikes = (post) => {
    const p = dbPosts?.filter((p) => p.slug === post.slug)[0];
    return p?.likes || 0;
  };

  return (
    <>
      <PageLayout title="Blog" description="A list of all articles and posts!">
        <PageSlideFade>
          <Header underlineColor={TURQUOISE} className="mb-6 mt-0">
            Featured Articles
          </Header>
          <div className="relative max-w-md">
            <input
              placeholder="Search articles"
              onChange={(e) => setSearchValue(e.target.value)}
              className="w-full rounded-md bg-gray-100 px-3 py-2 pr-10 outline-none dark:bg-[#1e2533]"
            />
            <BiSearch className="absolute right-3 top-1/2 h-6 w-6 -translate-y-1/2" />
          </div>
          <StaggerChildren>
            <div className="mt-6 flex flex-col gap-4">
              <AnimatePresence>
                {!filteredBlogPosts.length && <h1 className="py-10 text-3xl font-bold">No articles found</h1>}
                {filteredBlogPosts.map((post, i) => (
                  <motion.div
                    initial="hidden"
                    animate="visible"
                    variants={{
                      hidden: (i) => ({
                        opacity: 0,
                        y: -30 * i
                      }),
                      visible: (i) => ({
                        opacity: 1,
                        y: 0,
                        transition: {
                          delay: i * 0.1
                        }
                      })
                    }}
                    custom={i}
                    key={post.slug}
                  >
                    <MotionBox whileHover={{ y: -5 }} key={i}>
                      <PostCard post={post} postDbLikes={getPostLikes(post)} isLoading={isLoading} />
                    </MotionBox>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </StaggerChildren>
        </PageSlideFade>
      </PageLayout>
    </>
  );
};

const root = process.cwd();

export const getServerSideProps: GetServerSideProps = async () => {
  let devtoPosts = await getDevtoPosts();

  const paths = fs.readdirSync(path.join(root, 'data', 'posts')).map((p) => p.replace(/\.mdx/, ''));
  const localPosts = [];
  paths.map((p) => {
    const markdownWithMeta = fs.readFileSync(path.join(root, 'data', 'posts', `${p}.mdx`), 'utf-8');
    const { data: frontmatter } = matter(markdownWithMeta);
    const devPost = devtoPosts.filter(
      (data) =>
        !data.canonical_url.includes('dev.to') && data.canonical_url.split('/blog/')[1] === p
    )[0];

    localPosts.push({
      slug: p,
      title: frontmatter.title,
      description: frontmatter.description,
      published_at: frontmatter.published_at,
      comments_count:
        (frontmatter.comments_count ? frontmatter.comments_count : devPost?.comments_count) || 0,
      public_reactions_count:
        (frontmatter.public_reactions_count
          ? frontmatter.public_reactions_count
          : devPost?.public_reactions_count) || 0,
      tag_list: frontmatter.tags
    });
  });

  devtoPosts = devtoPosts.filter((data) => data.canonical_url.includes('dev.to'));
  const posts = [...localPosts, ...devtoPosts];

  if (!posts) {
    return {
      notFound: true
    };
  }

  return {
    props: { posts }
  };
};

export default Posts;
