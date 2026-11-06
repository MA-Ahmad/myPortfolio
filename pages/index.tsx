import Home from 'components/home-page/home';
import { StudioDock } from 'components/shared/studio-dock';
import { PersonJsonLd } from 'components/shared/person-json-ld';
import { GetStaticProps, NextPage } from 'next';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useRef, useState } from 'react';
import PageLayout from 'components/layouts/pageLayout';
import {
  Activity,
  contributionsRevalidate,
  fetchGitHubContributions
} from 'lib/github-contributions';
import { isPlaying } from 'lib/play';
import {
  REDRAW_EVENT,
  type RedrawOrigin,
  blankPage,
  isRedrawQuery,
  requestRedraw
} from 'lib/redraw';

// Only fetched once someone opens play mode, so the normal page carries none of it.
const PlayToolbar = dynamic(() => import('components/play/play-toolbar'), { ssr: false });
// Same for redraw: the agents, rulers and toolbar load on the first press.
const Redraw = dynamic(() => import('components/redraw/redraw'), { ssr: false });

type RedrawRun = { id: number; origin?: RedrawOrigin };

type HomePageProps = {
  contributions: Activity[];
};

const Index: NextPage<HomePageProps> = ({ contributions }) => {
  const router = useRouter();
  const [run, setRun] = useState<RedrawRun | null>(null);
  const runs = useRef(0);

  useEffect(() => {
    const onStart = (event: Event) => {
      const origin = (event as CustomEvent<RedrawOrigin | undefined>).detail;
      // The page is already blank; a press during a run (the command menu) starts it over.
      setRun({ id: ++runs.current, origin });
    };
    window.addEventListener(REDRAW_EVENT, onStart);
    return () => window.removeEventListener(REDRAW_EVENT, onStart);
  }, []);

  // `/?redraw=1` (the command menu on another page) starts a run once, then drops the flag.
  useEffect(() => {
    if (!router.isReady || !isRedrawQuery(router.query.redraw)) return;
    const query = { ...router.query };
    delete query.redraw;
    router.replace({ pathname: '/', query }, undefined, { shallow: true, scroll: false });
    requestRedraw();
  }, [router]);

  const closeRedraw = useCallback(() => setRun(null), []);
  const restartRedraw = useCallback(() => {
    blankPage();
    setRun({ id: ++runs.current });
  }, []);

  return (
    <PageLayout title="Muhammad Ahmad - Full Stack Developer">
      <PersonJsonLd />
      <Home contributions={contributions} />
      <StudioDock />
      {isPlaying(router.query) && <PlayToolbar />}
      {run && (
        <Redraw key={run.id} origin={run.origin} onClose={closeRedraw} onRestart={restartRedraw} />
      )}
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
