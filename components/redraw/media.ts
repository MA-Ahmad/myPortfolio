/**
 * How the agents draw pictures. Nothing appears at once:
 *
 * - Vector art is traced stroke by stroke like a pen plotter, each shape's outline drawn with a
 *   dash that grows from 0 to its full length (`pathLength="1"` makes every shape the same unit
 *   long). Filled shapes get a temporary hairline outline that hands over to the fill with a
 *   crossfade, so the fill never pops in.
 * - Raster images, canvases and backgrounds are developed like a print: a soft-edged mask reveals
 *   them row by row while the print head (the agent) runs across them in a zig-zag, and the whole
 *   picture sharpens from a grey blur to full colour as it fills.
 *
 * Every style it touches is written inline and stashed first, so `restore` hands each element
 * back exactly as it was, whether the drawing finished or was cut short.
 */

export type Point = { x: number; y: number };

export interface MediaDrawing {
  /** Run time in seconds at 1x. */
  duration: number;
  /** Paints progress `p` (0..1) and returns where the pen is, in page coordinates. */
  step(p: number): Point;
  /** Where the pen starts, for the agent to travel to. */
  start: Point;
  /** For sequences: how many items have been put down so far (each one gets a click). */
  placed?: number;
}

const GEOMETRY = 'path, line, polyline, polygon, rect, circle, ellipse';
const STYLE_PROPS = [
  'stroke-dasharray',
  'stroke-dashoffset',
  'stroke',
  'stroke-width',
  'stroke-opacity',
  'fill-opacity',
  'visibility',
  'filter',
  'mask-image',
  '-webkit-mask-image',
  'opacity',
  'scale',
  'transform-box',
  'transform-origin'
];

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
/** A gentle overshoot (about 6%), for an item that lands and settles. */
const easeOutBack = (t: number) => {
  const c = 1.2;
  return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
};

const centerOf = (el: Element): Point => {
  const rect = el.getBoundingClientRect();
  return {
    x: rect.left + rect.width / 2 + window.scrollX,
    y: rect.top + rect.height / 2 + window.scrollY
  };
};

/**
 * Puts items down one after another: each one fades and grows into place (scale and opacity
 * only), on a stagger that walks the order. `order` is reading order for rows of capsules, or
 * column by column for a calendar grid, the way GitHub fills a year week by week.
 */
export function placeInSequence(
  items: Element[],
  order: 'reading' | 'columns',
  stash: Stash
): MediaDrawing | null {
  const visible = items.filter((el) => {
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  });
  if (!visible.length) return null;

  const boxes = visible.map((el) => ({ el, rect: el.getBoundingClientRect() }));
  let delays: number[];
  let pop: number;
  if (order === 'columns') {
    // Left to right across the weeks; down each week a touch later, so every column runs
    // top to bottom. Labels above a column land with it.
    const left = Math.min(...boxes.map(({ rect }) => rect.left));
    const right = Math.max(...boxes.map(({ rect }) => rect.left));
    const top = Math.min(...boxes.map(({ rect }) => rect.top));
    const columns = new Set(boxes.map(({ rect }) => Math.round(rect.left))).size;
    const sweep = Math.min(2.6, Math.max(1.2, columns * 0.04));
    const cell = Math.max(1, Math.min(...boxes.map(({ rect }) => rect.height)));
    delays = boxes.map(
      ({ rect }) =>
        ((rect.left - left) / Math.max(1, right - left)) * sweep +
        Math.max(0, (rect.top - top) / cell) * 0.006
    );
    pop = 0.22;
  } else {
    // Reading order: group items that share a line (they overlap vertically, whatever their
    // heights), then left to right within each line.
    boxes.sort((a, b) => a.rect.top + a.rect.height / 2 - (b.rect.top + b.rect.height / 2));
    const lines: (typeof boxes)[] = [];
    let bottom = -Infinity;
    for (const box of boxes) {
      const middle = box.rect.top + box.rect.height / 2;
      if (middle > bottom || !lines.length) {
        lines.push([]);
        bottom = box.rect.bottom;
      } else {
        bottom = Math.max(bottom, box.rect.bottom);
      }
      lines[lines.length - 1].push(box);
    }
    boxes.splice(
      0,
      boxes.length,
      ...lines.flatMap((line) => line.sort((a, b) => a.rect.left - b.rect.left))
    );
    const step = Math.min(0.12, Math.max(0.05, 1.6 / boxes.length));
    delays = boxes.map((_, index) => index * step);
    pop = 0.32;
  }
  const order_ = delays.map((delay, index) => ({ delay, index })).sort((a, b) => a.delay - b.delay);

  for (const { el } of boxes) {
    stash.keep(el);
    const style = (el as HTMLElement).style;
    style.setProperty('opacity', '0');
    style.setProperty('scale', '0.6');
    // SVG cells grow from their own centre, not the drawing's origin.
    style.setProperty('transform-box', 'fill-box');
    style.setProperty('transform-origin', 'center');
  }

  const last = Math.max(...delays);
  const duration = last + pop;
  const drawing: MediaDrawing = {
    duration,
    placed: 0,
    start: centerOf(boxes[order_[0].index].el),
    step(p) {
      const t = p * duration;
      let placed = 0;
      let current = order_[0].index;
      for (const { delay, index } of order_) {
        const local = clamp01((t - delay) / pop);
        if (local <= 0) break;
        placed += 1;
        current = index;
        const style = (boxes[index].el as HTMLElement).style;
        style.setProperty('opacity', String(easeOut(Math.min(1, local * 1.8))));
        style.setProperty('scale', String(0.6 + 0.4 * easeOutBack(local)));
      }
      drawing.placed = placed;
      return centerOf(boxes[current].el);
    }
  };
  return drawing;
}

type Saved = { styles: [string, string, string][]; attrs: [string, string | null][] };

/** Original inline styles and attributes of everything a drawing touched. */
export class Stash {
  private saved = new Map<Element, Saved>();
  private undo = new Map<Element, () => void>();

  /** Runs `fn` when `el` is restored (to take out a temporary stand-in). */
  defer(el: Element, fn: () => void) {
    this.keep(el);
    this.undo.set(el, fn);
  }

  keep(el: Element, attrs: string[] = []) {
    if (this.saved.has(el)) return;
    const style = (el as HTMLElement).style;
    this.saved.set(el, {
      styles: STYLE_PROPS.map((prop) => [
        prop,
        style.getPropertyValue(prop),
        style.getPropertyPriority(prop)
      ]),
      attrs: attrs.map((name) => [name, el.getAttribute(name)])
    });
  }

  restore(el: Element) {
    this.undo.get(el)?.();
    this.undo.delete(el);
    const saved = this.saved.get(el);
    if (!saved) return;
    const style = (el as HTMLElement).style;
    for (const [prop, value, priority] of saved.styles) {
      if (value) style.setProperty(prop, value, priority);
      else style.removeProperty(prop);
    }
    for (const [name, value] of saved.attrs) {
      if (value === null) el.removeAttribute(name);
      else el.setAttribute(name, value);
    }
    this.saved.delete(el);
  }

  restoreWithin(root: Element) {
    for (const el of Array.from(this.saved.keys())) {
      if (el === root || root.contains(el)) this.restore(el);
    }
  }

  restoreAll() {
    for (const el of Array.from(this.saved.keys())) this.restore(el);
  }
}

function toPage(el: SVGGraphicsElement, x: number, y: number): Point | null {
  const matrix = el.getScreenCTM();
  if (!matrix) return null;
  const point = new DOMPoint(x, y).matrixTransform(matrix);
  return { x: point.x + window.scrollX, y: point.y + window.scrollY };
}

type Shape = {
  el: SVGGeometryElement;
  length: number;
  /** Traced with a dash; otherwise it only fades its fill in at the end. */
  traced: boolean;
  filled: boolean;
  /** Traced with a borrowed hairline because the shape has no stroke of its own. */
  borrowed: boolean;
  fillOpacity: number;
  /** Shapes on the same path share a slot, so their strokes are drawn together. */
  slot: number;
};

const HIDDEN_DEFS = 'pattern, mask, clipPath, marker';
const SVG_NS = 'http://www.w3.org/2000/svg';

/**
 * A `<use>` paints a copy of a shape in `<defs>`, and browsers don't reliably repaint that copy
 * while the source's dash moves. So while a picture is drawn each `<use>` is swapped for a plain
 * copy of what it shows, with the same attributes; the copy is traced and taken out afterwards.
 */
function standInForUses(svg: SVGSVGElement, stash: Stash) {
  for (const use of Array.from(svg.querySelectorAll<SVGUseElement>('use'))) {
    if (use.closest(`defs, ${HIDDEN_DEFS}`)) continue;
    const href = use.getAttribute('href') ?? use.getAttribute('xlink:href');
    if (!href?.startsWith('#')) continue;
    const target = svg.querySelector(`[id="${CSS.escape(href.slice(1))}"]`);
    if (!target || target.tagName.toLowerCase() === 'symbol') continue;

    const stand = document.createElementNS(SVG_NS, 'g');
    stand.setAttribute('data-redraw-stand-in', '');
    for (const attr of Array.from(use.attributes)) {
      if (!['href', 'xlink:href', 'x', 'y', 'width', 'height', 'id'].includes(attr.name)) {
        stand.setAttribute(attr.name, attr.value);
      }
    }
    const x = parseFloat(use.getAttribute('x') ?? '0') || 0;
    const y = parseFloat(use.getAttribute('y') ?? '0') || 0;
    if (x || y) {
      stand.setAttribute(
        'transform',
        `${use.getAttribute('transform') ?? ''} translate(${x} ${y})`
      );
    }
    const copy = target.cloneNode(true) as Element;
    for (const el of [copy, ...Array.from(copy.querySelectorAll('[id]'))]) el.removeAttribute('id');
    stand.appendChild(copy);
    use.before(stand);
    stash.defer(use, () => stand.remove());
    use.style.setProperty('visibility', 'hidden');
  }
}

/** Every shape the SVG actually paints, outside `<defs>` and its kin. */
function paintedShapes(svg: SVGSVGElement) {
  return Array.from(svg.querySelectorAll<SVGGeometryElement>(GEOMETRY)).filter(
    (el) => !el.closest(`defs, symbol, ${HIDDEN_DEFS}`)
  );
}

/** Traces an inline SVG. Returns null when it is not worth tracing (empty, or a dense chart). */
export function traceVector(svg: SVGSVGElement, stash: Stash): MediaDrawing | null {
  standInForUses(svg, stash);

  type Found = { el: SVGGeometryElement; style: CSSStyleDeclaration; length: number };
  const found: Found[] = [];
  for (const el of paintedShapes(svg)) {
    const style = getComputedStyle(el);
    // Not visibility: the whole picture is still hidden by the redraw when this runs.
    if (style.display === 'none') continue;
    let length = 0;
    try {
      length = el.getTotalLength();
    } catch {
      // Not measurable: it can still fade its fill in.
    }
    found.push({ el, style, length });
  }

  const paints = (style: CSSStyleDeclaration, prop: 'fill' | 'stroke') =>
    style[prop] !== 'none' &&
    parseFloat(prop === 'fill' ? style.fillOpacity : style.strokeWidth) > 0;
  // A drawing with real strokes is traced along them; its fills (pattern hatching, panels in
  // the page colour) only fade in once the lines are down. An icon made only of fills (most
  // brand marks) is traced with a borrowed hairline in its own ink instead.
  const lineArt = found.some(({ style, length }) => length > 0 && paints(style, 'stroke'));

  const slots = new Map<string, number>();
  const shapes: Shape[] = [];
  for (const { el, style, length } of found) {
    const filled = paints(style, 'fill');
    const stroked = paints(style, 'stroke');
    if (!filled && !stroked) continue;
    const traced = length > 0 && (stroked || !lineArt);
    const key = `${el.tagName}|${el.getAttribute('d') ?? el.getAttribute('points') ?? shapes.length}`;
    if (!slots.has(key)) slots.set(key, slots.size);
    shapes.push({
      el,
      length,
      traced,
      filled,
      borrowed: traced && !stroked,
      fillOpacity: parseFloat(style.fillOpacity) || 1,
      slot: slots.get(key)!
    });
    stash.keep(el, ['pathLength']);
    const inline = el.style;
    if (filled) inline.setProperty('fill-opacity', '0');
    if (!traced) {
      inline.setProperty('stroke-opacity', '0');
      continue;
    }
    const matrix = el.getScreenCTM();
    const scale = matrix ? Math.hypot(matrix.a, matrix.b) : 1;
    el.setAttribute('pathLength', '1');
    inline.setProperty('stroke-dasharray', '1 1');
    inline.setProperty('stroke-dashoffset', '1');
    inline.setProperty('visibility', 'hidden');
    if (!stroked) {
      // The hairline is in the shape's own ink; a pattern fill borrows the text colour.
      inline.setProperty('stroke', style.fill.startsWith('url(') ? style.color : style.fill);
      inline.setProperty('stroke-width', `${1 / scale}px`);
    }
  }

  const traced = shapes.filter((shape) => shape.traced);
  if (!traced.length || traced.length > 240) {
    stash.restoreWithin(svg);
    return null;
  }

  // One window per path, in drawing order, as long as the path is: the pen keeps a steady
  // speed, and the windows overlap a little, like a few pens working at once.
  const slotLength = new Map<number, number>();
  let screenLength = 0;
  for (const shape of traced) {
    if (slotLength.has(shape.slot)) continue;
    slotLength.set(shape.slot, shape.length);
    const matrix = shape.el.getScreenCTM();
    screenLength += shape.length * (matrix ? Math.hypot(matrix.a, matrix.b) : 1);
  }
  const total = Array.from(slotLength.values()).reduce((sum, length) => sum + length, 0);
  const windows = new Map<number, { from: number; to: number }>();
  let before = 0;
  for (const [slot, length] of Array.from(slotLength)) {
    const from = (before / total) * 0.88;
    before += length;
    windows.set(slot, { from, to: Math.min(1, from + Math.max(0.12, length / total)) });
  }

  // The pen's speed is roughly constant, so a long drawing takes longer, within a calm range.
  const duration = Math.min(2.6, Math.max(0.5, 0.4 + screenLength / 1400));
  const box = svg.getBoundingClientRect();
  const fallback = { x: box.left + window.scrollX, y: box.top + window.scrollY };
  const head = (shape: Shape, local: number) => {
    try {
      const point = shape.el.getPointAtLength(local * shape.length);
      return toPage(shape.el, point.x, point.y) ?? fallback;
    } catch {
      return fallback;
    }
  };

  return {
    duration,
    start: head(traced[0], 0),
    step(p) {
      // Lines over the first four fifths; fills come up over the last third.
      // A steady pen overall; each stroke eases in and out on its own.
      const trace = clamp01(p / 0.8);
      const fill = easeOut(clamp01((p - 0.68) / 0.32));
      // The agent rides the stroke that started last: the one being drawn right now.
      let pen: Point | null = null;
      let latest = -1;
      for (const shape of shapes) {
        const style = shape.el.style;
        if (shape.filled) style.setProperty('fill-opacity', String(fill * shape.fillOpacity));
        if (!shape.traced) continue;
        const { from, to } = windows.get(shape.slot)!;
        const local = easeInOut(clamp01((trace - from) / (to - from)));
        style.setProperty('visibility', local > 0 ? 'visible' : 'hidden');
        style.setProperty('stroke-dashoffset', String(1 - local));
        if (shape.borrowed) style.setProperty('stroke-opacity', String(1 - fill));
        if (local > 0 && local < 1 && from > latest) {
          latest = from;
          pen = head(shape, local);
        }
      }
      return pen ?? head(traced[traced.length - 1], trace >= 1 ? 1 : 0);
    }
  };
}

/** Develops a raster picture (img, canvas, video, CSS background) row by row. */
export function developRaster(
  el: HTMLElement,
  rect: { x: number; y: number; w: number; h: number },
  stash: Stash
): MediaDrawing {
  stash.keep(el);
  const style = el.style;
  const small = Math.max(rect.w, rect.h) <= 40;

  if (small) {
    // Too small to scan: it comes into focus where it stands.
    style.setProperty('filter', 'blur(4px) grayscale(1)');
    style.setProperty('opacity', '0');
    const center = { x: rect.x + rect.w / 2, y: rect.y + rect.h / 2 };
    return {
      duration: 0.4,
      start: center,
      step(p) {
        const e = easeOut(p);
        style.setProperty('opacity', String(e));
        style.setProperty('filter', `blur(${(1 - e) * 4}px) grayscale(${1 - e})`);
        return center;
      }
    };
  }

  const soft = Math.min(48, rect.h * 0.3);
  const passes = Math.round(Math.min(8, Math.max(3, rect.h / 32)));
  const duration = Math.min(2.4, Math.max(1, 0.7 + rect.h / 420 + rect.w / 1800));
  const paint = (p: number) => {
    // Rows appear behind a soft edge; the picture sharpens and gains colour as it fills.
    const edge = p * (rect.h + soft);
    const mask = `linear-gradient(to bottom, #000 ${edge - soft}px, transparent ${edge}px)`;
    style.setProperty('mask-image', mask);
    style.setProperty('-webkit-mask-image', mask);
    const sharp = easeOut(clamp01((p - 0.15) / 0.85));
    style.setProperty('filter', `blur(${(1 - sharp) * 10}px) grayscale(${1 - sharp})`);
  };
  paint(0);

  return {
    duration,
    start: { x: rect.x, y: rect.y },
    step(p) {
      if (p >= 1) {
        style.removeProperty('mask-image');
        style.removeProperty('-webkit-mask-image');
        style.setProperty('filter', 'none');
      } else {
        paint(p);
      }
      // The print head: across, down a row, back across.
      const rows = p * passes;
      const row = Math.min(passes - 1, Math.floor(rows));
      const along = rows - row;
      const x = row % 2 === 0 ? along : 1 - along;
      return {
        x: rect.x + rect.w * (p >= 1 ? 1 : x),
        y: rect.y + Math.min(rect.h, p * rect.h)
      };
    }
  };
}
