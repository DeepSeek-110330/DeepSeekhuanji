#!/usr/bin/env python3
"""合并所有 batch*.json 到 knowledge.json，并做完整性校验。"""
import json, glob, os, sys

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(DATA_DIR, "knowledge.json")

REQUIRED = ["id", "title", "titleEn", "branch", "level", "summary", "summaryEn",
            "definition", "definitionEn", "formulas", "properties", "propertiesEn",
            "examples", "links"]

BRANCHES = {"harmonic-analysis","pde-advanced","stochastic","riemannian","topology","complex-analysis","elementary-basics","elementary","plane-geometry","algebra","function","trigonometry","sequence","analytic",
            "calculus","multivariable","complex","ode","pde","numerical","real-analysis","functional-analysis","differential-geometry","linear","probability",
            "number","vector","set-logic","solid-geometry","combinatorics","abstract-algebra","dynamical-systems"}

def main():
    base = json.load(open(BASE))
    # 以 batch*.json 为唯一数据源，避免重复合并
    base["nodes"] = []
    merged = []
    known_ids = set()
    seen = set()

    errors = []
    warnings = []
    seen = set(known_ids)
    new_ids = set()

    for f in sorted(glob.glob(os.path.join(DATA_DIR, "batch*.json"))):
        try:
            nodes = json.load(open(f))
        except Exception as e:
            errors.append(f"{os.path.basename(f)}: JSON 解析失败: {e}")
            continue
        if not isinstance(nodes, list):
            errors.append(f"{os.path.basename(f)}: 顶层不是数组")
            continue

        for n in nodes:
            nid = n.get("id", "?")
            # 必填字段
            for k in REQUIRED:
                if k not in n or n[k] in (None, "", []):
                    errors.append(f"{nid}: 缺字段 {k}")
            # id 唯一
            if nid in seen:
                errors.append(f"{nid}: id 重复")
            seen.add(nid); new_ids.add(nid)
            # branch 合法
            if n.get("branch") not in BRANCHES:
                errors.append(f"{nid}: 非法 branch={n.get('branch')}")
            # level 1-5
            lv = n.get("level")
            if not isinstance(lv, int) or not (1 <= lv <= 5):
                errors.append(f"{nid}: level 非法={lv}")
            # properties 中英数量一致
            if len(n.get("properties", [])) != len(n.get("propertiesEn", [])):
                warnings.append(f"{nid}: properties 中英数量不一致")
            # 公式必须有 latex
            for i, fm in enumerate(n.get("formulas", [])):
                if "latex" not in fm:
                    errors.append(f"{nid}: formulas[{i}] 缺 latex")
            # 绘图表达式检查
            if "plot" in n:
                p = n["plot"]
                if not isinstance(p, dict) or "type" not in p:
                    errors.append(f"{nid}: plot 结构错误")
                elif p["type"] not in ("function","geometry","unitcircle","numberline","contour","vectorfield","conformal","slopefield","scatter","quadrature","curve3d","surface3d","custom"):
                    errors.append(f"{nid}: plot.type 未知={p['type']}")
            merged.append(n)

    # 链接完整性（允许指向尚未存在的 id，仅提示）
    all_ids = {n["id"] for n in merged}
    for n in merged:
        for l in n.get("links", []):
            if l not in all_ids:
                warnings.append(f"{n['id']}: link -> {l} (尚未生成)")

    print(f"节点总数: {len(merged)}  (新增 {len(new_ids)})")
    print(f"错误: {len(errors)}")
    for e in errors: print("  ✗", e)
    print(f"警告: {len(warnings)}")
    for w in warnings[:40]: print("  ⚠", w)
    if len(warnings) > 40: print(f"  ... 还有 {len(warnings)-40} 条")

    if errors:
        print("\n有错误，未写入。请修复后重试。")
        sys.exit(1)

    base["nodes"] = merged
    json.dump(base, open(BASE, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    print(f"\n已写入 {BASE}")

if __name__ == "__main__":
    main()
