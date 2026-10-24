import {
  type CSSProperties,
  type ReactNode,
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore
} from 'react';
import { Eye, EyeOff } from 'lucide-react';
import { type Point, wirePath } from 'lib/canvas/geometry';
import {
  ADJECTIVES,
  ANIMALS,
  CLOSE,
  COLORS,
  type ClientMessage,
  type Presence,
  SEND_INTERVAL_MS,
  type ServerMessage,
  type SharedWire
} from 'lib/canvas/presence';
import styles from './canvas.module.css';
import type { Layout } from './nodes';

export type { SharedWire };

/** The room worker in `workers/presence`, e.g. wss://theme-studio-presence.<you>.workers.dev/room. */
const ROOM_URL = process.env.NEXT_PUBLIC_PRESENCE_URL;
const HIDDEN_KEY = 'theme-studio:hide-others';
const IDENTITY_KEY = 'theme-studio:identity';
// Keeps idle sockets from being dropped by proxies; the worker answers without waking up.
const PING_MS = 30_000;
const RETRY_MIN_MS = 1000;
const RETRY_MAX_MS = 30_000;
// When the room turns us away, trying again soon won't help.
const FULL_RETRY_MS = 60_000;
const ABUSE_RETRY_MS = 10 * 60_000;
const HOUR_MS = 3_600_000;
const SHOWN_DOTS = 3;
// A cursor that hasn't moved for this long fades out until it moves again.
const IDLE_MS = 8000;

type Peers = readonly (readonly [id: number, presence: Presence, movedAt: number])[];
type Identity = Pick<Presence, 'name' | 'color'>;

const NO_PEERS: Peers = [];

const pick = <T,>(list: T[]) => list[Math.floor(Math.random() * list.length)];

const store = (area: () => Storage) => ({
  get(key: string) {
    try {
      return area().getItem(key);
    } catch {
      return null;
    }
  },
  set(key: string, value: string | null) {
    try {
      if (value === null) area().removeItem(key);
      else area().setItem(key, value);
    } catch {}
  }
});

const storage = store(() => window.localStorage);
const tabStorage = store(() => window.sessionStorage);

/**
 * An anonymous name and color, kept per tab: a reload doesn't rename you, and two of your own
 * tabs show up as two visitors rather than one name in two places.
 */
function identity(): Identity {
  try {
    const saved = JSON.parse(tabStorage.get(IDENTITY_KEY) ?? '');
    const [adjective, animal] = String(saved?.name).split(' ');
    if (ADJECTIVES.includes(adjective) && ANIMALS.includes(animal) && COLORS.includes(saved?.color)) return saved;
  } catch {}
  const fresh = { name: `${pick(ADJECTIVES)} ${pick(ANIMALS)}`, color: pick(COLORS) };
  tabStorage.set(IDENTITY_KEY, JSON.stringify(fresh));
  return fresh;
}

/** How long to wait before reconnecting, given why the socket closed. */
function retryDelay(code: number, retries: number) {
  const jitter = 0.5 + Math.random() / 2;
  if (code === CLOSE.full) return FULL_RETRY_MS * jitter;
  if (code === CLOSE.abuse) return ABUSE_RETRY_MS;
  // The room reopens on the hour; spread everyone's return over the first minute of it.
  if (code === CLOSE.resting) return HOUR_MS - (Date.now() % HOUR_MS) + Math.random() * 60_000;
  return Math.min(RETRY_MAX_MS, RETRY_MIN_MS * 2 ** retries) * jitter;
}

/**
 * One connection to the room: sends our presence at most every SEND_INTERVAL_MS, keeps everyone
 * else's, and reconnects with backoff when the socket drops. Updates from others are applied at
 * most once a frame, so a busy room can't make the canvas re-render faster than it paints.
 */
class Room {
  private socket: WebSocket | null = null;
  private others = new Map<number, Presence>();
  private movedAt = new Map<number, number>();
  private snapshot: Peers = NO_PEERS;
  private listeners = new Set<() => void>();
  private pending: Partial<Presence> = {};
  private lastSent = 0;
  private flushTimer: number | undefined;
  private retryTimer: number | undefined;
  private pingTimer: number | undefined;
  private emitFrame = 0;
  private retries = 0;
  private destroyed = false;

  constructor(
    private url: string,
    private me: Presence
  ) {
    this.connect();
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = () => this.snapshot;

  update(patch: Partial<Presence>) {
    this.me = { ...this.me, ...patch };
    this.pending = { ...this.pending, ...patch };
    this.schedule();
  }

  private schedule() {
    if (this.flushTimer !== undefined) return;
    const wait = Math.max(0, this.lastSent + SEND_INTERVAL_MS - Date.now());
    if (wait === 0) this.flush();
    else this.flushTimer = window.setTimeout(this.flush, wait);
  }

  destroy() {
    this.destroyed = true;
    window.clearTimeout(this.flushTimer);
    window.clearTimeout(this.retryTimer);
    window.clearInterval(this.pingTimer);
    cancelAnimationFrame(this.emitFrame);
    // Closing a socket that is still opening can leave the room holding the far end, so let it
    // open first and close it then.
    const socket = this.socket;
    if (socket?.readyState === WebSocket.CONNECTING) socket.onopen = () => socket.close();
    else socket?.close();
  }

  private connect() {
    const socket = new WebSocket(this.url);
    this.socket = socket;
    socket.onopen = () => {
      this.retries = 0;
      // Everything, so a reconnect brings the others fully up to date.
      this.pending = { ...this.me };
      this.flush();
      this.pingTimer = window.setInterval(() => socket.send('ping'), PING_MS);
    };
    socket.onmessage = (event) => {
      if (event.data === 'pong') return;
      let message: ServerMessage;
      try {
        message = JSON.parse(event.data);
      } catch {
        return;
      }
      const now = Date.now();
      if (message.t === 'welcome') {
        this.others = new Map(message.peers.map((peer) => [peer.id, peer.p]));
        this.movedAt = new Map(message.peers.map((peer) => [peer.id, now]));
      } else if (message.t === 'update') {
        const before = this.others.get(message.id);
        if (!before || JSON.stringify(before.cursor) !== JSON.stringify(message.p.cursor) || JSON.stringify(before.wire) !== JSON.stringify(message.p.wire))
          this.movedAt.set(message.id, now);
        this.others.set(message.id, message.p);
      } else if (message.t === 'leave') {
        this.movedAt.delete(message.id);
        if (!this.others.delete(message.id)) return;
      } else return;
      this.emit();
    };
    socket.onclose = (event) => {
      window.clearInterval(this.pingTimer);
      this.socket = null;
      this.others.clear();
      this.movedAt.clear();
      this.emit();
      if (this.destroyed) return;
      this.retryTimer = window.setTimeout(() => this.connect(), retryDelay(event.code, this.retries));
      this.retries += 1;
    };
  }

  private flush = () => {
    this.flushTimer = undefined;
    if (this.socket?.readyState !== WebSocket.OPEN || Object.keys(this.pending).length === 0) return;
    // A slow link still has the last update queued: keep merging into this one instead of
    // stacking more behind it, which would arrive later as a burst.
    if (this.socket.bufferedAmount > 0) {
      this.lastSent = Date.now();
      return this.schedule();
    }
    const message: ClientMessage = { t: 'update', p: this.pending };
    this.socket.send(JSON.stringify(message));
    this.pending = {};
    this.lastSent = Date.now();
  };

  private emit() {
    if (this.emitFrame) return;
    this.emitFrame = requestAnimationFrame(() => {
      this.emitFrame = 0;
      this.snapshot = Array.from(this.others, ([id, presence]) => [id, presence, this.movedAt.get(id) ?? 0] as const);
      this.listeners.forEach((listener) => listener());
    });
  }
}

type Context = {
  available: boolean;
  room: Room | null;
  hidden: boolean;
  setHidden: (hidden: boolean) => void;
};

const MultiplayerContext = createContext<Context>({
  available: false,
  room: null,
  hidden: false,
  setHidden: () => {}
});

const usePeers = (room: Room) => useSyncExternalStore(room.subscribe, room.getSnapshot, () => NO_PEERS);

/**
 * Puts Theme Studio in a shared room where visitors see each other's cursors and wires. Hiding
 * others leaves the room, so your own cursor stops going out too. Without a room URL the page is
 * just single-player.
 */
export function Multiplayer({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  const [hidden, setHiddenState] = useState(false);
  const [room, setRoom] = useState<Room | null>(null);

  // Joined only after mount: the page is static, and the choice and identity live in the browser.
  useEffect(() => {
    setHiddenState(storage.get(HIDDEN_KEY) === '1');
    setMounted(true);
  }, []);

  const available = Boolean(ROOM_URL) && mounted;

  useEffect(() => {
    if (!available || hidden) return;
    const next = new Room(ROOM_URL!, { ...identity(), layout: null, cursor: null, wire: null });
    setRoom(next);
    return () => {
      next.destroy();
      setRoom(null);
    };
  }, [available, hidden]);

  const setHidden = (next: boolean) => {
    setHiddenState(next);
    storage.set(HIDDEN_KEY, next ? '1' : null);
  };

  return (
    <MultiplayerContext.Provider value={{ available, room, hidden, setHidden }}>
      {children}
    </MultiplayerContext.Provider>
  );
}

/** The header pill: who else is here, and the switch to hide them. */
export function PresenceToggle() {
  const { available, room, hidden, setHidden } = useContext(MultiplayerContext);
  if (!available) return null;
  const label = hidden ? 'Show other visitors' : 'Hide other visitors';
  return (
    <button
      type="button"
      className={styles.presence}
      aria-pressed={!hidden}
      aria-label={label}
      title={label}
      onClick={() => setHidden(!hidden)}
    >
      {hidden ? <span>Others hidden</span> : room ? <Online room={room} /> : <span>Just you</span>}
      {hidden ? <EyeOff className="size-3.5" aria-hidden /> : <Eye className="size-3.5" aria-hidden />}
    </button>
  );
}

function Online({ room }: { room: Room }) {
  const peers = usePeers(room);
  return (
    <>
      {peers.length > 0 && (
        <span className={styles.presenceDots} aria-hidden>
          {peers.slice(0, SHOWN_DOTS).map(([id, { color }]) => (
            <span key={id} style={{ background: color }} />
          ))}
        </span>
      )}
      <span>{peers.length === 0 ? 'Just you' : `${peers.length} here`}</span>
    </>
  );
}

type LayerProps = {
  layout: Layout;
  /** The world's scale, undone on cursors so they stay pointer-sized. */
  scale: number;
  toWorld: (clientX: number, clientY: number) => Point;
  wire: SharedWire | null;
  /** The world's size, for the ghost-wire layer. */
  width: number;
  height: number;
};

/** Other visitors' cursors and wires, drawn into the world; also sends ours. */
export function PeerLayer(props: LayerProps) {
  const { room } = useContext(MultiplayerContext);
  return room ? <RoomLayer room={room} {...props} /> : null;
}

function RoomLayer({ room, layout, scale, toWorld, wire, width, height }: LayerProps & { room: Room }) {
  const others = usePeers(room);

  useEffect(() => room.update({ layout }), [room, layout]);

  // The wire changes every frame while it's dragged; only an actual change goes out.
  const wireKey = JSON.stringify(wire);
  useEffect(() => {
    room.update({ wire: JSON.parse(wireKey) });
  }, [room, wireKey]);

  useEffect(() => {
    // Converting to world coordinates measures the stage, so it happens once per send, not on
    // every pointer event; a frame mid-animation never pays for a forced layout.
    let latest: { x: number; y: number } | null = null;
    let timer: number | undefined;
    const send = () => {
      timer = undefined;
      if (latest) room.update({ cursor: toWorld(latest.x, latest.y) });
    };
    const move = (event: PointerEvent) => {
      latest = { x: event.clientX, y: event.clientY };
      timer ??= window.setTimeout(send, SEND_INTERVAL_MS);
    };
    const away = () => {
      latest = null;
      window.clearTimeout(timer);
      timer = undefined;
      room.update({ cursor: null });
    };
    // A finger isn't a cursor once it lifts.
    const up = (event: PointerEvent) => event.pointerType === 'touch' && away();
    // Leaving the window fast can skip pointerleave; a pointerout with nowhere to go is the same.
    const out = (event: PointerEvent) => !event.relatedTarget && away();
    const hide = () => document.visibilityState === 'hidden' && away();
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('blur', away);
    window.addEventListener('pointerout', out);
    document.documentElement.addEventListener('pointerleave', away);
    document.addEventListener('visibilitychange', hide);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('blur', away);
      window.removeEventListener('pointerout', out);
      document.documentElement.removeEventListener('pointerleave', away);
      document.removeEventListener('visibilitychange', hide);
    };
  }, [room, toWorld]);

  const peers = useMemo(() => others.filter(([, presence]) => presence.layout === layout), [others, layout]);

  // Idle cursors fade out; while any cursor is shown, check once a second which ones went still.
  const [now, setNow] = useState(() => Date.now());
  const showing = peers.some(([, presence]) => presence.cursor);
  useEffect(() => {
    if (!showing) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [showing]);

  return (
    <>
      <svg className={styles.layer} width={width} height={height} style={{ zIndex: 9 }} aria-hidden>
        {peers.map(([id, { color, wire }]) =>
          wire ? (
            <path
              key={id}
              className={styles.peerWire}
              data-lit={wire.lit || undefined}
              style={{ '--peer': color, '--accent': `var(--accent-${wire.source})` } as CSSProperties}
              d={wirePath(wire.from, wire.fromDir, wire.to, wire.toDir, wire.reachCap ?? Infinity)}
            />
          ) : null
        )}
      </svg>
      <div className={styles.peers} aria-hidden>
        {peers.map(([id, { name, color, cursor }, movedAt]) =>
          cursor ? (
            <div
              key={id}
              className={styles.peerCursor}
              data-idle={now - movedAt > IDLE_MS || undefined}
              style={{ transform: `translate3d(${cursor.x}px, ${cursor.y}px, 0) scale(${1 / scale})`, color }}
            >
              <svg width="16" height="18" viewBox="0 0 16 18">
                <path
                  d="M1 1 L15 8.2 L8.6 9.6 L5.6 16.4 Z"
                  fill="currentColor"
                  stroke="white"
                  strokeWidth="1.5"
                  strokeLinejoin="round"
                />
              </svg>
              <span style={{ background: color }}>{name}</span>
            </div>
          ) : null
        )}
      </div>
    </>
  );
}
