import type { Movie } from './movies';

// The insert's pixel size, matching the case: 1 wide by 0.78 tall (CASE_H in rack-scene.ts).
export const COVER_W = 512;
export const COVER_H = 400;
// The hinge spine down the lid's left side, as a share of the case's width.
export const HINGE = 0.07;

// Where the insert sits in the tray, in cover pixels: right of the hinge, inside a dark border.
const BORDER = Math.round(COVER_W * 0.034);
const INSERT_X = Math.round(COVER_W * HINGE) + Math.round(BORDER * 0.7);
const INSERT_W = COVER_W - INSERT_X - BORDER;
const INSERT_H = COVER_H - BORDER * 2;

let grain: HTMLCanvasElement | null = null;

function grainTile() {
  if (grain) return grain;
  grain = document.createElement('canvas');
  grain.width = grain.height = 128;
  const ctx = grain.getContext('2d')!;
  const image = ctx.createImageData(128, 128);
  for (let i = 0; i < image.data.length; i += 4) {
    const v = Math.random() * 255;
    image.data[i] = image.data[i + 1] = image.data[i + 2] = v;
    image.data[i + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return grain;
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number) {
  const lines: string[] = [];
  let line = '';
  for (const word of text.split(' ')) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);
  return lines;
}

function glow(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string, alpha: number) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, color);
  g.addColorStop(1, 'transparent');
  ctx.globalAlpha = alpha;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  ctx.globalAlpha = 1;
}

/**
 * Paints a film's insert: a spine strip with the title set vertically, then a poster built from
 * soft light, one restrained motif and condensed type, finished with grain and seated in the tray.
 */
export function drawCover(movie: Movie, poster?: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;
  if (poster) {
    drawPoster(ctx, movie, poster);
    return encase(canvas);
  }
  const [deep, mid, light] = movie.palette;
  const spine = Math.round(COVER_W * 0.15);
  const artX = spine;
  const artW = COVER_W - spine;

  // Art: deep base, light falling in from above, a second bounce low on the opposite side.
  const base = ctx.createLinearGradient(artX, 0, COVER_W, COVER_H);
  base.addColorStop(0, mid);
  base.addColorStop(0.65, deep);
  base.addColorStop(1, deep);
  ctx.fillStyle = base;
  ctx.fillRect(artX, 0, artW, COVER_H);
  ctx.save();
  ctx.beginPath();
  ctx.rect(artX, 0, artW, COVER_H);
  ctx.clip();
  glow(ctx, artX + artW * 0.62, COVER_H * 0.18, artW * 0.7, light, 0.35);
  glow(ctx, artX + artW * 0.1, COVER_H * 0.95, artW * 0.6, mid, 0.5);

  const cx = artX + artW / 2;
  ctx.strokeStyle = light;
  ctx.fillStyle = light;
  switch (movie.art) {
    case 'sun': {
      glow(ctx, cx, COVER_H * 0.36, artW * 0.42, light, 0.55);
      ctx.globalAlpha = 0.95;
      ctx.beginPath();
      ctx.arc(cx, COVER_H * 0.36, artW * 0.17, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 0.35;
      for (let i = 0; i < 7; i++) ctx.fillRect(artX, COVER_H * (0.56 + i * 0.035), artW, 1.5 + i * 0.4);
      break;
    }
    case 'beam': {
      const beam = ctx.createLinearGradient(0, 0, 0, COVER_H * 0.8);
      beam.addColorStop(0, 'transparent');
      beam.addColorStop(0.55, light);
      beam.addColorStop(1, 'transparent');
      ctx.globalAlpha = 0.55;
      ctx.fillStyle = beam;
      ctx.filter = 'blur(10px)';
      ctx.beginPath();
      ctx.moveTo(cx - artW * 0.05, 0);
      ctx.lineTo(cx + artW * 0.05, 0);
      ctx.lineTo(cx + artW * 0.22, COVER_H * 0.8);
      ctx.lineTo(cx - artW * 0.22, COVER_H * 0.8);
      ctx.fill();
      ctx.filter = 'none';
      break;
    }
    case 'rings': {
      ctx.globalAlpha = 0.28;
      ctx.lineWidth = 1.2;
      for (let r = 14; r < artW * 0.5; r += 11) {
        ctx.beginPath();
        ctx.arc(cx, COVER_H * 0.4, r, 0, Math.PI * 2);
        ctx.stroke();
      }
      break;
    }
    case 'grid': {
      ctx.globalAlpha = 0.22;
      ctx.lineWidth = 1;
      const horizon = COVER_H * 0.5;
      for (let i = -10; i <= 10; i++) {
        ctx.beginPath();
        ctx.moveTo(cx + i * 6, horizon);
        ctx.lineTo(cx + i * artW * 0.16, COVER_H);
        ctx.stroke();
      }
      for (let i = 1; i < 9; i++) {
        const y = horizon + (COVER_H - horizon) * (i / 9) ** 1.8;
        ctx.beginPath();
        ctx.moveTo(artX, y);
        ctx.lineTo(COVER_W, y);
        ctx.stroke();
      }
      break;
    }
    case 'type': {
      ctx.globalAlpha = 0.12;
      ctx.font = `900 ${COVER_H * 0.9}px 'Helvetica Neue', Arial, sans-serif`;
      ctx.textBaseline = 'alphabetic';
      ctx.fillText(movie.title.replace(/^The /, '')[0], artX - artW * 0.08, COVER_H * 0.82);
      break;
    }
  }
  ctx.globalAlpha = 1;

  // Type: a small credit at the top, the title set large and condensed at the bottom.
  ctx.fillStyle = light;
  ctx.globalAlpha = 0.75;
  ctx.font = `600 13px system-ui, sans-serif`;
  ctx.letterSpacing = '2px';
  ctx.fillText(`A FILM BY ${movie.director.toUpperCase()}`.slice(0, 44), artX + 22, 34);
  ctx.globalAlpha = 1;
  const size = movie.title.length > 26 ? 34 : movie.title.length > 14 ? 44 : 58;
  ctx.font = `800 ${size}px 'Helvetica Neue', Arial, sans-serif`;
  ctx.letterSpacing = '-0.5px';
  const lines = wrap(ctx, movie.title.toUpperCase(), artW - 44);
  lines.forEach((line, i) => ctx.fillText(line, artX + 22, COVER_H - 30 - (lines.length - 1 - i) * size * 0.95));
  ctx.restore();

  // Spine strip.
  ctx.fillStyle = deep;
  ctx.fillRect(0, 0, spine, COVER_H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(0, 0, spine, COVER_H);
  ctx.save();
  ctx.translate(spine / 2 + 6, COVER_H - 26);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = light;
  ctx.font = `800 17px 'Helvetica Neue', Arial, sans-serif`;
  ctx.letterSpacing = '2.5px';
  ctx.fillText(movie.title.toUpperCase().slice(0, 34), 0, 0);
  ctx.restore();
  ctx.globalAlpha = 0.6;
  ctx.fillStyle = light;
  ctx.font = `600 12px system-ui, sans-serif`;
  ctx.letterSpacing = '1px';
  ctx.fillText(String(movie.year), spine / 2 - 15, 28);
  ctx.globalAlpha = 1;

  // Film grain over everything.
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = 0.09;
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat')!;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  return encase(canvas);
}

/** The darkened average color of a region of an image, for a band that sits beside it. */
function bandColor(image: HTMLImageElement, sx: number, sy: number, sw: number, sh: number) {
  const probe = document.createElement('canvas');
  probe.width = probe.height = 8;
  const ctx = probe.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(image, sx, sy, sw, sh, 0, 0, 8, 8);
  const data = ctx.getImageData(0, 0, 8, 8).data;
  let [r, g, b] = [0, 0, 0];
  for (let i = 0; i < data.length; i += 4) [r, g, b] = [r + data[i], g + data[i + 1], b + data[i + 2]];
  const n = data.length / 4;
  // Darkened so the white title always reads, whatever the poster's colors.
  const dim = (v: number) => Math.round((v / n) * 0.45);
  return `rgb(${dim(r)} ${dim(g)} ${dim(b)})`;
}

/**
 * Lays out a real poster's insert like a shop-bought case: a band down the left in the poster's own
 * darkened color, the title set up it in bold capitals with the year at its foot, and the poster
 * filling the rest, cropped around `focus` (0 top, 1 bottom). Drawn in insert pixels and stretched to
 * the canvas, so it comes out undistorted once the insert is seated.
 */
function drawPoster(ctx: CanvasRenderingContext2D, movie: Movie, poster: HTMLImageElement) {
  ctx.save();
  ctx.scale(COVER_W / INSERT_W, COVER_H / INSERT_H);
  const band = Math.round(INSERT_W * 0.3);
  const artW = INSERT_W - band;

  // Poster: a thin margin is trimmed first, because some scans carry a white border.
  const trim = 0.04;
  const width = poster.naturalWidth * (1 - trim * 2);
  const height = poster.naturalHeight * (1 - trim * 2);
  const aspect = artW / INSERT_H;
  const sw = Math.min(width, height * aspect);
  const sh = sw / aspect;
  const sx = poster.naturalWidth * trim + (width - sw) / 2;
  const sy = poster.naturalHeight * trim + (height - sh) * Math.min(1, Math.max(0, movie.focus ?? 0.5));
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(poster, sx, sy, sw, sh, band, 0, artW, INSERT_H);

  // Band: colored from the poster's left edge, a touch lighter at the top, with a soft shadow where
  // it meets the art.
  ctx.fillStyle = bandColor(poster, sx, sy, sw * 0.25, sh);
  ctx.fillRect(0, 0, band, INSERT_H);
  const light = ctx.createLinearGradient(0, 0, 0, INSERT_H);
  light.addColorStop(0, 'rgba(255,255,255,0.08)');
  light.addColorStop(1, 'rgba(0,0,0,0.2)');
  ctx.fillStyle = light;
  ctx.fillRect(0, 0, band, INSERT_H);
  const edge = ctx.createLinearGradient(band, 0, band + 10, 0);
  edge.addColorStop(0, 'rgba(0,0,0,0.35)');
  edge.addColorStop(1, 'transparent');
  ctx.fillStyle = edge;
  ctx.fillRect(band, 0, 10, INSERT_H);

  // Title: up the band, bottom to top, on up to three lines, as large as fits.
  const pad = 22;
  const yearSpace = 46;
  const length = INSERT_H - pad - yearSpace;
  const across = band - pad * 2;
  const title = movie.title.toUpperCase();
  let size = 36;
  let lines: string[] = [];
  for (; size > 12; size -= 1) {
    ctx.font = `800 ${size}px 'Helvetica Neue', Arial, sans-serif`;
    lines = wrap(ctx, title, length);
    const longest = Math.max(...lines.map((line) => ctx.measureText(line).width));
    if (lines.length <= 3 && lines.length * size * 1.08 <= across && longest <= length) break;
  }
  ctx.save();
  ctx.translate(band / 2, INSERT_H - yearSpace);
  ctx.rotate(-Math.PI / 2);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.letterSpacing = '0.5px';
  const lineHeight = size * 1.08;
  lines.forEach((line, i) => ctx.fillText(line, 0, (i - (lines.length - 1) / 2) * lineHeight));
  ctx.restore();

  // Year, level at the foot of the band.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `600 15px system-ui, sans-serif`;
  ctx.letterSpacing = '1px';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillText(String(movie.year), band / 2, INSERT_H - pad);
  ctx.restore();
}

/**
 * Seats the insert in the tray under the lid: dark plastic around it, the insert recessed with a soft
 * shadow under its edge, a dark contact line and a lit lip, then a faint sheen. The lid's rim and
 * hinge spine are geometry in front of this (see drawLid), so they are not painted here.
 */
function encase(insert: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;
  const [x, y, w, h] = [INSERT_X, BORDER, INSERT_W, INSERT_H];

  // Clear plastic shows the dark tray behind it, with a little light caught toward the top.
  const lid = ctx.createLinearGradient(0, 0, COVER_W * 0.3, COVER_H);
  lid.addColorStop(0, 'rgb(58 62 70)');
  lid.addColorStop(0.5, 'rgb(36 39 45)');
  lid.addColorStop(1, 'rgb(26 28 33)');
  ctx.fillStyle = lid;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.55)';
  ctx.shadowBlur = 8;
  ctx.shadowOffsetY = 2;
  ctx.drawImage(insert, x, y, w, h);
  ctx.restore();
  ctx.strokeStyle = 'rgba(20,22,26,0.7)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(x - 0.75, y - 0.75, w + 1.5, h + 1.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 2.5, y - 2.5, w + 5, h + 5);

  const sheen = ctx.createLinearGradient(0, 0, COVER_W, COVER_H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.3, 'rgba(255,255,255,0.02)');
  sheen.addColorStop(0.55, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  return canvas;
}

/**
 * The lid's raised face, mapped over the whole front of the case (the window over the insert is cut
 * out of the geometry): a frosted hinge spine with fine ridges and knuckle tabs top and bottom, and a
 * narrow rim of clear plastic around the other three sides, lit along its outer edge.
 */
export function drawLid(): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;
  const hinge = Math.round(COVER_W * HINGE);

  const rim = ctx.createLinearGradient(0, 0, COVER_W * 0.4, COVER_H);
  rim.addColorStop(0, 'rgb(150 155 163)');
  rim.addColorStop(1, 'rgb(92 97 105)');
  ctx.fillStyle = rim;
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2;
  ctx.strokeRect(1, 1, COVER_W - 2, COVER_H - 2);

  // Spine: frosted, with ridges running its length and a lit edge where it steps down to the window.
  const frost = ctx.createLinearGradient(0, 0, hinge, 0);
  frost.addColorStop(0, 'rgb(150 155 163)');
  frost.addColorStop(0.35, 'rgb(112 117 125)');
  frost.addColorStop(0.7, 'rgb(138 143 151)');
  frost.addColorStop(1, 'rgb(100 105 113)');
  ctx.fillStyle = frost;
  ctx.fillRect(0, 0, hinge, COVER_H);
  for (let rx = 3; rx < hinge - 3; rx += 3) {
    ctx.fillStyle = rx % 2 ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.06)';
    ctx.fillRect(rx, 0, 1, COVER_H);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(hinge - 2, 0, 1.5, COVER_H);

  // Knuckle tabs: small inset rectangles, shadowed along the top and lit along the bottom.
  const tabW = Math.round(hinge * 0.5);
  const tabH = Math.round(COVER_H * 0.075);
  const tabX = Math.round((hinge - tabW) / 2) - 1;
  const inset = Math.round(COVER_W * 0.03);
  for (const tabY of [inset, COVER_H - inset - tabH]) {
    ctx.fillStyle = 'rgba(70,74,82,0.9)';
    ctx.fillRect(tabX, tabY, tabW, tabH);
    ctx.fillStyle = 'rgba(30,34,40,0.55)';
    ctx.fillRect(tabX, tabY, tabW, 1.5);
    ctx.fillRect(tabX, tabY, 1.5, tabH);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.fillRect(tabX, tabY + tabH - 1.5, tabW, 1.5);
    ctx.fillRect(tabX + tabW - 1.5, tabY, 1.5, tabH);
  }
  return canvas;
}
