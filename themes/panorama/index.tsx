import { useMemo } from 'react';
import type { ThemeHomeProps } from 'themes/registry';
import { SECTIONS } from './content';
import { BlocksPane, IntroPane, WorkPane, WritingPane } from './components/panes';
import { Sections } from './components/sections';
import { tornBackdrop } from './torn/backdrop';
import type { WeldKind } from './torn/welds';

export { PanoramaLayout } from './components/panorama-layout';

export function PanoramaHome({ contributions, posts, weld }: ThemeHomeProps & { weld?: WeldKind }) {
  const bodies = {
    intro: <IntroPane contributions={contributions} />,
    work: <WorkPane />,
    writing: <WritingPane posts={posts} />,
    blocks: <BlocksPane />
  };
  const art = useMemo(() => tornBackdrop(weld), [weld]);
  return (
    <Sections
      sections={SECTIONS.map((section) => ({ ...section, body: bodies[section.id] }))}
      backdrop={art}
    />
  );
}
