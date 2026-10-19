import { ReactElement } from 'react';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import Meta from 'components/shared/meta';
import { Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { TerminalHome, TerminalLayout } from 'themes/terminal';
import type { NextPageWithLayout } from './_app';

type Props = {
  contributions: Activity[];
};

const TerminalPage: NextPageWithLayout<Props> = ({ contributions }) => {
  return (
    <>
      <Meta title="Muhammad Ahmad - Full Stack Developer" />
      <Head>
        <meta name="robots" content="noindex" />
      </Head>
      <TerminalHome contributions={contributions} />
    </>
  );
};

TerminalPage.getLayout = (page: ReactElement) => <TerminalLayout>{page}</TerminalLayout>;

export const getStaticProps: GetStaticProps<Props> = async () => {
  const contributions = await fetchGitHubContributions();

  return {
    props: { contributions },
    revalidate: 86400
  };
};

export default TerminalPage;
