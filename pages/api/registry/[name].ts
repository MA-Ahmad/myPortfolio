import type { NextApiRequest, NextApiResponse } from 'next';
import { getBlock } from 'blocks/registry';
import { blockRegistryItem, getBlockFiles } from 'lib/block-source';

/** A block as a shadcn registry item, at /r/<name>.json: for `npx shadcn add <url>` and "Open in v0". */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const block = getBlock(String(req.query.name));
  if (!block) {
    res.status(404).json({ error: 'Block not found' });
    return;
  }
  // v0 and the shadcn CLI fetch this from other origins.
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400');
  res.status(200).json(blockRegistryItem(block, await getBlockFiles(block)));
}
