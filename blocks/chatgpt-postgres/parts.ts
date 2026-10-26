import type { Kind } from './world';

/**
 * Every machine is drawn as layers, bottom to top, each a named part of the real thing. The art
 * wraps each layer in `<g data-layer data-part-name>`, so a machine can be taken apart layer by
 * layer, and the card lists them. Notes say what the part does, after the post.
 */

export type Part = { key: string; name: string; note: string };

export const PARTS: Record<Kind, Part[]> = {
  apps: [
    { key: 'plinth', name: 'Plinth', note: 'Stands the app tier on the floor.' },
    { key: 'frame', name: 'Rack frame', note: 'Back posts that hold the shelves.' },
    { key: 'pods', name: 'App pods', note: 'ChatGPT and the API: the database’s clients. Each lamp is a pod.' },
    { key: 'cap', name: 'Top cap', note: 'Ties the posts together.' },
    { key: 'ports', name: 'Port strip', note: 'Where connections leave: one per query in the initial design, a few pooled ones today.' }
  ],
  gate: [
    { key: 'posts', name: 'Posts', note: 'Straddle the lane, so every tray passes through.' },
    { key: 'arm', name: 'Barrier arm', note: 'Drops to shed traffic above a ceiling: the application layer of the four rate limits.' },
    { key: 'beam', name: 'Beam and lamp', note: 'Red while it is shedding.' }
  ],
  cache: [
    { key: 'body', name: 'Memory body', note: 'The caching layer that serves most reads.' },
    { key: 'plate', name: 'Key plate', note: 'A hit is answered here, without touching PostgreSQL.' },
    { key: 'lock', name: 'Lease lock', note: 'Cache locking and leasing: one request per missed key fetches from PostgreSQL; the others wait for the refill.' }
  ],
  bouncer: [
    { key: 'service', name: 'Kubernetes Service', note: 'Load-balances across every PgBouncer deployment. Many client inlets, few server outlets: pooling. Its gauge shows server connections in use.' },
    { key: 'deck', name: 'Deck', note: 'Carries the deployments.' },
    { key: 'deployments', name: 'PgBouncer deployments', note: 'One Kubernetes deployment of several PgBouncer pods per read replica.' },
    { key: 'switch', name: 'Pooling-mode switch', note: 'Statement or transaction pooling, with idle timeouts to prevent connection exhaustion.' }
  ],
  primary: [
    { key: 'plinth', name: 'Plinth', note: 'Stands the primary on the floor.' },
    { key: 'cabinet', name: 'Cabinet', note: 'One Azure PostgreSQL flexible server: the only writer. MVCC copies a whole row on every update, leaving dead tuples for autovacuum.' },
    { key: 'slots', name: 'Connection slots', note: 'Ten lamps of 500 each: an instance allows 5,000 connections.' },
    { key: 'digest', name: 'Query-digest blocklist', note: 'The ORM can rate-limit or fully block a query digest: the query layer of the rate limits.' },
    { key: 'plaque', name: 'Schema policy plaque', note: 'Lightweight changes only, a 5-second timeout, indexes created and dropped concurrently, no new tables, rate-limited backfills, idle_in_transaction_session_timeout.' },
    { key: 'lid', name: 'Lid', note: 'Carries the dial and the spool.' },
    { key: 'dial', name: 'CPU dial', note: 'Primary CPU: what a single-writer design has to protect.' },
    { key: 'spool', name: 'WAL spool', note: 'The write-ahead log, streamed to every replica: each replica adds network and CPU load here.' }
  ],
  standby: [
    { key: 'plinth', name: 'Plinth', note: 'Stands the standby beside the primary.' },
    { key: 'cabinet', name: 'Hot standby', note: 'A continuously synchronised replica, promoted quickly when the primary fails or is down for maintenance.' },
    { key: 'lid', name: 'Lid and sync cable', note: 'The sync cable from the primary, and the role lamp.' }
  ],
  cosmos: [
    { key: 'plinth', name: 'Plinth', note: 'Stands the rack on the floor.' },
    { key: 'modules', name: 'Partitions', note: 'Azure Cosmos DB: shardable, write-heavy workloads, and every new table, since PostgreSQL takes no new ones.' },
    { key: 'frame', name: 'Frame and cap', note: 'Holds the partitions.' }
  ],
  replica: [
    { key: 'plinth', name: 'Plinth', note: 'Stands the replica on its region pad.' },
    { key: 'cabinet', name: 'Read replica', note: 'Serves reads, including the critical ones moved off the primary, so a primary failure no longer takes them down. Its load bar shows CPU.' },
    { key: 'lid', name: 'Lid and tier stripe', note: 'Solid stripe: high priority. Dashed: low priority, on separate instances.' },
    { key: 'port', name: 'WAL receiver', note: 'Takes the write-ahead log from the primary, or from a relay with cascading replication.' },
    { key: 'dial', name: 'Lag dial', note: 'Replication lag, kept near zero in production.' }
  ],
  depot: [
    { key: 'deck', name: 'Depot', note: 'Where idle trays wait.' },
    { key: 'pads', name: 'Charging pads', note: 'A lamp per pad. Under load, every tray is out.' }
  ]
};

export const partsOf = (kind: Kind) => PARTS[kind];
