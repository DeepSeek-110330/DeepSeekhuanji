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
  attribute float aGrade;
  attribute float aSeed;
  attribute float aRot;

  uniform float uTime;
  uniform float uPixelRatio;
  uniform float uSizeScale;
  uniform float uTwinkle;
  uniform float uOpacity;
  uniform float uReveal;
  uniform float uDrift;
  uniform float uDriftSpeed;
  uniform float uRich;
  uniform float uFlash;

  varying vec3 vColor;
  varying float vSpike;
  varying float vIntensity;
  varying float vGrade;
  varying float vSeed;
  varying float vRot;
  varying float vHover;
  varying float vRich;

  void main() {
    vRich = uRich;
    vColor = aColor;
    vSpike = aSpike;
    vGrade = aGrade;
    vSeed = aSeed;
    vRot = aRot;
    vHover = aHover;

    // 双频呼吸：一个快频 + 一个更慢的频，避免所有星同步闪
    float breath1 = 0.5 + 0.5 * sin(uTime * 1.05 + aPhase);
    float breath2 = 0.5 + 0.5 * sin(uTime * 0.31 + aPhase * 2.7 + 1.3);
    float tw = mix(1.0, 0.74 + 0.18 * breath1 + 0.08 * breath2, uTwinkle);

    // 极少数亮星的偶发微闪（只对知识点层开启）
    float flash = uFlash * uRich * 0.16 * smoothstep(0.965, 1.0, sin(uTime * 0.21 + aPhase * 9.0));

    // 幂律亮度：暗星更暗，亮星更突出
    float bright = mix(1.0, 0.80 + 0.28 * aSeed, uRich);
    vIntensity = aAlpha * uOpacity * (tw + flash) * bright;

    // 入场绽放：从中心向外逐圈点亮（uReveal 由 0 到 1）
    float rn = clamp(length(position) / 170.0, 0.0, 1.0);
    float e = smoothstep(0.0, 1.0, (uReveal * 1.5 - 0.5 * rn));
    vIntensity *= e;

    // 星体微动：极慢、极小的三轴漂移，逐点相位不同
    vec3 p = position;
    float dt = uTime * uDriftSpeed;
    p.x += sin(dt * 1.7 + aPhase * 1.3) * uDrift;
    p.y += cos(dt * 1.3 + aPhase * 2.1) * uDrift * 0.55;
    p.z += sin(dt * 1.1 + aPhase * 2.7) * uDrift;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;

    float dist = max(0.001, -mv.z);
    float gradeScale = mix(1.0, 0.92 + 0.20 * aGrade, uRich);
    float size = aSize * uSizeScale * (1.0 + aHover * 1.2) * (260.0 / dist);
    size *= mix(0.45, 1.0, e) * mix(1.0, 0.9 + 0.1 * breath1, uTwinkle);
    size *= gradeScale;
    gl_PointSize = clamp(size * uPixelRatio, 1.0, 300.0 * uPixelRatio);
  }
`;

const STAR_FRAGMENT = /* glsl */ `
  varying vec3 vColor;
  varying float vSpike;
  varying float vIntensity;
  varying float vGrade;
  varying float vSeed;
  varying float vRot;
  varying float vHover;
  varying float vRich;

  void main() {
    vec2 uv = gl_PointCoord - 0.5;
    float r = length(uv) * 2.0;
    if (r > 1.0) discard;

    // 三层结构：白热核 + 彩色内晕 + 冷色外晕
    float core = pow(max(0.0, 1.0 - r * 1.55), 8.0);
    float inner = exp(-r * r * 20.0) * 0.66;
    float halo = exp(-r * 3.8) * 0.36;
    float outer = exp(-r * 2.4) * 0.085;
    float bloom = exp(-r * 1.55) * 0.030;
    float whiteHalo = exp(-r * r * 8.5) * 0.24;
    float hero = smoothstep(0.82, 1.0, vGrade);
    float heroAura = exp(-r * 1.15) * 0.07 * hero;

    // 低等级星降饱和，高等级星保留分支色
    vec3 starWhite = mix(vec3(1.0, 0.93, 0.80), vec3(0.70, 0.84, 1.0), smoothstep(0.25, 0.75, vSeed));
    vec3 base = mix(starWhite, vColor, mix(0.02, 0.30, vGrade));

    // 分级星芒：L4/L5 才有明显星芒，并带每颗星自己的旋转角
    float spike = 0.0;
    if (vSpike > 0.001) {
      float c = cos(vRot);
      float s = sin(vRot);
      vec2 ruv = mat2(c, -s, s, c) * uv;
      float len = 0.82 + 0.36 * vSeed;
      vec2 auv = abs(ruv);
      float sx = max(0.0, 1.0 - auv.y * 30.0) * max(0.0, 1.0 - auv.x * (2.1 * len));
      float sy = max(0.0, 1.0 - auv.x * 30.0) * max(0.0, 1.0 - auv.y * (2.1 * len));
      spike = (sx + sy) * vSpike * 0.32;

      // 对角线星芒：更弱，只给高等级星
      if (vGrade > 0.85) {
        float c2 = cos(vRot + 0.7853981634);
        float s2 = sin(vRot + 0.7853981634);
        vec2 duv = abs(mat2(c2, -s2, s2, c2) * uv);
        float dx = max(0.0, 1.0 - duv.y * 34.0) * max(0.0, 1.0 - duv.x * (2.4 * len));
        float dy = max(0.0, 1.0 - duv.x * 34.0) * max(0.0, 1.0 - duv.y * (2.4 * len));
        spike += (dx + dy) * vSpike * 0.085;
      }
    }

    // 悬停/选中：只做轻微亮度增强，不加常驻大光环
    float hoverBoost = vHover * 0.10;

    float edge = 1.0 - smoothstep(0.72, 1.0, r);
    float i = (core * 1.0 + inner * 0.50 + halo * 0.34 + whiteHalo + heroAura + outer * 0.14 + spike + bloom + hoverBoost) * vIntensity * 0.92 * edge;
    if (i < 0.003) discard;

    // 核心偏白，外圈保留分支色，外晕略偏冷
    vec3 col = mix(base, vec3(1.0), clamp(core * 0.92, 0.0, 0.90));
    float warm = smoothstep(0.68, 1.0, vSeed) * 0.30 * (1.0 - vGrade * 0.30);
    col = mix(col, vec3(1.0, 0.82, 0.62), warm);
    col = mix(col, vec3(0.62, 0.78, 1.0), outer * 0.30);
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
    const grades = new Float32Array(n);
    const seeds = new Float32Array(n);
    const rots = new Float32Array(n);
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
      grades[i] = it.grade !== undefined ? it.grade : 0.4;
      seeds[i] = it.seed !== undefined ? it.seed : Math.random();
      rots[i] = it.rot !== undefined ? it.rot : Math.random() * Math.PI * 2;
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
    geo.setAttribute("aGrade", new THREE.BufferAttribute(grades, 1));
    geo.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
    geo.setAttribute("aRot", new THREE.BufferAttribute(rots, 1));

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
        uRich: { value: opts.rich ? 1 : 0 },
        uFlash: { value: opts.flash === false ? 0 : 1 },
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
  const cutoff = o.cutoff !== undefined ? o.cutoff : 0.42;
  const power = o.power !== undefined ? o.power : 1.6;

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

      // 只保留较亮的部分，形成丝状云；cutoff 越低，云越饱满
      let a = Math.max(0, (f - cutoff) / (1 - cutoff));
      a = Math.pow(a, power) * falloff;

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

/**
 * 生成一张「极光丝带」贴图：横向流动的冷色光带，边缘透明。
 * 适合用 AdditiveBlending 大尺度叠在银河盘面上，营造梦幻气体感。
 */
export function makeAuroraTexture(o = {}) {
  const size = o.size || 256;
  const noise = makeValueNoise(o.seed || 5);
  const cA = new THREE.Color(o.colorA || "#64e6ff");
  const cB = new THREE.Color(o.colorB || "#b68cff");
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const img = ctx.createImageData(size, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / (size - 1);
      const v = y / (size - 1);
      const edge = Math.pow(Math.sin(Math.PI * u), 1.35) * Math.pow(Math.sin(Math.PI * v), 0.55);
      const n = fbm(noise, u * 4.3 + 2.1, v * 7.2 + 8.4, 4);
      const wave =
        0.5 +
        0.085 * Math.sin(u * Math.PI * 2.0 + 0.7) +
        0.045 * Math.sin(u * Math.PI * 4.0 + 2.3) +
        0.035 * (n - 0.5);
      const d = Math.abs(v - wave);
      const band = Math.exp(-d * d / (2 * 0.035 * 0.035));
      const band2 = Math.exp(-Math.pow(d - 0.09, 2) / (2 * 0.055 * 0.055)) * 0.42;
      const alpha = Math.min(1, (band + band2) * (0.30 + 0.85 * n) * edge);
      const c = cA.clone().lerp(cB, Math.min(1, Math.max(0, u * 0.9 + (n - 0.5) * 0.35)));
      const idx = (y * size + x) * 4;
      img.data[idx] = Math.round(c.r * 255);
      img.data[idx + 1] = Math.round(c.g * 255);
      img.data[idx + 2] = Math.round(c.b * 255);
      img.data[idx + 3] = Math.round(alpha * 255);
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

/**
 * 生成一个微型旋涡星系贴图：亮核 + 两条稀疏旋臂。
 * 用于远景深空中的「其他星系」，只做点缀，不抢知识点。
 */
export function makeGalaxyTexture(o = {}) {
  const size = o.size || 192;
  const rand = mulberry32(o.seed || 17);
  const core = new THREE.Color(o.core || "#ffe6c4");
  const arm = new THREE.Color(o.arm || "#8fb8ff");
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  const cx = size * 0.5;
  const cy = size * 0.5;

  const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.42);
  g.addColorStop(0, `rgba(255,255,255,0.95)`);
  g.addColorStop(0.08, `rgba(${core.r*255|0},${core.g*255|0},${core.b*255|0},0.85)`);
  g.addColorStop(0.30, `rgba(${arm.r*255|0},${arm.g*255|0},${arm.b*255|0},0.24)`);
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);

  ctx.globalCompositeOperation = "lighter";
  for (let a = 0; a < 2; a++) {
    const base = a * Math.PI;
    for (let i = 0; i < 520; i++) {
      const t = Math.pow(rand(), 0.65);
      const r = size * (0.035 + 0.40 * t);
      const th = base + t * 4.8 + (rand() - 0.5) * (0.75 - 0.45 * t);
      const x = cx + Math.cos(th) * r;
      const y = cy + Math.sin(th) * r * 0.46;
      const al = (1 - t) * 0.20 + 0.03;
      const c = arm.clone().lerp(core, 0.22 + 0.55 * (1 - t));
      ctx.fillStyle = `rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},${al})`;
      const s = 0.6 + rand() * 1.1;
      ctx.fillRect(x, y, s, s);
    }
  }
  ctx.globalCompositeOperation = "source-over";
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

/**
 * 生成一张「旋涡星系底图」：暖色核球 + 冷色旋臂 + 暗尘埃带。
 * 它是一张平面纹理，放在银盘平面里作为「气体和星尘」的底层，
 * 让知识点像嵌在真实星系里，而不是浮在黑底上的点。
 */
export function makeSpiralGalaxyTexture(o = {}) {
  const size = o.size || 1024;
  const rand = mulberry32(o.seed || 808);
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  const cx = size / 2;
  const cy = size / 2;
  ctx.clearRect(0, 0, size, size);

  // 核球：暖白到金色的径向光
  const core = ctx.createRadialGradient(cx, cy, 0, cx, cy, size * 0.24);
  core.addColorStop(0, "rgba(255,248,230,0.95)");
  core.addColorStop(0.10, "rgba(255,224,180,0.62)");
  core.addColorStop(0.28, "rgba(210,180,255,0.28)");
  core.addColorStop(0.62, "rgba(90,120,220,0.10)");
  core.addColorStop(1, "rgba(20,30,80,0)");
  ctx.fillStyle = core;
  ctx.fillRect(0, 0, size, size);

  // 旋臂：先用低透明度的小光点铺出气体，再用亮星点缀
  ctx.globalCompositeOperation = "lighter";
  const armColors = [
    new THREE.Color("#7fe8ff"),
    new THREE.Color("#b18cff"),
    new THREE.Color("#ff9fd0"),
    new THREE.Color("#ffd6a0"),
  ];
  for (let i = 0; i < 12000; i++) {
    const arm = Math.floor(rand() * 4);
    const t = Math.pow(rand(), 0.72);
    const r = size * (0.025 + 0.445 * t);
    const theta =
      arm * (Math.PI / 2) +
      4.7 * t +
      (rand() - 0.5) * (0.48 - 0.24 * t);
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r * 0.66;
    const c = armColors[arm].clone().lerp(new THREE.Color("#fff4dc"), 0.18 + 0.45 * (1 - t));
    const a = (0.025 + 0.070 * (1 - t)) * (0.4 + 0.6 * rand());
    ctx.fillStyle = `rgba(${c.r*255|0},${c.g*255|0},${c.b*255|0},${a})`;
    const sz = 1.4 + rand() * 4.2;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }
  // 少量亮星团
  for (let i = 0; i < 380; i++) {
    const arm = Math.floor(rand() * 4);
    const t = Math.pow(rand(), 0.65);
    const r = size * (0.03 + 0.42 * t);
    const theta = arm * (Math.PI / 2) + 4.7 * t + (rand() - 0.5) * 0.28;
    const x = cx + Math.cos(theta) * r;
    const y = cy + Math.sin(theta) * r * 0.66;
    ctx.fillStyle = `rgba(255,248,235,${0.12 + 0.34 * rand()})`;
    const sz = 1.0 + rand() * 2.4;
    ctx.beginPath();
    ctx.arc(x, y, sz, 0, Math.PI * 2);
    ctx.fill();
  }

  // 暗尘埃带：用 destination-out 在气体上擦出旋涡状的暗缝
  ctx.globalCompositeOperation = "destination-out";
  for (let arm = 0; arm < 4; arm++) {
    ctx.beginPath();
    for (let k = 0; k <= 90; k++) {
      const t = 0.10 + 0.88 * (k / 90);
      const r = size * (0.05 + 0.42 * t);
      const theta = arm * (Math.PI / 2) + 4.7 * t + 0.13;
      const x = cx + Math.cos(theta) * r;
      const y = cy + Math.sin(theta) * r * 0.66;
      if (k === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.strokeStyle = "rgba(0,0,0,0.19)";
    ctx.lineWidth = size * 0.018;
    ctx.lineCap = "round";
    ctx.stroke();
  }

  // 边缘渐隐，避免看到贴图边界
  ctx.globalCompositeOperation = "destination-in";
  const fade = ctx.createRadialGradient(cx, cy, size * 0.18, cx, cy, size * 0.50);
  fade.addColorStop(0, "rgba(255,255,255,1)");
  fade.addColorStop(0.72, "rgba(255,255,255,0.72)");
  fade.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = fade;
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";

  // 轻微模糊：把「点状气体」融成连续的星云，同时保留旋臂的可读性
  const out = document.createElement("canvas");
  out.width = out.height = size;
  const octx = out.getContext("2d");
  octx.filter = "blur(2.4px)";
  octx.drawImage(cv, 0, 0);
  octx.filter = "none";

  const tex = new THREE.CanvasTexture(out);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = true;
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
