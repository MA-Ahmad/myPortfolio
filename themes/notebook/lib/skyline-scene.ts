import * as THREE from 'three';
import { onSchemeChange, prefersReducedMotion, readTokens } from './color-tokens';
import { MAX_VOXELS, type SkylineData } from './skyline-data';

export class Unsupported extends Error {}

type Options = {
  /** Element that holds the CSS color tokens. */
  tokenSource: Element;
  /** Positioned element the month labels are added to. */
  labelHost: HTMLElement;
  labelClass: string;
  onHover: (dayIndex: number | null) => void;
  onReady: () => void;
};

type View = { yaw: number; pitch: number };

// A voxel is 10/12 of a column, so the gaps match the flat bars' 10px squares and 2px gaps.
const UNIT = 10 / 12;
const FLAT = 0.16;
const FRONT_Z = 3 + UNIT / 2;
const LABEL_Z = 4.6;
const LABEL_DROP = 7.5;
const REST: View = { yaw: -16, pitch: 34 };
const KEYS: Record<string, View> = {
  ArrowLeft: { yaw: 8, pitch: 0 },
  ArrowRight: { yaw: -8, pitch: 0 },
  ArrowUp: { yaw: 0, pitch: -6 },
  ArrowDown: { yaw: 0, pitch: 6 }
};
const STEP_MS = 28;
const WEEK_DELAY_MS = 9;
const WEEKDAY_DELAY_MS = 4;
const deg = Math.PI / 180;

const clampView = ({ yaw, pitch }: View): View => ({
  yaw: Math.min(60, Math.max(-60, yaw)),
  pitch: Math.min(89, Math.max(8, pitch))
});

const vertexShader = /* glsl */ `
  attribute float aLit;
  varying vec3 vNormal;
  varying float vLit;
  void main() {
    vNormal = normalize(mat3(instanceMatrix) * normal);
    vLit = aLit;
    gl_Position = projectionMatrix * viewMatrix * modelMatrix * instanceMatrix * vec4(position, 1.0);
  }
`;

// No lights: each face is a fixed mix of bg and ink, so the front faces are exactly ink.
const fragmentShader = /* glsl */ `
  uniform vec3 uInk;
  uniform vec3 uBg;
  uniform float uHover;
  varying vec3 vNormal;
  varying float vLit;
  void main() {
    vec3 n = normalize(vNormal);
    float tone = n.z > 0.5 ? 1.0 : n.y > 0.5 ? 0.66 : n.y < -0.5 ? 0.3 : 0.44;
    vec3 color = mix(uBg, uInk, tone);
    if (uHover > 0.5 && vLit < 0.5) color = mix(uBg, color, 0.3);
    gl_FragColor = vec4(color, 1.0);
  }
`;

function voxelSet(count: number, height: number) {
  const geometry = new THREE.BoxGeometry(UNIT, height, UNIT);
  const lit = new THREE.InstancedBufferAttribute(new Float32Array(Math.max(1, count)), 1);
  geometry.setAttribute('aLit', lit);
  const material = new THREE.ShaderMaterial({
    uniforms: {
      uInk: { value: new THREE.Color() },
      uBg: { value: new THREE.Color() },
      uHover: { value: 0 }
    },
    vertexShader,
    fragmentShader
  });
  const mesh = new THREE.InstancedMesh(geometry, material, Math.max(1, count));
  mesh.count = 0;
  mesh.frustumCulled = false;
  return { mesh, geometry, material, lit, columnOf: new Int32Array(Math.max(1, count)) };
}

type VoxelSet = ReturnType<typeof voxelSet>;

export function mountSkyline(canvas: HTMLCanvasElement, data: SkylineData, options: Options) {
  const gl = canvas.getContext('webgl2', { antialias: true, alpha: true });
  if (!gl) throw new Unsupported('WebGL2 is unavailable');

  THREE.ColorManagement.enabled = false;
  const renderer = new THREE.WebGLRenderer({ canvas, context: gl, antialias: true, alpha: true });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setClearColor(0x000000, 0);

  const stage = options.labelHost;
  const reducedMotion = prefersReducedMotion();
  const { days, weeks } = data;
  const middle = (weeks - 1) / 2;
  const columns = days.map((day) => ({
    x: day.week - middle,
    z: day.weekday - 3,
    delay: day.week * WEEK_DELAY_MS + day.weekday * WEEKDAY_DELAY_MS
  }));

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, -500, 500);
  const solids = voxelSet(days.length * MAX_VOXELS, UNIT);
  const flats = voxelSet(days.length, FLAT);
  scene.add(solids.mesh, flats.mesh);

  const center = new THREE.Vector3(0, 3, 0);
  const bounds = new THREE.Box3(
    new THREE.Vector3(-weeks / 2, 0, -3.5),
    new THREE.Vector3(weeks / 2, MAX_VOXELS, LABEL_Z)
  );
  const matrix = new THREE.Matrix4();
  const corner = new THREE.Vector3();
  const projected = new THREE.Vector3();

  const months = data.months.map(({ week, label }) => {
    const element = document.createElement('span');
    element.className = options.labelClass;
    element.textContent = label;
    element.setAttribute('aria-hidden', 'true');
    stage.appendChild(element);
    return { element, x: week - middle };
  });

  const paint = () => {
    const tokens = readTokens(options.tokenSource);
    solids.material.uniforms.uInk.value.setRGB(...tokens.ink);
    solids.material.uniforms.uBg.value.setRGB(...tokens.bg);
    flats.material.uniforms.uInk.value.setRGB(...tokens.rule);
    flats.material.uniforms.uBg.value.setRGB(...tokens.bg);
  };

  let hovered: number | null = null;
  const highlight = ({ mesh, lit, columnOf }: VoxelSet) => {
    for (let i = 0; i < mesh.count; i++) lit.array[i] = columnOf[i] === hovered ? 1 : 0;
    lit.needsUpdate = true;
    mesh.material.uniforms.uHover.value = hovered === null ? 0 : 1;
  };

  const place = ({ mesh, columnOf }: VoxelSet, n: number, column: number, y: number) => {
    const { x, z } = columns[column];
    mesh.setMatrixAt(n, matrix.makeTranslation(x, y, z));
    columnOf[n] = column;
  };

  const commit = (set: VoxelSet, count: number) => {
    set.mesh.count = count;
    set.mesh.instanceMatrix.needsUpdate = true;
    // Raycasting caches the bounds of the instances, which change as the city rises.
    set.mesh.boundingSphere = null;
    highlight(set);
  };

  // Voxels sit one unit apart, so each day reads as a stack of separate cubes.
  let shown = days.map(() => 0);
  const goal = days.map((day) => day.height);
  const rebuild = () => {
    let solid = 0;
    let flat = 0;
    shown.forEach((height, column) => {
      for (let k = 0; k < height; k++) place(solids, solid++, column, k + UNIT / 2);
      if (!height) place(flats, flat++, column, FLAT / 2);
    });
    commit(solids, solid);
    commit(flats, flat);
  };

  // Camera
  const view = { ...REST };
  let target = { ...REST };
  let width = 1;
  let height = 1;
  let restScale = 0;
  let labelLift = 0;

  const placeCamera = () => {
    camera.position.set(
      center.x + Math.sin(view.yaw * deg) * Math.cos(view.pitch * deg) * 100,
      center.y + Math.sin(view.pitch * deg) * 100,
      center.z + Math.cos(view.yaw * deg) * Math.cos(view.pitch * deg) * 100
    );
    camera.lookAt(center);
    camera.updateMatrixWorld();
  };

  // Bottom-aligned with room for the month labels, and never larger than the rest view, so
  // turning the city can shrink it but never zoom in.
  const fit = () => {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const x of [bounds.min.x, bounds.max.x])
      for (const y of [bounds.min.y, bounds.max.y])
        for (const z of [bounds.min.z, bounds.max.z]) {
          corner.set(x, y, z).applyMatrix4(camera.matrixWorldInverse);
          minX = Math.min(minX, corner.x);
          maxX = Math.max(maxX, corner.x);
          minY = Math.min(minY, corner.y);
          maxY = Math.max(maxY, corner.y);
        }
    const rowDrop =
      corner.set(0, 0, FRONT_Z).applyMatrix4(camera.matrixWorldInverse).y -
      corner.set(0, 0, LABEL_Z).applyMatrix4(camera.matrixWorldInverse).y;
    const pad = 4;
    const below = pad + 6;
    const need = Math.max(
      (maxX - minX) / (width - 2 * pad),
      (maxY - minY) / (height - pad - below),
      (maxY - minY - rowDrop) / (height - pad - below - LABEL_DROP)
    );
    if (!restScale) restScale = need;
    const scale = Math.max(need, restScale);
    labelLift = Math.max(0, LABEL_DROP - rowDrop / scale);
    camera.left = minX - (width * scale - (maxX - minX)) / 2;
    camera.right = camera.left + width * scale;
    camera.bottom = minY - (below + labelLift) * scale;
    camera.top = camera.bottom + height * scale;
    camera.updateProjectionMatrix();
  };

  const placeMonths = () => {
    months.forEach(({ element, x }, i) => {
      element.hidden = width < 520 && i % 2 === 1;
      projected.set(x, 0, LABEL_Z).project(camera);
      const left = (projected.x * 0.5 + 0.5) * width;
      const top = (-projected.y * 0.5 + 0.5) * height + labelLift;
      element.style.transform = `translate(${left}px, ${top}px) translate(-50%, -50%)`;
    });
  };

  const draw = () => {
    placeCamera();
    fit();
    placeMonths();
    renderer.render(scene, camera);
  };

  const ease = () => {
    let moving = false;
    for (const key of ['yaw', 'pitch'] as const) {
      const delta = target[key] - view[key];
      if (Math.abs(delta) > 0.05 && !reducedMotion) {
        view[key] += delta * 0.14;
        moving = true;
      } else {
        view[key] = target[key];
      }
    }
    return moving;
  };

  // Rise: each column climbs one voxel every STEP_MS, in a wave across weeks and weekdays.
  let riseStart = 0;
  const rise = (now: number) => {
    const elapsed = reducedMotion ? Infinity : now - riseStart;
    let changed = false;
    let moving = false;
    for (let i = 0; i < shown.length; i++) {
      if (shown[i] === goal[i]) continue;
      const steps = Math.floor(Math.max(0, elapsed - columns[i].delay) / STEP_MS);
      const next = Math.min(goal[i], steps);
      if (next !== shown[i]) {
        shown[i] = next;
        changed = true;
      }
      if (shown[i] !== goal[i]) moving = true;
    }
    if (changed) rebuild();
    return moving;
  };

  let raf = 0;
  let destroyed = false;
  const frame = (now: number) => {
    raf = 0;
    if (destroyed) return;
    const turning = ease();
    const rising = rise(now);
    draw();
    if (turning || rising) loop();
  };
  const loop = () => {
    if (!raf && !destroyed) raf = requestAnimationFrame(frame);
  };

  const resize = () => {
    width = Math.max(1, stage.clientWidth);
    height = Math.max(1, stage.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(width, height, false);
    restScale = 0;
    const turned = { ...view };
    Object.assign(view, REST);
    placeCamera();
    fit();
    Object.assign(view, turned);
    draw();
  };

  // Interaction
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const pick = (event: PointerEvent) => {
    const rect = stage.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    raycaster.setFromCamera(pointer, camera);
    const [hit] = raycaster.intersectObjects([solids.mesh, flats.mesh], false);
    if (hit?.instanceId === undefined) return null;
    return (hit.object === solids.mesh ? solids : flats).columnOf[hit.instanceId];
  };
  const hover = (day: number | null) => {
    if (day === hovered) return;
    hovered = day;
    highlight(solids);
    highlight(flats);
    options.onHover(day);
    loop();
  };
  const turnTo = (next: View) => {
    target = clampView(next);
    loop();
  };

  let drag: { x: number; y: number; from: View; moved: boolean; pointer: number } | null = null;
  const release = (event: PointerEvent) => {
    if (!drag) return;
    if (!drag.moved && event.type === 'pointerup' && event.pointerType !== 'mouse') hover(pick(event));
    delete stage.dataset.dragging;
    drag = null;
  };

  const listeners = new AbortController();
  const { signal } = listeners;
  stage.addEventListener(
    'pointerdown',
    (event) => {
      drag = { x: event.clientX, y: event.clientY, from: target, moved: false, pointer: event.pointerId };
    },
    { signal }
  );
  stage.addEventListener(
    'pointermove',
    (event) => {
      if (drag?.pointer === event.pointerId && (event.buttons || event.pointerType !== 'mouse')) {
        const dx = event.clientX - drag.x;
        const dy = event.clientY - drag.y;
        if (!drag.moved && Math.hypot(dx, dy) > 4) {
          drag.moved = true;
          stage.setPointerCapture(event.pointerId);
          stage.dataset.dragging = '';
        }
        if (drag.moved) turnTo({ yaw: drag.from.yaw - dx * 0.35, pitch: drag.from.pitch + dy * 0.3 });
      }
      if (event.pointerType === 'mouse') hover(pick(event));
    },
    { signal }
  );
  stage.addEventListener('pointerup', release, { signal });
  stage.addEventListener('pointercancel', release, { signal });
  stage.addEventListener(
    'pointerleave',
    (event) => {
      if (!drag && event.pointerType === 'mouse') hover(null);
    },
    { signal }
  );
  stage.addEventListener('dblclick', () => turnTo(REST), { signal });
  // three rebuilds its state when a lost context is restored, but only a draw repaints.
  canvas.addEventListener('webglcontextrestored', draw, { signal });
  stage.addEventListener(
    'keydown',
    (event) => {
      const step = KEYS[event.key];
      if (!step) return;
      const next = clampView({ yaw: target.yaw + step.yaw, pitch: target.pitch + step.pitch });
      // At a limit the key keeps its default, so the page can still scroll.
      if (next.yaw === target.yaw && next.pitch === target.pitch) return;
      event.preventDefault();
      turnTo(next);
    },
    { signal }
  );

  const resizeObserver = new ResizeObserver(resize);
  const stopScheme = onSchemeChange(() => {
    paint();
    draw();
  });

  // The scene is built and drawn in a later task than the context, so input can run in between.
  const readyTimer = window.setTimeout(() => {
    if (destroyed) return;
    paint();
    if (reducedMotion) shown = goal.slice();
    rebuild();
    resizeObserver.observe(stage);
    resize();
    riseStart = performance.now();
    loop();
    options.onReady();
  }, 0);

  return () => {
    destroyed = true;
    window.clearTimeout(readyTimer);
    cancelAnimationFrame(raf);
    listeners.abort();
    resizeObserver.disconnect();
    stopScheme();
    delete stage.dataset.dragging;
    months.forEach(({ element }) => element.remove());
    for (const set of [solids, flats]) {
      set.geometry.dispose();
      set.material.dispose();
      set.mesh.dispose();
    }
    renderer.dispose();
    renderer.forceContextLoss();
  };
}
