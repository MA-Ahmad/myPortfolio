import { Activity } from 'lib/github-contributions';
import { Panel } from '../panel';
import { GitHubContributionGraph } from './graph';

export function GitHubContributions({
  contributions
}: {
  contributions: Activity[];
}) {
  if (!contributions?.length) {
    return null;
  }

  return (
    <Panel className="screen-line-top-border">
      <h2 className="sr-only">GitHub contributions</h2>
      <GitHubContributionGraph contributions={contributions} />
    </Panel>
  );
}
