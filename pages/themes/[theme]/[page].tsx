import { ReactElement } from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import {
  Activity,
  contributionsRevalidate,
  fetchGitHubContributions
} from 'lib/github-contributions';
import { ThemeLayout } from 'themes/theme-layout';
import { THEME_NAMES, ThemeName, isThemeName, themePages } from 'themes/registry';
import type { NextPageWithLayout } from '../../_app';

type Props = {
  theme: ThemeName;
  page: string;
  contributions: Activity[];
  posts: BlogListPost[];
};

const ThemeSubPage: NextPageWithLayout<Props> = ({ theme, page, contributions, posts }) => {
  const { title, Page } = themePages(theme)[page];

  return (
    <>
      <Meta title={title} noindex />
      <Page contributions={contributions} posts={posts} />
    </>
  );
};

ThemeSubPage.getLayout = (page: ReactElement) => <ThemeLayout>{page}</ThemeLayout>;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: THEME_NAMES.flatMap((theme) =>
    Object.keys(themePages(theme)).map((page) => ({ params: { theme, page } }))
  ),
  fallback: false
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const theme = params?.theme;
  const page = params?.page;
  if (!isThemeName(theme) || typeof page !== 'string' || !(page in themePages(theme))) {
    return { notFound: true };
  }

  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions(),
    getLatestBlogPosts().catch(() => [])
  ]);

  return {
    props: { theme, page, contributions, posts },
    revalidate: contributionsRevalidate(contributions)
  };
};

export default ThemeSubPage;
