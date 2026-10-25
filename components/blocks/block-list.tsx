import NextLink from 'next/link';
import { type BlockMeta, blockHref } from 'blocks/registry';
import { BlockThumbnail } from './block-thumbnail';

function BlockItem({ block }: { block: BlockMeta }) {
  return (
    <div className="group/block relative flex h-full flex-col gap-2 p-2 transition-[background-color] duration-150 ease-out hover:bg-accent-muted">
      <div className="relative">
        <BlockThumbnail name={block.name} className="rounded-xl" />
        <div className="pointer-events-none absolute inset-0 rounded-xl ring-1 ring-inset ring-black/15 dark:ring-white/15" />
      </div>

      <div className="flex flex-col gap-1 p-2">
        <h2 className="text-lg font-medium leading-snug text-balance">
          <NextLink href={blockHref(block)} className="text-foreground no-underline">
            <span className="absolute inset-0" aria-hidden />
            {block.title}
          </NextLink>
        </h2>
        <p className="text-sm text-muted-foreground">{block.description}</p>
      </div>
    </div>
  );
}

/** Cards in a 1/2/3 column grid, each framed by the page's full-width lines. */
export function BlockList({ blocks }: { blocks: BlockMeta[] }) {
  return (
    <div className="relative py-4">
      <div className="pointer-events-none absolute inset-0 -z-[1] hidden grid-cols-2 gap-4 sm:grid lg:grid-cols-3">
        <div className="border-r border-line" />
        <div className="border-l border-line lg:border-r" />
        <div className="hidden border-l border-line lg:block" />
      </div>

      <ul className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {blocks.map((block) => (
          // Cards in one row draw the same lines over each other, so every card can carry both.
          <li key={block.name} className="screen-line-top screen-line-bottom">
            <BlockItem block={block} />
          </li>
        ))}

        {blocks.length === 0 && (
          <li className="screen-line-top screen-line-bottom p-4 sm:col-span-2 lg:col-span-3">
            <p className="font-mono text-sm text-muted-foreground">No blocks yet.</p>
          </li>
        )}
      </ul>
    </div>
  );
}
