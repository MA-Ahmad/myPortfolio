import type { Movie } from './movies';

// The insert's pixel size, matching the case: 1 wide by 0.78 tall (CASE_H in rack-scene.ts).
export const COVER_W = 512;
export const COVER_H = 400;

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
export function drawCover(movie: Movie): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;
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

// The hinge spine down the lid's left side, as a share of the case's width.
export const HINGE = 0.07;

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
  const hinge = Math.round(COVER_W * HINGE);
  const border = Math.round(COVER_W * 0.034);
  const x = hinge + Math.round(border * 0.7);
  const y = border;
  const w = COVER_W - x - border;
  const h = COVER_H - border * 2;

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
