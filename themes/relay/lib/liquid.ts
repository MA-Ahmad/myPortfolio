/**
 * The page's backdrop: a sheet of black liquid, drawn by one fragment shader. A slowly
 * domain-warped height field is lit like a glossy surface, so only its crests catch a cool
 * highlight and the rest stays black. The light leans toward the pointer, and each relay drops a
 * ripple at the card's bullet that spreads and dies out.
 *
 * It renders at a fraction of the screen's resolution (it is all soft gradients), at most 30
 * frames a second, stops while the tab is hidden, and draws one still frame with reduced motion.
 * Without WebGL the canvas stays empty and the page's black shows through.
 */

const VERTEX = `
attribute vec2 a;
void main() { gl_Position = vec4(a, 0.0, 1.0); }
`;

const FRAGMENT = `
precision mediump float;
uniform vec2 uRes;
uniform float uTime;
uniform vec2 uLight;
uniform vec3 uRipple;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  vec2 u = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), u.x), mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
}
float fbm(vec2 p) {
  float v = 0.0;
  float a = 0.5;
  for (int i = 0; i < 3; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
  return v;
}
float height(vec2 p) {
  vec2 q = vec2(fbm(p + uTime * 0.022), fbm(p + vec2(5.2, 1.3) - uTime * 0.018));
  float h = fbm(p + 1.7 * q);
  float age = uTime - uRipple.z;
  if (age > 0.0 && age < 3.2) {
    float d = length(p - uRipple.xy);
    float r = age * 0.45;
    h += 0.05 * sin((d - r) * 26.0) * exp(-abs(d - r) * 8.0) * (1.0 - age / 3.2);
  }
  return h;
}
void main() {
  vec2 p = gl_FragCoord.xy / uRes.y * 1.3;
  float e = 0.012;
  float hx = height(p - vec2(e, 0.0)) - height(p + vec2(e, 0.0));
  float hy = height(p - vec2(0.0, e)) - height(p + vec2(0.0, e));
  vec3 n = normalize(vec3(hx, hy, e * 0.9));
  vec3 l = normalize(vec3(uLight, 0.75));
  vec3 hv = normalize(l + vec3(0.0, 0.0, 1.0));
  float spec = pow(max(dot(n, hv), 0.0), 72.0);
  float sheen = pow(max(dot(n, l), 0.0), 6.0);
  float rim = pow(1.0 - n.z, 3.0);
  vec3 col = vec3(0.016, 0.016, 0.02);
  col += vec3(0.82, 0.86, 1.0) * spec * 0.42;
  col += vec3(0.5, 0.54, 0.66) * sheen * 0.05;
  col += vec3(0.42, 0.46, 0.58) * rim * 0.16;
  // Calm where the text sits: the middle of the screen is held darker than its edges.
  vec2 c = (gl_FragCoord.xy / uRes - 0.5) * vec2(1.25, 1.0);
  col *= mix(0.42, 1.0, smoothstep(0.08, 0.62, length(c)));
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Render scale: soft gradients need few pixels; fewer still on phones. */
const SCALE = typeof matchMedia !== 'undefined' && matchMedia('(pointer: coarse)').matches ? 0.28 : 0.36;
const FRAME_MS = 1000 / 30;

export type Liquid = {
  /** Leans the light toward a point on the screen (CSS px). */
  point: (x: number, y: number) => void;
  /** Drops a ripple at a point on the screen (CSS px). */
  ripple: (x: number, y: number) => void;
  destroy: () => void;
};

export function startLiquid(canvas: HTMLCanvasElement, { still }: { still: boolean }): Liquid | null {
  const gl = canvas.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
  if (!gl) return null;

  const shader = (type: number, source: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, source);
    gl.compileShader(s);
    return s;
  };
  const program = gl.createProgram()!;
  gl.attachShader(program, shader(gl.VERTEX_SHADER, VERTEX));
  gl.attachShader(program, shader(gl.FRAGMENT_SHADER, FRAGMENT));
  gl.linkProgram(program);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) return null;
  gl.useProgram(program);

  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const a = gl.getAttribLocation(program, 'a');
  gl.enableVertexAttribArray(a);
  gl.vertexAttribPointer(a, 2, gl.FLOAT, false, 0, 0);

  const u = {
    res: gl.getUniformLocation(program, 'uRes'),
    time: gl.getUniformLocation(program, 'uTime'),
    light: gl.getUniformLocation(program, 'uLight'),
    ripple: gl.getUniformLocation(program, 'uRipple')
  };

  const start = performance.now();
  // The light rests up and to the left, and eases toward the pointer.
  const light = { x: -0.35, y: 0.45, tx: -0.35, ty: 0.45 };
  let ripple = { x: 0, y: 0, t: -10 };
  let frame = 0;
  let last = 0;

  const size = () => {
    const w = Math.max(1, Math.round(innerWidth * SCALE));
    const h = Math.max(1, Math.round(innerHeight * SCALE));
    if (canvas.width !== w || canvas.height !== h) {
      canvas.width = w;
      canvas.height = h;
      gl.viewport(0, 0, w, h);
    }
  };

  // Screen px to the shader's surface coordinates (y up, scaled by the height).
  const toSurface = (x: number, y: number) => ({ x: (x / innerHeight) * 1.3, y: ((innerHeight - y) / innerHeight) * 1.3 });

  const render = (now: number) => {
    size();
    light.x += (light.tx - light.x) * 0.06;
    light.y += (light.ty - light.y) * 0.06;
    const time = still ? 12 : (now - start) / 1000;
    gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform1f(u.time, time);
    gl.uniform2f(u.light, light.x, light.y);
    gl.uniform3f(u.ripple, ripple.x, ripple.y, ripple.t);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  const loop = (now: number) => {
    frame = requestAnimationFrame(loop);
    if (now - last < FRAME_MS) return;
    last = now;
    render(now);
  };

  const onVisibility = () => {
    cancelAnimationFrame(frame);
    if (document.visibilityState === 'visible' && !still) frame = requestAnimationFrame(loop);
  };
  const onResize = () => still && render(performance.now());

  if (still) render(performance.now());
  else frame = requestAnimationFrame(loop);
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('resize', onResize);

  return {
    point: (x, y) => {
      light.tx = (x / innerWidth - 0.5) * 1.4;
      light.ty = (0.5 - y / innerHeight) * 1.4;
    },
    ripple: (x, y) => {
      if (still) return;
      const s = toSurface(x, y);
      ripple = { x: s.x, y: s.y, t: (performance.now() - start) / 1000 };
    },
    destroy: () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('resize', onResize);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    }
  };
}
