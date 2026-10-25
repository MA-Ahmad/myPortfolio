import { GetStaticPaths, GetStaticProps } from 'next';
import { BlocksPage } from 'components/blocks/blocks-page';
import { type BlockCategory, getBlocks, getUsedCategories } from 'blocks/registry';

type Props = { category: BlockCategory };

export default function BlockCategoryPage({ category }: Props) {
  return <BlocksPage blocks={getBlocks(category.name)} category={category} />;
}

export const getStaticPaths: GetStaticPaths = async () => ({
  paths: getUsedCategories().map((category) => ({ params: { category: category.name } })),
  fallback: false
});

export const getStaticProps: GetStaticProps<Props> = async ({ params }) => {
  const category = getUsedCategories().find((item) => item.name === params?.category);
  return category ? { props: { category } } : { notFound: true };
};
