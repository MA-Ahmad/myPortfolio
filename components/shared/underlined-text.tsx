import { PropsWithChildren } from 'react';
import { Box } from '@chakra-ui/react';

interface Props {
  color: string;
  h?: string;
  zIndex?: number;
}
const UnderlinedText = (props: PropsWithChildren<Props>) => (
  <Box as="span" display="inline-block" position="relative">
    {props.children}
    <Box as="span" display="block" position="absolute" bg={'gray.200'} w={'100%'} h={props.h || '1px'} bottom={-2} />
  </Box>
);
export default UnderlinedText;
