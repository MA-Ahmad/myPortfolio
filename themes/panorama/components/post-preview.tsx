import { type RefObject, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import styles from '../panorama.module.css';

/** A row's cover; decorative, since the row's own title names the post. */
export type PreviewImage = { key: string; src: string };

/** The card's size: covers are 1200 × 630, framed by a thin border of panel. */
const WIDTH = 280;
const FRAME = 5;
const HEIGHT = Math.round(((WIDTH - 2 * FRAME) * 630) / 1200) + 2 * FRAME;
/** How far from the cursor the card sits, and how close it may come to the window's edge. */
const OFFSET = 20;
const MARGIN = 12;
/** Each 60fps frame closes this much of the gap to the cursor: quick to follow, never rigid. */
const FOLLOW = 0.3;
/** The lean into a sideways move, in degrees per pixel moved, and its cap. */
const LEAN = 0.35;
const MAX_LEAN = 4;

const FINE_POINTER = '(hover: hover) and (pointer: fine)';
const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/**
 * A post's cover that floats beside the cursor while it is over the post's row, and follows it
 * there. Rows opt in with `data-preview="<key>"`; one listener on the list finds them. Only mouse
 * and trackpad pointers get it: a tap opens the post.
 */
export function PostPreview({
  listRef,
  images
}: {
  listRef: RefObject<HTMLElement | null>;
  images: PreviewImage[];
}) {
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [active, setActive] = useState<string | null>(null);
  const [flip, setFlip] = useState({ x: false, y: false });
  const cardRef = useRef<HTMLDivElement>(null);

  // Mounted only for a fine pointer, inside the theme's root so its colours apply. Not inside the
  // section, whose transformed content would pin a fixed element to itself.
  useEffect(() => {
    const list = listRef.current;
    if (!list || !window.matchMedia(FINE_POINTER).matches) return;
    setHost(list.closest<HTMLElement>('[data-time]') ?? document.body);
  }, [listRef]);

  useEffect(() => {
    const list = listRef.current;
    const card = cardRef.current;
    if (!host || !list || !card) return;
    const keys = new Set(images.map((image) => image.key));
    const reduced = window.matchMedia(REDUCED_MOTION);

    const cursor = { x: 0, y: 0 };
    const at = { x: 0, y: 0 };
    let lean = 0;
    let shown: string | null = null;
    let flipped = { x: false, y: false };
    let frame = 0;
    let last = 0;

    const target = () => {
      const x = cursor.x + OFFSET + WIDTH > window.innerWidth - MARGIN;
      const y = cursor.y + OFFSET + HEIGHT > window.innerHeight - MARGIN;
      if (x !== flipped.x || y !== flipped.y) {
        flipped = { x, y };
        setFlip(flipped);
      }
      return {
        x: Math.max(MARGIN, x ? cursor.x - OFFSET - WIDTH : cursor.x + OFFSET),
        y: Math.max(MARGIN, y ? cursor.y - OFFSET - HEIGHT : cursor.y + OFFSET)
      };
    };

    const draw = () => {
      card.style.transform = `translate3d(${at.x}px, ${at.y}px, 0) rotate(${lean}deg)`;
    };

    const tick = (now: number) => {
      // Frame-rate independent: a 120Hz screen takes two smaller steps for one 60Hz step.
      const steps = Math.min(now - last, 64) / (1000 / 60);
      last = now;
      const goal = target();
      const k = reduced.matches ? 1 : 1 - Math.pow(1 - FOLLOW, steps);
      const dx = (goal.x - at.x) * k;
      at.x += dx;
      at.y += (goal.y - at.y) * k;
      const leanGoal = reduced.matches
        ? 0
        : Math.max(-MAX_LEAN, Math.min(MAX_LEAN, (dx / Math.max(steps, 0.5)) * LEAN));
      lean += (leanGoal - lean) * (1 - Math.pow(1 - 0.2, steps));
      draw();
      const settled =
        Math.abs(goal.x - at.x) < 0.1 && Math.abs(goal.y - at.y) < 0.1 && Math.abs(lean) < 0.01;
      if (settled) {
        at.x = goal.x;
        at.y = goal.y;
        lean = 0;
        draw();
        frame = 0;
      } else {
        frame = requestAnimationFrame(tick);
      }
    };

    const run = () => {
      if (frame) return;
      last = performance.now();
      frame = requestAnimationFrame(tick);
    };

    const show = (key: string | null) => {
      if (key === shown) return;
      // Appearing, it starts at the cursor rather than gliding in from wherever it last hid.
      if (!shown && key) {
        const goal = target();
        at.x = goal.x;
        at.y = goal.y;
        lean = 0;
        draw();
      }
      shown = key;
      setActive(key);
    };

    // The row under a point, if it has a cover and its section is open.
    const rowAt = (el: Element | null) => {
      const row = el?.closest<HTMLElement>('[data-preview]');
      if (!row || !list.contains(row)) return null;
      const key = row.dataset.preview!;
      return keys.has(key) ? key : null;
    };

    const onMove = (event: PointerEvent) => {
      if (event.pointerType === 'touch') return;
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      show(rowAt(event.target as Element));
      if (shown) run();
    };
    const onLeave = () => show(null);
    // Scrolling slides rows under a still cursor: show whichever one is there now.
    const onScroll = () => {
      if (shown) show(rowAt(document.elementFromPoint(cursor.x, cursor.y)));
    };
    // A key may switch sections under a still cursor; the next move brings the card back.
    const onKey = () => show(null);

    list.addEventListener('pointermove', onMove);
    list.addEventListener('pointerover', onMove);
    list.addEventListener('pointerleave', onLeave);
    list.addEventListener('pointerdown', onLeave);
    window.addEventListener('scroll', onScroll, { capture: true, passive: true });
    window.addEventListener('keydown', onKey);
    window.addEventListener('blur', onLeave);
    return () => {
      cancelAnimationFrame(frame);
      list.removeEventListener('pointermove', onMove);
      list.removeEventListener('pointerover', onMove);
      list.removeEventListener('pointerleave', onLeave);
      list.removeEventListener('pointerdown', onLeave);
      window.removeEventListener('scroll', onScroll, { capture: true });
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('blur', onLeave);
    };
  }, [host, listRef, images]);

  if (!host || !images.length) return null;

  return createPortal(
    <div ref={cardRef} className={styles.preview} aria-hidden>
      <div
        className={styles.previewCard}
        data-visible={active ? '' : undefined}
        style={{
          width: WIDTH,
          height: HEIGHT,
          padding: FRAME,
          transformOrigin: `${flip.x ? 'right' : 'left'} ${flip.y ? 'bottom' : 'top'}`
        }}
      >
        <div className={styles.previewImage}>
          {/* Every cover is loaded up front, so moving between rows never waits on one. */}
          {images.map((image) => (
            <img
              key={image.key}
              src={image.src}
              alt=""
              width={1200}
              height={630}
              decoding="async"
              data-active={image.key === active ? '' : undefined}
            />
          ))}
        </div>
      </div>
    </div>,
    host
  );
}
