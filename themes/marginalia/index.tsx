import type { ThemeHomeProps } from 'themes/registry';
import { Marginalia } from './components/paragraph';

export { MarginaliaLayout } from './components/marginalia-layout';

/** The whole site is one paragraph; its underlined words open notes in the margins. */
export function MarginaliaHome(props: ThemeHomeProps) {
  return <Marginalia {...props} />;
}
