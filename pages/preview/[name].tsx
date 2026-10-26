import { ReactElement } from 'react';
import { GetStaticPaths, GetStaticProps } from 'next';
import Meta from 'components/shared/meta';
import { BLOCKS, getBlock } from 'blocks/registry';
import { BLOCK_COMPONENTS } from 'blocks/components';
import type { NextPageWithLayout } from '../_app';

type Props = { name: string; title: string };

/** A block on its own, loaded by the block viewer's iframe and its "Open in new tab" button. */
const BlockPreview: NextPageWithLayout<Props> = ({ name, title }) => {
  const Block = BLOCK_COMPONENTS[name];

  return (
    <>
      <Meta title={`${title} - Preview`} noindex />
      <div className="min-h-screen bg-background text-foreground">
        {/* The block viewer measures this to fit the iframe to the block (`fitContent`). */}
        <div data-block-root>{Block ? <Block /> : null}</div>
      </div>
    </>
  );
};

BlockPreview.getLayout = (page: ReactElement) => page;

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: BLOCKS.map((block) => ({ params: { name: block.name } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const block = getBlock(String(params?.name));
  return block ? { props: { name: block.name, title: block.title } } : { notFound: true };
};

export default BlockPreview;
