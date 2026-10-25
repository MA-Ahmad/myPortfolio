import { type PointerEvent, type ReactNode, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu } from '@base-ui/react/menu';
import {
  CheckIcon,
  ChevronDownIcon,
  ClipboardCopyIcon,
  CopyIcon,
  FileCodeIcon,
  MaximizeIcon,
  MonitorIcon,
  RotateCwIcon,
  SmartphoneIcon,
  TabletIcon
} from 'lucide-react';
import { type BlockMeta, DEFAULT_IFRAME_HEIGHT } from 'blocks/registry';
import type { BlockFile } from 'lib/block-source';
import { cn } from 'lib/cn';

type View = 'preview' | 'code';

const VIEWS: { value: View; label: string }[] = [
  { value: 'preview', label: 'Preview' },
  { value: 'code', label: 'Code' }
];

// `null` fills the stage.
const SIZES = [
  { label: 'Mobile', width: 375, icon: SmartphoneIcon },
  { label: 'Tablet', width: 768, icon: TabletIcon },
  { label: 'Desktop', width: null, icon: MonitorIcon }
] as const;

// The Mobile preset: the preview never gets narrower than a phone.
const MIN_WIDTH = 375;
// Room kept to the right of the preview for its drag handle (lg:pr-3 on the stage).
const HANDLE_WIDTH = 12;
const EASE_OUT = [0.22, 1, 0.36, 1] as const;

/** A block's live preview (in an iframe, so it gets real breakpoints) and its source. */
export function BlockViewer({ block, files, markdown }: { block: BlockMeta; files: BlockFile[]; markdown: string }) {
  const [view, setView] = useState<View>('preview');
  const [width, setWidth] = useState<number | null>(null);
  const [dragging, setDragging] = useState(false);
  const [iframeKey, setIframeKey] = useState(0);
  const [activeFile, setActiveFile] = useState(files[0]?.path);
  const stageRef = useRef<HTMLDivElement>(null);

  const height = block.iframeHeight ?? DEFAULT_IFRAME_HEIGHT;
  const src = `/preview/${block.name}`;
  const file = files.find((item) => item.path === activeFile) ?? files[0];

  const resizeTo = (next: number | null) => {
    setView('preview');
    setWidth(next);
  };

  const startDrag = (event: PointerEvent<HTMLDivElement>) => {
    const stage = stageRef.current;
    if (!stage) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    const left = stage.getBoundingClientRect().left;
    const max = stage.clientWidth - HANDLE_WIDTH;
    const onMove = (move: globalThis.PointerEvent) => {
      const next = Math.min(Math.max(move.clientX - left, MIN_WIDTH), max);
      // Snapping back to the full width keeps the preview fluid instead of pinned to a pixel size.
      setWidth(next >= max - 8 ? null : Math.round(next));
    };
    const onUp = () => {
      setDragging(false);
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  return (
    <div id={block.name} className="flex min-w-0 scroll-mt-14 flex-col gap-2 p-2">
      <div className="flex w-full flex-wrap items-center gap-2 px-2">
        <div role="tablist" aria-label="View" className="flex gap-0.5 rounded-[10px] bg-muted p-0.5">
          {VIEWS.map((item) => (
            <button
              key={item.value}
              type="button"
              role="tab"
              aria-selected={view === item.value}
              onClick={() => setView(item.value)}
              className={cn(
                'relative h-7 rounded-lg px-3 text-sm font-medium outline-none transition-colors duration-150 focus-visible:ring-2 focus-visible:ring-foreground/30',
                view === item.value ? 'text-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {view === item.value && (
                <motion.span
                  layoutId={`block-view-${block.name}`}
                  transition={{ type: 'spring', duration: 0.35, bounce: 0.15 }}
                  className="absolute inset-0 rounded-lg bg-background shadow-[0_1px_2px_rgb(0_0_0/0.08)] ring-1 ring-border"
                />
              )}
              <span className="relative">{item.label}</span>
            </button>
          ))}
        </div>

        <span className="mx-2 hidden h-4 w-px bg-border sm:block" />
        <p className="hidden min-w-0 flex-1 truncate text-sm font-medium sm:block">
          {block.description.replace(/\.$/, '')}
        </p>

        <div className="ml-auto flex items-center gap-2">
          <div className="flex h-8 items-center gap-0.5 rounded-lg border border-border p-0.5">
            <div className="hidden items-center gap-0.5 lg:flex">
              {SIZES.map((size) => (
                <ToolButton
                  key={size.label}
                  label={size.label}
                  pressed={view === 'preview' && width === size.width}
                  onClick={() => resizeTo(size.width)}
                >
                  <size.icon className="size-4" />
                </ToolButton>
              ))}
              <span className="mx-0.5 h-4 w-px bg-border" />
            </div>
            <ToolButton label="Open in new tab" href={src}>
              <MaximizeIcon className="size-3.5" />
            </ToolButton>
            <span className="mx-0.5 h-4 w-px bg-border" />
            <ToolButton
              label="Refresh preview"
              onClick={() => {
                setView('preview');
                setIframeKey((key) => key + 1);
              }}
            >
              <RotateCwIcon className="size-3.5" />
            </ToolButton>
          </div>

          {view === 'code' && file && <CopyButton text={file.code} label={`Copy ${file.path}`} withText />}
          <OpenInMenu block={block} markdown={markdown} />
        </div>
      </div>

      <div
        ref={stageRef}
        className={cn(
          'relative rounded-xl lg:pr-3 bg-[radial-gradient(color-mix(in_oklab,var(--foreground)_6%,transparent)_1px,transparent_0)] bg-[length:10px_10px] bg-center',
          view !== 'preview' && 'hidden'
        )}
      >
        <div
          className={cn(
            'relative max-w-full',
            !dragging && 'transition-[width] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none'
          )}
          style={{ width: width ?? '100%' }}
        >
          <div className="relative overflow-hidden rounded-xl after:pointer-events-none after:absolute after:inset-0 after:rounded-xl after:ring-1 after:ring-inset after:ring-foreground/10">
            <iframe
              key={iframeKey}
              src={src}
              title={`${block.title} preview`}
              loading="lazy"
              height={height}
              className={cn('block w-full bg-background', dragging && 'pointer-events-none')}
            />
          </div>

          <div
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize preview"
            onPointerDown={startDrag}
            className="group/handle absolute -right-3 top-0 hidden h-full w-3 cursor-ew-resize touch-none lg:block"
          >
            <span
              className={cn(
                'absolute left-[3px] top-1/2 h-12 w-1.5 -translate-y-1/2 rounded-full bg-foreground/10 transition-[background-color,transform] duration-150 ease-out group-hover/handle:bg-foreground/20',
                dragging && 'scale-y-125 bg-foreground/30'
              )}
            />
          </div>
        </div>
      </div>

      {file && (
        // Both views stay mounted, so switching tabs keeps the iframe's state.
        <div className={cn('flex flex-col gap-2 lg:flex-row', view !== 'code' && 'hidden')} style={{ height }}>
          {files.length > 1 && (
            <ul className="flex shrink-0 gap-1 overflow-x-auto rounded-xl border border-border p-1 lg:w-56 lg:flex-col lg:overflow-y-auto">
              {files.map((item) => (
                <li key={item.path}>
                  <button
                    type="button"
                    onClick={() => setActiveFile(item.path)}
                    aria-current={item.path === file.path}
                    className={cn(
                      'flex h-8 w-full items-center gap-2 whitespace-nowrap rounded-lg px-2 text-left font-mono text-[0.8125rem] transition-colors duration-150',
                      item.path === file.path ? 'bg-muted text-foreground' : 'text-muted-foreground hover:bg-accent-muted hover:text-foreground'
                    )}
                  >
                    <FileCodeIcon className="size-4 shrink-0" />
                    {item.path}
                  </button>
                </li>
              ))}
            </ul>
          )}

          <figure className="m-0 flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-border">
            <figcaption className="flex h-10 shrink-0 items-center gap-2 border-b border-border px-3 font-mono text-[0.8125rem] text-muted-foreground">
              <FileCodeIcon className="size-4 shrink-0" />
              <span className="truncate">{file.path}</span>
              <span className="ml-auto">
                <CopyButton text={file.code} label={`Copy ${file.path}`} />
              </span>
            </figcaption>
            <div className="min-h-0 flex-1 overflow-auto bg-muted/30">
              <pre className="block-code m-0 flex min-w-max bg-transparent p-0 py-3 font-mono text-[0.8125rem] leading-6">
                <span aria-hidden className="sticky left-0 select-none bg-inherit px-4 text-right text-muted-foreground/60">
                  {Array.from({ length: file.lines }, (_, index) => (
                    <span key={index} className="block">
                      {index + 1}
                    </span>
                  ))}
                </span>
                <code
                  className={`language-${file.language} block pr-4`}
                  dangerouslySetInnerHTML={{ __html: file.html }}
                />
              </pre>
            </div>
          </figure>
        </div>
      )}
    </div>
  );
}

function ToolButton({
  label,
  pressed,
  href,
  onClick,
  children
}: {
  label: string;
  pressed?: boolean;
  href?: string;
  onClick?: () => void;
  children: ReactNode;
}) {
  const className = cn(
    'inline-flex size-6 items-center justify-center rounded-md text-muted-foreground no-underline outline-none transition-[color,background-color,transform] duration-150 ease-out hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.94]',
    pressed && 'bg-muted text-foreground'
  );

  return href ? (
    <a href={href} target="_blank" rel="noopener" aria-label={label} title={label} className={className}>
      {children}
    </a>
  ) : (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} className={className}>
      {children}
    </button>
  );
}

/**
 * Hands the block to an AI tool. Links can only carry a short prompt, so each one points the tool
 * at the block's Markdown (/blocks/<name>.md, every file in full) instead of the code itself.
 */
function OpenInMenu({ block, markdown }: { block: BlockMeta; markdown: string }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const prompt = () =>
    `Add the "${block.title}" block to my project. Its full source and dependencies are at ` +
    `${window.location.origin}/blocks/${block.name}.md. Read it, install the dependencies, and ` +
    `adapt the imports and styling to my codebase.`;

  const copyForAI = async () => {
    try {
      await navigator.clipboard.writeText(
        `Add this "${block.title}" block to my project, installing its dependencies and adapting ` +
          `the imports and styling to my codebase.\n\n${markdown}`
      );
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  const open = (base: string) => window.open(`${base}${encodeURIComponent(prompt())}`, '_blank', 'noopener');

  // The same logos as the home page's stack. Cursor's mark is black and ChatGPT's white, so each is
  // inverted in the color mode where it would vanish.
  const items = [
    { label: 'Copy for AI', icon: <ClipboardCopyIcon className="size-4 text-muted-foreground" />, onClick: copyForAI },
    {
      label: 'Open in Cursor',
      icon: <AppLogo src="/assets/images/skills/cursor.svg" className="dark:invert" />,
      onClick: () => open('https://cursor.com/link/prompt?text=')
    },
    {
      label: 'Open in Claude',
      icon: <AppLogo src="/assets/images/skills/claude.svg" />,
      onClick: () => open('https://claude.ai/new?q=')
    },
    {
      label: 'Open in ChatGPT',
      icon: <AppLogo src="/assets/images/skills/chatgpt.svg" className="invert dark:invert-0" />,
      onClick: () => open('https://chatgpt.com/?q=')
    }
  ];

  return (
    <Menu.Root>
      <Menu.Trigger
        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-border px-2.5 text-[0.8125rem] font-medium text-foreground outline-none transition-[background-color,transform] duration-150 ease-out hover:bg-muted focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.96] data-[popup-open]:bg-muted"
      >
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? 'copied' : 'open'}
            initial={{ opacity: 0, filter: 'blur(2px)' }}
            animate={{ opacity: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, filter: 'blur(2px)' }}
            transition={{ duration: 0.16, ease: EASE_OUT }}
            className="inline-flex items-center gap-1.5"
          >
            {copied ? <CheckIcon className="size-3.5 text-muted-foreground" /> : null}
            {copied ? 'Copied' : 'Open in'}
          </motion.span>
        </AnimatePresence>
        <ChevronDownIcon className="size-3.5 text-muted-foreground" />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner sideOffset={6} align="end" className="z-50">
          <Menu.Popup className="min-w-48 origin-[var(--transform-origin)] rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-lg outline-none transition-[opacity,transform] duration-150 ease-out data-[ending-style]:scale-95 data-[starting-style]:scale-95 data-[ending-style]:opacity-0 data-[starting-style]:opacity-0">
            {items.map((item) => (
              <Menu.Item
                key={item.label}
                onClick={item.onClick}
                className="flex h-8 cursor-default select-none items-center gap-2 rounded-lg px-2 text-sm outline-none data-[highlighted]:bg-muted"
              >
                {item.icon}
                {item.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

function AppLogo({ src, className }: { src: string; className?: string }) {
  return <img src={src} alt="" className={cn('pointer-events-none size-4 shrink-0 object-contain', className)} />;
}

function CopyButton({ text, label, withText }: { text: string; label: string; withText?: boolean }) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<number>(undefined);

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      return;
    }
    setCopied(true);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setCopied(false), 1600);
  };

  return (
    <button
      type="button"
      onClick={copy}
      aria-label={copied ? 'Copied' : label}
      title={label}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 text-muted-foreground outline-none transition-[color,background-color,transform] duration-150 ease-out hover:text-foreground focus-visible:ring-2 focus-visible:ring-foreground/30 active:scale-[0.96]',
        withText ? 'h-8 rounded-lg border border-border px-2.5 text-[0.8125rem] font-medium hover:bg-muted' : 'size-7 rounded-md hover:bg-muted'
      )}
    >
      <span className="relative inline-flex size-3.5">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.span
            key={copied ? 'done' : 'idle'}
            initial={{ opacity: 0, scale: 0.6, filter: 'blur(2px)' }}
            animate={{ opacity: 1, scale: 1, filter: 'blur(0px)' }}
            exit={{ opacity: 0, scale: 0.6, filter: 'blur(2px)' }}
            transition={{ duration: 0.18, ease: EASE_OUT }}
            className="inline-flex"
          >
            {copied ? <CheckIcon className="size-3.5" /> : <CopyIcon className="size-3.5" />}
          </motion.span>
        </AnimatePresence>
      </span>
      {withText && <span className="text-foreground">Copy code</span>}
    </button>
  );
}
