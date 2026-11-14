import type { ThemeHomeProps } from 'themes/registry';
import { Relay } from './components/relay';

export { RelayLayout } from './components/relay-layout';

/** Six sections on one blue sheet: picking one relays a packet to the card and fans out to its border. */
export function RelayHome(props: ThemeHomeProps) {
  return <Relay {...props} />;
}
