# Changelog

## 0.5.1

Fixes from an external review of 0.5.0, checked claim by claim against the code, plus a safety judgement made by the model and a reorganised health page. Tested end to end in DeepSeek Harness 0.1.5-rc.3 with real chats.

**Security**
- **Login check on every route.** Every `/api/longpi/*` route now runs DeepSeek Harness's own Host/Origin and login-cookie check (`ctx.connection.requestRejection`). Until now any local program or web page could read and change the profile, plans and follow-up settings without logging in.
  - A route answers 503 when that service is missing; it never falls open.
  - Writes must be `application/json` (415 otherwise).
  - Webhook addresses must be `https` and may not point at this machine, a link-local or metadata address.
- **Mirobody 0.1.1.** The bundled plugin gets the same route check. Its Python bridge now receives a minimal environment instead of every variable, API keys included.

**Safety judgement**
- **Input side.**
  - For each message the person types, the configured model labels it: a current emergency, self-harm, a request to start or stop a medicine, a request for their own dose, or a question about research findings.
  - LongPi appends one note for the model. It never replaces the person's words: the old keyword match turned 无胸痛, 父亲有中风史 or "stroke risk" into "only answer 120".
  - A narrow, negation-aware rule layer is used only when the model call fails.
  - Live results on 266 test sentences with deepseek-v4-flash: emergencies 36/36 with no false alarm, medicine requests 66/66; median 1.2 s.
- **Output side.** Before a turn ends, a reply that gave a dose or told the person to change a prescription gets one correction. The model judge decides; the rules decide alone only when the judge fails. Food amounts (一颗鸡蛋, 两片面包) are not doses unless a medicine is named in the same sentence.
- **Saving a plan.**
  - The person approves the save in DeepSeek Harness.
  - The save only goes through after the plan was read back to them.

**Numbers and records**
- **Failed reads stay visible.** A failed or cut record read is reported as such, never as "not measured" or "no change".
- **Newest value across codes.** Each input takes its newest value across all its LOINC codes. On the same day, the skill's order decides, so fasting glucose and hs-CRP now come first in longevity-skills.
- **China-PAR blood pressure.** Systolic pressure uses the newer of the clinic reading and the home 7-day mean.
- **Phenotypic-age history.** Stored points are recomputed when their inputs change.
- **Plan verdicts.**
  - Values are converted to one unit before comparing.
  - A zero baseline, a single home reading, or no adherence data at all gives 无法判断.
  - The wording no longer credits a change to a plan item.
- **Doses.** Removed from plan items of every category, including amounts written in Chinese numerals.
- **Check-ins.** A check-in can be ✓, 没做到 or undone.
- **Dense series.** A home blood-pressure or wearable series that fills Mirobody's 500-row page is read again for its older readings, so twice-daily readings get a verdict.
- **Tool results DeepSeek Harness accepts.** A wearable indicator without a LOINC code made `read_personal_situation` fail in real chats; the bug was there since 0.4. Every tool result is now lossless JSON, checked with DSH's own function.

**Health page and chat**
- **Four tabs.** The health page has 概览, 指标, 方案 and 档案.
  - 指标 is new: every checkup and wearable value by group, with its trend and whether it moved beyond normal fluctuation.
- **A LongPi page in DSH settings.** It holds follow-up reminders (one switch, the rest under 更多设置), the Mirobody connection (paste an address, test, save) and privacy.
- **One onboarding.**
  - Step 3 shows what the record holds.
  - Step 4 offers what can be done now.
  - The reminder question moves to plan adoption.
- **Chat cards.** The chat shows cards for a plan draft (adopt or remove items), a plan read-back, a check-in (with 撤销) and a result.
- **Workspace name.** A new workspace is named 健康对话.

**Versions** stay below 1.0 until declared stable:
- releases 2.0.0–5.0.0 are listed below as 0.2.0–0.5.0;
- the old tags v1.1.0 and v4.2.0 are now v0.1.1 and v0.4.2;
- dsh-plugin-mirobody 1.0.0 is now 0.1.0.

## 0.5.0 (published as 5.0.0)

LongPi becomes a guided journey in the DeepSeek Harness web UI, drafts plans, follows up by itself, and points out real changes in the record.

- **Onboarding** (`settings.onboarding`): four steps — what LongPi does and where data lives (consent, versioned), a profile where every question can be skipped and a skipped answer means unknown, the Mirobody connection with what the first results still need, and the first results with an optional evening check-in reminder.
- **Home** (`conversation.hero.brand.mark`): a greeting replaces DeepSeek Harness's default title, with one sentence on where things stand and a second line when the record has changes beyond normal fluctuation. Under the composer card sits one quiet row: today's check-ins (a tap records them) and the nearest retest while a plan runs, otherwise two suggested questions that go into the composer. The row is placed right under DSH's composer (DSH does not render `conversation.composer.dock` on the blank-session home); text insertion goes through an invisible `conversation.input.dock` bridge.
- **Health page** (sidebar 健康): progress, record changes, phenotypic age and China-PAR, the plan with check-ins and verdicts, profile and self-measurements, follow-up settings and the method library.
- **Journey** (`GET /api/longpi/journey`): stage (consent → profile → records → first_result → plan → routine), the next step, unanswered questions, first results or what blocks them, the add-on tests for the next checkup, reminders and suggestions. A plan saved before any first result moves straight to the routine.
- **Self-measurements**: waist, home blood pressure (judged as a 7-day mean) and weight, typed on the page or told in chat (`save_self_measurement`), with 斤, 尺 and 寸 converted. A tape-measure waist unlocks China-PAR before the next checkup.
- **Record changes**: every checkup marker with a sourced row in the biological-variation table is compared latest-to-previous and latest-to-first; only a change beyond the reference change value is listed, with the numbers, the band and the source. Wrong-direction changes and range markers (haemoglobin, MCV, white cells) come with the advice to take the reports to a doctor; weight stays neutral. Only rows whose LOINC code the table lists are compared, so urine creatinine or urine glucose never pool into the blood markers. The model is told to raise these first, without naming a cause or suggesting a supplement.
- **Plan drafting** (`draft_intervention_plan`, `GET /api/longpi/plan-draft`, `POST /api/longpi/plan-draft/accept`): up to three lifestyle items from the trial-effects table, chosen by the models' sensitivities and the person's focus, each with its evidence; no prescription drug ever, supplements only as 需先与医生确认 without a dose, a simple medication screen, and goals only where the evidence gives a number (never negative, never more than half of today's value). Adoption rebuilds every item from its evidence id.
- **Proactive follow-up** (`set_followup`, `send_followup_message`, `/api/longpi/followup`): check-in and retest reminders, a weekly summary and one nudge when the first steps stall, by desktop notification or a Feishu, WeCom, DingTalk (signed), Bark or generic webhook. Off by default; quiet hours, a daily cap and no back-fills. The brief mode refuses any health value, dose or plan item name; the model's changes that turn follow-up on, switch to full detail or set a webhook need the person's approval.
- **Relevant methods only**: a method counts as ready from the record only when at least one of its LOINC- or device-coded inputs comes from the record; methods that need only age, a precomputed score or answers stay matchable in chat but no longer fill 你的记录现在就能算.
- **A workspace on a fresh DSH**: when DeepSeek Harness has no workspace at all, LongPi creates one named 健康 (once; `bootstrapWorkspace`), so the composer works on first open.
- Calendar export of retests (`GET /api/longpi/calendar.ics`), `/longpi` shows the stage and follow-up state, 18 tools.

- **One-line installer.** `install.sh` installs the DeepSeek Harness CLI and pnpm when missing, clones longevity-skills, creates `~/longpi/.venv` with the Mirobody engine, adds the plugin to the `web` profile and writes its configuration between markers in the profile patch (keeping values set earlier and other rows). `--mcp-url` connects an existing Mirobody; `--with-mirobody` deploys one with Docker and connects its demo account. Runs again to update. Written for macOS bash 3.2 and `curl | bash`.
- **README** rewritten: an introduction, the one-line installation, usage, how it works, privacy (including DeepSeek Harness's session-log upload and how to turn it off). The step-by-step installation moved to `docs/install.md`, and configuration, tools, routes and review rules to `docs/reference.md` (both with Chinese versions).

## 0.4.2 (published as 4.2.0)

- **One install.** A tagged release of [dsh-plugin-mirobody](https://github.com/zwbao/dsh-plugin-mirobody) (now public) ships in `vendor/dsh-plugin-mirobody`, so `dsh plugin --profile web add github:zwbao/dsh-plugin-longpi` installs both. The copy sits inside the DSH profile, where the host's `@deepseek-ai` packages resolve for it; a checkout outside the profile could not load them (`Cannot find package '@deepseek-ai/schemastery'`), which a real DSH 0.1.5-rc.3 install showed. `npm run vendor:mirobody` refreshes it from a release tag. `mirobodyPluginHome` now defaults to the bundled copy; the `~/Projects/dsh-plugin-mirobody` fallback is gone.
- **Install guide.** README and README.zh rewritten as a from-scratch install: Mirobody server, the personal MCP address, the Python environment, the skill library, `dsh plugin add`, the profile patch, first start, and checks from the command line, the web page and the chat, with a troubleshooting table.
- **longevity-skills is public.** CI checks it out without a token. Its `data/biological_variation.json` now takes every lab value from a journal article (EuBIVAS and the EFLM working group's published meta-analyses) with the quoted line; the report footer says so.
- Test: the CRP noise-band check derives its expectation from the table's own CRP row.

## 0.4.1 (published as 4.1.0)

- **China-PAR for men and women on the board.** With longevity-skills' verified China-PAR (constants derived from the paper's own printed numbers, Table 2 reproduced within 1%), the model card shows the 10-year ASCVD risk now and at the plan's blood-pressure, cholesterol or waist goals, with the guideline category and each goal's contribution in percentage points. Home blood pressure enters as the mean of the last week of readings.
- **Stated yes/no facts in the profile.** China-PAR needs six facts no record holds: current smoking, diabetes, blood-pressure medicine in the last two weeks, northern China, urban, and (men) family history of heart attack or stroke. The person states them in conversation (`save_personal_profile`) or in the board's profile form; absent means not stated, never "no", and the card names what is still missing. Profile saves from the board now update only the fields sent.

## 0.4.0 (published as 4.0.0)

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

## 0.3.0 (published as 3.0.0)

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

## 0.2.0 (published as 2.0.0)

Personal longevity harness. Longevity skills stay in their checkout and are dispatched from one person's question and Mirobody record. The health board reads that same snapshot. Phenotypic age and the other formulas stay inside the skill scripts.
