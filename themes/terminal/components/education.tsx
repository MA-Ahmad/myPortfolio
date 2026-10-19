import { institutes } from 'data/data';
import { Section } from './section';
import { Timeline } from './timeline';

export function Education() {
  const entries = institutes.map((institute) => ({
    id: institute.title,
    title: `${institute.role.toLowerCase()} — ${institute.short_title.toLowerCase()}`,
    meta: institute.period,
    body: (
      <>
        <p>{institute.title.toLowerCase()}</p>
        {institute.awards?.map((award) => (
          <p key={award.title} className="text-term-muted">
            <span className="mr-2 text-term-accent">+</span>
            {award.title.toLowerCase()} — {award.description.toLowerCase()}
          </p>
        ))}
      </>
    )
  }));

  return (
    <Section id="education" command="cat education.md">
      <Timeline entries={entries} />
    </Section>
  );
}
