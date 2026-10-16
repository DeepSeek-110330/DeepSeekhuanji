import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { renderPlot } from "./plot.js?v=26";
import { StarLayer, makeNebulaTexture, makeSoftGlowTexture } from "./stars.js?v=26";

/* ============================================================
   1. 全局状态
   ============================================================ */
let DATA = null; // knowledge.json 的内容
const nodeById = new Map(); // id -> 节点数据
let dataIndexOf = new Map(); // id -> Points 中的下标
let starLayer = null; // 知识点星体图层
const bgLayers = []; // 背景星尘图层
let linksObject = null; // 合并后的连线
let linkMeta = []; // 每条连线的元信息
let linkBaseColors = null; // 连线的原始颜色
let linksRevealStart = 0; // 连线入场淡入起点
let armSpine = null; // 分支筛选时高亮的「旋臂骨架线」

let hoveredIndex = -1;
let selectedIndex = -1;
let activeBranch = null; // 当前筛选的分支，null = 全部
let currentNode = null; // 当前打开的知识点
let panelHistory = []; // 面板浏览历史（「返回上一个」用）
let currentLang = "zh"; // zh | en  —— 面板语言
let armAngles = []; // 旋臂基础角度（由 computePositions 填充）
let armLabels = []; // 旋臂名称漂浮标签
let pulseIdx = []; // 搜索结果脉冲高亮的下标
let pulseT0 = 0;   // 脉冲起始时刻

/* ============================================================
   2. 加载数据
   ============================================================ */
async function loadData() {
  // 首屏只加载「骨架」（轻量字段）；点开知识点时再按分支加载完整内容（见 loadNodeDetails）
  // no-cache：每次都向服务器校验，保证加了新知识点后刷新就能看到
  const res = await fetch("data/skeleton.json", { cache: "no-cache" });
  DATA = await res.json();
  DATA.nodes.forEach((n) => nodeById.set(n.id, n));
}

/* 按需加载：详情分片 data/parts/<branch>.json（一个分支只加载一次，之后走内存缓存） */
const partsCache = new Map();   // branch -> { nodeId: 详情对象 }
const partsPending = new Map(); // branch -> Promise（防并发重复请求）
async function loadNodeDetails(node) {
  if (node.details) return node.details;
  const branch = node.branch;
  if (!partsCache.has(branch)) {
    if (!partsPending.has(branch)) {
      partsPending.set(
        branch,
        fetch(`data/parts/${branch}.json`, { cache: "no-cache" })
          .then((r) => {
            if (!r.ok) throw new Error("HTTP " + r.status);
            return r.json();
          })
          .then((json) => {
            partsCache.set(branch, json);
            partsPending.delete(branch);
            return json;
          })
          .catch((err) => {
            partsPending.delete(branch);
            throw err;
          })
      );
    }
    await partsPending.get(branch);
  }
  const part = partsCache.get(branch)[node.id] || null;
  if (part) node.details = part;
  return part;
}

/* 固定种子的随机数：保证每次刷新星系布局一致 */
function seededRandom(seed) {
  let a = seed | 0;
  return function () {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ============================================================
   3. 计算知识点的 3D 位置
      旋臂分布 + 松弛推挤，避免光团重叠
   ============================================================ */
function computePositions() {
  const rnd = seededRandom(9182736);

  const grouped = new Map();
  DATA.nodes.forEach((n) => {
    if (!grouped.has(n.branch)) grouped.set(n.branch, []);
    grouped.get(n.branch).push(n);
  });

  // 只有「已有知识点的分支」才分配到旋臂上，臂角按数量均匀铺开
  const populated = Object.keys(DATA.branches).filter((b) => grouped.has(b));
  const armCount = Math.max(1, populated.length);
  const anchors = new Map();

  // 记录旋臂的基础角度，供背景星尘复用，保证背景与知识点旋臂对齐
  armAngles = populated.map((_, i) => (i / armCount) * Math.PI * 2);

  // 节点最多的分支，用来把各臂的尺寸归一化到同一把尺子上
  const maxN = Math.max(...populated.map((b) => grouped.get(b).length), 1);

  populated.forEach((branch, arm) => {
    const nodes = grouped.get(branch);
    // 稳定排序，保证布局可复现
    nodes.sort((a, b) => a.level - b.level || (a.id < b.id ? -1 : 1));

    const armAngle = (arm / armCount) * Math.PI * 2;
    const n = nodes.length;

    // 三个尺寸参数都随节点数缩放，让每条臂的「点密度」彼此接近：
    //   sweep      —— 扫过的角度：点少 ⇒ 只占一小段弧，不再拖出空荡荡的长弧
    //   radius0    —— 内端起点：点少 ⇒ 整条臂整体外移，把核心让给大分支
    //   radialSpan —— 径向长度：点少 ⇒ 臂更短
    // 再叠加 radius * 0.006 的全局螺旋项，保持银河的螺旋观感。
    const t = n / maxN;
    const sweep = Math.min(3.2, 0.28 + n * 0.086);
    const radius0 = 26 + (1 - t) * 36;
    const radialSpan = 42 + Math.min(74, n * 2.0);

    nodes.forEach((node, i) => {
      // s：沿着旋臂从内到外的位置
      const s = (i + 0.5) / n;
      // 级别只做轻微的内外偏移，不主导布局
      const lvlShift = (node.level - 3) * 2.6;

      const radius = radius0 + s * radialSpan + lvlShift + (rnd() - 0.5) * 6;
      // 旋臂：角度随 s 推进，叠加轻微的螺旋感
      const angle =
        armAngle + s * sweep + radius * 0.006 + (rnd() - 0.5) * 0.1;

      const x = Math.cos(angle) * radius;
      const z = Math.sin(angle) * radius;
      const y = (rnd() - 0.5) * 30;

      node.position = { x, y, z };
      anchors.set(node.id, { x, y, z });
    });
  });

  // —— 松弛：互相推开，再轻微拉回旋臂 ——
  const nodes = DATA.nodes;
  const minDist = 7.5;
  const minDist2 = minDist * minDist;

  for (let iter = 0; iter < 110; iter++) {
    for (let i = 0; i < nodes.length; i++) {
      const a = nodes[i].position;
      for (let j = i + 1; j < nodes.length; j++) {
        const b = nodes[j].position;
        let dx = b.x - a.x;
        let dy = b.y - a.y;
        let dz = b.z - a.z;
        const d2 = dx * dx + dy * dy + dz * dz;
        if (d2 < minDist2 && d2 > 1e-6) {
          const d = Math.sqrt(d2);
          const push = ((minDist - d) / d) * 0.5;
          dx *= push;
          dy *= push;
          dz *= push;
          a.x -= dx;
          a.y -= dy;
          a.z -= dz;
          b.x += dx;
          b.y += dy;
          b.z += dz;
        }
      }
    }
    // 拉回锚点，保持旋臂轮廓
    const k = 0.014;
    for (let i = 0; i < nodes.length; i++) {
      const p = nodes[i].position;
      const anc = anchors.get(nodes[i].id);
      p.x += (anc.x - p.x) * k;
      p.y += (anc.y - p.y) * k;
      p.z += (anc.z - p.z) * k;
    }
  }
}

/* ============================================================
   4. 场景初始化
   ============================================================ */
const canvas = document.getElementById("galaxy");
const scene = new THREE.Scene();
// 极轻的雾：只用于让远处的连线淡入背景，成本极低
scene.fog = new THREE.FogExp2(0x04050e, 0.0016);

const camera = new THREE.PerspectiveCamera(
  50,
  window.innerWidth / window.innerHeight,
  0.5,
  4000
);
camera.position.set(0, 118, 238);

const renderer = new THREE.WebGLRenderer({
  canvas,
  antialias: false, // 点精灵自带柔边；省下 MSAA 的开销
  alpha: false,
  powerPreference: "high-performance",
  stencil: false,
  depth: true,
});
renderer.setClearColor(0x04050e, 1);

/* 自适应分辨率：性能不足时自动降采样，保证流畅 */
const quality = {
  pr: Math.min(window.devicePixelRatio || 1, 2),
  max: Math.min(window.devicePixelRatio || 1, 2),
  min: 1,
  steps: 0,
  samples: [],
  lastCheck: 0,
};

function applySize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  renderer.setPixelRatio(quality.pr);
  renderer.setSize(w, h);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
  const pr = Math.min(quality.pr, 2);
  if (starLayer) starLayer.material.uniforms.uPixelRatio.value = pr;
  bgLayers.forEach((l) => (l.material.uniforms.uPixelRatio.value = pr));
}

applySize();

/* 相机飞行的状态（在 OrbitControls 事件里会用到，提前声明） */
let fly = null;
let resumeAutoRotateAt = 0;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.15; // 松手后迅速停稳（原 0.055 太长，会"粘"着继续滑行）
controls.rotateSpeed = 0.42;
controls.zoomSpeed = 1.0;
controls.panSpeed = 0.7;
controls.screenSpacePanning = false;
controls.zoomToCursor = true; // 缩放锚定鼠标位置，避免整幅画面向中心漂移
controls.minDistance = 18; // 允许贴近星星观察
controls.maxDistance = 700;
controls.autoRotate = true;
controls.autoRotateSpeed = 0.32;

/* 用户一操作就交还完全控制权：中断飞行、暂停自转 */
controls.addEventListener("start", () => {
  fly = null;
  controls.autoRotate = false;
});
controls.addEventListener("end", () => {
  resumeAutoRotateAt = performance.now() + 3500;
});

/* ============================================================
   5. 背景：星云 + 银核 + 远景星壳 + 银盘星尘
   ============================================================ */
function createNebulae() {
  const group = new THREE.Group();

  // 贴近银盘的两片「银河带」：扁长形状，制造银河主体光带
  const bandConfigs = [
    { seed: 7, pos: [-40, -8, 30], scale: [700, 190], rot: 0.55, opacity: 0.10, inner: "#2a1b6e", outer: "#1257b8" },
    { seed: 19, pos: [55, 6, -35], scale: [620, 170], rot: 0.6, opacity: 0.09, inner: "#3a1b6e", outer: "#1b3fa8" },
  ];

  // 外围星云：更饱和的冷色，点缀而非糊成一片
  const configs = [
    { seed: 3,  scale: 400, pos: [-185, -26, 155], rot: 0.4,  opacity: 0.28, inner: "#4a1f9e", outer: "#1b5fd8" },
    { seed: 11, scale: 380, pos: [205, 20, -145],  rot: -0.7, opacity: 0.25, inner: "#6a1f8c", outer: "#1f3fd8" },
    { seed: 23, scale: 300, pos: [90, -28, 215],   rot: 1.2,  opacity: 0.20, inner: "#0b4c86", outer: "#5f36d8" },
    { seed: 41, scale: 290, pos: [-145, 28, -205], rot: -1.6, opacity: 0.18, inner: "#6f2a94", outer: "#1560b0" },
  ];

  const addSprite = (tex, opacity, rot) =>
    new THREE.SpriteMaterial({
      map: tex,
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
      rotation: rot,
    });

  bandConfigs.forEach((c) => {
    const tex = makeNebulaTexture({ seed: c.seed, inner: c.inner, outer: c.outer, size: 192 });
    const sp = new THREE.Sprite(addSprite(tex, c.opacity, c.rot));
    sp.position.set(c.pos[0], c.pos[1], c.pos[2]);
    sp.scale.set(c.scale[0], c.scale[1], 1);
    sp.renderOrder = -3;
    group.add(sp);
  });

  configs.forEach((c) => {
    const tex = makeNebulaTexture({ seed: c.seed, inner: c.inner, outer: c.outer });
    const sp = new THREE.Sprite(addSprite(tex, c.opacity, c.rot));
    sp.position.set(c.pos[0], c.pos[1], c.pos[2]);
    sp.scale.setScalar(c.scale);
    sp.renderOrder = -3;
    group.add(sp);
  });

  return group;
}

function createCore() {
  const group = new THREE.Group();

  // 内层：紧凑的明亮核心
  const innerTex = makeSoftGlowTexture([
    [0, "rgba(255,255,255,1)"],
    [0.25, "rgba(228,238,255,0.55)"],
    [0.55, "rgba(170,198,255,0.16)"],
    [1, "rgba(120,160,255,0)"],
  ]);
  const inner = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: innerTex,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  inner.scale.setScalar(26);
  inner.renderOrder = -1;
  group.add(inner);

  // 核球：沿银盘方向铺开的柔光
  const bulgeTex = makeSoftGlowTexture([
    [0, "rgba(214,230,255,0.5)"],
    [0.4, "rgba(150,182,255,0.16)"],
    [1, "rgba(90,120,215,0)"],
  ]);
  const bulge = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: bulgeTex,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      depthTest: false,
    })
  );
  bulge.scale.set(230, 78, 1);
  bulge.position.set(0, 0, 0);
  bulge.renderOrder = -2;
  group.add(bulge);

  return group;
}

function createBackgroundStars() {
  const rnd = seededRandom(424242);
  const group = new THREE.Group();

  // —— 远景星壳：包裹整个场景，旋转时产生宇宙纵深 ——
  const shell = [];
  const N1 = 5600;
  for (let i = 0; i < N1; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = 760 + rnd() * 560;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const tint = rnd();
    let color = "#ffffff";
    if (tint > 0.92) color = "#ffd9a8";
    else if (tint > 0.76) color = "#cfe0ff";
    else if (tint > 0.63) color = "#e6d6ff";
    shell.push({
      position: [Math.cos(th) * s * r, u * r * 0.9, Math.sin(th) * s * r],
      color,
      size: 1.5 + rnd() * 3.0,
      spike: rnd() > 0.988 ? 0.55 : 0,
    });
  }
  const shellLayer = new StarLayer(shell, { opacity: 1, twinkle: 0.10 });
  group.add(shellLayer.object);
  bgLayers.push(shellLayer);

  // —— 银盘星尘：沿知识点旋臂的角度分布，塑造银河主体 ——
  // 注意：这里用的螺线系数（0.038r）比知识点旋臂（0.006r）紧得多，
  // 是**有意为之**的人工银盘盘面 —— 星尘铺出连续的盘，知识点在其上形成分段旋臂。
  // 两者共享同一组 armAngles（因此旋臂朝向始终对齐），但螺距不同。
  const dust = [];
  const N2 = 11000;
  const arms = armAngles.length ? armAngles : [0, Math.PI];
  for (let i = 0; i < N2; i++) {
    const arm = arms[Math.floor(rnd() * arms.length)];
    const t = Math.pow(rnd(), 0.85);
    const r = 16 + t * 165;
    // 与知识点旋臂同一条螺线：angle = arm + 0.038r - 0.93
    const spiral = 0.038 * r - 0.93;
    const jitter = (rnd() - 0.5) * (0.55 - 0.34 * t);
    const angle = arm + spiral + jitter;

    const wob = 3.5 + r * 0.07;
    const tint = rnd();
    let color = "#9fb4ff";
    if (tint > 0.9) color = "#ffd9b0";
    else if (tint > 0.68) color = "#cfe0ff";
    else if (tint > 0.42) color = "#b9a8ff";
    dust.push({
      position: [
        Math.cos(angle) * r + (rnd() - 0.5) * wob,
        (rnd() - 0.5) * (5 + r * 0.03),
        Math.sin(angle) * r + (rnd() - 0.5) * wob,
      ],
      color,
      size: 1.0 + rnd() * 1.9,
      spike: 0,
    });
  }
  const dustLayer = new StarLayer(dust, { opacity: 0.6, twinkle: 0.16 });
  group.add(dustLayer.object);
  bgLayers.push(dustLayer);

  // —— 星系晕：弥散的稀疏微光，让星系外缘自然消散 ——
  const halo = [];
  const N3 = 2400;
  for (let i = 0; i < N3; i++) {
    const th = rnd() * Math.PI * 2;
    const r = 120 + Math.pow(rnd(), 0.8) * 340;
    halo.push({
      position: [
        Math.cos(th) * r,
        (rnd() - 0.5) * 40 * (1 - r / 460),
        Math.sin(th) * r,
      ],
      color: rnd() > 0.5 ? "#8fa8e8" : "#b9a8ff",
      size: 1.0 + rnd() * 1.6,
      spike: 0,
    });
  }
  const haloLayer = new StarLayer(halo, { opacity: 0.42, twinkle: 0.12 });
  group.add(haloLayer.object);
  bgLayers.push(haloLayer);

  // —— 深空微尘星：散落在整片暗区的闪烁小星，让黑夜不空 ——
  const motes = [];
  const N4 = 700;
  for (let i = 0; i < N4; i++) {
    const u = rnd() * 2 - 1;
    const th = rnd() * Math.PI * 2;
    const r = 180 + Math.pow(rnd(), 0.7) * 540;
    const s = Math.sqrt(Math.max(0, 1 - u * u));
    const tint = rnd();
    let color = "#e8eeff";
    if (tint > 0.9) color = "#ffd9a8";
    else if (tint > 0.78) color = "#cfe0ff";
    else if (tint > 0.64) color = "#d9c6ff";
    motes.push({
      position: [Math.cos(th) * s * r, u * r * 0.85, Math.sin(th) * s * r],
      color,
      size: 1.2 + rnd() * 2.0,
      spike: rnd() > 0.975 ? 0.5 : 0,
    });
  }
  const motesLayer = new StarLayer(motes, { opacity: 0.6, twinkle: 0.28 });
  group.add(motesLayer.object);
  bgLayers.push(motesLayer);

  return group;
}

/* ============================================================
   6. 知识点之间的连线（合并为一次绘制）
   ============================================================ */
function buildLinks() {
  const positions = [];
  const colors = [];
  linkMeta = [];
  const done = new Set();
  const cA = new THREE.Color();
  const cB = new THREE.Color();
  const SEG = 18;

  DATA.nodes.forEach((node) => {
    (node.links || []).forEach((tid) => {
      const key = node.id < tid ? node.id + "|" + tid : tid + "|" + node.id;
      if (done.has(key)) return;
      done.add(key);

      const target = nodeById.get(tid);
      if (!target) return;

      const a = node.position;
      const b = target.position;
      const mx = (a.x + b.x) / 2;
      const my = (a.y + b.y) / 2 + 3.5;
      const mz = (a.z + b.z) / 2;

      const startVert = positions.length / 3;
      let px = null;
      let py = null;
      let pz = null;

      for (let s = 0; s <= SEG; s++) {
        const t = s / SEG;
        const it = 1 - t;
        const x = it * it * a.x + 2 * it * t * mx + t * t * b.x;
        const y = it * it * a.y + 2 * it * t * my + t * t * b.y;
        const z = it * it * a.z + 2 * it * t * mz + t * t * b.z;
        if (px !== null) positions.push(px, py, pz, x, y, z);
        px = x;
        py = y;
        pz = z;
      }

      const vertCount = positions.length / 3 - startVert;
      cA.set(DATA.branches[node.branch].color);
      cB.set(DATA.branches[target.branch].color);

      for (let v = 0; v < vertCount; v++) {
        const t = vertCount > 1 ? v / (vertCount - 1) : 0;
        // 中段稍亮，两端收敛，连线看起来像能量流
        const shape = 0.45 + 0.55 * Math.sin(Math.PI * t);
        const c = cA.clone().lerp(cB, t);
        colors.push(c.r * shape, c.g * shape, c.b * shape);
      }

      linkMeta.push({
        start: startVert,
        count: vertCount,
        a: node.branch,
        b: target.branch,
        na: node.id,
        nb: tid,
      });
    });
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  linkBaseColors = new Float32Array(colors);

  const mat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0.22,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: true,
  });

  linksObject = new THREE.LineSegments(geo, mat);
  linksObject.renderOrder = 1;
  return linksObject;
}

/** 连线着色：分支筛选 + 悬停/选中时的「脉络高亮」（成本极低） */
function updateLinkColors() {
  if (!linksObject) return;
  const attr = linksObject.geometry.getAttribute("color");
  const arr = attr.array;
  const DIM = 0.05;

  // 悬停或选中的节点优先：它连出去的脉络点亮，其余压暗
  let focusId = null;
  if (hoveredIndex >= 0) focusId = DATA.nodes[hoveredIndex].id;
  else if (selectedIndex >= 0) focusId = DATA.nodes[selectedIndex].id;

  linkMeta.forEach((m) => {
    let k;
    if (focusId) {
      k = m.na === focusId || m.nb === focusId ? 1.45 : 0.06;
    } else {
      const on = !activeBranch || m.a === activeBranch || m.b === activeBranch;
      k = on ? 1 : DIM;
    }
    for (let v = 0; v < m.count; v++) {
      const i = (m.start + v) * 3;
      arr[i] = linkBaseColors[i] * k;
      arr[i + 1] = linkBaseColors[i + 1] * k;
      arr[i + 2] = linkBaseColors[i + 2] * k;
    }
  });
  attr.needsUpdate = true;
}

/* ============================================================
   7. 知识点星体
   ============================================================ */
function createKnowledgeStars() {
  const items = DATA.nodes.map((n) => ({
    position: [n.position.x, n.position.y, n.position.z],
    color: DATA.branches[n.branch].color,
    size: 7 + n.level * 2.8,
    spike: n.level >= 4 ? 0.95 : n.level === 3 ? 0.55 : n.level === 2 ? 0.22 : 0,
  }));

  starLayer = new StarLayer(items, { opacity: 1, twinkle: 0.22, reveal: true });
  dataIndexOf = new Map(DATA.nodes.map((n, i) => [n.id, i]));
  return starLayer.object;
}

function refreshHighlights() {
  if (!starLayer) return;
  const values = new Float32Array(starLayer.count);
  if (selectedIndex >= 0) values[selectedIndex] = 0.9;
  if (hoveredIndex >= 0) values[hoveredIndex] = Math.max(values[hoveredIndex], 1.6);
  if (pulseT0) {
    const age = (performance.now() - pulseT0) / 1000;
    if (age > 1.8) {
      pulseT0 = 0;
      pulseIdx = [];
    } else {
      const k = (1 - age / 1.8) * Math.abs(Math.sin(age * Math.PI * 3)) * 1.4;
      for (const i of pulseIdx) values[i] = Math.max(values[i], k);
    }
  }
  starLayer.setHighlightArray(values);
  updateLinkColors(); // 悬停时的「脉络高亮」
}

/* ============================================================
   8. 射线拾取（点击 / 悬停）
   ============================================================ */
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const tooltip = document.createElement("div");
tooltip.id = "tooltip";
document.body.appendChild(tooltip);

function updatePointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function pick() {
  if (!starLayer) return -1;
  // 拾取半径随视距自适应
  const dist = camera.position.distanceTo(controls.target);
  raycaster.params.Points.threshold = Math.max(1.8, dist * 0.02);
  raycaster.setFromCamera(pointer, camera);
  const hits = raycaster.intersectObject(starLayer.object, false);
  return hits.length ? hits[0].index : -1;
}

canvas.addEventListener("pointermove", (e) => {
  updatePointer(e);
  const idx = pick();
  if (idx !== hoveredIndex) {
    hoveredIndex = idx;
    refreshHighlights();
    canvas.style.cursor = idx >= 0 ? "pointer" : "grab";
  }
  if (idx >= 0) {
    const n = DATA.nodes[idx];
    tooltip.textContent =
      currentLang === "en" && n.titleEn ? n.titleEn : n.title;
    tooltip.style.left = e.clientX + 16 + "px";
    tooltip.style.top = e.clientY + 16 + "px";
    tooltip.style.opacity = "1";
  } else {
    tooltip.style.opacity = "0";
  }
});

let pointerDownPos = null;
canvas.addEventListener("pointerdown", (e) => {
  pointerDownPos = { x: e.clientX, y: e.clientY };
});

canvas.addEventListener("pointerup", (e) => {
  if (!pointerDownPos) return;
  const moved = Math.hypot(
    e.clientX - pointerDownPos.x,
    e.clientY - pointerDownPos.y
  );
  pointerDownPos = null;
  if (moved > 6) return; // 视为拖动，不触发点击

  updatePointer(e);
  const idx = pick();
  if (idx >= 0) openPanel(DATA.nodes[idx].id);
});

/* ============================================================
   9. 详情面板
   ============================================================ */
const panel = document.getElementById("panel");
const panelBranch = document.getElementById("panel-branch");
const panelTitle = document.getElementById("panel-title");
const panelSummary = document.getElementById("panel-summary");
const panelContent = document.getElementById("panel-content");
const panelLinks = document.getElementById("panel-links");
const panelLevel = document.getElementById("panel-level");
const panelBack = document.getElementById("panel-back");

document.getElementById("panel-close").addEventListener("click", closePanel);

document.getElementById("panel-back").addEventListener("click", () => {
  const prev = panelHistory.pop();
  if (prev) openPanel(prev, true);
});

document.getElementById("lang-toggle").addEventListener("click", () => {
  currentLang = currentLang === "zh" ? "en" : "zh";
  document.getElementById("lang-toggle").textContent =
    currentLang === "zh" ? "EN" : "中文";
  if (currentNode) openPanel(currentNode.id);
});

// 公式卡片：一键复制 LaTeX
panelContent.addEventListener("click", (e) => {
  const btn = e.target.closest(".copy-tex");
  if (!btn) return;
  const tex = btn.getAttribute("data-tex") || "";
  const done = () => {
    btn.textContent = "✓ 已复制";
    btn.classList.add("copied");
    setTimeout(() => {
      btn.textContent = "复制";
      btn.classList.remove("copied");
    }, 1100);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(tex).then(done, () => {});
  }
});

/* 深链接：URL hash 与面板同步（#节点id，可直接分享） */
function setUrlHash(id) {
  try {
    history.replaceState(null, "", id ? "#" + encodeURIComponent(id) : location.pathname + location.search);
  } catch (e) {}
}

document.getElementById("panel-share").addEventListener("click", () => {
  if (!currentNode) return;
  const btn = document.getElementById("panel-share");
  const url = location.origin + location.pathname + "#" + encodeURIComponent(currentNode.id);
  const done = () => {
    btn.textContent = "✓";
    setTimeout(() => (btn.textContent = "🔗"), 1100);
  };
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(url).then(done, done);
  } else {
    done();
  }
});

/* 旋臂名称漂浮标签 */
function buildArmLabels() {
  const wrap = document.createElement("div");
  wrap.id = "arm-labels";
  document.body.appendChild(wrap);
  const outer = new Map();
  for (const n of DATA.nodes) {
    const len2 = n.position.x * n.position.x + n.position.y * n.position.y + n.position.z * n.position.z;
    const cur = outer.get(n.branch);
    if (!cur || len2 > cur.len2) outer.set(n.branch, { n, len2 });
  }
  armLabels = [];
  for (const [b, { n }] of outer) {
    const info = DATA.branches[b];
    const v = new THREE.Vector3(n.position.x, n.position.y, n.position.z);
    const pos = v.clone().normalize().multiplyScalar(v.length() + 13);
    const el = document.createElement("div");
    el.className = "arm-label";
    el.innerHTML = '<span class="dot" style="background:' + info.color + ';box-shadow:0 0 8px ' + info.color + '"></span>' + info.name;
    wrap.appendChild(el);
    armLabels.push({ el, pos, branch: b });
  }
}

const _armProjV = new THREE.Vector3();
function updateArmLabels() {
  if (!armLabels.length) return;
  const w = window.innerWidth, h = window.innerHeight;
  for (const L of armLabels) {
    if (activeBranch && L.branch !== activeBranch) { L.el.style.opacity = 0; continue; }
    _armProjV.copy(L.pos).project(camera);
    const x = ((_armProjV.x + 1) / 2) * w;
    const y = ((1 - _armProjV.y) / 2) * h;
    if (_armProjV.z > 1 || x < -80 || x > w + 80 || y < -40 || y > h + 40) { L.el.style.opacity = 0; continue; }
    L.el.style.opacity = 0.85;
    L.el.style.transform = "translate(-50%,-50%) translate(" + x + "px, " + y + "px)";
  }
}

/* ============================================================
   9.6 学习路线（v=25）
   ============================================================ */
let pathsData = null;
let pathState = null; // {title, nodes, index}

async function openPathsMenu() {
  const menu = document.getElementById("paths-menu");
  const willShow = menu.classList.contains("hidden");
  menu.classList.toggle("hidden");
  if (!willShow) return;
  if (!pathsData) {
    try {
      const res = await fetch("data/paths.json", { cache: "no-cache" });
      pathsData = await res.json();
    } catch (e) {
      return;
    }
    const list = document.getElementById("paths-list");
    list.innerHTML = "";
    for (const p of pathsData.paths) {
      const div = document.createElement("div");
      div.className = "path-item";
      div.innerHTML =
        '<div class="path-title">' + p.title + "</div>" +
        '<div class="path-desc">' + p.desc + " · " + p.nodes.length + " 步</div>";
      div.addEventListener("click", () => {
        menu.classList.add("hidden");
        enterPath(p);
      });
      list.appendChild(div);
    }
  }
}

function enterPath(path) {
  pathState = { title: path.title, nodes: path.nodes.slice(), index: 0 };
  // 清掉分支筛选，避免与路线高亮冲突
  activeBranch = null;
  document.querySelectorAll("#legend li").forEach((el) => el.classList.remove("dimmed"));
  const inPath = new Set(path.nodes);
  DATA.nodes.forEach((n, i) => {
    starLayer.setAlphaTarget(i, inPath.has(n.id) ? 1 : 0.06);
  });
  updateLinkColors();
  updateArmSpine();
  openPanel(path.nodes[0]);
  updatePathHUD();
}

function exitPath() {
  pathState = null;
  DATA.nodes.forEach((n, i) => starLayer.setAlphaTarget(i, 1));
  updateLinkColors();
  updateArmSpine();
  document.getElementById("path-hud").classList.add("hidden");
}

function updatePathHUD() {
  const hud = document.getElementById("path-hud");
  if (!pathState) {
    hud.classList.add("hidden");
    return;
  }
  hud.classList.remove("hidden");
  document.getElementById("path-hud-title").textContent = pathState.title;
  document.getElementById("path-hud-step").textContent =
    pathState.index + 1 + " / " + pathState.nodes.length;
  document.getElementById("path-prev").disabled = pathState.index === 0;
  document.getElementById("path-next").textContent =
    pathState.index === pathState.nodes.length - 1 ? "完成 ✓" : "下一步 →";
}

function stepPath(delta) {
  if (!pathState) return;
  const next = pathState.index + delta;
  if (next < 0) return;
  if (next >= pathState.nodes.length) {
    exitPath();
    return;
  }
  pathState.index = next;
  openPanel(pathState.nodes[next]);
  updatePathHUD();
}

document.getElementById("paths-btn").addEventListener("click", (e) => {
  e.stopPropagation();
  openPathsMenu();
});
document.getElementById("path-prev").addEventListener("click", () => stepPath(-1));
document.getElementById("path-next").addEventListener("click", () => stepPath(1));
document.getElementById("path-exit").addEventListener("click", exitPath);
document.addEventListener("click", (e) => {
  if (!e.target.closest("#paths-menu") && !e.target.closest("#paths-btn")) {
    document.getElementById("paths-menu").classList.add("hidden");
  }
});

function closePanel() {
  panel.classList.add("hidden");
  setUrlHash(null);
  currentNode = null;
  selectedIndex = -1;
  panelHistory = [];
  refreshHighlights();
}

function openPanel(id, fromBack = false) {
  const node = nodeById.get(id);
  if (!node) return;
  // 浏览历史：同节点重开不入栈；从「返回」进来也不入栈
  if (!fromBack && currentNode && currentNode.id !== id) {
    panelHistory.push(currentNode.id);
    if (panelHistory.length > 30) panelHistory.shift();
  }
  currentNode = node;
  setUrlHash(id);
  selectedIndex = dataIndexOf.has(id) ? dataIndexOf.get(id) : -1;
  refreshHighlights();

  const branch = DATA.branches[node.branch];
  const useEn = currentLang === "en";
  panelBranch.textContent = useEn && branch.nameEn ? branch.nameEn : branch.name;
  panelBranch.style.color = branch.color;
  panelLevel.textContent =
    "L" + node.level + " " + "★".repeat(node.level) + "☆".repeat(5 - node.level);
  panelBack.style.display = panelHistory.length ? "" : "none";

  panelTitle.innerHTML =
    node.title +
    (node.titleEn ? `<span class="title-en">${node.titleEn}</span>` : "");
  panelSummary.textContent = useEn
    ? node.summaryEn || node.summary || ""
    : node.summary || "";

  panelContent.innerHTML = buildPanelHTML(node, useEn, node.details || null);

  // 详情按需加载：先显示骨架（标题/摘要/配图），拿到分片后补齐正文
  if (!node.details) {
    loadNodeDetails(node)
      .then((details) => {
        if (!details || currentNode !== node) return;
        panelContent.innerHTML = buildPanelHTML(node, useEn, details);
        renderMath();
        renderNodePlots(node);
      })
      .catch(() => {
        if (currentNode !== node) return;
        const ph = panelContent.querySelector(".details-loading");
        if (ph) {
          ph.textContent = useEn
            ? "Failed to load content — check your network and tap the topic again."
            : "内容加载失败——请检查网络后重新点击该知识点。";
        }
      });
  }

  // 关联知识点
  panelLinks.innerHTML = "";
  const linkIds = node.links || [];
  const valid = linkIds.filter((lid) => nodeById.has(lid));
  if (valid.length) {
    const title = document.createElement("div");
    title.className = "links-title";
    title.textContent = useEn ? "Related topics" : "关联知识点";
    panelLinks.appendChild(title);

    valid.forEach((lid) => {
      const ln = nodeById.get(lid);
      const chip = document.createElement("span");
      chip.className = "link-chip";
      chip.innerHTML = `<span class="dot" style="background:${
        DATA.branches[ln.branch].color
      }"></span>${ln.title}`;
      chip.addEventListener("click", () => {
        openPanel(lid);
        flyTo(lid);
      });
      panelLinks.appendChild(chip);
    });
  }

  panel.classList.remove("hidden");
  renderMath();
  renderNodePlots(node);
  flyTo(id);
}

/* 组装面板 HTML：定义 / 公式 / 表达式 / 性质 / 例题
   details 为 null 时表示分片尚未就绪：先给「加载中」占位（配图不依赖分片，照常渲染） */
function buildPanelHTML(node, useEn, details) {
  const parts = [];

  if (!details) {
    parts.push(
      section(
        useEn ? "Content" : "内容",
        `<span class="details-loading">${useEn ? "Loading…" : "正在加载内容…"}</span>`
      )
    );
    if (node.plot) {
      parts.push(`<div class="plot-wrap" id="plot-wrap-${node.id}"></div>`);
    }
    return parts.join("");
  }

  const def = useEn ? details.definitionEn || details.definition : details.definition;
  if (def) {
    parts.push(section(useEn ? "Definition" : "定义", mdToHTML(def)));
  }

  if (details.formulas && details.formulas.length) {
    const items = details.formulas
      .map(
        (f) =>
          `<div class="formula-item"><button type="button" class="copy-tex" data-tex="${escapeHTML(
            f.latex
          ).replace(/"/g, "&quot;")}">复制</button><div class="formula-latex">$$${f.latex}$$</div>${
            (useEn ? f.noteEn || f.note : f.note)
              ? `<div class="formula-note">${useEn ? f.noteEn || f.note : f.note}</div>`
              : ""
          }</div>`
      )
      .join("");
    parts.push(section(useEn ? "Key Formulas" : "核心公式", items));
  }

  if (details.expression) {
    const e = details.expression;
    parts.push(
      section(
        useEn ? "Expression" : "表达式",
        `<div class="expr-box"><code>${escapeHTML(e.text || "")}</code>${
          e.symbol ? `<span class="expr-symbol">${escapeHTML(e.symbol)}</span>` : ""
        }</div>${
          (useEn ? e.noteEn || e.note : e.note)
            ? `<div class="formula-note">${escapeHTML(useEn ? e.noteEn || e.note : e.note)}</div>`
            : ""
        }`
      )
    );
  }

  if (node.plot) {
    parts.push(`<div class="plot-wrap" id="plot-wrap-${node.id}"></div>`);
  }

  const props = useEn ? details.propertiesEn || details.properties : details.properties;
  if (props && props.length) {
    const items = props.map((p) => `<li>${mdToHTML(p)}</li>`).join("");
    parts.push(section(useEn ? "Properties" : "性质", `<ul class="prop-list">${items}</ul>`));
  }

  if (details.examples && details.examples.length) {
    const items = details.examples
      .map(
        (ex, i) =>
          `<div class="example"><div class="example-q"><b>${
            useEn ? "Example" : "例"
          } ${i + 1}.</b> ${mdToHTML(ex.problem || "")}</div><details class="example-sol"><summary>${
            useEn ? "Show solution" : "看解答"
          }</summary><div class="sol-body">${
            useEn ? "Solution" : "解"
          }：${mdToHTML(ex.solution || "")}</div></details></div>`
      )
      .join("");
    parts.push(section(useEn ? "Examples" : "例题", items));
  }

  return parts.join("");
}

function section(title, body) {
  return `<div class="panel-section"><div class="section-title">${title}</div>${body}</div>`;
}

function renderNodePlots(node) {
  const wrap = document.getElementById(`plot-wrap-${node.id}`);
  if (wrap) {
    wrap.innerHTML = "";
    renderPlot(node.plot, wrap);
  }
}

function escapeHTML(s) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

// 极简 Markdown：**粗体**、`代码`、换行
function mdToHTML(text) {
  let html = escapeHTML(text);
  html = html.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  html = html.replace(/`(.+?)`/g, "<code>$1</code>");
  return html;
}

function renderMath() {
  if (window.renderMathInElement) {
    window.renderMathInElement(panelContent, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}

/* ============================================================
   10. 相机飞行
   —— 基于时间的缓动，保证一定会结束，不会锁死视角
   ============================================================ */
function flyTo(id) {
  const node = nodeById.get(id);
  if (!node) return;

  const pos = new THREE.Vector3(node.position.x, node.position.y, node.position.z);
  const dir = pos.clone().normalize();
  const offset = dir.multiplyScalar(26).add(new THREE.Vector3(0, 12, 0));

  // 落点必须落在可缩放范围内，否则会被 OrbitControls 推回去
  const minLen = controls.minDistance * 1.25;
  const maxLen = controls.maxDistance * 0.8;
  const len = offset.length();
  if (len < minLen) offset.setLength(minLen);
  else if (len > maxLen) offset.setLength(maxLen);

  fly = {
    fromPos: camera.position.clone(),
    toPos: pos.clone().add(offset),
    fromTarget: controls.target.clone(),
    toTarget: pos.clone(),
    start: performance.now(),
    duration: 900,
  };
  controls.autoRotate = false;
}

function updateFly() {
  if (!fly) {
    if (!controls.autoRotate && performance.now() > resumeAutoRotateAt) {
      controls.autoRotate = true;
    }
    return;
  }

  const t = Math.min(1, (performance.now() - fly.start) / fly.duration);
  // easeInOutCubic
  const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

  camera.position.lerpVectors(fly.fromPos, fly.toPos, e);
  controls.target.lerpVectors(fly.fromTarget, fly.toTarget, e);

  if (t >= 1) {
    fly = null;
    resumeAutoRotateAt = performance.now() + 2800;
  }
}

/* ============================================================
   11. 图例 + 搜索
   ============================================================ */
/* 分支的“难易程度”排序（小学 → 初中 → 高中 → 大学 → 研究生）。
   仅用于左下角「知识分支」图例列表；银河旋臂的分配顺序仍按 data.branches 的键顺序。
   未来新增分支时，把它的 id 插到这个数组的合适位置。 */
const BRANCH_DIFFICULTY_ORDER = [
  "elementary-basics", "elementary", "plane-geometry", "algebra", "set-logic", "mathematical-logic",
  "function", "trigonometry", "sequence", "analytic", "solid-geometry",
  "combinatorics", "graph-theory", "probability", "statistics", "calculus", "linear", "multivariable",
  "complex", "ode", "pde", "numerical", "optimization-or", "real-analysis", "functional-analysis",
  "dynamical-systems", "special-functions", "differential-geometry", "vector", "number", "abstract-algebra",
  "topology", "complex-analysis",
  "stochastic", "riemannian", "harmonic-analysis", "pde-advanced", "math-history",
];
const branchRank = (key) => {
  const i = BRANCH_DIFFICULTY_ORDER.indexOf(key);
  return i === -1 ? BRANCH_DIFFICULTY_ORDER.length : i;
};

function buildLegend() {
  const list = document.getElementById("legend-list");
  // 只显示已有知识点的分支，避免点了没有内容
  const populated = new Set(DATA.nodes.map((n) => n.branch));

  Object.entries(DATA.branches)
    .filter(([key]) => populated.has(key))
    .sort((a, b) => branchRank(a[0]) - branchRank(b[0]))
    .forEach(([key, b]) => {
      const count = DATA.nodes.filter((n) => n.branch === key).length;
      const li = document.createElement("li");
      li.innerHTML =
        `<span class="dot" style="background:${b.color};box-shadow:0 0 10px ${b.color}"></span>` +
        `<span class="legend-name">${b.name}</span>` +
        `<span class="legend-count">${count}</span>`;
      li.addEventListener("click", () => toggleBranch(key, li));
      list.appendChild(li);
    });
}

/* 知识分支面板的收放 */
function setupLegendToggle() {
  const legend = document.getElementById("legend");
  const toggle = document.getElementById("legend-toggle");
  if (!legend || !toggle) return;

  toggle.addEventListener("click", () => {
    const collapsed = legend.classList.toggle("collapsed");
    toggle.setAttribute("aria-expanded", String(!collapsed));
  });
}

function toggleBranch(key, li) {
  if (activeBranch === key) {
    activeBranch = null;
    document
      .querySelectorAll("#legend li")
      .forEach((el) => el.classList.remove("dimmed"));
  } else {
    activeBranch = key;
    document.querySelectorAll("#legend li").forEach((el) => {
      el.classList.toggle("dimmed", el !== li);
    });
  }
  applyBranchFilter();
}

function applyBranchFilter() {
  DATA.nodes.forEach((n, i) => {
    const visible = !activeBranch || n.branch === activeBranch;
    // 被筛掉的分支降低亮度而不是直接消失，保留银河整体轮廓
    starLayer.setAlphaTarget(i, visible ? 1 : 0.055);
  });
  updateLinkColors();
  updateArmSpine();
}

/* 分支筛选时，给该旋臂描一条发光的「骨架线」 */
function updateArmSpine() {
  if (armSpine) {
    scene.remove(armSpine);
    armSpine.geometry.dispose();
    armSpine.material.dispose();
    armSpine = null;
  }
  if (!activeBranch) return;
  const pts = DATA.nodes
    .filter((n) => n.branch === activeBranch)
    .map((n) => new THREE.Vector3(n.position.x, n.position.y, n.position.z))
    .sort((a, b) => a.length() - b.length());
  if (pts.length < 2) return;
  const curve = new THREE.CatmullRomCurve3(pts);
  const geo = new THREE.BufferGeometry().setFromPoints(
    curve.getPoints(Math.min(160, pts.length * 24))
  );
  const mat = new THREE.LineBasicMaterial({
    color: DATA.branches[activeBranch].color,
    transparent: true,
    opacity: 0.5,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  armSpine = new THREE.Line(geo, mat);
  armSpine.renderOrder = 3;
  scene.add(armSpine);
}

function buildSearch() {
  const input = document.getElementById("search");
  const box = document.getElementById("search-results");
  let hits = [];
  let sel = -1;

  const paintSel = () => {
    [...box.children].forEach((el, i) => el.classList.toggle("sel", i === sel));
    if (sel >= 0 && box.children[sel]) {
      box.children[sel].scrollIntoView({ block: "nearest" });
    }
  };

  const openHit = (n) => {
    box.classList.add("hidden");
    input.value = "";
    hits = [];
    sel = -1;
    const i = dataIndexOf.get(n.id);
    if (i !== undefined) starLayer.setAlphaTarget(i, 1);
    openPanel(n.id);
  };

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    if (!q) {
      box.classList.add("hidden");
      hits = [];
      sel = -1;
      return;
    }

    const scored = [];
    DATA.nodes.forEach((n) => {
      const title = n.title.toLowerCase();
      const titleEn = (n.titleEn || "").toLowerCase();
      const summary = (n.summary || "").toLowerCase();
      const tags = (n.tags || []).join(" ").toLowerCase();
      let score = 0;
      if (title === q || titleEn === q) score = 100;
      else if (title.startsWith(q)) score = 80;
      else if (title.includes(q)) score = 60;
      else if (titleEn.includes(q)) score = 45;
      else if (tags.includes(q)) score = 30;
      else if (summary.includes(q)) score = 20;
      if (score > 0) scored.push({ n, score });
    });
    scored.sort((a, b) => b.score - a.score || a.n.level - b.n.level);
    hits = scored.map((s) => s.n);
    pulseIdx = hits.slice(0, 12).map((n) => dataIndexOf.get(n.id)).filter((i) => i !== undefined);
    pulseT0 = performance.now();

    box.innerHTML = "";
    if (!hits.length) {
      box.innerHTML = '<div class="empty">没有找到相关知识点</div>';
      sel = -1;
    } else {
      hits.forEach((n) => {
        const div = document.createElement("div");
        div.className = "item";
        div.innerHTML =
          `<span class="dot" style="background:${
            DATA.branches[n.branch].color
          }"></span>` +
          `<span class="item-text"><span class="item-title">${n.title}</span>` +
          (n.summary ? `<span class="item-sub">${n.summary}</span>` : "") +
          `</span>`;
        div.addEventListener("click", () => openHit(n));
        box.appendChild(div);
      });
      sel = 0;
    }
    box.classList.remove("hidden");
    paintSel();
  });

  // 键盘操作：↑↓ 选择、回车打开、Esc 关闭
  input.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      box.classList.add("hidden");
      input.blur();
      return;
    }
    if (box.classList.contains("hidden") || !hits.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      sel = (sel + 1) % hits.length;
      paintSel();
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      sel = (sel - 1 + hits.length) % hits.length;
      paintSel();
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (sel >= 0 && hits[sel]) openHit(hits[sel]);
    }
  });

  document.addEventListener("click", (e) => {
    if (!e.target.closest("#search-wrap")) box.classList.add("hidden");
  });
}

/* ============================================================
   12. 动画循环
   ============================================================ */
const clock = new THREE.Clock();
let elapsed = 0;

function monitorPerf(dt) {
  if (dt <= 0) return;
  quality.samples.push(dt);
  if (quality.samples.length > 120) quality.samples.shift();

  const now = performance.now();
  if (now - quality.lastCheck < 2500) return;
  if (quality.samples.length < 60) return;
  quality.lastCheck = now;

  const avg = quality.samples.reduce((a, b) => a + b, 0) / quality.samples.length;
  const fps = 1000 / avg;
  quality.samples.length = 0;

  // 帧率偏低时自动降低渲染分辨率，最多降两级
  if (fps < 45 && quality.pr > quality.min + 0.05 && quality.steps < 2) {
    quality.pr = Math.max(quality.min, quality.pr - 0.5);
    quality.steps++;
    applySize();
    console.info(
      `[银河] 检测到帧率偏低（${fps.toFixed(0)}fps），渲染分辨率降至 ${quality.pr}x`
    );
  }
}

function animate() {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, clock.getDelta());
  elapsed += dt;

  updateFly();
  controls.update();

  // 连线入场淡入
  if (linksRevealStart && linksObject) {
    const lt = Math.min(1, (performance.now() - linksRevealStart) / 1500);
    linksObject.material.opacity = 0.22 * (1 - Math.pow(1 - lt, 3));
    if (lt >= 1) linksRevealStart = 0;
  }

  if (starLayer) starLayer.update(elapsed, dt);
  if (pulseT0) refreshHighlights(); // 搜索脉冲期间逐帧刷新高亮
  updateArmLabels();
  for (let i = 0; i < bgLayers.length; i++) bgLayers[i].update(elapsed, dt);

  renderer.render(scene, camera);
  monitorPerf(dt);
}

/* ============================================================
   13. 窗口尺寸
   ============================================================ */
let resizeTimer = null;
window.addEventListener("resize", () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(applySize, 80);
});

/* ============================================================
   14. 启动
   ============================================================ */
async function main() {
  await loadData();
  computePositions();

  scene.add(createNebulae());
  scene.add(createCore());
  scene.add(createBackgroundStars());
  scene.add(buildLinks());
  scene.add(createKnowledgeStars());

  // 入场：连线随星星从暗到亮
  linksObject.material.opacity = 0;
  linksRevealStart = performance.now();

  // 顶栏副标题：动态统计
  const populatedBranches = new Set(DATA.nodes.map((n) => n.branch)).size;
  const subtitle = document.querySelector("#topbar .subtitle");
  if (subtitle) {
    subtitle.textContent = `${DATA.nodes.length} 个知识点 · ${populatedBranches} 条分支 ｜ 点击任意光点，展开一个知识点`;
  }

  buildLegend();
  buildArmLabels();
  setupLegendToggle();
  buildSearch();

  // 随机漫游：跳到一颗随机星星
  document.getElementById("roam-btn").addEventListener("click", () => {
    const n = DATA.nodes[Math.floor(Math.random() * DATA.nodes.length)];
    openPanel(n.id);
  });

  // 深链接：#节点id 直接打开对应知识点（可分享）
  const openFromHash = () => {
    const raw = decodeURIComponent((location.hash || "").slice(1));
    if (raw && nodeById.has(raw) && (!currentNode || currentNode.id !== raw)) openPanel(raw);
  };
  window.addEventListener("hashchange", openFromHash);
  if (location.hash) setTimeout(openFromHash, 350);

  // 调试钩子：便于查看渲染统计
  window.__galaxy = {
    renderer,
    scene,
    camera,
    controls,
    starLayer,
    bgLayers,
    getFly: () => fly,
  };

  const loading = document.getElementById("loading");
  loading.classList.add("hidden");
  setTimeout(() => (loading.style.display = "none"), 700);

  animate();
}

main();
