import {
  Stack,
  IconButton,
  Link,
  Box,
  Text,
  useColorModeValue,
  Flex
} from "@chakra-ui/react";
import siteConfig from "../../configs/site-config";

const iconProps = {
  variant: "ghost",
  size: "lg",
  isRound: true
};

const Footer = () => {
  return (
    <Stack
      as="footer"
      isInline
      spacing={[1, 2]}
      p={4}
      justifyContent="space-between"
      alignItems="center"
      w={["100%", "85%", "80%"]}
      maxW={800}
      mx="auto"
    >
      <Flex
        flexDirection={["column", "column", "row"]}
        flexFlow={["column-reverse", "column-reverse"]}
        justifyContent={["center", "space-between"]}
        alignItems="center"
        w="100%"
      >
        {/* <HStack> */}
        <Text
          textAlign="center"
          fontSize="sm"
          color={useColorModeValue("gray.500", "gray.200")}
        >
          © {new Date().getFullYear()} Muhammad Mustafa Ali{" "}
        </Text>
        {/* <Box fontSize="md" textAlign="left">
        Website built with
        <Box
          as="span"
          mx="2"
          _before={{
            cursor: "default",
            content: '"❤️"'
          }}
          _hover={{
            _before: {
              content: '"☕️"'
            }
          }}
        />
        in Pakistan{"  "}🇵🇰
      </Box> */}
        {/* </HStack> */}
        <Box textAlign="center">
          {siteConfig.author.accounts.map((sc, index) => (
            <IconButton
              key={index}
              as={Link}
              isExternal
              href={sc.url}
              aria-label={sc.label}
              size="lg"
              colorScheme={sc.type}
              icon={sc.icon}
              {...iconProps}
            />
          ))}
        </Box>
      </Flex>
    </Stack>
  );
};

export default Footer;
