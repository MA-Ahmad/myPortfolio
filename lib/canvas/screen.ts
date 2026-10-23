import type { NextRouter } from 'next/router';

export type ScreenColors = {
  card: string;
  border: string;
  text: string;
  muted: string;
  backdrop: string;
  accent: string;
};

type Options = { href: string; title: string; route: string; colors: ScreenColors };

export type Screen = {
  /** Grows the screen out of `from`, powers it on, dives into it and opens the page. */
  run: (from: DOMRect) => void;
  /** Jumps straight to the page. */
  skip: () => void;
  /** Removes the screen and says so, unless it has already started running. */
  destroy: () => boolean;
};

type Rect = { left: number; top: number; width: number; height: number };

const HEADER_H = 40;
const RADIUS = 14;
const EXPAND_MS = 440;
// The page powers on this far into the expand, once it has loaded.
const POWER_AT = 0.6;
const LINE_MS = 140;
const OPEN_MS = 280;
const HOLD_MS = 140;
const DIVE_MS = 480;
// How long the real page plays its own entrance under the screen before the screen fades off it.
const SETTLE_MS = 1000;
const FADE_MS = 220;
const LOAD_TIMEOUT_MS = 5000;
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.7, 0, 0.2, 1)';
const SCREEN_OFF = '#0b0b0c';
const MONO = 'Cascadia, ui-monospace, SFMono-Regular, Menlo, monospace';

const px = ({ left, top, width, height }: Rect) => ({
  left: `${left}px`,
  top: `${top}px`,
  width: `${width}px`,
  height: `${height}px`
});

// The page the screen opens plays its entrance under the screen, where it can't be seen; parts
// whose entrance outlasts the handover skip it when they mount within this window.
const ARRIVAL_MS = 3000;
let arrivedAt = -Infinity;

/** Whether the current page was just opened out of a Theme Studio screen. */
export const openedFromScreen = () => performance.now() - arrivedAt < ARRIVAL_MS;

const wait = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  style: Partial<CSSStyleDeclaration>,
  parent?: HTMLElement
) {
  const node = document.createElement(tag);
  Object.assign(node.style, style);
  parent?.appendChild(node);
  return node;
}

/**
 * A screen the size of the viewport scaled down: the header on top, the page below at the
 * viewport's own aspect, so the page inside lays out exactly as it will once opened.
 */
function screenRect(vw: number, vh: number): Rect {
  const mobile = vw < 768;
  const maxH = vh * (mobile ? 0.7 : 0.78);
  const width = Math.min(mobile ? vw - 32 : Math.min(vw * 0.62, 1040), ((maxH - HEADER_H) * vw) / vh);
  const height = HEADER_H + (width * vh) / vw;
  return { left: (vw - width) / 2, top: (vh - height) / 2, width, height };
}

/**
 * The display grown into a real screen. It loads the page in a frame as soon as it is created,
 * so the page is usually ready by the time the screen is. It lives on the body rather than in
 * React, and paints only with inline styles, so it outlives the Theme Studio page: once the
 * page opens, the screen stays over it while it settles and then fades off, which hides the
 * page replaying its entrance. Everything here was already on screen inside the frame.
 */
export function createScreen(router: NextRouter, { href, title, route, colors }: Options): Screen {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;
  const target = screenRect(vw, vh);
  const full: Rect = { left: 0, top: -HEADER_H, width: vw, height: vh + HEADER_H };
  const scale = (rect: Rect) => `scale(${rect.width / vw})`;

  const root = element('div', { position: 'fixed', inset: '0', zIndex: '100', pointerEvents: 'none' });
  const backdrop = element(
    'div',
    { position: 'absolute', inset: '0', background: colors.backdrop, backdropFilter: 'blur(6px)', opacity: '0' },
    root
  );
  const shell = element(
    'div',
    {
      position: 'absolute',
      ...px(target),
      overflow: 'hidden',
      borderRadius: `${RADIUS}px`,
      background: colors.card,
      // An outline sits over the page inside, where a border would shift it.
      outline: `1px solid color-mix(in oklab, ${colors.accent} 45%, ${colors.border})`,
      outlineOffset: '-1px',
      boxShadow: `0 40px 100px -40px rgb(0 0 0 / 0.7), 0 0 60px -20px color-mix(in oklab, ${colors.accent} 45%, transparent)`,
      opacity: '0'
    },
    root
  );

  const header = element(
    'div',
    {
      display: 'flex',
      alignItems: 'center',
      gap: '9px',
      height: `${HEADER_H}px`,
      padding: '0 14px',
      boxSizing: 'border-box',
      borderBottom: `1px solid ${colors.border}`,
      color: colors.text,
      font: '500 13px var(--font-inter), system-ui, sans-serif',
      whiteSpace: 'nowrap',
      opacity: '0'
    },
    shell
  );
  element(
    'span',
    {
      width: '7px',
      height: '7px',
      borderRadius: '50%',
      background: colors.accent,
      boxShadow: `0 0 10px ${colors.accent}`
    },
    header
  );
  element('span', {}, header).textContent = title;
  element('span', { flex: '1' }, header);
  // A phone-width screen has room for the title and status only.
  if (target.width >= 420)
    element('span', { font: `400 11px ${MONO}`, color: colors.muted }, header).textContent = route;
  const status = element('span', { font: `400 11px ${MONO}`, color: colors.accent }, header);
  status.textContent = 'booting…';
  const blink = status.animate([{ opacity: 1 }, { opacity: 0.35 }], {
    duration: 600,
    direction: 'alternate',
    iterations: Infinity
  });

  const area = element(
    'div',
    { position: 'absolute', top: `${HEADER_H}px`, right: '0', bottom: '0', left: '0', overflow: 'hidden', background: SCREEN_OFF, opacity: '0' },
    shell
  );
  const frame = element(
    'iframe',
    {
      position: 'absolute',
      top: '0',
      left: '0',
      width: `${vw}px`,
      height: `${vh}px`,
      border: '0',
      transformOrigin: '0 0',
      transform: scale(target),
      clipPath: 'inset(50% 0 50% 0)',
      pointerEvents: 'none'
    },
    area
  );
  frame.title = title;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');
  const line = element(
    'div',
    {
      position: 'absolute',
      top: '50%',
      left: '0',
      right: '0',
      height: '2px',
      marginTop: '-1px',
      background: '#fff',
      boxShadow: `0 0 14px 2px ${colors.accent}`,
      transform: 'scaleX(0)',
      opacity: '0'
    },
    area
  );

  const loaded = new Promise<boolean>((resolve) => {
    frame.addEventListener('load', () => resolve(true), { once: true });
    window.setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
  });
  frame.src = href;
  document.body.appendChild(root);

  let stage: 'idle' | 'running' | 'leaving' | 'gone' = 'idle';

  const remove = () => {
    stage = 'gone';
    window.removeEventListener('keydown', onKey);
    root.remove();
  };

  /** Opens the page under the screen, then lets the screen fade off once the page has settled. */
  const leave = async () => {
    stage = 'leaving';
    window.removeEventListener('keydown', onKey);
    root.style.pointerEvents = 'none';
    arrivedAt = performance.now();
    try {
      await router.push(href);
    } catch {
      return remove();
    }
    // Scrolling before then would show the screen standing still over a moving page.
    await Promise.race([
      wait(SETTLE_MS),
      new Promise<void>((resolve) => {
        window.addEventListener('wheel', () => resolve(), { once: true, passive: true });
        window.addEventListener('touchmove', () => resolve(), { once: true, passive: true });
      })
    ]);
    await root.animate([{ opacity: 1 }, { opacity: 0 }], { duration: FADE_MS, easing: 'ease', fill: 'forwards' })
      .finished;
    remove();
  };

  const run = async (from: DOMRect) => {
    if (stage !== 'idle') return;
    stage = 'running';
    root.style.pointerEvents = 'auto';
    root.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', onKey);

    const start: Rect = { left: from.left, top: from.top, width: from.width, height: from.height };
    const grow = { duration: EXPAND_MS, easing: EASE_OUT, fill: 'forwards' } as const;
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { ...grow, easing: 'ease' });
    shell.animate([{ ...px(start), opacity: 0 }, { opacity: 1, offset: 0.25 }, { ...px(target), opacity: 1 }], grow);
    header.animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1 }], grow);
    area.animate([{ opacity: 0 }, { opacity: 1, offset: 0.4 }, { opacity: 1 }], grow);
    frame.animate([{ transform: scale(start) }, { transform: scale(target) }], grow);

    await wait(EXPAND_MS * POWER_AT);
    const ok = await loaded;
    if (stage !== 'running') return;
    if (!ok) return leave();

    // Power on like a tube: a bright line across the middle, then the picture opening out of it.
    line.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], {
      duration: LINE_MS,
      easing: EASE_OUT,
      fill: 'forwards'
    });
    await wait(LINE_MS * 0.8);
    line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OPEN_MS, easing: 'ease-out', fill: 'forwards' });
    await frame.animate(
      [
        { clipPath: 'inset(50% 0 50% 0)', filter: 'brightness(2.2)' },
        { clipPath: 'inset(0% 0 0% 0)', filter: 'brightness(1)' }
      ],
      { duration: OPEN_MS, easing: EASE_OUT, fill: 'forwards' }
    ).finished;
    blink.cancel();
    status.textContent = 'live';

    await wait(HOLD_MS);
    if (stage !== 'running') return;

    // Into the screen: it grows to the viewport and the header leaves over the top.
    const dive = { duration: DIVE_MS, easing: EASE_IN_OUT, fill: 'forwards' } as const;
    shell.animate(
      [
        { ...px(target), borderRadius: `${RADIUS}px`, outlineColor: shell.style.outlineColor },
        { ...px(full), borderRadius: '0px', outlineColor: 'transparent' }
      ],
      dive
    );
    await frame.animate([{ transform: scale(target) }, { transform: 'scale(1)' }], dive).finished;
    if (stage === 'running') leave();
  };

  function skip() {
    if (stage !== 'running') return;
    stage = 'leaving';
    loaded.then((ok) => {
      if (!ok) {
        remove();
        router.push(href);
        return;
      }
      root.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
      Object.assign(shell.style, px(full), { borderRadius: '0px', outlineColor: 'transparent', opacity: '1' });
      Object.assign(frame.style, { transform: 'scale(1)', clipPath: 'none' });
      Object.assign(backdrop.style, { opacity: '1' });
      Object.assign(area.style, { opacity: '1' });
      Object.assign(header.style, { opacity: '1' });
      leave();
    });
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') skip();
  }

  return {
    run,
    skip,
    destroy: () => {
      if (stage !== 'idle') return false;
      remove();
      return true;
    }
  };
}
