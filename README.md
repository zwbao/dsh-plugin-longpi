# dsh-plugin-longpi

**English** · **[中文](README.zh.md)**

Personal longevity harness for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It turns a DSH profile into one person's board: the methods stay in [longevity-skills](https://github.com/zwbao/longevity-skills), the chart stays in [Mirobody](https://github.com/thetahealth/mirobody), and this plugin decides which skill answers the question, checks the measurements before a skill runs, tracks the person's own intervention plan, and looks up the collected evidence.

Not a medical device. No diagnosis, no dose. An emergency is “call 120” (988 in the US), then stop. See [docs/intended-use.md](docs/intended-use.md).

## Install from scratch

A working setup has four separate parts:

| Part | What it is | Where |
| --- | --- | --- |
| Mirobody server | The record: lab reports, wearables, medications. The plugin reads it through Mirobody's MCP endpoint, read-only | Docker, `http://127.0.0.1:18060` |
| longevity-skills | The method library (skill scripts) and two reference tables | `~/longpi/longevity-skills` |
| Python environment | Mirobody's terminology engine (LOINC, unit conversion) and the skills' dependencies | `~/longpi/.venv` |
| DSH + this plugin | Conversation, tools and the health board; [dsh-plugin-mirobody](https://github.com/zwbao/dsh-plugin-mirobody) ships inside this plugin, nothing extra to install | `~/.dsh/profiles/web` |

Run the blocks below in order. Everything goes under `~/longpi`; **in every new terminal, run the `export` at the top of step 0 first.**

### 0. Tools

You need macOS or Linux, Node.js 22.19+, pnpm (`dsh plugin` installs through it), Python 3.12+, git with git-lfs, Docker (for Mirobody), and a [DeepSeek API key](https://platform.deepseek.com/api_keys), which you enter in the DSH web page.

```bash
export LONGPI_HOME=~/longpi
mkdir -p "$LONGPI_HOME"

node -v                                   # v22.19 or later
npm install -g pnpm@10 @deepseek-ai/dsh   # use sudo, or a Node from nvm/fnm, if npm lacks permission
pnpm -v && dsh --version                  # checked with pnpm 10 and dsh 0.1.5-rc.3
python3.12 --version                      # else: brew install python@3.12, or uv python install 3.12
git lfs version                           # else: brew install git-lfs / apt install git-lfs
docker info --format '{{.ServerVersion}}' # Docker must be running
```

### 1. Start Mirobody (the record server)

```bash
cd "$LONGPI_HOME"
git clone --depth 1 https://github.com/thetahealth/mirobody.git
cd mirobody
git lfs install && git lfs pull   # the LOINC bundle; without it the file is a pointer stub
./deploy.sh                       # Postgres + Redis + server + worker, about 800 MB of memory
```

Open <http://127.0.0.1:18060> and sign in as `you@mirobody.ai` with code `111111`. `SEED_DEMO_DATA=true` is the default, so two demo accounts already hold 2,019 readings, which is enough to check the plugin.

- For your own data: set `SEED_DEMO_DATA=false` in `mirobody/.env` before the first start, then register your own account as in step 2.
- Uploading a lab PDF or photo needs one model key (OpenRouter, Gemini, OpenAI, Anthropic or DeepSeek) in `mirobody/.env`, then `docker compose restart`. Reading existing data does not.
- If it does not come up, `deploy.sh` prints the cause and the fix (a subnet clash, a Docker that refuses named volumes).

### 2. Get the record-server address (MCP)

The plugin reads the record through a personal MCP address. In the web page it is **Settings → MCP**; from the command line:

```bash
MIROBODY=http://127.0.0.1:18060

# Demo account: sign in with the fixed code
JWT=$(curl -s -X POST "$MIROBODY/email/verify" -H 'Content-Type: application/json' \
  -d '{"email":"you@mirobody.ai","code":"111111"}' \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["access_token"])')

# Your own account: replace the block above with a one-time register and a password sign-in
# curl -s -X POST "$MIROBODY/password/register" -H 'Content-Type: application/json' \
#   -d '{"email":"me@example.com","password":"at-least-8-chars"}'
# JWT=$(curl -s -X POST "$MIROBODY/password/login" -H 'Content-Type: application/json' \
#   -d '{"email":"me@example.com","password":"at-least-8-chars"}' \
#   | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["access_token"])')

MCP_URL=$(curl -s -X POST "$MIROBODY/personal/mcp" -H "Authorization: Bearer $JWT" \
  | python3 -c 'import sys, json; print(json.load(sys.stdin)["data"]["url"])')
echo "$MCP_URL"   # like http://127.0.0.1:18060/mcp/<long secret>
```

The address is the credential: anyone who has it can read this record, so keep it out of chats and screenshots. It is valid for 30 days by default (`MCP_URL_TTL_DAYS` in Mirobody's `.env`); when it expires, rerun this step and update the config from step 6. DSH reloads the config without a restart.

### 3. Python environment

One virtual environment serves both Mirobody's terminology engine and the skill scripts.

```bash
cd "$LONGPI_HOME"
python3.12 -m venv .venv
.venv/bin/pip install --upgrade pip
.venv/bin/pip install mirobody numpy scipy openpyxl
# with uv: uv venv --python 3.12 .venv && uv pip install --python .venv/bin/python mirobody numpy scipy openpyxl

.venv/bin/python -c "import mirobody; print(mirobody.__version__, mirobody.BUNDLE_VERSION)"
# prints something like: 1.5.0 loinc-2.83+2026.09.17-aacb2c715b56
```

A few skills need heavier dependencies (pyaging, for example) and name a runtime in their `skill.json`. Without that interpreter configured, the plugin refuses to run them rather than try another environment; see `skillRuntimes` under [Configuration](#configuration).

### 4. The skill library

```bash
cd "$LONGPI_HOME"
git clone https://github.com/zwbao/longevity-skills.git
ls longevity-skills/catalog.json longevity-skills/data   # catalog.json, biological_variation.json, effects.jsonl
```

### 5. Install the plugin

```bash
dsh plugin --profile web add github:zwbao/dsh-plugin-longpi
```

The web profile is created if it does not exist. `missing peer @deepseek-ai/...` warnings are expected: DSH provides those packages. No `allowBuilds` is needed, because the repository carries the built `lib/`.

```bash
ls ~/.dsh/profiles/web/node_modules/dsh-plugin-longpi/vendor/dsh-plugin-mirobody   # the bundled Mirobody plugin
grep -A 6 '"bundles"' ~/.dsh/profiles/web/package.json                             # lists dsh-plugin-longpi
```

Do not also `dsh plugin add` the Mirobody plugin: LongPi already mounts it in the same process, and a second copy registers the same tools twice.

### 6. Configure

The config lives in the profile's patch file. A patch replaces the row's whole `config`, so every key is restated. The script backs up the existing file first; if the backup holds anything besides `[]`, merge it back by hand.

```bash
P="${DSH_HOME:-$HOME/.dsh}/profiles/web/cordis.patch.yml"
cp "$P" "$P.bak.$(date +%Y%m%d%H%M%S)"
cat > "$P" <<EOF
# LongPi. A patch replaces the row's whole config, so every key is restated.
- id: dsh-plugin-longpi
  config:
    skillsHome: $LONGPI_HOME/longevity-skills
    skillsVersion: ''
    mirobodyPluginHome: ''
    pythonBin: $LONGPI_HOME/.venv/bin/python
    mirobodyHome: ''
    mcpUrl: '$MCP_URL'
    mcpToken: ''
    member: ''
    timeoutMs: 30000
    skillPython: $LONGPI_HOME/.venv/bin/python
    skillTimeoutMs: 120000
    skillRuntimes: {}
    dataDir: ''
    maxSkillMatches: 8
EOF
chmod 600 "$P"

dsh --profile web --dump-config | grep -A 17 'id: dsh-plugin-longpi'
```

The last command should print `# == dsh-plugin-longpi, patched by …/cordis.patch.yml` followed by your values (`mcpUrl` in clear text, so do not share the output). Each key is described under [Configuration](#configuration).

### 7. Start DSH

Plugins load at startup. If DSH is already running, stop it with Ctrl+C in its terminal first.

```bash
cd "$LONGPI_HOME" && dsh web
```

It prints `dsh web: http://127.0.0.1:3080/?token=…` and opens the browser (`--no-open` to skip that). The first time:

1. On the beta notice (内测声明), click **继续**.
2. In **添加一个 API Key 开始使用**, paste your DeepSeek API key and click **保存并继续** (stored in `~/.dsh/.credentials.yaml`; you can also add it later under **设置 → 模型**).
3. Pick a workspace above the input box (any folder, such as `~/longpi`) to start a session.

### 8. Check that the plugin works

**8.1 From the command line (no model needed).** `TOKEN` is the part after `token=` in the address from step 7.

```bash
TOKEN='paste the part after token='
curl -s "http://127.0.0.1:3080/api/longpi/version?token=$TOKEN"; echo
curl -s "http://127.0.0.1:3080/api/longpi/board?token=$TOKEN" | python3 -c '
import json, sys
d = json.load(sys.stdin); s, m, r = d["skills"], d["mirobody"], d["records"]
print("skills  ", s["count"], "version", s["version"], s["error"] or "")
print("mirobody", "mounted" if m["mounted"] else "not mounted: " + m["error"])
e = m["engine"]; print("engine  ", ("ok " + str(e.get("version"))) if e.get("ok") else ("failed: " + str(e.get("error"))))
print("record  ", r["status"], r["indicator_count"], "indicators", r["error"] or "")'
curl -s "http://127.0.0.1:3080/api/mirobody/resolve?q=%E8%A1%80%E7%BA%A2%E8%9B%8B%E7%99%BD&token=$TOKEN" \
  | python3 -c 'import json, sys; x = json.load(sys.stdin)["results"][0]; print(x["term"], "→", x["loinc"])'
```

Expected output, with your own numbers:

```text
{"product":"dsh-plugin-longpi","version":"4.2.0"}
skills   171 version 2026.39.0
mirobody mounted
engine   ok 1.5.0
record   ok 21 indicators
血红蛋白 → 718-7
```

**8.2 In the web page (no model needed).**

- Above the input box there is a **LongPi** row of suggested questions (a click copies one), and the sidebar footer shows **LongPi**.
- Type `/longpi` and press Enter. You should see:

  ```text
  dsh-plugin-longpi 4.2.0
  skills 171 (personal 98)  version 2026.39.0  revision …  from catalog.json
  profile age unset  sex unknown  birth unset
  mirobody mounted
  record server configured
  ```

  `/longpi-version` prints the version only; `/longpi-skills 表型年龄` prints the skills a question would reach.
- The board is a conversation view named **健康看板**. Once a session has a conversation, it appears among the view tabs at the top next to the chat view (DSH hides the tab row while a session is blank). Its header should read "Mirobody 已连接 · N 项指标".
- Open **记录、方法和档案** at the bottom of the board and save age, sex and the yes/no facts China-PAR needs. When the record has a checkup with all nine blood markers on one day, the body-age card shows phenotypic age and the goals section shows the China-PAR 10-year risk. Age has to be entered: birth year is only used for an estimate, never as a model input.

**8.3 With the model (needs the DeepSeek key).** Send these one at a time; each should show the tool call card named on the right.

| Send | Expected tool |
| --- | --- |
| 看看我的记录里有哪些检查指标 | `read_personal_situation` |
| 我 53 岁，男，1972 年出生，不吸烟，没有糖尿病，没吃降压药，住北方城市，家里没有早发心血管病。帮我存到档案 | `save_personal_profile` |
| 用我记录里的血检算表型年龄，数值和单位按记录原样传，缺的不要补 | `run_longevity_skill` |
| 帮我保存干预方案：从 2026-09-01 起每天快走 8000 步，每周 3 次力量训练，11 点前睡觉；目标空腹血糖 5.0 | `save_intervention_plan` (reads the plan back first; saves after you confirm) |
| 我的干预方案有没有效果？哪些有效，哪些还看不出来？ | `review_interventions` |
| 如果空腹血糖降到 5.0、超敏 CRP 降到 1，表型年龄会怎样？ | `model_intervention_goals` |

When something looks wrong, ask "帮我查一下 longpi 状态"; the model calls `longpi_status`, which reports the skill library, runtimes and Mirobody (no chart values, no token).

### 9. Troubleshooting

| Symptom | Cause and fix |
| --- | --- |
| `dsh plugin` cannot find pnpm | `npm install -g pnpm@10`, then check `pnpm -v`. |
| `skills unavailable`, or 0 skills | `skillsHome` is wrong or the clone is missing: `ls $LONGPI_HOME/longevity-skills/catalog.json`. |
| `mirobody not mounted: … not found` | Not installed through `dsh plugin add`, or `mirobodyPluginHome` points at a missing folder. Leave it empty and redo step 5. |
| `mirobody not mounted: Cannot find package '@deepseek-ai/…'` | `mirobodyPluginHome` points at a checkout outside the DSH profile, which cannot see DSH's packages. Leave it empty to use the bundled copy. |
| engine failed, `No module named mirobody` | The interpreter in `pythonBin` lacks mirobody; redo step 3. |
| record `error` saying refused or 401 | The MCP address expired or was mistyped. Redo step 2 and update `mcpUrl` (reloaded live). |
| record `error` saying Could not reach | Mirobody is not running: `cd $LONGPI_HOME/mirobody && docker compose ps`. |
| The board asks for chronological age | Enter age in the board's profile form, or tell the model. |
| A skill returns `runtime_missing` | It needs its own interpreter; set it in `skillRuntimes` under the runtime name the skill declares. |
| A config change had no effect | Check with `--dump-config` that the row is `patched by` your file; any key left out of the patch falls back to its default. |
| DSH fails to start | The terminal names the failing plugin; the full report is in `~/.dsh/logs/startup-*.log`. |
| No 健康看板 tab | Start the session with a message first; after changing plugins, restart `dsh web`. |

### Update and uninstall

```bash
dsh plugin --profile web update dsh-plugin-longpi   # latest main from GitHub; then restart dsh web
git -C "$LONGPI_HOME/longevity-skills" pull          # new skills, no restart needed
dsh plugin --profile web remove dsh-plugin-longpi   # uninstall; then delete the LongPi row from cordis.patch.yml
```

To pin a version, install `github:zwbao/dsh-plugin-longpi#v4.2.0` (or another tag). Uninstalling keeps the profile, plans and check-ins in `~/.dsh/longpi`.

### Without DSH (developers)

```bash
git clone https://github.com/zwbao/dsh-plugin-longpi.git && cd dsh-plugin-longpi
npm ci
LONGEVITY_SKILLS_HOME="$LONGPI_HOME/longevity-skills" npm test   # units, dispatch, Mirobody format, intervention review
npm run preview && python3 -m http.server 4173 -d preview/out     # then open http://127.0.0.1:4173
```

`npm run preview` renders the board with demo data (a fake Mirobody record, the real skills) as a plain page. To try local changes in DSH: `npm pack`, then `dsh plugin --profile web add ./dsh-plugin-longpi-<version>.tgz`. `npm run vendor:mirobody` refreshes the bundled Mirobody plugin from its release tag.

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

## What the model can call

Fourteen LongPi tools. Mounting Mirobody adds its eight tools in the same process (LOINC, units, indicators, medications, genotypes, status).

| Tool | What it returns |
| --- | --- |
| `read_personal_situation` | Saved age, sex, birth year; indicator names, values, units; the medication plan; earlier readouts; which methods the record can already run and which miss one or two inputs. |
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

Phenotypic age is recomputed by the skill at every checkup with all nine blood markers; goal estimates come from the skill too (`--targets`, `levers.json`) and are labelled model estimates. The plugin never states how many years a person will live.

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
