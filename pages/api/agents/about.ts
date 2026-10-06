import type { NextApiRequest, NextApiResponse } from 'next';
import { aboutMarkdown, sendMarkdown } from 'lib/agent-markdown';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  sendMarkdown(res, aboutMarkdown());
}
