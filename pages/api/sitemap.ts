import matter from 'gray-matter';
import type { NextApiRequest, NextApiResponse } from 'next';
import { SITE_URL } from 'data/constants';
import { blockHref, getBlocks, getUsedCategories } from 'blocks/registry';
import { localPostSlugs, localPostSource } from 'lib/local-posts';

// Theme and block preview pages are noindexed, and posts written on Dev.to name Dev.to as
// canonical, so none of them are listed.
const PAGES = [
  '/',
  '/blog',
  '/theme-studio',
  '/blocks',
  ...getUsedCategories().map((category) => `/blocks/${category.name}`),
  ...getBlocks().map(blockHref)
];

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  const posts = localPostSlugs().map((slug) => {
    const { data } = matter(localPostSource(slug));
    return {
      loc: `/blog/${slug}`,
      lastmod: new Date(data.published_at).toISOString().slice(0, 10)
    };
  });

  const urls = [...PAGES.map((loc) => ({ loc, lastmod: undefined })), ...posts]
    .map(
      ({ loc, lastmod }) =>
        `  <url><loc>${SITE_URL}${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}</url>`
    )
    .join('\n');

  res.setHeader('Content-Type', 'application/xml;charset=utf-8');
  res.setHeader('Cache-Control', 'public, s-maxage=86400, stale-while-revalidate=86400');
  res.status(200).send(
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`
  );
}
