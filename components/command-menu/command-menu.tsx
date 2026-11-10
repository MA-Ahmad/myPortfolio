import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import { useTheme } from 'next-themes';
import { Command } from 'cmdk';
import {
  BlocksIcon,
  BriefcaseBusinessIcon,
  FileTextIcon,
  FileUserIcon,
  FolderGit2Icon,
  HashIcon,
  GraduationCapIcon,
  Columns4Icon,
  HomeIcon,
  LayersIcon,
  MoonIcon,
  MoonStarIcon,
  NotebookIcon,
  SearchIcon,
  SunMediumIcon,
  SwatchBookIcon,
  PencilRulerIcon,
  TerminalIcon,
  WorkflowIcon
} from 'lucide-react';
import { PROFILE } from 'data/profile';
import { cn } from 'lib/cn';
import { pixelNavigate } from 'lib/pixel-transition';
import { requestRedraw } from 'lib/redraw';

/** Opens the site's command menu from elsewhere on the page (the mobile dock's search pill). */
export const OPEN_COMMAND_MENU_EVENT = 'command-menu:open';
export const openCommandMenu = () => window.dispatchEvent(new Event(OPEN_COMMAND_MENU_EVENT));

const PAGE_LINKS = [
  { title: 'Home', href: '/', shortcut: 'GH', icon: HomeIcon },
  { title: 'Blocks', href: '/blocks', icon: BlocksIcon },
  { title: 'Resume', href: PROFILE.resumeUrl, icon: FileUserIcon, external: true }
];

const SECTION_LINKS = [
  { title: 'Stack', href: '/#stack', icon: LayersIcon },
  { title: 'Experience', href: '/#experience', icon: BriefcaseBusinessIcon },
  { title: 'Education', href: '/#education', icon: GraduationCapIcon },
  { title: 'Projects', href: '/#projects', icon: FolderGit2Icon }
];

/** Class names per part of the menu; a theme passes its own to re-skin it. */
export type CommandMenuSkin = {
  trigger: string;
  kbd: string;
  backdrop: string;
  panel: string;
  inputRow: string;
  input: string;
  list: string;
  group: string;
  item: string;
  empty: string;
  footer: string;
  icon: string;
};

const DEFAULT_SKIN: CommandMenuSkin = {
  trigger:
    'inline-flex size-8 items-center justify-center gap-2 rounded-full border border-line text-sm text-muted-foreground hover:bg-muted sm:h-8 sm:w-auto sm:px-2.5',
  kbd: 'ml-1 hidden rounded border border-line px-1 font-mono text-[10px] md:inline',
  backdrop: 'absolute inset-0 bg-black/40',
  panel:
    'relative mx-auto mt-16 w-[min(32rem,calc(100vw-1.5rem))] overflow-hidden rounded-2xl border border-line bg-muted text-popover-foreground shadow-2xl dark:bg-popover',
  inputRow: 'flex h-12 items-center gap-2 px-3',
  input:
    'h-12 w-full min-w-0 bg-transparent text-base outline-none placeholder:text-muted-foreground sm:text-sm',
  // The results sit on their own dark, rounded card between the search row and the footer.
  list: 'mx-1.5 max-h-[min(20rem,calc(100dvh-12rem))] overflow-y-auto overscroll-contain rounded-xl border border-line bg-background p-2',
  group: 'mb-2',
  item: 'flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm outline-none data-[selected=true]:bg-muted',
  empty: 'py-8 text-center font-mono text-sm text-muted-foreground',
  footer:
    'flex items-center justify-between px-3 py-2 text-xs text-muted-foreground',
  icon: 'text-muted-foreground'
};

type Props = {
  skin?: Partial<CommandMenuSkin>;
  /** Replaces the "On this site" links, for pages whose sections differ from the main site. */
  sections?: { title: string; href: string }[];
  /** Hide the light/dark group on themes that have a single palette. */
  showMode?: boolean;
  /** Extra classes for the trigger button (the site nav hides it on phones, where the dock has it). */
  triggerClassName?: string;
};

export function CommandMenu({ skin, sections, showMode = true, triggerClassName }: Props = {}) {
  const s = { ...DEFAULT_SKIN, ...skin };
  const iconClass = cn('size-4', s.icon);
  const router = useRouter();
  const { setTheme, resolvedTheme } = useTheme();
  const [open, setOpen] = useState(false);
  const [isMac, setIsMac] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const terminalIconRef = useRef<SVGSVGElement>(null);
  const notebookIconRef = useRef<SVGSVGElement>(null);
  const midnightIconRef = useRef<SVGSVGElement>(null);
  const panoramaIconRef = useRef<SVGSVGElement>(null);
  const canvasIconRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    setIsMac(/Mac|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => {
    if (!open) return;
    router.prefetch('/themes/terminal');
    router.prefetch('/themes/notebook');
    router.prefetch('/themes/midnight');
    router.prefetch('/themes/panorama');
    router.prefetch('/theme-studio');
  }, [open, router]);

  // The input takes focus as the menu opens; closing hands focus back to where it was.
  const rememberFocus = () => {
    if (!panelRef.current) returnFocus.current = document.activeElement as HTMLElement | null;
  };

  useEffect(() => {
    if (open) return;
    const target = returnFocus.current;
    returnFocus.current = null;
    if (target?.isConnected) target.focus({ preventScroll: true });
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const typing =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        rememberFocus();
        setOpen((value) => !value);
        return;
      }

      if (event.key === '/' && !typing && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        rememberFocus();
        setOpen(true);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    };

    const onOpenRequest = () => {
      rememberFocus();
      setOpen(true);
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener(OPEN_COMMAND_MENU_EVENT, onOpenRequest);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener(OPEN_COMMAND_MENU_EVENT, onOpenRequest);
    };
  }, []);

  // Closes on any press outside the panel, whatever sits behind it.
  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, [open]);

  const go = (href: string, openInNewTab = false) => {
    setOpen(false);
    if (openInNewTab) {
      window.open(href, '_blank', 'noopener');
      return;
    }
    router.push(href);
  };

  const openTerminalTheme = () => {
    const icon = terminalIconRef.current?.getBoundingClientRect();
    setOpen(false);
    pixelNavigate(router, '/themes/terminal', {
      origin: icon
        ? { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      // Must match --term-accent and --term-bg in themes/terminal/terminal.module.css.
      edge: '#b8c572',
      background: '#0d0e0f'
    });
  };

  const openNotebookTheme = () => {
    const icon = notebookIconRef.current?.getBoundingClientRect();
    const dark = resolvedTheme === 'dark';
    setOpen(false);
    pixelNavigate(router, '/themes/notebook', {
      origin: icon
        ? { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      // Must match --nb-ink and --nb-bg in themes/notebook/notebook.module.css.
      edge: dark ? 'oklch(94% 0.004 80)' : 'oklch(21% 0.006 70)',
      background: dark ? 'oklch(15.5% 0.004 70)' : 'oklch(98.4% 0.0025 95)'
    });
  };

  const openMidnightTheme = () => {
    const icon = midnightIconRef.current?.getBoundingClientRect();
    setOpen(false);
    pixelNavigate(router, '/themes/midnight', {
      origin: icon
        ? { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      // Must match --mn-ink and --mn-bg in themes/midnight/midnight.module.css.
      edge: '#f3f3f4',
      background: '#0b0b0d'
    });
  };

  const openPanoramaTheme = () => {
    const icon = panoramaIconRef.current?.getBoundingClientRect();
    setOpen(false);
    pixelNavigate(router, '/themes/panorama', {
      origin: icon
        ? { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      // Must match --pn-ink and --pn-bg in themes/panorama/panorama.module.css.
      edge: '#f4f4f5',
      background: '#1c1f24'
    });
  };

  const openCanvas = () => {
    const icon = canvasIconRef.current?.getBoundingClientRect();
    const dark = resolvedTheme === 'dark';
    setOpen(false);
    pixelNavigate(router, '/theme-studio', {
      origin: icon
        ? { x: icon.left + icon.width / 2, y: icon.top + icon.height / 2 }
        : { x: window.innerWidth / 2, y: window.innerHeight / 2 },
      // Must match --cv-bg in components/canvas/canvas.module.css.
      edge: getComputedStyle(document.documentElement).getPropertyValue('--foreground').trim(),
      background: dark ? '#0a0a0b' : '#f6f6f4'
    });
  };

  return (
    <>
      <button
        type="button"
        data-slot="command-menu-trigger"
        onClick={() => {
          rememberFocus();
          setOpen(true);
        }}
        className={cn(s.trigger, triggerClassName)}
        aria-label="Open command menu"
      >
        <SearchIcon className="size-3.5" />
        <span className="hidden sm:inline">Search…</span>
        <kbd className={s.kbd}>
          {isMac ? '⌘K' : 'Ctrl K'}
        </kbd>
      </button>

      {open ? (
        // data-command-menu-open lifts the site header above the spider while open (globals.css).
        <div data-command-menu-open className="fixed inset-0 z-[80] overflow-x-hidden overscroll-contain">
          <button
            type="button"
            className={s.backdrop}
            aria-label="Close command menu"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Command menu"
            className={s.panel}
          >
            <Command label="Command menu" className="flex flex-col outline-none">
              <div className={s.inputRow}>
                <SearchIcon className="size-4 opacity-50" />
                <Command.Input
                  autoFocus
                  placeholder="Search pages, sections, links…"
                  className={s.input}
                />
              </div>
              <Command.List className={s.list}>
                <Command.Empty className={s.empty}>
                  No results found.
                </Command.Empty>

                <Command.Group heading="Pages" className={s.group}>
                  {PAGE_LINKS.map((link) => (
                    <CommandItem className={s.item}
                      key={link.href + link.title}
                      onSelect={() => go(link.href, link.external)}
                    >
                      <link.icon className={iconClass} />
                      <span>{link.title}</span>
                      {link.shortcut ? (
                        <span className="ml-auto font-mono text-xs text-muted-foreground">
                          {link.shortcut}
                        </span>
                      ) : null}
                    </CommandItem>
                  ))}
                </Command.Group>

                <Command.Group heading="Themes" className={s.group}>
                  <CommandItem className={s.item} onSelect={openCanvas} keywords={['canvas', 'wire', 'switch']}>
                    <WorkflowIcon ref={canvasIconRef} className={iconClass} />
                    <span>Theme Studio</span>
                  </CommandItem>
                  <CommandItem className={s.item} onSelect={openTerminalTheme}>
                    <TerminalIcon ref={terminalIconRef} className={iconClass} />
                    <span>Terminal</span>
                  </CommandItem>
                  <CommandItem className={s.item} onSelect={openNotebookTheme}>
                    <NotebookIcon ref={notebookIconRef} className={iconClass} />
                    <span>Notebook</span>
                  </CommandItem>
                  <CommandItem className={s.item} onSelect={openMidnightTheme}>
                    <MoonIcon ref={midnightIconRef} className={iconClass} />
                    <span>Midnight</span>
                  </CommandItem>
                  <CommandItem className={s.item} onSelect={openPanoramaTheme}>
                    <Columns4Icon ref={panoramaIconRef} className={iconClass} />
                    <span>Panorama</span>
                  </CommandItem>
                  <CommandItem className={s.item} onSelect={() => go('/?play=1')} keywords={['customize', 'layout', 'lines', 'accent']}>
                    <SwatchBookIcon className={iconClass} />
                    <span>Play mode</span>
                  </CommandItem>
                  <CommandItem
                    className={s.item}
                    onSelect={() => {
                      if (router.pathname !== '/') return go('/?redraw=1');
                      setOpen(false);
                      requestRedraw();
                    }}
                    keywords={['rebuild', 'agents', 'draw', 'animate']}
                  >
                    <PencilRulerIcon className={iconClass} />
                    <span>Redraw the page</span>
                  </CommandItem>
                </Command.Group>

                <Command.Group heading="On this site" className={s.group}>
                  {sections
                    ? sections.map((link) => (
                        <CommandItem className={s.item} key={link.href} onSelect={() => go(link.href)}>
                          <HashIcon className={iconClass} />
                          <span>{link.title}</span>
                        </CommandItem>
                      ))
                    : SECTION_LINKS.map((link) => (
                        <CommandItem className={s.item} key={link.href} onSelect={() => go(link.href)}>
                          <link.icon className={iconClass} />
                          <span>{link.title}</span>
                        </CommandItem>
                      ))}
                </Command.Group>

                <Command.Group heading="Social" className={s.group}>
                  {PROFILE.socials.map((item) => (
                    <CommandItem className={s.item}
                      key={item.href}
                      onSelect={() => go(item.href, item.name !== 'email')}
                    >
                      <span className={iconClass}>↗</span>
                      <span>{item.title}</span>
                    </CommandItem>
                  ))}
                </Command.Group>

                <Command.Group heading="Other" className={s.group}>
                  <CommandItem className={s.item} onSelect={() => go('/llms.txt', true)}>
                    <FileTextIcon className={iconClass} />
                    <span>llms.txt</span>
                  </CommandItem>
                </Command.Group>

                {showMode ? (
                <Command.Group heading="Mode" className={s.group}>
                  <CommandItem className={s.item} onSelect={() => { setTheme('light'); setOpen(false); }}>
                    <SunMediumIcon className={iconClass} />
                    <span>Light</span>
                  </CommandItem>
                  <CommandItem className={s.item} onSelect={() => { setTheme('dark'); setOpen(false); }}>
                    <MoonStarIcon className={iconClass} />
                    <span>Dark</span>
                  </CommandItem>
                </Command.Group>
                ) : null}
              </Command.List>
              <div className={s.footer}>
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
  onSelect,
  keywords,
  className
}: {
  children: React.ReactNode;
  onSelect: () => void;
  keywords?: string[];
  className: string;
}) {
  return (
    <Command.Item onSelect={onSelect} keywords={keywords} className={className}>
      {children}
    </Command.Item>
  );
}

export default CommandMenu;
