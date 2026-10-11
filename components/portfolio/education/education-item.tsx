import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { ChevronsUpDownIcon, GraduationCapIcon, InfinityIcon } from 'lucide-react';
import { EducationItemData } from 'data/profile';
import { IconTile } from '../icon-tile';
import { Tag } from '../tag';
import { VerticalDivider } from '../separator';

export function EducationItem({ item }: { item: EducationItemData }) {
  const { start, end } = item.period;
  const isOngoing = !end;

  return (
    <div className="group/education-item relative before:absolute before:left-3 before:h-full before:w-px before:bg-border">
      <div
        className="pointer-events-none absolute bottom-0 left-3 hidden size-4 bg-background group-last/education-item:flex"
        aria-hidden
      >
        <span className="size-full -translate-y-2 rounded-bl-sm border-b border-l border-line" />
      </div>

      <Disclosure defaultOpen={item.isExpanded && Boolean(item.description)}>
        <DisclosureButton
          disabled={!item.description}
          className="group block w-full text-left outline-none disabled:cursor-default"
        >
          <div className="relative z-[1] mb-1 flex items-start gap-3 text-base">
            <IconTile>
              <GraduationCapIcon />
            </IconTile>
            <h3 className="flex-1 font-medium text-balance">{item.school}</h3>
            {item.description ? (
              <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
            ) : null}
          </div>

          <dl className="flex min-w-0 flex-wrap items-center gap-x-2 pl-9 text-sm text-muted-foreground">
            <div>
              <dt className="sr-only">Study period</dt>
              <dd className="flex items-center gap-0.5 tabular-nums">
                <span>{start}</span>
                <span className="font-mono">—</span>
                {isOngoing ? (
                  <InfinityIcon className="size-4" aria-label="Present" strokeWidth={1.5} />
                ) : (
                  <span>{end}</span>
                )}
              </dd>
            </div>
            {item.degree ? (
              <>
                <VerticalDivider />
                <div className="min-w-0">
                  <dt className="sr-only">Degree</dt>
                  <dd className="text-pretty">{item.degree}</dd>
                </div>
              </>
            ) : null}
          </dl>
        </DisclosureButton>

        {item.description ? (
          <DisclosurePanel className="overflow-hidden">
            <div className="min-w-0 whitespace-pre-wrap break-words pt-3 pb-1 pl-9 text-sm text-muted-foreground">
              {item.description.replace(/\*\*/g, '')}
            </div>
          </DisclosurePanel>
        ) : null}
      </Disclosure>

      {item.skills?.length ? (
        <ul className="flex flex-wrap gap-1.5 pt-3 pl-9">
          {item.skills.map((skill) => (
            <li key={skill} className="flex">
              <Tag>{skill}</Tag>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
