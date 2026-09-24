#!/usr/bin/env python3
import argparse
from pathlib import Path
p = argparse.ArgumentParser(); p.add_argument("--out", required=True); a = p.parse_args()
Path(a.out).mkdir(parents=True, exist_ok=True)
(Path(a.out) / "report.md").write_text("# 特殊运行时\n\n跑完了。\n\n边界: fixture\n", encoding="utf-8")
