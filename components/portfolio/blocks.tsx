import NextLink from 'next/link';
import { ArrowRightIcon } from 'lucide-react';
import { BLOCKS, getBlocks } from 'blocks/registry';
import { BlockItem } from 'components/blocks/block-list';
import { Panel, PanelHeader, PanelTitle, PanelTitleSup } from './panel';

const ID = 'blocks';
const MAX = 4;

/** The newest blocks, two to a row, with a link to all of them. */
export function Blocks() {
  const blocks = getBlocks().slice(0, MAX);
  if (!blocks.length) return null;

  return (
    <Panel id={ID}>
      <PanelHeader>
        <PanelTitle>
          <a href={`#${ID}`} className="text-foreground no-underline">
            Blocks
          </a>
          <PanelTitleSup>({BLOCKS.length})</PanelTitleSup>
        </PanelTitle>
      </PanelHeader>

      <div className="relative">
        <div className="pointer-events-none absolute inset-0 -z-[1] hidden grid-cols-2 gap-4 sm:grid">
          <div className="border-r border-line" />
          <div className="border-l border-line" />
        </div>

        <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {blocks.map((block) => (
            <li key={block.name} className="border-b border-line">
              <BlockItem block={block} heading="h3" />
            </li>
          ))}
          {/* An odd last row keeps its shape. */}
          {blocks.length % 2 ? <li className="diagonal-stripes hidden border-b border-line sm:block" aria-hidden /> : null}
        </ul>
      </div>

      <div className="flex items-center justify-center py-4">
        <NextLink
          href="/blocks"
          className="inline-flex items-center gap-2 rounded-md border border-line bg-muted px-3 py-1.5 text-sm text-foreground no-underline shadow-[inset_0_0_1px] shadow-foreground/20"
        >
          <span>All blocks</span>
          <ArrowRightIcon size={16} />
        </NextLink>
      </div>
    </Panel>
  );
}
