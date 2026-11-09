import { BLOCKS } from 'blocks/registry';
import { companies, skillsArray } from 'data/data';
import { PROFILE } from 'data/profile';
import { projectsList } from 'data/projectData';

/** X and email are the Intro's torn pills, so they aren't repeated here. */
const SOCIALS = ['github', 'linkedin'];

const SKILL_NAMES: Record<string, string> = {
  Nextjs: 'Next.js',
  Typescript: 'TypeScript',
  Javascript: 'JavaScript',
  Nestjs: 'NestJS',
  Postgres: 'PostgreSQL',
  Mysql: 'MySQL'
};

/** How many posts and blocks a section lists before its "All" link. */
export const LIST_LIMIT = 4;

/**
 * Single-colour logos, which vanish on a background of their own colour: black ones are flipped
 * to white at night, the white one to black by day.
 */
const LOGO_TONES: Record<string, 'dark' | 'light'> = {
  Nextjs: 'dark',
  'shadcn/ui': 'dark',
  Cursor: 'dark',
  ChatGPT: 'light'
};

/** Kept off the Work pane so it fits on a desktop screen without scrolling. */
const LEFT_OUT = ['Vercel'];
const PROJECTS_LEFT_OUT = ['Spaace'];

export const PANORAMA_CONTENT = {
  name: PROFILE.displayName,
  role: 'Product-minded full stack engineer',
  intro:
    'I treat every feature as mine to own: start from the problem, shape the solution around the people using it, and stay with it until it’s live and working.',
  now: { role: companies[0].role, company: companies[0].title },
  links: [
    ...PROFILE.socials
      .filter((social) => SOCIALS.includes(social.name))
      .map((social) => ({ id: social.name, label: social.title, href: social.href })),
    { id: 'resume', label: 'Résumé', href: PROFILE.resumeUrl }
  ],
  stack: ['Frontend', 'Backend', 'Database', 'Workflow & AI'].map((type) => ({
    title: type,
    skills: skillsArray
      .filter((skill) => skill.type === type && !LEFT_OUT.includes(skill.name))
      .map((skill) => ({
        name: SKILL_NAMES[skill.name] ?? skill.name,
        icon: skill.image,
        tone: LOGO_TONES[skill.name]
      }))
  })),
  projects: projectsList
    .slice(0, 4)
    .filter((project) => !PROJECTS_LEFT_OUT.includes(project.title))
    .map((project) => ({
      title: project.title,
      href: project.site,
      text: project.description,
      stack: project.techStack.slice(0, 3)
    })),
  blocks: [...BLOCKS]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((block) => ({
      title: block.title,
      text: block.description,
      href: `/blocks/${block.category}/${block.name}`,
      image: block.images && {
        alt: block.images.alt,
        ...(typeof block.images.card === 'string'
          ? { light: block.images.card, dark: block.images.card }
          : block.images.card)
      }
    }))
};

/** The sections, left to right. */
export const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'work', label: 'Work' },
  { id: 'writing', label: 'Writing' },
  { id: 'blocks', label: 'Blocks' }
] as const;
