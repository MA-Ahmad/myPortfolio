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

/** The post in a few lines, for the info panel: what went wrong and how it was fixed. */
export const SUMMARY = {
  problem:
    'One PostgreSQL primary took every write and many reads. When something upstream spiked the load (a cache failure, a surge of expensive joins, a write storm), queries slowed, requests timed out and retries added even more load, which could degrade all of ChatGPT and the API.',
  fixes: [
    'Reads moved to nearly 50 replicas; the primary keeps the writes.',
    'Shardable, write-heavy work and every new table moved to Azure Cosmos DB.',
    'PgBouncer pools connections: connecting fell from 50 ms to 5 ms on average.',
    'On a cache miss, one request refills the key while the others wait.',
    'A hot standby, rate limits, no expensive joins and only lightweight schema changes protect the primary.'
  ],
  result: 'Millions of queries per second, low double-digit ms p99, five-nines availability, and one SEV-0 in 12 months.'
};
