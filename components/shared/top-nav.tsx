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
import { CommandMenu } from 'components/command-menu/command-menu';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';

const webLinks = [
  { name: 'About', path: '/about' },
  { name: 'Blog', path: '/blog' }
];

const mobileLinks = [
  { name: 'About', path: '/about' },
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
        'rounded-md px-3 py-1 leading-inherit no-underline hover:bg-muted hover:text-[var(--link-color)]',
        isActive
          ? 'bg-muted text-[var(--link-color)]'
          : 'bg-transparent text-inherit'
      )}
    >
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
          'flex items-center gap-2 px-3 py-2 no-underline hover:bg-muted hover:text-[var(--link-color)]',
          isActive && 'bg-muted text-[var(--link-color)]'
        )}
      >
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
    <header className="sticky top-0 z-50 max-w-[100vw] overflow-x-clip bg-background/85 px-2 backdrop-blur-md">
      <div className="screen-line-top screen-line-bottom mx-auto flex h-[var(--header-height)] items-center gap-2 border-x border-line screen-line-bottom-border screen-line-top-border pl-4 pr-2 after:z-[1] md:max-w-3xl">
        <button
          type="button"
          aria-label="Open Menu"
          className="inline-flex size-8 items-center justify-center rounded-md md:hidden"
          onClick={() => setIsOpen((open) => !open)}
        >
          {isOpen ? <AiOutlineClose /> : <GiHamburgerMenu />}
        </button>

        <NextLink href="/" aria-label="Home" className="shrink-0 no-underline">
          <img
            alt={PROFILE.displayName}
            className="size-8 rounded-full border object-cover"
            style={{ borderColor: linkColor }}
            src={PROFILE.avatar}
          />
        </NextLink>

        <nav className="hidden items-center gap-1 md:flex">
          {webLinks.map((link) => (
            <NavLink
              key={link.path}
              name={link.name}
              path={link.path}
              onClose={onClose}
            />
          ))}
          <Menu>
            <MenuButton className="inline-flex items-center rounded-md px-3 py-1 text-[1em] leading-inherit hover:bg-muted hover:text-[var(--link-color)]">
              Links
              <BiChevronDown className="ml-1 h-5 w-5" />
            </MenuButton>
            <MenuItems
              anchor="bottom start"
              className="z-[60] mt-2 w-48 rounded-md border border-line bg-popover shadow-lg"
            >
              {dropdownLinks.map((link) => (
                <MenuLink
                  key={link.path}
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

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <CommandMenu />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <AccentPicker aria-label="Accent Color Picker" className="relative z-[1]" />
          <ColorModeSwitcher />
        </div>
      </div>

      {isOpen ? (
        <div className="mx-auto border-x border-line bg-background px-4 pb-4 md:hidden md:max-w-3xl">
          <nav className="flex flex-col gap-3 pt-3">
            {mobileLinks.map((link) => (
              <NavLink
                key={link.path}
                name={link.name}
                path={link.path}
                onClose={onClose}
              />
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
