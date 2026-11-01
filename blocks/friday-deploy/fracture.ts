/**
 * How the key comes apart before the blast. The key is cut again and again, each cut splitting one
 * piece in two, and every cut is a crack: it runs across its piece from one end, then opens, the
 * two sides pulling away from each other and turning slightly about the far end, so the gap is a
 * wedge, widest where the crack began. The pieces left at the end are the blast's shards.
 *
 * A piece is drawn as the whole key, clipped by its outline and by its side of every crack that made
 * it, then moved by every crack that has opened between it and the whole key. Neighbours share each
 * crack's exact jagged line, so they always fit back together.
 */

export type Pt = { x: number; y: number };
export type Rand = (min: number, max: number) => number;

type Node = { parent: number; side: 1 | -1; cut: number; poly: Pt[] };

type Cut = {
  /** The piece it splits; its two halves are the nodes after it, side 1 first. */
  node: number;
  /** Its normal: side 1 is where it points. */
  n: Pt;
  /** The jagged line, from where the crack starts to where it ends, and its length to each point. */
  line: Pt[];
  at: number[];
  length: number;
  /** Where the line runs, from start to end. */
  d: Pt;
  /** Which way to turn side 1 so the crack opens at its start. */
  turn: number;
  /** How far the two sides slip along the crack as it opens, in gaps. */
  slip: number;
  path: Path2D;
  /** Each side's half of the plane, side 1 first. */
  regions: [Path2D, Path2D];
};

export type Piece = {
  node: number;
  /** Its centroid on the key, from the key's centre. */
  home: Pt;
  /** The cracks that made it, and its side of each. */
  edges: { cut: number; side: 1 | -1 }[];
};

export type FractureLook = {
  /** How wide a crack opens, in px at `--s: 1`. */
  gap: number;
  /** How far the sides of a crack turn apart, in degrees. */
  twist: number;
  /** How far a crack wanders off a straight line, in px at `--s: 1`. */
  jag: number;
};

/** When each crack starts and how long it takes to run its length, as fractions of the spread. */
const SPREAD = 0.8;
const RUN = 0.16;
/** How long a crack takes to open once it has run its length, as a fraction of the spread. */
const OPEN = 0.1;
/** How much wider every crack is pulled at the split, just before the bang. */
const STRAIN = 1.6;
const FAR = 600;

const clamp01 = (v: number) => Math.min(1, Math.max(0, v));
const easeOutCubic = (v: number) => 1 - Math.pow(1 - clamp01(v), 3);

function area(poly: Pt[]) {
  let sum = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    sum += a.x * b.y - b.x * a.y;
  }
  return Math.abs(sum) / 2;
}

/** 1 / 4π for a circle, 1/16 for a square, near 0 for a sliver. */
function compactness(poly: Pt[]) {
  let perimeter = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    perimeter += Math.hypot(b.x - a.x, b.y - a.y);
  }
  return area(poly) / (perimeter * perimeter);
}

export function centroid(poly: Pt[]): Pt {
  let x = 0;
  let y = 0;
  let signed = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const cross = a.x * b.y - b.x * a.y;
    signed += cross;
    x += (a.x + b.x) * cross;
    y += (a.y + b.y) * cross;
  }
  return { x: x / (3 * signed), y: y / (3 * signed) };
}

/** The part of a convex polygon on one side of the line through `p` with normal `n`. */
function cut(poly: Pt[], p: Pt, n: Pt, side: 1 | -1): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = side * ((a.x - p.x) * n.x + (a.y - p.y) * n.y);
    const db = side * ((b.x - p.x) * n.x + (b.y - p.y) * n.y);
    if (da >= 0) out.push(a);
    if (da >= 0 !== db >= 0) {
      const k = da / (da - db);
      out.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    }
  }
  return out;
}

/** Where the line through `p` with normal `n` crosses a convex polygon's outline. */
function chord(poly: Pt[], p: Pt, n: Pt): [Pt, Pt] {
  const hits: Pt[] = [];
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const da = (a.x - p.x) * n.x + (a.y - p.y) * n.y;
    const db = (b.x - p.x) * n.x + (b.y - p.y) * n.y;
    if (da >= 0 !== db >= 0) {
      const k = da / (da - db);
      hits.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
    }
  }
  return [hits[0], hits[1]];
}

export function roundedRect(w: number, h: number, r: number): Pt[] {
  const corners: [number, number, number][] = [
    [w / 2 - r, -h / 2 + r, -Math.PI / 2],
    [w / 2 - r, h / 2 - r, 0],
    [-w / 2 + r, h / 2 - r, Math.PI / 2],
    [-w / 2 + r, -h / 2 + r, Math.PI]
  ];
  const points: Pt[] = [];
  for (const [cx, cy, start] of corners) {
    for (let i = 0; i <= 6; i++) {
      const a = start + (i / 6) * (Math.PI / 2);
      points.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
    }
  }
  return points;
}

function pathOf(points: Pt[], close = false) {
  const path = new Path2D();
  points.forEach((p, i) => (i ? path.lineTo(p.x, p.y) : path.moveTo(p.x, p.y)));
  if (close) path.closePath();
  return path;
}

export type Fracture = ReturnType<typeof fracture>;

/**
 * Cuts the key (`outline`, around its centre) into `count` pieces, always splitting a large piece
 * and preferring pieces near the middle, so the centre breaks finer than the corners, like glass
 * around the point of impact. `rand` decides the pieces, which the blast was tuned on; `crackRand`
 * only the look of the cracks, so changing that never changes the blast.
 */
export function fracture(
  outline: Pt[],
  count: number,
  reach: number,
  s: number,
  look: FractureLook,
  rand: Rand,
  crackRand: Rand
) {
  const nodes: Node[] = [{ parent: -1, side: 1, cut: -1, poly: outline }];
  const raw: { node: number; p: Pt; n: Pt }[] = [];
  let leaves = [0];
  let attempts = 0;
  while (leaves.length < count && attempts++ < count * 20) {
    let pick = 0;
    let best = -1;
    leaves.forEach((id, i) => {
      const piece = nodes[id].poly;
      const c = centroid(piece);
      const score =
        area(piece) * (1 + 0.9 * (1 - Math.min(1, Math.hypot(c.x, c.y) / reach))) * rand(0.8, 1.2);
      if (score > best) {
        best = score;
        pick = i;
      }
    });
    const id = leaves[pick];
    const piece = nodes[id].poly;
    const c = centroid(piece);
    const size = Math.sqrt(area(piece));
    const p = { x: c.x + rand(-0.22, 0.22) * size, y: c.y + rand(-0.22, 0.22) * size };
    const angle = rand(0, Math.PI);
    const n = { x: Math.cos(angle), y: Math.sin(angle) };
    const a = cut(piece, p, n, 1);
    const b = cut(piece, p, n, -1);
    if (a.length < 3 || b.length < 3 || area(a) < 40 || area(b) < 40) continue;
    // No slivers: real shards are chunky, and slivers vanish when they tumble edge-on.
    if (compactness(a) < 0.036 || compactness(b) < 0.036) continue;
    nodes[id].cut = raw.length;
    raw.push({ node: id, p, n });
    nodes.push({ parent: id, side: 1, cut: -1, poly: a });
    nodes.push({ parent: id, side: -1, cut: -1, poly: b });
    leaves = [
      ...leaves.slice(0, pick),
      nodes.length - 2,
      nodes.length - 1,
      ...leaves.slice(pick + 1)
    ];
  }

  const impact = { x: crackRand(-0.15, 0.15) * reach, y: crackRand(-0.15, 0.15) * reach };
  const cuts: Cut[] = raw.map(({ node, p, n }) => {
    const [a, b] = chord(nodes[node].poly, p, n);
    const [from, to] =
      Math.hypot(a.x - impact.x, a.y - impact.y) <= Math.hypot(b.x - impact.x, b.y - impact.y)
        ? [a, b]
        : [b, a];
    const length = Math.hypot(to.x - from.x, to.y - from.y);
    const d = { x: (to.x - from.x) / length, y: (to.y - from.y) / length };
    // A random walk across the normal with the odd sharp kink, pinned to the straight cut at both
    // ends so it meets the edge and the cracks it runs between.
    const steps = Math.max(3, Math.round(length / (2.4 * s)));
    const line: Pt[] = [];
    const at: number[] = [];
    let offset = 0;
    for (let i = 0; i <= steps; i++) {
      const k = i / steps;
      const pin = Math.min(1, i, steps - i);
      const kink = crackRand(0, 1) < 0.12 ? crackRand(-1.8, 1.8) : 0;
      offset = (offset * 0.6 + (crackRand(-1, 1) + kink) * look.jag * s) * pin;
      line.push({
        x: from.x + (to.x - from.x) * k + n.x * offset,
        y: from.y + (to.y - from.y) * k + n.y * offset
      });
      at.push(i ? at[i - 1] + Math.hypot(line[i].x - line[i - 1].x, line[i].y - line[i - 1].y) : 0);
    }
    const start = { x: from.x - d.x * FAR, y: from.y - d.y * FAR };
    const end = { x: to.x + d.x * FAR, y: to.y + d.y * FAR };
    const half = (side: 1 | -1) =>
      pathOf(
        [
          start,
          ...line,
          end,
          { x: end.x + side * n.x * FAR, y: end.y + side * n.y * FAR },
          { x: start.x + side * n.x * FAR, y: start.y + side * n.y * FAR }
        ],
        true
      );
    // Turning about the end by θ moves the start by θ·L across the line, one way or the other.
    const across = -d.y * n.x + d.x * n.y;
    return {
      node,
      n,
      line,
      at,
      length: at[steps],
      d,
      turn: across >= 0 ? -1 : 1,
      slip: crackRand(-0.35, 0.35),
      path: pathOf(line),
      regions: [half(1), half(-1)]
    };
  });

  const pieces: Piece[] = leaves.map((node) => {
    const edges: Piece['edges'] = [];
    for (let id = node; nodes[id].parent >= 0; id = nodes[id].parent) {
      edges.push({ cut: nodes[nodes[id].parent].cut, side: nodes[id].side });
    }
    return { node, home: centroid(nodes[node].poly), edges };
  });

  const outlinePath = pathOf(outline, true);
  const startOf = (j: number) => (SPREAD * j) / Math.max(1, cuts.length - 1);

  /** How far each crack has run (0 to 1) and opened (0 to 1, more under strain) at `spread`. */
  const state = (spread: number, split: number) =>
    cuts.map((_, j) => {
      const run = clamp01((spread - startOf(j)) / RUN);
      const open = easeOutCubic((spread - startOf(j) - RUN) / OPEN);
      return { run, open, wide: open * (1 + STRAIN * split) };
    });

  /** Where every piece of the tree has moved to, as transforms in key pixels. */
  const transforms = (spread: number, split: number) => {
    const cracks = state(spread, split);
    const out: DOMMatrix[] = [new DOMMatrix()];
    for (let id = 1; id < nodes.length; id++) {
      const { parent, side } = nodes[id];
      const j = nodes[parent].cut;
      const c = cuts[j];
      const wide = cracks[j].wide;
      if (wide <= 0) {
        out.push(out[parent]);
        continue;
      }
      const gap = (look.gap * s * wide) / 2;
      const slip = gap * c.slip;
      const hinge = c.line[c.line.length - 1];
      const angle = side * c.turn * look.twist * wide * 0.5;
      out.push(
        out[parent]
          .translate(side * (c.n.x * gap + c.d.x * slip), side * (c.n.y * gap + c.d.y * slip))
          .translate(hinge.x, hinge.y)
          .rotate(angle)
          .translate(-hinge.x, -hinge.y)
      );
    }
    return { cracks, out };
  };

  const clip = (ctx: CanvasRenderingContext2D, piece: Piece) => {
    ctx.clip(outlinePath);
    for (const { cut: j, side } of piece.edges) ctx.clip(cuts[j].regions[side === 1 ? 0 : 1]);
  };

  return {
    pieces,
    outline: outlinePath,

    /** How many cracks have started by `spread`, to tick a sound for each new one. */
    started(spread: number) {
      let n = 0;
      while (n < cuts.length && startOf(n) < spread) n++;
      return n;
    },

    transforms,

    /** Clips to one piece, in key pixels. */
    clip,

    /** Strokes every edge of a piece, the key's outline included, for a shard's rim. */
    strokeEdges(ctx: CanvasRenderingContext2D, piece: Piece) {
      ctx.stroke(outlinePath);
      for (const { cut: j } of piece.edges) ctx.stroke(cuts[j].path);
    },

    /**
     * The key in pieces at `spread` and `split`, centred on the origin: `texture` is drawn so that
     * its key's centre lands there. Through the gaps, the dark inside of the key.
     */
    draw(
      ctx: CanvasRenderingContext2D,
      spread: number,
      split: number,
      paintKey: (ctx: CanvasRenderingContext2D) => void
    ) {
      const { cracks, out } = transforms(spread, split);

      ctx.fillStyle = '#050506';
      ctx.fill(outlinePath);

      for (const piece of pieces) {
        const m = out[piece.node];
        ctx.save();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        clip(ctx, piece);
        paintKey(ctx);

        // A piece turned out of the key's plane catches the light, or loses it.
        const tilt = Math.atan2(m.b, m.a);
        if (Math.abs(tilt) > 0.001) {
          ctx.fillStyle = tilt > 0 ? '#fff' : '#000';
          ctx.globalAlpha = Math.min(0.06, Math.abs(tilt) * 1.5);
          ctx.fill(outlinePath);
          ctx.globalAlpha = 1;
        }

        // Along each open crack, the broken edge: a band of the key's core and a lip of light.
        ctx.lineJoin = 'round';
        for (const { cut: j } of piece.edges) {
          const open = cracks[j].open;
          if (open <= 0.01) continue;
          ctx.strokeStyle = `rgba(58,58,66,${0.95 * open})`;
          ctx.lineWidth = 2.8 * s;
          ctx.stroke(cuts[j].path);
          ctx.strokeStyle = `rgba(150,150,160,${0.45 * open})`;
          ctx.lineWidth = 0.7 * s;
          ctx.stroke(cuts[j].path);
        }
        ctx.restore();
      }

      // Cracks still running, and those not yet open: a hairline across their piece.
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      cuts.forEach((c, j) => {
        const { run, open } = cracks[j];
        if (run <= 0 || open >= 1) return;
        const reachTo = c.length * run;
        const partial: Pt[] = [c.line[0]];
        for (let i = 1; i < c.line.length; i++) {
          if (c.at[i] <= reachTo) {
            partial.push(c.line[i]);
            continue;
          }
          const a = c.line[i - 1];
          const b = c.line[i];
          const k = (reachTo - c.at[i - 1]) / (c.at[i] - c.at[i - 1]);
          partial.push({ x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k });
          break;
        }
        const m = out[c.node];
        ctx.save();
        ctx.transform(m.a, m.b, m.c, m.d, m.e, m.f);
        ctx.globalAlpha = 1 - open;
        const path = pathOf(partial);
        ctx.strokeStyle = 'rgba(0,0,0,0.9)';
        ctx.lineWidth = 1.1 * s;
        ctx.stroke(path);
        ctx.translate(0.5 * s, 0.6 * s);
        ctx.strokeStyle = 'rgba(255,255,255,0.14)';
        ctx.lineWidth = 0.6 * s;
        ctx.stroke(path);
        ctx.restore();
      });
    }
  };
}
