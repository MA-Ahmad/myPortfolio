import React from 'react'
import {
  Flex,
  FlexProps,
  Tag as ChakraTag,
  TagProps as ChakraTagProps,
  useColorModeValue,
  useTheme,
} from '@chakra-ui/react'
import { ColorKeys, getTagBackgroundDark } from '../theme/colors'

export interface TagProps extends ChakraTagProps {
  name: string
  interactive?: boolean
  colorScheme?: ColorKeys
}

export function useTagStyles(colorScheme: ColorKeys = 'accent') {
  const theme = useTheme()
  return {
    bg: useColorModeValue(
      `${colorScheme}.100`,
      colorScheme === 'accent'
        ? 'var(--colors-accent-tag-bg-dark)'
        : getTagBackgroundDark(colorScheme, theme)
    ),
    color: useColorModeValue(`${colorScheme}.800`, `${colorScheme}.200`),
  }
}

export const Tag: React.FC<TagProps> = ({
  colorScheme = 'accent',
  name,
  interactive = true,
  ...props
}) => {
  const propsOverride = {
    size: 'sm',
    verticalAlign: 'middle',
    ...useTagStyles(colorScheme),
  }
  if (!interactive) {
    return (
      <ChakraTag {...props} {...propsOverride}>
        {name}
      </ChakraTag>
    )
  }

  return (
    // <RouteLink to={`/posts?tag=${name}`}>
    <ChakraTag {...props} {...propsOverride}>
      {name}
    </ChakraTag>
    // </RouteLink>
  )
}

export interface TagsProps extends FlexProps {
  interactive?: boolean
  tags?: string[]
  tagProps?: Partial<TagProps>
}

export const Tags: React.FC<TagsProps> = ({
  tags,
  interactive = true,
  tagProps = {},
  ...props
}) => {
  if (!tags || tags.length === 0) {
    return null
  }
  return (
    <Flex alignItems="center" flexWrap="wrap" m="-2px" {...props}>
      {tags.map((tag) => (
        <Tag
          key={tag}
          name={tag}
          interactive={interactive}
          m="2px"
          {...tagProps}
        />
      ))}
    </Flex>
  )
}
