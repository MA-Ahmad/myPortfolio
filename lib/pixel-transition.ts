import type { NextRouter } from 'next/router';

type PixelTransitionOptions = {
  origin: { x: number; y: number };
  edge: string;
  background: string;
};

const CELL = 24;
const DELAY_MS = 0;
const DURATION_MS = 650;
const FRAMES = 40;
const JITTER = 0.25;
const EDGE_WIDTH = 0.06;

let running = false;

// The old page stays on screen as a browser snapshot while the new one loads, then its
// pixels drop away outward from `origin` to reveal the new page underneath.
export async function pixelNavigate(
  router: NextRouter,
  href: string,
  { origin, edge, background }: PixelTransitionOptions
) {
  if (running) return;

  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!document.startViewTransition) {
    await router.push(href);
    return;
  }

  running = true;
  const root = document.documentElement;
  if (!reduceMotion) {
    root.dataset.pixelTransition = '';
    root.style.setProperty('--pixel-transition-edge', edge);
    root.style.setProperty(
      '--pixel-transition-old-bg',
      getComputedStyle(document.body).backgroundColor
    );
    root.style.setProperty('--pixel-transition-new-bg', background);
  }

  const frames = reduceMotion ? null : buildFrames(origin);
  const transition = document.startViewTransition(async () => {
    await router.push(href);
  });

  try {
    await transition.ready;
    if (frames) {
      const { revealed, remaining } = frames;
      const timing = {
        delay: DELAY_MS,
        duration: DURATION_MS,
        easing: 'linear',
        fill: 'both' as const
      };
      root.animate(revealed, { ...timing, pseudoElement: '::view-transition-new(root)' });
      root.animate(remaining, { ...timing, pseudoElement: '::view-transition-old(root)' });
    }
    await transition.finished;
  } catch {
    // A skipped or failed transition still completes the navigation without animation.
  } finally {
    delete root.dataset.pixelTransition;
    root.style.removeProperty('--pixel-transition-edge');
    root.style.removeProperty('--pixel-transition-old-bg');
    root.style.removeProperty('--pixel-transition-new-bg');
    running = false;
  }
}

function buildFrames(origin: { x: number; y: number }) {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const cols = Math.ceil(width / CELL);
  const rows = Math.ceil(height / CELL);
  const maxDistance = Math.max(
    Math.hypot(origin.x, origin.y),
    Math.hypot(width - origin.x, origin.y),
    Math.hypot(origin.x, height - origin.y),
    Math.hypot(width - origin.x, height - origin.y)
  );

  const thresholds = new Float32Array(cols * rows);
  let maxThreshold = 0;
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const distance = Math.hypot((col + 0.5) * CELL - origin.x, (row + 0.5) * CELL - origin.y);
      const threshold = (distance / maxDistance) * (1 - JITTER) + Math.random() * JITTER;
      thresholds[row * cols + col] = threshold;
      maxThreshold = Math.max(maxThreshold, threshold);
    }
  }
  for (let i = 0; i < thresholds.length; i++) {
    thresholds[i] = (thresholds[i] / maxThreshold) * (1 - EDGE_WIDTH);
  }

  // One clip path per frame, with each row's adjacent cells merged into a single rect.
  const cellsPath = (include: (threshold: number) => boolean) => {
    let path = '';
    for (let row = 0; row < rows; row++) {
      let start = -1;
      for (let col = 0; col <= cols; col++) {
        const inside = col < cols && include(thresholds[row * cols + col]);
        if (inside && start < 0) start = col;
        if (!inside && start >= 0) {
          path += `M${start * CELL} ${row * CELL}h${(col - start) * CELL}v${CELL}h${-(col - start) * CELL}z`;
          start = -1;
        }
      }
    }
    return `path('${path || 'M0 0z'}')`;
  };

  const revealed: Keyframe[] = [];
  const remaining: Keyframe[] = [];
  for (let frame = 0; frame <= FRAMES; frame++) {
    const offset = frame / FRAMES;
    const progress = 1 - (1 - offset) ** 2;
    // step-end holds each frame's cells; two paths with the same shape count would otherwise morph.
    revealed.push({
      offset,
      easing: 'step-end',
      clipPath: cellsPath((t) => t < progress - EDGE_WIDTH)
    });
    remaining.push({ offset, easing: 'step-end', clipPath: cellsPath((t) => t >= progress) });
  }
  revealed[FRAMES].clipPath = 'none';
  remaining[FRAMES].clipPath = cellsPath(() => false);
  return { revealed, remaining };
}
