import { useMemo, useRef } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import { ArrowUpRight } from 'lucide-react';
import type { BlogListPost } from 'components/blog/post-item';
import type { Activity } from 'lib/github-contributions';
import { PANORAMA_CONTENT as C, LIST_LIMIT } from '../content';
import styles from '../panorama.module.css';
import { Contributions } from './contributions';
import { PostPreview } from './post-preview';
import { ContactPills } from '../pipeline/contact-pills';
import { Pipeline } from '../pipeline/pipeline';
import pipelineStyles from '../pipeline/pipeline.module.css';

export function IntroPane({ contributions }: { contributions: Activity[] }) {
  return (
    <>
      <h1 className={styles.name}>{C.name}</h1>
      <p className={styles.role}>{C.role}</p>
      <p className={styles.now}>
        <span className={styles.live} aria-hidden />
        {C.now.role} at {C.now.company}
      </p>
      <p className={styles.text}>{C.intro}</p>
      <div className={pipelineStyles.pipeline}>
        <ContactPills links={C.links} />
        <Pipeline />
      </div>
      <Contributions contributions={contributions} />
    </>
  );
}

export function WorkPane() {
  return (
    <>
      <h2 className={styles.heading}>Stack</h2>
      <dl className={styles.stack}>
        {C.stack.map((group) => (
          <div key={group.title} className={styles.stackGroup}>
            <dt>{group.title}</dt>
            <dd>
              <ul className={styles.chips}>
                {group.skills.map((skill) => (
                  <li key={skill.name} className={styles.chip}>
                    <img src={skill.icon} alt="" width={14} height={14} data-tone={skill.tone} />
                    {skill.name}
                  </li>
                ))}
              </ul>
            </dd>
          </div>
        ))}
      </dl>
      <h2 className={styles.heading}>Selected projects</h2>
      <ul className={styles.list}>
        {C.projects.map((project) => (
          <li key={project.title}>
            <a href={project.href} target="_blank" rel="noreferrer" className={styles.row}>
              <span className={styles.rowTitle}>
                {project.title}
                <ArrowUpRight size={13} aria-hidden />
              </span>
              <span className={styles.rowText}>{project.text}</span>
              <span className={styles.rowMeta}>{project.stack.join(' · ')}</span>
            </a>
          </li>
        ))}
      </ul>
    </>
  );
}

export function WritingPane({ posts }: { posts: BlogListPost[] }) {
  const latest = posts.slice(0, LIST_LIMIT);
  const listRef = useRef<HTMLUListElement>(null);
  const covers = useMemo(
    () =>
      posts
        .slice(0, LIST_LIMIT)
        .filter((post) => post.cover_image)
        .map((post) => ({ key: post.slug, src: post.cover_image! })),
    [posts]
  );
  return (
    <>
      <h2 className={styles.heading}>Latest writing</h2>
      {latest.length ? (
        <ul ref={listRef} className={styles.list}>
          {latest.map((post) => (
            <li key={post.slug}>
              <Link
                href={`/blog/${post.slug}`}
                className={styles.row}
                data-preview={post.cover_image ? post.slug : undefined}
              >
                <span className={styles.rowTitle}>{post.title}</span>
                {post.description && <span className={styles.rowText}>{post.description}</span>}
                <time className={styles.rowMeta} dateTime={post.published_at}>
                  {format(new Date(post.published_at), 'MMM d, yyyy')}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <p className={styles.text}>
          The posts couldn’t be loaded just now. They’re all on the blog.
        </p>
      )}
      <PostPreview listRef={listRef} images={covers} />
      <Link href="/blog" className={styles.more}>
        All posts
      </Link>
    </>
  );
}

export function BlocksPane() {
  return (
    <>
      <p className={styles.text}>
        Interactive pieces with their source, ready to drop into a page.
      </p>
      <ul className={styles.cards}>
        {C.blocks.slice(0, LIST_LIMIT).map((block) => (
          <li key={block.href}>
            <Link href={block.href} className={styles.card}>
              <span className={styles.cardImage}>
                {block.image && (
                  <>
                    <img
                      src={block.image.dark}
                      alt={block.image.alt}
                      width={640}
                      height={400}
                      loading="lazy"
                      decoding="async"
                      data-mode={block.image.light === block.image.dark ? undefined : 'dark'}
                    />
                    {block.image.light !== block.image.dark && (
                      <img
                        src={block.image.light}
                        alt=""
                        width={640}
                        height={400}
                        loading="lazy"
                        decoding="async"
                        data-mode="light"
                      />
                    )}
                  </>
                )}
              </span>
              <span className={styles.rowTitle}>{block.title}</span>
              <span className={styles.rowText}>{block.text}</span>
            </Link>
          </li>
        ))}
      </ul>
      <Link href="/blocks" className={styles.more}>
        All blocks
      </Link>
    </>
  );
}
