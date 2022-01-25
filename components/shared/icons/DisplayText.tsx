import { Text, useColorModeValue, Spinner } from '@chakra-ui/react'
import { useLinkColor } from 'components/theme'

interface DisplayTextProps {
  isLoading: boolean
  value: number
}

const DisplayText: React.SFC<DisplayTextProps> = ({ isLoading, value }) => {
  const linkColor = useLinkColor()
  const textColor = useColorModeValue('gray.500', 'gray.200')

  return (
    <>
      {isLoading ? (
        <Spinner
          size="xs"
          speed="0.65s"
          emptyColor="gray.200"
          color={linkColor}
        />
      ) : (
        <Text
          fontSize="sm"
          noOfLines={1}
          fontWeight="400"
          align="left"
          color={textColor}
        >
          {value}
        </Text>
      )}
    </>
  )
}

export default DisplayText
