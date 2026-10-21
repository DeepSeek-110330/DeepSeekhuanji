# 复分析高阶推导 · 高危清单（D69~D73）

## 共形、Möbius、Riemann 映射、Schwarz
- 共形映射：非常值全纯 $f$ 且 $f'(z_0)\ne0$ 时局部共形；$f'=0$ 的临界点一般不保角（可能把角放大整数倍）。全局共形双射 = 双全纯。
- Möbius：$ad-bc\ne0$，在 $\widehat{\mathbb C}$ 上双全纯；把广义圆（圆/直线）映为广义圆；交比在 Möbius 下不变；四点共圆/共线 $\iff$ 交比为实数；三对点唯一确定。
- Riemann 映射：单连通真子域 $\Omega\subsetneq\mathbb C$ 存在双全纯 $f:\Omega\to\mathbb D$；唯一性需固定 $z_0$ 与辐角（$f(z_0)=0$、$f'(z_0)>0$）。边界到边界连续需额外条件（如 Jordan 曲线，Carathéodory）；不要无条件写“边界同胚”。
- Schwarz 引理：$f:\mathbb D\to\mathbb D$ 全纯、$f(0)=0$，则 $|f(z)|\le|z|$、$|f'(0)|\le1$；等号（某点或导数）推出 $f(z)=e^{i\theta}z$。一般点用 Schwarz–Pick。
- 最大模原理：区域上非常值全纯函数不能在内点取最大模；有界区域+边界连续时最大模在边界；最小模需 $f$ 无零点（否则用 $1/f$）。

## 延拓、整函数、因子分解、亚纯
- 解析延拓：沿路径的延拓由局部幂级数连接；同一点不同路径可能得到不同值（单值性障碍）；恒等定理要求极限点在内域。
- 单值性定理：区域单连通、沿每条路径可延拓、且延拓在路径同伦下一致（或局部单值）时，得到全纯单值函数；条件不能漏。
- 整函数：Liouville（有界⇒常数）；多项式增长与次数；Casorati–Weierstrass 在本质奇点附近稠密；Picard 小定理：非常值整函数至多漏一个值（$e^z$ 漏 0）；大定理：本质奇点邻域至多漏一个值。
- Weierstrass 分解：给定离散零集（无聚点）与重数，存在整函数以它们为零点；一般用典范因子 $E_p$ 保证收敛；有限阶时可控制 genus；$\sin z$ 的经典分解。
- 亚纯函数：极点孤立、无本质奇点；在 $\widehat{\mathbb C}$ 上亚纯 = 有理函数；Mittag-Leffler 处理极点主部。
- Mittag-Leffler：离散极点集、给定主部，存在亚纯函数；需收敛因子；不要与 Weierstrass（零点）混淆。
- Picard：小定理与大定理的“至多漏一个值”；证明通常用模函数/单值化或 Bloch，不能只引用；条件：非常值/本质奇点。

## 正规族、Gamma、Zeta、椭圆
- 正规族：局部一致有界 ⇒ 正规（Montel）；等价于等度连续/局部有界；Marty 定理用球面导数；极限可能为常数，仍算正规。
- Gamma：$\Gamma(z+1)=z\Gamma(z)$、$\Gamma(n)=(n-1)!$、反射公式、Weierstrass 乘积；极点在 $0,-1,-2,\dots$，留数 $(-1)^n/n!$；不是整函数。
- Zeta：$\zeta(s)=\sum n^{-s}$ 在 $\Re s>1$；解析延拓为 $\mathbb C\setminus\{1\}$ 上亚纯，简单极点留数 1；函数方程；平凡零点 $-2,-4,\dots$；临界带 $0<\Re s<1$；Euler 乘积 $\Re s>1$。
- 椭圆函数：双周期亚纯；Liouville 说明非常值椭圆函数在基本平行四边形内极点留数和为 0；Weierstrass $\wp$ 满足 $\wp'^2=4\wp^3-g_2\wp-g_3$；不要把它与 Jacobi 形式混用。
- Schwarz–Christoffel：上半平面到多边形内部；$f'(z)=C\prod(z-a_k)^{\alpha_k-1}$，$\alpha_k$ 为内角/$\pi$；需顶点预像、收敛与边界对应条件；不要漏指数。
- 留数进阶：留数定理需孤立奇点、路径不穿奇点；Jordan 引理需上半平面半圆、$e^{iz}$；分支切割/多值函数需选分支；小圆弧引理；无穷远留数符号。

## 调和、Riemann 曲面、单值化
- 调和函数：局部实部/虚部全纯；均值性质；最大/最小原理；Dirichlet 问题在圆盘用 Poisson 核；边界连续需边界函数连续。
- Poisson 积分：$P_r(\theta)=(1-r^2)/(1-2r\cos\theta+r^2)$；$u(re^{i\theta})=\frac1{2\pi}\int P_r(\theta-\phi)f(\phi)d\phi$；边界极限为 $f$（可积/连续条件）。
- Harnack：正调和函数在紧子集上相互控制；Harnack 不等式；单调收敛/局部一致收敛的极限仍调和；需连通区域。
- Riemann 曲面：复一维流形、全纯转移；紧 Riemann 曲面上的亚纯函数构成域；genus；单值化。
- 单值化：单连通 Riemann 曲面分类为 $\widehat{\mathbb C}$、$\mathbb C$、$\mathbb D$；紧曲面由 universal cover 的商；亏格 0/1/≥2 分别对应球面/复环/双曲；不要无条件把任意曲面写成 $\mathbb D/\Gamma$（需单值化）。
- Poincaré 双曲：$\mathbb D$ 上度量 $ds^2=4|dz|^2/(1-|z|^2)^2$，曲率 $-1$；等距群 $PSL(2,\mathbb R)$；测地线为与边界正交的圆弧/直径；边界无穷远。
