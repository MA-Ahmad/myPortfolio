import type { ComponentType } from 'react';
import dynamic from 'next/dynamic';

/**
 * The rendered block for each name in BLOCKS (blocks/registry.ts). Load each with next/dynamic
 * so it gets its own chunk and a page only downloads the blocks it shows.
 */
export const BLOCK_COMPONENTS: Record<string, ComponentType> = {
  'api-lifecycle': dynamic(() => import('./api-lifecycle/api-lifecycle')),
  'movie-rack': dynamic(() => import('./movie-rack/movie-rack'))
};
