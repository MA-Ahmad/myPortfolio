import { GetStaticPaths, GetStaticProps } from 'next';
import NextLink from 'next/link';
import { ArrowLeftIcon, ArrowRightIcon } from 'lucide-react';
import PageLayout from 'components/layouts/pageLayout';
import { BlockViewer } from 'components/blocks/block-viewer';
import {
  BLOCKS,
  type BlockCategory,
  type BlockMeta,
  blockHref,
  getBlock,
  getBlocks,
  getCategory
} from 'blocks/registry';
import { type BlockFile, getBlockFiles } from 'lib/block-source';
import { SITE_URL } from 'data/constants';

type Props = {
  block: BlockMeta;
  category: BlockCategory;
  files: BlockFile[];
  previous: BlockMeta | null;
  next: BlockMeta | null;
};

const navButton =
  'inline-flex size-7 items-center justify-center rounded-md bg-muted text-muted-foreground no-underline transition-[color,transform] duration-150 ease-out hover:text-foreground active:scale-[0.94]';

export default function BlockPage({ block, category, files, previous, next }: Props) {
  return (
    <PageLayout
      title={`${block.title} - Blocks`}
      description={block.description}
      image={block.images ? `${SITE_URL}${block.images.og}` : undefined}
      imageAlt={block.images?.alt}
      animate={false}
    >
      <div className="pt-12">
        <div className="px-4 pb-2 text-sm font-medium tracking-wider text-muted-foreground">
          {category.title}
        </div>
        <h1 className="screen-line-top screen-line-bottom -translate-x-px px-4 text-4xl font-medium tracking-tight text-balance">
          {block.title}
        </h1>
      </div>

      <div className="h-4" />
      <div className="screen-line-bottom h-px" />

      <div className="flex items-center justify-between gap-4 p-2 pl-4">
        <NextLink
          href={`/blocks/${category.name}`}
          className="inline-flex h-7 items-center gap-2 text-sm text-muted-foreground no-underline transition-colors duration-150 hover:text-foreground"
        >
          <ArrowLeftIcon className="size-4" />
          {category.title}
        </NextLink>

        <div className="flex items-center gap-2">
          {previous && (
            <NextLink href={blockHref(previous)} aria-label={`Previous block: ${previous.title}`} title={previous.title} className={navButton}>
              <ArrowLeftIcon className="size-4" />
            </NextLink>
          )}
          {next && (
            <NextLink href={blockHref(next)} aria-label={`Next block: ${next.title}`} title={next.title} className={navButton}>
              <ArrowRightIcon className="size-4" />
            </NextLink>
          )}
        </div>
      </div>

      <div className="screen-line-top h-px" />

      <BlockViewer key={block.name} block={block} files={files} />

      <div className="screen-line-bottom h-4" />
    </PageLayout>
  );
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: BLOCKS.map((block) => ({ params: { category: block.category, name: block.name } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const block = getBlock(String(params?.name));
  const category = block && getCategory(block.category);
  if (!block || !category || block.category !== params?.category) return { notFound: true };

  const ordered = getBlocks();
  const index = ordered.findIndex((item) => item.name === block.name);
  const files = await getBlockFiles(block);

  return {
    props: {
      block,
      category,
      files,
      previous: ordered[index - 1] ?? null,
      next: ordered[index + 1] ?? null
    }
  };
};
