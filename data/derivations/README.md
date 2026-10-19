# 知识点推导叠加层（v=31 起）

这个目录存放每个知识点的**分步推导**，由 `merge.py` 按 id 附加到 `knowledge.json` 的节点上，
再由 `build_runtime.py` 放进 `data/parts/<branch>.json`。不修改 `data/batch*.json`。

## 文件格式

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

## 硬性要求

- 每批 **5~7 个**知识点。
- 每个条目至少 **3 步**；`zh` / `en` 必须等长、逐步对应。
- 写清「条件 → 推理 → 结论」，不要只写结论。
- 公式用 `$...$` / `$$...$$`；过宽公式用 `\begin{aligned}` 分行。
- 中文出现在数学模式里必须包 `\text{}`。
- 生成后必须另派**独立复核**，重点查条件漏写、蕴含方向、符号约定、英文镜像。
- 未覆盖的节点不显示推导区；**不要用模板批量灌水**。

## 覆盖进度

| 批次 | 主题 | 节点 |
|---|---|---|
| D01 | 微积分基础 | `limit`、`continuity`、`derivative`、`mean-value-theorems`、`integral`、`fundamental-theorem`、`taylor-formula` |
| D02 | 极限与连续 | `sequence-limit`、`limit-laws`、`two-important-limits`、`infinitesimal`、`discontinuity-types`、`continuity-theorems`、`lhopital` |
| D03 | 导数与微分 | `differentiation-rules`、`chain-rule`、`higher-order-derivative`、`implicit-differentiation`、`parametric-derivative`、`differential`、`curvature` |
| D04 | 导数应用与积分法 | `monotonicity-extremum`、`concavity-inflection`、`curve-sketching`、`optimization`、`antiderivative`、`integration-substitution` |
| D05 | 积分几何与物理 | `integration-by-parts`、`improper-integral`、`integral-area`、`integral-volume`、`arc-length`、`integral-physics` |
| D06 | 行列式与矩阵 | `determinant-definition`、`determinant-properties`、`cofactor-expansion`、`cramer-rule`、`determinant-calculation`、`matrix-operations`、`inverse-matrix` |
| D07 | 矩阵进阶 | `elementary-matrices`、`matrix-rank`、`block-matrices`、`matrix-powers-polynomials`、`matrix-factorization`、`generalized-inverse`、`matrix-groups` |
| D08 | 向量组与方程组 | `linear-combination`、`linear-dependence`、`vector-group-rank`、`vector-space-basis`、`homogeneous-solutions`、`nonhomogeneous-solutions`、`rank-nullity` |
| D09 | 特征值与若尔当 | `eigenvalue-eigenvector`、`matrix-similarity-diagonalization`、`symmetric-matrix-diagonalization`、`jordan-form`、`minimal-polynomial`、`lambda-matrix`、`normal-matrices` |
| D10 | 二次型与对偶 | `inner-product-orthogonality`、`quadratic-form-standard`、`positive-definite-inertia`、`eigenvalue-variational`、`dual-bilinear`、`quotient-space`、`tensor-product` |
| D11 | 线性空间与变换 | `linear-space-general`、`linear-transformation`、`basis-change`、`subspace-sum-direct`、`nonnegative-matrices`、`sylvester-lyapunov`、`matrix-functions` |
| D12 | 矩阵微分 | `matrix-derivative-basics`、`matrix-differential-rules`、`matrix-gradient-identities`、`matrix-calculus-optimization`、`matrix-spectral-derivatives`、`matrix-function-derivatives`、`matrix-calculus-chain-rule` |
| D13 | 概率基础 | `probability-basics`、`conditional-probability-bayes`、`random-variable`、`expectation-variance`、`discrete-distributions`、`continuous-distributions` |
| D14 | 分布与极限定理 | `normal-distribution`、`random-vector`、`marginal-conditional-independence`、`covariance-correlation`、`law-of-large-numbers`、`central-limit-theorem` |
| D15 | 统计推断 | `statistics-sampling`、`sampling-distributions`、`point-estimation`、`interval-estimation`、`hypothesis-testing`、`chi-square-anova` |
| D16 | 概率应用 | `regression-analysis`、`function-of-random-variables`、`moments-mgf`、`data-collection`、`data-analysis` |
| D17 | 函数基础 | `function-concept`、`domain-range`、`linear-function`、`inverse-variation-function`、`quadratic-function`、`power-function`、`function-zeros` |
| D18 | 函数性质 | `monotonicity`、`parity`、`periodicity`、`rational-exponent`、`composite-function`、`inverse-function`、`change-of-base` |
| D19 | 指数函数 | `exponential-function`、`exponential-equation`、`exponential-growth-decay`、`natural-constant-e` |
| D20 | 对数与模型 | `logarithm`、`logarithmic-function`、`logarithmic-equation`、`function-models` |
| D21 | 小学数与运算 | `counting-comparison`、`whole-numbers`、`addition-subtraction`、`multiplication-division`、`four-operations-order`、`large-numbers`、`rounding-approximation` |
| D22 | 小学量与负数 | `length-units`、`area-volume-units`、`mass-time-units`、`negative-numbers-elementary`、`letters-for-numbers`、`average-elementary`、`chicken-rabbit` |
| D23 | 小学分数小数 | `fractions-elementary`、`decimals-elementary`、`percentage-elementary`、`ratio-elementary`、`factors-multiples`、`operation-laws-elementary`、`possibility-elementary`、`angles-elementary` |
| D24 | 小学几何统计 | `area-elementary`、`perimeter-elementary`、`circle-elementary`、`solid-figures-elementary`、`solid-volume-elementary`、`figures-motion-elementary`、`observing-objects`、`statistics-charts` |
| D25 | 方程与不等式 | `linear-equation-junior`、`inequality`、`linear-inequality-junior`、`linear-system-two-variables`、`polynomial`、`quadratic-equation-junior` |
| D26 | 代数与几何基础 | `basic-inequality`、`quadratic-inequality`、`axial-symmetry`、`lines-angle-basics`、`intersecting-lines`、`plane-coordinates` |
| D27 | 平面几何 | `central-symmetry-rotation`、`congruent-triangles`、`parallelogram`、`projection-view`、`rectangle-rhombus-square`、`circle-junior`、`similarity` |

当前覆盖：**176 / 641**（微积分 33 + 线性代数 49 + 概率统计 23 + 函数 22 + 小学 30 + 代数 8 + 平面几何 11）。后续按分支分批推进。

## 命令

```bash
python3 data/merge.py          # 校验并附加推导
python3 data/build_runtime.py  # 重建 skeleton + parts
```

`merge.py` 会打印 `推导覆盖: N/641`，并拒绝以下情况：
- 推导 id 不存在或重复；
- `zh` / `en` 不是数组、为空、步骤数不一致；
- 少于 3 步、某一步为空。
