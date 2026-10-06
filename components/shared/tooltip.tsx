import * as TooltipPrimitive from '@radix-ui/react-tooltip';
import { ReactNode } from 'react';

interface TooltipProps {
  label: string;
  children: ReactNode;
  placement?: 'top' | 'right' | 'bottom' | 'left';
}

export const Tooltip = ({ label, children, placement = 'top' }: TooltipProps) => {
  return (
    <TooltipPrimitive.Root>
      <TooltipPrimitive.Trigger asChild>{children}</TooltipPrimitive.Trigger>
      <TooltipPrimitive.Portal>
        <TooltipPrimitive.Content
          side={placement}
          className="z-[1800] rounded-md bg-gray-800 px-2 py-1 text-xs text-white shadow-md"
        >
          {label}
          <TooltipPrimitive.Arrow className="fill-gray-800" />
        </TooltipPrimitive.Content>
      </TooltipPrimitive.Portal>
    </TooltipPrimitive.Root>
  );
};
