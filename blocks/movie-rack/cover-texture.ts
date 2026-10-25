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
 * soft light, one restrained motif and condensed type, finished with grain and the case's hinge.
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

/**
 * Seats the insert inside the jewel case's front: a frosted hinge band down the left, a thin
 * strip of clear plastic around the insert showing the dark tray behind, and the lid's lit rim.
 */
function encase(insert: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = COVER_W;
  canvas.height = COVER_H;
  const ctx = canvas.getContext('2d')!;
  const hinge = Math.round(COVER_W * 0.085);
  const border = Math.round(COVER_W * 0.022);
  const x = hinge + Math.round(border * 0.6);
  const y = border;
  const w = COVER_W - x - border;
  const h = COVER_H - border * 2;

  // The tray, seen through clear plastic.
  ctx.fillStyle = '#1c1f25';
  ctx.fillRect(0, 0, COVER_W, COVER_H);
  ctx.drawImage(insert, x, y, w, h);
  ctx.strokeStyle = 'rgba(255,255,255,0.16)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x - 0.5, y - 0.5, w + 1, h + 1);

  // Hinge: frosted plastic with fine vertical ridges and a knuckle at each end.
  const frost = ctx.createLinearGradient(0, 0, hinge, 0);
  frost.addColorStop(0, 'rgb(236 240 245)');
  frost.addColorStop(0.22, 'rgb(196 202 211)');
  frost.addColorStop(0.5, 'rgb(242 245 248)');
  frost.addColorStop(0.78, 'rgb(182 189 199)');
  frost.addColorStop(1, 'rgb(226 230 236)');
  ctx.fillStyle = frost;
  ctx.fillRect(0, 0, hinge, COVER_H);
  for (let rx = 2; rx < hinge - 1; rx += 3) {
    ctx.fillStyle = rx % 2 ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.08)';
    ctx.fillRect(rx, 0, 1, COVER_H);
  }
  ctx.fillStyle = 'rgba(30,34,40,0.35)';
  for (const top of [0.06, 0.86]) ctx.fillRect(2, COVER_H * top, hinge - 4, COVER_H * 0.08);
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.fillRect(hinge - 1.5, 0, 1.5, COVER_H);
  ctx.fillStyle = 'rgba(0,0,0,0.35)';
  ctx.fillRect(hinge, 0, 1.5, COVER_H);

  // The lid: a bright outer rim, a softer inner one, and a faint diagonal sheen.
  ctx.strokeStyle = 'rgba(255,255,255,0.9)';
  ctx.lineWidth = 2.5;
  ctx.strokeRect(1.25, 1.25, COVER_W - 2.5, COVER_H - 2.5);
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 1;
  ctx.strokeRect(5.5, 5.5, COVER_W - 11, COVER_H - 11);
  const sheen = ctx.createLinearGradient(0, 0, COVER_W, COVER_H);
  sheen.addColorStop(0, 'rgba(255,255,255,0.12)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  ctx.fillStyle = sheen;
  ctx.fillRect(0, 0, COVER_W, COVER_H);

  return canvas;
}

/**
 * The case's thin edges in profile: lid lip, the seam where lid meets tray, then the tray's rim.
 * Bands run across the edge's thickness; `across` picks which texture axis that is.
 */
export function drawEdge(across: 'u' | 'v'): HTMLCanvasElement {
  const bands: [number, string][] = [
    [0.12, 'rgb(248 250 252)'],
    [0.2, 'rgb(150 156 166)'],
    [0.44, 'rgb(214 219 226)'],
    [0.54, 'rgb(70 75 84)'],
    [0.8, 'rgb(206 211 219)'],
    [0.9, 'rgb(246 248 251)'],
    [1, 'rgb(160 166 176)']
  ];
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = across === 'u' ? size : 4;
  canvas.height = across === 'u' ? 4 : size;
  const ctx = canvas.getContext('2d')!;
  let from = 0;
  for (const [to, color] of bands) {
    ctx.fillStyle = color;
    if (across === 'u') ctx.fillRect(from * size, 0, (to - from) * size + 1, 4);
    // Canvas rows run top-down but v runs bottom-up; either way the profile is symmetric enough.
    else ctx.fillRect(0, from * size, 4, (to - from) * size + 1);
    from = to;
  }
  return canvas;
}
