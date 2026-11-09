import { ReactElement, useEffect, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import type { GetServerSideProps } from 'next';
import Meta from 'components/shared/meta';
import type { BlogListPost } from 'components/blog/post-item';
import { getLatestBlogPosts } from 'lib/blogPosts';
import { type Activity, fetchGitHubContributions } from 'lib/github-contributions';
import { PanoramaHome, PanoramaLayout } from 'themes/panorama';
import {
  STYLE_LOOK,
  WELD_DEVICES,
  WELD_STYLES,
  WELDER_DEFAULTS,
  type WelderConfig,
  welderStore
} from 'themes/panorama/torn/welder-config';
import type { NextPageWithLayout } from '../_app';

/**
 * Dev only: the tuning page for welding a Panorama seam by hand. The real theme, with a panel to
 * pick the process (stick, MIG, TIG, laser, braze) and the device (pencil, electrode, TIG torch,
 * MIG gun, laser pen), and tune the bead, arc and cursor, live. Hover a
 * torn seam, hold and drag along it. "Start over" tears the seams again. Save writes
 * `themes/panorama/torn/welder.json`.
 */

type NumberKey = {
  [K in keyof WelderConfig]: WelderConfig[K] extends number ? K : never;
}[keyof WelderConfig];
type Knob = { key: NumberKey; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; knobs: Knob[] }[] = [
  {
    title: 'Bead',
    knobs: [
      { key: 'width', label: 'Width (px)', min: 2, max: 12, step: 0.1 },
      { key: 'cool', label: 'Cooling (ms)', min: 150, max: 3000, step: 50 },
      { key: 'dry', label: 'Drying (ms)', min: 200, max: 8000, step: 100 }
    ]
  },
  {
    title: 'Arc',
    knobs: [
      { key: 'glow', label: 'Light', min: 0, max: 2, step: 0.05 },
      { key: 'spatter', label: 'Spatter', min: 0, max: 2, step: 0.05 },
      { key: 'smoke', label: 'Smoke', min: 0, max: 2, step: 0.05 }
    ]
  },
  {
    title: 'Cursor',
    knobs: [
      { key: 'pen', label: 'Rod (px)', min: 8, max: 48, step: 1 },
      { key: 'hint', label: 'Hint', min: 0, max: 1, step: 1 }
    ]
  }
];

type Props = { contributions: Activity[]; posts: BlogListPost[] };

const WelderLab: NextPageWithLayout<Props> = ({ contributions, posts }) => {
  const [take, setTake] = useState(0);
  return (
    <>
      <Meta title="Welder lab" noindex />
      <PanoramaHome key={take} contributions={contributions} posts={posts} />
      <Panel onRestart={() => setTake((n) => n + 1)} />
    </>
  );
};

const noop = () => () => {};
const button = 'rounded-md bg-white/10 px-2 py-1 hover:bg-white/20';

function Panel({ onRestart }: { onRestart: () => void }) {
  const [config, setConfig] = useState<WelderConfig>(WELDER_DEFAULTS);
  const [open, setOpen] = useState(true);
  const [status, setStatus] = useState<string | null>(null);
  const mounted = useSyncExternalStore(
    noop,
    () => true,
    () => false
  );

  useEffect(() => welderStore.set(config), [config]);
  useEffect(() => () => welderStore.set(WELDER_DEFAULTS), []);

  const set = (key: NumberKey, value: number) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const copy = async () => {
    const ok = await navigator.clipboard.writeText(JSON.stringify(config, null, 2)).then(
      () => true,
      () => false
    );
    setStatus(ok ? 'Copied JSON' : 'Copy failed');
  };
  const save = async () => {
    const res = await fetch('/api/dev/welder', {
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
        Welder <span className="text-neutral-500">{open ? 'Hide' : 'Show'}</span>
      </button>
      {open && (
        <div className="max-h-[calc(100vh-140px)] overflow-y-auto px-3 pb-3">
          <fieldset className="mb-3">
            <legend className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
              Process
            </legend>
            <div className="flex flex-wrap gap-1">
              {WELD_STYLES.map((style) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={config.style === style}
                  onClick={() =>
                    setConfig((current) => ({ ...current, ...STYLE_LOOK[style].preset, style }))
                  }
                  className={`${button} ${config.style === style ? 'bg-white/30' : ''}`}
                >
                  {STYLE_LOOK[style].label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset className="mb-3">
            <legend className="mb-1 text-[11px] uppercase tracking-wide text-neutral-500">
              Device
            </legend>
            <div className="flex flex-wrap gap-1">
              {WELD_DEVICES.map((device) => (
                <button
                  key={device.key}
                  type="button"
                  aria-pressed={config.device === device.key}
                  onClick={() => setConfig((current) => ({ ...current, device: device.key }))}
                  className={`${button} ${config.device === device.key ? 'bg-white/30' : ''}`}
                >
                  {device.label}
                </button>
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
            <button type="button" onClick={onRestart} className={button}>
              Start over
            </button>
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

WelderLab.getLayout = (page: ReactElement) => <PanoramaLayout>{page}</PanoramaLayout>;

export const getServerSideProps: GetServerSideProps<Props> = async () => {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  const [contributions, posts] = await Promise.all([
    fetchGitHubContributions().catch(() => []),
    getLatestBlogPosts().catch(() => [])
  ]);
  return { props: { contributions, posts } };
};

export default WelderLab;
