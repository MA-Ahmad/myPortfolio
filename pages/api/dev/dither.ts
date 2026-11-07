import { promises as fs } from 'fs';
import path from 'path';
import type { NextApiRequest, NextApiResponse } from 'next';
import saved from 'themes/panorama/torn/dither-sky.json';

const FILE = 'themes/panorama/torn/dither-sky.json';
const SAVED: Record<string, unknown> = saved;
const KEYS = Object.keys(SAVED);

/**
 * Dev only: writes the dithered band's config from the tuning page (/dev/dither) to
 * `dither-sky.json`, which the Panorama theme imports, so saving on that page is what ships.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (process.env.NODE_ENV === 'production') return res.status(404).end();
  if (req.method !== 'POST') return res.status(405).end();

  const body: Record<string, unknown> = req.body ?? {};
  const valid =
    Object.keys(body).length === KEYS.length &&
    KEYS.every((key) =>
      typeof SAVED[key] === 'number'
        ? typeof body[key] === 'number' && Number.isFinite(body[key])
        : typeof body[key] === 'string' && /^#[0-9a-f]{6}$/i.test(body[key] as string)
    );
  if (!valid) return res.status(400).json({ error: `Expected exactly: ${KEYS.join(', ')}` });

  const config = Object.fromEntries(KEYS.map((key) => [key, body[key]]));
  await fs.writeFile(path.join(process.cwd(), FILE), `${JSON.stringify(config, null, 2)}\n`);
  res.status(200).json({ path: FILE });
}
