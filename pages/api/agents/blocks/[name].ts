import type { NextApiRequest, NextApiResponse } from 'next';
import { SITE_URL } from 'data/constants';
import { blockHref, getBlock } from 'blocks/registry';
import { blockMarkdown, getBlockFiles } from 'lib/block-source';
import { sendMarkdown } from 'lib/agent-markdown';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const block = getBlock(String(req.query.name));
  if (!block) {
    res.status(404).send('Block not found');
    return;
  }
  sendMarkdown(res, blockMarkdown(block, await getBlockFiles(block), SITE_URL), blockHref(block));
}
