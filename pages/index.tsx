import Home from 'components/home-page/home';
import { GetStaticProps, NextPage } from 'next';
import PageLayout from 'components/layouts/pageLayout';
import { Activity, fetchGitHubContributions } from 'lib/github-contributions';

type HomePageProps = {
  contributions: Activity[];
};

const Index: NextPage<HomePageProps> = ({ contributions }) => {
  return (
    <PageLayout title="Muhammad Ahmad - Full Stack Developer">
      <Home contributions={contributions} />
    </PageLayout>
  );
};

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const contributions = await fetchGitHubContributions();

  return {
    props: { contributions },
    revalidate: 86400
  };
};

export default Index;
