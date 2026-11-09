import { memo, useEffect, useRef } from 'react';
import { BIN, GAP, type Sheet } from './sheet';
import { startArc } from './sound';
import { type Point, xAt } from './tear';
import styles from './torn.module.css';

/** How far either side of the tear the pointer counts as on the seam, px; pressed, a little more. */
const NEAR = GAP + 12;
const HOLD_NEAR = NEAR * 2;
/** The canvas reaches this far either side of the seam, and above and below it, for the rod and light. */
const HALF = 150;
const ABOVE = 170;
const BELOW = 80;
/** The arc melts the seam this far either side of the rod's tip, px, a spot in this long. */
const MELT = 7;
const SPOT_MS = 110;
/** A seam counts as welded once this share of it is. */
const DONE = 0.985;
/** An electrode burns down over this much arc time, ms. */
const BURN_MS = 9000;
const SPATTER = 140;
const GRAVITY = 0.0011;

type Spark = { x: number; y: number; vx: number; vy: number; born: number; life: number };
type Puff = { x: number; y: number; born: number; drift: number };

/** White-hot, yellow, orange, cherry, dull red, then steel: the colour of cooling metal by temperature (0–1). */
const RAMP: [number, [number, number, number]][] = [
  [1, [255, 252, 228]],
  [0.82, [255, 214, 120]],
  [0.6, [255, 150, 52]],
  [0.4, [212, 72, 24]],
  [0.2, [120, 40, 26]],
  [0, [74, 78, 88]]
];
const STEEL: [number, number, number] = [74, 78, 88];

function heatColour(t: number): [number, number, number] {
  for (let i = 1; i < RAMP.length; i++) {
    const [at, c] = RAMP[i];
    if (t >= at) {
      const [from, p] = RAMP[i - 1];
      const k = (t - at) / (from - at);
      return [c[0] + (p[0] - c[0]) * k, c[1] + (p[1] - c[1]) * k, c[2] + (p[2] - c[2]) * k];
    }
  }
  return STEEL;
}

const rgba = (c: number[], a: number) =>
  `rgba(${Math.round(c[0])},${Math.round(c[1])},${Math.round(c[2])},${a.toFixed(3)})`;

/**
 * Welds a torn seam by hand, with a stick welder. Over the seam the cursor becomes an electrode in
 * its holder; pressed, it strikes an arc right on the seam (a violet-white core, its blue light
 * thrown over the sheet, spatter flying and falling, a little smoke) and melts the seam under the
 * tip into a bead, laid in overlapping ripples that cool from white-hot through orange and cherry to
 * steel. Drag along the seam while holding to run the bead; once the whole seam is welded it shuts
 * (`onDone`) and the section past it opens. The electrode burns down as it's used.
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
  const done = useRef(onDone);
  useEffect(() => {
    done.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
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
    const heat = new Float32Array(bins);
    let welded = 0;
    if (bead) for (let i = 0; i < bins; i++) if (bead[i]) welded++;
    const sparks: Spark[] = [];
    const puffs: Puff[] = [];
    // Where the pointer is along the seam, or null when it's off it.
    let target: number | null = null;
    let pressed = false;
    let suppressClick = false;
    let finished = false;
    let tip = 0;
    let tipHeat = 0;
    let burnt = 0;
    let frame = 0;
    let last = 0;
    let lastPuff = 0;
    let lastPop = 0;
    let arc: ReturnType<typeof startArc> | null = null;

    // Seam space to canvas space: x is across the seam from its centre line, y runs along it.
    const cx = (x: number) => x + HALF;
    const cy = (y: number) => y + ABOVE;

    const locate = (event: PointerEvent) => {
      if (!live || finished || !sheetEl.contains(event.target as Node)) {
        if (!pressed) target = null;
        return mark();
      }
      const origin = canvas.parentElement!.getBoundingClientRect();
      const offset = event.clientX - origin.left;
      const at = event.clientY - origin.top;
      const near = pressed ? HOLD_NEAR : NEAR;
      target = at > 0 && at < length && Math.abs(offset - xAt(tear, at)) < near ? at : null;
      mark();
    };

    // The sheet hides the cursor while the rod is drawn; each seam clears only its own mark.
    const mark = () => {
      if (target !== null) sheetEl.dataset.seam = String(index);
      else if (sheetEl.dataset.seam === String(index)) delete sheetEl.dataset.seam;
    };

    const ensure = () => {
      if (!frame) frame = requestAnimationFrame(tick);
    };

    const onMove = (event: PointerEvent) => {
      locate(event);
      ensure();
    };
    const onDown = (event: PointerEvent) => {
      if (event.button !== 0 || target === null || !live || finished) return;
      // Caught before the section underneath sees it, so the press welds instead of opening it.
      event.preventDefault();
      event.stopPropagation();
      pressed = true;
      suppressClick = true;
      ensure();
    };
    const onUp = () => {
      pressed = false;
    };
    const onClick = (event: MouseEvent) => {
      if (!suppressClick) return;
      suppressClick = false;
      event.preventDefault();
      event.stopPropagation();
    };
    const onLeave = () => {
      pressed = false;
      target = null;
      mark();
    };

    const finish = (now: number) => {
      finished = true;
      pressed = false;
      // Any stragglers the rod skipped are filled in, so the bead has no holes.
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
      if (target !== null) tip = arcing ? tip + (target - tip) * Math.min(1, dt / 30) : target;

      // The arc's sound follows it.
      if (arcing && !arc) arc = startArc();
      if (!arcing && arc) {
        arc.stop();
        arc = null;
      }
      arc?.flutter();

      if (arcing) {
        burnt += dt;
        tipHeat = 1;
        const lo = Math.max(0, Math.floor((tip - MELT) / BIN));
        const hi = Math.min(bins - 1, Math.ceil((tip + MELT) / BIN));
        for (let i = lo; i <= hi; i++) {
          const d = Math.abs(i * BIN + BIN / 2 - tip);
          if (d > MELT) continue;
          heat[i] += (dt / SPOT_MS) * Math.sqrt(1 - d / MELT);
          if (heat[i] >= 1 && !bead![i]) {
            bead![i] = now;
            welded++;
          }
        }
        // Spatter: globules thrown up and out of the pool, falling back under gravity.
        const throws = 1 + Math.floor(Math.random() * 4);
        for (let k = 0; k < throws; k++) {
          if (sparks.length >= SPATTER) sparks.shift();
          const angle = -Math.PI / 2 + (Math.random() - 0.5) * 2.6;
          const speed = 0.08 + Math.random() ** 2 * 0.55;
          sparks.push({
            x: xAt(tear, tip),
            y: tip,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            born: now,
            life: 220 + Math.random() * 520
          });
        }
        if (now - lastPop > 70 && Math.random() < 0.35) {
          lastPop = now;
          arc?.pop();
        }
        if (now - lastPuff > 70) {
          lastPuff = now;
          puffs.push({ x: xAt(tear, tip), y: tip, born: now, drift: (Math.random() - 0.5) * 0.02 });
          if (puffs.length > 30) puffs.shift();
        }
        if (welded >= bins * DONE) finish(now);
      } else {
        tipHeat *= Math.exp(-dt / 450);
      }

      ctx.clearRect(0, 0, width, height);
      const hot = drawBead(now);
      const lively = drawSmokeAndSpatter(now);
      if (arcing) drawArc(now);
      if (target !== null && live && !finished) drawRod(target === null ? tip : tip, arcing);

      const moving = arcing || target !== null || lively || hot || tipHeat > 0.02;
      frame = moving ? requestAnimationFrame(tick) : 0;
      if (!frame) last = 0;
    };

    /** The bead, ripple by ripple, each its own temperature. Returns whether any of it still glows. */
    const drawBead = (now: number) => {
      if (!bead || !welded) return false;
      let glowing = false;
      const rx = GAP + 2.6;
      ctx.globalCompositeOperation = 'source-over';
      // The heat-affected zone: a faint straw-and-blue stain either side of the bead.
      for (let i = 0; i < bins; i++) {
        if (!bead[i]) continue;
        const y = i * BIN + BIN / 2;
        ctx.fillStyle = 'rgba(168, 132, 86, 0.07)';
        ctx.beginPath();
        ctx.ellipse(cx(xAt(tear, y)), cy(y), rx + 3, 3.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      for (let i = 0; i < bins; i++) {
        const at = bead[i];
        if (!at) continue;
        const y = i * BIN + BIN / 2;
        const x = cx(xAt(tear, y));
        const t = Math.exp(-(now - at) / 900);
        if (t > 0.02) glowing = true;
        const colour = heatColour(t);
        ctx.fillStyle = rgba(colour, 1);
        ctx.beginPath();
        ctx.ellipse(x, cy(y), rx, 2.5, 0, 0, Math.PI * 2);
        ctx.fill();
        // Each ripple's leading edge catches the light; its trailing edge is in shade.
        ctx.lineWidth = 0.8;
        ctx.strokeStyle = `rgba(255,255,255,${(0.1 + 0.25 * t).toFixed(3)})`;
        ctx.beginPath();
        ctx.ellipse(x, cy(y), rx - 0.8, 1.8, 0, Math.PI * 1.1, Math.PI * 1.9);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(0,0,0,0.3)';
        ctx.beginPath();
        ctx.ellipse(x, cy(y), rx - 0.4, 2.1, 0, Math.PI * 0.15, Math.PI * 0.85);
        ctx.stroke();
      }
      // The glow off what is still hot.
      ctx.globalCompositeOperation = 'lighter';
      for (let i = 0; i < bins; i++) {
        const at = bead[i];
        if (!at) continue;
        const t = Math.exp(-(now - at) / 900);
        if (t < 0.15) continue;
        const y = i * BIN + BIN / 2;
        ctx.fillStyle = rgba([255, 120, 40], t * 0.12);
        ctx.beginPath();
        ctx.arc(cx(xAt(tear, y)), cy(y), 9, 0, Math.PI * 2);
        ctx.fill();
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
        const r = 4 + age * 22;
        ctx.fillStyle = `rgba(150,150,160,${(0.07 * (1 - age)).toFixed(3)})`;
        ctx.beginPath();
        ctx.arc(
          cx(puff.x + puff.drift * t + Math.sin(t / 260) * 3),
          cy(puff.y - 0.035 * t),
          r,
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
        // A streak back along its path, as the eye sees a glowing globule in flight.
        const vy = spark.vy + GRAVITY * t;
        const colour = heatColour(1 - age * 0.85);
        ctx.strokeStyle = rgba(colour, 1 - age);
        ctx.lineWidth = 1.3 * (1 - age) + 0.4;
        ctx.beginPath();
        ctx.moveTo(cx(x), cy(y));
        ctx.lineTo(cx(x - spark.vx * 16), cy(y - vy * 16));
        ctx.stroke();
      }
      ctx.globalCompositeOperation = 'source-over';
      return left;
    };

    /** The arc: its light thrown wide over the sheet, a violet halo, a white core and the pool. */
    const drawArc = (now: number) => {
      const x = cx(xAt(tear, tip));
      const y = cy(tip);
      const f = 0.72 + Math.random() * 0.28;
      ctx.globalCompositeOperation = 'lighter';
      const light = ctx.createRadialGradient(x, y, 0, x, y, HALF);
      light.addColorStop(0, `rgba(170, 196, 255, ${(0.26 * f).toFixed(3)})`);
      light.addColorStop(0.35, `rgba(120, 150, 255, ${(0.08 * f).toFixed(3)})`);
      light.addColorStop(1, 'rgba(120, 150, 255, 0)');
      ctx.fillStyle = light;
      ctx.fillRect(x - HALF, y - HALF, HALF * 2, HALF * 2);
      // The weld pool under the arc.
      ctx.fillStyle = 'rgba(255, 176, 70, 0.9)';
      ctx.beginPath();
      ctx.ellipse(x, y + 1.5, GAP + 3.2, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      const halo = ctx.createRadialGradient(x, y, 0, x, y, 26 * f);
      halo.addColorStop(0, `rgba(200, 190, 255, ${(0.75 * f).toFixed(3)})`);
      halo.addColorStop(1, 'rgba(120, 110, 255, 0)');
      ctx.fillStyle = halo;
      ctx.beginPath();
      ctx.arc(x, y, 26 * f, 0, Math.PI * 2);
      ctx.fill();
      // A few filaments of the arc, jumping between the rod and the pool.
      ctx.strokeStyle = 'rgba(225, 220, 255, 0.85)';
      ctx.lineWidth = 0.9;
      for (let k = 0; k < 3; k++) {
        ctx.beginPath();
        ctx.moveTo(x + (Math.random() - 0.5) * 2, y - 4);
        ctx.lineTo(x + (Math.random() - 0.5) * 7, y - 1.5);
        ctx.lineTo(x + (Math.random() - 0.5) * 9, y + 1.5);
        ctx.stroke();
      }
      const core = ctx.createRadialGradient(x, y, 0, x, y, 7 * f);
      core.addColorStop(0, 'rgba(255, 255, 255, 1)');
      core.addColorStop(0.5, 'rgba(235, 240, 255, 0.8)');
      core.addColorStop(1, 'rgba(200, 210, 255, 0)');
      ctx.fillStyle = core;
      ctx.beginPath();
      ctx.arc(x, y, 7 * f, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
      void now;
    };

    /** The electrode in its holder, tip on the seam, leaning back up to the right. */
    const drawRod = (along: number, arcing: boolean) => {
      const tx = cx(xAt(tear, along));
      const ty = cy(along) - (arcing ? 4 : 7);
      const ux = 0.5;
      const uy = -0.866;
      const rod = 66 - 38 * Math.min(1, burnt / BURN_MS);
      const at = (d: number): [number, number] => [tx + ux * d, ty + uy * d];
      ctx.lineCap = 'round';
      // The electrode: flux-coated, its bare end in the jaws.
      const [ex, ey] = at(rod);
      ctx.strokeStyle = '#2a2c31';
      ctx.lineWidth = 4.4;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = '#a69b86';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(...at(2.5));
      ctx.lineTo(ex, ey);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.moveTo(...at(3));
      ctx.lineTo(ex - 0.8, ey - 0.4);
      ctx.stroke();
      // Its tip, glowing after the arc.
      ctx.strokeStyle = tipHeat > 0.02 ? rgba(heatColour(0.35 + 0.6 * tipHeat), 1) : '#5d6068';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(tx, ty);
      ctx.lineTo(...at(2.5));
      ctx.stroke();
      // The holder: copper jaws, then the insulated handle with its band, then the lead.
      const [jx, jy] = at(rod + 14);
      ctx.strokeStyle = '#8a4f2a';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(ex, ey);
      ctx.lineTo(jx, jy);
      ctx.stroke();
      ctx.strokeStyle = 'rgba(255, 196, 150, 0.35)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(ex - 2.5, ey - 1.5);
      ctx.lineTo(jx - 2.5, jy - 1.5);
      ctx.stroke();
      const [hx, hy] = at(rod + 66);
      ctx.strokeStyle = '#17181c';
      ctx.lineWidth = 13;
      ctx.beginPath();
      ctx.moveTo(jx, jy);
      ctx.lineTo(hx, hy);
      ctx.stroke();
      ctx.strokeStyle = '#d5541c';
      ctx.lineWidth = 13;
      ctx.lineCap = 'butt';
      ctx.beginPath();
      ctx.moveTo(...at(rod + 18));
      ctx.lineTo(...at(rod + 24));
      ctx.stroke();
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'rgba(255,255,255,0.12)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(...(at(rod + 26).map((v, i) => v + (i ? -2.6 : -4.4)) as [number, number]));
      ctx.lineTo(hx - 4.4, hy - 2.6);
      ctx.stroke();
      ctx.strokeStyle = '#0d0e10';
      ctx.lineWidth = 6;
      ctx.beginPath();
      ctx.moveTo(hx, hy);
      ctx.bezierCurveTo(hx + 22, hy - 30, hx + 60, hy - 10, hx + 80, hy - 40);
      ctx.stroke();
      // While the seam is still open, say how it's done.
      if (!arcing) {
        ctx.font = '500 11px ui-monospace, monospace';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.fillText(welded ? 'Hold and drag along' : 'Hold to weld', tx + 12, ty + 22);
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
  }, [sheet, index, tear, length, live]);

  return <canvas ref={ref} className={styles.welder} aria-hidden />;
}
