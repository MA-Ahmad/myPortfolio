import type { Kind } from './world';

/**
 * Every machine is drawn as layers, bottom to top, each a named part of the real thing. The art
 * wraps each layer in `<g data-layer data-part-name>`, so a machine can be taken apart. Only the
 * parts that mean something in the post are listed (and numbered when taken apart); plinths,
 * posts, decks and lids are not, and stay where they are.
 */

export type Part = {
  key: string;
  name: string;
  note: string;
  /** Where the part goes when the machine is taken apart, in world units: x right, y toward the
   * viewer, z up. Parts on a face slide out from it; parts on top lift off. */
  apart?: [number, number, number];
  /** Moves aside to show the parts, but is not one of them: no number, not in the card. */
  unlisted?: true;
};

export const PARTS: Record<Kind, Part[]> = {
  apps: [
    { key: 'pods', name: 'App servers', note: 'ChatGPT and the API: the database’s clients.' },
    { key: 'ports', name: 'Connection ports', note: 'Where connections leave: one per query in the initial design, a few pooled ones today.' }
  ],
  gate: [
    { key: 'arm', name: 'Barrier arm', note: 'Drops to shed traffic above a ceiling: the application layer of the four rate limits.', apart: [0, 0, 10] },
    { key: 'beam', name: 'Lamp', note: 'Red while it is shedding.', apart: [0, 0, 20] }
  ],
  cache: [
    { key: 'body', name: 'Memory', note: 'The caching layer that serves most reads.' },
    { key: 'plate', name: 'Key plate', note: 'A hit is answered here, without touching PostgreSQL.', apart: [0, 0, 12] },
    { key: 'lock', name: 'Lease lock', note: 'Cache locking and leasing: one request per missed key fetches from PostgreSQL; the others wait for the refill.', apart: [0, 0, 24] }
  ],
  bouncer: [
    { key: 'service', name: 'Kubernetes Service', note: 'Load-balances across every PgBouncer deployment. Its gauge shows server connections in use.' },
    { key: 'deployments', name: 'PgBouncer deployments', note: 'One Kubernetes deployment of several PgBouncer pods per read replica.', apart: [0, 0, 16] },
    { key: 'switch', name: 'Pooling mode', note: 'Statement or transaction pooling, with idle timeouts to prevent connection exhaustion.', apart: [0, 10, 0] }
  ],
  primary: [
    { key: 'cabinet', name: 'PostgreSQL primary', note: 'One Azure PostgreSQL flexible server: the only writer. MVCC copies a whole row on every update, leaving dead tuples for autovacuum.' },
    { key: 'slots', name: 'Connection slots', note: 'An instance allows 5,000 connections; each lamp is a tenth of them.', apart: [0, 14, 0] },
    { key: 'digest', name: 'Query-digest blocklist', note: 'The ORM can rate-limit or fully block a query digest: the query layer of the rate limits.', apart: [0, 22, 0] },
    { key: 'plaque', name: 'Schema rules', note: 'Lightweight changes only, a 5-second timeout, indexes created and dropped concurrently, no new tables, rate-limited backfills, idle_in_transaction_session_timeout.' },
    { key: 'dial', name: 'CPU dial', note: 'Primary CPU: what a single-writer design has to protect.', apart: [0, 0, 12] },
    { key: 'spool', name: 'WAL', note: 'The write-ahead log, streamed to every replica: each replica adds network and CPU load here.', apart: [0, 0, 22] }
  ],
  standby: [
    { key: 'cabinet', name: 'Hot standby', note: 'A continuously synchronised replica, promoted quickly when the primary fails or is down for maintenance.' },
    { key: 'cable', name: 'Sync cable', note: 'Keeps it in step with the primary.' }
  ],
  cosmos: [
    { key: 'modules', name: 'Partitions', note: 'Azure Cosmos DB: shardable, write-heavy workloads, and every new table, since PostgreSQL takes no new ones.' },
    { key: 'frame', name: 'Frame', note: '', apart: [0, 0, 20], unlisted: true }
  ],
  replica: [
    { key: 'cabinet', name: 'Read replica', note: 'Serves reads, including the critical ones moved off the primary, so a primary failure no longer takes them down. Its load bar shows CPU.' },
    { key: 'lid', name: 'Tier stripe', note: 'Solid: high priority. Dashed: low priority, on separate instances.', apart: [0, 0, 10] },
    { key: 'port', name: 'WAL receiver', note: 'Takes the write-ahead log from the primary, or from a relay with cascading replication.', apart: [0, 0, 24] },
    { key: 'dial', name: 'Lag dial', note: 'Replication lag, kept near zero in production.', apart: [0, 0, 19] }
  ],
  depot: [{ key: 'pads', name: 'Charging pads', note: 'Where idle trays wait and charge. Under load, every tray is out.' }]
};

/** The parts a card lists and a take-apart numbers. */
export const listedParts = (kind: Kind) => PARTS[kind].filter((part) => !part.unlisted);
