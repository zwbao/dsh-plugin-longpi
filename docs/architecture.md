# Architecture

LongPi is the personal layer. Three pieces stay separate.

1. **DeepSeek Harness** hosts the conversation, the tools, and the health board.
2. **longevity-skills** is the method library. Each directory is one published method with a `SKILL.md`, a machine-readable `skill.json` (tier, species, intents, inputs with units and ranges, outputs, entry script), and when the paper allows a personal readout a script. `catalog.json` indexes all of them, `intents.json` maps user questions to skills, and `skills/longevity-evidence/data/claims.jsonl` holds the named entities the papers make statements about. The plugin never copies a formula.
3. **dsh-plugin-mirobody** is the read-only data seam. LongPi mounts that plugin's `apply` from `mirobodyPluginHome`, so LOINC, UCUM, and the chart tools register in this process. Wearable login and file ingestion stay in the Mirobody server.

## Modules

| Module | Job |
| --- | --- |
| `catalog.ts` | Load `catalog.json`; else each `skill.json`; else the legacy README list. Cached by file stamps. |
| `intents.ts` | Detect intents from triggers and from drugs, supplements and genes named in the evidence store. |
| `measurements.ts` | Stage measurements exactly as `skillkit.py` does (key vs alias, `unit_required`, declared `accept` factors, ranges); decide which skills the record can already run. |
| `units.ts` | Unit and name normalization, identical to `skillkit.py`; both pass `schema/unit_cases.json`. |
| `match.ts` | Rank skills by intent, readiness and shared words; keep tier C out unless the organism is named. |
| `runner.ts` | Stage files, pick the interpreter by runtime, fill profile flags, run the script in a path jail, read `out/report.md`, `out/result.json` and `out/problems.json`, write the receipt. |
| `history.ts` | Earlier readouts (declared outputs only), for before-and-after skills and the board. |
| `stats.ts` | Weekly anonymous counts per skill: runs, failures, missing input keys. |
| `guardrails.ts` | Emergency and medication intercepts before the model runs. |

## Dispatch is a tool, not a prompt guess

- `read_personal_situation` loads the saved age, sex, and birth year, the indicators and medications the Mirobody server returned, earlier readouts, and which methods are ready.
- `list_longevity_intents` and `match_longevity_skills` rank skills by intent and by what the record already holds.
- `read_longevity_skill` returns the instructions and the manifest.
- `run_longevity_skill` takes `measurements` as recorded; the harness converts declared units, checks ranges, fills the saved profile fields, stages `measurements.csv`, and runs the script with a path jail: relative names and `out/` only, no `..`, no absolute path.
- `query_longevity_evidence` runs the evidence skill with the named entities and, if asked, the medication plan.

## The board

The `健康看板` tab shows the same snapshot: runnable methods, methods one or two inputs away, earlier readouts, the medication plan, and lets the person save a profile. Saving a profile does not write Mirobody.

Accounts and consent are out of scope. One DSH profile is one person. Penguin and sequence-to-function tools are not part of this plugin.
