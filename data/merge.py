#!/usr/bin/env python3
"""合并所有 batch*.json 到 knowledge.json，并做完整性校验。"""
import json, glob, os, sys

DATA_DIR = os.path.dirname(os.path.abspath(__file__))
BASE = os.path.join(DATA_DIR, "knowledge.json")
DERIV_DIR = os.path.join(DATA_DIR, "derivations")

REQUIRED = ["id", "title", "titleEn", "branch", "level", "summary", "summaryEn",
            "definition", "definitionEn", "formulas", "properties", "propertiesEn",
            "examples", "links"]

BRANCHES = {"harmonic-analysis","pde-advanced","stochastic","riemannian","topology","complex-analysis","elementary-basics","elementary","plane-geometry","algebra","function","trigonometry","sequence","analytic",
            "calculus","multivariable","complex","ode","pde","numerical","real-analysis","functional-analysis","differential-geometry","linear","probability",
            "number","vector","set-logic","solid-geometry","combinatorics","abstract-algebra","dynamical-systems","special-functions","statistics","math-history","graph-theory","mathematical-logic","optimization-or"}


def load_derivations(ids, errors):
    """读取 data/derivations/*.json，返回 id -> {derivation, derivationEn}。

    推导是叠加层，不写进 batch*.json；这样 641 个节点的正文与 110 个批次文件
    不会被推导批次反复改写。每个条目必须中英同步、步骤数一致。
    """
    entries = {}
    if not os.path.isdir(DERIV_DIR):
        return entries
    for path in sorted(glob.glob(os.path.join(DERIV_DIR, "*.json"))):
        name = os.path.basename(path)
        try:
            with open(path, encoding="utf-8") as f:
                obj = json.load(f)
        except Exception as e:
            errors.append(f"{name}: JSON 解析失败: {e}")
            continue
        nodes = obj.get("nodes", obj)
        if not isinstance(nodes, dict):
            errors.append(f"{name}: 顶层必须是对象或含 nodes 对象")
            continue
        for nid, entry in nodes.items():
            if nid in entries:
                errors.append(f"{name}: 推导 id 重复: {nid}")
                continue
            if nid not in ids:
                errors.append(f"{name}: 推导指向不存在的知识点: {nid}")
                continue
            zh = entry.get("zh")
            en = entry.get("en")
            if not isinstance(zh, list) or not isinstance(en, list):
                errors.append(f"{nid}: derivation 必须是 zh/en 两个数组")
                continue
            if len(zh) != len(en):
                errors.append(f"{nid}: 推导中英步骤数不一致 ({len(zh)} vs {len(en)})")
                continue
            if len(zh) < 3:
                errors.append(f"{nid}: 推导至少需要 3 步（当前 {len(zh)}）")
                continue
            bad = False
            for i, (z, e) in enumerate(zip(zh, en), 1):
                if not isinstance(z, str) or not z.strip():
                    errors.append(f"{nid}: 第 {i} 步中文为空")
                    bad = True
                if not isinstance(e, str) or not e.strip():
                    errors.append(f"{nid}: 第 {i} 步英文为空")
                    bad = True
            if bad:
                continue
            entries[nid] = {
                "derivation": zh,
                "derivationEn": en,
            }
    return entries


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

    # 推导叠加层（data/derivations/*.json）
    derivations = load_derivations(all_ids, errors)
    for n in merged:
        d = derivations.get(n["id"])
        if d:
            n.update(d)

    print(f"节点总数: {len(merged)}  (新增 {len(new_ids)})")
    print(f"推导覆盖: {len(derivations)}/{len(merged)}")
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
