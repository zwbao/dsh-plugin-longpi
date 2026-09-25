# Reference

**English** · **[中文](reference.zh.md)**

Configuration keys, the tools the model can call, commands and HTTP routes, and the rules for dispatch, unit checks and intervention review.

## Configuration

| Field | Meaning |
| --- | --- |
| `skillsHome` | Checkout of longevity-skills. Empty tries `LONGEVITY_SKILLS_HOME`, then `~/longevity-skills`, then `~/Projects/longevity-skills`. |
| `skillsVersion` | Optional pinned release of longevity-skills, such as `2026.39.0`. `longpi_status` reports whether the checkout matches. |
| `mirobodyPluginHome` | Leave empty to use the bundled `vendor/dsh-plugin-mirobody`. Point it elsewhere only to debug the Mirobody plugin itself, and only at a folder inside the DSH profile. |
| `pythonBin` | Interpreter that can `import mirobody`. Empty tries `MIROBODY_PYTHON`, then `python3.14`, `python3.13`, `python3.12`, `python3`. |
| `mirobodyHome` | Optional Mirobody source checkout added to `sys.path` (it needs `git lfs pull`). Leave empty with a pip-installed mirobody. |
| `mcpUrl` | Record server: the personal address `…/mcp/<secret>` from step 2, or `http://127.0.0.1:18060/mcp` with `mcpToken`. Terminology works without it. |
| `mcpToken` | The `access_token` from sign-in when the address carries no secret (valid 30 days by default). |
| `member` | Care-circle member id. Empty is the account holder. |
| `skillPython` | Interpreter for skill scripts; the same virtual environment as `pythonBin` works. Empty is `python3`. |
| `skillRuntimes` | Interpreters for skills with heavier dependencies, by the runtime name in their `skill.json`, e.g. `{ "pyaging": "/opt/pyaging/.venv/bin/python", "scientific": "/opt/sci/.venv/bin/python" }`. A skill whose runtime is missing is refused, never run with another interpreter. |
| `skillTimeoutMs` | Script budget. Default `120000`. |
| `dataDir` | Profile, receipts, earlier readouts, plans and check-ins. Empty is `~/.dsh/longpi`. |
| `maxSkillMatches` | How many skills a question may dispatch. Default `8`. |
| `timeoutMs` | Budget for the Mirobody bridge and MCP calls. Default `30000`. |
| `bootstrapWorkspace` | On a DeepSeek Harness with no workspace yet, create `<dataDir>/workspace` once and register it as the workspace 「健康」, so a session can open and the LongPi home works. Never touches a registry that already has workspaces, and never creates it again after that (a marker `workspace-bootstrap.json` in `dataDir` records it, so a workspace you delete stays deleted). Default `true`. |

## What the model can call

Fourteen LongPi tools. Mounting Mirobody adds its eight tools in the same process (LOINC, units, indicators, medications, genotypes, status).

| Tool | What it returns |
| --- | --- |
| `read_personal_situation` | Saved age, sex, birth year; indicator names, values, units; the medication plan; earlier readouts; which methods the record can already run and which miss one or two tests; `record_changes`, markers whose change between checkups is larger than normal fluctuation. |
| `list_longevity_intents` | The kinds of questions the library answers and, for this person, which skills of each are ready. |
| `match_longevity_skills` | Ranked skills for this question and this record, with the detected intents, why each matched, and what each still needs. |
| `read_longevity_skill` | The skill's instructions plus its manifest: every input with unit, accepted units, range and whether it comes from the record or the profile. |
| `run_longevity_skill` | The script's readout. Pass `measurements` as recorded; the harness converts declared units, checks ranges, fills the saved age and sex, and refuses a missing or wrong unit before the script runs. Paths stay inside the run directory. |
| `query_longevity_evidence` | What the collected papers state about a drug, supplement, diet or gene, grouped into human, animal and cell evidence, each cited. No doses. |
| `list_longevity_domains` | The method menu (animal and cell work counted separately). |
| `save_personal_profile` | Local profile only (name, birth year, age, sex, and the yes/no facts China-PAR needs: smoking, diabetes, blood-pressure medicine, north/south, urban/rural, family history). It does not write Mirobody. |
| `longpi_status` | Checkout version and pin, configured runtimes, Mirobody status. No chart, no token. |
| `save_intervention_plan` | Checks a plan the person described or shared and returns a read-back; saves a new version only when called again with `confirm: true`. Medicines and supplements are kept by name; doses stay in Mirobody. |
| `log_intervention_checkin` | Records that the person did (or did not do) a plan item on a day, with tags for illness, travel or a different lab. |
| `read_intervention_plan` | The saved plan, earlier versions and recent check-ins. |
| `review_interventions` | For every item and marker: baseline, retest, change against the reference change value, adherence, what else changed, the trial average; phenotypic age at every checkup; model cards; next steps. |
| `model_intervention_goals` | What-if goal values run through the phenotypic-age skill (and China-PAR once verified). Model estimates. |

Commands: `/longpi`, `/longpi-skills 我的生物年龄`, `/longpi-stats`, `/longpi-version`.

HTTP: `GET /api/longpi/board`, `GET /api/longpi/tracking`, `GET /api/longpi/match?q=`, `GET /api/longpi/intents`, `GET /api/longpi/stats`, `GET /api/longpi/report`, `POST /api/longpi/profile`, `POST /api/longpi/checkin`, `POST /api/longpi/run-ready`, `GET /api/longpi/version`. Each needs the DSH `token` from the address DSH printed (query parameter or `Authorization: Bearer`); the board adds it for you.

## Plans and whether they work

The plan is the person's own (or one a doctor or longevity coach gave them). The plugin turns it into items, reads them back, and saves only after the person confirms; every save is a new version in `dataDir/interventions/`, on this machine only.

An item counts as working on a marker only when all of these hold: a baseline within 180 days before it started; a retest after the marker's minimum interval (about 3 months for HbA1c); a change beyond the reference change value built from within-person biological variation and assay imprecision (log-normal for CRP and triglycerides, 7-day means for home blood pressure); and enough adherence over the last 12 weeks (wearable threshold, the Mirobody dose log, or check-ins; a day with no record is unknown, not a miss). Within-person variation comes from `data/biological_variation.json` in longevity-skills, where every row cites a journal article and quotes the line that prints the number; a marker without a checkable source gets no band, and its verdict says it cannot be judged. When something else changed at the same time, the verdict says only the combination can be judged. There are four verdicts: 有效 (working), 波动内 (within noise), 反向 (the wrong way), 无法判断 (cannot tell). Next steps are limited to adherence, retesting on time, a missing test, changing one thing at a time, and talking to a doctor or coach; never a medicine or a dose.

**Changes in the record.** Without any plan, every checkup marker that has a biological-variation row (LOINC rows only; wearable series and the person's own measurements are left out) is checked the same way: the latest result against the one before it and, with three or more checkup days, against the first of the last six. A change counts only beyond the reference change value; the larger overshoot is reported. A change in the good direction (the row's `better`) is good news; any other one, including every marker with no good direction, is one to show a doctor, and those come first. Markers compared on multi-day means (home blood pressure) are not checked from single readings. Differences between labs or instruments are not included. The journey (`changes`), `read_personal_situation` (`record_changes`), the plan draft's notes and the export report all show the same rows.

Phenotypic age is recomputed by the skill at every checkup with all nine blood markers; goal estimates come from the skill too (`--targets`, `levers.json`) and are labelled model estimates. The plugin never states how many years a person will live.

## Dispatch

1. **Intent.** The question is matched against `intents.json` in longevity-skills (biological age, methylation age, organ age, wearables and sleep, telomere, intervention evidence, genes, before and after, imaging, cognition, frailty, immunity, model organisms). Drugs, supplements and genes named in the evidence store count too. The model can also pass an intent id.
2. **What the record can run.** Each skill's `skill.json` declares its inputs with LOINC codes, names as they appear on lab reports, units and ranges. A skill counts as ready from the record only when every required input is there and at least one input a checkup or a device records (one with a LOINC or device code) came from the record; one missing one or two such tests, and nothing else, is listed with what is missing. A method that needs only age, an answer, or another method's output is never listed as ready or near from the record; it is still matched by the question.
3. **Ranking.** The intent's own ordering, readiness, and words the question shares with the skill. Tier C skills (animal and cell work, or inputs no person has) appear only when the question names that organism. When nothing specific matches, the list is empty rather than filled with weak guesses.

`test/dispatch-cases.json` holds 50 everyday questions and `test/dispatch-heldout.json` 15 more that were not used for tuning; `npm test` fails if the top-3 hit rate drops below 90% (50 cases) or 80% (held-out), or if an animal skill reaches a question that names no organism.

## Units and refusals

The script owns the formula; the harness owns the plumbing. Measurements go in as recorded. The harness and the skill's `skillkit.py` apply the same rules: a row named by the input's key carries that key's unit; a row named as on a lab report is read in the input's unit unless the skill says that unit must be stated (CRP, where mg/L read as mg/dL stays in range); declared alternative units are converted; anything outside the plausible range stops the run with a reason. A skill that refuses its inputs exits 3 and the reasons come back in `problems`.

## Receipts, readouts and statistics

`dataDir/receipts.jsonl` records each run: skill, checkout revision, exit code, error kind, the input keys used and the input keys missing. `dataDir/history.jsonl` keeps each run's declared outputs (for example `phenoage`) so a before-and-after skill can use them. `/longpi-stats` writes a weekly count of runs, failures and missing inputs per skill — no values, no report text — for the person to share with the skill maintainers if they want to. Nothing is uploaded by the plugin.

## Layout

See [architecture.md](architecture.md). Penguin and sequence-to-function tools are not in this plugin. Accounts and consent stay outside DSH.
