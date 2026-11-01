import { ReactElement, useEffect, useMemo, useRef, useState } from 'react';
import type { GetServerSideProps } from 'next';
import dynamic from 'next/dynamic';
import Meta from 'components/shared/meta';
import { createBlast, deployStage } from 'blocks/friday-deploy/blast';
import { BLAST_CONFIG, type BlastConfig, blastSeconds } from 'blocks/friday-deploy/config';
import { KEY_HEIGHT, KEY_WIDTH, paintKeycap } from 'blocks/friday-deploy/keycap';
import type { NextPageWithLayout } from '../_app';

/**
 * Dev only: the tuning page for the Friday deploy blast. It draws the blast at any moment next to
 * the same moment of the reference recording, at the same scale, with every taste value on a
 * slider. Click the stage for a new seed; Save writes `blocks/friday-deploy/blast.json`, which the
 * block imports.
 */

type Knob = { key: keyof BlastConfig; label: string; min: number; max: number; step: number };

const GROUPS: { title: string; knobs: Knob[] }[] = [
  {
    title: 'Timing',
    knobs: [
      { key: 'deployMs', label: 'Deploy (ms)', min: 1200, max: 4000, step: 50 },
      { key: 'rewindMs', label: 'Rewind (ms)', min: 500, max: 2000, step: 50 }
    ]
  },
  {
    title: 'Cracks',
    knobs: [
      { key: 'crackGap', label: 'Gap (px)', min: 0, max: 4, step: 0.1 },
      { key: 'crackTwist', label: 'Twist (°)', min: 0, max: 8, step: 0.1 },
      { key: 'crackJag', label: 'Jag (px)', min: 0, max: 2.5, step: 0.05 }
    ]
  },
  {
    title: 'Shards',
    knobs: [
      { key: 'shardCount', label: 'Pieces', min: 5, max: 20, step: 1 },
      { key: 'shardSpeed', label: 'Speed', min: 0.4, max: 1.8, step: 0.05 },
      { key: 'shardDrag', label: 'Drag', min: 1.5, max: 6, step: 0.1 },
      { key: 'shardSpin', label: 'Spin', min: 0, max: 2, step: 0.05 },
      { key: 'shardDepth', label: 'Depth', min: 0, max: 1.5, step: 0.05 },
      { key: 'shardHold', label: 'Hold (s)', min: 0.4, max: 2, step: 0.05 },
      { key: 'glint', label: 'Glint', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Fire',
    knobs: [
      { key: 'fireSize', label: 'Size', min: 0.4, max: 1.8, step: 0.05 },
      { key: 'fireSeconds', label: 'Burn (s)', min: 0.1, max: 0.8, step: 0.01 },
      { key: 'smoke', label: 'Smoke', min: 0, max: 1, step: 0.01 }
    ]
  },
  {
    title: 'Shockwave',
    knobs: [
      { key: 'ringReach', label: 'Reach', min: 0.4, max: 1.6, step: 0.05 },
      { key: 'ringSeconds', label: 'Travel (s)', min: 0.25, max: 1.4, step: 0.05 }
    ]
  },
  {
    title: 'Particles',
    knobs: [
      { key: 'sparks', label: 'Sparks', min: 0, max: 160, step: 1 },
      { key: 'embers', label: 'Embers', min: 0, max: 120, step: 1 }
    ]
  },
  {
    title: 'Camera',
    knobs: [{ key: 'flash', label: 'Flash', min: 0, max: 1, step: 0.01 }]
  }
];

/** Frames of the reference recording, by milliseconds from its bang, at the stage's scale. */
const REFERENCE_MS = [-67, 0, 33, 67, 100, 150, 200, 300, 450, 600, 800, 1000, 1300];

const STAGE = 500;
const KEY = { width: KEY_WIDTH, height: KEY_HEIGHT };
const SPEEDS = [1, 0.25, 0.1];
const STORAGE_KEY = 'friday-deploy-lab';

const nearestReference = (ms: number) =>
  REFERENCE_MS.reduce((best, frame) => (Math.abs(frame - ms) < Math.abs(best - ms) ? frame : best));

function readRail(): BlastConfig[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
  } catch {
    // A private window or a cleared store starts with an empty rail.
    return [];
  }
}

function Lab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [config, setConfig] = useState<BlastConfig>(BLAST_CONFIG);
  // Seconds from the bang; negative while the key cracks.
  const [t, setT] = useState(0.1);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(0.25);
  const [savedTo, setSavedTo] = useState<string | null>(null);
  const [rail, setRail] = useState(readRail);
  const [dpr] = useState(() => Math.min(window.devicePixelRatio || 1, 2));

  const start = -config.deployMs / 1000;
  const end = blastSeconds(config);

  const texture = useMemo(() => paintKeycap(KEY.width, KEY.height, dpr), [dpr]);
  const blast = useMemo(
    () => createBlast({ x: STAGE / 2, y: STAGE / 2, ...KEY, texture, config }),
    [texture, config]
  );

  useEffect(() => {
    const ctx = canvasRef.current?.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#050506';
    ctx.fillRect(0, 0, STAGE, STAGE);
    if (t < 0) {
      // The deploy, as the block draws it: the cracks over the key, then its pieces pulling apart.
      blast.drawBreaking(ctx, deployStage(1 + t / (config.deployMs / 1000)));
    } else {
      blast.drawBack(ctx, t);
      blast.drawFront(ctx, t, 1);
    }
  }, [blast, t, config.deployMs, dpr]);

  useEffect(() => {
    if (!playing) return;
    let raf = 0;
    let last = performance.now();
    const tick = (now: number) => {
      const dt = ((now - last) / 1000) * speed;
      last = now;
      setT((current) => (current + dt > end ? start : current + dt));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, speed, start, end]);

  const set = (key: keyof BlastConfig, value: number) =>
    setConfig((current) => ({ ...current, [key]: value }));

  const save = async () => {
    const json = JSON.stringify(config, null, 2);
    const copied = await navigator.clipboard.writeText(json).then(
      () => true,
      () => false
    );
    const response = await fetch('/api/dev/friday-deploy', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: json
    });
    const result = await response.json();
    setSavedTo(
      response.ok
        ? `Saved to ${result.path}${copied ? ' (and copied)' : ''}`
        : `Not saved: ${result.error}`
    );
    if (!response.ok) return;
    const next = [config, ...rail.filter((entry) => JSON.stringify(entry) !== json)].slice(0, 12);
    setRail(next);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      // The rail is a convenience; the saved file is what counts.
    }
  };

  const ms = Math.round(t * 1000);
  const reference = nearestReference(ms);

  return (
    <div
      style={{ fontFamily: 'system-ui, sans-serif' }}
      className="min-h-screen bg-[#0b0b0d] p-6 text-sm text-neutral-200"
    >
      <div className="mx-auto flex max-w-[1440px] flex-wrap gap-6">
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <figure className="m-0">
              <canvas
                ref={canvasRef}
                width={STAGE * dpr}
                height={STAGE * dpr}
                style={{ width: STAGE, height: STAGE }}
                className="block cursor-pointer rounded-lg"
                onClick={() => set('seed', Math.floor(Math.random() * 1e6))}
                title="Click for a new seed"
              />
              <figcaption className="mt-2 flex justify-between text-neutral-400">
                <span>This block · {ms} ms</span>
                <span className="tabular-nums">seed {config.seed}</span>
              </figcaption>
            </figure>
            <figure className="m-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={`/dev/friday-deploy/ref${reference}.jpg`}
                alt={`Reference recording ${reference} ms from the bang`}
                width={STAGE}
                height={STAGE}
                className="block rounded-lg"
              />
              <figcaption className="mt-2 text-neutral-400">Reference · {reference} ms</figcaption>
            </figure>
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              className="rounded-md bg-white px-3 py-1.5 font-medium text-black"
              onClick={() => setPlaying(!playing)}
            >
              {playing ? 'Pause' : 'Play'}
            </button>
            {SPEEDS.map((value) => (
              <button
                key={value}
                type="button"
                className={`rounded-md px-2 py-1.5 tabular-nums ${speed === value ? 'bg-neutral-700 text-white' : 'text-neutral-400'}`}
                onClick={() => setSpeed(value)}
              >
                {value}×
              </button>
            ))}
            <input
              type="range"
              aria-label="Time from the bang"
              className="flex-1"
              min={start}
              max={end}
              step={0.001}
              value={t}
              onChange={(event) => {
                setPlaying(false);
                setT(Number(event.target.value));
              }}
            />
          </div>

          <div className="flex flex-wrap gap-1.5">
            {REFERENCE_MS.map((frame) => (
              <button
                key={frame}
                type="button"
                className={`rounded-md px-2 py-1 tabular-nums ${reference === frame ? 'bg-neutral-700 text-white' : 'bg-neutral-900 text-neutral-400'}`}
                onClick={() => {
                  setPlaying(false);
                  setT(frame / 1000);
                }}
              >
                {frame} ms
              </button>
            ))}
          </div>
        </div>

        <aside className="flex w-80 flex-col gap-4">
          {GROUPS.map((group) => (
            <fieldset key={group.title} className="m-0 rounded-lg border border-neutral-800 p-3">
              <legend className="px-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
                {group.title}
              </legend>
              {group.knobs.map((knob) => (
                <label
                  key={knob.key}
                  className="grid grid-cols-[96px_1fr_48px] items-center gap-2 py-0.5"
                >
                  <span className="text-neutral-400">{knob.label}</span>
                  <input
                    type="range"
                    min={knob.min}
                    max={knob.max}
                    step={knob.step}
                    value={config[knob.key]}
                    onChange={(event) => set(knob.key, Number(event.target.value))}
                  />
                  <span className="text-right tabular-nums">{config[knob.key]}</span>
                </label>
              ))}
            </fieldset>
          ))}

          <div className="flex gap-2">
            <button
              type="button"
              className="flex-1 rounded-md bg-white px-3 py-2 font-medium text-black"
              onClick={save}
            >
              Save
            </button>
            <button
              type="button"
              className="rounded-md bg-neutral-800 px-3 py-2"
              onClick={() => setConfig(BLAST_CONFIG)}
            >
              Reset to file
            </button>
          </div>
          {savedTo ? <p className="m-0 text-neutral-400">{savedTo}</p> : null}

          {rail.length ? (
            <div className="flex flex-wrap gap-1.5">
              {rail.map((entry, i) => (
                <button
                  key={i}
                  type="button"
                  className="rounded-md bg-neutral-900 px-2 py-1 tabular-nums text-neutral-300"
                  onClick={() => setConfig(entry)}
                >
                  #{entry.seed}
                </button>
              ))}
            </div>
          ) : null}
        </aside>
      </div>
    </div>
  );
}

// The lab reads the window (pixel ratio, saved rail) from its first render, so it never renders on the server.
const ClientLab = dynamic(() => Promise.resolve(Lab), { ssr: false });

const FridayDeployLab: NextPageWithLayout = () => (
  <>
    <Meta title="Friday deploy - tuning" noindex />
    <ClientLab />
  </>
);

FridayDeployLab.getLayout = (page: ReactElement) => page;

export const getServerSideProps: GetServerSideProps = async () =>
  process.env.NODE_ENV === 'production' ? { notFound: true } : { props: {} };

export default FridayDeployLab;
