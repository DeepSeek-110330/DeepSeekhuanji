#!/usr/bin/env python3
"""把 knowledge.json 拆成运行时分片，用于「首屏骨架 + 按需加载」。

产出：
  data/skeleton.json      —— 首屏加载（每个知识点的轻量字段）
  data/parts/<branch>.json —— 点开知识点时按分支加载完整内容

用法：内容更新后先跑 merge.py，再跑本脚本。
"""
import collections
import json
import os

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, "knowledge.json")
PARTS_DIR = os.path.join(HERE, "parts")

# 从骨架里剔除的重字段（放进按需分片）
HEAVY = (
    "definition", "definitionEn",
    "formulas",
    "properties", "propertiesEn",
    "examples", "expression",
)

with open(SRC, encoding="utf-8") as f:
    d = json.load(f)

nodes = d["nodes"]
skeleton = {"meta": d.get("meta", {}), "branches": d["branches"], "nodes": []}
parts = collections.defaultdict(dict)

for n in nodes:
    skeleton["nodes"].append({k: v for k, v in n.items() if k not in HEAVY})
    part = {k: n[k] for k in HEAVY if k in n and n[k]}
    if part:
        parts[n["branch"]][n["id"]] = part

sk_path = os.path.join(HERE, "skeleton.json")
with open(sk_path, "w", encoding="utf-8") as f:
    json.dump(skeleton, f, ensure_ascii=False, separators=(",", ":"))

os.makedirs(PARTS_DIR, exist_ok=True)
for name in os.listdir(PARTS_DIR):
    if name.endswith(".json"):
        os.remove(os.path.join(PARTS_DIR, name))

total = 0
for branch, obj in parts.items():
    p = os.path.join(PARTS_DIR, branch + ".json")
    with open(p, "w", encoding="utf-8") as f:
        json.dump(obj, f, ensure_ascii=False, separators=(",", ":"))
    total += os.path.getsize(p)

sk_size = os.path.getsize(sk_path)
print("skeleton.json : %.0f KB（%d 个节点）" % (sk_size / 1024, len(skeleton["nodes"])))
print("parts/        : %d 个分片，共 %.1f MB" % (len(parts), total / 1024 / 1024))
sizes = sorted(
    ((os.path.getsize(os.path.join(PARTS_DIR, f)), f) for f in os.listdir(PARTS_DIR)),
    reverse=True,
)
for s, f in sizes[:3]:
    print("  最大的分片: %-30s %.0f KB" % (f, s / 1024))
