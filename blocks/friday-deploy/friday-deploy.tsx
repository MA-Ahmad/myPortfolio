'use client';

// A client component: in the App Router (v0, `npx shadcn add`) it runs in the browser. The Pages Router ignores this.
import { type PointerEvent, useEffect, useRef, useState } from 'react';
import { RotateCcwIcon, Volume2Icon, VolumeXIcon } from 'lucide-react';
import { type Blast, createBlast, deployStage } from './blast';
import { BLAST_CONFIG, blastSeconds } from './config';
import { KEY_WIDTH, measureLabels, paintKeycap } from './keycap';
import { Server, type ServerMood } from './server';
import { type Sound, createSound } from './sound';
import styles from './friday-deploy.module.css';

type Phase = 'idle' | 'deploying' | 'blown' | 'rewinding';

const { deployMs: DEPLOY_MS, rewindMs: REWIND_MS } = BLAST_CONFIG;
const BLAST_SECONDS = blastSeconds(BLAST_CONFIG);
// A rollback rewinds from no later than this into the blast, so the shards are still in the air.
const REWIND_FROM = 1.3;
const FLINCH_MS = 650;
// After the shards fly home, the cracks close up again, the newest first.
const HEAL_MS = 640;
// The whine builds over the last part of the deploy, from when the cracks start to glow.
const WHINE_AT = 0.5;
const COMMIT = 'a1f3c9e';

const STATUS: Record<Phase, { text: string; tone: 'ok' | 'busy' | 'down' }> = {
  idle: { text: 'production · healthy', tone: 'ok' },
  deploying: { text: `deploying ${COMMIT}…`, tone: 'busy' },
  blown: { text: 'production · 502 bad gateway', tone: 'down' },
  rewinding: { text: `git revert ${COMMIT}`, tone: 'busy' }
};

const easeInOutCubic = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2);

/**
 * A deploy key that blows up when you press it, after the "Hex" landing page's option key. The
 * deploy runs, its progress stalls in the nineties, and the key cracks: a crack right across it,
 * then a few more. The pieces pull apart along the
 * cracks, and it bursts into a fireball and a shockwave, the pieces flying as glass shards that
 * still carry the label. A little server, production itself, watches. Roll back and the blast
 * plays in reverse until the pieces meet, then the cracks close up and the key is whole again.
 */
export default function FridayDeploy() {
  const rootRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<HTMLDivElement>(null);
  const backRef = useRef<HTMLCanvasElement>(null);
  const frontRef = useRef<HTMLCanvasElement>(null);
  const keyRef = useRef<HTMLButtonElement>(null);
  const rollbackRef = useRef<HTMLButtonElement>(null);
  const serverRef = useRef<HTMLDivElement>(null);
  // Where the server's eyes are, measured on the first pointer move after each layout change, so
  // moving the pointer never forces a layout.
  const eyesRef = useRef<{ x: number; y: number } | null>(null);
  const soundRef = useRef<Sound | null>(null);
  const progressRef = useRef<HTMLDivElement>(null);
  const percentRef = useRef<HTMLSpanElement>(null);
  const fillRef = useRef<HTMLSpanElement>(null);
  const controls = useRef({ deploy: () => {}, rollback: () => {} });

  const [phase, setPhase] = useState<Phase>('idle');
  const [flinch, setFlinch] = useState(false);
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
      heat: '',
      percent: -1,
      whining: false,
      cracks: 0
    };
    let dpr = 1;
    let flinchTimer = 0;

    // The key's box on the canvases, to the fraction of a pixel, at rest: less any press of a click
    // still easing out.
    const keyBox = () => {
      const box = key.getBoundingClientRect();
      const origin = scene.getBoundingClientRect();
      const pressed = getComputedStyle(key).translate;
      const [tx = 0, ty = 0] = pressed === 'none' ? [] : pressed.split(' ').map(parseFloat);
      return {
        x: box.left - origin.left - tx + box.width / 2,
        y: box.top - origin.top - ty + box.height / 2,
        width: box.width,
        height: box.height
      };
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
        const { x, y } = keyBox();
        state.center = { x, y };
        state.blast.moveTo(state.center.x, state.center.y);
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
      setHeat((blast.heat(t) * appear).toFixed(2));
    };

    // The progress bar is written straight to the DOM: React never renders a frame of it.
    const setProgress = (progress: number) => {
      const percent = Math.floor(progress * 100);
      if (percent === state.percent) return;
      state.percent = percent;
      if (fillRef.current) fillRef.current.style.scale = `${progress} 1`;
      if (percentRef.current) percentRef.current.textContent = `${percent}%`;
      progressRef.current?.setAttribute('aria-valuenow', String(percent));
    };

    const boom = (now: number) => {
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
      const blast = state.blast!;

      if (state.phase === 'deploying') {
        const u = Math.min(1, (now - state.start) / DEPLOY_MS);
        const stage = deployStage(u);
        setProgress(stage.progress);
        if (u >= WHINE_AT && !state.whining) {
          state.whining = true;
          sound.charge(((1 - WHINE_AT) * DEPLOY_MS) / 1000);
        }
        const started = blast.cracksStarted(stage.cracks);
        if (started > state.cracks) {
          state.cracks = started;
          sound.crack();
        }
        // From the first crack the key is drawn in pieces, so the page's key goes in the same frame.
        if (stage.cracks > 0) {
          key.style.opacity = '0';
          blast.drawBreaking(frontCtx, stage);
        }
        if (u >= 1) {
          boom(now);
          paint(0, 1, 1);
        }
      } else if (state.phase === 'blown') {
        const t = (now - state.start) / 1000;
        state.t = t;
        if (t >= BLAST_SECONDS) {
          setHeat('0.00');
          return;
        }
        paint(t, 1, 1);
      } else if (state.phase === 'rewinding') {
        const elapsed = now - state.start;
        if (elapsed < REWIND_MS) {
          // If the blast had already faded, bring it back in over the first moments of the rewind.
          const q = elapsed / REWIND_MS;
          const appear = state.jumped ? Math.min(1, q / 0.15) : 1;
          paint(state.from * (1 - easeInOutCubic(q)), 0.45, appear);
        } else {
          // The pieces close together and the cracks close up, the newest first. The key is drawn
          // exactly as the page's, which takes over in the same frame once it's whole.
          setHeat('0.00');
          const h = Math.min(1, (elapsed - REWIND_MS) / HEAL_MS);
          if (h >= 1) {
            key.style.opacity = '';
            state.blast = null;
            enter('idle');
            return;
          }
          blast.drawBreaking(frontCtx, {
            progress: 1,
            cracks: 1 - easeInOutCubic(Math.min(1, h / 0.85)),
            split: 1 - easeInOutCubic(Math.min(1, h / 0.4))
          });
        }
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
      if (reducedMotion.matches) {
        key.style.opacity = '0';
        enter('blown');
        return;
      }
      const { x, y, width, height } = keyBox();
      state.center = { x, y };
      state.scale = width / KEY_WIDTH;
      // The first blast is exactly the tuned one; each one after breaks the key differently. It is
      // made now, because the cracks are the lines it breaks along.
      const config = { ...BLAST_CONFIG, seed: BLAST_CONFIG.seed + state.deploys++ };
      state.blast = createBlast({
        ...state.center,
        width,
        height,
        texture: paintKeycap(width, height, dpr, measureLabels(key)),
        config
      });
      state.start = performance.now();
      state.percent = -1;
      state.whining = false;
      state.cracks = 0;
      enter('deploying');
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
    const server = serverRef.current;
    if (!server) return;
    if (!eyesRef.current) {
      const rect = server.getBoundingClientRect();
      eyesRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height * 0.35 };
    }
    const dx = event.clientX - eyesRef.current.x;
    const dy = event.clientY - eyesRef.current.y;
    const distance = Math.hypot(dx, dy) || 1;
    // Full deflection from 220px away; closer than that the eyes turn only part of the way.
    const reach = Math.min(1, distance / 220) / distance;
    server.style.setProperty('--lx', (dx * reach).toFixed(2));
    server.style.setProperty('--ly', (dy * reach).toFixed(2));
  };

  const onPointerLeave = () => {
    serverRef.current?.style.setProperty('--lx', '0');
    serverRef.current?.style.setProperty('--ly', '0');
  };

  const toggleSound = () => {
    if (muted) soundRef.current?.enable();
    else soundRef.current?.disable();
    setMuted(!muted);
  };

  const mood: ServerMood =
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
          <Server ref={serverRef} mood={mood} smoking={phase === 'blown'} />

          <button
            ref={keyRef}
            type="button"
            className={styles.key}
            onClick={() => controls.current.deploy()}
            aria-disabled={phase !== 'idle'}
            aria-label="Deploy to production"
          >
            <span className={styles.face}>
              <span className={styles.glyph} data-key-glyph aria-hidden>
                ⏎
              </span>
              <span className={styles.label} data-key-label>
                deploy
              </span>
            </span>
          </button>

          <div className={styles.action}>
            {phase === 'deploying' ? (
              <div
                ref={progressRef}
                className={styles.progress}
                role="progressbar"
                aria-label={`Deploying ${COMMIT}`}
                aria-valuemin={0}
                aria-valuemax={100}
              >
                <span className={styles.progressText}>
                  Deploying <span ref={percentRef}>0%</span>
                </span>
                <span className={styles.track}>
                  <span ref={fillRef} className={styles.fill} />
                </span>
              </div>
            ) : phase === 'blown' ? (
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
                ) : (
                  'Rolling back…'
                )}
              </p>
            )}
          </div>

          <h2 className={styles.title}>Never deploy on a Friday.</h2>
        </div>

        <canvas ref={frontRef} className={styles.canvas} aria-hidden />
      </div>
    </div>
  );
}
