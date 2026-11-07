import { ReactElement, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GetServerSideProps } from 'next';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { type Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { PanoramaHome, PanoramaLayout } from 'themes/panorama';
import { DITHER_DEFAULTS, type DitherConfig, ditherStore } from 'themes/panorama/torn/dither-sky';
import { SKY_DEFAULTS, skyStore } from 'themes/panorama/torn/pixel-sky';
import { useTimeOfDay } from 'themes/panorama/time';
import type { NextPageWithLayout } from '../_app';

/**
 * Dev only: the tuning page for the Panorama theme's dithered night band. The real theme, with a
 * panel of presets, sliders and colours that redraw the band live. It shows at night only. Save
 * writes `themes/panorama/torn/dither-sky.json` (with "On" ticked, it ships).
 */

type NumberKey = {
  [K in keyof DitherConfig]: DitherConfig[K] extends number ? K : never;
}[keyof DitherConfig];
type ColourKey = Exclude<keyof DitherConfig, NumberKey>;
type Knob = { key: NumberKey; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; knobs: Knob[] }[] = [
  {
    title: 'Pixels',
    knobs: [
      { key: 'cell', label: 'Cell (px)', min: 1, max: 10, step: 0.5 },
      { key: 'gap', label: 'Gap (dev px)', min: 0, max: 3, step: 1 },
      { key: 'levels', label: 'Levels', min: 3, max: 24, step: 1 },
      { key: 'curve', label: 'Curve', min: 1, max: 2.4, step: 0.05 },
      { key: 'chroma', label: 'Colour specks', min: 0, max: 1, step: 0.05 },
      { key: 'noise', label: 'Noise', min: 0, max: 1, step: 0.01 },
      { key: 'floor', label: 'Dark dots', min: 0, max: 0.6, step: 0.01 },
      { key: 'farDots', label: 'Far dots', min: 0, max: 1, step: 0.05 }
    ]
  },
  {
    title: 'Band',
    knobs: [
      { key: 'angle', label: 'Tilt (°)', min: -45, max: 45, step: 1 },
      { key: 'offset', label: 'Position', min: -0.2, max: 1.2, step: 0.01 },
      { key: 'width', label: 'Width', min: 0.05, max: 1.5, step: 0.01 },
      { key: 'greenAt', label: 'Green at', min: 0.05, max: 0.95, step: 0.01 },
      { key: 'yellowAt', label: 'Yellow at', min: 0.05, max: 0.95, step: 0.01 },
      { key: 'softness', label: 'Softness', min: 0, max: 1, step: 0.05 },
      { key: 'glow', label: 'Halo', min: 0, max: 1, step: 0.01 },
      { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 }
    ]
  }
];

const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'top', label: 'Top' },
  { key: 'green', label: 'Green' },
  { key: 'yellow', label: 'Yellow' },
  { key: 'bottom', label: 'Bottom' }
];

const PRESETS: { name: string; config: Partial<DitherConfig> }[] = [
  { name: 'Saved', config: DITHER_DEFAULTS },
  {
    name: 'Aurora',
    config: {
      cell: 3,
      gap: 0,
      levels: 8,
      curve: 1.6,
      chroma: 0.12,
      noise: 0.3,
      floor: 0.3,
      farDots: 0.4,
      angle: -10,
      offset: 0.17,
      width: 0.26,
      softness: 1,
      glow: 0.1,
      opacity: 0.85,
      green: '#1d8c55',
      yellow: '#d9b65a',
      greenAt: 0.45,
      yellowAt: 0.7
    }
  },
  {
    name: 'Horizon',
    config: {
      cell: 3,
      gap: 0,
      levels: 8,
      curve: 1.6,
      chroma: 0.12,
      noise: 0.3,
      floor: 0.3,
      farDots: 0.3,
      angle: -24,
      offset: 0.62,
      width: 0.55,
      softness: 1,
      glow: 0.2,
      opacity: 0.8,
      green: '#178a63',
      yellow: '#e2a845',
      greenAt: 0.35,
      yellowAt: 0.74
    }
  },
  {
    name: 'Thin',
    config: {
      cell: 2.5,
      gap: 0,
      levels: 8,
      curve: 1.6,
      chroma: 0.15,
      noise: 0.3,
      floor: 0.25,
      farDots: 0.3,
      angle: -8,
      offset: 0.12,
      width: 0.14,
      softness: 1,
      glow: 0.3,
      opacity: 0.9,
      green: '#22b06a',
      yellow: '#efd06b',
      greenAt: 0.4,
      yellowAt: 0.7
    }
  },
  {
    name: 'Coarse',
    config: {
      cell: 5,
      gap: 1,
      levels: 6,
      curve: 1.6,
      chroma: 0.2,
      noise: 0.35,
      floor: 0.35,
      farDots: 0.5,
      angle: -12,
      offset: 0.2,
      width: 0.32,
      softness: 1,
      glow: 0.15,
      opacity: 0.8,
      green: '#1d8c55',
      yellow: '#d9b65a',
      greenAt: 0.45,
      yellowAt: 0.7
    }
  },
  {
    name: 'Faint',
    config: {
      cell: 3,
      gap: 0,
      levels: 8,
      curve: 1.6,
      chroma: 0.08,
      noise: 0.3,
      floor: 0.2,
      farDots: 0.2,
      angle: -10,
      offset: 0.15,
      width: 0.24,
      softness: 1,
      glow: 0.08,
      opacity: 0.6,
      green: '#17724a',
      yellow: '#b49650',
      greenAt: 0.45,
      yellowAt: 0.7
    }
  }
];

type Props = { contributions: Activity[]; posts: BlogListPost[] };

const DitherLab: NextPageWithLayout<Props> = ({ contributions, posts }) => (
  <>
    <Meta title="Dithered sky lab" noindex />
    <PanoramaHome contributions={contributions} posts={posts} />
    <Panel />
  </>
);

const noop = () => () => {};
const button = 'rounded-md bg-white/10 px-2 py-1 hover:bg-white/20';

function Panel() {
  // On while tuning, whatever is saved.
  const [config, setConfig] = useState<DitherConfig>({ ...DITHER_DEFAULTS, enabled: 1 });
  const [grid, setGrid] = useState(true);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
  const { time } = useTimeOfDay();

  useEffect(() => ditherStore.set(config), [config]);
  useEffect(
    () => skyStore.set(grid ? SKY_DEFAULTS : { ...SKY_DEFAULTS, night: 0, twinkles: 0 }),
    [grid]
  );
  useEffect(
    () => () => {
      ditherStore.set(DITHER_DEFAULTS);
      skyStore.set(SKY_DEFAULTS);
    },
    []
  );

  const set = <K extends keyof DitherConfig>(key: K, value: DitherConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const copy = async () => {
    const ok = await navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(
      () => true,
      () => false
    );
    setStatus(ok ? 'Copied JSON' : 'Copy failed');
  };
  const save = async () => {
    const res = await fetch('/api/dev/dither', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
    setStatus(res.ok ? `Saved to ${(await res.json()).path}` : 'Save failed');
  };

  if (!mounted) return null;
  return createPortal(
    <div className="fixed right-4 top-16 z-[100] w-72 rounded-xl border border-white/10 bg-neutral-900/90 text-[12px] text-neutral-200 shadow-2xl backdrop-blur">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2 font-medium"
      >
        Dithered sky <span className="text-neutral-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto px-3 pb-3">
          {time !== 'night' && (
            <p className="mb-2 rounded-md bg-amber-500/15 px-2 py-1 text-amber-200">
              Night only: pick the moon in the header.
            </p>
          )}
          <div className="mb-3 flex flex-col gap-1">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={config.enabled > 0}
                onChange={(event) => set('enabled', event.target.checked ? 1 : 0)}
              />
              On (saved as on, it ships)
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={grid}
                onChange={(event) => setGrid(event.target.checked)}
              />
              Show the pixel grid and stars too
            </label>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() =>
                  setConfig((current) => ({
                    ...current,
                    ...preset.config,
                    enabled: current.enabled
                  }))
                }
                className={button}
              >
                {preset.name}
              </button>
            ))}
          </div>
          <fieldset className="mb-3">
            <legend className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
              Colours, top to bottom
            </legend>
            <div className="grid grid-cols-4 gap-2">
              {COLOURS.map((colour) => (
                <label key={colour.key} className="flex flex-col items-center gap-1">
                  <input
                    type="color"
                    value={config[colour.key]}
                    onChange={(event) => set(colour.key, event.target.value)}
                    className="h-7 w-full cursor-pointer rounded border-0 bg-transparent"
                  />
                  <span className="text-neutral-400">{colour.label}</span>
                </label>
              ))}
            </div>
          </fieldset>
          {GROUPS.map((group) => (
            <fieldset key={group.title} className="mb-3">
              <legend className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
                {group.title}
              </legend>
              {group.knobs.map((knob) => (
                <label
                  key={knob.key}
                  className="mb-1 grid grid-cols-[88px_1fr_40px] items-center gap-2"
                >
                  <span>{knob.label}</span>
                  <input
                    type="range"
                    min={knob.min}
                    max={knob.max}
                    step={knob.step}
                    value={config[knob.key]}
                    onChange={(event) => set(knob.key, Number(event.target.value))}
                  />
                  <span className="text-right tabular-nums text-neutral-400">
                    {config[knob.key]}
                  </span>
                </label>
              ))}
            </fieldset>
          ))}
          <div className="flex flex-wrap gap-1">
            <button type="button" onClick={copy} className={button}>
              Copy JSON
            </button>
            <button
              type="button"
              onClick={save}
              className="rounded-md bg-white px-2 py-1 text-black"
            >
              Save
            </button>
          </div>
          {status && <p className="mt-2 text-neutral-400">{status}</p>}
        </div>
      )}
    </div>,
    document.body
  );
}

DitherLab.getLayout = (page: ReactElement) => <PanoramaLayout>{page}</PanoramaLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions().catch(() => []),
    getLatestBlogPosts().catch(() => [])
  ]);
  return { props: { contributions, posts } };
};

export default DitherLab;
