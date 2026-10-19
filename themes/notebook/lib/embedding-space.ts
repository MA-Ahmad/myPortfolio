/**
 * A toy embedding table. Dimensions 0..2 are the drawn position, so the screen is one linear map
 * of the vectors and a sum of vectors lands on the sum of their points. Tokens that mean similar
 * things share a cluster signature in the other dimensions. Nothing is trained: the analogy
 * families share an exact offset, the way training makes real embeddings line up.
 */

export const DIMS = 32;

export type Space = {
  words: string[];
  vectors: Float32Array[];
  /** True for unlabeled points: never a neighbor, never hovered. */
  dust: boolean[];
  /** True for points drawn as strongly as words: words and the bodies of the clusters. */
  strong: boolean[];
  index: Map<string, number>;
};

export type Neighbor = { word: string; index: number; cosine: number };

export type Analogy = { a: string; b: string; c: string; caption: string };

export const ANALOGIES: Analogy[] = [
  { a: 'king', b: 'man', c: 'woman', caption: 'king - man + woman' },
  { a: 'islamabad', b: 'pakistan', c: 'japan', caption: 'islamabad - pakistan + japan' },
  { a: 'walked', b: 'walk', c: 'swim', caption: 'walked - walk + swim' }
];

// [x, y, z] of each cluster in drawn units, spread across the band.
const CLUSTERS: Record<string, { at: [number, number, number]; words: string[] }> = {
  function: {
    at: [-1.5, -1.2, 0.5],
    words: ['the', 'a', 'and', 'or', 'of', 'to', 'in', 'on', 'at', 'for', 'with', 'my', 'i', 'it', 'is', 'that', 'this', 'by', 'from', 'about', 'every', 'end', '.', ',']
  },
  web: {
    at: [7.5, 1.5, -1.5],
    words: ['react', 'next', 'rails', 'ruby', 'typescript', 'javascript', 'node', 'nestjs', 'tailwind', 'css', 'html', 'postgres', 'redis', 'graphql', 'api', 'vercel', 'aws', 'docker', 'git', 'github']
  },
  build: {
    at: [3, -2.5, 2.5],
    words: ['build', 'code', 'deploy', 'design', 'test', 'debug', 'refactor', 'review', 'merge', 'release', 'launch', 'fix', 'love']
  },
  product: {
    at: [9.5, -2, 2],
    words: ['web', 'products', 'product', 'app', 'site', 'blog', 'feature', 'users', 'page', 'interface', 'fast', 'clean', 'simple', 'feel', 'open', 'source']
  },
  time: {
    at: [-6, 2.5, -2],
    words: ['year', 'month', 'week', 'day', 'today', 'morning', 'night', 'monday', 'friday', 'summer', 'winter', 'hour', 'minute', 'always', 'soon']
  },
  places: {
    at: [-10, -1, 1.5],
    words: ['lahore', 'karachi', 'osaka', 'lyon', 'city', 'country', 'home', 'office', 'remote', 'world']
  },
  numbers: {
    at: [1, 3.5, -3],
    words: ['one', 'two', 'three', 'four', 'five', 'ten', 'hundred', '2017', '2019', '2021', '2023', '2026']
  },
  people: {
    at: [-4.5, -3.5, -1],
    words: ['person', 'team', 'friend', 'engineer', 'developer', 'designer', 'founder', 'reader']
  }
};

const FAMILIES: { cluster: string; pairs: [string, string][] }[] = [
  { cluster: 'people', pairs: [['man', 'woman'], ['king', 'queen'], ['boy', 'girl'], ['brother', 'sister']] },
  { cluster: 'places', pairs: [['pakistan', 'islamabad'], ['japan', 'tokyo'], ['france', 'paris'], ['turkey', 'ankara']] },
  { cluster: 'build', pairs: [['walk', 'walked'], ['swim', 'swam'], ['run', 'ran'], ['ship', 'shipped'], ['write', 'wrote']] }
];

const DUST = 1800;
const CLUSTER_BODY = 150;
const WORLD = 12;

function rng(seed: number) {
  return () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSpace(passage: string[], seed = 11): Space {
  const random = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(random() + 1e-9)) * Math.cos(2 * Math.PI * random());

  const words: string[] = [];
  const vectors: Float32Array[] = [];
  const dust: boolean[] = [];
  const strong: boolean[] = [];
  const index = new Map<string, number>();
  const put = (word: string, vector: Float32Array, isDust = false, isStrong = !isDust) => {
    if (!isDust && index.has(word)) return;
    if (!isDust) index.set(word, words.length);
    words.push(word);
    vectors.push(vector);
    dust.push(isDust);
    strong.push(isStrong);
  };

  const signature = (spread: number) => {
    const v = new Float32Array(DIMS);
    for (let d = 3; d < DIMS; d++) v[d] = gauss() * spread;
    return v;
  };
  const centers = Object.fromEntries(
    Object.entries(CLUSTERS).map(([name, { at }]) => {
      const v = signature(0.35);
      at.forEach((value, d) => (v[d] = value / WORLD));
      return [name, v];
    })
  );
  const near = (center: Float32Array, spread: number, extra = 0.12) => {
    const v = new Float32Array(DIMS);
    for (let d = 0; d < DIMS; d++) v[d] = center[d] + gauss() * (d < 3 ? spread : extra);
    return v;
  };

  // The shared offset points mostly sideways, toward the middle of the band, and the second pair
  // sits above or below the first, toward the band's middle, so the analogy opens up on screen.
  for (const { cluster, pairs } of FAMILIES) {
    const center = centers[cluster];
    const sx = -Math.sign(center[0]) || 1;
    const offset = signature(0.18);
    offset[0] = (sx * 1.3) / WORLD;
    offset[1] = 0.225 / WORLD;
    offset[2] = ((random() - 0.5) * 0.72) / WORLD;
    let first: Float32Array | null = null;
    pairs.forEach(([from, to], i) => {
      const base = near(center, 1.2 / WORLD, 0.1);
      if (!first) first = base;
      else if (i === 1) {
        base[0] = first[0] + (0.54 * sx) / WORLD;
        base[1] = first[1] + (center[1] > 0 ? -1.8 : 1.8) / WORLD;
        base[2] = first[2];
      }
      const target = new Float32Array(DIMS);
      for (let d = 0; d < DIMS; d++) target[d] = base[d] + offset[d] + gauss() * (d < 3 ? 0.01 : 0.07);
      put(from, base);
      put(to, target);
    });
  }

  for (const [name, { words: list }] of Object.entries(CLUSTERS)) {
    for (const word of list) put(word, near(centers[name], 1.3 / WORLD));
  }
  for (const word of passage) put(word, near(centers.function, 1.6 / WORLD, 0.2));

  // Unlabeled bodies give each cluster its density; dust fills the band around them.
  for (const center of Object.values(centers)) {
    for (let i = 0; i < CLUSTER_BODY; i++) put('', near(center, 1.7 / WORLD, 0.25), true, true);
  }
  for (let i = 0; i < DUST; i++) {
    const v = signature(0.3);
    v[0] = (gauss() * 6.5) / WORLD;
    v[1] = (gauss() * 2.8) / WORLD;
    v[2] = (gauss() * 3.2) / WORLD;
    put('', v, true);
  }

  return { words, vectors, dust, strong, index };
}

/** Drawn position of a vector, in world units. */
export function position(v: ArrayLike<number>): [number, number, number] {
  return [v[0] * WORLD, v[1] * WORLD, v[2] * WORLD];
}

export function cosine(a: ArrayLike<number>, b: ArrayLike<number>) {
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let d = 0; d < DIMS; d++) {
    dot += a[d] * b[d];
    na += a[d] * a[d];
    nb += b[d] * b[d];
  }
  return dot / (Math.sqrt(na * nb) || 1);
}

/** Nearest labeled tokens by cosine over all dimensions. */
export function neighbors(space: Space, query: ArrayLike<number>, k: number, exclude: number[] = []) {
  const skip = new Set(exclude);
  const best: Neighbor[] = [];
  space.vectors.forEach((vector, index) => {
    if (space.dust[index] || skip.has(index)) return;
    const c = cosine(query, vector);
    if (best.length < k || c > best[best.length - 1].cosine) {
      best.push({ word: space.words[index], index, cosine: c });
      best.sort((x, y) => y.cosine - x.cosine);
      if (best.length > k) best.pop();
    }
  });
  return best;
}

/** 3CosAdd: the argmax over the whole table of cos(x, a - b + c), inputs excluded. */
export function solve(space: Space, analogy: Analogy) {
  const [ia, ib, ic] = [analogy.a, analogy.b, analogy.c].map((word) => space.index.get(word)!);
  const sum = new Float32Array(DIMS);
  for (let d = 0; d < DIMS; d++) {
    sum[d] = space.vectors[ia][d] - space.vectors[ib][d] + space.vectors[ic][d];
  }
  const [answer] = neighbors(space, sum, 1, [ia, ib, ic]);
  return { ia, ib, ic, sum, answer, caption: analogy.caption };
}
