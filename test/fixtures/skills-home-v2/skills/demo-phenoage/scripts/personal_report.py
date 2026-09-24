#!/usr/bin/env python3
"""Fixture: reads marker,value,unit rows, writes report.md and result.json.

A CRP above 10 mg/dL is refused with exit code 3 and problems.json, like skillkit.
"""
import argparse, csv, json
from pathlib import Path

p = argparse.ArgumentParser()
p.add_argument("--biomarkers", required=True)
p.add_argument("--age", type=float, required=True)
p.add_argument("--sex")
p.add_argument("--out", required=True)
a = p.parse_args()
rows = {r["marker"]: float(r["value"]) for r in csv.DictReader(open(a.biomarkers, encoding="utf-8"))}
out = Path(a.out); out.mkdir(parents=True, exist_ok=True)
if rows.get("crp_mg_dl", 0) > 10:
    (out / "problems.json").write_text(json.dumps({"schema": "longevity-problems/1", "problems": [{"key": "crp_mg_dl", "label": "C反应蛋白", "kind": "range", "message_zh": "C反应蛋白 不在合理范围。"}]}, ensure_ascii=False), encoding="utf-8")
    (out / "report.md").write_text("# 演示\n\n## 输入没有通过检查\n\n- C反应蛋白 不在合理范围。\n\n边界: fixture\n", encoding="utf-8")
    raise SystemExit(3)
score = round(a.age + rows["albumin_gL"] / 10 - 4.5 + rows["crp_mg_dl"], 3)
(out / "report.md").write_text(f"# 演示\n\n演示年龄是 {score} 岁。\n性别 {a.sex}\n\n边界: fixture\n", encoding="utf-8")
(out / "result.json").write_text(json.dumps({"schema": "longevity-result/1", "skill": "demo-phenoage", "outputs": {"phenoage": {"value": score, "unit": "a", "label_zh": "演示年龄"}}}, ensure_ascii=False), encoding="utf-8")
