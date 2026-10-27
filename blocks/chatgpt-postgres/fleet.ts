import type { Load } from './scenarios';
import type { Design, SideKey, SimState } from './sim';
import { BAY_REACH, GATE_X, LOOP, WORLD, backS, bayDirection, poseAt, type Machine, type Tier } from './world';

/**
 * The robot trays on one floor. They run one way round the lane loop; a tray picks a slip up at the
 * apps, stops at each machine on its slip's route (stepping into a bay beside the lane so others
 * can pass), and brings the answer back to the apps. The load model decides what kind of slips the
 * apps hand out and how they fare; the trays only show it. One tray stands for many queries.
 */

export type SlipKind = 'read' | 'write' | 'join';
export type Lamp = 'run' | 'wait' | 'lease' | 'fail' | 'shed' | 'retry' | 'charge' | 'idle';
type Fail = 'timeout' | 'refused' | 'down' | 'blocked' | 'locked';

type Stop = { id: string; s: number; dwell: number; bays: number };

export type Job = {
  kind: SlipKind;
  tier: Tier;
  stops: Stop[];
  /** Where and how it fails, if it does. */
  fail?: { at: string; how: Fail };
  /** Turned away at the rate-limit gate. */
  shed?: boolean;
  /** A cache miss on a hot key: with a lease, only one of these goes on to the database. */
  hot?: boolean;
  retry?: boolean;
  /** A query in words, for the hover card. */
  sql: string;
};

type Phase = 'lane' | 'enter' | 'lift' | 'dwell' | 'lower' | 'exit' | 'parked';

export type Tray = {
  id: number;
  s: number;
  v: number;
  /** 0 on the lane, 1 fully in a bay. */
  bay: number;
  /** Which bay of the dock it is in, as an offset along the lane. */
  slot: number;
  lift: number;
  phase: Phase;
  timer: number;
  job: Job | null;
  /** The stop it is heading for, an index into `job.stops`. */
  next: number;
  lamp: Lamp;
  slip: SlipKind | 'none' | 'void';
  x: number;
  y: number;
  heading: number;
  /** Docks it has taken a bay at, so it can let it go. */
  dockId: string | null;
  hops: number;
  /** Whether the current stop has dealt with its slip yet. */
  served: boolean;
  /** Seconds since it last saw the apps, for the hover card. */
  age: number;
  /** The lamp it had before it stopped in a queue on the lane, to show again when it moves on. */
  queued: Lamp | null;
  /** Seconds it has been held up behind another tray. */
  heldFor: number;
};

export type FleetContext = { sim: SimState; load: Load; design: Design; cascading: boolean };

const SPEED = 96;
const ACCEL = 220;
const GAP = 17;
const ENTER = 0.28;
const LIFT = 0.18;
export const FLEET = 13;
/** Seconds a request waits on a dead primary before it times out (illustrative). */
const DOWN_TIMEOUT = 5;
/** Seconds a query waits on a saturated primary before it times out (illustrative). */
const OVERLOAD_TIMEOUT = 3.5;

/** A small seeded generator, so a scenario plays the same each time. */
function random(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const ahead = (from: number, to: number) => (((to - from) % LOOP) + LOOP) % LOOP;

const SQL: Record<SlipKind, string[]> = {
  read: ['SELECT * FROM conversations WHERE id = $1', 'SELECT plan FROM accounts WHERE user_id = $1', 'SELECT * FROM users WHERE id = $1'],
  write: ['UPDATE conversations SET title = $2 WHERE id = $1', 'INSERT INTO messages …', 'UPDATE users SET last_seen = now()'],
  join: ['SELECT … FROM users JOIN accounts JOIN orgs JOIN … (12 tables)']
};

export class Fleet {
  side: SideKey;
  trays: Tray[] = [];
  pending: Job[] = [];
  /** Whether the floor was failing on the last step, to notice the moment it recovers. */
  wasFailing = false;
  /** The trays spread round the loop at the start still need their first slips. */
  seeding = true;
  machines: Machine[];
  docks = new Map<string, { s: number; bays: number; taken: (number | null)[] }>();
  rand: () => number;
  spawnIn = 0;
  leaseHolder: number | null = null;
  /** When the lease was taken: the holder's fetch refills the cache this long after. */
  leaseSince = 0;
  /** When each machine last did something, for its lamps. */
  pulses = new Map<string, number>();
  time = 0;
  gateS = backS(GATE_X);
  /** Counts for the readout. */
  counts = { done: 0, failed: 0, shed: 0, retries: 0, waited: 0 };

  constructor(side: SideKey, seed = 7) {
    this.side = side;
    this.rand = random(seed);
    this.machines = WORLD[side].filter((machine) => !machine.ghost);
    for (const machine of this.machines) {
      if (machine.dock) this.docks.set(machine.id, { s: machine.dock.s, bays: machine.dock.bays, taken: Array(machine.dock.bays).fill(null) });
    }
    this.reset();
  }

  reset() {
    this.trays = [];
    this.pending = [];
    this.wasFailing = false;
    this.seeding = true;
    this.leaseHolder = null;
    this.counts = { done: 0, failed: 0, shed: 0, retries: 0, waited: 0 };
    this.docks.forEach((dock) => dock.taken.fill(null));
    const depot = this.docks.get('depot')!;
    for (let id = 0; id < FLEET; id++) {
      // Spread the fleet round the loop, a few already parked in the depot.
      const parked = id < depot.bays;
      const s = parked ? depot.s : (LOOP * (id - depot.bays)) / (FLEET - depot.bays) + 8;
      const tray: Tray = {
        id,
        s,
        v: parked ? 0 : SPEED * 0.6,
        bay: parked ? 1 : 0,
        slot: 0,
        lift: 0,
        phase: parked ? 'parked' : 'lane',
        timer: 0,
        job: null,
        next: 0,
        lamp: parked ? 'charge' : 'idle',
        slip: 'none',
        x: 0,
        y: 0,
        heading: 0,
        dockId: null,
        hops: 0,
        served: false,
        queued: null,
        heldFor: 0,
        age: 0
      };
      if (parked) {
        depot.taken[id] = id;
        tray.dockId = 'depot';
        tray.slot = this.slotOffset(depot, id);
      }
      this.place(tray);
      this.trays.push(tray);
    }
  }

  stop(id: string, dwell: number): Stop {
    const dock = this.docks.get(id)!;
    return { id, s: dock.s, dwell, bays: dock.bays };
  }

  /** The apps hand out a slip: its kind and fate come from the load model. */
  makeJob(ctx: FleetContext, retry = false): Job {
    const job = this.planJob(ctx, retry);
    const { sim, load, design } = ctx;
    // The primary is down and there is no standby: everything depended on it, so every slip goes to
    // it and waits for an answer that never comes.
    if (!design.standby && load.primaryDown > 0.5) {
      job.stops = [job.stops[0], this.stop('primary', 0.3)];
      job.fail = { at: 'primary', how: 'down' };
      job.hot = false;
      return job;
    }
    // The primary is down and the hot standby has been promoted: the writer is now the standby.
    if (design.standby && load.primaryDown > 0.5 && sim.primaryUp) {
      job.stops = job.stops.map((stop) => (stop.id === 'primary' ? this.stop('standby', stop.dwell) : stop));
      if (job.fail?.at === 'primary') job.fail.at = 'standby';
    }
    return job;
  }

  /** How long a busy primary holds a tray: past saturation the wait grows fast, so its bays turn
   * over slowly and the trays behind queue on the lane. */
  heldAt(cpu: number) {
    return Math.max(0, cpu - 0.5) * 1.6 + Math.max(0, cpu - 1) * 16;
  }

  /** Where a read that missed the cache goes next: the primary or a replica. */
  missStop({ sim, design }: FleetContext, tier: Tier) {
    if (this.rand() < design.primaryReads) return this.stop('primary', 0.3 + this.heldAt(sim.cpu));
    return this.replicaStop(tier, 0.3 + Math.min(1.4, (tier === 'low' ? sim.lowCpu : sim.replicaCpu) * 0.8));
  }

  planJob(ctx: FleetContext, retry: boolean): Job {
    const { sim, load, design } = ctx;
    const r = this.rand;
    const held = (cpu: number) => this.heldAt(cpu);
    const after = this.side === 'after';
    const writes = 8 * load.write;
    const reads = 120 * load.read;
    const joins = Math.max(0, load.join - 1) * 2.5;
    const roll = r() * (reads * 0.16 + writes * 1.6 + joins);
    let job: Job;
    const apps = this.stop('apps', 0.22);
    if (roll < joins) {
      job = { kind: 'join', tier: 'high', stops: [apps], sql: SQL.join[0] };
      if (after) {
        // The digest is blocked under load; otherwise the join is done in the app as simple reads on a replica.
        if (sim.cpu > 0.6) job.fail = { at: 'primary', how: 'blocked' };
        job.stops.push(this.stop('bouncer', 0.2));
        job.stops.push(job.fail ? this.stop('primary', 0.25) : this.replicaStop('high', 0.5));
      } else job.stops.push(this.stop('primary', 1.1 + Math.min(1.5, sim.cpu)));
    } else if (roll < joins + writes * 1.6) {
      job = { kind: 'write', tier: 'high', stops: [apps], sql: SQL.write[Math.floor(r() * 3)] };
      if (after) job.stops.push(this.stop('bouncer', 0.18));
      const sharded = after && r() < design.sharded + (load.fresh * (design.newWorkloads - design.sharded) * Math.max(0, load.write - 1)) / Math.max(load.write, 1);
      job.stops.push(sharded ? this.stop('cosmos', 0.3) : this.stop('primary', 0.35 + held(sim.cpu)));
    } else {
      const miss = r() < Math.max(load.miss, 0.12) * 2.2;
      const noisy = after && r() < load.noisy * 0.5;
      job = { kind: 'read', tier: noisy || r() < 0.15 ? 'low' : 'high', stops: [apps, this.stop('cache', 0.22)], sql: SQL.read[Math.floor(r() * 3)] };
      if (miss) {
        job.hot = load.miss > 0.2 && r() < 0.8;
        if (after) job.stops.push(this.stop('bouncer', 0.18));
        job.stops.push(this.missStop(ctx, job.tier));
      }
    }
    job.retry = retry;
    // Fate: rate limits shed first, then failures land on the last stop that touches a database.
    if (after && r() < sim.shed * 1.6) job.shed = true;
    else if (!job.fail && !(design.standby && load.primaryDown > 0.5) && r() < sim.errors * 1.15) {
      const last = job.stops[job.stops.length - 1];
      if (last.id !== 'cache' && last.id !== 'apps') {
        const how: Fail = !sim.primaryUp && last.id === 'primary' ? 'down' : load.alter > 0.5 ? 'locked' : sim.connections >= 4_990 && !design.pooled ? 'refused' : 'timeout';
        job.fail = { at: last.id, how };
      } else if (!design.lease || !after) {
        // A failing cache path: the slip still has to find out at the database.
        const db = this.stop('primary', 0.4);
        job.stops.push(db);
        job.fail = { at: 'primary', how: sim.primaryUp ? 'timeout' : 'down' };
      }
    }
    if (!design.standby && !sim.primaryUp && !job.fail) {
      const touchesPrimary = job.stops.some((stop) => stop.id === 'primary');
      if (touchesPrimary) job.fail = { at: 'primary', how: 'down' };
    }
    return job;
  }

  replicaStop(tier: Tier, dwell: number): Stop {
    const candidates = this.machines.filter((m) => m.kind === 'replica' && (!m.tier || m.tier === tier) && !this.isDown(m.id));
    const pick = candidates[Math.floor(this.rand() * candidates.length)] ?? this.machines.find((m) => m.kind === 'replica')!;
    return this.stop(pick.id, dwell);
  }

  downReplica: string | null = null;
  isDown = (id: string) => this.downReplica === id;

  slotOffset(dock: { s: number; bays: number }, slot: number) {
    const toward = bayDirection(dock.s);
    return (slot - (dock.bays - 1) / 2) * 17 * (toward < 0 ? 1 : -1);
  }

  /** World position and heading of a tray from its place on the loop and in a bay. */
  place(tray: Tray) {
    const pose = poseAt(tray.s);
    const toward = bayDirection(tray.s);
    const eased = tray.bay * tray.bay * (3 - 2 * tray.bay);
    tray.x = pose.x + tray.slot * eased;
    tray.y = pose.y + toward * BAY_REACH * eased;
    const into = toward < 0 ? -Math.PI / 2 : Math.PI / 2;
    const moving = tray.phase === 'enter' || tray.phase === 'exit';
    const target = moving ? lerpAngle(pose.heading, into, Math.min(1, Math.sin(Math.PI * eased) * 0.9 + (tray.phase === 'enter' ? eased * 0.1 : 0))) : tray.bay > 0.5 ? into : pose.heading;
    tray.heading = lerpAngle(tray.heading, target, 0.25);
  }

  release(tray: Tray) {
    if (!tray.dockId) return;
    const dock = this.docks.get(tray.dockId);
    if (dock) dock.taken = dock.taken.map((id) => (id === tray.id ? null : id));
    tray.dockId = null;
  }

  pulse(id: string) {
    this.pulses.set(id, this.time);
  }

  /** Begin the next job at the apps, or run empty and park at the depot if there is none. */
  board(tray: Tray) {
    tray.job = this.pending.shift() ?? null;
    tray.next = 1;
    tray.hops = 0;
    tray.age = 0;
    if (tray.job) {
      tray.slip = tray.job.kind;
      tray.lamp = tray.job.retry ? 'retry' : 'run';
    } else {
      tray.slip = 'none';
      tray.lamp = 'idle';
    }
  }

  /** Whether a tray coming back to the apps finds every bay taken and has to wait on the lane. */
  appsWanted() {
    const dock = this.docks.get('apps')!;
    if (dock.taken.includes(null)) return false;
    return this.trays.some((t) => t.phase === 'lane' && (!t.job || t.next >= t.job.stops.length) && ahead(t.s, dock.s) < 40);
  }

  /**
   * What happens while a tray stands in a bay: 'wait' keeps it there, 'go' lets it leave for its
   * next stop, 'reroute' sends it on to a different machine for this same stop.
   */
  serve(tray: Tray, stop: Stop, ctx: FleetContext): 'go' | 'wait' | 'reroute' {
    const job = tray.job;
    if (!job) return 'go';
    const { design, load, sim } = ctx;

    // No lease: a read that was to be a hit finds the cache failing when it gets there, misses, and
    // goes on to the database like every other miss, failing as often as the floor is failing.
    if (stop.id === 'cache' && !design.lease && !tray.served && job.kind === 'read' && tray.next === job.stops.length - 1 && load.miss > 0.2 && this.rand() < Math.min(1, load.miss * 2.2)) {
      const next = this.missStop(ctx, job.tier);
      job.stops.push(next);
      if (!job.fail && this.rand() < sim.errors * 1.15) job.fail = { at: next.id, how: 'timeout' };
    }

    // A hot key with a lease: one tray fetches the row, the others wait at the cache for the refill.
    if (stop.id === 'cache' && job.hot && design.lease) {
      if (this.leaseHolder === null && !tray.served) {
        this.leaseHolder = tray.id;
        this.leaseSince = this.time;
        tray.lamp = 'lease';
      } else if (this.leaseHolder !== tray.id) {
        if (!tray.served) {
          tray.served = true;
          this.counts.waited++;
        }
        tray.lamp = 'wait';
        if (this.leaseHolder !== null) return 'wait';
        job.stops = job.stops.slice(0, tray.next + 1);
        tray.lamp = 'run';
        return 'go';
      }
    }

    // The writer is down and a hot standby is being promoted: writes fail ("write operations would
    // still fail") and are retried; once the standby is promoted, they go to it.
    if (stop.id === 'primary' && design.standby && load.primaryDown > 0.5 && !sim.primaryUp && !job.fail) job.fail = { at: 'primary', how: 'down' };
    else if (stop.id === 'primary' && design.standby && load.primaryDown > 0.5 && sim.primaryUp) {
      job.stops[tray.next] = this.stop('standby', stop.dwell);
      if (job.fail?.at === 'primary') job.fail.at = 'standby';
      tray.lamp = tray.job?.retry ? 'retry' : 'run';
      return 'reroute';
    }

    // No standby: a tray already on its way when the primary went down finds out when it gets there.
    if (stop.id === 'primary' && !design.standby && load.primaryDown > 0.5 && !job.fail) job.fail = { at: 'primary', how: 'down' };

    if (!tray.served) {
      tray.served = true;
      this.pulse(stop.id);
    }

    // A slip doomed to time out or be refused when it was handed out gets its answer if the
    // database has recovered by the time it arrives.
    if (job.fail?.at === stop.id && (job.fail.how === 'timeout' || job.fail.how === 'refused') && sim.errors < 0.01) job.fail = undefined;

    // A saturated primary decides a query's fate when it gets there, from how it is doing now, not
    // when the slip was handed out: under overload, a share of queries time out.
    if (stop.id === 'primary' && !tray.served && sim.primaryUp && sim.cpu > 1) {
      if (job.fail?.at === 'primary' && job.fail.how === 'timeout') job.fail = undefined;
      if (!job.fail && this.rand() < sim.errors) job.fail = { at: 'primary', how: 'timeout' };
    }

    // A failure isn't instant: the tray waits for an answer until it times out, then gives up.
    if (job.fail && job.fail.at === stop.id) {
      // A dead primary with no standby answers nothing, so a request holds its bay until it times
      // out: the bays stay full and the trays behind queue on the lane, the pile-up the post describes.
      // A query on a saturated primary waits out its timeout before giving up, as does one on a dead
      // primary with no standby: the bays stay full and the trays behind queue on the lane.
      const patience =
        job.fail.how === 'blocked' ? 0.3 : job.fail.how === 'down' && !design.standby ? DOWN_TIMEOUT : job.fail.how === 'timeout' && stop.id === 'primary' && sim.cpu > 1 ? OVERLOAD_TIMEOUT : 1.3;
      if (tray.timer < patience) {
        tray.lamp = 'wait';
        return 'wait';
      }
      tray.lamp = 'fail';
      tray.slip = 'void';
      this.counts.failed++;
      if (this.leaseHolder === tray.id) this.leaseHolder = null;
      job.stops = job.stops.slice(0, tray.next + 1);
      job.fail = undefined;
      // No backoff: the client asks again at once, and the load comes straight back.
      const again = design.backoff ? this.rand() < 0.15 : this.rand() < 0.55 + load.retryFast * 0.45;
      if (again && this.pending.length < 8) {
        this.pending.push({ ...this.makeJob(ctx, true), kind: job.kind });
        this.counts.retries++;
      }
      return 'go';
    }
    if (tray.lamp === 'lease' && stop.id !== 'cache' && stop.id !== 'bouncer') tray.lamp = 'run';
    return 'go';
  }

  step(dt: number, ctx: FleetContext) {
    this.time += dt;
    // The trays that start out on the lane are already on a job, as if they had just left the apps.
    if (this.seeding) {
      this.seeding = false;
      for (const tray of this.trays) {
        if (tray.phase !== 'lane' || tray.job) continue;
        tray.job = this.makeJob(ctx);
        tray.next = 1;
        tray.slip = tray.job.kind;
        tray.lamp = 'run';
      }
    }
    // The primary is back: a request that was doomed only because it was down gets its answer
    // now, on its way, waiting in a bay or still queued at the apps, so the backlog drains.
    // A request doomed only because the primary was down gets its answer once it is back: on its
    // way, waiting in a bay or still queued at the apps, so the backlog drains.
    if (ctx.load.primaryDown <= 0.5) {
      for (const job of this.pending) if (job.fail?.how === 'down') job.fail = undefined;
      for (const tray of this.trays) if (tray.job?.fail?.how === 'down') tray.job.fail = undefined;
    }
    // The moment the floor recovers from any trouble, the backlog starts clean: requests the trouble
    // had doomed get answered, and trays still heading home from a failure stop showing red (their
    // slips stay void, since those requests did fail).
    const failing = ctx.load.primaryDown > 0.5 || ctx.sim.errors > 0.02;
    if (this.wasFailing && !failing && ctx.sim.errors < 0.01) {
      for (const job of this.pending) job.fail = undefined;
      for (const tray of this.trays) {
        if (tray.job) tray.job.fail = undefined;
        if (tray.lamp === 'fail' || tray.lamp === 'wait') tray.lamp = tray.job?.retry ? 'retry' : 'run';
      }
      this.wasFailing = false;
    } else if (failing) this.wasFailing = true;
    // The apps hand out slips at a pace that follows traffic; a full queue just waits.
    const pace = 1.6 / Math.min(2.4, Math.max(0.6, ctx.load.read * 0.6 + ctx.load.write * 0.08 + 0.3));
    this.spawnIn -= dt;
    while (this.spawnIn <= 0) {
      this.spawnIn += pace;
      if (this.pending.length >= 6) continue;
      const job = this.makeJob(ctx);
      this.pending.push(job);
      // A miss on a hot key never comes alone: the same key is wanted by a herd of requests at once.
      if (job.hot) {
        for (let copy = 0; copy < 3 && this.pending.length < 8; copy++) {
          const twin = this.makeJob(ctx);
          if (twin.kind === 'read' && twin.hot) this.pending.push(twin);
        }
      }
    }
    // The holder's fetch is quick next to a lap of the floor, so the refill lands on a timer.
    if (this.leaseHolder !== null && (this.time - this.leaseSince > 2.4 || !this.trays.some((t) => t.id === this.leaseHolder && t.job))) {
      const holder = this.trays.find((t) => t.id === this.leaseHolder);
      if (holder?.lamp === 'lease') holder.lamp = holder.job?.retry ? 'retry' : 'run';
      this.leaseHolder = null;
      this.pulse('refill');
    }

    const lane = this.trays.filter((tray) => tray.bay < 0.5 && tray.phase !== 'parked');
    for (const tray of this.trays) {
      tray.age += dt;
      switch (tray.phase) {
        case 'parked': {
          tray.lamp = 'charge';
          // Leave to fetch work only when no empty tray is already waiting for it at the apps, and
          // the queue is long enough that the trays coming back won't clear it.
          const idleAtApps = this.trays.some((t) => t.dockId === 'apps' && !t.job && (t.phase === 'enter' || t.phase === 'lift' || t.phase === 'dwell'));
          if (!idleAtApps && this.pending.length >= 3) {
            tray.phase = 'exit';
            tray.timer = 0;
            tray.lamp = 'idle';
          }
          break;
        }
        case 'lane': {
          const job = tray.job;
          const stop = job && tray.next < job.stops.length ? job.stops[tray.next] : null;
          // The next place to stop: a job's stop, the apps to board, or the depot when empty.
          const appsS = this.docks.get('apps')!.s;
          const depotS = this.docks.get('depot')!.s;
          let target = stop ? stop.s : appsS;
          let target_id = stop ? stop.id : 'apps';
          if (!job && this.pending.length === 0 && ahead(tray.s, depotS) < ahead(tray.s, appsS)) {
            target = depotS;
            target_id = 'depot';
          }
          const toStop = ahead(tray.s, target);
          // Keep a gap to the tray in front.
          let gap = Infinity;
          for (const other of lane) {
            if (other === tray) continue;
            const d = ahead(tray.s, other.s);
            if (d > 0.01 && d < gap) gap = d;
          }
          // Shed at the gate: the arm drops, the slip is void, and the tray goes home.
          if (job?.shed && ahead(tray.s, this.gateS) < 3 && tray.lamp !== 'shed') {
            tray.lamp = 'shed';
            tray.slip = 'void';
            job.stops = job.stops.slice(0, tray.next);
            this.counts.shed++;
            this.pulse('gate');
          }
          const brake = Math.min(Math.sqrt(2 * ACCEL * Math.max(0, toStop - 0.5)), Math.sqrt(2 * ACCEL * Math.max(0, gap - GAP)));
          const want = Math.min(SPEED, brake);
          tray.v = want > tray.v ? Math.min(want, tray.v + ACCEL * dt) : want;
          tray.s = (tray.s + tray.v * dt) % LOOP;
          // Held up behind the tray in front for more than a moment: a queue on the lane, lit as
          // waiting until it moves on. Trays bunching briefly at the apps don't count.
          tray.heldFor = gap < GAP + 2 && tray.v < 2 && toStop >= 1 ? tray.heldFor + dt : 0;
          const held = tray.heldFor > 1;
          if (held && !tray.queued && (tray.lamp === 'run' || tray.lamp === 'retry')) {
            tray.queued = tray.lamp;
            tray.lamp = 'wait';
          } else if (!held && tray.queued) {
            if (tray.lamp === 'wait') tray.lamp = tray.queued;
            tray.queued = null;
          }
          if (toStop < 1 && tray.v < 4) {
            // At the stop: take a free bay, or wait here (and hold up the lane) until one frees.
            const dock = this.docks.get(target_id)!;
            const free = dock.taken.indexOf(null);
            if (free >= 0) {
              dock.taken[free] = tray.id;
              if (tray.queued) {
                if (tray.lamp === 'wait') tray.lamp = tray.queued;
                tray.queued = null;
              }
              tray.dockId = target_id;
              tray.slot = this.slotOffset(dock, free);
              tray.s = target;
              tray.phase = 'enter';
              tray.timer = 0;
              tray.v = 0;
            } else if (tray.lamp === 'run' || tray.lamp === 'retry') tray.lamp = 'wait';
          }
          break;
        }
        case 'enter': {
          tray.timer += dt;
          tray.bay = Math.min(1, tray.timer / ENTER);
          if (tray.bay >= 1) {
            if (tray.dockId === 'depot') {
              tray.phase = 'parked';
              tray.slip = 'none';
            } else {
              tray.phase = 'lift';
              tray.timer = 0;
              tray.served = false;
            }
          }
          break;
        }
        case 'lift': {
          tray.timer += dt;
          tray.lift = Math.min(1, tray.timer / LIFT);
          if (tray.lift >= 1) {
            tray.phase = 'dwell';
            tray.timer = 0;
            if (tray.dockId === 'apps') {
              // Back at the apps: hand the answer over, then take the next slip.
              if (tray.job && tray.hops > 0) {
                if (tray.slip !== 'void') this.counts.done++;
              }
              this.board(tray);
            }
          }
          break;
        }
        case 'dwell': {
          tray.timer += dt;
          // Empty at the apps: wait in the bay for the next request rather than lap the floor to the
          // depot, unless a tray coming in needs the bay.
          if (tray.dockId === 'apps' && !tray.job) {
            if (this.pending.length) this.board(tray);
            else if (!this.appsWanted()) break;
          }
          const job = tray.job;
          const stop = job && tray.dockId !== 'apps' ? job.stops[tray.next] : null;
          // The primary takes as long as its load says now: slow when saturated.
          const dwell = stop ? (stop.id === 'primary' ? Math.max(stop.dwell, 0.3 + this.heldAt(ctx.sim.cpu)) : stop.dwell) : 0.22;
          const verdict = stop ? this.serve(tray, stop, ctx) : 'go';
          if (verdict === 'wait') break;
          if (verdict === 'reroute') {
            // Lower the deck and drive on to the new machine; this stop isn't done yet.
            tray.phase = 'lower';
            tray.timer = 0;
            break;
          }
          if (tray.timer >= dwell) {
            if (stop) {
              tray.next++;
              tray.hops++;
              if (tray.lamp === 'wait') tray.lamp = 'run';
            }
            tray.phase = 'lower';
            tray.timer = 0;
          }
          break;
        }
        case 'lower': {
          tray.timer += dt;
          tray.lift = Math.max(0, 1 - tray.timer / LIFT);
          if (tray.lift <= 0) {
            tray.phase = 'exit';
            tray.timer = 0;
          }
          break;
        }
        case 'exit': {
          tray.timer += dt;
          tray.bay = Math.max(0, 1 - tray.timer / ENTER);
          if (tray.bay <= 0) {
            this.release(tray);
            tray.slot = 0;
            tray.phase = 'lane';
            tray.s = (tray.s + 0.6) % LOOP;
          }
          break;
        }
      }
      this.place(tray);
    }
  }
}

function lerpAngle(from: number, to: number, t: number) {
  let delta = ((to - from + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (delta < -Math.PI) delta += Math.PI * 2;
  return from + delta * t;
}
