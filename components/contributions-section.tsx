import { siteConfig, ContributionDay } from "@/content/site";
import { fetchGitHubContributions } from "@/lib/github";
import { ContributionGraph } from "./contribution-graph";
import { Panel } from "./panel";
import cursorData from "@/content/cursor-contributions.json";

async function getGitHubData() {
  const { contributions, total } = await fetchGitHubContributions(
    siteConfig.github.username
  );
  return { contributions, total };
}

function getCursorData(): { contributions: ContributionDay[]; total: number } {
  const contributions = (cursorData.contributions || []) as ContributionDay[];
  const total = contributions.reduce((sum, c) => sum + c.count, 0);
  return { contributions, total };
}

export async function ContributionsSection() {
  const githubData = await getGitHubData();
  const cursorContributions = getCursorData();

  const cursorIsEmpty = cursorContributions.contributions.length === 0;

  return (
    <>
      <Panel className="screen-line-top-none">
        <h2 className="sr-only">GitHub Contributions</h2>
        <ContributionGraph
          contributions={githubData.contributions}
          total={githubData.total}
          label="GitHub"
          source="GitHub"
          sourceUrl={`https://github.com/${siteConfig.github.username}`}
          figureNumber={2}
          isEmpty={githubData.contributions.length === 0}
        />
      </Panel>

      <Panel className="screen-line-top-none">
        <h2 className="sr-only">Cursor Contributions</h2>
        <ContributionGraph
          contributions={cursorContributions.contributions}
          total={cursorContributions.total}
          label="Cursor"
          source="Cursor"
          figureNumber={3}
          isEmpty={cursorIsEmpty}
        />
      </Panel>
    </>
  );
}
