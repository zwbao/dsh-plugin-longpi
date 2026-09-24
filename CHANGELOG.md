# Changelog

## 4.0.0

Track the person's own intervention plan against their record, and a board built around progress.

- **Reads real Mirobody records.** Mirobody 1.5 answers MCP calls with a compact pipe table (constant columns hoisted into a `(constants: …)` line, a single row as that line alone), not JSON rows, so 3.0 read zero indicators from a real server. The parser is tested against fixtures rendered by Mirobody's own code, and a fake MCP server checked byte for byte against them.
- **Interventions.** `save_intervention_plan` checks a plan the person described or shared and returns a structured read-back; it saves only when called again with `confirm: true`. Medicines and supplements are saved by name and linked to the Mirobody medication plan; a dose in the plan text is not stored. `log_intervention_checkin` records check-ins with tags for days that disturb a lab (illness, travel, a different lab). Plans keep every version in `dataDir/interventions/`.
- **Judging an item.** `review_interventions` compares, for every marker an item aims at, the result before it started with the retest after the marker's minimum interval, against the reference change value from within-person biological variation (EFLM and peer-reviewed sources in longevity-skills `data/biological_variation.json`; home blood pressure as 7-day means). It weighs adherence over the last 12 weeks (wearable threshold, Mirobody dose log, or check-ins; missing days are unknown, never misses), items aimed at the same marker, medication courses running at the retest, and tagged days, and sets the trial average from `data/effects.jsonl` beside the change. Verdicts: 有效, 波动内, 反向, 无法判断. Next steps never include a medicine or a dose.
- **Phenotypic age over time.** Every checkup where the nine labs were measured on the same day is back-computed by the skill, with the date the labs were taken; the board draws the trend against a noise band derived from the skill's own slopes and the variation table (a lower bound where an input has no published variation).
- **Model estimates for goals.** `model_intervention_goals` and the board run the phenotypic-age skill with `--targets` (`levers.json`): phenotypic age and the model's 10-year mortality risk now and at the goals, and each goal alone. The China-PAR card stays "待系数校验" until that skill's coefficients are verified. No personal "years of life" figure.
- **The board** leads with phenotypic age, adherence and the next retest; then what really improved, the plan timeline with adherence strips and verdicts, each marker against its band and goal, the model cards, and next steps. Inline SVG, hover and keyboard read-outs, a table for every chart, light and dark palettes. `npm run preview` renders it with demo data and no host.
- **Faster turns.** Record reads are cached for a minute, so one turn no longer repeats 2–10 MCP calls per tool.
- Runs report the unit conversions the harness applied (`conversions`), and `POST /api/longpi/run-ready` runs every method the record already supplies. `GET /api/longpi/report` exports a Markdown summary for a doctor or coach.
- The medication intercept lets plain records through (an uploaded plan that lists a supplement dose, "鱼油停了两天") and still blocks advice-seeking and change intents.

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
