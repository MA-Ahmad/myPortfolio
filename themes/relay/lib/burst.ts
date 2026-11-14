/**
 * The relay's one piece of motion, drawn on a single canvas over the stage:
 *
 * 1. A packet runs the wire from the active nav node to the card's bullet (the hub).
 * 2. Twelve hairlines shoot from the hub to evenly spaced points on the card's border. Each takes
 *    a share of SPOKE_MS in proportion to its length (the longest takes all of it), quad out;
 *    they draw at 35% and settle to 10%.
 * 3. At each impact a 4px node pops (scale to 1.6 while fading, NODE_MS), and the impact grows
 *    its slice of the border, 1/12 of the perimeter, expo out (SLICE_MS), at 60%.
 * 4. Once the ring is whole it holds, then eases back to the CSS border's 16%.
 *
 * Everything is a pure function of the time since the click, so a new click simply restarts it,
 * and the resting frame is the same drawing at t = ∞.
 */

export type Point = { x: number; y: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Scene = { hub: Point; card: Rect; node: Point | null };

export const SPOKES = 12;
export const PACKET_MS = 280;
export const SPOKE_MS = 460;
export const NODE_MS = 520;
export const SLICE_MS = 420;
const RING_HOLD_MS = 260;
const RING_FADE_MS = 900;
const SETTLE_MS = 600;

const SPOKE_DRAW = 0.35;
const SPOKE_REST = 0.1;
const RING = 0.6;
const WIRE = 0.16;

const quadOut = (t: number) => t * (2 - t);
const expoOut = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const inOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const clamp = (t: number) => Math.min(1, Math.max(0, t));

/** The point `s` px along the card's border, clockwise from its top left corner. */
function along(card: Rect, s: number): Point {
  const { x, y, w, h } = card;
  const p = 2 * (w + h);
  s = ((s % p) + p) % p;
  if (s < w) return { x: x + s, y };
  if (s < w + h) return { x: x + w, y: y + s - w };
  if (s < 2 * w + h) return { x: x + w - (s - w - h), y: y + h };
  return { x, y: y + h - (s - 2 * w - h) };
}

/** Strokes the border from `a` to `b` px along it, turning its corners. */
function strokeAlong(ctx: CanvasRenderingContext2D, card: Rect, a: number, b: number) {
  const { w, h } = card;
  const corners = [0, w, w + h, 2 * w + h, 2 * (w + h)];
  const p = 2 * (w + h);
  ctx.beginPath();
  const start = along(card, a);
  ctx.moveTo(start.x, start.y);
  // Walk the corners that fall between a and b (b may run past a full lap's end).
  for (let lap = Math.floor(a / p) * p; lap < b; lap += p) {
    for (const c of corners) {
      const s = lap + c;
      if (s > a && s < b) {
        const q = along(card, s);
        ctx.lineTo(q.x, q.y);
      }
    }
  }
  const end = along(card, b);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();
}

/** Where each spoke lands: the middle of each twelfth of the border. */
function targets(card: Rect) {
  const p = 2 * (card.w + card.h);
  return Array.from({ length: SPOKES }, (_, i) => {
    const s = ((i + 0.5) * p) / SPOKES;
    return { s, at: along(card, s) };
  });
}

/** How long the whole burst runs, from the click: when it is over, the frame stops changing. */
export const BURST_MS = PACKET_MS + SPOKE_MS + SLICE_MS + RING_HOLD_MS + RING_FADE_MS;

/**
 * Draws the scene `t` ms after a click (Infinity for the resting frame; null for a scene that has
 * not been lit yet, which shows only the wire). `packet` is false when the burst starts at the hub
 * (the first one on arrival, or a phone with no wire).
 */
export function draw(
  ctx: CanvasRenderingContext2D,
  scene: Scene,
  t: number | null,
  { ink, packet }: { ink: string; packet: boolean }
) {
  const { hub, card, node } = scene;
  ctx.lineWidth = 1;
  ctx.strokeStyle = ink;
  ctx.fillStyle = ink;

  // The wire, always there, faint.
  if (node) {
    ctx.globalAlpha = WIRE;
    ctx.beginPath();
    ctx.moveTo(node.x, node.y);
    ctx.lineTo(hub.x, hub.y);
    ctx.stroke();
  }
  if (t === null) return;

  const lead = packet && node ? PACKET_MS : 0;

  // 1. The packet, a 4px square riding the wire (ease-in-out: it is moving across the screen).
  if (node && t < lead) {
    const k = inOut(clamp(t / lead));
    const x = node.x + (hub.x - node.x) * k;
    const y = node.y + (hub.y - node.y) * k;
    ctx.globalAlpha = 1;
    ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
  }

  const b = t - lead;
  if (b < 0) return;

  const spokes = targets(card);
  const lengths = spokes.map(({ at }) => Math.hypot(at.x - hub.x, at.y - hub.y));
  const longest = Math.max(...lengths);
  const slice = (2 * (card.w + card.h)) / SPOKES / 2;

  spokes.forEach(({ s, at }, i) => {
    const dur = (SPOKE_MS * lengths[i]) / longest;
    const k = quadOut(clamp(b / dur));
    const since = b - dur; // time since impact

    // 2. The spoke: drawn at 35%, settling to 10% once it lands.
    ctx.globalAlpha = since < 0 ? SPOKE_DRAW : SPOKE_DRAW + (SPOKE_REST - SPOKE_DRAW) * quadOut(clamp(since / SETTLE_MS));
    ctx.beginPath();
    ctx.moveTo(hub.x, hub.y);
    ctx.lineTo(hub.x + (at.x - hub.x) * k, hub.y + (at.y - hub.y) * k);
    ctx.stroke();
    if (since < 0) return;

    // 3. The node pops at the impact, and the impact grows its slice of the border.
    if (since < NODE_MS) {
      const n = clamp(since / NODE_MS);
      const size = 4 * (1 + 0.6 * quadOut(n));
      ctx.globalAlpha = 1 - quadOut(n);
      ctx.fillRect(at.x - size / 2, at.y - size / 2, size, size);
    }
    const grow = expoOut(clamp(since / SLICE_MS)) * slice;
    ctx.globalAlpha = RING * ringAlpha(b);
    if (grow > 0.5) strokeAlong(ctx, card, s - grow, s + grow);
  });
}

/** 4. The ring holds once whole, then eases back to the resting border. */
function ringAlpha(time: number) {
  const whole = SPOKE_MS + SLICE_MS;
  if (time < whole + RING_HOLD_MS) return 1;
  return 1 - quadOut(clamp((time - whole - RING_HOLD_MS) / RING_FADE_MS));
}
