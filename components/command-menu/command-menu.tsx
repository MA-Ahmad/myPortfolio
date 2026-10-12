import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { Command } from 'cmdk';
import {
  BookOpenIcon,
  BriefcaseBusinessIcon,
  FileTextIcon,
  FolderGit2Icon,
  GraduationCapIcon,
  HomeIcon,
  LayersIcon,
  MoonStarIcon,
  SearchIcon,
  SunMediumIcon
} from 'lucide-react';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';

const PAGE_LINKS = [
  { title: 'Home', href: '/', shortcut: 'GH', icon: HomeIcon },
  { title: 'Blog', href: '/blog', shortcut: 'GL', icon: BookOpenIcon }
];

const SECTION_LINKS = [
  { title: 'Stack', href: '/#stack', icon: LayersIcon },
  { title: 'Experience', href: '/#experience', icon: BriefcaseBusinessIcon },
  { title: 'Education', href: '/#education', icon: GraduationCapIcon },
  { title: 'Projects', href: '/#projects', icon: FolderGit2Icon }
];

export function CommandMenu() {
  const router = useRouter();
  const { setTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
        return;
      }

      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        setOpen(true);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const go = (href: string, openInNewTab = false) => {
    setOpen(false);
    if (openInNewTab) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    router.push(href);
  };

  return (
    <>
      <button
        type="button"
        data-slot="command-menu-trigger"
        onClick={() => setOpen(true)}
        className="inline-flex size-8 items-center justify-center gap-2 rounded-full border border-line text-sm text-muted-foreground hover:bg-muted sm:h-8 sm:w-auto sm:px-2.5"
        aria-label="Open command menu"
      >
        <SearchIcon className="size-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className="ml-1 hidden rounded border border-line px-1 font-mono text-[10px] md:inline">
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      {open ? (
        <div className="fixed inset-0 z-[80]">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close command menu"
            onClick={() => setOpen(false)}
          />
          <div className="relative mx-auto mt-16 w-[min(32rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-popover text-popover-foreground shadow-2xl">
            <Command label="Command menu" className="flex flex-col outline-none">
              <div className="flex h-12 items-center gap-2 border-b border-line px-3">
                <SearchIcon className="size-4 opacity-50" />
                <Command.Input
                  placeholder="Search pages, sections, links…"
                  className="h-12 w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                />
              </div>
              <Command.List className="max-h-80 overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center font-mono text-sm text-muted-foreground">
                  No results found.
                </Command.Empty>

                <Command.Group heading="Pages" className="mb-2">
                  {PAGE_LINKS.map((link) => (
                    <CommandItem
                      key={link.href + link.title}
                      onSelect={() => go(link.href)}
                    >
                      <link.icon className="size-4 text-muted-foreground" />
                      <span>{link.title}</span>
                      {link.shortcut ? (
                        <span className="ml-auto font-mono text-xs text-muted-foreground">
                          {link.shortcut}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </Command.Group>

                <Command.Group heading="On this site" className="mb-2">
                  {SECTION_LINKS.map((link) => (
                    <CommandItem key={link.href} onSelect={() => go(link.href)}>
                      <link.icon className="size-4 text-muted-foreground" />
                      <span>{link.title}</span>
                    </CommandItem>
                  ))}
                </Command.Group>

                <Command.Group heading="Social" className="mb-2">
                  {PROFILE.socials.map((item) => (
                    <CommandItem
                      key={item.href}
                      onSelect={() => go(item.href, item.name !== 'email')}
                    >
                      <span className="size-4 text-muted-foreground">↗</span>
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
                </Command.Group>

                <Command.Group heading="Other" className="mb-2">
                  <CommandItem onSelect={() => go('/llms.txt', true)}>
                    <FileTextIcon className="size-4 text-muted-foreground" />
                    <span>llms.txt</span>
                  </CommandItem>
                </Command.Group>

                <Command.Group heading="Theme">
                  <CommandItem onSelect={() => { setTheme('light'); setOpen(false); }}>
                    <SunMediumIcon className="size-4 text-muted-foreground" />
                    <span>Light</span>
                  </CommandItem>
                  <CommandItem onSelect={() => { setTheme('dark'); setOpen(false); }}>
                    <MoonStarIcon className="size-4 text-muted-foreground" />
                    <span>Dark</span>
                  </CommandItem>
                </Command.Group>
              </Command.List>
              <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-muted-foreground">
                <span>Navigate</span>
                <span>Enter to select</span>
              </div>
            </Command>
          </div>
        </div>
      ) : null}
    </>
  );
}

function CommandItem({
  children,
  onSelect
}: {
  children: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none',
        'data-[selected=true]:bg-muted'
      )}
    >
      {children}
    </Command.Item>
  );
}

export default CommandMenu;
