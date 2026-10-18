import { format, parseISO } from 'date-fns';
import { Activity } from 'lib/github-contributions';
import { PROFILE } from 'data/profile';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from 'components/ui/tooltip';
import {
  ContributionGraph,
  ContributionGraphBlock,
  ContributionGraphCalendar,
  ContributionGraphFooter,
  ContributionGraphLegend,
  ContributionGraphTotalCount
} from './contribution-graph';

export function GitHubContributionGraph({ contributions }: { contributions: Activity[] }) {
  if (contributions.length === 0) {
    return null;
  }

  return (
    <TooltipProvider>
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
            className="px-4 [&_[data-slot=month-labels]]:text-muted-foreground"
            aria-hidden
          >
            {({ activity, dayIndex, weekIndex }) => (
              <Tooltip>
                <TooltipTrigger
                  render={
                    <g>
                      <ContributionGraphBlock
                        activity={activity}
                        dayIndex={dayIndex}
                        weekIndex={weekIndex}
                      />
                    </g>
                  }
                />
                <TooltipContent className="font-sans">
                  <p>
                    {activity.count} contribution{activity.count > 1 ? 's' : null} on{' '}
                    {format(parseISO(activity.date), 'd MMM yyyy')}
                  </p>
                </TooltipContent>
              </Tooltip>
            )}
          </ContributionGraphCalendar>

          <ContributionGraphFooter className="px-4 text-sm">
            <ContributionGraphTotalCount>
              {({ totalCount }) => (
                <figcaption className="text-pretty tabular-nums">
                  {totalCount.toLocaleString('en-US')} contributions,{' '}
                  {format(parseISO(contributions[0].date), 'd MMM yyyy')} –{' '}
                  {format(parseISO(contributions[contributions.length - 1].date), 'd MMM yyyy')}.
                  Source:{' '}
                  <a
                    href={PROFILE.githubUrl}
                    className="link-underline font-normal text-foreground hover:text-foreground"
                    target="_blank"
                    rel="noopener"
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
    </TooltipProvider>
  );
}
