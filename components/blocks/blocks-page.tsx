import NextLink from 'next/link';
import PageLayout from 'components/layouts/pageLayout';
import { type BlockCategory, type BlockMeta, getUsedCategories } from 'blocks/registry';
import { cn } from 'lib/cn';
import { BlockList } from './block-list';

export const BLOCKS_TITLE = 'Blocks';
export const BLOCKS_TAGLINE = 'Ready-made sections, built for this site.';

function BlocksNav({ active }: { active?: string }) {
  const items = [
    { href: '/blocks', title: 'All', current: !active },
    ...getUsedCategories().map((category) => ({
      href: `/blocks/${category.name}`,
      title: category.title,
      current: category.name === active
    }))
  ];

  return (
    <div className="no-scrollbar overflow-x-auto">
      <nav className="flex w-max items-center whitespace-nowrap">
        {items.map((item) => (
          <NextLink
            key={item.href}
            href={item.href}
            aria-current={item.current ? 'page' : undefined}
            className={cn(
              'border-r border-line p-4 font-mono text-[0.8125rem] font-medium uppercase leading-4 tracking-wide text-muted-foreground no-underline transition-[color,background-color] duration-150 ease-out hover:bg-accent-muted hover:text-foreground',
              item.current && 'bg-accent-muted text-foreground'
            )}
          >
            {item.title}
          </NextLink>
        ))}
      </nav>
    </div>
  );
}

/** The shell shared by /blocks and /blocks/[category]: heading, category tabs, then the grid. */
export function BlocksPage({ blocks, category }: { blocks: BlockMeta[]; category?: BlockCategory }) {
  const title = category ? `${category.title} blocks` : BLOCKS_TITLE;
  const description = category ? category.description : BLOCKS_TAGLINE;

  return (
    <PageLayout title={title} description={description} animate={false}>
      <div className="pt-12">
        <div className="px-4 pb-2 text-sm font-medium tracking-wider text-muted-foreground">
          {category ? category.title : BLOCKS_TITLE}
        </div>
        <h1 className="screen-line-top screen-line-bottom -translate-x-px px-4 text-4xl font-medium tracking-tight text-balance">
          {description}
        </h1>
      </div>

      <div className="h-4" />
      <div className="screen-line-bottom screen-line-bottom-border h-px" />

      <BlocksNav active={category?.name} />

      <div className="screen-line-top screen-line-top-border screen-line-bottom">
        <div className="stripe-divider" />
      </div>

      <BlockList blocks={blocks} />

      <div className="screen-line-bottom h-px" />

      <div className="p-2">
        <div className="relative border border-line p-4">
          <p className="font-mono text-sm text-muted-foreground">More blocks on the way…</p>
          <div className="[&>*]:absolute [&>*]:flex [&>*]:size-2 [&>*]:border [&>*]:border-border [&>*]:bg-background">
            <div className="left-[-4.5px] top-[-4.5px]" />
            <div className="bottom-[-4.5px] left-[-4.5px]" />
            <div className="right-[-4.5px] top-[-4.5px]" />
            <div className="bottom-[-4.5px] right-[-4.5px]" />
          </div>
        </div>
      </div>
    </PageLayout>
  );
}
