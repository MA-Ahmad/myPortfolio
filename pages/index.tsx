import * as React from "react";
import {
  Flex,
  Link,
  IconButton,
  useDisclosure,
  useColorModeValue,
} from "@chakra-ui/react";
import { FaGithub } from "react-icons/fa";
import { ColorModeSwitcher } from '../components/ColorModeSwitcher';

export default function Home() {
  return (
    <Flex alignItems={"center"}>
      <IconButton
        as={Link}
        href={"https://github.com/MA-Ahmad"}
        size={"md"}
        icon={<FaGithub />}
        aria-label={"Github account"}
        bg={useColorModeValue("white", "gray.700")}
        _hover={{
          textDecoration: "none",
          bg: useColorModeValue("gray.200", "gray.900")
        }}
      />
      <ColorModeSwitcher justifySelf="flex-end" />
    </Flex>
  )
}
