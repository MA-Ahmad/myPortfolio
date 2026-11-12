import { type CSSProperties, type ComponentType, useEffect, useRef } from 'react';
import { Blocks, BriefcaseBusiness, Newspaper, UserRound } from 'lucide-react';
import {
  BLEED,
  BLUES,
  type BarStyle,
  GREENS,
  type PixelBar,
  STRANDS,
  barHeight,
  barWidth,
  colorOf,
  runPixelBar
} from 'lib/canvas/pixel-bar';
import styles from './canvas.module.css';
import { type CardId, type Layout, cardById } from './nodes';

/** The site's sections, as stretches of the bar: what fills first fills the bar's start. */
const SECTIONS: {
  name: string;
  icon: ComponentType<{ className?: string }>;
  share: number;
  color: string;
}[] = [
  { name: 'Intro', icon: UserRound, share: 0.22, color: '#4a98f0' },
  { name: 'Work', icon: BriefcaseBusiness, share: 0.3, color: '#4fd373' },
  { name: 'Articles', icon: Newspaper, share: 0.24, color: '#ec5aa5' },
  { name: 'Blocks', icon: Blocks, share: 0.24, color: '#f28530' }
];
/** Where each section starts and ends along the bar, as shares. */
const RANGES = SECTIONS.reduce<[number, number][]>((out, { share }) => {
  const from = out.length ? out[out.length - 1][1] : 0;
  return [...out, [from, from + share]];
}, []);

/** Colourful pixels, one segment for each section. */
const SECTIONED: BarStyle = {
  shape: 'square',
  segments: SECTIONS.map(({ color, share }) => ({ color, share }))
};

/** Each theme's bar: the wire's colours for Classic, the contribution greens for Terminal, and so on. */
const LOOKS: Record<CardId, BarStyle> = {
  home: STRANDS,
  terminal: GREENS,
  panorama: BLUES,
  midnight: SECTIONED,
  notebook: SECTIONED
};

/** The least room either side of the bar, inside the screen, and its rows of cells. */
const MARGIN: Record<Layout, number> = { desktop: 32, mobile: 20 };
const ROWS: Record<Layout, number> = { desktop: 12, mobile: 11 };

// The bar waits for the first light to land, then fills in bursts, as data arriving would, over
// FILL_MS; it holds short of full until the page has loaded. Once full it holds a beat as its
// leading edge cools, then the screen grows.
const FILL_MS = 720;
const WAIT_AT = 0.92;
const HOLD_MS = 180;
/** Time in (as a share of the fill), and how full the bar is by then. */
const BURSTS: [number, number][] = [
  [0, 0],
  [0.1, 0.07],
  [0.21, 0.22],
  [0.32, 0.29],
  [0.45, 0.46],
  [0.58, 0.63],
  [0.7, 0.78],
  [0.8, 0.86],
  [0.9, 0.93],
  [1, 1]
];

function fillAt(k: number) {
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  const i = BURSTS.findIndex(([at]) => at > k);
  const [k0, p0] = BURSTS[i - 1];
  const [k1, p1] = BURSTS[i];
  return p0 + ((p1 - p0) * (k - k0)) / (k1 - k0);
}

type Props = {
  id: CardId;
  layout: Layout;
  /** The screen's inner width, px. */
  width: number;
  /** When the first light lands on the display, ms after the send began. */
  landsAt: number;
  /** Whether the page being sent has loaded, so the bar may finish. */
  ready: boolean;
  /** Called once, when the bar is full and has cooled. */
  onDone: () => void;
};

/**
 * The display's screen while a theme is sent to it: the picture goes dark and a pixel progress bar
 * in the theme's own colours fills as the light comes up the bundle. Under it, the site's sections
 * fill in turn as the bar passes through them, each with its own percentage; pointing at one picks
 * its stretch out on the bar.
 */
export function SendProgress({ id, layout, width, landsAt, ready, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const rowRefs = useRef<(HTMLDivElement | null)[]>([]);
  const barRef = useRef<PixelBar | null>(null);
  const readyRef = useRef(ready);
  const doneRef = useRef(onDone);
  useEffect(() => {
    readyRef.current = ready;
    doneRef.current = onDone;
  });

  const look = LOOKS[id];
  const rows = ROWS[layout];
  const sectioned = look === SECTIONED;

  useEffect(() => {
    const bar = runPixelBar(canvasRef.current!, look, {
      margin: BLEED,
      rows,
      // A bar in one run of colour marks where each section ends; a sectioned one has its own lines.
      marks: sectioned ? undefined : RANGES.slice(0, -1).map(([, to]) => to)
    });
    barRef.current = bar;
    const started = performance.now();
    let full = 0;
    let frame = 0;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const fill = fillAt((now - started - landsAt) / FILL_MS);
      bar.set(readyRef.current ? fill : Math.min(fill, WAIT_AT));
      const shown = bar.shown();
      if (percentRef.current) percentRef.current.textContent = `${Math.round(shown * 100)}%`;
      RANGES.forEach(([from, to], i) => {
        const row = rowRefs.current[i];
        if (!row) return;
        const part = Math.max(0, Math.min(1, (shown - from) / (to - from)));
        const state = part >= 1 ? 'done' : part > 0 ? 'active' : 'waiting';
        if (row.dataset.state !== state) row.dataset.state = state;
        row.lastChild!.textContent = `${Math.round(part * 100)}%`;
      });
      if (!bar.settled()) return;
      full ||= now;
      if (now - full < HOLD_MS) return;
      cancelAnimationFrame(frame);
      doneRef.current();
    };
    frame = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(frame);
      bar.stop();
      barRef.current = null;
    };
  }, [look, rows, sectioned, landsAt]);

  // The bar is a whole number of cells; the label and the sections line up with its ends.
  const barW = barWidth(width - MARGIN[layout] * 2);
  const barH = barHeight(rows);

  return (
    <div className={styles.sending}>
      <div className={styles.sendingBody} style={{ width: barW }}>
        <div className={styles.sendingLabel} aria-hidden>
          <span>Sending {cardById(id).title}</span>
          <span ref={percentRef}>0%</span>
        </div>
        <div className={styles.sendingTrack} style={{ height: barH }}>
          <canvas
            ref={canvasRef}
            className={styles.sendingBar}
            style={{ left: -BLEED, top: -BLEED, width: barW + BLEED * 2, height: barH + BLEED * 2 }}
            aria-hidden
          />
        </div>
        <div className={styles.sendingSections} aria-hidden>
          {SECTIONS.map(({ name, icon: Icon, color }, i) => (
            <div
              key={name}
              ref={(row) => {
                rowRefs.current[i] = row;
              }}
              className={styles.sendingSection}
              data-state="waiting"
              style={
                {
                  '--section': sectioned ? color : colorOf(look, (RANGES[i][0] + RANGES[i][1]) / 2)
                } as CSSProperties
              }
              onPointerEnter={() => barRef.current?.focus(RANGES[i])}
              onPointerLeave={() => barRef.current?.focus(null)}
            >
              <span className={styles.sendingIcon}>
                <Icon className="size-3" />
              </span>
              <span className={styles.sendingName}>{name}</span>
              <span className={styles.sendingPercent}>0%</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
