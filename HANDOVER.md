# 数学知识银河 · 完整交接文档 (HANDOVER)

> **一份自包含的项目快照说明。** 新会话只需要读这一个文件，就能完整恢复项目上下文，
> 不必重新读取 7.6 MB 的 `knowledge.json`（这正是 token 成本的大头）。
>
> 文档版本：2026-10-21（推导卡版）｜ 数据：641 个知识点 ｜ 源码：v=50 ｜ 已上线：https://deepseek-110330.github.io/DeepSeekhuanji/

---

## ★ 给下一个 AI 的阅读指引（先看这里）

**你只需要用户一句话**：`读 <路径>/HANDOVER.md，然后继续做 XX`。
用户不必粘贴任何内容——你有文件读取工具，自己读即可。

### 阅读顺序与原则

| 顺序 | 文件 | 何时读 | 大小 |
|---|---|---|---|
| **1** | `HANDOVER.md`（本文件） | **必读，从头读完** | 81 KB |
| 2 | `data/SCHEMA.md` | **要生成新知识点时**必读 | 10 KB |
| 3 | `WORKFLOW.md` | 需要**完整错误目录细节**或**更多脚本**时（本文件第 9、11 节是精简版） | 22 KB |
| 4 | `REPORT.md` | 需要**批次历史**或工程质量细节时 | 12 KB |
| 5 | `README.md` | 基本不用读（它是给人类看的项目介绍，内容与本文件重叠） | 5.6 KB |

### ⚠️ 省 token 的关键：不要读这些

| 不要读 | 原因 |
|---|---|
| `data/knowledge.json`（7.6 MB） | **本文件第 4 节已有全部 641 个知识点的 id + 名称 + 等级**，足够判断"有什么、缺什么"。只有需要精确定位某节点的完整内容时才用脚本定向提取单个节点，**不要整体读入** |
| `data/batch*.json`（110 个，共约 7.4 MB） | 同上，除非要修改某个批次文件，否则用 `merge.py` 的校验结果代替人工阅读 |
| `js/plot.js`（1802 行） | 除非要**新增图表类型**，否则本文件第 6 节已够用 |
| `js/app.js`（2905 行） | 除非要改**布局或交互**，否则不必读；第 10 节已说明布局算法位置与问题 |

### 需要精确定位某个知识点时的正确做法

```python
import json
d = json.load(open('data/knowledge.json', encoding='utf-8'))
n = next(x for x in d['nodes'] if x['id'] == 'derivative')   # 只取需要的那一个
print(json.dumps(n, ensure_ascii=False, indent=2))
```

### 开工前必须向用户确认的两件事

1. **做什么方向**（例如"拓扑学"/"高中补充"）——本文件第 10 节有遗留清单
2. **是否允许改动布局**——第 10 节说明的布局优化会重新排布所有光点，**用户此前明确要求不要移动已有知识点，必须先问**

---

## 目录

1. [一分钟了解](#1-一分钟了解)
2. [启动与验证](#2-启动与验证)
3. [文件清单](#3-文件清单)
4. [★ 知识点全清单（641 个）](#4-知识点全清单641-个) ← 最有价值，避免重读 JSON
5. [数据格式](#5-数据格式)
6. [绘图引擎参考](#6-绘图引擎参考)
7. [内容生成工作流](#7-内容生成工作流)
8. [硬规则](#8-硬规则)
9. [错误目录（282 处历史教训）](#9-错误目录282-处历史教训)
10. [遗留工作](#10-遗留工作)
11. [常用脚本](#11-常用脚本)

---

## 1. 一分钟了解

**数学知识银河**：3D 星系式数学知识可视化站点。

- 每个知识点 = 银河里的一个光点，按学科分支分布在不同旋臂上
- 点击光点 → 相机飞行 → 右侧面板展开完整内容
- 每个知识点含：**中英双语**的定义、名称、摘要、性质 + 公式（带说明）+ 表达式 + 例题 + **代码实时绘制的配图**
- **纯前端**：HTML + CSS + JavaScript，无后端、无数据库、无构建步骤
- 本地 `vendor/` 加载 Three.js（3D）与 KaTeX（公式），不依赖 CDN

**覆盖范围**：小学 → 初中 → 高中（三角）→ 大学（微积分 / 多元微积分 / 复变 / ODE / PDE / 数值分析 / 实变 / 泛函 / 微分几何 / 概率统计 / 向量与张量）→ 研究生（拓扑学 / 复分析 / 随机过程 / 黎曼几何 / 调和分析 / PDE 进阶）

**当前规模**：641 个知识点、3171 条公式、1302 道例题、481 张配图、38 条分支、推导覆盖 390/641（微积分 33 + 线性代数 49 + 概率统计 23 + 函数 22 + 小学 30 + 代数 8 + 平面几何 11 + 三角 23 + 数列 12 + 解析几何 7 + 计数原理 5 + 多元微积分 22 + 复变 28 + 常微分方程 26 + 偏微分方程 14 + 数值分析 15 + 实变分析 20 + 泛函分析 18 + 拓扑 24）、约 65 万字中文正文（定义/性质/例题/摘要 + 公式说明的纯汉字数）。

**已上线**：https://deepseek-110330.github.io/DeepSeekhuanji/ —— GitHub Pages，仓库 `DeepSeek-110330/DeepSeekhuanji`（公开）。

---

## 2. 启动与验证

```bash
cd 数学知识银河
python3 -m http.server 8123
# 浏览器打开 http://localhost:8123
```

> **端口必须用 8123**：浏览器缓存按「协议 + 主机 + 端口」隔离。历史开发都在 8123，
> 换端口会让浏览器重新缓存本地 `vendor/` 的 Three.js/KaTeX（约 3 MB）。
>
> **不能直接双击 index.html**：浏览器会因 CORS 拦截 `fetch` 读本地 JSON 与 ES 模块。

健康检查：

```bash
curl -s -o /dev/null -w "index %{http_code}\n" http://localhost:8123/index.html
curl -s -o /dev/null -w "data  %{http_code}\n" http://localhost:8123/data/knowledge.json
```

**验证注意**：标签页不可见时浏览器会暂停 `requestAnimationFrame`，此时动画不推进、
逐节点检查会超时。做全量验证前先让标签页可见。

### 2.2 公网部署（GitHub Pages，2026-10-16 起）

- **线上地址**：https://deepseek-110330.github.io/DeepSeekhuanji/ ；**仓库**：https://github.com/DeepSeek-110330/DeepSeekhuanji （公开）
- **本地目录已是 git 仓库**（`main` 分支，远程 `origin` 已指向上述仓库）
- **更新流程**：改内容 →（若改 `js/` 先升 `?v=N`）→ 跑 `python3 data/merge.py` → `python3 data/build_runtime.py` → `git add -A && git commit -m "…" && git push` → 约 40 秒后 Pages 自动重建，刷新线上地址核验（更省事：`python3 release.py -m "说明"` 一条命令全包）
- **凭证**：`gh` 在 `~/.local/bin/gh`，已登录 `DeepSeek-110330`（keyring）；git 凭据助手已配好（`gh auth git-credential`）
- **网络注意**：国内直连 `github.com` 时好时坏（`api.github.com` 一般稳定）。推送前先测：`curl -s -o /dev/null -w "%{http_code}" https://github.com`。不通时的办法：① 换手机热点（实测最有效）；② 本地自动换线代理：`python3 ~/.local/tmp/ghproxy.py`，再把 `https_proxy`、`http_proxy` 设为 `http://127.0.0.1:8433`
- **push 被拒**（远程有新提交，如在网页上建过文件）：`git pull origin main --no-rebase --allow-unrelated-histories`（必要时加 `-X ours`）合并后再 push

---

## 3. 文件清单

```
数学知识银河/
├── README.md               给人看的项目说明
├── REPORT.md               进度报告（规模、批次记录、质量统计）
├── WORKFLOW.md             接手指南（工作流 + 错误目录 + 脚本）
├── AGENTS.md               项目协作指令（给 AI 会话）
├── HANDOVER.md             本文件（自包含总览）
├── index.html              页面骨架（146 行）
├── katex-check.html        全库公式渲染扫描页（开发用）
├── plot-test.html          绘图引擎测试页（开发用）
├── release.py              一键发布（升版本号→merge→build→提交→推送）
├── css/style.css           样式（1961 行）
├── vendor/                 Three.js 与 KaTeX 本地库（v=19 起，不依赖 CDN）
├── js/
│   ├── app.js              主逻辑：场景/相机/交互/面板/搜索/布局/路线/共鸣（2905 行）
│   ├── plot.js             绘图引擎：12 种数学图表（1802 行）
│   └── stars.js            星体渲染：着色器星点 + 差速流动（660 行）
├── data/
│   ├── knowledge.json      ★ 合并后的完整知识库（约 7.6 MB；本地/工具用）
│   ├── batch*.json         110 个批次源文件（每批 4~8 个知识点）
│   ├── merge.py            合并 + 校验脚本
│   ├── build_runtime.py    生成首屏骨架与详情分片（merge 后运行）
│   ├── derivations/       知识点推导叠加层（D01 起，按 id 附加）
│   ├── resonance-notes.json 知识共鸣「推导卡」精选注记（结果级 + pair 级）
│   ├── skeleton.json       首屏骨架（约 764 KB，运行时首屏加载）
│   ├── paths.json          学习路线（6 条精选路线，导览功能）
│   ├── parts/              详情分片 ×38（按需加载）
│   ├── SCHEMA.md           数据格式与绘图规范（生成前必读）
│   ├── IDLIST.txt          当前所有合法 id 清单（链接校验用）
│   └── merge_backup/       （如存在）合并前的备份
└── 快照/                   历史快照 zip（不纳入版本库）
```

**源码合计 7,474 行**：app.js 2905 + plot.js 1802 + stars.js 660 + css 1961 + html 146

---

## 4. ★ 知识点全清单（641 个）

> **这一节是新会话恢复上下文的关键。** 有了它就不必读 `knowledge.json`（7.6 MB → 本节约 38 KB，省 99%）。

**总计 641 个知识点，分布在 38 条分支上（38 条全部有内容）。**

> 格式：`id` 中文名（L 等级）。等级 1~5，越大越高级、光点越大、离银心越远。

### 4.1 小学基础 `elementary-basics` — Elementary School Basics（30 个）

- `addition-subtraction` 加法和减法（L1）
- `angles-elementary` 角的初步认识与度量（L1）
- `area-volume-units` 面积与体积单位（L1）
- `average-elementary` 平均数（L1）
- `chicken-rabbit` 鸡兔同笼（L1）
- `counting-comparison` 数数与比较大小（L1）
- `figures-motion-elementary` 图形的运动（L1）
- `four-operations-order` 四则运算与运算顺序（L1）
- `large-numbers` 大数与近似数（L1）
- `length-units` 长度单位（L1）
- `letters-for-numbers` 用字母表示数与简易方程（L1）
- `mass-time-units` 质量与时间单位（L1）
- `multiplication-division` 乘法和除法（L1）
- `negative-numbers-elementary` 负数的初步认识（L1）
- `observing-objects` 观察物体（L1）
- `perimeter-elementary` 周长（L1）
- `possibility-elementary` 可能性（L1）
- `rounding-approximation` 四舍五入与近似数（L1）
- `solid-figures-elementary` 认识立体图形（L1）
- `statistics-charts` 统计图表（L1）
- `whole-numbers` 整数的认识与数位（L1）
- `area-elementary` 面积与面积公式（L2）
- `circle-elementary` 圆的周长与面积（L2）
- `decimals-elementary` 小数的意义与运算（L2）
- `factors-multiples` 因数、倍数与质数（L2）
- `fractions-elementary` 分数的意义与运算（L2）
- `operation-laws-elementary` 运算定律与简便计算（L2）
- `percentage-elementary` 百分数（L2）
- `ratio-elementary` 比与比例（L2）
- `solid-volume-elementary` 立体图形的体积（L2）

### 4.2 数与式 `elementary` — Numbers & Expressions（10 个）

- `algebraic-expression` 整式与合并同类项（L1）
- `rational-numbers` 有理数（L1）
- `rational-operations` 有理数的运算（L1）
- `scientific-notation` 科学记数法与近似数（L1）
- `algebraic-fraction` 分式（L2）
- `algebraic-identities` 整式的乘法与乘法公式（L2）
- `factorization` 因式分解（L2）
- `quadratic-radical` 二次根式（L2）
- `real-numbers` 实数（L2）
- `square-cube-root` 平方根与立方根（L2）

### 4.3 平面几何 `plane-geometry` — Plane Geometry（11 个）

- `axial-symmetry` 轴对称（L1）
- `intersecting-lines` 相交线与平行线（L1）
- `lines-angle-basics` 直线、射线、线段与角（L1）
- `central-symmetry-rotation` 旋转与中心对称（L2）
- `congruent-triangles` 全等三角形（L2）
- `parallelogram` 平行四边形（L2）
- `plane-coordinates` 平面直角坐标系（L2）
- `projection-view` 投影与视图（L2）
- `rectangle-rhombus-square` 矩形、菱形与正方形（L2）
- `circle-junior` 圆（L3）
- `similarity` 相似三角形（L3）

### 4.4 代数 `algebra` — Algebra（8 个）

- `linear-equation-junior` 一元一次方程（L1）
- `basic-inequality` 基本不等式（L2）
- `inequality` 不等式（L2）
- `linear-inequality-junior` 一元一次不等式与不等式组（L2）
- `linear-system-two-variables` 二元一次方程组（L2）
- `polynomial` 多项式（L2）
- `quadratic-equation-junior` 一元二次方程（L2）
- `quadratic-inequality` 一元二次不等式及其解法（L2）

### 4.5 函数 `function` — Functions（22 个）

- `domain-range` 函数的定义域与值域（L1）
- `function-concept` 函数的概念（L1）
- `linear-function` 一次函数（L1）
- `function-zeros` 函数的零点（L2）
- `inverse-variation-function` 反比例函数（L2）
- `monotonicity` 函数的单调性（L2）
- `parity` 函数的奇偶性（L2）
- `periodicity` 函数的周期性（L2）
- `power-function` 幂函数（L2）
- `quadratic-function` 二次函数（L2）
- `rational-exponent` 指数与指数幂（L2）
- `change-of-base` 换底公式（L3）
- `composite-function` 复合函数（L3）
- `exponential-equation` 指数方程与不等式（L3）
- `exponential-function` 指数函数（L3）
- `function-models` 函数模型及其应用（L3）
- `inverse-function` 反函数（L3）
- `logarithm` 对数（L3）
- `logarithmic-function` 对数函数（L3）
- `exponential-growth-decay` 指数增长与衰减模型（L4）
- `logarithmic-equation` 对数方程与不等式（L4）
- `natural-constant-e` 自然常数 e 与自然对数（L4）

### 4.6 三角 `trigonometry` — Trigonometry（23 个）

- `triangle` 三角形（L1）
- `acute-trigonometry` 锐角三角函数（L2）
- `angle-radian` 任意角与弧度制（L2）
- `pythagorean` 勾股定理与三角（L2）
- `triangle-area` 三角形的面积（L2）
- `unit-circle` 单位圆（L2）
- `cosine-function` 余弦函数（L3）
- `fundamental-identities` 同角三角函数关系（L3）
- `law-of-cosines` 余弦定理（L3）
- `law-of-sines` 正弦定理（L3）
- `reduction-formulas` 诱导公式（L3）
- `sine-function` 正弦函数（L3）
- `tangent-function` 正切函数（L3）
- `trigonometric-definition` 三角函数的定义（L3）
- `auxiliary-angle` 辅助角公式（L4）
- `inverse-trig-functions` 反三角函数（L4）
- `sinusoidal-model` 正弦型函数模型（L4）
- `triangle-application` 解三角形的实际应用（L4）
- `triangle-identities` 三角形中的恒等变换（L4）
- `trig-properties` 三角函数的性质（L4）
- `trig-transform` 三角函数图像变换（L4）
- `trigonometric-identities` 三角恒等变换（L4）
- `sum-to-product` 和差化积与积化和差（L5）

### 4.7 数列与级数 `sequence` — Sequences & Series（12 个）

- `arithmetic-sequence` 等差数列（L2）
- `geometric-sequence` 等比数列（L2）
- `sequence-concept` 数列的概念与表示（L2）
- `mathematical-induction` 数学归纳法（L3）
- `sequence-summation` 数列的求和方法（L3）
- `harmonic-series` 调和级数（L4）
- `series` 无穷级数（L4）
- `alternating-series` 交错级数与绝对收敛（L5）
- `fourier-series` 傅里叶级数（L5）
- `power-series` 幂级数（L5）
- `series-convergence-tests` 正项级数及其判别法（L5）
- `taylor-series` 泰勒级数（L5）

### 4.8 解析几何 `analytic` — Analytic Geometry（7 个）

- `circle-equation` 圆的方程（L2）
- `line-equation` 直线的方程（L2）
- `parabola` 抛物线（L2）
- `ellipse` 椭圆（L3）
- `hyperbola` 双曲线（L3）
- `line-circle-relation` 直线与圆的位置关系（L3）
- `conic-comprehensive` 圆锥曲线的综合应用（L4）

### 4.9 微积分 `calculus` — Calculus（33 个）

- `continuity` 函数的连续性（L3）
- `infinitesimal` 无穷小与无穷大（L3）
- `limit` 极限（L3）
- `limit-laws` 极限的运算法则（L3）
- `sequence-limit` 数列极限（L3）
- `antiderivative` 不定积分（L4）
- `chain-rule` 链式法则（L4）
- `concavity-inflection` 凹凸性与拐点（L4）
- `continuity-theorems` 闭区间上连续函数的性质（L4）
- `curve-sketching` 函数图像的描绘（L4）
- `derivative` 导数（L4）
- `differential` 微分（L4）
- `differentiation-rules` 求导法则（L4）
- `discontinuity-types` 间断点及其分类（L4）
- `fundamental-theorem` 微积分基本定理（L4）
- `higher-order-derivative` 高阶导数（L4）
- `integral` 定积分（L4）
- `integral-area` 定积分求面积（L4）
- `integral-physics` 定积分的物理应用（L4）
- `integral-volume` 定积分求体积（L4）
- `integration-by-parts` 分部积分法（L4）
- `integration-substitution` 换元积分法（L4）
- `monotonicity-extremum` 单调性与极值（L4）
- `optimization` 最值问题（L4）
- `two-important-limits` 两个重要极限（L4）
- `arc-length` 弧长（L5）
- `curvature` 曲率（L5）
- `implicit-differentiation` 隐函数求导（L5）
- `improper-integral` 反常积分（L5）
- `lhopital` 洛必达法则（L5）
- `mean-value-theorems` 微分中值定理（L5）
- `parametric-derivative` 参数方程求导（L5）
- `taylor-formula` 泰勒公式（L5）

### 4.10 多元微积分 `multivariable` — Multivariable Calculus（22 个）

- `double-integral` 二重积分（L4）
- `higher-order-partial` 高阶偏导数（L4）
- `multivariable-function` 多元函数（L4）
- `partial-derivative` 偏导数（L4）
- `directional-derivative` 方向导数（L5）
- `divergence-curl` 散度与旋度（L5）
- `double-integral-polar` 极坐标下的二重积分（L5）
- `gauss-theorem` 高斯公式（L5）
- `gradient` 梯度（L5）
- `green-theorem` 格林公式（L5）
- `jacobian` 雅可比行列式（L5）
- `lagrange-multiplier` 拉格朗日乘数法（L5）
- `line-integral` 曲线积分（L5）
- `multivariable-chain-rule` 多元复合函数求导（L5）
- `multivariable-extrema` 多元函数的极值（L5）
- `multivariable-implicit-differentiation` 多元隐函数求导（L5）
- `multivariable-limit` 多元函数的极限与连续（L5）
- `multivariable-taylor` 多元泰勒公式（L5）
- `stokes-theorem` 斯托克斯公式（L5）
- `surface-integral` 曲面积分（L5）
- `total-differential` 全微分（L5）
- `triple-integral` 三重积分（L5）

### 4.11 复变函数与积分变换 `complex` — Complex Analysis & Transforms（28 个）

- `complex-number` 复数（L2）
- `complex-function` 复变函数（L3）
- `complex-plane` 复平面与复数的表示（L3）
- `complex-trig-form` 复数的三角表示（L3）
- `analytic-function` 解析函数（L4）
- `cauchy-riemann` 柯西-黎曼方程（L4）
- `complex-integral` 复积分（L4）
- `complex-limit-continuity` 复变函数的极限与连续（L4）
- `convolution` 卷积（L4）
- `elementary-complex-functions` 初等复变函数（L4）
- `argument-principle` 辐角原理与儒歇定理（L5）
- `cauchy-integral-formula` 柯西积分公式（L5）
- `cauchy-integral-theorem` 柯西积分定理（L5）
- `complex-power-series` 复幂级数（L5）
- `complex-taylor-series` 复变函数的泰勒级数（L5）
- `fourier-transform` 傅里叶变换（L5）
- `fourier-transform-properties` 傅里叶变换的性质（L5）
- `harmonic-function` 调和函数（L5）
- `inverse-laplace-transform` 拉普拉斯逆变换（L5）
- `isolated-singularities` 孤立奇点（L5）
- `laplace-solve-ode` 用拉普拉斯变换解微分方程（L5）
- `laplace-transform` 拉普拉斯变换（L5）
- `laplace-transform-properties` 拉普拉斯变换的性质（L5）
- `laurent-series` 洛朗级数（L5）
- `liouville-theorem` 刘维尔定理（L5）
- `residue` 留数与留数定理（L5）
- `residue-computation` 留数的计算（L5）
- `residue-real-integrals` 用留数计算实积分（L5）

### 4.12 常微分方程 `ode` — Differential Equations（26 个）

- `ode-basic-concepts` 微分方程的基本概念（L3）
- `bernoulli-equation` 伯努利方程（L4）
- `constant-coefficient-homogeneous` 常系数齐次线性方程（L4）
- `first-order-applications` 一阶微分方程的应用（L4）
- `first-order-linear-ode` 一阶线性微分方程（L4）
- `homogeneous-ode` 齐次方程（L4）
- `reducible-ode` 可降阶的高阶方程（L4）
- `separable-ode` 可分离变量方程（L4）
- `bifurcation-chaos` 分支与混沌初步（L5）
- `constant-coefficient-nonhomogeneous` 常系数非齐次线性方程（L5）
- `dynamical-systems` 动力系统初步：流、轨道与不变集（L5）
- `euler-equation` 欧拉方程（L5）
- `exact-equation` 恰当方程与积分因子（L5）
- `limit-cycles` 极限环与庞加莱-本迪克松定理（L5）
- `linear-ode-system` 线性微分方程组（L5）
- `linear-ode-theory` 高阶线性方程解的结构（L5）
- `lyapunov-second-method` 李雅普诺夫第二方法与李雅普诺夫函数（L5）
- `matrix-exponential` 矩阵指数与基解矩阵（L5）
- `ode-boundary-value` 常微分方程的边值问题（L5）
- `ode-comparison` 比较定理与微分不等式（L5）
- `ode-continuous-dependence` 解对初值与参数的连续依赖性和可微性（L5）
- `ode-existence-uniqueness` 解的存在唯一性定理（L5）
- `ode-maximal-interval` 解的最大存在区间与延拓（L5）
- `ode-power-series` 幂级数解法（L5）
- `phase-plane` 相平面与平衡点（L5）
- `stability` 稳定性理论（L5）

### 4.13 偏微分方程 `pde` — Partial Differential Equations（14 个）

- `pde-basic-concepts` 偏微分方程的基本概念（L4）
- `classification-pde` 二阶线性偏微分方程的分类（L5）
- `dalembert-formula` 达朗贝尔公式（L5）
- `dirichlet-neumann` 狄利克雷问题与诺伊曼问题（L5）
- `first-order-pde` 一阶偏微分方程与特征线法（L5）
- `fourier-method-pde` 傅里叶级数解法（L5）
- `green-function` 格林函数（L5）
- `heat-equation` 热传导方程（L5）
- `laplace-equation` 拉普拉斯方程（L5）
- `maximum-principle` 最大值原理（L5）
- `pde-well-posedness` 定解问题的适定性（L5）
- `separation-of-variables` 分离变量法（L5）
- `sturm-liouville` 施图姆-刘维尔问题（L5）
- `wave-equation` 波动方程（L5）

### 4.14 数值分析 `numerical` — Numerical Analysis（15 个）

- `numerical-error` 误差、有效数字与数值稳定性（L3）
- `direct-linear-solvers` 线性方程组的直接解法：高斯消元与 LU 分解（L4）
- `euler-methods` 欧拉法与改进欧拉法（L4）
- `interpolation` 插值法：拉格朗日插值与牛顿插值（L4）
- `least-squares-fitting` 最小二乘拟合（L4）
- `newton-method` 牛顿迭代法与割线法（L4）
- `nonlinear-equations` 非线性方程求根：二分法与不动点迭代（L4）
- `numerical-differentiation` 数值微分（L4）
- `numerical-integration` 数值积分：梯形公式与辛普森公式（L4）
- `gaussian-quadrature` 高斯求积公式（L5）
- `iterative-linear-solvers` 线性方程组的迭代解法（L5）
- `matrix-condition` 矩阵范数与条件数（L5）
- `numerical-stability` 数值方法的收敛性与稳定性（L5）
- `runge-kutta` 龙格-库塔方法（L5）
- `spline-interpolation` 三次样条插值（L5）

### 4.15 实变函数论 `real-analysis` — Real Analysis（20 个）

- `set-algebra` 集合列与 σ 代数（L3）
- `measurable-functions` 可测函数（L4）
- `measurable-sets` 可测集与勒贝格测度（L4）
- `measure-space` 测度空间与测度的性质（L4）
- `outer-measure` 勒贝格外测度（L4）
- `simple-functions` 简单函数与可测函数的逼近（L4）
- `absolutely-continuous` 绝对连续函数（L5）
- `bounded-variation` 有界变差函数（L5）
- `convergence-ae` 几乎处处收敛与依测度收敛（L5）
- `dominated-convergence` 控制收敛定理（L5）
- `egorov-lusin` 叶戈罗夫定理与鲁津定理（L5）
- `fatou-lemma` 法图引理（L5）
- `fubini-tonelli` 富比尼定理与托内利定理（L5）
- `integral-properties` 勒贝格积分的性质（L5）
- `lebesgue-differentiation` 勒贝格微分定理（L5）
- `lebesgue-integral` 勒贝格积分的定义（L5）
- `lp-spaces` L^p 空间（L5）
- `monotone-convergence` 单调收敛定理（L5）
- `product-measure` 乘积测度（L5）
- `riemann-vs-lebesgue` 黎曼积分与勒贝格积分的关系（L5）

### 4.16 泛函分析 `functional-analysis` — Functional Analysis（18 个）

- `metric-space` 度量空间（L4）
- `normed-space` 赋范线性空间（L4）
- `banach-space` 巴拿赫空间（L5）
- `bounded-operators` 有界线性算子与算子范数（L5）
- `closed-graph` 闭图像定理与一致有界原理（L5）
- `compact-operators` 紧算子（L5）
- `complete-metric-space` 完备度量空间与压缩映射原理（L5）
- `dual-space` 对偶空间与里斯表示定理（L5）
- `fredholm-alternative` 弗雷德霍姆二择一定理（L5）
- `hahn-banach` 哈恩-巴拿赫定理（L5）
- `inner-product-space` 内积空间与希尔伯特空间（L5）
- `open-mapping` 开映射定理与逆算子定理（L5）
- `orthogonality-projection` 正交性与投影定理（L5）
- `orthonormal-basis` 正交基与傅里叶展开（L5）
- `spectral-theorem` 自伴算子的谱定理（L5）
- `spectrum` 谱与预解集（L5）
- `unbounded-operators` 无界算子初步（L5）
- `weak-convergence` 弱收敛与自反空间（L5）

### 4.17 微分几何 `differential-geometry` — Differential Geometry（28 个）

- `arc-length-param` 弧长与弧长参数化（L4）
- `regular-surface` 正则曲面与参数表示（L4）
- `space-curve` 空间曲线与参数表示（L4）
- `surface-area` 曲面的面积（L4）
- `tangent-plane` 切平面与法向量（L4）
- `curvature-torsion` 曲率与挠率（L5）
- `curve-fundamental-theorem` 曲线论基本定理（L5）
- `differential-form` 微分形式（L5）
- `exterior-derivative` 外微分（L5）
- `first-fundamental-form` 第一基本形式（L5）
- `frenet-formulas` Frenet–Serret 公式（L5）
- `frenet-frame` Frenet 标架（L5）
- `gauss-bonnet` 高斯–博内定理（L5）
- `gauss-map` 高斯映射（L5）
- `gaussian-mean-curvature` 高斯曲率与平均曲率（L5）
- `generalized-stokes` 广义斯托克斯定理（L5）
- `geodesic` 测地线（L5）
- `lie-derivative` 李导数与李括号（L5）
- `manifold-integration` 流形上的积分与定向（L5）
- `manifold-vector-fields` 流形上的向量场与流（L5）
- `minimal-surface` 极小曲面（L5）
- `normal-curvature` 法曲率（L5）
- `principal-curvature` 主曲率与主方向（L5）
- `second-fundamental-form` 第二基本形式（L5）
- `smooth-manifold` 光滑流形（L5）
- `surface-isometry` 等距与可展曲面（L5）
- `tangent-space` 切空间与切映射（L5）
- `theorema-egregium` 高斯绝妙定理（L5）

### 4.19 概率统计 `probability` — Probability & Statistics（23 个）

- `data-collection` 数据的收集、整理与描述（L1）
- `data-analysis` 数据的分析（L2）
- `probability-basics` 概率的定义与性质（L2）
- `conditional-probability-bayes` 条件概率与贝叶斯公式（L3）
- `expectation-variance` 数学期望与方差（L3）
- `random-variable` 随机变量与分布函数（L3）
- `statistics-sampling` 总体、样本与统计量（L3）
- `continuous-distributions` 常见连续型分布（L4）
- `covariance-correlation` 协方差与相关系数（L4）
- `discrete-distributions` 常见离散型分布（L4）
- `marginal-conditional-independence` 边缘分布、条件分布与独立性（L4）
- `normal-distribution` 正态分布（L4）
- `random-vector` 二维随机变量与联合分布（L4）
- `regression-analysis` 回归分析（L4）
- `central-limit-theorem` 中心极限定理（L5）
- `chi-square-anova` 卡方检验与方差分析（L5）
- `function-of-random-variables` 随机变量函数的分布（L5）
- `hypothesis-testing` 假设检验（L5）
- `interval-estimation` 区间估计与置信区间（L5）
- `law-of-large-numbers` 大数定律（L5）
- `moments-mgf` 矩与矩母函数（L5）
- `point-estimation` 点估计：矩估计与极大似然（L5）
- `sampling-distributions` 抽样分布与三大分布（L5）

### 4.21 向量与空间 `vector` — Vectors & Space（11 个）

- `vector` 向量（L3）
- `del-operator` 矢量微分算子 ∇（L4）
- `scalar-vector-fields` 标量场与矢量场（L4）
- `christoffel-symbols` Christoffel 符号与协变导数（L5）
- `curvilinear-coordinates` 曲线坐标系中的梯度、散度与旋度（L5）
- `index-notation` 指标记号与爱因斯坦求和约定（L5）
- `metric-tensor` 度量张量与指标升降（L5）
- `stress-strain-tensor` 应力张量与应变张量（L5）
- `tensor-algebra` 张量代数：缩并、对称与反对称（L5）
- `tensor-introduction` 张量初步（L5）
- `vector-identities` 矢量微分恒等式（L5）

### 4.22 拓扑学 `topology` — Topology（24 个）

- `closed-sets-interior` 闭集、闭包与内部（L4）
- `topological-space` 拓扑空间（L4）
- `basis-subbasis` 基与子基（L5）
- `brouwer-fixed-point` 布劳威尔不动点定理（L5）
- `compactness` 紧致性（L5）
- `compactness-metric` 度量空间中的紧致性（L5）
- `connectedness` 连通性与道路连通性（L5）
- `continuity-homeomorphism` 连续映射与同胚（L5）
- `countability-axioms` 可数性公理与可分性（L5）
- `covering-space` 覆叠空间（L5）
- `de-rham-cohomology` 德拉姆上同调（L5）
- `euler-characteristic` 欧拉示性数（L5）
- `fundamental-group` 基本群（L5）
- `fundamental-group-circle` 圆周的基本群（L5）
- `homology-group` 同调群（L5）
- `homotopy` 同伦与同伦等价（L5）
- `local-compactification` 局部紧性与紧化（L5）
- `seifert-van-kampen` 塞弗特–范坎彭定理（L5）
- `separation-axioms` 分离公理（T₀–T₄）（L5）
- `simplicial-complex` 单纯复形与三角剖分（L5）
- `simplicial-homology` 单纯同调群（L5）
- `subspace-product-quotient` 子空间、积空间与商空间（L5）
- `surface-classification` 曲面的分类（L5）
- `tychonoff-theorem` 吉洪诺夫定理（L5）

**主线**：点集拓扑（ZFC 公理 → 连续/同胚 → 子空间·积·商 → 分离公理 T₀–T₄ → 紧 · 连通 · 可数性与可分 → 吉洪诺夫定理 → 局部紧与紧化）→ 代数拓扑（同伦与同伦等价 → 基本群 → π₁(S¹)=ℤ → 覆叠空间 → 塞弗特–范坎彭 → 单纯同调 → 同调群 → 欧拉示性数 → 曲面分类 → 德拉姆上同调，接微分几何的桥梁）。
**性质**：完全无法数值验算，复核只能靠人工逐条审查（本轮 2 个复核代理共抓到 **18 处**错误）。

### 4.23 复分析（专业深度版） `complex-analysis` — Complex Analysis (Graduate Level)（24 个）

- `analytic-continuation` 解析延拓（L5）
- `conformal-mapping` 共形映射（L5）
- `elliptic-functions` 椭圆函数（L5）
- `entire-functions` 整函数（L5）
- `gamma-function` 伽马函数（L5）
- `harmonic-dirichlet-problem` 调和函数与狄利克雷问题（L5）
- `harnack-principle` 哈纳克原理（L5）
- `hyperbolic-geometry-poincare` 双曲几何与庞加莱模型（L5）
- `maximum-modulus-principle` 最大模原理（L5）
- `meromorphic-functions` 亚纯函数（L5）
- `mittag-leffler` 米塔-列夫勒定理（L5）
- `mobius-transformation` 分式线性变换（L5）
- `monodromy-theorem` 单值性定理（L5）
- `normal-families` 正规族与蒙泰尔定理（L5）
- `picard-theorems` 皮卡定理（L5）
- `poisson-integral` 泊松积分公式（L5）
- `residue-advanced` 留数技巧进阶（L5）
- `riemann-mapping-theorem` 黎曼映射定理（L5）
- `riemann-surfaces` 黎曼曲面（L5）
- `schwarz-christoffel` 施瓦茨–克里斯托费尔变换（L5）
- `schwarz-lemma` 施瓦茨引理（L5）
- `uniformization-theorem` 单值化定理（L5）
- `weierstrass-factorization` 魏尔斯特拉斯分解定理（L5）
- `zeta-function` 黎曼 ζ 函数（L5）

**与 `complex` 的分工**：`complex`（27 个）是工科复变与积分变换，本分支不重复其内容，只做数学专业的深化。
**主线**：共形映射与分式线性变换 → 黎曼映射定理 → 施瓦茨引理 → 最大模原理 → 解析延拓 → 单值性定理 → 整函数与增长阶 → 魏尔斯特拉斯分解 → 亚纯函数与米塔-列夫勒 → 皮卡定理 → 正规族与蒙泰尔 → Γ / ζ / 椭圆函数 / SC 变换 / 留数进阶 → 调和函数与狄利克雷问题 → 泊松积分 → 哈纳克原理 → 黎曼曲面 → 单值化定理 → 双曲几何与庞加莱模型。
**性质**：概念性内容为主，复核代理抓到 **20 处**错误（含 2 处经典公式的适用条件被写宽）。

### 4.24 随机过程 `stochastic` — Stochastic Processes（24 个）

- `birth-death-process` 生灭过程（L5）
- `brownian-motion` 布朗运动（L5）
- `brownian-properties` 布朗运动的性质与路径结构（L5）
- `continuous-time-markov` 连续时间马尔可夫链（L5）
- `doob-decomposition` 杜布分解与杜布不等式（L5）
- `ergodic-theory` 遍历定理与混合性（L5）
- `finite-dimensional-distributions` 有限维分布族与柯尔莫哥洛夫扩张定理（L5）
- `gaussian-process` 高斯过程（L5）
- `girsanov` 吉尔萨诺夫定理（L5）
- `ito-formula` 伊藤公式（L5）
- `ito-integral` 伊藤积分（L5）
- `markov-chain-classification` 状态分类与常返性（L5）
- `martingale` 鞅（L5）
- `martingale-convergence` 鞅收敛定理（L5）
- `reflection-principle` 反射原理与首达时分布（L5）
- `stationarity` 平稳过程与宽平稳（L5）
- `stationary-distribution` 平稳分布与极限定理（L5）
- `stochastic-differential-equation` 随机微分方程（L5）
- `stochastic-process` 随机过程（L5）
- `stopping-time` 停时与可选停时定理（L5）
- `white-noise-spectral` 白噪声与谱密度（L5）
- `chapman-kolmogorov` 查普曼–柯尔莫哥洛夫方程与转移矩阵（L4）
- `markov-chain` 马尔可夫链（L4）
- `poisson-process` 泊松过程（L4）

**主线**：过程与有限维分布 → 高斯过程与平稳性 → 谱密度与遍历 → 马尔可夫链（C-K 方程、状态分类、平稳分布、连续时间链）→ 泊松过程 → 布朗运动（处处不可微、二次变差 = t、反射原理）→ 鞅与停时 → 杜布分解与鞅收敛 → 伊藤积分与伊藤公式 → SDE → 吉尔萨诺夫。
**性质**：与 `probability`（工科概率统计）不重复，从测度论高度讲。样例轨道无法真随机绘制，配图统一用**固定正弦和近似**并在标题注明。复核 4 组共抓到 **19 处**。

### 4.25 黎曼几何 `riemannian` — Riemannian Geometry（20 个）

- `bishop-gromov` 毕晓普–格罗莫夫体积比较定理（L5）
- `bonnet-myers` 邦内–迈尔斯定理（L5）
- `cartan-hadamard` 嘉当–哈达玛定理（L5）
- `conjugate-points-cut-locus` 共轭点与割迹（L5）
- `curvature-symmetries` 曲率张量的对称性与比安基恒等式（L5）
- `einstein-manifold` 爱因斯坦流形与里奇流（L5）
- `exponential-map` 指数映射与单射半径（L5）
- `first-variation` 弧长第一变分（L5）
- `hodge-laplace-beltrami` 拉普拉斯–贝尔特拉米算子与霍奇理论（L5）
- `hopf-rinow` 霍普夫–里诺定理（L5）
- `jacobi-fields` 雅可比场（L5）
- `levi-civita-connection` 列维-奇维塔联络（L5）
- `parallel-transport-holonomy` 平行移动与和乐群（L5）
- `rauch-comparison` 劳赫比较定理（L5）
- `ricci-scalar-curvature` 里奇曲率与数量曲率（L5）
- `riemannian-curvature-tensor` 黎曼曲率张量（L5）
- `riemannian-metric` 黎曼度量（L5）
- `second-variation-index-form` 弧长第二变分与指标形式（L5）
- `sectional-curvature` 截面曲率（L5）
- `space-forms` 空间形式与常曲率空间（L5）

**与 `differential-geometry` 的分工**：后者是曲线曲面论（Frenet、第一/第二基本形式、高斯-博内），本分支从**内蕴/抽象流形**高度讲，只 links 引用不重复。
**主线**：黎曼度量 → 列维-奇维塔联络 → 平行移动与和乐 → 指数映射与单射半径 → 第一变分 → 曲率张量 → 对称性与比安基 → 里奇/数量曲率 → 截面曲率 → 空间形式 → 雅可比场 → 共轭点与割迹 → 第二变分 → Rauch 比较 → Bishop–Gromov → Hopf–Rinow → Cartan–Hadamard → Bonnet–Myers → 爱因斯坦流形与里奇流 → Laplace–Beltrami 与霍奇理论。
**符号约定（重要）**：全库统一 `R(X,Y)Z = ∇_X∇_YZ − ∇_Y∇_XZ − ∇_{[X,Y]}Z`；该约定下球面上 `R_1221 = +sin²θ`、`R_1212 = −sin²θ`，雅可比方程写作 `∇∇J + R(J,γ')γ' = 0`。复核 2 组共抓到 **11 处**。

### 4.26 调和分析 `harmonic-analysis` — Harmonic Analysis（18 个）

- `bmo-space` BMO 空间与 John–Nirenberg 不等式（L5）
- `calderon-zygmund-decomposition` 考尔德伦–齐格蒙德分解（L5）
- `conjugate-function-hilbert` 共轭函数与希尔伯特变换（L5）
- `dirichlet-fejer-kernel` 狄利克雷核与费耶核（L5）
- `fourier-inversion-uniqueness` 傅里叶反演与唯一性（L5）
- `fourier-restriction` 傅里叶限制问题（L5）
- `fourier-series-convergence` 傅里叶级数的收敛性（L5）
- `fourier-transform-l1` L¹ 上的傅里叶变换（L5）
- `fractional-integral-hls` 分数次积分与哈代–李特尔伍德–索伯列夫不等式（L5）
- `hardy-littlewood-maximal` 哈代–李特尔伍德极大算子（L5）
- `hardy-space-h1` 哈代空间 H¹（L5）
- `interpolation-theorems` 插值定理：Riesz–Thorin 与 Marcinkiewicz（L5）
- `littlewood-paley-theory` 李特尔伍德–佩利理论（L5）
- `plancherel-theorem` 普朗歇尔定理（L5）
- `schwartz-space` 施瓦茨空间（L5）
- `singular-integral-operators` 奇异积分算子（L5）
- `uncertainty-principle` 不确定性原理（L5）
- `wavelet-transform` 小波变换（L5）

**主线**：L¹/L² 上的傅里叶变换与反演 → 施瓦茨空间与缓增分布 → 不确定性原理 → 级数收敛（Carleson/吉布斯）→ 狄利克雷与费耶核 → 希尔伯特变换 → HL 极大算子 → 分数次积分与 HLS → 插值定理 → 小波 → CZ 分解 → 奇异积分算子 → H¹ → BMO 与 John–Nirenberg → Littlewood–Paley → 傅里叶限制。
**约定（重要）**：全库统一 `f̂(ξ) = ∫f(x)e^{−2πix·ξ}dx`（2π 在指数里）；涉及该约定的常数（普朗歇尔、不确定性 `1/(4π)`、高斯自对偶 `e^{−πx²}`）都必须与之一致。
**性质**：3 组复核共抓到 **20 处**（其中一条是复核员自身报错——`∫|Ha|` 的取值，经独立数值重算纠正为 `(4/π)log(1+√2)`）。

### 4.27 偏微分方程（进阶） `pde-advanced` — Advanced PDE（14 个）

- `distribution-convolution-fourier` 分布的卷积与傅里叶变换（L5）
- `distribution-derivative` 分布的导数与乘法（L5）
- `distribution-theory` 广义函数与分布（L5）
- `elliptic-regularity` 椭圆正则性与先验估计（L5）
- `fundamental-solution` 基本解（L5）
- `galerkin-energy-estimate` 伽辽金方法与能量估计（L5）
- `heat-regularity` 热方程的正则性与长时行为（L5）
- `hyperbolic-energy-speed` 双曲方程的能量方法与有限传播速度（L5）
- `sobolev-embedding` 索伯列夫嵌入定理（L5）
- `sobolev-trace-compactness` 迹定理与紧嵌入（Rellich–Kondrachov）（L5）
- `variational-direct-method` 变分方法与狄利克雷原理（L5）
- `weak-derivative-sobolev` 弱导数与索伯列夫空间（L5）
- `weak-maximum-principle` 弱最大值原理与霍普夫引理（L5）
- `weak-solution-lax-milgram` 弱解与 Lax–Milgram 定理（L5）

**与 `pde` 的分工**：后者是工科偏微分方程（分离变量、傅里叶解法、达朗贝尔、格林函数），本分支是研究生泛函分析式 PDE，只 links 引用不重复。
**主线**：广义函数与分布 → 分布的导数/卷积/傅里叶变换 → 基本解 → 弱导数与索伯列夫空间 → 嵌入定理 → 迹定理与紧嵌入 → 弱解与 Lax–Milgram → 伽辽金与能量估计 → 椭圆正则性 → 弱最大值原理与 Hopf 引理 → 热方程正则性与长时行为 → 双曲能量与有限传播 → 变分直接方法。
**符号约定**：最大值原理用**无负号**约定 `Lu = a^{ij}∂_i∂_ju + b^i∂_iu + cu`，故假设是 `Lu ≥ 0`（不是 `≤ 0`）；基本解统一用 `−ΔE = δ`（故二维基本解是 `−(1/2π)log|x|`）。
**性质**：2 组复核共抓到 **9 处**。
### 4.28 集合与逻辑 `set-logic` — Sets & Logic（3 个）

- `sets-operations` 集合的概念与运算（L2）
- `sufficient-necessary-condition` 充分条件与必要条件（L2）
- `universal-existential-quantifiers` 全称量词与存在量词（L2）

### 4.29 立体几何 `solid-geometry` — Solid Geometry（7 个）

- `point-line-plane-relations` 空间点、直线、平面的位置关系（L2）
- `spatial-figures` 空间几何体及其结构（L2）
- `spatial-surface-volume` 空间几何体的表面积与体积（L2）
- `line-plane-parallel` 直线、平面平行的判定与性质（L3）
- `line-plane-perpendicular` 直线、平面垂直的判定与性质（L3）
- `spatial-vectors` 空间向量及其运算（L3）
- `spatial-vector-angles` 空间向量与空间角（L4）

### 4.30 计数原理 `combinatorics` — Combinatorics（5 个）

- `combinations` 组合与组合数（L2）
- `counting-principles` 分类加法与分步乘法计数原理（L2）
- `permutations` 排列与排列数（L2）
- `binomial-theorem` 二项式定理（L3）
- `combinatorics-comprehensive` 排列与组合的综合应用（L3）

> **高中补充批次（2026-10-15）**：本轮新增 30 个知识点（`batch75~79`）。除上述三条新分支（集合与逻辑 / 立体几何 / 计数原理）外，还补入 `algebra` 基本不等式与一元二次不等式、`function` 函数模型、`sequence` 数列 5 个（概念·等差·等比·求和·归纳法）、`analytic` 直线与圆·椭圆·双曲线等 6 个、`complex` 复数的三角表示。3 组独立复核共抓到 5 处错误（见 9.13），已全部修正。
### 4.31 线性代数 `linear` — Linear Algebra（49 个）

- `determinant-definition` 行列式的定义（L3）
- `linear-combination` 向量组的线性组合与线性表示（L3）
- `matrix-operations` 矩阵的概念与运算（L3）
- `cofactor-expansion` 代数余子式与展开定理（L4）
- `cramer-rule` 克拉默法则（L4）
- `determinant-properties` 行列式的性质（L4）
- `eigenvalue-eigenvector` 特征值与特征向量（L4）
- `elementary-matrices` 初等变换与初等矩阵（L4）
- `homogeneous-solutions` 齐次线性方程组与基础解系（L4）
- `inner-product-orthogonality` 向量的内积、正交性与施密特正交化（L4）
- `inverse-matrix` 逆矩阵（L4）
- `linear-dependence` 线性相关与线性无关（L4）
- `matrix-powers-polynomials` 方阵的幂与方阵多项式（L4）
- `matrix-rank` 矩阵的秩（L4）
- `nonhomogeneous-solutions` 非齐次线性方程组解的结构（L4）
- `vector-group-rank` 向量组的秩与最大无关组（L4）
- `vector-space-basis` 向量空间 ℝⁿ：基、维数与坐标（L4）
- `basis-change` 基变换与坐标变换（L5）
- `block-matrices` 分块矩阵（L5）
- `determinant-calculation` 行列式的计算技巧（L5）
- `dual-bilinear` 对偶空间与双线性型（L5）
- `eigenvalue-variational` 特征值的变分刻画（L5）
- `generalized-inverse` 广义逆矩阵（Moore–Penrose）（L5）
- `jordan-form` 若尔当标准型初步（L5）
- `lambda-matrix` λ-矩阵与初等因子（L5）
- `linear-space-general` 线性空间：定义与性质（L5）
- `linear-transformation` 线性变换及其矩阵表示（L5）
- `matrix-calculus-chain-rule` 链式法则与反向传播的矩阵公式（L5）
- `matrix-calculus-optimization` 矩阵微分与最优化（L5）
- `matrix-derivative-basics` 矩阵微分：布局约定与基本定义（L5）
- `matrix-differential-rules` 矩阵微分的运算法则（L5）
- `matrix-factorization` 矩阵的 QR 分解与奇异值分解初步（L5）
- `matrix-function-derivatives` 矩阵函数的导数（L5）
- `matrix-functions` 矩阵函数与矩阵指数（L5）
- `matrix-gradient-identities` 常用矩阵梯度公式（迹技巧）（L5）
- `matrix-groups` 矩阵群初步（L5）
- `matrix-similarity-diagonalization` 矩阵的相似与可对角化（L5）
- `matrix-spectral-derivatives` 特征值与奇异值对矩阵的导数（L5）
- `minimal-polynomial` 最小多项式（L5）
- `nonnegative-matrices` 非负矩阵与 Perron–Frobenius 定理（L5）
- `normal-matrices` 正规矩阵与谱定理（L5）
- `positive-definite-inertia` 正定二次型与惯性定理（L5）
- `quadratic-form-standard` 二次型及其标准形（L5）
- `quotient-space` 商空间与第一同构定理（L5）
- `rank-nullity` 线性变换的核、像与维数定理（L5）
- `subspace-sum-direct` 子空间的和、交与直和（L5）
- `sylvester-lyapunov` 矩阵方程：Sylvester 与 Lyapunov（含 Kronecker 积）（L5）
- `symmetric-matrix-diagonalization` 实对称矩阵的对角化（L5）
- `tensor-product` 张量积与多重线性代数（L5）

> **线性代数批次（2026-10-15）**：`batch80~89` 共新增 49 个知识点，覆盖「行列式 → 矩阵 → 向量组与方程组 → 内积·特征值·二次型 → 线性空间与线性变换 → 深水区（λ-矩阵、正规矩阵谱定理、广义逆、Perron–Frobenius、张量积、矩阵群、对偶与双线性）→ 矩阵微分（含反向传播）」。5 轮独立复核共抓到 18 处错误（见 9.14~9.16），已全部修正。





---

### 4.32 数论与拓展 `number` — Number Theory & Beyond（18 个）

- `algebraic-number-theory` 代数数论初步（L5）
- `analytic-number-theory` 解析数论初步（L5）
- `arithmetic-functions` 算术函数与莫比乌斯反演（L5）
- `chinese-remainder-theorem` 中国剩余定理（L4）
- `congruence-basics` 同余及其运算（L3）
- `continued-fractions` 连分数与有理逼近（L4）
- `diophantine-equations` 丢番图方程（L4）
- `divisibility-algorithm` 整除性与带余除法（L2）
- `euler-totient-theorem` 欧拉函数与欧拉定理（L4）
- `fermat-little-theorem` 费马小定理（L4）
- `gcd-euclidean-algorithm` 最大公因数与辗转相除法（L3）
- `linear-congruence` 一次同余方程（L3）
- `p-adic-numbers` p 进数初步（L5）
- `primes-fundamental-theorem` 素数与算术基本定理（L3）
- `primitive-roots` 原根与指数（L5）
- `quadratic-reciprocity` 二次互反律（L5）
- `quadratic-residues` 二次剩余与勒让德符号（L5）
- `rsa-cryptography` 数论与密码学：RSA（L4）

> **数论批次（2026-10-16）**：`batch90~92` 共新增 18 个知识点（初等 6 / 经典 6 / 拓展 6）。3 组独立复核共抓到 10 处错误（见 9.17），已全部修正。**当时 30 条分支全部填充完毕（此后又新增 8 条，见 4.33~4.40）。**

### 4.33 抽象代数 `abstract-algebra` — Abstract Algebra（14 个）


- `field-extension-algebraic` 域扩张与代数元（L5）
- `finite-fields` 有限域（L5）
- `galois-theory-intro` 伽罗瓦理论初步：群与域的对应（L5）
- `group-actions-orbit-stabilizer` 群作用与轨道-稳定子定理（L5）
- `group-definition-examples` 群的定义与例子（L5）
- `group-homomorphism-quotient` 群同态与商群（L5）
- `integral-domain-ufd` 整环与唯一分解环（L5）
- `lagrange-theorem` 拉格朗日定理（L5）
- `modules-intro` 模初步：环上的「线性空间」（L5）
- `polynomial-ring-irreducibility` 多项式环与不可约性（L5）
- `ring-ideal` 环与理想（L5）
- `solvable-groups-radicals` 可解群与五次方程的不可解性（L5）
- `subgroup-coset` 子群与陪集（L5）
- `symmetric-alternating-groups` 对称群与交错群（L5）

> **抽象代数批次（2026-10-16）**：`batch93~95` 共新增 14 个知识点（群论 6 / 环与模 4 / 域与伽罗瓦 4）。3 组独立复核共抓到 8 处错误（见 9.18），已全部修正。


### 4.34 动力系统与分形 `dynamical-systems` — Dynamical Systems & Fractals（8 个）


- `bifurcation-period-doubling` 倍周期分岔与费根鲍姆常数（L5）
- `discrete-maps-cobweb` 离散映射与蛛网图（L4）
- `fractal-dimension` 分形与相似维数（L4）
- `iterated-function-systems` 迭代函数系与分形构造（L4）
- `logistic-map-chaos` 逻辑斯蒂映射与混沌（L5）
- `lorenz-system` 洛伦兹系统与蝴蝶效应（L5）
- `lyapunov-exponent` 李雅普诺夫指数（L4）
- `mandelbrot-julia` 曼德博集与朱利亚集（L5）

> **动力系统与分形批次（2026-10-16）**：`batch96~97` 共新增 8 个知识点（离散混沌 4 / 洛伦兹与分形 4）。1 组独立复核抓到 8 处错误（见 9.18），已全部修正。


### 4.35 特殊函数与数学物理 `special-functions` — Special Functions & Mathematical Physics（8 个）


- `bessel-functions` 贝塞尔函数（L5）
- `beta-function` 贝塔函数与欧拉积分（L4）
- `elliptic-integrals` 椭圆积分（L5）
- `error-function` 误差函数与正态积分（L4）
- `legendre-polynomials` 勒让德多项式（L5）
- `orthogonal-polynomials` 正交多项式族（Hermite·Laguerre·Chebyshev）（L4）
- `spherical-harmonics` 球谐函数（L5）
- `stirling-formula` 斯特林公式与渐近展开（L4）

> **特殊函数与数学物理批次（2026-10-16）**：`batch98~99` 共新增 8 个知识点（积分与渐近 4 / 正交多项式 4）。1 组独立复核抓到 5 处错误（含英文镜像，见 9.18），已全部修正。


### 4.36 统计与数据科学 `statistics` — Statistics & Data Science（8 个）


- `bayesian-inference` 贝叶斯统计推断（L5）
- `bootstrap-resampling` 自助法与重采样（L4）
- `em-algorithm` EM 算法（L5）
- `experimental-design-causality` 实验设计与因果推断初步（L4）
- `fisher-information` 充分统计量与 Fisher 信息（L5）
- `monte-carlo-methods` 蒙特卡洛方法与 MCMC 初步（L5）
- `principal-component-analysis` 主成分分析（L5）
- `time-series-basics` 时间序列初步（L5）

> **统计与数据科学批次（2026-10-16）**：`batch100~101` 共新增 8 个知识点（推断与计算 4 / 重采样与因果 4）。1 组独立复核抓到 2 处错误（见 9.18），已全部修正。


### 4.37 数学史与思想 `math-history` — History & Ideas of Mathematics（8 个）


- `birth-of-probability` 概率论的诞生：从赌局到公理（L4）
- `brouwer-hilbert-controversy` 数学基础之争：逻辑主义·直觉主义·形式主义（L5）
- `cantor-infinity` 康托与无穷：不可数的世界（L4）
- `cubic-quartic-history` 三次方程与四次方程求解史（L4）
- `group-theory-origins` 群论的起源：从拉格朗日到伽罗瓦（L5）
- `hilbert-program-godel` 希尔伯特纲领与哥德尔不完备性（L5）
- `non-euclidean-geometry` 非欧几何的诞生（L4）
- `rigorization-of-analysis` 分析学的严格化：从直觉到 ε–δ（L4）

> **数学史与思想批次（2026-10-16）**：`batch102~103` 共新增 8 个知识点（方程与非欧 4 / 群论与基础危机 4）。1 组独立复核抓到 2 处错误（另 2 处史实精度升级，见 9.18），已全部修正。


### 4.38 图论 `graph-theory` — Graph Theory（9 个）


- `bipartite-matching` 二部图与匹配（L4）
- `euler-hamilton` 欧拉回路与哈密顿回路（L4）
- `graph-basics` 图的基本概念（L3）
- `graph-coloring` 图的染色（L4）
- `network-flow` 网络流：最大流最小割（L4）
- `planar-euler-formula` 平面图与欧拉公式（L4）
- `ramsey-theory` 拉姆齐定理初步（L5）
- `trees-spanning` 树与生成树（L3）
- `turan-extremal-graph-theory` 极值图论与 Turán 定理（L5）

> **图论批次（2026-10-16）**：`batch104~105` 共新增 9 个知识点（基础 5 / 染色·拉姆齐·网络流·Turán 4）。1 组独立复核抓到 3 处错误（见 9.18），已全部修正。


### 4.39 数理逻辑与集合论 `mathematical-logic` — Mathematical Logic & Set Theory（10 个）


- `axiom-of-choice` 选择公理与等价形式（L5）
- `cardinal-arithmetic` 基数算术（L5）
- `compactness-theorem` 紧致性定理（L5）
- `computability-turing` 可计算性与图灵机（L5）
- `formal-proof-systems` 形式系统与形式证明（L4）
- `ordinals-well-ordering` 序数与良序（L5）
- `predicate-logic` 谓词逻辑与量词（L4）
- `propositional-logic` 命题逻辑与真值表（L3）
- `soundness-completeness` 可靠性与完备性（L5）
- `zfc-axioms` 集合论公理（ZFC 初步）（L4）

> **数理逻辑与集合论批次（2026-10-16）**：`batch106~107` 共新增 10 个知识点（命题与一阶逻辑 5 / 集合论与可计算性 5）。1 组独立复核抓到 2 处错误（另 2 处补严，见 9.18），已全部修正。


### 4.40 最优化与运筹 `optimization-or` — Optimization & Operations Research（9 个）


- `convex-optimization` 凸优化问题（L5）
- `convex-sets-functions` 凸集与凸函数（L4）
- `dynamic-programming` 动态规划（L4）
- `game-theory-nash` 博弈论与纳什均衡（L5）
- `gradient-descent-sgd` 梯度下降与随机梯度下降（L4）
- `integer-programming` 整数规划初步（L5）
- `kkt-conditions` KKT 条件（L5）
- `linear-programming` 线性规划与单纯形法（L4）
- `lp-duality` 线性规划对偶理论（L5）

> **最优化与运筹批次（2026-10-16）**：`batch108~109` 共新增 9 个知识点（凸与线性规划 5 / 算法与博弈 4）。1 组独立复核抓到 2 处错误（见 9.18），已全部修正。



## 5. 数据格式

运行时只读 `data/knowledge.json`：

```jsonc
{
  "meta": { "title": "数学知识银河", "version": "2.0" },
  "branches": {
    "calculus": { "name": "微积分", "nameEn": "Calculus", "color": "#d16bff" }
  },
  "nodes": [
    {
      "id": "derivative",              // 全局唯一，小写英文+连字符
      "title": "导数", "titleEn": "Derivative",
      "branch": "calculus",            // 必须是 branches 的键
      "level": 4,                      // 1~5，影响光点大小与离银心距离
      "summary": "…", "summaryEn": "…",
      "definition": "…（支持 **粗体**、`代码`、$行内公式$、$$独立公式$$）",
      "definitionEn": "…",
      "formulas": [{ "latex": "…", "note": "中文说明", "noteEn": "英文说明" }],
      "expression": { "text": "…", "symbol": "…", "note": "…", "noteEn": "…" },
      "properties": ["…"], "propertiesEn": ["…"],   // 中英数量必须一一对应
      "derivation": ["推导第 1 步…", "推导第 2 步…"], // 可选，v=31 起；从 data/derivations/ 叠加
      "derivationEn": ["Step 1…", "Step 2…"],         // 与 derivation 等长
      "plot": { "type": "function", … },            // 可选，见第 6 节
      "examples": [{ "problem": "…", "solution": "…" }],
      "tags": ["…"],
      "links": ["其他知识点的 id"]                   // 必须真实存在
    }
  ]
}
```

**必填字段**：`id, title, titleEn, branch, level, summary, summaryEn, definition,
definitionEn, formulas, properties, propertiesEn, examples, links`

完整规范见 `data/SCHEMA.md`。

---

## 6. 绘图引擎参考

`js/plot.js` 共 12 种图表类型，全部代码实时绘制、矢量清晰、随窗口缩放：

| type | 用途 | 关键字段 |
|---|---|---|
| `function` | 函数图像 | `functions:[{expr,color,label}]`；`fills`（面积填充）、`tangents`（切线）、`xRange/yRange` |
| `geometry` | 平面几何 | `elements:[{type: polygon/segment/point/label/circle/arc/axes}]` |
| `numberline` | 数轴 | `range`、`points`、`intervals` |
| `unitcircle` | 单位圆与三角函数 | `angle`（弧度） |
| `contour` | 二元函数等值线 | `expr`（用 x,y）、`levels`、`levelRange`、`resolution` |
| `vectorfield` | 向量场 / 梯度场 / 相图 | `fx`、`fy`、`contourExpr`（背景等高线）、`marks` |
| `conformal` | 共形映射 | `re`、`im`、`zRange`、`density` |
| `slopefield` | 斜率场 + 解曲线 | `expr`（y'=f(x,y)）、`initial:[{x,y,color,label}]`（自动 RK4 积分画解曲线） |
| `scatter` | 散点图 + 拟合线 | `points`、`lines:[{slope,intercept}]` |
| `quadrature` | 数值积分示意 | `expr`、`from`、`to`、`n`、`method: left/right/midpoint/trapezoid/simpson`（图上自动标近似值） |
| `curve3d` | 3D 曲线 | `x`、`y`、`z`（**变量用 t**）、`tRange`、`frames:[{at}]`（自动算 Frenet 标架画 T/N/B） |
| `surface3d` | 3D 曲面（带光照） | 图形式 `expr`（x,y）；参数式 `surf:{x,y,z}`（**变量用 u,v**）、`uRange/vRange`、`density`、`wire` |

### 表达式求值的坑

1. **变量名固定**：`function/contour/vectorfield/slopefield/scatter` 用 `x`（和 `y`）；`curve3d` 用 `t`；`surface3d` 参数式用 `u,v`
2. **JS 里 `-x**2` 是语法错误** —— 引擎已自动给幂运算底数补括号修复，但新写表达式建议直接写 `-(x^2)`
3. 幂用 `^` 或 `**` 均可；`ln`→`log`、`pi`→`PI`、`e`→`E` 自动转换
4. `xRange` 要避开发散点（如 `sin(1/x)` 在 0 附近）

---

## 7. 内容生成工作流

### 步骤 1：确定范围，先查重

```python
import json
d = json.load(open('data/knowledge.json', encoding='utf-8'))
for n in d['nodes']:
    if n['branch'] == 'calculus': print(n['id'], n['title'])
```

**用户提某个方向时，先扫描已有内容**，明确告知"哪些已有、跳过、新增几个"。避免重复生成。

### 步骤 2：写批次文件 `data/batchNN-<主题>.json`

格式见 `SCHEMA.md`。id 要语义化且全局唯一。

### 步骤 2.5：知识点推导（v=31 起）

推导不写进 `batch*.json`，而是放在 `data/derivations/batchDNN-<主题>.json` 叠加层：

```json
{
  "meta": { "batch": "D02", "topic": "…" },
  "nodes": {
    "node-id": {
      "zh": ["第 1 步…", "第 2 步…", "第 3 步…"],
      "en": ["Step 1…", "Step 2…", "Step 3…"]
    }
  }
}
```

规则：
- 每个条目至少 3 步；`zh` 与 `en` 必须等长、逐步对应，不能只写中文。
- 每步优先写「条件 → 推导 → 结论」；公式用 `$...$` 或 `$$...$$`，中文在数学模式里必须包 `\text{}`。
- 每批 5~7 个知识点；生成后必须另派**独立复核**，重点查条件漏写、蕴含方向、符号约定、英文镜像。
- 未覆盖的节点不显示推导区；**不要用模板批量灌水**。
- 改完依次跑 `python3 data/merge.py` → `python3 data/build_runtime.py`；`katex-check.html` 会同时扫描推导公式。

### 步骤 3：更新 `data/IDLIST.txt`

列出所有已有 id + 本批新 id（子代理靠它校验链接）：

**必须一行一个 id**。早期版本用 `textwrap.fill` 按 100 字宽折行，结果 `levi-civita-connection` 被切成 `levi-civita-` + `connection` 两个 token，已经有代理据此差点写出坏链。另外要**原子写入**（先写临时文件再 `os.replace`），否则正在读它的代理可能看到半截文件。

```python
import json, os, tempfile
d = json.load(open('data/knowledge.json', encoding='utf-8'))
existing = [n['id'] for n in d['nodes']]
new = "id1 id2 id3".split()          # 本批要生成的 id
lines = ["# 所有合法的 links 目标 id（links 只能指向这个列表里的 id，且不能指向自己）",
         "# 格式：一行一个 id，不要折行",
         "", f"## 已有知识点（{len(existing)} 个）", ""] + existing + \
        ["", f"## 本批正在生成（{len(new)} 个）", ""] + new + [""]
txt = "\n".join(lines)
fd, tmp = tempfile.mkstemp(dir='data', suffix='.tmp'); os.close(fd)
open(tmp, 'w', encoding='utf-8').write(txt); os.replace(tmp, 'data/IDLIST.txt')
```

### 步骤 4：派生成子代理（**每批 5~7 个知识点**）

提示词必须包含：
1. 必读 `SCHEMA.md` 与 `IDLIST.txt`
2. 输出文件名（**绝对路径**，并强调"只写这个文件"）
3. 知识点清单：`id | 中文名 | 英文名 | level | 配图建议`
4. **本批的准确性硬性要求**（对照第 9 节错误目录，列出该主题的高危点）
5. 字段要求
6. **自检要求**：写完用 python3 检查 JSON 合法/字段齐全/中英数量一致/链接有效/绘图表达式可求值，**并验算每道例题**
7. 回执要求：**≤8 行**，只报路径、节点数、自检结果、修正了什么

> 单批超过 ~8 个知识点质量会掉（实测有代理写到一半崩掉）。

### 步骤 5：合并校验

```bash
cd data && python3 merge.py
```

必须看到 `错误: 0`。常见报错：`id 重复`、`非法 branch`、`未知 plot.type`、`坏链接`。

### 步骤 6：★ 独立复核（**不要省**）

再派 1~3 个**复核代理**（与生成代理分开），逐条重算：

```
你是严格的数学审校员。逐条检查文件的准确性，找出所有真实错误。
【高危点】……（列该主题易错点）
【输出】JSON 数组：{file, id, field, current, problem, fix}
只报确认的真实错误；没有就输出 []。不报格式问题，不复述正确内容。
```

**这不是走过场**：27 轮累计抓到 **282 处真实错误**，且都是
**数值验算抓不到**的类型（定理条件漏写、蕴含方向写反、符号约定不一致）。

### 步骤 7：修正 → 重新合并 → 复检

用**字面替换**修正（不要用正则替换 LaTeX，反斜杠会被当转义）。注意：
- 含 `'` 的字符串用 Python 双引号包（如 `"$y'$"`）
- LaTeX 里 `\m`、`\g` 在正则是非法转义；用字面替换或 `re.escape()`
- 文本里可能有换行，搜索串要包含或避开
- **中英文措辞不同，两处都要改**

### 步骤 8：浏览器验证

抽样打开知识点，确认公式与配图渲染成功；用穷举法把全库公式交给 KaTeX 渲染，
捕获所有警告（应保持 **0 警告**）。脚本见第 11 节。

---

## 8. 硬规则

| 规则 | 说明 |
|---|---|
| **改 JS 必升版本号** | 改 `js/` 下任何文件后，把 `index.html`、`js/app.js`、`plot-test.html` 里的 `?v=N` 统一 +1（当前 **v=50**）。否则浏览器吃旧缓存，你会以为改动没生效 |
| **改数据不用升版本号** | `knowledge.json` 用 `fetch(..., {cache:"no-cache"})` 加载，每次校验，刷新即生效 |
| **加完必跑合并** | `python3 data/merge.py` |
| **生成前先更新 IDLIST** | 否则链接校验失败 |
| **新分支/新图表类型三处同步** | `data/knowledge.json` 的 `branches`、`data/merge.py` 的白名单、`data/SCHEMA.md` |
| **单批 5~7 个** | 超出质量下降 |
| **不擅自改布局** | 用户明确说过不要移动已有知识点（可提议，先问） |
| **改完要上线** | 内容/代码改完后 `git add -A && git commit -m "…" && git push`，GitHub Pages 约 40 秒后自动重建生效（见 §2.2） |
| **一键发布** | `python3 release.py -m "说明"`：自动升 ?v=N → merge → build_runtime → 提交 → 推送（v=26 起） |
| **改数据要生成分片** | 内容更新后依次跑 `python3 data/merge.py` → `python3 data/build_runtime.py`（生成首屏骨架与详情分片） |

---

## 9. 错误目录（282 处历史教训）

> 生成内容时逐条对照，能避掉大部分坑。

### 9.1 蕴含方向写反（最高频）

| 错误写法 | 正确 |
|---|---|
| 连续必可导 | **可导 ⇒ 连续**，反之不成立 |
| 相关 ⇒ 独立 | **独立 ⇒ 不相关**（ρ=0 推不出独立） |
| 只有独立时 E(XY)=E(X)E(Y) | 独立是充分条件；充要条件是**不相关** |
| a=b ⟺ ac=bc | **c=0 时不成立**；应写 a=b ⟹ ac=bc |
| 闭 ⟺ 闭图像 | 闭图像定理是**图像闭 ⇒ 有界**（不能先设有界） |
| 逐点有界 ⟸ 一致有界 | 一致有界原理是**逐点 ⇒ 一致** |
| 弱收敛 ⇒ 范数收敛 | **范数收敛 ⇒ 弱收敛**，反之不成立 |
| 谱点 ⇒ 特征值 | **特征值 ∈ 谱**，谱点不一定是特征值 |
| 紧算子 ⟸ 有限维 | **恒等算子紧 ⟺ 空间有限维** |
| 闭 ⇒ 恰当 | **恰当 ⇒ 闭**；反向需可缩区域（庞加莱引理） |
| 有 n 位有效数字 ⟺ \|e_r\|≤1/(2a₁)10^{−(n−1)} | 这是**必要**条件；**充分**条件常数是 **1/(2(a₁+1))** |
| 平行 ⇔ 角相等 | **判定（角⇒平行）与性质（平行⇒角）互为逆命题**，方向不能混 |
| 独立 ⟸ 不相关 | **独立 ⇒ 不相关**（方向不能反） |

### 9.2 定理条件漏写/写错

| 定理 | 常被漏掉的条件 |
|---|---|
| 柯西积分定理 | **单连通** + 解析 |
| 乘积测度截面积分公式 | **μ、ν 都 σ 有限** |
| 托内利 vs 富比尼 | 托内利只需 f≥0 可测；富比尼要求 **∫∫\|f\| < ∞** |
| 叶戈罗夫定理 | **有限测度** |
| 控制收敛定理 | **控制函数必须可积** |
| 压缩映射原理 | **完备** + q<1 且与 x,y 无关 |
| 投影定理 | Hilbert 空间（**完备**）+ M 是**闭子空间** |
| Banach–Zaretsky | 需 **连续** + 有界变差 + N 性质 |
| 开映射/闭图像定理 | 需**双巴拿赫空间**；开映射还要**满射** |
| 隐函数定理 | F_z ≠ 0 |
| 牛顿法二阶收敛 | 只在**单根**处；重根退化为线性 |
| Gronwall 引理 | 只需 **β(t) ≥ 0**（α≥0 非必需） |
| 达朗贝尔公式 | ½ 与 1/(2a) 系数、积分区间长 2at |
| 高斯绝妙定理 | 归因于 **Gauss 方程**（不是 Codazzi 方程） |

### 9.3 符号 / 约定不一致

| 问题 | 要点 |
|---|---|
| Frenet 挠率 | τ = (r',r'',r''')/\|r'×r''\|²；**重参数化不变**（变号的是镜像反射，不是 t→−t） |
| 曲面 L、M、N | 符号取决于**法向量取内/外向**，同一文档必须统一 |
| 二阶线性 PDE 判别式 | 是 **B²−AC**（交叉项系数是 2B），不是 B²−4AC |
| 谱半径 | r(T)=lim‖Tⁿ‖^{1/n}；**按绝对值排序**才有 ‖T‖=\|λ₁\| |
| 共轭调和函数 | 关系**不对称**：v 是 u 的共轭，−u 才是 v 的 |
| 中心差商余项 | 是三阶导 **f'''**（不是 f''） |

### 9.4 概念混淆

| 错误 | 正确 |
|---|---|
| "路程 = ∫v dt" | 是**位移**；路程 = ∫\|v\|dt |
| "原点（f_x≠0）是鞍点" | 不是驻点就**不能叫鞍点** |
| "闭而不连续的算子只能定义在**稠密**子空间" | **稠密不是必要条件**（只保证非闭子空间） |
| "无界算子定义域必是稠密真子空间" | 稠密是**约定**，不是定理结论 |
| "鞍结分支是唯一不要求对称性的" | **跨临界分支也不要求** |
| 分数 = "能写成两整数之比" | 那样整数也成了分数，与互斥分类矛盾 |
| "改写 = 去掉末尾 4 个 0" | 是**小数点左移 4 位**；"去末尾 0"只在 0 够多时成立 |
| "线段只有一条对称轴" | **两条**：垂直平分线 + 所在直线 |
| 角平分线逆命题 | 必须限定"**在角的内部**" |
| 高斯映射共形条件 | 需排除**平坦点**（dn=0） |

### 9.5 例证不当 / 答非所问

| 错误 | 正确 |
|---|---|
| 凳子的高约 1 分米 | 1 分米=10cm，凳子约 4 分米；换**粉笔盒** |
| 题问"还需多久"→ 答累计时间 | 要答**剩余时间** |
| 残差平方和 1²+8²+11²=378 | 应为 1²+**16**²+11² |
| 环面 L、N 符号 | 与法向约定不符（该参数化 r_u×r_v 指向内侧） |

### 9.6 工程性坑

| 坑 | 应对 |
|---|---|
| `-x**2` 在 JS 里是语法错误 | 引擎已自动补括号；新表达式写 `-(x^2)` |
| 中文裸露在数学模式 | 包进 `\text{}`（KaTeX 0.16.9 中 `σ` 在 text 模式无字形，用 `\sigma`） |
| 中文下标 `S_{侧}` | 写 `S_{\text{侧}}` |
| 正则替换 LaTeX 报 `bad escape \m` | 用字面替换，或 `re.escape()`；替换串用 `lambda m: new` |
| Python 字符串含 `'` | 用双引号包 |
| 参数曲面用 u,v 但求值器只认 x,y | 用 `buildEvaluator(expr, params, ["u","v"])` |
| 浏览器吃旧缓存 | 改 JS 必升 `?v=N`（当前 v=50） |
| 标签页后台导致检查超时 | 先 focus 保持可见，或抽样检查 |
| `\,^{\circ}` 被 KaTeX 判错 | 空格类命令（`\,` `\;` `\:` `\!` `\quad`）**不能直接加角标**：`\,^{\circ}` 在页面上渲染成红色错误，必须写 `\,{}^{\circ}`（已在旧内容里抓到 5 处） |

### 9.7 拓扑学专属坑（本轮新增 18 处）

| 坑 | 正确写法 |
|---|---|
| 开集公理写反 | 开集：**任意**并 + **有限**交；闭集：**任意**交 + **有限**并（对偶，最容易颠倒） |
| 「紧 ⇒ 闭」漏 Hausdorff | 必须 Hausdorff。**T₁ 不够**：无限集上的余有限拓扑是 T₁，但无限真子集紧而不闭（Sierpiński 空间同理） |
| 道路连通与连通的方向 | 道路连通 ⇒ 连通，**反之不成立**（拓扑学家的正弦曲线）；局部道路连通时两者才一致 |
| 可分与第二可数的关系 | C₂ ⇒ 可分，但**可分 ⇏ C₂**（Sorgenfrey 直线）；只有**度量空间**里 可分 ⟺ C₂ ⟺ Lindelöf |
| 「单点紧化不紧」 | 单点紧化**恒为紧**（构造拉一下覆盖就得到）；它可能不 Hausdorff（如 ℚ*）。要写「X* 紧 Hausdorff」必须先有「X 局部紧 Hausdorff **且不紧**」 |
| 管引理漏条件 | 管引理必须是「**Y 紧** + {x₀}×Y ⊆ W 开」才有 U∋x₀ 使 U×Y ⊆ W |
| 完全正则当成正规 | 完全正则（Tychonoff）**不蕴含正规**，只保证正则 |
| 直线同伦的条件 | H=(1−t)f+t g 只要求 **Y 凸**；星形域要两步（先各自收缩到星心） |
| 覆叠空间提升看错 | 覆叠 p(t)=e^{2πit} 下，γ(t)=e^{2πit} 的提升是 **t**（即 θ(γ(t))/2π），不是 θ(γ(t)) |
| 覆叠分类定理漏条件 | 子群 ↔ 连通覆叠的 Galois 对应要求底空间**半局部单连通** |
| H₁ 与 π₁ 的关系漏条件 | H₁(X) ≅ π₁(X)/[π₁,π₁] 要求 **X 道路连通** |
| 庞加莱对偶漏条件 | 要求**紧致且无边界**（闭）的定向 n-流形 |
| 非交换例子举错 | 环面 T² 的 π₁=ℤ² 本来交换，不能用来说明「顺序有影响」；要举亏格 ≥ 2 的曲面或 S¹∨S¹ |

### 9.8 复分析专属坑（本轮新增 20 处）

| 坑 | 正确写法 |
|---|---|
| Möbius 分类不排除恒等 | **恒等变换**固定每一点、β=4，会污染「1 或 2 个不动点」「抛物型唯一不动点」的结论，必须加「非恒等」 |
| 「收敛圆 = 自然边界」 | **不成立**：1+z+z²+⋯ = 1/(1−z) 除 z=1 外处处可延拓。真正的例子是缺项级数 Σz^{2ᵏ}（Hadamard 缺项定理） |
| 「阶<1 的整函数必有无穷多零点」 | 需限定**超越**（非多项式）：多项式阶为 0，却只有有限多个零点 |
| 极点聚点当成本性奇点 | tan z 在 ∞ 处、1/sin(1/w) 在 w=0 处，奇点本质是**极点的聚点（非孤立奇点）**，不是本性奇点 |
| 皮卡定理假设放宽 | 必须是**本性奇点**，不能写成「非可去」：极点 1/z 在每个去心邻域内就漏掉无穷多个值 |
| SC 变换指数方向写宽 | 「内角越大指数 α−1 越接近 0」**只在凸顶点（内角<π）成立**；凹顶点内角越大指数越大 |
| SC 变换场强奇性指数 | 场强是导数型量，角点附近 ∼ (z−x_k)^{**α_k−1**}，不是 (z−x_k)^{α_k} |
| 哈纳克不等式与泊松核的对应 | 泊松核被 **(1−r/R)/(1+r/R)** 与其倒数夹住，不是 1±r/R |
| 单值化定理抛物型举例 | 抛物型代表是**柱面** ℂ/ℤ ≅ ℂ*；**有界圆环** {1<|z|<R} 属**双曲型** |
| 「全平面能共形映到圆盘」 | 不能——否则有界整函数为常数（刘维尔）。黎曼映射定理的 **D ≠ ℂ** 是本质条件 |
| 调和函数「是解析函数的实部」 | 只在**单连通区域**整体成立；一般区域只是**局部**成立（u=log|z| 在 ℂ∖{0} 上无共轭） |


### 9.9 随机过程专属坑（本轮新增 19 处）

| 坑 | 正确写法 |
|---|---|
| MA(1) 谱的频率方向 | `f(λ) = (1+θ²+2θcosλ)σ²/2π`：**θ>0 时峰在 λ=0（低频占优）**，θ<0 时峰在 λ=π。别凭「差分会放大高频」的印象写反 |
| AR(1) 谱漏 φ 的符号 | AR(1)：**φ>0 时峰在 λ=0，φ<0 时峰在 λ=π**；不能无条件断言低频占优 |
| 「iid 就是白噪声」漏零均值 | 白噪声定义含 Eε_t = 0，必须写「**零均值**、二阶矩有限的 iid」 |
| 「a.s. 收敛需要遍历性」 | **错**。Birkhoff 只需严平稳 + E\|X₁\| < ∞，极限是 E[X₁\|I]；遍历性只保证极限退化为常数 |
| 「非遍历 ⇒ 极限必是随机变量」 | **错**，也可能退化为常数（X_t = (−1)^t cosΘ 的时间平均收敛到 0） |
| 正常返定义漏「先常返」 | 必须**先有 f_ii = 1** 才能谈 μ_i；瞬态也可以有有限的 Σ n·f⁽ⁿ⁾_ii |
| 例题前提与解答自相矛盾 | 有向环链 p⁽ⁿ⁾₁₃ ≡ 0，**极限存在**；真正失效的是「与出发点无关的极限分布」与平稳分布唯一性 |
| **配图公式照搬别的节点** | 三状态链 `P=½I+½C` 的特征值是 `½e^{iπ/3}`（模 ½，复数）而非 ¼；正确解 `μₙ(1)=1/3+(2/3)(1/2)ⁿcos(nπ/3)`。**生成后必须用数值迭代核对曲线** |
| 生灭链 / M-M-1「总是可逆」 | 可逆是相对平稳分布而言；**M/M/1 需 ρ<1** 才有平稳分布。凡「总是可逆」「总满足细致平衡」都要补条件 |
| 杜布分解唯一性的反例 | 「A 可取任意鞅」**举不出来**——从 0 出发的递增鞅必恒为 0。真反例：`X_n = n`、`A_n = n + ½M̃_n` |
| 「伊藤等距反例仅 T=1 时矛盾」 | 非适应 `f_s ≡ W_T` 时 `E\|∫f dW\|² = E[W_T⁴] = 3T²`，与等距的 `T²` **对一切 T>0 都不等**；先破的是鞅性 |
| 吉尔萨诺夫「少了 −½∫θ² 会发散」 | 常数 θ 时 `E_P[exp(−θW_T)] = e^{θ²T/2}` 是**有限值**，问题是 ≠1（不是概率测度），不是发散 |
| GBM 均值与中位数「之差」 | 两者**之比**才是 `e^{σ²t/2}`；之差是 `X₀e^{μt}(1−e^{−σ²t/2})`，含 X₀ 与 μ |
| 包络系数写错 | `∫₀ᵗ(2s+1)²ds = ((2t+1)³−1)/6`；写成 `/3` 会让包络大 √2 倍。**画完要数值对照** |

### 9.10 黎曼几何专属坑（本轮新增 11 处）

| 坑 | 正确写法 |
|---|---|
| **Rauch 比较定理前提不足** | **必须要求 J(0) = J̃(0) = 0**；只给 \|J(0)\| = \|J̃(0)\| 是假命题。反例：`M=S²(1/2)`（K=4）与 `M̃=S²`（K̃=1），取 `J=cos2t`、`J̃=cos t`，t=1.2 处 \|J\| = 0.737 > \|J̃\| = 0.362 |
| 共轭点定义漏 J(0)=0 | 不要求它时，对任意 t₀ 都存在非零雅可比场在 t₀ 取零 ⇒ 每点都成共轭点、重数恒为 n。重数 = 满足 **J(0)=J(t₀)=0** 的空间维数 = `dim ker(d exp_p)_{t₀v}` |
| 联络命题漏 \|ξ\|² | `(∇_X g)(ξ,ξ) = −2⟨X,ξ⟩·\|ξ\|²`；题设只给 ξ≠0 时不能省 |
| 「端点固定」张冠李戴 | 纬线变分的端点随 s 移动，公式仍对是因为 `V ⊥ γ'` 使边界项为零，不是因为端点固定 |
| 爱因斯坦 + Myers 漏「完备」 | Bonnet–Myers 要求**完备**；球面挖去一点仍有 Ric = λg > 0，却既不紧也不完备 |
| Cartan–Hadamard 下 π₁ 应为 0 | 假设含**单连通** ⇒ M 可缩 ⇒ π₁ = 0。亏格 ≥ 2 的闭曲面**不单连通**，不是 Hadamard 流形 |
| 曲率指标的书写次序 | 同一 R(X,Y)Z 下，`R_ijkl = ⟨R(∂_i,∂_j)∂_k, ∂_l⟩` 时球面 `R_1221 = +sin²θ`、`R_1212 = −sin²θ`。**截面曲率分子必须取 `R_XYYX` 型**（即 `K = R_1221/Gram`）；写成 `K = R_1212/det g` 会差一个负号。**里奇必须算出标准正定值（球面 Ric = (n−1)g）**，出现整体符号翻转就要查缩并指标 |
| 对称性「哪条用到什么」张冠李戴 | ① `R(X,Y)Z = −R(Y,X)Z` 对**任何仿射联络**成立（不需要无挠）；**②第一比安基才要求无挠**。③④⑤ 需要度规拉指标 |
| 配图指向错节 | 「这正是本节配图所画的 |K| 等值线」——该图其实在 `ricci-scalar-curvature` 节点。跨节点引用前先核对 plot.type |


### 9.11 调和分析专属坑（本轮新增 20 处）

| 坑 | 正确写法 |
|---|---|
| 傅里叶约定不统一 | 全库统一 `f̂(ξ) = ∫f(x)e^{−2πixξ}dx`。散点：普朗歇尔无常数、不确定性 `Δx·Δξ ≥ 1/(4π)`、自对偶函数是 `e^{−πx²}`（**不是 `e^{−x²}`**）。换角频率约定必须显式声明 |
| 不确定性原理的伸缩系数 | `f_a(x)=f(ax)` 时 `f̂_a(ξ)=(1/a)f̂(ξ/a)`，故 `∫ξ²\|f̂_a\|²dξ = a∫u²\|f̂(u)\|²du`（**是 a，不是 1/a³**）；`1/a³` 只适用于 `x` 侧 |
| 「L¹ 在卷积下不封闭」 | **错**。Young 不等式 `‖f*g‖₁ ≤ ‖f‖₁‖g‖₁` 保证 L¹ 对卷积封闭（它是卷积 Banach 代数）。真正不封闭的是**逐点乘法**，以及 `f ∈ L¹ ⇏ f̂ ∈ L¹` |
| 伸缩与峰值方向 | `g(x)=f(x/2)` ⇒ `ĝ(ξ)=2f̂(2ξ)`：谱变窄、**峰值加倍**（由 1 升到 2）。写成「峰值减半」是另一套归一化约定下的结论 |
| 高斯小波的 `ψ̂(0)` | `ψ=e^{−t²/2}` 时 `ψ̂(0)=∫e^{−t²/2}dt=√(2π)`（**不是 1**），故不可容许、`C_ψ=∞` |
| 连续小波变换是单射还是满射 | **单射不是满射**：`‖W_f‖ = √C_ψ‖f‖₂` 只给等距嵌入，值域是满足再生恒等式的**真**闭子空间（冗余表示）。不能写 onto |
| 连续小波的可容许常数 | `C_ψ = ∫\|ψ̂(ξ)\|²/\|ξ\| dξ`（**分母是 \|ξ\|，不是 \|ξ\|²**） |
| 极大算子的图形与几何 | `B(x,r)` 与区间重叠长度：`x>1, x−1<r≤x+1` 时为 `r−x+1`（**不是 x+1−r**），否则 `A′(r)` 的符号会反 |
| 分数次积分的核与 α 的方向 | 核 `\|x\|^{−(n−α)}`。`α` **越小**核越尖、**尾巴越轻**；`α` 越大核越平、尾巴越重、光滑化越强（别把两个方向写反） |
| H¹ 中函数「平均值为 0」的论证 | 不能默认 `φ(0)≠0`（存在 `∫φ≠0` 但 `φ(0)=0` 的容许核，如 `φ(x)=x₁e^{−\|x−e₁\|²}`）。要么取 `φ(0)≠0`，要么按**尺度 `t=\|x\|`** 论证：`tⁿ(φ_t*f)(tz)→(∫f)φ(z)` |
| BMO 里 `\|x\|` 的平均振荡 | 在 `[−R,R]` 上是 **R/4**（`(1/2R)∫\|x−R/2\|dx`），不是 `R/2`（`R/2` 是均值，不是平均偏差） |
| 「振荡函数不在 BMO」 | **错**。`‖f‖_{BMO} ≤ 2‖f‖_∞` ⇒ `L^∞ ⊂ BMO`，所以 `sin x`、`sin(x²)` **必在** BMO 中。真正不在的是像 `\|x\|` 那样**线性增长**的函数 |
| 限制问题中延拓形式的指数方向 | `δ^{1−3/q} ≲ δ^{1/p}`（`δ→0`）要求指数**越大越好**：`1−3/q ≥ 1/p ⟹ 1/p′ ≥ 3/q ⟹ q ≥ 3p′ = (n+1)/(n−1)p′`（**延拓形式**）。写成 `q ≤ p′/3` 是把限制形式与延拓形式搞混 |
| 限制问题结果的归属 | `ℝ³` 抛物面：**Bourgain–Guth(2011) `q>3+5/17≈3.294`**、**Guth(2016) 多项式分解 `q>3.25`**、**Wang(2022) `q>3+3/13≈3.231`**。顺序与数值都要对 |
| `p=2` 限制失效的反例 | 不能用「`L²` 函数只在 a.e. 意义下有定义」论证（同一理由会否定已证明的 `p<2n/(n+1)` 定理）。正确反例是**量级型集中**：`f̂` 取球心在 `S^{n−1}` 上半径 `δ` 的球的特征函数，比值 `≈δ^{(n−1)/q−n/2}→∞`（`q≥2`） |
| CZ 分解的方体选取 | 必须是**严格** `> λ`（平均恰为 `λ` 的方体不计入）；否则方体列表与 `Σ\|Q_k\| ≤ ‖f‖₁/λ` 的计数都会错 |
| 奇异积分在 `L^∞` 侧的失效方式 | 失效的是**有界性**（`H·1_{[0,1]}` 无界），**不是局部可积性**：由 `T: L^∞→BMO` 与 `BMO ⊂ L^p_loc`，`Tf` 永远局部可积 |

### 9.12 PDE 进阶专属坑（本轮新增 9 处）

| 坑 | 正确写法 |
|---|---|
| **最大值原理的符号取决于算子约定** | 本库用**无负号**约定 `Lu = a^{ij}∂_i∂_ju + b^i∂_iu + cu`：内部极大点处恒有 `Lu ≤ 0`，故假设必须是 **`Lu ≥ 0`（`c ≤ 0`）⇒ 最大值在边界**。若改用 Evans 的 `Lu = −a^{ij}∂_i∂_ju + …` 约定，才写作 `Lu ≤ 0` |
| 弱最大值原理的两种情形 | `c = 0` 时是等式 `max_Ω̄ u = max_∂Ω u`；`c ≤ 0` 时要写成 `sup_Ω u ≤ sup_∂Ω u⁺`（**不能混**） |
| 索伯列夫嵌入的必要条件方向 | `n/q < n/p − 1 ⟺ 1/q < 1/p − 1/n = 1/p*` **⟺ q > p\***（不是 `q < p*`）。`p* = np/(n−p)` |
| 迹的指数损失 | `T: W^{1,p}(Ω) → W^{1−1/p,p}(∂Ω)`，损失的恰是 **1/p**，与 `n` 无关 |
| 紧嵌入的严格性 | Rellich–Kondrachov 要求 **`q < p*` 严格**；取等号只有连续嵌入、不紧 |
| 伽辽金离散矩阵的对称性 | 由强制性只能得 `A_m` **正定**；`(A_m)_{ij}=a(φ_j,φ_i)`，**只有 `a` 对称时**才对称正定（`CG` 也才可用，否则用 GMRES） |
| 椭圆正则性提升的阶数 | `f ∈ H^k ⇒ u ∈ H^{k+2}`（**提升 2 阶**，不是任意阶）；先验估计右端**必须同时含 `f` 与 `u` 的低阶范数** |
| 分布卷积的单位元 | `δ * a = a`（对一切分布 `a`）。写成 `δ * a = δ` 只在 `a = δ` 时成立 |
| 二维拉普拉斯基本解的符号 | 在 `−ΔE = δ` 约定下是 **`E = −(1/2π)log\|x\|`**（`Δ(log\|x\|) = 2πδ`）；`+(1/2π)log\|x\|` 对应 `ΔE = δ` 约定。全篇符号必须配套 |
| 分布导数的边界项 | `⟨∂^α u, φ⟩ = (−1)^{|α|}⟨u, ∂^α φ⟩`；用 `[f]_a^b = f(b) − f(a)` 时别把端点项符号写反（`[−xφ]_{−1}^0 = −φ(−1)`） |
| 热方程卷积解的增长条件 | `\|u₀\| ≤ e^{C\|x\|²}` 时卷积收敛要求 **`C < 1/(4t)`**（固定 `[0,T]` 则 `C < 1/(4T)`）；取 `u₀=e^{A\|x\|²}` 的解恰在 `t=1/(4A)` 爆破 |
| 热解解析延拓的「型」与「带宽」 | `\|u(z,t)\| ≤ (4πt)^{−n/2}\|u₀\|₁e^{\|\operatorname{Im}z\|²/(4t)}` 里 `1/(4t)` 是**指数型系数**；解析**带宽**是 `~√t` 且随时间**增长**（不要混） |
| 双曲方程的能量守恒 | `E = ½∫(u_t² + \|∇u\|²)`，`E′ = 0`（**两项都是加号，是守恒不是耗散**）。Huygens：**奇数维 `n ≥ 3`**；`n = 1` 是退化情形（`u₁` 项要对整个区间积分）；二维用 Hadamard 降维公式，`∂_t` 作用在 `u₀` 的圆盘积分上 |
| 波动方程例题的边界条件 | `sin(kx)cos(kt)` 满足**周期**边界，**不满足**齐次 Neumann（`u_x(0,t)=k cos(kt) ≠ 0`）；要演示 Neumann 应换 `cos(kx)cos(kt)` |

### 9.13 高中补充专属坑（2026-10-15 新增 5 处）

| 坑 | 正确写法 |
|---|---|
| 等差数列 Sₙ 最大值判据漏 a₍ₙ₊₁₎=0 | 写「a_n ≥ 0 且 a_{n+1} < 0」会漏掉 a_{n+1}=0（此时 S_n=S_{n+1}，两处同时最大）；应为 **a_n ≥ 0 且 a_{n+1} ≤ 0**，只有最大值点唯一时才用严格不等号 |
| 归纳法推导起点时反例没逐个验算 | 说明「从 n=5 起步」时把 n=1 误列为不成立（2¹ > 1² 其实成立）；列反例必须逐项验算起点之前的整段（此处不成立的是 n=2、3、4） |
| 中点弦存在性误推广 | 「中点在内部区域内」只对椭圆成立；双曲线须 **x₀²/a² − y₀²/b² > 1**（弦在同一支上）或 **< 0**（弦连接两支），0 ≤ 该值 ≤ 1 时这样的弦不存在 |
| 直线与双曲线「只有一个公共点」漏退化情形 | 方程退化为一次式（直线与渐近线**平行**）才有唯一交点；直线恰好**是**渐近线本身时退化方程无解、零交点（二次项与一次项系数同时为 0） |
| 向量证平行/垂直的条件张冠李戴 | 方向向量共线只能得「平行**或重合**」——排除重合是**平行**判定要补的条件；垂直（数量积为 0）不需要、也不可能重合 |
### 9.14 线性代数专属坑（3 轮复核新增 6 处）

| 坑 | 正确写法 |
|---|---|
| 范德蒙德行列式的等比结构在列上 | 第 j 列是 1, xⱼ, xⱼ², …（公比 xⱼ）；「各行成等比」是错的（行是各次幂，首行为 1） |
| 「系数取不同值 ⇒ 组合不同」欠前提 | 只在线性无关时成立；相关时不同系数可能给出同一向量 |
| 「换基坐标就会不同」欠「一般」 | 零向量在任何基下坐标都不变，非零向量也可能不变——必须写「一般不同」 |
| 惯性指数数反 | 特征值 t+1, t+1, t−2 在 −1<t<1 时为两个正、一个负：p=2、q=1 |
| 「λ≠0（即 A 可逆）」方向过强 | 单个特征值非零推不出可逆（反例 diag(1,0)）；A 可逆 ⟺ 全部特征值非零 |
| 若尔当标准型里 λᵢ 的「重复次数」 | 是若尔当块的个数（=几何重数），不是「按代数重数出现」；重数由块的阶数和承载 |

### 9.15 深水区专属坑（新增 5 处）

| 坑 | 正确写法 |
|---|---|
| 「e^{A+B}=e^Ae^B **仅当** AB=BA」 | 「仅当」是假命题（指数映射不单射，存在反例）；AB=BA 只是充分条件 |
| e^{A} 与 e^{tA} 混同 | 基解矩阵是 e^{tA}（d/dt·e^{tA}=Ae^{tA}）；e^A 是 t=1 处的取值 |
| 「交错链五个不等式」 | 3+2 个特征值的交错链只有 **4 个**不等式（数数错误） |
| 「α⊗β=0 未必意味着因子为 0」 | 域上的线性空间里是假命题（那是环上模的现象，如 ℤ/2⊗ℤ/3=0）；应为 ⟺ 某因子为 0 |
| (S°)°=ι(S) 漏「有限维」 | 无限维只有 ⊇ 方向；取等号需 dim V<∞ |

### 9.16 矩阵微分专属坑（新增 7 处）

| 坑 | 正确写法 |
|---|---|
| 布局归属张冠李戴 | 默认分子布局的是 Wikipedia 等文献引言；《Matrix Cookbook》的**标量**导数与分母/梯度约定同形、可直接照用 |
| 「全库统一分母布局」不严谨 | 标量导数按分母布局，但 m×n 雅可比严格属「分子/雅可比布局」——整体应称**混合布局**并分别说明 |
| 「(X⁻²dX 之类) 形状上也不对」 | 形状其实相同（方阵）；错的是因子顺序与数值 |
| 「（梯度都与 x 同型）」套在 ∂(Ax)/∂x=A 上 | A 是 m×n 雅可比矩阵，一般与 x 不同型 |
| 「解对生成元的导数」说反 | d/dt·e^{tA}=Ae^{tA} 是解对**时间**的导数；生成元 A 是解在 t=0 处的导数 |
| 广播方向与公式自相矛盾 | 「复制到每一列」对应按列求和；「按行复制」才是 b̄ⱼ=Σᵢ——描述与公式必须逐一对应 |
| 反向传播统一起点漏梯度横杠 | 是 dL=tr(Z̄ᵀdZ)，不是 tr(ZᵀdZ) |

---

### 9.17 数论专属坑（3 组复核新增 10 处，2026-10-16）

| 坑 | 正确写法 |
|---|---|
| 二次剩余定义漏前提 `p∤a`（摘要+正文、中英 4 处连坐） | 必须写「模奇素数 $p$，**$p\nmid a$** 且 $x^2\equiv a\pmod p$ 有解」；否则 $a\equiv0$ 时 $x=0$ 使方程有解，$0$ 也被算作二次剩余，与勒让德符号 $(a/p)=0$ 的约定及「恰有 $(p-1)/2$ 个」的计数矛盾 |
| 勒让德符号取值漏条件 | $a^{(p-1)/2}\equiv\pm1$ 只在 $p\nmid a$ 时成立（$p\mid a$ 时为 $0$）；所引的费马小定理本身就要求 $\gcd(a,p)=1$ |
| 连分数「最佳逼近」两类性质混淆（属性+例题 2 处） | 「分母小于 $q_{k+1}$ 的分数都不比 $p_k/q_k$ 更接近 $x$」是**假**命题（$\sqrt2$：$140/99$ 比 $99/70$ 更近，而 $99<169$）。正解：第二类 $|q_kx-p_k|<|qx-p|$ 对一切 $0<q<q_{k+1}$；用「更接近 $x$」（第一类）表述时阈值须是分母 $\le q_k$。Legendre 判据（误差 $<1/(2q^2)$ 必为渐近分数）不受影响 |
| 「奇素数 $\iff p=2$ 或 $p\equiv1\pmod4$」自相矛盾 | 二平方和定理完整写法：$p=x^2+y^2$（$p$ 为素数）$\iff p=2$ 或 $p\equiv1\pmod4$——「奇素数」与「$p=2$」只能留一个 |
| 高斯整数中 $2$ 的分解写错 | $2=-i(1+i)^2$（原把 $2$ 误写成 $\pi$；若要用 $\pi$，应是 $\pi=1+i$ 及其相伴元） |
| 欧几里得引理逆方向缺前提 | 「$p$ 为素数 $\iff p\mid ab\Rightarrow p\mid a$ 或 $p\mid b$」需限定 **$p>1$**（$p=1$ 或 $0$ 时右端恒真） |
| 中国剩余定理中 $M_i$ 角色误称 | $M_i$ 只是模 $m_i$ 下的**可逆元（单位）**，其逆元为 $t_i$；在模 $m_i$ 下 $\equiv1$ 的是乘积 $M_it_i$，不是 $M_i$ 本身（「单位元」指 $1$） |

> 分布：二次剩余 4、连分数 2、代数数论 2、素数 1、中国剩余定理 1，共 **10 处**——全部为「前提漏写 / 概念误称」类，数值验算抓不到，再次印证独立复核的必要性。

### 9.18 全库审计与新增科目精选坑（2026-10-16 深夜）

> **全库审计**（11 组独立复核扫旧节点）抓到 59 处，**三轮新科目**（74 个新节点 + 配图轮）复核抓到 32+10 处，均已修正。以下为最具代表性的坑（完整清单见各轮复核记录）。

| 坑 | 正确写法 |
|---|---|
| 雅可比换元积分区域记号 $\iint_D$ | 换元后被积式活在参数平面，应写 $\iint_{D'}$（与节点自身记号、积分限一致） |
| 「0 在最左边」 | 只在自然数范围内成立；数轴 0 左侧还有负数 |
| 四舍五入「保留到哪一位、看到哪一位」 | 是「保留到哪一位，就**看这一位的下一位**」 |
| 「认识亿以内的数」却又含亿级 | 改为「认识大数」 |
| 「有最大最小值 ⇒ 值域 $[m,M]$」 | 需**连续**（反例：阶梯函数）；零点存在定理同样需连续 |
| 「两直线平行 ⇔ 斜率相等」 | 需 **$b_1\ne b_2$**（否则重合） |
| 「$e^x$ 是唯一导数为自身的函数」 | 一般解 $y=Ce^x$；在 $a^x$ 中唯 $a=e$ |
| $E(XY)=E(X)E(Y)$「requires independence」（英文） | 充要条件是不相关 $\operatorname{Cov}=0$；独立只是充分条件 |
| Gronwall 引理「$\alpha\ge0$ 不可省」 | 只有 $\beta\ge0$ 不可省；结论对任意实数 $\alpha$ 成立 |
| 测地线「等价于速率为常数」 | 方向反了：测地线 ⇒ 速率常数；反之不成立（球面纬圆） |
| 极小曲面 $H\equiv0$「面积局部最小」 | 是驻点；最小需二阶变分非负（悬链面反例） |
| 单位球弱紧归因 Eberlein–Šmulian | 弱紧是 Kakutani；E–Š 负责「弱紧 ⇔ 弱序列紧」 |
| $\mathbb{R}^n$ 紧⇒有界用覆盖 $\{(-m,m)\}$ | $n\ge2$ 时不是开覆盖；用 $B(0,m)$ |
| $\mathbb{Z}$ 在 $\mathbb{R}$ 中有无穷多聚点 | 反了：$\mathbb{Z}$ 无聚点；「无处稠密 ≠ 无聚点」应配 Cantor 集 |
| 覆盖空间 Galois 对应漏「半局部单连通」 | 子群→连通覆叠方向需要它；覆叠→子群方向恒有定义 |
| 7 顶点克莱因瓶 | 不存在：克莱因瓶剖分至少需 8 顶点（Franklin 定理） |
| $V_4\cong\mathbb{Z}_2$ | $V_4\cong\mathbb{Z}_2\times\mathbb{Z}_2$（无 4 阶元）；$S_4$ 可解链的商别写错 |
| Eisenstein 验算漏「$p\mid a_0$」 | 常数项必须被 $p$ 整除但不被 $p^2$ 整除；$x^4+1$ 需换元 $(x+1)^4+1$ |
| 「导出列在主群停住」 | 应为「在 $A_n$ 停住」 |
| 倍周期 $\sigma_{12}$ 序号错位 | $\sigma_{12}\approx3.569945604$（$3.569945657$ 是 $\sigma_{13}$） |
| 「瑞利–贝努埃对流」 | 瑞利–**贝纳德**对流（Bénard） |
| 「$|z|>2$ 必逃逸」缺前提 | 对 $|c|\le2$ 成立；$c=-2.5$ 有界反例 |
| $c=-1$ 叫「兔形」朱利亚集 | $c=-1$ 是 basilica；兔形对应 $c\approx-0.1226+0.7449i$ |
| 欧拉公式等号刻画漏「连通」 | 反例：三角形+孤立点；「每面≥3 边」推导同样需连通 |
| Ore 定理漏 $n\ge3$ | $n=2$ 时条件空洞成立却无哈密顿回路 |
| 「直接替换得 $\exists y(y>y)$（恒假）」 | 是偶然式：论域与解释可使其为真 |
| 凸优化配图用**正**梯度却称「指向极小点」 | 应画 $-\nabla f$（v=26 起站内约定：负梯度配「下降/指向极小」） |
| 配图 fills「两曲线之间」 | 引擎语义是「曲线 ↔ 水平线 base」；应传**上方曲线+base=下方**（SCHEMA 已改准） |

## 10. 遗留工作

### 内容缺口（已清空）

> **已完成**：拓扑学（24，`batch53~56`）、复分析专业深度版（24，`batch57~60`）、
> 随机过程（24，`batch61~64`）、黎曼几何（20，`batch65~68`）、
> 调和分析（18，`batch69~71`）、PDE 进阶（14，`batch72~74`）——均于 2026-10-14 完成；
> 高中补充（30，`batch75~79`）、线性代数（49，`batch80~89`）—— 2026-10-15 完成；
> 数论与拓展（18，`batch90~92`）—— 2026-10-16 完成；
> **抽象代数（14，`batch93~95`）、动力系统与分形（8，`batch96~97`）、特殊函数与数学物理（8，`batch98~99`）、
> 统计与数据科学（8，`batch100~101`）、数学史与思想（8，`batch102~103`）、图论（9，`batch104~105`）、
> 数理逻辑与集合论（10，`batch106~107`）、最优化与运筹（9，`batch108~109`）—— 均于 2026-10-16 完成。
> 至此全部 38 条分支填充完毕。**

高中补充实际落地 30 个：集合与逻辑（新分支 3）、不等式（2）、数列（5）、解析几何（6）、
立体几何（新分支 7）、计数原理（新分支 5）、复数的三角表示（1）、函数模型（1）。
导数初步与统计案例经查重确认已被现有 `calculus`（33 个）与 `probability`（23 个）覆盖，故未重复生成。

线性代数 49 个（`batch80~89`）：行列式（5）、矩阵（5）、向量组与线性方程组（6）、内积·特征值与二次型（6）、线性空间与线性变换（6）、深水区与补缺（14）、矩阵微分（7，含反向传播）。5 轮独立复核共抓到 18 处错误（见 9.14~9.16），已全部修正。

数论 18 个（`batch90~92`）：初等数论（整除与带余除法、辗转相除、算术基本定理、同余、一次同余、中国剩余定理）、经典定理（欧拉定理、费马小定理、原根、二次剩余、二次互反律、算术函数）、拓展一瞥（丢番图方程、连分数、p 进数、代数数论、解析数论、RSA）。3 组独立复核共抓到 10 处错误（见 9.17），已全部修正。

### 空分支

- ~~`linear` 线性代数~~ —— 已于 2026-10-15 完成（49 个，`batch80~89`，见 4.31）
- ~~`number` 数论与拓展~~ —— **已于 2026-10-16 完成（18 个，`batch90~92`，见 4.32）**；至此 **38/38 分支全部填充，内容缺口清零** ✅

### 布局优化（**已实施**，2026-10-14）

**问题**：银河看起来不均匀——知识点多的臂密，少的臂（如解析几何 1 个点）拖一条长空弧。

**根因**：`js/app.js` 的 `computePositions()` 里 `sweep = min(3.6, 2.0 + n*0.05)`，
即每条臂扫过 117°~206°，与节点数关系不大。

**已实施的改法**：三个尺寸参数都随节点数 `n` 缩放（`t = n / maxN`）——

```js
const sweep      = Math.min(3.2, 0.28 + n * 0.086);  // 22°~183°
const radius0    = 26 + (1 - t) * 36;                // 点少 ⇒ 内端外移
const radialSpan = 42 + Math.min(74, n * 2.0);       // 44~116
```

角度抖动从 ±0.16 收到 ±0.10。同时**改 `js/` 就要升 `?v=N`**（现为 **v=50**）。

**注意**：这会重新排布所有点（内容与分支归属不变）。用户已于 2026-10-14 明确授权。

**2026-10-15 追加交互优化（v=9→v=10）**：分支面板限高（约 10 项）与滚动、分支列表按难易排序（仅列表；旋臂分配顺序未动）、相机阻尼 0.055→0.15、缩放锚定鼠标（zoomToCursor）。

**2026-10-16 深夜批次（v=19→v=26）**：首屏骨架+详情分片+本地 vendor（v=19）；新增八个科目分支——抽象代数、动力系统与分形（v=20）、特殊函数与数学物理、统计与数据科学、数学史与思想（v=21）、图论、数理逻辑与集合论、最优化与运筹（v=22），共 74 个新节点；学习路线导览、深链接分享、搜索脉冲、旋臂名称标签（v=23~25）；移动端适配（v=26）；配图补全 45 张（覆盖 68%→75%）；`release.py` 一键发布；搜索记录折叠/清除、底部按钮收纳与旋臂标签开关（v=27~28，即时响应）。

**2026-10-19 知识共鸣批次（v=29）**：不再新增知识点，做代码层的交互升级——
- **星体微动**：`stars.js` 顶点着色器加入极慢、极小的三轴漂移；每个点相位不同，布局轮廓不变。相机贴近时自动收小振幅，避免与静态连线端点错位。
- **能量脉冲**：少量光点沿已有连线飞行（随机、低亮度、最多 4 个并发）；悬停知识点时，沿它的连线放出 1~2 个脉冲，并让直接相邻的知识点轻微提亮。
- **知识共鸣模式**（按钮 / `R` 键）：点两颗星，程序在链接图上求最短知识链；两颗星的光环与投影沿弧线相撞，迸发涟漪，然后给出**碰撞结果**——直接相邻时取「共同关联」中难度最接近、连接度最高的桥点；跨分支时取最短链的中点。点击结果即可继续探索。
- **画面整洁**：共鸣模式暂停自转、收起旋臂标签；结果卡默认只显示核心信息，长知识链可横向滑动；搜索空结果框的显示 bug 一并修复。
- **拾取升级**：由射线拾取改为屏幕空间「画面上最近的光点」，银河中心密集区点选更准；单次拾取约 0.03 ms。

**2026-10-19 推导卡批次（v=30）**：给「知识共鸣」的结果补上可核对的推导，而不是只给一个结论——
- **图结构推导**：直接相邻时列出 `N(A)∩N(B)`、难度差与连接度排名；跨分支时列出 BFS 分层计数、最短跳数与中点位置。这部分是严格可复核的。
- **数学联系**：`data/resonance-notes.json` 内置 13 条结果级注记 + 8 条 pair 级注记，含定理陈述、推导步骤、适用条件与反例。例如「导数 × 定积分 → 微积分基本定理」会给出变上限积分求导与牛顿–莱布尼茨公式的完整推导。
- **概念对照与核心公式**：结果卡按需读取详情分片，展示 A/B/结果三条目的摘要与结果条目的第一条核心公式；公式由 KaTeX 渲染。
- **诚实边界**：没有精选注记的组合只显示结构推导 + 概念摘要，并明确声明「图谱相邻不等同于定理级蕴含」，不凭空编造证明。
- **交互**：结果卡点「为什么是这个结果？」进入推导视图，顶部「← 返回结果」退回；推导视图只显示推导内容，避免与结果摘要挤在一起。

**2026-10-19 知识点推导批次（v=31 起；v=32 扩到线性代数）**：把「推导」从共鸣结果卡扩展到每个知识点的详情面板——
- **叠加层**：新增 `data/derivations/*.json`，按 id 给节点附加 `derivation` / `derivationEn` 两个等长数组；不修改 110 个 `batch*.json`。首批文件 `D01-calculus-core.json`。
- **数据管线**：`merge.py` 校验 id 存在、中英步骤等长、每步非空、至少 3 步；`build_runtime.py` 把推导放进详情分片，首屏骨架不加载；`katex-check.html` 同步扫描推导中的公式。
- **面板**：新增「推导 / Derivation」区，按步骤编号、KaTeX 渲染、默认展开、可折叠；中英切换同步。
- **D01~D05（微积分 33/33）**：极限/连续、导数/微分/曲率、积分方法/应用、积分几何/物理。
- **D06~D12（线性代数 49/49）**：行列式与矩阵、初等变换/秩/分块、向量组与方程组、特征值/若尔当、二次型/对偶/张量、线性空间/变换、矩阵微分。
- **D13~D20（概率统计 23 + 函数 22）**：概率基础与常见分布、极限定理与抽样推断、回归/随机变量函数；函数概念与性质、幂指对、图像与模型。
- **D21~D27（小学 30 + 代数 8 + 平面几何 11）**：数位/四则/分数小数百分数/单位/面积体积；方程与不等式/二次方程；全等相似/四边形/圆/三视图/坐标。
- **D28~D35（三角 23 + 数列 12 + 解析几何 7 + 计数原理 5）**：弧度/单位圆/三角函数图像与恒等变换/正余弦定理；等差等比/求和/归纳法/级数；直线圆圆锥曲线；排列组合/二项式定理。
- **D36~D43（多元微积分 22 + 复变 28）**：多元极限/偏导/全微分/链式法则/重积分/线面积分/三大公式；复平面/CR 方程/复积分/柯西定理与公式/级数/留数/辐角原理/积分变换。
- **D44~D52（常微分方程 26 + 偏微分方程 14 + 数值分析 15）**：一阶方程/线性方程与系统/存在唯一性、稳定性与 Lyapunov/相平面、极限环、分支与混沌、边值、幂级数；PDE 分类、特征线、波动/热/拉普拉斯、分离变量、达朗贝尔、Sturm–Liouville、格林函数、最大值原理、适定性；误差、求根、直接/迭代解法、插值样条、最小二乘、数值微积分、高斯求积、条件数、Euler/RK、收敛与稳定性。
- **D53~D59（实变分析 20 + 泛函分析 18）**：σ 代数/外测度/可测集/测度/可测函数；简单函数逼近/a.e. 与依测度收敛/Egorov/Lusin；勒贝格积分三大收敛定理/黎曼对比/Lp；乘积测度/Fubini–Tonelli/BV/AC/勒贝格微分；度量/完备/压缩映射/赋范/巴拿赫/内积/投影；正交基/有界算子/对偶/Hahn–Banach/开映射/闭图像；紧算子/谱/谱定理/无界算子/弱收敛/Fredholm。
- **D60~D63（拓扑 24/24）**：拓扑空间/基/闭包/连续与同胚/子空间积商/分离公理；紧致性/度量紧性/连通性/可数性/Tychonoff/局部紧化；同伦/基本群/圆周基本群/覆叠/van Kampen/Brouwer；单纯复形/单纯同调/同调群/Euler 示性数/曲面分类/de Rham 上同调。
- 独立复核累计抓到 107 处以上条件/表述问题（D44~D63 又修正 60 余处，包括端点爆破误判、比较定理连通分支、Rayleigh 商 Robin 边界项、有效数字分母、Heun 二阶光滑性、Hopf 非退化条件、BV 等号刻画、谱定理预解界、开映射的 X/Y 完备性、拓扑子空间内部、覆叠定义、单纯复形几何实现等），修正后全部复检 0 错误。
- **覆盖进度**：390/641（微积分 33 + 线性代数 49 + 概率统计 23 + 函数 22 + 小学 30 + 代数 8 + 平面几何 11 + 三角 23 + 数列 12 + 解析几何 7 + 计数原理 5 + 多元微积分 22 + 复变 28 + 常微分方程 26 + 偏微分方程 14 + 数值分析 15 + 实变分析 20 + 泛函分析 18 + 拓扑 24）。剩余按 5~7 个/批推进，每批必须独立复核；未覆盖节点不显示推导区，**不用模板灌水**。

**2026-10-19 星体视觉优化（v=33→v=41）**：只改 `stars.js` 的星点着色器与 `app.js` 的星点参数，不动布局、不动数据——
- **三层星体**：白热核 + 分支色内晕 + 冷色外晕；外晕增加边缘淡出，避免近景出现硬边圆盘。
- **分级星芒**：L5 才有明显的主星芒 + 对角星芒，L4 只有主星芒，L3 很弱，L1/L2 无星芒；每颗星按自己的旋转角绘制，不再全是正十字。
- **亮度分层**：大小与亮度按等级和确定性随机种子形成幂律分布，低等级星降饱和、退到背景，高等级星保留分支色与白色核心。
- **双频闪烁**：快频 + 慢频叠加，少量亮星偶发微闪；`prefers-reduced-motion` 时关闭闪烁与微闪。
- **悬停反馈**：只做轻微亮度增强，移除了会在大尺度下形成巨大圆环的常驻 hover ring。
- **背景分层与差速**：远景星壳、银盘星尘、星系晕、深空微尘四层各有不同尺寸/透明度与极慢自转速度；银盘星尘几乎不动，保持与知识点旋臂对齐。
- **尘埃带与星云丝**：新增 3 片暗色尘埃带（正常混合压暗核球）和 2 条很淡的冷色星云丝，增加盘面纵深感。
- **连线亮度**：最终基础不透明度 $0.19$（从 $0.34$ 累计降低约 44%，在 $0.22$ 基础上再弱约 14%）；端点形状保持 $0.55$，两端比旧版更清晰，整体仍低于悬停/共鸣高亮。
- **性能**：仍是单 `Points`、单 draw call；实测 60fps，Lighthouse 100/100/100。

**2026-10-21 深空视觉 v8（v=50）**：不改布局、不改知识点位置、不改任何交互，只重做「空间、材质、光、界面」——
- **极简深空**：移除星云、气体盘、银河带、远景星系和所有外围大型结构；只保留暗色深空、约 1.97 万颗背景星、641 颗知识点星体与很淡的核心光。
- **银河差速流动**：知识点与连线在 GPU 中按半径差速自转，内侧角速度约 $0.032$ rad/s、外侧约 $0.013$ rad/s；背景星层以负速度反向漂移，形成两个方向的流动。
- **星点**：白/金/蓝色温分层，高等级星保留柔和星芒；不再额外堆叠密集星团。
- **连线**：可见但克制的蓝灰色因果连线（基础不透明度 0.105），与知识点使用同一差速公式；内侧带动外侧、端点始终相连，拾取/飞行/旋臂标签同步使用当前流动位置。
- **UI**：保留深空玻璃 + 仪表细线，但压低大面积发光；面板、搜索、图例、按钮统一暗色。
- **性能**：单 Points 星点、无后处理、无星云 draw call；实测 60fps，Lighthouse 100/100/100。

**2026-10-16 交互美化与公网上线（v=11→v=18）**：面板等级徽章（L# ★）、「← 返回上一个」、例题折叠「看解答」、公式一键复制 LaTeX、光点呼吸明暗、悬停高亮链接路径、银河入场渐显绽放、搜索键盘导航（↑↓/Enter/Esc）、「随机漫游」按钮、分支旋臂脊线；星空加密至 19,700 背景星 + 700 微粒。**暗区公式雾气（v=16~17）试做后于 v=18 整体撤除**（用户判定不符预期；星星密度保留）。公网部署见 §2.2。

### 已知技术债

- Three.js / KaTeX 已本地化到 `vendor/`，不再依赖 CDN；但仍是静态站点，没有 Service Worker，断网后无法离线打开
- 首屏骨架 764 KB、详情分片共 6.0 MB（38 片）；移动端弱网下首次加载仍有优化空间
- ~~「发文件给别人」不能双击打开（CORS）~~ —— **已由 GitHub Pages 部署解决（2026-10-16，见 §2.2）**；本地开发仍用 `python3 -m http.server 8123`

---

## 11. 常用脚本

### 11.1 结构校验

```python
import json
d = json.load(open('data/knowledge.json', encoding='utf-8'))
nodes = d['nodes']; ids = {n['id'] for n in nodes}
REQ = ['id','title','titleEn','branch','level','summary','summaryEn',
       'definition','definitionEn','formulas','properties','propertiesEn','examples','links']
bad = []
for n in nodes:
    for k in REQ:
        if not n.get(k): bad.append(f"{n['id']}:缺{k}")
    if len(n['properties']) != len(n['propertiesEn']): bad.append(f"{n['id']}:性质中英不等")
    for i, f in enumerate(n['formulas']):
        if not all(f.get(k) for k in ('latex','note','noteEn')): bad.append(f"{n['id']}:公式{i}不全")
    for l in n.get('links', []):
        if l not in ids: bad.append(f"{n['id']}:坏链{l}")
print('节点', len(nodes), '| 问题', len(bad), bad[:5])
```

### 11.2 把 `\text{}` 之外的中文包进 `\text{}`

```python
import json, re
CJK = re.compile(r'[\u4e00-\u9fff\u3001\u3002\uff0c\uff1b\uff1a\uff08\uff09]')
TEXTCMD = re.compile(r'\\(text|mathrm|operatorname|mbox)\s*\{')
def wrap(inner):
    out=[]; i=0
    while i < len(inner):
        m = TEXTCMD.match(inner, i)
        if m:
            j=m.end(); dep=1
            while j < len(inner) and dep>0:
                if inner[j]=='{': dep+=1
                elif inner[j]=='}': dep-=1
                j+=1
            out.append(inner[i:j]); i=j; continue
        c=inner[i]
        if CJK.match(c):
            k=i
            while k < len(inner) and CJK.match(inner[k]): k+=1
            out.append(r'\text{'+inner[i:k]+'}'); i=k
        else: out.append(c); i+=1
    return ''.join(out)
def fix(s):
    s = re.sub(r'\$\$([\s\S]+?)\$\$', lambda m: '$$'+wrap(m.group(1))+'$$', s)
    return re.sub(r'\$([^$\n]+?)\$', lambda m: '$'+wrap(m.group(1))+'$', s)
```

### 11.3 KaTeX 全库错误扫描（**首选 `katex-check.html`**）

项目根目录已固化一个扫描页：浏览器打开 `http://localhost:8123/katex-check.html`，
它会读取 `knowledge.json`、把全库每个 `$...$` 片段（当前 **135,660** 个）用 `throwOnError:true, strict:"warn"` 渲染，
在页面上打印 `SCANNED= / ERRORS= / 前 25 条错误`。**改完内容必跑，要求 ERRORS=0**。

下面的旧内联脚本等价，作为备用：

```javascript
const data = await (await fetch('data/knowledge.json', {cache:'no-cache'})).json();
const el = document.createElement('div');
el.style.cssText = 'position:absolute;left:-9999px'; document.body.appendChild(el);
const bad = [];
const tryRender = (tex, nid) => {
  const w = []; const ow = console.warn; console.warn = () => w.push(1);
  try { katex.render(tex, el, { throwOnError: false }); } catch(e) { w.push(1); }
  console.warn = ow;
  if (w.length) bad.push([nid, tex.slice(0,80)]);
};
function walk(o, nid) {
  if (typeof o === 'string') {
    let t = o;
    for (const m of t.matchAll(/\$\$([\s\S]+?)\$\$/g)) tryRender(m[1], nid);
    t = t.replace(/\$\$[\s\S]+?\$\$/g, '');
    for (const m of t.matchAll(/\$([^$\n]+?)\$/g)) tryRender(m[1], nid);
  } else if (Array.isArray(o)) o.forEach(x => walk(x, nid));
  else if (o && typeof o === 'object') Object.entries(o).forEach(([k,v]) => {
    if (k === 'latex' && typeof v === 'string') tryRender(v, nid); else walk(v, nid);
  });
}
for (const n of data.nodes) walk(n, n.id);
el.remove();
return { warnings: bad.length, list: bad.slice(0,5) };   // 应恒为 0
```

### 11.4 截图银河（绕过 RAF 暂停）

```javascript
const g = window.__galaxy;                     // 页面暴露的调试钩子
g.controls.autoRotate = false;
g.camera.position.set(0, 150, 295); g.controls.target.set(0,0,0); g.controls.update();
g.renderer.render(g.scene, g.camera);          // 手动渲染（不依赖 RAF）
const gl = g.renderer.getContext();
const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
const px = new Uint8Array(w*h*4);
gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
// 再翻转到 canvas、缩放、toDataURL 输出
```

调试钩子：`window.__galaxy = { renderer, scene, camera, controls, starLayer, bgLayers, getFly }`

---

### 11.5 一键发布

```bash
python3 release.py -m "提交说明"        # 全流程（升版本号 + merge + build + 提交 + 推送）
python3 release.py -m "…" --no-push    # 只提交不推送
python3 release.py -m "…" --no-bump    # 不升版本号
```

自动检测 js/css 改动决定是否升 `?v=N`；merge 报错会自动中止。

## 12. 与用户协作的注意事项

1. **质量优先**——用户反复强调"质量第一"，不要为省 token 跳过独立复核
2. **先核对再生成**——用户提某方向时，先扫描已有内容，明确说清"哪些已有、跳过、新增几个"
3. **诚实汇报**——复核抓到多少错误就报多少，附"错在哪、怎么改"。用户明确欣赏这种透明
4. **不擅自改布局**——可提议，但要先问
5. **省 token 的正确做法**：不读生成的内容（最大开销），只跑脚本校验；让子代理自验；
   要求短回执。但**复核环节不要省**
6. **回复用中文**

---

*本文档由项目开发过程自动沉淀。若与代码/数据不一致，以 `data/knowledge.json` 与 `js/` 下的实际文件为准。*
