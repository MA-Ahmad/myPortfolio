/**
 * The boxes a web can be spun in, in the spider layer's coordinates.
 *
 * Every row of `.site-frame` (the page's sections) makes three cells: the left gutter,
 * the column itself and the right gutter, split horizontally at any `[data-web-cut]`
 * line inside it (the header's avatar line). Elements marked `[data-web-box]` (the Theme
 * Studio dock) are boxes of their own, and their web is drawn inside them so it travels
 * with them. Thin rows such as the stripe separators are paths, not boxes.
 */
export type Box = {
  key: string;
  x: number;
  y: number;
  w: number;
  h: number;
  /** Set for element boxes: the web lives inside this element. */
  el?: HTMLElement;
  label: string;
};

const MIN_H = 48;
const MIN_W = 72;

export function railGutter() {
  const rails = document.querySelector('.guide-rails');
  if (!rails) return 24;
  const value = getComputedStyle(rails).getPropertyValue('--play-gutter').trim();
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const n = parseFloat(value);
  if (!Number.isFinite(n)) return 24;
  return value.endsWith('rem') ? n * rem : n;
}

export function collectBoxes(layer: Element): Box[] {
  const L = layer.getBoundingClientRect();
  const frame = layer.parentElement?.querySelector('.site-frame');
  if (!frame) return [];
  const F = frame.getBoundingClientRect();
  const gutter = railGutter();
  const columns = [
    { name: 'left', x0: 0, x1: F.left - gutter - L.left },
    { name: 'mid', x0: F.left - L.left, x1: F.right - L.left },
    { name: 'right', x0: F.right + gutter - L.left, x1: L.width }
  ];

  const boxes: Box[] = [];
  Array.from(frame.children).forEach((row, r) => {
    const R = row.getBoundingClientRect();
    if (R.height < MIN_H) return;
    const cuts = Array.from(row.querySelectorAll('[data-web-cut]'))
      .map((el) => el.getBoundingClientRect().top)
      .filter((y) => y > R.top + MIN_H && y < R.bottom - MIN_H);
    const lines = [R.top, ...cuts.sort((a, b) => a - b), R.bottom];
    for (let b = 0; b < lines.length - 1; b++) {
      for (const col of columns) {
        const w = col.x1 - col.x0;
        const h = lines[b + 1] - lines[b];
        if (w < MIN_W || h < MIN_H) continue;
        boxes.push({
          key: `r${r}-b${b}-${col.name}`,
          x: col.x0,
          y: lines[b] - L.top,
          w,
          h,
          label: 'this box'
        });
      }
    }
  });

  document.querySelectorAll<HTMLElement>('[data-web-box]').forEach((el) => {
    const E = el.getBoundingClientRect();
    if (E.width < MIN_W || E.height < MIN_H) return; // hidden (e.g. the dock on mobile)
    boxes.push({
      key: `el:${el.dataset.webBox}`,
      x: E.left - L.left,
      y: E.top - L.top,
      w: el.offsetWidth,
      h: el.offsetHeight,
      el,
      label: el.dataset.webBox ?? 'this box'
    });
  });

  return boxes;
}

/** The smallest box under a point, so an element box wins over the cell behind it. */
export function boxAt(boxes: Box[], x: number, y: number) {
  let best: Box | undefined;
  for (const box of boxes) {
    if (x < box.x || x > box.x + box.w || y < box.y || y > box.y + box.h) continue;
    if (!best || box.w * box.h < best.w * best.h) best = box;
  }
  return best;
}
