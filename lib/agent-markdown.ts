import type { NextApiResponse } from 'next';
import { skillsArray } from 'data/data';
import { SITE_URL } from 'data/constants';
import { getBlocks } from 'blocks/registry';
import { EDUCATION, EXPERIENCES, PROFILE, PROJECTS } from 'data/profile';

export function sendMarkdown(res: NextApiResponse, content: string) {
  res.setHeader('Content-Type', 'text/markdown;charset=utf-8');
  res.status(200).send(content);
}

export function llmsTxt() {
  return `# mahmad.me

- [About](${SITE_URL}/about.md): A quick intro to me, my tech stack, and how to connect.
- [Experience](${SITE_URL}/experience.md): Highlights from my career and key roles I've taken on.
- [Education](${SITE_URL}/education.md): Where I studied, what I focused on, and what I built along the way.
- [Projects](${SITE_URL}/projects.md): Selected projects that show my skills and creativity.

## Blocks

${getBlocks()
  .map((block) => `- [${block.title}](${SITE_URL}/blocks/${block.name}.md): ${block.description}`)
  .join('\n')}
`;
}

export function aboutMarkdown() {
  const socials = PROFILE.socials
    .map((item) => `- [${item.title}](${item.href})`)
    .join('\n');
  const stack = skillsArray.map((item) => `- ${item.name}`).join('\n');

  return `# About

## Personal Information

- First Name: ${PROFILE.firstName}
- Display Name: ${PROFILE.displayName}
- Location: ${PROFILE.address}
- Website: ${PROFILE.website}

## Social Links

${socials}

## Tech Stack

${stack}
`;
}

export function experienceMarkdown() {
  return `# Experience

${EXPERIENCES.map((item) =>
    item.positions
      .map((position) => {
        const skills = position.skills?.map((skill) => skill).join(', ') || 'N/A';
        return `## ${position.title} | ${item.companyName}\n\nDuration: ${position.employmentPeriod.start} - ${position.employmentPeriod.end || 'Present'}\n\nSkills: ${skills}`;
      })
      .join('\n\n')
  ).join('\n\n')}
`;
}

export function educationMarkdown() {
  return `# Education

${EDUCATION.map((item) => {
    const heading = item.degree || item.school;
    const school = heading === item.school ? '' : ` | ${item.school}`;
    const skills = item.skills?.length
      ? `\n\nSkills: ${item.skills.join(', ')}`
      : '';
    const description = item.description ? `\n\n${item.description.trim()}` : '';
    const duration = item.period
      ? `\n\nDuration: ${item.period.start} - ${item.period.end || 'Present'}`
      : '';
    return `## ${heading}${school}${duration}${skills}${description}`;
  }).join('\n\n')}
`;
}

export function projectsMarkdown() {
  return `# Projects

${PROJECTS.map((item) => {
    const skills = `\n\nSkills: ${item.skills.join(', ')}`;
    const description = item.description ? `\n\n${item.description.trim()}` : '';
    const url = item.link ? `\n\nProject URL: ${item.link}` : '';
    return `## ${item.title}${url}${skills}${description}`;
  }).join('\n\n')}
`;
}
