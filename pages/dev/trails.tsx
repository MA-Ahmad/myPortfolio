import { ReactElement, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GetServerSideProps } from 'next';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { type Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { PanoramaHome, PanoramaLayout } from 'themes/panorama';
import { DITHER_DEFAULTS, ditherStore } from 'themes/panorama/torn/dither-sky';
import { TRAILS_DEFAULTS, type TrailsConfig, trailsStore } from 'themes/panorama/torn/trails-sky';
import { useTimeOfDay } from 'themes/panorama/time';
import type { NextPageWithLayout } from '../_app';

/**
 * Dev only: the generator for the Panorama theme's star trails. The real theme, with the trails
 * drawn across every torn section and a panel of knobs that redraw them live. New seed (or N) for
 * another sky; Save writes `themes/panorama/torn/trails-sky.json` and keeps it on the rail, where a
 * click brings it back. It shows here at night, always; on the theme page only if saved with
 * "Live" ticked.
 */

type NumberKey = {
  [K in keyof TrailsConfig]: TrailsConfig[K] extends number ? K : never;
}[keyof TrailsConfig];
type ColourKey = Exclude<keyof TrailsConfig, NumberKey>;
type Knob = { key: NumberKey; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; knobs: Knob[] }[] = [
  {
    title: 'Pole and band',
    knobs: [
      { key: 'poleX', label: 'Pole x', min: -1, max: 2, step: 0.01 },
      { key: 'poleY', label: 'Pole y', min: -1, max: 2.5, step: 0.01 },
      { key: 'inner', label: 'Inner radius', min: 0.05, max: 2, step: 0.01 },
      { key: 'outer', label: 'Outer radius', min: 0.1, max: 2.5, step: 0.01 },
      { key: 'edge', label: 'Soft edges', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Trails',
    knobs: [
      { key: 'count', label: 'Trails', min: 50, max: 2500, step: 10 },
      { key: 'sweep', label: 'Sweep (°)', min: 2, max: 120, step: 1 },
      { key: 'rotation', label: 'Rotation (°)', min: -180, max: 180, step: 1 },
      { key: 'spread', label: 'Scatter (°)', min: 0, max: 90, step: 1 },
      { key: 'thickness', label: 'Thickness', min: 0.3, max: 3, step: 0.05 },
      { key: 'brightness', label: 'Brightness', min: 0.05, max: 1.5, step: 0.01 },
      { key: 'warmShare', label: 'Warm trails', min: 0, max: 0.5, step: 0.01 },
      { key: 'fade', label: 'End fade', min: 0, max: 0.5, step: 0.01 }
    ]
  },
  {
    title: 'Sky',
    knobs: [
      { key: 'haze', label: 'Haze', min: 0, max: 1.5, step: 0.01 },
      { key: 'stars', label: 'Point stars', min: 0, max: 1200, step: 10 },
      { key: 'opacity', label: 'Opacity', min: 0, max: 1, step: 0.01 }
    ]
  }
];

const COLOURS: { key: ColourKey; label: string }[] = [
  { key: 'cool', label: 'Blue' },
  { key: 'white', label: 'Bright' },
  { key: 'warm', label: 'Warm' }
];

/** Five directions, each a different place for the pole and so a different shape of sky. */
const VARIANTS: { name: string; config: Partial<TrailsConfig> }[] = [
  {
    // The pole low in the middle, behind the content: one rainbow of trails over every section.
    name: 'Arch',
    config: {
      seed: 2407,
      dither: 0,
      poleX: 0.55,
      poleY: 1.15,
      inner: 0.3,
      outer: 0.62,
      edge: 0.6,
      count: 1200,
      sweep: 70,
      rotation: -105,
      spread: 30,
      thickness: 1.1,
      brightness: 0.75,
      haze: 1.2,
      stars: 260
    }
  },
  {
    // The pole off the top-left corner: tight curls at the left opening into long sweeps across.
    name: 'Vortex',
    config: {
      seed: 811,
      dither: 0,
      poleX: -0.06,
      poleY: 0.1,
      inner: 0.12,
      outer: 1.25,
      edge: 0.4,
      count: 1500,
      sweep: 46,
      rotation: 42,
      spread: 34,
      thickness: 1,
      brightness: 0.75,
      haze: 0.9,
      stars: 220
    }
  },
  {
    // The pole far below the sheet: long, nearly flat streaks gliding along the top.
    name: 'Horizon',
    config: {
      seed: 5120,
      dither: 0,
      poleX: 0.45,
      poleY: 3.2,
      inner: 1.55,
      outer: 1.95,
      edge: 0.5,
      count: 1100,
      sweep: 22,
      rotation: -88,
      spread: 14,
      thickness: 1,
      brightness: 0.8,
      haze: 1,
      stars: 320
    }
  },
  {
    // The pole in the sky, over the right-hand sections: full rings around a still point.
    name: 'Polaris',
    config: {
      seed: 3303,
      dither: 0,
      poleX: 0.8,
      poleY: 0.22,
      inner: 0.03,
      outer: 0.95,
      edge: 0.3,
      count: 1400,
      sweep: 55,
      rotation: 0,
      spread: 180,
      thickness: 1,
      brightness: 0.7,
      haze: 0.5,
      stars: 200
    }
  },
  {
    // The arch on the dithered sky's square cells.
    name: 'Arch, dithered',
    config: {
      seed: 2407,
      dither: 1,
      poleX: 0.55,
      poleY: 1.15,
      inner: 0.3,
      outer: 0.62,
      edge: 0.6,
      count: 1200,
      sweep: 70,
      rotation: -105,
      spread: 30,
      thickness: 1.1,
      brightness: 0.75,
      haze: 0.8,
      stars: 260
    }
  }
];

const MODES: { label: string; dither: number }[] = [
  { label: 'Smooth', dither: 0 },
  { label: 'Dithered', dither: 1 }
];

type Props = { contributions: Activity[]; posts: BlogListPost[] };

const TrailsLab: NextPageWithLayout<Props> = ({ contributions, posts }) => (
  <>
    <Meta title="Star trails lab" noindex />
    <PanoramaHome contributions={contributions} posts={posts} />
    <Panel />
  </>
);

const noop = () => () => {};
const button = 'rounded-md bg-white/10 px-2 py-1 hover:bg-white/20';
const RAIL_KEY = 'trails-lab';

function readRail(): TrailsConfig[] {
  try {
    return JSON.parse(localStorage.getItem(RAIL_KEY) ?? '[]');
  } catch {
    // A private window or a cleared store starts with an empty rail.
    return [];
  }
}

function Panel() {
  // `enabled` here is only whether they're live on the theme page, which is what Save writes; this
  // page always shows them.
  const [config, setConfig] = useState<TrailsConfig>(TRAILS_DEFAULTS);
  const [glow, setGlow] = useState(false);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  // Read once on the client; the panel renders nothing until mounted, so the server never sees it.
  const [rail, setRail] = useState<TrailsConfig[]>(() =>
    typeof window === 'undefined' ? [] : readRail()
  );
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );
  const { time } = useTimeOfDay();

  useEffect(() => trailsStore.set({ ...config, enabled: 1 }), [config]);
  useEffect(() => ditherStore.set({ ...DITHER_DEFAULTS, enabled: glow ? 1 : 0 }), [glow]);
  useEffect(
    () => () => {
      trailsStore.set(TRAILS_DEFAULTS);
      ditherStore.set(DITHER_DEFAULTS);
    },
    []
  );

  const set = <K extends keyof TrailsConfig>(key: K, value: TrailsConfig[K]) =>
    setConfig((current) => ({ ...current, [key]: value }));
  const reseed = () => set('seed', Math.floor(Math.random() * 100000));

  // N for a new sky; the arrow keys belong to the sections.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable) return;
      if (event.key === 'n' || event.key === 'N')
        setConfig((current) => ({ ...current, seed: Math.floor(Math.random() * 100000) }));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const copy = async () => {
    const ok = await navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(
      () => true,
      () => false
    );
    setStatus(ok ? 'Copied JSON' : 'Copy failed');
  };
  const save = async () => {
    const next = [
      config,
      ...rail.filter((c) => JSON.stringify(c) !== JSON.stringify(config))
    ].slice(0, 12);
    setRail(next);
    try {
      localStorage.setItem(RAIL_KEY, JSON.stringify(next));
    } catch {
      // Without storage the rail lasts this visit.
    }
    const res = await fetch('/api/dev/trails', {
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
        Star trails <span className="text-neutral-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto px-3 pb-3">
          {time !== 'night' && (
            <p className="mb-2 rounded-md bg-amber-500/15 px-2 py-1 text-amber-200">
              Night only: pick the moon in the header.
            </p>
          )}
          <div className="mb-3 flex items-center gap-1">
            {MODES.map((mode) => (
              <button
                key={mode.label}
                type="button"
                onClick={() => set('dither', mode.dither)}
                aria-pressed={config.dither === mode.dither}
                className={`${button} ${config.dither === mode.dither ? 'bg-white/25' : ''}`}
              >
                {mode.label}
              </button>
            ))}
            <span className="ml-auto tabular-nums text-neutral-400">seed {config.seed}</span>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            <button
              type="button"
              onClick={reseed}
              className="rounded-md bg-white px-2 py-1 text-black"
            >
              New seed (N)
            </button>
          </div>
          <div className="mb-3 flex flex-wrap gap-1">
            {VARIANTS.map((variant) => (
              <button
                key={variant.name}
                type="button"
                onClick={() =>
                  setConfig((current) => ({
                    ...current,
                    ...variant.config,
                    enabled: current.enabled
                  }))
                }
                className={button}
              >
                {variant.name}
              </button>
            ))}
          </div>
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
                checked={glow}
                onChange={(event) => setGlow(event.target.checked)}
              />
              Dithered glow behind them
            </label>
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
          {rail.length > 0 && (
            <fieldset className="mt-3">
              <legend className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
                Saved
              </legend>
              <div className="flex flex-wrap gap-1">
                {rail.map((saved, i) => (
                  <button
                    key={`${saved.seed}-${i}`}
                    type="button"
                    onClick={() => setConfig(saved)}
                    className={`${button} tabular-nums`}
                  >
                    {saved.seed}
                    {saved.dither ? ' · dith' : ''}
                  </button>
                ))}
              </div>
            </fieldset>
          )}
        </div>
      )}
    </div>,
    document.body
  );
}

TrailsLab.getLayout = (page: ReactElement) => <PanoramaLayout>{page}</PanoramaLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions().catch(() => []),
    getLatestBlogPosts().catch(() => [])
  ]);
  return { props: { contributions, posts } };
};

export default TrailsLab;
