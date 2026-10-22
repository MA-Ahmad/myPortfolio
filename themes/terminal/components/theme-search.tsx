import { CommandMenu, type CommandMenuSkin } from 'components/command-menu/command-menu';

const HEADING =
  '[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-term-dim';

const SKIN: Partial<CommandMenuSkin> = {
  trigger:
    'inline-flex shrink-0 items-center gap-2 border border-term-border px-2 py-1 text-xs text-term-muted transition-colors duration-150 hover:border-term-accent/60 hover:text-term-fg',
  kbd: 'hidden border border-term-border px-1 text-[10px] text-term-dim md:inline',
  backdrop: 'absolute inset-0 bg-term-bg/70 backdrop-blur-sm',
  panel:
    'relative mx-auto mt-16 w-[min(34rem,calc(100vw-1.5rem))] overflow-hidden border border-term-accent/40 bg-term-card text-term-fg shadow-[0_0_32px_#a9b66522]',
  inputRow: 'flex h-11 items-center gap-2 border-b border-term-border px-3 text-term-accent',
  input: 'h-11 w-full bg-transparent text-sm text-term-fg outline-none placeholder:text-term-dim',
  list: `max-h-80 overflow-y-auto p-2 ${HEADING}`,
  item: 'flex cursor-pointer items-center gap-2 px-2 py-1.5 text-sm text-term-muted outline-none data-[selected=true]:bg-term-accent/10 data-[selected=true]:text-term-accent',
  empty: 'py-8 text-center text-sm text-term-dim',
  footer: 'flex justify-between border-t border-term-border px-3 py-1.5 text-[11px] text-term-dim',
  icon: 'text-term-dim'
};

const SECTIONS = [
  { title: 'Experience', href: '/themes/terminal#experience' },
  { title: 'Projects', href: '/themes/terminal#projects' },
  { title: 'Education', href: '/themes/terminal#education' },
  { title: 'Why hire me', href: '/themes/terminal#hire-me' }
];

// The terminal has a single palette, so there is no light/dark group.
export function TerminalSearch() {
  return <CommandMenu skin={SKIN} sections={SECTIONS} showMode={false} />;
}
