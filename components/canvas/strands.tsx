import { type Ref, useEffect, useImperativeHandle, useLayoutEffect, useRef } from 'react';
import { type Point, wireReach } from 'lib/canvas/geometry';
import {
  PALETTE_DARK,
  PALETTE_LIGHT,
  type Rgb,
  type StrandEnd,
  createStrands,
  fanHalf,
  paletteAt,
  strandPoints
} from 'lib/canvas/strands';
import styles from './canvas.module.css';

export type StrandsMode = 'live' | 'idle' | 'off';
export type StrandsHandle = { moveEnd: (to: Point) => void };

type Props = {
  ref?: Ref<StrandsHandle>;
  /** Stage size in CSS px, and how world coordinates map onto it. */
  width: number;
  height: number;
  scale: number;
  ox: number;
  oy: number;
  from: Point;
  fromDir: number;
  to: Point;
  toDir: number;
  /**
   * Half the width of the fan at each end, when it should span a card's edge whatever the distance.
   * Left out, the fan grows with the wire's length.
   */
  fanFrom?: number;
  fanTo?: number;
  mode: StrandsMode;
  /** The phone layout. */
  compact: boolean;
  /** prefers-reduced-motion */
  reduced: boolean;
};

type Band = { s: number; speed: number; strength: number };
type Spark = { strand: number; s: number; speed: number };

// Per mode: how bright the bundle is, how far the far end has fanned open, how often bands of light
// start (seconds; 0 = never), how fast they cross (bundle lengths / s) and how strong they are.
type Mode = { level: number; tipFan: number; every: number; speed: number; strength: number };
const MODES: Record<StrandsMode, Mode> = {
  // Sending: band after band at speed, with sparks racing up single strands between them.
  live: { level: 1, tipFan: 1, every: 0.13, speed: 2.2, strength: 1 },
  // Connected and waiting: the whole fan open, a slow band of light every second or so.
  idle: { level: 0.8, tipFan: 1, every: 1.1, speed: 0.5, strength: 0.6 },
  // Between themes while the carousel moves: dark, so it can fade back in on the next one.
  off: { level: 0, tipFan: 0.6, every: 0, speed: 0, strength: 0 }
};
const EASE = 0.18; // seconds for level and tipFan to settle
const MAX_BANDS = 12;
// The opening volley when sending starts: this many bands, this far apart along the bundle.
const VOLLEY = 5;
const VOLLEY_GAP = 0.16;
const VOLLEY_SPEED = 2.6;
// Sparks: short hot dashes, each racing up one strand while the bundle is sending.
const SPARK_RATE = 70; // per second
const SPARK_MAX = 80;
const SPARK_WIDTH = 0.022; // half-length, as a share of the bundle
const SPARK_HOT = 0.85;
const BAND_WIDTH = 0.04; // half-length of a band, as a share of the bundle
const BASE_ALPHA_DARK = 0.34; // a resting strand on the dark page
const HOT = 0.5; // how far a band's core is mixed toward white (dark page)
const GLOW_WIDTH = 3.5; // glow stroke, in hairlines
const GLOW_ALPHA = 0.07; // glow opacity at full strength
const CORE_WIDTH = 1.4; // core stroke, in hairlines
const CORE_ALPHA = 0.6; // core opacity scale at full strength
const SMILE = 0.035; // how far the middle strands run ahead of the outer ones
const COUNT = 96;
const COUNT_COMPACT = 64;
const SEGMENTS = 36;
const SEGMENTS_COMPACT = 28;
// The bundle fans across most of a card's top edge.
const FAN_MAX = 112;
const FAN_MAX_COMPACT = 14;
// The bundle's middle is a weight on a spring: it trails the ends when a node is moved, swings past
// and settles. Underdamped, so it reads as a rope and not a rod.
const SWAY_STIFFNESS = 110;
const SWAY_DAMPING = 11;
// It never hangs further out than this share of the bundle's length.
const SWAY_LIMIT = 0.45;
// Moving a node stirs the light up: at this speed (px/s) the bundle is at its liveliest.
const STIR_SPEED = 900;
const STIR_LEVEL = 0.2; // added brightness
const STIR_PACE = 0.65; // share of the wait between bands it removes
const STIR_EASE = 0.25; // seconds for the stir to die down

const rgba = (c: Rgb, a: number) => `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a})`;

export function Strands(props: Props) {
  const { ref, width, height } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const propsRef = useRef(props);
  const endRef = useRef<Point | null>(null);
  const toRef = useRef(props.to);
  const dprRef = useRef(1);

  useImperativeHandle(ref, () => ({ moveEnd: (to) => (endRef.current = to) }), []);

  // After every render, before paint: the loop reads props from a ref, and a new `to` ends any moveEnd override.
  useLayoutEffect(() => {
    propsRef.current = props;
    if (toRef.current.x !== props.to.x || toRef.current.y !== props.to.y) {
      toRef.current = props.to;
      endRef.current = null;
    }
  });

  useLayoutEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    dprRef.current = dpr;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = width + 'px';
    canvas.style.height = height + 'px';
  }, [width, height]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext('2d');
    if (!canvas || !ctx) return;
    const strands = createStrands(COUNT);
    const points = new Float32Array((SEGMENTS + 1) * 2);
    const tmp: Rgb = [0, 0, 0];
    const hot: Rgb = [0, 0, 0];
    const bands: Band[] = [];
    const sparks: Spark[] = [];
    let sending = false;
    let sparkDue = 0;
    // The bundle runs up and down, so each end points along y and fans along x.
    const a: StrandEnd = { at: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, perp: { x: 1, y: 0 }, half: 0 };
    const b: StrandEnd = { at: { x: 0, y: 0 }, dir: { x: 0, y: 1 }, perp: { x: 1, y: 0 }, half: 0 };
    let level = 0;
    let tipFan = 0;
    let sinceSpawn = 0;
    let nextSpawn = 0;
    let last = performance.now();
    let raf = 0;
    // Where the bundle's middle is, how fast it is going, and where it would rest.
    let midX = NaN;
    let midY = 0;
    let velX = 0;
    let velY = 0;
    let restX = 0;
    let restY = 0;
    let stir = 0;

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const p = propsRef.current;
      const to = endRef.current ?? p.to;
      const mode = MODES[p.mode];

      // The middle follows its resting place on a spring. A bundle that is dark, or new, starts at rest.
      const nextX = (p.from.x + to.x) / 2;
      const nextY = (p.from.y + to.y) / 2;
      let swayX = 0;
      let swayY = 0;
      if (p.reduced || p.mode === 'off' || Number.isNaN(midX) || dt === 0) {
        midX = nextX;
        midY = nextY;
        velX = velY = 0;
        stir = 0;
      } else {
        const moved = Math.hypot(nextX - restX, nextY - restY) / dt;
        stir += (Math.min(1, moved / STIR_SPEED) - stir) * (1 - Math.exp(-dt / (moved > 1 ? 0.06 : STIR_EASE)));
        velX += (SWAY_STIFFNESS * (nextX - midX) - SWAY_DAMPING * velX) * dt;
        velY += (SWAY_STIFFNESS * (nextY - midY) - SWAY_DAMPING * velY) * dt;
        midX += velX * dt;
        midY += velY * dt;
        swayX = midX - nextX;
        swayY = midY - nextY;
        const limit = SWAY_LIMIT * Math.hypot(to.x - p.from.x, to.y - p.from.y);
        const out = Math.hypot(swayX, swayY);
        if (out > limit) {
          swayX *= limit / out;
          swayY *= limit / out;
          midX = nextX + swayX;
          midY = nextY + swayY;
        }
      }
      restX = nextX;
      restY = nextY;

      if (p.reduced) {
        level = mode.level;
        tipFan = mode.tipFan;
        bands.length = 0;
        sparks.length = 0;
      } else {
        // Sending opens with a volley, one band hard on the heels of the last.
        if (p.mode === 'live' && !sending) {
          for (let k = 0; k < VOLLEY; k++) bands.push({ s: -0.08 - k * VOLLEY_GAP, speed: VOLLEY_SPEED, strength: 1 });
          sinceSpawn = 0;
          nextSpawn = (VOLLEY * VOLLEY_GAP) / VOLLEY_SPEED;
        }
        sending = p.mode === 'live';
        for (let i = sparks.length - 1; i >= 0; i--) {
          sparks[i].s += sparks[i].speed * dt;
          if (sparks[i].s > 1.06) sparks.splice(i, 1);
        }
        if (sending) {
          sparkDue += SPARK_RATE * dt;
          while (sparkDue >= 1 && sparks.length < SPARK_MAX) {
            sparkDue -= 1;
            sparks.push({ strand: Math.floor(Math.random() * COUNT), s: -0.05, speed: 2 + Math.random() * 1.8 });
          }
          sparkDue %= 1;
        }
        const k = 1 - Math.exp(-dt / EASE);
        const lit = mode.level > 0 ? Math.min(1, mode.level + STIR_LEVEL * stir) : 0;
        level += (lit - level) * k;
        tipFan += (mode.tipFan - tipFan) * k;
        for (let i = bands.length - 1; i >= 0; i--) {
          bands[i].s += bands[i].speed * dt;
          if (bands[i].s > 1.15 || (bands[i].s < -0.12 && !sending)) bands.splice(i, 1);
        }
        sinceSpawn += dt;
        if (mode.every > 0 && sinceSpawn > nextSpawn && bands.length < MAX_BANDS) {
          bands.push({
            s: -0.1,
            speed: mode.speed * (0.8 + Math.random() * 0.4),
            strength: mode.strength
          });
          sinceSpawn = 0;
          nextSpawn = mode.every * (0.8 + Math.random() * 0.4) * (1 - STIR_PACE * stir);
        }
      }

      const { from, fromDir, toDir, scale, ox, oy, compact } = p;
      const dpr = dprRef.current;
      const count = compact ? COUNT_COMPACT : COUNT;
      const segments = compact ? SEGMENTS_COMPACT : SEGMENTS;
      const length = Math.hypot(to.x - from.x, to.y - from.y);
      const half = fanHalf(length, compact ? FAN_MAX_COMPACT : FAN_MAX);
      a.at = from;
      a.dir.y = fromDir;
      a.half = p.fanFrom ?? half;
      b.at = to;
      b.dir.y = toDir;
      b.half = (p.fanTo ?? half) * tipFan;
      const reach = wireReach(from, fromDir, to);
      const flip = fromDir === toDir ? -1 : 1;
      const lane = flip === 1 ? 0 : from.x > to.x ? 1 : -1;

      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(dpr * scale, 0, 0, dpr * scale, dpr * ox, dpr * oy);
      const dark = document.documentElement.classList.contains('dark');
      const palette = dark ? PALETTE_DARK : PALETTE_LIGHT;
      ctx.globalCompositeOperation = dark ? 'lighter' : 'source-over';
      const hair = (dpr >= 2 ? 0.75 : 1) / scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';

      for (let n = 0; n < count; n++) {
        // A compact bundle spreads its fewer strands evenly over the full set so the palette still spans it.
        const strand = strands[compact ? Math.floor((n * COUNT) / count) : n];
        strandPoints(points, a, b, strand, reach, flip, lane, segments, swayX, swayY);
        const c = paletteAt(palette, (strand.u + 1) / 2, tmp);

        ctx.beginPath();
        ctx.moveTo(points[0], points[1]);
        for (let i = 1; i <= segments; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
        ctx.lineWidth = hair;
        ctx.strokeStyle = rgba(c, 1);
        ctx.globalAlpha = level * strand.level * (dark ? BASE_ALPHA_DARK : 0.6);
        ctx.stroke();

        if (bands.length === 0) continue;
        if (dark) {
          hot[0] = c[0] + (255 - c[0]) * HOT;
          hot[1] = c[1] + (255 - c[1]) * HOT;
          hot[2] = c[2] + (255 - c[2]) * HOT;
        } else {
          hot[0] = c[0];
          hot[1] = c[1];
          hot[2] = c[2];
        }
        for (const band of bands) {
          const centre = band.s + SMILE * (1 - strand.u * strand.u) + strand.lag;
          if (centre < -2 * BAND_WIDTH || centre > 1 + 2 * BAND_WIDTH) continue;
          const j0 = Math.max(0, Math.floor((centre - 2 * BAND_WIDTH) * segments));
          const j1 = Math.min(segments, Math.ceil((centre + 2 * BAND_WIDTH) * segments));
          if (j1 <= j0) continue;
          const g = ctx.createLinearGradient(points[j0 * 2], points[j0 * 2 + 1], points[j1 * 2], points[j1 * 2 + 1]);
          g.addColorStop(0, rgba(c, 0));
          g.addColorStop(0.5, rgba(hot, 1));
          g.addColorStop(1, rgba(c, 0));
          ctx.beginPath();
          ctx.moveTo(points[j0 * 2], points[j0 * 2 + 1]);
          for (let i = j0 + 1; i <= j1; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
          ctx.strokeStyle = g;
          ctx.lineWidth = hair * GLOW_WIDTH;
          ctx.globalAlpha = GLOW_ALPHA * band.strength * level;
          ctx.stroke();
          ctx.lineWidth = hair * CORE_WIDTH;
          ctx.globalAlpha = CORE_ALPHA * band.strength * level * (0.5 + 0.5 * strand.level);
          ctx.stroke();
        }
      }

      // Sparks, each on its own strand: far hotter than a band and a fraction of its length.
      for (const spark of sparks) {
        if (compact && spark.strand % 2) continue;
        const j0 = Math.max(0, Math.floor((spark.s - 2 * SPARK_WIDTH) * segments));
        const j1 = Math.min(segments, Math.ceil((spark.s + 2 * SPARK_WIDTH) * segments));
        if (j1 <= j0) continue;
        const strand = strands[spark.strand];
        strandPoints(points, a, b, strand, reach, flip, lane, segments, swayX, swayY);
        const c = paletteAt(palette, (strand.u + 1) / 2, tmp);
        const mix = dark ? SPARK_HOT : 0;
        hot[0] = c[0] + (255 - c[0]) * mix;
        hot[1] = c[1] + (255 - c[1]) * mix;
        hot[2] = c[2] + (255 - c[2]) * mix;
        const g = ctx.createLinearGradient(points[j0 * 2], points[j0 * 2 + 1], points[j1 * 2], points[j1 * 2 + 1]);
        g.addColorStop(0, rgba(c, 0));
        g.addColorStop(0.7, rgba(hot, 1));
        g.addColorStop(1, rgba(c, 0));
        ctx.beginPath();
        ctx.moveTo(points[j0 * 2], points[j0 * 2 + 1]);
        for (let i = j0 + 1; i <= j1; i++) ctx.lineTo(points[i * 2], points[i * 2 + 1]);
        ctx.strokeStyle = g;
        ctx.lineWidth = hair * 5;
        ctx.globalAlpha = 0.14 * level;
        ctx.stroke();
        ctx.lineWidth = hair * 1.8;
        ctx.globalAlpha = 0.95 * level;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, []);

  return <canvas ref={canvasRef} className={styles.strands} data-strands aria-hidden />;
}
