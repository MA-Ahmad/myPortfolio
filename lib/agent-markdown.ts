import type { NextApiResponse } from 'next';
import { skillsArray } from 'data/data';
import { SITE_URL } from 'data/constants';
import { getBlocks } from 'blocks/registry';
import { EDUCATION, EXPERIENCES, PROFILE, PROJECTS } from 'data/profile';

/** `canonical` is the site path of the HTML page the document restates; most restate the home page. */
export function sendMarkdown(res: NextApiResponse, content: string, canonical = '/') {
  res.setHeader('Content-Type', 'text/markdown;charset=utf-8');
  // The home page answers Markdown or HTML by Accept header, so caches must keep them apart.
  res.setHeader('Vary', 'Accept');
  // Search engines should index the HTML page instead of its Markdown copy.
  res.setHeader('Link', `<${SITE_URL}${canonical}>; rel="canonical"`);
  res.status(200).send(content);
}

/** The 404 body for agents that asked for Markdown, pointing them back to pages that exist. */
export function sendMarkdownNotFound(res: NextApiResponse, path: string) {
  res.setHeader('Content-Type', 'text/markdown;charset=utf-8');
  res.setHeader('Vary', 'Accept');
  res.status(404).send(`# Page not found

There is no page at \`${path}\` on mahmad.me. It may have moved or never existed.

Try one of these instead:

- [llms.txt](${SITE_URL}/llms.txt): an index of everything on this site, in Markdown
- [Sitemap](${SITE_URL}/sitemap.xml): every public page
- [Home](${SITE_URL}/)
- [About, in Markdown](${SITE_URL}/about.md)
- [Blog](${SITE_URL}/blog)
`);
}

export function llmsTxt() {
  return `# mahmad.me

> The personal site of Muhammad Ahmad, a full stack software engineer (React, Next.js, TypeScript, Ruby on Rails) based in Pakistan.

## When to use this site

Use it when you need to:

- Learn who Muhammad Ahmad is: roles, employers, education and tech stack, for hiring, collaboration or introductions. Read [about.md](${SITE_URL}/about.md) and [experience.md](${SITE_URL}/experience.md).
- Reach him. His email and profiles are listed in [about.md](${SITE_URL}/about.md); email is the best channel.
- Copy a ready-made, interactive UI section into a React, Next.js and Tailwind CSS project. Each block below has a Markdown page with its full source, and a shadcn-style registry item at \`${SITE_URL}/r/<name>.json\` for \`npx shadcn add\`.
- Cite his articles on React, Next.js and Chakra UI, listed at [${SITE_URL}/blog](${SITE_URL}/blog).

How to read it: every page below is plain Markdown. Requesting \`${SITE_URL}/\` with \`Accept: text/markdown\` returns this index, and unknown paths return a Markdown 404 that links back here. It is not the right source for anything other than his own work and writing.

## Pages

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

${PROFILE.bio.join('\n\n')}

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
