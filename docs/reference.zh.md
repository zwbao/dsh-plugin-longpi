# 参考

**[English](reference.md)** · **中文**

配置项、模型可调用的工具、命令与 HTTP 接口，以及调度、单位校验和干预评估的规则。

## 配置

| 字段 | 含义 |
| --- | --- |
| `skillsHome` | longevity-skills 的检出目录。空则试环境变量 `LONGEVITY_SKILLS_HOME`，再试 `~/longevity-skills`，然后是 `~/Projects/longevity-skills`。 |
| `skillsVersion` | 可选，锁定技能库的发布版本，例如 `2026.39.0`。`longpi_status` 会报告检出是否对得上。 |
| `mirobodyPluginHome` | 留空：用插件附带的 `vendor/dsh-plugin-mirobody`。只有调试 Mirobody 插件本身时才指向别的目录，而且那个目录要在 DSH profile 里。 |
| `pythonBin` | 能 `import mirobody` 的解释器。空则试 `MIROBODY_PYTHON`，再依次试 `python3.14`、`python3.13`、`python3.12`、`python3`。 |
| `mirobodyHome` | 可选，把 Mirobody 源码目录加进 `sys.path`（源码要先 `git lfs pull`）。用 pip 装的 mirobody 时留空。 |
| `mcpUrl` | 记录服务器：第 2 步的个人地址 `…/mcp/<密钥>`；或 `http://127.0.0.1:18060/mcp` 加 `mcpToken`。只做术语解析时可以空着。 |
| `mcpToken` | 地址里不带密钥时，填登录返回的 `access_token`（默认 30 天有效）。 |
| `member` | 关怀圈成员 id。空表示这个账号本人。 |
| `skillPython` | 跑技能脚本的解释器，建议和 `pythonBin` 用同一个虚拟环境。空则是 `python3`。 |
| `skillRuntimes` | 依赖较重的技能用的解释器，按 `skill.json` 里的 runtime 名配置，例如 `{ "pyaging": "/opt/pyaging/.venv/bin/python", "scientific": "/opt/sci/.venv/bin/python" }`。没配的技能直接拒绝，不会换别的解释器硬跑。 |
| `skillTimeoutMs` | 脚本时限，默认 `120000`。 |
| `dataDir` | 档案、回执、以前的读出、干预方案和打卡。空则是 `~/.dsh/longpi`。 |
| `maxSkillMatches` | 一个问题最多点名几个技能，默认 `8`。 |
| `timeoutMs` | Mirobody 桥和 MCP 请求的时限，默认 `30000`。 |
| `bootstrapWorkspace` | DeepSeek Harness 还没有任何工作区时，创建 `<dataDir>/workspace` 并登记为工作区「健康对话」，只做一次，这样会话可以打开，LongPi 首页可以使用（早期版本创建的「健康」工作区保留原名）。已有工作区时不作任何改动；创建之后不再重复创建（`dataDir` 里的 `workspace-bootstrap.json` 记录了这件事，删除的工作区不会再出现）。默认 `true`。 |

**在应用里设置的连接。** 在 DeepSeek Harness 设置的 LongPi 页保存的 Mirobody 地址（需要时连同令牌）存放在 `dataDir/connection.json`（仅本人可读），在清除之前替代 `mcpUrl` 和 `mcpToken`，LongPi 的所有读取都用它，挂载的 Mirobody 工具也一样。只有通过它在 10 秒内成功读取一次记录目录后才会保存；地址须为 `https://`，或指向 `127.0.0.1`、`localhost` 的 `http://`。页面不会拿到令牌，显示的地址会隐去 `/mcp/` 之后的部分。

## 工具

LongPi 自己 14 个。挂上 Mirobody 之后，同一进程里还有它的 8 个：LOINC、单位、检查、用药、基因型、状态。

| 工具 | 返回 |
| --- | --- |
| `read_personal_situation` | 保存的年龄、性别、出生年；检查的名字、数值和单位；用药计划；以前算过的读出；记录现在能跑哪些方法、差一两项检查的缺什么；`record_changes`：两次体检之间变化超出正常波动的指标。 |
| `list_longevity_intents` | 技能库能回答哪几类问题，以及这个人每一类里哪些技能已经能跑。 |
| `match_longevity_skills` | 按这个问题和这份记录排出的技能，带上识别出的意图、为什么选中、还缺什么。 |
| `read_longevity_skill` | 该技能的说明和清单：每个输入的单位、可接受的单位、合理范围，以及从记录还是档案里来。 |
| `run_longevity_skill` | 脚本写的读出。用 `measurements` 照记录原样传数值和单位；插件换算声明过的单位、检查范围、从档案补实足年龄和性别，缺单位或单位不对时在脚本运行前拒收。路径只能留在本次运行目录里。 |
| `query_longevity_evidence` | 收录论文对某个药物、补剂、饮食或基因的说法，按人群、动物、细胞分组，每条带出处。不给剂量。 |
| `list_longevity_domains` | 方法目录（动物和细胞研究单独计数）。 |
| `save_personal_profile` | 只写本地档案（称呼、出生年、年龄、性别，以及 China-PAR 需要的是否项：吸烟、糖尿病、两周内用降压药、南北方、城乡、家族史），不写 Mirobody。 |
| `longpi_status` | 技能库版本和锁定情况、已配置的运行时、Mirobody 状态。没有病历，没有 token。 |
| `save_intervention_plan` | 检查这个人说出或分享的干预方案，先返回读回请对方确认；带 `confirm: true` 再调一次才保存新版本。药物和补剂只按名字保存，剂量留在 Mirobody。 |
| `log_intervention_checkin` | 记下某天是否完成某一项，可标注生病、出差、换了检测机构等会干扰检查结果的情况。 |
| `read_intervention_plan` | 当前方案、以前的版本和最近的打卡。 |
| `review_interventions` | 每一项、每个目标指标：开始前的基线、够间隔的复测、对照个体正常波动（参考变化值）的变化、近 12 周执行率、同期其他变化、试验平均效应；历次体检的表型年龄；模型估计；下一步。 |
| `model_intervention_goals` | 不保存的“如果达到某个目标值”：用表型年龄技能（China-PAR 校验通过后也算）计算。模型估计。 |

命令：`/longpi`、`/longpi-skills 我的生物年龄`、`/longpi-stats`、`/longpi-version`。

HTTP 接口，供 LongPi 页面、引导流程和设置页使用：

- 读取：`GET /api/longpi/journey`、`/indicators`、`/indicators/detail?id=`、`/connection`、`/board`、`/tracking`、`/plan-draft`、`/followup`、`/self`、`/calendar.ics`、`/report`、`/match?q=`、`/intents`、`/stats`、`/version`；
- 写入：`POST /api/longpi/connection`、`/connection/test`、`/profile`、`/consent`、`/self`、`/checkin`、`/plan-draft/accept`、`/followup`、`/followup/test`、`/run-ready`；`DELETE /api/longpi/connection`、`/self?id=`。

每个接口先经过 DeepSeek Harness 自身的检查：请求须发往本机地址（或 DSH 配置为可信的主机），不能来自其他网站，并带有 DSH 的登录 Cookie。浏览器打开 DSH 打印的地址（`…/?token=…`）时会获得这个 Cookie。接口不接受 `token` 参数。没有 Cookie 返回 401；来自其他网站或经由其他主机名返回 403；DSH 没有连接服务时，所有接口返回 503。写入请求须使用 `Content-Type: application/json`（可带 charset），否则返回 415。在终端中调用时，先用 token 换取 Cookie，见安装指南第 8.1 步。

随访 Webhook 地址须为 `https://`，且不能指向本机（`127.0.0.0/8`、`::1`、`localhost`）、链路本地地址（`169.254.0.0/16`、`fe80::/10`）、未指定地址（`0.0.0.0`、`::`）或 `metadata.google.internal`。家庭局域网地址可以使用。不做任何 DNS 解析。

## 干预评估

方案是这个人自己的（或医生、长寿师给的）。插件整理成条目读给对方确认后才保存，每次保存都留一个版本，放在本机 `dataDir/interventions/`，不上传。

判断一项干预对某个指标有没有用，要同时满足：开始前 180 天内有基线；复测晚于该指标的最短间隔（如 HbA1c 约 3 个月）；变化超出个体生物变异加检测误差合成的参考变化值（CRP、甘油三酯按对数正态计算，家庭血压按 7 天平均）；近 12 周执行率够（手环阈值、Mirobody 服用记录或打卡，没有记录的天算未知，不算没做）。个体变异来自 longevity-skills 的 `data/biological_variation.json`，每一行都注明期刊出处；没有可核对来源的指标不给噪声带，结论写「无法判断」。同期还有别的干预或用药变化时照实说明只能评价组合。结论只有四种：有效、波动内、反向、无法判断。下一步只包括补执行、按时复测、补测、一次只改一项、和医生或长寿师讨论，不涉及任何药物和剂量。

**记录里的明显变化**：不需要方案。每个有生物变异数据的体检指标（只看带 LOINC 的检查行，手环数据和本人自测不算）用同一个标准判断：最新一次对比前一次；有三次及以上时，再对比最近六次里的第一次。变化超出参考变化值才算，两种对比都超出时报超出更多的那一个。方向是好的（按该行的 `better`）算好消息；方向不好的，以及要结合参考范围判断的指标（血红蛋白、平均红细胞体积、白细胞等）无论升降，都建议请医生看，排在前面。没有好坏方向的指标（体重）只说明变化。空腹血糖下降也只说明变化；有糖尿病或用药计划里有降糖药时，空腹血糖或糖化血红蛋白明显下降也建议请医生看。只比较 LOINC 编码在该行之列的检查行，尿液结果不会被当成同名的血液指标。按多日平均判断的指标（家庭血压）不用单次读数判断。不同医院、不同仪器之间的差异没有算进去。旅程（`changes`）、`read_personal_situation`（`record_changes`）、方案草稿的说明和导出报告显示的是同一批结果。

表型年龄在每次九项血检齐全的体检上由技能脚本回算；达成目标的估计也由技能脚本（`--targets`、`levers.json`）给出，都标“模型估计”。不输出个人“能多活几年”。

## 技能调度

1. **意图**：问题先对 longevity-skills 的 `intents.json`（生物年龄、甲基化年龄、器官年龄、可穿戴和睡眠、端粒、干预证据、基因、前后对比、影像、认知、衰弱、免疫、模式生物）。证据库里点名的药物、补剂和基因也算。模型也可以直接传意图 id。
2. **记录能跑什么**：每个技能的 `skill.json` 声明了输入的 LOINC、化验单上的叫法、单位和范围。必需输入都齐、并且至少有一项体检或设备记录的输入（带 LOINC 或设备代码）来自记录时，才算记录现在就能算；只差一两项这类检查、不缺别的，才列为差一两项并写明缺什么。只需要年龄、一个回答或别的方法读出的技能，不列为记录能算或差一项，但仍可以按问题匹配。
3. **排序**：意图自己的顺序、是否能跑、问题和技能说明重合的词。C 类技能（动物和细胞研究，或者输入只能是队列统计量）只在问题点名该生物时进入名单。没有实质对上时返回空名单，不拿弱匹配凑数。

`test/dispatch-cases.json` 有 50 个日常问题，`test/dispatch-heldout.json` 另有 15 个没用来调参的问题。前 3 名命中率低于 90%（50 题）或 80%（留出题），或者动物技能出现在没点名生物的问题里，`npm test` 就不通过。

## 单位校验

公式在技能脚本里，搬运由插件负责。数值照记录原样传。插件和技能里的 `skillkit.py` 用同一套规则：
- 用输入的键名（如 `crp_mg_dl`）写的行，单位就是键名里的单位。
- 用化验单叫法写的行，按输入的单位读。技能声明必须写单位的项例外：比如 CRP，mg/L 误读成 mg/dL 仍在合理范围内。
- 声明过的其他单位会被换算。
- 超出合理范围的值会停下并说明原因。

技能拒收输入时退出码是 3，原因放在 `problems` 里返回。

## 运行记录与统计

- `dataDir/receipts.jsonl` 记录每次运行：技能、检出版本、退出码、错误类型、用了哪些输入键、缺了哪些输入键。
- `dataDir/history.jsonl` 保存每次运行声明过的输出（例如 `phenoage`），供前后对比的技能使用。
- `/longpi-stats` 写出一周的计数：每个技能跑了几次、失败原因、缺了哪些输入。不含任何数值和报告文字，是否分享给技能维护者由本人决定。

插件不上传任何东西。

结构见 [architecture.md](architecture.md)。这里没有 Penguin，也没有序列到功能的工具。账号和同意不在这个插件里。
