import * as React from 'react'
import { Box, Stack, Skeleton, VStack, HStack, Divider } from '@chakra-ui/react'

const ListSkeleton = () => {
  const list: number[] = [1, 2, 3, 4, 5]

  return (
    <>
      {list.map((id) => {
        return (
          <VStack spacing={4} align="left" mx={[0, 0, 6]} mt={8} key={id}>
            <Stack isInline justifyContent="space-between" py={2} px={[2, 3]}>
              <Box width="100%">
                <HStack isInline justifyContent="space-between">
                  <Skeleton height="14px" width="55%" />
                </HStack>
                <VStack align="start" marginTop={2}>
                  <Skeleton height="8px" width="35%" />
                </VStack>
                <VStack marginTop={2} ml={7} align="left" spacing={2}>
                  <Skeleton height="8px" width="40%" />
                  <Skeleton height="8px" width="40%" />
                  <Skeleton height="8px" width="40%" />
                </VStack>
              </Box>
            </Stack>
            <Divider />
          </VStack>
        )
      })}
    </>
  )
}

export default ListSkeleton
