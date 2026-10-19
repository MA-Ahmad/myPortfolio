import { skillsArray } from 'data/data';
import { PROFILE } from 'data/profile';

type TagColor =
  | 'text-term-fg'
  | 'text-term-accent'
  | 'text-term-red'
  | 'text-term-orange'
  | 'text-term-yellow'
  | 'text-term-aqua'
  | 'text-term-blue'
  | 'text-term-purple';

const STACK_COLORS: Record<string, TagColor> = {
  react: 'text-term-blue',
  nextjs: 'text-term-fg',
  'tailwind css': 'text-term-aqua',
  'shadcn/ui': 'text-term-fg',
  typescript: 'text-term-blue',
  javascript: 'text-term-yellow',
  'ruby on rails': 'text-term-red',
  nestjs: 'text-term-red',
  ruby: 'text-term-red',
  python: 'text-term-yellow',
  postgres: 'text-term-blue',
  mysql: 'text-term-orange',
  redis: 'text-term-red',
  cursor: 'text-term-fg',
  claude: 'text-term-orange',
  chatgpt: 'text-term-aqua',
  vercel: 'text-term-fg',
  figma: 'text-term-purple',
  photoshop: 'text-term-blue',
  heroku: 'text-term-purple',
  aws: 'text-term-orange',
  'digital ocean': 'text-term-blue',
  nginx: 'text-term-accent'
};

export const TERMINAL_CONTENT = {
  handle: 'ahmad',
  bio: "I'm a full stack engineer who loves building web products, shipping fast, and contributing to open source.",
  currently: {
    label: 'working at',
    highlight: PROFILE.jobs[0].company.toLowerCase(),
    suffix: `— ${PROFILE.jobs[0].title.toLowerCase()}`
  },
  openToWork: true,
  timeZoneLabel: 'PKT',
  stack: skillsArray.map((skill) => {
    const name = skill.name.toLowerCase();
    return { name, color: STACK_COLORS[name] ?? 'text-term-fg' };
  }),
  nav: [
    { label: 'experience', href: '#experience' },
    { label: 'projects', href: '#projects' }
  ],
  whyHireMe: [
    "I've been shipping production software since 2017, from Rails monoliths to Next.js frontends, NestJS services, and web3 platforms. I like owning a feature end to end, from the database to the pixels.",
    "I care about clean, boring, maintainable code and products that feel fast. I'm comfortable leading, mentoring, and working with remote teams across time zones.",
    "If you're building something interesting, I'd love to hear about it."
  ]
};
