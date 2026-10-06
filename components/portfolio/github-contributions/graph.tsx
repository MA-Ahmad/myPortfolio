import { format, parseISO } from 'date-fns';
import { Activity } from 'lib/github-contributions';
import { PROFILE } from 'data/profile';
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount
} from './contribution-graph';

export function GitHubContributionGraph({
  contributions
}: {
  contributions: Activity[];
}) {
  if (contributions.length === 0) {
    return null;
  }

  return (
    <figure>
      <ContributionGraph
        className="mx-auto gap-4 py-4"
        data={contributions}
        blockSize={12}
        blockMargin={2}
        blockRadius={0}
        aria-label="GitHub Contributions Graph"
      >
        <ContributionGraphCalendar
          className="no-scrollbar px-4 text-muted-foreground"
          title="GitHub Contributions"
          aria-hidden
        >
          {({ activity, dayIndex, weekIndex }) => (
            <g>
              <title>
                {`${activity.count} contribution${activity.count === 1 ? '' : 's'} on ${format(parseISO(activity.date), 'd MMM yyyy')}`}
              </title>
              <ContributionGraphBlock
                activity={activity}
                dayIndex={dayIndex}
                weekIndex={weekIndex}
              />
            </g>
          )}
        </ContributionGraphCalendar>

        <ContributionGraphFooter className="px-4 text-sm">
          <ContributionGraphTotalCount>
            {({ totalCount }) => (
              <figcaption className="text-pretty tabular-nums">
                <span className="mr-2 tracking-wide text-muted-foreground/80">
                  Fig. 2.
                </span>
                {totalCount.toLocaleString('en')} contributions,{' '}
                {format(parseISO(contributions[0].date), 'd MMM yyyy')} –{' '}
                {format(parseISO(contributions[contributions.length - 1].date), 'd MMM yyyy')}
                . Source:{' '}
                <a
                  href={PROFILE.githubUrl}
                  className="link-underline text-foreground"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  GitHub
                </a>
                .
              </figcaption>
            )}
          </ContributionGraphTotalCount>
          <ContributionGraphLegend aria-hidden />
        </ContributionGraphFooter>
      </ContributionGraph>
    </figure>
  );
}
