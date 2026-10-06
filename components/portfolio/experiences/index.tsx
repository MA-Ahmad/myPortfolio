import { useState } from 'react';
import { ChevronDownIcon } from 'lucide-react';
import { EXPERIENCES, ExperienceItemData } from 'data/profile';
import { Panel, PanelHeader, PanelTitle } from '../panel';
import { ExperienceItem } from './experience-item';

const ID = 'experience';
const MAX = 3;

export function Experiences() {
  const [open, setOpen] = useState(false);
  const visible = open ? EXPERIENCES : EXPERIENCES.slice(0, MAX);

  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`} className="text-foreground no-underline">
            Experience
          </a>
        </PanelTitle>
      </PanelHeader>

      <div className="px-4">
        <ExperienceList experiences={visible} />
      </div>

      {EXPERIENCES.length > MAX ? (
        <div className="-mt-px flex items-center justify-center py-4">
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

function ExperienceList({ experiences }: { experiences: ExperienceItemData[] }) {
  return (
    <>
      {experiences.map((experience) => (
        <ExperienceItem key={experience.id} experience={experience} />
      ))}
    </>
  );
}
