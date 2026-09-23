# Changelog

## 3.0.0

Dispatch by intent and by what the record can run, instead of word overlap.

- Reads the longevity-skills v2 layout: `catalog.json`, `intents.json`, and one `skill.json` per skill (tier, species, intents, inputs with LOINC, units and ranges, outputs, entry script, runtime). The README list still works as a fallback.
- `match_longevity_skills` detects intents (or takes one from the model), ranks the intent's skills, prefers skills whose inputs the record already holds, lists what the near ones miss, and keeps animal and cell skills out of questions that do not name the organism. On 50 everyday questions the right skill is in the top 3 for all 50; on 15 held-out questions, 14.
- `run_longevity_skill` takes `measurements` as recorded. The harness converts declared units, checks ranges, refuses a missing unit where a wrong one would stay in range (CRP mg/L vs mg/dL), fills the saved age and sex, and adds `--out`. Script refusals (exit 3) come back as `problems`.
- New tools `list_longevity_intents` and `query_longevity_evidence` (human, animal and cell evidence from the collected papers, cited, no doses).
- The medication intercept now catches named drugs and supplements and names on the person's plan ("要不要把阿司匹林停了", "二甲双胍一天吃几片") and leaves evidence questions alone.
- Skills that need a heavier interpreter declare a runtime; `skillRuntimes` maps it. A missing runtime is refused, not run with another interpreter.
- Earlier readouts (`history.jsonl`) feed before-and-after skills and the board. `/longpi-stats` and `GET /api/longpi/stats` give weekly counts with no values.
- `skillsVersion` pins a longevity-skills release; `longpi_status` reports the match.
- Record reading keeps LOINC codes and all indicators (not the first 40) and fetches latest values in chunks.

## 2.0.0

Personal longevity harness. Longevity skills stay in their checkout and are dispatched from one person's question and Mirobody record. The health board reads that same snapshot. Phenotypic age and the other formulas stay inside the skill scripts.
