/**
 * What OpenAI published, and nothing else. Every number the block presents as OpenAI's comes from
 * this file; everything the simulation computes is illustrative and labelled that way.
 *
 * Source: Bohan Zhang, "Scaling PostgreSQL to power 800 million ChatGPT users", OpenAI, 22 January 2026.
 */

export const SOURCE = {
  title: 'Scaling PostgreSQL to power 800 million ChatGPT users',
  author: 'Bohan Zhang',
  publisher: 'OpenAI',
  date: '22 January 2026',
  url: 'https://openai.com/index/scaling-postgresql/'
};

/** The numbers, as published. */
export const PUBLISHED = {
  users: '800 million',
  loadGrowth: 'more than 10x in a year',
  qps: 'millions of queries per second',
  primaries: 1,
  replicas: 'nearly 50',
  replicaCount: 50,
  connectionLimit: 5_000,
  connectBefore: 50,
  connectAfter: 5,
  joinTables: 12,
  schemaTimeout: 5,
  p99: 'low double-digit ms',
  availability: 'five nines',
  sevZero: 1,
  imageGenWrites: 'more than 10x',
  imageGenSignups: 'over 100 million in a week',
  cascadingReplicas: 'potentially over a hundred'
};

export type Fact = {
  /** The section of the post it comes from. */
  section: string;
  text: string;
};

/** The post, section by section, in its own order. The sources drawer lists these. */
export const FACTS: Fact[] = [
  {
    section: 'Introduction',
    text: 'One primary Azure PostgreSQL flexible server and nearly 50 read replicas spread over multiple regions serve millions of queries per second for 800 million users. PostgreSQL load grew more than 10x in the past year.'
  },
  {
    section: 'Cracks in our initial design',
    text: 'After ChatGPT launched, the team scaled up (bigger instances) and out (more read replicas). Overload SEVs followed one pattern: an upstream issue spikes load (cache misses from a caching-layer failure, a surge of expensive multi-way joins, a write storm from a launch), latency climbs, requests time out, and retries amplify the load.'
  },
  {
    section: 'Cracks in our initial design',
    text: 'MVCC copies the whole row on every update: write amplification, read amplification through dead tuples, table and index bloat, index maintenance overhead and hard autovacuum tuning.'
  },
  {
    section: 'Scaling PostgreSQL to millions of QPS',
    text: 'Shardable, write-heavy workloads moved to sharded systems such as Azure Cosmos DB. No new tables may be added to PostgreSQL; new workloads default to the sharded systems. PostgreSQL itself stays unsharded with a single writer, because sharding would touch hundreds of endpoints.'
  },
  {
    section: 'Reducing load on the primary',
    text: 'Reads go to replicas wherever possible; reads inside write transactions stay on the primary and are kept efficient. Redundant writes were fixed, lazy writes smooth spikes, and backfills are strictly rate-limited.'
  },
  {
    section: 'Query optimization',
    text: 'A query joining 12 tables caused past high-severity SEVs. Avoid multi-table joins, move join logic to the application, review the SQL the ORM generates, and set idle_in_transaction_session_timeout so idle transactions cannot block autovacuum.'
  },
  {
    section: 'Single point of failure mitigation',
    text: 'Most critical requests only read, and those reads are served from replicas, so a primary failure fails writes but is no longer a SEV0. The primary runs in HA mode with a hot standby that can be promoted quickly. Each region has several replicas with headroom.'
  },
  {
    section: 'Workload isolation',
    text: 'Requests are split into low- and high-priority tiers on separate instances, so a noisy low-priority workload cannot slow high-priority requests. Products and services are isolated the same way.'
  },
  {
    section: 'Connection pooling',
    text: 'Each instance allows 5,000 connections, and connection storms have exhausted them. PgBouncer in statement or transaction mode pools them: in benchmarks, average connection time fell from 50 ms to 5 ms. Idle timeouts prevent exhaustion. Each read replica has its own Kubernetes deployment of PgBouncer pods, several deployments sit behind one Kubernetes Service, and proxy, clients and replicas share a region.'
  },
  {
    section: 'Caching',
    text: 'A caching layer serves most reads. When many requests miss the same key, cache locking and leasing let one of them fetch from PostgreSQL and refill the cache while the others wait.'
  },
  {
    section: 'Scaling read replicas',
    text: 'The primary streams WAL to every replica, so each one adds network and CPU load on the primary and makes lag higher and less stable. Cascading replication, where intermediate replicas relay WAL, is in testing with Azure: potentially over a hundred replicas, at the cost of harder failover.'
  },
  {
    section: 'Rate limit',
    text: 'Rate limits at the application, connection pooler, proxy and query layers; no overly short retry intervals; and an ORM that can rate-limit or fully block a query digest to shed load.'
  },
  {
    section: 'Schema Management',
    text: 'Only lightweight schema changes that do not rewrite the table, a 5-second timeout on every change, indexes created and dropped concurrently, changes to existing tables only, and rate-limited backfills even when they take over a week.'
  },
  {
    section: 'Results and the road ahead',
    text: 'Replication lag near zero, low double-digit millisecond p99 client-side latency and five-nines availability. One SEV-0 in twelve months, at the ChatGPT ImageGen launch, when writes rose more than 10x as over 100 million people signed up in a week. Next: move the remaining write-heavy workloads, cascading replication, and possibly sharded PostgreSQL.'
  }
];
