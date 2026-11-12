import { type CSSProperties, useEffect, useRef } from 'react';
import {
  BLUES,
  type BarStyle,
  GREENS,
  PIXELS,
  STRANDS,
  barHeight,
  barWidth,
  runPixelBar
} from 'lib/canvas/pixel-bar';
import styles from './canvas.module.css';
import { type CardId, type Layout, cardById } from './nodes';

/** Each theme's bar: the wire's colours for Classic, the contribution greens for Terminal, and so on. */
const LOOKS: Record<CardId, BarStyle> = {
  home: STRANDS,
  terminal: GREENS,
  panorama: BLUES,
  midnight: PIXELS,
  notebook: PIXELS
};

/** The least room either side of the bar, inside the screen, px. */
const MARGIN: Record<Layout, number> = { desktop: 32, mobile: 20 };
/** The label sits this far above the bar, px. */
const LABEL_GAP = 12;

// The bar waits for the first light to land, then fills in bursts, as data arriving would, over
// FILL_MS; it holds short of full until the page has loaded. Once full it holds a beat as its
// leading edge cools, then the screen grows.
const FILL_MS = 720;
const WAIT_AT = 0.92;
const HOLD_MS = 180;
/** Seconds in (as a share of the fill), and how full the bar is by then. */
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
  /** The screen's inner size, px. */
  width: number;
  height: number;
  /** When the first light lands on the display, ms after the send began. */
  landsAt: number;
  /** Whether the page being sent has loaded, so the bar may finish. */
  ready: boolean;
  /** Called once, when the bar is full and has cooled. */
  onDone: () => void;
};

/**
 * The display's screen while a theme is sent to it: the picture goes dark and a pixel progress bar
 * in the theme's own colours fills as the light comes up the bundle, its label and percentage
 * lined up with the bar's ends.
 */
export function SendProgress({ id, layout, width, height, landsAt, ready, onDone }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const readyRef = useRef(ready);
  const doneRef = useRef(onDone);
  useEffect(() => {
    readyRef.current = ready;
    doneRef.current = onDone;
  });

  useEffect(() => {
    const bar = runPixelBar(canvasRef.current!, LOOKS[id], MARGIN[layout]);
    const started = performance.now();
    let full = 0;
    let frame = 0;
    const step = (now: number) => {
      frame = requestAnimationFrame(step);
      const fill = fillAt((now - started - landsAt) / FILL_MS);
      bar.set(readyRef.current ? fill : Math.min(fill, WAIT_AT));
      const shown = Math.round(bar.shown() * 100);
      if (percentRef.current) percentRef.current.textContent = `${shown}%`;
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
    };
  }, [id, layout, landsAt]);

  // Where the bar lands in the screen, so the label lines up with its ends (see runPixelBar).
  const barW = barWidth(width - MARGIN[layout] * 2);
  const left = Math.round((width - barW) / 2);
  const top = Math.round((height - barHeight) / 2);

  return (
    <div className={styles.sending} aria-hidden>
      <canvas ref={canvasRef} className={styles.sendingBar} />
      <div
        className={styles.sendingLabel}
        style={{ left, width: barW, top: top - LABEL_GAP } as CSSProperties}
      >
        <span>Sending {cardById(id).title}</span>
        <span ref={percentRef}>0%</span>
      </div>
    </div>
  );
}
