import { useEffect, useRef } from 'react';
import { GeistMono } from 'geist/font/mono';
import { cn } from 'lib/cn';
import { NOTEBOOK_CONTENT } from 'themes/notebook/content';
import { onSchemeChange, prefersReducedMotion, readTokens } from 'themes/notebook/lib/color-tokens';
import { buildSpace, position, tokenize } from 'themes/notebook/lib/embedding-space';
import notebook from 'themes/notebook/notebook.module.css';
import styles from '../canvas.module.css';

const CAMERA = 90;
const PITCH = 0.32;
const SPIN = 0.07;
const STEP_S = 1.4;
const TRAIL = 5;
const FRAME_MS = 1000 / 30;
const STILL_T = 6;
const PAD = 12;
const LINE_H = 15;
/** Room kept under the galaxy, like the PAD above the passage. */
const BOTTOM = PAD;
/** Lines of the passage shown at once; it scrolls to keep the current word in view. */
const MAX_LINES = 1;

const show = (token: string) => (token.startsWith(' ') ? `·${token.slice(1)}` : token);
const rgb = ([r, g, b]: number[], alpha = 1) =>
  `rgb(${Math.round(r * 255)} ${Math.round(g * 255)} ${Math.round(b * 255)} / ${alpha})`;

/**
 * The notebook's embedding galaxy drawn flat on a 2D canvas: the passage on top, one line at a
 * time, with the current token inked (it scrolls as the walk moves on), and below it the same token positions slowly turning, a short trail walking the
 * passage word by word. No WebGL, so it stays cheap next to the other previews, and it only runs
 * while on screen.
 */
export function NotebookPreview() {
  const rootRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const root = rootRef.current!;
    const canvas = canvasRef.current!;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const passage = tokenize(NOTEBOOK_CONTENT.passage.toLowerCase());
    const space = buildSpace(passage);
    const sequence = passage.map((token) => space.index.get(token) ?? 0);
    const N = space.words.length;
    const points = new Float32Array(N * 3);
    space.vectors.forEach((v, i) => points.set(position(v), i * 3));
    const screen = new Float32Array(N * 3);
    // Fit to where nearly all tokens sit, so a few far outliers don't shrink the cloud.
    const quantile = (values: number[]) => values.sort((a, b) => a - b)[Math.floor(values.length * 0.97)];
    const reach = quantile(Array.from({ length: N }, (_, i) => Math.hypot(points[i * 3], points[i * 3 + 2])));
    const rise = quantile(Array.from({ length: N }, (_, i) => Math.abs(points[i * 3 + 1])));

    let tokens = readTokens(root);
    const family = getComputedStyle(root).fontFamily;
    let width = 0;
    let height = 0;
    let galaxyTop = 0;
    let galaxyHeight = 0;
    let placed: { text: string; x: number; line: number }[] = [];
    let lines = 1;

    // Wraps the passage token by token, breaking only before whole words.
    const layout = () => {
      ctx.font = `11px ${family}`;
      const max = width - PAD * 2;
      let x = 0;
      let line = 0;
      placed = passage.map((token) => {
        let text = x === 0 ? token.trimStart() : token;
        let w = ctx.measureText(text).width;
        if (x > 0 && x + w > max && token.startsWith(' ')) {
          line++;
          x = 0;
          text = token.trimStart();
          w = ctx.measureText(text).width;
        }
        const at = { text, x: PAD + x, line };
        x += w;
        return at;
      });
      lines = line + 1;
      galaxyTop = PAD + Math.min(lines, MAX_LINES) * LINE_H + 4;
      galaxyHeight = height - galaxyTop - BOTTOM;
    };

    const resize = () => {
      const ratio = Math.min(window.devicePixelRatio, 2);
      width = canvas.clientWidth;
      height = canvas.clientHeight;
      canvas.width = Math.round(width * ratio);
      canvas.height = Math.round(height * ratio);
      ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
      layout();
    };

    const project = (t: number) => {
      const yaw = t * SPIN - 0.6;
      const cy = Math.cos(yaw);
      const sy = Math.sin(yaw);
      const cp = Math.cos(PITCH);
      const sp = Math.sin(PITCH);
      // The nearest point is CAMERA - reach away, so this keeps the widest one inside the frame.
      const focal =
        Math.min((width / 2 - 8) / reach, galaxyHeight / 2 / (rise + reach * sp)) * (CAMERA - reach);
      const middle = galaxyTop + galaxyHeight / 2;
      for (let i = 0; i < N; i++) {
        const x = points[i * 3];
        const y = points[i * 3 + 1];
        const z = points[i * 3 + 2];
        const x1 = x * cy + z * sy;
        const z1 = -x * sy + z * cy;
        const y1 = y * cp - z1 * sp;
        const depth = CAMERA + y * sp + z1 * cp;
        screen[i * 3] = width / 2 + (x1 * focal) / depth;
        screen[i * 3 + 1] = middle - (y1 * focal) / depth;
        screen[i * 3 + 2] = depth;
      }
    };

    const draw = (t: number) => {
      project(t);
      const { bg, ink, faint } = tokens;
      ctx.fillStyle = rgb(bg);
      ctx.fillRect(0, 0, width, height);

      const step = Math.floor(t / STEP_S);
      const glide = Math.min(1, (t / STEP_S - step) * 2.5);
      const wrap = (k: number) => ((k % passage.length) + passage.length) % passage.length;
      const current = wrap(step);

      ctx.font = `11px ${family}`;
      ctx.textBaseline = 'middle';
      // Only MAX_LINES lines fit above the galaxy: the passage scrolls to the current word's line.
      const first = Math.max(0, Math.min(placed[current].line - (MAX_LINES - 1), lines - MAX_LINES));
      placed.forEach(({ text, x, line }, k) => {
        if (line < first || line >= first + MAX_LINES) return;
        const y = PAD + (line - first) * LINE_H + LINE_H / 2;
        const behind = wrap(current - k);
        ctx.fillStyle = behind < TRAIL ? rgb(ink, behind === 0 ? 0.4 + 0.6 * glide : 1 - behind / TRAIL) : rgb(faint, 0.55);
        ctx.fillText(text, x, y);
      });

      for (let i = 0; i < N; i++) {
        const depth = screen[i * 3 + 2];
        const near = Math.min(1, Math.max(0, (CAMERA + reach - depth) / (2 * reach)));
        const dust = space.dust[i];
        ctx.fillStyle = rgb(ink, (dust ? 0.26 : 0.5) * (0.4 + 0.6 * near));
        const size = (dust ? 1 : 1.6) * (CAMERA / depth);
        ctx.fillRect(screen[i * 3] - size / 2, screen[i * 3 + 1] - size / 2, size, size);
      }

      const at = (k: number) => sequence[wrap(k)];
      ctx.lineWidth = 1;
      for (let k = 0; k < TRAIL; k++) {
        const a = at(step - k - 1);
        const b = at(step - k);
        const ax = screen[a * 3];
        const ay = screen[a * 3 + 1];
        const reachT = k === 0 ? glide : 1;
        ctx.strokeStyle = rgb(ink, 0.7 * (1 - k / TRAIL));
        ctx.beginPath();
        ctx.moveTo(ax, ay);
        ctx.lineTo(ax + (screen[b * 3] - ax) * reachT, ay + (screen[b * 3 + 1] - ay) * reachT);
        ctx.stroke();
      }

      ctx.font = `10px ${family}`;
      for (let k = TRAIL - 1; k >= 0; k--) {
        const i = at(step - k);
        const x = screen[i * 3];
        const y = screen[i * 3 + 1];
        const alpha = k === 0 ? glide : 1 - k / TRAIL;
        ctx.fillStyle = rgb(ink, alpha);
        ctx.fillRect(x - 2, y - 2, 4, 4);
        if (k < 3) {
          ctx.fillStyle = rgb(ink, alpha * (k === 0 ? 1 : 0.55));
          ctx.fillText(show(space.words[i]), x + 6, y);
        }
      }
    };

    let frame = 0;
    let last = 0;
    let visible = false;
    const start = performance.now();
    const reduced = prefersReducedMotion();
    const now = () => (reduced ? STILL_T : (performance.now() - start) / 1000);
    const tick = (time: number) => {
      frame = requestAnimationFrame(tick);
      if (time - last < FRAME_MS) return;
      last = time;
      draw((time - start) / 1000);
    };
    const run = () => {
      cancelAnimationFrame(frame);
      if (visible && !reduced) frame = requestAnimationFrame(tick);
      else draw(now());
    };

    resize();
    draw(now());
    const observer = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
      run();
    });
    observer.observe(canvas);
    const sizes = new ResizeObserver(() => {
      resize();
      draw(now());
    });
    sizes.observe(canvas);
    const stopScheme = onSchemeChange(() => {
      tokens = readTokens(root);
      draw(now());
    });
    let alive = true;
    document.fonts?.ready.then(() => {
      if (!alive) return;
      layout();
      draw(now());
    });

    return () => {
      alive = false;
      cancelAnimationFrame(frame);
      observer.disconnect();
      sizes.disconnect();
      stopScheme();
    };
  }, []);

  return (
    <div
      ref={rootRef}
      className={cn(notebook.root, GeistMono.variable)}
      style={{ minHeight: 0, height: '100%' }}
    >
      <canvas ref={canvasRef} className={styles.galaxy} />
    </div>
  );
}
