import * as React from 'react';
import fs from 'fs';
import path from 'path';
import matter from 'gray-matter';
import html from 'remark-html';
import { remark } from 'remark';
import prism from 'remark-prism';
import { ArrowLeftIcon } from 'lucide-react';
import NextLink from 'next/link';
import { BlogPost } from '../../interfaces/interface';
import { GetStaticPaths, GetStaticProps, NextPage } from 'next';
import PageLayout from 'components/layouts/pageLayout';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { getDevtoPosts } from 'lib/fetchPosts';
import { SITE_URL } from 'data/constants';

export interface AllBlogProps {
  blogDetails: BlogPost;
  articleContent: string;
}

const ArticlePage: NextPage<AllBlogProps> = ({ articleContent, blogDetails }) => {
  const [coverFailed, setCoverFailed] = React.useState(false);

  if (!blogDetails) {
    return null;
  }

  return (
    <PageLayout
      title={blogDetails.title}
      description={blogDetails.description}
      image={blogDetails.cover_image}
      keywords={blogDetails.tags?.join(', ')}
      // Posts written on Dev.to are mirrored here; Dev.to keeps the original.
      canonical={
        blogDetails.canonical_url?.includes('dev.to') ? blogDetails.canonical_url : undefined
      }
      animate={false}
    >
      <div className="h-12" />

      <div className="screen-line-bottom h-px" />

      <div className="flex items-center justify-between p-2 pl-4">
        <NextLink
          href="/blog"
          className="nav-link inline-flex h-7 items-center gap-2 text-sm font-medium tracking-wider text-muted-foreground no-underline hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          Blog
        </NextLink>
      </div>

      <div className="screen-line-top screen-line-bottom py-px">
        <div className="h-4" />
      </div>

      <h1 className="screen-line-bottom px-4 text-4xl font-medium tracking-tight text-balance">
        {blogDetails.title}
      </h1>

      <div className="px-4 pt-8">
        {blogDetails.description ? (
          <p className="text-muted-foreground">{blogDetails.description}</p>
        ) : null}

        {blogDetails.cover_image && !coverFailed ? (
          <div className="relative my-5 select-none">
            <img
              className="aspect-[1200/630] w-full rounded-xl object-cover"
              src={blogDetails.cover_image}
              alt={blogDetails.title}
              onError={() => setCoverFailed(true)}
            />
            <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/15 dark:ring-white/15" />
          </div>
        ) : null}

        <div className="article">
          <div dangerouslySetInnerHTML={{ __html: articleContent }} />
        </div>
      </div>

      <div className="screen-line-top h-4" />
    </PageLayout>
  );
};

const root = process.cwd();
export const getStaticPaths: GetStaticPaths = async () => {
  const latestPosts = await getLatestBlogPosts();

  return {
    paths: latestPosts.map((post) => ({
      params: { slug: post.slug }
    })),
    fallback: true
  };
};

const markdownToHtml = async (markdown: string) => {
  const result = await remark().use(html).use(prism).process(markdown);
  return result.toString();
};

/**
 * Where an old post URL should point now that the blog only serves its latest Dev.to posts:
 * the local copy when one exists, otherwise the article on Dev.to.
 */
const movedPostURL = (slug: string, devData: BlogPost[], localSlugs: string[]) => {
  const post =
    devData.find((data) => data.slug === slug) ??
    devData.find(
      (data) =>
        !data.canonical_url.includes('dev.to') && data.canonical_url.split('/blog/')[1] === slug
    );
  if (!post) return null;

  const localSlug = post.canonical_url.startsWith(`${SITE_URL}/blog/`)
    ? post.canonical_url.split('/blog/')[1]
    : undefined;
  return localSlug && localSlugs.includes(localSlug) ? `/blog/${localSlug}` : post.url;
};

export const getStaticProps: GetStaticProps = async ({ params }) => {
  const slug = String(params?.slug);
  const latestPosts = await getLatestBlogPosts();
  const isLatestPost = latestPosts.some((post) => post.slug === slug);
  const localSlugs = fs
    .readdirSync(path.join(root, 'data', 'posts'))
    .map((file) => file.replace(/\.mdx/, ''));

  const devData: BlogPost[] = await getDevtoPosts();

  // Local posts stay up after they drop out of the latest list; other old links follow the post.
  if (!isLatestPost && !localSlugs.includes(slug)) {
    const destination = movedPostURL(slug, devData, localSlugs);
    return destination ? { redirect: { destination, permanent: true } } : { notFound: true };
  }

  const selectedBlog = devData.filter(
    (data) => data?.slug === params?.slug && data.canonical_url.includes('dev.to')
  );
  let blogObj = null,
    remarkContent = null;

  if (selectedBlog.length) {
    const res = await fetch(`https://dev.to/api/articles/${selectedBlog[0]?.id}`);
    blogObj = await res.json();
    remarkContent = await markdownToHtml(blogObj.body_markdown);
  } else {
    const markdownWithMeta = fs.readFileSync(
      path.join(root, 'data', 'posts', `${params?.slug}.mdx`),
      'utf-8'
    );
    const { data: frontmatter, content } = matter(markdownWithMeta);
    const devtoPost = devData.filter(
      (data) =>
        !data.canonical_url.includes('dev.to') &&
        data.canonical_url.split('/blog/')[1] === params?.slug
    )[0];
    if (devtoPost) {
      frontmatter['comments_count'] = devtoPost?.comments_count;
      frontmatter['public_reactions_count'] = devtoPost?.public_reactions_count;
      frontmatter['url'] = devtoPost?.url;
      if (!frontmatter.cover_image) {
        frontmatter['cover_image'] = devtoPost?.cover_image;
      }
    }
    blogObj = frontmatter;

    if (params?.slug) {
      blogObj.slug = params?.slug;
    }
    remarkContent = await markdownToHtml(content);
  }

  if (!devData) {
    return {
      notFound: true
    };
  }

  return {
    props: {
      articleContent: remarkContent,
      blogDetails: blogObj
    },
    revalidate: 1
  };
};

export default ArticlePage;
