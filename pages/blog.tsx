import { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { GetServerSideProps } from 'next';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import PageLayout from 'components/layouts/pageLayout';
import { PostList } from 'components/blog/post-list';
import { BlogListPost } from 'components/blog/post-item';
import { getDevtoPosts } from 'lib/fetchPosts';

const TITLE = 'Blog';
const DESCRIPTION = 'A list of all articles and posts!';

const Posts = ({ posts }: { posts: BlogListPost[] }) => {
  const [searchValue, setSearchValue] = useState('');

  const filteredPosts = posts
    .filter((post) => {
      const searchContent = `${post.title} ${post.description || ''}`;
      return searchContent.toLowerCase().includes(searchValue.toLowerCase());
    })
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at));

  return (
    <PageLayout title={TITLE} description={DESCRIPTION} animate={false}>
      <div className="min-h-screen pt-12">
        <div>
          <div className="px-4 pb-2 text-sm font-medium tracking-wider text-muted-foreground">
            Blog
          </div>
          <h1 className="screen-line-top screen-line-bottom -translate-x-px px-4 text-4xl font-medium tracking-tight text-balance">
            {DESCRIPTION}
          </h1>
        </div>

        <div className="h-4" />

        <div className="screen-line-top screen-line-bottom p-2">
          <div className="flex h-9 items-center gap-2 rounded-lg border border-border px-3">
            <SearchIcon className="size-4 shrink-0 text-muted-foreground" />
            <input
              placeholder="Search blog…"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              className="h-full w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        <PostList posts={filteredPosts} />

        <div className="h-4" />
      </div>
    </PageLayout>
  );
};

const root = process.cwd();

export const getServerSideProps: GetServerSideProps = async () => {
  let devtoPosts = await getDevtoPosts();

  const paths = fs.readdirSync(path.join(root, 'data', 'posts')).map((p) => p.replace(/\.mdx/, ''));
  const localPosts: BlogListPost[] = [];
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
      cover_image: frontmatter.cover_image || devPost?.cover_image || ''
    });
  });

  devtoPosts = devtoPosts.filter((data) => data.canonical_url.includes('dev.to'));
  const posts = [
    ...localPosts,
    ...devtoPosts.map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      published_at: post.published_at,
      cover_image: post.cover_image || post.social_image || ''
    }))
  ];

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
