import { GITHUB_USERNAME } from 'data/constants';

export type Activity = {
  date: string;
  count: number;
  level: number;
};

const CONTRIBUTIONS_API = 'https://github-contributions-api.jogruber.de/v4';

export async function fetchGitHubContributions(
  username = GITHUB_USERNAME
): Promise<Activity[]> {
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
