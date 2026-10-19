/**
 * A toy token embedding table: unit vectors in DIMS dimensions. The scene draws dimensions 0..2,
 * so the drawing is a linear projection and vector arithmetic stays exact on screen. Tokens that
 * mean similar things sit in one tight cluster; nothing is trained, and the analogy families share
 * one relation offset, the way training makes real embeddings line up.
 */

export const DIMS = 32;
const DRAWN = 3;
const SCALE = [18, 15, 18] as const;
const SIZE = 3200;

export type Space = {
  /** Whole words carry a leading space, as in a GPT-style vocabulary; pieces do not. */
  words: string[];
  vectors: Float32Array[];
  /** True for the scattered rare tokens between the clusters: drawn faint, never hovered. */
  dust: boolean[];
  /** True for capitalized tokens: kept out of word lists and hover. */
  capitalized: boolean[];
  index: Map<string, number>;
};

export type Neighbor = { word: string; index: number; cosine: number };

/** An analogy a : b :: c : ?, answered by b - a + c. */
export type Analogy = { a: string; b: string; c: string };

type Vec3 = [number, number, number];
type Cluster = { name: string; at: Vec3; words?: string; raw?: string[] };
type Pair = [string, string];
// The first two pairs [[x0, y0], [x1, y1]] make the family's analogy, read within the pairs,
// x0 : y0 :: x1 : y1 (pakistan : islamabad :: japan : tokyo), or across them, x0 : x1 :: y0 : y1
// (man : king :: woman : queen).
type Family = { pairs: [Pair, Pair, ...Pair[]]; reads: 'within' | 'across'; extra?: string };

// prettier-ignore
const CLUSTERS: Cluster[] = [
  {
    name: 'function',
    at: [-0.56, 0.08, 0.12],
    words:
      'the a an of to in at on for with by from about as into onto over under around through and or but not so too also very just than like then if because while though although yet nor either neither whether upon within without across along among against toward between beyond during',
  },
  {
    name: 'pronoun',
    at: [0.58, -0.04, -0.14],
    words:
      "I you we they it me us them my our your their its who what which when where how why that this these those there here it's you'll you're haven't I'm we're they're don't can't isn't won't I've we've whoever whatever myself yourself ourselves themselves itself",
  },
  {
    name: 'aux',
    at: [-0.62, 0.28, -0.15],
    words:
      'is was are were be been being have has had do does did will would can could should may might must shall get got make made let need ought used going gonna wanna',
  },
  {
    name: 'punct',
    at: [0.62, -0.32, -0.2],
    raw: [
      '.', ',', '!', '?', ';', ':', "'", '"', '(', ')', '-', '...', '[', ']', '{', '}', '/', '*',
      '&', '%', '#', '@', '_', '~', '|', '<', '>', '=', '+', ' (', ' -', ' "', " '", ' [', ' {',
      ' *', ' &', ' =', ' +', ' /', '),', ').', '."', ',"', '?"', '!"', "'s", "'t", "'ll", "'re",
      "'ve", "'d", "'m", '--', '->', '=>', '::', '();', '{}', '[]', '`', '```',
    ],
  },
  {
    name: 'suffix',
    at: [-0.64, -0.12, -0.2],
    raw: [
      'ing', 'ed', 'er', 'ers', 'ies', 'ity', 'ment', 'tion', 'ally', 'ly', 's', 'es', 'able',
      'ness', 'ful', 'less', 'ous', 'ive', 'ize', 'ise', 'ist', 'ism', 'al', 'ic', 'ary', 'ory',
      'ship', 'hood', 'ation', 'ence', 'ance', 'est', 'en', 'ish', 'ward', 'wise', 'ible', 'ial',
      'ian', 'ant', 'ent', 'ings', 'ments', 'tions', 'ated', 'ating', 'ized', 'izing', 'fully',
      'ably', 'ically', 'ure', 'age', 'ery', 'let', 'ette', 'oid', 'ology',
    ],
  },
  {
    name: 'time',
    at: [0.48, 0.28, -0.12],
    words:
      'time times day days year years week weeks month months hour hours minute minutes second moment life lifetime early late long soon start end begin beginning summer summers winter winters spring springs autumn autumns season seasons morning evening night today tomorrow yesterday age decade century future past now already ago left remaining until since before after always never often forever period era date calendar clock weekend holiday birthday deadline history',
  },
  {
    name: 'quantity',
    at: [-0.2, -0.05, 0.28],
    words:
      'most much more many few less least some any all each every no both half whole enough several plenty lot lots little big bigger biggest small smaller smallest large huge tiny first last next further extra only single double triple total entire full empty',
  },
  {
    name: 'code',
    at: [0.52, -0.2, 0.24],
    words:
      'software code engineer engineering developer programmer web products product app apps site blog source frontend backend fullstack react next nextjs rails ruby nestjs tailwind css html postgres redis graphql vercel docker aws javascript typescript node api database query bug debug deploy commit git github branch merge test tests build ship release server client compiler runtime function class method variable component hook state props route cache thread async loop array string integer null undefined script terminal keyboard linux open',
  },
  {
    name: 'work',
    at: [0.2, -0.28, -0.25],
    words:
      'job jobs work career company salary hire hiring manager office boss meeting project projects startup business money contract interview promotion university student degree study exam school graduate intern resume team client launch revenue focus founder leader leadership colleague customer market studio freelance remote',
  },
  {
    name: 'verb',
    at: [-0.44, 0.3, 0.16],
    words:
      'look looks like assume take find finish keep say tell feel try want need help show call ask turn move play hold bring happen sit stand lose pay meet include continue set change lead understand watch follow stop create speak allow add spend grow win offer remember love consider appear buy wait serve send expect stay fall cut reach remain suggest raise pass sell require report decide pull contribute',
  },
  {
    name: 'quality',
    at: [0.0, 0.3, 0.0],
    words:
      'happy sad hard easy good bad great wonderful fast slow clean messy simple calm angry afraid proud tired busy free grateful lonely hope fear joy pain peace nature honest kind brave gentle strange beautiful ugly real true false important possible clear sure certain ready',
  },
  {
    name: 'thing',
    at: [0.12, 0.0, 0.3],
    words:
      'things thing stuff everything nothing something anything world earth sun moon rain snow sea river tree forest mountain sky wind light dark fire water stone flower garden field road house room door window table chair book paper phone car',
  },
  { name: 'people', at: [-0.6, -0.3, 0.18] },
  { name: 'place', at: [0.55, 0.1, 0.22] },
  { name: 'number', at: [-0.1, -0.32, -0.15] },
  { name: 'dust', at: [0, 0, 0] },
];

// Pairs that share one relation offset, so the classic analogies hold by construction.
// prettier-ignore
const FAMILIES: Record<string, Family> = {
  people: {
    reads: 'across',
    pairs: [
      ['man', 'woman'], ['king', 'queen'], ['prince', 'princess'], ['boy', 'girl'],
      ['father', 'mother'], ['son', 'daughter'], ['brother', 'sister'], ['husband', 'wife'],
      ['uncle', 'aunt'], ['he', 'she'], ['him', 'her'], ['his', 'hers'], ['actor', 'actress'],
      ['waiter', 'waitress'], ['nephew', 'niece'], ['grandfather', 'grandmother'],
      ['emperor', 'empress'], ['duke', 'duchess'], ['sir', 'madam'], ['gentleman', 'lady'],
      ['mr', 'mrs'], ['dad', 'mom'], ['groom', 'bride'],
    ],
    extra:
      'people person friend friends parent parents child children family spouse human someone everyone baby kid kids neighbor stranger guest',
  },
  place: {
    reads: 'within',
    pairs: [
      ['pakistan', 'islamabad'], ['japan', 'tokyo'], ['france', 'paris'], ['turkey', 'ankara'],
      ['germany', 'berlin'], ['italy', 'rome'], ['spain', 'madrid'], ['england', 'london'],
      ['portugal', 'lisbon'], ['austria', 'vienna'], ['norway', 'oslo'], ['sweden', 'stockholm'],
      ['greece', 'athens'], ['egypt', 'cairo'], ['canada', 'ottawa'], ['ireland', 'dublin'],
      ['china', 'beijing'], ['india', 'delhi'], ['iran', 'tehran'], ['malaysia', 'kuala'],
    ],
    extra:
      'city country capital town village street home campus europe asia america africa north south east west lahore karachi peshawar multan abroad border',
  },
  verb: {
    reads: 'within',
    pairs: [
      ['walk', 'walked'], ['swim', 'swam'], ['run', 'ran'], ['go', 'went'], ['write', 'wrote'],
      ['think', 'thought'], ['take', 'took'], ['find', 'found'], ['see', 'saw'], ['give', 'gave'],
      ['come', 'came'], ['eat', 'ate'], ['speak', 'spoke'], ['drive', 'drove'], ['sing', 'sang'],
      ['fly', 'flew'], ['know', 'knew'], ['begin', 'began'], ['read', 'read_'], ['type', 'typed'],
      ['build', 'built'], ['live', 'lived'], ['finish', 'finished'], ['love', 'loved'],
      ['learn', 'learned'], ['work', 'worked'], ['play', 'played'], ['ship', 'shipped'],
    ],
  },
};

export const ANALOGIES: readonly Analogy[] = Object.values(FAMILIES).map(
  ({ pairs: [[x0, y0], [x1]], reads }) => {
    const [b, c] = reads === 'within' ? [y0, x1] : [x1, y0];
    return { a: ' ' + x0, b: ' ' + b, c: ' ' + c };
  }
);

const SYLLABLES =
  'th he in er an re on at en nd ti es or te of ed is it al ar st to nt ng se ha as ou io le ve co me de hi ri ro ic ne ea ra ce li ch ll be ma si om ur ca el ta la ns di fo ho pe ec pr no ct us ac ot il tr ly nc et ut ss so rs un lo wa ge ie wh ee wi em ad ol rt po we na ul ni ts mo ow pa im mi ai sh ir su id os iv ia am fi ci vi pl ig tu ev ld ry mp fe bl ab gh ty op wo sa ay ex ke fr oo av ag if ap gr od bo sp rd do uc bu ei ov by rm ep tt oc fa ef cu rn sc gi da yo cr cl du ga qu ue ff ba ey ls va um pp ua up lu go ht ru ug ds lt pi rc rr eg au ck ew mu br bi pt ak pu ui rg ib tl ny ki rk ys ob mm fu ph og ms ye ud mb ip ub oi rl gu dr hr cc tw ft wn nu af hu nn eo vo rv nf xp gn sm fl iz ok nl my gl aw sy oa';

/** Splits text into GPT-style tokens: whole words keep their leading space, long words split. */
export function tokenize(text: string) {
  const out: string[] = [];
  for (const piece of text.match(/\s?[A-Za-z']+|\s?\d+|\s?[^\sA-Za-z\d]/g) ?? []) {
    const lead = piece.startsWith(' ') ? ' ' : '';
    const word = piece.trim();
    const suffix = word.length > 6 && word.match(/(ing|tion|ally|ed|ly|er|ers|ies|ity|ment)$/);
    if (suffix) out.push(lead + word.slice(0, -suffix[0].length), suffix[0]);
    else if (word.length > 8) out.push(lead + word.slice(0, 5), word.slice(5));
    else out.push(piece);
  }
  return out;
}

function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildSpace(passage: string[], seed = 11): Space {
  const random = rng(seed);
  const gauss = () => Math.sqrt(-2 * Math.log(Math.max(random(), 1e-9))) * Math.cos(2 * Math.PI * random());
  // A drawn part plus a random hidden part of the given length.
  const direction = (drawn: ArrayLike<number>, hidden: number) => {
    const v = new Float32Array(DIMS);
    v.set(drawn, 0);
    let n = 0;
    for (let i = DRAWN; i < DIMS; i++) n += (v[i] = gauss()) ** 2;
    n = Math.sqrt(n);
    for (let i = DRAWN; i < DIMS; i++) v[i] *= hidden / n;
    return v;
  };
  const noise = (drawn: number, hidden: number) => {
    const v = new Float32Array(DIMS);
    for (let i = 0; i < DIMS; i++) v[i] = gauss() * (i < DRAWN ? drawn : hidden);
    return v;
  };
  const add = (...terms: [ArrayLike<number>, number?][]) => {
    const out = new Float32Array(DIMS);
    for (const [v, k = 1] of terms) for (let i = 0; i < DIMS; i++) out[i] += v[i] * k;
    return out;
  };
  const normalize = (v: Float32Array) => {
    let n = 0;
    for (let i = 0; i < DIMS; i++) n += v[i] * v[i];
    n = Math.sqrt(n);
    for (let i = 0; i < DIMS; i++) v[i] /= n;
    return v;
  };

  const words: string[] = [];
  const vectors: Float32Array[] = [];
  const cluster: number[] = [];
  const index = new Map<string, number>();
  const put = (token: string, v: Float32Array, c: number) => {
    if (index.has(token)) return;
    index.set(token, words.length);
    words.push(token);
    vectors.push(normalize(v));
    cluster.push(c);
  };

  // Rare tokens share one hidden direction that no cluster uses, so they stay out of word lists.
  const rare = direction([0, 0, 0], 1);
  const centers = CLUSTERS.map((c) => {
    const v = direction(c.at, 1);
    let dot = 0;
    for (let i = DRAWN; i < DIMS; i++) dot += v[i] * rare[i];
    let n = 0;
    for (let i = DRAWN; i < DIMS; i++) n += (v[i] -= dot * rare[i]) ** 2;
    const k = Math.sqrt(1 - Math.hypot(...c.at) ** 2) / Math.sqrt(n);
    for (let i = DRAWN; i < DIMS; i++) v[i] *= k;
    return v;
  });
  const noSpace = direction([0, 0.03, 0], 0.34);
  const capital = direction([0, -0.025, 0.02], 0.3);
  // Each word comes as ' word', often as 'word', and sometimes as ' Word', all close together.
  const variants = (base: Float32Array, word: string, c: number) => {
    put(' ' + word, add([base], [noise(0.004, 0.035)]), c);
    if (random() < 0.65) put(word, add([base], [noSpace], [noise(0.006, 0.04)]), c);
    if (/^[a-z]/.test(word) && random() < 0.5) {
      put(' ' + word[0].toUpperCase() + word.slice(1), add([base], [capital], [noise(0.006, 0.04)]), c);
    }
  };
  const word = (c: number, drawn = 0.026, hidden = 0.14) => add([centers[c]], [noise(drawn, hidden)]);

  CLUSTERS.forEach((spec, c) => {
    if (spec.raw) for (const s of spec.raw) put(s, word(c, 0.024, 0.14), c);
    if (spec.words) {
      for (const w of spec.words.split(' ')) if (!index.has(' ' + w)) variants(word(c), w, c);
    }
    const family = FAMILIES[spec.name];
    if (!family) return;
    const sx = -Math.sign(spec.at[0]);
    const rel = [sx * 0.072, 0.015, (random() - 0.5) * 0.04];
    const a = direction(rel, 0.26);
    const b = direction([-rel[0], -rel[1], -rel[2]], 0.26);
    let first: Float32Array | null = null;
    let opened = false;
    for (const [x, y] of family.pairs) {
      const role = add([centers[c]], [noise(0.022, 0.14)]);
      // The analogy's second pair sits across the relation, so its parallelogram opens up on screen.
      if (!first) first = role;
      else if (!opened) {
        role[0] = first[0] + 0.03 * sx;
        role[1] = first[1] + (centers[c][1] > 0 ? -0.12 : 0.12);
        role[2] = first[2];
        opened = true;
      }
      variants(add([role], [a]), x, c);
      variants(add([role], [b]), y.replace(/_$/, ''), c);
    }
    for (const w of family.extra?.split(' ') ?? []) variants(word(c), w, c);
  });

  // Numbers sit on a helix: periodic features in base 10 and 100, as probes find in real models.
  const num = CLUSTERS.findIndex((c) => c.name === 'number');
  const years = Array.from({ length: 41 }, (_, i) => 1990 + i);
  const values = [...Array.from({ length: 101 }, (_, i) => i), 128, 200, 256, 365, 500, 512, 1000, 1024, ...years];
  const axis = direction([0.17, 0.02, -0.06], 0);
  for (const n of values) {
    const v = add([centers[num]], [axis, Math.log10(n + 1) / 3.3 - 0.5], [noise(0.003, 0.06)]);
    const th10 = (2 * Math.PI * n) / 10;
    const th100 = (2 * Math.PI * n) / 100;
    v[1] += 0.035 * Math.cos(th10);
    v[2] += 0.035 * Math.sin(th10);
    v[DRAWN + 0] += 0.32 * Math.cos(th10);
    v[DRAWN + 1] += 0.32 * Math.sin(th10);
    v[DRAWN + 2] += 0.22 * Math.cos(th100);
    v[DRAWN + 3] += 0.22 * Math.sin(th100);
    v[DRAWN + 4] += 0.4 * (n >= 1900 && n <= 2100 ? 1 : 0);
    put(' ' + n, v, num);
    if (n < 100 && random() < 0.5) put(String(n), add([v], [noSpace]), num);
  }

  const dust = CLUSTERS.length - 1;
  const syllables = SYLLABLES.split(' ');
  const syllable = () => syllables[Math.floor(random() * syllables.length)];
  for (let i = 0; words.length < SIZE && i < 5000; i++) {
    const s = syllable() + (random() < 0.6 ? syllable() : '') + (random() < 0.2 ? syllable()[0] : '');
    const at = [(random() * 2 - 1) * 0.76, gauss() * 0.2, gauss() * 0.17];
    put((random() < 0.35 ? ' ' : '') + s, add([direction(at, 0.6)], [rare, 0.7]), dust);
  }

  for (const token of passage) {
    if (index.has(token)) continue;
    const spaced = index.get(' ' + token.trim());
    if (spaced !== undefined) put(token, add([vectors[spaced]], [noSpace]), cluster[spaced]);
    else put(token, word(dust), dust);
  }

  return {
    words,
    vectors,
    dust: cluster.map((c) => c === dust),
    capitalized: words.map((w) => w !== w.toLowerCase()),
    index
  };
}

/** Drawn position of a vector, in world units. */
export function position(v: ArrayLike<number>): [number, number, number] {
  return [v[0] * SCALE[0], v[1] * SCALE[1], v[2] * SCALE[2]];
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

/** Nearest tokens by cosine over all dimensions, capitalized tokens left out. */
export function neighbors(space: Space, query: ArrayLike<number>, k: number, exclude: number[] = []) {
  const skip = new Set(exclude);
  const best: Neighbor[] = [];
  space.vectors.forEach((vector, index) => {
    if (space.capitalized[index] || skip.has(index)) return;
    const c = cosine(query, vector);
    if (best.length < k || c > best[best.length - 1].cosine) {
      best.push({ word: space.words[index], index, cosine: c });
      best.sort((x, y) => y.cosine - x.cosine);
      if (best.length > k) best.pop();
    }
  });
  return best;
}

/** 3CosAdd, as word2vec evaluates analogies: argmax cos(x, b - a + c) without a, b and c. */
export function solve(space: Space, analogy: Analogy) {
  const [ia, ib, ic] = [analogy.a, analogy.b, analogy.c].map((token) => space.index.get(token)!);
  const sum = new Float32Array(DIMS);
  for (let d = 0; d < DIMS; d++) {
    sum[d] = space.vectors[ib][d] - space.vectors[ia][d] + space.vectors[ic][d];
  }
  const [answer] = neighbors(space, sum, 1, [ia, ib, ic]);
  const caption = `${analogy.b.trim()} - ${analogy.a.trim()} + ${analogy.c.trim()}`;
  return { ia, ib, ic, sum, answer, caption };
}
