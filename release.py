#!/usr/bin/env python3
"""一键发布：升版本号（若 js/ 或 css/ 有改动）→ merge → build_runtime → 提交 → 推送。

用法：
  python3 release.py -m "提交说明"            # 完整发布（含 git push）
  python3 release.py -m "..." --no-push       # 只提交不推送
  python3 release.py -m "..." --no-bump       # 跳过版本号升级
"""
import argparse
import os
import re
import subprocess
import sys

ROOT = os.path.dirname(os.path.abspath(__file__))
V_FILES = ["index.html", "js/app.js", "js/plot.js", "js/stars.js", "plot-test.html"]


def run(cmd, capture=False, check=True):
    r = subprocess.run(cmd, cwd=ROOT, text=True, capture_output=capture)
    if check and r.returncode != 0:
        sys.exit("✗ 命令失败（exit %d）: %s\n%s" % (r.returncode, " ".join(cmd), (r.stdout or "")[-500:]))
    return r


def changed_paths(*paths):
    r = run(["git", "status", "--porcelain", "--"] + list(paths), capture=True)
    return bool(r.stdout.strip())


def bump_version():
    pat = re.compile(r"\?v=(\d+)")
    versions = set()
    for f in V_FILES:
        with open(os.path.join(ROOT, f), encoding="utf-8") as fh:
            versions |= {int(m.group(1)) for m in pat.finditer(fh.read())}
    if not versions:
        print("（未找到 ?v=N，跳过）")
        return
    if len(versions) != 1:
        sys.exit("✗ 版本号不一致：%s（请先手工统一）" % sorted(versions))
    old = versions.pop()
    for f in V_FILES:
        p = os.path.join(ROOT, f)
        with open(p, encoding="utf-8") as fh:
            s = fh.read()
        s2 = pat.sub("?v=%d" % (old + 1), s)
        if s2 != s:
            with open(p, "w", encoding="utf-8") as fh:
                fh.write(s2)
    print("✓ 版本号 v=%d → v=%d" % (old, old + 1))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("-m", "--message", required=True, help="git commit 说明")
    ap.add_argument("--no-push", action="store_true", help="只提交，不推送")
    ap.add_argument("--no-bump", action="store_true", help="不升版本号")
    args = ap.parse_args()

    # 1) 版本号（只在前端有改动时需要）
    if not args.no_bump and changed_paths("js", "css"):
        bump_version()
    else:
        print("（js/css 无改动或 --no-bump，跳过版本号）")

    # 2) 合并校验（错误必须为 0）
    r = run(["python3", "data/merge.py"], capture=True)
    tail = r.stdout.strip().splitlines()[-4:]
    print("\n".join(tail))
    if "错误: 0" not in r.stdout:
        sys.exit("✗ merge 校验存在错误，已中止发布")

    # 3) 重建运行时分片
    r = run(["python3", "data/build_runtime.py"], capture=True)
    print(r.stdout.strip())

    # 4) 提交
    run(["git", "add", "-A"])
    r = run(["git", "diff", "--cached", "--quiet"], check=False)
    if r.returncode == 0:
        print("（没有需要提交的变更）")
    else:
        run(["git", "commit", "-q", "-m", args.message])
        print("✓ 已提交")

    # 5) 推送
    if args.no_push:
        print("（--no-push：跳过推送）")
    else:
        r = run(["git", "push"], capture=True, check=False)
        if r.returncode == 0:
            print("✓ 已推送到 GitHub")
        else:
            print("⚠ push 失败（大概率是网络窗口问题）：")
            print((r.stderr or r.stdout or "").strip()[-300:])
            print("  网络恢复后重试： git push")
    print("—— 发布流程结束 ——")


if __name__ == "__main__":
    main()
