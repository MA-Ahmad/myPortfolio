/**
 * Redraw (`components/redraw/*`): a crew of agents takes the home page apart and draws it back,
 * layer by layer. The top nav button and the command menu ask for a run with this event; the
 * home page listens for it and loads the redraw code only then, so the page carries none of it.
 */
export const REDRAW_EVENT = 'redraw:start';

/** Where the agents fly out from, in viewport coordinates (the button that was pressed). */
export type RedrawOrigin = { x: number; y: number };

const PENDING = 'data-redraw-pending';

/**
 * Blanks the page on the press itself, before the redraw code has loaded, so the run starts from
 * an empty canvas with no fade. The engine takes over from this attribute when it starts; the
 * timeout only matters if the code never arrives (offline), so the page can't stay blank.
 */
export function blankPage() {
  const root = document.documentElement;
  root.setAttribute(PENDING, '');
  window.setTimeout(() => {
    if (!root.hasAttribute('data-redraw')) root.removeAttribute(PENDING);
  }, 5000);
}

export function clearBlankPage() {
  document.documentElement.removeAttribute(PENDING);
}

export function requestRedraw(from?: Element | null) {
  blankPage();
  let detail: RedrawOrigin | undefined;
  if (from) {
    const rect = from.getBoundingClientRect();
    detail = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
  }
  window.dispatchEvent(new CustomEvent<RedrawOrigin | undefined>(REDRAW_EVENT, { detail }));
}

/** `/?redraw=1` starts a run on load, so the command menu can ask for one from any page. */
export const isRedrawQuery = (value: unknown) => value === '1';

/** Warms the chunk on hover, so the first press starts without waiting on the network. */
export const preloadRedraw = () => import('components/redraw/redraw');
