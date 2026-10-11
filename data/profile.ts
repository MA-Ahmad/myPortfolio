import { companies, institutes } from 'data/data';
import { projectsList } from 'data/projectData';
import { GITHUB_USERNAME, SITE_URL } from 'data/constants';

export const PROFILE = {
  displayName: 'Muhammad Ahmad',
  firstName: 'Ahmad',
  avatar: 'https://avatars2.githubusercontent.com/u/37842853?v=4',
  flipSentences: [
    'Full Stack Developer.',
    'Open source lover.',
    'This is my digital garden.'
  ],
  address: 'Pakistan',
  website: SITE_URL,
  email: 'muhammad.ahmad8043@gmail.com',
  timeZone: 'Asia/Karachi',
  githubUsername: GITHUB_USERNAME,
  githubUrl: `https://github.com/${GITHUB_USERNAME}`,
  jobs: [
    {
      title: companies[0].role,
      company: companies[0].title,
      experienceId: slugify(companies[0].title)
    }
  ],
  socials: [
    { name: 'github', title: 'GitHub', handle: GITHUB_USERNAME, href: `https://github.com/${GITHUB_USERNAME}` },
    { name: 'twitter', title: 'X', handle: '@muhammad_ahmaad', href: 'https://twitter.com/muhammad_ahmaad' },
    { name: 'linkedin', title: 'LinkedIn', handle: 'muhammad-ahmad20', href: 'https://linkedin.com/in/muhammad-ahmad20' },
    { name: 'devto', title: 'DEV', handle: 'm_ahmad', href: 'https://dev.to/m_ahmad' },
    { name: 'email', title: 'Email', handle: 'muhammad.ahmad8043@gmail.com', href: 'mailto:muhammad.ahmad8043@gmail.com' }
  ]
};

export type ExperienceItemData = {
  id: string;
  companyName: string;
  companyLogo?: string;
  isCurrentEmployer?: boolean;
  positions: {
    id: string;
    title: string;
    employmentPeriod: { start: string; end?: string };
    skills?: string[];
  }[];
};

export const EXPERIENCES: ExperienceItemData[] = companies.map((company) => {
  const { start, end } = splitPeriod(company.period);
  return {
    id: slugify(company.title),
    companyName: company.title,
    companyLogo: company.logo,
    isCurrentEmployer: !end,
    positions: [
      {
        id: `${slugify(company.title)}-role`,
        title: company.role,
        employmentPeriod: { start, end },
        skills: company.skills
      }
    ]
  };
});

export type EducationItemData = {
  id: string;
  school: string;
  degree?: string;
  period: { start: string; end?: string };
  description?: string;
  skills?: string[];
  isExpanded?: boolean;
};

export const EDUCATION: EducationItemData[] = institutes.map((institute) => {
  const { start, end } = splitPeriod(institute.period);
  return {
    id: slugify(institute.short_title || institute.title),
    school: institute.title,
    degree: institute.role,
    period: { start, end },
    description: institute.awards
      ?.map((award) => `**${award.title}** — ${award.description}`)
      .join('\n\n'),
    skills: institute.skills,
    isExpanded: true
  };
});

export type ProjectItemData = {
  id: string;
  title: string;
  link?: string;
  skills: string[];
  description?: string;
};

export const PROJECTS: ProjectItemData[] = projectsList.map((project) => ({
  id: slugify(project.title),
  title: project.title,
  link: project.site,
  skills: project.techStack,
  description: project.description
}));

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function splitPeriod(period: string) {
  const [rawStart, rawEnd] = period.split(/\s*-\s*/);
  const start = rawStart?.trim() || period;
  const end = !rawEnd || /present/i.test(rawEnd) ? undefined : rawEnd.trim();
  return { start, end };
}
