import { EDUCATION } from 'data/profile';
import { Panel, PanelHeader, PanelTitle } from '../panel';
import { EducationItem } from './education-item';

const ID = 'education';

export function Education() {
  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`} className="text-foreground no-underline">
            Education
          </a>
        </PanelTitle>
      </PanelHeader>
      <div className="space-y-4 px-4 py-4">
        {EDUCATION.map((item) => (
          <EducationItem key={item.id} item={item} />
        ))}
      </div>
    </Panel>
  );
}
