/**
 * The keycap painted onto a canvas, matching the CSS key in `friday-deploy.module.css`. The canvas
 * takes the page's key over when it cracks and hands it back when it heals, so the two must match
 * to the pixel. The blast cuts this picture into shards, so each piece of glass carries its part of
 * the key: a corner of the face, half of "deploy", the return glyph.
 */

/** The key's size and corner radius in the CSS at `--s: 1`; every size below is scaled from them. */
export const KEY_WIDTH = 112;
export const KEY_HEIGHT = 96;
export const KEY_RADIUS = 20;
/** Transparent margin around the key, so a shard's rim never clips at the picture's edge. */
export const KEY_PAD = 4;

export const KEY_FONT = 'system-ui, -apple-system, sans-serif';

/** Where the key's two labels sit: the top of each line box, from the key's top left, in px. */
export type KeyLabels = {
  glyphRight: number;
  glyphTop: number;
  labelLeft: number;
  labelTop: number;
};

/** The labels where the page's key has laid them out, which the CSS alone can't say to the pixel. */
export function measureLabels(key: HTMLElement): KeyLabels {
  const box = key.getBoundingClientRect();
  const glyph = key.querySelector('[data-key-glyph]')!.getBoundingClientRect();
  const label = key.querySelector('[data-key-label]')!.getBoundingClientRect();
  return {
    glyphRight: glyph.right - box.left,
    glyphTop: glyph.top - box.top,
    labelLeft: label.left - box.left,
    labelTop: label.top - box.top
  };
}

/** The labels where the CSS puts them, for a key that isn't on the page. */
function cssLabels(width: number, height: number, s: number): KeyLabels {
  return {
    glyphRight: width - 16 * s,
    glyphTop: 13 * s,
    labelLeft: 17 * s,
    labelTop: height - 35 * s
  };
}

function shape(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number
) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

/** The CSS insets on a box: a 1px ring (`inset 0 0 0 1px`) and a top edge (`inset 0 1px 0`). */
function insets(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  ring: string,
  edge: string
) {
  ctx.save();
  shape(ctx, x, y, w, h, r);
  ctx.clip();
  ctx.lineWidth = 2;
  ctx.strokeStyle = ring;
  ctx.stroke();
  ctx.beginPath();
  ctx.rect(x - 1, y - 1, w + 2, h + 2);
  ctx.roundRect(x, y + 1, w, h, r);
  ctx.fillStyle = edge;
  ctx.fill('evenodd');
  ctx.restore();
}

/**
 * Draws `text` with its line box's top at `top`, as CSS sets a line at `line-height: 1`: the font's
 * ascent and descent centred in a box one font size tall.
 */
function line(ctx: CanvasRenderingContext2D, text: string, x: number, top: number, size: number) {
  const m = ctx.measureText(text);
  const ascent = m.fontBoundingBoxAscent;
  ctx.fillText(text, x, top + (size - (ascent + m.fontBoundingBoxDescent)) / 2 + ascent);
}

export function paintKeycap(
  width: number,
  height: number,
  dpr: number,
  labels?: KeyLabels
): HTMLCanvasElement {
  const s = width / KEY_WIDTH;
  const { glyphRight, glyphTop, labelLeft, labelTop } = labels ?? cssLabels(width, height, s);
  const canvas = document.createElement('canvas');
  const fullW = width + KEY_PAD * 2;
  const fullH = height + KEY_PAD * 2;
  canvas.width = Math.ceil(fullW * dpr);
  canvas.height = Math.ceil(fullH * dpr);
  const ctx = canvas.getContext('2d')!;
  // Scaled to fill the whole bitmap, so drawn back at the key's size it lands without a stretch.
  ctx.scale(canvas.width / fullW, canvas.height / fullH);
  ctx.translate(KEY_PAD, KEY_PAD);

  // The cap: a dark shell, lighter at the top where the light falls.
  const shell = ctx.createLinearGradient(0, 0, 0, height);
  shell.addColorStop(0, '#2c2c31');
  shell.addColorStop(1, '#111113');
  shape(ctx, 0, 0, width, height, KEY_RADIUS * s);
  ctx.fillStyle = shell;
  ctx.fill();
  insets(
    ctx,
    0,
    0,
    width,
    height,
    KEY_RADIUS * s,
    'rgba(255,255,255,0.06)',
    'rgba(255,255,255,0.1)'
  );

  // The face the finger presses: inset, with more room below for the cap's lower lip. Its
  // gradient runs `to bottom right` as CSS draws one, square to the box's other diagonal.
  const fx = 6 * s;
  const fy = 5 * s;
  const fw = width - 12 * s;
  const fh = height - 15 * s;
  const diagonal = Math.hypot(fw, fh);
  const reach = (fw * fh) / diagonal;
  const cx = fx + fw / 2;
  const cy = fy + fh / 2;
  const dx = (fh / diagonal) * reach;
  const dy = (fw / diagonal) * reach;
  const face = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  face.addColorStop(0, '#262629');
  face.addColorStop(1, '#19191c');
  shape(ctx, fx, fy, fw, fh, 14 * s);
  ctx.fillStyle = face;
  ctx.fill();
  insets(ctx, fx, fy, fw, fh, 14 * s, 'rgba(255,255,255,0.05)', 'rgba(255,255,255,0.06)');

  ctx.fillStyle = '#e4e4e7';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `400 ${17 * s}px ${KEY_FONT}`;
  ctx.textAlign = 'right';
  line(ctx, '⏎', glyphRight, glyphTop, 17 * s);
  ctx.font = `400 ${15 * s}px ${KEY_FONT}`;
  ctx.textAlign = 'left';
  ctx.letterSpacing = `${0.15 * s}px`;
  line(ctx, 'deploy', labelLeft, labelTop, 15 * s);

  return canvas;
}
