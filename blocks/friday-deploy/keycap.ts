/**
 * The keycap painted onto a canvas, matching the CSS key in `friday-deploy.module.css`. The blast
 * cuts this picture into shards, so each piece of glass carries its part of the key: a corner of
 * the face, half of "deploy", the return glyph.
 */

/** The key's width in the CSS at `--s: 1`; every size below is scaled from it. */
export const KEY_WIDTH = 148;
/** Transparent margin around the key, so a shard's rim never clips at the picture's edge. */
export const KEY_PAD = 4;

export const KEY_FONT = 'ui-rounded, "SF Pro Rounded", system-ui, -apple-system, sans-serif';

export function paintKeycap(width: number, height: number, dpr: number): HTMLCanvasElement {
  const s = width / KEY_WIDTH;
  const canvas = document.createElement('canvas');
  canvas.width = Math.ceil((width + KEY_PAD * 2) * dpr);
  canvas.height = Math.ceil((height + KEY_PAD * 2) * dpr);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(dpr, dpr);
  ctx.translate(KEY_PAD, KEY_PAD);

  // The cap: a dark shell, lighter at the top where the light falls.
  const shell = ctx.createLinearGradient(0, 0, 0, height);
  shell.addColorStop(0, '#36363c');
  shell.addColorStop(1, '#141417');
  ctx.beginPath();
  ctx.roundRect(0, 0, width, height, 26 * s);
  ctx.fillStyle = shell;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.08)';
  ctx.lineWidth = 1;
  ctx.stroke();

  // The face the finger presses: inset, with more room below for the cap's lower lip.
  const fx = 9 * s;
  const fy = 7 * s;
  const fw = width - 18 * s;
  const fh = height - 21 * s;
  const face = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
  face.addColorStop(0, '#2d2d33');
  face.addColorStop(1, '#1b1b1f');
  ctx.beginPath();
  ctx.roundRect(fx, fy, fw, fh, 18 * s);
  ctx.fillStyle = face;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.06)';
  ctx.stroke();

  ctx.fillStyle = '#ececf0';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `500 ${24 * s}px ${KEY_FONT}`;
  ctx.textAlign = 'right';
  ctx.fillText('⏎', fx + fw - 14 * s, fy + 30 * s);
  ctx.font = `500 ${19 * s}px ${KEY_FONT}`;
  ctx.textAlign = 'left';
  ctx.fillText('deploy', fx + 14 * s, fy + fh - 16 * s);

  return canvas;
}
