import { skillsArray } from 'data/data';
import { cn } from 'lib/cn';
import { MIDNIGHT_CONTENT, SKILL_GROUPS } from '../content';
import { PixelHeading } from './pixel-heading';
import { SkillChip } from './skill-chip';
import styles from '../midnight.module.css';

const imageOf = (name: string) =>
  skillsArray.find((skill) => skill.name.toLowerCase() === name.toLowerCase())?.image;

function Chip({ name }: { name: string }) {
  const label = skillsArray.find((skill) => skill.name === name)?.name ?? name;
  return <SkillChip name={label === 'Nextjs' ? 'Next.js' : label} image={imageOf(name)} inline />;
}

export function SkillsPage() {
  return (
    <>
      <PixelHeading subtitle="The tools I reach for">Skills</PixelHeading>
      <p className={styles.lead}>
        {MIDNIGHT_CONTENT.skillsLine.map((part, index) =>
          typeof part === 'string' ? part : <Chip key={index} name={part.skill} />
        )}
      </p>
      {SKILL_GROUPS.map((group) => (
        <section key={group.title} className={styles.group}>
          <h2 className={cn(styles.groupTitle, styles.mono)}>{`<${group.title}/>`}</h2>
          <div className={styles.chips} style={{ marginTop: 0 }}>
            {group.skills.map((skill) => (
              <SkillChip key={skill.name} name={skill.name} image={skill.image} />
            ))}
          </div>
        </section>
      ))}
      <p className={cn(styles.secret, styles.mono)}>{MIDNIGHT_CONTENT.skillsSecret}</p>
    </>
  );
}
