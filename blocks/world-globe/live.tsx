'use client';

import * as React from 'react';
import { geoGraticule, geoOrthographic, geoPath } from 'd3-geo';
import { useInView, useLoop, useReadout } from './iso-react';
import {
  CENTER,
  COUNTRIES,
  EARTH_TILT,
  HOVER,
  LIFT,
  PLATE,
  R,
  RING_H,
  RING_IN,
  RING_OUT,
  TILT_MAX,
  TILT_MIN,
  add,
  apply,
  applyT,
  basisOf,
  cross,
  describe,
  dot,
  facingPoint,
  latText,
  lonText,
  multiply,
  norm,
  rotationAbout,
  rotationFrom,
  scale,
  spinToFace,
  standMatrix,
  tidy,
  turnBetween,
  wrap,
  type Matrix,
  type Vec
} from './globe';
import { CENTER_FLAT, HEIGHT, K, P, STAND_BACK, STAND_FRONT, WIDTH, pointerPath, poleParts, ringPieces } from './stand';
import styles from './world-globe.module.css';

/** Idle spin, degrees a second: one turn a minute. */
const IDLE_RATE = 6;
export const SCALE_MOST = 2.4;
export const SCALE_STEP = 1.35;
/** With the stand gone, the view closes in on the ball until it and its plates pulled all the way out fill the frame. */
const GLOBE_ONLY_SCALE = Math.min(WIDTH, HEIGHT) / (2 * (R + PLATE + LIFT + 6) * K);
/** Seconds of quiet before the globe starts showing countries on its own, and between them. */
const TOUR_AFTER = 6;
const TOUR_EVERY = 4.2;
const TOUR_MIN_AREA = 4e5;

const BASIS = basisOf(P);
const LIGHT = norm(add(add(scale(BASIS.toward, 0.55), scale(BASIS.up, 0.7)), scale(BASIS.right, -0.45)));
const C = CENTER as Vec;
const RADIANS = Math.PI / 180;
/** How far past the ring's flat faces a plate keeps when it slides by. */
const CLEAR = RING_H / 2 + 1.5;

const smoothstep = (a: number, b: number, x: number) => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** A d3 path context that keeps the projected points as flat rings of unit-sphere coordinates. */
class Sink {
  rings: number[][] = [];
  private ring: number[] = [];
  reset() {
    this.rings = [];
  }
  moveTo(x: number, y: number) {
    this.ring = [x, y];
    this.rings.push(this.ring);
  }
  lineTo(x: number, y: number) {
    this.ring.push(x, y);
  }
  closePath() {}
  arc() {}
}

const f = (value: number) => Math.round(value * 10) / 10;

/** Rings of unit points as an SVG path, scaled by `size` about the screen point `[ox, oy]`. */
function ringsPath(rings: number[][], ox: number, oy: number, size: number, closed: boolean) {
  let d = '';
  for (const ring of rings) {
    if (ring.length < 4) continue;
    d += `M${f(ox + ring[0] * size)} ${f(oy + ring[1] * size)}`;
    for (let i = 2; i < ring.length; i += 2) d += `L${f(ox + ring[i] * size)} ${f(oy + ring[i + 1] * size)}`;
    if (closed) d += 'Z';
  }
  return d;
}

/**
 * A plate's sides: each edge of its outline swept from the ball's surface out to the plate's top. In an
 * orthographic view a radial sweep is a scaling about the plate's centre, so each side is a quad between
 * the same edge at two sizes, wound one way so the union fills.
 */
function wallsPath(rings: number[][], ox: number, oy: number, inner: number, outer: number) {
  let d = '';
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const ax = ring[i * 2];
      const ay = ring[i * 2 + 1];
      const bx = ring[j * 2];
      const by = ring[j * 2 + 1];
      const turn = ax * by - ay * bx;
      if (Math.abs(turn) < 1e-7) continue;
      const q = [ox + ax * inner, oy + ay * inner, ox + bx * inner, oy + by * inner, ox + bx * outer, oy + by * outer, ox + ax * outer, oy + ay * outer];
      d +=
        turn > 0
          ? `M${f(q[0])} ${f(q[1])}L${f(q[2])} ${f(q[3])}L${f(q[4])} ${f(q[5])}L${f(q[6])} ${f(q[7])}Z`
          : `M${f(q[6])} ${f(q[7])}L${f(q[4])} ${f(q[5])}L${f(q[2])} ${f(q[3])}L${f(q[0])} ${f(q[1])}Z`;
    }
  }
  return d;
}

export interface GlobeState {
  broken: boolean;
  spinning: boolean;
  pulled: number;
  scale: number;
  selected: number;
  /** The globe alone, off its stand, turning freely. */
  free: boolean;
}

export interface GlobeHandle {
  setBroken(on: boolean): void;
  setSpinning(on: boolean): void;
  /** Turn a country to face the viewer and pull it out. */
  find(index: number): void;
  putBack(): void;
  turn(degrees: number): void;
  tiltBy(degrees: number): void;
  scaleBy(factor: number): void;
  home(): void;
  setFree(on: boolean): void;
}

interface Props {
  onState: (state: GlobeState) => void;
}

type PlateNodes = { group: SVGGElement; walls: SVGPathElement; base: SVGPathElement; face: SVGPathElement };

/** Where a lifted plate's shadow falls on the ball, per unit of lift: away from the light, down and right. */
const SHADOW: [number, number] = [0.55, 0.8];

export const Globe = React.memo(
  React.forwardRef<GlobeHandle, Props>(function Globe({ onState }, handle) {
    const { anchor, say } = useReadout<HTMLDivElement>();
    const inView = useInView(anchor);
    const svg = React.useRef<SVGSVGElement>(null);
    const sorted = React.useRef<SVGGElement>(null);
    const standBack = React.useRef<SVGGElement>(null);
    const standFront = React.useRef<SVGGElement>(null);
    const announce = React.useRef<HTMLSpanElement>(null);
    const gradient = React.useId().replace(/:/g, '');
    const dragging = React.useRef<{ id: number; x: number; y: number; moved: boolean; t: number; v: number; plate: number } | null>(null);
    const callbacks = React.useRef({ onState });
    callbacks.current = { onState };

    const live = React.useRef({
      built: false,
      spin: 0,
      rate: IDLE_RATE,
      spinTarget: null as number | null,
      tilt: EARTH_TILT,
      tiltTarget: EARTH_TILT,
      tiltDrawn: Number.NaN,
      broken: false,
      spinning: true,
      /** The ball's orientation, globe to world; on the stand it follows spin and tilt. */
      orient: standMatrix(0, EARTH_TILT) as Matrix,
      free: false,
      /** 0 on the stand, 1 alone; the stand fades and the view closes in as it eases between. */
      mix: 0,
      mixDrawn: -1,
      /** Whether the ball sits on its axis again after turning freely. */
      settled: true,
      /** Turning speed off the stand, as a world rotation vector in radians a second. */
      omega: [0, 0, 0] as Vec,
      /** Turns asked for by the keys off the stand, still to be made. */
      nudge: [0, 0, 0] as Vec,
      /** A country being turned to face the viewer off the stand. */
      faceTarget: -1,
      lift: new Float64Array(COUNTRIES.length),
      speed: new Float64Array(COUNTRIES.length),
      wait: new Float64Array(COUNTRIES.length),
      pulled: new Set<number>(),
      hover: -1,
      selected: -1,
      tour: -1,
      quiet: 0,
      tourWait: 0,
      scale: 1,
      scaleTarget: 1,
      viewBox: '',
      order: '',
      dirty: true,
      plates: [] as PlateNodes[],
      pieces: [] as SVGGElement[],
      pieceDepth: [] as number[],
      pieceTheta: [] as number[],
      core: null as SVGGElement | null,
      graticule: null as SVGPathElement | null,
      sockets: null as SVGPathElement | null,
      shadows: null as SVGPathElement | null,
      seatedWalls: null as SVGPathElement | null,
      seatedBase: null as SVGPathElement | null,
      northInner: null as SVGGElement | null,
      northOuter: null as SVGGElement | null,
      northStatic: null as SVGGElement | null,
      northCap: null as SVGGElement | null,
      pointer: null as SVGPathElement | null,
      southInner: null as SVGGElement | null,
      southOuter: null as SVGGElement | null,
      tone: new Int8Array(COUNTRIES.length).fill(-1),
      drawnLit: new Int8Array(COUNTRIES.length),
      readout: ''
    });

    const projection = React.useMemo(() => geoOrthographic().scale(1).translate([0, 0]).precision(0), []);
    const sink = React.useMemo(() => new Sink(), []);
    const path = React.useMemo(() => geoPath(projection, sink as unknown as CanvasRenderingContext2D), [projection, sink]);
    const graticule = React.useMemo(() => geoGraticule().extent([[-180, -90], [180, 90]]).step([15, 15]).precision(1)(), []);
    // The grid is drawn with d3's adaptive resampling, so meridians and parallels bend as true curves on
    // the ball (to about a third of a pixel) instead of running as straight chords between samples.
    const gridProjection = React.useMemo(() => geoOrthographic().scale(1).translate([0, 0]).precision(0.3 / (R * K)), []);
    const gridPath = React.useMemo(() => geoPath(gridProjection, sink as unknown as CanvasRenderingContext2D), [gridProjection, sink]);

    const report = React.useCallback(() => {
      const state = live.current;
      callbacks.current.onState({ broken: state.broken, spinning: state.spinning, pulled: state.pulled.size, scale: state.scaleTarget, selected: state.selected, free: state.free });
    }, []);

    const speak = (text: string) => {
      if (announce.current) announce.current.textContent = text;
    };

    /** Make the DOM nodes once: the plates, the ring pieces, the ball and the pole parts. */
    const build = React.useCallback(() => {
      const state = live.current;
      const root = sorted.current;
      if (!root || state.built) return;
      state.built = true;
      const ns = 'http://www.w3.org/2000/svg';
      const make = <T extends SVGElement>(tag: string, attrs: Record<string, string> = {}) => {
        const node = document.createElementNS(ns, tag) as T;
        for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
        return node;
      };
      const core = make<SVGGElement>('g', { class: styles.core });
      const [cx, cy] = CENTER_FLAT;
      core.appendChild(make('circle', { cx: String(cx), cy: String(cy), r: String(R * K), fill: `url(#${gradient})` }));
      state.graticule = core.appendChild(make<SVGPathElement>('path', { class: `iso-line ${styles.graticule}`, 'data-tone': 'faint' }));
      state.sockets = core.appendChild(make<SVGPathElement>('path', { class: styles.socket }));
      // Shadows of lifted plates fall on the ball and into the empty sockets, never over other plates.
      state.shadows = core.appendChild(make<SVGPathElement>('path', { class: styles.shadow, 'clip-path': `url(#${gradient}-ball)` }));
      state.seatedWalls = core.appendChild(make<SVGPathElement>('path', { class: styles.walls }));
      state.seatedBase = core.appendChild(make<SVGPathElement>('path', { class: `iso-line ${styles.base}`, 'data-tone': 'lo' }));
      core.appendChild(make('circle', { class: 'iso-line', 'data-tone': 'mid', cx: String(cx), cy: String(cy), r: String(R * K) }));
      state.core = core;
      state.plates = COUNTRIES.map((country) => {
        const group = make<SVGGElement>('g', { class: styles.plate, 'data-i': String(country.index) });
        const walls = group.appendChild(make<SVGPathElement>('path', { class: styles.walls }));
        const base = group.appendChild(make<SVGPathElement>('path', { class: `iso-line ${styles.base}`, 'data-tone': 'lo' }));
        const face = group.appendChild(make<SVGPathElement>('path', { class: styles.face }));
        return { group, walls, base, face };
      });
      state.pieces = Array.from({ length: 72 }, () => make<SVGGElement>('g'));
      state.northInner = make<SVGGElement>('g');
      state.northOuter = make<SVGGElement>('g');
      state.northStatic = state.northOuter.appendChild(make<SVGGElement>('g'));
      state.pointer = state.northOuter.appendChild(make<SVGPathElement>('path', { class: 'iso-line', 'data-tone': 'hi', 'data-free': 'end' }));
      state.northCap = state.northOuter.appendChild(make<SVGGElement>('g'));
      state.southInner = make<SVGGElement>('g');
      state.southOuter = make<SVGGElement>('g');
    }, [gradient]);

    /** Rebuild the ring and the pole parts for a new tilt. */
    const placeRing = React.useCallback((tilt: number) => {
      const state = live.current;
      const pieces = ringPieces(tilt);
      pieces.forEach((piece, i) => {
        state.pieces[i].innerHTML = piece.svg;
        state.pieceDepth[i] = piece.depth;
        state.pieceTheta[i] = piece.theta;
      });
      const parts = poleParts(tilt);
      state.northInner!.innerHTML = parts.northInner;
      state.northStatic!.innerHTML = parts.northOuter;
      state.northCap!.innerHTML = parts.northCap;
      state.southInner!.innerHTML = parts.southInner;
      state.southOuter!.innerHTML = parts.southOuter;
      state.tiltDrawn = tilt;
    }, []);

    /** Draw the ball at its current spin, tilt and lifts, and put everything in painter's order. */
    const draw = React.useCallback(() => {
      const state = live.current;
      if (!state.built) return;
      if (!(Math.abs(state.tilt - state.tiltDrawn) <= 1e-3)) placeRing(state.tilt);
      const { tilt } = state;
      const M = state.orient;
      const rotate = rotationFrom(P, M);
      const [cx, cy] = CENTER_FLAT;
      const probe = applyT(M, [0, 1, 0]);
      // The ring fades with the stand, and plates stop making way for it.
      const ringShown = 1 - state.mix;
      if (Math.abs(state.mix - state.mixDrawn) > 1e-3) {
        state.mixDrawn = state.mix;
        const opacity = String(f(ringShown * 100) / 100);
        for (const node of [standBack.current, standFront.current, ...state.pieces, state.northInner, state.northOuter, state.southInner, state.southOuter]) {
          if (node) node.style.opacity = opacity;
        }
      }
      const showRing = ringShown > 1e-3;

      projection.rotate(rotate);
      gridProjection.rotate(rotate);
      sink.reset();
      gridPath(graticule);
      state.graticule!.setAttribute('d', ringsPath(sink.rings, cx, cy, R * K, false));

      const order = { backBefore: [] as [number, Element][], backAfter: [] as [number, Element][], frontBefore: [] as [number, Element][], frontAfter: [] as [number, Element][] };
      let sockets = '';
      // Seated plates all stand at one height, so their faces never overlap: their sides go down
      // first, together, and no side pokes over a neighbour's face along a shared border.
      let shadows = '';
      let seatedWalls = '';
      let seatedBase = '';
      const lit = state.hover >= 0 ? state.hover : state.tour >= 0 ? state.tour : state.selected;

      for (const country of COUNTRIES) {
        const i = country.index;
        const nodes = state.plates[i];
        const d = state.lift[i];
        const center = apply(M, country.dir);
        // The plate's spread across the ring's plane, on the unit sphere.
        let lo = Infinity;
        let hi = -Infinity;
        const points = country.points;
        for (let p = 0; p < points.length; p += 3) {
          const y = points[p] * probe[0] + points[p + 1] * probe[1] + points[p + 2] * probe[2];
          if (y < lo) lo = y;
          if (y > hi) hi = y;
        }

        // While a plate passes the ring's radius, it slides along the ball until it is clear of the ring.
        const window = smoothstep(PLATE + 0.4, RING_IN - R - PLATE - 0.6, d) * (1 - smoothstep(RING_OUT - R + 0.5, RING_OUT - R + 6, d)) * ringShown;
        let turned: number[] | undefined;
        let dir = center;
        if (window > 0) {
          const r = R + d + PLATE;
          const need = Math.min(0.99, CLEAR / r);
          if (lo < need && hi > -need) {
            const up = Math.asin(need) - Math.asin(Math.max(-1, lo));
            const down = -(Math.asin(Math.min(1, hi)) + Math.asin(need));
            const angle = (Math.abs(up) < Math.abs(down) ? up : down) * window;
            const axis = norm(cross(country.dir, probe));
            turned = rotationAbout(axis, angle);
            dir = apply(multiply(M, turned), country.dir);
            lo += angle;
            hi += angle;
          }
        }

        sink.reset();
        path(country.feature);
        const flatRings = sink.rings;
        if (d > 0.3 && flatRings.length) sockets += ringsPath(flatRings, cx, cy, R * K, true);
        let rings = flatRings;
        if (turned) {
          projection.rotate(rotationFrom(P, M, turned));
          sink.reset();
          path(country.feature);
          rings = sink.rings;
          projection.rotate(rotate);
        }

        if (!rings.length) {
          if (nodes.face.getAttribute('d')) {
            nodes.face.setAttribute('d', '');
            nodes.walls.setAttribute('d', '');
            nodes.base.setAttribute('d', '');
          }
          continue;
        }
        const [ox, oy] = [cx + dot(dir, BASIS.right) * d * K, cy - dot(dir, BASIS.up) * d * K];
        nodes.face.setAttribute('d', ringsPath(rings, ox, oy, (R + PLATE) * K, true));
        const walls = wallsPath(rings, ox, oy, R * K, (R + PLATE) * K);
        const base = ringsPath(rings, ox, oy, R * K, true);
        // A lifted plate casts its outline onto the ball: in this view a plate rising toward you would
        // otherwise not move at all.
        if (d > 0.3) shadows += ringsPath(rings, cx + SHADOW[0] * d * K, cy + SHADOW[1] * d * K, R * K, true);
        if (d === 0) {
          seatedWalls += walls;
          seatedBase += base;
          nodes.walls.setAttribute('d', '');
          nodes.base.setAttribute('d', '');
        } else {
          nodes.walls.setAttribute('d', walls);
          nodes.base.setAttribute('d', base);
        }

        const tone = Math.round(((dot(dir, LIGHT) + 1) / 2) * 50) * 2;
        if (tone !== state.tone[i]) {
          state.tone[i] = tone;
          nodes.face.style.setProperty('--wg-tone', `${tone}%`);
        }
        const isLit = i === lit ? 1 : 0;
        if (isLit !== state.drawnLit[i]) {
          state.drawnLit[i] = isLit;
          if (isLit) nodes.group.setAttribute('data-lit', '');
          else nodes.group.removeAttribute('data-lit');
        }

        // Painter's order. A plate wholly on the viewer's side of the ring's plane is in front of the
        // whole ring, and one wholly behind it is behind; one across it is inside the ring or beyond it.
        const reach = d + PLATE;
        const side = dot(dir, [0, 1, 0]) * d;
        const yLo = Math.min(lo * R, lo * (R + PLATE)) + side;
        const yHi = Math.max(hi * R, hi * (R + PLATE)) + side;
        const depth = dot(dir, BASIS.toward) * (R + PLATE / 2 + d);
        const back = d > PLATE && dot(dir, BASIS.toward) < 0;
        const inside = reach < RING_IN - R;
        const before = yHi < -RING_H / 2 ? true : yLo > RING_H / 2 ? false : back ? !inside : inside;
        const list = back ? (before ? order.backBefore : order.backAfter) : before ? order.frontBefore : order.frontAfter;
        list.push([depth, nodes.group]);
      }
      state.sockets!.setAttribute('d', sockets);
      state.shadows!.setAttribute('d', shadows);
      state.seatedWalls!.setAttribute('d', seatedWalls);
      state.seatedBase!.setAttribute('d', seatedBase);

      // The hour circle's pointer turns with the ball: it points along the Greenwich meridian.
      if (showRing) state.pointer!.setAttribute('d', pointerPath(tilt, apply(M, [1, 0, 0])));

      const backRing: [number, Element][] = [];
      const frontRing: [number, Element][] = [];
      let nearNorth = -Infinity;
      let nearSouth = Infinity;
      if (showRing) state.pieces.forEach((piece, i) => {
        const depth = state.pieceDepth[i];
        (depth < 0 ? backRing : frontRing).push([depth, piece]);
        const theta = state.pieceTheta[i];
        if (Math.min(theta, 360 - theta) < 30) nearNorth = Math.max(nearNorth, depth);
        if (Math.abs(theta - 180) < 30) nearSouth = Math.min(nearSouth, depth);
      });
      if (showRing) {
        frontRing.push([nearNorth + 0.01, state.northOuter!]);
        backRing.push([nearSouth - 0.01, state.southOuter!]);
        const a = [Math.sin(tilt * RADIANS), 0, Math.cos(tilt * RADIANS)] as Vec;
        order.frontBefore.push([dot(a, BASIS.toward) * R, state.northInner!]);
        order.backAfter.push([-dot(a, BASIS.toward) * R, state.southInner!]);
      }

      const byDepth = (p: [number, Element], q: [number, Element]) => p[0] - q[0];
      const final = [
        ...order.backBefore.sort(byDepth),
        ...backRing.sort(byDepth),
        ...order.backAfter.sort(byDepth),
        [0, state.core!] as [number, Element],
        ...order.frontBefore.sort(byDepth),
        ...frontRing.sort(byDepth),
        ...order.frontAfter.sort(byDepth)
      ].map(([, node]) => node);
      const key = final.map((node) => (node as SVGElement).dataset.i ?? node.nodeName).join();
      if (key !== state.order || sorted.current!.childNodes.length !== final.length) {
        state.order = key;
        sorted.current!.replaceChildren(...final);
      }

      // The readout: the country under the pointer or being shown, else where the ball faces.
      const country = lit >= 0 ? COUNTRIES[lit] : null;
      const faces = facingPoint(P, M);
      const text = country
        ? describe(country)
        : state.free
          ? `Facing ${latText(faces.lat)} ${lonText(faces.lon)}`
          : `Facing ${lonText(faces.lon)} · axis ${tilt.toFixed(1)}°`;
      if (text !== state.readout) {
        state.readout = text;
        say(text);
      }
    }, [graticule, gridPath, gridProjection, path, placeRing, projection, say, sink]);

    /** Where each plate is heading: home, a hover, or out (less for plates over the stand). */
    const targetOf = React.useCallback((i: number) => {
      const state = live.current;
      const out = state.broken || state.pulled.has(i);
      const lit = i === state.hover || i === state.tour;
      if (!out) return lit ? HOVER : 0;
      // On the stand, plates over the column barely rise; alone, every plate comes all the way out.
      const down = -apply(state.orient, COUNTRIES[i].dir)[2];
      const cap = LIFT - (LIFT - HOVER) * smoothstep(0.42, 0.78, down) * (1 - state.mix);
      return cap + (lit && state.broken ? 4 : 0);
    }, []);

    const placeView = React.useCallback(() => {
      const state = live.current;
      const s = state.scale * (1 + (GLOBE_ONLY_SCALE - 1) * state.mix);
      const pull = Math.max(state.mix, Math.min(1, (state.scale - 1) / 0.6));
      const cx = WIDTH / 2 + (CENTER_FLAT[0] - WIDTH / 2) * pull;
      const cy = HEIGHT / 2 + (CENTER_FLAT[1] - HEIGHT / 2) * pull;
      const w = WIDTH / s;
      const h = HEIGHT / s;
      const box = `${f(cx - w / 2)} ${f(cy - h / 2)} ${f(w)} ${f(h)}`;
      if (box !== state.viewBox) {
        state.viewBox = box;
        svg.current?.setAttribute('viewBox', box);
      }
    }, []);

    const tick = React.useCallback(
      (dt: number, calm: boolean) => {
        const state = live.current;
        build();
        let moving = false;

        // Between the stand and the globe alone.
        const mixTarget = state.free ? 1 : 0;
        if (state.mix !== mixTarget) {
          const next = calm ? mixTarget : state.mix + (mixTarget - state.mix) * (1 - Math.exp(-dt / 0.4));
          state.mix = Math.abs(next - mixTarget) < 1e-3 ? mixTarget : next;
          moving = true;
        }

        if (state.free) {
          // Off the stand the ball turns about any axis: toward a country being found, by the keys'
          // nudges, by a fling, and otherwise slowly about its own axis.
          const turnBy = (axis: Vec, angle: number) => {
            if (Math.abs(angle) < 1e-7) return;
            state.orient = tidy(multiply(rotationAbout(norm(axis), angle), state.orient));
            moving = true;
          };
          if (state.faceTarget >= 0) {
            const at = apply(state.orient, COUNTRIES[state.faceTarget].dir);
            const axis = cross(at, BASIS.toward);
            const angle = Math.atan2(Math.hypot(...axis), dot(at, BASIS.toward));
            if (angle < 1e-3) state.faceTarget = -1;
            else turnBy(axis, calm ? angle : angle * (1 - Math.exp(-dt / 0.35)));
            state.omega = [0, 0, 0];
          }
          const nudge = Math.hypot(...state.nudge);
          if (nudge > 1e-5) {
            const share = calm ? 1 : 1 - Math.exp(-dt / 0.22);
            turnBy(state.nudge, nudge * share);
            state.nudge = scale(state.nudge, 1 - share);
            state.omega = [0, 0, 0];
          }
          if (!dragging.current && state.faceTarget < 0 && nudge <= 1e-5) {
            const idle = state.spinning && !calm ? scale(apply(state.orient, [0, 0, 1]), IDLE_RATE * RADIANS) : ([0, 0, 0] as Vec);
            const ease = calm ? 1 : 1 - Math.exp(-dt / 1.1);
            state.omega = add(state.omega, scale(add(idle, scale(state.omega, -1)), ease));
            const speed = Math.hypot(...state.omega);
            turnBy(state.omega, speed * dt);
          }
          state.settled = false;
        } else {
        // Spin: toward a country being found, else coast back to the idle rate.
        const before = state.spin;
        if (state.spinTarget !== null) {
          const next = calm ? state.spinTarget : state.spin + (state.spinTarget - state.spin) * (1 - Math.exp(-dt / 0.35));
          state.spin = Math.abs(state.spinTarget - next) < 0.02 ? state.spinTarget : next;
          if (state.spin === state.spinTarget) state.spinTarget = null;
          state.rate = 0;
        } else if (!dragging.current) {
          const idle = state.spinning && !calm ? IDLE_RATE : 0;
          state.rate = calm ? idle : state.rate + (idle - state.rate) * (1 - Math.exp(-dt / 1.1));
          if (Math.abs(state.rate - idle) < 0.01) state.rate = idle;
          state.spin += state.rate * dt;
        }
        if (state.spin !== before) moving = true;

        const tilt = calm ? state.tiltTarget : state.tilt + (state.tiltTarget - state.tilt) * (1 - Math.exp(-dt / 0.18));
        state.tilt = Math.abs(tilt - state.tiltTarget) < 0.01 ? state.tiltTarget : tilt;
        if (state.tilt !== state.tiltDrawn) moving = true;

        // Back on the stand, the ball eases onto its axis before it follows spin and tilt again.
        const home = standMatrix(state.spin, state.tilt);
        if (state.settled) state.orient = home;
        else {
          const { axis, angle } = turnBetween(state.orient, home);
          if (calm || angle < 1e-3) {
            state.orient = home;
            state.settled = true;
          } else state.orient = tidy(multiply(rotationAbout(axis, angle * (1 - Math.exp(-dt / 0.3))), state.orient));
          moving = true;
        }
        }

        // The idle tour: after a quiet spell the globe lifts the country facing you, one after another.
        state.quiet += dt;
        if (!calm && state.quiet > TOUR_AFTER && !state.broken && state.hover < 0) {
          state.tourWait -= dt;
          if (state.tourWait <= 0) {
            state.tourWait = TOUR_EVERY;
            let best = -1;
            let bestFacing = 0.55;
            for (const country of COUNTRIES) {
              if (country.area < TOUR_MIN_AREA || country.index === state.tour || state.pulled.has(country.index)) continue;
              const facingBy = dot(apply(state.orient, country.dir), BASIS.toward);
              if (facingBy > bestFacing) {
                bestFacing = facingBy;
                best = country.index;
              }
            }
            state.tour = best;
          }
        }

        // Plates: each rides a spring to its target, after its own short wait when the map breaks.
        for (let i = 0; i < COUNTRIES.length; i++) {
          const target = targetOf(i);
          if (state.wait[i] > 0) {
            state.wait[i] -= dt;
            if (!calm) {
              moving = true;
              continue;
            }
          }
          let at = state.lift[i];
          let speed = state.speed[i];
          if (at === target && speed === 0) continue;
          moving = true;
          if (calm) {
            at = target;
            speed = 0;
          } else {
            const steps = Math.max(1, Math.ceil(dt * 240));
            const slice = dt / steps;
            for (let step = 0; step < steps; step++) {
              speed += ((target - at) * 90 - speed * 14) * slice;
              at += speed * slice;
              // A plate going home lands in its socket instead of sinking through the ball.
              if (at < 0) {
                at = 0;
                speed = 0;
              }
            }
            if (Math.abs(target - at) < 2e-3 && Math.abs(speed) < 2e-3) {
              at = target;
              speed = 0;
            }
          }
          state.lift[i] = at;
          state.speed[i] = speed;
        }

        const s = calm ? state.scaleTarget : state.scale + (state.scaleTarget - state.scale) * (1 - Math.exp(-dt / 0.16));
        state.scale = Math.abs(s - state.scaleTarget) < 1e-3 ? state.scaleTarget : s;
        if (state.scale !== state.scaleTarget) moving = true;
        placeView();

        if (moving || state.dirty) {
          state.dirty = false;
          draw();
        }
        const touring = !calm && (state.spinning || (state.free && Math.hypot(...state.omega) > 1e-4));
        return moving || touring || dragging.current !== null;
      },
      [build, draw, placeView, targetOf]
    );

    const kick = useLoop(tick, inView);

    const touch = React.useCallback(() => {
      const state = live.current;
      state.quiet = 0;
      state.tourWait = 0;
      if (state.tour >= 0) state.tour = -1;
      state.dirty = true;
      kick();
    }, [kick]);

    const setBroken = React.useCallback(
      (on: boolean) => {
        const state = live.current;
        if (state.broken === on) return;
        state.broken = on;
        state.pulled.clear();
        // The side facing you breaks first and comes home last, with a little scatter.
        COUNTRIES.forEach((country, i) => {
          const near = (dot(apply(state.orient, country.dir), BASIS.toward) + 1) / 2;
          const scatter = ((i * 7919) % 97) / 97;
          state.wait[i] = on ? (1 - near) * 0.45 + scatter * 0.12 : near * 0.35 + scatter * 0.12;
        });
        speak(on ? 'The map is broken apart into its countries.' : 'The countries are back on the ball.');
        touch();
        report();
      },
      [report, touch]
    );

    const toggle = React.useCallback(
      (i: number) => {
        const state = live.current;
        if (state.broken) {
          state.selected = state.selected === i ? -1 : i;
        } else if (state.pulled.has(i)) {
          state.pulled.delete(i);
          if (state.selected === i) state.selected = -1;
          speak(`${COUNTRIES[i].name} is back in place.`);
        } else {
          state.pulled.add(i);
          state.selected = i;
          state.wait[i] = 0;
          speak(`${describe(COUNTRIES[i])}, pulled out.`);
        }
        touch();
        report();
      },
      [report, touch]
    );

    React.useImperativeHandle(
      handle,
      () => ({
        setBroken,
        setSpinning(on) {
          live.current.spinning = on;
          touch();
          report();
        },
        find(index) {
          const state = live.current;
          const country = COUNTRIES[index];
          if (state.free) state.faceTarget = index;
          else {
            const want = spinToFace(P, country.lon, state.tilt);
            state.spinTarget = state.spin + wrap(want - state.spin);
          }
          if (state.broken) {
            state.selected = index;
          } else {
            state.pulled.add(index);
            state.selected = index;
          }
          speak(`${describe(country)}, pulled out.`);
          touch();
          report();
        },
        putBack() {
          const state = live.current;
          state.broken = false;
          state.pulled.clear();
          state.selected = -1;
          speak('Every country is back on the ball.');
          touch();
          report();
        },
        turn(degrees) {
          const state = live.current;
          // Off the stand, → turns the near side to the right, about the screen's vertical.
          if (state.free) state.nudge = add(state.nudge, scale(BASIS.up, -degrees * RADIANS));
          else state.spinTarget = (state.spinTarget ?? state.spin) + degrees;
          touch();
        },
        tiltBy(degrees) {
          const state = live.current;
          // Off the stand, ↓ rolls the near side down, about the screen's horizontal, 15° a press.
          if (state.free) state.nudge = add(state.nudge, scale(BASIS.right, -degrees * 7.5 * RADIANS));
          else state.tiltTarget = Math.max(TILT_MIN, Math.min(TILT_MAX, state.tiltTarget + degrees));
          touch();
        },
        setFree(on) {
          const state = live.current;
          if (state.free === on) return;
          state.free = on;
          state.faceTarget = -1;
          state.nudge = [0, 0, 0];
          if (on) {
            state.spinTarget = null;
            state.omega = state.spinning ? scale(apply(state.orient, [0, 0, 1]), IDLE_RATE * RADIANS) : [0, 0, 0];
          } else {
            // Back on the stand, keep the longitude that faces you and settle onto the axis from there.
            state.spin = spinToFace(P, facingPoint(P, state.orient).lon, state.tilt);
            state.spinTarget = null;
            state.rate = state.spinning ? IDLE_RATE : 0;
            state.settled = false;
          }
          speak(on ? 'The globe is off its stand: drag to turn it any way.' : 'The globe is back on its stand.');
          touch();
          report();
        },
        scaleBy(factor) {
          const state = live.current;
          state.scaleTarget = Math.max(1, Math.min(SCALE_MOST, state.scaleTarget * factor));
          touch();
          report();
        },
        home() {
          const state = live.current;
          state.scaleTarget = 1;
          state.tiltTarget = EARTH_TILT;
          touch();
          report();
        }
      }),
      [report, setBroken, toggle, touch]
    );

    // ── Pointer: drag sideways to spin, up and down to slide the ring; click a country to pull it ──

    const plateAt = (target: EventTarget | null) => {
      const group = (target as Element | null)?.closest?.('[data-i]') as SVGGElement | null;
      return group ? Number(group.dataset.i) : -1;
    };

    const onPointerDown = (event: React.PointerEvent<SVGSVGElement>) => {
      if (event.button !== 0) return;
      dragging.current = { id: event.pointerId, x: event.clientX, y: event.clientY, moved: false, t: performance.now(), v: 0, plate: plateAt(event.target) };
      live.current.spinTarget = null;
      touch();
    };

    const onPointerMove = (event: React.PointerEvent<SVGSVGElement>) => {
      const state = live.current;
      const drag = dragging.current;
      if (!drag || drag.id !== event.pointerId) {
        if (event.pointerType === 'mouse') {
          const plate = plateAt(event.target);
          if (plate !== state.hover) {
            state.hover = plate;
            touch();
          }
        }
        return;
      }
      const dx = event.clientX - drag.x;
      const dy = event.clientY - drag.y;
      if (!drag.moved && Math.hypot(dx, dy) < 4) return;
      if (!drag.moved) {
        drag.moved = true;
        svg.current?.setPointerCapture(event.pointerId);
        state.hover = -1;
      }
      // Screen pixels to view-box units, then the ball's surface follows the pointer at its middle.
      const box = svg.current?.getBoundingClientRect();
      const perPixel = box ? WIDTH / (state.scale * (1 + (GLOBE_ONLY_SCALE - 1) * state.mix)) / box.width : 1;
      const degrees = ((dx * perPixel) / (R * K)) / RADIANS;
      const now = performance.now();
      const seconds = Math.max(1e-3, (now - drag.t) / 1000);
      drag.t = now;
      if (state.free) {
        // A trackball: the near side follows the pointer in any direction.
        const turn = add(scale(BASIS.up, (-dx * perPixel) / (R * K)), scale(BASIS.right, (-dy * perPixel) / (R * K)));
        const angle = Math.hypot(...turn);
        if (angle > 1e-7) state.orient = tidy(multiply(rotationAbout(norm(turn), angle), state.orient));
        state.omega = add(scale(state.omega, 0.6), scale(turn, 0.4 / seconds));
        state.faceTarget = -1;
      } else {
        drag.v = drag.v * 0.6 + (degrees / seconds) * 0.4;
        state.spin += degrees;
        state.tiltTarget = Math.max(TILT_MIN, Math.min(TILT_MAX, state.tiltTarget + dy * perPixel * 0.25));
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
      state.quiet = 0;
      state.dirty = true;
      kick();
    };

    const onPointerUp = (event: React.PointerEvent<SVGSVGElement>) => {
      const drag = dragging.current;
      if (!drag || drag.id !== event.pointerId) return;
      dragging.current = null;
      const state = live.current;
      if (drag.moved && state.free) {
        const speed = Math.hypot(...state.omega);
        if (speed > 4) state.omega = scale(state.omega, 4 / speed);
      } else if (drag.moved) state.rate = Math.max(-240, Math.min(240, drag.v));
      else if (drag.plate >= 0) toggle(drag.plate);
      touch();
    };

    const onPointerLeave = () => {
      const state = live.current;
      if (state.hover >= 0 && !dragging.current) {
        state.hover = -1;
        touch();
      }
    };

    React.useEffect(() => {
      report();
    }, [report]);

    return (
      <div ref={anchor} className={styles.stage}>
        <svg
          ref={svg}
          className={`iso-svg ${styles.svg}`}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label="A desk globe on a turned stand. Its countries are separate plates set into an ocean ball, held in a brass meridian ring with an hour circle at the North Pole. Countries lift out of their sockets when picked, and the whole map can break apart. It can also be taken off the stand and turned freely in any direction."
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
          onPointerLeave={onPointerLeave}
        >
          <defs>
            <clipPath id={`${gradient}-ball`}>
              <circle cx={CENTER_FLAT[0]} cy={CENTER_FLAT[1]} r={R * K} />
            </clipPath>
            <radialGradient id={gradient} cx="0.36" cy="0.3" r="0.78">
              <stop offset="0" style={{ stopColor: 'var(--wg-ocean-hi)' }} />
              <stop offset="0.6" style={{ stopColor: 'var(--wg-ocean-mid)' }} />
              <stop offset="1" style={{ stopColor: 'var(--wg-ocean-lo)' }} />
            </radialGradient>
          </defs>
          <g ref={standBack} dangerouslySetInnerHTML={{ __html: STAND_BACK }} />
          <g ref={sorted} />
          <g ref={standFront} dangerouslySetInnerHTML={{ __html: STAND_FRONT }} />
        </svg>
        <span ref={announce} className={styles.hidden} aria-live="polite" />
      </div>
    );
  })
);
