# Architecture

LongPi is the personal layer. Three pieces stay separate.

1. **DeepSeek Harness** hosts the conversation, the tools, and the health board.
2. **longevity-skills** is the method library. Each directory is one published method with a `SKILL.md`, a machine-readable `skill.json` (tier, species, intents, inputs with units and ranges, outputs, entry script), and when the paper allows a personal readout a script. `catalog.json` indexes all of them, `intents.json` maps user questions to skills, and `skills/longevity-evidence/data/claims.jsonl` holds the named entities the papers make statements about. The plugin never copies a formula.
3. **dsh-plugin-mirobody** is the read-only data seam. A tagged release ships in `vendor/dsh-plugin-mirobody` (`npm run vendor:mirobody`), so one `dsh plugin add` installs both and the copy sits inside the DSH profile, where the host's `@deepseek-ai` packages resolve for it. LongPi mounts that plugin's `apply` (or the checkout named by `mirobodyPluginHome`), so LOINC, UCUM, and the chart tools register in this process. Wearable login and file ingestion stay in the Mirobody server.

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
| `compact.ts` | Parse Mirobody's compact pipe tables (hoisted constants, single-row answers, refusals, the meta line). |
| `records.ts` | Read the record over MCP with a one-minute cache: catalogue and latest values, dated series, the dose log in windows under Mirobody's row cap, and medication courses. |
| `reference.ts` | Read `data/biological_variation.json` and `data/effects.jsonl` from the skills checkout; reference change values (symmetric, or log-normal for skewed markers). |
| `interventions.ts` | The person's plan (versioned) and check-ins in `dataDir/interventions/`; normalization, dose stripping, links to the Mirobody medication plan. |
| `evaluate.ts` | Pure functions: adherence, one verdict per item and marker, next steps. |
| `tracking.ts` | Put it together for tools and the board: series, adherence data, phenotypic age at every checkup (by the skill), noise bands, model cards from `levers.json`. |
| `overview.ts` | What the record can run now, run-everything-ready, the Markdown report. |

## Dispatch is a tool, not a prompt guess

- `read_personal_situation` loads the saved age, sex, and birth year, the indicators and medications the Mirobody server returned, earlier readouts, and which methods are ready.
- `list_longevity_intents` and `match_longevity_skills` rank skills by intent and by what the record already holds.
- `read_longevity_skill` returns the instructions and the manifest.
- `run_longevity_skill` takes `measurements` as recorded; the harness converts declared units, checks ranges, fills the saved profile fields, stages `measurements.csv`, and runs the script with a path jail: relative names and `out/` only, no `..`, no absolute path.
- `query_longevity_evidence` runs the evidence skill with the named entities and, if asked, the medication plan.

## Interventions

The plan is the person's own, saved after a read-back they confirm. Tools: `save_intervention_plan`, `log_intervention_checkin`, `read_intervention_plan`, `review_interventions`, `model_intervention_goals`. A verdict needs a baseline in the 180 days before the item started, a retest after the marker's minimum interval, a change beyond the reference change value, adequate adherence, and names what else changed. Phenotypic age and goal models come from the skill script (`--targets`, `out/levers.json`), never from a formula in the plugin.

## The board

The `健康看板` tab loads `/api/longpi/board` (profile, record status, readiness) and then `/api/longpi/tracking` (plan, verdicts, charts, phenotypic age, model cards, next steps). It leads with phenotypic age against its noise band, adherence and the next retest; shows what really improved; the plan timeline and item cards with 12-week adherence strips and check-in buttons; each target marker against its band and goal; model estimates; next steps; and, collapsed, records, methods and the profile. Saving a profile or a check-in does not write Mirobody. `preview/` renders the built client with demo data from `test/fake-mirobody.mjs`.

Accounts and consent are out of scope. One DSH profile is one person. Penguin and sequence-to-function tools are not part of this plugin.
