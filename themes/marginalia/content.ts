import { BLOCKS } from 'blocks/registry';
import { companies, skillsArray } from 'data/data';
import { PROFILE } from 'data/profile';
import { projectsList } from 'data/projectData';

/** The notes a word in the paragraph can open, in the order their words appear. */
export type NoteId =
  | 'place'
  | 'games'
  | 'web3'
  | 'property'
  | 'now'
  | 'stack'
  | 'writing'
  | 'blocks'
  | 'github'
  | 'contact';

/** A run of the paragraph: plain text, or a word that opens a note. */
export type Run = string | { note: NoteId; text: string };

/**
 * The whole site. Each `{ note }` run is underlined and opens its note in the margin (on a phone,
 * as a footnote under the paragraph).
 */
export const PARAGRAPH: Run[] = [
  'I’m Muhammad Ahmad, a full stack engineer in ',
  { note: 'place', text: 'Pakistan' },
  '. Since 2017 I’ve built ',
  { note: 'games', text: 'browser games' },
  ', ',
  { note: 'web3', text: 'web3 products' },
  ' and ',
  { note: 'property', text: 'software for property managers' },
  ', lately as a senior engineer at ',
  { note: 'now', text: companies[0].title },
  '. I work in ',
  { note: 'stack', text: 'React, Next.js and Rails' },
  ', from the database to the pixels. I ',
  { note: 'writing', text: 'write about the web' },
  ' on DEV and give away ',
  { note: 'blocks', text: 'Blocks' },
  ', sections you can copy into your own site. ',
  { note: 'github', text: 'My GitHub' },
  ' is rarely quiet. If you’re building something, ',
  { note: 'contact', text: 'write to me' },
  '.'
];

/** Which margin a note sits in when both margins are shown. */
export const SIDE: Record<NoteId, 'left' | 'right'> = {
  place: 'left',
  games: 'right',
  web3: 'right',
  property: 'left',
  now: 'left',
  stack: 'right',
  writing: 'left',
  blocks: 'right',
  github: 'left',
  contact: 'right'
};

/** Opened on arrival, so the first view shows what the page does. */
export const OPEN_AT_START: NoteId[] = ['place', 'web3'];

const company = (title: string) => companies.find((c) => c.title === title)!;
const project = (title: string) => projectsList.find((p) => p.title === title)!;

const SKILL_NAMES: Record<string, string> = {
  Nextjs: 'Next.js',
  Typescript: 'TypeScript',
  Javascript: 'JavaScript',
  Nestjs: 'NestJS',
  Postgres: 'PostgreSQL',
  Mysql: 'MySQL'
};

export const MARGINALIA_CONTENT = {
  name: PROFILE.displayName,
  role: PROFILE.jobs[0].title,
  timeZone: PROFILE.timeZone,
  bigWolf: company('Big Wolf Games'),
  web3: ['Shadow War', 'Spaace', 'Deca Stream', 'RISE Chain', 'Alienzone'].map(project),
  smata: project('Smata'),
  career: companies.map((c) => ({ title: c.title, role: c.role, period: c.period.replace(' - ', '–') })),
  stack: ['Frontend', 'Backend', 'Database'].map((type) => ({
    type,
    skills: skillsArray
      .filter((skill) => skill.type === type)
      .map((skill) => SKILL_NAMES[skill.name] ?? skill.name)
  })),
  blocks: [...BLOCKS]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 4)
    .map((block) => ({ title: block.title, href: `/blocks/${block.category}/${block.name}` })),
  blockCount: BLOCKS.length,
  email: PROFILE.email,
  links: [
    ...PROFILE.socials
      .filter((social) => social.name !== 'email')
      .map((social) => ({ label: social.title, href: social.href })),
    { label: 'Résumé', href: PROFILE.resumeUrl }
  ],
  githubUrl: PROFILE.githubUrl
};
