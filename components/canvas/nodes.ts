import type { Point } from 'lib/canvas/geometry';

export type CardId = 'home' | 'terminal' | 'notebook';
export type NodeId = CardId | 'display';
export type Layout = 'desktop' | 'mobile';
export type Side = 'left' | 'right';

export const CARD_W = 300;
export const CARD_HEADER_H = 44;
/** Below the preview: the same 6px inset it has at the sides, plus the card border. */
export const CARD_BOTTOM = 7;
export const PORT_SIZE = 12;

export const DISPLAY_W = 280;
export const DISPLAY_HEADER_H = 48;
export const DISPLAY_ROW_H = 36;
export const DISPLAY_BODY_PAD = 8;
export const DISPLAY_FOOTER_H = 40;
export const DISPLAY_H = DISPLAY_HEADER_H + DISPLAY_BODY_PAD * 2 + DISPLAY_ROW_H * 3 + DISPLAY_FOOTER_H;
/** The inputs sit halfway down, one on each side, level with every card port. */
export const DISPLAY_INPUT_Y = DISPLAY_H / 2;

export const NEAR_RADIUS = 64;
export const SNAP_RADIUS = 18;

const GAP_X = 120;
const GAP_Y = 32;
const SIDE_W = 340;
const PREVIEW = { home: 207, terminal: 172, notebook: 446 };
const chrome = (preview: number) => CARD_HEADER_H + preview + CARD_BOTTOM;

// Desktop is as tall as the right column; the notebook and the display are centered on it, so
// the notebook port sits level with the display input and its wire runs straight.
const DESKTOP_H = Math.max(chrome(PREVIEW.notebook), chrome(PREVIEW.home) + GAP_Y + chrome(PREVIEW.terminal));
const NOTEBOOK_Y = (DESKTOP_H - chrome(PREVIEW.notebook)) / 2;
const DISPLAY_Y = (DESKTOP_H - DISPLAY_H) / 2;

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
    width: { desktop: SIDE_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW.home, mobile: 168 },
    packets: ['react.png', 'nextjs.png', 'typescript.png', 'claude.svg', 'tailwindcss.svg', 'vercel.svg']
  },
  {
    id: 'terminal',
    title: 'Terminal',
    route: '/themes/terminal',
    href: '/themes/terminal',
    width: { desktop: SIDE_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW.terminal, mobile: 150 },
    packets: ['rails.png', 'nestjs.svg', 'postgresql.png', 'claude.svg', 'ruby.png', 'redis.png']
  },
  {
    id: 'notebook',
    title: 'Notebook',
    route: '/themes/notebook',
    href: '/themes/notebook',
    width: { desktop: CARD_W, mobile: CARD_W },
    previewHeight: { desktop: PREVIEW.notebook, mobile: 240 },
    packets: ['claude.svg', 'react.png', 'nextjs.png', 'rails.png', 'typescript.png', 'cursor.svg']
  }
];

export const cardById = (id: CardId) => CARDS.find((card) => card.id === id)!;

export const cardHeight = (card: CardDef, layout: Layout) => chrome(card.previewHeight[layout]);

export const nodeSize = (id: NodeId, layout: Layout) => {
  if (id === 'display') return { w: DISPLAY_W, h: DISPLAY_H };
  const card = cardById(id);
  return { w: card.width[layout], h: cardHeight(card, layout) };
};

/**
 * The card edge the port is on. On desktop it faces the display, whichever side of it the card
 * has been moved to, so every card can plug in from either side. The phone stack is a single
 * column left of the display's input, so its ports stay on the right.
 */
export function portSide(id: CardId, layout: Layout, positions: Positions): Side {
  if (layout !== 'desktop') return 'right';
  const card = cardById(id);
  const cardCenter = positions[id].x + card.width.desktop / 2;
  const displayCenter = positions.display.x + DISPLAY_W / 2;
  return cardCenter < displayCenter ? 'right' : 'left';
}

/**
 * A desktop card's port faces the display, so it plugs into the display input on the opposite
 * side. On a phone the display is above the stack and every wire runs up its right edge.
 */
export const inputSide = (id: CardId, layout: Layout, positions: Positions): Side =>
  layout !== 'desktop' ? 'right' : portSide(id, layout, positions) === 'left' ? 'right' : 'left';

/** Every port sits halfway down its card's edge. */
export const portY = (card: CardDef, layout: Layout) => cardHeight(card, layout) / 2;

/**
 * Desktop puts the display in the middle: the tall notebook on its left, home above terminal on
 * its right, each port facing the display. Mobile stacks everything in one column.
 */
export function initialPositions(layout: Layout): Record<NodeId, Point> {
  if (layout === 'desktop') {
    const right = CARD_W + GAP_X * 2 + DISPLAY_W;
    return {
      notebook: { x: 0, y: NOTEBOOK_Y },
      display: { x: CARD_W + GAP_X, y: DISPLAY_Y },
      home: { x: right, y: 0 },
      terminal: { x: right, y: chrome(PREVIEW.home) + GAP_Y }
    };
  }
  // The display leads the stack, so it is on screen whenever the page opens; the cards sit
  // under it and wire up the right side.
  const stack = {} as Record<NodeId, Point>;
  stack.display = { x: MOBILE_GUTTER + (CARD_W - DISPLAY_W) / 2, y: 0 };
  let y = DISPLAY_H + MOBILE_GAP_DISPLAY;
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
  desktop: { w: CARD_W + GAP_X * 2 + DISPLAY_W + SIDE_W, h: DESKTOP_H },
  mobile: {
    w: CARD_W + MOBILE_GUTTER * 2,
    h: DISPLAY_H + MOBILE_GAP_DISPLAY + CARDS.reduce((sum, card) => sum + cardHeight(card, 'mobile') + 24, 0)
  }
};

export function outputPort(id: CardId, positions: Positions, layout: Layout): Point {
  const card = cardById(id);
  const at = positions[id];
  const x = portSide(id, layout, positions) === 'left' ? at.x : at.x + card.width[layout];
  return { x, y: at.y + portY(card, layout) };
}

export const inputPort = (at: Point, side: Side): Point => ({
  x: side === 'left' ? at.x : at.x + DISPLAY_W,
  y: at.y + DISPLAY_INPUT_Y
});

/** Which way a wire leaves a port: rightward from a right edge, leftward from a left one. */
export const direction = (side: Side) => (side === 'left' ? -1 : 1);
