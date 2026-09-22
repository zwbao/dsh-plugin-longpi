# dsh-plugin-longpi

**English** · **[中文](README.zh.md)**

Personal longevity harness for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness). It turns a DSH profile into one person's board: the methods stay in [longevity-skills](https://github.com/zwbao/longevity-skills), the chart stays in [Mirobody](https://github.com/thetahealth/mirobody), and this plugin decides which skill to read.

Not a medical device. No diagnosis, no dose change. An emergency is “call 120” (988 in the US), then stop. See [docs/intended-use.md](docs/intended-use.md).

## Install

Node 22.19+ and a Python 3.12+ interpreter. The Mirobody checkout has to be built (`lib/index.js` present). The longevity-skills checkout is separate and private.

```bash
cd /path/to/dsh-plugin-longpi && npm install && npm test
dsh plugin --profile web add link:/path/to/dsh-plugin-longpi
```

Restart `dsh web`. Open the **健康看板** tab. Defaults look for `~/Projects/longevity-skills` and `~/Projects/dsh-plugin-mirobody`. Do not also `dsh plugin add` mirobody: LongPi mounts it, and a second copy collides on tool names.

| Field | Meaning |
| --- | --- |
| `skillsHome` | Checkout of longevity-skills. Empty tries `LONGEVITY_SKILLS_HOME`, then `~/Projects/longevity-skills`. |
| `mirobodyPluginHome` | Checkout of dsh-plugin-mirobody. Empty tries `MIROBODY_PLUGIN_HOME`, then `~/Projects/dsh-plugin-mirobody`. |
| `pythonBin` | Interpreter that can `import mirobody`. Empty prefers that checkout's `.venv`. |
| `mirobodyHome` | Optional Mirobody source added to `sys.path`. |
| `mcpUrl` / `mcpToken` | Read-only record server, usually `http://127.0.0.1:18060/mcp`. Terminology works without them. |
| `member` | Care-circle member id. Empty is the caller. |
| `skillPython` | Interpreter for skill scripts. Empty is `python3`. |
| `skillTimeoutMs` | Script budget. Default `120000`. |
| `dataDir` | Profile, receipts, and staged runs. Empty is `~/.dsh/longpi`. |
| `maxSkillMatches` | How many skills a question may dispatch. Default `8`. |

## What the model can call

Seven LongPi tools. Mounting Mirobody adds its eight tools in the same process (LOINC, units, indicators, medications, genotypes, status).

| Tool | What it returns |
| --- | --- |
| `read_personal_situation` | Saved age, sex, birth year, and the Mirobody summary. |
| `match_longevity_skills` | Ranked skill directories for this question and this record. |
| `read_longevity_skill` | That skill's instructions. |
| `run_longevity_skill` | The script's readout. Paths stay inside the run directory. |
| `list_longevity_domains` | The method menu. |
| `save_personal_profile` | Local profile only. It does not write Mirobody. |
| `longpi_status` | Whether the checkouts are present. No chart, no token. |

Commands: `/longpi`, `/longpi-skills 表型年龄`, `/longpi-version`.

HTTP: `GET /api/longpi/board`, `GET /api/longpi/match?q=`, `POST /api/longpi/profile`, `GET /api/longpi/version`. The board forwards the DSH `token` query parameter.

## Dispatch

A question is matched against each skill's name, description, and the one-line note in the longevity-skills README. A few records unlock a skill without a question: several phenotypic-age markers, a telomere, or sleep. Mouse, worm, fly, and the other model-organism skills wait until the question names them.

The script owns the formula. This package does not recompute phenotypic age. A missing marker stays missing. The receipt stores the skill name, the checkout revision, the exit code, and a short excerpt.

## Layout

See [docs/architecture.md](docs/architecture.md). Penguin and sequence-to-function tools are not in this plugin. Accounts and consent stay outside DSH.
