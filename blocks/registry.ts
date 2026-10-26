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
  /** npm packages the block needs, listed in its Markdown for AI tools and anyone copying it. */
  dependencies?: string[];
  /** Files the block reads from `public/` rather than ships as source (images, fonts), in Markdown:
   * where they go, and how the block behaves without them. Listed under "Assets" in its Markdown. */
  assets?: string;
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
      'art.tsx',
      'geometry.ts',
      'view.ts',
      'api-lifecycle.module.css',
      'iso-react.tsx',
      'iso-kit.ts'
    ],
    iframeHeight: 860,
    dependencies: ['next-themes']
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
