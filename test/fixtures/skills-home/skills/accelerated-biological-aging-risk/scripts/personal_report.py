#!/usr/bin/env python3
import argparse
from pathlib import Path

parser = argparse.ArgumentParser()
parser.add_argument("--age", required=True)
parser.add_argument("--biomarkers", required=True)
parser.add_argument("--out", required=True)
args = parser.parse_args()
text = Path(args.biomarkers).read_text(encoding="utf-8")
out = Path(args.out)
out.mkdir(parents=True, exist_ok=True)
(out / "report.md").write_text(
    f"表型年龄: fixture\n边界: fixture only\n{text}\n",
    encoding="utf-8",
)
