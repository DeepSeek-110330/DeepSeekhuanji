import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { renderPlot } from "./plot.js?v=36";
import { StarLayer, makeNebulaTexture, makeSoftGlowTexture } from "./stars.js?v=36";

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
let armLabelsOn = false; // 旋臂标签显示开关（默认收起：38 条标签同时出现会显得拥挤）
let pulseIdx = []; // 搜索结果脉冲高亮的下标
let pulseT0 = 0;   // 脉冲起始时刻

/* 知识共鸣：让有链接关系的知识点产生可控的「碰撞—融合」交互 */
const REDUCE_MOTION = window.matchMedia
  ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
  : false;
let resonanceMode = false;
let resonanceA = -1;           // 第一颗星的节点下标
let resonancePath = [];        // 两颗星之间的最短知识链
let resonancePathIds = new Set();
let resonancePathKeys = new Set();
let resonanceAnim = null;      // 飞行/碰撞动画状态
let resonanceGlow = new Map(); // 节点 id -> 临时高亮
let resonanceMarkers = null;   // { a, b } 两枚选中光环
let resonanceGhosts = null;    // { a, b } 碰撞用的星体投影
let resonanceTrails = null;    // { a, b } 两条汇聚能量弧
let resonanceRipple = null;    // 碰撞涟漪
let resonancePulses = [];      // 沿连线飞行的能量脉冲
let resonanceLinkIndex = new Map(); // "idA|idB" -> linkMeta 下标
let adjacency = new Map();     // 无向邻接表
let nextAmbientPulse = 0;
let lastHoverPulse = 0;
let resonanceToken = 0;        // 防止退出后旧动画回调继续弹结果
let resonanceAutoRotate = null; // 进入共鸣前的自转状态
let resonanceRenderToken = 0;   // 结果卡异步补充公式时的版本号
let resonancePathLayers = [];   // BFS 每一层发现的节点数（推导展示用）
let RESONANCE_NOTES = { pairs: {}, results: {} }; // 精选推导注记

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

/* 精选推导注记：只影响「知识共鸣」结果卡，不参与 knowledge.json 的合并 */
async function loadResonanceNotes() {
  try {
    const res = await fetch("data/resonance-notes.json", { cache: "no-cache" });
    if (!res.ok) return;
    const json = await res.json();
    RESONANCE_NOTES = {
      pairs: json.pairs || {},
      results: json.results || {},
    };
  } catch (err) {
    // 注记是可选增强；读取失败时退回纯结构推导
    RESONANCE_NOTES = { pairs: {}, results: {} };
  }
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
        key,
        pa: { x: a.x, y: a.y, z: a.z },
        pb: { x: b.x, y: b.y, z: b.z },
        pm: { x: mx, y: my, z: mz },
        ca: DATA.branches[node.branch].color,
        cb: DATA.branches[target.branch].color,
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
    if (resonancePathKeys.size && resonancePathKeys.has(m.key)) {
      // 共鸣链路：优先点亮整条知识链
      k = 2.1;
    } else if (resonanceMode && resonancePathKeys.size) {
      // 共鸣进行中，压暗无关连线，让画面保持干净
      k = 0.025;
    } else if (focusId) {
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
  const items = DATA.nodes.map((n, i) => {
    const seed = (i * 0.6180339887498949) % 1;
    const grade = n.level / 5;
    const spikes = n.level >= 5 ? 1.0 : n.level === 4 ? 0.55 : n.level === 3 ? 0.2 : n.level === 2 ? 0.06 : 0;
    return {
      position: [n.position.x, n.position.y, n.position.z],
      color: DATA.branches[n.branch].color,
      size: (7 + n.level * 2.8) * (0.9 + 0.25 * seed),
      spike: spikes,
      grade,
      seed,
      rot: seed * Math.PI * 2,
    };
  });

  starLayer = new StarLayer(items, {
    opacity: 1,
    twinkle: REDUCE_MOTION ? 0 : 0.22,
    reveal: true,
    drift: REDUCE_MOTION ? 0 : 1.4,
    driftSpeed: 0.14,
    rich: true,
    flash: !REDUCE_MOTION,
  });
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
  // 悬停 / 选中时，把直接相邻的知识点也轻微提亮：关系不再只靠线
  const focusIdx = hoveredIndex >= 0 ? hoveredIndex : selectedIndex;
  if (focusIdx >= 0 && adjacency.size) {
    const focusId = DATA.nodes[focusIdx].id;
    const neighbors = adjacency.get(focusId);
    if (neighbors) {
      const k = hoveredIndex >= 0 ? 0.45 : 0.32;
      for (const nid of neighbors) {
        const i = dataIndexOf.get(nid);
        if (i !== undefined) values[i] = Math.max(values[i], k);
      }
    }
  }
  // 共鸣链路：整条知识链轻微提亮；碰撞瞬间再额外闪一下
  for (const id of resonancePathIds) {
    const i = dataIndexOf.get(id);
    if (i !== undefined) values[i] = Math.max(values[i], 0.85);
  }
  for (const [idx, v] of resonanceGlow) {
    if (idx >= 0 && idx < values.length) values[idx] = Math.max(values[idx], v);
  }
  starLayer.setHighlightArray(values);
  updateLinkColors(); // 悬停时的「脉络高亮」
}

/* ============================================================
   7.5 知识共鸣（v=30）
   - 星体微动：在 stars.js 顶点着色器里做极慢、极小的三轴漂移
   - 能量脉冲：少量光点沿已有连线飞行，让网络「有呼吸」但不喧闹
   - 知识碰撞：任选两颗星 → 在链接图上求最短知识链 → 投影相撞 →
     把「桥点 / 共同关联」作为碰撞结果，而不是凭空生成新内容
   ============================================================ */

function linkKey(a, b) {
  return a < b ? a + "|" + b : b + "|" + a;
}

function makeRingTexture() {
  const size = 128;
  const cv = document.createElement("canvas");
  cv.width = cv.height = size;
  const ctx = cv.getContext("2d");
  ctx.translate(size / 2, size / 2);
  ctx.strokeStyle = "rgba(255,255,255,1)";
  ctx.shadowColor = "rgba(170,210,255,0.95)";
  ctx.shadowBlur = 20;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.arc(0, 0, 40, 0, Math.PI * 2);
  ctx.stroke();
  ctx.globalAlpha = 0.45;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(0, 0, 50, 0, Math.PI * 2);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.generateMipmaps = false;
  return tex;
}

function makeResonanceSprite(texture, scale, opacity) {
  const material = new THREE.SpriteMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  const sprite = new THREE.Sprite(material);
  sprite.scale.setScalar(scale);
  sprite.userData.baseScale = scale;
  sprite.userData.baseOpacity = opacity;
  sprite.visible = false;
  sprite.renderOrder = 6;
  return sprite;
}

function makeResonanceTrail() {
  const geo = new THREE.BufferGeometry();
  const arr = new Float32Array(25 * 3);
  geo.setAttribute("position", new THREE.Float32BufferAttribute(arr, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const line = new THREE.Line(geo, mat);
  line.visible = false;
  line.renderOrder = 5;
  line.frustumCulled = false;
  return line;
}

function fillTrail(line, p0, pc, p1) {
  const attr = line.geometry.getAttribute("position");
  const a = attr.array;
  for (let i = 0; i < 25; i++) {
    const t = i / 24;
    const it = 1 - t;
    a[i * 3] = it * it * p0.x + 2 * it * t * pc.x + t * t * p1.x;
    a[i * 3 + 1] = it * it * p0.y + 2 * it * t * pc.y + t * t * p1.y;
    a[i * 3 + 2] = it * it * p0.z + 2 * it * t * pc.z + t * t * p1.z;
  }
  attr.needsUpdate = true;
}

function createResonanceObjects() {
  const ringTex = makeRingTexture();
  const glowTex = makeSoftGlowTexture([
    [0, "rgba(255,255,255,1)"],
    [0.28, "rgba(190,220,255,0.72)"],
    [1, "rgba(120,160,255,0)"],
  ]);

  resonanceMarkers = {
    a: makeResonanceSprite(ringTex, 16, 0.9),
    b: makeResonanceSprite(ringTex, 16, 0.9),
  };
  resonanceGhosts = {
    a: makeResonanceSprite(glowTex, 10, 1),
    b: makeResonanceSprite(glowTex, 10, 1),
  };
  resonanceTrails = {
    a: makeResonanceTrail(),
    b: makeResonanceTrail(),
  };
  resonanceRipple = makeResonanceSprite(ringTex, 10, 0.9);
  resonancePulses = Array.from({ length: 10 }, () =>
    makeResonanceSprite(glowTex, 2.6, 0.7)
  );

  for (const s of [resonanceMarkers.a, resonanceMarkers.b, resonanceGhosts.a, resonanceGhosts.b, resonanceTrails.a, resonanceTrails.b, resonanceRipple, ...resonancePulses]) {
    scene.add(s);
  }
}

function buildAdjacency() {
  adjacency = new Map(DATA.nodes.map((n) => [n.id, new Set()]));
  DATA.nodes.forEach((n) => {
    (n.links || []).forEach((tid) => {
      if (!adjacency.has(tid) || tid === n.id) return;
      adjacency.get(n.id).add(tid);
      adjacency.get(tid).add(n.id);
    });
  });
  resonanceLinkIndex = new Map();
  linkMeta.forEach((m, i) => resonanceLinkIndex.set(m.key, i));
}

/** BFS 最短知识链（最多 maxDepth 跳） */
function shortestPathInfo(aId, bId, maxDepth = 8) {
  if (aId === bId) return { path: [aId], layers: [1], distance: 0 };
  const parent = new Map([[aId, null]]);
  let frontier = [aId];
  const layers = [1];
  for (let depth = 0; depth < maxDepth; depth++) {
    const next = [];
    let levelCount = 0;
    let found = false;
    for (const cur of frontier) {
      const neighbors = adjacency.get(cur);
      if (!neighbors) continue;
      for (const nb of neighbors) {
        if (parent.has(nb)) continue;
        parent.set(nb, cur);
        levelCount++;
        if (nb === bId) found = true;
        else next.push(nb);
      }
    }
    layers.push(levelCount);
    if (found) {
      const path = [bId];
      let x = parent.get(bId);
      while (x) {
        path.push(x);
        x = parent.get(x);
      }
      return { path: path.reverse(), layers, distance: depth + 1 };
    }
    frontier = next;
    if (!frontier.length) break;
  }
  return { path: null, layers, distance: -1 };
}

function shortestPath(aId, bId, maxDepth = 8) {
  return shortestPathInfo(aId, bId, maxDepth).path;
}

function commonNeighbors(aId, bId, refLevel = 3) {
  const sa = adjacency.get(aId) || new Set();
  const sb = adjacency.get(bId) || new Set();
  const degree = (id) => (adjacency.get(id) || new Set()).size;
  return [...sa]
    .filter((x) => sb.has(x) && x !== aId && x !== bId)
    .sort((x, y) => {
      // 优先「难度接近两者平均」的桥点，再优先连接度高的核心概念。
      // 这样「导数 × 定积分」会落到「微积分基本定理」，而不是随机挑一个高阶节点。
      const lx = (nodeById.get(x) || {}).level || 3;
      const ly = (nodeById.get(y) || {}).level || 3;
      const dx = Math.abs(lx - refLevel);
      const dy = Math.abs(ly - refLevel);
      if (dx !== dy) return dx - dy;
      const gx = degree(x);
      const gy = degree(y);
      if (gx !== gy) return gy - gx;
      return x.localeCompare(y);
    });
}

function nodeTitle(id) {
  const n = nodeById.get(id);
  if (!n) return id;
  return currentLang === "en" && n.titleEn ? n.titleEn : n.title;
}

function setMarker(sprite, id) {
  if (!sprite) return;
  const n = nodeById.get(id);
  if (!n) {
    sprite.visible = false;
    return;
  }
  sprite.position.set(n.position.x, n.position.y, n.position.z);
  sprite.material.color.set(DATA.branches[n.branch].color);
  sprite.material.opacity = sprite.userData.baseOpacity || 0.9;
  sprite.scale.setScalar(sprite.userData.baseScale || 16);
  sprite.visible = true;
}

function updateResonanceHud(text) {
  const el = document.getElementById("resonance-hud-text");
  if (el) el.textContent = text;
}

function hideResonanceCard() {
  const card = document.getElementById("resonance-card");
  if (!card) return;
  card.classList.remove("show");
  card.classList.remove("rc-show-derivation");
  card.classList.add("hidden");
}

function resetResonanceSelection() {
  resonanceToken++;
  resonanceA = -1;
  resonancePath = [];
  resonancePathIds = new Set();
  resonancePathKeys = new Set();
  resonancePathLayers = [];
  resonanceGlow.clear();
  resonanceAnim = null;
  if (resonanceMarkers) {
    resonanceMarkers.a.visible = false;
    resonanceMarkers.b.visible = false;
  }
  if (resonanceGhosts) {
    resonanceGhosts.a.visible = false;
    resonanceGhosts.b.visible = false;
  }
  if (resonanceTrails) {
    resonanceTrails.a.visible = false;
    resonanceTrails.b.visible = false;
    resonanceTrails.a.material.opacity = 0;
    resonanceTrails.b.material.opacity = 0;
  }
  if (resonanceRipple) {
    resonanceRipple.visible = false;
    resonanceRipple.material.opacity = 0;
  }
  hideResonanceCard();
  refreshHighlights();
}

function setResonanceMode(on) {
  if (on === resonanceMode) return;
  resonanceMode = on;
  document.body.classList.toggle("resonance-on", on);
  const btn = document.getElementById("resonance-btn");
  if (btn) {
    btn.classList.toggle("active", on);
    btn.setAttribute("aria-pressed", String(on));
  }
  const hud = document.getElementById("resonance-hud");
  if (hud) hud.classList.toggle("hidden", !on);
  if (on) {
    closePanel();
    if (pathState) exitPath();
    resetResonanceSelection();
    // 两连击选星时暂停自转，避免星星在两次点击之间转走
    resonanceAutoRotate = controls.autoRotate;
    controls.autoRotate = false;
    updateResonanceHud("依次点击两颗星，看看它们能碰撞出什么");
    canvas.style.cursor = "crosshair";
  } else {
    resetResonanceSelection();
    if (resonanceAutoRotate !== null) {
      controls.autoRotate = resonanceAutoRotate;
      resonanceAutoRotate = null;
    }
    canvas.style.cursor = "grab";
  }
}

function handleResonanceClick(idx) {
  if (idx < 0 || resonanceAnim) return;
  const card = document.getElementById("resonance-card");
  const resultShown = card && card.classList.contains("show");
  // 已经出过结果：下一次点击重新从第一颗星开始
  if (resonancePath.length || resultShown) {
    resetResonanceSelection();
    resonanceA = idx;
    setMarker(resonanceMarkers.a, DATA.nodes[idx].id);
    updateResonanceHud(`已选「${nodeTitle(DATA.nodes[idx].id)}」 · 再选第二颗星`);
    refreshHighlights();
    return;
  }
  if (resonanceA < 0) {
    resonanceA = idx;
    setMarker(resonanceMarkers.a, DATA.nodes[idx].id);
    updateResonanceHud(`已选「${nodeTitle(DATA.nodes[idx].id)}」 · 再选第二颗星`);
    refreshHighlights();
    return;
  }
  if (idx === resonanceA) {
    updateResonanceHud("请选择另一颗星");
    return;
  }
  launchResonance(resonanceA, idx);
}

function launchResonance(aIdx, bIdx) {
  const a = DATA.nodes[aIdx];
  const b = DATA.nodes[bIdx];
  if (!a || !b) return;

  const info = shortestPathInfo(a.id, b.id, 8);
  const path = info.path || [];
  resonancePath = path;
  resonancePathLayers = info.layers || [];
  resonancePathIds = new Set(path);
  resonancePathKeys = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    resonancePathKeys.add(linkKey(path[i], path[i + 1]));
  }

  resonanceA = aIdx;
  setMarker(resonanceMarkers.a, a.id);
  setMarker(resonanceMarkers.b, b.id);

  const ap = a.position;
  const bp = b.position;
  const mid = {
    x: (ap.x + bp.x) / 2,
    y: (ap.y + bp.y) / 2 + 8,
    z: (ap.z + bp.z) / 2,
  };
  const cA = {
    x: (ap.x + mid.x) / 2,
    y: Math.max(ap.y, mid.y) + 10,
    z: (ap.z + mid.z) / 2,
  };
  const cB = {
    x: (bp.x + mid.x) / 2,
    y: Math.max(bp.y, mid.y) + 10,
    z: (bp.z + mid.z) / 2,
  };
  const now = performance.now();
  resonanceAnim = {
    phase: "fly",
    start: now,
    duration: REDUCE_MOTION ? 520 : 1150,
    aIdx,
    bIdx,
    aId: a.id,
    bId: b.id,
    path,
    ap: { x: ap.x, y: ap.y, z: ap.z },
    bp: { x: bp.x, y: bp.y, z: bp.z },
    mid,
    cA,
    cB,
    impactAt: 0,
  };

  [resonanceGhosts.a, resonanceGhosts.b].forEach((g) => {
    g.visible = true;
    g.material.opacity = 1;
    g.scale.setScalar(g.userData.baseScale || 10);
  });
  resonanceGhosts.a.position.set(ap.x, ap.y, ap.z);
  resonanceGhosts.b.position.set(bp.x, bp.y, bp.z);
  resonanceGhosts.a.material.color.set(DATA.branches[a.branch].color);
  resonanceGhosts.b.material.color.set(DATA.branches[b.branch].color);

  fillTrail(resonanceTrails.a, ap, cA, mid);
  fillTrail(resonanceTrails.b, bp, cB, mid);
  resonanceTrails.a.material.color.set(DATA.branches[a.branch].color);
  resonanceTrails.b.material.color.set(DATA.branches[b.branch].color);
  resonanceTrails.a.material.opacity = 0.18;
  resonanceTrails.b.material.opacity = 0.18;
  resonanceTrails.a.visible = true;
  resonanceTrails.b.visible = true;

  resonanceRipple.visible = false;
  updateResonanceHud(
    path.length ? "两颗星正在靠近…" : "两颗星正在靠近…（暂无已知链路）"
  );
  refreshHighlights();
}

function updateResonance(now) {
  const pulse = 1 + 0.07 * Math.sin(now * 0.004);
  for (const m of [resonanceMarkers && resonanceMarkers.a, resonanceMarkers && resonanceMarkers.b]) {
    if (m && m.visible) m.scale.setScalar((m.userData.baseScale || 16) * pulse);
  }

  if (!resonanceAnim) return;
  const anim = resonanceAnim;

  if (anim.phase === "fly") {
    const t = Math.min(1, (now - anim.start) / anim.duration);
    const e = 1 - Math.pow(1 - t, 3);
    const setGhost = (g, p0, pc) => {
      const it = 1 - e;
      g.position.set(
        it * it * p0.x + 2 * it * e * pc.x + e * e * anim.mid.x,
        it * it * p0.y + 2 * it * e * pc.y + e * e * anim.mid.y,
        it * it * p0.z + 2 * it * e * pc.z + e * e * anim.mid.z
      );
      const s = 8 + 5 * Math.sin(Math.PI * e);
      g.scale.setScalar(s);
      g.material.opacity = 1 - 0.2 * t;
    };
    setGhost(resonanceGhosts.a, anim.ap, anim.cA);
    setGhost(resonanceGhosts.b, anim.bp, anim.cB);
    resonanceTrails.a.material.opacity = 0.18 * (1 - 0.45 * t);
    resonanceTrails.b.material.opacity = 0.18 * (1 - 0.45 * t);

    if (t >= 1) {
      anim.phase = "impact";
      anim.impactAt = now;
      resonanceGhosts.a.visible = false;
      resonanceGhosts.b.visible = false;
      resonanceTrails.a.visible = false;
      resonanceTrails.b.visible = false;
      resonanceRipple.position.copy(anim.mid);
      resonanceRipple.material.color.set(0xffffff);
      resonanceRipple.material.opacity = 0.9;
      resonanceRipple.scale.setScalar(8);
      resonanceRipple.visible = true;

      // 沿知识链放出少量能量脉冲
      const maxPulses = Math.min(4, Math.max(0, anim.path.length - 1));
      for (let i = 0; i < maxPulses; i++) {
        const key = linkKey(anim.path[i], anim.path[i + 1]);
        const li = resonanceLinkIndex.get(key);
        if (li !== undefined) {
          spawnPulse(li, {
            duration: 1000,
            size: 3.2,
            opacity: 0.9,
            reverse: i % 2 === 1,
          });
        }
      }

      const token = ++resonanceToken;
      const { aId, bId, path } = anim;
      setTimeout(() => {
        if (resonanceMode && token === resonanceToken) {
          showResonanceResult(aId, bId, path);
        }
      }, REDUCE_MOTION ? 260 : 560);
    }
  } else if (anim.phase === "impact") {
    const age = now - anim.impactAt;
    const t = Math.min(1, age / 850);
    const e = 1 - Math.pow(1 - t, 3);
    resonanceRipple.scale.setScalar(8 + 80 * e);
    resonanceRipple.material.opacity = 0.9 * (1 - e);

    const fade = Math.max(0, 1 - age / 700);
    for (const id of anim.path) {
      const i = dataIndexOf.get(id);
      if (i !== undefined) resonanceGlow.set(i, 0.85 + 1.15 * fade);
    }
    refreshHighlights();

    if (t >= 1) {
      resonanceRipple.visible = false;
      resonanceRipple.material.opacity = 0;
      resonanceGlow.clear();
      anim.phase = "done";
      resonanceAnim = null;
      refreshHighlights();
    }
  }
}

function spawnPulse(linkIdx, opts = {}) {
  const m = linkMeta[linkIdx];
  if (!m) return;
  const sprite = resonancePulses.find((s) => !s.visible);
  if (!sprite) return;
  sprite.material.color.set(
    opts.color || (Math.random() < 0.5 ? m.ca : m.cb)
  );
  sprite.material.opacity = 0;
  sprite.visible = true;
  sprite.userData = {
    start: performance.now(),
    duration: opts.duration || 2400,
    reverse: !!opts.reverse,
    size: opts.size || 2.6,
    opacity: opts.opacity || 0.62,
    linkIdx,
  };
}

function updatePulses(now) {
  for (const s of resonancePulses) {
    if (!s.visible) continue;
    const u = s.userData;
    const m = linkMeta[u.linkIdx];
    if (!m) {
      s.visible = false;
      continue;
    }
    const t = (now - u.start) / u.duration;
    if (t >= 1 || t < 0) {
      s.visible = false;
      s.material.opacity = 0;
      continue;
    }
    const tt = u.reverse ? 1 - t : t;
    const it = 1 - tt;
    s.position.set(
      it * it * m.pa.x + 2 * it * tt * m.pm.x + tt * tt * m.pb.x,
      it * it * m.pa.y + 2 * it * tt * m.pm.y + tt * tt * m.pb.y,
      it * it * m.pa.z + 2 * it * tt * m.pm.z + tt * tt * m.pb.z
    );
    const fade = Math.sin(Math.PI * t);
    s.material.opacity = u.opacity * fade;
    s.scale.setScalar(u.size * (0.7 + 0.6 * fade));
  }
}

function pulseFromNode(id, limit = 2) {
  if (!resonancePulses.length || REDUCE_MOTION) return;
  const candidates = [];
  for (let i = 0; i < linkMeta.length; i++) {
    const m = linkMeta[i];
    if (m.na === id || m.nb === id) candidates.push(i);
  }
  if (!candidates.length) return;
  candidates.sort(() => Math.random() - 0.5);
  for (let k = 0; k < Math.min(limit, candidates.length); k++) {
    spawnPulse(candidates[k], {
      duration: 1600,
      size: 2.4,
      opacity: 0.62,
      reverse: Math.random() < 0.5,
    });
  }
}

function maybeAmbientPulse(now) {
  if (REDUCE_MOTION || resonanceMode || resonanceAnim || document.hidden) return;
  if (now < nextAmbientPulse) return;
  nextAmbientPulse = now + 2600 + Math.random() * 2000;
  const active = resonancePulses.filter((s) => s.visible).length;
  if (active >= 4 || !linkMeta.length) return;
  const count = Math.random() < 0.45 ? 2 : 1;
  for (let i = 0; i < count && active + i < 4; i++) {
    spawnPulse(Math.floor(Math.random() * linkMeta.length), {
      duration: 2600,
      size: 2.4,
      opacity: 0.55,
    });
  }
}

function makeNodeChip(id, className) {
  const n = nodeById.get(id);
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className || "rc-chip";
  if (n) {
    btn.style.setProperty("--node-color", DATA.branches[n.branch].color);
    const dot = document.createElement("span");
    dot.className = "rc-dot";
    const label = document.createElement("span");
    label.className = "rc-chip-label";
    label.textContent = nodeTitle(id);
    btn.append(dot, label);
  } else {
    btn.textContent = id;
  }
  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    openPanel(id);
  });
  return btn;
}

function makeTextEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined && text !== null) el.textContent = text;
  return el;
}

function renderMathIn(el) {
  if (!el || !window.renderMathInElement) return;
  try {
    window.renderMathInElement(el, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  } catch (err) {
    // 单条公式失败不应拖垮整张结果卡
  }
}

function appendFormulaSlot(container, resultId, token) {
  const slot = makeTextEl("div", "rc-formula-slot", "正在读取核心公式…");
  container.appendChild(slot);
  const node = nodeById.get(resultId);
  if (!node) {
    slot.textContent = "条目不存在。";
    return;
  }
  loadNodeDetails(node)
    .then((details) => {
      if (token !== resonanceRenderToken) return;
      slot.textContent = "";
      const formula = details && (details.formulas || [])[0];
      if (!formula) {
        slot.textContent = "该条目暂无核心公式。";
        return;
      }
      slot.appendChild(makeTextEl("div", "rc-formula-label", "核心公式"));
      const box = makeTextEl("div", "rc-formula");
      if (window.katex) {
        try {
          box.innerHTML = window.katex.renderToString(formula.latex, {
            displayMode: true,
            throwOnError: false,
          });
        } catch (err) {
          box.textContent = formula.latex;
        }
      } else {
        box.textContent = formula.latex;
      }
      slot.appendChild(box);
      if (formula.note) {
        const note = makeTextEl("div", "rc-formula-note", formula.note);
        slot.appendChild(note);
        renderMathIn(note);
      }
    })
    .catch(() => {
      if (token === resonanceRenderToken) slot.textContent = "核心公式读取失败。";
    });
}

function addConceptRow(parent, label, id) {
  const n = nodeById.get(id);
  if (!n) return;
  const row = makeTextEl("div", "rc-compare-row");
  const tag = makeTextEl("span", "rc-compare-label", label);
  const dot = makeTextEl("span", "rc-dot");
  dot.style.setProperty("--node-color", DATA.branches[n.branch].color);
  const text = makeTextEl("span", "rc-compare-text");
  text.appendChild(makeTextEl("b", "", n.title));
  text.appendChild(document.createTextNode("：" + (n.summary || "")));
  row.append(tag, dot, text);
  parent.appendChild(row);
}

function showResonanceResult(aId, bId, path) {
  const card = document.getElementById("resonance-card");
  const body = document.getElementById("resonance-body");
  if (!card || !body) return;
  const a = nodeById.get(aId);
  const b = nodeById.get(bId);
  if (!a || !b) return;

  body.innerHTML = "";
  card.classList.remove("rc-show-derivation");
  const actionsHost = document.getElementById("resonance-actions");
  if (actionsHost) actionsHost.innerHTML = "";
  const pair = document.createElement("div");
  pair.className = "rc-pair";
  const addPairNode = (node) => {
    const span = document.createElement("span");
    span.className = "rc-pair-node";
    span.style.setProperty("--node-color", DATA.branches[node.branch].color);
    const dot = document.createElement("span");
    dot.className = "rc-dot";
    const label = document.createElement("span");
    label.textContent = nodeTitle(node.id);
    span.append(dot, label);
    pair.appendChild(span);
  };
  addPairNode(a);
  const times = document.createElement("span");
  times.className = "rc-times";
  times.textContent = "×";
  pair.appendChild(times);
  addPairNode(b);
  body.appendChild(pair);

  const token = ++resonanceRenderToken;
  const direct = path.length === 2;
  const info = shortestPathInfo(aId, bId, 8);
  const layers = info.layers || [];
  const common = commonNeighbors(aId, bId, (a.level + b.level) / 2);
  const pairNote =
    RESONANCE_NOTES.pairs[aId + "|" + bId] ||
    RESONANCE_NOTES.pairs[bId + "|" + aId] ||
    RESONANCE_NOTES.pairs[linkKey(aId, bId)] ||
    null;

  let fusionId = null;
  let verdict = "";

  if (!path.length) {
    verdict = "8 跳内未找到知识链 · 换两颗试试";
  } else if (direct) {
    verdict = "直接相邻";
    if (common.length) {
      fusionId = common[0];
      verdict += ` · 共同关联 ${common.length} 个`;
    } else {
      verdict += " · 暂无共同关联";
    }
  } else {
    verdict = `最短知识链 · ${path.length - 1} 跳`;
    fusionId = path[Math.floor(path.length / 2)];
  }

  // 精选注记可以指定更有教学价值的桥点；只接受确实位于候选集合中的节点
  if (pairNote && Object.prototype.hasOwnProperty.call(pairNote, "result")) {
    const preferred = pairNote.result;
    if (preferred === null) fusionId = null;
    else if (direct && common.includes(preferred)) fusionId = preferred;
    else if (!direct && path.includes(preferred)) fusionId = preferred;
  }

  const resultNote = fusionId ? RESONANCE_NOTES.results[fusionId] || null : null;
  const pairHasMath = !!(pairNote && (pairNote.steps || pairNote.note));
  const mathNote = pairHasMath ? pairNote : resultNote;
  const titleOf = (id) => nodeTitle(id);

  const verdictEl = document.createElement("div");
  verdictEl.className = "rc-verdict";
  verdictEl.textContent = verdict;
  body.appendChild(verdictEl);

  if (fusionId) {
    const fusion = document.createElement("div");
    fusion.className = "rc-fusion";
    const cap = document.createElement("span");
    cap.className = "rc-fusion-label";
    cap.textContent = "碰撞结果";
    const arrow = document.createElement("span");
    arrow.className = "rc-fusion-arrow";
    arrow.textContent = "→";
    fusion.append(cap, arrow, makeNodeChip(fusionId, "rc-fusion-node"));
    body.appendChild(fusion);
  }

  // 一句话回答「为什么是这个结果」
  const chosenRank = direct && fusionId ? common.indexOf(fusionId) + 1 : 0;
  const midIndex = path.length ? Math.floor(path.length / 2) : -1;
  let why = "";
  if (!path.length) {
    why = "从第一颗星出发做 BFS，8 跳内没有遇到第二颗星。";
  } else if (direct) {
    if (fusionId) {
      if (pairNote && pairNote.result === fusionId) {
        why = `知识库精选关联把「${titleOf(fusionId)}」定为这一对的碰撞结果；它同时在 ${common.length} 个共同关联中排第 ${chosenRank}。`;
      } else {
        why = `两颗星都直接连接到「${titleOf(fusionId)}」；在 ${common.length} 个共同关联中，它按难度接近度与连接度排第 ${chosenRank}。`;
      }
    } else {
      why = "两颗星直接相邻，但它们的邻接集合没有交集，因此没有第三方桥点。";
    }
  } else if (fusionId) {
    const idx = path.indexOf(fusionId);
    if (pairNote && pairNote.result === fusionId) {
      why = `知识库精选关联把「${titleOf(fusionId)}」定为桥点；它位于最短链第 ${idx + 1}/${path.length} 个节点。`;
    } else {
      why = `「${titleOf(fusionId)}」是 A→B 最短链（${path.length - 1} 跳）的中点（第 ${idx + 1}/${path.length} 个节点）。`;
    }
  } else {
    why = "最短链已找到，但没有可用的桥点。";
  }
  body.appendChild(makeTextEl("div", "rc-why", why));

  if (path.length > 2) {
    const wrap = document.createElement("div");
    wrap.className = "rc-path";
    const cap = document.createElement("span");
    cap.className = "rc-section-label";
    cap.textContent = "知识链";
    wrap.appendChild(cap);
    const chips = document.createElement("div");
    chips.className = "rc-path-chips";
    path.forEach((id, i) => {
      if (i) {
        const arrow = document.createElement("span");
        arrow.className = "rc-path-arrow";
        arrow.textContent = "→";
        chips.appendChild(arrow);
      }
      chips.appendChild(makeNodeChip(id, "rc-chip rc-path-chip"));
    });
    wrap.appendChild(chips);
    body.appendChild(wrap);
  }

  // 可展开的完整推导
  const details = makeTextEl("details", "rc-derivation");
  const toggle = makeTextEl(
    "summary",
    "rc-derivation-toggle",
    "为什么是这个结果？查看推导"
  );
  details.appendChild(toggle);
  const derivation = makeTextEl("div", "rc-derivation-body");
  details.appendChild(derivation);
  details.open = false;
  details.addEventListener("toggle", () => {
    card.classList.toggle("rc-show-derivation", details.open);
    toggle.textContent = details.open
      ? "← 收起推导，返回结果"
      : "为什么是这个结果？查看推导";
    if (details.open) body.scrollTop = 0;
  });
  body.appendChild(details);

  // ① 图结构推导
  derivation.appendChild(
    makeTextEl(
      "div",
      "rc-derivation-heading",
      `${titleOf(aId)} × ${titleOf(bId)}${fusionId ? " → " + titleOf(fusionId) : ""}`
    )
  );
  derivation.appendChild(makeTextEl("div", "rc-derivation-title", "① 图结构推导"));
  if (direct) {
    derivation.appendChild(
      makeTextEl("p", "", `两颗星直接相邻：${titleOf(bId)} ∈ N(${titleOf(aId)})。`)
    );
    if (common.length) {
      const names =
        common.slice(0, 8).map(titleOf).join("、") +
        (common.length > 8 ? ` 等 ${common.length} 个` : "");
      derivation.appendChild(
        makeTextEl("p", "", `共同关联 N(A)∩N(B) 共 ${common.length} 个：${names}。`)
      );
      const chosen = nodeById.get(fusionId);
      if (chosen) {
        const gap = Math.abs(chosen.level - (a.level + b.level) / 2);
        const degree = (adjacency.get(fusionId) || new Set()).size;
        derivation.appendChild(
          makeTextEl(
            "p",
            "",
            `排序规则：先比难度差 |level(C) − ${((a.level + b.level) / 2).toFixed(1)}|，再比连接度 deg(C)。选中的「${titleOf(fusionId)}」难度差 ${gap.toFixed(1)}、连接度 ${degree}、排名 ${chosenRank}/${common.length}。`
          )
        );
      }
    } else {
      derivation.appendChild(
        makeTextEl(
          "p",
          "",
          "N(A)∩N(B)=∅：没有同时与两颗星相邻的第三方节点，所以没有「碰撞结果」。"
        )
      );
    }
  } else if (path.length) {
    const layerText = layers.length
      ? layers.map((n, i) => `第 ${i} 层 ${n} 个`).join("；")
      : "（无分层数据）";
    derivation.appendChild(
      makeTextEl("p", "", `BFS 分层（从第一颗星出发）：${layerText}。`)
    );
    derivation.appendChild(
      makeTextEl(
        "p",
        "",
        `最短距离 ${path.length - 1} 跳；回溯父指针得到上方知识链。${
          fusionId
            ? `取${pairNote && pairNote.result === fusionId ? "精选" : "中点"}节点「${titleOf(fusionId)}」作为桥点。`
            : ""
        }`
      )
    );
  } else {
    derivation.appendChild(
      makeTextEl("p", "", "BFS 在 8 跳内没有到达第二颗星；当前图谱中二者不连通或距离超过上限。")
    );
  }

  if (pairNote && pairNote.reason) {
    derivation.appendChild(makeTextEl("p", "rc-note-reason", "精选理由：" + pairNote.reason));
  }

  if (direct && common.length > 1) {
    const rest = common.filter((id) => id !== fusionId).slice(0, 4);
    if (rest.length) {
      const wrap = document.createElement("div");
      wrap.className = "rc-common";
      wrap.appendChild(makeTextEl("span", "rc-section-label", "其他共同关联"));
      const chips = document.createElement("div");
      chips.className = "rc-path-chips";
      rest.forEach((id) => {
        chips.appendChild(makeNodeChip(id, "rc-chip rc-common-chip"));
      });
      if (common.length > rest.length + 1) {
        chips.appendChild(
          makeTextEl("span", "rc-more", `+${common.length - rest.length - 1}`)
        );
      }
      wrap.appendChild(chips);
      derivation.appendChild(wrap);
    }
  }

  // ② 数学联系
  derivation.appendChild(makeTextEl("div", "rc-derivation-title", "② 数学联系"));
  if (mathNote) {
    if (mathNote.title) {
      derivation.appendChild(makeTextEl("p", "rc-note-title", mathNote.title));
    }
    if (mathNote.note) {
      derivation.appendChild(makeTextEl("p", "", mathNote.note));
    }
    if (mathNote.steps && mathNote.steps.length) {
      const ol = document.createElement("ol");
      mathNote.steps.forEach((step) => {
        ol.appendChild(makeTextEl("li", "", step));
      });
      derivation.appendChild(ol);
    }
    if (mathNote.caveat) {
      derivation.appendChild(
        makeTextEl("div", "rc-caveat", "条件 / 反例：" + mathNote.caveat)
      );
    }
  } else {
    derivation.appendChild(
      makeTextEl(
        "p",
        "",
        "这一对没有预置的定理级推导。下面给出三条目的概念摘要与结果条目的核心公式，供核对；图谱上的相邻关系不等同于数学上的蕴含关系。"
      )
    );
  }

  // ③ 概念对照
  derivation.appendChild(makeTextEl("div", "rc-derivation-title", "③ 概念对照"));
  const compare = makeTextEl("div", "rc-compare");
  addConceptRow(compare, "A", aId);
  addConceptRow(compare, "B", bId);
  if (fusionId) addConceptRow(compare, "结果", fusionId);
  derivation.appendChild(compare);

  // ④ 结果条目的核心公式
  if (fusionId) {
    derivation.appendChild(
      makeTextEl("div", "rc-derivation-title", "④ 结果条目的核心公式")
    );
    appendFormulaSlot(derivation, fusionId, token);
  }

  // ⑤ 说明
  derivation.appendChild(
    makeTextEl(
      "div",
      "rc-disclaimer",
      "图结构推导（BFS / 共同邻居排序）是严格可复核的；数学联系来自知识库条目或精选注记。没有精选注记时，本卡只说明图谱关系，不声称定理级蕴含。"
    )
  );
  renderMathIn(derivation);

  const actions = document.createElement("div");
  actions.className = "rc-actions";
  if (fusionId) {
    const open = document.createElement("button");
    open.type = "button";
    open.className = "rc-primary";
    open.textContent = `打开「${nodeTitle(fusionId)}」`;
    open.addEventListener("click", () => openPanel(fusionId));
    actions.appendChild(open);
  }
  const again = document.createElement("button");
  again.type = "button";
  again.className = "rc-secondary";
  again.textContent = "再选两颗";
  again.addEventListener("click", () => {
    resetResonanceSelection();
    updateResonanceHud("依次点击两颗星，看看它们能碰撞出什么");
  });
  actions.appendChild(again);
  (actionsHost || body).appendChild(actions);

  updateResonanceHud("碰撞完成 · 点击结果继续探索");
  tooltip.style.opacity = "0";
  card.classList.remove("hidden");
  requestAnimationFrame(() => card.classList.add("show"));
}

/* ============================================================
   8. 射线拾取（点击 / 悬停）
   ============================================================ */
const pointer = new THREE.Vector2();
const _pickV = new THREE.Vector3();
const tooltip = document.createElement("div");
tooltip.id = "tooltip";
document.body.appendChild(tooltip);

function updatePointer(e) {
  pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
  pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;
}

function pick() {
  if (!DATA || !starLayer) return -1;
  // 屏幕空间拾取：在鼠标附近找「画面上最近」的光点，而不是沿射线找最近的点。
  // 银河中心很密，射线拾取容易被前方更远的星抢走；屏幕距离更符合用户看到的目标。
  const w = window.innerWidth;
  const h = window.innerHeight;
  const px = (pointer.x * 0.5 + 0.5) * w;
  const py = (-pointer.y * 0.5 + 0.5) * h;
  const radius = 16;
  const r2 = radius * radius;
  let best = -1;
  let bestD2 = r2;
  for (let i = 0; i < DATA.nodes.length; i++) {
    const p = DATA.nodes[i].position;
    _pickV.set(p.x, p.y, p.z).project(camera);
    if (_pickV.z < -1 || _pickV.z > 1) continue;
    const x = (_pickV.x * 0.5 + 0.5) * w;
    const y = (-_pickV.y * 0.5 + 0.5) * h;
    const dx = x - px;
    const dy = y - py;
    const d2 = dx * dx + dy * dy;
    if (d2 < bestD2) {
      bestD2 = d2;
      best = i;
    }
  }
  return best;
}

canvas.addEventListener("pointermove", (e) => {
  updatePointer(e);
  const idx = pick();
  if (idx !== hoveredIndex) {
    hoveredIndex = idx;
    refreshHighlights();
    canvas.style.cursor = idx >= 0 ? "pointer" : resonanceMode ? "crosshair" : "grab";
    // 悬停时沿它的连线放出 1~2 个能量脉冲（带冷却，避免扫过星群时刷屏）
    if (idx >= 0 && !resonanceMode && !resonanceAnim) {
      const now = performance.now();
      if (now - lastHoverPulse > 1500) {
        lastHoverPulse = now;
        pulseFromNode(DATA.nodes[idx].id, 2);
      }
    }
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
  if (resonanceMode) {
    if (idx >= 0) handleResonanceClick(idx);
    return;
  }
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
  if (!armLabelsOn) {
    for (const L of armLabels) L.el.style.opacity = 0;
    return;
  }
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

// 按钮收纳栏（v=27）
document.getElementById("actions-toggle").addEventListener("click", () => {
  const actions = document.getElementById("legend-actions");
  const btn = document.getElementById("actions-toggle");
  const collapsed = actions.classList.toggle("collapsed");
  btn.textContent = collapsed ? "»" : "«";
  btn.setAttribute("aria-expanded", String(!collapsed));
});

// 旋臂标签显示/屏蔽（v=27；v=28 起即时生效，不依赖动画帧）
document.getElementById("labels-btn").addEventListener("click", () => {
  armLabelsOn = !armLabelsOn;
  document.getElementById("labels-btn").classList.toggle("off", !armLabelsOn);
  if (!armLabelsOn) {
    for (const L of armLabels) L.el.style.opacity = 0;
  } else {
    updateArmLabels(); // 立即按当前视角重新投影显示
  }
});
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
  if (resonanceMode) setResonanceMode(false);
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

  if (details.derivation && details.derivation.length) {
    const steps = useEn
      ? details.derivationEn || details.derivation
      : details.derivation;
    const items = steps.map((s) => `<li>${mdToHTML(s)}</li>`).join("");
    parts.push(
      section(
        useEn ? "Derivation" : "推导",
        `<details class="derivation-box" open><summary>${
          useEn ? `${steps.length} steps` : `推导过程（${steps.length} 步）`
        }</summary><ol class="derivation-steps">${items}</ol></details>`
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
  fitDerivationMath(panelContent);
}

/** 推导区公式过宽时自动缩小字号；极端长的公式仍保留横向滚动作为兜底 */
function fitDerivationMath(root) {
  if (!root) return;
  root.querySelectorAll(".derivation-steps .katex-display").forEach((el) => {
    el.style.fontSize = "";
    for (const scale of [0.92, 0.84, 0.76, 0.68]) {
      if (el.scrollWidth <= el.clientWidth + 1) break;
      el.style.fontSize = scale + "em";
    }
  });
  root.querySelectorAll(".derivation-box").forEach((box) => {
    if (box.dataset.fitBound) return;
    box.dataset.fitBound = "1";
    box.addEventListener("toggle", () => {
      if (box.open) fitDerivationMath(root);
    });
  });
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
  const body = document.getElementById("sr-body");
  const srCount = document.getElementById("sr-count");
  const srFold = document.getElementById("sr-fold");
  const searchClear = document.getElementById("search-clear");
  let hits = [];
  let sel = -1;

  const paintSel = () => {
    [...body.children].forEach((el, i) => el.classList.toggle("sel", i === sel));
    if (sel >= 0 && box.children[sel]) {
      box.children[sel].scrollIntoView({ block: "nearest" });
    }
  };

  const openHit = (n) => {
    box.classList.add("hidden");
    input.value = "";
    hits = [];
    sel = -1;
    searchClear.style.display = "none";
    const i = dataIndexOf.get(n.id);
    if (i !== undefined) starLayer.setAlphaTarget(i, 1);
    openPanel(n.id);
  };

  input.addEventListener("input", () => {
    const q = input.value.trim().toLowerCase();
    searchClear.style.display = input.value ? "" : "none";
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

    body.innerHTML = "";
    box.classList.remove("folded");
    srFold.textContent = "折叠";
    srCount.textContent = hits.length ? hits.length + " 条结果" : "";
    if (!hits.length) {
      body.innerHTML = '<div class="empty">没有找到相关知识点</div>';
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
        body.appendChild(div);
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
      input.value = "";
      hits = [];
      sel = -1;
      searchClear.style.display = "none";
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

  // 清除（×）：删除搜索记录并收起结果
  searchClear.addEventListener("click", () => {
    input.value = "";
    hits = [];
    sel = -1;
    box.classList.add("hidden");
    searchClear.style.display = "none";
    input.focus();
  });
  // 结果面板：折叠 / 关闭
  srFold.addEventListener("click", () => {
    box.classList.toggle("folded");
    srFold.textContent = box.classList.contains("folded") ? "展开" : "折叠";
  });
  document.getElementById("sr-close").addEventListener("click", () => {
    box.classList.add("hidden");
    input.value = "";
    hits = [];
    sel = -1;
    searchClear.style.display = "none";
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

  if (starLayer) {
    // 远景时让星体轻微漂浮；贴近观察时自动收小，避免与静态连线端点错位
    const dist = camera.position.distanceTo(controls.target);
    const driftK = Math.max(0, Math.min(1, (dist - 50) / 150));
    starLayer.material.uniforms.uDrift.value = REDUCE_MOTION ? 0 : 1.4 * driftK;
    starLayer.update(elapsed, dt);
  }
  if (pulseT0) refreshHighlights(); // 搜索脉冲期间逐帧刷新高亮
  const now = performance.now();
  updateResonance(now);
  updatePulses(now);
  maybeAmbientPulse(now);
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
  await Promise.all([loadData(), loadResonanceNotes()]);
  computePositions();

  scene.add(createNebulae());
  scene.add(createCore());
  scene.add(createBackgroundStars());
  scene.add(buildLinks());
  scene.add(createKnowledgeStars());
  buildAdjacency();
  createResonanceObjects();

  // 入场：连线随星星从暗到亮
  linksObject.material.opacity = 0;
  linksRevealStart = performance.now();

  // 顶栏副标题：动态统计
  const populatedBranches = new Set(DATA.nodes.map((n) => n.branch)).size;
  const subtitle = document.querySelector("#topbar .subtitle");
  if (subtitle) {
    subtitle.textContent = `${DATA.nodes.length} 个知识点 · ${populatedBranches} 条分支 ｜ 点击光点展开 · R 键知识共鸣`;
  }

  buildLegend();
  buildArmLabels();
  setupLegendToggle();
  buildSearch();

  // 知识共鸣（v=30）：按钮 / 退出 / 卡片关闭 / 键盘快捷键
  document.getElementById("resonance-btn")?.addEventListener("click", (e) => {
    e.stopPropagation();
    setResonanceMode(!resonanceMode);
  });
  document.getElementById("resonance-exit")?.addEventListener("click", () => {
    setResonanceMode(false);
  });
  document.getElementById("resonance-card-close")?.addEventListener("click", () => {
    resetResonanceSelection();
    updateResonanceHud("依次点击两颗星，看看它们能碰撞出什么");
  });
  document.getElementById("resonance-derivation-back")?.addEventListener("click", () => {
    const details = document.querySelector(".rc-derivation");
    if (details) details.open = false;
  });
  const isTypingTarget = (t) =>
    !!t &&
    (t.tagName === "INPUT" ||
      t.tagName === "TEXTAREA" ||
      t.tagName === "SELECT" ||
      t.isContentEditable);
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && resonanceMode) {
      setResonanceMode(false);
      return;
    }
    if (
      (e.key === "r" || e.key === "R") &&
      !isTypingTarget(e.target) &&
      !e.metaKey &&
      !e.ctrlKey &&
      !e.altKey
    ) {
      e.preventDefault();
      setResonanceMode(!resonanceMode);
    }
  });

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
    getResonance: () => ({
      mode: resonanceMode,
      selected: resonanceA,
      path: resonancePath,
      animating: !!resonanceAnim,
    }),
    // 调试 / 演示：直接让两个知识点发生共鸣碰撞
    debugCollide: (aId, bId) => {
      const ai = dataIndexOf.get(aId);
      const bi = dataIndexOf.get(bId);
      if (ai === undefined || bi === undefined) return false;
      if (!resonanceMode) setResonanceMode(true);
      if (resonancePath.length || resonanceAnim) resetResonanceSelection();
      launchResonance(ai, bi);
      return true;
    },
    screenPos: (id) => {
      const n = nodeById.get(id);
      if (!n) return null;
      const v = new THREE.Vector3(
        n.position.x,
        n.position.y,
        n.position.z
      ).project(camera);
      return {
        x: (v.x * 0.5 + 0.5) * window.innerWidth,
        y: (-v.y * 0.5 + 0.5) * window.innerHeight,
        z: v.z,
      };
    },
    pickAt: (x, y) => {
      pointer.x = (x / window.innerWidth) * 2 - 1;
      pointer.y = -(y / window.innerHeight) * 2 + 1;
      const idx = pick();
      return idx >= 0 ? DATA.nodes[idx].id : null;
    },
  };

  const loading = document.getElementById("loading");
  loading.classList.add("hidden");
  setTimeout(() => (loading.style.display = "none"), 700);

  animate();
}

main();
