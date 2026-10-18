import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import { BlogListPost } from 'components/blog/post-item';
import { getDevtoPosts } from 'lib/fetchPosts';

export const LATEST_BLOG_COUNT = 10;

const root = process.cwd();

export const getLatestBlogPosts = async (): Promise<BlogListPost[]> => {
  let devtoPosts = await getDevtoPosts();

  const slugs = fs
    .readdirSync(path.join(root, 'data', 'posts'))
    .map((file) => file.replace(/\.mdx/, ''));

  const localPosts: BlogListPost[] = slugs.map((slug) => {
    const markdownWithMeta = fs.readFileSync(
      path.join(root, 'data', 'posts', `${slug}.mdx`),
      'utf-8'
    );
    const { data: frontmatter } = matter(markdownWithMeta);
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
