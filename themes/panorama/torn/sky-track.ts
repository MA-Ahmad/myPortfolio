import type { LitCell } from './pixel-sky';

/** How far from the cursor a pixel is still tracked, px, and how many lines at most. */
const RADIUS = 220;
const LINES = 8;
/** Readouts beside this many of the nearest tracked pixels. */
const READOUTS = 2;
/** How fast the whole overlay comes up and lets go, per ms. */
const RISE = 1 / 160;
const FALL = 1 / 260;

const NS = 'http://www.w3.org/2000/svg';

type Classes = { line: string; mark: string; text: string; box: string };

/**
 * The cursor's tracking lines over the night sky: a hairline from a small box on the cursor to
 * each of the sky's tracked pixels near it, a hollow square on each, coordinates beside the
 * nearest, and a count. Night only, fine pointers only, and not under reduced motion. Nothing
 * runs until the pointer is over the sheet near a tracked pixel.
 */
export function createSkyTrack(svg: SVGSVGElement, classes: Classes) {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return inert();
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return inert();

  /** A torn seam's threads (tether.tsx) or its spark (attract.tsx) have the pointer: they win. */
  const seamHasPointer = () => {
    const sheetEl = svg.closest<HTMLElement>('[data-skin]');
    return (
      !!sheetEl &&
      (sheetEl.dataset.seam !== undefined || !!sheetEl.querySelector('[data-tethered]'))
    );
  };

  const make = <K extends keyof SVGElementTagNameMap>(tag: K, className: string) => {
    const el = document.createElementNS(NS, tag);
    el.setAttribute('class', className);
    el.setAttribute('opacity', '0');
    svg.appendChild(el);
    return el;
  };
  const lines: SVGLineElement[] = [];
  const marks: SVGRectElement[] = [];
  for (let i = 0; i < LINES; i++) {
    lines.push(make('line', classes.line));
    const mark = make('rect', classes.mark);
    mark.setAttribute('width', '6');
    mark.setAttribute('height', '6');
    marks.push(mark);
  }
  const readouts: SVGTextElement[] = [];
  for (let i = 0; i < READOUTS; i++) readouts.push(make('text', classes.text));
  const reticle = make('rect', classes.box);
  reticle.setAttribute('width', '22');
  reticle.setAttribute('height', '16');
  const chip = make('rect', classes.box);
  // A dark backing (inline: the shared box class has no fill) keeps the chip's text readable
  // over the moon and over other marks.
  chip.style.fill = 'rgb(8 9 12 / 0.82)';
  const chipText = make('text', classes.text);

  let cells: LitCell[] = [];
  let pointer: { x: number; y: number } | null = null;
  // Tracking is kept to the open section (its horizontal extent, in the svg's px, less a margin):
  // the torn edges of the closed ones would cut the lines, marks and text up.
  let span = { left: 0, right: Infinity };
  let want = 0;
  let power = 0;
  let frame = 0;
  let last = 0;

  const show = (el: Element, opacity: number) => el.setAttribute('opacity', opacity.toFixed(2));

  const tick = (now: number) => {
    const dt = Math.min(48, now - (last || now));
    last = now;
    // The seam's listener may run after ours on the same pointer event.
    if (want && seamHasPointer()) want = 0;
    power = want > power ? Math.min(1, power + RISE * dt) : Math.max(0, power - FALL * dt);

    const near: { cell: LitCell; distance: number; cx: number; cy: number }[] = [];
    if (pointer) {
      for (const cell of cells) {
        const cx = cell.x + cell.size / 2;
        if (cx < span.left || cx > span.right) continue;
        const cy = cell.y + cell.size / 2;
        const distance = Math.hypot(cx - pointer.x, cy - pointer.y);
        if (distance < RADIUS) near.push({ cell, distance, cx, cy });
      }
      near.sort((a, b) => a.distance - b.distance);
      near.length = Math.min(near.length, LINES);
    }

    for (let i = 0; i < LINES; i++) {
      const slot = near[i];
      if (!pointer || !slot) {
        show(lines[i], 0);
        show(marks[i], 0);
        continue;
      }
      const closeness = 1 - slot.distance / RADIUS;
      lines[i].setAttribute('x1', pointer.x.toFixed(1));
      lines[i].setAttribute('y1', pointer.y.toFixed(1));
      lines[i].setAttribute('x2', slot.cx.toFixed(1));
      lines[i].setAttribute('y2', slot.cy.toFixed(1));
      // Fade in over the first sixth of the reach, so a line does not pop in at full strength.
      const edge = Math.min(1, closeness * 6);
      show(lines[i], power * (0.3 + 0.55 * closeness) * edge);
      // Whole + 0.5 px puts the 1px strokes on pixel centres, so they stay crisp.
      marks[i].setAttribute('x', (Math.round(slot.cx - 3) + 0.5).toFixed(1));
      marks[i].setAttribute('y', (Math.round(slot.cy - 3) + 0.5).toFixed(1));
      show(marks[i], power * edge * (0.6 + 0.4 * closeness));
    }

    // The chip goes on the side of the cursor with more of the open section, or the other side if
    // it would not fit inside it, so it never runs into a seam.
    let clear: { left: number; right: number; top: number; bottom: number } | null = null;
    if (pointer) {
      reticle.setAttribute('x', (Math.round(pointer.x - 11) + 0.5).toFixed(1));
      reticle.setAttribute('y', (Math.round(pointer.y - 8) + 0.5).toFixed(1));
      show(reticle, power);

      chipText.textContent = `TRACKING ${near.length} POINTS`;
      const width = chipText.getComputedTextLength();
      const leftX = pointer.x - 11 - 6 - width;
      const rightX = pointer.x + 11 + 6;
      const fits = (x: number) => x - 4 >= span.left && x + width + 4 <= span.right;
      let left = pointer.x > (span.left + span.right) / 2;
      if (!fits(left ? leftX : rightX) && fits(left ? rightX : leftX)) left = !left;
      const textX = left ? leftX : rightX;
      chipText.setAttribute('x', textX.toFixed(1));
      chipText.setAttribute('y', (pointer.y + 3).toFixed(1));
      chip.setAttribute('x', (Math.round(textX - 4) + 0.5).toFixed(1));
      chip.setAttribute('y', (Math.round(pointer.y - 8) + 0.5).toFixed(1));
      chip.setAttribute('width', (width + 8).toFixed(1));
      chip.setAttribute('height', '16');
      show(chipText, power * 0.95);
      show(chip, power * 0.95);
      // The reticle and chip together, padded: readouts keep out of it.
      clear = {
        left: Math.min(pointer.x - 11, textX - 4) - 4,
        right: Math.max(pointer.x + 11, textX + width + 4) + 4,
        top: pointer.y - 8 - 4,
        bottom: pointer.y + 8 + 4
      };
    }

    // Closer than this a readout would sit under the chip. Each goes on the side of its pixel
    // facing away from the cursor, and one that would still touch the chip or reticle is skipped
    // for the next nearest pixel. One that would stick out of the open section, touch the sheet's
    // top edge, or lie under another tracked pixel's square is skipped too.
    const candidates = pointer ? near.filter((s) => s.distance > 70) : [];
    let used = 0;
    for (const slot of candidates) {
      if (used >= READOUTS || !pointer || !clear) break;
      const { x, y, size } = slot.cell;
      const text = readouts[used];
      const away = slot.cx < pointer.x;
      const textX = away ? x - 6 : x + size + 6;
      const baseline = y + size / 2 + 3;
      text.textContent = `X ${Math.round(x)} Y ${Math.round(y)}`;
      text.setAttribute('text-anchor', away ? 'end' : 'start');
      text.setAttribute('x', textX.toFixed(1));
      text.setAttribute('y', baseline.toFixed(1));
      const width = text.getComputedTextLength();
      const from = away ? textX - width : textX;
      const hits =
        from < clear.right &&
        from + width > clear.left &&
        baseline - 9 < clear.bottom &&
        baseline + 2 > clear.top;
      const cut = baseline - 9 < 2;
      const covered = near.some(
        (other) =>
          other !== slot &&
          from - 2 < other.cx + 3 &&
          from + width + 2 > other.cx - 3 &&
          baseline - 11 < other.cy + 3 &&
          baseline + 4 > other.cy - 3
      );
      if (hits || cut || covered || from < span.left || from + width > span.right) continue;
      show(text, power * 0.9 * Math.min(1, (1 - slot.distance / RADIUS) * 3));
      used++;
    }
    for (let i = used; i < READOUTS; i++) show(readouts[i], 0);

    if (power > 0 || want > 0) {
      frame = requestAnimationFrame(tick);
    } else {
      frame = 0;
      last = 0;
    }
  };

  const onMove = (event: PointerEvent) => {
    const timed = svg.closest('[data-time]');
    const sheetEl = svg.closest('[data-skin]');
    if (
      timed?.getAttribute('data-time') !== 'night' ||
      event.buttons !== 0 ||
      !sheetEl?.contains(event.target as Node) ||
      seamHasPointer()
    ) {
      want = 0;
    } else {
      // Only over the open section; else the overlay fades out where it is.
      const section = (event.target as Element).closest('section');
      if (!section?.hasAttribute('data-open')) {
        want = 0;
      } else {
        const box = svg.getBoundingClientRect();
        const rect = section.getBoundingClientRect();
        span = { left: rect.left - box.left + 8, right: rect.right - box.left - 8 };
        const here = { x: event.clientX - box.left, y: event.clientY - box.top };
        pointer = here;
        want = cells.some((c) => {
          const cx = c.x + c.size / 2;
          return cx >= span.left && cx <= span.right && Math.hypot(c.x - here.x, c.y - here.y) < RADIUS;
        })
          ? 1
          : 0;
      }
    }
    if (want && !frame) frame = requestAnimationFrame(tick);
  };
  const onLeave = () => {
    want = 0;
  };

  window.addEventListener('pointermove', onMove, { passive: true });
  document.documentElement.addEventListener('pointerleave', onLeave);

  return {
    /** The pixels to track, px from the sheet's top left; called again when the sky is redrawn. */
    setCells(next: LitCell[]) {
      cells = next;
    },
    destroy() {
      window.removeEventListener('pointermove', onMove);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      cancelAnimationFrame(frame);
      frame = 0;
      svg.replaceChildren();
    }
  };
}

/** What the tracker is when the pointer can't hover or motion is reduced: nothing. */
function inert() {
  return { setCells: (cells: LitCell[]): void => void cells, destroy: (): void => {} };
}
