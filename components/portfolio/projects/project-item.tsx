import { Disclosure, DisclosureButton, DisclosurePanel } from '@headlessui/react';
import { BoxIcon, ChevronsUpDownIcon, LinkIcon } from 'lucide-react';
import { ProjectItemData } from 'data/profile';
import { Tooltip } from 'components/shared/tooltip';
import { IconTile } from '../icon-tile';
import { Tag } from '../tag';

export function ProjectItem({ project }: { project: ProjectItemData }) {
  return (
    <Disclosure>
      <div className="relative flex items-center hover:bg-muted/60">
        <IconTile className="mx-4">
          <BoxIcon />
        </IconTile>

        <div className="flex flex-1 items-center gap-2 border-l border-dashed border-line p-4">
          <div className="min-w-0 flex-1">
            <h3 className="mb-1 leading-snug font-medium text-balance">
              <DisclosureButton className="text-left">
                <span className="absolute inset-0" aria-hidden />
                {project.title}
              </DisclosureButton>
            </h3>
          </div>

          {project.link ? (
            <Tooltip label="Open project">
              <a
                className="relative z-[1] flex size-6 shrink-0 items-center justify-center text-muted-foreground no-underline hover:text-foreground"
                href={project.link}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Open project"
              >
                <LinkIcon className="size-4" />
              </a>
            </Tooltip>
          ) : null}

          <ChevronsUpDownIcon className="size-4 shrink-0 text-muted-foreground" />
        </div>
      </div>

      <DisclosurePanel className="overflow-hidden">
        <div className="space-y-4 border-t border-line p-4">
          {project.description ? (
            <p className="text-sm text-muted-foreground">{project.description}</p>
          ) : null}
          {project.skills.length > 0 ? (
            <ul className="flex flex-wrap gap-1.5">
              {project.skills.map((skill) => (
                <li key={skill} className="flex">
                  <Tag>{skill}</Tag>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </DisclosurePanel>
    </Disclosure>
  );
}
