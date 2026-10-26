import {
  corners,
  cylinder,
  dotGrid,
  dotsSvg,
  haloOf,
  insetPlan,
  iso,
  lineOnTop,
  lineSvg,
  pathOf,
  planOutline,
  radialTicks,
  ring,
  segment,
  sideSeam,
  sideTicks,
  slabOf,
  solidSvg,
  type Flat,
  type Plan,
  type Point3,
  type Projection
} from './iso-kit';
import type { SideKey } from './sim';
import {
  BAY_REACH,
  DEPOT_PADS,
  DEPOT_X,
  FLOOR,
  FLOOR_H,
  FOOT_H,
  LANE,
  LOOP,
  REGIONS,
  WORLD,
  bayDirection,
  poseAt,
  type Machine
} from './world';

/**
 * The machines as SVG markup, built once per camera. Parts that move or light up carry data
 * attributes (`data-seg`, `data-led`, `data-part`) that the bench finds once and writes to every
 * frame; nothing here runs per frame except the few path builders at the bottom.
 */

const ATTR = (pairs: Record<string, string | number | undefined>) =>
  Object.entries(pairs)
    .filter(([, value]) => value !== undefined)
    .map(([key, value]) => ` ${key}="${value}"`)
    .join('');

const group = (body: string, attrs: Record<string, string | number | undefined> = {}) => `<g${ATTR(attrs)}>${body}</g>`;

/**
 * A machine drawn as named layers, bottom to top, in painting order: `layer(key)` starts the next
 * one, and `join()` wraps each in `<g data-layer data-part-name>` so it can later be lifted apart.
 * The names and notes are in parts.ts.
 */
function layers() {
  const list: { key: string; markup: string[] }[] = [{ key: 'base', markup: [] }];
  return {
    push: (...markup: string[]) => void list[list.length - 1].markup.push(...markup),
    layer: (key: string) => void list.push({ key, markup: [] }),
    join: () =>
      list
        .filter((entry) => entry.markup.length)
        .map((entry, index) => `<g class="cp-layer" data-layer="${index}" data-part-name="${entry.key}">${entry.markup.join('')}</g>`)
        .join('')
  };
}

/** A short line that lights up: an LED segment. */
const seg = (d: string, attrs: Record<string, string | number | undefined>) => `<path class="iso-line cp-seg"${ATTR(attrs)} d="${d}"/>`;

/** A round LED dot. */
const led = ([x, y]: Flat, r: number, attrs: Record<string, string | number | undefined>) =>
  `<circle class="cp-led"${ATTR(attrs)} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}"/>`;

const plate = (plan: Plan, z: number, h: number, P: Projection, tone: 'hi' | 'mid' | 'lo' = 'mid', bevel = 0.5) =>
  solidSvg(slabOf(plan, z, h, P, 6, bevel), { tone, crease: 'faint' });

/** Three rule lines standing for engraved text on a plate's top. */
function rules(plan: Plan, z: number, P: Projection, count = 3) {
  const lines: string[] = [];
  for (let index = 0; index < count; index++) {
    const y = plan.y + plan.d * ((index + 1) / (count + 1));
    const long = index === 0 ? 0.75 : 0.55 - index * 0.08;
    lines.push(lineOnTop([plan.x + plan.w * 0.14, y], [plan.x + plan.w * (0.14 + long), y], z, P));
  }
  return lineSvg(lines.join(''), { tone: 'lo', free: true });
}

/** Corner screws on a plate's top. */
const screws = (plan: Plan, z: number, P: Projection, inset = 2.2) =>
  dotsSvg(
    corners(plan, inset).map(([x, y]) => iso([x, y, z], P)),
    { size: 0.5, tone: 'mid' }
  );

/** A closed slot on the front face (+y): a vent or an LED that ends on its own outline. */
const frontSlot = (plan: Plan, x0: number, x1: number, z: number, P: Projection, half = 0.55) => {
  const y = plan.y + plan.d;
  return pathOf([iso([x0, y, z + half], P), iso([x1, y, z + half], P), iso([x1, y, z - half], P), iso([x0, y, z - half], P)], true);
};

/** Lines across the right face (+x). */
const rightLine = (plan: Plan, y0: number, y1: number, z: number, P: Projection) =>
  segment([plan.x + plan.w, y0, z], [plan.x + plan.w, y1, z], P);

/** A machine that isn't there: an outline of where it would stand, in dashed faint line. */
function ghostSvg(machine: Machine, P: Projection) {
  const plan = { ...machine.plan, r: 0 };
  const { h } = machine;
  const corners3 = corners(plan);
  const edges = corners3.map(([x, y]) => segment([x, y, 0], [x, y, h], P)).join('');
  return group(
    lineSvg(planOutline(plan, 0, P, 4) + planOutline(plan, h, P, 4) + edges, { tone: 'faint', dashed: true }),
    { class: 'cp-ghost', 'data-ghost': machine.id }
  );
}

// ── Floor ────────────────────────────────────────────────────────────────────

function laneLoop(offset: number): Plan {
  return {
    x: LANE.west - offset,
    y: LANE.back - offset,
    w: LANE.east - LANE.west + offset * 2,
    d: LANE.front - LANE.back + offset * 2,
    r: Math.max(0.5, LANE.corner + offset)
  };
}

/** Bays beside the lane: a stop line and two short bay edges for every bay a dock has. */
/** Where a bay line meets the lane's outer edge at `x`: on the straight, or round a corner. */
function laneEdgeY(x: number, toward: number) {
  const R = LANE.corner + LANE.width / 2;
  const cy = toward > 0 ? LANE.front - LANE.corner : LANE.back + LANE.corner;
  const cx = Math.min(LANE.east - LANE.corner, Math.max(LANE.west + LANE.corner, x));
  const dx = Math.min(R, Math.abs(x - cx));
  return cy + toward * Math.sqrt(R * R - dx * dx);
}

function baysOf(machine: Machine, P: Projection) {
  if (!machine.dock) return '';
  const lines: string[] = [];
  const { s, bays } = machine.dock;
  const pose = poseAt(s);
  const toward = bayDirection(s);
  const farY = pose.y + toward * (BAY_REACH + 8);
  for (let bay = 0; bay < bays; bay++) {
    const x = pose.x + (bay - (bays - 1) / 2) * 17 * (toward < 0 ? 1 : -1);
    lines.push(lineOnTop([x - 8, laneEdgeY(x - 8, toward)], [x - 8, farY], 0.05, P), lineOnTop([x + 8, laneEdgeY(x + 8, toward)], [x + 8, farY], 0.05, P));
    lines.push(lineOnTop([x - 8, farY], [x + 8, farY], 0.05, P));
  }
  return lineSvg(lines.join(''), { tone: 'lo' });
}

/** WAL pipes from the primary to every replica, or the cascading tree. Drawn in a floor trench. */
export function walRoutes(side: SideKey, cascading: boolean) {
  const machines = WORLD[side];
  const primary = machines.find((m) => m.id === 'primary')!;
  const replicas = machines.filter((m) => m.kind === 'replica');
  const from: [number, number] = [primary.plan.x + primary.plan.w * 0.5, primary.plan.y + primary.plan.d];
  const trunkY = LANE.front + LANE.width / 2 + 3;
  const spurY = (m: Machine) => m.plan.y;
  const routes: { to: string; points: [number, number][] }[] = [];
  if (!cascading) {
    replicas.forEach((replica, index) => {
      const rx = replica.plan.x + replica.plan.w / 2 + (index - replicas.length / 2) * 0.8;
      routes.push({ to: replica.id, points: [from, [from[0], trunkY + index * 0.9], [rx, trunkY + index * 0.9], [rx, spurY(replica)]] });
    });
  } else {
    // One intermediate per region takes the WAL from the primary and relays it to its neighbour.
    const byRegion = new Map<number, Machine[]>();
    for (const replica of replicas) byRegion.set(replica.region ?? 0, [...(byRegion.get(replica.region ?? 0) ?? []), replica]);
    let lane = 0;
    for (const members of Array.from(byRegion.values())) {
      const head = members.find((m) => m.tier === 'high') ?? members[0];
      const hx = head.plan.x + head.plan.w / 2;
      routes.push({ to: head.id, points: [from, [from[0], trunkY + lane * 0.9], [hx, trunkY + lane * 0.9], [hx, spurY(head)]] });
      lane++;
      for (const member of members) {
        if (member === head) continue;
        const mx = member.plan.x + member.plan.w / 2;
        const z = head.plan.y + 4;
        routes.push({ to: member.id, points: [[hx, z], [mx, z]] });
      }
    }
  }
  return routes;
}

function walSvg(side: SideKey, P: Projection) {
  const trench = (points: [number, number][], to: string) => {
    const flat = points.map(([x, y]) => iso([x, y, 0.1], P));
    const d = pathOf(flat);
    return `<path class="iso-line cp-wal" data-to="${to}" data-tone="lo" d="${d}"/><path class="iso-line cp-wal-flow" data-to="${to}" data-tone="blue" data-flow="" d="${d}"/>`;
  };
  const fan = walRoutes(side, false)
    .map((route) => trench(route.points, route.to))
    .join('');
  const cascade = side === 'after' ? walRoutes(side, true).map((route) => trench(route.points, route.to)).join('') : '';
  return group(fan, { 'data-wal': 'fan' }) + (cascade ? group(cascade, { 'data-wal': 'cascade', 'data-hidden': '' }) : '');
}

/** Direct connections, before: a cable per few hundred connections, run behind the back row from the apps to the primary. */
function cablesSvg(side: SideKey, P: Projection) {
  if (side !== 'before') return '';
  const apps = WORLD.before.find((m) => m.id === 'apps')!;
  const primary = WORLD.before.find((m) => m.id === 'primary')!;
  const out: string[] = [];
  for (let index = 0; index < 8; index++) {
    const y = FLOOR.y + 5 + index * 1.3;
    const ax = apps.plan.x + apps.plan.w * 0.5 + index * 1.4;
    const px = primary.plan.x + 10 + index * 2;
    const d = pathOf([iso([ax, apps.plan.y, 0.4], P), iso([ax, y, 0.4], P), iso([px, y, 0.4], P), iso([px, primary.plan.y, 0.4], P)]);
    out.push(`<path class="iso-line cp-cable" data-cable="${index}" data-tone="mid" d="${d}"/>`);
  }
  return group(out.join(''), { 'data-cables': '' });
}

export function floorSvg(side: SideKey, P: Projection) {
  const parts: string[] = [];
  parts.push(`<path class="iso-halo" d="${haloOf(FLOOR, -FLOOR_H - FOOT_H, FLOOR_H, P)}"/>`);
  // Feet, then the plate.
  for (const [x, y] of corners(FLOOR, 16)) parts.push(solidSvg(cylinder(x, y, 7, -FLOOR_H - FOOT_H, FOOT_H, P, 20), { tone: 'lo' }));
  parts.push(solidSvg(slabOf(FLOOR, -FLOOR_H, FLOOR_H, P, 8, 1.4), { tone: 'mid', inner: lineSvg(sideSeam(FLOOR, -FLOOR_H + 2.4, P), { tone: 'faint' }) }));
  // Fiducials: the floor grid the trays navigate by.
  parts.push(dotsSvg(dotGrid(FLOOR.x + 14, FLOOR.y + 12, 18, 11, 28, 0, P), { size: 0.45, tone: 'lo' }));
  // Corner screws and a ruler along the front edge.
  parts.push(screws(FLOOR, 0, P, 6));
  const ticks = sideTicks(FLOOR.x + 20, FLOOR.x + FLOOR.w - 20, 10, 5, FLOOR.y + FLOOR.d, -1.6, [1.6, 3], P);
  parts.push(lineSvg(sideSeam(FLOOR, -1.6, P), { tone: 'faint' }));
  parts.push(lineSvg(ticks.minor, { tone: 'faint', free: 'end' }), lineSvg(ticks.major, { tone: 'lo', free: 'end' }));
  // Region pads, with zone tape round each.
  REGIONS[side].forEach((pad, index) => {
    parts.push(solidSvg(slabOf(pad, 0, 0.6, P, 6), { tone: 'lo', flat: true }));
    parts.push(lineSvg(planOutline(insetPlan(pad, 2.5), 0.6, P, 6), { tone: 'mid', dashed: true }));
    parts.push(dotsSvg(corners(pad, 5).map(([x, y]) => iso([x, y, 0.6], P)), { size: 0.55, tone: 'mid' }));
    parts.push(group('', { 'data-region': index }));
  });
  // The lane: outer and inner edges, a dashed centre line, and chevrons that show the way round.
  parts.push(lineSvg(planOutline(laneLoop(LANE.width / 2), 0.05, P, 8) + planOutline(laneLoop(-LANE.width / 2), 0.05, P, 8), { tone: 'mid' }));
  parts.push(lineSvg(planOutline(laneLoop(0), 0.05, P, 8), { tone: 'faint', dashed: true }));
  const chevrons: string[] = [];
  for (let s = 30; s < LOOP; s += 60) {
    const { x, y, heading } = poseAt(s);
    const fx = Math.cos(heading);
    const fy = Math.sin(heading);
    const tip: [number, number] = [x + fx * 2.5, y + fy * 2.5];
    const left: [number, number] = [x - fx * 2 - fy * 3, y - fy * 2 + fx * 3];
    const right: [number, number] = [x - fx * 2 + fy * 3, y - fy * 2 - fx * 3];
    chevrons.push(pathOf([iso([...left, 0.05], P), iso([...tip, 0.05], P), iso([...right, 0.05], P)], true));
  }
  parts.push(`<path class="iso-line cp-chevron" data-tone="lo" d="${chevrons.join('')}"/>`);
  for (const machine of WORLD[side]) if (!machine.ghost) parts.push(baysOf(machine, P));
  // A status ring painted round each machine's foot: it glows amber under strain and red when down.
  for (const machine of WORLD[side]) {
    if (machine.ghost || machine.kind === 'depot' || machine.kind === 'gate') continue;
    parts.push(`<path class="cp-ring" data-ring="${machine.id}" d="${planOutline(insetPlan(machine.plan, -4.5), 0.1, P, 6)}"/>`);
  }
  parts.push(walSvg(side, P));
  parts.push(cablesSvg(side, P));
  return parts.join('');
}

// ── Machines ─────────────────────────────────────────────────────────────────

/** The app tier: a rack of app pods, three shelves of three, each with a status LED. */
function appsSvg({ plan, h }: Machine, P: Projection) {
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('plinth');
  parts.push(plate(plan, 0, 3, P, 'lo'));
  const post = 4;
  const posts = corners(plan).map(([x, y]) => ({ x: x - (x > plan.x ? post : 0), y: y - (y > plan.y ? post : 0), w: post, d: post, r: 0.6 }));
  const backPosts = posts.filter((p) => p.y < plan.y + 1);
  const frontPosts = posts.filter((p) => p.y >= plan.y + 1);
  parts.layer('frame');
  for (const p of backPosts) parts.push(plate(p, 3, h - 3, P, 'mid', 0.3));
  parts.layer('pods');
  const shelves = 3;
  const pitch = (h - 8) / shelves;
  for (let shelf = 0; shelf < shelves; shelf++) {
    const z = 3 + shelf * pitch;
    parts.push(plate(insetPlan(plan, 1.5), z, 1.4, P, 'lo', 0.2));
    for (let column = 0; column < 3; column++) {
      const pod: Plan = { x: plan.x + 6 + column * ((plan.w - 12) / 3), y: plan.y + 8, w: (plan.w - 12) / 3 - 3, d: plan.d - 14, r: 1.2 };
      const podH = pitch - 4;
      const front = pod.y + pod.d;
      const inner = lineSvg(
        frontSlot(pod, pod.x + 2, pod.x + pod.w - 6, z + 1.4 + podH * 0.35, P, 0.4) + frontSlot(pod, pod.x + 2, pod.x + pod.w - 6, z + 1.4 + podH * 0.65, P, 0.4),
        { tone: 'faint' }
      );
      parts.push(solidSvg(slabOf(pod, z + 1.4, podH, P, 6, 0.4), { tone: 'hi', inner }));
      parts.push(led(iso([pod.x + pod.w - 3, front, z + 1.4 + podH * 0.5], P), 0.9, { 'data-led': `pod-${shelf * 3 + column}` }));
    }
  }
  parts.layer('cap');
  parts.push(plate(insetPlan(plan, -0.5), h - 2, 2.4, P, 'mid', 0.6));
  parts.push(screws(insetPlan(plan, -0.5), h + 0.4, P, 2.4));
  parts.layer('frame');
  for (const p of frontPosts) parts.push(plate(p, 3, h - 5, P, 'mid', 0.3));
  parts.layer('ports');
  // Port strip along the foot of the front: where the connections leave.
  const strip: Plan = { x: plan.x + 8, y: plan.y + plan.d, w: plan.w - 16, d: 3, r: 0.6 };
  parts.push(plate(strip, 0.5, 2.6, P, 'lo', 0.2));
  parts.push(dotsSvg(Array.from({ length: 8 }, (_, i) => iso([strip.x + 3 + i * ((strip.w - 6) / 7), strip.y + strip.d, 1.8], P)), { size: 0.45, tone: 'mid' }));
  return parts.join();
}

/**
 * The rate-limit gate on the lane: two posts, a beam, and an arm that drops when it sheds. Trays
 * pass between the posts and under the beam, so it comes in three pieces for the painter's sort.
 */
export function gatePartsOf({ plan, h }: Machine, P: Projection) {
  const parts: string[] = [];
  const back: Plan = { x: plan.x + 2, y: plan.y, w: 6, d: 4, r: 0.8 };
  const front: Plan = { x: plan.x + 2, y: plan.y + plan.d - 4, w: 6, d: 4, r: 0.8 };
  parts.push(group(plate({ ...back, x: back.x - 2, y: back.y - 2, w: 10, d: 8 }, 0, 1.5, P, 'lo') + plate(back, 1.5, h - 1.5, P, 'mid', 0.4), { 'data-part': 'gate-back' }));
  const beam: Plan = { x: plan.x + 1, y: plan.y, w: 8, d: plan.d, r: 1 };
  const arm: Plan = { x: plan.x + 3.5, y: plan.y + 4, w: 3, d: plan.d - 8, r: 0.6 };
  parts.push(
    group(
      solidSvg(slabOf(arm, h - 12, 3, P, 4, 0.3), {
        tone: 'hi',
        inner: lineSvg(Array.from({ length: 5 }, (_, i) => lineOnTop([arm.x, arm.y + 2 + i * 4], [arm.x + arm.w, arm.y + 4 + i * 4], h - 9, P)).join(''), { tone: 'red' })
      }),
      { 'data-part': 'arm' }
    )
  );
  parts.push(group(plate({ ...front, x: front.x - 2, y: front.y - 2, w: 10, d: 8 }, 0, 1.5, P, 'lo') + plate(front, 1.5, h - 1.5, P, 'mid', 0.4), { 'data-part': 'gate-front' }));
  parts.push(plate(beam, h, 4, P, 'mid', 0.6));
  parts.push(led(iso([beam.x + beam.w, beam.y + beam.d / 2, h + 2], P), 1, { 'data-led': 'gate' }));
  const wrap = (key: string, index: number, markup: string) => `<g class="cp-layer" data-layer="${index}" data-part-name="${key}">${markup}</g>`;
  return { back: wrap('posts', 0, parts[0]), top: wrap('arm', 1, parts[1]) + wrap('beam', 2, parts[3] + parts[4]), front: wrap('posts', 0, parts[2]) };
}

/** The cache: a memory body with a key plate on top, eight key pockets, and (after) a lease lock. */
function cacheSvg({ plan, h }: Machine, P: Projection, lease: boolean) {
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('body');
  const split = h - 7;
  const body = solidSvg(slabOf(plan, 0, split, P, 6, 0.8), {
    tone: 'hi',
    inner: lineSvg(sideSeam(plan, 4, P), { tone: 'faint' }) + lineSvg(Array.from({ length: 9 }, (_, i) => frontSlot(plan, plan.x + 6 + i * 5.4, plan.x + 6 + i * 5.4 + 2.5, split * 0.55, P)).join(''), { tone: 'lo' })
  });
  parts.push(body);
  parts.push(led(iso([plan.x + plan.w - 5, plan.y + plan.d, split * 0.55], P), 1, { 'data-led': 'hit' }));
  parts.layer('plate');
  const lid = insetPlan(plan, 1);
  const pockets: string[] = [];
  for (let row = 0; row < 2; row++) {
    for (let column = 0; column < 4; column++) {
      const pocket: Plan = { x: lid.x + 5 + column * 12, y: lid.y + 6 + row * 13, w: 9, d: 9, r: 1 };
      pockets.push(planOutline(pocket, h, P, 4));
    }
  }
  parts.push(
    group(
      solidSvg(slabOf(lid, split, 7, P, 6, 0.6), { tone: 'hi', inner: lineSvg(pockets.join(''), { tone: 'lo' }) }) +
        dotsSvg(Array.from({ length: 8 }, (_, i) => iso([lid.x + 9.5 + (i % 4) * 12, lid.y + 10.5 + Math.floor(i / 4) * 13, h], P)), { size: 0.7, tone: 'mid' }) +
        screws(lid, h, P, 2),
      { 'data-part': 'lid' }
    )
  );
  if (lease) {
    parts.layer('lock');
    // A padlock on the plate's right end: a body and a shackle. Its LED shows a lease held.
    const lock: Plan = { x: lid.x + lid.w - 10, y: lid.y + lid.d - 13, w: 7, d: 5, r: 1 };
    const cx = lock.x + lock.w / 2;
    const cy = lock.y + lock.d / 2;
    const shackle = pathOf(Array.from({ length: 13 }, (_, i) => {
      const a = Math.PI * (i / 12);
      return iso([cx - 2.4 * Math.cos(a), cy, h + 5 + 3 * Math.sin(a)], P);
    }));
    parts.push(group(lineSvg(shackle, { tone: 'hi' }) + solidSvg(slabOf(lock, h, 5, P, 4, 0.3), { tone: 'hi' }) + led(iso([cx, lock.y + lock.d, h + 2.2], P), 0.8, { 'data-led': 'lease' }), { 'data-part': 'lock' }));
  }
  return parts.join();
}

/**
 * PgBouncer: a Kubernetes Service (the base, with many client inlets and few server outlets) and,
 * on it, one deployment tray per replica, each holding three pods.
 */
function bouncerSvg({ plan, h }: Machine, P: Projection, deployments: number) {
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('service');
  const base = solidSvg(slabOf(plan, 0, h - 6, P, 6, 0.8), {
    tone: 'hi',
    inner:
      lineSvg(sideSeam(plan, 3, P), { tone: 'faint' }) +
      lineSvg(sideSeam(plan, (h - 6) * 0.72, P), { tone: 'faint' })
  });
  parts.push(base);
  // Many inlets on the left of the front, few outlets on the right: pooling, drawn.
  parts.push(dotsSvg(Array.from({ length: 14 }, (_, i) => iso([plan.x + 5 + (i % 7) * 3.2, plan.y + plan.d, 3 + Math.floor(i / 7) * 3], P)), { size: 0.5, tone: 'mid' }));
  parts.push(dotsSvg([0, 1].map((i) => iso([plan.x + plan.w - 12 + i * 5, plan.y + plan.d, 4.5], P)), { size: 0.9, tone: 'hi' }));
  // The pool gauge: server connections in use.
  for (let i = 0; i < 8; i++) {
    const x = plan.x + 32 + i * 3.4;
    parts.push(seg(frontSlot(plan, x, x + 2.2, (h - 6) * 0.3, P, 0.5), { 'data-seg': `pool-${i}` }));
  }
  parts.layer('deck');
  const deck = insetPlan(plan, 2);
  parts.push(plate(deck, h - 6, 1.6, P, 'mid', 0.4));
  parts.layer('deployments');
  const columns = Math.ceil(deployments / 2);
  const trayW = (deck.w - 4) / columns - 2;
  for (let index = 0; index < deployments; index++) {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const tray: Plan = { x: deck.x + 3 + column * (trayW + 2), y: deck.y + 3 + row * ((deck.d - 6) / 2), w: trayW, d: (deck.d - 6) / 2 - 2, r: 1 };
    const z = h - 4.4;
    let pods = plate(tray, z, 1.6, P, 'lo', 0.3);
    for (let pod = 0; pod < 3; pod++) {
      const cx = tray.x + tray.w * ((pod + 1) / 4);
      const cy = tray.y + tray.d / 2;
      pods += solidSvg(cylinder(cx, cy, Math.min(2.6, tray.w / 9), z + 1.6, 3.4, P, 16, 0.3), { tone: 'hi' });
    }
    parts.push(group(pods + led(iso([tray.x + tray.w, tray.y + tray.d / 2, z + 1], P), 0.6, { 'data-led': `deploy-${index}` }), { 'data-part': `deploy-${index}` }));
  }
  parts.layer('switch');
  // The pooling-mode switch: a toggle on the right face.
  const toggle: Plan = { x: plan.x + plan.w, y: plan.y + plan.d * 0.3, w: 2, d: 7, r: 0.5 };
  parts.push(plate(toggle, (h - 6) * 0.35, 3, P, 'mid', 0.2));
  return parts.join();
}

/** The dial on top of a database: where its needle pivots and how long it is. */
export const dialOf = ({ plan, h }: Machine) => ({ cx: plan.x + plan.w * 0.36, cy: plan.y + plan.d * 0.42, r: Math.min(plan.w, plan.d) * 0.2, z: h + 3.4 });

/** The CPU needle on a dial, swept from −135° (idle) to +135° (pegged). */
export function needleOf(machine: Machine, value: number, P: Projection) {
  const { cx, cy, r, z } = dialOf(machine);
  const angle = (-135 + Math.min(Math.max(value, 0), 1.2) * 225) * (Math.PI / 180);
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return pathOf([iso([cx - sx * 2, cy - sy * 2, z + 0.2], P), iso([cx + sx * r * 0.85, cy + sy * r * 0.85, z + 0.2], P)]);
}

/** The primary: a tall cabinet with a CPU dial, a column of connection-slot LEDs, and a WAL spool. */
function primarySvg(machine: Machine, P: Projection, side: SideKey) {
  const { plan, h } = machine;
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('plinth');
  parts.push(plate(insetPlan(plan, -1.5), 0, 3, P, 'lo', 0.4));
  parts.layer('cabinet');
  const units = side === 'before' ? 7 : 6;
  const pitch = (h - 6) / units;
  const seams = Array.from({ length: units - 1 }, (_, i) => sideSeam(plan, 3 + (i + 1) * pitch, P)).join('');
  // Vents on each unit's front: closed slots.
  const vents: string[] = [];
  for (let unit = 0; unit < units; unit++) {
    const z = 3 + unit * pitch + pitch * 0.5;
    for (let i = 0; i < 6; i++) vents.push(frontSlot(plan, plan.x + 6 + i * 4, plan.x + 8.4 + i * 4, z, P, 0.45));
  }
  parts.push(
    solidSvg(slabOf(plan, 3, h - 3, P, 6, 1), {
      tone: 'hi',
      inner: lineSvg(seams, { tone: 'faint' }) + lineSvg(vents.join(''), { tone: 'lo' })
    })
  );
  parts.layer('slots');
  // Connection slots: ten LEDs down the front's right side, each a tenth of the 5,000.
  for (let i = 0; i < 10; i++) {
    const z = 6 + i * ((h - 14) / 10);
    const x = plan.x + plan.w - 9;
    parts.push(seg(frontSlot(plan, x, x + 5, z, P, 0.6), { 'data-seg': `conn-${i}` }));
  }
  // The status lamp on the front.
  parts.push(led(iso([plan.x + plan.w - 4, plan.y + plan.d, h - 5], P), 1.2, { 'data-led': 'status' }));
  // Top: a lid, the CPU dial, and the WAL spool.
  parts.layer('lid');
  const lid = insetPlan(plan, -0.6);
  parts.push(plate(lid, h, 2, P, 'mid', 0.6));
  parts.push(screws(lid, h + 2, P, 2.4));
  parts.layer('dial');
  const dial = dialOf(machine);
  const ticks = radialTicks(dial.cx, dial.cy, dial.r - 1, 18, 3, dial.z, [1.2, 2.4], P, -0.75 * Math.PI, 1.5 * Math.PI);
  parts.push(
    solidSvg(cylinder(dial.cx, dial.cy, dial.r, h + 2, 1.4, P, 36, 0.4), {
      tone: 'hi',
      inner: lineSvg(ring(dial.cx, dial.cy, dial.r - 1, dial.z, P, 36), { tone: 'faint' }) + lineSvg(ticks.minor, { tone: 'lo', free: 'start' }) + lineSvg(ticks.major, { tone: 'mid', free: 'start' })
    })
  );
  parts.push(`<path class="iso-line cp-red-arc" data-tone="red" d="${pathOf(Array.from({ length: 9 }, (_, i) => {
    const a = (0.5 + (i / 8) * 0.25) * Math.PI;
    return iso([dial.cx + Math.sin(a) * (dial.r - 0.6), dial.cy - Math.cos(a) * (dial.r - 0.6), dial.z], P);
  }))}"/>`);
  parts.push(`<path class="iso-line" data-tone="lit" data-free="" data-part="needle" d="${needleOf(machine, 0, P)}"/>`);
  parts.push(dotsSvg([iso([dial.cx, dial.cy, dial.z + 0.3], P)], { size: 0.9, tone: 'hi' }));
  parts.layer('spool');
  // The WAL spool: a reel at the back right of the lid, a flange either side.
  const sx = plan.x + plan.w * 0.78;
  const sy = plan.y + plan.d * 0.3;
  parts.push(solidSvg(cylinder(sx, sy, 7, h + 2, 1, P, 28, 0.3), { tone: 'mid' }));
  parts.push(group(solidSvg(cylinder(sx, sy, 5, h + 3, 5, P, 28), { tone: 'hi', inner: lineSvg(ring(sx, sy, 5.6, h + 5.5, P, 28), { tone: 'faint' }) }), { 'data-part': 'spool' }));
  parts.push(solidSvg(cylinder(sx, sy, 7, h + 8, 1, P, 28, 0.3), { tone: 'mid' }));
  parts.push(led(iso([sx, sy, h + 9.2], P), 0.9, { 'data-led': 'wal' }));
  if (side === 'after') {
    parts.layer('digest');
    // The ORM's query-digest blocklist: a plate on the front with rule lines and a block LED.
    const digest: Plan = { x: plan.x + 4, y: plan.y + plan.d, w: 22, d: 1.4, r: 0.3 };
    parts.push(plate(digest, h - 18, 9, P, 'mid', 0.2));
    for (let i = 0; i < 3; i++) parts.push(lineSvg(segment([digest.x + 3, digest.y + digest.d, h - 15 + i * 2.2], [digest.x + 14 - i * 2, digest.y + digest.d, h - 15 + i * 2.2], P), { tone: 'lo', free: true }));
    parts.push(led(iso([digest.x + 19, digest.y + digest.d, h - 13.5], P), 0.9, { 'data-led': 'digest' }));
    parts.layer('plaque');
    // The policy plaque on the right face: five rules, a line each.
    const plaqueY0 = plan.y + 10;
    const plaqueY1 = plan.y + plan.d - 10;
    const plaque = [0, 1, 2, 3, 4].map((i) => rightLine(plan, plaqueY0 + 2, plaqueY1 - 6 - (i % 2) * 6, h - 14 - i * 3.2, P)).join('');
    const face = plan.x + plan.w;
    const border = pathOf([iso([face, plaqueY0, h - 9], P), iso([face, plaqueY1, h - 9], P), iso([face, plaqueY1, h - 30], P), iso([face, plaqueY0, h - 30], P)], true);
    parts.push(lineSvg(border, { tone: 'mid' }));
    parts.push(lineSvg(plaque, { tone: 'lo', free: true }));
  }
  return parts.join();
}

/** The hot standby: a shorter twin with a sync cable from the primary and a role lamp. */
function standbySvg({ plan, h }: Machine, P: Projection, primary: Machine) {
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('plinth');
  parts.push(plate(insetPlan(plan, -1.2), 0, 3, P, 'lo', 0.4));
  parts.layer('cabinet');
  const seams = [1, 2, 3, 4].map((i) => sideSeam(plan, 3 + i * ((h - 3) / 5), P)).join('');
  parts.push(solidSvg(slabOf(plan, 3, h - 3, P, 6, 1), { tone: 'hi', inner: lineSvg(seams, { tone: 'faint' }) }));
  parts.push(led(iso([plan.x + plan.w - 4, plan.y + plan.d, h - 5], P), 1.2, { 'data-led': 'role' }));
  parts.layer('lid');
  parts.push(plate(insetPlan(plan, -0.5), h, 2, P, 'mid', 0.5));
  // The sync cable: from the primary's lid, over the gap, onto the standby's lid.
  const from: Point3 = [primary.plan.x + primary.plan.w - 3, primary.plan.y + primary.plan.d * 0.7, primary.h + 2];
  const to: Point3 = [plan.x + 4, plan.y + plan.d * 0.7, h + 2];
  const mid: Point3 = [(from[0] + to[0]) / 2, from[1], Math.max(from[2], to[2]) + 6];
  const curve = Array.from({ length: 13 }, (_, i) => {
    const t = i / 12;
    const a = (1 - t) * (1 - t);
    const b = 2 * (1 - t) * t;
    const c = t * t;
    return iso([a * from[0] + b * mid[0] + c * to[0], a * from[1] + b * mid[1] + c * to[1], a * from[2] + b * mid[2] + c * to[2]], P);
  });
  parts.push(`<g class="iso-wire" data-tone="mid"><path class="iso-line cp-sync" data-tone="mid" data-flow="" d="${pathOf(curve)}"/><circle class="iso-wire-end" cx="${curve[0][0].toFixed(1)}" cy="${curve[0][1].toFixed(1)}" r="1"/><circle class="iso-wire-end" cx="${curve[12][0].toFixed(1)}" cy="${curve[12][1].toFixed(1)}" r="1"/></g>`);
  return parts.join();
}

/** Azure Cosmos DB, the sharded system: a frame of partition modules, three across and four high. */
function cosmosSvg({ plan, h }: Machine, P: Projection) {
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('plinth');
  parts.push(plate(insetPlan(plan, -1.2), 0, 3, P, 'lo', 0.4));
  parts.layer('modules');
  const rows = 4;
  const columns = 3;
  const pitchZ = (h - 6) / rows;
  const pitchX = (plan.w - 6) / columns;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const module: Plan = { x: plan.x + 3 + column * pitchX + 0.6, y: plan.y + 3, w: pitchX - 1.2, d: plan.d - 6, r: 1 };
      const z = 3 + row * pitchZ + 0.6;
      parts.push(solidSvg(slabOf(module, z, pitchZ - 1.2, P, 4, 0.4), { tone: 'hi', inner: lineSvg(frontSlot(module, module.x + 2, module.x + module.w - 6, z + pitchZ * 0.4, P, 0.4), { tone: 'faint' }) }));
      parts.push(led(iso([module.x + module.w - 3, module.y + module.d, z + (pitchZ - 1.2) / 2], P), 0.75, { 'data-led': `shard-${row * columns + column}` }));
    }
  }
  parts.layer('frame');
  // Frame uprights at the front corners, and a cap.
  for (const x of [plan.x, plan.x + plan.w - 2.4]) parts.push(plate({ x, y: plan.y + plan.d - 2.4, w: 2.4, d: 2.4, r: 0.4 }, 3, h - 3, P, 'mid', 0.2));
  parts.push(plate(insetPlan(plan, -0.6), h, 2.4, P, 'mid', 0.6));
  parts.push(rules(insetPlan(plan, 6), h + 2.4, P));
  return parts.join();
}

/** A read replica: a cabinet with a WAL receiver on its lid, a lag dial, a load bar and a tier stripe. */
function replicaSvg(machine: Machine, P: Projection) {
  const { plan, h, tier } = machine;
  const parts = layers();
  parts.push(`<path class="iso-halo" d="${haloOf(plan, 0, h, P)}"/>`);
  parts.layer('plinth');
  parts.push(plate(insetPlan(plan, -1), 0, 2.4, P, 'lo', 0.3));
  parts.layer('cabinet');
  const seams = [1, 2, 3].map((i) => sideSeam(plan, 2.4 + i * ((h - 2.4) / 4), P)).join('');
  const vents = Array.from({ length: 4 }, (_, i) => frontSlot(plan, plan.x + 5 + i * 3.6, plan.x + 7 + i * 3.6, h * 0.62, P, 0.45)).join('');
  parts.push(solidSvg(slabOf(plan, 2.4, h - 2.4, P, 6, 0.8), { tone: 'hi', inner: lineSvg(seams, { tone: 'faint' }) + lineSvg(vents, { tone: 'lo' }) }));
  for (let i = 0; i < 5; i++) {
    const z = 6 + i * 3.4;
    parts.push(seg(frontSlot(plan, plan.x + plan.w - 9, plan.x + plan.w - 4, z, P, 0.6), { 'data-seg': `load-${i}` }));
  }
  parts.push(led(iso([plan.x + 4, plan.y + plan.d, h - 4], P), 1, { 'data-led': 'status' }));
  parts.layer('lid');
  parts.push(plate(insetPlan(plan, -0.4), h, 1.8, P, 'mid', 0.5));
  if (tier) {
    // High tier: a solid stripe; low tier: a dashed one.
    const y = plan.y + plan.d - 2.5;
    parts.push(lineSvg(lineOnTop([plan.x - 0.4, y], [plan.x + plan.w + 0.4, y], h + 1.8, P), { tone: tier === 'high' ? 'blue' : 'mid', dashed: tier === 'low' }));
  }
  parts.layer('port');
  // WAL receiver: a small port on the lid's back edge, where the trench comes up.
  const port = cylinder(plan.x + plan.w / 2, plan.y + 5, 2.4, h + 1.8, 2.4, P, 16, 0.3);
  parts.push(solidSvg(port, { tone: 'mid' }));
  parts.layer('dial');
  // The lag dial.
  const cx = plan.x + plan.w * 0.42;
  const cy = plan.y + plan.d * 0.6;
  const ticks = radialTicks(cx, cy, 5.2, 8, 4, h + 3.1, [0.8, 1.6], P, -0.75 * Math.PI, 1.5 * Math.PI);
  parts.push(solidSvg(cylinder(cx, cy, 6, h + 1.8, 1.3, P, 28, 0.3), { tone: 'hi', inner: lineSvg(ring(cx, cy, 5.2, h + 3.1, P, 28), { tone: 'faint' }) + lineSvg(ticks.minor + ticks.major, { tone: 'lo', free: 'start' }) }));
  parts.push(`<path class="iso-line" data-tone="lit" data-free="" data-part="lag" d=""/>`);
  parts.push(dotsSvg([iso([cx, cy, h + 3.2], P)], { size: 0.6, tone: 'hi' }));
  return parts.join();
}

/** The lag needle on a replica's dial. */
export function lagNeedleOf({ plan, h }: Machine, value: number, P: Projection) {
  const cx = plan.x + plan.w * 0.42;
  const cy = plan.y + plan.d * 0.6;
  const angle = (-135 + Math.min(Math.max(value, 0), 1) * 270) * (Math.PI / 180);
  const sx = Math.sin(angle);
  const sy = -Math.cos(angle);
  return pathOf([iso([cx, cy, h + 3.2], P), iso([cx + sx * 4.4, cy + sy * 4.4, h + 3.2], P)]);
}

/** The depot: charging pads, each with two contact strips and a lamp. */
function depotSvg({ plan }: Machine, P: Projection) {
  const parts = layers();
  parts.layer('deck');
  parts.push(solidSvg(slabOf(plan, 0, 1.2, P, 6, 0.3), { tone: 'mid', inner: rules({ x: plan.x + 3, y: plan.y + plan.d - 8, w: 24, d: 7, r: 0 }, 1.2, P, 2) }));
  parts.layer('pads');
  // One pad under each bay: a tray parked in bay 0 stands at DEPOT_X + 17, bay 2 at DEPOT_X − 17.
  const bayY = LANE.front + BAY_REACH;
  for (let pad = 0; pad < DEPOT_PADS; pad++) {
    const x = DEPOT_X + (1 - pad) * 17;
    const padPlan: Plan = { x: x - 7.5, y: bayY - 8, w: 15, d: 16, r: 2 };
    parts.push(solidSvg(slabOf(padPlan, 1.2, 0.8, P, 6, 0.2), { tone: 'lo' }));
    parts.push(lineSvg(planOutline({ x: x - 3.6, y: padPlan.y + 4, w: 1.2, d: 9, r: 0.3 }, 2, P, 2) + planOutline({ x: x + 2.4, y: padPlan.y + 4, w: 1.2, d: 9, r: 0.3 }, 2, P, 2), { tone: 'mid' }));
    parts.push(led(iso([x, padPlan.y + padPlan.d + 1, 1.6], P), 0.8, { 'data-led': `pad-${pad}` }));
  }
  return parts.join();
}

export function machineSvg(side: SideKey, machine: Machine, P: Projection) {
  if (machine.ghost) return ghostSvg(machine, P);
  const primary = WORLD[side].find((m) => m.id === 'primary')!;
  switch (machine.kind) {
    case 'apps':
      return appsSvg(machine, P);
    case 'gate': {
      const gate = gatePartsOf(machine, P);
      return gate.back + gate.top + gate.front;
    }
    case 'cache':
      return cacheSvg(machine, P, side === 'after');
    case 'bouncer':
      return bouncerSvg(machine, P, WORLD[side].filter((m) => m.kind === 'replica').length);
    case 'primary':
      return primarySvg(machine, P, side);
    case 'standby':
      return standbySvg(machine, P, primary);
    case 'cosmos':
      return cosmosSvg(machine, P);
    case 'replica':
      return replicaSvg(machine, P);
    case 'depot':
      return depotSvg(machine, P);
  }
}
