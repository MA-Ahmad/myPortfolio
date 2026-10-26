import { PUBLISHED } from './facts';
import type { Load } from './scenarios';

/**
 * A small load model of each design, stepped every frame. It is illustrative: the units are made
 * up and tuned so each mechanism the post describes has the effect the post says it has. Only the
 * numbers in facts.ts are OpenAI's.
 */

export type SideKey = 'before' | 'after';

export type Design = {
  /** One request per missed key fetches from the database; the rest wait for the refill. */
  lease: boolean;
  /** PgBouncer between the apps and every instance. */
  pooled: boolean;
  /** Share of database reads that land on the primary. */
  primaryReads: number;
  /** Share of writes moved to sharded systems (Azure Cosmos DB). */
  sharded: number;
  /** Share of a new workload's writes that land in the sharded systems: new tables may not go in PostgreSQL. */
  newWorkloads: number;
  /** Lazy writes smooth spikes over this many seconds; 0 writes straight through. */
  lazy: number;
  /** Low- and high-priority traffic on separate instances. */
  tiers: boolean;
  /** Rate limits at the application, pooler, proxy and query layers. */
  limits: boolean;
  /** Clients back off instead of retrying on a short interval. */
  backoff: boolean;
  /** The ORM can block a query digest, and joins are done in the application. */
  digest: boolean;
  /** A hot standby that can be promoted. */
  standby: boolean;
  /** Schema changes time out after 5 s. */
  schemaTimeout: boolean;
  /** Backfills are rate-limited. */
  slowBackfill: boolean;
  /** idle_in_transaction_session_timeout keeps idle transactions from blocking autovacuum. */
  idleTimeout: boolean;
  /** Replicas in the only region (before) or across regions (after). */
  replicas: number;
  /** Regions the replicas are spread over. */
  regions: number;
};

export const DESIGNS: Record<SideKey, Design> = {
  before: {
    lease: false,
    pooled: false,
    primaryReads: 0.45,
    sharded: 0,
    newWorkloads: 0,
    lazy: 0,
    tiers: false,
    limits: false,
    backoff: false,
    digest: false,
    standby: false,
    schemaTimeout: false,
    slowBackfill: false,
    idleTimeout: false,
    replicas: 3,
    regions: 1
  },
  after: {
    lease: true,
    pooled: true,
    primaryReads: 0.04,
    sharded: 0.6,
    newWorkloads: 0.92,
    lazy: 1.6,
    tiers: true,
    limits: true,
    backoff: true,
    digest: true,
    standby: true,
    schemaTimeout: true,
    slowBackfill: true,
    idleTimeout: true,
    replicas: PUBLISHED.replicaCount,
    regions: 3
  }
};

/** Settings the visitor can change on the after bench. */
export type Knobs = {
  replicas: number;
  cascading: boolean;
};

export type Status = 'ok' | 'degraded' | 'sev' | 'sev0';

export type Reading = {
  /** Queries per second the system answers, in thousands (illustrative). */
  qps: number;
  /** p99 latency in ms. */
  p99: number;
  /** Share of requests that fail. */
  errors: number;
  /** Share of requests turned away on purpose by a rate limit or a blocked digest. */
  shed: number;
  /** Primary CPU, 0–1 and above when saturated. */
  cpu: number;
  /** Replica CPU, high-priority tier (or every replica before). */
  replicaCpu: number;
  /** Low-priority tier CPU (after only). */
  lowCpu: number;
  /** Server connections held on the primary, out of 5,000. */
  connections: number;
  /** Replica lag in ms. */
  lag: number;
  /** The primary's WAL shipping load, 0–1. */
  wal: number;
  /** Dead tuples, 0 clean to 1 badly bloated. */
  bloat: number;
  /** Requests waiting on a cache lease. */
  leaseQueue: number;
  /** Write share sent to Cosmos DB, in thousands of QPS. */
  cosmos: number;
  /** A schema change holding a lock, in seconds held. */
  lockHeld: number;
  /** The primary is serving. */
  primaryUp: boolean;
  /** The standby is being promoted, 0–1. */
  promoting: number;
  status: Status;
};

export type SimState = Reading & {
  /** Failed requests last step, which come back as retries. */
  failing: number;
  lazyWrites: number;
  downFor: number;
  promoted: boolean;
  /** Seconds since a replica failed. */
  lostFor: number;
  /** p99 and error history for the sparkline, one sample every SAMPLE seconds. */
  history: { p99: number[]; errors: number[] };
  sampleIn: number;
  time: number;
};

export const SAMPLE = 0.25;
export const HISTORY = 120;

/** Normal-day traffic, in thousands of queries per second (illustrative). */
const READS = 120;
const WRITES = 8;
/** Capacity of the primary and of one replica, in the same cost units. */
const PRIMARY_CAPACITY = 100;
const REPLICA_CAPACITY = 34;
/** A write costs this much more than a read: MVCC copies the whole row. */
const WRITE_COST = 3;
/** Shipping one write's WAL to one replica. */
const WAL_COST = 0.038;
/** WAL a primary can ship before replica lag climbs. */
const WAL_CAPACITY = 20;
/** A 12-table join costs as much as this many simple reads. */
const JOIN_COST = 12;
/** Seconds to promote the hot standby (illustrative: the post says only that it is quick). */
export const STANDBY_PROMOTION = 6;

export function initialState(): SimState {
  return {
    qps: 0,
    p99: 0,
    errors: 0,
    shed: 0,
    cpu: 0,
    replicaCpu: 0,
    lowCpu: 0,
    connections: 0,
    lag: 0,
    wal: 0,
    bloat: 0.08,
    leaseQueue: 0,
    cosmos: 0,
    lockHeld: 0,
    primaryUp: true,
    promoting: 0,
    status: 'ok',
    failing: 0,
    lazyWrites: WRITES,
    downFor: 0,
    promoted: false,
    lostFor: 0,
    history: { p99: [], errors: [] },
    sampleIn: 0,
    time: 0
  };
}

const clamp = (value: number, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const ease = (current: number, target: number, dt: number, seconds: number) =>
  current + (target - current) * (1 - Math.exp(-dt / seconds));

/** A smooth, repeatable wobble for replica lag, which the post calls unstable under WAL pressure. */
const wobble = (t: number) => 0.5 + 0.25 * Math.sin(t * 2.3) + 0.25 * Math.sin(t * 5.9 + 1.7);

export function statusOf(errors: number, p99: number): Status {
  if (errors > 0.4) return 'sev0';
  if (errors > 0.05) return 'sev';
  if (errors > 0.004 || p99 > 140) return 'degraded';
  return 'ok';
}

/** One step of the model. Mutates and returns `state`. */
export function step(state: SimState, design: Design, load: Load, knobs: Knobs, dt: number): SimState {
  state.time += dt;
  const replicas = Math.max(1, design.regions > 1 ? knobs.replicas : design.replicas);

  // Demand, with last step's failures coming back as retries: the vicious cycle.
  const retryGain = design.backoff ? 0.12 : 0.55 + 5 * load.retryFast;
  const retries = Math.min(state.failing * retryGain, 2.2);
  let reads = READS * load.read * (1 + retries);
  let writes = WRITES * load.write * (1 + retries * 0.5);

  // Rate limits at the application, pooler and proxy layers shed low-priority traffic above a ceiling.
  let shed = 0;
  if (design.limits) {
    const ceiling = READS * 2.2;
    if (reads > ceiling) {
      shed += (reads - ceiling) / reads;
      reads = ceiling;
    }
  }

  // The cache. A storm of misses is mostly the same hot keys; a lease sends one request per key on.
  const misses = reads * load.miss;
  const hot = clamp((load.miss - 0.1) / 0.75);
  const dbReads = design.lease ? misses * (1 - hot) + misses * hot * 0.06 : misses;
  state.leaseQueue = ease(state.leaseQueue, design.lease ? misses * hot * 0.94 : 0, dt, 0.4);

  // Writes: shardable ones move to the sharded system, as do a new workload's, and lazy writes
  // smooth the rest.
  const calmWrites = WRITES * (1 + retries * 0.5);
  const surge = Math.max(0, writes - calmWrites);
  const sharded =
    (writes - surge) * design.sharded + surge * (load.fresh * design.newWorkloads + (1 - load.fresh) * design.sharded);
  let pgWrites = writes - sharded;
  pgWrites += WRITES * load.backfill * (design.slowBackfill ? 0.25 : 6);
  if (design.lazy > 0) {
    state.lazyWrites = ease(state.lazyWrites, pgWrites, dt, design.lazy);
    pgWrites = Math.min(pgWrites, state.lazyWrites);
  } else state.lazyWrites = pgWrites;
  state.cosmos = sharded;

  // MVCC: every write leaves a dead tuple; autovacuum clears them unless idle transactions block it.
  const vacuum = design.idleTimeout ? 0.09 : 0.035;
  state.bloat = clamp(state.bloat + (pgWrites / (WRITES * 40)) * dt - vacuum * state.bloat * dt * 3, 0.02, 1);
  const writeCost = WRITE_COST * (1 + state.bloat * 1.4);
  const readCost = 1 + state.bloat * 0.6;

  // The 12-table join. After: done in the application as simple reads, and its digest blocked under load.
  let joinCost = (load.join - 1) * 0.8 * JOIN_COST;
  if (design.digest) {
    const blocked = state.cpu > 0.6 ? 0.8 : 0;
    shed += ((load.join - 1) * 0.8 * blocked) / Math.max(reads, 1);
    joinCost = (load.join - 1) * 0.8 * 1.4 * (1 - blocked);
  }

  // WAL to every replica, or through intermediate replicas with cascading replication.
  const fanout = design.regions > 1 && knobs.cascading ? Math.min(replicas, 6) : replicas;
  const walLoad = pgWrites * fanout * WAL_COST;
  state.wal = ease(state.wal, walLoad / WAL_CAPACITY, dt, 0.5);

  // A schema change that rewrites a table holds its lock until done, or for 5 s with the timeout.
  if (load.alter > 0.5) state.lockHeld += dt;
  else state.lockHeld = 0;
  const locked = load.alter > 0.5 && (!design.schemaTimeout || state.lockHeld < 5);

  // The primary going down, and the standby taking over.
  const down = load.primaryDown > 0.5;
  if (down) state.downFor += dt;
  else {
    state.downFor = 0;
    state.promoted = false;
  }
  if (down && design.standby && state.downFor >= STANDBY_PROMOTION) state.promoted = true;
  state.promoting = down && design.standby && !state.promoted ? clamp(state.downFor / STANDBY_PROMOTION) : 0;
  state.primaryUp = !down || state.promoted;

  const noisyCost = load.noisy * 160;
  const primaryReads = dbReads * design.primaryReads;
  const replicaReads = dbReads - primaryReads;
  const primaryDemand =
    primaryReads * readCost +
    pgWrites * writeCost +
    walLoad +
    (design.digest ? 0 : joinCost) +
    (design.tiers ? 0 : noisyCost * 0.45);
  const cpu = primaryDemand / PRIMARY_CAPACITY;

  // Replicas: before, three in one region share everything; after, high and low tiers are apart.
  const lost = load.replicaDown > 0.5 ? 1 : 0;
  state.lostFor = lost ? state.lostFor + dt : 0;
  // Without a pooler's health checks, the failed replica's clients error until they reconnect elsewhere.
  const stranded = lost && !design.pooled ? (0.5 / replicas) * Math.exp(-state.lostFor / 2.5) : 0;
  const serving = design.tiers ? Math.max(1, replicas * 0.7 - lost * 0.15) : Math.max(1, replicas - lost);
  const replicaDemand = replicaReads * readCost + (design.digest ? joinCost : 0) + (design.tiers ? 0 : noisyCost * 0.55);
  const replicaCpu = replicaDemand / (serving * REPLICA_CAPACITY) / (design.tiers ? 0.12 : 1);
  const lowCpu = design.tiers ? (replicaReads * 0.15 * readCost + noisyCost) / (Math.max(1, replicas * 0.3) * REPLICA_CAPACITY) / 0.6 : 0;

  // Connections. Direct: every in-flight query holds one, and a storm opens thousands more.
  // Pooled: PgBouncer keeps a small set of server connections and queues clients in front.
  const inFlight = (primaryReads + pgWrites + Math.max(0, load.join - 1) * 2) * (1 + Math.max(0, cpu - 0.6) * 6);
  const wanted = design.pooled
    ? Math.min(PUBLISHED.connectionLimit * 0.4, 420 + inFlight * 6)
    : 900 + inFlight * 38 + load.connect * PUBLISHED.connectionLimit;
  const refused = design.pooled ? 0 : clamp((wanted - PUBLISHED.connectionLimit) / wanted);
  state.connections = ease(state.connections, Math.min(wanted, PUBLISHED.connectionLimit), dt, 0.35);

  // Latency: connecting, then queueing on the busiest instance a request touches.
  const connect = design.pooled ? PUBLISHED.connectAfter : PUBLISHED.connectBefore;
  const busiest = Math.max(down && !state.promoted ? 0 : cpu * (design.primaryReads > 0.1 ? 1 : 0.6), replicaCpu);
  const queueing = 7 / Math.max(0.035, 1 - Math.min(busiest, 0.965));
  const poolWait = design.pooled ? Math.max(0, load.connect - 0.2) * 6 : 0;
  let p99 = connect + 4 * readCost + queueing + poolWait + load.slow;
  if (cpu > 1) p99 += (cpu - 1) * 900;
  if (locked) p99 += design.schemaTimeout ? 160 * (state.lockHeld / 5) : 2_400;
  if (design.limits) p99 = Math.min(p99, 2_000);

  // Failures.
  const total = reads + writes;
  const timeouts = clamp((p99 - 260) / 900);
  const overload = cpu > 1 ? clamp((cpu - 1) / cpu) : 0;
  let outage = 0;
  if (down && !state.promoted) outage = design.standby ? (writes - sharded) / total : 1;
  const lockedShare = locked && !design.schemaTimeout ? 0.6 : 0;
  const errors = 1 - (1 - timeouts) * (1 - overload * 0.85) * (1 - refused) * (1 - outage) * (1 - lockedShare) * (1 - stranded);

  // Displayed values ease so the dials don't jitter; the cycle reads the raw failure rate.
  state.failing = errors;
  state.cpu = ease(state.cpu, down && !state.promoted ? 0 : cpu, dt, 0.3);
  state.replicaCpu = ease(state.replicaCpu, replicaCpu, dt, 0.3);
  state.lowCpu = ease(state.lowCpu, lowCpu, dt, 0.3);
  state.p99 = ease(state.p99, p99, dt, 0.25);
  state.errors = ease(state.errors, errors, dt, 0.25);
  state.shed = ease(state.shed, clamp(shed), dt, 0.3);
  state.qps = ease(state.qps, total * (1 - errors) * (1 - clamp(shed)), dt, 0.3);
  const pressure = Math.max(0, state.wal - 0.55);
  state.lag = Math.min(2_000, state.lag);
  state.lag = ease(state.lag, design.tiers || replicas > 3 ? 0.4 + pressure * 900 * (0.6 + 0.8 * wobble(state.time)) : 0.4 + pressure * 900, dt, 0.4);
  state.status = statusOf(state.errors, state.p99);

  state.sampleIn -= dt;
  if (state.sampleIn <= 0) {
    state.sampleIn += SAMPLE;
    state.history.p99.push(state.p99);
    state.history.errors.push(state.errors);
    if (state.history.p99.length > HISTORY) {
      state.history.p99.shift();
      state.history.errors.shift();
    }
  }
  return state;
}

/** Runs the model from cold to its steady state on a calm day, so the dials start settled. */
export function settled(design: Design, knobs: Knobs, calm: Load): SimState {
  const state = initialState();
  for (let index = 0; index < 600; index++) step(state, design, calm, knobs, 1 / 30);
  state.history = { p99: [], errors: [] };
  return state;
}

export const STATUS_TEXT: Record<Status, string> = {
  ok: 'Healthy',
  degraded: 'Degraded',
  sev: 'SEV',
  sev0: 'SEV0'
};
