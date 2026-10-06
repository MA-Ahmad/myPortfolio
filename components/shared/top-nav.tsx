import { useState } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { GiHamburgerMenu } from 'react-icons/gi';
import { AiOutlineClose, AiTwotoneThunderbolt } from 'react-icons/ai';
import { ColorModeSwitcher } from '../theme/ColorModeSwitcher';
import { BiChevronDown } from 'react-icons/bi';
import { CgArrowsExchange } from 'react-icons/cg';
import { BsCheckCircle, BsBook } from 'react-icons/bs';
import { MdTimeline } from 'react-icons/md';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { AccentPicker } from 'components/theme/Accent';
import { useLinkColor } from 'components/theme';
import { MotionBox } from 'components/shared/animations/motion';
import { cn } from 'lib/cn';

const webLinks = [
  { name: 'About', path: '/about' },
  { name: 'Blog', path: '/blog' }
];

const mobileLinks = [
  { name: 'Projects', path: '/projects' },
  { name: 'Open Source', path: '/open-source' },
  { name: 'Blog', path: '/blog' },
  { name: 'Changelog', path: '/changelog' }
];

const dropdownLinks = [
  { name: 'Projects', path: '/projects' },
  { name: 'Tech Stack', path: '/tech-stack' },
  { name: 'Open Source', path: '/open-source' },
  { name: 'Achievements', path: '/achievements' },
  { name: 'Changelog', path: '/changelog' }
];

interface NavLinkProps {
  name: string;
  path: string;
  onClose: () => void;
}

const NavLink = (props: NavLinkProps) => {
  const router = useRouter();
  const isActive = router.pathname === props.path;

  return (
    <NextLink
      href={props.path}
      onClick={() => props.onClose()}
      className={cn(
        'rounded-md px-3 py-1 leading-inherit no-underline hover:bg-gray-200 hover:text-[var(--link-color)] dark:hover:bg-gray-700',
        isActive
          ? 'bg-gray-200 text-[var(--link-color)] dark:bg-gray-700'
          : 'bg-transparent text-inherit'
      )}>

      {props.name}

    </NextLink>
  );
};

interface MenuLinkProps {
  name: string;
  path: string;
  color: string;
  rPath: string;
  onClose: () => void;
}

const MenuLink = (props: MenuLinkProps) => {
  const iconsObj = {
    '/tech-stack': <AiTwotoneThunderbolt size={18} color={props.color} />,
    '/open-source': <BsBook size={18} color={props.color} />,
    '/achievements': <BsCheckCircle size={18} color={props.color} />,
    '/projects': <MdTimeline size={18} color={props.color} />,
    '/changelog': <CgArrowsExchange size={18} color={props.color} />
  };
  const isActive = props.rPath === props.path;

  return (
    <MenuItem>
      <NextLink
        href={props.path}
        onClick={() => props.onClose()}
        className={cn(
          'flex items-center gap-2 px-3 py-2 no-underline hover:bg-gray-200 hover:text-[var(--link-color)] dark:hover:bg-gray-700',
          isActive && 'bg-gray-200 text-[var(--link-color)] dark:bg-gray-700'
        )}>

        {iconsObj[props.path]}
        <span>{props.name}</span>

      </NextLink>
    </MenuItem>
  );
};

export default function TopNav() {
  const linkColor = useLinkColor();
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const onClose = () => setIsOpen(false);

  return (
    <div
      className="fixed z-[55] w-full px-4 shadow-lg backdrop-blur-[5px] backdrop-saturate-150 bg-white/80 dark:bg-[rgba(26,32,44,0.8)]"
    >
      <div className="mx-auto flex h-16 w-[90%] max-w-[800px] items-center justify-between sm:w-[85%] lg:w-[80%]">
        <button
          type="button"
          aria-label="Open Menu"
          className="inline-flex h-10 w-10 items-center justify-center rounded-md md:hidden"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <AiOutlineClose /> : <GiHamburgerMenu />}
        </button>
        <div className="flex items-center gap-8">
          <MotionBox whileHover={{ scale: 1.2 }} className="rounded-full shadow-md">
            <NextLink href="/">

              <img
                alt="Muhammad Ahmad"
                className="h-8 w-8 rounded-full border-2 object-cover"
                style={{ borderColor: linkColor }}
                src="https://avatars2.githubusercontent.com/u/37842853?v=4"
              />

            </NextLink>
          </MotionBox>
          <nav className="hidden items-center gap-3 md:flex">
            {webLinks.map((link, index) => (
              <NavLink
                key={index}
                name={link.name}
                path={link.path}
                onClose={onClose}
              />
            ))}
            <Menu>
              <MenuButton className="inline-flex items-center rounded-md px-3 py-1 text-[1em] leading-inherit hover:bg-gray-200 hover:text-[var(--link-color)] dark:hover:bg-gray-700">
                Links
                <BiChevronDown className="ml-1 h-5 w-5 transition-transform ui-open:rotate-180" />
              </MenuButton>
              <MenuItems
                anchor="bottom start"
                className="z-[5] mt-2 w-48 rounded-md border-none bg-white shadow-[2px_4px_6px_2px_rgba(160,174,192,0.6)] dark:bg-[rgb(26,32,44)] dark:shadow-[2px_4px_6px_2px_rgba(9,17,28,0.6)]"
              >
                {dropdownLinks.map((link, index) => (
                  <MenuLink
                    key={index}
                    path={link.path}
                    name={link.name}
                    onClose={onClose}
                    color={linkColor}
                    rPath={router.pathname}
                  />
                ))}
              </MenuItems>
            </Menu>
          </nav>
        </div>
        <div className="flex items-center">
          <AccentPicker
            aria-label="Accent Color Picker"
            className="relative z-[1] mr-2"
          />
          <ColorModeSwitcher />
        </div>
      </div>

      {isOpen ? (
        <div className="block w-full max-w-[800px] pb-4 md:hidden">
          <nav className="flex flex-col gap-4">
            {mobileLinks.map((link, index) => (
              <NavLink
                key={index}
                name={link.name}
                path={link.path}
                onClose={onClose}
              />
            ))}
          </nav>
        </div>
      ) : null}
    </div>
  );
}
