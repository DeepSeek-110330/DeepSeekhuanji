# 接手指南 (WORKFLOW.md)

> **给下一个 AI 会话看的操作手册。** 如果你刚接手这个项目，从头读一遍，然后按第一节启动环境、按第三节继续生成内容。
>
> 上次更新：2026-10-19 ｜ 数据 641 个知识点 ｜ 源码版本 v=37（已上线 GitHub Pages）

---

## 〇、一分钟了解项目

**数学知识银河**：3D 星系式数学知识可视化站点。纯前端（HTML/CSS/JS），无构建、无后端。

- 每个知识点 = 银河里的一个光点，按学科分支排布在不同旋臂上
- 点击光点 → 相机飞行 → 右侧面板展开内容（中英双语定义、公式、性质、例题、配图）
- 配图**全部由代码实时绘制**（12 种图表类型），不是图片
- 数据在 `data/knowledge.json`（由 `data/batch*.json` 合并而来）

**当前进度**：641 个知识点，38 条分支（全部填充），涵盖小学 → 研究生（含线性代数与矩阵微分、拓扑学、复分析、随机过程、黎曼几何、调和分析、PDE 进阶、数论与拓展、抽象代数、动力系统与分形、特殊函数与数学物理、统计与数据科学、数学史与思想、图论、数理逻辑与集合论、最优化与运筹）。**已上线**：<https://deepseek-110330.github.io/DeepSeekhuanji/>

---

## 一、启动与验证环境

```bash
cd 数学知识银河
python3 -m http.server 8123     # 端口固定用 8123
```

> **端口必须用 8123**：所有历史开发与浏览器缓存都在这个端口上（浏览器缓存按「协议+主机+端口」隔离）。换端口会导致本地 `vendor/` 的 Three.js/KaTeX 重新缓存（约 3 MB）。

验证页面正常：

```bash
curl -s -o /dev/null -w "index %{http_code}\n" http://localhost:8123/index.html
curl -s -o /dev/null -w "data  %{http_code}\n" http://localhost:8123/data/knowledge.json
```

浏览器验证时注意：**标签页不可见时浏览器会暂停 `requestAnimationFrame`**，此时动画/飞行不推进、逐节点检查会超时。做全量验证前先 `browser.tabs.focus` 并把桌面窗口保持可见。

---

### 1.2 发布与更新（GitHub Pages，2026-10-16 起）

- **线上地址**：https://deepseek-110330.github.io/DeepSeekhuanji/ ｜ **仓库**：https://github.com/DeepSeek-110330/DeepSeekhuanji
- **更新流程**：改内容 →（若改 `js/` 先升 `?v=N`）→ `python3 data/merge.py` → `python3 data/build_runtime.py` → `git add -A && git commit -m "…" && git push` → 约 40 秒后 Pages 自动重建（v=26 起：`python3 release.py -m "说明"` 一键完成）
- **网络不稳时的办法**（国内直连 github.com 时好时坏；先测 `curl -s -o /dev/null -w "%{http_code}" https://github.com`）：
  ① 换手机热点（实测最有效）；② 本地自动换线代理 `python3 ~/.local/tmp/ghproxy.py`，并把 `https_proxy`、`http_proxy` 指向 `http://127.0.0.1:8433`
- **push 被拒**（远程有新提交）：先 `git pull origin main --no-rebase --allow-unrelated-histories` 合并，再 push

## 二、硬规则（违反会出问题）

| 规则 | 说明 |
|---|---|
| **改 JS 必升版本号** | 改了 `js/` 下任何文件，把 `index.html`、`js/app.js`、`plot-test.html` 里的 `?v=N` 统一 +1。否则浏览器吃旧缓存，你会以为改动没生效 |
| **改数据不用升版本号** | `knowledge.json` 用 `fetch(..., {cache:"no-cache"})` 加载，每次都会校验，刷新即生效 |
| **加完必跑合并** | `python3 data/merge.py`——会校验字段/冲突/分支/链接/图表类型，**有错拒绝写入** |
| **生成前先更新 IDLIST** | `data/IDLIST.txt` 是当前所有合法 id 清单，子代理靠它校验链接。**新增节点要先把它写进去** |
| **新分支/新图表类型要三处同步** | `data/knowledge.json` 的 `branches`、`data/merge.py` 的白名单、`data/SCHEMA.md` 的表格 |
| **单批产出 5~7 个** | 子代理单批超过 ~8 个知识点质量会下降（实测有代理写崩过） |
| **改完要上线** | 内容/代码改完后 `git add -A && git commit && git push`，Pages 约 40 秒后自动重建（见 §1.2） |
| **改数据要生成分片** | 内容更新后依次跑 `python3 data/merge.py`、`python3 data/build_runtime.py`（首屏骨架 + 详情分片，v=19 起） |
| **发布用 release.py** | `python3 release.py -m "说明"`：自动升 ?v=N → merge → build_runtime → 提交 → 推送（v=26 起） |

---

## 三、继续生成内容的标准流程

### 步骤 1：确定范围与分支

先扫描现有内容避免重复：

```python
import json
d = json.load(open('data/knowledge.json', encoding='utf-8'))
# 某分支已有什么
for n in d['nodes']:
    if n['branch'] == 'calculus': print(n['id'], n['title'])
# 关键词查重
for kw in ['洛必达','泰勒','哈希']:
    print(kw, [n['title'] for n in d['nodes'] if kw in n['title']])
```

**注意**：用户常说"做 X 方向"，但 X 方向的基础内容可能已存在。**先核对再列清单**，明确跳过已有的部分（并告诉用户跳过了什么）。

### 步骤 2：写批次文件

新建 `data/batchNN-<主题>.json`，格式见 `data/SCHEMA.md`。

**id 命名**：小写英文 + 连字符，要语义化且全局唯一（如 `frenet-frame`、`law-of-large-numbers`）。

### 步骤 2.5：知识点推导（v=31 起）

推导不写进内容批次，而是放在 `data/derivations/batchDNN-<主题>.json` 叠加层：

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
- 每批 **5~7 个**；每个条目至少 3 步；`zh`/`en` 等长且逐步对应。
- 写清「条件 → 推理 → 结论」；公式用 `$...$` / `$$...$$`；过宽公式用 `\begin{aligned}` 分行。
- 生成后必须另派独立复核，重点查条件漏写、蕴含方向、符号约定、英文镜像。
- 未覆盖节点不显示推导区；**不要模板灌水**。
- 改完跑 `merge.py` → `build_runtime.py`；`katex-check.html` 会扫描推导公式。

### 步骤 3：更新 IDLIST

**必须一行一个 id**（折行会把 `levi-civita-connection` 切成两个 token，代理会误判），并**原子写入**：

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

### 步骤 4：派生成代理（每个 5~7 个知识点）

提示词模板要点（**必须包含**）：

1. 必读 `SCHEMA.md` 与 `IDLIST.txt`
2. 输出文件名（**给绝对路径**，明确"只写这个文件"）
3. 知识点清单：`id | 中文名 | 英文名 | level | 配图建议`
4. **本批的准确性硬性要求**（见附录 A 的错误目录，针对该主题列出高危点）
5. 字段要求（引用 SCHEMA.md）
6. **自检要求**：写完后用 python3 检查 JSON 合法/字段齐全/中英数量一致/链接有效/图表表达式可求值，**并验算每道例题**
7. 回执要求：**≤8 行**，只报文件路径、节点数、自检结果、修正了什么

### 步骤 5：合并校验

```bash
cd data && python3 merge.py
```

看输出：`错误: 0` 才继续。常见错误：
- `id 重复` → 新批次的 id 撞了已有节点
- `非法 branch` → 分支名不在白名单（需同步 `merge.py`）
- `未知 plot.type` → 新图表类型没加进白名单

### 步骤 6：独立复核（关键，不要省）

**再派 1~3 个复核代理**，读批次文件，逐条核对：

```
你是严格的数学审校员。逐条检查文件的准确性，找出所有真实错误。
【高危点】……（列出该主题的易错点）
【输出】JSON 数组，每项 {file, id, field, current, problem, fix}；
只报确认的真实错误；没有就输出 []。不报格式问题，不复述正确内容。
```

**复核代理的价值已被反复验证**：每轮平均抓到 4~5 处真实错误，且都是**数值验算抓不到**的类型（定理条件漏写、蕴含方向写反、符号约定不一致）。详见附录 A。

### 步骤 7：修正 → 重新合并 → 复检

修正时用**字面替换**（不要用正则替换 LaTeX，反斜杠会被当转义）：

```python
def rep(path, nid, field, old, new):
    d = json.load(open(path, encoding='utf-8'))
    n = next(x for x in d if x['id'] == nid)
    cur = n
    parts = field.replace(']','').replace('[','.').split('.')
    for p in parts[:-1]: cur = cur[int(p)] if p.isdigit() else cur[p]
    k = parts[-1]; k = int(k) if k.isdigit() else k
    if isinstance(cur[k], str) and old in cur[k]:
        cur[k] = cur[k].replace(old, new)
        json.dump(d, open(path,'w',encoding='utf-8'), ensure_ascii=False, indent=2)
        print('✓', nid, field)
    else:
        print('✗ 未匹配:', nid, field, old[:40])
```

**注意**：
- 字符串里含 `'` 时用双引号包（如 `"$y'$"`），别用 `\'`
- LaTeX 里的 `\m`、`\g` 等在正则里是非法转义；用字面替换，或 `re.escape()`
- 文本里可能有换行，搜索串要包含或避开它
- 中英文可能措辞不同，**两处都要改**

### 步骤 8：浏览器验证

```javascript
// 全量或抽样检查：逐个打开知识点，确认公式与配图渲染成功
const data = await (await fetch('data/knowledge.json', {cache:'no-cache'})).json();
let ok = 0; const fail = [];
for (const n of data.nodes) {
  const input = document.getElementById('search');
  input.value = n.title;
  input.dispatchEvent(new Event('input', { bubbles: true }));
  await new Promise(r => setTimeout(r, 6));
  const items = [...document.querySelectorAll('#search-results .item')];
  const ex = items.find(i => i.querySelector('.item-title')?.textContent === n.title);
  if (!ex) { fail.push(n.id+':搜索'); continue; }
  ex.click();
  await new Promise(r => setTimeout(r, 38));
  const katex = document.querySelectorAll('#panel-content .katex').length;
  const plotOK = !n.plot || !!document.querySelector('.plot-canvas');
  if (katex > 0 && plotOK) ok++; else fail.push(n.id);
}
```

> 300+ 节点全量检查约需 20 秒，**可能触发 evaluate 60 秒超时**——建议抽样（每分支取 3 个 + 新批次全部）。

**KaTeX 警告的穷举检查**（比正则扫描可靠得多）：

```javascript
// 把全库公式逐条交给 KaTeX 渲染，捕获警告
const bad = [];
const tryRender = (tex, nid) => {
  const w = []; const ow = console.warn; console.warn = () => w.push(1);
  try { katex.render(tex, el, { throwOnError: false }); } catch(e) { w.push(1); }
  console.warn = ow;
  if (w.length) bad.push([nid, tex.slice(0,80)]);
};
// 遍历所有字符串字段里的 $...$ / $$...$$，以及 formula.latex（裸 LaTeX）
```

---

## 四、绘图引擎参考

`js/plot.js`，共 12 种类型。**给知识点配图前先看这里**，选对类型：

| type | 用途 | 关键字段 |
|---|---|---|
| `function` | 函数图像 | `functions:[{expr,color,label}]`、`fills`（面积）、`tangents`（切线）、`xRange/yRange` |
| `geometry` | 平面几何 | `elements:[{type:polygon/segment/point/label/circle/arc/axes}]` |
| `numberline` | 数轴 | `range`、`points`、`intervals` |
| `unitcircle` | 单位圆 | `angle`（弧度） |
| `contour` | 等值线 | `expr`（用 x,y）、`levels` |
| `vectorfield` | 向量场 | `fx`、`fy`、`contourExpr`（背景等高线）、`marks` |
| `conformal` | 共形映射 | `re`、`im`、`zRange`、`density` |
| `slopefield` | 斜率场 | `expr`（y'=f(x,y)）、`initial:[{x,y,color,label}]`（自动 RK4 画解曲线） |
| `scatter` | 散点图 | `points`、`lines:[{slope,intercept}]` |
| `quadrature` | 数值积分 | `expr`、`from`、`to`、`n`、`method: left/right/midpoint/trapezoid/simpson` |
| `curve3d` | 3D 曲线 | `x`、`y`、`z`（**用变量 t**）、`tRange`、`frames:[{at}]`（自动画 Frenet 标架） |
| `surface3d` | 3D 曲面 | 图形式：`expr`（x,y）；参数式：`surf:{x,y,z}`（**用 u,v**）、`uRange/vRange`、`density` |

### 表达式求值的坑

1. **变量名必须是引擎支持的**：`function`/`contour`/`vectorfield`/`slopefield`/`scatter` 用 `x`（和 `y`）；`curve3d` 用 `t`；`surface3d` 参数式用 `u,v`
2. **JS 里 `-x**2` 是语法错误**——引擎已自动补括号修复，但**新写表达式时最好直接写成 `-(x^2)`**
3. 幂用 `^` 或 `**` 均可（引擎会转换）；`ln` → `log`、`π` → `PI`、`e` → `E` 自动处理
4. 避免在 `xRange` 内含发散点（如 `sin(1/x)` 在 0 附近），或让范围避开

---

## 五、布局算法

在 `js/app.js` 的 `computePositions()`：

```javascript
const t = n / maxN;
const sweep      = Math.min(3.2, 0.28 + n * 0.086);  // 22°~183°，随节点数缩放
const radius0    = 26 + (1 - t) * 36;                // 点少 ⇒ 内端外移
const radialSpan = 42 + Math.min(74, n * 2.0);       // 44~116
const radius = radius0 + s * radialSpan + lvlShift + jitter;
const angle = armAngle + s * sweep + radius * 0.006 + jitter;
```

- 臂的基础角度由**有知识点的分支**均匀分配（`armAngle = index / populatedCount * 2π`），所以**分支对象的键顺序决定旋臂顺序**
- 之后有 **110 轮松弛推挤**（最小间距 7.5），保证光点不重叠
- 使用固定种子随机数，布局可复现

**布局已于 2026-10-14 按用户授权改造完毕**：三个尺寸参数都随节点数缩放，使各臂点密度接近（1 个点的臂从 117° 收到 22°，33 个点的臂保持 183°），角度抖动 ±0.16→±0.10。**改造会重新排布所有点——当时已经用户明确同意；后续如需再动布局，仍须先征得确认**（详见 `HANDOVER.md` 第 10 节）。

---

## 附录 A：错误目录（★ 最有价值的积累 ★）

这些是 27 轮独立复核累计抓到的 **282 处真实错误**的类型归纳（拓扑/复分析见 `HANDOVER.md` 9.7/9.8 节，随机过程/黎曼几何见 9.9/9.10 节，调和分析/PDE 进阶见 9.11/9.12 节，高中补充见 9.13 节，线性代数见 9.14 节，深水区见 9.15 节，矩阵微分见 9.16 节，数论见 9.17 节，全库审计与新增科目见 9.18 节）。**生成内容时逐条对照，能避掉大部分坑。**

### A1. 蕴含方向写反（最高频）

| 错误写法 | 正确 |
|---|---|
| 连续必可导 | **可导 ⇒ 连续**，反之不成立 |
| 相关 ⇒ 独立 | **独立 ⇒ 不相关**（ρ=0 推不出独立） |
| 只有独立时 E(XY)=E(X)E(Y) | 独立是充分条件；充要条件是**不相关** |
| a=b ⟺ ac=bc | **c=0 时不成立**；要写 a=b ⟹ ac=bc |
| 闭 ⟺ 闭图像 | 闭图像定理：**图像闭 ⇒ 有界**（不能先设有界） |
| 逐点有界 ⟸ 一致有界 | 一致有界原理是**逐点 ⇒ 一致** |
| 范数收敛 ⟸ 弱收敛 | **范数收敛 ⇒ 弱收敛**，反之不成立 |
| 特征值 ⟸ 谱点 | **特征值 ∈ 谱**，但谱点不一定是特征值 |
| 紧 ⟸ 有限维 | **恒等算子紧 ⟺ 空间有限维** |
| 恰当 ⟸ 闭 | **恰当 ⇒ 闭**；闭 ⇒ 恰当需要可缩区域（庞加莱引理） |
| 有 n 位有效数字 ⟺ \|e_r\| ≤ 1/(2a₁)10^{-(n-1)} | 这是**必要**条件；**充分**条件常数是 1/(2(a₁+1)) |
| 平行 ⇔ 角相等 | 判定（角⇒平行）与性质（平行⇒角）互为逆命题，**方向不能混** |

### A2. 定理条件漏写或写错

| 定理 | 常被漏掉的条件 |
|---|---|
| 柯西积分定理 | **单连通** + 解析 |
| 乘积测度截面积分公式 | **μ、ν 都 σ 有限** |
| 托内利 vs 富比尼 | 托内利只要求 f≥0 可测；富比尼要求 **∫∫\|f\|<∞** |
| 叶戈罗夫 | **有限测度** |
| 控制收敛 | **控制函数必须可积** |
| 哈密顿… 压缩映射原理 | **完备** + q<1 且与 x,y 无关 |
| 投影定理 | Hilbert 空间（**完备**）+ M **闭子空间** |
| Banach–Zaretsky | 需 **连续** + BV + N 性质 |
| 开映射/闭图像定理 | 需**双巴拿赫空间**；开映射还要**满射** |
| 隐函数定理 | F_z ≠ 0 |
| 牛顿法二阶收敛 | 只在**单根**处；重根退化为线性 |
| 格拉姆… Gronwall 引理 | 只需 **β(t) ≥ 0**（α≥0 非必需） |
| 达朗贝尔公式 | ½ 与 1/(2a) 系数、积分区间 2at |
| 高斯绝妙定理 | 归因于 **Gauss 方程**（不是 Codazzi 方程） |

### A3. 符号/约定不一致

| 问题 | 要点 |
|---|---|
| Frenet 标架 | 挠率 τ = (r',r'',r''')/\|r'×r''\|²；**重参数化不变**（变号的是镜像反射，不是 t→−t） |
| 曲面 L、M、N | 符号取决于**法向量取内/外向**，同一文档必须统一约定 |
| 相对论… 分类判别式 | 二阶线性 PDE 是 **B²−AC**（交叉项系数是 2B），不是 B²−4AC |
| 谱半径 | r(T)=lim‖Tⁿ‖^{1/n}；**按绝对值排序**才有 ‖T‖=\|λ₁\| |
| 期望性质 | E(XY)=E(X)E(Y) 的充要条件是 Cov=0 |

### A4. 概念混淆

| 错误 | 正确 |
|---|---|
| "路程 = ∫v dt" | 是**位移**；路程 = ∫\|v\|dt |
| "原点（f_x≠0）是鞍点" | 不是驻点就**不能叫鞍点** |
| "闭而不连续的算子只能定义在**稠密**子空间" | **稠密不是必要条件**（只保证非闭子空间） |
| "无界算子定义域必是稠密真子空间" | 稠密是**约定**，不是定理结论 |
| 共轭调和函数"互为" | 关系**不对称**：v 是 u 的共轭，−u 才是 v 的 |
| "鞍结分支是唯一不要求对称性的" | **跨临界分支也不要求** |
| 分数 = "能写成两整数之比" | 那样整数也成了分数，与"整数/分数互斥分类"矛盾 |
| "改写 = 去掉末尾 4 个 0" | 是**小数点左移 4 位**；"去末尾 0"只在 0 够多时成立 |
| "线段只有一条对称轴" | **两条**：垂直平分线 + 所在直线 |
| 角平分线逆命题 | 必须限定"**在角的内部**" |

### A5. 例证不当 / 答非所问

| 错误 | 正确 |
|---|---|
| 凳子的高约 1 分米 | 1 分米=10cm，凳子约 4 分米；换**粉笔盒** |
| 题问"还需多久"→ 答累计时间 | 要答**剩余时间**（34.8−10=24.8） |
| 中心差商余项写成 f'' | 是三阶导 **f'''** |
| 残差平方和算错 | 1²+8²+11²=186 ≠ 378；应为 1²+**16**²+11² |
| 环面 L、N 符号 | 与法向约定不符（该参数化 r_u×r_v 指向内侧） |

### A6. 工程性坑

| 坑 | 应对 |
|---|---|
| `-x**2` 在 JS 里是语法错误 | 引擎已自动补括号；新表达式写成 `-(x^2)` |
| 中文裸露在数学模式 | 包进 `\text{}`（KaTeX 0.16.9 的 `σ` 等符号在 text 模式无字形，要用 `\sigma`） |
| 中文下标 `S_{侧}` | 写成 `S_{\text{侧}}` |
| 正则替换 LaTeX 时报 `bad escape \m` | 用字面替换，或对搜索串 `re.escape()`；替换串用 `lambda m: new` |
| 字符串含 `'`（如 `$y'$`） | Python 里用双引号包 |
| 参数曲面用 u,v 但求值器只认 x,y | 用 `buildEvaluator(expr, params, ["u","v"])` |
| 浏览器吃旧缓存 | 改 JS 必升 `?v=N` |
| 标签页后台导致检查超时 | 先 focus，保持窗口可见；或抽样检查 |

---

## 附录 B：常用脚本片段

### B1. 结构校验

```python
import json
d = json.load(open('knowledge.json', encoding='utf-8'))
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

### B2. 把 `\text{}` 之外的中文包进 `\text{}`

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
def fix(s):   # 处理 $...$ 与 $$...$$
    s = re.sub(r'\$\$([\s\S]+?)\$\$', lambda m: '$$'+wrap(m.group(1))+'$$', s)
    return re.sub(r'\$([^$\n]+?)\$', lambda m: '$'+wrap(m.group(1))+'$', s)
```

### B3. 截图银河（绕过 RAF 暂停）

```javascript
const g = window.__galaxy;
g.controls.autoRotate = false;
g.camera.position.set(0, 150, 295); g.controls.target.set(0, 0, 0); g.controls.update();
g.renderer.render(g.scene, g.camera);           // 手动渲染
const gl = g.renderer.getContext();
const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
const px = new Uint8Array(w*h*4);
gl.readPixels(0, 0, w, h, gl.RGBA, gl.UNSIGNED_BYTE, px);
// 再翻转到 canvas、缩放到 TW 宽、toDataURL 输出
```

页面暴露了调试钩子 `window.__galaxy = { renderer, scene, camera, controls, starLayer, bgLayers, getFly }`。

---

## 附录 C：后续可做的工作

| 任务 | 说明 |
|---|---|
| ~~拓扑学（~24 个）~~ | ✅ 已完成（batch53~56） |
| ~~复分析深度版（~24 个）~~ | ✅ 已完成（batch57~60） |
| ~~随机过程（~24 个）~~ | ✅ 已完成（batch61~64） |
| ~~黎曼几何（~20 个）~~ | ✅ 已完成（batch65~68） |
| ~~调和分析（~18 个）~~ | ✅ 已完成（batch69~71） |
| ~~PDE 深度版（~14 个）~~ | ✅ 已完成（batch72~74） |
| ~~高中补充（30 个）~~ | ✅ 已完成（batch75~79，2026-10-15） |
| ~~线性代数（49 个）~~ | ✅ 已完成（batch80~89，2026-10-15；含矩阵微分与深水区） |
| ~~数论~~ | ✅ 已完成（18 个，`batch90~92`，2026-10-16；初等/经典/拓展各 6） |
| ~~抽象代数 / 动力系统与分形~~ | ✅ 已完成（14 + 8，`batch93~97`） |
| ~~特殊函数 / 统计与数据科学 / 数学史与思想~~ | ✅ 已完成（8 + 8 + 8，`batch98~103`） |
| ~~图论 / 数理逻辑与集合论 / 最优化与运筹~~ | ✅ 已完成（9 + 10 + 9，`batch104~109`） |
| 布局优化 | ✅ 已实施（2026-10-14，用户授权） |
| ~~GitHub Pages 部署~~ | ✅ 已完成（2026-10-16，见 §1.2） |

**说明**：既定方向均已完成；**38/38 分支全部填充，内容缺口清零**。

---

## 附录 D：与用户协作的注意事项

1. **质量优先**——用户反复强调"质量第一"。不要为了省 token 跳过独立复核。
2. **先核对再生成**——用户提某个方向时，先扫描已有内容，明确说清"哪些已有、跳过、新增几个"。
3. **诚实汇报**——复核抓到多少错误就报多少，附上"错在哪、怎么改"。用户明确表示欣赏这种透明。
4. **不要擅自改布局**——用户明确说过不要移动已有知识点（可以提议，但要先问）。
5. **省 token 的正确做法**：不读生成的内容（那是最大开销），只跑脚本校验；让子代理自验；要求短回执。但**复核环节不要省**。
6. 用户会用中文交流，回复用中文。
