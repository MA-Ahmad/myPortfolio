import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { Activity } from 'lib/github-contributions';
import type { BlogListPost } from 'components/blog/post-item';
import { MARGINALIA_CONTENT as C, type NoteId } from '../content';
import styles from '../marginalia.module.css';

type NoteProps = { contributions: Activity[]; posts: BlogListPost[] };

/** The heading each note carries, in the margin and as a footnote. */
export const NOTE_TITLES: Record<NoteId, string> = {
  place: 'Pakistan',
  games: C.bigWolf.title,
  web3: 'Web3 products',
  property: C.smata.title,
  now: C.career[0].title,
  stack: 'Stack',
  writing: 'Latest writing',
  blocks: 'Blocks',
  github: 'GitHub, last 12 months',
  contact: 'Write to me'
};

export function NoteBody({ id, contributions, posts }: NoteProps & { id: NoteId }) {
  switch (id) {
    case 'place':
      return <PlaceNote />;
    case 'games':
      return (
        <>
          <p>
            {C.bigWolf.role}, {C.bigWolf.period.replace(' - ', '–')}. Browser games and the
            backends behind them, in Rails, React and PixiJS.
          </p>
        </>
      );
    case 'web3':
      return (
        <ul className={styles.list}>
          {C.web3.map((project) => (
            <li key={project.title}>
              <Out href={project.site}>{project.title}</Out>
              <span className={styles.dim}> {shorten(project.description)}</span>
            </li>
          ))}
        </ul>
      );
    case 'property':
      return (
        <p>
          {C.smata.description} Built with {C.smata.techStack.join(', ')}.{' '}
          <Out href={C.smata.site}>smata.com</Out>
        </p>
      );
    case 'now':
      return (
        <>
          <p>
            {C.career[0].role} since {C.career[0].period.split('–')[0]}. Before that:
          </p>
          <ul className={styles.rows}>
            {C.career.slice(1).map((job) => (
              <li key={job.title}>
                <span>{job.title}</span>
                <span className={styles.dim}>{job.period}</span>
              </li>
            ))}
          </ul>
        </>
      );
    case 'stack':
      return (
        <dl className={styles.stack}>
          {C.stack.map((group) => (
            <div key={group.type}>
              <dt>{group.type}</dt>
              <dd>{group.skills.join(', ')}</dd>
            </div>
          ))}
        </dl>
      );
    case 'writing':
      return (
        <>
          <ul className={styles.rows}>
            {posts.slice(0, 4).map((post) => (
              <li key={post.slug}>
                <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                <span className={styles.dim}>{format(new Date(post.published_at), 'MMM yyyy')}</span>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/blog">All posts →</Link>
          </p>
        </>
      );
    case 'blocks':
      return (
        <>
          <ul className={styles.list}>
            {C.blocks.map((block) => (
              <li key={block.href}>
                <Link href={block.href}>{block.title}</Link>
              </li>
            ))}
          </ul>
          <p>
            <Link href="/blocks">All {C.blockCount} blocks →</Link>
          </p>
        </>
      );
    case 'github':
      return <GitHubNote contributions={contributions} />;
    case 'contact':
      return <ContactNote />;
  }
}

function Out({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <a href={href} target="_blank" rel="noreferrer">
      {children}
    </a>
  );
}

/** First clause of a project's description, so five fit in a margin. */
function shorten(text: string) {
  const cut = text.split(/ with | focused | for /)[0];
  return cut.endsWith('.') ? cut : `${cut}.`;
}

function PlaceNote() {
  // The time is read on the client only, so the server's clock never shows.
  const [now, setNow] = useState<string | null>(null);
  useEffect(() => {
    const tick = () =>
      setNow(
        new Intl.DateTimeFormat('en-US', {
          timeZone: C.timeZone,
          hour: 'numeric',
          minute: '2-digit'
        }).format(new Date())
      );
    tick();
    const timer = setInterval(tick, 30_000);
    return () => clearInterval(timer);
  }, []);
  return (
    <p>
      {C.timeZone.replace('_', ' ')}, GMT+5.
      {now ? <> It’s {now} here.</> : null} Remote with teams across time zones.
    </p>
  );
}

function GitHubNote({ contributions }: { contributions: Activity[] }) {
  const { total, weeks } = useMemo(() => {
    const weeks: number[] = [];
    contributions.forEach((day, i) => {
      weeks[Math.floor(i / 7)] = (weeks[Math.floor(i / 7)] ?? 0) + day.count;
    });
    return { total: contributions.reduce((sum, day) => sum + day.count, 0), weeks };
  }, [contributions]);

  if (!weeks.length)
    return (
      <p>
        <Out href={C.githubUrl}>github.com/{C.githubUrl.split('/').pop()}</Out>
      </p>
    );

  const max = Math.max(...weeks, 1);
  const W = 200;
  const H = 36;
  const step = W / Math.max(weeks.length - 1, 1);
  const points = weeks.map((count, i) => `${(i * step).toFixed(1)},${(H - (count / max) * H).toFixed(1)}`);

  return (
    <>
      <p>
        <strong className={styles.figure}>{total.toLocaleString('en-US')}</strong> contributions.
      </p>
      <svg
        className={styles.spark}
        viewBox={`0 -2 ${W} ${H + 4}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Weekly contributions over the last ${weeks.length} weeks, peaking at ${max} in a week`}
      >
        <polyline points={`0,${H} ${points.join(' ')} ${W},${H}`} className={styles.sparkArea} />
        <polyline points={points.join(' ')} className={styles.sparkLine} />
      </svg>
      <p>
        <Out href={C.githubUrl}>Open GitHub →</Out>
      </p>
    </>
  );
}

function ContactNote() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(C.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  };
  return (
    <>
      <p className={styles.email}>
        <a href={`mailto:${C.email}`}>{C.email}</a>
        <button type="button" className={styles.copy} onClick={copy}>
          {copied ? 'Copied' : 'Copy'}
        </button>
      </p>
      <ul className={styles.inline}>
        {C.links.map((link) => (
          <li key={link.label}>
            <Out href={link.href}>{link.label}</Out>
          </li>
        ))}
      </ul>
    </>
  );
}
