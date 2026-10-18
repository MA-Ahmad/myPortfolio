export { useLinkColor, useHoverLinkColor } from './colors'
export type { ColorKeys } from './colors'

export const getTagColor = (type) => {
  type = type.toLowerCase()
  if (type === 'rails' || type === 'ruby') {
    return 'red'
  } else if (type === 'react') {
    return 'cyan'
  } else if (type === 'javascript') {
    return 'yellow'
  } else if (type === 'typescript' || type === 'tailwindcss') {
    return 'blue'
  } else if (type === 'chakraui' || type === 'css') {
    return 'teal'
  }
}

const tagColorClasses: Record<string, string> = {
  red: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-200',
  cyan: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-200',
  yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-200',
  blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-200',
  teal: 'bg-teal-100 text-teal-800 dark:bg-teal-900/30 dark:text-teal-200'
}

export const getTagClasses = (type?: string) => {
  if (!type) {
    return 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
  }
  const color = getTagColor(type)
  return tagColorClasses[color] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200'
}
