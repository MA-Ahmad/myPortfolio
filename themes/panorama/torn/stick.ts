/**
 * The mouse, stuck to the end of the threads. A pull's hand stops short however far the pointer
 * goes, which leaves the real cursor wandering off on its own; so while something is pulled the
 * real cursor is hidden and a closed hand, like the grabbing cursor, is drawn where the threads
 * end. Let go, and it glides back to where the pointer really is before the real one returns.
 *
 * One for the page, shared by everything that can be pulled (tether.tsx, strain.tsx, peel.tsx).
 */

/** How quickly the drawn cursor returns to the pointer once let go, and when it gives up, ms. */
const RETURN_MS = 55;
const RETURN_MAX_MS = 320;

let cursor: HTMLDivElement | null = null;
let held = false;
let frame = 0;
const at = { x: 0, y: 0 };
const real = { x: 0, y: 0 };

function ensure() {
  if (cursor) return cursor;
  cursor = document.createElement('div');
  cursor.setAttribute('aria-hidden', 'true');
  cursor.style.cssText =
    'position:fixed;left:0;top:0;z-index:60;pointer-events:none;will-change:transform;display:none';
  // A closed hand like the system's grabbing cursor, which a pull shows: the pull keeps its
  // cursor, it just stays on the threads. Centred on the element's own origin.
  cursor.innerHTML =
    '<svg width="22" height="22" viewBox="0 0 22 22" style="display:block;margin:-12px 0 0 -11px">' +
    '<g fill="#fff" stroke="#111" stroke-width="1.2" stroke-linejoin="round" stroke-linecap="round">' +
    '<path d="M5.6 10V7.2a1.6 1.6 0 0 1 3.2 0V6.6a1.6 1.6 0 0 1 3.2 0v.6a1.6 1.6 0 0 1 3.2 0v.9' +
    'a1.5 1.5 0 0 1 3 0v5.5c0 3.3-2.4 5.6-5.8 5.6H11c-2.3 0-3.7-1-4.9-2.9l-2.5-3.7' +
    'c-.7-1.1.6-2.3 1.6-1.4z"/>' +
    '<path d="M8.8 7.2v3M12 7.2v3M15.2 8.1v2.2" fill="none"/></g></svg>';
  document.body.appendChild(cursor);
  window.addEventListener(
    'pointermove',
    (event) => {
      real.x = event.clientX;
      real.y = event.clientY;
    },
    { passive: true }
  );
  return cursor;
}

const place = () => {
  cursor!.style.transform = `translate(${at.x.toFixed(1)}px, ${at.y.toFixed(1)}px)`;
};

const hide = () => {
  cancelAnimationFrame(frame);
  frame = 0;
  if (cursor) cursor.style.display = 'none';
  delete document.documentElement.dataset.stuck;
};

/** Shows the cursor at this point of the window, and hides the real one. Call each frame of a pull. */
export function holdCursor(x: number, y: number) {
  const element = ensure();
  cancelAnimationFrame(frame);
  frame = 0;
  if (!held) {
    held = true;
    element.style.display = 'block';
    document.documentElement.dataset.stuck = '';
  }
  at.x = x;
  at.y = y;
  place();
}

/** Lets the cursor go: it glides to the real pointer and gives way to it, or at once if `now`. */
export function freeCursor(now = false) {
  if (!held) return;
  held = false;
  if (now) return hide();
  const began = performance.now();
  let last = began;
  const step = (time: number) => {
    const follow = 1 - Math.exp(-(time - last) / RETURN_MS);
    last = time;
    at.x += (real.x - at.x) * follow;
    at.y += (real.y - at.y) * follow;
    place();
    if (Math.hypot(real.x - at.x, real.y - at.y) < 1.5 || time - began > RETURN_MAX_MS) hide();
    else frame = requestAnimationFrame(step);
  };
  frame = requestAnimationFrame(step);
}
