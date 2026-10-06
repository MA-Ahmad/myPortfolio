import React, { ReactNode } from 'react';
import { Popover, PopoverButton, PopoverPanel } from '@headlessui/react';
import { FiCheckCircle } from 'react-icons/fi';
import { IconType } from 'react-icons';

export interface StoryTimelineProps {
  icon?: IconType;
  skipTrail?: boolean;
  index: number;
  year?: string;
  children?: ReactNode;
}

export const StoryTimeline: React.FC<StoryTimelineProps> = ({
  icon: Icon = FiCheckCircle,
  index,
  year,
  skipTrail = false,
  children
}) => {
  return (
    <div className="flex min-h-20">
      <div className="mr-4 flex min-h-[8rem] flex-col items-center">
        <Popover className="relative">
          <PopoverButton className="relative outline-none">
            <div className="h-12 w-12 rounded-full bg-gray-600 opacity-[0.07] dark:bg-gray-500 dark:opacity-[0.15]" />
            {year ? (
              <div className="absolute left-2 top-[0.875rem] text-[15px] font-bold text-gray-700 dark:text-gray-200">
                {year}
              </div>
            ) : (
              <Icon className="absolute left-[0.875rem] top-[0.875rem] text-gray-700 dark:text-gray-200" size="1.25rem" />
            )}
          </PopoverButton>
          {!year && (
            <PopoverPanel
              anchor={index % 2 === 0 ? 'right' : 'left'}
              className="z-10 rounded-md bg-white p-1 shadow-lg dark:bg-gray-800 sm:p-3"
            >
              <div className="overflow-scroll">{children}</div>
            </PopoverPanel>
          )}
        </Popover>
        {!skipTrail && <div className="w-px flex-1 bg-gray-700 dark:bg-gray-200" />}
      </div>
    </div>
  );
};
