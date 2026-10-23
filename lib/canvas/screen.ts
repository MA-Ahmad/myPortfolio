import type { NextRouter } from 'next/router';

type Options = { href: string; title: string; colors: { backdrop: string; accent: string } };

export type Screen = {
  /** Grows `display` into a screen, powers it on with the page, dives into it and opens the page. */
  run: (display: HTMLElement) => void;
  /** Jumps straight to the page. */
  skip: () => void;
  /** Removes the screen and says so, unless it has already started running. */
  destroy: () => boolean;
};

type Rect = { left: number; top: number; width: number; height: number };

const EXPAND_MS = 520;
const STATIC_IN_MS = 160;
const LINE_MS = 150;
const OPEN_MS = 460;
const STATIC_OUT_MS = 420;
const SCANLINES_MS = 900;
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

/** Fills `canvas` with fresh grey static every frame until stopped. */
function runStatic(canvas: HTMLCanvasElement) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return () => {};
  const image = ctx.createImageData(canvas.width, canvas.height);
  let frame = 0;
  const draw = () => {
    const data = image.data;
    for (let i = 0; i < data.length; i += 4) {
      const v = Math.random() * 255;
      data[i] = data[i + 1] = data[i + 2] = v;
      data[i + 3] = 255;
    }
    ctx.putImageData(image, 0, 0);
    frame = requestAnimationFrame(draw);
  };
  draw();
  return () => cancelAnimationFrame(frame);
}

/**
 * The display grown into a screen showing the page. The page loads in a frame as soon as the
 * screen is created, before anyone plugs in, so it is ready by the time the display has grown.
 * When it runs, the screen takes on the display's own header, rows, footer and look, at its exact
 * place and size, so the display itself seems to grow: the rows fade into a dark tube, which
 * powers on old-TV style into the page, and then it dives into the page.
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
      clipPath: 'inset(50% 0 50% 0)',
      pointerEvents: 'none'
    },
    area
  );
  frame.title = title;
  frame.tabIndex = -1;
  frame.setAttribute('aria-hidden', 'true');

  // The tube: static, scanlines and the line it powers on from, drawn over the page.
  const noise = element(
    'canvas',
    { position: 'absolute', inset: '0', width: '100%', height: '100%', opacity: '0', filter: 'blur(0.6px)' },
    area
  );
  noise.width = 160;
  noise.height = Math.round((160 * vh) / vw);
  // The picture comes on blown out: a white wash over it that fades, cheaper than a filter.
  const flash = element('div', { position: 'absolute', inset: '0', background: '#fff', opacity: '0' }, area);
  const scanlines = element(
    'div',
    {
      position: 'absolute',
      inset: '0',
      background: 'repeating-linear-gradient(to bottom, rgb(0 0 0 / 0.45) 0 1px, transparent 1px 3px)',
      opacity: '0'
    },
    area
  );
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
      boxShadow: `0 0 16px 3px ${colors.accent}`,
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
  let full: Rect = { left: 0, top: 0, width: vw, height: vh };
  let stopStatic = () => {};

  const remove = () => {
    stage = 'gone';
    stopStatic();
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

    // Power on like an old set: blurry static, a bright line across the middle, then the picture
    // opening out of the line, blown out and soft before it settles.
    stopStatic = runStatic(noise);
    noise.animate([{ opacity: 0 }, { opacity: 0.55 }], { duration: STATIC_IN_MS, easing: 'ease-out', fill: 'forwards' });
    scanlines.animate([{ opacity: 0 }, { opacity: 1 }], { duration: STATIC_IN_MS, fill: 'forwards' });
    await wait(STATIC_IN_MS * 0.6);
    line.animate([{ transform: 'scaleX(0)', opacity: 1 }, { transform: 'scaleX(1)', opacity: 1 }], {
      duration: LINE_MS,
      easing: EASE_OUT,
      fill: 'forwards'
    });
    await wait(LINE_MS * 0.8);
    line.animate([{ opacity: 1 }, { opacity: 0 }], { duration: OPEN_MS * 0.6, easing: 'ease-out', fill: 'forwards' });
    noise.animate([{ opacity: 0.55 }, { opacity: 0 }], { duration: STATIC_OUT_MS, easing: 'ease-in', fill: 'forwards' });
    scanlines.animate([{ opacity: 1 }, { opacity: 0 }], { duration: SCANLINES_MS, easing: 'ease-in', fill: 'forwards' });
    const label = bottom.lastChild;
    if (label) label.textContent = `Showing ${title}`;
    // No filter on the frame: blurring a whole live page each frame stalls it. The soft static
    // fading over the picture and a fading white wash read as the blur and the glare.
    flash.animate([{ opacity: 0.7 }, { opacity: 0.25, offset: 0.4 }, { opacity: 0 }], {
      duration: OPEN_MS * 1.3,
      easing: 'ease-out',
      fill: 'forwards'
    });
    await frame.animate([{ clipPath: 'inset(50% 0 50% 0)' }, { clipPath: 'inset(0% 0 0% 0)' }], {
      duration: OPEN_MS,
      easing: EASE_OUT,
      fill: 'forwards'
    }).finished;
    window.setTimeout(() => stopStatic(), STATIC_OUT_MS);

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
      stopStatic();
      root.getAnimations({ subtree: true }).forEach((animation) => animation.cancel());
      Object.assign(shell.style, px(full), { transform: 'none', borderRadius: '0px', opacity: '1' });
      Object.assign(frame.style, { transform: 'scale(1)', clipPath: 'none' });
      Object.assign(flash.style, { opacity: '0' });
      Object.assign(backdrop.style, { opacity: '1' });
      Object.assign(area.style, { background: SCREEN_OFF });
      Object.assign(noise.style, { opacity: '0' });
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
