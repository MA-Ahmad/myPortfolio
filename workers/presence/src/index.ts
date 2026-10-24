import { DurableObject } from 'cloudflare:workers';
import {
  CLOSE,
  type ClientMessage,
  type Presence,
  SEND_INTERVAL_MS,
  type ServerMessage,
  sanitize
} from '../../../lib/canvas/presence';

type Env = {
  ROOMS: DurableObjectNamespace<PresenceRoom>;
  /** Connection attempts per address, checked before the room is ever woken. */
  CONNECT_LIMITER: RateLimit;
  /** Comma-separated origins allowed to join, e.g. the site and the local dev server. */
  ALLOWED_ORIGINS: string;
};

// `seen` is the last time this visitor sent anything besides a ping (pings are timed by the runtime).
type Attachment = { id: number; ip: string; seen: number; p: Partial<Presence> };
type Bucket = { tokens: number; at: number };
type Usage = { hour: number; count: number };

const MAX_PEERS = 50;
// Room for a few tabs or people behind one shared network.
const MAX_PEERS_PER_IP = 6;
const MAX_MESSAGE_BYTES = 2048;

// Token buckets: a page sends at most 1000 / SEND_INTERVAL_MS (20) a second, so the refill rate
// leaves headroom and the burst absorbs messages a network stall delivers all at once.
const SOCKET_RATE = (1000 / SEND_INTERVAL_MS) * 1.25;
const SOCKET_BURST = SOCKET_RATE * 2;
const IP_RATE = SOCKET_RATE * 3;
const IP_BURST = IP_RATE * 2;

// Incoming messages are billed 20 to a request and the free plan has 100,000 requests a day, so
// about 2M messages. The room stops at 60k an hour (1.44M a day), leaving room for connections,
// and no one address may take more than a quarter of that.
const HOUR_MS = 3_600_000;
const ROOM_HOURLY = 60_000;
const IP_HOURLY = 15_000;
// Counters live in memory and are saved this often, so they survive the room hibernating.
const SAVE_EVERY = 200;
const BAN_MS = 10 * 60_000;

// Matches the page's keep-alive; answered by the runtime without waking the room.
const PING = 'ping';
const PONG = 'pong';
// A connection that dies without closing (a sleeping laptop, a dropped network) never says goodbye,
// so while anyone is here the room sweeps for sockets that stopped answering. Pages ping every
// 30s, but a hidden tab's timers can slow to once a minute, hence the margin.
const SWEEP_MS = 30_000;
const STALE_MS = 150_000;
const ROOM = '*';

const ready = (p: Partial<Presence>): p is Presence => typeof p.name === 'string' && typeof p.color === 'string';
const nextHour = (now: number) => (Math.floor(now / HOUR_MS) + 1) * HOUR_MS;

/**
 * The one Theme Studio room. It only relays: each visitor's presence lives on their socket's
 * attachment, so it survives hibernation. Storage only holds bans and hourly message counts.
 *
 * A message over a limit is still billed once it arrives, so dropping it isn't enough: whoever
 * breaks a limit is disconnected and kept out for a while instead.
 */
export class PresenceRoom extends DurableObject<Env> {
  private sockets = new WeakMap<WebSocket, Bucket>();
  private addresses = new Map<string, Bucket>();
  private usage = new Map<string, Usage>();

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(PING, PONG));
  }

  async fetch(request: Request): Promise<Response> {
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const now = Date.now();
    const [client, server] = Object.values(new WebSocketPair());
    const response = new Response(null, { status: 101, webSocket: client });

    // Refused sockets are accepted only to carry the close code, which tells the page how long
    // to wait. Not hibernatable, so they never count as peers.
    const refusal = this.refusal(ip, now);
    if (refusal) {
      server.accept();
      server.close(refusal, 'Refused');
      return response;
    }
    this.ctx.acceptWebSocket(server);
    const attachment: Attachment = { id: crypto.getRandomValues(new Uint32Array(1))[0], ip, seen: now, p: {} };
    server.serializeAttachment(attachment);
    if ((await this.ctx.storage.getAlarm()) === null) await this.ctx.storage.setAlarm(now + SWEEP_MS);
    const peers = this.attachments(server).filter((peer) => ready(peer.p)) as { id: number; p: Presence }[];
    this.send(server, { t: 'welcome', peers: peers.map(({ id, p }) => ({ id, p })) });
    return response;
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer) {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (!attachment) return;
    const { ip } = attachment;
    const now = Date.now();
    // Nothing the page sends comes close to these, so only a misbehaving client trips them.
    if (typeof message !== 'string' || message.length > MAX_MESSAGE_BYTES) return this.ban(ip, now + BAN_MS);
    if (!this.take(this.socketBucket(ws, now), SOCKET_RATE, SOCKET_BURST, now)) return this.ban(ip, now + BAN_MS);
    if (!this.take(this.addressBucket(ip, now), IP_RATE, IP_BURST, now)) return this.ban(ip, now + BAN_MS);
    if (this.count(ip, now) > IP_HOURLY) return this.ban(ip, nextHour(now));
    if (this.count(ROOM, now) > ROOM_HOURLY) return this.rest(now);

    let parsed: ClientMessage;
    try {
      parsed = JSON.parse(message);
    } catch {
      return;
    }
    if (parsed?.t !== 'update') return;
    attachment.p = { ...attachment.p, ...sanitize(parsed.p) };
    attachment.seen = now;
    ws.serializeAttachment(attachment);
    if (ready(attachment.p)) this.broadcast(ws, { t: 'update', id: attachment.id, p: attachment.p });
  }

  /** Drops sockets that went quiet, and keeps sweeping while anyone is left. */
  async alarm() {
    const now = Date.now();
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (!attachment) continue;
      const pinged = this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? 0;
      if (now - Math.max(attachment.seen, pinged) > STALE_MS) this.close(ws, CLOSE.stale, 'Stale');
    }
    if (this.attachments().length > 0) await this.ctx.storage.setAlarm(now + SWEEP_MS);
  }

  async webSocketClose(ws: WebSocket) {
    this.leave(ws);
  }

  async webSocketError(ws: WebSocket) {
    this.leave(ws);
  }

  /** Why a new connection from `ip` is turned away, if it is. */
  private refusal(ip: string, now: number) {
    if ((this.ctx.storage.kv.get<number>('rest') ?? 0) > now) return CLOSE.resting;
    if ((this.ctx.storage.kv.get<number>(`ban:${ip}`) ?? 0) > now) return CLOSE.abuse;
    const open = this.attachments();
    if (open.length >= MAX_PEERS) return CLOSE.full;
    if (open.filter((peer) => peer.ip === ip).length >= MAX_PEERS_PER_IP) return CLOSE.full;
    return null;
  }

  private socketBucket(ws: WebSocket, now: number) {
    let bucket = this.sockets.get(ws);
    if (!bucket) this.sockets.set(ws, (bucket = { tokens: SOCKET_BURST, at: now }));
    return bucket;
  }

  private addressBucket(ip: string, now: number) {
    let bucket = this.addresses.get(ip);
    if (!bucket) this.addresses.set(ip, (bucket = { tokens: IP_BURST, at: now }));
    return bucket;
  }

  private take(bucket: Bucket, rate: number, burst: number, now: number) {
    bucket.tokens = Math.min(burst, bucket.tokens + ((now - bucket.at) / 1000) * rate);
    bucket.at = now;
    if (bucket.tokens < 1) return false;
    bucket.tokens -= 1;
    return true;
  }

  /** Counts one message against `key`'s budget for this hour and returns the running total. */
  private count(key: string, now: number) {
    const hour = Math.floor(now / HOUR_MS);
    let usage = this.usage.get(key) ?? this.ctx.storage.kv.get<Usage>(`use:${key}`);
    if (!usage || usage.hour !== hour) usage = { hour, count: 0 };
    usage.count += 1;
    this.usage.set(key, usage);
    if (usage.count % SAVE_EVERY === 0) this.ctx.storage.kv.put(`use:${key}`, usage);
    return usage.count;
  }

  /** Disconnects every socket from `ip` and keeps the address out until `until`. */
  private ban(ip: string, until: number) {
    this.ctx.storage.kv.put(`ban:${ip}`, until);
    this.addresses.delete(ip);
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as Attachment | null;
      if (attachment?.ip === ip) this.close(ws, CLOSE.abuse, 'Limit reached');
    }
  }

  /** The room's hourly budget is spent: everyone leaves until the next hour. */
  private rest(now: number) {
    this.ctx.storage.kv.put('rest', nextHour(now));
    for (const ws of this.ctx.getWebSockets()) this.close(ws, CLOSE.resting, 'Limit reached');
  }

  private close(ws: WebSocket, code: number, reason: string) {
    // Cleared first, so its close handler doesn't announce a leave twice.
    const attachment = ws.deserializeAttachment() as Attachment | null;
    ws.serializeAttachment(null);
    if (attachment) this.broadcast(ws, { t: 'leave', id: attachment.id });
    try {
      ws.close(code, reason);
    } catch {}
  }

  private leave(ws: WebSocket) {
    const attachment = ws.deserializeAttachment() as Attachment | null;
    if (attachment) this.broadcast(ws, { t: 'leave', id: attachment.id });
  }

  private attachments(except?: WebSocket) {
    return this.ctx
      .getWebSockets()
      .filter((ws) => ws !== except)
      .map((ws) => ws.deserializeAttachment() as Attachment | null)
      .filter((attachment): attachment is Attachment => attachment !== null);
  }

  private send(ws: WebSocket, message: ServerMessage) {
    try {
      ws.send(JSON.stringify(message));
    } catch {
      // Already closing; its close handler tells the others.
    }
  }

  private broadcast(from: WebSocket, message: ServerMessage) {
    const data = JSON.stringify(message);
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === from || ws.deserializeAttachment() === null) continue;
      try {
        ws.send(data);
      } catch {}
    }
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname !== '/room') return new Response('Not found', { status: 404 });
    if (request.headers.get('Upgrade') !== 'websocket') return new Response('Expected a WebSocket', { status: 426 });
    const allowed = env.ALLOWED_ORIGINS.split(',').map((origin) => origin.trim());
    if (!allowed.includes(request.headers.get('Origin') ?? '')) return new Response('Forbidden', { status: 403 });
    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown';
    const { success } = await env.CONNECT_LIMITER.limit({ key: ip });
    if (!success) return new Response('Too many connections', { status: 429 });
    return env.ROOMS.get(env.ROOMS.idFromName('theme-studio')).fetch(request);
  }
} satisfies ExportedHandler<Env>;
