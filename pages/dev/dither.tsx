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
 * panel of presets, sliders and colours that redraw the glow live. It shows here at night,
 * always; on the theme page only if saved with "Live" ticked. Save writes
 * `themes/panorama/torn/dither-sky.json`.
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
    title: 'Horizon',
    knobs: [
      { key: 'angle', label: 'Tilt (°)', min: -45, max: 45, step: 1 },
      { key: 'offset', label: 'Position', min: -0.2, max: 1.2, step: 0.01 },
      { key: 'width', label: 'Band height', min: 0.1, max: 1.5, step: 0.01 },
      { key: 'taper', label: 'Taper', min: 0, max: 1, step: 0.05 },
      { key: 'edge', label: 'Edge', min: 0.002, max: 0.2, step: 0.002 },
      { key: 'below', label: 'Glow under', min: 0, max: 0.5, step: 0.01 },
      { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Cool glow (high)',
    knobs: [
      { key: 'coolStrength', label: 'Strength', min: 0, max: 1.5, step: 0.01 },
      { key: 'coolAt', label: 'Peak at', min: 0, max: 1, step: 0.01 },
      { key: 'coolUp', label: 'Fade up', min: 0.02, max: 1.5, step: 0.01 },
      { key: 'coolDown', label: 'Fade down', min: 0.01, max: 0.6, step: 0.01 }
    ]
  },
  {
    title: 'Warm glow (low)',
    knobs: [
      { key: 'warmStrength', label: 'Strength', min: 0, max: 1.5, step: 0.01 },
      { key: 'warmAt', label: 'Peak at', min: 0, max: 1, step: 0.01 },
      { key: 'warmWidth', label: 'Spread', min: 0.01, max: 0.6, step: 0.01 }
    ]
  },
  {
    title: 'Rim (on the horizon)',
    knobs: [
      { key: 'rimStrength', label: 'Strength', min: 0, max: 1.5, step: 0.01 },
      { key: 'rimWidth', label: 'Spread', min: 0.005, max: 0.2, step: 0.005 }
    ]
  }
];

const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'cool', label: 'Cool' },
  { key: 'warm', label: 'Warm' },
  { key: 'rim', label: 'Rim' }
];

/** The glows as fitted to the reference's measured profile: blue over amber over a red rim. */
const REFERENCE: Partial<DitherConfig> = {
  cool: '#44beff',
  coolStrength: 0.41,
  coolAt: 0.28,
  coolUp: 0.38,
  coolDown: 0.09,
  warm: '#ff9519',
  warmStrength: 0.46,
  warmAt: 0.16,
  warmWidth: 0.095,
  rim: '#ff1a0a',
  rimStrength: 0.45,
  rimWidth: 0.035,
  edge: 0.02,
  below: 0.12
};

const PRESETS: { name: string; config: Partial<DitherConfig> }[] = [
  { name: 'Saved', config: DITHER_DEFAULTS },
  {
    name: 'Reference',
    config: { ...REFERENCE, angle: -8, offset: 0.6, width: 0.36, taper: 0.45, opacity: 0.85 }
  },
  {
    name: 'Aurora',
    config: {
      ...REFERENCE,
      cool: '#2fd38c',
      coolStrength: 0.36,
      warm: '#ffc94a',
      warmStrength: 0.4,
      rim: '#ff7a2e',
      rimStrength: 0.2,
      angle: -8,
      offset: 0.36,
      width: 0.36,
      taper: 0.3,
      opacity: 0.85
    }
  },
  {
    name: 'High',
    config: { ...REFERENCE, angle: -6, offset: 0.24, width: 0.3, taper: 0.5, opacity: 0.85 }
  },
  {
    name: 'Faint',
    config: {
      ...REFERENCE,
      coolStrength: 0.25,
      warmStrength: 0.26,
      rimStrength: 0.15,
      angle: -8,
      offset: 0.36,
      width: 0.36,
      taper: 0.4,
      floor: 0.2,
      farDots: 0.2,
      opacity: 0.6
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
  // `enabled` here is only whether it's live on the theme page, which is what Save writes; this
  // page always shows it, so tuning never needs it live.
  const [config, setConfig] = useState<DitherConfig>(DITHER_DEFAULTS);
  const [grid, setGrid] = useState(true);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
  const { time } = useTimeOfDay();

  useEffect(() => ditherStore.set({ ...config, enabled: 1 }), [config]);
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
              Live on /themes/panorama (when saved)
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
              Colours
            </legend>
            <div className="grid grid-cols-3 gap-2">
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
