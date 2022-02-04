import * as React from 'react';
import { Box, Stack, Skeleton, VStack, HStack, useColorModeValue } from '@chakra-ui/react';

const CardSkeleton = () => {
  const bgColor = useColorModeValue('white', 'gray.900');
  const cards: number[] = [1, 2, 3, 4, 5, 6, 7, 8];
  // --downlevelIteration
  // [...Array(10).keys()]
  return (
    <>
      {cards.map((id) => {
        return (
          <Box key={id} size="xl" py={2} rounded="xl" borderWidth="1px" bg={bgColor}>
            <Stack isInline justifyContent="space-between" py={2} px={[2, 3]}>
              <Box width="100%">
                <HStack isInline justifyContent="space-between">
                  <Skeleton height="14px" width="40%" />
                  <Skeleton height="14px" width="20%" />
                </HStack>
                <VStack align="start" marginTop={2}>
                  <Skeleton height="8px" width="30%" />
                </VStack>
                <Box marginTop={2}>
                  <Skeleton height="8px" width="100%" />
                  <Stack spacing={2} mt={1} isInline alignItems="center">
                    <Skeleton height="8px" width="80%" />
                  </Stack>
                </Box>
              </Box>
            </Stack>
          </Box>
        );
      })}
    </>
  );
};

export default CardSkeleton;
