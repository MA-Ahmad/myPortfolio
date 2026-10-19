import type { Point } from 'lib/canvas/geometry';

export type CardId = 'home' | 'terminal' | 'notebook';
export type NodeId = CardId | 'display';
export type Layout = 'desktop' | 'mobile';
export type Side = 'left' | 'right';

export const CARD_W = 300;
export const CARD_HEADER_H = 44;
export const CARD_FOOTER_H = 40;
export const PORT_SIZE = 12;

export const DISPLAY_W = 280;
export const DISPLAY_HEADER_H = 48;
export const DISPLAY_ROW_H = 36;
export const DISPLAY_BODY_PAD = 8;
export const DISPLAY_FOOTER_H = 40;
export const DISPLAY_H = DISPLAY_HEADER_H + DISPLAY_BODY_PAD * 2 + DISPLAY_ROW_H * 3 + DISPLAY_FOOTER_H;
/** The inputs sit on the first row, `source`, one on each side. */
export const DISPLAY_INPUT_Y = DISPLAY_HEADER_H + DISPLAY_BODY_PAD + DISPLAY_ROW_H / 2;

export const NEAR_RADIUS = 64;
export const SNAP_RADIUS = 18;

const NOTEBOOK_H = CARD_HEADER_H + 446 + CARD_FOOTER_H;
/** The display is centered on the notebook's height, so the notebook wire runs straight. */
const DISPLAY_Y = (NOTEBOOK_H - DISPLAY_H) / 2;

export type CardDef = {
  id: CardId;
  title: string;
  route: string;
  href: string;
  previewHeight: Record<Layout, number>;
  /** Port height from the card top; defaults to the middle of the footer. */
  portY?: Partial<Record<Layout, number>>;
  /** The card edge the port is on, facing the display; defaults to the right. */
  portSide?: Partial<Record<Layout, Side>>;
};

export const CARDS: CardDef[] = [
  {
    id: 'home',
    title: 'Home',
    route: '/',
    href: '/',
    previewHeight: { desktop: 180, mobile: 168 },
    portSide: { desktop: 'left' }
  },
  {
    id: 'terminal',
    title: 'Terminal',
    route: '/themes/terminal',
    href: '/themes/terminal',
    previewHeight: { desktop: 150, mobile: 150 },
    portY: { desktop: CARD_HEADER_H / 2 },
    portSide: { desktop: 'left' }
  },
  {
    id: 'notebook',
    title: 'Notebook',
    route: '/themes/notebook',
    href: '/themes/notebook',
    previewHeight: { desktop: 446, mobile: 240 },
    portY: { desktop: DISPLAY_Y + DISPLAY_INPUT_Y }
  }
];

export const cardById = (id: CardId) => CARDS.find((card) => card.id === id)!;

export const cardHeight = (card: CardDef, layout: Layout) =>
  CARD_HEADER_H + card.previewHeight[layout] + CARD_FOOTER_H;

export const nodeSize = (id: NodeId, layout: Layout) =>
  id === 'display'
    ? { w: DISPLAY_W, h: DISPLAY_H }
    : { w: CARD_W, h: cardHeight(cardById(id), layout) };

export const portSide = (id: CardId, layout: Layout): Side =>
  cardById(id).portSide?.[layout] ?? 'right';

/** A card's port faces the display, so it plugs into the display input on the opposite side. */
export const inputSide = (id: CardId, layout: Layout): Side =>
  portSide(id, layout) === 'left' ? 'right' : 'left';

export const portY = (card: CardDef, layout: Layout) =>
  card.portY?.[layout] ?? cardHeight(card, layout) - CARD_FOOTER_H / 2;

const GAP_X = 120;
const GAP_Y = 32;

/**
 * Desktop puts the display in the middle: the tall notebook on its left, home above terminal on
 * its right, each port facing the display. Mobile stacks everything in one column.
 */
export function initialPositions(layout: Layout): Record<NodeId, Point> {
  if (layout === 'desktop') {
    const right = CARD_W + GAP_X * 2 + DISPLAY_W;
    return {
      notebook: { x: 0, y: 0 },
      display: { x: CARD_W + GAP_X, y: DISPLAY_Y },
      home: { x: right, y: 0 },
      terminal: { x: right, y: cardHeight(cardById('home'), 'desktop') + GAP_Y }
    };
  }
  let y = 0;
  const stack = {} as Record<NodeId, Point>;
  for (const card of CARDS) {
    stack[card.id] = { x: 0, y };
    y += cardHeight(card, 'mobile') + 24;
  }
  stack.display = { x: (CARD_W - DISPLAY_W) / 2, y: y + 24 };
  return stack;
}

export const DESIGN = {
  desktop: { w: CARD_W * 2 + GAP_X * 2 + DISPLAY_W, h: NOTEBOOK_H },
  mobile: {
    w: CARD_W,
    h: CARDS.reduce((sum, card) => sum + cardHeight(card, 'mobile') + 24, 0) + 24 + DISPLAY_H
  }
};

export function outputPort(id: CardId, at: Point, layout: Layout): Point {
  const card = cardById(id);
  const x = portSide(id, layout) === 'left' ? at.x : at.x + CARD_W;
  return { x, y: at.y + portY(card, layout) };
}

export const inputPort = (at: Point, side: Side): Point => ({
  x: side === 'left' ? at.x : at.x + DISPLAY_W,
  y: at.y + DISPLAY_INPUT_Y
});

/** Which way a wire leaves a port: rightward from a right edge, leftward from a left one. */
export const direction = (side: Side) => (side === 'left' ? -1 : 1);
