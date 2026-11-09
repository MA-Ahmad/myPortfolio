import { memo, useEffect, useRef, useSyncExternalStore } from 'react';
import { BIN, GAP, type Sheet } from './sheet';
import { startArc } from './sound';
import { type Point, xAt } from './tear';
import { STYLE_LOOK, styleOf, welderStore } from './welder-config';
import styles from './torn.module.css';

/** How far either side of the tear the pointer counts as on the seam, px; pressed, more. */
const NEAR = GAP + 12;
const HOLD_NEAR = NEAR * 3;
/** The canvas reaches this far either side of the seam, and above and below it. */
const HALF = 150;
const ABOVE = 120;
const BELOW = 80;
/** A seam counts as welded once this share of it is. */
const DONE = 0.985;
/** The rod's tip melts this far either side of it as it passes, px. */
const MELT = 4;
/** The bead runs through the seam smoothed over this far either side, px: a bead, not the tear. */
const SMOOTH = 5;
const SPATTER = 160;
const GRAVITY = 0.0011;

type Spark = { x: number; y: number; vx: number; vy: number; born: number; life: number };
type Puff = { x: number; y: number; born: number; drift: number };
type RGB = [number, number, number];

/** White-hot, yellow, orange, cherry, dull red: the glow of cooling metal by temperature (0–1). */
const RAMP: [number, RGB][] = [
  [1, [255, 252, 228]],
  [0.8, [255, 212, 116]],
  [0.58, [255, 148, 50]],
  [0.36, [208, 70, 24]],
  [0.16, [118, 38, 24]]
];

/** The metal's colour at temperature `t` (0–1), cooling to `metal`. */
function heatColour(t: number, metal: RGB): RGB {
  const stops: [number, RGB][] = [...RAMP, [0, metal]];
  for (let i = 1; i < stops.length; i++) {
    const [at, c] = stops[i];
    if (t >= at) {
      const [from, p] = stops[i - 1];
      const k = (t - at) / (from - at);
      return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k];
    }
  }
  return metal;
}

const rgba = (c: number[], a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${Math.max(0, Math.min(1, a)).toFixed(3)})`;
const scale = (c: RGB, k: number): RGB => [c[0] * k, c[1] * k, c[2] * k];

/**
 * Welds a torn seam by hand. Over the seam the cursor becomes a short rod; pressed, it strikes an
 * arc on the seam and every bit of seam the tip passes over is welded at once, however fast it
 * moves, into one continuous bead that cools from white-hot to the metal of the chosen process
 * (welder.json: stick, MIG, TIG, laser or braze), with its arc light, spatter and smoke. Once the
 * whole seam is welded it shuts (`onDone`) and the section past it opens.
 *
 * The bead is kept on the sheet, so it stays drawn while the seam is shut; `live` is off then, and
 * this only draws it. Fine pointers only, and not under reduced motion.
 */
export const Welder = memo(
  HandWelder,
  (a, b) =>
    // onDone is read through a ref, so a new one alone needs no render.
    a.index === b.index && a.tear === b.tear && a.length === b.length && a.live === b.live
);

function HandWelder({
  sheet,
  index,
  tear,
  length,
  live,
  onDone
}: {
  sheet: Sheet;
  index: number;
  tear: Point[];
  length: number;
  /** Whether the seam is torn and can be welded; otherwise the bead is only drawn. */
  live: boolean;
  /** The whole seam is welded; `along` is where the rod last was. */
  onDone: (along: number) => void;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const config = useSyncExternalStore(
    welderStore.subscribe,
    welderStore.get,
    welderStore.getServer
  );
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const look = STYLE_LOOK[styleOf(config)];
    const canvas = ref.current!;
    const sheetEl = canvas.closest<HTMLElement>('[data-skin]')!;
    const ctx = canvas.getContext('2d')!;
    const dpr = window.devicePixelRatio || 1;
    const width = HALF * 2;
    const height = length + ABOVE + BELOW;
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const bins = Math.ceil(length / BIN);
    const bead = sheet.bead(index, live);
    let welded = 0;
    if (bead) for (let i = 0; i < bins; i++) if (bead[i]) welded++;

    // The bead's centre line: the tear smoothed, so the bead runs straight over its zigzag.
    const centre = new Float32Array(bins);
    for (let i = 0; i < bins; i++) {
      const y = i * BIN + BIN / 2;
      let sum = 0;
      let n = 0;
      for (let d = -SMOOTH; d <= SMOOTH; d += 1) {
        sum += xAt(tear, Math.max(0, Math.min(length, y + d)));
        n++;
      }
      centre[i] = sum / n;
    }

    const sparks: Spark[] = [];
    const puffs: Puff[] = [];
    let target: number | null = null;
    let pressed = false;
    let suppressClick = false;
    let finished = false;
    let tip = 0;
    // Where the tip was when it last welded, so a fast stroke welds everything it swept over.
    let swept: number | null = null;
    let tipHeat = 0;
    let frame = 0;
    let last = 0;
    let lastPuff = 0;
    let lastPop = 0;
    let arc: ReturnType<typeof startArc> | null = null;

    const cx = (x: number) => x + HALF;
    const cy = (y: number) => y + ABOVE;
    const binAt = (y: number) => Math.max(0, Math.min(bins - 1, Math.floor(y / BIN)));

    const mark = () => {
      if (target !== null) sheetEl.dataset.seam = String(index);
      else if (sheetEl.dataset.seam === String(index)) delete sheetEl.dataset.seam;
    };

    const locate = (event: PointerEvent) => {
      if (!live || finished || (!pressed && !sheetEl.contains(event.target as Node))) {
        if (!pressed) target = null;
        return mark();
      }
      const origin = canvas.parentElement!.getBoundingClientRect();
      const offset = event.clientX - origin.left;
      const at = Math.max(0, Math.min(length, event.clientY - origin.top));
      const near = pressed ? HOLD_NEAR : NEAR;
      target = Math.abs(offset - xAt(tear, at)) < near ? at : null;
      mark();
    };

    const ensure = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    /** Welds every bin between `from` and `to` along the seam, now, a little later the further on. */
    const weld = (from: number, to: number, now: number) => {
      if (!bead) return;
      const lo = binAt(Math.min(from, to) - MELT);
      const hi = binAt(Math.max(from, to) + MELT);
      for (let i = lo; i <= hi; i++) {
        if (bead[i]) continue;
        bead[i] = now;
        welded++;
      }
    };

    const onMove = (event: PointerEvent) => {
      locate(event);
      // Weld on every move, not just every frame, so a quick stroke leaves no gaps.
      if (pressed && target !== null && !finished) {
        weld(swept ?? target, target, performance.now());
        swept = target;
        tip = target;
      }
      ensure();
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || target === null || !live || finished) return;
      // Caught before the section underneath sees it, so the press welds instead of opening it.
      event.preventDefault();
      event.stopPropagation();
      pressed = true;
      suppressClick = true;
      tip = target;
      swept = target;
      weld(target, target, performance.now());
      ensure();
    };
    const onUp = () => {
      pressed = false;
      swept = null;
    };
    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onLeave = () => {
      pressed = false;
      swept = null;
      target = null;
      mark();
    };

    const finish = (now: number) => {
      finished = true;
      pressed = false;
      // Any stragglers are filled in, so the bead has no holes.
      for (let i = 0; i < bins; i++) if (!bead![i]) bead![i] = now;
      welded = bins;
      target = null;
      mark();
      sheet.weldedByHand(index);
      done.current(tip);
    };

    const tick = (now: number) => {
      const dt = Math.min(48, now - (last || now));
      last = now;
      const arcing = pressed && target !== null && live && !finished;
      if (target !== null && !pressed) tip = target;

      if (arcing && !arc) arc = startArc();
      if (!arcing && arc) {
        arc.stop();
        arc = null;
      }
      arc?.flutter();

      if (arcing) {
        tipHeat = 1;
        const x = centre[binAt(tip)];
        const throws = Math.round((1 + Math.random() * 3) * config.spatter);
        for (let k = 0; k < throws; k++) {
          if (sparks.length >= SPATTER) sparks.shift();
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
          const speed = 0.08 + Math.random() ** 2 * 0.5;
          sparks.push({
            x,
            y: tip,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            born: now,
            life: 200 + Math.random() * 480
          });
        }
        if (config.spatter > 0 && now - lastPop > 80 && Math.random() < 0.3 * config.spatter) {
          lastPop = now;
          arc?.pop();
        }
        if (config.smoke > 0 && now - lastPuff > 90 / config.smoke) {
          lastPuff = now;
          puffs.push({ x, y: tip, born: now, drift: (Math.random() - 0.5) * 0.02 });
          if (puffs.length > 30) puffs.shift();
        }
        if (welded >= bins * DONE) finish(now);
      } else {
        tipHeat *= Math.exp(-dt / 400);
      }

      ctx.clearRect(0, 0, width, height);
      const hot = drawBead(now);
      const lively = drawSmokeAndSpatter(now);
      if (arcing) drawArc();
      if (target !== null && live && !finished) drawPen(arcing);

      const moving = arcing || target !== null || lively || hot || tipHeat > 0.02;
      frame = moving ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };

    /** Runs of welded bins, as [first, last] pairs. */
    const runs = () => {
      const out: [number, number][] = [];
      let start = -1;
      for (let i = 0; i <= bins; i++) {
        const on = i < bins && bead![i] > 0;
        if (on && start < 0) start = i;
        if (!on && start >= 0) {
          out.push([start, i - 1]);
          start = -1;
        }
      }
      return out;
    };

    const path = (from: number, to: number, shift = 0) => {
      ctx.beginPath();
      for (let i = from; i <= to; i++) {
        const x = cx(centre[i] + shift);
        const y = cy(i * BIN + BIN / 2);
        if (i === from) ctx.moveTo(x, from === to ? y - BIN / 2 : y);
        else ctx.lineTo(x, y);
      }
      if (from === to) ctx.lineTo(cx(centre[to] + shift), cy(to * BIN + BIN));
    };

    /**
     * The bead: one continuous stroke along each welded run, a dark edge, its body and a sheen
     * along its crown so it reads as rounded, then fine ripples across it, then the glow of
     * whatever is still hot. Returns whether any of it still glows.
     */
    const drawBead = (now: number) => {
      if (!bead || !welded) return false;
      const w = config.width;
      const metal = look.metal;
      ctx.globalCompositeOperation = 'source-over';
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const segments = runs();

      // The heat-affected zone either side: a straw-and-blue stain on TIG, a faint shadow otherwise.
      for (const [a, b] of segments) {
        if (look.tint) {
          path(a, b);
          ctx.strokeStyle = 'rgba(70, 96, 170, 0.16)';
          ctx.lineWidth = w + 9;
          ctx.stroke();
          path(a, b);
          ctx.strokeStyle = 'rgba(190, 150, 80, 0.22)';
          ctx.lineWidth = w + 5;
          ctx.stroke();
        } else {
          path(a, b);
          ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)';
          ctx.lineWidth = w + 2.4;
          ctx.stroke();
        }
        path(a, b);
        ctx.strokeStyle = rgba(scale(metal, 0.62), 1);
        ctx.lineWidth = w;
        ctx.stroke();
        path(a, b);
        ctx.strokeStyle = rgba(metal, 1);
        ctx.lineWidth = w * 0.66;
        ctx.stroke();
        path(a, b, -w * 0.12);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
        ctx.lineWidth = Math.max(0.8, w * 0.22);
        ctx.stroke();
      }

      // Ripples: faint curved lines across the bead at an even spacing, curving the way it was run.
      if (config.ripple > 0 && config.rippleDepth > 0) {
        const every = Math.max(1, Math.round(config.ripple / BIN));
        ctx.lineCap = 'round';
        ctx.lineWidth = 0.7;
        for (let i = 0; i < bins; i += every) {
          if (!bead[i]) continue;
          const x = cx(centre[i]);
          const y = cy(i * BIN + BIN / 2);
          const half = w * 0.42;
          ctx.strokeStyle = rgba([0, 0, 0], 0.32 * config.rippleDepth);
          ctx.beginPath();
          ctx.moveTo(x - half, y + 0.4);
          ctx.quadraticCurveTo(x, y - 1.6, x + half, y + 0.4);
          ctx.stroke();
          ctx.strokeStyle = rgba([255, 255, 255], 0.12 * config.rippleDepth);
          ctx.beginPath();
          ctx.moveTo(x - half, y - 0.4);
          ctx.quadraticCurveTo(x, y - 2.4, x + half, y - 0.4);
          ctx.stroke();
        }
      }

      // What is still hot glows, cooling along the bead in the order it was laid.
      let glowing = false;
      ctx.lineCap = 'butt';
      for (let i = 0; i < bins - 1; i++) {
        const at = bead[i];
        if (!at || !bead[i + 1]) continue;
        const t = Math.exp(-(now - at) / Math.max(100, config.cool));
        if (t < 0.03) continue;
        glowing = true;
        const colour = heatColour(t, metal);
        ctx.strokeStyle = rgba(colour, Math.min(1, t * 1.6));
        ctx.lineWidth = config.width * 0.9;
        ctx.beginPath();
        ctx.moveTo(cx(centre[i]), cy(i * BIN + BIN / 2));
        ctx.lineTo(cx(centre[i + 1]), cy((i + 1) * BIN + BIN / 2 + 0.3));
        ctx.stroke();
      }
      if (glowing) {
        ctx.globalCompositeOperation = 'lighter';
        ctx.lineCap = 'round';
        for (let i = 0; i < bins - 1; i += 2) {
          const at = bead[i];
          if (!at) continue;
          const t = Math.exp(-(now - at) / Math.max(100, config.cool));
          if (t < 0.2) continue;
          ctx.strokeStyle = rgba([255, 130, 50], t * 0.1);
          ctx.lineWidth = config.width * 3;
          ctx.beginPath();
          ctx.moveTo(cx(centre[i]), cy(i * BIN));
          ctx.lineTo(cx(centre[i]), cy(i * BIN + BIN * 2));
          ctx.stroke();
        }
      }
      ctx.globalCompositeOperation = 'source-over';
      return glowing;
    };

    /** Smoke rising off the pool, then the spatter as cooling streaks. Returns whether any is left. */
    const drawSmokeAndSpatter = (now: number) => {
      let left = false;
      ctx.globalCompositeOperation = 'source-over';
      for (const puff of puffs) {
        const age = (now - puff.born) / 1400;
        if (age >= 1) continue;
        left = true;
        const t = now - puff.born;
        ctx.fillStyle = `rgba(150,150,160,${(0.06 * (1 - age)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(
          cx(puff.x + puff.drift * t + Math.sin(t / 260) * 3),
          cy(puff.y - 0.035 * t),
          4 + age * 20,
          0,
          Math.PI * 2
        );
        ctx.fill();
      }
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      for (const spark of sparks) {
        const t = now - spark.born;
        const age = t / spark.life;
        if (age >= 1) continue;
        left = true;
        const x = spark.x + spark.vx * t;
        const y = spark.y + spark.vy * t + 0.5 * GRAVITY * t * t;
        const vy = spark.vy + GRAVITY * t;
        ctx.strokeStyle = rgba(heatColour(1 - age * 0.85, [120, 40, 26]), 1 - age);
        ctx.lineWidth = 1.2 * (1 - age) + 0.35;
        ctx.beginPath();
        ctx.moveTo(cx(x), cy(y));
        ctx.lineTo(cx(x - spark.vx * 14), cy(y - vy * 14));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      return left;
    };

    /** The arc: its light thrown over the sheet, a halo, the pool and a white core. */
    const drawArc = () => {
      const x = cx(centre[binAt(tip)]);
      const y = cy(tip);
      const f = (0.72 + Math.random() * 0.28) * config.glow;
      const [r, g, b] = look.arc;
      ctx.globalCompositeOperation = 'lighter';
      if (config.glow > 0) {
        const light = ctx.createRadialGradient(x, y, 0, x, y, HALF);
        light.addColorStop(0, rgba([r, g, b], 0.24 * f));
        light.addColorStop(0.35, rgba([r * 0.7, g * 0.75, b], 0.07 * f));
        light.addColorStop(1, rgba([r, g, b], 0));
        ctx.fillStyle = light;
        ctx.fillRect(x - HALF, y - HALF, HALF * 2, HALF * 2);
        const halo = ctx.createRadialGradient(x, y, 0, x, y, 20 * f);
        halo.addColorStop(0, rgba([r, g, b], 0.7));
        halo.addColorStop(1, rgba([r, g, b], 0));
        ctx.fillStyle = halo;
        ctx.beginPath();
        ctx.arc(x, y, 20 * f, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.fillStyle = 'rgba(255, 180, 80, 0.85)';
      ctx.beginPath();
      ctx.ellipse(x, y + 1, config.width * 0.6, 3.2, 0, 0, Math.PI * 2);
      ctx.fill();
      const core = ctx.createRadialGradient(x, y, 0, x, y, 5.5);
      core.addColorStop(0, 'rgba(255, 255, 255, 1)');
      core.addColorStop(0.5, 'rgba(240, 244, 255, 0.75)');
      core.addColorStop(1, 'rgba(220, 230, 255, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    };

    /** The cursor: a short rod leaning up to the right, its tip on the seam, glowing after use. */
    const drawPen = (arcing: boolean) => {
      const tx = cx(centre[binAt(tip)]);
      const ty = cy(tip) - (arcing ? 2.5 : 4);
      const ux = 0.5;
      const uy = -0.866;
      const len = Math.max(8, config.pen);
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.55)';
      ctx.lineWidth = 3.6;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + ux * len, ty + uy * len);
      ctx.stroke();
      ctx.strokeStyle = '#c9ccd3';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(tx + ux * 2, ty + uy * 2);
      ctx.lineTo(tx + ux * len, ty + uy * len);
      ctx.stroke();
      ctx.strokeStyle =
        tipHeat > 0.02 ? rgba(heatColour(0.3 + 0.65 * tipHeat, [90, 94, 104]), 1) : '#8a8f99';
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(tx + ux * 3, ty + uy * 3);
      ctx.stroke();
      if (!arcing && !welded && config.hint > 0) {
        ctx.font = '500 11px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText('Hold to weld', tx + 10, ty + 18);
      }
    };

    if (bead && welded) ensure();
    window.addEventListener('pointermove', onMove, { passive: true });
    window.addEventListener('pointerup', onUp);
    window.addEventListener('blur', onLeave);
    document.documentElement.addEventListener('pointerleave', onLeave);
    sheetEl.addEventListener('pointerdown', onDown, true);
    sheetEl.addEventListener('click', onClick, true);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('blur', onLeave);
      document.documentElement.removeEventListener('pointerleave', onLeave);
      sheetEl.removeEventListener('pointerdown', onDown, true);
      sheetEl.removeEventListener('click', onClick, true);
      cancelAnimationFrame(frame);
      arc?.stop();
      target = null;
      mark();
    };
  }, [sheet, index, tear, length, live, config]);

  return <canvas ref={ref} className={styles.welder} aria-hidden />;
}
