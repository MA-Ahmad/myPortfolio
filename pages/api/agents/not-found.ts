import type { NextApiRequest, NextApiResponse } from 'next';
import { sendMarkdownNotFound } from 'lib/agent-markdown';

// Reached through the fallback rewrite in next.config.js, so `path` is the page that was asked for.
export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const path = req.query.path;
  sendMarkdownNotFound(res, `/${Array.isArray(path) ? path.join('/') : (path ?? '')}`);
}
