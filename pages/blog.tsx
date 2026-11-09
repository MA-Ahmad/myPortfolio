import { useState } from 'react';
import { SearchIcon } from 'lucide-react';
import { GetStaticProps } from 'next';
import PageLayout from 'components/layouts/pageLayout';
import { PostList } from 'components/blog/post-list';
import { BlogListPost } from 'components/blog/post-item';
import { blogRevalidate, getDevtoPostsOrNull, getLatestBlogPosts } from 'lib/blogPosts';

const TITLE = 'Blog';
const DESCRIPTION = 'A list of all articles and posts!';

const Posts = ({ posts }: { posts: BlogListPost[] }) => {
  const [searchValue, setSearchValue] = useState('');

  const filteredPosts = posts.filter((post) => {
    const searchContent = `${post.title} ${post.description || ''}`;
    return searchContent.toLowerCase().includes(searchValue.toLowerCase());
  });

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

export const getStaticProps: GetStaticProps = async () => {
  const devtoPosts = await getDevtoPostsOrNull();
  const posts = await getLatestBlogPosts(devtoPosts ?? []);

  if (!posts.length) {
    return { notFound: true, revalidate: 300 };
  }

  return {
    props: { posts },
    revalidate: blogRevalidate(devtoPosts)
  };
};

export default Posts;
