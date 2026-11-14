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

export const RELAY_CONTENT = {
  name: PROFILE.displayName,
  role: PROFILE.jobs[0].title,
  resumeUrl: PROFILE.resumeUrl,
  email: PROFILE.email,
  githubUrl: PROFILE.githubUrl,
  linkedinUrl: PROFILE.socials.find((s) => s.name === 'linkedin')?.href ?? PROFILE.githubUrl,
  now: companies[0],
  career: companies.map((c) => ({ title: c.title, role: c.role, period: period(c.period) })),
  projects: projectsList.map((p) => ({ title: p.title, href: p.site, stack: p.techStack.slice(0, 2).join(' · ') })),
  blocks: M.blocks,
  blockCount: M.blockCount,
  links: M.links
};
