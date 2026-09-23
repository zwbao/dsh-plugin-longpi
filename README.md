# dsh-plugin-longpi

**English** · **[中文](README.zh.md)**

Personal longevity harness for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It turns a DSH profile into one person's board: the methods stay in [longevity-skills](https://github.com/zwbao/longevity-skills), the chart stays in [Mirobody](https://github.com/thetahealth/mirobody), and this plugin decides which skill answers the question, checks the measurements before a skill runs, and looks up the collected evidence.

Not a medical device. No diagnosis, no dose. An emergency is “call 120” (988 in the US), then stop. See [docs/intended-use.md](docs/intended-use.md).

## Install

Node 22.19+ and a Python 3.12+ interpreter. The Mirobody checkout has to be built (`lib/index.js` present). The longevity-skills checkout is separate and private; use a release tag (v2 layout: `catalog.json`, `intents.json`, one `skill.json` per skill).

```bash
cd /path/to/dsh-plugin-longpi && npm install && npm test
dsh plugin --profile web add link:/path/to/dsh-plugin-longpi
```

Restart `dsh web`. Open the **健康看板** tab. Defaults look for `~/Projects/longevity-skills` and `~/Projects/dsh-plugin-mirobody`. Do not also `dsh plugin add` mirobody: LongPi mounts it, and a second copy collides on tool names.

| Field | Meaning |
| --- | --- |
| `skillsHome` | Checkout of longevity-skills. Empty tries `LONGEVITY_SKILLS_HOME`, then `~/longevity-skills`, then `~/Projects/longevity-skills`. |
| `skillsVersion` | Optional pinned release of longevity-skills, such as `2026.39.0`. `longpi_status` reports whether the checkout matches. |
| `mirobodyPluginHome` | Checkout of dsh-plugin-mirobody. Empty tries `MIROBODY_PLUGIN_HOME`, then `~/Projects/dsh-plugin-mirobody`. |
| `pythonBin` | Interpreter that can `import mirobody`. Empty prefers that checkout's `.venv`. |
| `mirobodyHome` | Optional Mirobody source added to `sys.path`. |
| `mcpUrl` / `mcpToken` | Read-only record server, usually `http://127.0.0.1:18060/mcp`. Terminology works without them. |
| `member` | Care-circle member id. Empty is the caller. |
| `skillPython` | Interpreter for skill scripts. Empty is `python3`. |
| `skillRuntimes` | Interpreters for skills with heavier dependencies, by the runtime name in their `skill.json`, e.g. `{ "pyaging": "/opt/pyaging/.venv/bin/python", "scientific": "/opt/sci/.venv/bin/python" }`. A skill whose runtime is missing is refused, never run with another interpreter. |
| `skillTimeoutMs` | Script budget. Default `120000`. |
| `dataDir` | Profile, receipts, earlier readouts and staged runs. Empty is `~/.dsh/longpi`. |
| `maxSkillMatches` | How many skills a question may dispatch. Default `8`. |

## What the model can call

Nine LongPi tools. Mounting Mirobody adds its eight tools in the same process (LOINC, units, indicators, medications, genotypes, status).

| Tool | What it returns |
| --- | --- |
| `read_personal_situation` | Saved age, sex, birth year; indicator names, values, units; the medication plan; earlier readouts; which methods the record can already run and which miss one or two inputs. |
| `list_longevity_intents` | The kinds of questions the library answers and, for this person, which skills of each are ready. |
| `match_longevity_skills` | Ranked skills for this question and this record, with the detected intents, why each matched, and what each still needs. |
| `read_longevity_skill` | The skill's instructions plus its manifest: every input with unit, accepted units, range and whether it comes from the record or the profile. |
| `run_longevity_skill` | The script's readout. Pass `measurements` as recorded; the harness converts declared units, checks ranges, fills the saved age and sex, and refuses a missing or wrong unit before the script runs. Paths stay inside the run directory. |
| `query_longevity_evidence` | What the collected papers state about a drug, supplement, diet or gene, grouped into human, animal and cell evidence, each cited. No doses. |
| `list_longevity_domains` | The method menu (animal and cell work counted separately). |
| `save_personal_profile` | Local profile only. It does not write Mirobody. |
| `longpi_status` | Checkout version and pin, configured runtimes, Mirobody status. No chart, no token. |

Commands: `/longpi`, `/longpi-skills 我的生物年龄`, `/longpi-stats`, `/longpi-version`.

HTTP: `GET /api/longpi/board`, `GET /api/longpi/match?q=`, `GET /api/longpi/intents`, `GET /api/longpi/stats`, `POST /api/longpi/profile`, `GET /api/longpi/version`. The board forwards the DSH `token` query parameter.

## Dispatch

1. **Intent.** The question is matched against `intents.json` in longevity-skills (biological age, methylation age, organ age, wearables and sleep, telomere, intervention evidence, genes, before and after, imaging, cognition, frailty, immunity, model organisms). Drugs, supplements and genes named in the evidence store count too. The model can also pass an intent id.
2. **What the record can run.** Each skill's `skill.json` declares its inputs with LOINC codes, names as they appear on lab reports, units and ranges. A skill whose inputs are all in the record (or in earlier readouts) ranks up and is marked ready; one missing one or two inputs is listed with what is missing.
3. **Ranking.** The intent's own ordering, readiness, and words the question shares with the skill. Tier C skills (animal and cell work, or inputs no person has) appear only when the question names that organism. When nothing specific matches, the list is empty rather than filled with weak guesses.

`test/dispatch-cases.json` holds 50 everyday questions and `test/dispatch-heldout.json` 15 more that were not used for tuning; `npm test` fails if the top-3 hit rate drops below 90% (50 cases) or 80% (held-out), or if an animal skill reaches a question that names no organism.

## Units and refusals

The script owns the formula; the harness owns the plumbing. Measurements go in as recorded. The harness and the skill's `skillkit.py` apply the same rules: a row named by the input's key carries that key's unit; a row named as on a lab report is read in the input's unit unless the skill says that unit must be stated (CRP, where mg/L read as mg/dL stays in range); declared alternative units are converted; anything outside the plausible range stops the run with a reason. A skill that refuses its inputs exits 3 and the reasons come back in `problems`.

## Receipts, readouts and statistics

`dataDir/receipts.jsonl` records each run: skill, checkout revision, exit code, error kind, the input keys used and the input keys missing. `dataDir/history.jsonl` keeps each run's declared outputs (for example `phenoage`) so a before-and-after skill can use them. `/longpi-stats` writes a weekly count of runs, failures and missing inputs per skill — no values, no report text — for the person to share with the skill maintainers if they want to. Nothing is uploaded by the plugin.

## Layout

See [docs/architecture.md](docs/architecture.md). Penguin and sequence-to-function tools are not in this plugin. Accounts and consent stay outside DSH.
