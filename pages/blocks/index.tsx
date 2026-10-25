import { BlocksPage } from 'components/blocks/blocks-page';
import { getBlocks } from 'blocks/registry';

export default function Blocks() {
  return <BlocksPage blocks={getBlocks()} />;
}
