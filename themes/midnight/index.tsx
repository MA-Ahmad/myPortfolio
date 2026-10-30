import type { ThemeHomeProps } from 'themes/registry';
import { HomePage } from './components/home-page';
import { SkillsPage } from './components/skills-page';
import { WorkList } from './components/work-list';

export { MidnightLayout } from './components/midnight-layout';

export function MidnightHome({ contributions }: ThemeHomeProps) {
  return <HomePage contributions={contributions} />;
}

export const MidnightWork = WorkList;
export const MidnightSkills = SkillsPage;
