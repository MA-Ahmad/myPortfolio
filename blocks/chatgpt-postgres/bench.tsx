'use client';

import * as React from 'react';
import { floorSvg, gatePartsOf, lagNeedleOf, machineSvg, needleOf } from './art';
import { Fleet, type FleetContext, type Tray } from './fleet';
import { iso, translateAlong, type Projection } from './iso-kit';
import { orderOf, type Box } from './order';
import { BODY_R, DECK_LIFT, TRAY_TOP, columnOf, eyeOf, lampOf, robotArt, type RobotArt } from './robot';
import { PUBLISHED } from './facts';
import type { SideKey } from './sim';
import { HEIGHT, ROLES, WIDTH, WORLD, projectionAt, type Kind, type Machine } from './world';

/**
 * One floor: its machines, its lane and its fleet of trays. It renders an empty SVG once; the
 * markup comes in through refs when the camera is set, and every frame only writes attributes.
 */

export type BenchHandle = {
  /** Build every part for this camera. */
  draw: (P: Projection) => void;
  /** Move the trays and light the machines for this instant. */
  frame: (dt: number, ctx: FleetContext) => void;
  reset: () => void;
  /** The machine under a point on screen, front-most first. */
  machineAt: (clientX: number, clientY: number) => Machine | null;
  /** The tray under a point on screen. */
  trayAt: (clientX: number, clientY: number) => Tray | null;
  fleet: () => Fleet;
  svg: () => SVGSVGElement | null;
  /** Set the view box: the zoom and pan. `scale` keeps the pins one size on screen. */
  view: (box: [number, number, number, number], scale: number) => void;
  /** Light one role's machines and dim the rest; null lights everything. */
  focus: (kind: Kind | null) => void;
  /** The numbered pin under a point on screen. */
  pinAt: (clientX: number, clientY: number) => Kind | null;
  /** Where a role's pin stands, in view-box units. */
  anchorOf: (kind: Kind) => [number, number] | null;
  /** The visible floor paints every frame; the hidden one only keeps its fleet moving. */
  setActive: (active: boolean) => void;
};

type Item = { key: string; node: SVGGElement; box: () => Box };

/** A floor's static markup for one camera. */
type Markup = {
  floor: string;
  machines: Map<string, string>;
  gates: Map<string, ReturnType<typeof gatePartsOf>>;
  robot: RobotArt;
};

// Building the markup is most of a redraw. Turning draws at whole degrees, so each angle is built
// once and revisited from here.
const MARKUP: Record<SideKey, Map<number, Markup>> = { before: new Map(), after: new Map() };

function markupOf(side: SideKey, P: Projection): Markup {
  const cached = MARKUP[side].get(P.azimuth);
  if (cached) return cached;
  const machines = new Map<string, string>();
  const gates = new Map<string, ReturnType<typeof gatePartsOf>>();
  for (const machine of WORLD[side]) {
    if (machine.kind === 'gate' && !machine.ghost) gates.set(machine.id, gatePartsOf(machine, P));
    else machines.set(machine.id, machineSvg(side, machine, P));
  }
  const markup = { floor: floorSvg(side, P), machines, gates, robot: robotArt(P) };
  if (Number.isInteger(P.azimuth)) MARKUP[side].set(P.azimuth, markup);
  return markup;
}

/** Build one angle's markup ahead of a turn; false once it was already there. */
export function prepare(side: SideKey, azimuth: number) {
  if (MARKUP[side].has(azimuth)) return false;
  markupOf(side, projectionAt(azimuth));
  return true;
}

const NS = 'http://www.w3.org/2000/svg';

const make = (name: string, attrs: Record<string, string> = {}) => {
  const node = document.createElementNS(NS, name);
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

/** Set an attribute only when it changes; most frames change little. */
function put(node: Element | null | undefined, name: string, value: string | null) {
  if (!node) return;
  if (value === null) {
    if (node.hasAttribute(name)) node.removeAttribute(name);
  } else if (node.getAttribute(name) !== value) node.setAttribute(name, value);
}

const boxOf = (machine: Machine, extra = 12): Box => [
  machine.plan.x,
  machine.plan.x + machine.plan.w,
  machine.plan.y,
  machine.plan.y + machine.plan.d,
  0,
  machine.h + extra
];

type Live = {
  needle?: SVGPathElement | null;
  lag?: SVGPathElement | null;
  segs: Map<string, Element>;
  leds: Map<string, Element>;
  parts: Map<string, Element>;
};

type Props = {
  side: SideKey;
  label: string;
};

export const Bench = React.memo(
  React.forwardRef<BenchHandle, Props>(function Bench({ side, label }, handle) {
    const svgRef = React.useRef<SVGSVGElement>(null);
    const floorRef = React.useRef<SVGGElement>(null);
    const itemsRef = React.useRef<SVGGElement>(null);
    const pinsRef = React.useRef<SVGGElement>(null);
    const fleet = React.useRef<Fleet | null>(null);
    if (!fleet.current) fleet.current = new Fleet(side);
    const state = React.useRef({
      P: null as Projection | null,
      items: [] as Item[],
      order: '',
      machines: new Map<string, { node: SVGGElement; live: Live; machine: Machine }>(),
      trays: [] as { node: SVGGElement; deck: SVGGElement; column: SVGGElement; eye: SVGCircleElement; lamp: SVGPathElement; lift: number; slip: string }[],
      robot: null as ReturnType<typeof robotArt> | null,
      pins: [] as { kind: Kind; node: SVGGElement; at: [number, number] }[],
      pinScale: 1,
      active: true,
      focus: null as Kind | null
    });

    const draw = React.useCallback(
      (P: Projection) => {
        const s = state.current;
        const floor = floorRef.current;
        const items = itemsRef.current;
        if (!floor || !items) return;
        s.P = P;
        const markup = markupOf(side, P);
        floor.innerHTML = markup.floor;
        items.textContent = '';
        s.items = [];
        s.machines.clear();
        const collect = (node: Element): Live => ({
          needle: node.querySelector<SVGPathElement>('[data-part="needle"]'),
          lag: node.querySelector<SVGPathElement>('[data-part="lag"]'),
          segs: new Map(Array.from(node.querySelectorAll('[data-seg]')).map((el) => [el.getAttribute('data-seg')!, el])),
          leds: new Map(Array.from(node.querySelectorAll('[data-led]')).map((el) => [el.getAttribute('data-led')!, el])),
          parts: new Map(Array.from(node.querySelectorAll('[data-part]')).map((el) => [el.getAttribute('data-part')!, el]))
        });
        for (const machine of WORLD[side]) {
          if (machine.kind === 'depot') {
            // Flat on the floor: drawn with it, under the trays that park on it.
            const node = make('g', { 'data-machine': machine.id }) as SVGGElement;
            node.innerHTML = markup.machines.get(machine.id)!;
            floor.appendChild(node);
            s.machines.set(machine.id, { node, live: collect(node), machine });
            continue;
          }
          if (machine.kind === 'gate' && !machine.ghost) {
            const parts = markup.gates.get(machine.id)!;
            const { plan, h } = machine;
            const holder = make('g', { 'data-machine': machine.id }) as SVGGElement;
            const pieces: [string, string, Box][] = [
              ['back', parts.back, [plan.x, plan.x + plan.w, plan.y - 2, plan.y + 6, 0, h]],
              ['front', parts.front, [plan.x, plan.x + plan.w, plan.y + plan.d - 6, plan.y + plan.d + 2, 0, h]],
              ['top', parts.top, [plan.x, plan.x + plan.w, plan.y, plan.y + plan.d, h - 13, h + 5]]
            ];
            for (const [key, markup, box] of pieces) {
              const node = make('g', { 'data-machine': `${machine.id}-${key}` }) as SVGGElement;
              node.innerHTML = markup;
              holder.appendChild(node);
              s.items.push({ key: `${machine.id}-${key}`, node, box: () => box });
            }
            s.machines.set(machine.id, { node: holder, live: collect(holder), machine });
            continue;
          }
          const node = make('g', { 'data-machine': machine.id, class: 'cp-machine' }) as SVGGElement;
          if (machine.ghost) node.setAttribute('data-ghosted', '');
          node.innerHTML = markup.machines.get(machine.id)!;
          const box = boxOf(machine, machine.kind === 'primary' ? 14 : 8);
          s.items.push({ key: machine.id, node, box: () => box });
          s.machines.set(machine.id, { node, live: collect(node), machine });
        }
        // Trays: the same markup for every one, parsed once, copied and moved into place.
        const art = markup.robot;
        s.robot = art;
        const base0 = make('g');
        base0.innerHTML = art.base;
        const deck0 = make('g', { class: 'cp-deck' });
        deck0.innerHTML = `${art.deck}<g data-slip="read">${art.slip}</g><g data-slip="join">${art.bundle}</g>`;
        s.trays = fleet.current!.trays.map((tray) => {
          const node = make('g', { class: 'cp-tray', 'data-tray': String(tray.id) }) as SVGGElement;
          const base = base0.cloneNode(true);
          const lamp = make('path', { class: 'iso-line cp-lamp', d: '' }) as SVGPathElement;
          const eye = make('circle', { class: 'cp-eye', r: '0.75' }) as SVGCircleElement;
          const column = make('g') as SVGGElement;
          const deck = deck0.cloneNode(true) as SVGGElement;
          node.append(base, lamp, eye, column, deck);
          return { node, deck, column, eye, lamp, lift: -1, slip: '' };
        });
        fleet.current!.trays.forEach((tray, index) => {
          const view = s.trays[index];
          s.items.push({
            key: `tray-${tray.id}`,
            node: view.node,
            box: () => [tray.x - BODY_R - 0.5, tray.x + BODY_R + 0.5, tray.y - BODY_R - 0.5, tray.y + BODY_R + 0.5, 0, TRAY_TOP]
          });
        });
        for (const item of s.items) items.appendChild(item.node);
        // Numbered pins over the machines: one per role, the same number on both floors.
        const pins = pinsRef.current;
        s.pins = [];
        if (pins) {
          pins.textContent = '';
          for (const role of ROLES) {
            const machine = WORLD[side].find((m) => m.id === role.pin[side]);
            if (!machine) continue;
            const { plan, h } = machine;
            const top = machine.kind === 'depot' ? 3 : h + (machine.kind === 'primary' ? 12 : machine.kind === 'gate' ? 6 : 5);
            const at = iso([plan.x + plan.w / 2, plan.y + plan.d / 2, top], P) as [number, number];
            const node = make('g', { class: 'cp-pin', 'data-kind': role.kind }) as SVGGElement;
            if (machine.ghost) node.setAttribute('data-missing', '');
            node.innerHTML = `<path class="cp-pin-stem" d="M0 0V-13"/><circle class="cp-pin-dot" r="1.6"/><circle class="cp-pin-head" cy="-21" r="8"/><text class="cp-pin-text" y="-17.6" text-anchor="middle">${role.n}</text>`;
            pins.appendChild(node);
            s.pins.push({ kind: role.kind, node, at });
          }
          placePins();
        }
        s.order = '';
        applyFocus();
        paint();
      },
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [side]
    );

    const placePins = () => {
      const s = state.current;
      const k = 1 / s.pinScale;
      for (const pin of s.pins) pin.node.setAttribute('transform', `translate(${pin.at[0].toFixed(1)} ${pin.at[1].toFixed(1)}) scale(${k.toFixed(3)})`);
    };

    const applyFocus = () => {
      const s = state.current;
      const items = itemsRef.current;
      if (!items) return;
      put(items, 'data-focus', s.focus ? '' : null);
      put(pinsRef.current, 'data-focus', s.focus ? '' : null);
      for (const { node, machine } of Array.from(s.machines.values())) {
        const lit = s.focus === machine.kind;
        put(node, 'data-focused', lit ? '' : null);
        // The gate is three pieces; light each.
        node.querySelectorAll?.('[data-machine]').forEach((piece) => put(piece, 'data-focused', lit ? '' : null));
      }
      for (const item of s.items) {
        const id = item.key.replace(/-(back|front|top)$/, '');
        const machine = WORLD[side].find((m) => m.id === id);
        put(item.node, 'data-focused', machine && s.focus === machine.kind ? '' : null);
      }
      for (const pin of s.pins) put(pin.node, 'data-focused', s.focus === pin.kind ? '' : null);
    };

    /** Write the trays' places and the machines' lamps, then sort. */
    const paint = (ctx?: FleetContext) => {
      const s = state.current;
      const P = s.P;
      const f = fleet.current!;
      if (!P || !s.active) return;
      f.trays.forEach((tray, index) => {
        const view = s.trays[index];
        if (!view) return;
        put(view.node, 'transform', translateAlong(P, [tray.x, tray.y, 0]));
        put(view.node, 'data-lamp', tray.lamp);
        const lift = Math.round(tray.lift * 20) / 20;
        if (lift !== view.lift) {
          view.lift = lift;
          put(view.deck, 'transform', lift ? translateAlong(P, [0, 0, lift * DECK_LIFT]) : null);
          view.column.innerHTML = columnOf(lift * DECK_LIFT, P);
        }
        const slip = tray.slip === 'void' ? `${tray.job?.kind === 'join' ? 'join' : 'read'} void` : tray.slip;
        if (slip !== view.slip) {
          view.slip = slip;
          put(view.node, 'data-slip', slip);
        }
        put(view.node, 'data-kind', tray.job?.kind ?? null);
        put(view.node, 'data-tier', tray.job?.tier ?? null);
        const eye = eyeOf(tray.heading, P);
        put(view.eye, 'cx', eye.x.toFixed(1));
        put(view.eye, 'cy', eye.y.toFixed(1));
        put(view.eye, 'data-hidden', eye.shown ? null : '');
        put(view.lamp, 'd', lampOf(tray.heading, P));
      });
      if (ctx) light(ctx);
      sort();
    };

    const sort = () => {
      const s = state.current;
      const P = s.P;
      const items = itemsRef.current;
      if (!P || !items) return;
      const order = orderOf(
        s.items.map((item) => item.box()),
        P
      );
      const key = order.join(',');
      if (key === s.order) return;
      s.order = key;
      for (const index of order) items.appendChild(s.items[index].node);
    };

    /** How each machine is doing, for its ring and its pin: fine, strained, down, or promoted. */
    const conditionOf = (machine: Machine, { sim, load }: FleetContext): 'ok' | 'hot' | 'down' | 'promoted' => {
      switch (machine.kind) {
        case 'primary':
          if (load.primaryDown > 0.5) return 'down';
          return sim.cpu > 0.95 ? 'down' : sim.cpu > 0.7 ? 'hot' : 'ok';
        case 'standby':
          return load.primaryDown > 0.5 ? (sim.primaryUp ? 'promoted' : 'hot') : 'ok';
        case 'cache':
          return load.miss > 0.5 ? 'hot' : 'ok';
        case 'replica': {
          if (fleet.current!.downReplica === machine.id) return 'down';
          const cpu = machine.tier === 'low' ? sim.lowCpu : sim.replicaCpu;
          return cpu > 0.95 ? 'down' : cpu > 0.7 ? 'hot' : 'ok';
        }
        case 'apps':
          return sim.errors > 0.3 ? 'down' : sim.errors > 0.02 || sim.p99 > 140 ? 'hot' : 'ok';
        case 'bouncer':
          return sim.connections > 1800 ? 'hot' : 'ok';
        case 'gate':
          return sim.shed > 0.02 ? 'hot' : 'ok';
        default:
          return 'ok';
      }
    };

    /** The machines' lamps, dials and gauges from the model and the fleet. */
    const light = (ctx: FleetContext) => {
      const { sim, cascading } = ctx;
      const s = state.current;
      const P = s.P!;
      const f = fleet.current!;
      const recent = (id: string, within = 0.35) => f.time - (f.pulses.get(id) ?? -10) < within;
      // Rings round the machines, and the pins over them, say how each one is doing.
      const rank = { ok: 0, promoted: 1, hot: 2, down: 3 } as const;
      const byKind = new Map<string, keyof typeof rank>();
      for (const { machine } of Array.from(s.machines.values())) {
        if (machine.ghost) continue;
        const condition = conditionOf(machine, ctx);
        put(floorRef.current?.querySelector(`[data-ring="${machine.id}"]`), 'data-state', condition === 'ok' ? null : condition);
        const worst = byKind.get(machine.kind);
        if (!worst || rank[condition] > rank[worst]) byKind.set(machine.kind, condition);
      }
      for (const pin of s.pins) {
        const condition = byKind.get(pin.kind);
        put(pin.node, 'data-state', condition && condition !== 'ok' ? condition : null);
      }
      for (const { live, machine, node } of Array.from(s.machines.values())) {
        switch (machine.kind) {
          case 'primary': {
            if (!live.needle) break;
            put(live.needle, 'd', needleOf(machine, sim.primaryUp ? sim.cpu : 0, P));
            const lit = Math.round((sim.connections / PUBLISHED.connectionLimit) * 10);
            for (let i = 0; i < 10; i++) put(live.segs.get(`conn-${i}`), 'data-on', i < lit ? (lit >= 10 ? 'full' : i >= 7 ? 'hot' : 'on') : null);
            put(live.leds.get('status'), 'data-state', !sim.primaryUp ? 'down' : sim.cpu > 0.95 ? 'hot' : recent('primary') ? 'busy' : 'ok');
            put(live.leds.get('wal'), 'data-state', sim.wal > 0.7 ? 'hot' : sim.wal > 0.05 ? 'busy' : 'ok');
            put(live.leds.get('digest'), 'data-state', recent('primary', 0.6) && f.trays.some((t) => t.job?.fail?.how === 'blocked' && t.lamp === 'fail') ? 'down' : 'ok');
            put(node, 'data-down', ctx.load.primaryDown > 0.5 ? '' : null);
            put(node, 'data-promoted', null);
            break;
          }
          case 'standby':
            put(live.leds.get('role'), 'data-state', sim.promoting > 0 ? 'hot' : ctx.load.primaryDown > 0.5 && sim.primaryUp ? 'busy' : 'ok');
            break;
          case 'replica': {
            const down = f.downReplica === machine.id;
            const cpu = machine.tier === 'low' ? sim.lowCpu : sim.replicaCpu;
            const lit = down ? 0 : Math.min(5, Math.round(cpu * 5 + (recent(machine.id) ? 1 : 0)));
            for (let i = 0; i < 5; i++) put(live.segs.get(`load-${i}`), 'data-on', i < lit ? (cpu > 0.9 ? 'full' : i >= 3 ? 'hot' : 'on') : null);
            put(live.leds.get('status'), 'data-state', down ? 'down' : recent(machine.id) ? 'busy' : 'ok');
            put(node, 'data-down', down ? '' : null);
            if (live.lag) put(live.lag, 'd', lagNeedleOf(machine, Math.min(1, sim.lag / 400), P));
            break;
          }
          case 'cache':
            put(live.leds.get('hit'), 'data-state', ctx.load.miss > 0.5 ? 'hot' : recent('cache') ? 'busy' : 'ok');
            put(live.leds.get('lease'), 'data-state', f.leaseHolder !== null ? 'busy' : recent('refill', 0.5) ? 'ok' : 'idle');
            break;
          case 'bouncer': {
            const lit = Math.max(1, Math.round((sim.connections / (PUBLISHED.connectionLimit * 0.4)) * 8));
            for (let i = 0; i < 8; i++) put(live.segs.get(`pool-${i}`), 'data-on', i < lit ? 'on' : null);
            live.leds.forEach((el) => put(el, 'data-state', recent('bouncer') ? 'busy' : 'ok'));
            break;
          }
          case 'cosmos': {
            const busy = recent('cosmos', 0.6);
            live.leds.forEach((el, key) => put(el, 'data-state', busy && (Number(key.split('-')[1]) + Math.floor(f.time * 6)) % 4 === 0 ? 'busy' : 'ok'));
            break;
          }
          case 'gate': {
            const shedding = recent('gate', 0.7);
            const arm = live.parts.get('arm');
            put(arm, 'transform', shedding ? translateAlong(P, [0, 0, -9]) : null);
            put(live.leds.get('gate'), 'data-state', shedding ? 'down' : 'ok');
            break;
          }
          case 'apps':
            live.leds.forEach((el, key) => put(el, 'data-state', sim.errors > 0.3 && Number(key.split('-')[1]) % 2 === 0 ? 'down' : recent('apps', 0.3) ? 'busy' : 'ok'));
            break;
          case 'depot': {
            const dock = f.docks.get('depot')!;
            dock.taken.forEach((id, pad) => put(live.leds.get(`pad-${pad}`), 'data-state', id === null ? 'idle' : 'charge'));
            break;
          }
        }
      }
      // WAL: which set of pipes is live, and whether they are under pressure.
      const floor = floorRef.current;
      if (floor) {
        put(floor.querySelector('[data-wal="fan"]'), 'data-hidden', cascading && side === 'after' ? '' : null);
        put(floor.querySelector('[data-wal="cascade"]'), 'data-hidden', cascading && side === 'after' ? null : '');
        put(floor, 'data-wal-state', sim.wal > 0.75 ? 'hot' : sim.wal > 0.5 ? 'warm' : 'ok');
        put(floor, 'data-primary', sim.primaryUp ? null : 'down');
        const cables = Math.round((sim.connections / PUBLISHED.connectionLimit) * 8);
        floor.querySelectorAll('[data-cable]').forEach((el, index) => put(el, 'data-on', index < cables ? (cables >= 8 ? 'full' : cables >= 6 ? 'hot' : 'on') : null));
      }
    };

    const frame = React.useCallback((dt: number, ctx: FleetContext) => {
      fleet.current!.step(dt, ctx);
      paint(ctx);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const toLocal = (clientX: number, clientY: number) => {
      const svg = svgRef.current;
      const matrix = svg?.getScreenCTM();
      if (!svg || !matrix) return null;
      return new DOMPoint(clientX, clientY).matrixTransform(matrix.inverse());
    };

    React.useImperativeHandle(
      handle,
      () => ({
        draw,
        frame,
        reset: () => {
          fleet.current!.reset();
          paint();
        },
        machineAt: (clientX, clientY) => {
          const point = toLocal(clientX, clientY);
          if (!point) return null;
          const s = state.current;
          // The front-most machine whose drawing holds the point.
          const order = s.order.split(',').map(Number);
          for (let k = order.length - 1; k >= 0; k--) {
            const item = s.items[order[k]];
            if (!item || item.key.startsWith('tray-')) continue;
            const box = item.node.getBBox();
            if (point.x >= box.x && point.x <= box.x + box.width && point.y >= box.y && point.y <= box.y + box.height) {
              const id = item.key.replace(/-(back|front|top)$/, '');
              const machine = WORLD[side].find((m) => m.id === id);
              if (machine && !machine.ghost) return machine;
            }
          }
          return null;
        },
        trayAt: (clientX, clientY) => {
          const point = toLocal(clientX, clientY);
          const s = state.current;
          if (!point || !s.P) return null;
          for (const tray of fleet.current!.trays) {
            const box = s.trays[tray.id]?.node.getBBox();
            const matrix = s.trays[tray.id]?.node.transform.baseVal.consolidate()?.matrix;
            if (!box || !matrix) continue;
            const x = point.x - matrix.e;
            const y = point.y - matrix.f;
            if (x >= box.x && x <= box.x + box.width && y >= box.y && y <= box.y + box.height) return tray;
          }
          return null;
        },
        fleet: () => fleet.current!,
        svg: () => svgRef.current,
        view: (box, scale) => {
          const text = box.map((value) => Math.round(value * 100) / 100).join(' ');
          put(svgRef.current, 'viewBox', text);
          const s = state.current;
          if (Math.abs(s.pinScale - scale) > 1e-3) {
            s.pinScale = scale;
            placePins();
          }
        },
        focus: (kind) => {
          state.current.focus = kind;
          applyFocus();
        },
        pinAt: (clientX, clientY) => {
          const point = toLocal(clientX, clientY);
          const s = state.current;
          if (!point) return null;
          const k = 1 / s.pinScale;
          let best: Kind | null = null;
          let bestD = 11 * k;
          for (const pin of s.pins) {
            const d = Math.hypot(point.x - pin.at[0], point.y - (pin.at[1] - 21 * k));
            if (d < bestD) {
              bestD = d;
              best = pin.kind;
            }
          }
          return best;
        },
        anchorOf: (kind) => state.current.pins.find((pin) => pin.kind === kind)?.at ?? null,
        setActive: (active) => {
          const s = state.current;
          s.active = active;
          if (active) {
            s.order = '';
            s.trays.forEach((view) => (view.lift = -1));
          }
        }
      }),
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [draw, frame, side]
    );

    return (
      <svg ref={svgRef} className="iso-svg cp-svg" viewBox={`0 0 ${WIDTH} ${HEIGHT}`} role="img" aria-label={label} focusable="false" data-side={side}>
        <g ref={floorRef} className="cp-floor" />
        <g ref={itemsRef} className="cp-items" />
        <g ref={pinsRef} className="cp-pins" aria-hidden="true" />
      </svg>
    );
  })
);
