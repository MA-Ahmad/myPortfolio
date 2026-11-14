import matter from 'gray-matter';
import { BlogListPost } from 'components/blog/post-item';
import { getDevtoPosts } from 'lib/fetchPosts';
import { localPostSlugs, localPostSource } from 'lib/local-posts';

export const LATEST_BLOG_COUNT = 10;

type DevtoPosts = Awaited<ReturnType<typeof getDevtoPosts>>;

/** The few Dev.to posts are optional: local posts are listed even when Dev.to is down. */
export const getDevtoPostsOrNull = (): Promise<DevtoPosts | null> =>
  getDevtoPosts().catch((error) => {
    console.error('Dev.to posts: request failed', error);
    return null;
  });

/** How long a blog page is cached: an hour, or five minutes when it was built without Dev.to. */
export const blogRevalidate = (devtoPosts: DevtoPosts | null) => (devtoPosts ? 3600 : 300);

// Pass the Dev.to list when the caller already has it (or [] when Dev.to is down).
export const getLatestBlogPosts = async (devtoPosts?: DevtoPosts): Promise<BlogListPost[]> => {
  devtoPosts ??= await getDevtoPosts();

  const localPosts: BlogListPost[] = localPostSlugs().map((slug) => {
    const { data: frontmatter } = matter(localPostSource(slug));
    const devPost = devtoPosts.find(
      (data) =>
        !data.canonical_url.includes('dev.to') && data.canonical_url.split('/blog/')[1] === slug
    );

    return {
      slug,
      title: frontmatter.title,
      description: frontmatter.description,
      published_at: frontmatter.published_at,
      cover_image: frontmatter.cover_image || devPost?.cover_image || ''
    };
  });

  const hostedDevtoPosts = devtoPosts
    .filter((data) => data.canonical_url.includes('dev.to'))
    .map((post) => ({
      slug: post.slug,
      title: post.title,
      description: post.description,
      published_at: post.published_at,
      cover_image: post.cover_image || post.social_image || ''
    }));

  return [...localPosts, ...hostedDevtoPosts]
    .sort((a, b) => +new Date(b.published_at) - +new Date(a.published_at))
    .slice(0, LATEST_BLOG_COUNT);
};
