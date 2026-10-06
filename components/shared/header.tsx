import { PropsWithChildren } from 'react';
import UnderlinedText from 'components/shared/underlined-text';
import { cn } from 'lib/cn';

interface Props {
  underlineColor?: string;
  emoji?: string;
  className?: string;
}

const Header = ({
  children,
  underlineColor,
  emoji,
  className
}: PropsWithChildren<Props>) => (
  <h1 className={cn('mb-6 mt-10 text-left text-3xl font-bold leading-tight', className)}>
    <UnderlinedText color={underlineColor}>{children}</UnderlinedText>
    {emoji ? ' ' + emoji : ''}
  </h1>
);
export default Header;
