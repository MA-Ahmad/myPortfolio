import { LOCAL_POSTS } from 'lib/generated/posts';

/** Slugs of the posts in data/posts, bundled at build time (see scripts/generate-content.mjs). */
export const localPostSlugs = (): string[] => LOCAL_POSTS.map((post) => post.slug);

/** A local post's MDX source, frontmatter included. Throws for a slug that isn't a local post. */
export const localPostSource = (slug: string): string => {
  const post = LOCAL_POSTS.find((p) => p.slug === slug);
  if (!post) throw new Error(`No local post data/posts/${slug}.mdx`);
  return post.source;
};
