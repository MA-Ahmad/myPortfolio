import { GITHUB_USERNAME } from 'data/constants';

export type Activity = {
  date: string;
  count: number;
  level: number;
};

const CONTRIBUTIONS_API = 'https://github-contributions-api.jogruber.de/v4';
const CACHE_MS = 60 * 60 * 1000;

// `next dev` runs getStaticProps on every navigation; without this each page switch waits on the API.
const cache = new Map<string, { at: number; data: Promise<Activity[]> }>();

export function fetchGitHubContributions(username = GITHUB_USERNAME): Promise<Activity[]> {
  const cached = cache.get(username);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.data;
  const data = requestContributions(username);
  cache.set(username, { at: Date.now(), data });
  data.then((contributions) => {
    if (contributions.length === 0) cache.delete(username);
  });
  return data;
}

async function requestContributions(username: string): Promise<Activity[]> {
  try {
    const res = await fetch(`${CONTRIBUTIONS_API}/${username}?y=last`);
    if (!res.ok) {
      return [];
    }
    const data = (await res.json()) as { contributions?: Activity[] };
    return data.contributions ?? [];
  } catch {
    return [];
  }
}
