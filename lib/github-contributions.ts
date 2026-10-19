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

async function requestContributions(username: string, attempts = 2): Promise<Activity[]> {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    try {
      const res = await fetch(`${CONTRIBUTIONS_API}/${username}?y=last`);
      if (res.ok) {
        const data = (await res.json()) as { contributions?: Activity[] };
        if (data.contributions?.length) return data.contributions;
        console.error(`GitHub contributions: empty response (attempt ${attempt})`);
      } else {
        console.error(`GitHub contributions: HTTP ${res.status} (attempt ${attempt})`);
      }
    } catch (error) {
      console.error(`GitHub contributions: request failed (attempt ${attempt})`, error);
    }
  }
  return [];
}

/** Pages built without contributions retry soon instead of staying empty for a day. */
export function contributionsRevalidate(contributions: Activity[]) {
  return contributions.length > 0 ? 86400 : 300;
}
