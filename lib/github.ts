import { ContributionDay } from "@/content/site";

interface GitHubContributionResponse {
  total: Record<string, number>;
  contributions: Array<{
    date: string;
    count: number;
    level: number;
  }>;
}

export async function fetchGitHubContributions(
  username: string
): Promise<{ contributions: ContributionDay[]; total: number }> {
  try {
    const response = await fetch(
      `https://github-contributions-api.jogruber.de/v4/${username}?y=last`,
      { next: { revalidate: 86400 } }
    );

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub contributions: ${response.status}`);
    }

    const data: GitHubContributionResponse = await response.json();

    const contributions: ContributionDay[] = data.contributions.map((c) => ({
      date: c.date,
      count: c.count,
    }));

    const total = Object.values(data.total).reduce((sum, count) => sum + count, 0);

    return { contributions, total };
  } catch (error) {
    console.error("Error fetching GitHub contributions:", error);
    return { contributions: [], total: 0 };
  }
}

export function getContributionLevel(count: number): number {
  if (count === 0) return 0;
  if (count <= 3) return 1;
  if (count <= 6) return 2;
  if (count <= 9) return 3;
  return 4;
}
