import React from 'react';
import { ColorKeys, getTagBackgroundDark } from '../theme/colors';
import { cn } from 'lib/cn';

export interface TagProps {
  name: string;
  interactive?: boolean;
  colorScheme?: ColorKeys | 'accent';
  className?: string;
}

export function useTagStyles(colorScheme: ColorKeys | 'accent' = 'accent') {
  if (colorScheme === 'accent') {
    return {
      backgroundColor: 'var(--colors-accent-100)',
      color: 'var(--colors-accent-800)'
    };
  }

  return {
    backgroundColor: getTagBackgroundDark(colorScheme),
    color: undefined
  };
}

export const Tag: React.FC<TagProps> = ({
  colorScheme = 'accent',
  name,
  className
}) => {
  return (
    <span
      className={cn(
        'm-0.5 inline-flex items-center rounded-lg px-2 py-0.5 align-middle text-sm dark:text-[var(--colors-accent-200)]',
        colorScheme === 'accent' &&
          'bg-[var(--colors-accent-100)] text-[var(--colors-accent-800)] dark:bg-[var(--colors-accent-tag-bg-dark)]',
        className
      )}
    >
      {name}
    </span>
  );
};

export interface TagsProps {
  interactive?: boolean;
  tags?: string[];
  tagProps?: Partial<TagProps>;
  className?: string;
}

export const Tags: React.FC<TagsProps> = ({
  tags,
  interactive = true,
  tagProps = {},
  className
}) => {
  if (!tags || tags.length === 0) {
    return null;
  }
  return (
    <div className={cn('-m-0.5 flex flex-wrap items-center', className)}>
      {tags.map((tag) => (
        <Tag key={tag} name={tag} interactive={interactive} {...tagProps} />
      ))}
    </div>
  );
};
