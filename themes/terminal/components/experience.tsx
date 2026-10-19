import { EXPERIENCES } from 'data/profile';
import { Section } from './section';
import { Timeline } from './timeline';

export function Experience() {
  const entries = EXPERIENCES.map((experience) => {
    const position = experience.positions[0];
    const { start, end } = position.employmentPeriod;
    return {
      id: experience.id,
      title: `${position.title.toLowerCase()} — ${experience.companyName.toLowerCase()}`,
      meta: `${start} – ${end ?? 'present'}`,
      body: <p>{position.skills?.join(', ')}</p>
    };
  });

  return (
    <Section id="experience" command="cat experience.log">
      <Timeline entries={entries} />
    </Section>
  );
}
