"""Regenerate the Mirobody wire fixtures from Mirobody's own renderer.

The plugin reads Mirobody through MCP, and Mirobody answers with a compact
pipe table (`mirobody.agent.tools._render.render_compact`), not JSON rows.
These fixtures are produced by that renderer so the plugin's parser is tested
against the real format, not against a shape someone imagined.

    MIROBODY_SITE=/path/to/site-packages python3 test/fixtures/mirobody/generate.py

Writes record.json (one demo person's observations and medications) and
cases/*.json (the exact tool payload Mirobody 1.5 returns for a set of
canonical calls). test/fake-mirobody.mjs serves record.json over MCP and must
render the same text for the same calls; test/mirobody-format.mjs checks that.
"""

from __future__ import annotations

import json
import os
import random
import sys
from datetime import date, timedelta
from pathlib import Path

SITE = os.environ.get("MIROBODY_SITE", "")
if SITE:
    sys.path.insert(0, SITE)  # a site-packages that has mirobody 1.5 installed

from mirobody.agent.tools._render import envelope_meta, render_compact  # noqa: E402
from mirobody.kernel import meds as meds_kernel  # noqa: E402
from mirobody.kernel import tools  # noqa: E402

HERE = Path(__file__).resolve().parent
TZ = "Asia/Shanghai"
TODAY = "2026-09-24"

CHECKUPS = ["2025-10-18", "2026-01-20", "2026-04-22", "2026-08-26"]
FILES = ["2025-10 年度体检报告.pdf", "2026-01 复查.pdf", "2026-04 复查.pdf", "2026-08 年度体检报告.pdf"]

# indicator, printed name, LOINC, unit, one value per checkup
LABS = [
    ("Albumin-ALB", "白蛋白", "1751-7", "g/L", ["44.1", "44.8", "45.2", "45.6"]),
    ("Creatinine-Cr", "肌酐", "2160-0", "umol/L", ["82", "80", "79", "81"]),
    ("Fasting Blood Glucose-FBG", "空腹血糖", "14771-0", "mmol/L", ["6.1", "5.9", "5.6", "5.4"]),
    ("hs-CRP", "超敏C反应蛋白", "30522-7", "mg/L", ["4.2", "2.9", "1.8", "1.2"]),
    ("Lymphocyte Percentage-LYM%", "淋巴细胞百分比", "736-9", "%", ["28.5", "30.1", "31.2", "32.0"]),
    ("Mean Corpuscular Volume-MCV", "平均红细胞体积", "787-2", "fL", ["90.2", "89.8", "90.5", "90.1"]),
    ("Red Cell Distribution Width-RDW-CV", "红细胞分布宽度", "788-0", "%", ["13.4", "13.2", "13.1", "12.9"]),
    ("Alkaline Phosphatase-ALP", "碱性磷酸酶", "6768-6", "U/L", ["78", "74", "72", "70"]),
    ("White Blood Cell Count-WBC", "白细胞计数", "6690-2", "10^9/L", ["7.1", "6.8", "6.3", "6.0"]),
    ("Glycated Hemoglobin-HbA1c", "糖化血红蛋白", "4548-4", "%", ["6.1", "5.9", "5.7", "5.6"]),
    ("Total Cholesterol-TC", "总胆固醇", "2093-3", "mmol/L", ["5.6", "5.4", "5.1", "4.9"]),
    ("LDL Cholesterol-LDL-C", "低密度脂蛋白胆固醇", "13457-7", "mmol/L", ["3.7", "3.5", "3.2", "3.0"]),
    ("HDL Cholesterol-HDL-C", "高密度脂蛋白胆固醇", "2085-9", "mmol/L", ["1.12", "1.18", "1.22", "1.26"]),
    ("Triglycerides-TG", "甘油三酯", "2571-8", "mmol/L", ["2.4", "1.9", "1.4", "1.2"]),
    ("Waist Circumference-WC", "腰围", "8280-0", "cm", ["94", "92", "90", "88"]),
]

DEVICE_START = date(2025, 10, 1)
DEVICE_END = date(2026, 9, 20)


def _between(first: float, last: float, step: int, span: int) -> float:
    return first + (last - first) * (step / max(span - 1, 1))


def build_record() -> dict:
    observations: list[dict] = []
    for indicator, name, loinc, unit, values in LABS:
        for day, file, value in zip(CHECKUPS, FILES, values):
            observations.append({
                "indicator": indicator, "name": name, "system": "loinc", "code": loinc,
                "unit": unit, "date": day, "time": f"{day} 08:30:00", "value": value, "file": file,
            })

    rng = random.Random("longpi-demo")
    span = (DEVICE_END - DEVICE_START).days + 1
    exercise_from = date(2026, 1, 5)
    sleep_from = date(2026, 3, 1)
    for step in range(span):
        day = DEVICE_START + timedelta(days=step)
        iso = day.isoformat()
        weekend = day.weekday() >= 5
        base = 9200 if day >= exercise_from else 6400
        steps = max(round(rng.gauss(base, 1800) * (0.8 if weekend else 1.0)), 600)
        observations.append({"indicator": "dailySteps", "name": "", "system": "device", "code": "dailySteps",
                             "unit": "count", "date": iso, "time": f"{iso} 23:59:00", "value": str(steps), "file": ""})
        sleep = (7.1 if day >= sleep_from else 6.3) + rng.uniform(-0.7, 0.7)
        observations.append({"indicator": "dailyTotalSleepTime", "name": "", "system": "device", "code": "dailyTotalSleepTime",
                             "unit": "hours", "date": iso, "time": f"{iso} 07:10:00", "value": f"{sleep:.1f}", "file": ""})
        rhr = _between(68, 61, step, span) + rng.uniform(-2, 2)
        observations.append({"indicator": "dailyRestingHeartRates", "name": "", "system": "device", "code": "dailyRestingHeartRates",
                             "unit": "count/min", "date": iso, "time": f"{iso} 23:59:00", "value": str(round(rhr)), "file": ""})
        if step % 3 == 0:
            sbp = _between(137, 125, step, span) + rng.randint(-5, 5)
            dbp = _between(87, 79, step, span) + rng.randint(-4, 4)
            observations.append({"indicator": "systolicPressures", "name": "", "system": "device", "code": "systolicPressures",
                                 "unit": "mmHg", "date": iso, "time": f"{iso} 07:40:00", "value": str(round(sbp)), "file": ""})
            observations.append({"indicator": "diastolicPressures", "name": "", "system": "device", "code": "diastolicPressures",
                                 "unit": "mmHg", "date": iso, "time": f"{iso} 07:40:00", "value": str(round(dbp)), "file": ""})
        if step % 7 == 0:
            kg = _between(78.6, 74.9, step, span) + rng.uniform(-0.4, 0.4)
            observations.append({"indicator": "bodyMasss", "name": "", "system": "device", "code": "bodyMasss",
                                 "unit": "kg", "date": iso, "time": f"{iso} 07:00:00", "value": f"{kg:.1f}", "file": ""})

    plans = [
        {"medication": "鱼油(Omega-3)", "status": "active", "schedule": "每日1次", "today": "taken",
         "since": "2026-03-01", "until": "", "source": "self", "plan_id": "p-fishoil"},
        {"medication": "维生素D3", "status": "active", "schedule": "每日1次", "today": "pending",
         "since": "2025-11-01", "until": "", "source": "self", "plan_id": "p-vitd"},
    ]
    log: list[dict] = []
    for plan_id, name, first in (("p-fishoil", "鱼油(Omega-3)", date(2026, 3, 1)), ("p-vitd", "维生素D3", date(2025, 11, 1))):
        day = first
        while day <= DEVICE_END:
            taken = rng.random() < (0.9 if plan_id == "p-fishoil" else 0.8)
            log.append({"date": day.isoformat(), "time": f"{day.isoformat()} 08:05:00", "medication": name,
                        "status": "taken" if taken else "skipped", "slot": "morning", "dose": "",
                        "recorded_by": "self", "plan_id": plan_id})
            day += timedelta(days=1)
    history = [
        {"medication": "维生素D3", "start": "2025-11-01", "end": "", "closed_by": "", "plan_id": "p-vitd"},
        {"medication": "布洛芬", "start": "2026-04-15", "end": "2026-04-20", "closed_by": "completed", "plan_id": "p-ibu"},
        {"medication": "鱼油(Omega-3)", "start": "2026-03-01", "end": "", "closed_by": "", "plan_id": "p-fishoil"},
    ]
    return {"tz": TZ, "today": TODAY, "observations": observations,
            "medications": {"plans": plans, "log": log, "history": history}}


# --- the canonical calls, answered the way Mirobody shapes them ---------------

def _by_indicator(record: dict) -> dict[str, list[dict]]:
    out: dict[str, list[dict]] = {}
    for row in record["observations"]:
        out.setdefault(row["indicator"], []).append(row)
    for rows in out.values():
        rows.sort(key=lambda r: r["time"])
    return out


def _meta(**kw) -> tools.Meta:
    return tools.Meta(tz=TZ, **kw)


def catalogue(record: dict) -> tools.Envelope:
    groups = _by_indicator(record)
    rows = []
    for name in sorted(groups):
        items = groups[name]
        rows.append({"indicator": name, "series": name, "system": items[0]["system"], "code": items[0]["code"],
                     "standard": True, "name": name, "kind": "", "count": len(items), "unit": items[0]["unit"],
                     "latest_value": items[-1]["value"], "first_date": items[0]["date"], "last_date": items[-1]["date"],
                     "total": len(groups), "reason": "", "day_known": True})
    return tools.Envelope(status="ok", data=rows, meta=_meta(row_count=len(rows), catalog_total=len(rows)))


def latest(record: dict, names: list[str]) -> tools.Envelope:
    groups = _by_indicator(record)
    rows = []
    for name in names:
        items = groups.get(name)
        if not items:
            continue
        r = items[-1]
        rows.append({"indicator": name, "series": name, "system": r["system"], "code": r["code"], "name": r["name"],
                     "time": r["time"], "date": r["date"], "value": r["value"], "unit": r["unit"],
                     "value_canonical": None, "unit_canonical": "", "modality": "", "basis": "readings",
                     "day_known": True, "provenance": "measured"})
    return tools.Envelope(status="ok", data=rows,
                          meta=_meta(aggregate="latest", aggregate_basis="readings", row_count=len(rows)))


def readings(record: dict, names: list[str], start: str, end: str, limit: int) -> tools.Envelope:
    groups = _by_indicator(record)
    rows = []
    truncated = False
    for name in names:
        items = [r for r in groups.get(name, []) if start <= r["date"] <= end]
        items = sorted(items, key=lambda r: r["time"], reverse=True)
        if len(items) > limit:
            truncated = True
        for r in items[:limit]:
            rows.append({"indicator": name, "series": name, "system": r["system"], "code": r["code"], "name": r["name"],
                         "time": r["time"], "date": r["date"], "value": r["value"], "unit": r["unit"],
                         "value_canonical": None, "unit_canonical": "", "file": r["file"], "file_key": "",
                         "row_id": None, "modality": "", "total": len(items), "day_known": True, "provenance": "measured"})
    return tools.Envelope(status="ok", data=rows,
                          meta=_meta(window=(start, end), resolution="raw", aggregate="none",
                                     row_count=len(rows), truncated=truncated))


def day_buckets(record: dict, names: list[str], start: str, end: str) -> tools.Envelope:
    groups = _by_indicator(record)
    rows = []
    for name in names:
        per_day: dict[str, list[float]] = {}
        unit = ""
        system = code = ""
        for r in groups.get(name, []):
            if start <= r["date"] <= end:
                per_day.setdefault(r["date"], []).append(float(r["value"]))
                unit, system, code = r["unit"], r["system"], r["code"]
        for day in sorted(per_day):
            values = per_day[day]
            rows.append({"indicator": name, "series": name, "system": system, "code": code, "period": day,
                         "avg": round(sum(values) / len(values), 4), "min": min(values), "max": max(values),
                         "n": len(values), "unit": unit, "day_known": True, "provenance": "measured"})
    return tools.Envelope(status="ok", data=rows,
                          meta=_meta(window=(start, end), resolution="day", aggregate="none",
                                     aggregate_basis="buckets", row_count=len(rows)))


def stats(record: dict, names: list[str], start: str, end: str) -> tools.Envelope:
    groups = _by_indicator(record)
    rows = []
    for name in names:
        items = [r for r in groups.get(name, []) if start <= r["date"] <= end]
        if not items:
            continue
        nums = [float(r["value"]) for r in items]
        row = {"indicator": name, "series": name, "system": items[0]["system"], "code": items[0]["code"],
               "count": len(items), "numeric_count": len(nums), "min": min(nums), "max": max(nums),
               "avg": round(sum(nums) / len(nums), 4), "first": items[0]["value"], "first_date": items[0]["date"],
               "last": items[-1]["value"], "last_date": items[-1]["date"], "unit": items[0]["unit"],
               "mixed_units": False, "basis": "readings", "day_known": True, "provenance": "computed"}
        row["change"] = round(nums[-1] - nums[0], 4)
        rows.append(row)
    return tools.Envelope(status="ok", data=rows,
                          meta=_meta(window=(start, end), aggregate="stats", aggregate_basis="readings",
                                     row_count=len(rows)))


def medications(record: dict, view: str, start: str = "", end: str = "") -> tuple[tools.Envelope, tuple[str, ...]]:
    meds = record["medications"]
    if view == "log":
        rows = [r for r in meds["log"] if start <= r["date"] <= end]
        rows = sorted(rows, key=lambda r: (r["date"], r["medication"]), reverse=True)
        env = tools.Envelope(status="ok", data=rows, meta=_meta(window=(start, end), row_count=len(rows)),
                             assumptions=(meds_kernel.LOG_NOTE,))
    elif view == "history":
        rows = list(meds["history"])
        env = tools.Envelope(status="ok", data=rows, meta=_meta(row_count=len(rows)))
    else:
        rows = list(meds["plans"])
        env = tools.Envelope(status="ok", data=rows, meta=_meta(row_count=len(rows)),
                             assumptions=(meds_kernel.PLAN_NOTE,))
    return env, meds_kernel.VIEW_COLUMNS[view]


def payload(env: tools.Envelope, columns=None) -> dict:
    return {"result": render_compact(env, columns), **envelope_meta(env)}


def main() -> None:
    record = build_record()
    (HERE / "record.json").write_text(json.dumps(record, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    labs = [name for name, *_ in LABS]
    pheno = labs[:9]
    cases = {
        "catalogue": ({}, payload(catalogue(record))),
        "latest": ({"indicators": labs, "aggregate": "latest"}, payload(latest(record, labs))),
        "readings": ({"indicators": pheno, "start": "2025-01-01", "end": TODAY, "resolution": "raw", "aggregate": "none", "limit": 500},
                     payload(readings(record, pheno, "2025-01-01", TODAY, 500))),
        "readings-truncated": ({"indicators": ["dailySteps"], "start": "2026-06-01", "end": "2026-06-30", "resolution": "raw", "aggregate": "none", "limit": 5},
                               payload(readings(record, ["dailySteps"], "2026-06-01", "2026-06-30", 5))),
        "day-buckets": ({"indicators": ["dailySteps", "dailyTotalSleepTime"], "start": "2026-06-01", "end": "2026-06-30", "resolution": "day", "aggregate": "none"},
                        payload(day_buckets(record, ["dailySteps", "dailyTotalSleepTime"], "2026-06-01", "2026-06-30"))),
        "stats": ({"indicators": ["hs-CRP", "Fasting Blood Glucose-FBG"], "start": "2025-10-01", "end": TODAY, "aggregate": "stats"},
                  payload(stats(record, ["hs-CRP", "Fasting Blood Glucose-FBG"], "2025-10-01", TODAY))),
        "meds-plan": ({"view": "plan"}, payload(*medications(record, "plan"))),
        "meds-log": ({"view": "log", "start": "2026-09-01", "end": "2026-09-20"}, payload(*medications(record, "log", "2026-09-01", "2026-09-20"))),
        "meds-history": ({"view": "history"}, payload(*medications(record, "history"))),
        "error": ({"indicators": ["nope"], "aggregate": "latest"},
                  payload(tools.Envelope(status="error", data=None, meta=_meta(), error_class="recoverable",
                                         error_kind="invalid_arguments",
                                         assumptions=("indicator 'nope' is not in this record",)))),
    }
    out = HERE / "cases"
    out.mkdir(exist_ok=True)
    for name, (args, body) in cases.items():
        (out / f"{name}.json").write_text(json.dumps({"args": args, "payload": body}, ensure_ascii=False, indent=1) + "\n",
                                          encoding="utf-8")
    print(f"wrote record.json ({len(record['observations'])} observations) and {len(cases)} cases")


if __name__ == "__main__":
    main()
