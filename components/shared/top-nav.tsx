import { useState } from 'react';
import { GiHamburgerMenu } from 'react-icons/gi';
import { AiOutlineClose } from 'react-icons/ai';
import { FileUserIcon, SwatchBookIcon } from 'lucide-react';
import { ColorModeSwitcher } from '../theme/ColorModeSwitcher';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { CommandMenu } from 'components/command-menu/command-menu';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { PLAY_EXIT_EVENT, isPlaying } from 'lib/play';

const pageLinks: { name: string; path: string }[] = [
  // { name: 'Blog', path: '/blog' }
  { name: 'Blocks', path: '/blocks' }
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
        'text-sm font-medium tracking-wide no-underline transition-[color] hover:text-foreground',
        isActive ? 'text-foreground' : 'text-muted-foreground'
      )}
    >
      {props.name}
    </NextLink>
  );
};

/** Toggles play mode; it is home-page only, so other pages don't show it. */
const PlayButton = () => {
  const router = useRouter();
  if (router.pathname !== '/') return null;
  const playing = isPlaying(router.query);

  const toggle = () => {
    if (playing) window.dispatchEvent(new Event(PLAY_EXIT_EVENT));
    else router.replace({ pathname: '/', query: { play: '1' } }, undefined, { shallow: true, scroll: false });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={playing ? 'Exit play mode' : 'Play with the layout'}
      title={playing ? 'Exit play mode' : 'Play with the layout'}
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-full border border-line text-muted-foreground transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground active:scale-[0.94]',
        playing && 'bg-muted text-foreground'
      )}
    >
      <SwatchBookIcon className="size-3.5" />
    </button>
  );
};

export default function TopNav({ wide = false }: { wide?: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const onClose = () => setIsOpen(false);

  return (
    <header className="sticky top-0 z-50 max-w-[100vw] overflow-x-clip bg-background px-2">
      <div
        className={cn(
          'screen-line-top screen-line-bottom mx-auto flex h-[var(--header-height)] items-center gap-2 border-x border-line screen-line-bottom-border screen-line-top-border pl-4 pr-2 after:z-[1] site-frame',
          wide ? 'md:max-w-6xl' : 'md:max-w-3xl'
        )}
      >
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

        <div className="flex-1" />

        {pageLinks.length > 0 ? (
          <>
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
            <span className="mx-2 hidden h-5 w-px bg-line md:block" />
          </>
        ) : null}

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
          <PlayButton />
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
