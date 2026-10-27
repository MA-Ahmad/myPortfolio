/**
 * Blocks: ready-made sections shown at /blocks, each with a live preview and its source.
 *
 * To add one, create `blocks/<name>/` with the component as `<name>.tsx` (default export) plus
 * any files it needs, list it in BLOCKS below, and add it to BLOCK_COMPONENTS in
 * `blocks/components.ts`. The files listed here are what the Code tab shows, read at build time.
 */

export type BlockCategory = {
  name: string;
  title: string;
  description: string;
};

export type BlockMeta = {
  /** Folder name and URL slug, e.g. `hero-01`. */
  name: string;
  title: string;
  description: string;
  category: BlockCategory['name'];
  /** ISO date; listings show the newest first. */
  createdAt: string;
  /** Paths inside `blocks/<name>/`; the first is the entry file. */
  files: string[];
  /** Height of the live preview in px. */
  iframeHeight?: number;
  /** Grow the preview to the block's full height, so the page scrolls instead of the preview;
   * `iframeHeight` is then only its height before the block has loaded. */
  fitContent?: boolean;
  /** npm packages the block needs, listed in its Markdown for AI tools and anyone copying it. */
  dependencies?: string[];
  /** npm packages it needs only to build, such as type definitions (`npm install -D`). */
  devDependencies?: string[];
  /** Files the block reads from `public/` rather than ships as source (images, fonts), in Markdown:
   * where they go, and how the block behaves without them. Listed under "Assets" in its Markdown. */
  assets?: string;
  /**
   * Stills in `public/`. `card` is the picture on its card in the blocks list (one per color mode, or
   * one for both when the block looks the same in each); `og` is its 1200 × 630 social preview, and
   * `alt` describes it. Without them the card renders the live block and the page uses the site's
   * default image.
   */
  images?: { card: string | { light: string; dark: string }; og: string; alt: string };
};

export const BLOCK_CATEGORIES: BlockCategory[] = [
  { name: 'interactive', title: 'Interactive', description: 'Animated pieces you can scroll, drag and play with.' },
  { name: 'hero', title: 'Hero', description: 'Opening sections that introduce a person or product.' },
  { name: 'about', title: 'About', description: 'Profile, bio and social link sections.' },
  { name: 'experience', title: 'Experience', description: 'Work history and timeline sections.' },
  { name: 'projects', title: 'Projects', description: 'Project lists, cards and showcases.' },
  { name: 'testimonials', title: 'Testimonials', description: 'Quotes and social proof.' },
  { name: 'blog', title: 'Blog', description: 'Article lists and post layouts.' }
];

export const BLOCKS: BlockMeta[] = [
  {
    name: 'world-globe',
    title: 'World globe',
    description: 'An isometric desk globe whose countries are separate plates: spin it, pull any country out of its socket, split it into its states or provinces, or break the whole map apart.',
    category: 'interactive',
    createdAt: '2026-10-27',
    files: ['world-globe.tsx', 'live.tsx', 'globe.ts', 'stand.ts', 'use-fullscreen.ts', 'world-globe.module.css', 'divisions/index.json', 'divisions/build.mjs', 'iso-react.tsx', 'iso-kit.ts'],
    iframeHeight: 1040,
    dependencies: ['d3-geo', 'topojson-client', 'world-atlas', 'next-themes', 'lucide-react'],
    devDependencies: ['@types/d3-geo', '@types/topojson-client', 'clipper-lib', 'polylabel', 'topojson-server', 'topojson-simplify'],
    assets:
      'The pieces each country splits into, one TopoJSON file per country at `public/blocks/world-globe/divisions/<code>.json` (about 1.4 MB for all 169 together), listed in `divisions/index.json`. Each is fetched only when its country is first pulled out. Rebuild them with `node blocks/world-globe/divisions/build.mjs <ne_10m_admin_1_states_provinces.geojson> <ne_110m_admin_0_countries.geojson>` (Natural Earth, public domain). Without them the globe works as before, and countries simply do not split.'
  },
  {
    name: 'chatgpt-postgres',
    title: 'ChatGPT Postgres',
    description: 'How OpenAI scaled PostgreSQL for 800 million ChatGPT users, animated: the first design and today’s, in normal traffic, a cache-miss spike and a primary failure.',
    category: 'interactive',
    createdAt: '2026-10-27',
    files: [
      'chatgpt-postgres.tsx',
      'bench.tsx',
      'fleet.ts',
      'sim.ts',
      'scenarios.ts',
      'facts.ts',
      'world.ts',
      'art.ts',
      'parts.ts',
      'robot.ts',
      'order.ts',
      'use-fullscreen.ts',
      'chatgpt-postgres.module.css',
      'iso-react.tsx',
      'iso-kit.ts'
    ],
    iframeHeight: 980,
    fitContent: true,
    dependencies: ['next-themes', 'lucide-react'],
    images: {
      card: { light: '/blocks/chatgpt-postgres/card-light.webp', dark: '/blocks/chatgpt-postgres/card-dark.webp' },
      og: '/blocks/chatgpt-postgres/og.png',
      alt: 'An isometric server floor showing today’s PostgreSQL setup for ChatGPT: app servers behind a rate-limit gate, a cache, PgBouncer, one primary with a hot standby, Azure Cosmos DB and six read replicas, with small robot trays carrying queries along a lane between them.'
    }
  },
  {
    name: 'api-lifecycle',
    title: 'API lifecycle',
    description: 'An isometric request bench that fetches a user profile through the gateway, server, cache and database.',
    category: 'interactive',
    createdAt: '2026-10-26',
    files: [
      'api-lifecycle.tsx',
      'live.tsx',
      'model.ts',
      'screen.tsx',
      'art.ts',
      'geometry.ts',
      'order.ts',
      'view.ts',
      'api-lifecycle.module.css',
      'iso-react.tsx',
      'iso-kit.ts'
    ],
    iframeHeight: 860,
    dependencies: ['next-themes', 'lucide-react'],
    images: {
      card: { light: '/blocks/api-lifecycle/card-light.webp', dark: '/blocks/api-lifecycle/card-dark.webp' },
      og: '/blocks/api-lifecycle/og.png',
      alt: 'An isometric request bench: a client terminal, an auth gate, an app server, a cache and a filing cabinet, with a profile card lifting out of an open drawer onto a shuttle.'
    }
  },
  {
    name: 'movie-rack',
    title: 'Movie rack',
    description: 'A 3D rack of CD cases to scroll through, with a slot-machine pick.',
    category: 'interactive',
    createdAt: '2026-10-25',
    files: ['movie-rack.tsx', 'rack-scene.ts', 'cover-texture.ts', 'movies.ts', 'movie-rack.module.css'],
    iframeHeight: 820,
    dependencies: ['three', 'framer-motion', 'lucide-react'],
    devDependencies: ['@types/three'],
    // The rack draws its own dark scene in either color mode, so one card serves both.
    images: {
      card: '/blocks/movie-rack/card.webp',
      og: '/blocks/movie-rack/og.jpg',
      alt: 'A 3D rack of CD cases with film posters, with Drive pulled out of the row as tonight’s pick.'
    },
    assets:
      'Optional film posters, one per film in `movies.ts`, at `public/blocks/movie-rack/posters/<id>.jpg` (the `poster` field holds each path; any portrait image works). They are not included here. Every case shows a painted cover until its poster loads, so the rack works without them; to leave them out entirely, remove the `poster` fields.'
  }
];

export const DEFAULT_IFRAME_HEIGHT = 720;

const byNewest = (a: BlockMeta, b: BlockMeta) =>
  new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();

export function getBlocks(category?: string): BlockMeta[] {
  return BLOCKS.filter((block) => !category || block.category === category).sort(byNewest);
}

export function getBlock(name: string): BlockMeta | undefined {
  return BLOCKS.find((block) => block.name === name);
}

export function getCategory(name: string): BlockCategory | undefined {
  return BLOCK_CATEGORIES.find((category) => category.name === name);
}

/** Only categories that hold a block get a tab and a page. */
export function getUsedCategories(): BlockCategory[] {
  return BLOCK_CATEGORIES.filter((category) => BLOCKS.some((block) => block.category === category.name));
}

export const blockHref = (block: BlockMeta) => `/blocks/${block.category}/${block.name}`;

/** The block as one Markdown document, for AI tools (pages/api/agents/blocks). */
export const blockMarkdownPath = (block: BlockMeta) => `/blocks/${block.name}.md`;

/** The block as a shadcn registry item, for `npx shadcn add` and "Open in v0" (pages/api/registry). */
export const blockRegistryPath = (block: BlockMeta) => `/r/${block.name}.json`;
