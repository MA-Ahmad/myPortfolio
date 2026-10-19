'use client';
import { useEffect, useRef, useState } from 'react';

type Props = {
  src?: string;
  alt?: string;
  className?: string;
  cell?: number;         // intro pixel size (px)
  hoverCell?: number;    // hover particle size (px)
  hoverRadius?: number;  // radius that breaks apart under the cursor
  hoverSpeed?: number;   // sideways burst
  hoverDepth?: number;   // how deep particles fall
};

export default function PixelAvatar({
  src = 'https://avatars.githubusercontent.com/u/37842853?v=4&s=920',
  alt = 'Muhammad Ahmad',
  className = '',
  cell = 4, hoverCell = 3, hoverRadius = 34, hoverSpeed = .45, hoverDepth = 1.3,
}: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const introRef = useRef<HTMLCanvasElement>(null);
  const hoverRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const [show, setShow] = useState(false);   // reveal the sharp image
  const [cors, setCors] = useState(true);     // fall back to a plain <img> if CORS fails

  useEffect(() => {
    const wrap = wrapRef.current!, intro = introRef.current!;
    const hover = hoverRef.current!;
    const ictx = intro.getContext('2d')!, hctx = hover.getContext('2d')!;
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const showFinal = () => setShow(true);

    const DURATION = 850, SPREAD = 1300, RISE = 1.1, FOCAL = 320, FOCUS_LEAD = 400, RIPPLE_MS = 800;

    // Sharp photo grows out from the center through a feathered circular mask.
    // At 220% the opaque core (70% of the mask's half-size) reaches past the corners.
    const rippleIn = () => {
      const mask = { maskImage: 'radial-gradient(circle closest-side, #000 70%, transparent 100%)', maskPosition: 'center', maskRepeat: 'no-repeat' };
      imgRef.current?.animate(
        [{ ...mask, maskSize: '0% 0%' }, { ...mask, maskSize: '220% 220%' }],
        { duration: RIPPLE_MS, easing: 'cubic-bezier(0.645, 0.045, 0.355, 1)' },
      );
      showFinal();
    };
    let W = 0, H = 0, dpr = 1, raf = 0, hRaf = 0, hLast = 0, hReady = false, started = false;
    let parts: any[] = [], hParts: any[] = [];
    let hCols = 0, hRows = 0, hCol = new Uint8ClampedArray(0), hBusy = new Uint8Array(0);
    let io: IntersectionObserver | undefined;

    const img = new Image();
    img.crossOrigin = 'anonymous'; // required so the canvas can read the pixels

    // Average each cell from the full-res image ("object-cover" behaviour)
    const sample = (c: number, cols: number, rows: number) => {
      const s = document.createElement('canvas'); s.width = W; s.height = H;
      const g = s.getContext('2d', { willReadFrequently: true })!;
      g.imageSmoothingQuality = 'high';
      const sc = Math.max(W / img.naturalWidth, H / img.naturalHeight);
      const dw = img.naturalWidth * sc, dh = img.naturalHeight * sc;
      g.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
      const src = g.getImageData(0, 0, W, H).data;
      const out = new Uint8ClampedArray(cols * rows * 4);
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        let r = 0, gr = 0, b = 0, a = 0, n = 0;
        const ye = Math.min(H, (y + 1) * c), xe = Math.min(W, (x + 1) * c);
        for (let yy = y * c; yy < ye; yy++) for (let xx = x * c; xx < xe; xx++) {
          const i = (yy * W + xx) * 4, al = src[i + 3];
          r += src[i] * al; gr += src[i + 1] * al; b += src[i + 2] * al; a += al; n++;
        }
        const o = (y * cols + x) * 4;
        if (a) { out[o] = r / a; out[o + 1] = gr / a; out[o + 2] = b / a; out[o + 3] = a / n; }
      }
      return out;
    };

    const setup = (cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D) => {
      cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    /* ---------- hover: square particles flying into depth ---------- */
    const initHover = () => {
      setup(hover, hctx);
      hCols = Math.ceil(W / hoverCell); hRows = Math.ceil(H / hoverCell);
      hCol = sample(hoverCell, hCols, hRows);
      hBusy = new Uint8Array(hCols * hRows); hParts = [];
      hReady = true;
    };

    const hFrame = (now: number) => {
      const dt = Math.min(50, now - hLast); hLast = now;
      const f = dt / 16.67;
      hctx.clearRect(0, 0, W, H);
      for (let n = hParts.length - 1; n >= 0; n--) {
        const p = hParts[n];
        p.age += dt;
        const k = p.age / p.life;
        if (k >= 1) { hBusy[p.i] = 0; hParts[n] = hParts[hParts.length - 1]; hParts.pop(); continue; }
        p.x += p.vx * f; p.y += p.vy * f;
        p.vx *= Math.pow(.97, f); p.vy *= Math.pow(.97, f);
        p.z = Math.min(FOCAL * .7, p.z + p.vz * f);
        const s = 1 / (1 - p.z / FOCAL);
        const sx = p.vpx + (p.x - p.vpx) * s, sy = p.vpy + (p.y - p.vpy) * s;
        const size = Math.max(1, Math.ceil(hoverCell * s));
        hctx.globalAlpha = k < .6 ? 1 : 1 - (k - .6) / .4;
        hctx.fillStyle = p.col;
        hctx.fillRect(Math.round(sx), Math.round(sy), size, size);
      }
      hctx.globalAlpha = 1;
      hRaf = hParts.length ? requestAnimationFrame(hFrame) : 0;
    };

    const onMove = (e: PointerEvent) => {
      if (!hReady) return;
      const r = wrap.getBoundingClientRect();
      const mx = e.clientX - r.left, my = e.clientY - r.top, R = hoverRadius, C = hoverCell;
      const c0 = Math.max(0, Math.floor((mx - R) / C)), c1 = Math.min(hCols - 1, Math.floor((mx + R) / C));
      const r0 = Math.max(0, Math.floor((my - R) / C)), r1 = Math.min(hRows - 1, Math.floor((my + R) / C));
      for (let y = r0; y <= r1; y++) for (let x = c0; x <= c1; x++) {
        const i = y * hCols + x;
        if (hBusy[i] || hCol[i * 4 + 3] < 10) continue;
        const px = x * C, py = y * C, d = Math.hypot(px + C / 2 - mx, py + C / 2 - my);
        if (d > R) continue;
        const f = 1 - d / R;
        if (Math.random() > .05 + .3 * f * f) continue;   // sparse, densest right under the cursor
        hBusy[i] = 1;
        const ang = Math.atan2(py - my, px - mx) + (Math.random() - .5) * 1.2;
        const sp = (.3 + Math.random() * 1.7) * hoverSpeed * (.4 + f);
        const away = Math.random() < .82;
        hParts.push({
          i, x: px, y: py, z: 0, vpx: mx, vpy: my,
          vx: Math.cos(ang) * sp, vy: Math.sin(ang) * sp - Math.random() * .4,
          vz: (away ? -1 : .6) * (.5 + Math.random()) * hoverDepth,
          age: 0, life: 1200 + Math.random() * 900,
          col: `rgb(${hCol[i * 4]},${hCol[i * 4 + 1]},${hCol[i * 4 + 2]})`,
        });
      }
      if (!hRaf) { hLast = performance.now(); hRaf = requestAnimationFrame(hFrame); }
    };

    /* ---------- intro: pixels bubble up and assemble ---------- */
    const runIntro = () => {
      const rect = wrap.getBoundingClientRect();
      W = Math.round(rect.width); H = Math.round(rect.height);
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      if (!W || !H) { showFinal(); return; }   // parent has no size yet: just show the image
      setup(intro, ictx);

      const cols = Math.ceil(W / cell), rows = Math.ceil(H / cell);
      let data: Uint8ClampedArray;
      try { data = sample(cell, cols, rows); } catch { showFinal(); return; } // CORS fallback

      parts = [];
      for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
        const i = (y * cols + x) * 4;
        if (data[i + 3] < 10) continue;
        const tx = x * cell, ty = y * cell;
        parts.push({
          tx, ty,
          sx: tx + (Math.random() - .5) * W * .5, sy: H + Math.random() * H * RISE,
          col: `rgb(${data[i]},${data[i + 1]},${data[i + 2]})`,
          delay: (1 - ty / H) * SPREAD * .55 + Math.random() * SPREAD * .45,
          dur: DURATION * (.75 + Math.random() * .5),
          wob: 8 + Math.random() * 16, ph: Math.random() * Math.PI * 2,
        });
      }

      const t0 = performance.now(), total = SPREAD + DURATION * 1.25;
      let focusing = false;
      const frame = (now: number) => {
        const t = now - t0;
        if (!focusing && t >= total - FOCUS_LEAD) { focusing = true; rippleIn(); }
        ictx.clearRect(0, 0, W, H);
        for (const p of parts) {
          const k = (t - p.delay) / p.dur;
          if (k <= 0) continue;
          ictx.fillStyle = p.col;
          if (k >= 1) { ictx.fillRect(p.tx, p.ty, cell, cell); continue; }
          const e = 1 - Math.pow(1 - k, 3);
          const wob = Math.sin(k * 9 + p.ph) * p.wob * (1 - e);
          ictx.globalAlpha = Math.min(1, k * 4);
          ictx.beginPath();
          ictx.arc(p.sx + (p.tx - p.sx) * e + wob + cell / 2, p.sy + (p.ty - p.sy) * e + cell / 2,
                   (cell / 2) * (.6 + .5 * e), 0, 6.2832);
          ictx.fill();
          ictx.globalAlpha = 1;
        }
        if (t < total) raf = requestAnimationFrame(frame);
        else { showFinal(); try { initHover(); } catch {} }
      };
      raf = requestAnimationFrame(frame);
    };

    /* ---------- press / click: replay the intro ---------- */
    const replay = () => {
      if (!started || reduce) return;
      cancelAnimationFrame(raf); cancelAnimationFrame(hRaf); hRaf = 0;
      hReady = false; hParts = []; hctx.clearRect(0, 0, W, H);
      setShow(false);
      runIntro();
    };
    const onDown = (e: PointerEvent) => { if (e.pointerType !== 'touch') replay(); };
    const onClick = (e: MouseEvent) => { if ((e as PointerEvent).pointerType === 'touch') replay(); };

    img.onload = () => {
      if (reduce) { showFinal(); return; }
      io = new IntersectionObserver(([en]) => {
        if (en.isIntersecting && !started) { started = true; io?.disconnect(); runIntro(); }
      }, { threshold: .35 });
      io.observe(wrap);
    };
    img.onerror = () => { setCors(false); showFinal(); };
    img.src = src;
    wrap.addEventListener('pointermove', onMove);
    wrap.addEventListener('pointerdown', onDown);
    wrap.addEventListener('click', onClick);

    return () => {
      cancelAnimationFrame(raf); cancelAnimationFrame(hRaf);
      io?.disconnect();
      wrap.removeEventListener('pointermove', onMove);
      wrap.removeEventListener('pointerdown', onDown);
      wrap.removeEventListener('click', onClick);
    };
  }, [src, cell, hoverCell, hoverRadius, hoverSpeed, hoverDepth]);

  return (
    <div ref={wrapRef} className={`relative block size-full cursor-pointer overflow-hidden rounded-[inherit] select-none touch-pan-y ${className}`}>
      {/* in normal flow, so the wrapper is sized exactly like your old <img> */}
      <img
        key={String(cors)}
        ref={imgRef}
        src={src}
        alt={alt}
        draggable={false}
        crossOrigin={cors ? 'anonymous' : undefined}
        onError={() => { if (cors) setCors(false); }}
        className={`relative z-[1] block size-full rounded-[inherit] object-cover ${show ? 'opacity-100' : 'opacity-0'}`}
      />
      <canvas ref={introRef} className="absolute inset-0 z-0 size-full" />
      <canvas ref={hoverRef} className="pointer-events-none absolute inset-0 z-[2] size-full" />
    </div>
  );
}
