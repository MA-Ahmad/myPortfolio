import { type ReactNode, useEffect, useState } from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { ThemeHomeProps } from 'themes/registry';
import { RELAY_CONTENT as C, type SectionId } from '../content';
import { BlockCard, CompanyCard, GitHubCard, MapCard, PostCard, ProjectCard, XCard, preloadPictures } from './cards';
import { Glimpse } from './glimpse';
import { Micro } from './micro';
import styles from '../relay.module.css';

type Props = ThemeHomeProps & { id: SectionId; go: (id: SectionId) => void };

const out = { target: '_blank', rel: 'noreferrer' } as const;

/** What the card says for each section. */
export function Section({ id, contributions, posts, go }: Props) {
  useEffect(() => preloadPictures(id, posts), [id, posts]);

  switch (id) {
    case 'intro':
      return (
        <>
          <h1>Hey, I’m {C.firstName}. I build web products end to end.</h1>
          <p>
            A full stack engineer in{' '}
            <Glimpse id="map" card={<MapCard />} tap>
              {C.city}
            </Glimpse>
            . For nine years I’ve been <Micro kind="plane">shipping</Micro> products from the{' '}
            <Micro kind="stack">database</Micro> to the <Micro kind="pixels">pixels</Micro>, lately at{' '}
            <Glimpse id="now" card={<CompanyCard company={C.companies[0]} />}>
              <button type="button" className={styles.inlineLink} onClick={() => go('work')}>
                {C.companies[0].title}
              </button>
            </Glimpse>
            .
          </p>
          <p>
            I sweat the small details, the ones that make software feel <Micro kind="heart">cared for</Micro>. Say
            hi on X at{' '}
            <Glimpse id="x" card={<XCard />}>
              <a href={C.x.href} {...out}>
                {C.x.handle}
              </a>
            </Glimpse>
            , or see what I’m{' '}
            <Glimpse id="github" card={<GitHubCard contributions={contributions} />}>
              <a href={C.github.href} {...out}>
                building on GitHub
              </a>
            </Glimpse>
            .
          </p>
          <Action href={C.resumeUrl}>Résumé</Action>
        </>
      );

    case 'work':
      return (
        <>
          <h1>Nine years, five teams, one habit: owning the work until it’s live.</h1>
          <Rows
            rows={C.companies.map((company) => ({
              key: company.title,
              left: (
                <Glimpse id={`co:${company.title}`} card={<CompanyCard company={company} />} tap>
                  {company.title}
                </Glimpse>
              ),
              right: company.period
            }))}
          />
          <Action href={C.linkedinUrl}>LinkedIn</Action>
        </>
      );

    case 'projects':
      return (
        <>
          <h1>Things I’ve shipped, from DeFi swaps to strata software.</h1>
          <Rows
            rows={C.projects.map((project) => ({
              key: project.title,
              left: (
                <Glimpse id={`pr:${project.title}`} card={<ProjectCard project={project} />}>
                  <a href={project.href} {...out}>
                    {project.title}
                  </a>
                </Glimpse>
              ),
              right: project.host
            }))}
          />
          <Action href={C.github.href}>More on GitHub</Action>
        </>
      );

    case 'writing':
      return (
        <>
          <h1>Notes from the workbench, published on DEV.</h1>
          {posts.length ? (
            <Rows
              rows={posts.slice(0, 5).map((post) => ({
                key: post.slug,
                left: (
                  <Glimpse id={`po:${post.slug}`} card={<PostCard post={post} />}>
                    <Link href={`/blog/${post.slug}`}>{post.title}</Link>
                  </Glimpse>
                ),
                right: format(new Date(post.published_at), 'MMM yyyy')
              }))}
            />
          ) : (
            <p>Posts come in from DEV. The full list lives on the blog.</p>
          )}
          <Action href="/blog" internal>
            All posts
          </Action>
        </>
      );

    case 'blocks':
      return (
        <>
          <h1>Blocks: sections you can lift straight into your own site.</h1>
          <p>Each one ships with a live preview and its full source.</p>
          <Rows
            rows={C.blocks.map((block) => {
              const card = C.blockCards.find((b) => b.href === block.href);
              const link = <Link href={block.href}>{block.title}</Link>;
              return {
                key: block.href,
                left: card ? (
                  <Glimpse id={`bl:${block.href}`} card={<BlockCard block={card} />}>
                    {link}
                  </Glimpse>
                ) : (
                  link
                ),
                right: card?.categoryTitle ?? ''
              };
            })}
          />
          <Action href="/blocks" internal>
            Browse all {C.blockCount}
          </Action>
        </>
      );

    case 'contact':
      return (
        <>
          <h1>Building something? I’d like to hear about it.</h1>
          <p>
            Email is quickest: <CopyEmail />
          </p>
          <p>
            Or find me on{' '}
            <Glimpse id="x" card={<XCard />}>
              <a href={C.x.href} {...out}>
                X
              </a>
            </Glimpse>
            ,{' '}
            <Glimpse id="github" card={<GitHubCard contributions={contributions} />}>
              <a href={C.github.href} {...out}>
                GitHub
              </a>
            </Glimpse>
            ,{' '}
            <a href={C.linkedinUrl} {...out}>
              LinkedIn
            </a>{' '}
            and{' '}
            <a href={C.devUrl} {...out}>
              DEV
            </a>
            .
          </p>
          <Action href={`mailto:${C.email}`}>Email me</Action>
        </>
      );
  }
}

/** The address, which copies itself when clicked; "Copied" takes its place for a moment. */
function CopyEmail() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(C.email);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      window.location.href = `mailto:${C.email}`;
    }
  };
  return (
    <button
      type="button"
      className={styles.copyEmail}
      onClick={copy}
      data-copied={copied || undefined}
      aria-label={copied ? 'Email address copied' : `Copy ${C.email}`}
    >
      <span>{C.email}</span>
      <span aria-hidden="true">Copied to clipboard</span>
    </button>
  );
}

function Rows({ rows }: { rows: { key: string; left: ReactNode; right: ReactNode }[] }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.key}>
          <span>{row.left}</span>
          <span className={styles.dim}>{row.right}</span>
        </li>
      ))}
    </ul>
  );
}

function Action({ href, internal, children }: { href: string; internal?: boolean; children: ReactNode }) {
  return internal ? (
    <Link href={href} className={styles.action}>
      {children}
    </Link>
  ) : (
    <a href={href} className={styles.action} {...(href.startsWith('mailto:') ? {} : out)}>
      {children}
    </a>
  );
}
