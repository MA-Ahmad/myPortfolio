import { MouseEvent, ReactElement, ReactNode, useEffect, useRef } from 'react';
import { GetStaticProps } from 'next';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft } from 'lucide-react';
import Meta from 'components/shared/meta';
import { CanvasStage } from 'components/canvas/canvas-stage';
import styles from 'components/canvas/canvas.module.css';
import { Activity, contributionsRevalidate, fetchGitHubContributions } from 'lib/github-contributions';
import { pixelNavigate } from 'lib/pixel-transition';
import type { NextPageWithLayout } from './_app';

type Props = {
  contributions: Activity[];
};

const CanvasPage: NextPageWithLayout<Props> = ({ contributions }) => (
  <>
    <Meta title="Canvas" />
    <Head>
      <meta name="robots" content="noindex" />
    </Head>
    <h1 className="sr-only">Canvas: wire a theme into the display to open it</h1>
    <CanvasStage contributions={contributions} />
  </>
);

function CanvasLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const rootRef = useRef<HTMLDivElement>(null);

  // The shared body background follows the main site; match it so overscroll doesn't flash.
  useEffect(() => {
    const root = rootRef.current!;
    const previous = document.body.style.background;
    const sync = () => {
      document.body.style.background = getComputedStyle(root).getPropertyValue('--cv-bg');
    };
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => {
      observer.disconnect();
      document.body.style.background = previous;
    };
  }, []);

  useEffect(() => {
    router.prefetch('/');
  }, [router]);

  const backToMainSite = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return;
    event.preventDefault();
    const arrow = event.currentTarget.getBoundingClientRect();
    const mainSite = getComputedStyle(document.documentElement);
    pixelNavigate(router, '/', {
      origin: { x: arrow.left + arrow.width / 2, y: arrow.top + arrow.height / 2 },
      edge: mainSite.getPropertyValue('--foreground').trim(),
      background: mainSite.getPropertyValue('--background').trim()
    });
  };

  return (
    <div ref={rootRef} className={styles.root}>
      <header className={styles.bar}>
        <div className={styles.title}>
          <Link
            href="/"
            onClick={backToMainSite}
            aria-label="Back to main site"
            title="Back to main site"
            className={styles.back}
          >
            <ArrowLeft className="size-4" />
          </Link>
          Canvas
          <span className={styles.hint}>Drag a wire from a theme into the display</span>
        </div>
      </header>
      <main>{children}</main>
    </div>
  );
}

CanvasPage.getLayout = (page: ReactElement) => <CanvasLayout>{page}</CanvasLayout>;

export const getStaticProps: GetStaticProps<Props> = async () => {
  const contributions = await fetchGitHubContributions();
  return {
    props: { contributions },
    revalidate: contributionsRevalidate(contributions)
  };
};

export default CanvasPage;
