import { type CSSProperties, type ReactNode, type Ref, memo, useEffect, useRef } from 'react';
import { noise, type Point, pointsOf, xAt } from './tear';
import styles from './torn.module.css';

/**
 * Five ways to weld a seam shut. Each one is a gap profile (`gapAt`: how open the seam is, at
 * every point along it, at every moment of the weld) plus a drawing. The pieces' clip paths and the
 * bead are driven from that one profile, so they never drift.
 */
export const WELDS = {
  torch: { label: 'Torch' },
  spot: { label: 'Spot' },
  arc: { label: 'Arc' },
  molten: { label: 'Molten' },
  snap: { label: 'Snap' }
} as const;

export type WeldKind = keyof typeof WELDS;
export const WELD_KINDS = Object.keys(WELDS) as WeldKind[];
export const WELD_MS = 1400;

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const smooth = (v: number) => v * v * (3 - 2 * v);

/**
 * Zip welds close behind a front that runs along the seam at constant speed: torch from the top,
 * molten from the bottom, or two fronts out both ways from wherever the seam was clicked. Ahead of
 * a front the gap opens again over `taper` px, so the seam reads as a V closing.
 */
const ZIPS = {
  torch: { from: 150, to: 1000, taper: 72, down: true },
  molten: { from: 200, to: 1000, taper: 72, down: false }
} as const;
export type ZipKind = keyof typeof ZIPS;
export const isZip = (kind: WeldKind): kind is ZipKind => kind in ZIPS;
export const taperOf = (kind: ZipKind) => ZIPS[kind].taper;

/** Where along its seam a weld starts, px, or null to start where its kind always does. */
export type Origin = number | null;

/** Where a zip weld's fronts leave from, which ways they run, and the longest run, px. */
function zipFrom(kind: ZipKind, length: number, origin: Origin) {
  if (origin === null) {
    const { down } = ZIPS[kind];
    return { o: down ? 0 : length, up: !down, down, span: length };
  }
  const o = Math.max(0, Math.min(length, origin));
  return { o, up: true, down: true, span: Math.max(o, length - o) };
}

/**
 * How far a zip weld's fronts have run from where they left, `t` ms into the weld, px; negative
 * before they reach the seam. Fronts always run at one speed, so a weld started midway ends sooner.
 */
function reachAt(kind: ZipKind, t: number, length: number, origin: Origin) {
  const { from, to, taper } = ZIPS[kind];
  const { span } = zipFrom(kind, length, origin);
  const duration = ((to - from) * (span + taper)) / (length + taper);
  return (span + taper) * clamp((t - from) / duration) - taper;
}

/**
 * How far into a zip weld (ms) its fronts have run `reach` px from where they left: the inverse
 * of `reachAt`, for a seam being pulled shut by hand (see tether.tsx).
 */
export function timeAtReach(kind: ZipKind, reach: number, length: number) {
  const { from, to, taper } = ZIPS[kind];
  return from + ((to - from) * (reach + taper)) / (length + taper);
}

/** The stretch of seam a zip weld has shut `t` ms in, `[start, end]` px, grown `lead` past each front. */
export function shutAt(kind: ZipKind, t: number, length: number, origin: Origin, lead = 0) {
  const { o, up, down } = zipFrom(kind, length, origin);
  const reach = Math.max(0, reachAt(kind, t, length, origin) + lead);
  return [up ? Math.max(0, o - reach) : o, down ? Math.min(length, o + reach) : o];
}

/** When a zip weld's front reaches `along`, in ms from the start of the weld. */
function frontTime(kind: ZipKind, along: number, length: number, origin: Origin) {
  const { from, to, taper } = ZIPS[kind];
  const distance = Math.abs(along - zipFrom(kind, length, origin).o) + taper;
  return from + (distance / (length + taper)) * (to - from);
}

/** Linear interpolation through `[t, value]` stops. */
function through(stops: [number, number][], t: number) {
  if (t <= stops[0][0]) return stops[0][1];
  for (let i = 1; i < stops.length; i++) {
    const [t1, v1] = stops[i];
    if (t > t1) continue;
    const [t0, v0] = stops[i - 1];
    return v0 + ((v1 - v0) * (t - t0)) / (t1 - t0);
  }
  return stops[stops.length - 1][1];
}

/** One step closer at each of `times`, each step taking `ramp` ms. */
const stepped = (times: number[], t: number, ramp = 40) =>
  1 - times.reduce((sum, at) => sum + clamp((t - at) / ramp), 0) / times.length;

export const SPOT_TIMES = Array.from({ length: 7 }, (_, k) => 120 + k * 120);

/** How open the seam is at `along`, `t` ms into the weld: 1 is torn, 0 is shut (snap overshoots). */
export function gapAt(
  kind: WeldKind,
  t: number,
  along: number,
  length: number,
  origin: Origin = null
) {
  if (t <= 0) return 1;
  if (isZip(kind)) {
    const ahead =
      Math.abs(along - zipFrom(kind, length, origin).o) - reachAt(kind, t, length, origin);
    return smooth(clamp(ahead / ZIPS[kind].taper));
  }
  if (kind === 'spot') return stepped(SPOT_TIMES, t);
  if (kind === 'arc') {
    // Dragged in by the arcs, with a jitter, then slammed shut (520-560ms, accelerating).
    if (t > 520) return 0.38 * (1 - clamp((t - 520) / 40) ** 2);
    return through(
      [
        [0, 1],
        [140, 0.84],
        [224, 0.93],
        [336, 0.62],
        [420, 0.7],
        [520, 0.38]
      ],
      t
    );
  }
  // Snap: held while the charge builds, pulled in faster and faster, overshoots and settles.
  if (t < 280) return 1;
  if (t < 520) return 1 - clamp((t - 280) / 240) ** 2;
  return through(
    [
      [520, 0],
      [580, -0.3],
      [660, 0.12],
      [740, 0]
    ],
    t
  );
}

/** A torn seam pulled by its threads narrows to this share of its gap and no further. */
export const PINCHED = 0.12;

/**
 * How open a torn seam is at `along` while its threads are pulled as far as a weld from `at`
 * would be `t` ms in: the weld's own profile, but never narrower than PINCHED. Only the weld
 * that follows shuts it.
 */
export function pinchedAt(kind: WeldKind, t: number, along: number, length: number, at: number) {
  const open = gapAt(kind, t, along, length, at);
  return isZip(kind) ? Math.max(PINCHED, open) : open;
}

/** Frames every 25ms across `duration`, for the Web Animations API (linear between frames). */
export function track(duration: number, frame: (t: number) => Keyframe): Keyframe[] {
  const count = Math.max(2, Math.ceil(duration / 25));
  return Array.from({ length: count + 1 }, (_, i) => {
    const t = (i / count) * duration;
    return { ...frame(t), offset: i / count };
  });
}

type Range = [number, number];
const pick = ([a, b]: Range, r: number) => a + (b - a) * r;

type BurstProps = {
  seed: number;
  x: number;
  y: number;
  count: number;
  /** When the burst starts, in ms from the start of the weld. */
  delay: number;
  /** Launch angles in degrees; 0 is right, -90 straight up, 90 straight down. */
  spread?: Range;
  speed?: Range;
  /** How far below its peak each particle falls. */
  fall?: Range;
  life?: Range;
  /** Sparks are short streaks that cool from white to orange; drips are molten. */
  look?: 'spark' | 'drip';
};

/**
 * A burst of sparks. Each one flies out on its own angle (an ease-out in x), rises and then falls
 * under gravity (an ease-out to its peak, then an ease-in), cools and fades as it goes.
 */
function Burst({
  seed,
  x,
  y,
  count,
  delay,
  spread = [-165, -15],
  speed = [30, 70],
  fall = [40, 90],
  life = [520, 820],
  look = 'spark'
}: BurstProps) {
  return (
    <g transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}>
      {Array.from({ length: count }, (_, i) => {
        const r = (k: number) => noise(seed, i * 11 + k);
        const angle = (pick(spread, r(1)) * Math.PI) / 180;
        const velocity = pick(speed, r(2));
        const dx = Math.cos(angle) * velocity;
        const up = Math.min(0, Math.sin(angle) * velocity * 0.7);
        const down = Math.max(up, Math.sin(angle) * velocity) + pick(fall, r(3));
        const tail = 4 + r(6) * 4;
        const style = {
          '--dx': `${dx.toFixed(1)}px`,
          '--up': `${up.toFixed(1)}px`,
          '--down': `${down.toFixed(1)}px`,
          '--t': `${Math.round(pick(life, r(4)))}ms`,
          '--d': `${Math.round(delay + r(5) * 70)}ms`
        } as CSSProperties;
        return (
          <g key={i} className={styles.particleX} style={style}>
            <g className={styles.particleY}>
              <line
                className={look === 'drip' ? styles.drip : styles.spark}
                x2={(-Math.cos(angle) * tail).toFixed(2)}
                y2={(-Math.sin(angle) * tail).toFixed(2)}
              />
            </g>
          </g>
        );
      })}
    </g>
  );
}

type WeldProps = {
  kind: WeldKind;
  tear: Point[];
  seed: number;
  /** The seam's length, px. */
  length: number;
  origin: Origin;
};

/**
 * The weld drawn over one seam, in seam space. It mounts when the weld starts, so its CSS
 * animations start with it. Memoized, so the sparks aren't rebuilt each time another seam moves.
 */
export const Weld = memo(function Weld({ kind, tear, seed, length, origin }: WeldProps) {
  const points = pointsOf(tear);
  const on = (f: number): Point => [xAt(tear, f * length), f * length];
  const spaced = (count: number) => Array.from({ length: count }, (_, i) => (i + 0.5) / count);
  // How soon each part of a weld that spreads from a clicked point fires: 0 there, 1 at the far end.
  const far = origin === null ? 1 : Math.max(origin, length - origin) || 1;
  const outward = (y: number) => (origin === null ? 0 : Math.abs(y - origin) / far);

  if (kind === 'torch' || kind === 'molten') {
    // Torch: a white-hot bead runs down the seam throwing sparks; behind it the seam is shut and
    // glows, then cools. Molten: metal fills the seam from the bottom up behind a white-hot front,
    // dripping as it rises. Clicked at a point, either one runs out both ways from there. The glow
    // is the whole seam, uncovered in bands that ride each front.
    const down = kind === 'torch';
    const { up: rises, down: falls } = zipFrom(kind, length, origin);
    const dirs = [...(rises ? [-1 as const] : []), ...(falls ? [1 as const] : [])];
    const band = { kind, length, origin };
    return (
      <>
        <Band {...band} reach="trail">
          <polyline points={points} className={styles.glow} />
          <polyline points={points} className={styles.core} />
        </Band>
        {dirs.map((dir) => (
          <Band key={`halo${dir}`} {...band} dir={dir} reach={56}>
            <polyline points={points} className={styles.haloLine} />
          </Band>
        ))}
        {dirs.map((dir) => (
          <Band key={`head${dir}`} {...band} dir={dir} reach={down ? 10 : 8}>
            <polyline points={points} className={styles.headLine} />
          </Band>
        ))}
        <Plane>
          {spaced(down ? 9 : 6).map((f, i) => {
            const [x, y] = on(f);
            const delay = frontTime(kind, y, length, origin);
            return down ? (
              <Burst key={i} seed={seed * 31 + i} x={x} y={y} count={5} delay={delay} />
            ) : (
              <g key={i}>
                <Burst
                  seed={seed * 47 + i}
                  x={x}
                  y={y}
                  count={2}
                  delay={delay}
                  spread={[84, 96]}
                  speed={[2, 6]}
                  fall={[18, 40]}
                  life={[600, 900]}
                  look="drip"
                />
                <Burst
                  seed={seed * 53 + i}
                  x={x}
                  y={y}
                  count={3}
                  delay={delay}
                  spread={[-150, -30]}
                  speed={[14, 30]}
                  fall={[14, 30]}
                  life={[380, 560]}
                />
              </g>
            );
          })}
        </Plane>
      </>
    );
  }

  if (kind === 'spot') {
    // Seven spot welds fire down the seam, or out from a clicked point starting right on it; each
    // pulls the pieces a step closer and leaves a mark that cools from white to iron.
    const spots = origin === null ? spaced(7).map((f) => f * length) : spotsFrom(origin, length);
    return (
      <Plane>
        {spots.map((y, i) => {
          const x = xAt(tear, y);
          const delay = SPOT_TIMES[i];
          return (
            <g key={i}>
              <g
                transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}
                style={{ '--d': `${delay}ms` } as CSSProperties}
              >
                <circle r="2.6" className={styles.spotMark} />
                <circle r="9" className={styles.spotRing} />
                <circle r="6" className={styles.spotFlash} />
              </g>
              <Burst
                seed={seed * 37 + i}
                x={x}
                y={y}
                count={6}
                delay={delay}
                spread={[-180, 0]}
                speed={[24, 56]}
                fall={[30, 60]}
                life={[420, 640]}
              />
            </g>
          );
        })}
      </Plane>
    );
  }

  if (kind === 'arc') {
    // Electric arcs flicker across the gap while they drag the pieces together; they slam shut in
    // a blue-white flash and a spray of sparks.
    const bolts = [0.1, 0.22, 0.34, 0.46, 0.58, 0.7, 0.82, 0.92].map((f, i) => {
      const [cx, cy] = on(f + (noise(seed, 600 + i) - 0.5) * 0.05);
      const zag: Point[] = Array.from({ length: 9 }, (_, k) => [
        cx - 18 + (36 * k) / 8,
        cy + (k === 0 || k === 8 ? 0 : (noise(seed * 41 + i, k) - 0.5) * 14)
      ]);
      return { points: pointsOf(zag), delay: origin === null ? (i * 53) % 140 : 140 * outward(cy) };
    });
    return (
      <Plane>
        <polyline points={points} className={styles.arcFlashWide} />
        <polyline points={points} className={styles.arcFlash} />
        {bolts.map((bolt, i) => (
          <polyline
            key={i}
            points={bolt.points}
            className={styles.arcBolt}
            style={{ '--d': `${bolt.delay}ms` } as CSSProperties}
          />
        ))}
        {spaced(8).map((f, i) => {
          const [x, y] = on(f);
          return (
            <Burst
              key={i}
              seed={seed * 43 + i}
              x={x}
              y={y}
              count={5}
              delay={560 + 50 * outward(y)}
              spread={[-180, 0]}
              speed={[36, 80]}
            />
          );
        })}
      </Plane>
    );
  }

  // Snap: a charge builds along the seam as the pieces are pulled in (out from a clicked point,
  // when there is one); they meet in a flash and a ripple runs out across the paper on both sides.
  const charge = <polyline points={points} className={styles.charge} />;
  return (
    <>
      {origin !== null && (
        <Spread origin={origin} length={length}>
          {charge}
        </Spread>
      )}
      <Plane>
        {origin === null && charge}
        <polyline
          points={points}
          className={styles.ripple}
          style={{ '--dir': '-1' } as CSSProperties}
        />
        <polyline
          points={points}
          className={styles.ripple}
          style={{ '--dir': '1' } as CSSProperties}
        />
        <polyline points={points} className={styles.snapLine} />
      </Plane>
    </>
  );
});

/**
 * Spot welds out from a clicked point: the first right on it, then one a step either side, and so
 * on outward, keeping to the seam.
 */
function spotsFrom(origin: number, length: number) {
  const step = length / 7;
  const spots = [origin];
  for (let k = 1; spots.length < 7; k++) {
    for (const y of [origin + k * step, origin - k * step])
      if (y > step / 3 && y < length - step / 3 && spots.length < 7) spots.push(y);
    if (k > 14) break;
  }
  return spots;
}

/** A drawing uncovered out from `origin`, both ways along the seam, over a snap weld's charge-up. */
function Spread({
  origin,
  length,
  children
}: {
  origin: number;
  length: number;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const far = Math.max(origin, length - origin);
    const frames = track(WELD_MS, (t) => {
      const reach = far * smooth(clamp(t / 500));
      const top = Math.max(0, origin - reach);
      const bottom = Math.max(0, length - origin - reach);
      return { clipPath: `inset(${top.toFixed(1)}px 0 ${bottom.toFixed(1)}px 0)` };
    });
    const animation = ref.current!.animate(frames, { duration: WELD_MS, fill: 'both' });
    return () => animation.cancel();
  }, [origin, length]);
  return <Plane ref={ref}>{children}</Plane>;
}

/**
 * Part of a zip weld's glow, uncovered only where the seam has shut: `trail` is everything behind
 * the fronts, a number is a band of that many px just behind the front running `dir` (1 down the
 * seam, -1 up it).
 */
function Band({
  kind,
  length,
  origin,
  reach,
  dir = 1,
  children
}: {
  kind: ZipKind;
  length: number;
  origin: Origin;
  reach: number | 'trail';
  dir?: 1 | -1;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const soft = 8; // how far the glow runs on past the front before it's gone

  useEffect(() => {
    // The trail is clipped to the shut stretch; a band rides its front under a mask that fades
    // it out behind.
    const { o } = zipFrom(kind, length, origin);
    const frames = track(WELD_MS, (t) => {
      if (reach !== 'trail') {
        const run = reachAt(kind, t, length, origin);
        // From a clicked point both heads start on it, brightening as it pinches shut, then part.
        const raw = o + dir * (origin === null ? run : Math.max(0, run));
        const at = dir > 0 ? raw - reach : raw - soft;
        const shown = dir > 0 ? raw < length + reach : raw > -reach;
        const fade = origin === null ? 1 : clamp(1 + run / ZIPS[kind].taper);
        return { maskPosition: `0 ${at.toFixed(1)}px`, opacity: shown ? fade : 0 };
      }
      const [start, end] = shutAt(kind, t, length, origin);
      return { clipPath: `inset(${start.toFixed(1)}px 0 ${(length - end).toFixed(1)}px 0)` };
    });
    const animation = ref.current!.animate(frames, { duration: WELD_MS, fill: 'both' });
    return () => animation.cancel();
  }, [kind, length, origin, reach, dir]);

  const mask =
    reach === 'trail'
      ? undefined
      : ({
          '--mask': `linear-gradient(${dir > 0 ? 180 : 0}deg, transparent, #000 70%, #000 ${
            (100 * reach) / (reach + soft)
          }%, transparent)`,
          '--mask-size': `100% ${reach + soft}px`
        } as CSSProperties);

  return (
    <Plane ref={ref} className={reach === 'trail' ? styles.trail : styles.masked} style={mask}>
      {children}
    </Plane>
  );
}

/**
 * A drawing in seam space: an 800px plane centred on the seam's centre line and as long as the
 * seam, so a clip on it is in px along the seam. Its svg's origin is the top of the centre line.
 */
export function Plane({
  ref,
  className,
  style,
  children
}: {
  ref?: Ref<HTMLDivElement>;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      ref={ref}
      className={`${styles.plane} ${styles.weld} ${className ?? ''}`}
      style={style}
      aria-hidden
    >
      <svg className={styles.drawing}>{children}</svg>
    </div>
  );
}
