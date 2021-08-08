import { Flex, Link, Text, Icon, Box } from "@chakra-ui/react";
import { FaDev } from "react-icons/fa";

interface IProps {
  href: string;
}

const DevToCallToAction = ({ href }: IProps): JSX.Element => (
  <Flex justifyContent="center" marginTop="7">
    <Box>
      <Text marginBottom="2" fontSize="2xl" fontWeight="400">
        React, comment and follow on
      </Text>
      <Link href={href} isExternal>
        <Icon as={FaDev} w={12} h={12} />
      </Link>
    </Box>
  </Flex>
);

export default DevToCallToAction;
