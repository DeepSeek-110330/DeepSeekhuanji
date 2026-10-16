# 数学知识银河 —— 知识点数据规范 (v2)

## 数据结构

每个知识点是一个 JSON 对象，放在 `nodes` 数组里。字段如下：

```json
{
  "id": "kebab-case-id",            // 必填，全局唯一，英文小写连字符
  "title": "中文标题",               // 必填
  "titleEn": "English Title",       // 必填
  "branch": "function",             // 必填，见下方分支表
  "level": 1,                       // 必填，1~5，越大越高级（影响星星大小与位置）
  "summary": "一句话中文简介",        // 必填
  "summaryEn": "One-line English summary",  // 必填
  "definition": "中文定义，支持 **粗体** 和 $行内公式$、$$独立公式$$",  // 必填
  "definitionEn": "English definition, same markup",  // 必填
  "formulas": [                     // 必填，至少 1 条
    {
      "latex": "a^{x+y}=a^x a^y",   // 必填，纯 LaTeX，不要加 $ 包裹
      "note": "中文说明：这是什么、怎么用",
      "noteEn": "English note"
    }
  ],
  "expression": {                   // 可选，纯文本记号
    "text": "f(x)=a^x  (a>0, a≠1)",
    "symbol": "a^x",
    "note": "说明",
    "noteEn": "note"
  },
  "properties": ["中文性质1", "中文性质2"],       // 必填，3~5 条
  "propertiesEn": ["property 1", "property 2"],  // 必填
  "plot": { ... },                  // 可选，见下方绘图规范
  "examples": [                     // 必填，至少 1 条
    { "problem": "中文题目", "solution": "中文解答（含公式）" }
  ],
  "tags": ["标签1", "标签2"],       // 可选
  "links": ["related-id"]           // 必填，关联知识点的 id（可指向后续批次）
}
```

## 分支表（branch 只能取这些值）

| id | 中文名 | 英文名 |
|---|---|---|
| harmonic-analysis | 调和分析 | Harmonic Analysis |
| pde-advanced | 偏微分方程（进阶） | Advanced PDE |
| stochastic | 随机过程 | Stochastic Processes |
| riemannian | 黎曼几何 | Riemannian Geometry |
| topology | 拓扑学 | Topology |
| complex-analysis | 复分析 | Complex Analysis |
| elementary-basics | 小学基础 | Elementary School Basics |
| elementary | 数与式 | Numbers & Expressions |
| plane-geometry | 平面几何 | Plane Geometry |
| solid-geometry | 立体几何 | Solid Geometry |
| algebra | 代数 | Algebra |
| set-logic | 集合与逻辑 | Sets & Logic |
| combinatorics | 计数原理 | Combinatorics |
| function | 函数 | Functions |
| trigonometry | 三角 | Trigonometry |
| sequence | 数列与级数 | Sequences & Series |
| analytic | 解析几何 | Analytic Geometry |
| calculus | 微积分 | Calculus |
| multivariable | 多元微积分 | Multivariable Calculus |
| complex | 复变函数与积分变换 | Complex Analysis & Transforms |
| ode | 常微分方程 | Differential Equations |
| pde | 偏微分方程 | Partial Differential Equations |
| numerical | 数值分析 | Numerical Analysis |
| real-analysis | 实变函数论 | Real Analysis |
| functional-analysis | 泛函分析 | Functional Analysis |
| differential-geometry | 微分几何 | Differential Geometry |
| linear | 线性代数 | Linear Algebra |
| probability | 概率统计 | Probability & Statistics |
| number | 数论与拓展 | Number Theory & Beyond |
| vector | 向量与空间 | Vectors & Space |
| abstract-algebra | 抽象代数 | Abstract Algebra |
| dynamical-systems | 动力系统与分形 | Dynamical Systems & Fractals |
| special-functions | 特殊函数与数学物理 | Special Functions & Mathematical Physics |
| statistics | 统计与数据科学 | Statistics & Data Science |
| math-history | 数学史与思想 | History & Ideas of Mathematics |
| graph-theory | 图论 | Graph Theory |
| mathematical-logic | 数理逻辑与集合论 | Mathematical Logic & Set Theory |
| optimization-or | 最优化与运筹 | Optimization & Operations Research |

## 绘图规范（plot）

用代码实时绘图。`type` 决定类型：

### 1. function —— 函数图像
```json
{
  "type": "function",
  "functions": [
    { "expr": "sin(x)", "color": "#4cc9f0", "label": "y = sin x" },
    { "expr": "a^x", "params": { "a": 2 }, "color": "#ff6b9d", "label": "y = 2^x" }
  ],
  "xRange": [-7, 7],
  "yRange": [-1.5, 1.5],
  "title": "图像标题"
}
```
- `expr` 中可用：`x`、参数，以及 sin cos tan asin acos atan exp log ln sqrt abs pow PI E 等
- 幂用 `**` 或 `^` 均可（引擎会自动转换）
- 多个函数给不同 color

**面积填充（定积分、面积问题）** —— 给函数图像加 `fills`：
```json
{
  "type": "function",
  "functions": [{ "expr": "x^2", "color": "#06d6a0", "label": "y = x²" }],
  "fills": [
    { "expr": "x^2", "from": 0, "to": 2, "base": 0, "color": "#06d6a0", "label": "∫₀² x²dx" }
  ],
  "xRange": [-1, 3], "yRange": [-1, 5],
  "title": "定积分的几何意义"
}
```
- `from`/`to` 是积分区间，`base` 是填充的基准线（默认 0）
- 两条曲线/水平线之间的面积：**`expr` 传上方曲线、`base` 传下方曲线或水平线**（如 `{"expr":"2^x","from":3,"to":4.6,"base":8}` 填 2^x 与 y=8 之间）；若传「上−下」差值式，区域会整体填到 x 轴处，不是两曲线之间

**切线（导数的几何意义）** —— 加 `tangents`（自动数值求导画切线）：
```json
{
  "type": "function",
  "functions": [{ "expr": "x^2", "color": "#4cc9f0", "label": "y = x²" }],
  "tangents": [{ "expr": "x^2", "at": 1, "color": "#ff6b9d", "label": "切线斜率 = 2" }],
  "xRange": [-2, 3], "yRange": [-1, 6],
  "title": "导数的几何意义"
}
```

### 2. unitcircle —— 单位圆与三角函数
```json
{ "type": "unitcircle", "angle": 1.047, "title": "单位圆" }
```
（angle 用弧度）

### 3. numberline —— 数轴
```json
{ "type": "numberline", "range": [-5, 5],
  "points": [{ "at": 2, "label": "√2", "color": "#ffd166" }],
  "intervals": [{ "from": -1, "to": 3, "color": "#4cc9f0" }],
  "title": "数轴" }
```

### 4. geometry —— 平面几何
```json
{ "type": "geometry", "xRange": [-1, 5], "yRange": [-1, 4],
  "elements": [
    { "type": "axes" },
    { "type": "polygon", "points": [[0,0],[4,0],[0,3]], "fill": "rgba(76,201,240,0.12)", "color": "#4cc9f0" },
    { "type": "segment", "from": [0,0], "to": [4,0], "color": "#ffd166" },
    { "type": "circle", "cx": 0, "cy": 0, "r": 2, "color": "#b388ff" },
    { "type": "point", "at": [0,0], "label": "A" },
    { "type": "label", "at": [2,-0.5], "text": "b" }
  ],
  "title": "标题" }
```

### 5. contour —— 等高线（二元函数）
```json
{ "type": "contour", "expr": "x^2 + y^2",
  "xRange": [-2.5, 2.5], "yRange": [-2.5, 2.5],
  "levels": 10, "title": "f(x,y) = x² + y² 的等值线" }
```
- 可用于：多元函数、等值线、拉格朗日乘数法的约束曲线、多元极值
- `expr` 用变量 `x` 和 `y`
- `levelRange`（可选）：`[min, max]`，指定等值线的取值范围（默认按全图函数值的对称区间取）；配合 `levels: 1` 可精确只画一条等值线——如要画椭圆 `x^2/25 + y^2/9 = 1`，用 `"expr": "x^2/25 + y^2/9", "levelRange": [0, 2], "levels": 1`，唯一一条线正好是 `= 1` 的椭圆

### 6. vectorfield —— 向量场 / 梯度场
```json
{ "type": "vectorfield",
  "fx": "-x", "fy": "-y",
  "xRange": [-2, 2], "yRange": [-2, 2],
  "contourExpr": "x^2 + y^2",
  "marks": [{ "at": [0, 0], "label": "原点" }],
  "title": "梯度场" }
```
- `fx`/`fy` 是向量场的两个分量，用 `x`、`y`
- `contourExpr` 可选：背景叠加标量场等高线
- 可用于：梯度场、方向导数、保守场与势函数

### 7. conformal —— 共形映射（复变函数）
```json
{ "type": "conformal",
  "re": "x^2 - y^2", "im": "2*x*y",
  "zRange": [-1.4, 1.4], "density": 9,
  "title": "w = z² 把直角网格映成两族正交曲线" }
```
- z = x + iy，w = f(z) = re(x,y) + i·im(x,y)
- `re`/`im` 分别是实部和虚部的表达式，用 `x`、`y`
- `zRange` 是 z 平面网格范围 [min, max]（正方形）
- `density` 网格线条数；`outRange` 可选（w 平面显示范围，不写则自动计算）
- 可用于：解析函数、共形映射、柯西-黎曼方程、初等复变函数

### 8. slopefield —— 斜率场 / 方向场（一阶微分方程）
```json
{ "type": "slopefield",
  "expr": "x + y",
  "xRange": [-3, 3], "yRange": [-3, 3],
  "initial": [
    { "x": 0, "y": 1, "color": "#ff6b9d", "label": "y(0)=1" }
  ],
  "title": "斜率场与解曲线" }
```
- `expr` 是 y' = f(x, y)，用 `x`、`y`
- `initial` 可选：初值点列表，会用 RK4 数值积分自动画出解曲线
- 可用于：一阶方程、积分曲线、相图、稳定性直观

## 写作要求

1. **定义**：准确、口语化，2~4 段，讲清「是什么」和「为什么重要」。
2. **公式**：3~5 条核心公式，每条配一句说明。
3. **性质**：3~5 条关键性质。
4. **例题**：1~2 道，题目和解答都要有，解答含公式。
5. **配图**：能画图的（函数、几何、三角、数轴）一定加 plot；纯概念（如"函数概念"）可省略。
6. **关联 links**：指向真实相关的知识点 id，不要乱连。
7. LaTeX 中反斜杠要转义为 `\\`（JSON 要求）。
8. 中文用「」，不要用英文引号。
9. 输出必须是**合法 JSON 数组**（`[ {...}, {...} ]`），不要包含 markdown 代码块标记。

### 9. scatter —— 散点图（回归、相关、抽样）
```json
{ "type": "scatter",
  "points": [[1, 2.1], [2, 3.9], [3, 5.8], [4, 8.2]],
  "lines": [{ "slope": 1.95, "intercept": 0.05, "color": "#ffd166", "label": "回归直线" }],
  "xRange": [0, 5], "yRange": [0, 9],
  "title": "散点与回归直线" }
```
- `points` 是 [x, y] 数组；xRange/yRange 不写则自动按数据范围
- `lines` 可选：直线用 slope/intercept（也可用 from/to 限定区间）；`line`（单个）也支持
- `marks` 可标注特殊点，`pointColor`/`pointSize` 可调散点样式

### 10. quadrature —— 数值积分示意（矩形/梯形/辛普森）
```json
{ "type": "quadrature",
  "expr": "x^2", "from": 0, "to": 2, "n": 4,
  "method": "trapezoid",
  "color": "#06d6a0", "curveColor": "#4cc9f0",
  "title": "梯形公式逼近 ∫₀²x²dx" }
```
- `expr` 被积函数；`from`/`to` 积分区间；`n` 子区间个数
- `method` 取 `left` | `right` | `midpoint` | `trapezoid` | `simpson`
- 图上会自动标注近似值；xRange/yRange 不写则自动

### 11. curve3d —— 3D 曲线（空间曲线、Frenet 标架）
```json
{ "type": "curve3d",
  "x": "cos(t)", "y": "sin(t)", "z": "t/3",
  "tRange": [0, 12.566],
  "frames": [{ "at": 4.19, "scale": 0.75 }],
  "color": "#4cc9f0",
  "title": "圆柱螺线" }
```
- 用参数 `t` 写表达式（不是 x、y）
- `frames` 可选：自动数值计算 Frenet 标架并在该参数处画 T（粉）、N（绿）、B（黄）三支箭头
- `azimuth`/`elevation` 可选（默认 0.7 / 0.45）；`axes:false` 可关坐标轴

### 12. surface3d —— 3D 曲面（带光照的网格）
```json
{ "type": "surface3d",
  "expr": "x^2 - y^2", "xRange": [-1.5, 1.5], "yRange": [-1.5, 1.5],
  "density": [24, 24], "color": "#4cc9f0", "title": "马鞍面" }
```
参数曲面写成 `surf`：
```json
{ "type": "surface3d",
  "surf": { "x": "sin(u)*cos(v)", "y": "sin(u)*sin(v)", "z": "cos(u)" },
  "uRange": [0, 3.1416], "vRange": [0, 6.2832], "density": [20, 28], "color": "#ff6b9d" }
```
- 图形式用变量 `x`、`y`；参数式用变量 `u`、`v`
- `wire: true` 只画网格线不填充
