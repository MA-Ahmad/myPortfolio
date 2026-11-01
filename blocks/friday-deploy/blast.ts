import { type BlastConfig, seeded } from './config';
import { type Piece, type Pt, type Rand, fracture, roundedRect } from './fracture';
import { KEY_PAD, KEY_RADIUS, KEY_WIDTH } from './keycap';

/**
 * The explosion, drawn on two canvases: one behind the page (shockwave, fireball, smoke, the far
 * shards) and one in front of it (the near shards, sparks, embers and the flash).
 *
 * Everything is a closed-form function of the config and `t`, the seconds since the blast, rather
 * than a simulation stepped frame by frame. That makes any moment drawable on its own, so rolling
 * back is the same drawing with `t` running backwards (the shards fly home and the fire folds in),
 * and the tuning page can scrub to any frame.
 */

type Shard = {
  piece: Piece;
  /** Where the centroid sat on the key, from the key's centre. */
  home: Pt;
  /** Where the piece had parted to at the bang, from the key's centre, and how far it had turned. */
  from: Pt;
  turned: number;
  vx: number;
  vy: number;
  spin: number;
  /** Turn rate about the shard's own axis; its cosine squashes the shard as it tumbles. */
  flip: number;
  /** Depth: below 0 it falls behind the page, above 0 it flies at the viewer and grows. */
  z: number;
  fadeAt: number;
};

/** Where a deploy stands at `u`, its time from 0 to 1. See `deployStage`. */
export type Stage = {
  /** The progress bar, 0 to 1. It never reaches the end. */
  progress: number;
  /** How much of the crack pattern has spread, 0 to 1. */
  cracks: number;
  /** The pieces pulling apart, just before the bang. */
  split: number;
};

type Spark = { vx: number; vy: number; life: number; width: number; hue: number };
type Ember = { vx: number; vy: number; life: number; size: number; spin: number; phase: number };
type Puff = { angle: number; reach: number; radius: number; rise: number; life: number };

export type Blast = {
  drawBack(ctx: CanvasRenderingContext2D, t: number): void;
  drawFront(ctx: CanvasRenderingContext2D, t: number, flash: number): void;
  /** How brightly the blast lights its surroundings, 0 to 1. */
  heat(t: number): number;
  /** Re-centres the blast on the key, after the layout moves it. */
  moveTo(x: number, y: number): void;
  /**
   * The key before the bang, drawn whole until it cracks, then in pieces: each crack runs across
   * its piece and opens, the pieces pulling apart, and at the end the whole key strains open.
   * It sits exactly where the page's key does, casting the same shadows, so either can take over.
   */
  drawBreaking(ctx: CanvasRenderingContext2D, stage: Stage): void;
  /** How many cracks have started at `cracks` (from `Stage`), to tick a sound for each new one. */
  cracksStarted(cracks: number): number;
};

const TAU = Math.PI * 2;
const SPIN_DRAG = 2.6;
const SPARK_DRAG = 5;
const EMBER_DRAG = 2.4;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);
const easeOutQuart = (v: number) => 1 - Math.pow(1 - clamp01(v), 4);
/** Distance covered by a unit velocity under linear drag `k` after `t` seconds. */
const coast = (k: number, t: number) => (1 - Math.exp(-k * t)) / k;

/**
 * A soft disc of one colour fading to transparent, painted once. Puffs of fire and smoke are
 * stamps of it, which is far cheaper than filling a new radial gradient for each one every frame.
 */
function softDisc(r: number, g: number, b: number) {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const fill = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  fill.addColorStop(0, `rgba(${r},${g},${b},1)`);
  fill.addColorStop(1, `rgba(${r},${g},${b},0)`);
  ctx.fillStyle = fill;
  ctx.fillRect(0, 0, size, size);
  return canvas;
}

const ramp = (v: number, from: number, to: number) => clamp01((v - from) / (to - from));

/**
 * The deploy before the bang, at `u` from 0 to 1. The progress bar runs quickly, slows and stalls in
 * the nineties. Meanwhile the key cracks: slowly at first, then faster. At the end the pieces pull
 * apart along the cracks, and it goes.
 */
export function deployStage(u: number): Stage {
  const progress =
    u < 0.3
      ? 0.55 * easeOutCubic(u / 0.3)
      : u < 0.75
        ? 0.55 + 0.35 * ((u - 0.3) / 0.45)
        : 0.9 + 0.09 * easeOutCubic((u - 0.75) / 0.25);
  return {
    progress,
    cracks: Math.pow(ramp(u, 0.3, 0.9), 1.5),
    split: Math.pow(ramp(u, 0.9, 1), 2)
  };
}

export function createBlast(opts: {
  x: number;
  y: number;
  width: number;
  height: number;
  texture: HTMLCanvasElement;
  config: BlastConfig;
}): Blast {
  const { width, height, texture, config } = opts;
  const random = seeded(config.seed);
  const rand: Rand = (min, max) => min + random() * (max - min);
  const sign = () => (random() < 0.5 ? -1 : 1);
  let cx = opts.x;
  let cy = opts.y;
  const s = width / KEY_WIDTH;

  // The cracks have their own random numbers, so their look never changes the tuned blast.
  const crackRandom = seeded(config.seed + 7919);
  const crackRand: Rand = (min, max) => min + crackRandom() * (max - min);
  const broken = fracture(
    roundedRect(width, height, KEY_RADIUS * s),
    config.shardCount,
    width * 0.6,
    s,
    { gap: config.crackGap, twist: config.crackTwist, jag: config.crackJag },
    rand,
    crackRand
  );
  // The shards take off from wherever the pieces had parted to at the bang.
  const parted = broken.transforms(1, 1).out;

  const shards: Shard[] = broken.pieces.map((piece) => {
    const home = piece.home;
    const m = parted[piece.node];
    const distance = Math.hypot(home.x, home.y);
    const base = distance > 6 * s ? Math.atan2(home.y, home.x) : rand(0, TAU);
    const angle = base + rand(-0.35, 0.35);
    const z = rand(-0.45, 0.85) * config.shardDepth;
    const speed = rand(430, 900) * config.shardSpeed * s * (1 + 0.2 * z);
    return {
      piece,
      home,
      from: m.transformPoint(home),
      turned: Math.atan2(m.b, m.a),
      vx: Math.cos(angle) * speed,
      // A little lift: debris goes up before it drifts down.
      vy: Math.sin(angle) * speed - 70 * s,
      spin: rand(4, 11) * config.shardSpin * sign(),
      flip: rand(3, 9) * config.shardSpin * sign(),
      z,
      fadeAt: rand(config.shardHold, config.shardHold + 0.6)
    };
  });
  // Far shards first, so the nearer ones overlap them.
  shards.sort((a, b) => a.z - b.z);

  const sparks: Spark[] = Array.from({ length: config.sparks }, () => {
    const angle = rand(0, TAU);
    const speed = rand(600, 1500) * s;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(0.25, 0.7),
      width: rand(1, 2.2) * s,
      hue: rand(28, 48)
    };
  });

  const embers: Ember[] = Array.from({ length: config.embers }, () => {
    const angle = rand(0, TAU);
    const speed = rand(120, 520) * s;
    return {
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: rand(1, 2.5),
      size: rand(1.5, 3.6) * s,
      spin: rand(-8, 8),
      phase: rand(0, TAU)
    };
  });

  const flames: Puff[] = Array.from({ length: 9 }, (_, i) => ({
    angle: (i / 9) * TAU + rand(-0.3, 0.3),
    reach: rand(28, 70) * config.fireSize * s,
    radius: rand(40, 72) * config.fireSize * s,
    rise: 0,
    life: rand(0.82, 1.32) * config.fireSeconds
  }));

  const smoke: Puff[] = Array.from({ length: 8 }, () => ({
    angle: rand(0, TAU),
    reach: rand(20, 95) * s,
    radius: rand(55, 95) * s,
    rise: rand(18, 40) * s,
    life: rand(1.2, 1.9)
  }));

  const fireDisc = softDisc(255, 160, 40);
  const smokeDisc = softDisc(96, 30, 14);
  // Shards are drawn in their own local space, so one gradient serves every shard; only its
  // strength changes, through globalAlpha.
  const sheen = texture.getContext('2d')!.createLinearGradient(-30 * s, -30 * s, 30 * s, 30 * s);
  sheen.addColorStop(0, 'rgba(255,255,255,0)');
  sheen.addColorStop(0.5, 'rgba(255,255,255,1)');
  sheen.addColorStop(1, 'rgba(255,255,255,0)');

  const texW = width + KEY_PAD * 2;
  const texH = height + KEY_PAD * 2;
  const gravity = 60 * s;

  function drawShard(ctx: CanvasRenderingContext2D, shard: Shard, t: number) {
    const alpha = 1 - clamp01((t - shard.fadeAt) / 0.7);
    if (alpha <= 0) return;
    const travel = coast(config.shardDrag, t) + 0.05 * t;
    const turn = coast(SPIN_DRAG, t) + 0.08 * t;
    const phase = shard.flip * turn;
    const grow = 1 + shard.z * (1 - Math.exp(-4 * t));
    ctx.save();
    ctx.globalAlpha *= alpha;
    ctx.translate(
      cx + shard.from.x + shard.vx * travel,
      cy + shard.from.y + shard.vy * travel + 0.5 * gravity * t * t
    );
    ctx.rotate(shard.turned + shard.spin * turn);
    ctx.scale(Math.cos(phase) * grow, grow);
    paintShard(ctx, shard, Math.exp(-t / 0.28), Math.pow(Math.abs(Math.sin(phase + 0.5)), 8), grow);
    ctx.restore();
  }

  const paintKey = (ctx: CanvasRenderingContext2D) =>
    ctx.drawImage(texture, -width / 2 - KEY_PAD, -height / 2 - KEY_PAD, texW, texH);

  /** One piece of the key, in its own space: its part of the key, the light on the glass, its rim. */
  function paintShard(
    ctx: CanvasRenderingContext2D,
    shard: Shard,
    heat: number,
    glint: number,
    grow: number
  ) {
    const opacity = ctx.globalAlpha;
    ctx.save();
    ctx.translate(-shard.home.x, -shard.home.y);
    broken.clip(ctx, shard.piece);
    ctx.globalAlpha = opacity * 0.9;
    paintKey(ctx);
    ctx.translate(shard.home.x, shard.home.y);
    // Glass catches the light as it turns face-on.
    ctx.globalAlpha = opacity * (0.04 + config.glint * glint);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = sheen;
    ctx.fillRect(-60 * s, -60 * s, 120 * s, 120 * s);
    ctx.globalAlpha = opacity;
    if (heat > 0.02) {
      ctx.fillStyle = `rgba(255,170,90,${0.85 * heat})`;
      ctx.fillRect(-60 * s, -60 * s, 120 * s, 120 * s);
    }

    // The rim, along every edge, drawn twice as wide and clipped to the piece so only its inner
    // half shows: white-hot at first, cooling to the gold of the reference.
    const r = Math.round(222 + 33 * heat);
    const g = Math.round(166 + 84 * heat);
    const b = Math.round(96 + 150 * heat);
    ctx.globalAlpha = opacity;
    ctx.translate(-shard.home.x, -shard.home.y);
    ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = `rgba(${r},${g},${b},0.16)`;
    ctx.lineWidth = (8 * s) / grow;
    broken.strokeEdges(ctx, shard.piece);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = `rgba(${r},${g},${b},0.95)`;
    ctx.lineWidth = (2.8 * s) / grow;
    broken.strokeEdges(ctx, shard.piece);
    ctx.restore();
  }

  /** Position under drag plus a little gravity, so the streaks curve as they slow. */
  function sparkAt(spark: Spark, t: number): Pt {
    const d = coast(SPARK_DRAG, t);
    return { x: cx + spark.vx * d, y: cy + spark.vy * d + ((500 * s) / SPARK_DRAG) * (t - d) };
  }

  function drawPuff(
    ctx: CanvasRenderingContext2D,
    disc: HTMLCanvasElement,
    puff: Puff,
    t: number,
    alpha: number,
    grow: number
  ) {
    const k = easeOutCubic(t / 0.5);
    const px = cx + Math.cos(puff.angle) * puff.reach * k;
    const py = cy + Math.sin(puff.angle) * puff.reach * k - puff.rise * t;
    const radius = puff.radius * (1 + grow * t);
    const opacity = ctx.globalAlpha;
    ctx.globalAlpha = opacity * alpha;
    ctx.drawImage(disc, px - radius, py - radius, radius * 2, radius * 2);
    ctx.globalAlpha = opacity;
  }

  return {
    drawBack(ctx, t) {
      // Smoke under everything: a dull red haze that lingers and rises after the fire is gone.
      for (const puff of smoke) {
        const a = config.smoke * clamp01((t - 0.08) / 0.25) * (1 - clamp01(t / puff.life));
        if (a <= 0) continue;
        drawPuff(ctx, smokeDisc, puff, t, a, 0.6);
      }

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';

      // Shockwave: a scorched disc edged by a bright ring that races out and thins.
      const wave = clamp01(t / config.ringSeconds);
      const ring = (95 + 200 * easeOutQuart(wave)) * config.ringReach * s;
      const fade = Math.pow(1 - wave, 1.6);
      if (fade > 0.01) {
        const disc = ctx.createRadialGradient(cx, cy, 0, cx, cy, ring);
        disc.addColorStop(0, 'rgba(150,48,16,0)');
        disc.addColorStop(0.55, `rgba(130,38,12,${0.32 * fade})`);
        disc.addColorStop(0.96, `rgba(110,28,10,${0.55 * fade})`);
        disc.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = disc;
        ctx.beginPath();
        ctx.arc(cx, cy, ring, 0, TAU);
        ctx.fill();

        const strokes: [number, number, string][] = [
          [1.07, 30 * (1 - 0.5 * wave), `rgba(255,224,186,${0.14 * fade})`],
          [1.03, 12, `rgba(255,228,196,${0.22 * fade})`],
          [1, 2.6, `rgba(255,240,224,${0.9 * fade})`],
          [0.9, 1.5, `rgba(255,150,128,${0.5 * fade})`]
        ];
        for (const [scale, lineWidth, color] of strokes) {
          ctx.strokeStyle = color;
          ctx.lineWidth = lineWidth * s;
          ctx.beginPath();
          ctx.arc(cx, cy, ring * scale, 0, TAU);
          ctx.stroke();
        }
      }

      // Fireball: white at the core, then yellow, orange and a deep red rim, cooling as it swells.
      const fire = Math.exp(-t / config.fireSeconds);
      if (fire > 0.01) {
        const radius = (70 + 95 * easeOutCubic(t / 0.3)) * config.fireSize * s;
        const ball = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        ball.addColorStop(0, `rgba(255,250,232,${fire})`);
        ball.addColorStop(0.25, `rgba(255,214,122,${fire})`);
        ball.addColorStop(0.55, `rgba(255,124,30,${0.85 * fire})`);
        ball.addColorStop(0.8, `rgba(170,46,12,${0.5 * fire})`);
        ball.addColorStop(1, 'rgba(120,20,0,0)');
        ctx.fillStyle = ball;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.fill();

        // Lobes, so the ball never reads as a perfect circle.
        for (const puff of flames) {
          const a = Math.exp(-t / puff.life) * 0.55;
          drawPuff(ctx, fireDisc, puff, t, a, 0.9);
        }
      }
      ctx.restore();

      for (const shard of shards) if (shard.z < 0) drawShard(ctx, shard, t);
    },

    drawFront(ctx, t, flash) {
      for (const shard of shards) if (shard.z >= 0) drawShard(ctx, shard, t);

      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';

      for (const spark of sparks) {
        const left = 1 - t / spark.life;
        if (left <= 0) continue;
        // A streak from where the spark was a moment ago to where it is now.
        const head = sparkAt(spark, t);
        const tail = sparkAt(spark, Math.max(0, t - 0.035));
        ctx.strokeStyle = `hsla(${spark.hue},100%,${62 + 30 * left}%,${left})`;
        ctx.lineWidth = spark.width * (0.4 + 0.6 * left);
        ctx.beginPath();
        ctx.moveTo(tail.x, tail.y);
        ctx.lineTo(head.x, head.y);
        ctx.stroke();
      }

      // Embers: small square flecks that flicker, drift and rise on the heat.
      for (const ember of embers) {
        const left = 1 - t / ember.life;
        if (left <= 0) continue;
        const d = coast(EMBER_DRAG, t);
        const x = cx + ember.vx * d;
        const y = cy + ember.vy * d - 34 * s * t;
        const flicker = 0.6 + 0.4 * Math.sin(t * 22 + ember.phase);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ember.spin * t + ember.phase);
        ctx.fillStyle = `rgba(255,${Math.round(110 + 90 * left)},${Math.round(40 + 60 * left)},${Math.min(1, left * 1.6) * flicker})`;
        const size = ember.size * (0.5 + 0.5 * left);
        ctx.fillRect(-size / 2, -size / 2, size, size);
        ctx.restore();
      }

      // The bloom at the centre, over the page, so it lights whatever stands near the key.
      const core = Math.exp(-t / 0.12);
      if (core > 0.01) {
        const radius = 130 * s;
        const bloom = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
        bloom.addColorStop(0, `rgba(255,252,240,${core})`);
        bloom.addColorStop(0.4, `rgba(255,226,170,${0.6 * core})`);
        bloom.addColorStop(1, 'rgba(255,170,80,0)');
        ctx.fillStyle = bloom;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, 0, TAU);
        ctx.fill();
      }
      ctx.restore();

      const white = config.flash * flash * Math.exp(-t / 0.05);
      if (white > 0.01) {
        ctx.fillStyle = `rgba(255,246,232,${white})`;
        ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      }
    },

    heat(t) {
      return Math.exp(-t / 0.3);
    },

    moveTo(x, y) {
      cx = x;
      cy = y;
    },

    drawBreaking(ctx, stage) {
      ctx.save();
      ctx.translate(cx, cy);
      // The key's shadow and base, as CSS casts them: `0 12px 28px` and `0 4px 0`. A canvas shadow
      // is measured in the bitmap's pixels, so it is scaled by the canvas's own pixel ratio.
      const dpr = ctx.getTransform().a;
      ctx.fillStyle = '#08080a';
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.6)';
      ctx.shadowBlur = 28 * dpr;
      ctx.shadowOffsetY = 12 * dpr;
      ctx.fill(broken.outline);
      ctx.restore();
      ctx.save();
      ctx.translate(0, 4);
      ctx.fill(broken.outline);
      ctx.restore();
      if (stage.cracks > 0) broken.draw(ctx, stage.cracks, stage.split, paintKey);
      else paintKey(ctx);
      ctx.restore();
    },

    cracksStarted(spread) {
      return broken.started(spread);
    }
  };
}
