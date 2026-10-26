/**
 * The incidents and changes the post describes, each as a load shape over time. Both benches run
 * the same scenario on one clock; only their designs differ. Times are in seconds of the bench's
 * clock, which runs in real time.
 */

/** What the world throws at the database in one instant. 1 is a normal day. */
export type Load = {
  /** Read traffic, as a multiple of normal. */
  read: number;
  /** Write traffic, as a multiple of normal. */
  write: number;
  /** Share of reads the cache misses. About 10% on a normal day. */
  miss: number;
  /** Expensive multi-way join queries, as a multiple of a normal trickle. */
  join: number;
  /** New connections opened at once, as a share of the 5,000 limit. */
  connect: number;
  /** Clients retry on a short fixed interval instead of backing off. */
  retryFast: number;
  /** A new feature's inefficient low-priority queries. */
  noisy: number;
  /** The primary is down: 1. */
  primaryDown: number;
  /** One read replica is down: 1. */
  replicaDown: number;
  /** An ALTER COLUMN TYPE that would rewrite a whole table is running: 1. */
  alter: number;
  /** A table backfill is running: 1. */
  backfill: number;
  /** Extra latency from a small upstream slowdown, in ms. */
  slow: number;
  /** Share of the extra writes that come from a new workload rather than existing tables. */
  fresh: number;
};

export const CALM: Load = {
  read: 1,
  write: 1,
  miss: 0.1,
  join: 1,
  connect: 0,
  retryFast: 0,
  noisy: 0,
  primaryDown: 0,
  replicaDown: 0,
  alter: 0,
  backfill: 0,
  slow: 0,
  fresh: 0
};

export type ScenarioKey =
  | 'normal'
  | 'cache'
  | 'join'
  | 'writes'
  | 'imagegen'
  | 'connections'
  | 'retries'
  | 'noisy'
  | 'primary'
  | 'replica'
  | 'schema'
  | 'backfill';

export type Scenario = {
  key: ScenarioKey;
  /** Chip label. */
  label: string;
  /** The keyboard key that fires it. */
  hotkey: string;
  /** What happens, in one line, for the caption. */
  what: string;
  /** The post's section it comes from. */
  section: string;
  /** Seconds: ramp in, hold, ramp out. After that the bench keeps running at a calm load. */
  ramp: number;
  hold: number;
  release: number;
  /** The load at full strength; anything left out stays calm. */
  peak: Partial<Load>;
  /** What each design is expected to do, for the caption and the announcement. */
  before: string;
  after: string;
};

export const SCENARIOS: Scenario[] = [
  {
    key: 'normal',
    label: 'Normal day',
    hotkey: '1',
    what: 'Read-heavy traffic: the cache answers most reads, and writes are a small share.',
    section: 'Introduction',
    ramp: 0,
    hold: 0,
    release: 0,
    peak: {},
    before: 'Every query opens its own connection, reads inside the app’s critical path still hit the primary, and p99 sits higher.',
    after: 'Reads land on regional replicas through PgBouncer; the primary only takes writes. Low double-digit ms p99.'
  },
  {
    key: 'cache',
    label: 'Cache-layer failure',
    hotkey: '2',
    what: 'The caching layer fails and hit rates drop, so a burst of misses lands on PostgreSQL.',
    section: 'Caching',
    ramp: 1,
    hold: 9,
    release: 2,
    peak: { miss: 0.85 },
    before: 'Every miss goes to the database, CPU saturates, requests time out and their retries pile on.',
    after: 'Cache leasing lets one request per key fetch the row while the others wait for the refill; the queue drains.'
  },
  {
    key: 'join',
    label: '12-table join surge',
    hotkey: '3',
    what: 'A spike of one expensive query that joins 12 tables, the kind behind past high-severity SEVs.',
    section: 'Query optimization',
    ramp: 1,
    hold: 8,
    release: 2,
    peak: { join: 14 },
    before: 'The join burns primary CPU and slows every other query on the instance.',
    after: 'The join is broken up and done in the application, and the ORM can block the query digest outright.'
  },
  {
    key: 'writes',
    label: 'Feature write storm',
    hotkey: '4',
    what: 'A new feature launches and writes surge. MVCC copies whole rows, so bloat builds up.',
    section: 'Reducing load on the primary',
    ramp: 1.5,
    hold: 8,
    release: 2,
    peak: { write: 5, fresh: 1 },
    before: 'Writes, their WAL and dead tuples all land on the one primary; autovacuum falls behind.',
    after: 'Shardable writes go to Azure Cosmos DB and lazy writes smooth the rest.'
  },
  {
    key: 'imagegen',
    label: 'ImageGen launch',
    hotkey: '5',
    what: 'ChatGPT ImageGen goes viral: writes rise more than 10x as over 100 million people sign up in a week.',
    section: 'Results and the road ahead',
    ramp: 2,
    hold: 9,
    release: 3,
    peak: { write: 11, read: 2.4, connect: 0.5, fresh: 0.25 },
    before: 'Writes, connections and retries swamp the primary together, and it stays down long after the surge.',
    after: 'Honestly: this was the one SEV-0 in twelve months. The primary strains, then recovers once the surge passes.'
  },
  {
    key: 'connections',
    label: 'Connection storm',
    hotkey: '6',
    what: 'Thousands of clients connect at once. Each instance allows 5,000 connections.',
    section: 'Connection pooling',
    ramp: 0.6,
    hold: 8,
    release: 1.5,
    peak: { connect: 1.4 },
    before: 'All 5,000 slots fill and new connections are refused.',
    after: 'PgBouncer pools them: few server connections, and connecting takes 5 ms instead of 50.'
  },
  {
    key: 'retries',
    label: 'Retry storm',
    hotkey: '7',
    what: 'A small slowdown, and clients that retry on a short fixed interval.',
    section: 'Rate limit',
    ramp: 1,
    hold: 9,
    release: 2,
    peak: { retryFast: 1, read: 1.5, miss: 0.3, slow: 250 },
    before: 'Each timeout comes back as more load: the vicious cycle the post describes.',
    after: 'Backoff and rate limits at the application, pooler, proxy and query layers cap it.'
  },
  {
    key: 'noisy',
    label: 'Noisy neighbor',
    hotkey: '8',
    what: 'A new feature ships inefficient low-priority queries.',
    section: 'Workload isolation',
    ramp: 1,
    hold: 9,
    release: 2,
    peak: { noisy: 1 },
    before: 'They share every instance with critical traffic, so everything slows down.',
    after: 'Low-priority traffic has its own instances: they run hot, and high-priority requests never notice.'
  },
  {
    key: 'primary',
    label: 'Primary down',
    hotkey: '9',
    what: 'The single writer fails.',
    section: 'Single point of failure mitigation',
    ramp: 0,
    hold: 9,
    release: 0,
    peak: { primaryDown: 1 },
    before: 'Critical reads still go through the primary: a full outage, SEV0.',
    after: 'Reads keep serving from replicas, writes fail briefly, and the hot standby is promoted. Not a SEV0.'
  },
  {
    key: 'replica',
    label: 'Replica down',
    hotkey: '0',
    what: 'One read replica fails.',
    section: 'Single point of failure mitigation',
    ramp: 0,
    hold: 9,
    release: 0,
    peak: { replicaDown: 1 },
    before: 'The other replicas in the only region take its load and run hot.',
    after: 'Several replicas per region with headroom: traffic reroutes and nobody notices.'
  },
  {
    key: 'schema',
    label: 'ALTER COLUMN TYPE',
    hotkey: '[',
    what: 'A schema change that rewrites the whole table.',
    section: 'Schema Management',
    ramp: 0,
    hold: 10,
    release: 0,
    peak: { alter: 1 },
    before: 'The rewrite locks the table for as long as it takes, and every query on it waits.',
    after: 'The 5-second schema timeout cancels it; only lightweight changes are allowed.'
  },
  {
    key: 'backfill',
    label: 'Backfill',
    hotkey: ']',
    what: 'Filling a new field on every row of a large table.',
    section: 'Schema Management',
    ramp: 0.5,
    hold: 10,
    release: 1,
    peak: { backfill: 1 },
    before: 'The backfill writes as fast as it can, and the primary feels it.',
    after: 'Strictly rate-limited: a trickle that can take over a week, with no production impact.'
  }
];

export const scenarioOf = (key: ScenarioKey) => SCENARIOS.find((scenario) => scenario.key === key) ?? SCENARIOS[0];

/** How long a scenario takes to play out before the bench is back to calm. */
export const lengthOf = (scenario: Scenario) => scenario.ramp + scenario.hold + scenario.release;

/** The share of the scenario's peak at time `t`, eased in and out. */
export function strengthAt(scenario: Scenario, t: number) {
  const ease = (x: number) => x * x * (3 - 2 * x);
  const { ramp, hold, release } = scenario;
  if (t < 0) return 0;
  if (t < ramp) return ease(t / ramp);
  if (t < ramp + hold) return 1;
  if (release > 0 && t < ramp + hold + release) return 1 - ease((t - ramp - hold) / release);
  return 0;
}

/** The world's load `t` seconds into a scenario. */
export function loadAt(scenario: Scenario, t: number): Load {
  const strength = strengthAt(scenario, t);
  const load = { ...CALM };
  for (const key of Object.keys(scenario.peak) as (keyof Load)[]) {
    const peak = scenario.peak[key]!;
    load[key] = CALM[key] + (peak - CALM[key]) * strength;
  }
  return load;
}
