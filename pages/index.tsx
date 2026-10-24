import Home from 'components/home-page/home';
import { StudioDock } from 'components/shared/studio-dock';
import { GetStaticProps, NextPage } from 'next';
import PageLayout from 'components/layouts/pageLayout';
import {
  Activity,
  contributionsRevalidate,
  fetchGitHubContributions
} from 'lib/github-contributions';

type HomePageProps = {
  contributions: Activity[];
};

const Index: NextPage<HomePageProps> = ({ contributions }) => {
  return (
    <PageLayout title="Muhammad Ahmad - Full Stack Developer">
      <Home contributions={contributions} />
      <StudioDock />
    </PageLayout>
  );
};

export const getStaticProps: GetStaticProps<HomePageProps> = async () => {
  const contributions = await fetchGitHubContributions();

  return {
    props: { contributions },
    revalidate: contributionsRevalidate(contributions)
  };
};

export default Index;
