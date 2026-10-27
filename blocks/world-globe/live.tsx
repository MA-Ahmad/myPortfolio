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
  describePiece,
  dot,
  hasDivisions,
  loadDivisions,
  piecesPhrase,
  faceMatrix,
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
  type Divisions,
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
  /** What a click on the picked country does next, when that is not the usual. */
  hint: string;
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

/** A country that splits into provinces: their plates, the borders printed on the whole plate, and how far split it is. */
interface Split {
  data: Divisions;
  nodes: PlateNodes[];
  borders: SVGPathElement;
  /** 0 whole, 1 split: the pieces spread apart along the ball as it rises. */
  at: number;
  speed: number;
  target: number;
  /** How high each piece stands above the others: the one picked, and the one under the pointer. */
  raise: Float64Array;
  tone: Int8Array;
  lit: Int8Array;
  /** The name printed on each piece, and where each piece and its name's anchor last landed on screen. */
  labels: LabelNodes[];
  boxes: Box[];
  shapes: (Shape | null)[];
  /** Where each name was last fitted, relative to its piece's box, so it is searched for again only when the piece or the zoom changes. */
  plans: (Plan | null)[];
  anchors: ([number, number] | null)[];
}

/** "a state", "an emirate": the commonest kind of piece a country splits into, as a phrase. */
function unitOf(pieces: { kind: string }[]) {
  const kinds = new Map<string, number>();
  for (const piece of pieces) kinds.set(piece.kind.toLowerCase(), (kinds.get(piece.kind.toLowerCase()) ?? 0) + 1);
  const kind = Array.from(kinds).sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'part';
  return `${/^[aeiou]/.test(kind) ? 'an' : 'a'} ${kind}`;
}

/** How far the pieces of a split country move apart, and how much they rise above the plate's height. */
const SPREAD = 4.5;
const PIECE_RISE = 1.2;
const PIECE_PICKED = 3.5;
/** A split country fills this share of the view, however small it is, up to this zoom. */
const FOCUS_FILL = 0.66;
const FOCUS_MOST = 48;
/** How high a country split open stands above its socket. */
const FOCUS_LIFT = 12;
/** Province names: their size on screen in CSS pixels, and the smallest they shrink to before going outside. */
const LABEL_PX = 11;
const LABEL_MIN_PX = 8.5;
/** Width of one character of the mono face, with its letter spacing, per unit of font size. */
const CHAR_EM = 0.64;

type Box = [number, number, number, number];

/** A piece's outline on screen: unit rings scaled by `size` about `[ox, oy]`. */
type Shape = { rings: number[][]; ox: number; oy: number; size: number };

/**
 * How far a line of text centred at `[x, y]` and running along `[ux, uy]` can reach each way and stay
 * inside the shape: the nearer of the outline's crossings ahead and behind (0 if the point is outside).
 */
function reachAlong({ rings, ox, oy, size }: Shape, x: number, y: number, ux: number, uy: number) {
  let back = Infinity;
  let ahead = Infinity;
  let behind = 0;
  for (const ring of rings) {
    const n = ring.length / 2;
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const ax = ox + ring[j * 2] * size;
      const ay = oy + ring[j * 2 + 1] * size;
      const ex = ox + ring[i * 2] * size - ax;
      const ey = oy + ring[i * 2 + 1] * size - ay;
      const denom = ux * ey - uy * ex;
      if (Math.abs(denom) < 1e-12) continue;
      const wx = ax - x;
      const wy = ay - y;
      const along = (wx * uy - wy * ux) / denom;
      if (along < 0 || along >= 1) continue;
      const t = (wx * ey - wy * ex) / denom;
      if (t < 0) {
        behind++;
        back = Math.min(back, -t);
      } else ahead = Math.min(ahead, t);
    }
  }
  return behind % 2 === 1 ? Math.min(back, ahead) : 0;
}

/** Grow `box` to take in rings of unit points scaled by `size` about `[ox, oy]`. */
function growBox(box: Box, rings: number[][], ox: number, oy: number, size: number) {
  for (const ring of rings) {
    for (let i = 0; i < ring.length; i += 2) {
      const x = ox + ring[i] * size;
      const y = oy + ring[i + 1] * size;
      if (x < box[0]) box[0] = x;
      if (y < box[1]) box[1] = y;
      if (x > box[2]) box[2] = x;
      if (y > box[3]) box[3] = y;
    }
  }
  return box;
}

const emptyBox = (): Box => [Infinity, Infinity, -Infinity, -Infinity];

/**
 * The box around a country's main landmass. Parts are gathered into clusters of parts near each other
 * (closer than a sixth of the larger one's size, or the spread of split pieces), and the cluster holding the most area wins: the lower
 * 48 over Alaska and Hawaii, metropolitan France over French Guiana.
 */
function mainBox(parts: { box: Box; weight: number }[]): Box | null {
  const items = parts.filter((part) => Number.isFinite(part.box[0]));
  if (!items.length) return null;
  const root = items.map((_, k) => k);
  const find = (k: number): number => (root[k] === k ? k : (root[k] = find(root[k])));
  const size = ([x0, y0, x1, y1]: Box) => Math.max(x1 - x0, y1 - y0);
  for (let a = 0; a < items.length; a++) {
    for (let b = a + 1; b < items.length; b++) {
      const A = items[a].box;
      const B = items[b].box;
      // Split pieces sit apart on purpose, so parts within the spread of each other always join.
      const reach = Math.max(size(A) / 6, size(B) / 6, SPREAD * K * 1.6);
      const gap = Math.max(A[0] - B[2], B[0] - A[2], A[1] - B[3], B[1] - A[3]);
      if (gap <= reach) root[find(a)] = find(b);
    }
  }
  const weight = new Map<number, number>();
  items.forEach((item, k) => weight.set(find(k), (weight.get(find(k)) ?? 0) + item.weight));
  const best = Array.from(weight).sort((p, q) => q[1] - p[1])[0][0];
  const box = emptyBox();
  items.forEach((item, k) => {
    if (find(k) !== best) return;
    box[0] = Math.min(box[0], item.box[0]);
    box[1] = Math.min(box[1], item.box[1]);
    box[2] = Math.max(box[2], item.box[2]);
    box[3] = Math.max(box[3], item.box[3]);
  });
  return box;
}

/** A ring's area on screen, in view-box units, to weigh a plate's parts before it splits. */
function ringArea(ring: number[], size: number) {
  let sum = 0;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) sum += (ring[j] - ring[i]) * (ring[j + 1] + ring[i + 1]);
  return Math.abs(sum / 2) * size * size;
}

/**
 * CSS pixels per view-box unit at zoom 1. The drawing's height is capped on the page, so its box can be
 * wider than the view box's proportions; the browser then fits the view box by the tighter side.
 */
const pixelsPerUnit = (cssWidth: number, cssHeight: number) => (cssWidth ? Math.min(cssWidth / WIDTH, cssHeight ? cssHeight / HEIGHT : Infinity) : 1);

/** A name split over two lines at the space or hyphen nearest its middle (a hyphen stays on the first line). */
function twoLines(text: string): [string, string] | null {
  const breaks: number[] = [];
  for (let index = 0; index < text.length; index++) if (text[index] === ' ' || text[index] === '-') breaks.push(index);
  if (!breaks.length) return null;
  const middle = text.length / 2;
  const at = breaks.reduce((best, index) => (Math.abs(index - middle) < Math.abs(best - middle) ? index : best));
  return text[at] === '-' ? [text.slice(0, at + 1), text.slice(at + 1)] : [text.slice(0, at), text.slice(at + 1)];
}

/** Points inside a box to try a name at when its anchor is too tight, nearest the anchor first. */
function candidates(box: Box, anchor: [number, number]): [number, number][] {
  const points: [number, number][] = [anchor];
  const columns = 16;
  const rows = 12;
  for (let i = 1; i < columns; i++) {
    for (let j = 1; j < rows; j++) points.push([box[0] + ((box[2] - box[0]) * i) / columns, box[1] + ((box[3] - box[1]) * j) / rows]);
  }
  return points.sort((a, b) => Math.hypot(a[0] - anchor[0], a[1] - anchor[1]) - Math.hypot(b[0] - anchor[0], b[1] - anchor[1]));
}

/** A name's fitted place: a point as fractions of its piece's box, its angle in degrees, lines and size, and what it was fitted for. */
type Plan = { fx: number; fy: number; angle: number; lines: string[]; px: number; inside: boolean; width: number; height: number; unit: number };

const LABEL_ANGLES = [0, 15, -15, 30, -30, 45, -45];

type LabelNodes = { group: SVGGElement; wire: SVGPathElement; dots: SVGPathElement; text: SVGTextElement; first: SVGTSpanElement; second: SVGTSpanElement };

const SVG_NS = 'http://www.w3.org/2000/svg';
const make = <T extends SVGElement>(tag: string, attrs: Record<string, string> = {}) => {
  const node = document.createElementNS(SVG_NS, tag) as T;
  for (const [key, value] of Object.entries(attrs)) node.setAttribute(key, value);
  return node;
};

const plateNodes = (attrs: Record<string, string>): PlateNodes => {
  const group = make<SVGGElement>('g', { class: styles.plate, ...attrs });
  const walls = group.appendChild(make<SVGPathElement>('path', { class: styles.walls }));
  const base = group.appendChild(make<SVGPathElement>('path', { class: `iso-line ${styles.base}`, 'data-tone': 'lo' }));
  const face = group.appendChild(make<SVGPathElement>('path', { class: styles.face }));
  return { group, walls, base, face };
};

const clearPlate = (nodes: PlateNodes) => {
  if (!nodes.face.getAttribute('d')) return;
  nodes.face.setAttribute('d', '');
  nodes.walls.setAttribute('d', '');
  nodes.base.setAttribute('d', '');
};

/** Where a lifted plate's shadow falls on the ball, per unit of lift: away from the light, down and right. */
const SHADOW: [number, number] = [0.55, 0.8];
/** The light is high and soft, so a shadow travels no further than this however high its plate rises. */
const SHADOW_REACH = 12;

export const Globe = React.memo(
  React.forwardRef<GlobeHandle, Props>(function Globe({ onState }, handle) {
    const { anchor, say } = useReadout<HTMLDivElement>();
    const inView = useInView(anchor);
    const svg = React.useRef<SVGSVGElement>(null);
    const sorted = React.useRef<SVGGElement>(null);
    const standBack = React.useRef<SVGGElement>(null);
    const standFront = React.useRef<SVGGElement>(null);
    const labelLayer = React.useRef<SVGGElement>(null);
    const announce = React.useRef<HTMLSpanElement>(null);
    const gradient = React.useId().replace(/:/g, '');
    const dragging = React.useRef<{ id: number; x: number; y: number; moved: boolean; t: number; v: number; plate: [number, number] } | null>(null);
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
      /** Provinces of a split country: under the pointer, and picked (with `hover` and `selected` their country). */
      hoverPiece: -1,
      selectedPiece: -1,
      /** A split country joined up again: the next click puts it back. */
      rejoined: -1,
      splits: new Map<number, Split>(),
      /** A split country the view closes in on and follows; the spin waits while it is open. */
      focus: -1,
      focusMix: 0,
      /** Where the country being followed sits on screen, in view-box units, and the zoom that frames it. */
      focusBox: null as Box | null,
      /** The view's zoom as drawn, and how wide the drawing is on the page, for sizing names in pixels. */
      viewScale: 1,
      viewCenter: [WIDTH / 2, HEIGHT / 2] as [number, number],
      cssWidth: 0,
      cssHeight: 0,
      /** The +/− buttons while a country is framed scale the framing rather than the whole view. */
      focusZoom: 1,
      /** Splitting a southern country took the globe off its stand; joining it puts it back. */
      autoFree: false,
      loading: new Set<number>(),
      /** Countries whose pieces failed to load. */
      unsplit: new Set<number>(),
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
      /** What each plate drew last, reused while the ball and that plate hold still. */
      memo: [] as ({ d: number; empty: boolean; socket: string; shadow: string; walls: string; base: string; list: 'backBefore' | 'backAfter' | 'frontBefore' | 'frontAfter'; depth: number } | undefined)[],
      drawnOrient: null as Matrix | null,
      drawnMix: -1,
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
      const picked = state.selected >= 0 ? COUNTRIES[state.selected] : null;
      const split = picked ? state.splits.get(picked.index) : undefined;
      const out = picked && (state.broken || state.pulled.has(picked.index));
      const hint = !picked || !out || !hasDivisions(picked) || state.unsplit.has(picked.index)
        ? ''
        : split && split.target === 1
          ? `Click ${unitOf(split.data.pieces)} · click it again to join them up`
          : state.rejoined === picked.index
            ? `Click ${picked.name} again to put it back`
            : split
              ? `Click ${picked.name} again to split it into its ${piecesPhrase(split.data.pieces).length <= 34 ? piecesPhrase(split.data.pieces) : `${split.data.pieces.length} parts`}`
              : `Click ${picked.name} again to split it`;
      callbacks.current.onState({ broken: state.broken, spinning: state.spinning, pulled: state.pulled.size, scale: state.focus >= 0 ? 1.5 : state.scaleTarget, selected: state.selected, free: state.free, hint });
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
      state.plates = COUNTRIES.map((country) => plateNodes({ 'data-i': String(country.index) }));
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

    /**
     * Print each province's name on its piece, centred on its anchor, on one line or two, as large as fits
     * up to LABEL_PX. A piece too small for its name gets it beside the country instead, on a wire whose
     * dot lands on the piece. Names show only while their country is split open and followed.
     */
    const placeLabels = React.useCallback((split: Split, i: number) => {
      const state = live.current;
      // Names fade in once the view has nearly closed in and the pieces have spread, so they are fitted
      // once, at the size they will be read at, rather than searched for on every frame of the zoom.
      const shown = state.focus === i ? smoothstep(0.85, 1, split.at) * smoothstep(0.85, 1, state.focusMix) : 0;
      const unit = 1 / (state.viewScale * pixelsPerUnit(state.cssWidth, state.cssHeight));
      const all = state.focusBox;
      const litPiece = state.hover === i && state.hoverPiece >= 0 ? state.hoverPiece : state.hover < 0 && state.selected === i ? state.selectedPiece : -1;
      // Names show only while this country is split open and framed; otherwise they are all hidden.
      if (shown < 0.01 || !all) {
        for (const nodes of split.labels) if (nodes.group.style.display !== 'none') nodes.group.style.display = 'none';
        return;
      }
      type Placed = { p: number; x: number; y: number; ay: number; ax: number; px: number; lines: string[]; side: number; angle: number };
      const placed: Placed[] = [];
      // What the page shows of the drawing, in view-box units, less a small margin.
      const halfW = (state.cssWidth * unit) / 2;
      const halfH = (state.cssHeight * unit) / 2 || halfW;
      const seen = { left: state.viewCenter[0] - halfW + 6 * unit, right: state.viewCenter[0] + halfW - 6 * unit, top: state.viewCenter[1] - halfH + 6 * unit, bottom: state.viewCenter[1] + halfH - 6 * unit };

      // Fitting a name is the costly part, so at most two are fitted a frame; the rest wait their turn.
      let budget = 2;
      split.data.pieces.forEach((piece, p) => {
        const nodes = split.labels[p];
        const anchor = split.anchors[p];
        if (shown < 0.01 || !anchor || !split.boxes[p] || !all) {
          if (nodes.group.style.display !== 'none') nodes.group.style.display = 'none';
          return;
        }
        const box = split.boxes[p];
        const width = box[2] - box[0];
        const height = box[3] - box[1];
        let plan = split.plans[p];
        // Refitted only when the name's size against its piece changes, as after the +/− buttons.
        const ratio = (value: Plan) => (unit / width) * (value.width / value.unit);
        const stale = !plan || Math.abs(ratio(plan) - 1) > 0.06 || Math.abs(height / width - plan.height / plan.width) > 0.06 * (height / width);
        if (stale && !budget && plan) {
          // Keep the old fit until this name's turn comes.
        } else if (stale && !budget) {
          if (nodes.group.style.display !== 'none') nodes.group.style.display = 'none';
          return;
        } else if (stale) {
          budget--;
          const shape = split.shapes[p];
          // A name fits at a point when, on every row it covers (its top, middle and bottom), half its
          // width plus a margin stays inside the piece either way along its baseline. Horizontal first,
          // at each size, then turned to follow the piece.
          const fitsAt = ([x, y]: [number, number], lines: string[], px: number, angle: number) => {
            if (!shape) return false;
            const ux = Math.cos((angle * Math.PI) / 180);
            const uy = Math.sin((angle * Math.PI) / 180);
            const half = (Math.max(...lines.map((line) => line.length)) * CHAR_EM * px * unit) / 2 + 2 * unit;
            const tall = (lines.length * px * 1.25 * unit) / 2;
            return [0, -tall, tall].every((d) => reachAlong(shape, x - uy * d, y + ux * d, ux, uy) >= half);
          };
          const halves = twoLines(piece.label);
          // No angle can fit a name longer than the piece's diagonal: skip the search for those, which is
          // most of a country of many small units, and the costly case (a search that finds nothing).
          const shortest = Math.min(piece.label.length, halves ? Math.max(halves[0].length, halves[1].length) : Infinity) * CHAR_EM * LABEL_MIN_PX * unit;
          const roomy = Math.hypot(width, height) >= shortest;
          const spots = shape && roomy ? candidates(box, anchor).filter((spot) => reachAlong(shape, spot[0], spot[1], 1, 0) > 0) : [];
          let found: Plan | null = null;
          for (const angles of [[0], LABEL_ANGLES.slice(1)]) {
            for (let size = LABEL_PX; size >= LABEL_MIN_PX && !found; size -= 0.5) {
              for (const lines of halves ? [[piece.label], halves] : [[piece.label]]) {
                for (const angle of angles) {
                  const at = spots.find((spot) => fitsAt(spot, lines, size, angle));
                  if (at) {
                    found = { fx: (at[0] - box[0]) / width, fy: (at[1] - box[1]) / height, angle, lines, px: size, inside: true, width, height, unit };
                    break;
                  }
                }
                if (found) break;
              }
            }
            if (found) break;
          }
          plan = found ?? { fx: 0, fy: 0, angle: 0, lines: [piece.label], px: LABEL_PX, inside: false, width, height, unit };
          split.plans[p] = plan;
        }
        // A name fitted on its piece but cut off by the edge of the view goes beside the country instead.
        const at = [box[0] + plan!.fx * width, box[1] + plan!.fy * height];
        const reachX = (Math.max(...plan!.lines.map((line) => line.length)) * CHAR_EM * plan!.px * unit) / 2;
        const reachY = plan!.lines.length * plan!.px * 0.75 * unit;
        const reach = plan!.angle ? Math.max(reachX, reachY) : 0;
        const visible = at[0] - (reach || reachX) >= seen.left && at[0] + (reach || reachX) <= seen.right && at[1] - (reach || reachY) >= seen.top && at[1] + (reach || reachY) <= seen.bottom;
        if (plan!.inside && visible) {
          placed.push({ p, x: at[0], y: at[1], ax: anchor[0], ay: anchor[1], px: plan!.px, lines: plan!.lines, side: 0, angle: plan!.angle });
        } else {
          // Too small for its name: it is named beside the country, laid out below with the others.
          placed.push({ p, x: anchor[0], y: anchor[1], ax: anchor[0], ay: anchor[1], px: LABEL_PX, lines: [piece.label], side: 9, angle: 0 });
        }
      });

      // Every piece in view is named. Those whose name will not go on them are set in a column beside
      // the country, each as near the height of its own piece as the others allow, on the side its
      // piece is nearer; a side too full for its names passes its middlemost to the other. A crowded
      // column sets its names smaller (down to LABEL_MIN_PX) and closer. Where neither side has room
      // (a narrow phone), they go in rows under the country. Pieces out of view are not named.
      const pending: Placed[] = [];
      for (const label of placed.filter((item) => item.side === 9)) {
        placed.splice(placed.indexOf(label), 1);
        const out = (x: number, y: number) => x < seen.left || x > seen.right || y < seen.top || y > seen.bottom;
        if (out(label.ax, label.ay)) {
          // Its anchor is out of view, but part of the piece may not be (Alaska on a phone): anchor the
          // name at a point inside the piece within the part in view, else leave the piece unnamed.
          const box = split.boxes[label.p];
          const shape = split.shapes[label.p];
          const part: Box = [Math.max(box[0], seen.left), Math.max(box[1], seen.top), Math.min(box[2], seen.right), Math.min(box[3], seen.bottom)];
          const spot =
            shape && part[0] < part[2] && part[1] < part[3]
              ? candidates(part, [(part[0] + part[2]) / 2, (part[1] + part[3]) / 2]).find(([x, y]) => !out(x, y) && reachAlong(shape, x, y, 1, 0) > 0)
              : undefined;
          if (!spot) {
            const nodes = split.labels[label.p];
            if (nodes.group.style.display !== 'none') nodes.group.style.display = 'none';
            continue;
          }
          [label.ax, label.ay] = spot;
          [label.x, label.y] = spot;
        }
        pending.push(label);
      }
      const middle = (all[0] + all[2]) / 2;
      const wideOf = (label: Placed, px: number) => label.lines[0].length * CHAR_EM * px * unit;
      const widest = (labels: Placed[], px: number) => Math.max(0, ...labels.map((label) => wideOf(label, px)));
      const roomLeft = all[0] - 14 * unit - widest(pending, LABEL_MIN_PX) >= seen.left;
      const roomRight = all[2] + 14 * unit + widest(pending, LABEL_MIN_PX) <= seen.right;
      const height = seen.bottom - seen.top;
      /** The name size and spacing that fit `n` names in `span`, as large as allowed. */
      const fit = (n: number, span: number) => {
        const px = Math.max(LABEL_MIN_PX, Math.min(LABEL_PX, span / Math.max(n, 1) / (1.5 * unit)));
        return { px, pitch: Math.min(px * 1.5 * unit, span / Math.max(n - 1, 1)) };
      };
      /** Spread names down a column: each at its piece's height if it can be, never closer than `pitch`, all within [top, bottom]. */
      const spread = (labels: Placed[], pitch: number, top: number, bottom: number) => {
        labels.sort((a, b) => a.ay - b.ay);
        labels.forEach((label, k) => (label.y = Math.max(Math.min(label.ay, bottom), top, k ? labels[k - 1].y + pitch : top)));
        for (let k = labels.length - 1; k >= 0; k--) labels[k].y = Math.min(labels[k].y, k < labels.length - 1 ? labels[k + 1].y - pitch : bottom);
        labels.forEach((label, k) => (label.y = Math.max(label.y, k ? labels[k - 1].y + pitch : top)));
      };
      if (roomLeft || roomRight) {
        const sides: Record<number, Placed[]> = { [-1]: [], 1: [] };
        for (const label of pending) sides[(label.ax >= middle && roomRight) || !roomLeft ? 1 : -1].push(label);
        const capacity = Math.floor(height / (LABEL_MIN_PX * 1.5 * unit)) + 1;
        for (const [from, to] of [
          [-1, 1],
          [1, -1]
        ]) {
          if (!(to === 1 ? roomRight : roomLeft)) continue;
          sides[from].sort((a, b) => Math.abs(a.ax - middle) - Math.abs(b.ax - middle));
          while (sides[from].length > capacity && sides[to].length < capacity) sides[to].push(sides[from].shift()!);
        }
        for (const side of [-1, 1]) {
          const column = sides[side];
          if (!column.length) continue;
          const { px, pitch } = fit(column.length, height);
          const x = side > 0 ? Math.min(all[2] + 14 * unit, seen.right - widest(column, px)) : Math.max(all[0] - 14 * unit, seen.left + widest(column, px));
          for (const label of column) {
            label.side = side;
            label.px = px;
            label.x = x;
          }
          // A name reaches half a line above and below its middle, so the column stops that short of the edges.
          const half = px * 0.75 * unit;
          spread(column, pitch, seen.top + half, seen.bottom - half);
          placed.push(...column);
        }
      } else if (pending.length) {
        // Rows under the country, each wire dropping straight down from its piece to a dot with its
        // name beside it, to the right if every name fits there, else the left; rows are ordered so
        // every wire passes beside the names above it, never through one.
        const top = Math.min(all[3] + 16 * unit, seen.bottom - LABEL_MIN_PX * 0.75 * unit);
        const { px, pitch } = fit(pending.length, Math.max(seen.bottom - LABEL_MIN_PX * 0.75 * unit - top, LABEL_MIN_PX * unit));
        const rightward = pending.every((label) => label.ax + 4 * unit + wideOf(label, px) <= seen.right) || !pending.every((label) => label.ax - 4 * unit - wideOf(label, px) >= seen.left);
        pending
          .sort((a, b) => (rightward ? b.ax - a.ax : a.ax - b.ax))
          .forEach((label, k) => {
            label.px = px;
            label.y = top + k * pitch;
            label.x = rightward ? Math.min(label.ax + 4 * unit, seen.right - wideOf(label, px)) : Math.max(label.ax - 4 * unit, seen.left + wideOf(label, px));
            label.side = rightward ? 2 : -2;
          });
        placed.push(...pending);
      }
      for (const { p, x, y, ax, ay, px, lines, side, angle } of placed) {
        const nodes = split.labels[p];
        nodes.group.style.display = '';
        nodes.group.style.opacity = String(f(shown * 100) / 100);
        if ((p === litPiece) !== (nodes.group.dataset.lit !== undefined)) {
          if (p === litPiece) nodes.group.setAttribute('data-lit', '');
          else nodes.group.removeAttribute('data-lit');
        }
        if (side) {
          // The wire runs to just short of the name: its side, or its top when it sits underneath.
          const [ex, ey] = Math.abs(side) === 2 ? [ax, y] : [x - side * 3 * unit, y];
          const r = 1.6 * unit;
          const dot = (cx: number, cy: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0`;
          nodes.wire.setAttribute('d', `M${f(ax)} ${f(ay)}L${f(ex)} ${f(ey)}`);
          nodes.dots.setAttribute('d', dot(ax, ay) + dot(ex, ey));
          nodes.text.setAttribute('data-outside', '');
        } else {
          if (nodes.wire.getAttribute('d')) {
            nodes.wire.setAttribute('d', '');
            nodes.dots.setAttribute('d', '');
          }
          nodes.text.removeAttribute('data-outside');
        }
        const size = px * unit;
        nodes.text.setAttribute('font-size', String(f(size * 100) / 100));
        nodes.text.setAttribute('text-anchor', side > 0 ? 'start' : side < 0 ? 'end' : 'middle');
        [nodes.first, nodes.second].forEach((span, k) => {
          const text = lines[k] ?? '';
          if (span.textContent !== text) span.textContent = text;
          span.setAttribute('x', String(f(x)));
        });
        nodes.first.setAttribute('y', String(f(lines.length === 2 ? y - size * 0.62 : y)));
        nodes.second.setAttribute('y', String(f(y + size * 0.62)));
        if (angle) nodes.text.setAttribute('transform', `rotate(${angle} ${f(x)} ${f(y)})`);
        else nodes.text.removeAttribute('transform');
      }
    }, []);

    /** Draw the ball at its current spin, tilt and lifts, and put everything in painter's order. */
    const draw = React.useCallback(() => {
      const state = live.current;
      if (!state.built || !sorted.current) return;
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
      // With the ball held still (as while a country is split open), plates whose lift has not changed
      // are drawn exactly as last time, so only what moves is projected and written again.
      const same = state.drawnOrient !== null && state.drawnMix === state.mix && M.every((value, k) => value === state.drawnOrient![k]);
      state.drawnOrient = M.slice();
      state.drawnMix = state.mix;
      if (!same) {
        gridProjection.rotate(rotate);
        sink.reset();
        gridPath(graticule);
        state.graticule!.setAttribute('d', ringsPath(sink.rings, cx, cy, R * K, false));
      }

      const order = { backBefore: [] as [number, Element][], backAfter: [] as [number, Element][], frontBefore: [] as [number, Element][], frontAfter: [] as [number, Element][] };
      let sockets = '';
      // Seated plates all stand at one height, so their faces never overlap: their sides go down
      // first, together, and no side pokes over a neighbour's face along a shared border.
      let shadows = '';
      let seatedWalls = '';
      let seatedBase = '';
      const lit = state.hover >= 0 ? state.hover : state.tour >= 0 ? state.tour : state.selected;
      // The province lit: the one under the pointer, else the one picked while nothing else is hovered.
      const litPiece = state.hover >= 0 ? (state.hoverPiece >= 0 ? [state.hover, state.hoverPiece] : null) : state.selectedPiece >= 0 ? [state.selected, state.selectedPiece] : null;

      const relight = (i: number, nodes: PlateNodes) => {
        const isLit = i === lit && !litPiece ? 1 : 0;
        if (isLit !== state.drawnLit[i]) {
          state.drawnLit[i] = isLit;
          if (isLit) nodes.group.setAttribute('data-lit', '');
          else nodes.group.removeAttribute('data-lit');
        }
      };

      for (const country of COUNTRIES) {
        const i = country.index;
        const nodes = state.plates[i];
        const d = state.lift[i];
        const memo = state.memo[i];
        if (same && memo && memo.d === d && !state.splits.has(i)) {
          if (memo.empty) continue;
          sockets += memo.socket;
          shadows += memo.shadow;
          if (d === 0) {
            seatedWalls += memo.walls;
            seatedBase += memo.base;
          }
          relight(i, nodes);
          order[memo.list].push([memo.depth, nodes.group]);
          continue;
        }
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
        const socket = d > 0.3 && flatRings.length ? ringsPath(flatRings, cx, cy, R * K, true) : '';
        sockets += socket;
        let rings = flatRings;
        if (turned) {
          projection.rotate(rotationFrom(P, M, turned));
          sink.reset();
          path(country.feature);
          rings = sink.rings;
          projection.rotate(rotate);
        }

        const split = state.splits.get(i);
        if (!rings.length) {
          state.memo[i] = { d, empty: true, socket: '', shadow: '', walls: '', base: '', list: 'frontAfter', depth: 0 };
          clearPlate(nodes);
          if (split) {
            split.borders.setAttribute('d', '');
            split.nodes.forEach(clearPlate);
          }
          continue;
        }
        const [ox, oy] = [cx + dot(dir, BASIS.right) * d * K, cy - dot(dir, BASIS.up) * d * K];

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
        const listName: keyof typeof order = back ? (before ? 'backBefore' : 'backAfter') : before ? 'frontBefore' : 'frontAfter';
        const list = order[listName];

        const following = i === state.focus;
        // Framed by the whole plate until it splits, then by its pieces alone.
        // Framed by the whole plate until it splits, then by its pieces; either way its main landmass.
        if (following && !(split && split.at > 0)) state.focusBox = mainBox(rings.map((ring) => ({ box: growBox(emptyBox(), [ring], ox, oy, (R + PLATE) * K), weight: ringArea(ring, (R + PLATE) * K) })));
        if (split && split.at > 0) {
          // Split: the whole plate gives way to its provinces, which rise with it and spread apart along
          // the ball from the country's middle, each casting its own shadow.
          clearPlate(nodes);
          split.borders.setAttribute('d', '');
          const frame = turned ? multiply(M, turned) : M;
          if (turned) projection.rotate(rotationFrom(P, M, turned));
          const pieceBoxes: { box: Box; weight: number }[] = [];
          for (const piece of split.data.pieces) {
            const pieceNodes = split.nodes[piece.index];
            sink.reset();
            path(piece.feature);
            const pieceRings = sink.rings;
            if (!pieceRings.length) {
              clearPlate(pieceNodes);
              continue;
            }
            const at = apply(frame, piece.dir);
            const away = add(at, scale(dir, -dot(at, dir)));
            const spread = Math.hypot(...away) > 1e-6 ? scale(norm(away), SPREAD * split.at) : ([0, 0, 0] as Vec);
            const rise = d + (PIECE_RISE + split.raise[piece.index]) * split.at;
            const offset = add(spread, scale(dir, rise));
            const px = cx + dot(offset, BASIS.right) * K;
            const py = cy - dot(offset, BASIS.up) * K;
            pieceNodes.face.setAttribute('d', ringsPath(pieceRings, px, py, (R + PLATE) * K, true));
            pieceNodes.walls.setAttribute('d', wallsPath(pieceRings, px, py, R * K, (R + PLATE) * K));
            pieceNodes.base.setAttribute('d', ringsPath(pieceRings, px, py, R * K, true));
            const cast = Math.min(rise, SHADOW_REACH);
            shadows += ringsPath(pieceRings, cx + (SHADOW[0] * cast + dot(spread, BASIS.right)) * K, cy + (SHADOW[1] * cast - dot(spread, BASIS.up)) * K, R * K, true);
            const box = growBox(emptyBox(), pieceRings, px, py, (R + PLATE) * K);
            split.boxes[piece.index] = box;
            split.shapes[piece.index] = { rings: pieceRings, ox: px, oy: py, size: (R + PLATE) * K };
            pieceBoxes.push({ box, weight: piece.area });
            // The name's anchor, on the piece's top face; hidden when it is round the back.
            const anchor = apply(frame, piece.anchorDir);
            const top = add(scale(anchor, R + PLATE), offset);
            split.anchors[piece.index] = dot(anchor, BASIS.toward) > 0.05 ? [cx + dot(top, BASIS.right) * K, cy - dot(top, BASIS.up) * K] : null;
            const tone = Math.round(((dot(at, LIGHT) + 1) / 2) * 50) * 2;
            if (tone !== split.tone[piece.index]) {
              split.tone[piece.index] = tone;
              pieceNodes.face.style.setProperty('--wg-tone', `${tone}%`);
            }
            const isLit = litPiece && litPiece[0] === i && litPiece[1] === piece.index ? 1 : 0;
            if (isLit !== split.lit[piece.index]) {
              split.lit[piece.index] = isLit;
              if (isLit) pieceNodes.group.setAttribute('data-lit', '');
              else pieceNodes.group.removeAttribute('data-lit');
            }
            list.push([dot(at, BASIS.toward) * (R + PLATE / 2) + dot(offset, BASIS.toward), pieceNodes.group]);
          }
          if (turned) projection.rotate(rotate);
          if (following) state.focusBox = mainBox(pieceBoxes);
          placeLabels(split, i);
          continue;
        }
        if (split) {
          split.nodes.forEach(clearPlate);
          placeLabels(split, i);
          // Whole, the plate carries its provinces' borders like a printed globe.
          if (turned) projection.rotate(rotationFrom(P, M, turned));
          sink.reset();
          path(split.data.borders);
          split.borders.setAttribute('d', ringsPath(sink.rings, ox, oy, (R + PLATE) * K, false));
          if (turned) projection.rotate(rotate);
        }
        nodes.face.setAttribute('d', ringsPath(rings, ox, oy, (R + PLATE) * K, true));
        const walls = wallsPath(rings, ox, oy, R * K, (R + PLATE) * K);
        const base = ringsPath(rings, ox, oy, R * K, true);
        // A lifted plate casts its outline onto the ball: in this view a plate rising toward you would
        // otherwise not move at all.
        const shadow = d > 0.3 ? ringsPath(rings, cx + SHADOW[0] * Math.min(d, SHADOW_REACH) * K, cy + SHADOW[1] * Math.min(d, SHADOW_REACH) * K, R * K, true) : '';
        shadows += shadow;
        state.memo[i] = { d, empty: false, socket, shadow, walls, base, list: listName, depth };
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
        relight(i, nodes);
        list.push([depth, nodes.group]);
      }
      // While a country is split open, the rest of the map steps back so its provinces read.
      const focusing = state.focus >= 0 && (state.splits.get(state.focus)?.at ?? 0) > 0.2;
      if (focusing !== (svg.current?.dataset.focusing !== undefined)) {
        if (focusing) svg.current?.setAttribute('data-focusing', '');
        else svg.current?.removeAttribute('data-focusing');
      }
      // Written only when changed: the browser re-reads a whole path on every write.
      for (const [node, d] of [
        [state.sockets!, sockets],
        [state.shadows!, shadows],
        [state.seatedWalls!, seatedWalls],
        [state.seatedBase!, seatedBase]
      ] as const) {
        if (node.getAttribute('d') !== d) node.setAttribute('d', d);
      }

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
      const key = final.map((node) => { const data = (node as SVGElement).dataset; return data.i === undefined ? node.nodeName : `${data.i}.${data.p ?? ''}`; }).join();
      if (key !== state.order || sorted.current!.childNodes.length !== final.length) {
        state.order = key;
        sorted.current!.replaceChildren(...final);
      }

      // The readout: the country under the pointer or being shown, else where the ball faces.
      const country = lit >= 0 ? COUNTRIES[lit] : null;
      const litSplit = litPiece ? state.splits.get(litPiece[0]) : undefined;
      const piece = litPiece && litSplit ? litSplit.data.pieces[litPiece[1]] : null;
      const faces = facingPoint(P, M);
      const text = piece
        ? describePiece(piece, COUNTRIES[litPiece![0]])
        : country
        ? describe(country)
        : state.free
          ? `Facing ${latText(faces.lat)} ${lonText(faces.lon)}`
          : `Facing ${lonText(faces.lon)} · axis ${tilt.toFixed(1)}°`;
      if (text !== state.readout) {
        state.readout = text;
        say(text);
      }
    }, [graticule, gridPath, gridProjection, path, placeLabels, placeRing, projection, say, sink]);

    /** Where each plate is heading: home, a hover, or out (less for plates over the stand). */
    const targetOf = React.useCallback((i: number) => {
      const state = live.current;
      const out = state.broken || state.pulled.has(i);
      const lit = i === state.hover || i === state.tour;
      if (!out) return lit ? HOVER : 0;
      // A country split open for a close look rises only clear of its socket, so its pieces stay over
      // the ball (and off the stand, for a country low on it) and read against the sockets they left.
      if (i === state.focus) return FOCUS_LIFT;
      // On the stand, plates over the column barely rise; alone, every plate comes all the way out.
      const down = -apply(state.orient, COUNTRIES[i].dir)[2];
      const cap = LIFT - (LIFT - HOVER) * smoothstep(0.42, 0.78, down) * (1 - state.mix);
      return cap + (lit && state.broken ? 4 : 0);
    }, []);

    const placeView = React.useCallback(() => {
      const state = live.current;
      const whole = state.scale * (1 + (GLOBE_ONLY_SCALE - 1) * state.mix);
      const pull = Math.max(state.mix, Math.min(1, (state.scale - 1) / 0.6));
      let s = whole;
      let cx = WIDTH / 2 + (CENTER_FLAT[0] - WIDTH / 2) * pull;
      let cy = HEIGHT / 2 + (CENTER_FLAT[1] - HEIGHT / 2) * pull;
      // A split country is followed and framed: the view closes in until its pieces fill FOCUS_FILL of
      // it, easing the zoom in log scale so it feels even, and keeps them framed as they spread and turn.
      const frame = state.focusBox;
      if (state.focusMix > 0 && frame && Number.isFinite(frame[0])) {
        // What the page shows, in view-box units at zoom 1, then the zoom that makes the pieces fill it.
        const m = pixelsPerUnit(state.cssWidth, state.cssHeight);
        const seenW = state.cssWidth ? state.cssWidth / m : WIDTH;
        const seenH = state.cssHeight ? state.cssHeight / m : HEIGHT;
        const fit = Math.min(Math.max(Math.min(seenW / Math.max(frame[2] - frame[0], 1), seenH / Math.max(frame[3] - frame[1], 1)) * FOCUS_FILL, whole), FOCUS_MOST) * state.focusZoom;
        const ease = smoothstep(0, 1, state.focusMix);
        s = Math.exp(Math.log(whole) * (1 - ease) + Math.log(fit) * ease);
        cx += ((frame[0] + frame[2]) / 2 - cx) * ease;
        cy += ((frame[1] + frame[3]) / 2 - cy) * ease;
      }
      state.viewScale = s;
      state.viewCenter = [cx, cy];
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
        // Unmounting detaches the refs before the loop's cleanup cancels it, so a frame can land in between.
        if (!sorted.current) return false;
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
            // Turn the country to face you the right way up: north up, east to the right.
            const { axis, angle } = turnBetween(state.orient, faceMatrix(P, COUNTRIES[state.faceTarget].dir));
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
            const idle = state.spinning && !calm && state.focus < 0 ? scale(apply(state.orient, [0, 0, 1]), IDLE_RATE * RADIANS) : ([0, 0, 0] as Vec);
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
          const idle = state.spinning && !calm && state.focus < 0 ? IDLE_RATE : 0;
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

        // Split countries: the pieces spread and close on a spring, and the picked one stands a little higher.
        state.splits.forEach((split, i) => {
          if (split.at !== split.target || split.speed !== 0) {
            moving = true;
            if (calm) {
              split.at = split.target;
              split.speed = 0;
            } else {
              const steps = Math.max(1, Math.ceil(dt * 240));
              const slice = dt / steps;
              for (let step = 0; step < steps; step++) {
                split.speed += ((split.target - split.at) * 140 - split.speed * 17) * slice;
                split.at += split.speed * slice;
                if (split.at < 0) {
                  split.at = 0;
                  split.speed = 0;
                }
              }
              if (Math.abs(split.target - split.at) < 1e-3 && Math.abs(split.speed) < 1e-3) {
                split.at = split.target;
                split.speed = 0;
              }
            }
          }
          for (const piece of split.data.pieces) {
            const want = state.selected === i && state.selectedPiece === piece.index ? PIECE_PICKED : state.hover === i && state.hoverPiece === piece.index ? PIECE_RISE : 0;
            const now = split.raise[piece.index];
            if (now === want) continue;
            const next = calm ? want : now + (want - now) * (1 - Math.exp(-dt / 0.12));
            split.raise[piece.index] = Math.abs(next - want) < 1e-3 ? want : next;
            moving = true;
          }
        });

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

        const focusTarget = state.focus >= 0 ? 1 : 0;
        if (state.focusMix !== focusTarget) {
          const next = calm ? focusTarget : state.focusMix + (focusTarget - state.focusMix) * (1 - Math.exp(-dt / 0.3));
          state.focusMix = Math.abs(next - focusTarget) < 1e-3 ? focusTarget : next;
          moving = true;
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

    /** Load a country's provinces, once, and make their plates and the borders printed on the whole one. */
    const prepare = React.useCallback(
      (i: number) => {
        const state = live.current;
        const country = COUNTRIES[i];
        if (!hasDivisions(country) || state.unsplit.has(i)) return Promise.resolve(undefined);
        const ready = state.splits.get(i);
        if (ready) return Promise.resolve(ready);
        state.loading.add(i);
        return loadDivisions(country).catch(() => {
          // Without its pieces (say the files were not copied) the country just does not split.
          state.loading.delete(i);
          state.unsplit.add(i);
          report();
          return null;
        }).then((data) => {
          if (!data) return undefined;
          state.loading.delete(i);
          const parent = state.plates[i].group;
          const borders = parent.appendChild(make<SVGPathElement>('path', { class: `iso-line ${styles.borders}`, 'data-tone': 'mid' }));
          const labels = data.pieces.map((piece) => {
            const group = labelLayer.current!.appendChild(make<SVGGElement>('g', { class: styles.label, style: 'display:none', 'data-i': String(i), 'data-p': String(piece.index) }));
            const wire = group.appendChild(make<SVGPathElement>('path', { class: `iso-line ${styles.labelWire}`, 'data-tone': 'mid' }));
            const dots = group.appendChild(make<SVGPathElement>('path', { class: styles.labelDots }));
            const text = group.appendChild(make<SVGTextElement>('text', { class: styles.labelText }));
            const first = text.appendChild(make<SVGTSpanElement>('tspan'));
            const second = text.appendChild(make<SVGTSpanElement>('tspan'));
            return { group, wire, dots, text, first, second };
          });
          const split: Split = {
            data,
            nodes: data.pieces.map((piece) => plateNodes({ 'data-i': String(i), 'data-p': String(piece.index), class: `${styles.plate} ${styles.piece}` })),
            borders,
            at: 0,
            speed: 0,
            target: 0,
            raise: new Float64Array(data.pieces.length),
            tone: new Int8Array(data.pieces.length).fill(-1),
            lit: new Int8Array(data.pieces.length),
            labels,
            boxes: data.pieces.map(() => null as unknown as Box),
            shapes: data.pieces.map(() => null),
            plans: data.pieces.map(() => null),
            anchors: data.pieces.map(() => null)
          };
          state.splits.set(i, split);
          state.dirty = true;
          kick();
          report();
          return split;
        });
      },
      [kick, report]
    );

    /** Take the globe off its stand (turning freely) or put it back, settling onto the axis. */
    const placeFree = React.useCallback((on: boolean) => {
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
    }, []);

    /** Stop following a country; if splitting it took the globe off its stand, put it back. */
    const releaseFocus = React.useCallback(() => {
      const state = live.current;
      state.focus = -1;
      if (state.autoFree) {
        state.autoFree = false;
        placeFree(false);
      }
    }, [placeFree]);

    /** Join every split country up again. */
    const joinAll = React.useCallback(() => {
      const state = live.current;
      state.splits.forEach((split) => (split.target = 0));
      releaseFocus();
      state.selectedPiece = -1;
      state.hoverPiece = -1;
      state.rejoined = -1;
    }, [releaseFocus]);

    const setBroken = React.useCallback(
      (on: boolean) => {
        const state = live.current;
        if (state.broken === on) return;
        state.broken = on;
        state.pulled.clear();
        joinAll();
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
      [joinAll, report, touch]
    );

    /**
     * A click on a country or one of its provinces. A country comes out on the first click. A country with
     * provinces splits on the next, its provinces are then picked one by one, a second click on the picked
     * province joins them up again, and the click after that puts the country back.
     */
    const toggle = React.useCallback(
      (i: number, p = -1) => {
        const state = live.current;
        const country = COUNTRIES[i];
        const split = state.splits.get(i);
        const out = state.broken || state.pulled.has(i);
        const splitNow = () => {
          state.selected = i;
          state.selectedPiece = -1;
          state.rejoined = -1;
          void prepare(i).then((ready) => {
            if (!ready || !(live.current.broken || live.current.pulled.has(i))) return;
            ready.target = 1;
            const state = live.current;
            if (state.focus !== i) state.focusZoom = 1;
            state.focus = i;
            // A country the stand cannot turn to face you (the south, low on the tilted ball) is looked
            // at the way a person would: off the stand, turned to face you north up. Joining it up
            // puts the globe back.
            if (!state.free) {
              const spin = state.spin + wrap(spinToFace(P, country.lon, state.tilt) - state.spin);
              if (dot(apply(standMatrix(spin, state.tilt), country.dir), BASIS.toward) < 0.92) {
                state.autoFree = true;
                placeFree(true);
              }
            }
            if (state.free) state.faceTarget = i;
            else state.spinTarget = state.spin + wrap(spinToFace(P, country.lon, state.tilt) - state.spin);
            speak(`${country.name} splits into its ${piecesPhrase(ready.data.pieces)}.`);
            touch();
            report();
          });
        };
        if (p >= 0 && split && split.target === 1) {
          if (state.selected === i && state.selectedPiece === p) {
            split.target = 0;
            if (state.focus === i) releaseFocus();
            state.selectedPiece = -1;
            state.rejoined = i;
            speak(`${country.name} is whole again.`);
          } else {
            state.selected = i;
            state.selectedPiece = p;
            speak(describePiece(split.data.pieces[p], country));
          }
        } else if (out && hasDivisions(country) && !state.unsplit.has(i) && state.rejoined !== i && (!state.broken || state.selected === i)) {
          splitNow();
        } else if (state.broken) {
          state.rejoined = -1;
          state.selected = state.selected === i ? -1 : i;
        } else if (state.pulled.has(i)) {
          state.pulled.delete(i);
          if (split) split.target = 0;
          if (state.focus === i || state.autoFree) releaseFocus();
          state.rejoined = -1;
          if (state.selected === i) state.selected = -1;
          speak(`${country.name} is back in place.`);
        } else {
          state.pulled.add(i);
          state.selected = i;
          state.selectedPiece = -1;
          state.rejoined = -1;
          state.wait[i] = 0;
          // Fetch its provinces now, so they are ready by the next click.
          void prepare(i);
          speak(`${describe(country)}, pulled out.`);
        }
        touch();
        report();
      },
      [placeFree, prepare, releaseFocus, report, touch]
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
          if (!state.free) {
            const want = state.spin + wrap(spinToFace(P, country.lon, state.tilt) - state.spin);
            // Far south, a country is out of sight on the tilted stand: take the globe off to show it.
            if (dot(apply(standMatrix(want, state.tilt), country.dir), BASIS.toward) < 0.5) {
              state.autoFree = true;
              placeFree(true);
            } else state.spinTarget = want;
          }
          if (state.free) state.faceTarget = index;
          if (state.broken) {
            state.selected = index;
          } else {
            state.pulled.add(index);
            state.selected = index;
          }
          state.selectedPiece = -1;
          state.rejoined = -1;
          void prepare(index);
          speak(`${describe(country)}, pulled out.`);
          touch();
          report();
        },
        putBack() {
          const state = live.current;
          state.broken = false;
          state.pulled.clear();
          joinAll();
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
          // The visitor's choice: the globe stays where they put it when a split closes.
          state.autoFree = false;
          placeFree(on);
          speak(on ? 'The globe is off its stand: drag to turn it any way.' : 'The globe is back on its stand.');
          touch();
          report();
        },
        scaleBy(factor) {
          const state = live.current;
          if (state.focus >= 0) state.focusZoom = Math.max(0.25, Math.min(2.5, state.focusZoom * factor));
          else state.scaleTarget = Math.max(1, Math.min(SCALE_MOST, state.scaleTarget * factor));
          touch();
          report();
        },
        home() {
          const state = live.current;
          state.scaleTarget = 1;
          releaseFocus();
          state.tiltTarget = EARTH_TILT;
          touch();
          report();
        }
      }),
      [joinAll, placeFree, prepare, releaseFocus, report, setBroken, toggle, touch]
    );

    // ── Pointer: drag sideways to spin, up and down to slide the ring; click a country to pull it ──

    /** The country, and the province if it is one, under the pointer. */
    const plateAt = (target: EventTarget | null): [number, number] => {
      const group = (target as Element | null)?.closest?.('[data-i]') as SVGGElement | null;
      return group ? [Number(group.dataset.i), group.dataset.p === undefined ? -1 : Number(group.dataset.p)] : [-1, -1];
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
          const [plate, piece] = plateAt(event.target);
          if (plate !== state.hover || piece !== state.hoverPiece) {
            state.hover = plate;
            state.hoverPiece = piece;
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
        state.hoverPiece = -1;
      }
      // Screen pixels to view-box units, then the ball's surface follows the pointer at its middle.
      const box = svg.current?.getBoundingClientRect();
      const perPixel = box ? 1 / (state.viewScale * pixelsPerUnit(box.width, box.height)) : 1;
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
      else if (drag.plate[0] >= 0) toggle(drag.plate[0], drag.plate[1]);
      touch();
    };

    const onPointerLeave = () => {
      const state = live.current;
      if (state.hover >= 0 && !dragging.current) {
        state.hover = -1;
        state.hoverPiece = -1;
        touch();
      }
    };

    React.useEffect(() => {
      report();
    }, [report]);

    // Names are sized in screen pixels, so the drawing's width on the page is kept at hand.
    React.useEffect(() => {
      const node = svg.current;
      if (!node) return;
      const observer = new ResizeObserver(([entry]) => {
        live.current.cssWidth = entry.contentRect.width;
        live.current.cssHeight = entry.contentRect.height;
        live.current.dirty = true;
        kick();
      });
      observer.observe(node);
      return () => observer.disconnect();
    }, [kick]);

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
          <g ref={labelLayer} className={styles.labels} />
        </svg>
        <span ref={announce} className={styles.hidden} aria-live="polite" />
      </div>
    );
  })
);
