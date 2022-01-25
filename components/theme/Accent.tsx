import React from 'react'
import { IconButton, IconButtonProps, Icon } from '@chakra-ui/react'
import { theme, ColorKeys, useLinkColor, accentKeys } from 'components/theme'
import { useLocalSetting } from 'components/hooks/useLocalSetting'
import { css, Global } from '@emotion/react'
import { getTagBackgroundDark } from 'components/theme/colors'

export const AccentPickerIcon = ({ ...props }) => {
  const color = useLinkColor()
  return (
    <Icon viewBox="0 0 200 200" boxSize="1.3em" color={color} {...props}>
      <path
        fill="currentColor"
        d="M 100, 100 m -75, 0 a 75,75 0 1,0 150,0 a 75,75 0 1,0 -150,0"
      />
    </Icon>
  )
}

export const AccentPicker: React.FC<IconButtonProps> = ({ ...props }) => {
  const [key, setAccentKey] = useLocalSetting<ColorKeys>(
    'accent',
    'defaultAccent'
  )

  const update = React.useCallback(() => {
    let index = accentKeys.indexOf(key)
    index = (index + 1) % accentKeys.length
    setAccentKey(accentKeys[index])
  }, [key])

  return (
    <IconButton
      icon={<AccentPickerIcon />}
      isRound
      onMouseDown={update}
      {...props}
    />
  )
}

export const AccentGlobal: React.FC = () => {
  const [accentKey] = useLocalSetting<ColorKeys>('accent', 'defaultAccent')
  const accent = theme.colors[accentKey]
  const styles = React.useMemo(
    () => css`
      :root {
        --colors-accent-50: ${accent[50]};
        --colors-accent-100: ${accent[100]};
        --colors-accent-200: ${accent[200]};
        --colors-accent-300: ${accent[300]};
        --colors-accent-400: ${accent[400]};
        --colors-accent-500: ${accent[500]};
        --colors-accent-600: ${accent[600]};
        --colors-accent-700: ${accent[700]};
        --colors-accent-800: ${accent[800]};
        --colors-accent-900: ${accent[900]};
        --colors-accent-tag-bg-dark: ${getTagBackgroundDark(accentKey, theme)};
      }
    `,
    [accentKey]
  )
  return <Global styles={styles} />
}
