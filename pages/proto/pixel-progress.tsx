// PROTOTYPE: a page to see (and record) each theme's send progress bar on its own, as the Theme
// Studio's display shows it. Delete it once it has served.
import { type CSSProperties, type ReactElement, useCallback, useEffect, useState } from 'react';
import type { GetStaticProps } from 'next';
import { Monitor } from 'lucide-react';
import { type CardId, cardById } from 'components/canvas/nodes';
import { SendProgress } from 'components/canvas/send-progress';
import Meta from 'components/shared/meta';
import type { NextPageWithLayout } from 'pages/_app';

/* One display for each bar: Classic, Terminal, Panorama, and Midnight (Notebook shares its bar). */
const THEMES: { id: CardId; accent: string }[] = [
  { id: 'home', accent: '#7db4ff' },
  { id: 'terminal', accent: '#b8c572' },
  { id: 'panorama', accent: '#a5b4fc' },
  { id: 'midnight', accent: '#f5a524' }
];

// The display's own size on desktop (nodes.ts): 560 wide, a 43px header over a 315px screen.
const W = 560;
// Shorter than the real display's, so all four fit in one recording.
const SCREEN_H = 232;
// The send's light lands on the display this long after it starts (SEND_LANDS_MS).
const LANDS_MS = 320;
// How long a finished bar stays up before it plays again.
const AGAIN_MS = 1400;

const CSS = `
.pp-root { min-height: 100vh; display: grid; place-items: center; padding: 32px 24px; background: #0a0a0b; background-image: radial-gradient(rgb(255 255 255 / 0.07) 1px, transparent 1.2px); background-size: 22px 22px; color: #e8e9ec; font: 13px/1.4 -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; -webkit-font-smoothing: antialiased; }
.pp-grid { display: grid; grid-template-columns: repeat(2, ${W}px); justify-content: center; gap: 32px; }
.pp-one { display: grid; justify-items: center; }
.pp-one .pp-item { transform: scale(var(--zoom)); }
.pp-item { display: grid; }
.pp-display { width: ${W}px; border-radius: 14px; overflow: hidden; background: #141416; box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.1), 0 12px 32px -8px rgb(0 0 0 / 0.6); }
.pp-display header { height: 43px; display: flex; align-items: center; gap: 10px; padding: 0 14px; border-bottom: 1px solid rgb(255 255 255 / 0.08); font-weight: 500; }
.pp-display header span:last-child { margin-left: auto; color: rgb(255 255 255 / 0.45); font: 12px ui-monospace, SFMono-Regular, Menlo, monospace; }
.pp-icon { display: grid; place-items: center; width: 24px; height: 24px; border-radius: 7px; background: rgb(255 255 255 / 0.08); }
.pp-screen { position: relative; height: ${SCREEN_H}px; background: #0b0b0c; }
.pp-tools[hidden] { display: none; }
.pp-tools { position: fixed; left: 50%; bottom: 24px; transform: translateX(-50%); z-index: 10; display: flex; align-items: center; gap: 8px; padding: 6px; border-radius: 999px; background: rgb(24 24 27 / 0.9); backdrop-filter: blur(12px); box-shadow: inset 0 0 0 1px rgb(255 255 255 / 0.08), 0 8px 24px rgb(0 0 0 / 0.4); color: #fff; }
.pp-tools button, .pp-tools select { height: 30px; white-space: nowrap; font: inherit; color: inherit; background: transparent; border: 0; border-radius: 999px; padding: 0 12px; cursor: pointer; transition: background-color 150ms ease-out; }
.pp-tools button:hover, .pp-tools select:hover { background: rgb(255 255 255 / 0.1); }
.pp-tools button[data-on] { background: rgb(255 255 255 / 0.16); }
.pp-tools label { display: flex; align-items: center; gap: 6px; padding: 0 10px; }
.pp-divider { width: 1px; height: 16px; background: rgb(255 255 255 / 0.12); }
`;

/** A display playing one theme's send bar; `run` changes to play it again. */
function Display({
  id,
  accent,
  run,
  onDone,
  resolution
}: {
  id: CardId;
  accent: string;
  run: number;
  onDone: () => void;
  resolution: number;
}) {
  const card = cardById(id);
  return (
    <section className="pp-display" aria-label={`${card.title} display`}>
      <header>
        <span className="pp-icon" style={{ color: accent }}>
          <Monitor className="size-3.5" />
        </span>
        Display
        <span>{card.route}</span>
      </header>
      <div className="pp-screen">
        <SendProgress
          key={run}
          id={id}
          layout="desktop"
          width={W - 2}
          landsAt={LANDS_MS}
          ready
          onDone={onDone}
          resolution={resolution}
        />
      </div>
    </section>
  );
}

const PixelProgressProto: NextPageWithLayout = () => {
  // 'all', or one theme shown alone and larger, for recording.
  const [shown, setShown] = useState<'all' | CardId>('all');
  const [zoom, setZoom] = useState(1.5);
  const [loop, setLoop] = useState(true);
  // The controls stay out of the recording; H shows them.
  const [tools, setTools] = useState(false);
  const [runs, setRuns] = useState<Record<string, number>>({});

  const replay = useCallback((id?: CardId) => {
    setRuns((now) => {
      const next = { ...now };
      for (const theme of THEMES)
        if (!id || theme.id === id) next[theme.id] = (now[theme.id] ?? 0) + 1;
      return next;
    });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement).tagName;
      if (tag === 'SELECT' || tag === 'INPUT') return;
      if (event.key === 'r' || event.key === 'R') replay();
      if (event.key === 'h' || event.key === 'H') setTools((on) => !on);
      const n = parseInt(event.key, 10);
      if (n === 0) setShown('all');
      else if (n >= 1 && n <= THEMES.length) {
        setShown(THEMES[n - 1].id);
        replay(THEMES[n - 1].id);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [replay]);

  const done = (id: CardId) => () => {
    if (loop) window.setTimeout(() => replay(id), AGAIN_MS);
  };

  const items = THEMES.filter(({ id }) => shown === 'all' || shown === id);

  return (
    <div className="pp-root">
      <Meta title="Send progress prototype" noindex />
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        className={shown === 'all' ? 'pp-grid' : 'pp-one'}
        style={{ '--zoom': zoom } as CSSProperties}
      >
        {items.map(({ id, accent }) => (
          <div key={id} className="pp-item">
            <Display
              id={id}
              accent={accent}
              run={runs[id] ?? 0}
              onDone={done(id)}
              // Shown alone, the screen is scaled up: its bar is drawn as much sharper.
              resolution={shown === 'all' ? 1 : zoom}
            />
          </div>
        ))}
      </div>
      <nav className="pp-tools" aria-label="Prototype controls" hidden={!tools}>
        <button
          type="button"
          data-on={shown === 'all' || undefined}
          onClick={() => setShown('all')}
        >
          All
        </button>
        {THEMES.map(({ id }) => (
          <button
            key={id}
            type="button"
            data-on={shown === id || undefined}
            onClick={() => {
              setShown(id);
              replay(id);
            }}
          >
            {cardById(id).title}
          </button>
        ))}
        <span className="pp-divider" aria-hidden />
        <button type="button" onClick={() => replay()}>
          Replay (R)
        </button>
        <label>
          <input type="checkbox" checked={loop} onChange={(e) => setLoop(e.target.checked)} /> Loop
        </label>
        <select
          value={zoom}
          onChange={(e) => setZoom(+e.target.value)}
          aria-label="Size when shown alone"
        >
          <option value={1}>1x</option>
          <option value={1.25}>1.25x</option>
          <option value={1.5}>1.5x</option>
          <option value={1.75}>1.75x</option>
        </select>
      </nav>
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
