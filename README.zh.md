# dsh-plugin-longpi

**[English](README.md)** · **中文**

面向个人的长寿抗衰 harness。装进 DeepSeek Harness 之后，一个人有一块健康看板：方法在 [longevity-skills](https://github.com/zwbao/longevity-skills)，病历在 [Mirobody](https://github.com/thetahealth/mirobody)。这个插件按这个人的问题和已经在档的检查决定用哪个技能，在技能运行前检查数值和单位，并查询收录论文里的证据。

不是医疗器械。不下诊断，不给剂量。紧急情况是「拨打 120」（在美国是 988），然后停下。见 [docs/intended-use.md](docs/intended-use.md)。

## 安装

需要 Node 22.19+，以及能 `import mirobody` 的 Python 3.12+。Mirobody 插件目录里要已经有 `lib/index.js`。技能仓库单独克隆，它是私有的；请用发布的版本（v2 结构：`catalog.json`、`intents.json`、每个技能一份 `skill.json`）。

```bash
cd /path/to/dsh-plugin-longpi && npm install && npm test
dsh plugin --profile web add link:/path/to/dsh-plugin-longpi
```

重启 `dsh web`，打开 **健康看板**。默认会找 `~/Projects/longevity-skills` 和 `~/Projects/dsh-plugin-mirobody`。不要再单独安装 mirobody 插件：LongPi 会在进程里挂上它，装两份会在工具名上冲突。

| 字段 | 含义 |
| --- | --- |
| `skillsHome` | longevity-skills 的检出目录。空则试环境变量 `LONGEVITY_SKILLS_HOME`，再试 `~/longevity-skills`，然后才是 `~/Projects/longevity-skills`。 |
| `skillsVersion` | 可选，锁定技能库的发布版本，例如 `2026.39.0`。`longpi_status` 会报告检出是否对得上。 |
| `mirobodyPluginHome` | dsh-plugin-mirobody 的检出目录。空则试 `MIROBODY_PLUGIN_HOME`，再试 `~/Projects/dsh-plugin-mirobody`。 |
| `pythonBin` | 能导入 mirobody 的解释器。空则优先用该目录下的 `.venv`。 |
| `mirobodyHome` | 可选，把 Mirobody 源码加进 `sys.path`。 |
| `mcpUrl` / `mcpToken` | 只读记录服务器，通常是 `http://127.0.0.1:18060/mcp`。只做术语解析时可以空着。 |
| `member` | 关怀圈成员。空表示当前调用者。 |
| `skillPython` | 跑技能脚本的解释器。空则是 `python3`。 |
| `skillRuntimes` | 依赖较重的技能用的解释器，按 `skill.json` 里的 runtime 名配置，例如 `{ "pyaging": "/opt/pyaging/.venv/bin/python", "scientific": "/opt/sci/.venv/bin/python" }`。没配的技能直接拒绝，不会换别的解释器硬跑。 |
| `skillTimeoutMs` | 脚本时限，默认 `120000`。 |
| `dataDir` | 档案、回执、以前的读出和暂存输入。空则是 `~/.dsh/longpi`。 |
| `maxSkillMatches` | 一个问题最多点名几个技能，默认 `8`。 |

## 工具

LongPi 自己 9 个。挂上 Mirobody 之后，同一进程里还有它的 8 个：LOINC、单位、检查、用药、基因型、状态。

| 工具 | 返回 |
| --- | --- |
| `read_personal_situation` | 保存的年龄、性别、出生年；检查的名字、数值和单位；用药计划；以前算过的读出；记录现在能跑哪些方法、差一两项的缺什么。 |
| `list_longevity_intents` | 技能库能回答哪几类问题，以及这个人每一类里哪些技能已经能跑。 |
| `match_longevity_skills` | 按这个问题和这份记录排出的技能，带上识别出的意图、为什么选中、还缺什么。 |
| `read_longevity_skill` | 该技能的说明和清单：每个输入的单位、可接受的单位、合理范围，以及从记录还是档案里来。 |
| `run_longevity_skill` | 脚本写的读出。用 `measurements` 照记录原样传数值和单位；插件换算声明过的单位、检查范围、从档案补实足年龄和性别，缺单位或单位不对时在脚本运行前拒收。路径只能留在本次运行目录里。 |
| `query_longevity_evidence` | 收录论文对某个药物、补剂、饮食或基因的说法，按人群、动物、细胞分组，每条带出处。不给剂量。 |
| `list_longevity_domains` | 方法目录（动物和细胞研究单独计数）。 |
| `save_personal_profile` | 只写本地档案，不写 Mirobody。 |
| `longpi_status` | 技能库版本和锁定情况、已配置的运行时、Mirobody 状态。没有病历，没有 token。 |

命令：`/longpi`、`/longpi-skills 我的生物年龄`、`/longpi-stats`、`/longpi-version`。

HTTP：`GET /api/longpi/board`、`GET /api/longpi/match?q=`、`GET /api/longpi/intents`、`GET /api/longpi/stats`、`POST /api/longpi/profile`、`GET /api/longpi/version`。看板会带上打开页面时的 DSH `token`。

## 怎么调度

1. **意图**：问题先对 longevity-skills 的 `intents.json`（生物年龄、甲基化年龄、器官年龄、可穿戴和睡眠、端粒、干预证据、基因、前后对比、影像、认知、衰弱、免疫、模式生物）。证据库里点名的药物、补剂和基因也算。模型也可以直接传意图 id。
2. **记录能跑什么**：每个技能的 `skill.json` 声明了输入的 LOINC、化验单上的叫法、单位和范围。输入在记录里（或在以前的读出里）都齐的技能排前面并标成能跑；差一两项的列出来，写明缺什么。
3. **排序**：意图自己的顺序、是否能跑、问题和技能说明重合的词。C 类技能（动物和细胞研究，或者输入只能是队列统计量）只在问题点名该生物时进入名单。没有实质对上时返回空名单，不拿弱匹配凑数。

`test/dispatch-cases.json` 有 50 个日常问题，`test/dispatch-heldout.json` 另有 15 个没用来调参的问题。前 3 名命中率低于 90%（50 题）或 80%（留出题），或者动物技能出现在没点名生物的问题里，`npm test` 就不通过。

## 单位和拒收

公式在技能脚本里，搬运由插件负责。数值照记录原样传。插件和技能里的 `skillkit.py` 用同一套规则：
- 用输入的键名（如 `crp_mg_dl`）写的行，单位就是键名里的单位。
- 用化验单叫法写的行，按输入的单位读。技能声明必须写单位的项例外：比如 CRP，mg/L 误读成 mg/dL 仍在合理范围内。
- 声明过的其他单位会被换算。
- 超出合理范围的值会停下并说明原因。

技能拒收输入时退出码是 3，原因放在 `problems` 里返回。

## 回执、读出和统计

- `dataDir/receipts.jsonl` 记录每次运行：技能、检出版本、退出码、错误类型、用了哪些输入键、缺了哪些输入键。
- `dataDir/history.jsonl` 保存每次运行声明过的输出（例如 `phenoage`），供前后对比的技能使用。
- `/longpi-stats` 写出一周的计数：每个技能跑了几次、失败原因、缺了哪些输入。不含任何数值和报告文字，是否分享给技能维护者由本人决定。

插件不上传任何东西。

结构见 [docs/architecture.md](docs/architecture.md)。这里没有 Penguin，也没有序列到功能的工具。账号和同意不在这个插件里。
