import type { ThemeHomeProps } from 'themes/registry';
import { EDUCATION, EXPERIENCES, PROFILE, PROJECTS } from 'data/profile';
import { NOTEBOOK_CONTENT } from './content';
import { Clock } from './components/clock';
import { IndexList, IndexRow, IndexSection } from './components/index-row';
import { Skyline } from './components/skyline';
import styles from './notebook.module.css';

export { NotebookLayout } from './components/notebook-layout';

export function NotebookHome({ contributions, posts }: ThemeHomeProps) {
  const notes = posts.slice(0, NOTEBOOK_CONTENT.notesCount);

  return (
    <>
      <h1 className={styles.srOnly}>{PROFILE.displayName}</h1>
      <p className={styles.lede}>
        <span className={styles.plateInline}>{NOTEBOOK_CONTENT.lede}</span>
      </p>
      <Clock />

      {contributions.length > 0 ? (
        <IndexSection
          id="github"
          label="github"
          more={{
            href: PROFILE.githubUrl,
            label: PROFILE.githubUsername,
            context: 'on github',
            external: true
          }}
        >
          <Skyline contributions={contributions} />
        </IndexSection>
      ) : null}

      <IndexSection id="projects" label="projects">
        <IndexList lead="14ch">
          {PROJECTS.map((project) => (
            <IndexRow
              key={project.id}
              href={project.link}
              external={Boolean(project.link)}
              lead={project.title}
              leadTone="ink"
              main={project.description}
              mainTone="body"
              trail={project.link ? domain(project.link) : undefined}
              clip
            />
          ))}
        </IndexList>
      </IndexSection>

      <IndexSection id="work" label="work">
        <IndexList lead="12ch">
          {EXPERIENCES.map((experience) => {
            const position = experience.positions[0];
            return (
              <IndexRow
                key={experience.id}
                lead={period(position.employmentPeriod)}
                main={experience.companyName}
                trail={position.title}
                stackTrail
              />
            );
          })}
        </IndexList>
      </IndexSection>

      {notes.length > 0 ? (
        <IndexSection
          id="notes"
          label="notes"
          more={{ href: '/blog', label: 'all', context: 'notes' }}
        >
          <IndexList>
            {notes.map((post) => (
              <IndexRow
                key={post.slug}
                href={`/blog/${post.slug}`}
                lead={dotDate(post.published_at)}
                main={post.title}
                clip
              />
            ))}
          </IndexList>
        </IndexSection>
      ) : null}

      <IndexSection id="education" label="education">
        <IndexList>
          {EDUCATION.map((education) => (
            <IndexRow
              key={education.id}
              main={education.school}
              trail={education.degree}
              clip
              stackTrail
            />
          ))}
        </IndexList>
      </IndexSection>

      <IndexSection id="elsewhere" label="elsewhere">
        <IndexList>
          {PROFILE.socials.map((social) => (
            <IndexRow
              key={social.name}
              href={social.href}
              external={social.name !== 'email'}
              lead={social.name === 'twitter' ? 'x' : social.name}
              main={social.handle}
            />
          ))}
        </IndexList>
      </IndexSection>
    </>
  );
}

/** Formats from the ISO string itself, so the server and browser always agree. */
function dotDate(iso: string) {
  const [date] = iso.split('T');
  return date.replaceAll('-', '.');
}

function period({ start, end }: { start: string; end?: string }) {
  return `${start} → ${end ?? 'now'}`;
}

function domain(url: string) {
  return new URL(url).hostname.replace(/^www\./, '');
}
