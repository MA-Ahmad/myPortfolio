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
} from '@chakra-ui/react';
import { GiHamburgerMenu } from 'react-icons/gi';
import { AiOutlineClose } from 'react-icons/ai';
import { ColorModeSwitcher } from '../theme/ColorModeSwitcher';
import { AiTwotoneThunderbolt } from 'react-icons/ai';
import { BiChevronDown } from 'react-icons/bi';
import { CgArrowsExchange } from 'react-icons/cg';
import { BsCheckCircle } from 'react-icons/bs';
import { MdTimeline } from 'react-icons/md';
import { BsBook } from 'react-icons/bs';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { AccentPicker } from 'components/theme/Accent';
import { useLinkColor } from 'components/theme';
import { MotionBox } from 'components/shared/animations/motion';

const webLinks = [
  { name: 'About', path: '/about' },
  { name: 'Projects', path: '/projects' }
];

const mobileLinks = [
  { name: 'Projects', path: '/projects' },
  { name: 'Open Source', path: '/open-source' },
];

const dropdownLinks = [
  { name: 'Projects', path: '/projects' },
  { name: 'Tech Stack', path: '/tech-stack' },
  { name: 'Open Source', path: '/open-source' },
  { name: 'Achievements', path: '/achievements' },
];

interface NavLinkProps {
  index?: number;
  name: string;
  path: string;
  linkColor: string;
  onClose: () => void;
}

const NavLink = (props: NavLinkProps) => {
  const router = useRouter();
  const link = {
    bg: useColorModeValue('gray.200', 'gray.700'),
    color: useColorModeValue('blue.500', 'blue.200')
  };

  return (
    <NextLink href={props.path} passHref>
      <Link
        px={3}
        py={1}
        lineHeight="inherit"
        rounded={'md'}
        _hover={{
          textDecoration: 'none',
          bg: link.bg,
          color: props.linkColor
        }}
        bg={router.pathname === props.path ? link.bg : 'transparent'}
        color={router.pathname === props.path ? props.linkColor : 'inherit'}
        onClick={() => props.onClose()}
      >
        {props.name}
      </Link>
    </NextLink>
  );
};

interface MenuLinkProps {
  name: string;
  path: string;
  color: string;
  bg: string;
  rPath: string;
  onClose: () => void;
}

const MenuLink = (props: MenuLinkProps) => {
  const iconsObj = {
    '/tech-stack': <Icon as={AiTwotoneThunderbolt} size={18} color={props.color} />,
    '/open-source': <Icon as={BsBook} size={18} color={props.color} />,
    '/achievements': <Icon as={BsCheckCircle} size={18} color={props.color} />,
    '/projects': <Icon as={MdTimeline} size={18} color={props.color} />,
    '/changelog': <Icon as={CgArrowsExchange} size={18} color={props.color} />
  };

  return (
    <NextLink href={props.path} passHref>
      <Link onClick={() => props.onClose()}>
        <MenuItem
          color={props.rPath === props.path && props.color}
          bg={props.rPath === props.path && props.bg}
          _hover={{ color: props.color, bg: props.bg }}
        >
          <HStack>
            {iconsObj[props.path]}
            <Text>{props.name}</Text>
          </HStack>
        </MenuItem>
      </Link>
    </NextLink>
  );
};

export default function TopNav() {
  const linkColor = useLinkColor();
  const router = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();

  const menuProps = {
    bg: useColorModeValue('gray.200', 'gray.700'),
    color: useColorModeValue('blue.500', 'blue.200')
  };

  return (
    <>
      <Box
        px={4}
        boxShadow={'lg'}
        position="fixed"
        width="100%"
        zIndex="55"
        css={{
          backdropFilter: 'saturate(180%) blur(5px)',
          backgroundColor: useColorModeValue('rgba(255, 255, 255, 0.8)', 'rgba(26, 32, 44, 0.8)')
        }}
      >
        <Flex
          h={16}
          alignItems={'center'}
          justifyContent={'space-between'}
          w={['90%', '85%', '80%']}
          maxW={800}
          mx="auto"
        >
          <IconButton
            size={'md'}
            icon={isOpen ? <AiOutlineClose /> : <GiHamburgerMenu />}
            aria-label={'Open Menu'}
            display={['inherit', 'inherit', 'none']}
            onClick={isOpen ? onClose : onOpen}
          />
          <HStack spacing={8} alignItems={'center'}>
            <MotionBox whileHover={{ scale: 1.2 }} shadow="md" rounded="full">
              <NextLink href={'/'} passHref>
                <Avatar
                  as={Link}
                  size={'sm'}
                  showBorder={true}
                  borderColor={linkColor}
                  src={'https://avatars2.githubusercontent.com/u/37842853?v=4'}
                />
              </NextLink>
            </MotionBox>
            <HStack as={'nav'} spacing={3} display={{ base: 'none', md: 'flex' }}>
              {webLinks.map((link, index) => (
                <NavLink
                  key={index}
                  name={link.name}
                  path={link.path}
                  linkColor={linkColor}
                  onClose={onClose}
                />
              ))}
              <Menu autoSelect={false} isLazy>
                {({ isOpen, onClose }) => (
                  <>
                    <MenuButton
                      as={Button}
                      variant="ghost"
                      size="sm"
                      px={3}
                      py={1}
                      lineHeight="inherit"
                      fontSize={'1em'}
                      rounded={'md'}
                      height={'auto '}
                      _focus={{ boxShadow: 'none' }}
                      _hover={{ color: linkColor, bg: menuProps.bg }}
                      _active={{ bg: menuProps.bg }}
                    >
                      Links
                      <Icon
                        as={BiChevronDown}
                        h={5}
                        w={5}
                        ml={1}
                        transition={'all .25s ease-in-out'}
                        transform={isOpen ? 'rotate(180deg)' : ''}
                      />
                    </MenuButton>
                    <MenuList
                      zIndex={5}
                      bg={useColorModeValue('rgb(255, 255, 255)', 'rgb(26, 32, 44)')}
                      border="none"
                      boxShadow={useColorModeValue(
                        '2px 4px 6px 2px rgba(160, 174, 192, 0.6)',
                        '2px 4px 6px 2px rgba(9, 17, 28, 0.6)'
                      )}
                    >
                      {dropdownLinks.map((link, index) => (
                        <MenuLink
                          key={index}
                          path={link.path}
                          name={link.name}
                          onClose={onClose}
                          color={linkColor}
                          bg={menuProps.bg}
                          rPath={router.pathname}
                        />
                      ))}
                    </MenuList>
                  </>
                )}
              </Menu>
            </HStack>
          </HStack>
          <Flex alignItems={'center'}>
            <AccentPicker
              aria-label="Accent Color Picker"
              variant="ghost"
              zIndex={1}
              color={linkColor}
              mr={2}
            />
            <ColorModeSwitcher justifySelf="flex-end" />
          </Flex>
        </Flex>

        {isOpen ? (
          <Box
            pb={4}
            w={['100%', '100%', '80%']}
            maxW={800}
            display={['inherit', 'inherit', 'none']}
          >
            <Stack as={'nav'} spacing={4}>
              {mobileLinks.map((link, index) => (
                <NavLink
                  key={index}
                  index={index}
                  name={link.name}
                  path={link.path}
                  linkColor={linkColor}
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
