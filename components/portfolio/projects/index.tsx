import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { PROJECTS } from 'data/profile';
import { Panel, PanelHeader, PanelTitle, PanelTitleSup } from '../panel';
import { ProjectItem } from './project-item';

const ID = 'projects';
const MAX = 3;

export function Projects() {
  const [open, setOpen] = useState(false);
  const visible = open ? PROJECTS : PROJECTS.slice(0, MAX);

  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`} className="text-foreground no-underline">
            Projects
          </a>
          <PanelTitleSup>({PROJECTS.length})</PanelTitleSup>
        </PanelTitle>
      </PanelHeader>

      <ul>
        {visible.map((project) => (
          <li key={project.id} className="border-b border-line last:border-b-0">
            <ProjectItem project={project} />
          </li>
        ))}
      </ul>

      {PROJECTS.length > MAX ? (
        <div className="screen-line-top flex items-center justify-center py-4">
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className="inline-flex items-center gap-2 rounded-md border border-line bg-muted px-3 py-1.5 text-sm shadow-[inset_0_0_1px] shadow-foreground/20"
          >
            <span>{open ? 'Show less' : 'Show more'}</span>
            <ChevronDownIcon className={open ? 'rotate-180' : undefined} size={16} />
          </button>
        </div>
      ) : null}
    </Panel>
  );
}
