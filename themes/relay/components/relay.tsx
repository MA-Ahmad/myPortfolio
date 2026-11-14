import {
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  useSyncExternalStore
} from 'react';
import Link from 'next/link';
import { format } from 'date-fns';
import type { ThemeHomeProps } from 'themes/registry';
import { RELAY_CONTENT as C, SECTIONS, type SectionId } from '../content';
import { BURST_MS, PACKET_MS, type Scene, draw } from '../lib/burst';
import { type Liquid, startLiquid } from '../lib/liquid';
import { Spec } from './spec';
import styles from '../relay.module.css';

/** The card's starting size, and the least it can be dragged down to. */
const START = { w: 640, h: 400 };
const MIN = { w: 420, h: 320 };
/** Room around the stage the canvas keeps, so nodes popping on the border aren't clipped. */
const BLEED = 24;

const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

/** From this width the nav stands beside the card, wired to it; below, it is a row above it. */
const SIDE = '(min-width: 1000px)';
const subscribeSide = (change: () => void) => {
  const query = matchMedia(SIDE);
  query.addEventListener('change', change);
  return () => query.removeEventListener('change', change);
};
const useSide = () => useSyncExternalStore(subscribeSide, () => matchMedia(SIDE).matches, () => true);

export function Relay({ posts }: ThemeHomeProps) {
  const [active, setActive] = useState<SectionId>('intro');
  // How the last switch happened: a click plays the relay, keys and reduced motion switch at once.
  const [instant, setInstant] = useState(true);
  const [size, setSize] = useState(START);
  const [shown, setShown] = useState({ w: START.w, h: START.h });
  const [pulse, setPulse] = useState(0);
  const [spec, setSpec] = useState(false);

  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const cardRef = useRef<HTMLDivElement>(null);
  const hubRef = useRef<HTMLSpanElement>(null);
  const nodes = useRef<Partial<Record<SectionId, HTMLSpanElement | null>>>({});
  const activeRef = useRef(active);
  const side = useSide();
  useLayoutEffect(() => {
    activeRef.current = active;
  }, [active]);

  // The burst's clock: when it started and whether a packet leads it. `lit` stays true after the
  // first burst, so the resting frame keeps its faint spokes.
  const burst = useRef<{ start: number; packet: boolean } | null>(null);

  // The black liquid behind everything: the light follows the pointer, a relay ripples it.
  const liquidRef = useRef<HTMLCanvasElement>(null);
  const liquid = useRef<Liquid | null>(null);
  useEffect(() => {
    if (!liquidRef.current) return;
    liquid.current = startLiquid(liquidRef.current, { still: reducedMotion() });
    const move = (event: globalThis.PointerEvent) => liquid.current?.point(event.clientX, event.clientY);
    window.addEventListener('pointermove', move, { passive: true });
    return () => {
      window.removeEventListener('pointermove', move);
      liquid.current?.destroy();
      liquid.current = null;
    };
  }, []);
  const lit = useRef(false);
  const frame = useRef(0);

  /** Where everything is, in the canvas's own px. */
  const scene = useCallback((): Scene | null => {
    const stage = stageRef.current;
    const card = cardRef.current;
    const hub = hubRef.current;
    if (!stage || !card || !hub) return null;
    const box = stage.getBoundingClientRect();
    const ox = box.left - BLEED;
    const oy = box.top - BLEED;
    const c = card.getBoundingClientRect();
    const h = hub.getBoundingClientRect();
    const n = nodes.current[activeRef.current]?.getBoundingClientRect();
    // On a phone the nav sits above the card in a row: there is no wire, the burst starts at the hub.
    const wired = n && stage.dataset.layout === 'side';
    return {
      card: { x: c.left - ox + 0.5, y: c.top - oy + 0.5, w: c.width - 1, h: c.height - 1 },
      hub: { x: h.left + h.width / 2 - ox, y: h.top + h.height / 2 - oy },
      node: wired ? { x: n.left + n.width / 2 - ox, y: n.top + n.height / 2 - oy } : null
    };
  }, []);

  const paint = useCallback(
    (now: number) => {
      const canvas = canvasRef.current;
      const stage = stageRef.current;
      const s = scene();
      if (!canvas || !stage || !s) return false;
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = stage.offsetWidth + BLEED * 2;
      const h = stage.offsetHeight + BLEED * 2;
      if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
        canvas.width = Math.round(w * dpr);
        canvas.height = Math.round(h * dpr);
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;
      }
      const ctx = canvas.getContext('2d');
      if (!ctx) return false;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);
      const ink = getComputedStyle(stage).getPropertyValue('--rl-ink').trim() || '#fff';
      const b = burst.current;
      const t = b ? now - b.start : lit.current ? Infinity : null;
      draw(ctx, s, t, { ink, packet: b?.packet ?? false });
      return b !== null && t !== null && t < BURST_MS;
    },
    [scene]
  );

  /** Repaint now, and keep painting while a burst is running. */
  const run = useCallback(() => {
    cancelAnimationFrame(frame.current);
    const tick = (now: number) => {
      if (paint(now)) frame.current = requestAnimationFrame(tick);
      else burst.current = null;
    };
    frame.current = requestAnimationFrame(tick);
  }, [paint]);

  /** Plays the relay: the packet (if there's a wire), then the spokes and the ring. */
  const fire = useCallback(
    (packet: boolean) => {
      lit.current = true;
      if (reducedMotion()) {
        burst.current = null;
        run();
        return;
      }
      burst.current = { start: performance.now(), packet };
      run();
      // The liquid ripples out from the hub as the spokes leave it.
      window.setTimeout(() => {
        const hub = hubRef.current?.getBoundingClientRect();
        if (hub) liquid.current?.ripple(hub.left + hub.width / 2, hub.top + hub.height / 2);
      }, packet ? PACKET_MS : 0);
    },
    [run]
  );

  // The hub takes the packet with a small pop, when it arrives.
  const pulseTimer = useRef<number | undefined>(undefined);
  const go = (id: SectionId, how: 'click' | 'key') => {
    setActive(id);
    // In the phone's row of tabs, bring the picked one fully into view.
    if (stageRef.current?.dataset.layout === 'stack') {
      document
        .getElementById(`relay-tab-${id}`)
        ?.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: reducedMotion() ? 'auto' : 'smooth' });
    }
    setInstant(how === 'key');
    window.clearTimeout(pulseTimer.current);
    if (how === 'key') {
      // Keys move fast: switch at once, no relay. The resting spokes follow on the next frame.
      lit.current = true;
      burst.current = null;
      requestAnimationFrame(() => run());
      return;
    }
    const wired = stageRef.current?.dataset.layout === 'side';
    requestAnimationFrame(() => fire(wired));
    pulseTimer.current = window.setTimeout(() => setPulse((p) => p + 1), wired ? PACKET_MS : 0);
  };

  // On arrival, once the fonts have set the text, the relay plays once, so the page shows what it
  // does. With reduced motion it simply rests, lit.
  useEffect(() => {
    let cancelled = false;
    let timer: number | undefined;
    (document.fonts?.ready ?? Promise.resolve()).then(() => {
      if (cancelled) return;
      timer = window.setTimeout(() => {
        fire(stageRef.current?.dataset.layout === 'side');
        if (!reducedMotion()) window.setTimeout(() => setPulse((p) => p + 1), PACKET_MS);
      }, 350);
    });
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      cancelAnimationFrame(frame.current);
    };
  }, [fire]);

  // Anything that moves the card or the hub repaints the resting frame (a running burst keeps
  // going on its own clock, against the new geometry).
  useEffect(() => {
    const stage = stageRef.current;
    const card = cardRef.current;
    if (!stage || !card) return;
    const observer = new ResizeObserver(() => {
      setShown({ w: Math.round(card.offsetWidth), h: Math.round(card.offsetHeight) });
      if (!burst.current) run();
    });
    observer.observe(stage);
    observer.observe(card);
    return () => observer.disconnect();
  }, [run]);

  useLayoutEffect(() => {
    if (!burst.current) run();
  }, [active, run]);

  // The nav reads as a list of tabs: arrows move through it without animation.
  const onNavKey = (event: KeyboardEvent) => {
    const i = SECTIONS.findIndex((s) => s.id === active);
    const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    const next = SECTIONS[(i + step + SECTIONS.length) % SECTIONS.length].id;
    go(next, 'key');
    document.getElementById(`relay-tab-${next}`)?.focus();
  };

  // The corner handle resizes the card, like a frame in a design tool.
  const drag = useRef<{ x: number; y: number; w: number; h: number; max: number } | null>(null);
  const onHandleDown = (event: PointerEvent<HTMLButtonElement>) => {
    const card = cardRef.current;
    const stage = stageRef.current;
    if (!card || !stage) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    const room = stage.getBoundingClientRect().right - card.getBoundingClientRect().left;
    drag.current = { x: event.clientX, y: event.clientY, w: card.offsetWidth, h: card.offsetHeight, max: room };
  };
  const onHandleMove = (event: PointerEvent<HTMLButtonElement>) => {
    const d = drag.current;
    if (!d) return;
    setSize({
      w: Math.round(Math.min(d.max, Math.max(MIN.w, d.w + event.clientX - d.x))),
      h: Math.round(Math.min(760, Math.max(MIN.h, d.h + event.clientY - d.y)))
    });
  };
  const onHandleUp = () => {
    if (!drag.current) return;
    drag.current = null;
    fire(false);
  };
  const onHandleKey = (event: KeyboardEvent) => {
    const step = event.shiftKey ? 40 : 10;
    const delta = { ArrowRight: [step, 0], ArrowLeft: [-step, 0], ArrowDown: [0, step], ArrowUp: [0, -step] }[event.key];
    if (!delta) return;
    event.preventDefault();
    setSize((s) => ({ w: Math.max(MIN.w, s.w + delta[0]), h: Math.max(MIN.h, s.h + delta[1]) }));
  };

  return (
    <div className={styles.page}>
      <canvas ref={liquidRef} className={styles.liquid} aria-hidden="true" />
      <header className={styles.top}>
        <span>{C.name}</span>
        <span className={styles.dim}>{C.role}</span>
        <button
          type="button"
          className={styles.specToggle}
          aria-pressed={spec}
          onClick={() => setSpec((s) => !s)}
        >
          {spec ? 'Hide the spec' : 'Show the spec'}
        </button>
      </header>

      <div ref={stageRef} className={styles.stage} data-layout={side ? 'side' : 'stack'} data-spec={spec || undefined}>
        <canvas ref={canvasRef} className={styles.canvas} style={{ left: -BLEED, top: -BLEED }} aria-hidden="true" />

        <nav className={styles.nav} aria-label="Sections">
          <div role="tablist" aria-orientation="vertical" className={styles.tabs} onKeyDown={onNavKey}>
            {SECTIONS.map((section) => {
              const selected = section.id === active;
              return (
                <button
                  key={section.id}
                  id={`relay-tab-${section.id}`}
                  type="button"
                  role="tab"
                  aria-selected={selected}
                  aria-controls="relay-card"
                  tabIndex={selected ? 0 : -1}
                  className={styles.tab}
                  onClick={(event) => go(section.id, event.detail === 0 ? 'key' : 'click')}
                >
                  <span>{section.label}</span>
                  <span
                    ref={(el) => {
                      nodes.current[section.id] = el;
                    }}
                    className={styles.node}
                    aria-hidden="true"
                  />
                </button>
              );
            })}
          </div>
          <Spec at="nav" />
        </nav>

        <div className={styles.frame} style={{ '--card-w': `${size.w}px` } as CSSProperties}>
          <div
            ref={cardRef}
            id="relay-card"
            role="tabpanel"
            aria-labelledby={`relay-tab-${active}`}
            className={styles.card}
            style={{ minHeight: size.h }}
          >
            <span key={pulse} ref={hubRef} className={styles.hub} data-pulse={pulse > 0 || undefined} aria-hidden="true" />
            <div key={active} className={styles.content} data-instant={instant || undefined}>
              <Section id={active} posts={posts} go={(id) => go(id, 'click')} />
            </div>
          </div>

          <button
            type="button"
            className={styles.handle}
            aria-label={`Resize the card, now ${shown.w} by ${shown.h}`}
            onPointerDown={onHandleDown}
            onPointerMove={onHandleMove}
            onPointerUp={onHandleUp}
            onPointerCancel={onHandleUp}
            onKeyDown={onHandleKey}
            onKeyUp={(event) => event.key.startsWith('Arrow') && fire(false)}
          />
          <span className={styles.readout} aria-hidden="true">
            {shown.w} × {shown.h}
          </span>
          <Spec at="card" />
        </div>
      </div>
    </div>
  );
}

function Section({
  id,
  posts,
  go
}: {
  id: SectionId;
  posts: ThemeHomeProps['posts'];
  go: (id: SectionId) => void;
}) {
  const jump = (to: SectionId, label: ReactNode) => (
    <button type="button" className={styles.inlineLink} onClick={() => go(to)}>
      {label}
    </button>
  );

  switch (id) {
    case 'intro':
      return (
        <>
          <h1>I build web products, from the database to the pixels.</h1>
          <p>
            Full stack engineer in Pakistan, shipping since 2017. These days I build web3 products at{' '}
            {jump('work', C.now.title)} in Next.js, React and Rails.
          </p>
          <Action href={C.resumeUrl}>Résumé</Action>
        </>
      );
    case 'work':
      return (
        <>
          <h1>
            {C.now.role} at {C.now.title}, since {C.now.period.split(' - ')[0]}.
          </h1>
          <Rows rows={C.career.slice(1).map((job) => ({ key: job.title, left: job.title, right: job.period }))} />
          <Action href={C.linkedinUrl}>LinkedIn</Action>
        </>
      );
    case 'projects':
      return (
        <>
          <h1>Products I’ve shipped, from DeFi to property software.</h1>
          <Rows
            rows={C.projects.map((p) => ({
              key: p.title,
              left: (
                <a href={p.href} target="_blank" rel="noreferrer">
                  {p.title}
                </a>
              ),
              right: p.stack
            }))}
          />
          <Action href={C.githubUrl}>GitHub</Action>
        </>
      );
    case 'writing':
      return (
        <>
          <h1>Notes from building for the web, published on DEV.</h1>
          {posts.length ? (
            <Rows
              rows={posts.slice(0, 5).map((post) => ({
                key: post.slug,
                left: <Link href={`/blog/${post.slug}`}>{post.title}</Link>,
                right: format(new Date(post.published_at), 'MMM yyyy')
              }))}
            />
          ) : (
            <p>The latest posts load from DEV; the full list is on the blog.</p>
          )}
          <Action href="/blog" internal>
            All posts
          </Action>
        </>
      );
    case 'blocks':
      return (
        <>
          <h1>Blocks: sections you can copy into your own site.</h1>
          <p>Each one comes with a live preview and its full source.</p>
          <Rows rows={C.blocks.map((b) => ({ key: b.href, left: <Link href={b.href}>{b.title}</Link>, right: '' }))} />
          <Action href="/blocks" internal>
            Browse all {C.blockCount}
          </Action>
        </>
      );
    case 'contact':
      return (
        <>
          <h1>Building something? Write to me.</h1>
          <p>
            <a href={`mailto:${C.email}`}>{C.email}</a>
          </p>
          <ul className={styles.links}>
            {C.links.map((link) => (
              <li key={link.label}>
                <a href={link.href} target="_blank" rel="noreferrer">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
          <Action href={`mailto:${C.email}`}>Email me</Action>
        </>
      );
  }
}

function Rows({ rows }: { rows: { key: string; left: ReactNode; right: ReactNode }[] }) {
  return (
    <ul className={styles.rows}>
      {rows.map((row) => (
        <li key={row.key}>
          <span>{row.left}</span>
          <span className={styles.dim}>{row.right}</span>
        </li>
      ))}
    </ul>
  );
}

function Action({ href, internal, children }: { href: string; internal?: boolean; children: ReactNode }) {
  return internal ? (
    <Link href={href} className={styles.action}>
      {children}
    </Link>
  ) : (
    <a href={href} className={styles.action} target={href.startsWith('mailto:') ? undefined : '_blank'} rel="noreferrer">
      {children}
    </a>
  );
}
