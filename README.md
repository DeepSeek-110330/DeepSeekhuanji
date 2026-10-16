# 数学知识银河 (Math Knowledge Galaxy)

一个**3D 星系式的数学知识可视化网站**：每个光点是一个数学知识点，点击即可展开完整内容（中英双语定义、公式、性质、例题、代码实时绘制的配图）。

纯前端项目——HTML + CSS + JavaScript，**无后端、无数据库、无构建步骤**。

---

## 快速开始

```bash
cd math-galaxy
python3 -m http.server 8123
```

浏览器打开 <http://localhost:8123>

> **必须用本地服务器**，不能直接双击 `index.html`——浏览器会因 CORS 拦截 `fetch` 读取本地 JSON 与 ES 模块。
>
> 端口建议用 **8123**：之前所有开发和缓存都是在 8123 上，换端口会导致 CDN 资源重新下载。

---

## 项目结构

```
math-galaxy/
├── index.html              页面骨架（79 行）
├── css/style.css           样式：深空主题、玻璃拟态面板（659 行）
├── js/
│   ├── app.js              主逻辑：场景、相机、交互、面板、搜索（1035 行）
│   ├── plot.js             绘图引擎：12 种数学图表（1802 行）
│   └── stars.js            星体渲染：着色器星点、星云贴图（330 行）
├── plot-test.html          绘图引擎的测试页（开发用）
└── data/
    ├── knowledge.json      ★ 合并后的知识库（唯一的运行时数据，约 6.0 MB）
    ├── batch*.json         90 个批次源文件（生成内容，合并后得到 knowledge.json）
    ├── merge.py            合并 + 校验脚本
    ├── SCHEMA.md           数据格式规范（生成内容前必读）
    ├── IDLIST.txt          当前所有合法 id 清单（校验链接用）
    ├── README.md           本文件
    ├── REPORT.md           进度报告
    └── AGENT.md            接手指南（给下一个 AI 会话看）
```

---

## 功能

| 功能 | 说明 |
|---|---|
| **银河星图** | 知识点按学科分支分布在螺旋旋臂上，每分支一种颜色 |
| **点击点亮** | 点击光点 → 相机飞过去 → 右侧展开完整内容 |
| **双语切换** | 面板右上角「EN / 中文」一键切换中英文内容 |
| **公式渲染** | KaTeX 渲染 LaTeX 公式 |
| **12 种数学图表** | 函数图、几何图、等高线、向量场、共形映射、斜率场、坐标轴、散点图、数值积分、3D 曲线、3D 曲面、单位圆——全部用代码实时绘制，可缩放不模糊 |
| **搜索** | 按标题/摘要/标签搜索，标题精确匹配优先 |
| **分支筛选** | 左下角「知识分支」面板可收放，点击分支只看该分支 |
| **性能自适应** | 帧率低时自动降低渲染分辨率 |

---

## 数据规模

| 项目 | 数量 |
|---|---|
| 知识点 | **549 个** |
| 公式 | 2713 条 |
| 例题 | 1119 道 |
| 配图 | 409 张 |
| 分支 | 29 条（有内容的）／30 条已定义 |
| 中文正文 | 约 49 万字 |

覆盖范围：**小学 → 初中 → 高中（三角、数列、解析几何、立体几何、计数原理等）→ 大学（微积分/线性代数（含矩阵微分）/概率统计/复变/ODE/PDE/数值分析/实变/泛函/微分几何）→ 研究生（拓扑学/复分析/随机过程/黎曼几何/调和分析/PDE 进阶）**

---

## 数据格式速览

运行时只读 `data/knowledge.json`：

```jsonc
{
  "meta": { "title": "数学知识银河", ... },
  "branches": {
    "calculus": { "name": "微积分", "nameEn": "Calculus", "color": "#d16bff" }
  },
  "nodes": [
    {
      "id": "derivative",              // 全局唯一
      "title": "导数", "titleEn": "Derivative",
      "branch": "calculus",            // 必须属于 branches 里的键
      "level": 4,                      // 1~5，影响星点大小与位置
      "summary": "…", "summaryEn": "…",
      "definition": "…（支持 **粗体** 与 $公式$、$$独立公式$$）",
      "definitionEn": "…",
      "formulas": [{ "latex": "…", "note": "…", "noteEn": "…" }],
      "expression": { "text": "…", "symbol": "…", "note": "…", "noteEn": "…" },
      "properties": ["…"], "propertiesEn": ["…"],   // 中英数量必须一致
      "plot": { "type": "function", … },            // 可选
      "examples": [{ "problem": "…", "solution": "…" }],
      "tags": ["…"],
      "links": ["另一个知识点的 id"]                 // 必须真实存在
    }
  ]
}
```

完整规范见 `data/SCHEMA.md`。

---

## 发布给别人看

这是纯静态站点，最简单的做法是把 `math-galaxy` 文件夹拖到 **Netlify Drop**（app.netlify.com/drop），几秒后拿到一个网址。

上传时只需这几个文件：

```
index.html
css/style.css
js/app.js  js/plot.js  js/stars.js
data/knowledge.json
```

（`batch*.json`、`merge.py`、`SCHEMA.md`、`IDLIST.txt`、`plot-test.html` 是开发用的，不必上传。）

**依赖说明**：Three.js 与 KaTeX 通过 CDN（jsdelivr）加载，因此**访问者需要联网**；国内访问 jsdelivr 有时较慢。若要完全离线，需把这两个库下载到本地并改为相对路径引用。

---

## 开发者须知（重要）

- **改了 `js/` 下的任何文件，必须提升版本号**：把 `index.html`、`js/app.js`、`plot-test.html` 里的 `?v=N` 统一改成 `?v=N+1`。否则浏览器会继续用旧缓存，改动看不到。
  （当前版本：**v=10**）
- 知识点数据用 `fetch(..., { cache: "no-cache" })` 加载，每次都会向服务器校验，**加完知识点刷新即可看到**。
- 加知识点后要跑合并脚本：

  ```bash
  cd data
  python3 merge.py     # 校验 + 合并所有 batch*.json → knowledge.json
  ```

  脚本会检查字段完整性、id 冲突、非法分支、坏链接、绘图类型，**有错会拒绝写入**。

更多细节（如何继续生成内容、历史踩过的坑）见 **`WORKFLOW.md`**，当前进度见 **`REPORT.md`**。
