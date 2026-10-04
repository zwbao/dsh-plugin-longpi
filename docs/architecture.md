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
| `runner.ts` | Stage files, pick the interpreter by runtime, fill profile flags, check argument paths, run the script with a short environment, read `out/report.md`, `out/result.json` and `out/problems.json`, write the receipt (no report text). |
| `history.ts` | Earlier readouts (declared outputs only), for before-and-after skills and the board. |
| `stats.ts` | Weekly anonymous counts per skill: runs, failures, missing input keys. |
| `guard-scope.ts` | LongPi's own workspaces (the one it created, or titled 健康对话 / 健康): where its persona, page snapshot and write tools apply. |
| `tools-approval.ts` | A plan saved from chat needs a fresh read-back of the same plan and then the person's approval; a deep analysis the person asks for needs their approval. |
| `compact.ts` | Parse Mirobody's compact pipe tables (hoisted constants, single-row answers, refusals, the meta line). |
| `records.ts` | Read the record over MCP with a one-minute cache: catalogue and latest values, dated series, the dose log in windows under Mirobody's row cap, and medication courses. |
| `reference.ts` | Read `data/biological_variation.json` and `data/effects.jsonl` from the skills checkout; reference change values (symmetric, or log-normal for skewed markers). |
| `interventions.ts` | The person's plan (versioned) and check-ins in `dataDir/interventions/`; normalization, dose stripping, links to the Mirobody medication plan. |
| `evaluate.ts` | Pure functions: adherence, one verdict per item and marker, next steps. |
| `tracking.ts` | Put it together for tools and the board: series, adherence data, phenotypic age at every checkup (by the skill), noise bands, model cards from `levers.json`. |
| `overview.ts` | What the record can run now, run-everything-ready, the Markdown report. |

In the client (`src/client/`), besides the page, onboarding, settings and the chat cards:

| Module | Job |
| --- | --- |
| `turn-data.ts` | A conversation Definition that collects each turn's LongPi calls (draft, read-back, save, check-in) from the session log and publishes them as the turn's `longpi` data; the `conversation.chat.turnTail` selector claims a turn that left something to do. Pure, tested in Node. |
| `turn-tail.ts` | The quick actions under such a turn: adopt the draft, confirm or adjust a read-back, take back today's check-ins, open the 健康 tab or the page. |
| `pane.ts` | The 健康 tab in DSH's right column (`sidebar.right.pane.tab`, a page type in `sidebarRightTabs`): the 概览 tab laid out for the column. |
| `call-state.ts` | Per-call outcomes the chat card and the quick actions share: the plan version a draft was adopted as, a check-in taken back. |
| `terms.ts` | The results' plain names (身体年龄, 10 年心血管风险) and what their ⓘ says about the model behind them. |

## Dispatch is a tool, not a prompt guess

- `read_personal_situation` loads the saved age, sex, and birth year, the indicators and medications the Mirobody server returned, earlier readouts, and which methods are ready.
- `list_longevity_intents` and `match_longevity_skills` rank skills by intent and by what the record already holds.
- `read_longevity_skill` returns the instructions and the manifest.
- `run_longevity_skill` takes `measurements` as recorded; the harness converts declared units, checks ranges, fills the saved profile fields, stages `measurements.csv`, and runs the script with argument path checks: relative names and `out/` only, no `..`, no absolute path.
- A skill script gets a short environment: `PATH`, `LANG`, `LC_ALL`, `HOME` and `TMPDIR` inside its own run directory, `PYTHONNOUSERSITE=1`, and nothing else of the harness's environment (no keys, no tokens). The Mirobody terminology bridge gets the same list plus `MIROBODY_HOME`, the real `HOME` and `PYTHONPATH`. This is not a sandbox: the script runs as the same user and can read what that user can. Skill scripts are trusted code from the skills checkout the person installed; the argument checks stop the model from pointing a script at other files, nothing more.
- `query_longevity_evidence` runs the evidence skill with the named entities and, if asked, the medication plan.

## Interventions

The plan is the person's own, saved after a read-back they confirm. Tools: `save_intervention_plan`, `log_intervention_checkin`, `read_intervention_plan`, `review_interventions`, `model_intervention_goals`. A verdict needs a baseline in the 180 days before the item started, a retest after the marker's minimum interval, a change beyond the reference change value, adequate adherence, and names what else changed. Phenotypic age and goal models come from the skill script (`--targets`, `out/levers.json`), never from a formula in the plugin.

## The board

The `健康看板` tab loads `/api/longpi/board` (profile, record status, readiness) and then `/api/longpi/tracking` (plan, verdicts, charts, phenotypic age, model cards, next steps). It leads with phenotypic age against its noise band, adherence and the next retest; shows what really improved; the plan timeline and item cards with 12-week adherence strips and check-in buttons; each target marker against its band and goal; model estimates; next steps; and, collapsed, records, methods and the profile. Saving a profile or a check-in does not write Mirobody. `preview/` renders the built client with demo data from `test/fake-mirobody.mjs`.

Accounts and consent are out of scope. One DSH profile is one person. Penguin and sequence-to-function tools are not part of this plugin.

## 长寿图鉴 (the Codex)

The design is `docs/codex-design.md` (1.2). The main line is a two-week personal experiment: an experiment pack shows three, the person picks one, does it, and turns the card over at the end. That reveal is the only pack opening. The library of research cards is free to read. There are no draws, rarities, streaks or caps.

| Module | Job |
| --- | --- |
| `engage/state.ts` | `engage/state.json` (version 2) in the account holder's LongPi home (`resolveRootDir`), whoever is being looked at. A v1 file migrates once: owned method cards become 已读, unused draws become the opening experiment pack, the streak is dropped, and the seed and `draws.jsonl` stay. |
| `engage/data.ts` | The shipped data: `data/codex/v3/library.json` (built; reviewed cards only) and `data/codex/v3/experiments.zh.json` (the experiment catalogue, the metrics, and the minimal meaningful differences). Adults only; the Codex can be closed. |
| `engage/context.ts` | What a journey build hands the Codex: safety facts (drug classes, conditions, pregnancy, open 先看医生 findings), the plan and next-step text (relevance only), LDL, retest dates, the latest checkup, and the results a retest pack shows. China-PAR outside 35–74, or with heart disease, gives no number. |
| `engage/series.ts` | The daily series the experiments are judged on (resting heart rate, HRV, sleep, sleep onset, night wakings, steps, home blood pressure, weight, waist, glucose), cached in `engage/series.json`. They are refreshed after each journey build of the holder, one Mirobody day read per series. Units are read off each series. |
| `engage/eligibility.ts` | The three-pick, in this order: safety, then data to measure the outcome, then relevance to the plan, then not done recently. A seeded order breaks ties only. Also the randomized version's 7 + 7 day schedule. |
| `engage/verdict.ts` | The three verdict words: 超出平时波动, 在平时波动内, 数据不够. Wristband metrics use the person's own spread (two-sample t, `posteriorDiff`) and a minimal meaningful difference. Blood pressure, weight, glucose and LDL use the reference change value. A good result outside the usual variation is said plainly and never attributed to the experiment. |
| `engage/nudge.ts` | The one prompt slot. The stand-up reminder is opt-in, for wristband owners only, inside 我的白天, never in presentation mode, at most twice a day and 2 h apart, and counts only when steps arrive within 10 minutes of 好. The reveal notice appears once on the day, plus once the next day after 稍后. |
| `engage/engine.ts` | Season (8 weeks or until the next retest), packs, runs (≥10 days with data, up to 7 more), retest packs, footprints. Footprints for family visits and checkups go to the holder and never bring a pack. Also the views, the actions, and the seams for the fact pack and the next steps. |
| `engage/routes.ts`, `tools.ts` | `GET/POST /api/longpi/codex`, `GET /api/longpi/codex/library`, `GET /api/longpi/codex/slot`; chat tools `read_season` and `log_life_event`. |

The client side:
- `client/engage/codex-page.ts` is the pixel panel, styled only inside `.lp-codex`.
- `client/engage/slot*.ts` and `activity.ts` hold the prompt slot. It shows as the 健康 pane's top row, or as a bottom-right `shell.overlay` bar when the pane is not on screen. The client checks continuous DSH use, a running turn and typing.
- 演示模式 is at the sidebar foot (`sidebar.footer.action`), on ⌘⌥P / Ctrl+Alt+P, and via `/演示模式`.
- The pane folds personal numbers until 显示 is pressed, then shows them for 60 s.

Not built: quiet hours from calendar meetings, because LongPi has no calendar connection (`calendar.ts` only writes an ICS file). Until there is one, 演示模式 and the folded pane are the safeguards.
