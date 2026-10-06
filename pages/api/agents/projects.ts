import type { NextApiRequest, NextApiResponse } from 'next';
import { projectsMarkdown, sendMarkdown } from 'lib/agent-markdown';

export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  sendMarkdown(res, projectsMarkdown());
}
