/**
 * The Theme Studio presence protocol, shared by the page and the room worker in
 * `workers/presence`. Kept free of path aliases and app imports so the worker can bundle it.
 */

type Point = { x: number; y: number };

/** A wire as its owner draws it, in world coordinates, so others can draw its ghost. */
export type SharedWire = {
  source: string;
  from: Point;
  fromDir: number;
  to: Point;
  toDir: number;
  lit: boolean;
  reachCap: number | null;
};

export type Presence = {
  name: string;
  color: string;
  // The two layouts place nodes differently, so only visitors on the same one are drawn.
  layout: 'desktop' | 'mobile' | null;
  cursor: Point | null;
  wire: SharedWire | null;
};

export type ClientMessage = { t: 'update'; p: Partial<Presence> };

export type ServerMessage =
  | { t: 'welcome'; peers: { id: number; p: Presence }[] }
  | { t: 'update'; id: number; p: Presence }
  | { t: 'leave'; id: number };

/** The page sends at most this often; the room's limits leave headroom above it. */
export const SEND_INTERVAL_MS = 50;

/** Close codes the room uses, so the page knows how long to wait before trying again. */
export const CLOSE = {
  /** The room or this visitor's address is at its connection limit. */
  full: 1013,
  /** Too many messages: this address is banned for a while. */
  abuse: 1008,
  /** The room's hourly message budget is spent; it reopens on the next hour. */
  resting: 4000,
  /** The room heard nothing from this connection for too long; the page just reconnects. */
  stale: 4001
} as const;

export const ADJECTIVES = ['Amber', 'Brisk', 'Calm', 'Dusky', 'Jade', 'Lucky', 'Misty', 'Neon', 'Quiet', 'Teal'];
export const ANIMALS = ['Fox', 'Heron', 'Lynx', 'Otter', 'Owl', 'Panda', 'Raven', 'Seal', 'Tiger', 'Wren'];
// Mid-tone, so a white name label and the arrow both read on the light and dark canvas.
export const COLORS = ['#e5484d', '#f76b15', '#d6a10b', '#30a46c', '#12a594', '#0090ff', '#6e56cf', '#d6409f'];

/** Well past either layout's world, so a sane cursor or wire always fits. */
const WORLD_LIMIT = 5000;

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const isCoordinate = (value: unknown) => typeof value === 'number' && Math.abs(value) <= WORLD_LIMIT;

function point(value: unknown): Point | undefined {
  if (!isRecord(value) || !isCoordinate(value.x) || !isCoordinate(value.y)) return undefined;
  return { x: value.x as number, y: value.y as number };
}

function isName(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  const [adjective, animal, ...rest] = value.split(' ');
  return rest.length === 0 && ADJECTIVES.includes(adjective) && ANIMALS.includes(animal);
}

function wire(value: unknown): SharedWire | undefined {
  if (!isRecord(value)) return undefined;
  const from = point(value.from);
  const to = point(value.to);
  const { source, fromDir, toDir, lit, reachCap } = value;
  // The source names a CSS custom property, so it is held to a plain word.
  if (typeof source !== 'string' || !/^[a-z]{1,16}$/.test(source) || !from || !to) return undefined;
  if ((fromDir !== 1 && fromDir !== -1) || (toDir !== 1 && toDir !== -1) || typeof lit !== 'boolean') return undefined;
  if (reachCap !== null && !isCoordinate(reachCap)) return undefined;
  return { source, from, fromDir, to, toDir, lit, reachCap: reachCap as number | null };
}

/**
 * Keeps only the well-formed fields of an update from the wire. Names and colors must come from
 * the lists above, so nobody can put their own text on another visitor's screen.
 */
export function sanitize(value: unknown): Partial<Presence> {
  if (!isRecord(value)) return {};
  const clean: Partial<Presence> = {};
  if (isName(value.name)) clean.name = value.name;
  if (typeof value.color === 'string' && COLORS.includes(value.color)) clean.color = value.color;
  if (value.layout === 'desktop' || value.layout === 'mobile') clean.layout = value.layout;
  else if (value.layout === null) clean.layout = null;
  if (value.cursor === null) clean.cursor = null;
  else if (point(value.cursor)) clean.cursor = point(value.cursor);
  if (value.wire === null) clean.wire = null;
  else if (wire(value.wire)) clean.wire = wire(value.wire);
  return clean;
}
