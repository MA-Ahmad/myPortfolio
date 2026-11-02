import { ReactElement, useContext, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GetServerSideProps } from 'next';
import { ChevronDown } from 'lucide-react';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { type Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { PanoramaHome, PanoramaLayout } from 'themes/panorama';
import { ToolsSlot } from 'themes/panorama/components/panorama-layout';
import styles from 'themes/panorama/panorama.module.css';
import { WELD_KINDS, WELDS } from 'themes/panorama/torn/welds';
import type { NextPageWithLayout } from '../_app';

/** Dev only, throwaway: the Panorama theme's torn sections, with a picker over the welds. */

type Props = { contributions: Activity[]; posts: BlogListPost[] };

const TornProto: NextPageWithLayout<Props> = ({ contributions, posts }) => {
  const [index, setIndex] = useState(0);
  const [take, setTake] = useState(0);
  const pick = (next: number) => {
    setIndex(next);
    setTake((n) => n + 1);
  };
  const replay = () => setTake((n) => n + 1);

  // Number keys pick a weld and R replays it; the arrow keys belong to the sections.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      if (event.key === 'r' || event.key === 'R') return replay();
      const n = Number(event.key);
      if (n >= 1 && n <= WELD_KINDS.length) pick(n - 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Meta title="Torn sections prototype" noindex />
      <PanoramaHome
        key={take}
        contributions={contributions}
        posts={posts}
        weld={WELD_KINDS[index]}
      />
      <Picker index={index} onPick={pick} />
    </>
  );
};

/** The weld, in the header's tools beside the sound switch and the time of day. */
function Picker({
  index,
  onPick
}: {
  index: number;
  onPick: (index: number) => void;
}) {
  const slot = useContext(ToolsSlot);
  if (!slot) return null;
  return createPortal(
    <div className={styles.weldPicker}>
      <label className={styles.weld}>
        <select aria-label="Weld" value={index} onChange={(event) => onPick(Number(event.target.value))}>
          {WELD_KINDS.map((kind, i) => (
            <option key={kind} value={i}>
              {WELDS[kind].label}
            </option>
          ))}
        </select>
        <ChevronDown size={12} strokeWidth={1.8} aria-hidden />
      </label>
    </div>,
    slot
  );
}

TornProto.getLayout = (page: ReactElement) => <PanoramaLayout>{page}</PanoramaLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions().catch(() => []),
    getLatestBlogPosts().catch(() => [])
  ]);
  return { props: { contributions, posts } };
};

export default TornProto;
