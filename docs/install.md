# Manual installation

**English** · **[中文](install.zh.md)**

The one-line installer in the [README](../README.md#installation) is the usual way in. This page lists the equivalent steps one by one, for troubleshooting, for custom locations, or for environments where the script cannot run.


A working setup has four separate parts:

| Part | What it is | Where |
| --- | --- | --- |
| Mirobody server | The record: lab reports, wearables, medications. The plugin reads it through Mirobody's MCP endpoint, read-only | Docker, `http://127.0.0.1:18060` |
| longevity-skills | The method library (skill scripts) and two reference tables | `~/longpi/longevity-skills` |
| Python environment | Mirobody's terminology engine (LOINC, unit conversion) and the skills' dependencies | `~/longpi/.venv` |
| DSH + this plugin | Conversation, tools and the health board; [dsh-plugin-mirobody](https://github.com/zwbao/dsh-plugin-mirobody) ships inside this plugin, nothing extra to install | `~/.dsh/profiles/web` |

Run the blocks below in order. Everything goes under `~/longpi`; **in every new terminal, run the `export` at the top of step 0 first.**

## 0. Tools

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

## 1. Start Mirobody (the record server)

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

## 2. Get the record-server address (MCP)

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

## 3. Python environment

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

A few skills need heavier dependencies (pyaging, for example) and name a runtime in their `skill.json`. Without that interpreter configured, the plugin refuses to run them rather than try another environment; see `skillRuntimes` in the [configuration reference](reference.md#configuration).

## 4. The skill library

```bash
cd "$LONGPI_HOME"
git clone https://github.com/zwbao/longevity-skills.git
ls longevity-skills/catalog.json longevity-skills/data   # catalog.json, biological_variation.json, effects.jsonl
```

## 5. Install the plugin

```bash
dsh plugin --profile web add github:zwbao/dsh-plugin-longpi
```

The web profile is created if it does not exist. `missing peer @deepseek-ai/...` warnings are expected: DSH provides those packages. No `allowBuilds` is needed, because the repository carries the built `lib/`.

```bash
ls ~/.dsh/profiles/web/node_modules/dsh-plugin-longpi/vendor/dsh-plugin-mirobody   # the bundled Mirobody plugin
grep -A 6 '"bundles"' ~/.dsh/profiles/web/package.json                             # lists dsh-plugin-longpi
```

Do not also `dsh plugin add` the Mirobody plugin: LongPi already mounts it in the same process, and a second copy registers the same tools twice.

## 6. Configure

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

dsh --profile web --dump-config | grep -B 1 -A 24 'id: dsh-plugin-longpi'
```

The last command should print `# == dsh-plugin-longpi, patched by …/cordis.patch.yml` followed by your values (`mcpUrl` in clear text, so do not share the output). Each key is described in the [configuration reference](reference.md#configuration).

## 7. Start DSH

Plugins load at startup. If DSH is already running, stop it with Ctrl+C in its terminal first.

```bash
cd "$LONGPI_HOME" && dsh web
```

It prints `dsh web: http://127.0.0.1:3080/?token=…` and opens the browser (`--no-open` to skip that). The first time:

1. On the beta notice (内测声明), click **继续**.
2. In **添加一个 API Key 开始使用**, paste your DeepSeek API key and click **保存并继续** (stored in `~/.dsh/.credentials.yaml`; you can also add it later under **设置 → 模型**).
3. Pick a workspace above the input box (any folder, such as `~/longpi`) to start a session.

## 8. Check that the plugin works

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

## 9. Troubleshooting

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

## Update and uninstall

```bash
dsh plugin --profile web update dsh-plugin-longpi   # latest main from GitHub; then restart dsh web
git -C "$LONGPI_HOME/longevity-skills" pull          # new skills, no restart needed
dsh plugin --profile web remove dsh-plugin-longpi   # uninstall; then delete the LongPi row from cordis.patch.yml
```

To pin a version, install `github:zwbao/dsh-plugin-longpi#v4.2.0` (or another tag). Uninstalling keeps the profile, plans and check-ins in `~/.dsh/longpi`.

## Without DSH (developers)

```bash
git clone https://github.com/zwbao/dsh-plugin-longpi.git && cd dsh-plugin-longpi
npm ci
LONGEVITY_SKILLS_HOME="$LONGPI_HOME/longevity-skills" npm test   # units, dispatch, Mirobody format, intervention review
npm run preview && python3 -m http.server 4173 -d preview/out     # then open http://127.0.0.1:4173
```

`npm run preview` renders the board with demo data (a fake Mirobody record, the real skills) as a plain page. To try local changes in DSH: `npm pack`, then `dsh plugin --profile web add ./dsh-plugin-longpi-<version>.tgz`. `npm run vendor:mirobody` refreshes the bundled Mirobody plugin from its release tag.
