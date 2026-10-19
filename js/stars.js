/* ============================================================
   stars.js —— 高性能星体渲染
   - StarLayer：单个 Points 对象承载全部星星（1 次 draw call）
   - 星芒、光晕全部在片元着色器里生成，无需后期处理
   - 程序化星云贴图，营造宇宙尺度感
   ============================================================ */
import * as THREE from "three";

/* ---------------- 着色器 ---------------- */

const STAR_VERTEX = /* glsl */ `
  attribute vec3 aColor;
  attribute float aSize;
  attribute float aSpike;
  attribute float aPhase;
  attribute float aHover;
  attribute float aAlpha;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uTwinkle;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uDrift;
  uniform float uDriftSpeed;

  varying vec3 vColor;
  varying float vSpike;
  varying float vIntensity;

  void main() {
    vColor = aColor;
    vSpike = aSpike;

    // 闪烁：低频呼吸（亮度 + 轻微尺寸），避免整体同步闪烁
    float breath = 0.5 + 0.5 * sin(uTime * 1.6 + aPhase);
    float tw = mix(1.0, breath, uTwinkle);
    vIntensity = aAlpha * uOpacity * tw;

    // 入场绽放：从中心向外逐圈点亮（uReveal 由 0 到 1）
    float rn = clamp(length(position) / 170.0, 0.0, 1.0);
    float e = smoothstep(0.0, 1.0, (uReveal * 1.5 - 0.5 * rn));
    vIntensity *= e;

    // 星体微动：极慢、极小的三轴漂移。每个点相位不同，
    // 因此不会整片同步移动；振幅远小于点间距，布局轮廓保持不变。
    vec3 p = position;
    float dt = uTime * uDriftSpeed;
    p.x += sin(dt * 1.7 + aPhase * 1.3) * uDrift;
    p.y += cos(dt * 1.3 + aPhase * 2.1) * uDrift * 0.55;
    p.z += sin(dt * 1.1 + aPhase * 2.7) * uDrift;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = max(0.001, -mv.z);
    float size = aSize * uSizeScale * (1.0 + aHover * 1.2) * (260.0 / dist);
    size *= mix(0.45, 1.0, e) * mix(1.0, 0.9 + 0.1 * breath, uTwinkle);
    gl_PointSize = clamp(size * uPixelRatio, 1.0, 300.0 * uPixelRatio);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vSpike;
  varying float vIntensity;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;

    // 核心：小而锐利，接近白热
    float core = pow(max(0.0, 1.0 - r * 2.05), 3.0);

    // 光晕：指数衰减，柔和外扩
    float halo = exp(-r * 3.6) * 0.40;

    // 十字星芒：亮星才有，营造「星辰」质感
    float spike = 0.0;
    if (vSpike > 0.001) {
      vec2 a = abs(uv);
      float sx = max(0.0, 1.0 - a.y * 30.0) * max(0.0, 1.0 - a.x * 2.2);
      float sy = max(0.0, 1.0 - a.x * 30.0) * max(0.0, 1.0 - a.y * 2.2);
      spike = (sx + sy) * vSpike * 0.45;
    }

    float i = (core + halo + spike) * vIntensity;
    if (i < 0.003) discard;

    // 核心偏白，外圈保留分支颜色
    vec3 col = mix(vColor, vec3(1.0), core * 0.6);
    gl_FragColor = vec4(col * i, i);
  }
`;

/* ---------------- 星体图层 ---------------- */

export class StarLayer {
  /**
   * @param {Array} items [{ position:[x,y,z], color:"#rrggbb", size:Number, spike:Number }]
   * @param {Object} opts  { opacity, twinkle, sizeScale, baseAlpha }
   */
  constructor(items, opts = {}) {
    const n = items.length;
    this.count = n;

    const positions = new Float32Array(n * 3);
    const colors = new Float32Array(n * 3);
    const sizes = new Float32Array(n);
    const spikes = new Float32Array(n);
    const phases = new Float32Array(n);
    const hover = new Float32Array(n);
    const alpha = new Float32Array(n);
    const baseAlpha = opts.baseAlpha !== undefined ? opts.baseAlpha : 1;

    const col = new THREE.Color();
    items.forEach((it, i) => {
      positions[i * 3] = it.position[0];
      positions[i * 3 + 1] = it.position[1];
      positions[i * 3 + 2] = it.position[2];
      col.set(it.color || "#ffffff");
      colors[i * 3] = col.r;
      colors[i * 3 + 1] = col.g;
      colors[i * 3 + 2] = col.b;
      sizes[i] = it.size || 6;
      spikes[i] = it.spike || 0;
      phases[i] = Math.random() * Math.PI * 2;
      alpha[i] = baseAlpha;
    });

    this._alpha = alpha;
    this._target = Float32Array.from(alpha);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geo.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
    geo.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
    geo.setAttribute("aSpike", new THREE.BufferAttribute(spikes, 1));
    geo.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
    geo.setAttribute("aHover", new THREE.BufferAttribute(hover, 1));
    geo.setAttribute("aAlpha", new THREE.BufferAttribute(alpha, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uPixelRatio: { value: Math.min(window.devicePixelRatio, 2) },
        uSizeScale: { value: opts.sizeScale || 1 },
        uTwinkle: { value: opts.twinkle !== undefined ? opts.twinkle : 0.22 },
        uOpacity: { value: opts.opacity !== undefined ? opts.opacity : 1 },
        uReveal: { value: opts.reveal ? 0 : 1 },
        uDrift: { value: opts.drift || 0 },
        uDriftSpeed: { value: opts.driftSpeed || 0.16 },
      },
      vertexShader: STAR_VERTEX,
      fragmentShader: STAR_FRAGMENT,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      premultipliedAlpha: true,
    });

    this.geometry = geo;
    this.object = new THREE.Points(geo, this.material);
    this.object.frustumCulled = false;
    this.object.renderOrder = 2;

    this._hoverAttr = geo.getAttribute("aHover");
    this._alphaAttr = geo.getAttribute("aAlpha");

    // 入场绽放：opts.reveal 为 true 时从 0 渐显（中心先亮、外圈随后）
    this._revealStart = opts.reveal ? performance.now() : 0;
    this._revealDuration = opts.revealDuration || 1700;
  }

  /** 设置某个点的悬停/选中高亮强度 */
  setHighlight(index, value) {
    if (index < 0 || index >= this.count) return;
    if (this._hoverAttr.array[index] === value) return;
    this._hoverAttr.array[index] = value;
    this._hoverAttr.needsUpdate = true;
  }

  setHighlightArray(values) {
    const arr = this._hoverAttr.array;
    let changed = false;
    for (let i = 0; i < values.length; i++) {
      if (arr[i] !== values[i]) {
        arr[i] = values[i];
        changed = true;
      }
    }
    if (changed) this._hoverAttr.needsUpdate = true;
  }

  /** 设置某个点目标透明度（用于分支筛选淡入淡出） */
  setAlphaTarget(index, value) {
    if (index < 0 || index >= this.count) return;
    this._target[index] = value;
  }

  setAllAlphaTarget(value) {
    this._target.fill(value);
  }

  /** 每帧更新：时间推进 + 透明度平滑 */
  update(time, dt) {
    this.material.uniforms.uTime.value = time;

    // 入场绽放：uReveal 由 0 平滑升到 1
    if (this._revealStart) {
      const rt = Math.min(1, (performance.now() - this._revealStart) / this._revealDuration);
      this.material.uniforms.uReveal.value = 1 - Math.pow(1 - rt, 3);
      if (rt >= 1) this._revealStart = 0;
    }

    const a = this._alpha;
    const t = this._target;
    const k = Math.min(1, dt * 6);
    let changed = false;
    for (let i = 0; i < a.length; i++) {
      const d = t[i] - a[i];
      if (d > 0.0005 || d < -0.0005) {
        a[i] += d * k;
        changed = true;
      } else if (a[i] !== t[i]) {
        a[i] = t[i];
        changed = true;
      }
    }
    if (changed) {
      this._alphaAttr.needsUpdate = true;
    }
  }
}

/* ---------------- 程序化星云贴图 ---------------- */

function mulberry32(a) {
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function makeValueNoise(seed) {
  const rand = mulberry32(seed);
  const SIZE = 256;
  const g = new Float32Array(SIZE * SIZE);
  for (let i = 0; i < g.length; i++) g[i] = rand();
  const at = (x, y) => g[(y & 255) * SIZE + (x & 255)];
  return (x, y) => {
    const xi = Math.floor(x);
    const yi = Math.floor(y);
    const xf = x - xi;
    const yf = y - yi;
    const u = xf * xf * (3 - 2 * xf);
    const v = yf * yf * (3 - 2 * yf);
    const a = at(xi, yi);
    const b = at(xi + 1, yi);
    const c = at(xi, yi + 1);
    const d = at(xi + 1, yi + 1);
    return (
      a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v
    );
  };
}

function fbm(noise, x, y, octaves) {
  let v = 0;
  let amp = 0.5;
  let freq = 1;
  let norm = 0;
  for (let i = 0; i < octaves; i++) {
    v += amp * noise(x * freq, y * freq);
    norm += amp;
    amp *= 0.5;
    freq *= 2.04;
  }
  return v / norm;
}

/**
 * 生成一张程序化星云贴图（柔和云雾 + 辐射状衰减）
 * @param {Object} o { seed, inner:"#hex", outer:"#hex", size }
 */
export function makeNebulaTexture(o = {}) {
  const size = o.size || 160;
  const noise = makeValueNoise(o.seed || 1);
  const noise2 = makeValueNoise((o.seed || 1) * 7 + 13);

  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);

  const inner = new THREE.Color(o.inner || "#4b2ea8");
  const outer = new THREE.Color(o.outer || "#1c6bff");

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const nx = (x / size) * 3.2;
      const ny = (y / size) * 3.2;

      // 云团形状
      let f = fbm(noise, nx, ny, 5);
      // 径向衰减：边缘自然消散
      const dx = (x / size - 0.5) * 2;
      const dy = (y / size - 0.5) * 2;
      const d = Math.min(1, Math.sqrt(dx * dx + dy * dy));
      const falloff = Math.pow(Math.max(0, 1 - d), 1.7);

      // 只保留较亮的部分，形成丝状云
      let a = Math.max(0, (f - 0.42) / 0.58);
      a = Math.pow(a, 1.6) * falloff;

      // 色彩混合
      const mixT = fbm(noise2, nx * 1.6 + 21, ny * 1.6 + 9, 3);
      const c = inner.clone().lerp(outer, Math.min(1, Math.max(0, mixT)));

      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round(c.r * 255);
      img.data[idx + 1] = Math.round(c.g * 255);
      img.data[idx + 2] = Math.round(c.b * 255);
      img.data[idx + 3] = Math.round(Math.min(1, a) * 255);
    }
  }

  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/** 柔和的径向渐变贴图（银核光晕、星云点缀用） */
export function makeSoftGlowTexture(stops) {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  (stops || [
    [0, "rgba(255,255,255,1)"],
    [0.35, "rgba(200,220,255,0.35)"],
    [1, "rgba(160,190,255,0)"],
  ]).forEach(([p, c]) => g.addColorStop(p, c));
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}
