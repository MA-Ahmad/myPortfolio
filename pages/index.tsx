import Home from 'components/home-page/home';
import { StudioDock } from 'components/shared/studio-dock';
import { GetStaticProps, NextPage } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import PageLayout from 'components/layouts/pageLayout';
import {
  Activity,
  contributionsRevalidate,
  fetchGitHubContributions
} from 'lib/github-contributions';
import { isPlaying } from 'lib/play';

// Only fetched once someone opens play mode, so the normal page carries none of it.
const PlayToolbar = dynamic(() => import('components/play/play-toolbar'), { ssr: false });

type HomePageProps = {
  contributions: Activity[];
};

const Index: NextPage<HomePageProps> = ({ contributions }) => {
  const router = useRouter();

  return (
    <PageLayout title="Muhammad Ahmad - Full Stack Developer">
      <Home contributions={contributions} />
      <StudioDock />
      {isPlaying(router.query) && <PlayToolbar />}
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
