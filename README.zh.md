# dsh-plugin-longpi

**[English](README.md)** · **中文**

面向个人的长寿抗衰 harness。装进 DeepSeek Harness 之后，一个人有一块健康看板：方法在 [longevity-skills](https://github.com/zwbao/longevity-skills)，病历在 [Mirobody](https://github.com/thetahealth/mirobody)，这个插件按这个人的问题和已经在档的检查决定读哪个技能。

不是医疗器械。不下诊断，不改剂量。紧急情况是「拨打 120」（在美国是 988），然后停下。见 [docs/intended-use.md](docs/intended-use.md)。

## 安装

需要 Node 22.19+，以及能 `import mirobody` 的 Python 3.12+。Mirobody 插件目录里要已经有 `lib/index.js`。技能仓库单独克隆，它是私有的。

```bash
cd /path/to/dsh-plugin-longpi && npm install && npm test
dsh plugin --profile web add link:/path/to/dsh-plugin-longpi
```

重启 `dsh web`，打开 **健康看板**。默认会找 `~/Projects/longevity-skills` 和 `~/Projects/dsh-plugin-mirobody`。不要再单独安装 mirobody 插件：LongPi 会在进程里挂上它，装两份会在工具名上冲突。

| 字段 | 含义 |
| --- | --- |
| `skillsHome` | longevity-skills 的检出目录。空则试环境变量 `LONGEVITY_SKILLS_HOME`，再试 `~/longevity-skills`，然后才是 `~/Projects/longevity-skills`。 |
| `mirobodyPluginHome` | dsh-plugin-mirobody 的检出目录。空则试 `MIROBODY_PLUGIN_HOME`，再试 `~/Projects/dsh-plugin-mirobody`。 |
| `pythonBin` | 能导入 mirobody 的解释器。空则优先用该目录下的 `.venv`。 |
| `mirobodyHome` | 可选，把 Mirobody 源码加进 `sys.path`。 |
| `mcpUrl` / `mcpToken` | 只读记录服务器，通常是 `http://127.0.0.1:18060/mcp`。只做术语解析时可以空着。 |
| `member` | 关怀圈成员。空表示当前调用者。 |
| `skillPython` | 跑技能脚本的解释器。空则是 `python3`。 |
| `skillTimeoutMs` | 脚本时限，默认 `120000`。 |
| `dataDir` | 档案、回执和暂存输入。空则是 `~/.dsh/longpi`。 |
| `maxSkillMatches` | 一个问题最多点名几个技能，默认 `8`。 |

## 工具

LongPi 自己 7 个。挂上 Mirobody 之后，同一进程里还有它的 8 个：LOINC、单位、检查、用药、基因型、状态。

| 工具 | 返回 |
| --- | --- |
| `read_personal_situation` | 保存的年龄、性别、出生年，以及 Mirobody 摘要。 |
| `match_longevity_skills` | 按这个问题和这份记录排出的技能目录。 |
| `read_longevity_skill` | 该技能的说明。 |
| `run_longevity_skill` | 脚本写的读出。路径只能留在本次运行目录里。 |
| `list_longevity_domains` | 方法目录。 |
| `save_personal_profile` | 只写本地档案，不写 Mirobody。 |
| `longpi_status` | 两个检出是否可用。没有病历，没有 token。 |

命令：`/longpi`、`/longpi-skills 表型年龄`、`/longpi-version`。

HTTP：`GET /api/longpi/board`、`GET /api/longpi/match?q=`、`POST /api/longpi/profile`、`GET /api/longpi/version`。看板会带上打开页面时的 DSH `token`。

## 怎么调度

问题会去对每个技能的名字、说明，以及 longevity-skills README 里的那一行。没有问题的时候，只有记录对上了才会点名：表型年龄的几项指标、端粒，或睡眠。小鼠、线虫、果蝇和其他模式生物要等问题点名。

公式在技能脚本里。这个包不另算表型年龄。缺的指标保持缺失。回执记下技能名、检出版本、退出码和一小段摘录，用来回放这次读出。

结构见 [docs/architecture.md](docs/architecture.md)。这里没有 Penguin，也没有序列到功能的工具。账号和同意不在这个插件里。
