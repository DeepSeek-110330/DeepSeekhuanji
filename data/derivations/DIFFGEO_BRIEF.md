# 微分几何推导 · 高危清单（D64~D68）

## 曲线论
- 正则曲线：$\gamma'(t)\ne0$；参数变换要求 $dt/ds\ne0$；弧长 $s(t)=\int|\gamma'|$，弧长参数满足 $|\gamma'|=1$。
- Frenet 标架：$T=\gamma'$、$N=T'/|T'|$、$B=T\times N$；$N$ 只在曲率 $\kappa>0$ 处有定义；不要对直线强行定义主法向。
- 曲率 $\kappa=|T'|$（弧长参数）；挠率 $\tau=-B'\cdot N$ 或 $\tau=B'\cdot N$ 的符号随约定；必须统一并说明。
- Frenet–Serret：$T'=\kappa N$、$N'=-\kappa T+\tau B$、$B'=-\tau N$（弧长参数、上述约定）；符号不能混。
- 曲线论基本定理：给定连续 $\kappa>0$ 与连续 $\tau$，存在唯一（差一个刚体运动）的弧长参数曲线；需 $\kappa>0$ 保证 Frenet 标架。
- 一般参数公式：$\kappa=|\gamma'\times\gamma''|/|\gamma'|^3$，$\tau=(\gamma'\times\gamma'')\cdot\gamma'''/|\gamma'\times\gamma''|^2$；需 $\gamma'\times\gamma''\ne0$（$\kappa>0$）。

## 曲面论
- 正则参数曲面：$r_u\times r_v\ne0$；切平面由 $r_u,r_v$ 张成；法向 $n=(r_u\times r_v)/|...|$。
- 第一基本形式 $E=r_u\cdot r_u$、$F=r_u\cdot r_v$、$G=r_v\cdot r_v$；面积元 $dA=\sqrt{EG-F^2}\,du\,dv$；需 $EG-F^2>0$。
- 第二基本形式 $e=r_{uu}\cdot n$、$f=r_{uv}\cdot n$、$g=r_{vv}\cdot n$；法向换号会同时改变 $e,f,g$、$K$ 不变、$H$ 变号。
- 法曲率 $\kappa_n=II/I$；主曲率是形状算子 $S=-dn$ 的特征值；$K=\det S$、$H=\frac12\operatorname{tr}S$；公式 $K=(eg-f^2)/(EG-F^2)$、$H=(eG-2fF+gE)/(2(EG-F^2))$ 要与法向约定一致。
- 高斯映射 $N:U\to S^2$；$dN$ 与形状算子符号约定要统一；Gauss 曲率是 $dN$ 的雅可比（带符号）。
- Theorema Egregium：$K$ 只由第一基本形式决定，是内蕴量；不能把第二基本形式的显式公式当作内蕴证明。
- 测地线：测地曲率为零；弧长一阶变分为零；方程 $\gamma''+\Gamma^k_{ij}\gamma'^i\gamma'^j=0$（或等价形式）；需正则曲线。
- Gauss–Bonnet：紧致可定向曲面（可带边界）$\int_MK\,dA+\int_{\partial M}k_g\,ds=2\pi\chi(M)$；边界定向、测地曲率符号要写清；无边界时 $\int K=2\pi\chi$。
- 等距：第一基本形式相同（局部）；可展曲面 $K=0$；极小曲面 $H=0$；不要把等距与嵌入方式混淆。

## 流形、形式与积分
- 光滑流形：局部欧氏坐标卡、转移映射光滑；切空间用曲线等价类或导数算子定义；切映射的推前/拉回方向不能反。
- 向量场与流：积分曲线、流满足 $\phi_{s+t}=\phi_s\circ\phi_t$；李括号 $[X,Y]=XY-YX$ 的反称性、雅可比恒等式；坐标公式。
- 微分形式：$\Omega^k(M)$、外积反称、$dx^I$ 约定；$k$-形式在 $k$ 维切空间上的取值；拉回 $f^*\omega$ 的公式。
- 外微分：$d^2=0$；$d(\omega\wedge\eta)=d\omega\wedge\eta+(-1)^k\omega\wedge d\eta$；闭/恰当；Poincaré 引理需可缩/星形区域。
- 流形积分：需要定向（或密度）；$n$-形式积分；边界诱导定向“外法向优先”；Stokes $\int_M d\omega=\int_{\partial M}\omega$ 需紧支撑/边界光滑；链上的 Stokes 不需要 $M$ 整体可定向。
- 李导数：$\mathcal L_X\omega=\frac{d}{dt}|_{t=0}\phi_t^*\omega$；Cartan 公式 $\mathcal L_X=d\iota_X+\iota_Xd$；李括号符号约定。
