/**
 * ============================================================================
 * SITE CONFIGURATION - Edit this file to customize your portfolio homepage
 * ============================================================================
 *
 * This is the single source of truth for all content on your one-page portfolio.
 * To customize:
 *
 * 1. PERSONAL INFO: Update name, role, location, tagline, and bio
 * 2. SOCIAL LINKS: Add/remove social profiles (GitHub, LinkedIn, Twitter, etc.)
 * 3. EXPERIENCE: Update your work history (most recent first)
 * 4. PROJECTS: Showcase your best work (select 4-6 featured projects)
 * 5. SKILLS: Group your technical skills by category
 * 6. EDUCATION: Add your educational background
 *
 * All sections are typed for safety. See the interfaces below for structure.
 */

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface SocialLink {
  platform: 'github' | 'linkedin' | 'twitter' | 'email' | 'devto' | 'website';
  url: string;
  label: string;
}

export interface Experience {
  company: string;
  role: string;
  period: string;
  description?: string;
  skills: string[];
  logo?: string;
}

export interface Project {
  title: string;
  description: string;
  url?: string;
  github?: string;
  techStack: string[];
  image?: string;
  featured?: boolean;
}

export interface SkillGroup {
  category: string;
  skills: string[];
}

export interface Education {
  institution: string;
  degree: string;
  period: string;
  logo?: string;
}

export interface SiteConfig {
  personal: {
    name: string;
    firstName: string;
    role: string;
    location: string;
    locationEmoji: string;
    tagline: string;
    bio: string;
    avatar: string;
  };
  socials: SocialLink[];
  experience: Experience[];
  featuredProjects: Project[];
  skills: SkillGroup[];
  education: Education[];
  footer: {
    copyright: string;
  };
}

// ============================================================================
// SITE CONFIGURATION - EDIT BELOW
// ============================================================================

export const siteConfig: SiteConfig = {
  // ---------------------------------------------------------------------------
  // PERSONAL INFORMATION
  // ---------------------------------------------------------------------------
  personal: {
    name: 'Muhammad Ahmad',
    firstName: 'Ahmad',
    role: 'Senior Software Engineer',
    location: 'Pakistan',
    locationEmoji: '🇵🇰',
    tagline: 'Full-stack developer and open-source enthusiast',
    bio: `I'm a senior software engineer with over 7 years of experience building 
web applications. I specialize in Ruby on Rails and React, with a passion for 
creating elegant solutions and contributing to open-source projects. Currently 
working on Web3 technologies and always exploring new ways to improve developer 
experiences.`,
    avatar: 'https://avatars2.githubusercontent.com/u/37842853?v=4',
  },

  // ---------------------------------------------------------------------------
  // SOCIAL LINKS
  // ---------------------------------------------------------------------------
  socials: [
    {
      platform: 'github',
      url: 'https://github.com/MA-Ahmad',
      label: 'GitHub',
    },
    {
      platform: 'linkedin',
      url: 'https://linkedin.com/in/muhammad-ahmad20',
      label: 'LinkedIn',
    },
    {
      platform: 'twitter',
      url: 'https://twitter.com/muhammad_ahmaad',
      label: 'Twitter',
    },
    {
      platform: 'devto',
      url: 'https://dev.to/m_ahmad',
      label: 'Dev.to',
    },
    {
      platform: 'email',
      url: 'mailto:muhammad.ahmad8043@gmail.com',
      label: 'Email',
    },
  ],

  // ---------------------------------------------------------------------------
  // WORK EXPERIENCE (most recent first)
  // ---------------------------------------------------------------------------
  experience: [
    {
      company: 'Nalikes Studio',
      role: 'Senior Software Engineer',
      period: '2023 — Present',
      description: 'Building Web3 applications and decentralized platforms using modern technologies.',
      skills: ['Web3', 'Next.js', 'Rails', 'TypeScript', 'React', 'AWS'],
      logo: '/assets/images/logos/nalikes-studio.png',
    },
    {
      company: 'Big Wolf Games',
      role: 'Senior Software Engineer',
      period: '2021 — 2023',
      description: 'Developed interactive gaming experiences and real-time multiplayer features.',
      skills: ['Ruby', 'Rails', 'TypeScript', 'React', 'Pixi.js', 'AWS'],
      logo: '/assets/images/logos/bigwolf.png',
    },
    {
      company: 'Phaedra Solutions',
      role: 'Senior Software Engineer',
      period: '2019 — 2021',
      description: 'Led development of enterprise web applications and mentored junior developers.',
      skills: ['Ruby', 'Rails', 'TypeScript', 'React', 'AWS'],
      logo: '/assets/images/logos/phaedra.jpeg',
    },
    {
      company: 'Brainx Technologies',
      role: 'Software Engineer',
      period: '2018 — 2019',
      description: 'Built scalable backend systems and automation tools.',
      skills: ['Ruby', 'Rails', 'JavaScript', 'Python'],
      logo: '/assets/images/logos/brainxtech.png',
    },
    {
      company: 'Brainplow',
      role: 'Software Engineer',
      period: '2017 — 2018',
      description: 'Developed web applications and data processing pipelines.',
      skills: ['JavaScript', 'Python', 'Angular'],
      logo: '/assets/images/logos/brainplow.jpg',
    },
  ],

  // ---------------------------------------------------------------------------
  // FEATURED PROJECTS (select your best 4-6 projects)
  // ---------------------------------------------------------------------------
  featuredProjects: [
    {
      title: 'TemplatesKart',
      description:
        'Production-ready Chakra UI templates and components. A comprehensive collection of hand-crafted UI elements for modern web applications.',
      url: 'https://templateskart.com',
      github: 'https://github.com/MA-Ahmad/templatesKart',
      techStack: ['React', 'Next.js', 'Chakra UI', 'TypeScript'],
      image: '/assets/images/projects/cover/templateskart.png',
      featured: true,
    },
    {
      title: 'Smata',
      description:
        'All-in-one cloud-based solution integrating management, communication, and accounting functions for strata management.',
      url: 'https://smata.com/',
      techStack: ['Rails', 'React', 'JavaScript'],
      image: '/assets/images/projects/cover/smata.png',
      featured: true,
    },
    {
      title: 'Peterpitch',
      description:
        'A team engagement platform that transforms meetings into performance boosters through gamification and fun activities.',
      url: 'https://peterpitch.com/',
      techStack: ['Rails', 'React', 'JavaScript'],
      image: '/assets/images/projects/cover/peterpitch.png',
      featured: true,
    },
    {
      title: 'Notch',
      description:
        'Project management platform for design and procurement teams, helping collaborate and manage floor plans in one place.',
      url: 'https://www.hellonotch.com/',
      techStack: ['Rails', 'JavaScript'],
      image: '/assets/images/projects/cover/notch.png',
      featured: true,
    },
    {
      title: 'Workof',
      description:
        'E-commerce furniture marketplace providing a unified platform for multiple vendors to showcase and sell products.',
      url: 'https://workof.com/',
      techStack: ['Rails', 'JavaScript'],
      image: '/assets/images/projects/cover/workof.png',
      featured: true,
    },
    {
      title: 'Hiredroid',
      description:
        'Skill-based hiring platform helping professionals attract talent from around the world through competency-focused matching.',
      url: 'https://hiredroid.com',
      techStack: ['React', 'Node.js'],
      image: '/assets/images/projects/cover/hiredroid.png',
      featured: true,
    },
  ],

  // ---------------------------------------------------------------------------
  // SKILLS (grouped by category)
  // ---------------------------------------------------------------------------
  skills: [
    {
      category: 'Languages',
      skills: ['TypeScript', 'JavaScript', 'Ruby', 'Python'],
    },
    {
      category: 'Frontend',
      skills: ['React', 'Next.js', 'Chakra UI', 'HTML/CSS'],
    },
    {
      category: 'Backend',
      skills: ['Ruby on Rails', 'Node.js', 'PostgreSQL', 'Redis'],
    },
    {
      category: 'DevOps & Tools',
      skills: ['AWS', 'Heroku', 'Docker', 'Git'],
    },
  ],

  // ---------------------------------------------------------------------------
  // EDUCATION
  // ---------------------------------------------------------------------------
  education: [
    {
      institution: 'FAST - NUCES',
      degree: 'Bachelor of Science in Computer Science',
      period: '2013 — 2017',
      logo: '/assets/images/logos/fast.png',
    },
  ],

  // ---------------------------------------------------------------------------
  // FOOTER
  // ---------------------------------------------------------------------------
  footer: {
    copyright: `© ${new Date().getFullYear()} Muhammad Ahmad. All rights reserved.`,
  },
};

export default siteConfig;
