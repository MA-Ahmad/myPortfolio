import { companies } from 'data/data';
import { PROFILE } from 'data/profile';
import { projectsList } from 'data/projectData';
import { MARGINALIA_CONTENT as M } from 'themes/marginalia/content';

/** The six sections the nav switches between, in order. */
export const SECTIONS = [
  { id: 'intro', label: 'Intro' },
  { id: 'work', label: 'Work' },
  { id: 'projects', label: 'Projects' },
  { id: 'writing', label: 'Writing' },
  { id: 'blocks', label: 'Blocks' },
  { id: 'contact', label: 'Contact' }
] as const;

export type SectionId = (typeof SECTIONS)[number]['id'];

const period = (value: string) => value.replace(' - ', '–');
const social = (name: string) => PROFILE.socials.find((s) => s.name === name)!;

const SKILL_NAMES: Record<string, string> = {
  web3: 'Web3',
  nextjs: 'Next.js',
  rails: 'Rails',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  react: 'React',
  aws: 'AWS',
  heroku: 'Heroku',
  ruby: 'Ruby',
  pixi: 'PixiJS',
  serverless: 'Serverless',
  python: 'Python',
  angular: 'Angular'
};

export const RELAY_CONTENT = {
  name: PROFILE.displayName,
  firstName: PROFILE.firstName,
  role: PROFILE.jobs[0].title,
  /** From the GitHub profile, which is where people check. */
  bio: 'Full Stack Engineer with a product mindset and endless passion for technology.',
  city: 'Lahore',
  country: 'Pakistan',
  timeZone: PROFILE.timeZone,
  avatar: PROFILE.avatar,
  resumeUrl: PROFILE.resumeUrl,
  email: PROFILE.email,
  x: { handle: social('twitter').handle, href: social('twitter').href },
  github: { handle: PROFILE.githubUsername, href: PROFILE.githubUrl },
  linkedinUrl: social('linkedin').href,
  devUrl: social('devto').href,
  companies: companies.map((c) => ({
    title: c.title,
    role: c.role,
    period: period(c.period),
    logo: c.logo,
    skills: c.skills.slice(0, 4).map((s) => SKILL_NAMES[s] ?? s)
  })),
  projects: projectsList.map((p) => ({
    title: p.title,
    href: p.site,
    host: new URL(p.site).host.replace(/^www\./, ''),
    text: p.description,
    stack: p.techStack,
    image: p.imageLight
  })),
  blocks: M.blocks,
  blockCards: M.blockCards,
  blockCount: M.blockCount
};
