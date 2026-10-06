import { differenceInMonths, parse } from 'date-fns';
import { BriefcaseBusinessIcon, InfinityIcon } from 'lucide-react';
import { ExperienceItemData } from 'data/profile';
import { IconTile } from '../icon-tile';
import { Tag } from '../tag';
import { VerticalDivider } from '../separator';

type Position = ExperienceItemData['positions'][number];

export function ExperiencePositionItem({ position }: { position: Position }) {
  const { start, end } = position.employmentPeriod;
  const isOngoing = !end;
  const duration = formatDuration(start, end);

  return (
    <div className="group/experience-position relative">
      <div className="pointer-events-none absolute bottom-0 left-3 hidden size-4 bg-background group-last/experience-position:flex">
        <span className="size-full -translate-y-2 rounded-bl-sm border-b border-l border-line" />
      </div>

      <div className="relative z-[1] mb-1 flex items-start gap-3 text-base">
        <IconTile>
          <BriefcaseBusinessIcon />
        </IconTile>
        <h4 className="flex-1 font-medium text-balance">{position.title}</h4>
      </div>

      <dl className="flex items-center gap-2 pl-9 text-sm text-muted-foreground">
        <div>
          <dt className="sr-only">Employment Period</dt>
          <dd className="flex items-center gap-0.5 tabular-nums">
            <span>{start}</span>
            <span className="font-mono">—</span>
            {isOngoing ? (
              <InfinityIcon
                className="size-4 translate-y-px"
                aria-label="Present"
                strokeWidth={1.5}
              />
            ) : (
              <span>{end}</span>
            )}
          </dd>
        </div>
        {duration ? (
          <>
            <VerticalDivider />
            <div>
              <dt className="sr-only">Duration</dt>
              <dd className="tabular-nums">{duration}</dd>
            </div>
          </>
        ) : null}
      </dl>

      {position.skills?.length ? (
        <ul className="flex flex-wrap gap-1.5 pt-3 pl-9">
          {position.skills.map((skill) => (
            <li key={skill} className="flex">
              <Tag>{skill}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function formatDuration(start: string, end?: string): string {
  const startHasMonth = start.includes('.');
  const endHasMonth = end ? end.includes('.') : true;

  if (!startHasMonth && end && !endHasMonth) {
    const years = parseInt(end, 10) - parseInt(start, 10);
    return years > 0 ? `${years}y` : '';
  }

  const startDate = parsePeriodDate(start, 'first');
  const endDate = end ? parsePeriodDate(end, 'last') : new Date();
  const totalMonths = differenceInMonths(endDate, startDate) + 1;
  if (totalMonths <= 0) {
    return '';
  }
  if (totalMonths < 12) {
    return `${totalMonths}m`;
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  return months === 0 ? `${years}y` : `${years}y ${months}m`;
}

function parsePeriodDate(str: string, fallbackMonth: 'first' | 'last'): Date {
  if (str.includes('.')) {
    return parse(str, 'MM.yyyy', new Date());
  }
  return parse(
    `${fallbackMonth === 'last' ? '12' : '01'}.${str}`,
    'MM.yyyy',
    new Date()
  );
}
