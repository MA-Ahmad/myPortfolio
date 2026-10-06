import React, { ReactNode } from 'react';
import { FiCheckCircle } from 'react-icons/fi';
import { IconType } from 'react-icons';
import { cn } from 'lib/cn';

export interface TimelineItemProps {
  icon?: IconType;
  skipTrail?: boolean;
  children?: ReactNode;
  className?: string;
}

export const TimelineItem: React.FC<TimelineItemProps> = ({
  icon: Icon = FiCheckCircle,
  skipTrail = false,
  children,
  className
}) => {
  return (
    <div className={cn('flex min-h-20', className)}>
      <div className="relative mr-4 flex flex-col items-center">
        <div className="h-12 w-12 rounded-full bg-gray-600 opacity-[0.07] dark:bg-gray-500 dark:opacity-[0.15]" />
        <Icon className="absolute left-[0.875rem] top-[0.875rem] text-gray-700 dark:text-gray-500" size="1.25rem" />
        {!skipTrail && <div className="my-1 w-px flex-1 bg-gray-700 dark:bg-gray-500" />}
      </div>
      <div className="pt-3">{children}</div>
    </div>
  );
};
