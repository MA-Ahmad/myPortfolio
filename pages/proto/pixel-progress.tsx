// PROTOTYPE: a page to check the pixel progress bar on before it goes into the Theme Studio's
// display. Delete it once the bar is in.
import { type ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import type { GetStaticProps } from 'next';
import Meta from 'components/shared/meta';
import { BLEED, type BarStyle, DOTS, PIXELS, type PixelBar, barHeight, runPixelBar } from 'lib/canvas/pixel-bar';
import type { NextPageWithLayout } from 'pages/_app';

/* The reference's own run: seconds in, and how full the bar is by then. */
const RUN: [number, number][] = [
  [0, 0],
  [0.35, 0.22],
  [0.7, 0.32],
  [1.03, 0.46],
  [1.37, 0.63],
  [1.7, 0.785],
  [2.03, 0.87],
  [2.37, 0.897],
  [2.7, 0.928],
  [3.03, 0.987],
  [3.3, 1]
];
const RUN_S = RUN[RUN.length - 1][0];

function runAt(t: number) {
  if (t >= RUN_S) return 1;
  const i = RUN.findIndex(([at]) => at > t);
  const [t0, p0] = RUN[i - 1];
  const [t1, p1] = RUN[i];
  return p0 + ((p1 - p0) * (t - t0)) / (t1 - t0);
}

const CSS = `
.pp-root { min-height: 100vh; padding: 48px 24px 96px; background: #fff; color: #e8e9ec; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
.pp-col { display: grid; gap: 40px; justify-items: center; width: 100%; }
.pp-card { width: min(1040px, 100%); padding: 20px 4px 28px; border-radius: 14px; background: #16171a; box-shadow: 0 1px 2px rgba(0,0,0,.2), 0 12px 32px -8px rgba(0,0,0,.35); }
.pp-card h2 { margin: 0 20px 2px; font-size: 20px; font-weight: 600; line-height: 1.2; }
.pp-card p { margin: 0 20px; color: rgba(255,255,255,.5); font: 12px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pp-bar { display: block; width: 100%; }
.pp-display { width: 560px; max-width: 100%; border-radius: 14px; overflow: hidden; background: #fff; box-shadow: 0 0 0 1px rgba(0,0,0,.12), 0 12px 32px -8px rgba(0,0,0,.25); color: #111; }
.pp-display header { height: 43px; display: flex; align-items: center; gap: 8px; padding: 0 14px; border-bottom: 1px solid rgba(0,0,0,.1); font-weight: 500; }
.pp-screen { height: 315px; display: grid; align-content: center; background: #0c0d0f; }
.pp-label { display: flex; justify-content: space-between; margin: 0 ${BLEED}px -${BLEED - 10}px; color: rgba(255,255,255,.55); font: 11px/1.4 ui-monospace, SFMono-Regular, Menlo, monospace; }
.pp-tools { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); display: flex; align-items: center; gap: 12px; padding: 8px 12px; border-radius: 999px; background: rgba(10,10,10,.86); color: #fff; box-shadow: 0 8px 24px rgba(0,0,0,.24); }
.pp-tools button, .pp-tools select { font: inherit; color: inherit; background: rgba(255,255,255,.12); border: 0; border-radius: 999px; padding: 5px 12px; cursor: pointer; }
.pp-tools label { display: flex; align-items: center; gap: 6px; }
.pp-tools input[type=range] { width: 160px; }
`;

/** One bar on a canvas, following `progress`. */
function Bar({ progress, jump, look }: { progress: number; jump: boolean; look: BarStyle }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const bar = useRef<PixelBar | null>(null);
  useEffect(() => {
    bar.current = runPixelBar(ref.current!, look);
    return () => bar.current?.stop();
  }, [look]);
  useEffect(() => bar.current?.set(progress, jump), [progress, jump]);
  return <canvas ref={ref} className="pp-bar" style={{ height: barHeight + BLEED * 2 }} aria-hidden="true" />;
}

const PixelProgressProto: NextPageWithLayout = () => {
  const [progress, setProgress] = useState(0);
  const [jump, setJump] = useState(false);
  const [loop, setLoop] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [run, setRun] = useState(1);

  const replay = useCallback(() => setRun((n) => n + 1), []);

  // Plays the reference's run; looping, it holds full for a moment and starts over.
  useEffect(() => {
    if (!run) return;
    const started = performance.now();
    let frame = 0;
    let timer = 0;
    const step = (now: number) => {
      const t = ((now - started) / 1000) * speed;
      setJump(t < 0.05);
      setProgress(t < 0.05 ? 0 : runAt(t - 0.05));
      if (t < RUN_S + 0.05) frame = requestAnimationFrame(step);
      else if (loop) timer = window.setTimeout(replay, 1800 / speed);
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(timer);
    };
  }, [run, loop, speed, replay]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'r' || event.key === 'R') replay();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replay]);

  return (
    <div className="pp-root">
      <Meta title="Pixel progress prototype" noindex />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pp-col">
        {[
          { name: 'Pixels', look: PIXELS },
          { name: 'Dots', look: DOTS }
        ].map(({ name, look }) => (
          <div key={name} className="pp-col">
            <section className="pp-card">
              <h2>{name}</h2>
              <p>At the reference&apos;s size · {(progress * 357.8).toFixed(1)} GB</p>
              <Bar progress={progress} jump={jump} look={look} />
            </section>
            <section className="pp-display">
              <header>Display</header>
              <div className="pp-screen">
                <div className="pp-label">
                  <span>Loading Midnight</span>
                  <span>{Math.round(progress * 100)}%</span>
                </div>
                <Bar progress={progress} jump={jump} look={look} />
              </div>
            </section>
          </div>
        ))}
      </div>
      <div className="pp-tools">
        <button type="button" onClick={replay}>
          Replay (R)
        </button>
        <label>
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
        </label>
        <label>
          Progress
          <input
            type="range"
            min={0}
            max={1}
            step={0.001}
            value={progress}
            onChange={(e) => {
              setRun(0);
              setJump(false);
              setProgress(+e.target.value);
            }}
          />
        </label>
        <select value={speed} onChange={(e) => setSpeed(+e.target.value)} aria-label="Speed">
          <option value={1}>1x</option>
          <option value={0.5}>0.5x</option>
          <option value={0.25}>0.25x</option>
        </select>
      </div>
    </div>
  );
};

PixelProgressProto.getLayout = (page: ReactElement) => page;

// Only under `pnpm dev`: a production build has no such page.
export const getStaticProps: GetStaticProps = async () => {
  if (process.env.NODE_ENV !== 'development') return { notFound: true };
  return { props: {} };
};

export default PixelProgressProto;
