#!/usr/bin/env python3
import argparse
from pathlib import Path
p = argparse.ArgumentParser(); p.add_argument("--entity", action="append", default=[]); p.add_argument("--medications"); p.add_argument("--out", required=True); a = p.parse_args()
meds = Path(a.medications).read_text(encoding="utf-8").split() if a.medications else []
Path(a.out).mkdir(parents=True, exist_ok=True)
(Path(a.out) / "report.md").write_text("# 证据查询\n\n" + "".join(f"## 查询：{e}\n\n" for e in a.entity) + "".join(f"- {m}：不能据此停。\n" for m in meds) + "\n边界: fixture\n", encoding="utf-8")
