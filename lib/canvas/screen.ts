import type { NextRouter } from 'next/router';

type Options = { href: string; title: string; colors: { backdrop: string; accent: string } };

export type Screen = {
  /** Grows `display` into a screen, brings the page up on it, dives into it and opens the page. */
  run: (display: HTMLElement) => void;
  /** Settles once the page has loaded in the screen, or has taken too long to (false). */
  ready: Promise<boolean>;
  /** Jumps straight to the page. */
  skip: () => void;
  /** Removes the screen and says so, unless it has already started running. */
  destroy: () => boolean;
};

type Rect = { left: number; top: number; width: number; height: number };

const EXPAND_MS = 520;
const OPEN_MS = 360;
const HOLD_MS = 220;
const DIVE_MS = 520;
// How long the real page plays its own entrance under the screen before the screen fades off it.
const SETTLE_MS = 1000;
const FADE_MS = 220;
const LOAD_TIMEOUT_MS = 5000;
const EASE_OUT = 'cubic-bezier(0.32, 0.72, 0, 1)';
const EASE_IN_OUT = 'cubic-bezier(0.7, 0, 0.2, 1)';
const SCREEN_OFF = '#0b0b0c';
// The theme tokens the display's own markup reads; the screen lives outside the canvas, so it
// carries them over.
const TOKENS = ['--cv-card', '--cv-card-raised', '--cv-border', '--cv-border-strong', '--cv-text', '--cv-muted', '--cv-wire', '--accent'];

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

let cleared: Promise<void> = Promise.resolve();

/**
 * Resolves once a screen opening a page has faded off it (at once when none is). Pages hold
 * anything the visitor should hear or see start, such as sound, until then.
 */
export const screenCleared = () => cleared;

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
 * The display grown into a screen showing the page. The page loads in a frame as soon as the
 * screen is created, before anyone plugs in, so it is ready by the time the display has grown.
 * When it runs, the screen takes on the display's own header, rows, footer and look, at its exact
 * place and size, so the display itself seems to grow: its finished progress bar fades into the
 * dark screen, the page comes up on it, and then it dives into the page.
 *
 * It lives on the body rather than in React, and positions everything inline, so it outlives the
 * Theme Studio page: once the page opens, the screen stays over it while it settles and then
 * fades off, which hides the page replaying its entrance.
 */
export function createScreen(router: NextRouter, { href, title, colors }: Options): Screen {
  const vw = document.documentElement.clientWidth;
  const vh = window.innerHeight;

  const root = element('div', { position: 'fixed', inset: '0', zIndex: '100', pointerEvents: 'none' });
  const backdrop = element(
    'div',
    { position: 'absolute', inset: '0', background: colors.backdrop, backdropFilter: 'blur(6px)', opacity: '0' },
    root
  );
  const shell = element(
    'div',
    { position: 'absolute', left: '0', top: '0', boxSizing: 'border-box', overflow: 'hidden', opacity: '0' },
    root
  );
  const area = element('div', { position: 'absolute', left: '0', right: '0', overflow: 'hidden' }, shell);
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
      opacity: '0',
      pointerEvents: 'none'
    },
    area
  );
  frame.title = title;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');

  const loaded = new Promise<boolean>((resolve) => {
    frame.addEventListener('load', () => resolve(true), { once: true });
    window.setTimeout(() => resolve(false), LOAD_TIMEOUT_MS);
  });
  frame.src = href;
  document.body.appendChild(root);

  let stage: 'idle' | 'running' | 'leaving' | 'gone' = 'idle';
  let clear = () => {};
  let full: Rect = { left: 0, top: 0, width: vw, height: vh };

  const remove = () => {
    stage = 'gone';
    window.removeEventListener('keydown', onKey);
    root.remove();
    clear();
  };

  /** Opens the page under the screen, then lets the screen fade off once the page has settled. */
  const leave = async () => {
    stage = 'leaving';
    cleared = new Promise((resolve) => (clear = resolve));
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

  /**
   * Dresses the shell as `display`: its look frozen inline, its header and footer copied on top
   * and bottom, its rows over a screen that is still off. Returns where it starts and the room
   * the header, footer and border take.
   */
  const becomeDisplay = (display: HTMLElement) => {
    const css = getComputedStyle(display);
    Object.assign(shell.style, {
      background: css.backgroundColor,
      border: `1px solid ${css.borderTopColor}`,
      borderRadius: css.borderTopLeftRadius,
      boxShadow: css.boxShadow,
      color: css.color,
      font: css.font
    });
    TOKENS.forEach((token) => shell.style.setProperty(token, css.getPropertyValue(token)));

    const header = display.querySelector<HTMLElement>(':scope > header')!;
    const status = display.querySelector<HTMLElement>(':scope > [role="status"]')!;
    const rows = Array.from(display.children).find(
      (child) => child.tagName === 'DIV' && child !== status
    ) as HTMLElement;
    const headerH = header.offsetHeight;
    const footerH = status.offsetHeight;

    const top = header.cloneNode(true) as HTMLElement;
    Object.assign(top.style, { position: 'absolute', top: '0', left: '0', right: '0' });
    const bottom = status.cloneNode(true) as HTMLElement;
    Object.assign(bottom.style, { position: 'absolute', bottom: '0', left: '0', right: '0' });
    bottom.removeAttribute('role');
    const content = rows.cloneNode(true) as HTMLElement;
    // A display that already plays the page hands over to this screen's own copy of it; a cloned
    // frame would load the page a third time.
    content.querySelectorAll('iframe').forEach((copy) => copy.remove());
    // A copied canvas comes up blank: the progress bar is drawn into its copy as it stands.
    const canvases = rows.querySelectorAll('canvas');
    content.querySelectorAll('canvas').forEach((copy, i) => {
      const source = canvases[i];
      copy.width = source.width;
      copy.height = source.height;
      copy.getContext('2d')?.drawImage(source, 0, 0);
    });
    Object.assign(content.style, { position: 'absolute', top: '0', left: '0', width: `${rows.offsetWidth}px` });
    // Added beside the frame, never around it: moving a frame reloads it.
    shell.insertBefore(top, area);
    shell.appendChild(bottom);
    area.insertBefore(content, frame);
    Object.assign(area.style, { top: `${headerH}px`, bottom: `${footerH}px` });

    // The display may be swollen and the canvas scaled, so it starts at its layout size, scaled
    // about its center to match what is on screen.
    const rect = display.getBoundingClientRect();
    const width = display.offsetWidth;
    const height = display.offsetHeight;
    const start = {
      left: rect.left + rect.width / 2 - width / 2,
      top: rect.top + rect.height / 2 - height / 2,
      width,
      height
    };
    return { start, scale: rect.width / width, chromeY: headerH + footerH + 2, headerH, content, bottom };
  };

  const run = async (display: HTMLElement) => {
    if (stage !== 'idle') return;
    stage = 'running';
    root.style.pointerEvents = 'auto';
    root.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', onKey);

    const { start, scale, chromeY, headerH, content, bottom } = becomeDisplay(display);
    // The screen keeps the viewport's aspect below the header and above the footer.
    const mobile = vw < 768;
    const maxH = vh * (mobile ? 0.72 : 0.8);
    const areaW = Math.min(mobile ? vw - 34 : Math.min(vw * 0.62, 1040), ((maxH - chromeY) * vw) / vh);
    const target: Rect = {
      width: areaW + 2,
      height: chromeY + (areaW * vh) / vw,
      left: (vw - areaW - 2) / 2,
      top: (vh - chromeY - (areaW * vh) / vw) / 2
    };
    // Diving in, the page fills the viewport and the header and footer leave past its edges.
    full = { left: -1, top: -headerH - 1, width: vw + 2, height: vh + chromeY };
    frame.style.transform = `scale(${areaW / vw})`;
    Object.assign(shell.style, px(start), { transform: `scale(${scale})`, opacity: '1' });

    // The same display grows; its rows fade as the middle goes dark like a tube switched off.
    const grow = { duration: EXPAND_MS, easing: EASE_OUT, fill: 'forwards' } as const;
    backdrop.animate([{ opacity: 0 }, { opacity: 1 }], { ...grow, easing: 'ease' });
    shell.animate([{ ...px(start), transform: `scale(${scale})` }, { ...px(target), transform: 'scale(1)' }], grow);
    content.animate([{ opacity: 1 }, { opacity: 0, offset: 0.45 }, { opacity: 0 }], grow);
    area.animate([{ background: 'transparent' }, { background: SCREEN_OFF, offset: 0.6 }, { background: SCREEN_OFF }], grow);
    await wait(EXPAND_MS);

    const ok = await loaded;
    if (stage !== 'running') return;
    if (!ok) return leave();

    // The page comes up on the dark screen.
    const label = bottom.lastChild;
    if (label) label.textContent = `Showing ${title}`;
    await frame.animate([{ opacity: 0 }, { opacity: 1 }], {
      duration: OPEN_MS,
      easing: 'ease-out',
      fill: 'forwards'
    }).finished;

    await wait(HOLD_MS);
    if (stage !== 'running') return;

    // Into the screen: the page grows to the viewport and the header and footer leave past it.
    const dive = { duration: DIVE_MS, easing: EASE_IN_OUT, fill: 'forwards' } as const;
    shell.animate(
      [
        { ...px(target), borderRadius: shell.style.borderRadius },
        { ...px(full), borderRadius: '0px' }
      ],
      dive
    );
    await frame.animate([{ transform: `scale(${areaW / vw})` }, { transform: 'scale(1)' }], dive).finished;
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
      Object.assign(shell.style, px(full), { transform: 'none', borderRadius: '0px', opacity: '1' });
      Object.assign(frame.style, { transform: 'scale(1)', opacity: '1' });
      Object.assign(backdrop.style, { opacity: '1' });
      Object.assign(area.style, { background: SCREEN_OFF });
      leave();
    });
  }

  function onKey(event: KeyboardEvent) {
    if (event.key === 'Escape' || event.key === 'Enter' || event.key === ' ') skip();
  }

  return {
    run,
    ready: loaded,
    skip,
    destroy: () => {
      if (stage !== 'idle') return false;
      remove();
      return true;
    }
  };
}
