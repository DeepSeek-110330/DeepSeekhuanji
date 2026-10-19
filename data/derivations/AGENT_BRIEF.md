# 推导生成代理 · 统一说明（v=31）

你正在为「数学知识银河」写**知识点详情面板**里的分步推导。目标不是写一段泛泛的解释，而是写一条**可核对、条件完整、中英同步**的数学推导。

## 必读

1. `data/SCHEMA.md` 的「推导叠加层（v=31 起）」。
2. `data/derivations/D01-calculus-core.json` 的写法与详细程度（这是质量基准）。
3. 你要写的每个知识点在 `data/knowledge.json` 中的完整条目：`definition`、`formulas`、`properties`、`examples`、`links`。不要只凭标题猜内容。
4. 需要时参考 `HANDOVER.md` 第 9 节错误目录（尤其 9.1 蕴含方向、9.2 定理条件、9.3 符号约定）。

## 输出

只写一个文件：`data/derivations/<批次文件名>.json`。**不要修改其他任何文件，不要运行 merge.py/build_runtime.py。**

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

- 每个知识点 **5~7 步**；`zh` 与 `en` 必须**等长、逐步对应**。
- 每一步写清「条件 → 推理 → 结论」；不能只写结论，也不能用“显然”“易得”跳过关键条件。
- 公式用 `$...$` / `$$...$$`；中文出现在数学模式里必须包 `\text{}`。
- 公式过宽时用 `\begin{aligned}` 分行，保证 500px 宽的面板不横向裁切。
- 英文是**数学翻译**，不是逐字直译；术语、条件、量词必须与中文一致。
- 不编造定理。若某个结论需要额外条件（连续、可微、可积、有限、非零、单连通等），必须写明。
- 不把“知识图谱相邻”当成“数学蕴含”；推导只依据定义、定理与标准结论。
- 每步尽量给出公式或明确的计算；证明题要写辅助函数/分割/反例。

## 自检

写完后用 Python 检查：

```python
import json
d=json.load(open('data/derivations/<你的文件>.json',encoding='utf-8'))
k=json.load(open('data/knowledge.json',encoding='utf-8'))
ids={n['id'] for n in k['nodes']}
for nid,e in d['nodes'].items():
    assert nid in ids, nid
    assert len(e['zh'])==len(e['en']), nid
    assert len(e['zh'])>=5, nid
    assert all(s.strip() for s in e['zh']+e['en']), nid
```

## 回执（≤8 行）

只报：文件路径、节点数、每个节点的步数、自检结果、你不确定/需要复核的点。不要粘贴正文。
