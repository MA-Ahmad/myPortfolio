'use client';

// A client component: in the App Router (v0, `npx shadcn add`) it runs in the browser. The Pages Router ignores this.
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { RotateCcwIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { type Blast, createBlast, drawCharge } from './blast';
import { BLAST_CONFIG, blastSeconds } from './config';
import { KEY_WIDTH, paintKeycap } from './keycap';
import { Duck, type DuckMood } from './duck';
import { type Sound, createSound } from './sound';
import styles from './friday-deploy.module.css';

type Phase = 'idle' | 'charging' | 'blown' | 'rewinding';

const { chargeMs: CHARGE_MS, rewindMs: REWIND_MS } = BLAST_CONFIG;
const BLAST_SECONDS = blastSeconds(BLAST_CONFIG);
// A rollback rewinds from no later than this into the blast, so the shards are still in the air.
const REWIND_FROM = 1.3;
const FLINCH_MS = 650;
const COMMIT = 'a1f3c9e';

const STATUS: Record<Phase, { text: string; tone: 'ok' | 'busy' | 'down' }> = {
  idle: { text: 'production · healthy', tone: 'ok' },
  charging: { text: `deploying ${COMMIT}…`, tone: 'busy' },
  blown: { text: 'production · 502 bad gateway', tone: 'down' },
  rewinding: { text: `git revert ${COMMIT}`, tone: 'busy' }
};

const easeInOutCubic = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

/**
 * A deploy key that blows up when you press it, after the "Hex" landing page's option key: it
 * charges, draws in a breath, then bursts into a fireball and a shockwave, and breaks into glass
 * shards that still carry its label. A rubber duck watches. Roll back and the whole blast plays
 * in reverse until the key is whole again.
 */
export default function FridayDeploy() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const keyRef = useRef<HTMLButtonElement>(null);
  const rollbackRef = useRef<HTMLButtonElement>(null);
  const duckRef = useRef<HTMLDivElement>(null);
  // Where the duck's eyes are, measured on the first pointer move after each layout change, so
  // moving the pointer never forces a layout.
  const eyesRef = useRef<{ x: number; y: number } | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const controls = useRef({ deploy: () => {}, rollback: () => {} });

  const [phase, setPhase] = useState<Phase>('idle');
  const [flinch, setFlinch] = useState(false);
  const [restored, setRestored] = useState(false);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const root = rootRef.current;
    const scene = sceneRef.current;
    const back = backRef.current;
    const front = frontRef.current;
    const key = keyRef.current;
    const backCtx = back?.getContext('2d');
    const frontCtx = front?.getContext('2d');
    if (!root || !scene || !back || !front || !key || !backCtx || !frontCtx) return;

    const sound = createSound();
    soundRef.current = sound;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

    // Everything the frame loop reads lives here, out of React state, so frames never re-render.
    const state = {
      phase: 'idle' as Phase,
      start: 0,
      raf: 0,
      t: 0,
      from: 0,
      jumped: false,
      blast: null as Blast | null,
      center: { x: 0, y: 0 },
      scale: 1,
      deploys: 0,
      shake: '',
      heat: ''
    };
    let dpr = 1;
    let flinchTimer = 0;

    const keyCenter = () => {
      const k = key.getBoundingClientRect();
      const c = back.getBoundingClientRect();
      return { x: k.left + k.width / 2 - c.left, y: k.top + k.height / 2 - c.top };
    };

    const resize = () => {
      const rect = root.getBoundingClientRect();
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      for (const canvas of [back, front]) {
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
      }
      eyesRef.current = null;
      if (state.blast) {
        const center = keyCenter();
        state.blast.moveTo(center.x, center.y);
      }
    };
    const observer = new ResizeObserver(resize);
    observer.observe(root);

    const clear = () => {
      for (const ctx of [backCtx, frontCtx]) {
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, back.width, back.height);
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      }
    };

    const enter = (next: Phase) => {
      state.phase = next;
      setPhase(next);
    };

    // Style writes only when the value changes: an unchanged write still costs a style recalc.
    const setShake = (value: string) => {
      if (value === state.shake) return;
      state.shake = value;
      scene.style.translate = value;
    };
    const setHeat = (value: string) => {
      if (value === state.heat) return;
      state.heat = value;
      root.style.setProperty('--heat', value);
    };

    const paint = (t: number, flash: number, appear: number) => {
      const blast = state.blast!;
      backCtx.globalAlpha = appear;
      frontCtx.globalAlpha = appear;
      blast.drawBack(backCtx, t);
      blast.drawFront(frontCtx, t, flash);
      backCtx.globalAlpha = 1;
      frontCtx.globalAlpha = 1;
      const shake = blast.shake(t);
      setShake(shake.x || shake.y ? `${shake.x.toFixed(1)}px ${shake.y.toFixed(1)}px` : '');
      setHeat((blast.heat(t) * appear).toFixed(2));
    };

    const settle = () => {
      setShake('');
      setHeat('0.00');
    };

    const boom = (now: number) => {
      key.style.transform = '';
      key.style.scale = '';
      key.style.filter = '';
      const center = keyCenter();
      const width = key.offsetWidth;
      const height = key.offsetHeight;
      // The first blast is exactly the tuned one; each one after breaks the key differently.
      const config = { ...BLAST_CONFIG, seed: BLAST_CONFIG.seed + state.deploys++ };
      state.blast = createBlast({
        ...center,
        width,
        height,
        texture: paintKeycap(width, height, dpr),
        config
      });
      // Hidden here, not on React's next commit, so the key and its shards never share a frame.
      key.style.opacity = '0';
      state.start = now;
      state.t = 0;
      enter('blown');
      sound.boom();
      setFlinch(true);
      window.clearTimeout(flinchTimer);
      flinchTimer = window.setTimeout(() => setFlinch(false), FLINCH_MS);
    };

    const step = (now: number) => {
      state.raf = 0;
      clear();

      if (state.phase === 'charging') {
        const p = Math.min(1, (now - state.start) / CHARGE_MS);
        drawCharge(backCtx, state.center.x, state.center.y, state.scale, p);
        // A tremble that builds, then the key draws in and darkens just before it goes. It goes on
        // `transform`, which nothing transitions and which adds to the pressed-in `translate`.
        const amp = 0.3 + 2.4 * p * p;
        const jitter = () => ((Math.random() * 2 - 1) * amp).toFixed(2);
        key.style.transform = `translate(${jitter()}px, ${jitter()}px) rotate(${(Number(jitter()) * 0.35).toFixed(2)}deg)`;
        const inhale = Math.max(0, (p - 0.8) / 0.2);
        key.style.scale = String(1 - 0.07 * inhale);
        key.style.filter = `brightness(${1 - 0.5 * inhale})`;
        if (p >= 1) {
          boom(now);
          paint(0, 1, 1);
        }
      } else if (state.phase === 'blown') {
        const t = (now - state.start) / 1000;
        state.t = t;
        if (t >= BLAST_SECONDS) {
          settle();
          return;
        }
        paint(t, 1, 1);
      } else if (state.phase === 'rewinding') {
        const q = Math.min(1, (now - state.start) / REWIND_MS);
        if (q >= 1) {
          // The key comes back in the same frame the shards go, so there is never an empty frame.
          settle();
          key.style.opacity = '';
          state.blast = null;
          enter('idle');
          setRestored(true);
          return;
        }
        // If the blast had already faded, bring it back in over the first moments of the rewind.
        const appear = state.jumped ? Math.min(1, q / 0.15) : 1;
        paint(state.from * (1 - easeInOutCubic(q)), 0.45, appear);
      } else {
        return;
      }
      state.raf = requestAnimationFrame(step);
    };

    const run = () => {
      if (!state.raf) state.raf = requestAnimationFrame(step);
    };

    controls.current.deploy = () => {
      if (state.phase !== 'idle') return;
      setRestored(false);
      if (reducedMotion.matches) {
        key.style.opacity = '0';
        enter('blown');
        return;
      }
      state.center = keyCenter();
      state.scale = key.offsetWidth / KEY_WIDTH;
      state.start = performance.now();
      enter('charging');
      sound.charge(CHARGE_MS / 1000);
      run();
    };

    controls.current.rollback = () => {
      if (state.phase !== 'blown') return;
      if (!state.blast) {
        key.style.opacity = '';
        enter('idle');
        return;
      }
      state.from = Math.min(state.t, REWIND_FROM);
      state.jumped = state.t > REWIND_FROM;
      state.start = performance.now();
      enter('rewinding');
      sound.rewind(REWIND_MS / 1000);
      run();
    };

    return () => {
      cancelAnimationFrame(state.raf);
      window.clearTimeout(flinchTimer);
      observer.disconnect();
      sound.dispose();
      soundRef.current = null;
    };
  }, []);

  // Enter deploys, then Enter (or R) rolls back, unless focus is somewhere else on the page. On the
  // block's own buttons Enter is left to the button. Never in the inert thumbnail on the blocks list.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const root = rootRef.current;
      if (
        !root ||
        root.closest('[inert]') ||
        event.metaKey ||
        event.ctrlKey ||
        event.altKey ||
        event.repeat
      )
        return;
      const active = document.activeElement;
      const inside = !!active && root.contains(active);
      if (active && active !== document.body && !inside) return;
      if (event.key === 'Enter' && !(active instanceof HTMLButtonElement)) {
        event.preventDefault();
        controls.current.deploy();
        controls.current.rollback();
      } else if (event.key === 'r' || event.key === 'R') {
        controls.current.rollback();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  // Keep focus on whichever button is on screen, carried across the phases where neither is.
  const focusInside = useRef(false);
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const inside = root.contains(document.activeElement) || focusInside.current;
    focusInside.current = false;
    if (!inside) return;
    if (phase === 'blown') rollbackRef.current?.focus({ preventScroll: true });
    else if (phase === 'idle') keyRef.current?.focus({ preventScroll: true });
    else focusInside.current = true;
  }, [phase]);

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const duck = duckRef.current;
    if (!duck) return;
    if (!eyesRef.current) {
      const rect = duck.getBoundingClientRect();
      eyesRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35 };
    }
    const dx = event.clientX - eyesRef.current.x;
    const dy = event.clientY - eyesRef.current.y;
    const distance = Math.hypot(dx, dy) || 1;
    // Full deflection from 220px away; closer than that the eyes turn only part of the way.
    const reach = Math.min(1, distance / 220) / distance;
    duck.style.setProperty('--lx', (dx * reach).toFixed(2));
    duck.style.setProperty('--ly', (dy * reach).toFixed(2));
  };

  const onPointerLeave = () => {
    duckRef.current?.style.setProperty('--lx', '0');
    duckRef.current?.style.setProperty('--ly', '0');
  };

  const toggleSound = () => {
    if (muted) soundRef.current?.enable();
    else soundRef.current?.disable();
    setMuted(!muted);
  };

  const mood: DuckMood =
    phase === 'idle' ? 'idle' : phase === 'blown' ? (flinch ? 'flinch' : 'stunned') : 'alarmed';
  const status = STATUS[phase];

  return (
    <div
      ref={rootRef}
      className={styles.root}
      data-phase={phase}
      onPointerMove={onPointerMove}
      onPointerLeave={onPointerLeave}
    >
      <div ref={sceneRef} className={styles.scene}>
        <canvas ref={backRef} className={styles.canvas} aria-hidden />

        <div className={styles.status} data-tone={status.tone} role="status">
          <span className={styles.dot} />
          {status.text}
        </div>

        <button
          type="button"
          className={styles.soundToggle}
          onClick={toggleSound}
          aria-pressed={!muted}
          aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
        >
          {muted ? <VolumeXIcon size={16} /> : <Volume2Icon size={16} />}
        </button>

        <div className={styles.stage}>
          <Duck ref={duckRef} mood={mood} sooty={phase === 'blown'} />

          <button
            ref={keyRef}
            type="button"
            className={styles.key}
            data-restored={restored || undefined}
            onClick={() => controls.current.deploy()}
            aria-disabled={phase !== 'idle'}
            aria-label="Deploy to production"
          >
            <span className={styles.face}>
              <span className={styles.glyph} aria-hidden>
                ⏎
              </span>
              <span className={styles.label}>deploy</span>
            </span>
          </button>

          <div className={styles.action}>
            {phase === 'blown' ? (
              <button
                ref={rollbackRef}
                type="button"
                className={styles.rollback}
                onClick={() => controls.current.rollback()}
              >
                <RotateCcwIcon size={14} strokeWidth={2.2} />
                Roll back
                <kbd>⏎</kbd>
              </button>
            ) : (
              <p className={styles.hint}>
                {phase === 'idle' ? (
                  <>
                    <span className={styles.desktopOnly}>
                      Click or press <kbd>⏎</kbd>
                    </span>
                    <span className={styles.touchOnly}>Tap</span> to deploy
                  </>
                ) : phase === 'charging' ? (
                  'Deploying…'
                ) : (
                  'Rolling back…'
                )}
              </p>
            )}
          </div>

          <h2 className={styles.title}>Never deploy on a Friday.</h2>
          <p className={styles.lede}>
            One key, straight to production. When it goes up in flames, explain it to the duck.
          </p>
        </div>

        <canvas ref={frontRef} className={styles.canvas} aria-hidden />
      </div>
    </div>
  );
}
