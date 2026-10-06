import { PropsWithChildren } from 'react';

interface Props {
  color?: string;
  h?: string;
  zIndex?: number;
}

const UnderlinedText = (props: PropsWithChildren<Props>) => (
  <span className="relative inline-block">
    {props.children}
    <span
      className="absolute bottom-[-0.5rem] block w-full bg-gray-200"
      style={{ height: props.h || '1px', zIndex: props.zIndex }}
    />
  </span>
);
export default UnderlinedText;
