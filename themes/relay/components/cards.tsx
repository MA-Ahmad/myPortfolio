import { useEffect, useState } from 'react';
import { getImageProps } from 'next/image';
import { format } from 'date-fns';
import { canOptimizeCover } from 'lib/cover-image';
import type { Activity } from 'lib/github-contributions';
import type { BlogListPost } from 'components/blog/post-item';
import { RELAY_CONTENT as C } from '../content';
import { MAP } from '../lib/map';
import styles from '../relay.module.css';

/**
 * What the glimpses show. Each is small and quiet: a picture when there is one, a title in the
 * page's sans, the details in mono. Pictures go through the image optimizer at the card's size.
 */

const CARD_W = 260;

/**
 * Starts loading the pictures a section's glimpses will show, as the section opens, so a card
 * never opens on an empty frame.
 */
export function preloadPictures(section: string, posts: BlogListPost[]) {
  const list: [string, number, number][] =
    section === 'projects'
      ? C.projects.flatMap((p) => (p.image ? [[p.image, 1994, 1314] as [string, number, number]] : []))
      : section === 'blocks'
        ? C.blockCards.map((b) => [typeof b.card === 'string' ? b.card : b.card.dark, 1280, 800] as [string, number, number])
        : section === 'writing'
          ? posts.slice(0, 5).flatMap((p) => (p.cover_image ? [[p.cover_image, 1200, 630] as [string, number, number]] : []))
          : [];
  for (const [src, w, h] of list) {
    const props = picture(src, w, h, '');
    const img = new Image();
    if (props.srcSet) img.srcset = props.srcSet;
    img.src = props.src;
  }
}

function picture(src: string, width: number, height: number, alt: string) {
  const remote = /^https?:/.test(src);
  return getImageProps({
    src,
    alt,
    width: CARD_W,
    height: Math.round((CARD_W * height) / width),
    unoptimized: remote && !canOptimizeCover(src)
  }).props;
}

function Shot({ src, width, height, alt }: { src: string; width: number; height: number; alt: string }) {
  const props = picture(src, width, height, alt);
  return (
    <div className={styles.shot} style={{ aspectRatio: `${width} / ${height}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- props come from getImageProps */}
      <img {...props} alt={props.alt} draggable={false} />
    </div>
  );
}

function useClock() {
  const read = () =>
    new Intl.DateTimeFormat('en-US', { timeZone: C.timeZone, hour: 'numeric', minute: '2-digit' }).format(new Date());
  const [time, setTime] = useState(read);
  useEffect(() => {
    const timer = setInterval(() => setTime(read()), 15_000);
    return () => clearInterval(timer);
  }, []);
  return time;
}

/** The city, on a quiet map of Pakistan, with the time there now. */
export function MapCard() {
  const time = useClock();
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      <svg className={styles.map} viewBox={`0 0 ${MAP.w} ${MAP.h}`} aria-hidden="true">
        {MAP.neighbours.map((d, i) => (
          <path key={i} d={d} className={styles.mapNear} />
        ))}
        <path d={MAP.pakistan} className={styles.mapLand} />
        <circle cx={MAP.lahore.x} cy={MAP.lahore.y} r={7} className={styles.mapRing} />
        <circle cx={MAP.lahore.x} cy={MAP.lahore.y} r={2.5} className={styles.mapPin} />
        <text x={MAP.lahore.x - 8} y={MAP.lahore.y + 3.5} textAnchor="end" className={styles.mapLabel}>
          {C.city}
        </text>
      </svg>
      <div className={styles.cardRow}>
        <span className={styles.cardTitle}>
          {C.city}, {C.country}
        </span>
        <span className={styles.cardNum}>{time}</span>
      </div>
      <span className={styles.cardMeta}>{MAP.coordinates} · GMT+5</span>
    </div>
  );
}

/** The X profile, as X would show it. */
export function XCard() {
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      <div className={styles.profile}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a 40px avatar */}
        <img src={C.avatar} alt="" width={40} height={40} className={styles.avatar} draggable={false} />
        <span>
          <span className={styles.cardTitle}>{C.name}</span>
          <span className={styles.cardMeta}>{C.x.handle}</span>
        </span>
        <XMark />
      </div>
      <p className={styles.cardText}>{C.bio}</p>
      <span className={styles.cardMeta}>
        {C.city}, {C.country} · mahmad.me
      </span>
    </div>
  );
}

function XMark() {
  return (
    <svg viewBox="0 0 24 24" className={styles.xMark} aria-hidden="true">
      <path d="M17.75 3h3.07l-6.7 7.66L22 21h-6.17l-4.83-6.32L5.47 21H2.4l7.17-8.2L2 3h6.33l4.37 5.78L17.75 3Zm-1.08 16.2h1.7L7.4 4.73H5.58l11.09 14.47Z" />
    </svg>
  );
}

/** The GitHub profile, with the last twenty weeks of contributions. */
export function GitHubCard({ contributions }: { contributions: Activity[] }) {
  const days = contributions.slice(-20 * 7);
  const total = contributions.reduce((sum, day) => sum + day.count, 0);
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      <div className={styles.profile}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a 40px avatar */}
        <img src={C.avatar} alt="" width={40} height={40} className={styles.avatar} draggable={false} />
        <span>
          <span className={styles.cardTitle}>{C.github.handle}</span>
          <span className={styles.cardMeta}>github.com</span>
        </span>
      </div>
      {days.length ? (
        <>
          <div className={styles.heat}>
            {days.map((day) => (
              <i key={day.date} data-level={day.level} />
            ))}
          </div>
          <span className={styles.cardMeta}>
            <b className={styles.cardNum}>{total.toLocaleString('en-US')}</b> contributions in the last year
          </span>
        </>
      ) : (
        <p className={styles.cardText}>{C.bio}</p>
      )}
    </div>
  );
}

type Company = (typeof C.companies)[number];

/** A team: its logo, the role there and the tools it ran on. */
export function CompanyCard({ company }: { company: Company }) {
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      <div className={styles.profile}>
        {/* eslint-disable-next-line @next/next/no-img-element -- a 36px logo */}
        <img src={company.logo} alt="" width={36} height={36} className={styles.logo} draggable={false} />
        <span>
          <span className={styles.cardTitle}>{company.title}</span>
          <span className={styles.cardMeta}>
            {company.role} · {company.period}
          </span>
        </span>
      </div>
      <ul className={styles.chips}>
        {company.skills.map((skill) => (
          <li key={skill}>{skill}</li>
        ))}
      </ul>
    </div>
  );
}

type Project = (typeof C.projects)[number];

export function ProjectCard({ project }: { project: Project }) {
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      {project.image ? <Shot src={project.image} width={1994} height={1314} alt="" /> : null}
      <span className={styles.cardTitle}>{project.title}</span>
      <p className={styles.cardText}>{project.text}</p>
      <span className={styles.cardMeta}>
        {project.host} · {project.stack.slice(0, 3).join(', ')}
      </span>
    </div>
  );
}

export function PostCard({ post }: { post: BlogListPost }) {
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      {post.cover_image ? <Shot src={post.cover_image} width={1200} height={630} alt="" /> : null}
      <span className={styles.cardTitle}>{post.title}</span>
      <span className={styles.cardMeta}>{format(new Date(post.published_at), 'd MMMM yyyy')} · DEV</span>
    </div>
  );
}

type Block = (typeof C.blockCards)[number];

export function BlockCard({ block }: { block: Block }) {
  const src = typeof block.card === 'string' ? block.card : block.card.dark;
  return (
    <div className={styles.cardBody} style={{ width: CARD_W }}>
      <Shot src={src} width={1280} height={800} alt="" />
      <div className={styles.cardRow}>
        <span className={styles.cardTitle}>{block.title}</span>
        <span className={styles.cardMeta}>{block.categoryTitle}</span>
      </div>
    </div>
  );
}
