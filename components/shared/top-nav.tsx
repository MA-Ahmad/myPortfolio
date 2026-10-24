import { useState } from 'react';
import { GiHamburgerMenu } from 'react-icons/gi';
import { AiOutlineClose } from 'react-icons/ai';
import { FileUserIcon } from 'lucide-react';
import { ColorModeSwitcher } from '../theme/ColorModeSwitcher';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { CommandMenu } from 'components/command-menu/command-menu';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';

const pageLinks: { name: string; path: string }[] = [
  // { name: 'Blog', path: '/blog' }
];

interface NavLinkProps {
  name: string;
  path: string;
  onClose: () => void;
}

const NavLink = (props: NavLinkProps) => {
  const router = useRouter();
  const isActive =
    router.pathname === props.path ||
    router.pathname.startsWith(`${props.path}/`);

  return (
    <NextLink
      href={props.path}
      aria-current={isActive ? 'page' : undefined}
      onClick={() => props.onClose()}
      className={cn(
        'nav-link text-sm font-medium tracking-wide text-muted-foreground no-underline transition-[color] hover:text-foreground',
        isActive && 'text-foreground'
      )}
    >
      {props.name}
    </NextLink>
  );
};

export default function TopNav() {
  const [isOpen, setIsOpen] = useState(false);
  const onClose = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-50 max-w-[100vw] overflow-x-clip bg-background px-2">
      <div className="screen-line-top screen-line-bottom mx-auto flex h-[var(--header-height)] items-center gap-2 border-x border-line screen-line-bottom-border screen-line-top-border pl-4 pr-2 after:z-[1] md:max-w-3xl">
        {pageLinks.length > 0 ? (
          <button
            type="button"
            aria-label="Open Menu"
            className="inline-flex size-8 items-center justify-center rounded-md md:hidden"
            onClick={() => setIsOpen((open) => !open)}
          >
            {isOpen ? <AiOutlineClose /> : <GiHamburgerMenu />}
          </button>
        ) : null}

        <NextLink href="/" aria-label="Home" className="avatar-ring shrink-0 no-underline">
          <img
            alt={PROFILE.displayName}
            className="size-8 rounded-full object-cover"
            src={PROFILE.avatar}
          />
        </NextLink>

        <nav className="hidden items-center gap-4 md:flex">
          {pageLinks.map((link) => (
            <NavLink
              key={link.path}
              name={link.name}
              path={link.path}
              onClose={onClose}
            />
          ))}
        </nav>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          <a
            href={PROFILE.resumeUrl}
            target="_blank"
            rel="noopener"
            aria-label="Resume"
            title="Resume"
            className="inline-flex size-8 items-center justify-center rounded-full border border-line text-muted-foreground no-underline transition-[color,background-color] hover:bg-muted hover:text-foreground"
          >
            <FileUserIcon className="size-3.5" />
          </a>
          <CommandMenu />
          <span className="mx-1 hidden h-5 w-px bg-line sm:block" />
          <ColorModeSwitcher />
        </div>
      </div>

      {isOpen && pageLinks.length > 0 ? (
        <div className="mx-auto border-x border-line bg-background px-4 pb-4 md:hidden md:max-w-3xl">
          <nav className="flex flex-col gap-3 pt-3">
            {pageLinks.map((link) => (
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
