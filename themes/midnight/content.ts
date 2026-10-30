import { companies, skillsArray } from 'data/data';
import { EXPERIENCES, PROFILE } from 'data/profile';

export type NodeKind = 'design' | 'build' | 'test' | 'ship';

/** The one-line pipeline under the intro: from design to shipped. */
export const PIPELINE_LABELS: Record<NodeKind, string> = {
  design: 'Design',
  build: 'Build',
  test: 'Test',
  ship: 'Ship'
};

const STACK_NAMES: Record<string, string> = {
  nextjs: 'Next.js',
  web3: 'Web3',
  aws: 'AWS',
  pixi: 'PixiJS',
  rails: 'Rails',
  typescript: 'TypeScript',
  javascript: 'JavaScript',
  react: 'React',
  ruby: 'Ruby',
  python: 'Python',
  angular: 'Angular',
  heroku: 'Heroku',
  serverless: 'Serverless'
};

const stackName = (value: string) => STACK_NAMES[value] ?? value.charAt(0).toUpperCase() + value.slice(1);

/** What each role was about, keyed by company. Edit freely; these are the words on the Work page. */
const WORK_DETAILS: Record<string, { badge?: string; location: string; bullets: string[] }> = {
  'Nalikes Studio': {
    badge: 'Remote',
    location: 'Remote',
    bullets: [
      'Own features end to end across web3 products: frontend and design, backend, and deployment.',
      'Build heavy, high-traffic websites that serve millions of users, where speed and reliability are part of the product.',
      'Work across product, design and engineering to take an idea from first sketch to something people use.'
    ]
  },
  'Big Wolf Games': {
    badge: 'Remote',
    location: 'Remote',
    bullets: [
      'Worked on the Narcos game, shipping the features players see.',
      'Built the internal tools the team used to run and support the game.'
    ]
  },
  'Phaedra Solutions': {
    location: 'Pakistan',
    bullets: [
      'Delivered projects for international clients, from Shopify storefronts to React frontends.',
      'Built the server side behind them, so each project shipped as a complete product.'
    ]
  },
  'Brainx Technologies': {
    location: 'Pakistan',
    bullets: [
      'Focused on frontend and design implementation, turning mockups into polished interfaces.',
      'Built and maintained Ruby on Rails applications behind them.'
    ]
  },
  Brainplow: {
    location: 'Pakistan',
    bullets: [
      'Early work in machine learning, building models and data pipelines in Python.',
      'Paired it with web development in JavaScript and Angular.'
    ]
  }
};

export const MIDNIGHT_CONTENT = {
  handle: PROFILE.socials.find((social) => social.name === 'twitter')!.handle,
  greeting: 'Nice to meet you 👋',
  intro: [
    [
      'I’m a ',
      ['product-minded engineer'],
      ' who treats every feature as mine to own. I start from the problem, shape the solution around the people using it, and ',
      ['stay with it until it’s live and working'],
      '.'
    ],
    [
      'I work with ',
      ['AI'],
      ' as a daily teammate to prototype sooner and learn faster, while keeping the judgment, taste and accountability for the outcome. Got something worth building? ',
      ['Let’s talk.']
    ]
  ] as (string | [string])[][],
  work: companies.map((company, index) => ({
    id: EXPERIENCES[index].id,
    company: company.title,
    logo: company.logo,
    role: company.role,
    period: company.period.replace('Present', 'Now'),
    current: /present/i.test(company.period),
    stack: company.skills.map(stackName),
    ...WORK_DETAILS[company.title]
  })),
  skillsLine: [
    'Day to day I write ',
    { skill: 'Typescript' },
    ' with ',
    { skill: 'Nextjs' },
    ' and ',
    { skill: 'Tailwind CSS' },
    ', keep my data in ',
    { skill: 'Postgres' },
    ' with ',
    { skill: 'Redis' },
    ' close by, and let ',
    { skill: 'Cursor' },
    ' speed up the boring parts.'
  ] as (string | { skill: string })[],
  skillsSecret: 'There’s more in the toolbox, but that’s a story for another day.',
  nav: [
    { label: 'Home', href: '/themes/midnight' },
    { label: 'Work', href: '/themes/midnight/work' },
    { label: 'Skills', href: '/themes/midnight/skills' },
    { label: 'Blog', href: '/blog' }
  ],
  /** Two of the interactive blocks on /blocks, shown on the home page. */
  projects: [
    {
      block: 'world-globe',
      text: 'An isometric globe built from separate country plates. Turn it any way, pull a country out, split it into its states.'
    },
    {
      block: 'chatgpt-postgres',
      text: 'How OpenAI scaled PostgreSQL for 800 million ChatGPT users, animated from the first design to today’s.'
    }
  ]
};

/** Skill groups in the order they read on the page, keyed by the `type` the data already carries. */
export const SKILL_GROUPS = ['Frontend', 'Backend', 'Database', 'Workflow & AI', 'Design', 'DevOps'].map(
  (type) => ({
    title: type.toUpperCase().replace(/ & /g, ' & '),
    skills: skillsArray.filter((skill) => skill.type === type)
  })
);
