import { type CSSProperties, type MouseEvent, useEffect, useState } from 'react';
import NextLink from 'next/link';
import { useRouter } from 'next/router';
import { useReducedMotion } from 'framer-motion';
import { ArrowUpRight, House, Monitor, Moon, NotebookPen, SquareTerminal } from 'lucide-react';
import { CARDS, type CardId } from 'components/canvas/nodes';
import { packetIcon } from 'components/canvas/packets';
import { pixelNavigate } from 'lib/pixel-transition';
import styles from './studio-dock.module.css';

const HREF = '/theme-studio';
// One theme plugs in per cycle; the CSS timelines in studio-dock.module.css are built on it.
const CYCLE_MS = 3800;
const PACKETS = 3;
const PACKET_STAGGER_MS = 220;

const ICONS: Record<CardId, typeof House> = { home: House, terminal: SquareTerminal, notebook: NotebookPen, midnight: Moon };

/** Which page the card sits on; each look borrows that page's palette, type and wording. */
export type DockLook = 'site' | 'terminal' | 'notebook' | 'midnight';

const LABELS: Record<DockLook, { title: string; open: string; display: string }> = {
  site: { title: 'Theme Studio', open: 'Play', display: 'display' },
  terminal: { title: '~/theme-studio', open: 'play', display: 'tty0' },
  notebook: { title: 'theme studio', open: 'play', display: 'display' },
  midnight: { title: 'Theme Studio', open: 'Play', display: 'display' }
};

// The stage is drawn 1:1 in px: the cards stacked on the left, wired into the display.
const CARD = { w: 92, h: 28, gap: 8 };
const STAGE_H = 8 * 2 + CARDS.length * CARD.h + (CARDS.length - 1) * CARD.gap;
const DISPLAY = { x: 160, y: (STAGE_H - 88) / 2, w: 88, h: 88 };
const INPUT = { x: DISPLAY.x, y: DISPLAY.y + DISPLAY.h / 2 };
const portY = (index: number) => 8 + index * (CARD.h + CARD.gap) + CARD.h / 2;
const wire = (index: number) => {
  const y = portY(index);
  const bend = (INPUT.x - CARD.w) / 2;
  return `M ${CARD.w} ${y} C ${CARD.w + bend} ${y} ${INPUT.x - bend} ${INPUT.y} ${INPUT.x} ${INPUT.y}`;
};

/** The colors Theme Studio paints first, so the pixel transition hands over without a flash. */
function studioColors() {
  const dark = document.documentElement.classList.contains('dark');
  const root = getComputedStyle(document.documentElement);
  return { edge: root.getPropertyValue('--foreground').trim(), background: dark ? '#0a0a0b' : '#f6f6f4' };
}

/**
 * A small live Theme Studio pinned to the page's corner on desktop: every few seconds one theme
 * plugs into the display, its skill icons ride the wire and the screen switches on. It is all CSS
 * on a fixed stage, so a page pays for no canvas, previews or three.js.
 */
export function StudioDock({ look = 'site' }: { look?: DockLook }) {
  const router = useRouter();
  const reduced = useReducedMotion();
  const [cycle, setCycle] = useState(0);

  useEffect(() => {
    if (reduced) return;
    let timer: number | undefined;
    const next = () => {
      timer = window.setTimeout(() => {
        setCycle((count) => count + 1);
        next();
      }, CYCLE_MS);
    };
    // A hidden tab stops cycling, and picks up with a fresh plug-in when it comes back.
    const onVisibility = () => {
      window.clearTimeout(timer);
      if (document.visibilityState === 'visible') next();
    };
    next();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [reduced]);

  const open = (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
    event.preventDefault();
    pixelNavigate(router, HREF, { origin: inputOrigin(event.currentTarget), ...studioColors() });
  };

  const activeIndex = cycle % CARDS.length;
  const active = CARDS[activeIndex];
  const ActiveIcon = ICONS[active.id];
  const labels = LABELS[look];

  return (
    <NextLink
      href={HREF}
      onClick={open}
      onMouseEnter={() => router.prefetch(HREF)}
      className={styles.dock}
      aria-label="Open Theme Studio: wire a theme into the display"
      data-look={look}
      data-reduced={reduced || undefined}
    >
      {look === 'midnight'
        ? (['Tl', 'Tr', 'Bl', 'Br'] as const).map((corner) => (
            <span key={corner} className={`${styles.bracket} ${styles[`bracket${corner}`]}`} aria-hidden />
          ))
        : null}
      <span className={styles.head}>
        <span className={styles.title}>{labels.title}</span>
        <span className={styles.open}>
          {labels.open}
          <ArrowUpRight className="size-3.5" aria-hidden />
        </span>
      </span>

      <span
        className={styles.stage}
        aria-hidden
        style={{ height: STAGE_H, '--accent': `var(--dock-${active.id})` } as CSSProperties}
      >
        <svg className={styles.wires} width={DISPLAY.x + DISPLAY.w} height={STAGE_H}>
          {CARDS.map((card, index) => (
            <path
              key={card.id}
              d={wire(index)}
              className={styles.wire}
              data-lit={index === activeIndex || undefined}
              style={{ '--wire': `var(--dock-${card.id})` } as CSSProperties}
            />
          ))}
          <circle className={styles.input} cx={INPUT.x} cy={INPUT.y} r={3.5} />
        </svg>

        {CARDS.map((card, index) => {
          const Icon = ICONS[card.id];
          return (
            <span
              key={card.id}
              className={styles.card}
              data-lit={index === activeIndex || undefined}
              style={{ top: portY(index) - CARD.h / 2, '--card': `var(--dock-${card.id})` } as CSSProperties}
            >
              <Icon className={styles.cardIcon} />
              {card.title}
              <span className={styles.port} />
            </span>
          );
        })}

        <span
          className={styles.display}
          style={{ left: DISPLAY.x, top: DISPLAY.y, width: DISPLAY.w, height: DISPLAY.h }}
        >
          <span className={styles.displayBar}>
            <Monitor className="size-2.5" />
            {labels.display}
          </span>
          <span key={cycle} className={styles.screen}>
            <ActiveIcon className={styles.screenIcon} />
            <span className={styles.screenTitle}>{active.title}</span>
          </span>
        </span>

        {!reduced &&
          active.packets.slice(0, PACKETS).map((icon, index) => (
            <span
              key={`${cycle}-${index}`}
              className={styles.packet}
              style={{ offsetPath: `path('${wire(activeIndex)}')`, animationDelay: `${index * PACKET_STAGGER_MS}ms` }}
            >
              <img src={packetIcon(icon)} alt="" loading="lazy" />
            </span>
          ))}
      </span>
    </NextLink>
  );
}

/** The display's input on screen, where the transition's pixels start falling. */
function inputOrigin(dock: HTMLElement) {
  const stage = dock.querySelector(`.${styles.stage}`)!.getBoundingClientRect();
  return { x: stage.left + INPUT.x, y: stage.top + INPUT.y };
}
