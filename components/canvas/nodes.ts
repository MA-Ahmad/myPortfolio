import type { Point } from 'lib/canvas/geometry';

export type CardId = 'home' | 'terminal' | 'notebook' | 'midnight' | 'panorama';
export type NodeId = CardId | 'display';
export type Layout = 'desktop' | 'mobile';
export type Side = 'left' | 'right' | 'top' | 'bottom';

export const CARD_W = 300;
export const CARD_HEADER_H = 44;
/** Below the preview: the same 6px inset it has at the sides, plus the card border. */
export const CARD_BOTTOM = 7;

export const DISPLAY_HEADER_H = 48;
/**
 * The display's body is a screen showing the connected theme's page: 16:9 on desktop, where the page
 * is laid out as a desktop sees it; nearly square on a phone, which shows the page's phone layout.
 */
export const DISPLAY_SCREEN_H: Record<Layout, number> = { desktop: 315, mobile: 330 };
// No footer: the screen runs to the bottom edge, where the bundle lands.
const DISPLAY: Record<Layout, { w: number; h: number }> = {
  desktop: { w: 560, h: DISPLAY_HEADER_H + DISPLAY_SCREEN_H.desktop },
  mobile: { w: 320, h: DISPLAY_HEADER_H + DISPLAY_SCREEN_H.mobile }
};
export const displaySize = (layout: Layout) => DISPLAY[layout];

// Every card is one size, so each sits the same in the slot under the display.
const PREVIEW_H: Record<Layout, number> = { desktop: 200, mobile: 170 };
const chrome = (preview: number) => CARD_HEADER_H + preview + CARD_BOTTOM;

// The display on top and, straight under it, the slot the connected theme sits in. The other themes
// wait in the same row on either side, a slot apart, and slide along it. On a phone the slots are
// close enough that the neighbours' edges show.
export const ROW: CardId[] = ['notebook', 'terminal', 'home', 'midnight', 'panorama'];
export const DEFAULT_ACTIVE: CardId = 'home';
const SLOT_W = CARD_W;
const SLOT_STEP: Record<Layout, number> = { desktop: SLOT_W + 56, mobile: SLOT_W + 14 };
// The height left for the bundle between the display and the cards.
const ROW_GAP_Y: Record<Layout, number> = { desktop: 230, mobile: 120 };

/** How many slots `id` is from the slot under the display: negative to its left. */
export const slotOffset = (id: CardId, active: CardId) => ROW.indexOf(id) - ROW.indexOf(active);

export type CardDef = {
  id: CardId;
  title: string;
  route: string;
  href: string;
  width: Record<Layout, number>;
  previewHeight: Record<Layout, number>;
  /** Skill icons, from /assets/images/skills. The studio dock sends the first few down its wire. */
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
    previewHeight: PREVIEW_H,
    packets: ['react.png', 'nextjs.png', 'typescript.png', 'claude.svg', 'tailwindcss.svg', 'vercel.svg']
  },
  {
    id: 'terminal',
    title: 'Terminal',
    route: '/themes/terminal',
    href: '/themes/terminal',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: PREVIEW_H,
    packets: ['rails.png', 'nestjs.svg', 'postgresql.png', 'claude.svg', 'ruby.png', 'redis.png']
  },
  {
    id: 'notebook',
    title: 'Notebook',
    route: '/themes/notebook',
    href: '/themes/notebook',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: PREVIEW_H,
    packets: ['claude.svg', 'react.png', 'nextjs.png', 'rails.png', 'typescript.png', 'cursor.svg']
  },
  {
    id: 'midnight',
    title: 'Midnight',
    route: '/themes/midnight',
    href: '/themes/midnight',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: PREVIEW_H,
    packets: ['nextjs.png', 'tailwindcss.svg', 'postgresql.png', 'redis.png', 'cursor.svg', 'typescript.png']
  },
  {
    id: 'panorama',
    title: 'Panorama',
    route: '/themes/panorama',
    href: '/themes/panorama',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: PREVIEW_H,
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

/**
 * The card edge the wire leaves by. It faces the display: the top edge while the card is below the
 * display, the bottom edge if it has been dragged above it.
 */
export function portSide(id: CardId, layout: Layout, positions: Positions): Side {
  const cardCenter = positions[id].y + cardHeight(cardById(id), layout) / 2;
  const displayCenter = positions.display.y + DISPLAY[layout].h / 2;
  return cardCenter > displayCenter ? 'top' : 'bottom';
}

/** The display edge a card's wire enters by: the one facing the card. */
export const inputSide = (id: CardId, layout: Layout, positions: Positions): Side =>
  portSide(id, layout, positions) === 'top' ? 'bottom' : 'top';

/** Where a card's port sits, from the card's own corner: the middle of the edge it is on. */
export function portOffset(card: CardDef, layout: Layout, side: Side): Point {
  const w = card.width[layout];
  const h = cardHeight(card, layout);
  if (side === 'left' || side === 'right') return { x: side === 'left' ? 0 : w, y: h / 2 };
  return { x: w / 2, y: side === 'top' ? 0 : h };
}

/**
 * The display at the top centre and the themes in one row beneath it, the `active` one in the slot
 * straight under the display, the rest a slot apart to either side.
 */
export function initialPositions(layout: Layout, active: CardId = DEFAULT_ACTIVE): Record<NodeId, Point> {
  const centre = DESIGN[layout].w / 2;
  const row = { display: { x: centre - DISPLAY[layout].w / 2, y: 0 } } as Record<NodeId, Point>;
  for (const id of ROW) {
    row[id] = {
      x: centre + slotOffset(id, active) * SLOT_STEP[layout] - cardById(id).width[layout] / 2,
      y: DISPLAY[layout].h + ROW_GAP_Y[layout]
    };
  }
  return row;
}

const tallest = (layout: Layout) => Math.max(...CARDS.map((card) => cardHeight(card, layout)));

/**
 * The box the nodes are laid out in, scaled to fit the window. Desktop has room for the connected
 * card and a neighbour each side; a phone's is as wide as its display, and the neighbours run off it.
 */
export const DESIGN: Record<Layout, { w: number; h: number }> = {
  desktop: { w: SLOT_W + 2 * SLOT_STEP.desktop, h: DISPLAY.desktop.h + ROW_GAP_Y.desktop + tallest('desktop') },
  mobile: { w: DISPLAY.mobile.w, h: DISPLAY.mobile.h + ROW_GAP_Y.mobile + tallest('mobile') }
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
