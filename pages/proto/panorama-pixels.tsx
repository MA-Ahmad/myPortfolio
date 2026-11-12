// PROTOTYPE: delete this file and lib/proto/panorama-pixels.ts once a pixel direction is chosen. It lays
// its canvases over the real page from outside; nothing in the theme imports it.
import { type ReactElement, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { GetStaticProps } from 'next';
import type { BlogListPost } from 'components/blog/post-item';
import Meta from 'components/shared/meta';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { type Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { DEFAULTS, type Values, live, startField, startWelds } from 'lib/proto/panorama-pixels';
import { PanoramaHome, PanoramaLayout } from 'themes/panorama';
import type { NextPageWithLayout } from 'pages/_app';

type Props = { contributions: Activity[]; posts: BlogListPost[] };

type Pieces = Pick<Values, 'bloom' | 'lattice' | 'blocks' | 'hop' | 'sweep' | 'cursor' | 'keepSky'>;

/* Each direction is a set of pieces; the panel's checkboxes then mix any subset of them. */
const VARIANTS: { name: string; pieces: Pieces }[] = [
  { name: 'Current', pieces: { bloom: 0, lattice: 0, blocks: 0, hop: 0, sweep: 0, cursor: 0, keepSky: 1 } },
  { name: 'Bloom', pieces: { bloom: 1, lattice: 0, blocks: 0, hop: 1, sweep: 0, cursor: 0, keepSky: 0 } },
  { name: 'Lattice', pieces: { bloom: 0, lattice: 1, blocks: 0, hop: 0, sweep: 1, cursor: 1, keepSky: 0 } },
  { name: 'Blocks', pieces: { bloom: 0, lattice: 0, blocks: 1, hop: 1, sweep: 1, cursor: 0, keepSky: 0 } },
  { name: 'All', pieces: { bloom: 1, lattice: 1, blocks: 1, hop: 1, sweep: 1, cursor: 1, keepSky: 0 } }
];

const WELDS = ['Current sparks', 'Zip-evaporate', 'Condense', 'Pixel sparks'];

/* The page's own sky and sparks step aside for the pieces that replace them. */
const VARIANT_CSS = `
html[data-proto-sky='off'] [class*='__ditherSky'],
html[data-proto-sky='off'] [class*='__pixelSky'],
html[data-proto-sky='off'] [class*='__twinkles'] { display: none; }
html[data-proto-weld] [class*='__spark'],
html[data-proto-weld] [class*='__drip'] { display: none; }
html[data-proto-weld='2'] [class*='__headLine'],
html[data-proto-weld='2'] [class*='__haloLine'] { display: none; }
.proto-field { position: absolute; inset: 0; width: 100%; height: 100%; pointer-events: none; }
.proto-welds { position: fixed; inset: 0; z-index: 2147483000; width: 100vw; height: 100vh; pointer-events: none; }
.proto-panel { max-height: calc(100vh - 150px); overflow: auto; }
.proto-panel fieldset { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 10px; margin: 0; padding: 0; border: 0; }
.proto-panel .proto-check { display: flex; align-items: center; gap: 6px; cursor: pointer; }
.proto-panel legend, .proto-panel h2 { margin: 0 0 6px; padding: 0; font: inherit; color: rgba(255, 255, 255, 0.55); }
`;

/** Every running transition and animation, at the panel's speed, while a switch plays out. */
function atSpeed(rate: number) {
  if (rate === 1) return;
  const until = performance.now() + 4000 / rate;
  const step = () => {
    for (const animation of document.getAnimations()) if (animation.playbackRate !== rate) animation.playbackRate = rate;
    if (performance.now() < until) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

/** Opens the next section (or the first, from the last), which welds the seam beside it. */
function replay() {
  const faces = Array.from(document.querySelectorAll<HTMLButtonElement>('[class*="__face"]'));
  const open = faces.findIndex((face) => face.getAttribute('aria-expanded') === 'true');
  atSpeed(live.speed);
  faces[(open + 1) % faces.length]?.click();
}

const PICKER_CSS = `
.proto-picker {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 2147483647;
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px;
  border-radius: 999px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow:
    0 0 0 1px rgba(255, 255, 255, 0.08) inset,
    0 8px 24px rgba(0, 0, 0, 0.24),
    0 2px 6px rgba(0, 0, 0, 0.12);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1;
  -webkit-font-smoothing: antialiased;
  user-select: none;
  -webkit-user-select: none;
}

.proto-picker-highlight {
  position: absolute;
  top: 4px;
  left: 0;
  height: 28px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.12);
  will-change: transform;
}

.proto-picker[data-ready] .proto-picker-highlight {
  transition:
    transform 250ms cubic-bezier(0.23, 1, 0.32, 1),
    width 250ms cubic-bezier(0.23, 1, 0.32, 1);
}

@media (prefers-reduced-motion: reduce) {
  .proto-picker[data-ready] .proto-picker-highlight { transition: none; }
}

.proto-picker-item {
  position: relative;
  display: flex;
  align-items: center;
  height: 28px;
  padding: 0 12px;
  border: 0;
  border-radius: 999px;
  background: transparent;
  color: rgba(255, 255, 255, 0.55);
  font: inherit;
  cursor: pointer;
  transition: color 150ms ease-out;
}

.proto-picker-item:hover {
  color: rgba(255, 255, 255, 0.85);
}

.proto-picker-item:active {
  transform: scale(0.97);
}

.proto-picker-item:focus-visible {
  outline: 2px solid rgba(255, 255, 255, 0.4);
  outline-offset: 2px;
}

.proto-picker-item[data-active] {
  color: #fff;
}

.proto-picker-divider {
  width: 1px;
  height: 16px;
  margin: 0 4px;
  background: rgba(255, 255, 255, 0.12);
}

.proto-picker-replay {
  padding: 0 10px;
  font-size: 14px;
}

.proto-panel {
  position: fixed;
  top: 72px;
  right: 24px;
  z-index: 2147483647;
  display: grid;
  gap: 10px;
  width: 240px;
  padding: 12px;
  border-radius: 12px;
  background: rgba(10, 10, 10, 0.82);
  -webkit-backdrop-filter: blur(12px) saturate(1.4);
  backdrop-filter: blur(12px) saturate(1.4);
  box-shadow: 0 0 0 1px rgba(255, 255, 255, 0.08) inset, 0 8px 24px rgba(0, 0, 0, 0.24);
  color: rgba(255, 255, 255, 0.85);
  font: 12px/1.3 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
.proto-panel label { display: grid; gap: 4px; }
.proto-panel span { display: flex; justify-content: space-between; }
.proto-panel output { color: rgba(255, 255, 255, 0.55); font-variant-numeric: tabular-nums; }
.proto-panel select, .proto-panel button { font: inherit; color: inherit; background: rgba(255, 255, 255, 0.08); border: 0; border-radius: 6px; padding: 4px 6px; }
.proto-panel button { cursor: pointer; }
`;

function Panel({ values, set }: { values: Values; set: (key: keyof Values, value: number) => void }) {
  const slider = (key: keyof Values, label: string, min: number, max: number, step: number, unit: string) => (
    <label>
      <span>
        {label}{' '}
        <output>
          {values[key]}
          {unit}
        </output>
      </span>
      <input type="range" min={min} max={max} step={step} value={values[key]} onChange={(e) => set(key, +e.target.value)} />
    </label>
  );
  const check = (key: keyof Values, label: string) => (
    <label className="proto-check">
      <input type="checkbox" checked={values[key] > 0} onChange={(e) => set(key, e.target.checked ? 1 : 0)} />
      {label}
    </label>
  );
  const copy = () => {
    const on = (['bloom', 'lattice', 'blocks', 'hop', 'sweep', 'cursor', 'keepSky'] as const).filter((key) => values[key]);
    navigator.clipboard?.writeText(
      `pieces: ${on.join(' + ') || 'none'} · position: ${values.place ? 'top' : 'corners'} · weld: ${WELDS[values.weld]} · cell: ${values.cell}px · size: ${values.size}px · reach: ${values.reach} · density: ${values.density} · brightness: ${values.brightness} · glow: ${values.glow}px · hops: ${values.hops} · drift: ${values.drift} · sweep every: ${values.sweepEvery}s`
    );
  };
  return (
    <div className="proto-panel">
      <fieldset>
        <legend>Pieces</legend>
        {check('bloom', 'Corner bloom')}
        {check('lattice', 'Lattice')}
        {check('blocks', 'Blocks')}
        {check('keepSky', 'Old sky')}
      </fieldset>
      <fieldset>
        <legend>Motion</legend>
        {check('hop', 'Hop')}
        {check('sweep', 'Sweep')}
        {check('cursor', 'Cursor')}
      </fieldset>
      <label>
        <span>Position</span>
        <select value={values.place} onChange={(e) => set('place', +e.target.value)}>
          <option value={0}>Top left + bottom right</option>
          <option value={1}>Along the top</option>
        </select>
      </label>
      <label>
        <span>Seam join (R to replay)</span>
        <select value={values.weld} onChange={(e) => set('weld', +e.target.value)}>
          {WELDS.map((name, i) => (
            <option key={name} value={i}>
              {name}
            </option>
          ))}
        </select>
      </label>
      {slider('cell', 'Grid', 4, 12, 1, 'px')}
      {slider('size', 'Pixel', 1, 10, 0.5, 'px')}
      {slider('reach', 'Reach', 0.15, 0.8, 0.01, '')}
      {slider('density', 'Density', 0.1, 1, 0.01, '')}
      {slider('brightness', 'Brightness', 0.1, 1, 0.01, '')}
      {slider('glow', 'Glow', 0, 16, 1, 'px')}
      {slider('hops', 'White-hot cells', 0, 60, 1, '')}
      {slider('drift', 'Pattern drift', 0, 0.6, 0.01, '')}
      {slider('sweepEvery', 'Sweep every', 3, 20, 1, 's')}
      <label>
        <span>Speed</span>
        <select value={values.speed} onChange={(e) => set('speed', +e.target.value)}>
          <option value={1}>1x</option>
          <option value={0.5}>0.5x</option>
          <option value={0.25}>0.25x</option>
        </select>
      </label>
      <button type="button" onClick={copy}>
        Copy values
      </button>
    </div>
  );
}

const PanoramaPixelsProto: NextPageWithLayout<Props> = ({ contributions, posts }) => {
  const [current, setCurrent] = useState(1);
  const [values, setValues] = useState<Values>({ ...DEFAULTS, ...VARIANTS[1].pieces });
  const [ready, setReady] = useState(false);
  const [surface, setSurface] = useState<HTMLElement | null>(null);
  const itemRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const highlightRef = useRef<HTMLSpanElement>(null);
  const fieldRef = useRef<HTMLCanvasElement>(null);
  const weldsRef = useRef<HTMLCanvasElement>(null);

  const pick = (index: number) => {
    setCurrent(index);
    setValues((now) => ({ ...now, ...VARIANTS[index].pieces }));
  };

  // The draw loops read the values from `live`; the page under them never re-renders for a slider.
  useEffect(() => {
    Object.assign(live, values);
    const root = document.documentElement;
    if (values.keepSky) delete root.dataset.protoSky;
    else root.dataset.protoSky = 'off';
    if (values.weld) root.dataset.protoWeld = String(values.weld);
    else delete root.dataset.protoWeld;
  }, [values]);

  useEffect(() => {
    const url = new URL(location.href);
    url.searchParams.set('v', String(current + 1));
    history.replaceState(history.state, '', url);
  }, [current]);

  useEffect(
    () => () => {
      delete document.documentElement.dataset.protoSky;
      delete document.documentElement.dataset.protoWeld;
    },
    []
  );

  useLayoutEffect(() => {
    const v = Number(new URLSearchParams(location.search).get('v'));
    // The ?v= param and the sheet are only known in the browser; read once, after hydration.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (v >= 1 && v <= VARIANTS.length) pick(v - 1);
    setSurface(document.querySelector<HTMLElement>('[class*="__surface"]'));
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);

  useEffect(() => {
    const root = document.querySelector<HTMLElement>('[data-time]');
    if (!surface || !root || !fieldRef.current) return;
    return startField(fieldRef.current, root);
  }, [surface]);

  useEffect(() => startWelds(weldsRef.current!), []);

  // A switch made on the page itself, by a click or an arrow key, plays at the panel's speed too.
  useEffect(() => {
    const slow = (event: Event) => {
      if (event instanceof KeyboardEvent && !event.key.startsWith('Arrow')) return;
      if (event.type === 'click' && !(event.target as Element).closest?.('[class*="__face"]')) return;
      atSpeed(live.speed);
    };
    window.addEventListener('click', slow, true);
    window.addEventListener('keydown', slow, true);
    return () => {
      window.removeEventListener('click', slow, true);
      window.removeEventListener('keydown', slow, true);
    };
  }, []);

  useLayoutEffect(() => {
    const move = () => {
      const el = itemRefs.current[current];
      const highlight = highlightRef.current;
      if (!el || !highlight) return;
      highlight.style.width = `${el.offsetWidth}px`;
      highlight.style.transform = `translateX(${el.offsetLeft}px)`;
    };
    move();
    window.addEventListener('resize', move);
    return () => window.removeEventListener('resize', move);
  }, [current]);

  // Number keys switch and R replays. The arrow keys stay the page's: they move between sections.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const n = parseInt(e.key, 10);
      if (n >= 1 && n <= VARIANTS.length) pick(n - 1);
      else if (e.key === 'r' || e.key === 'R') replay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <>
      <Meta title="Panorama pixels prototype" noindex />
      <style dangerouslySetInnerHTML={{ __html: PICKER_CSS + VARIANT_CSS }} />
      <PanoramaLayout>
        <PanoramaHome contributions={contributions} posts={posts} />
      </PanoramaLayout>
      {surface && createPortal(<canvas ref={fieldRef} className="proto-field" aria-hidden="true" />, surface)}
      <canvas ref={weldsRef} className="proto-welds" aria-hidden="true" />
      <Panel values={values} set={(key, value) => setValues((now) => ({ ...now, [key]: value }))} />
      <nav className="proto-picker" aria-label="Prototype variants" data-ready={ready || undefined}>
        <span ref={highlightRef} className="proto-picker-highlight" aria-hidden="true" />
        {VARIANTS.map(({ name }, i) => (
          <button
            key={name}
            ref={(el) => {
              itemRefs.current[i] = el;
            }}
            className="proto-picker-item"
            data-active={i === current || undefined}
            aria-current={i === current ? 'true' : undefined}
            onClick={() => pick(i)}
          >
            {name}
          </button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true" />
        <button className="proto-picker-item proto-picker-replay" aria-label="Replay seam join (R)" onClick={replay}>
          ↻
        </button>
      </nav>
    </>
  );
};

PanoramaPixelsProto.getLayout = (page: ReactElement) => page;

// Only under `pnpm dev`: a production build has no such page.
export const getStaticProps: GetStaticProps<Props> = async () => {
  if (process.env.NODE_ENV !== 'development') return { notFound: true };
  const [contributions, posts] = await Promise.all([fetchGitHubContributions(), getLatestBlogPosts().catch(() => [])]);
  return { props: { contributions, posts } };
};

export default PanoramaPixelsProto;
