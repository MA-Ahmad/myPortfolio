import { promises as fs } from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import saved from 'blocks/friday-deploy/blast.json';

const FILE = 'blocks/friday-deploy/blast.json';
const KEYS = Object.keys(saved);

/**
 * Dev only: writes the blast config from the tuning page (/dev/friday-deploy) to `blast.json`,
 * which the block imports, so saving on that page is what ships.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body: Record<string, unknown> = req.body ?? {};
  const keys = Object.keys(body);
  const valid =
    keys.length === KEYS.length &&
    KEYS.every((key) => typeof body[key] === 'number' && Number.isFinite(body[key]));
  if (!valid)
    return res.status(400).json({ error: `Expected numbers for exactly: ${KEYS.join(', ')}` });

  const config = Object.fromEntries(KEYS.map((key) => [key, body[key]]));
  await fs.writeFile(path.join(process.cwd(), FILE), `${JSON.stringify(config, null, 2)}\n`);
  res.status(200).json({ path: FILE });
}
