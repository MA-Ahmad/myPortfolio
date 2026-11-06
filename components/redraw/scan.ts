/**
 * Turns the live page into the layers the agents redraw. Nothing is cloned: every layer is a real
 * element, hidden with `visibility` (which a child can override, so layers nest) and shown again
 * when its agent finishes it. Text is revealed through the CSS Custom Highlight API, so typing
 * never changes the layout.
 */

/** frame: a box with its own paint. media: a picture, traced or developed. text: typed out.
 * wipe: thin lines and stripes, swept across. sequence: a row of capsules or a grid of cells,
 * put down one item at a time. */
export type LayerKind = 'frame' | 'media' | 'text' | 'wipe' | 'sequence';

export type Rect = { x: number; y: number; w: number; h: number };

export interface Layer {
  index: number;
  el: Element;
  kind: LayerKind;
  /** The nearest layer it sits in; it is drawn only once that one is done. */
  parent: number;
  depth: number;
  /** For text layers: the text nodes it types out, in order. */
  texts: Text[];
  /** For sequence layers: the items it puts down, one by one. */
  items: Element[];
  chars: number;
  /** Document coordinates, refreshed while the run goes on. */
  rect: Rect;
  /** Which way a wipe sweeps. */
  axis: 'x' | 'y';
  /** Fixed or sticky: its page position moves with the scroll, so the camera ignores it. */
  fixed: boolean;
  status: 'pending' | 'active' | 'done';
}

export type Scan = { layers: Layer[]; keep: Element[] };

const MEDIA = new Set(['img', 'svg', 'canvas', 'video', 'picture', 'iframe']);
const SKIP = new Set([
  'script',
  'style',
  'template',
  'noscript',
  'link',
  'meta',
  'br',
  'wbr',
  'head'
]);
const SIDES = ['Top', 'Right', 'Bottom', 'Left'] as const;

export function docRect(el: Element): Rect {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + window.scrollX,
    y: rect.top + window.scrollY,
    w: rect.width,
    h: rect.height
  };
}

const isClear = (color: string) =>
  !color || color === 'transparent' || /,\s*0\)$/.test(color) || /\/\s*0\)$/.test(color);

const hasPseudo = (el: Element, which: '::before' | '::after') => {
  const content = getComputedStyle(el, which).content;
  return Boolean(content) && content !== 'none' && content !== 'normal';
};

/** Whether the element paints anything itself, apart from its children. */
function paints(el: Element, style: CSSStyleDeclaration) {
  if (!isClear(style.backgroundColor) || style.backgroundImage !== 'none') return true;
  if (style.boxShadow !== 'none') return true;
  for (const side of SIDES) {
    if (
      parseFloat(style[`border${side}Width`]) > 0 &&
      style[`border${side}Style`] !== 'none' &&
      !isClear(style[`border${side}Color`])
    ) {
      return true;
    }
  }
  return hasPseudo(el, '::before') || hasPseudo(el, '::after');
}

/** Many small children in a row (a heatmap, a dot grid): one layer, put down cell by cell. */
function isDenseGrid(el: Element) {
  if (el.children.length < 24) return false;
  let small = 0;
  for (const child of Array.from(el.children)) {
    const rect = child.getBoundingClientRect();
    if (rect.width <= 24 && rect.height <= 24) small += 1;
  }
  return small / el.children.length > 0.8;
}

const shown = (el: Element) =>
  Array.from(el.children).filter((child) => getComputedStyle(child).display !== 'none');

/** The box that draws a capsule: the item itself, or its only child (`li > span`). */
function capsuleOf(item: Element) {
  let el: Element = item;
  for (let depth = 0; depth < 3; depth += 1) {
    // A small picture counts too: the swatches of a legend, a row of icons.
    if (MEDIA.has(el.tagName.toLowerCase()) || paints(el, getComputedStyle(el))) return el;
    const kids = shown(el);
    if (kids.length !== 1) return null;
    el = kids[0];
  }
  return null;
}

/**
 * A row of capsules: skill badges, tags, chips, a row of round icon buttons. At least three
 * small, similar-height boxes that each paint themselves. They are put down one after another,
 * in reading order, instead of all at once.
 */
function isCapsuleRow(el: Element) {
  const kids = shown(el);
  if (kids.length < 3) return false;
  let low = Infinity;
  let high = 0;
  let capsules = 0;
  for (const kid of kids) {
    const rect = kid.getBoundingClientRect();
    if (rect.height < 4 || rect.height > 44 || rect.width > 280) return false;
    if (capsuleOf(kid)) {
      capsules += 1;
      low = Math.min(low, rect.height);
      high = Math.max(high, rect.height);
    } else if (kid.children.length || (kid.textContent ?? '').trim().length > 24) {
      // Short labels may sit in the row ("Less ■■■■ More"); anything bigger is not a row.
      return false;
    }
  }
  return capsules >= 3 && high <= low * 1.6;
}

function isPictureStack(el: Element, box: DOMRect) {
  const kids = Array.from(el.children).filter(
    (child) => getComputedStyle(child).display !== 'none'
  );
  if (kids.length < 2) return false;
  return kids.every((child) => {
    if (!MEDIA.has(child.tagName.toLowerCase())) return false;
    const rect = child.getBoundingClientRect();
    return (
      Math.abs(rect.left - box.left) < 3 &&
      Math.abs(rect.top - box.top) < 3 &&
      Math.abs(rect.width - box.width) < 3 &&
      Math.abs(rect.height - box.height) < 3
    );
  });
}

/**
 * Collects the text an element types out: its own text nodes and those of plain inline children
 * (`<b>`, `<a>`, `<span>`). Anything else inside becomes its own layer later.
 */
function absorb(node: Element, texts: Text[], rest: Element[]) {
  for (const child of Array.from(node.childNodes)) {
    if (child.nodeType === Node.TEXT_NODE) {
      if (/\S/.test((child as Text).data)) texts.push(child as Text);
      continue;
    }
    if (child.nodeType !== Node.ELEMENT_NODE) continue;
    const el = child as Element;
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) continue;
    const style = getComputedStyle(el);
    if (style.display === 'none') continue;
    if (style.display === 'inline' && !MEDIA.has(tag) && !el.hasAttribute('data-redraw-ignore')) {
      absorb(el, texts, rest);
    } else {
      rest.push(el);
    }
  }
}

export function scanPage(root: Element): Scan {
  const layers: Layer[] = [];
  const keep: Element[] = [];

  const push = (
    el: Element,
    kind: LayerKind,
    parent: number,
    depth: number,
    fixed: boolean,
    texts: Text[] = [],
    items: Element[] = []
  ) => {
    const rect = docRect(el);
    layers.push({
      index: layers.length,
      el,
      kind,
      parent,
      depth,
      texts,
      chars: texts.reduce((sum, text) => sum + text.data.length, 0),
      items,
      rect,
      axis: rect.h > rect.w * 2 ? 'y' : 'x',
      fixed,
      status: 'pending'
    });
    return layers.length - 1;
  };

  const visit = (el: Element, parent: number, depth: number, insideFixed: boolean) => {
    const tag = el.tagName.toLowerCase();
    if (SKIP.has(tag)) return;
    if (el.hasAttribute('data-redraw-ignore')) {
      keep.push(el);
      return;
    }
    // Not part of the drawing at all: hidden by CSS for the whole run, back when it ends.
    if (el.hasAttribute('data-redraw-skip')) return;
    const style = getComputedStyle(el);
    // Already hidden: leave it alone, the page decides when it shows.
    if (style.display === 'none' || style.visibility !== 'visible') return;

    const box = el.getBoundingClientRect();
    const sized = box.width >= 1 && box.height >= 1;
    const fixed = insideFixed || style.position === 'fixed' || style.position === 'sticky';

    if (MEDIA.has(tag) || /url\(/.test(style.backgroundImage)) {
      if (sized) push(el, 'media', parent, depth, fixed);
      return;
    }

    // A stack of pictures filling one box (an image under its canvases) is one picture.
    if (sized && isPictureStack(el, box)) {
      push(el, 'media', parent, depth, fixed);
      return;
    }

    const texts: Text[] = [];
    const rest: Element[] = [];
    absorb(el, texts, rest);

    if (sized && !texts.length && (isDenseGrid(el) || isCapsuleRow(el))) {
      // The row itself (its own border or background) comes with the first item.
      push(el, 'sequence', parent, depth, fixed, [], shown(el));
      return;
    }

    let self = parent;
    if (sized && (texts.length || paints(el, style))) {
      const thin = box.width > box.height * 8 || box.height > box.width * 8;
      self = push(el, texts.length ? 'text' : thin ? 'wipe' : 'frame', parent, depth, fixed, texts);
    }
    for (const child of rest) visit(child, self, self === parent ? depth : depth + 1, fixed);
  };

  for (const child of Array.from(root.children)) visit(child, -1, 0, false);
  return { layers, keep };
}
