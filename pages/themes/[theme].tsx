import { ReactElement, ReactNode } from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import Head from 'next/head';
import { useRouter } from 'next/router';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import {
  Activity,
  contributionsRevalidate,
  fetchGitHubContributions
} from 'lib/github-contributions';
import { THEMES, THEME_NAMES, ThemeName, isThemeName } from 'themes/registry';
import type { NextPageWithLayout } from '../_app';

type Props = {
  theme: ThemeName;
  contributions: Activity[];
  posts: BlogListPost[];
};

const ThemePage: NextPageWithLayout<Props> = ({ theme, contributions, posts }) => {
  const { title, Home } = THEMES[theme];

  return (
    <>
      <Meta title={title} />
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <Home contributions={contributions} posts={posts} />
    </>
  );
};

/** `getLayout` doesn't receive page props, so the theme is read from the route. */
function ThemeLayout({ children }: { children: ReactNode }) {
  const { query } = useRouter();
  if (!isThemeName(query.theme)) return <>{children}</>;
  const { Layout } = THEMES[query.theme];
  return <Layout>{children}</Layout>;
}

ThemePage.getLayout = (page: ReactElement) => <ThemeLayout>{page}</ThemeLayout>;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: THEME_NAMES.map((theme) => ({ params: { theme } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const theme = params?.theme;
  if (!isThemeName(theme)) return { notFound: true };

  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions(),
    getLatestBlogPosts().catch(() => [])
  ]);

  return {
    props: { theme, contributions, posts },
    revalidate: contributionsRevalidate(contributions)
  };
};

export default ThemePage;
