import type { Axis, Point } from 'lib/canvas/geometry';

export type { Axis } from 'lib/canvas/geometry';

export type CardId = 'home' | 'terminal' | 'notebook' | 'midnight' | 'panorama';
export type NodeId = CardId | 'display';
export type Layout = 'desktop' | 'mobile';
export type Side = 'left' | 'right' | 'top' | 'bottom';

export const CARD_W = 300;
export const CARD_HEADER_H = 44;
/** Below the preview: the same 6px inset it has at the sides, plus the card border. */
export const CARD_BOTTOM = 7;
export const PORT_SIZE = 12;

export const DISPLAY_HEADER_H = 48;
export const DISPLAY_ROW_H = 36;
export const DISPLAY_BODY_PAD = 8;
export const DISPLAY_FOOTER_H = 40;
/** On desktop the display's body is a screen showing the connected theme's page, 16:9. */
export const DISPLAY_SCREEN_H = 315;
const DISPLAY: Record<Layout, { w: number; h: number }> = {
  // No footer on desktop: the screen runs to the bottom edge, where the bundle lands.
  desktop: { w: 560, h: DISPLAY_HEADER_H + DISPLAY_SCREEN_H },
  // On a phone its body is three rows of readouts.
  mobile: { w: 280, h: DISPLAY_HEADER_H + DISPLAY_BODY_PAD * 2 + DISPLAY_ROW_H * 3 + DISPLAY_FOOTER_H }
};
export const displaySize = (layout: Layout) => DISPLAY[layout];

export const NEAR_RADIUS = 64;
export const SNAP_RADIUS = 18;

// Every desktop card is one size, so each sits the same in the slot under the display.
const PREVIEW_H = 200;
const chrome = (preview: number) => CARD_HEADER_H + preview + CARD_BOTTOM;

// Desktop: the display on top and, straight under it, the slot the connected theme sits in. The
// other themes wait in the same row on either side, a slot apart, and slide along it.
export const ROW: CardId[] = ['notebook', 'terminal', 'home', 'midnight', 'panorama'];
export const DEFAULT_ACTIVE: CardId = 'home';
const SLOT_W = CARD_W;
const SLOT_GAP = 56;
const SLOT_STEP = SLOT_W + SLOT_GAP;
const ROW_GAP_Y = 230;

/** How many slots `id` is from the slot under the display: negative to its left. */
export const slotOffset = (id: CardId, active: CardId) => ROW.indexOf(id) - ROW.indexOf(active);

export type CardDef = {
  id: CardId;
  title: string;
  route: string;
  href: string;
  width: Record<Layout, number>;
  previewHeight: Record<Layout, number>;
  /**
   * Skill icons, from /assets/images/skills. Plugging in sends the first few down the wire (see
   * TRANSFER_COUNT in packets.tsx); hovering the port cycles through them all.
   */
  packets: string[];
};

export type Positions = Record<NodeId, Point>;

export const CARDS: CardDef[] = [
  {
    id: 'home',
    title: 'Classic',
    route: '/',
    href: '/',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW_H, mobile: 168 },
    packets: ['react.png', 'nextjs.png', 'typescript.png', 'claude.svg', 'tailwindcss.svg', 'vercel.svg']
  },
  {
    id: 'terminal',
    title: 'Terminal',
    route: '/themes/terminal',
    href: '/themes/terminal',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW_H, mobile: 150 },
    packets: ['rails.png', 'nestjs.svg', 'postgresql.png', 'claude.svg', 'ruby.png', 'redis.png']
  },
  {
    id: 'notebook',
    title: 'Notebook',
    route: '/themes/notebook',
    href: '/themes/notebook',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW_H, mobile: 170 },
    packets: ['claude.svg', 'react.png', 'nextjs.png', 'rails.png', 'typescript.png', 'cursor.svg']
  },
  {
    id: 'midnight',
    title: 'Midnight',
    route: '/themes/midnight',
    href: '/themes/midnight',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW_H, mobile: 170 },
    packets: ['nextjs.png', 'tailwindcss.svg', 'postgresql.png', 'redis.png', 'cursor.svg', 'typescript.png']
  },
  {
    id: 'panorama',
    title: 'Panorama',
    route: '/themes/panorama',
    href: '/themes/panorama',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW_H, mobile: 170 },
    packets: ['react.png', 'typescript.png', 'nextjs.png', 'claude.svg', 'tailwindcss.svg', 'vercel.svg']
  }
];

export const cardById = (id: CardId) => CARDS.find((card) => card.id === id)!;

export const cardHeight = (card: CardDef, layout: Layout) => chrome(card.previewHeight[layout]);

export const nodeSize = (id: NodeId, layout: Layout) => {
  if (id === 'display') return DISPLAY[layout];
  const card = cardById(id);
  return { w: card.width[layout], h: cardHeight(card, layout) };
};

/** Desktop wires run up from a card into the display; a phone's run sideways into its gutter. */
export const wireAxis = (layout: Layout): Axis => (layout === 'desktop' ? 'y' : 'x');

/**
 * The card edge the port is on. On desktop it faces the display: the top edge while the card is
 * below the display, the bottom edge if it has been dragged above it. The phone stack is a single
 * column left of the display's input, so its ports stay on the right.
 */
export function portSide(id: CardId, layout: Layout, positions: Positions): Side {
  if (layout !== 'desktop') return 'right';
  const cardCenter = positions[id].y + cardHeight(cardById(id), 'desktop') / 2;
  const displayCenter = positions.display.y + DISPLAY.desktop.h / 2;
  return cardCenter > displayCenter ? 'top' : 'bottom';
}

/**
 * A desktop card's port faces the display, so it plugs into the display input on the opposite
 * edge. On a phone the display is above the stack and every wire runs up its right edge.
 */
export const inputSide = (id: CardId, layout: Layout, positions: Positions): Side =>
  layout !== 'desktop' ? 'right' : portSide(id, layout, positions) === 'top' ? 'bottom' : 'top';

/** Where a card's port sits, from the card's own corner: the middle of the edge it is on. */
export function portOffset(card: CardDef, layout: Layout, side: Side): Point {
  const w = card.width[layout];
  const h = cardHeight(card, layout);
  if (side === 'left' || side === 'right') return { x: side === 'left' ? 0 : w, y: h / 2 };
  return { x: w / 2, y: side === 'top' ? 0 : h };
}

/**
 * Desktop puts the display at the top centre and the themes in one row beneath it, the `active`
 * one in the slot straight under the display with its port facing up at it, the rest a slot apart
 * to either side. Mobile stacks everything in one column and ignores `active`.
 */
export function initialPositions(layout: Layout, active: CardId = DEFAULT_ACTIVE): Record<NodeId, Point> {
  if (layout === 'desktop') {
    const centre = DESIGN.desktop.w / 2;
    const row = { display: { x: centre - DISPLAY.desktop.w / 2, y: 0 } } as Record<NodeId, Point>;
    for (const id of ROW) {
      row[id] = {
        x: centre + slotOffset(id, active) * SLOT_STEP - cardById(id).width.desktop / 2,
        y: DISPLAY.desktop.h + ROW_GAP_Y
      };
    }
    return row;
  }
  // The display leads the stack, so it is on screen whenever the page opens; the cards sit
  // under it and wire up the right side.
  const stack = {} as Record<NodeId, Point>;
  stack.display = { x: MOBILE_GUTTER + (CARD_W - DISPLAY.mobile.w) / 2, y: 0 };
  let y = DISPLAY.mobile.h + MOBILE_GAP_DISPLAY;
  for (const card of CARDS) {
    stack[card.id] = { x: MOBILE_GUTTER, y };
    y += cardHeight(card, 'mobile') + 24;
  }
  return stack;
}

// On a phone every wire runs up the right edge of the stack, out of its card's port and back
// into the display's input; this much room is kept for the curve on both sides, so the stack
// itself stays centered.
const MOBILE_GUTTER = 44;
const MOBILE_GAP_DISPLAY = 56;

/**
 * How far a phone wire's curve may reach out of its ports. A bezier with both handles this far
 * out swings 3/4 of it beyond the ports, which stays inside the gutter.
 */
export const wireReachCap = (layout: Layout) => (layout === 'mobile' ? MOBILE_GUTTER * 1.2 : Infinity);

export const DESIGN = {
  desktop: {
    w: SLOT_W + 2 * SLOT_STEP,
    h: DISPLAY.desktop.h + ROW_GAP_Y + Math.max(...CARDS.map((card) => cardHeight(card, 'desktop')))
  },
  mobile: {
    w: CARD_W + MOBILE_GUTTER * 2,
    h: DISPLAY.mobile.h + MOBILE_GAP_DISPLAY + CARDS.reduce((sum, card) => sum + cardHeight(card, 'mobile') + 24, 0)
  }
};

export function outputPort(id: CardId, positions: Positions, layout: Layout): Point {
  const card = cardById(id);
  const at = positions[id];
  const o = portOffset(card, layout, portSide(id, layout, positions));
  return { x: at.x + o.x, y: at.y + o.y };
}

/** A display input: the middle of the edge it is on. */
export const inputPort = (at: Point, side: Side, layout: Layout): Point => {
  const { w, h } = DISPLAY[layout];
  if (side === 'top') return { x: at.x + w / 2, y: at.y };
  if (side === 'bottom') return { x: at.x + w / 2, y: at.y + h };
  return { x: side === 'left' ? at.x : at.x + w, y: at.y + h / 2 };
};

/** Which way a wire leaves a port along its axis: -1 from a left or top edge, +1 from a right or bottom one. */
export const direction = (side: Side) => (side === 'left' || side === 'top' ? -1 : 1);

/** A step out of a port on `side`, as a vector. */
export const outward = (side: Side): Point =>
  side === 'left' || side === 'right' ? { x: direction(side), y: 0 } : { x: 0, y: direction(side) };
