import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { drawCover, drawEdge } from './cover-texture';
import type { Movie } from './movies';

// Geometry, in case widths: a jewel case is 1 wide.
// A touch shorter than a real jewel case (0.88), which reads portrait once seen at an angle.
const CASE_H = 0.78;
const CASE_T = 0.08;
const GAP = 0.27;
// How far each case also steps left as the row goes back: more tips the row into a steep diagonal.
// Set per screen shape on resize (see VIEWS).
const PULL_X = 1.0;
const PULL_Z = 0.12;
// How far a case rises under the mouse, and how quickly it eases there (per second).
const HOVER_LIFT = 0.055;
const HOVER_RATE = 14;
// The rack loops, and enough cases are laid out to run past both corners of the screen, so it
// always reads as endless: new cases slide in from off-screen rather than appearing at an end.
const MAX_SLOTS = 96;

// Seen from the upper right through a long lens, so it reads almost isometric. A tall screen gets
// the steep diagonal of the iOS original; a wide one looks from the side and only a little from
// above, so the row runs nearly horizontally. Screens in between blend the two.
const VIEWS = {
  tall: { aspect: 0.6, fov: 24, back: 3, distance: 12.5, azimuth: 44, elevation: 16, skew: 0.42, lookAt: [0.3, 0.12, -0.7] },
  wide: { aspect: 1.6, fov: 18, back: 0, distance: 12, azimuth: 40, elevation: 18, skew: 0.2, lookAt: [0.05, -0.04, -0.6] }
} as const;

const clamp = THREE.MathUtils.clamp;
const smoothstep = (t: number) => t * t * (3 - 2 * t);
const linear = (t: number) => t;
const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;
// Arrival timeline: the cases sweep in over the first STACKED of it, each taking FLIGHT of it; the
// first GROUP land together, then the rest follow one by one. The focused case slides out last.
const ARRIVAL_MS = 2300;
const STACKED = 0.86;
const FLIGHT = 0.3;
const GROUP = 6;
// Which end of the rack arrives first: 'far' (top right) or 'near' (bottom left).
const ARRIVE_FROM: 'far' | 'near' = 'far';
// Restack exit: the entrance played backwards. The focused case slides back in first, then the cases
// fly back out to the right, the way they came, the last to land leaving first.
const EXIT_MS = 1500;
// A reel coming to rest: fast start, very long settle.
const easeOutQuint = (t: number) => 1 - (1 - t) ** 5;

type Palette = [string, string, string];

export type RackSceneOptions = {
  canvas: HTMLCanvasElement;
  movies: Movie[];
  start: number;
  reduced: boolean;
  /** Every rendered frame, with the continuous position, for the ruler. */
  onFrame: (position: number) => void;
  /** When the case in focus changes. */
  onIndex: (index: number) => void;
  /** Whether the focused case has slid out, which is when its title should be shown. */
  onReveal: (revealed: boolean) => void;
};

export type RackScene = ReturnType<typeof createRackScene>;

export function createRackScene({ canvas, movies, start, reduced, onFrame, onIndex, onReveal }: RackSceneOptions) {
  const count = movies.length;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = environment;
  scene.environmentIntensity = 0.75;

  // Backdrop: the focused film's palette as soft light, redrawn while it eases to a new film.
  const backdrop = document.createElement('canvas');
  backdrop.width = backdrop.height = 256;
  const backdropCtx = backdrop.getContext('2d')!;
  const backdropTexture = new THREE.CanvasTexture(backdrop);
  backdropTexture.colorSpace = THREE.SRGBColorSpace;
  scene.background = backdropTexture;
  const toColor = (hex: string) => new THREE.Color(hex);
  const shown = movies[((start % count) + count) % count].palette.map(toColor);
  let wanted = shown.map((c) => c.clone());

  function paintBackdrop() {
    const [deep, mid, light] = shown.map((c) => `#${c.getHexString()}`);
    const ctx = backdropCtx;
    const base = ctx.createLinearGradient(0, 0, 0, 256);
    base.addColorStop(0, mid);
    base.addColorStop(0.55, deep);
    base.addColorStop(1, '#040506');
    ctx.fillStyle = base;
    ctx.fillRect(0, 0, 256, 256);
    const glowAt = (x: number, y: number, r: number, color: string, alpha: number) => {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, color);
      g.addColorStop(1, 'transparent');
      ctx.globalAlpha = alpha;
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 256, 256);
      ctx.globalAlpha = 1;
    };
    glowAt(70, 60, 190, mid, 0.85);
    glowAt(200, 190, 150, light, 0.22);
    const vignette = ctx.createRadialGradient(128, 118, 60, 128, 128, 200);
    vignette.addColorStop(0, 'transparent');
    vignette.addColorStop(1, 'rgba(0,0,0,0.55)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, 256, 256);
    backdropTexture.needsUpdate = true;
  }
  paintBackdrop();

  // Light: a soft key from the upper left casting onto an invisible floor.
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-3, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.radius = 4;
  key.shadow.bias = -0.0004;
  scene.add(key, key.target);
  scene.add(new THREE.HemisphereLight(0xffffff, 0x1a1c22, 0.5));

  const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.ShadowMaterial({ opacity: 0.38 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -CASE_H / 2 - 0.001;
  floor.receiveShadow = true;
  scene.add(floor);

  // Cases: a rounded clear-plastic shell, its insert under a glossy lid on the front face.
  const geometry = new RoundedBoxGeometry(1, CASE_H, CASE_T, 4, 0.02);
  // Clear polystyrene edges, banded with the lid-and-tray profile. On a box, the side faces run
  // their thickness along u and the top and bottom along v, so each gets its own band direction.
  const edge = (across: 'u' | 'v') => {
    const map = new THREE.CanvasTexture(drawEdge(across));
    map.colorSpace = THREE.SRGBColorSpace;
    // Opaque: the banded texture carries the plastic look, and transmission would cost a second
    // full render of the scene every frame.
    return new THREE.MeshPhysicalMaterial({
      map,
      roughness: 0.08,
      metalness: 0,
      clearcoat: 1,
      clearcoatRoughness: 0.04
    });
  };
  const sides = edge('u');
  const tops = edge('v');
  const backing = new THREE.MeshPhysicalMaterial({ color: 0x1b1d22, roughness: 0.4, clearcoat: 1 });
  const maxAnisotropy = renderer.capabilities.getMaxAnisotropy();

  // One cover per film, shared by every case slot that shows it.
  const covers = movies.map((movie) => {
    const texture = new THREE.CanvasTexture(drawCover(movie));
    texture.colorSpace = THREE.SRGBColorSpace;
    texture.anisotropy = Math.min(8, maxAnisotropy);
    const front = new THREE.MeshPhysicalMaterial({
      map: texture,
      roughness: 0.55,
      clearcoat: 1,
      clearcoatRoughness: 0.04
    });
    return { front, texture };
  });

  // The glass lid: a thin panel over each case's front that only adds reflected light. Black and
  // additive, it never washes the cover out; the environment's highlights slide across it as the case
  // moves, and Fresnel brightens it at glancing angles, which is what makes it read as glass.
  const lidGeometry = new THREE.PlaneGeometry(0.985, CASE_H - 0.015);
  // Its own studio to reflect: dark, with a few long softbox strips, so the lid catches crisp streaks.
  // It needs its own envMap anyway: with only scene.environment, envMapIntensity is ignored.
  const studio = new THREE.Scene();
  const softbox = new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide });
  const strip = new THREE.PlaneGeometry(1, 1);
  // Every lid faces the same way, so from the camera they all mirror the same patch of this studio:
  // low, to the left and in front of the rack. A long diagonal strip sits across that patch, so its
  // streak runs over the lids and sweeps along as the cases slide; a fainter softbox beside it adds a
  // broad sheen, and a strip overhead catches the top edges.
  const dim = new THREE.MeshBasicMaterial({ color: 0x2a2a2a, side: THREE.DoubleSide });
  for (const [x, y, z, w, h, ry, brightness] of [
    [-3.7, -1.9, 4.4, 0.3, 12, 0.55, softbox],
    [-1.6, -1.2, 5.6, 1.6, 6, 0.55, dim],
    [0, 6, -3, 8, 0.8, 0, softbox]
  ] as const) {
    const light = new THREE.Mesh(strip, brightness);
    light.position.set(x, y, z);
    light.scale.set(w, h, 1);
    light.lookAt(0, 0, 0);
    light.rotateZ(ry);
    studio.add(light);
  }
  const studioEnv = pmrem.fromScene(studio, 0.02).texture;
  strip.dispose();
  softbox.dispose();
  dim.dispose();
  const glass = new THREE.MeshPhysicalMaterial({
    envMap: studioEnv,
    color: 0x000000,
    roughness: 0.04,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.02,
    envMapIntensity: 1.3,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false
  });

  // A fixed pool of cases; each frame, slot k shows whichever film sits at its place in the loop.
  const slots = Array.from({ length: MAX_SLOTS }, () => {
    // Box faces: +x, -x, +y, -y, +z (front), -z (back).
    const materials = [sides, sides, tops, tops, covers[0].front, backing];
    const mesh = new THREE.Mesh(geometry, materials);
    mesh.castShadow = true;
    mesh.visible = false;
    mesh.userData.index = -1;
    mesh.userData.lift = 0;
    const lid = new THREE.Mesh(lidGeometry, glass);
    lid.position.z = CASE_T / 2 + 0.002;
    // Not a ray target: the pick test should hit the case, not its lid.
    lid.raycast = () => {};
    mesh.add(lid);
    scene.add(mesh);
    return { mesh, materials };
  });
  // Cases laid out in front of and behind the focus; measured against the screen on resize.
  let near = 12;
  let far = 22;
  let skew = VIEWS.tall.skew as number;
  // How many places back along the row the focused case sits, leaving that many cases in front of it.
  let back = 0;

  const camera = new THREE.PerspectiveCamera(VIEWS.wide.fov, 1, 0.1, 100);
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  composer.addPass(new OutputPass());

  function resize(width: number, height: number) {
    renderer.setSize(width, height, false);
    composer.setSize(width, height);
    camera.aspect = width / height;
    const { tall, wide } = VIEWS;
    const t = smoothstep(clamp((camera.aspect - tall.aspect) / (wide.aspect - tall.aspect), 0, 1));
    const mix = (a: number, b: number) => a + (b - a) * t;
    const azimuth = THREE.MathUtils.degToRad(mix(tall.azimuth, wide.azimuth));
    const elevation = THREE.MathUtils.degToRad(mix(tall.elevation, wide.elevation));
    skew = mix(tall.skew, wide.skew);
    back = mix(tall.back, wide.back);
    const lookAt = new THREE.Vector3(...tall.lookAt.map((v, i) => mix(v, wide.lookAt[i])) as [number, number, number]);
    // `distance` is measured as if through an 18° lens; a wider lens (more perspective, near cases
    // larger than far ones) moves the camera in to keep the same framing.
    camera.fov = mix(tall.fov, wide.fov);
    const lens = Math.tan(THREE.MathUtils.degToRad(9)) / Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = mix(tall.distance, wide.distance) * lens;
    camera.position
      .set(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation))
      .multiplyScalar(distance)
      .add(lookAt);
    camera.lookAt(lookAt);
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld();
    far = reach(1);
    near = Math.min(reach(-1), MAX_SLOTS - far - 2);
    // Draw now rather than on the next frame, so a resize never shows an empty canvas.
    layout();
    composer.render();
    wake();
  }

  // Motion state. `position` is continuous and unbounded; case i sits at the wrapped offset i - position.
  let position = start;
  let velocity = 0;
  type Mode =
    | { kind: 'idle' }
    | { kind: 'spring'; target: number; stiffness: number }
    | { kind: 'drag' }
    | { kind: 'tween'; from: number; to: number; begin: number; duration: number; done?: () => void };
  let mode: Mode = { kind: 'idle' };
  let arrival = reduced ? 1 : 0;
  let arrivalTween: { from: number; to: number; begin: number; duration: number; ease: (t: number) => number } | null =
    reduced ? null : { from: 0, to: 1, begin: performance.now() + 150, duration: ARRIVAL_MS, ease: linear };
  // Set while the restack plays the entrance backwards; the entrance restarts when it ends.
  let exiting = false;
  let shownIndex = -1;
  let revealed: boolean | null = null;

  const wrapIndex = (i: number) => ((i % count) + count) % count;

  // How many cases it takes, from the focus, until a case is fully off-screen in that direction.
  function reach(direction: 1 | -1) {
    const corner = new THREE.Vector3();
    for (let d = 1; d < MAX_SLOTS; d++) {
      const offset = d * direction;
      // The case's corner nearest the middle of the screen: once that is out, all of it is.
      const place = offset + back;
      corner.set(-place * GAP * skew - direction * 0.5, -direction * CASE_H * 0.5, -place * GAP).project(camera);
      const out = direction > 0 ? corner.x > 1 || corner.y > 1 : corner.x < -1 || corner.y < -1;
      if (out) return Math.min(d + 2, MAX_SLOTS / 2);
    }
    return MAX_SLOTS / 2;
  }

  function layout() {
    const base = Math.floor(position) - near;
    slots.forEach(({ mesh, materials }, k) => {
      const n = base + k;
      const d = n - position;
      if (d < -near - 1 || d > far) {
        mesh.visible = false;
        return;
      }
      const index = wrapIndex(n);
      if (mesh.userData.index !== index) {
        mesh.userData.index = index;
        materials[4] = covers[index].front;
      }
      // Arrival: cases swoop in from the right on a curve. The first GROUP share one start, the rest
      // each start a step after the one before. The case in focus slides out once the row is filled.
      const total = near + far + 1;
      const rank = ARRIVE_FROM === 'far' ? far - d : d + near;
      const step = clamp(Math.floor(rank) - GROUP + 1, 0, total - GROUP) / Math.max(1, total - GROUP);
      const landed = easeOutCubic(clamp((arrival / STACKED - step * (1 - FLIGHT)) / FLIGHT, 0, 1));
      const away = 1 - landed;
      const settled = smoothstep(clamp((arrival - STACKED) / (1 - STACKED), 0, 1));
      const pull = smoothstep(clamp(1 - Math.abs(d), 0, 1)) * settled;
      mesh.visible = landed > 0.001;
      // Only settled cases cast shadows; a case in flight would just smear across the floor.
      mesh.castShadow = landed > 0.999;
      mesh.position.set(
        -(d + back) * GAP * skew + pull * PULL_X + away * 6,
        pull * 0.015 + away * 1.2 + (mesh.userData.lift as number) * HOVER_LIFT,
        -(d + back) * GAP + pull * PULL_Z + away * 1.5
      );
      mesh.rotation.set(0, away * 1.3, 0);
    });
  }

  function stepPhysics(now: number, dt: number) {
    if (mode.kind === 'spring') {
      // Critically damped: arrives without overshoot, and carries whatever velocity it was given.
      const k = mode.stiffness;
      const c = 2 * Math.sqrt(k);
      const steps = 4;
      const h = dt / steps;
      for (let i = 0; i < steps; i++) {
        velocity += (-k * (position - mode.target) - c * velocity) * h;
        position += velocity * h;
      }
      if (Math.abs(position - mode.target) < 0.0005 && Math.abs(velocity) < 0.005) {
        position = mode.target;
        velocity = 0;
        mode = { kind: 'idle' };
      }
    } else if (mode.kind === 'tween') {
      const t = clamp((now - mode.begin) / mode.duration, 0, 1);
      const next = mode.from + (mode.to - mode.from) * easeOutQuint(t);
      velocity = dt > 0 ? (next - position) / dt : 0;
      position = next;
      if (t >= 1) {
        const done = mode.done;
        velocity = 0;
        mode = { kind: 'idle' };
        done?.();
      }
    }

    if (arrivalTween && now >= arrivalTween.begin) {
      const t = clamp((now - arrivalTween.begin) / arrivalTween.duration, 0, 1);
      arrival = arrivalTween.from + (arrivalTween.to - arrivalTween.from) * arrivalTween.ease(t);
      if (t >= 1) {
        arrivalTween = null;
        if (exiting) {
          // Every case has left and is invisible at arrival 0, so the entrance starts in the same frame.
          exiting = false;
          arrivalTween = { from: 0, to: 1, begin: now, duration: ARRIVAL_MS, ease: linear };
        }
      }
    }
  }

  // The hovered case rises and the rest settle back; an exponential approach stays smooth when the
  // mouse sweeps quickly across several cases.
  let hovered: THREE.Object3D | null = null;
  function easeLift(dt: number) {
    let moving = false;
    const rate = 1 - Math.exp(-dt * HOVER_RATE);
    for (const { mesh } of slots) {
      const lift = mesh.userData.lift as number;
      const target = mesh === hovered ? 1 : 0;
      if (Math.abs(target - lift) < 0.001) {
        mesh.userData.lift = target;
        continue;
      }
      mesh.userData.lift = lift + (target - lift) * rate;
      moving = true;
    }
    return moving;
  }

  function easeBackdrop(dt: number) {
    let moving = false;
    const rate = 1 - Math.exp(-dt * 5);
    shown.forEach((color, i) => {
      const target = wanted[i];
      if (Math.abs(color.r - target.r) + Math.abs(color.g - target.g) + Math.abs(color.b - target.b) > 0.002) {
        color.lerp(target, rate);
        moving = true;
      }
    });
    if (moving) paintBackdrop();
    return moving;
  }

  let frame = 0;
  let last = 0;
  let disposed = false;

  function tick(now: number) {
    frame = 0;
    if (disposed) return;
    const dt = last ? Math.min((now - last) / 1000, 1 / 30) : 1 / 60;
    last = now;
    stepPhysics(now, dt);
    const backdropMoving = easeBackdrop(dt);
    const lifting = easeLift(dt);

    const index = wrapIndex(Math.round(position));
    if (index !== shownIndex) {
      shownIndex = index;
      wanted = movies[index].palette.map(toColor);
      onIndex(index);
    }

    // The title shows once the focused case is most of the way out of the row.
    const reveal = arrival > STACKED + (1 - STACKED) * 0.5;
    if (reveal !== revealed) {
      revealed = reveal;
      onReveal(reveal);
    }

    layout();
    composer.render(dt);
    onFrame(position);

    // Sleeps once everything has settled; any input wakes it.
    if (mode.kind !== 'idle' || arrivalTween || backdropMoving || lifting) wake();
    else last = 0;
  }

  function wake() {
    if (!frame && !disposed) frame = requestAnimationFrame(tick);
  }

  // Shortest way around the loop to a given film.
  function nearest(index: number) {
    let delta = (index - position) % count;
    if (delta > count / 2) delta -= count;
    if (delta < -count / 2) delta += count;
    return Math.round(position + delta);
  }

  let wheelTarget: number | null = null;
  let wheelTimer: number | undefined;
  const samples: { t: number; p: number }[] = [];

  // Where one step along the rack lands on screen, so a drag can follow the cases under the finger.
  function screenStep(width: number, height: number) {
    const a = new THREE.Vector3(0, 0, 0).project(camera);
    const b = new THREE.Vector3(-GAP * skew, 0, -GAP).project(camera);
    const dx = ((b.x - a.x) * width) / 2;
    const dy = (-(b.y - a.y) * height) / 2;
    const length = Math.hypot(dx, dy) || 1;
    return { ux: dx / length, uy: dy / length, pixels: length };
  }

  const raycaster = new THREE.Raycaster();
  const meshes = slots.map((slot) => slot.mesh);

  function caseAt(x: number, y: number, width: number, height: number) {
    raycaster.setFromCamera(new THREE.Vector2((x / width) * 2 - 1, -(y / height) * 2 + 1), camera);
    const [first] = raycaster.intersectObjects(meshes.filter((m) => m.visible), false);
    return first ? first.object : null;
  }

  const api = {
    resize,

    /** The film under a point in canvas pixels, if any. */
    hit(x: number, y: number, width: number, height: number): number | null {
      const object = caseAt(x, y, width, height);
      return object ? (object.userData.index as number) : null;
    },

    /** Raises the case under a mouse position (canvas pixels), or lowers it again with null. */
    hover(point: { x: number; y: number; width: number; height: number } | null): boolean {
      const next = point ? caseAt(point.x, point.y, point.width, point.height) : null;
      if (next !== hovered) {
        hovered = next;
        wake();
      }
      return next !== null;
    },

    goTo(index: number) {
      mode = { kind: 'spring', target: nearest(index), stiffness: 140 };
      wake();
    },

    step(delta: number) {
      const from = mode.kind === 'spring' ? mode.target : Math.round(position);
      mode = { kind: 'spring', target: from + delta, stiffness: 170 };
      wake();
    },

    wheel(delta: number) {
      wheelTarget = (wheelTarget ?? (mode.kind === 'spring' ? mode.target : position)) + delta;
      mode = { kind: 'spring', target: wheelTarget, stiffness: 260 };
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        if (wheelTarget === null) return;
        mode = { kind: 'spring', target: Math.round(wheelTarget), stiffness: 120 };
        wheelTarget = null;
        wake();
      }, 120);
      wake();
    },

    dragStart() {
      mode = { kind: 'drag' };
      velocity = 0;
      samples.length = 0;
      samples.push({ t: performance.now(), p: position });
    },

    /** Moves by a drag measured in screen pixels. */
    dragBy(dx: number, dy: number, width: number, height: number) {
      const { ux, uy, pixels } = screenStep(width, height);
      // Pulling the rack toward the viewer (down the diagonal) brings the next films forward.
      position -= (dx * ux + dy * uy) / pixels;
      const now = performance.now();
      samples.push({ t: now, p: position });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      wake();
    },

    /** Moves by a drag measured in cases, for the ruler. */
    dragByCases(delta: number) {
      position += delta;
      const now = performance.now();
      samples.push({ t: now, p: position });
      while (samples.length > 2 && now - samples[0].t > 100) samples.shift();
      wake();
    },

    dragEnd() {
      const first = samples[0];
      const lastSample = samples[samples.length - 1];
      const span = lastSample && first ? (lastSample.t - first.t) / 1000 : 0;
      velocity = span > 0 ? clamp((lastSample.p - first.p) / span, -40, 40) : 0;
      // Project where the flick would coast to, then settle on the nearest case from there.
      mode = { kind: 'spring', target: Math.round(position + velocity * 0.32), stiffness: 90 };
      wake();
    },

    /** Spins forward through the rack and lands on a random film. */
    pick(done: (index: number) => void) {
      const spin = Math.round(position) + 14 + Math.floor(Math.random() * count);
      const index = wrapIndex(spin);
      if (reduced) {
        position = spin;
        mode = { kind: 'idle' };
        wake();
        done(index);
        return;
      }
      mode = { kind: 'tween', from: position, to: spin, begin: performance.now(), duration: 2800, done: () => done(index) };
      wake();
    },

    replay() {
      if (reduced || exiting) return;
      // Reverse from wherever the entrance is, at the exit's pace, so a part-built rack leaves sooner.
      exiting = true;
      arrivalTween = { from: arrival, to: 0, begin: performance.now(), duration: Math.max(1, EXIT_MS * arrival), ease: linear };
      wake();
    },

    get moving() {
      return mode.kind !== 'idle';
    },

    dispose() {
      disposed = true;
      cancelAnimationFrame(frame);
      window.clearTimeout(wheelTimer);
      for (const cover of covers) {
        cover.texture.dispose();
        cover.front.dispose();
      }
      geometry.dispose();
      lidGeometry.dispose();
      glass.dispose();
      studioEnv.dispose();
      for (const material of [sides, tops]) {
        material.map?.dispose();
        material.dispose();
      }
      backing.dispose();
      floor.geometry.dispose();
      (floor.material as THREE.Material).dispose();
      backdropTexture.dispose();
      environment.dispose();
      pmrem.dispose();
      composer.dispose();
      renderer.dispose();
    }
  };

  return api;
}
