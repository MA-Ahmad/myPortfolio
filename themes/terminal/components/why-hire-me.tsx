import { TERMINAL_CONTENT } from '../content';
import { Section } from './section';

export function WhyHireMe() {
  return (
    <Section id="hire-me" command="cat why-hire-me.md" headingClassName="mb-4">
      <div className="space-y-4 rounded-sm border border-term-dim/20 p-6">
        {TERMINAL_CONTENT.whyHireMe.map((paragraph) => (
          <p key={paragraph} className="text-sm leading-relaxed text-term-muted">
            {paragraph}
          </p>
        ))}
      </div>
    </Section>
  );
}
