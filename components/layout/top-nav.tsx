import {
  Box,
  Flex,
  Avatar,
  HStack,
  Button,
  Text,
  Link,
  IconButton,
  useDisclosure,
  useColorModeValue,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  Stack,
  Icon
} from "@chakra-ui/react";
import { GiHamburgerMenu } from "react-icons/gi";
import { AiOutlineClose } from "react-icons/ai";
import { FaGithub } from "react-icons/fa";
import { ColorModeSwitcher } from "../ui/ColorModeSwitcher";
// import UserIcon from "assets/images/user_icon.png";
import { AiTwotoneThunderbolt } from "react-icons/ai";
import { BiChevronDown } from "react-icons/bi";
import { BsCheckCircle } from "react-icons/bs";
import { MdTimeline } from "react-icons/md";
import { BsBook } from "react-icons/bs";
import NextLink from "next/link";

const webLinks = [
  { name: "About", path: "/about" },
  { name: "Blog", path: "/blog" }
];

const mobileLinks = [
  { name: "About", path: "/about" },
  { name: "Open Source", path: "/open-source" },
  { name: "Blog", path: "/blog" },
  { name: "Tech Stack", path: "/tech-stack" },
  { name: "Achievements", path: "/achievements" }
];

interface NavLinkProps {
  index?: number;
  name: string;
  path: string;
  onClose: () => void;
}

const NavLink = (props: NavLinkProps) => {
  const link = {
    bg: useColorModeValue("gray.200", "gray.900"),
    color: useColorModeValue("blue.500", "blue.200")
  };
  return (
    <NextLink href={props.path} passHref>
      <Link
        px={2}
        py={1}
        rounded={"md"}
        _hover={{
          textDecoration: "none",
          bg: link.bg
        }}
        _activeLink={{
          color: link.color
        }}
        onClick={() => props.onClose()}
        // to={props.path}
      >
        {props.name}
      </Link>
    </NextLink>
  );
};

export default function TopNav() {
  const { isOpen, onOpen, onClose } = useDisclosure();

  const menuProps = {
    bg: useColorModeValue("gray.200", "gray.900"),
    color: useColorModeValue("blue.500", "blue.200")
  };

  return (
    <>
      <Box
        bg={useColorModeValue("white", "gray.700")}
        px={4}
        boxShadow={"lg"}
        position="fixed"
        width="100%"
        zIndex="55"
      >
        <Flex
          h={16}
          alignItems={"center"}
          justifyContent={"space-between"}
          w={["90%", "85%", "80%"]}
          maxW={800}
          mx="auto"
        >
          <IconButton
            size={"md"}
            icon={isOpen ? <AiOutlineClose /> : <GiHamburgerMenu />}
            aria-label={"Open Menu"}
            display={["inherit", "inherit", "none"]}
            onClick={isOpen ? onClose : onOpen}
          />
          <HStack spacing={8} alignItems={"center"}>
            <Box>
              <NextLink href={"/"} passHref>
                <Avatar
                  as={Link}
                  size={"sm"}
                  // src={UserIcon}
                  src={"https://avatars2.githubusercontent.com/u/37842853?v=4"}
                />
              </NextLink>
            </Box>
            <HStack
              as={"nav"}
              spacing={4}
              display={{ base: "none", md: "flex" }}
            >
              {webLinks.map((link, index) => (
                <NavLink
                  key={index}
                  name={link.name}
                  path={link.path}
                  onClose={onClose}
                />
              ))}
              <Menu isLazy>
                {({ isOpen, onClose }) => (
                  <>
                    <MenuButton
                      as={Button}
                      variant="ghost"
                      size="sm"
                      px={2}
                      py={1.5}
                      fontSize={"1em"}
                      rounded={"md"}
                      height={"auto "}
                      _hover={menuProps}
                      _expanded={menuProps}
                      _focus={{ boxShadow: "outline" }}
                      rightIcon={<BiChevronDown size={18} />}
                    >
                      Links
                    </MenuButton>
                    <MenuList zIndex={5}>
                      <NextLink href={"/tech-stack"} passHref>
                        <Link onClick={onClose}>
                          <MenuItem>
                            <HStack>
                              <Icon
                                as={AiTwotoneThunderbolt}
                                size={18}
                                color={menuProps.color}
                              />
                              <Text>Tech Stack</Text>
                            </HStack>
                          </MenuItem>
                        </Link>
                      </NextLink>
                      <NextLink href={"/open-source"} passHref>
                        <Link onClick={onClose}>
                          <MenuItem>
                            <HStack>
                              <Icon
                                as={BsBook}
                                size={18}
                                color={menuProps.color}
                              />
                              <Text>Open Source</Text>
                            </HStack>
                          </MenuItem>
                        </Link>
                      </NextLink>
                      <NextLink href={"/developer-story"} passHref>
                        <Link onClick={onClose}>
                          <MenuItem>
                            <HStack>
                              <Icon
                                as={MdTimeline}
                                size={18}
                                color={menuProps.color}
                              />
                              <Text>Developer Story</Text>
                            </HStack>
                          </MenuItem>
                        </Link>
                      </NextLink>
                      <NextLink href={"/achievements"} passHref>
                        <Link onClick={onClose}>
                          <MenuItem>
                            <HStack>
                              <Icon
                                as={BsCheckCircle}
                                size={18}
                                color={menuProps.color}
                              />
                              <Text>Achievements</Text>
                            </HStack>
                          </MenuItem>
                        </Link>
                      </NextLink>
                    </MenuList>
                  </>
                )}
              </Menu>
            </HStack>
          </HStack>
          <Flex alignItems={"center"}>
            <ColorModeSwitcher justifySelf="flex-end" />
          </Flex>
        </Flex>

        {isOpen ? (
          <Box
            pb={4}
            w={["100%", "100%", "80%"]}
            maxW={800}
            display={["inherit", "inherit", "none"]}
          >
            <Stack as={"nav"} spacing={4}>
              {mobileLinks.map((link, index) => (
                <NavLink
                  key={index}
                  index={index}
                  name={link.name}
                  path={link.path}
                  onClose={onClose}
                />
              ))}
            </Stack>
          </Box>
        ) : null}
      </Box>
    </>
  );
}
