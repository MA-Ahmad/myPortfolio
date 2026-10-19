import * as THREE from 'three';
import { onSchemeChange, prefersReducedMotion, readTokens } from './color-tokens';
import { ANALOGIES, buildSpace, neighbors, position, solve, tokenize, type Neighbor } from './embedding-space';

type Options = {
  tokenSource: Element;
  /** The positioned stage; labels and plates are added to it. */
  labelHost: HTMLElement;
  classes: { label: string; small: string; block: string; head: string; row: string; box: string };
  passage: string;
  onReady: () => void;
};

const K = 8;
const STEP = 3.4;
const GLIDE = 1.5;
const TRAIL = 5;
const SWING = 96;
const YAW = 0.32;
const PITCH = 0.2;
const FOV = 30;
const HALF_W = 11.6;
const HALF_H = 6;
const DEPTH = 6;
// A very wide stage squashes y and lifts the band into the unfaded top of the mask.
const WIDE_FROM = 2.4;
const WIDE_SPAN = 0.8;
const WIDE_SQUASH = 0.42;
const WIDE_LIFT = 0.15;
const ANALOGY_PERIOD = 20;
const ANALOGY_OFFSET = 2;
const STILL_T = 6;
const FRAME_MS = 1000 / 30;
const POINTER_MS = 3000;
const HOVER_RADIUS = 14;
const MAX_SEGMENTS = 128;
const MAX_HIGHLIGHTS = 48;
const LABEL_SPACING = 12;
const LABEL_CLEARANCE = 12;

const clamp = (x: number, a: number, b: number) => Math.min(b, Math.max(a, x));
const smooth = (a: number, b: number, x: number) => {
  const u = clamp((x - a) / (b - a), 0, 1);
  return u * u * (3 - 2 * u);
};
const show = (token: string) => (token.startsWith(' ') ? `·${token.slice(1)}` : token);

const pointVertex = /* glsl */ `
  attribute float aMix;
  attribute float aSize;
  uniform float uPR, uScale, uNear, uFar, uFade;
  varying float vMix;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    float depth = -mv.z;
    float near = clamp((uFar - depth) / (uFar - uNear), 0.0, 1.0);
    vMix = aMix * mix(1.0 - uFade, 1.0, near);
    gl_PointSize = floor(clamp(aSize * uScale / depth, 1.0, 7.0) * uPR + 0.5);
  }
`;

const pointFragment = /* glsl */ `
  uniform vec3 uBg, uInk;
  varying float vMix;
  void main() { gl_FragColor = vec4(mix(uBg, uInk, vMix), 1.0); }
`;

export function mountEmbeddings(canvas: HTMLCanvasElement, options: Options) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
  if (!gl) return () => {};

  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const pr = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pr);

  const host = options.labelHost;
  const { classes } = options;
  const passage = tokenize(options.passage.toLowerCase());
  const space = buildSpace(passage);
  const sequence = passage.map((token) => space.index.get(token) ?? 0);
  const N = space.words.length;
  const positions = new Float32Array(N * 3);
  space.vectors.forEach((v, i) => positions.set(position(v), i * 3));
  const at = (i: number, out = new THREE.Vector3()) =>
    out.set(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  const neighborCache = new Map<number, Neighbor[]>();
  const nearest = (i: number) => {
    let list = neighborCache.get(i);
    if (!list) {
      list = neighbors(space, space.vectors[i], K, [i]);
      neighborCache.set(i, list);
    }
    return list;
  };
  const analogies = ANALOGIES.map((spec) => {
    const solved = solve(space, spec);
    return { ...solved, q: new THREE.Vector3(...position(solved.sum)) };
  });

  // Every 3D object lives in one group, so the wide squash stays one linear map.
  const scene = new THREE.Scene();
  const world = new THREE.Group();
  scene.add(world);
  const camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 200);

  const bg = new THREE.Color();
  const ink = new THREE.Color();
  const pointMaterial = (fade: number) =>
    new THREE.ShaderMaterial({
      uniforms: {
        uBg: { value: bg },
        uInk: { value: ink },
        uPR: { value: pr },
        uScale: { value: 30 },
        uNear: { value: 10 },
        uFar: { value: 30 },
        uFade: { value: fade }
      },
      vertexShader: pointVertex,
      fragmentShader: pointFragment
    });

  const cloudGeometry = new THREE.BufferGeometry();
  const mixes = new Float32Array(N);
  const sizes = new Float32Array(N);
  space.dust.forEach((isDust, i) => {
    mixes[i] = isDust ? 0.34 : 0.62;
    sizes[i] = isDust ? 1.4 : 2.1;
  });
  cloudGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  cloudGeometry.setAttribute('aMix', new THREE.BufferAttribute(mixes, 1));
  cloudGeometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1));
  const cloudMaterial = pointMaterial(0.62);
  world.add(new THREE.Points(cloudGeometry, cloudMaterial));

  const hiGeometry = new THREE.BufferGeometry();
  const hiPosition = new THREE.BufferAttribute(new Float32Array(MAX_HIGHLIGHTS * 3), 3);
  const hiMix = new THREE.BufferAttribute(new Float32Array(MAX_HIGHLIGHTS), 1);
  const hiSize = new THREE.BufferAttribute(new Float32Array(MAX_HIGHLIGHTS), 1);
  hiGeometry.setAttribute('position', hiPosition);
  hiGeometry.setAttribute('aMix', hiMix);
  hiGeometry.setAttribute('aSize', hiSize);
  const hiMaterial = pointMaterial(0.2);
  hiMaterial.depthTest = false;
  const highlights = new THREE.Points(hiGeometry, hiMaterial);
  highlights.renderOrder = 2;
  highlights.frustumCulled = false;
  world.add(highlights);

  const lineGeometry = new THREE.BufferGeometry();
  const linePosition = new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * 6), 3);
  const lineColor = new THREE.BufferAttribute(new Float32Array(MAX_SEGMENTS * 6), 3);
  lineGeometry.setAttribute('position', linePosition);
  lineGeometry.setAttribute('color', lineColor);
  const lineMaterial = new THREE.LineBasicMaterial({ vertexColors: true, depthTest: false });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  lines.renderOrder = 1;
  lines.frustumCulled = false;
  world.add(lines);

  const paint = () => {
    const tokens = readTokens(options.tokenSource);
    bg.setRGB(...tokens.bg);
    ink.setRGB(...tokens.ink);
  };
  paint();

  // Per-frame buffers
  let segments = 0;
  let lit = 0;
  const mixed = new THREE.Color();
  const seg = (a: THREE.Vector3, b: THREE.Vector3, m0: number, m1 = m0) => {
    if (segments >= MAX_SEGMENTS) return;
    const o = segments * 6;
    linePosition.array.set([a.x, a.y, a.z, b.x, b.y, b.z], o);
    mixed.copy(bg).lerp(ink, clamp(m0, 0, 1));
    lineColor.array.set([mixed.r, mixed.g, mixed.b], o);
    mixed.copy(bg).lerp(ink, clamp(m1, 0, 1));
    lineColor.array.set([mixed.r, mixed.g, mixed.b], o + 3);
    segments++;
  };
  const highlight = (p: THREE.Vector3, m: number, size: number) => {
    if (lit >= MAX_HIGHLIGHTS || m <= 0) return;
    hiPosition.array.set([p.x, p.y, p.z], lit * 3);
    hiMix.array[lit] = clamp(m, 0, 1);
    hiSize.array[lit] = size;
    lit++;
  };

  // DOM overlay: labels, neighbor plates, and boxes, positioned in CSS pixels.
  const pool = (className: string) => {
    const items: HTMLElement[] = [];
    let used = 0;
    return {
      take() {
        let element = items[used];
        if (!element) {
          element = document.createElement('div');
          element.className = className;
          host.appendChild(element);
          items.push(element);
        }
        used++;
        element.style.visibility = 'visible';
        return element;
      },
      reset() {
        used = 0;
      },
      hideRest() {
        for (let i = used; i < items.length; i++) items[i].style.visibility = 'hidden';
      },
      remove() {
        items.forEach((element) => element.remove());
      }
    };
  };
  const labelPool = pool(`${classes.label} ${classes.small}`);
  const boxPool = pool(classes.box);
  const blockPool = pool(classes.block);

  let width = 1;
  let height = 1;
  let showWords = true;
  let distance = 30;
  const screen = new THREE.Vector3();
  const toScreen = (p: THREE.Vector3) => {
    screen.copy(p).applyMatrix4(world.matrixWorld).project(camera);
    return { x: (screen.x * 0.5 + 0.5) * width, y: (0.5 - screen.y * 0.5) * height };
  };
  const placeAt = (element: HTMLElement, x: number, y: number, opacity: number) => {
    element.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px)`;
    element.style.opacity = String(clamp(opacity, 0, 1));
  };
  // Labels take the first free spot beside their point, stepping up and down, so they never cover
  // the word list or each other. An optional label is dropped when no spot is free.
  const placed: { x: number; y: number; w: number; half: number }[] = [];
  const hits = (x: number, y: number, w: number) =>
    placed.some((r) => x < r.x + r.w + 4 && x + w + 4 > r.x && Math.abs(y - r.y) < r.half);
  const textSizes = new Map<string, { w: number; h: number }>();
  const probe = document.createElement('div');
  probe.className = `${classes.label} ${classes.small}`;
  probe.style.visibility = 'hidden';
  probe.setAttribute('aria-hidden', 'true');
  host.appendChild(probe);
  const sizeOf = (text: string) => {
    let size = textSizes.get(text);
    if (!size) {
      probe.textContent = text;
      size = { w: probe.offsetWidth, h: probe.offsetHeight };
      textSizes.set(text, size);
    }
    return size;
  };
  const measure = (element: HTMLElement, text: string) => {
    if (element.textContent !== text) element.textContent = text;
    return sizeOf(text);
  };
  const write = (text: string, x: number, y: number, opacity: number) => {
    if (opacity <= 0.01) return 0;
    const element = labelPool.take();
    const { w, h } = measure(element, text);
    placeAt(element, x, y - h / 2, opacity);
    return w;
  };
  const label = (text: string, p: THREE.Vector3, opacity: number, dy = 0, extra = 0, optional = false) => {
    if (!showWords || opacity <= 0.01) return null;
    const element = labelPool.take();
    const { w, h } = measure(element, text);
    const s = toScreen(p);
    const full = w + extra;
    const sides = s.x + 7 + full > width - 6 ? [-1, 1] : [1, -1];
    let best: { x: number; y: number } | null = null;
    for (const k of [0, -1, 1, -2, 2]) {
      for (const side of sides) {
        const x = side > 0 ? s.x + 7 : s.x - 7 - full;
        const y = s.y + dy + k * LABEL_SPACING;
        if (!hits(x, y, full)) {
          best = { x, y };
          break;
        }
      }
      if (best) break;
    }
    if (!best) {
      if (optional) {
        element.style.visibility = 'hidden';
        return null;
      }
      best = { x: sides[0] > 0 ? s.x + 7 : s.x - 7 - full, y: s.y + dy };
    }
    placed.push({ x: best.x, y: best.y, w: full, half: LABEL_CLEARANCE });
    placeAt(element, best.x, best.y - h / 2, opacity);
    return { x: best.x, y: best.y, w };
  };
  const box = (x: number, y: number, half: number, opacity: number) => {
    if (opacity <= 0.01) return;
    const element = boxPool.take();
    element.style.width = element.style.height = `${half * 2}px`;
    placeAt(element, x - half, y - half, opacity);
  };

  const fillBlock = (element: HTMLElement, token: number) => {
    if (element.dataset.token === String(token)) return;
    element.dataset.token = String(token);
    element.replaceChildren();
    const head = document.createElement('div');
    head.className = classes.head;
    head.textContent = show(space.words[token]);
    element.appendChild(head);
    for (const n of nearest(token)) {
      const row = document.createElement('div');
      row.className = classes.row;
      const score = document.createElement('span');
      score.textContent = n.cosine.toFixed(2);
      const word = document.createElement('span');
      word.textContent = show(n.word);
      row.append(score, word);
      element.appendChild(row);
    }
  };

  const nb = new THREE.Vector3();
  const tip = new THREE.Vector3();
  const drawNeighbors = (token: number, q: THREE.Vector3, fade: number, grow: number) => {
    nearest(token).forEach((n, r) => {
      const g = smooth(r * 0.06, r * 0.06 + 0.4, grow);
      if (g <= 0) return;
      at(n.index, nb);
      tip.copy(q).lerp(nb, g);
      seg(q, tip, 0.7 * fade, 0.45 * fade);
      highlight(nb, 0.95 * fade * g, 3.2);
    });
    const p = toScreen(q);
    box(p.x, p.y, 5, 0.9 * fade);
    if (!showWords || fade <= 0.01) return;

    // The word list sits beside the point, turned toward the nearer edge when there is room.
    const block = blockPool.take();
    fillBlock(block, token);
    const blockW = block.offsetWidth;
    const blockH = block.offsetHeight;
    const gap = 22;
    const roomRight = width - 16 - (p.x + gap + blockW);
    const roomLeft = p.x - gap - blockW - 16;
    const outward = p.x < width / 2 ? roomLeft > 0 : roomRight < 0;
    const x = outward ? p.x - gap - blockW : p.x + gap;
    const y = clamp(p.y - 10, 12, height - blockH - 12);
    placeAt(block, x, y, fade);
    placed.push({ x, y: y + blockH / 2, w: blockW, half: blockH / 2 + LABEL_CLEARANCE });
  };

  const va = new THREE.Vector3();
  const vb = new THREE.Vector3();
  const vc = new THREE.Vector3();
  const vd = new THREE.Vector3();
  const drawAnalogy = (t: number) => {
    const u = (t + ANALOGY_OFFSET) / ANALOGY_PERIOD;
    const k = Math.floor(u);
    const ph = (u - k) * ANALOGY_PERIOD;
    const a = analogies[((k % analogies.length) + analogies.length) % analogies.length];
    if (!a.answer) return;
    const fade = smooth(0, 0.8, ph) * (1 - smooth(ANALOGY_PERIOD - 2.5, ANALOGY_PERIOD - 0.5, ph));
    if (fade <= 0) return;
    // a -> b is the offset and a -> c the other side; the same offset from c reaches b - a + c.
    const pa = at(a.ia, va);
    const pb = at(a.ib, vb);
    const pc = at(a.ic, vc);
    const pd = at(a.answer.index, vd);
    const g1 = smooth(0.4, 1.6, ph);
    const g2 = smooth(1.2, 2.4, ph);
    const g3 = smooth(2.2, 3.4, ph);
    const g4 = smooth(3.2, 3.8, ph);
    const m = 0.55 * fade;
    seg(pa, pa.clone().lerp(pb, g1), m);
    seg(pa, pa.clone().lerp(pc, g2), m);
    if (g3 > 0) {
      seg(pc, pc.clone().lerp(a.q, g3), m);
      seg(pb, pb.clone().lerp(a.q, g3), m);
    }
    if (g4 > 0) seg(a.q, a.q.clone().lerp(pd, g4), 0.35 * fade);
    highlight(pa, fade, 3.4);
    highlight(pb, fade * g1, 3.4);
    highlight(pc, fade * g2, 3.4);
    highlight(pd, fade * g4, 3.4);
    const sq = toScreen(a.q);
    if (g3 >= 1) box(sq.x, sq.y, 3, 0.8 * fade * g4 + 0.4 * fade * (1 - g4));
    if (!showWords) return;
    const tm = 0.75 * fade;
    label(show(space.words[a.ia]), pa, tm);
    label(show(space.words[a.ib]), pb, tm * g1);
    label(show(space.words[a.ic]), pc, tm * g2);
    const score = a.answer.cosine.toFixed(2);
    const answer = label(show(space.words[a.answer.index]), pd, tm * g4, 0, sizeOf(score).w + 4);
    if (answer) write(score, answer.x + answer.w + 4, answer.y, 0.45 * fade * g4);
    const points = [pa, pb, pc, pd, a.q].map(toScreen);
    const xs = points.map((s) => s.x);
    const bottom = Math.max(...points.map((s) => s.y)) + 20;
    const caption = `${a.caption} → ${space.words[a.answer.index].trim()}`;
    const capW = sizeOf(caption).w;
    const outer =
      (Math.min(...xs) + Math.max(...xs)) / 2 > width / 2
        ? Math.min(...xs) - 8
        : Math.max(...xs) + 8 - capW;
    write(caption, clamp(outer, 8, width - capW - 8), bottom, 0.6 * fade * g4);
  };

  // The pointer in stage pixels, and when it last moved. The stage ignores the pointer, so the
  // window reports it.
  const pointer = { x: 0, y: 0, at: -Infinity };
  const hovered = () => {
    if (performance.now() - pointer.at >= POINTER_MS || !showWords) return -1;
    let best = -1;
    let bestDistance = HOVER_RADIUS * HOVER_RADIUS;
    const p = new THREE.Vector3();
    for (let i = 0; i < N; i++) {
      if (space.dust[i] || space.capitalized[i]) continue;
      const s = toScreen(at(i, p));
      const dx = s.x - pointer.x;
      const dy = s.y - pointer.y;
      const d = dx * dx + dy * dy;
      if (d < bestDistance) {
        bestDistance = d;
        best = i;
      }
    }
    return best;
  };

  const q = new THREE.Vector3();
  const prevPoint = new THREE.Vector3();
  const curPoint = new THREE.Vector3();
  const draw = (t: number) => {
    const yaw = YAW * Math.sin((t / SWING) * Math.PI * 2);
    camera.position.set(
      Math.sin(yaw) * Math.cos(PITCH) * distance,
      Math.sin(PITCH) * distance,
      Math.cos(yaw) * Math.cos(PITCH) * distance
    );
    camera.lookAt(0, 0, 0);
    camera.updateMatrixWorld();

    segments = 0;
    lit = 0;
    labelPool.reset();
    boxPool.reset();
    placed.length = 0;
    blockPool.reset();

    const L = sequence.length;
    const u = t / STEP;
    const k = Math.floor(u);
    const ph = (u - k) * STEP;
    const tokenAt = (j: number) => sequence[((j % L) + L) % L];
    const current = tokenAt(k);
    const previous = tokenAt(k - 1);
    const move = smooth(0, GLIDE, ph);
    at(previous, prevPoint);
    at(current, curPoint);
    q.copy(prevPoint).lerp(curPoint, move);

    // The trail links the last tokens read, fading with age.
    let head = q.clone();
    const trailLabels: [string, THREE.Vector3, number][] = [];
    for (let j = 1; j <= TRAIL; j++) {
      const token = tokenAt(k - j);
      const p = at(token);
      const age = (j - 1 + move) / TRAIL;
      const m = 0.5 * (1 - age);
      if (m > 0) seg(head, p, m + 0.08, m);
      if (j > 1 || move > 0.6) {
        highlight(p, 0.85 * (1 - age), 2.8);
        trailLabels.push([show(space.words[token]), p, 0.6 * (1 - age) * (j === 1 ? smooth(0.6, 1, move) : 1)]);
      }
      head = p;
    }

    const hover = hovered();
    if (hover >= 0) {
      drawNeighbors(hover, at(hover), 1, 1);
    } else {
      const out = 1 - smooth(0, 0.35, ph);
      if (out > 0) drawNeighbors(previous, prevPoint, out, 1);
      const into = smooth(GLIDE + 0.05, GLIDE + 0.45, ph);
      if (into > 0) drawNeighbors(current, curPoint, into, smooth(GLIDE, GLIDE + 0.7, ph));
    }
    highlight(q, 1, 5.5);

    drawAnalogy(t);
    for (const [text, p, m] of trailLabels) label(text, p, m, -9, 0, true);

    lineGeometry.setDrawRange(0, segments * 2);
    linePosition.needsUpdate = true;
    lineColor.needsUpdate = true;
    hiGeometry.setDrawRange(0, lit);
    hiPosition.needsUpdate = true;
    hiMix.needsUpdate = true;
    hiSize.needsUpdate = true;
    labelPool.hideRest();
    boxPool.hideRest();
    blockPool.hideRest();

    renderer.render(scene, camera);
  };

  const resize = () => {
    width = Math.max(1, host.clientWidth);
    height = Math.max(1, host.clientHeight);
    renderer.setSize(width, height, false);
    const aspect = width / height;
    camera.aspect = aspect;
    const tan = Math.tan(((FOV / 2) * Math.PI) / 180);
    // A portrait stage rolls the camera so the band runs down the screen, and shows no words.
    const portrait = aspect < 1;
    camera.up.set(portrait ? 1 : 0, portrait ? 0 : 1, 0);
    showWords = !portrait;
    const along = portrait ? tan : tan * aspect;
    const across = portrait ? tan * aspect : tan;
    const wide = clamp((along / across - WIDE_FROM) / WIDE_SPAN, 0, 1);
    world.scale.set(1, 1 - WIDE_SQUASH * wide, 1);
    world.updateMatrixWorld();
    const fitWidth = HALF_W / along;
    const fitHeight = (HALF_H * world.scale.y) / across;
    distance = Math.min(fitWidth, Math.max(fitHeight * 1.3, fitWidth * 0.4));
    camera.setViewOffset(width, height, 0, WIDE_LIFT * wide * height, width, height);
    camera.updateProjectionMatrix();
    for (const material of [cloudMaterial, hiMaterial]) {
      material.uniforms.uScale.value = distance * 1.1 * clamp(Math.min(width, height) / 640, 0.72, 1);
      material.uniforms.uNear.value = distance - DEPTH;
      material.uniforms.uFar.value = distance + DEPTH;
    }
  };

  // Loop: at most 30 frames a second, only while the band is in view and the tab is shown.
  const reducedMotion = prefersReducedMotion();
  const started = performance.now();
  let raf = 0;
  let last = 0;
  let inView = true;
  let destroyed = false;
  const running = () => !destroyed && !reducedMotion && inView && !document.hidden;
  const tick = (time: number) => {
    raf = 0;
    if (!running()) return;
    if (time - last >= FRAME_MS) {
      last = time;
      draw((time - started) / 1000);
    }
    raf = requestAnimationFrame(tick);
  };
  const still = () => draw(STILL_T);
  const resume = () => {
    if (reducedMotion) return still();
    if (!raf && running()) raf = requestAnimationFrame(tick);
  };

  const resizeObserver = new ResizeObserver(() => {
    resize();
    if (reducedMotion) still();
  });
  resizeObserver.observe(host);
  resize();

  const intersection = new IntersectionObserver(([entry]) => {
    inView = entry.isIntersecting;
    resume();
  });
  intersection.observe(host);
  const onVisibility = () => resume();
  document.addEventListener('visibilitychange', onVisibility);
  const onPointerMove = (event: PointerEvent) => {
    if (event.pointerType !== 'mouse') return;
    const rect = host.getBoundingClientRect();
    pointer.x = event.clientX - rect.left;
    pointer.y = event.clientY - rect.top;
    pointer.at = performance.now();
  };
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  // three rebuilds its state when a lost context is restored, but only a draw repaints.
  const onRestore = () => draw(reducedMotion ? STILL_T : (performance.now() - started) / 1000);
  canvas.addEventListener('webglcontextrestored', onRestore);
  // Label widths measured before the font loads would leave labels misplaced.
  document.fonts.ready.then(() => {
    if (destroyed) return;
    textSizes.clear();
    if (reducedMotion) still();
  });

  const stopScheme = onSchemeChange(() => {
    paint();
    if (reducedMotion) still();
  });

  draw(reducedMotion ? STILL_T : 0);
  options.onReady();
  resume();

  return () => {
    destroyed = true;
    cancelAnimationFrame(raf);
    resizeObserver.disconnect();
    intersection.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
    window.removeEventListener('pointermove', onPointerMove);
    stopScheme();
    for (const p of [labelPool, boxPool, blockPool]) p.remove();
    probe.remove();
    canvas.removeEventListener('webglcontextrestored', onRestore);
    for (const disposable of [cloudGeometry, cloudMaterial, hiGeometry, hiMaterial, lineGeometry, lineMaterial]) {
      disposable.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
