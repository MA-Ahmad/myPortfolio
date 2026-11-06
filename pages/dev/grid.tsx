import { ReactElement, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GetServerSideProps } from 'next';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { type Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { PanoramaHome, PanoramaLayout } from 'themes/panorama';
import { GROUND_DEFAULTS, type GroundConfig, groundStore } from 'themes/panorama/torn/pixel-ground';
import type { NextPageWithLayout } from '../_app';

/**
 * Dev only: the tuning page for the Panorama theme's ground pixels. The real theme, with a panel of
 * presets and sliders that redraw the field live; switch the time of day in the header to judge it
 * white on night and black on day. Save writes `themes/panorama/torn/pixel-ground.json`.
 */

type Knob = { key: keyof GroundConfig; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; knobs: Knob[] }[] = [
  {
    title: 'Grid',
    knobs: [
      { key: 'cell', label: 'Pitch (px)', min: 4, max: 24, step: 1 },
      { key: 'size', label: 'Square (px)', min: 1, max: 22, step: 1 }
    ]
  },
  {
    title: 'Shape',
    knobs: [
      { key: 'reach', label: 'Reach up', min: 0.05, max: 1, step: 0.01 },
      { key: 'curve', label: 'Thinning', min: 0.3, max: 4, step: 0.1 },
      { key: 'density', label: 'Density', min: 0.05, max: 1, step: 0.01 },
      { key: 'corners', label: 'To corners', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Clumps',
    knobs: [
      { key: 'clump', label: 'Clump size', min: 2, max: 40, step: 1 },
      { key: 'clumping', label: 'Clumping', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Light',
    knobs: [
      { key: 'brightness', label: 'Strength', min: 0.02, max: 1, step: 0.01 },
      { key: 'floor', label: 'Faintest', min: 0, max: 1, step: 0.01 },
      { key: 'bright', label: 'Full cells', min: 0, max: 0.5, step: 0.01 },
      { key: 'night', label: 'Night opacity', min: 0, max: 1, step: 0.01 },
      { key: 'day', label: 'Day opacity', min: 0, max: 1, step: 0.01 }
    ]
  }
];

const PRESETS: { name: string; config: Partial<GroundConfig> }[] = [
  { name: 'Saved', config: GROUND_DEFAULTS },
  {
    name: 'Corners',
    config: {
      cell: 8,
      size: 6,
      reach: 0.45,
      curve: 1.3,
      density: 0.85,
      corners: 0.95,
      clump: 12,
      clumping: 0.7,
      brightness: 0.25,
      floor: 0.2,
      bright: 0.06
    }
  },
  {
    name: 'Full band',
    config: {
      cell: 8,
      size: 6,
      reach: 0.3,
      curve: 1.6,
      density: 0.8,
      corners: 0,
      clump: 10,
      clumping: 0.75,
      brightness: 0.2,
      floor: 0.2,
      bright: 0.05
    }
  },
  {
    name: 'Fine mesh',
    config: {
      cell: 6,
      size: 5,
      reach: 0.4,
      curve: 1.2,
      density: 0.95,
      corners: 0.6,
      clump: 14,
      clumping: 0.55,
      brightness: 0.18,
      floor: 0.35,
      bright: 0.04
    }
  },
  {
    name: 'Islands',
    config: {
      cell: 8,
      size: 6,
      reach: 0.38,
      curve: 1,
      density: 0.9,
      corners: 0.3,
      clump: 7,
      clumping: 1,
      brightness: 0.24,
      floor: 0.2,
      bright: 0.08
    }
  },
  {
    name: 'Chunky',
    config: {
      cell: 14,
      size: 11,
      reach: 0.3,
      curve: 1.8,
      density: 0.7,
      corners: 0.5,
      clump: 6,
      clumping: 0.8,
      brightness: 0.16,
      floor: 0.25,
      bright: 0.05
    }
  },
  {
    name: 'Dust',
    config: {
      cell: 10,
      size: 3,
      reach: 0.35,
      curve: 1.4,
      density: 0.35,
      corners: 0.4,
      clump: 9,
      clumping: 0.6,
      brightness: 0.4,
      floor: 0.2,
      bright: 0.12
    }
  }
];

type Props = { contributions: Activity[]; posts: BlogListPost[] };

const GridLab: NextPageWithLayout<Props> = ({ contributions, posts }) => (
  <>
    <Meta title="Ground pixels lab" noindex />
    <PanoramaHome contributions={contributions} posts={posts} />
    <Panel />
  </>
);

const noop = () => () => {};

function Panel() {
  const [config, setConfig] = useState<GroundConfig>(GROUND_DEFAULTS);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );

  useEffect(() => groundStore.set(config), [config]);
  useEffect(() => () => groundStore.set(GROUND_DEFAULTS), []);

  const set = (key: keyof GroundConfig, value: number) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const copy = async () => {
    const ok = await navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(
      () => true,
      () => false
    );
    setStatus(ok ? 'Copied JSON' : 'Copy failed');
  };
  const save = async () => {
    const res = await fetch('/api/dev/grid', {
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
        Ground pixels <span className="text-neutral-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto px-3 pb-3">
          <div className="mb-3 flex flex-wrap gap-1">
            {PRESETS.map((preset) => (
              <button
                key={preset.name}
                type="button"
                onClick={() => setConfig((current) => ({ ...current, ...preset.config }))}
                className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20"
              >
                {preset.name}
              </button>
            ))}
          </div>
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
            <button
              type="button"
              onClick={() => set('seed', Math.floor(Math.random() * 10000))}
              className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20"
            >
              New seed ({config.seed})
            </button>
            <button
              type="button"
              onClick={copy}
              className="rounded-md bg-white/10 px-2 py-1 hover:bg-white/20"
            >
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

GridLab.getLayout = (page: ReactElement) => <PanoramaLayout>{page}</PanoramaLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions().catch(() => []),
    getLatestBlogPosts().catch(() => [])
  ]);
  return { props: { contributions, posts } };
};

export default GridLab;
