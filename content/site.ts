/**
 * ═══════════════════════════════════════════════════════════════════════════
 * SITE CONTENT — Edit this file to customize the portfolio
 * ═══════════════════════════════════════════════════════════════════════════
 *
 * HOW TO EDIT:
 *
 * 1. NAME & BIO: Update `siteConfig.name`, `siteConfig.role`, `siteConfig.location`, and `siteConfig.bio`
 *
 * 2. SOCIALS: Edit the `siteConfig.socials` array. Each entry needs:
 *    - platform: 'github' | 'twitter' | 'linkedin' | 'devto' | 'email'
 *    - url: full URL or mailto: link
 *    - label: accessible label for screen readers
 *
 * 3. WORK HISTORY: Edit the `workHistory` array. Each job needs:
 *    - company, role, period, skills array
 *    - logo: optional path to image in /public/assets/images/logos/
 *
 * 4. PROJECTS: Edit the `projects` array. Each project needs:
 *    - title, description, techStack array
 *    - site: URL to live project
 *    - github: optional GitHub repo URL
 *    - image: optional path to cover image in /public/assets/images/projects/cover/
 *
 * 5. GITHUB USERNAME: Update `siteConfig.github.username` for the contribution graph
 *
 * 6. CURSOR GRAPH: The Cursor contribution data is loaded from content/cursor-contributions.json
 *    (if the file exists). Create that file with a `contributions` array of { date, count } objects.
 *    Alternatively, set an API endpoint in NEXT_PUBLIC_CURSOR_API_URL env variable if one becomes available.
 *
 * ═══════════════════════════════════════════════════════════════════════════
 */

export type SocialPlatform = 'github' | 'twitter' | 'linkedin' | 'devto' | 'email';

export interface Social {
  platform: SocialPlatform;
  url: string;
  label: string;
}

export interface WorkExperience {
  company: string;
  role: string;
  period: string;
  skills: string[];
  logo?: string;
}

export interface Project {
  title: string;
  description: string;
  techStack: string[];
  site: string;
  github?: string;
  image?: string;
}

export interface ContributionDay {
  date: string;
  count: number;
}

export interface SiteConfig {
  name: string;
  role: string;
  location: string;
  bio: string;
  avatarUrl: string;
  socials: Social[];
  github: {
    username: string;
  };
}

export const siteConfig: SiteConfig = {
  name: "Muhammad Ahmad",
  role: "Senior Software Engineer",
  location: "Pakistan",
  bio: "Full-stack developer passionate about building great web experiences. Open-source enthusiast who loves crafting clean, performant applications with modern technologies.",
  avatarUrl: "https://avatars2.githubusercontent.com/u/37842853?v=4",
  socials: [
    {
      platform: "github",
      url: "https://github.com/MA-Ahmad",
      label: "GitHub Profile",
    },
    {
      platform: "twitter",
      url: "https://twitter.com/muhammad_ahmaad",
      label: "Twitter Profile",
    },
    {
      platform: "devto",
      url: "https://dev.to/m_ahmad",
      label: "Dev.to Profile",
    },
    {
      platform: "linkedin",
      url: "https://linkedin.com/in/muhammad-ahmad20",
      label: "LinkedIn Profile",
    },
    {
      platform: "email",
      url: "mailto:muhammad.ahmad8043@gmail.com",
      label: "Email",
    },
  ],
  github: {
    username: "MA-Ahmad",
  },
};

export const workHistory: WorkExperience[] = [
  {
    company: "Nalikes Studio",
    role: "Senior Software Engineer",
    period: "2023 – Present",
    skills: ["Web3", "Next.js", "Rails", "TypeScript", "React", "AWS", "Heroku"],
    logo: "/assets/images/logos/nalikes-studio.png",
  },
  {
    company: "Big Wolf Games",
    role: "Senior Software Engineer",
    period: "2021 – 2023",
    skills: ["Ruby", "Rails", "TypeScript", "React", "Pixi", "AWS", "Heroku", "Serverless"],
    logo: "/assets/images/logos/bigwolf.png",
  },
  {
    company: "Phaedra Solutions",
    role: "Senior Software Engineer",
    period: "2019 – 2021",
    skills: ["Ruby", "Rails", "TypeScript", "JavaScript", "React", "AWS"],
    logo: "/assets/images/logos/phaedra.jpeg",
  },
  {
    company: "Brainx Technologies",
    role: "Software Engineer",
    period: "2018 – 2019",
    skills: ["Ruby", "Rails", "JavaScript", "Python"],
    logo: "/assets/images/logos/brainxtech.png",
  },
  {
    company: "Brainplow",
    role: "Software Engineer",
    period: "2017 – 2018",
    skills: ["JavaScript", "Python", "Angular"],
    logo: "/assets/images/logos/brainplow.jpg",
  },
];

export const projects: Project[] = [
  {
    title: "TemplatesKart",
    description:
      "Production-ready hand-crafted projects and components built on top of ChakraUI. Free Chakra UI templates for developers.",
    techStack: ["React", "Next.js", "ChakraUI"],
    site: "https://templateskart.com",
    github: "https://github.com/MA-Ahmad/templatesKart",
    image: "/assets/images/projects/cover/templateskart.png",
  },
  {
    title: "Smata",
    description:
      "An all-in-one cloud-based solution integrating management, communication, and accounting functions.",
    techStack: ["Rails", "React", "JavaScript"],
    site: "https://smata.com/",
    image: "/assets/images/projects/cover/smata.png",
  },
  {
    title: "Peterpitch",
    description:
      "A tool that takes the fun in your company seriously and turns your meetings into real performance boosters.",
    techStack: ["Rails", "React", "JavaScript"],
    site: "https://peterpitch.com/",
    image: "/assets/images/projects/cover/peterpitch.png",
  },
  {
    title: "Notch",
    description:
      "Project management website for design and procurement teams. Collaborate and manage floor plans in one place.",
    techStack: ["Rails", "JavaScript"],
    site: "https://www.hellonotch.com/",
    image: "/assets/images/projects/cover/notch.png",
  },
  {
    title: "Workof Ecommerce",
    description:
      "Ecommerce furniture site providing a single platform for multiple vendors to put their products on sale.",
    techStack: ["Rails", "JavaScript"],
    site: "https://workof.com/",
    image: "/assets/images/projects/cover/workof.png",
  },
  {
    title: "Souq of Qatar",
    description:
      "Online comparison website displaying products from all major stores, independent of any retailers.",
    techStack: ["Rails", "JavaScript"],
    site: "https://www.souqofqatar.com/",
    image: "/assets/images/projects/cover/souq.png",
  },
  {
    title: "GoSave",
    description:
      "App that lets you send allowances, assign chores, and approve spending all from your smartphone.",
    techStack: ["Rails"],
    site: "https://gosavehq.com/",
    image: "/assets/images/projects/cover/gosave.png",
  },
  {
    title: "Hiredroid",
    description:
      "Skill-based hiring system helping professionals attract the best talent from around the world.",
    techStack: ["React", "Node.js"],
    site: "https://hiredroid.com",
    image: "/assets/images/projects/cover/hiredroid.png",
  },
];
