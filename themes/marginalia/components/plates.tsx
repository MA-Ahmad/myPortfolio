import { useEffect, useState } from 'react';
import { getImageProps } from 'next/image';
import { format } from 'date-fns';
import { canOptimizeCover } from 'lib/cover-image';
import type { Activity } from 'lib/github-contributions';
import type { BlogListPost } from 'components/blog/post-item';
import { MARGINALIA_CONTENT as C, type NoteId } from '../content';
import { PREVIEW_W } from './preview';
import styles from '../marginalia.module.css';

/**
 * What the hover card shows for each phrase, and for the links inside the notes. Pictures go
 * through the image optimizer at the card's size (1x and 2x), so a glimpse costs a few KB.
 */

type Picture = { src: string; width: number; height: number; alt: string };

function imageProps({ src, width, height, alt }: Picture) {
  const remote = /^https?:/.test(src);
  return getImageProps({
    src,
    alt,
    width: PREVIEW_W,
    height: Math.round((PREVIEW_W * height) / width),
    unoptimized: remote && !canOptimizeCover(src)
  }).props;
}

const SMATA: Picture = {
  src: C.smata.imageLight!,
  width: 1994,
  height: 1314,
  alt: 'Smata’s strata management dashboard'
};

type BlockCard = (typeof C.blockCards)[number];
const blockPicture = (block: BlockCard, dark: boolean): Picture => ({
  src: typeof block.card === 'string' ? block.card : dark ? block.card.dark : block.card.light,
  width: 1280,
  height: 800,
  alt: block.alt
});

const postPicture = (post: BlogListPost): Picture => ({
  src: post.cover_image!,
  width: 1200,
  height: 630,
  alt: post.title
});

function Shot({ picture, title, meta }: { picture: Picture; title: string; meta?: string }) {
  const props = imageProps(picture);
  return (
    <figure className={styles.plate}>
      <div className={styles.shot} style={{ aspectRatio: `${picture.width} / ${picture.height}` }}>
        {/* eslint-disable-next-line @next/next/no-img-element -- props come from getImageProps */}
        <img {...props} alt={props.alt} draggable={false} />
      </div>
      <figcaption>
        <span className={styles.plateTitle}>{title}</span>
        {meta ? <span className={styles.plateMeta}>{meta}</span> : null}
      </figcaption>
    </figure>
  );
}

function Logo({ src, title, meta }: { src: string; title: string; meta: string }) {
  return (
    <div className={`${styles.plate} ${styles.plateRow}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- a 40px logo, already small */}
      <img className={styles.logo} src={src} alt="" width={40} height={40} draggable={false} />
      <span>
        <span className={styles.plateTitle}>{title}</span>
        <span className={styles.plateMeta}>{meta}</span>
      </span>
    </div>
  );
}

function Clock() {
  const read = () =>
    new Intl.DateTimeFormat('en-US', { timeZone: C.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date());
  const [time, setTime] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setTime(read()), 10_000);
    return () => clearInterval(timer);
  }, []);
  const [clock, period] = time.split(' ');
  return (
    <div className={styles.plate}>
      <span className={styles.clock}>
        {clock}
        <small>{period}</small>
      </span>
      <span className={styles.plateMeta}>{C.timeZone.replace('_', ' ')} · GMT+5 · now</span>
    </div>
  );
}

function Names({ title, names }: { title: string; names: string[] }) {
  return (
    <div className={styles.plate}>
      <span className={styles.plateTitle}>{title}</span>
      <ul className={styles.names}>
        {names.map((name) => (
          <li key={name}>{name}</li>
        ))}
      </ul>
    </div>
  );
}

function Icons() {
  return (
    <div className={styles.plate}>
      <div className={styles.icons}>
        {C.stackIcons.map((icon) => (
          // eslint-disable-next-line @next/next/no-img-element -- 24px skill icons
          <img key={icon.name} src={icon.image} alt="" title={icon.name} width={24} height={24} draggable={false} />
        ))}
      </div>
      <span className={styles.plateMeta}>Day to day: {C.stackIcons.slice(0, 3).map((i) => i.name).join(', ')} and more</span>
    </div>
  );
}

/** The last 20 weeks of contributions as the page's ink, darker for busier days. */
function Heat({ contributions }: { contributions: Activity[] }) {
  const days = contributions.slice(-20 * 7);
  const total = contributions.reduce((sum, day) => sum + day.count, 0);
  if (!days.length) return <Names title="GitHub" names={[C.githubUrl.replace('https://', '')]} />;
  return (
    <div className={styles.plate}>
      <div className={styles.heat}>
        {days.map((day) => (
          <i key={day.date} data-level={day.level} />
        ))}
      </div>
      <span className={styles.plateMeta}>
        <b>{total.toLocaleString('en-US')}</b> contributions in the last year
      </span>
    </div>
  );
}

/** The card for each phrase in the paragraph. */
export function phrasePreview(
  id: NoteId,
  { contributions, posts, dark }: { contributions: Activity[]; posts: BlogListPost[]; dark: boolean }
) {
  switch (id) {
    case 'place':
      return <Clock />;
    case 'games':
      return <Logo src={C.bigWolf.logo} title={C.bigWolf.title} meta={`Browser games · ${C.bigWolf.period.replace(' - ', '–')}`} />;
    case 'web3':
      return <Names title="Web3 products" names={C.web3.map((p) => p.title)} />;
    case 'property':
      return <Shot picture={SMATA} title="Smata" meta={C.smata.techStack.join(' · ')} />;
    case 'now': {
      const now = C.companies[0];
      return <Logo src={now.logo} title={now.title} meta={`${now.role} · since ${now.period.split(' - ')[0]}`} />;
    }
    case 'stack':
      return <Icons />;
    case 'writing': {
      const post = posts.find((p) => p.cover_image);
      return post ? (
        <Shot picture={postPicture(post)} title={post.title} meta={format(new Date(post.published_at), 'MMM yyyy')} />
      ) : (
        <Names title="On DEV" names={posts.slice(0, 3).map((p) => p.title)} />
      );
    }
    case 'blocks': {
      const block = C.blockCards[0];
      return block ? (
        <Shot picture={blockPicture(block, dark)} title={block.title} meta={`Newest of ${C.blockCount} blocks`} />
      ) : null;
    }
    case 'github':
      return <Heat contributions={contributions} />;
    case 'contact':
      return <Names title="Write to me" names={[C.email, 'Click for GitHub, LinkedIn, X and DEV']} />;
  }
}

/** The card for a block's link inside the Blocks note. */
export function blockPreview(href: string, dark: boolean) {
  const block = C.blockCards.find((b) => b.href === href);
  return block ? <Shot picture={blockPicture(block, dark)} title={block.title} meta={block.categoryTitle} /> : null;
}

/** The card for a post's link inside the writing note, when it has a cover. */
export function postPreview(post: BlogListPost) {
  return post.cover_image ? (
    <Shot picture={postPicture(post)} title={post.title} meta={format(new Date(post.published_at), 'd MMM yyyy')} />
  ) : null;
}

/** The srcsets the card will ask for, warmed when the mouse first moves. */
export function preloadList(posts: BlogListPost[], dark: boolean) {
  const post = posts.find((p) => p.cover_image);
  const all = [SMATA, ...C.blockCards.map((block) => blockPicture(block, dark)), ...(post ? [postPicture(post)] : [])];
  return all.map((picture) => {
    const props = imageProps(picture);
    return props.srcSet ?? props.src;
  });
}
