/**
 * The truth behind the figure: who can be fetched, what each hop costs in real milliseconds, and
 * the plan a `GET /users/:id` follows for each outcome (cache hit, cache miss, expired token,
 * unknown user). Every moving part, the readout and the client's screen read from `sceneAt`.
 *
 * Latencies are typical for an app in one region with a warm keep-alive connection: the network
 * between the browser and the region dominates, and the database is a few milliseconds.
 */

export interface Profile {
  id: number;
  name: string;
  /** Social handle, shown as @handle. */
  handle: string;
  /** GitHub username, when the user has one. */
  github?: string;
  role: string;
  repos: number;
  followers: number;
}

export const PROFILES: Profile[] = [
  // Repos and followers are MA-Ahmad's public GitHub counts.
  { id: 42, name: 'Muhammad Ahmad', handle: 'muhammad_ahmaad', github: 'MA-Ahmad', role: 'Senior Software Engineer', repos: 77, followers: 241 },
  { id: 108, name: 'Grace Hopper', handle: 'grace', role: 'Compiler lead', repos: 31, followers: 5210 }
];

/** An id with no row, so the database answers 404. */
export const MISSING_ID = 77;

export const profileOf = (id: number) => PROFILES.find((profile) => profile.id === id) ?? null;

/** The cabinet files rows by id: drawer 0 holds 1–99, drawer 1 100–199, drawer 2 200–299. */
export const drawerOf = (id: number) => Math.min(2, Math.max(0, Math.floor(id / 100)));

/** The cache's pockets, one per profile, in the order of PROFILES. */
export const pocketOf = (id: number) => PROFILES.findIndex((profile) => profile.id === id);

// Real costs, in ms.
export const NETWORK = 18; // one way, browser to the region, on a reused TLS connection
export const AUTH = 0.4; // verify the JWT's signature and expiry at the gateway
export const HOP = 0.2; // one hop inside the data centre
export const ROUTER = 0.3; // match the route and run the handler's setup
export const CACHE_GET = 0.6; // Redis GET, round trip
export const QUERY = 2.8; // Postgres lookup by primary key, round trip
export const CACHE_SET = 0.5; // Redis SET with a 60 s TTL
export const SERIALIZE = 0.1; // JSON.stringify the row
export const RENDER = 4; // parse the body and render the card in the browser

export type Outcome = 'hit' | 'miss' | 'expired' | 'missing';
export type Screen = 'idle' | 'loading' | 'profile' | 'unauthorized' | 'notFound';
export type Slip = 'none' | 'out' | 'denied' | 'empty';
export type Reader = 'idle' | 'ok' | 'deny';

/** Where a card can be: a named place, or the shuttle's tray. */
export type Anchor = 'drawer' | 'pocket' | 'shuttle' | 'terminal';

/** Stops along the rail, in world x. */
export const STOP = {
  client: -228,
  gate: -184,
  server: -55,
  cache: 45,
  db: 165
};

export const GATE_X = -150;

interface Channels {
  x: number;
  gate: number;
  drawer: number;
  dial: number;
}

interface Flags {
  label: string;
  screen: Screen;
  slip: Slip;
  reader: Reader;
  busy: boolean;
  pocket: number;
  stored: boolean;
  status: number;
}

export interface Step {
  secs: number;
  ms: number;
  to?: Partial<Channels>;
  set?: Partial<Flags>;
  card?: [Anchor, Anchor];
  hold?: Anchor;
}

export interface Request {
  id: number;
  token: 'valid' | 'expired';
}

export interface Plan {
  request: Request;
  outcome: Outcome;
  steps: Step[];
  secs: number;
  ms: number;
  bytes: number;
}

const bodyOf = (outcome: Outcome, id: number) => {
  if (outcome === 'expired') return { error: 'token_expired' };
  if (outcome === 'missing') return { error: 'not_found', id };
  return profileOf(id);
};

/** The response body's true size in bytes, as the server would send it. */
export const bytesOf = (outcome: Outcome, id: number) => new TextEncoder().encode(JSON.stringify(bodyOf(outcome, id))).length;

export function outcomeOf(request: Request, cached: boolean): Outcome {
  if (request.token === 'expired') return 'expired';
  if (!profileOf(request.id)) return 'missing';
  return cached ? 'hit' : 'miss';
}

const statusOf = (outcome: Outcome) => (outcome === 'expired' ? 401 : outcome === 'missing' ? 404 : 200);

export function planOf(request: Request, cached: boolean): Plan {
  const outcome = outcomeOf(request, cached);
  const pocket = pocketOf(request.id);
  const steps: Step[] = [
    { secs: 0.5, ms: 0, set: { label: 'sending', screen: 'loading', slip: 'out', reader: 'idle', status: 0 } },
    { secs: 1.5, ms: NETWORK, to: { x: STOP.gate }, set: { label: 'on the wire' } },
    { secs: 0.9, ms: AUTH, set: { label: 'checking token', reader: outcome === 'expired' ? 'deny' : 'ok' }, to: outcome === 'expired' ? {} : { gate: 1 } }
  ];

  if (outcome === 'expired') {
    steps.push(
      { secs: 0.4, ms: 0, set: { label: 'rejected', slip: 'denied', status: 401 } },
      { secs: 1.4, ms: NETWORK, to: { x: STOP.client }, set: { label: 'on the wire' } },
      { secs: 0.6, ms: RENDER, set: { label: 'rendering', reader: 'idle' } },
      { secs: 0.1, ms: 0, set: { label: 'done', screen: 'unauthorized', slip: 'none' } }
    );
  } else {
    steps.push(
      { secs: 1.1, ms: HOP, to: { x: STOP.server } , set: { label: 'to the server' } },
      { secs: 0.9, ms: ROUTER, to: { dial: 1, gate: 0 }, set: { label: 'routing', busy: true, reader: 'idle' } },
      { secs: 0.9, ms: HOP, to: { x: STOP.cache }, set: { label: 'to the cache' } },
      { secs: 0.7, ms: CACHE_GET, set: { label: outcome === 'hit' ? 'cache hit' : 'cache miss', pocket } }
    );

    if (outcome === 'hit') {
      steps.push({ secs: 0.9, ms: 0, card: ['pocket', 'shuttle'], set: { label: 'cache hit' } });
    } else {
      steps.push(
        { secs: 1.0, ms: HOP, to: { x: STOP.db }, set: { label: 'to the database', pocket: -1 } },
        { secs: 0.7, ms: QUERY / 2, to: { drawer: 1 }, set: { label: 'querying' } }
      );
      if (outcome === 'miss') steps.push({ secs: 1.0, ms: QUERY / 2, card: ['drawer', 'shuttle'], set: { label: 'row found' } });
      else steps.push({ secs: 0.8, ms: QUERY / 2, set: { label: 'no row', slip: 'empty', status: 404 } });
      steps.push({ secs: 1.0, ms: HOP, to: { x: STOP.cache, drawer: 0 }, set: { label: 'to the cache' } });
      if (outcome === 'miss') steps.push({ secs: 0.6, ms: CACHE_SET, set: { label: 'caching', pocket, stored: true } });
    }

    steps.push(
      { secs: 0.9, ms: HOP, to: { x: STOP.server }, set: { label: 'to the server', pocket: -1 } },
      { secs: 0.6, ms: SERIALIZE, to: { dial: 0 }, set: { label: 'serializing', status: statusOf(outcome) } },
      { secs: 0.5, ms: 0, to: { x: STOP.gate + 72 }, set: { label: 'responding', busy: false } },
      { secs: 0.4, ms: 0, to: { gate: 1 }, set: { label: 'responding' } },
      { secs: 1.4, ms: NETWORK, to: { x: STOP.client }, set: { label: 'on the wire' } },
      outcome === 'missing'
        ? { secs: 0.6, ms: RENDER, to: { gate: 0 }, set: { label: 'rendering' } }
        : { secs: 0.9, ms: RENDER, to: { gate: 0 }, card: ['shuttle', 'terminal'], set: { label: 'rendering' } },
      { secs: 0.1, ms: 0, set: { label: 'done', screen: outcome === 'missing' ? 'notFound' : 'profile', slip: 'none' } }
    );
  }

  // Between transfers a card stays where the last one left it.
  let held: Anchor | undefined;
  for (const step of steps) {
    if (step.card) held = step.card[1];
    else step.hold = held;
  }

  return {
    request,
    outcome,
    steps,
    secs: steps.reduce((sum, step) => sum + step.secs, 0),
    ms: steps.reduce((sum, step) => sum + step.ms, 0),
    bytes: bytesOf(outcome, request.id)
  };
}

export interface Scene extends Channels, Flags {
  clock: number;
  done: boolean;
  /** The card's anchors and progress (0..1) from the first to the second; null when there is none. */
  card: { from: Anchor; to: Anchor; t: number } | null;
}

export const REST_SCENE: Scene = {
  x: STOP.client,
  gate: 0,
  drawer: 0,
  dial: 0,
  label: 'ready',
  screen: 'idle',
  slip: 'none',
  reader: 'idle',
  busy: false,
  pocket: -1,
  stored: false,
  status: 0,
  clock: 0,
  done: true,
  card: null
};

const smooth = (t: number) => {
  const u = Math.min(1, Math.max(0, t));
  return u * u * (3 - 2 * u);
};

/** The whole bench `t` seconds into a plan. Travel is eased; the clock runs linearly within a step. */
export function sceneAt(plan: Plan, t: number): Scene {
  const scene: Scene = { ...REST_SCENE, done: false };
  let start = 0;
  for (const step of plan.steps) {
    const local = t - start;
    if (local < 0) break;
    Object.assign(scene, step.set);
    const u = smooth(local / step.secs);
    const linear = Math.min(1, local / step.secs);
    for (const key of Object.keys(step.to ?? {}) as (keyof Channels)[]) {
      scene[key] = scene[key] + (step.to![key]! - scene[key]) * u;
    }
    scene.clock += step.ms * linear;
    scene.card = step.card ? { from: step.card[0], to: step.card[1], t: u } : step.hold ? { from: step.hold, to: step.hold, t: 1 } : null;
    start += step.secs;
  }
  scene.done = t >= plan.secs;
  return scene;
}

/** Where the drawer for this request is, so the live code knows which drawer to pull. */
export const drawerFor = (plan: Plan) => drawerOf(plan.request.id);

export const ms = (value: number) => `${(Math.round(value * 10) / 10).toFixed(1)} ms`;

export const STATUS_TEXT: Record<number, string> = { 200: '200 OK', 401: '401 Unauthorized', 404: '404 Not Found' };

export function readoutOf(plan: Plan | null, scene: Scene) {
  if (!plan) return 'GET /users/:id · ready';
  const path = `GET /users/${plan.request.id}`;
  if (!scene.done) return `${path} · ${scene.label} · ${ms(scene.clock)}`;
  const tag = plan.outcome === 'hit' ? ' · cache hit' : plan.outcome === 'miss' ? ' · cache miss' : '';
  return `${STATUS_TEXT[statusOf(plan.outcome)]} · ${ms(plan.ms)} · ${plan.bytes} B${tag}`;
}

export const followersText = (count: number) => (count >= 1000 ? `${(Math.round(count / 100) / 10).toFixed(1)}k` : `${count}`);

/** The totals the caption quotes, computed from the same plans the bench plays. */
export const TOTALS = {
  miss: planOf({ id: 42, token: 'valid' }, false).ms,
  hit: planOf({ id: 42, token: 'valid' }, true).ms,
  expired: planOf({ id: 42, token: 'expired' }, false).ms,
  network: NETWORK * 2
};
