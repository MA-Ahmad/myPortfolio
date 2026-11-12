import { useEffect, useRef, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { MenuIcon, SearchIcon, XIcon } from 'lucide-react';
import { openCommandMenu } from 'components/command-menu/command-menu';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';

const LINKS: { name: string; href: string; external?: boolean }[] = [
  { name: 'Home', href: '/' },
  { name: 'Blocks', href: '/blocks' },
  { name: 'Resume', href: PROFILE.resumeUrl, external: true }
];

const BUTTON =
  'inline-flex h-10 items-center rounded-full border border-line bg-popover/90 text-popover-foreground shadow-lg backdrop-blur-md transition-[background-color,transform] duration-150 ease-out active:scale-[0.96]';

/**
 * Phones only: the site's menu and search sit in a floating dock at the bottom of the screen,
 * within thumb reach, instead of in the top bar. The search pill opens the one command menu the
 * top nav renders (its own trigger is hidden on phones).
 */
export function MobileDock() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const dockRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!dockRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  const isActive = (href: string) =>
    href === '/' ? router.pathname === '/' : router.pathname === href || router.pathname.startsWith(`${href}/`);

  return (
    <div
      ref={dockRef}
      data-redraw-ignore
      className="fixed inset-x-0 bottom-0 z-[60] flex justify-center px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pointer-events-none md:hidden print:hidden"
    >
      <div className="pointer-events-auto relative flex items-center gap-2">
        <AnimatePresence>
          {open ? (
            <motion.nav
              id="mobile-dock-menu"
              aria-label="Site"
              initial={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 6 }}
              animate={reduced ? { opacity: 1 } : { opacity: 1, scale: 1, y: 0 }}
              exit={reduced ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 4 }}
              transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
              style={{ transformOrigin: 'bottom left' }}
              className="absolute bottom-full left-0 mb-2 w-48 rounded-2xl border border-line bg-popover p-1.5 text-popover-foreground shadow-2xl"
            >
              {LINKS.map((link) => {
                const active = !link.external && isActive(link.href);
                const className = cn(
                  'flex items-center rounded-xl px-3 py-2.5 text-base no-underline transition-colors hover:bg-muted',
                  active ? 'bg-muted text-foreground' : 'text-foreground/90'
                );
                return link.external ? (
                  <a
                    key={link.name}
                    href={link.href}
                    target="_blank"
                    rel="noopener"
                    onClick={() => setOpen(false)}
                    className={className}
                  >
                    {link.name}
                  </a>
                ) : (
                  <NextLink
                    key={link.name}
                    href={link.href}
                    aria-current={active ? 'page' : undefined}
                    onClick={() => setOpen(false)}
                    className={className}
                  >
                    {link.name}
                  </NextLink>
                );
              })}
            </motion.nav>
          ) : null}
        </AnimatePresence>

        <button
          type="button"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          aria-controls="mobile-dock-menu"
          onClick={() => setOpen((value) => !value)}
          className={cn(BUTTON, 'w-10 justify-center')}
        >
          {open ? <XIcon className="size-4" /> : <MenuIcon className="size-4" />}
        </button>

        <button
          type="button"
          aria-label="Search"
          onClick={() => {
            setOpen(false);
            openCommandMenu();
          }}
          className={cn(BUTTON, 'w-36 justify-start gap-2 px-3.5 text-sm text-muted-foreground')}
        >
          <SearchIcon className="size-3.5" />
          <span>Search…</span>
        </button>
      </div>
    </div>
  );
}
