# LongPi 2.0 方案 —— 成为大健康方向 star 第一

状态：**第一轮已落地并跑通测试**（见文末「本轮改了什么」）。本文档是完整方案与路线图。
日期：2026-09-17 · 目标仓库：[zwbao/dsh-plugin-longpi](https://github.com/zwbao/dsh-plugin-longpi)

---

## 0. 三个纠正

这轮调研推翻了三个前提，方案建在纠正后的事实上。

**纠正 1 —— 「s2f」「tycho」都不是 GitHub 项目，是你本机已有的两套系统。**

| 名字 | 真实身份 | 位置 |
|---|---|---|
| s2f | [s2f-agent](https://github.com/JiaqiLi1024/s2f-agent) 被移植成 [PenguinHarness](https://github.com/Prism-Shadow/penguin-harness) 原生 agent 的 **s2f-penguin**；Python 包 `s2f-core`，CLI `s2f` | `~/s2f-penguin`（v0.2.0，含 PRD/CHANGELOG/契约数据） |
| tycho | **Tycho Engine**：本地优先的个人数字孪生引擎，Python，44 个 MCP stdio 工具 | `~/Library/CloudStorage/…/cancerdao/code/tycho/engine`，CLI `~/.local/bin/tycho`，家目录 `~/.tycho` |

我一开始按 GitHub 上的同名项目去找，找到的是 `NIMI-research/Tycho`（ARC-AGI-3，56★）、`firewalker06/tycho`（48★）、`propeller-heads/tycho`（区块链索引器）——**全是错的**。线索来自你自己写的 `~/s2f-penguin/docs/PRD.md` 第 46 行：「扩展只有 `tools.mcpServers`（**本机 tycho 先例**）」。

**纠正 2 —— 有两个数字要分开看：插件榜的门槛，和数字健康 OSS 的天花板。**

**（a）DSH 插件目录实测**（3,727 个插件，1,484 个有星数）：

| 指标 | 值 |
|---|---|
| 中位数 | **2 ★** |
| p95 | 50 ★ |
| p99 | 791 ★ |
| 最大值 | 29,567 ★（`volcengine/OpenViking` 记忆插件） |
| ≥100 ★ 的插件 | 49 个 |
| 健康类插件 | **只有 1 个**：[Mr-Neutr0n/dsh-medseek](https://github.com/Mr-Neutr0n/dsh-medseek)（临床文书，未进星数榜） |
| `tools` 分类天花板 | 477 ★（`superdesigndev/treg`） |
| `skill` 分类天花板 | 1,062 ★（`GanyuanRan/Aegis`） |

**（b）但「大健康方向 star 第一」比的是整个数字健康开源界，不是插件榜。**实测天花板约 **7k**，不是 50k：

| 项目 | ★ | 许可 | 说明 |
|---|---|---|---|
| [wger-project/wger](https://github.com/wger-project/wger) | 6,926 | AGPL-3.0 | 健身/营养/体重追踪，当前数字健康第一 |
| [Freeyourgadget/Gadgetbridge](https://github.com/Freeyourgadget/Gadgetbridge) | 4,594 | AGPL-3.0 | 多品牌穿戴同步，**已归档**，迁至 Codeberg |
| [kakoni/awesome-healthcare](https://github.com/kakoni/awesome-healthcare) | 3,977 | CC0-1.0 | 医疗开源清单 |
| [OpenHealthForAll/open-health](https://github.com/OpenHealthForAll/open-health) | 3,949 | AGPL-3.0 | **AI 健康助手，头号竞品** |
| [synthetichealth/synthea](https://github.com/synthetichealth/synthea) | 3,342 | Apache-2.0 | 合成病人生成器 |
| [thetahealth/mirobody](https://github.com/thetahealth/mirobody) | **1,321** | **Apache-2.0** | **最直接竞品**：AI-native 健康数据引擎，labs + 可穿戴 + 基因组 |

**所以目标要拆成两句**：拿到「大健康方向第一」需要超过约 **7,000 ★**；拿到「长寿/生物年龄细分第一」只需超过 **1,321 ★**（mirobody）。后者现实得多，且是可以分阶段达成的。

**长寿 agent 赛道已有的直接先例**（说明这条路有人走过，但没人做透）：

| 项目 | ★ | 说明 |
|---|---|---|
| [SequelHQ/Sequel](https://github.com/SequelHQ/Sequel) | 270 | MIT，「个性化长寿助手」，2024 年后停更 |
| [longevity-genie](https://github.com/longevity-genie) 组织 | 82+80+34+31+21+20+10 | 一整套 longevity MCP 服务器 + agent 框架，**最直接的竞品簇** |
| [albert-ying/longevity-os](https://github.com/albert-ying/longevity-os) | 21 | 「agentic 长寿 OS，10 个 AI 医生，N-of-1 试验」——定位与 LongPi 高度重叠 |
| [199-mcp/mcp-phenoage-clock](https://github.com/199-mcp/mcp-phenoage-clock) | 5 | MIT，**已经在做 PhenoAge 的 MCP server**——接口可对齐，不必另发明 |
| [gangchen/epiage-skill](https://github.com/gangchen/epiage-skill) | 2 | 24 个表观时钟做成 agent skill（纯 pandas+numpy），**打包方式最值得抄** |

三条可执行的结论：① 竞品都在做「引擎/工具」，没人做「会员界面 + 出处可审计」；② PhenoAge MCP 已经存在，说明我们的接口设计应该对齐既有惯例；③ `gangchen/epiage-skill` 证明了「把时钟做成 agent skill」是可行的打包形态，而 LongPi 现在正是这个形态，只是多了 GUI 与守则。

**纠正 3 —— 首页那个 41.2 是写死的，不是算出来的。**

`src/fixture.ts` 里 `composite_age: 41.2` 是字面量，`iage: 57` 也是字面量。README 却写着「Every answer that cites a number must come from a tool」「Invented labs are a bug」。**声明与实现不一致，这是这个仓库最大的风险**——在健康域，一个被查出数字是编的插件，star 会变成负资产。

---

## 1. 定位：三段系统，LongPi 只做薄的那一段

```
┌──────────────────────────────────────────────────────────────┐
│  DSH Web GUI                                                 │
│  └─ dsh-plugin-longpi   ← 本仓：会员界面 + 最前沿证据 + 守则   │
│       ├── 生物年龄引擎（PhenoAge，本仓实现，可复算）           │
│       ├── 九项标志物面板 / 基因组 12 位点 / 五层组学          │
│       └── s2f 路由与去标识契约                                │
└───────────┬──────────────────────────────┬───────────────────┘
            │ s2f_route / s2f_plan         │ mcp__tycho__*  (44 tools)
            │ s2f_batch_request（契约）     │
            ▼                              ▼
┌───────────────────────────┐   ┌──────────────────────────────┐
│ s2f-penguin               │   │ Tycho Engine                 │
│ 序列 → 功能                │   │ 这个人的纵向真相              │
│ · 变异效应模型适配器        │   │ · 哈希链账本（可发现篡改）    │
│ · claim ceiling（约束/分子  │   │ · twin labs/genotype         │
│   /细胞）                   │   │ · 预测先写后结算 + 校准       │
│ · 每次运行出复现收据        │   │ · N-of-1 preregister + 序贯   │
│ · 拒绝 hg19、拒绝人类 live  │   │ · safety_check / screening    │
│   GPN forward               │   │   loop / 周报骨架             │
└───────────────────────────┘   └──────────────────────────────┘
```

**边界规则（写进 system prompt，不靠模型自觉）：**

> LongPi 提出**带 claim ceiling 的候选**；Tycho 判定**关于这个个体的事情是否为真**。
> 表型年龄永远不变成治疗指令；预测在窗口结算前永远不变成结论。

为什么这样切：

- **不重实现**。Tycho 已经有 44 个工具覆盖了 LongPi README 本来想承诺的东西（预测、N-of-1、安全门、筛查闭环）。重写一遍是纯粹的浪费，而且必然更差。
- **MCP 是唯一该用的边界**。DSH 自带 [`@deepseek-ai/dsh-mcp-client`](/Users/baozhiwei/.local/dsh-runtime/lib/node_modules/@deepseek-ai/dsh/node_modules/@deepseek-ai/dsh-mcp-client)，工具以 `mcp__<server>__<tool>` 注册。**接 Tycho 只需要 `cordis.patch.yml` 里一行配置，零适配代码。**这是 star 效率最高的接法。
- **工具 token 成本是真的**。44 个工具定义进每一次请求，所以默认注释掉、由用户显式打开。`tycho serve` 在没有 twin 时退出码 2，会让 DSH 启动变慢或报错——这也是默认关的第二个理由。

---

## 2. 护城河：可审计性，而不是功能数量

功能可以被抄，**「每个数字都能被第三方复算」抄不动**，因为它要求你把公式、常数、单位、失败语义、以及「没实现什么」全部摊开。

已经落地的形态：

1. **黄金向量测试**。`test/smoke.mjs` 用手算重算 PhenoAge，断言引擎输出 `52.52920526313869`。改一个系数就红。
2. **拒绝优先于猜测**。缺项 → `MISSING_INPUT`；单位不合理 → `OUT_OF_RANGE`（带期望单位提示）；无参考队列 → `NO_REFERENCE`。三条都有测试。
3. **模型卡**（`read_bioage_model`）显式列出**没有实现**的时钟（KDM / Horvath / GrimAge / DunedinPACE）及原因，而不是静默省略。
4. **GUI 出处行**。综合年龄下方直接写明「生物学维 = 引擎计算」「其余 4 维 = 固定演示值」，每张模块卡角标区分「引擎 / 演示输入」。
5. **claim ceiling 随值返回**。PhenoAge 的三个限制（人群模型非诊断、单次误差大、跨实验室不可比）永远跟着数字走。

---

## 3. 吸收清单（全部于 2026-09-17 核对 slug / 星数 / 许可）

原则：**能跨进程调用就别内联；内联的必须只搬「已发表常数」，绝不搬 copyleft 代码。**
`integration` 四档：`import` 可直接依赖 · `process` 只能子进程/HTTP（copyleft） · `cite` 只能引用 · `unknown` 等同保留所有权利。

### 3.1 生物年龄 / 衰老时钟

| 项目 | ★ | 许可 | 接法 | 用途 |
|---|---|---|---|---|
| [lucascamillomd/pyaging](https://github.com/lucascamillomd/pyaging) | 130 | MIT | import | **首选时钟引擎**（GPU 优化的时钟合集）。注：原 slug `rsinghlab/pyaging` 只是 301 重定向 |
| [bio-learn/biolearn](https://github.com/bio-learn/biolearn) | 91 | BSD-3（人工核对 LICENSE 正文） | import | 统一生物标志物 + 时钟装载。**原 slug `BioAgeLab/biolearn` 是 404 死链，已修** |
| [HigginsChenLab/methylCIPHER](https://github.com/HigginsChenLab/methylCIPHER) | 25 | BSD-3 | process | 甲基化时钟覆盖最广（PC / SystemsAge / CausalAge / DunedinPACE） |
| [dayoonkwon/BioAge](https://github.com/dayoonkwon/BioAge) | 191 | **GPL-3.0** 🚩 | cite | 只用于核对 PhenoAge 常数（本仓已如此），**不得链接** |
| [Healome/openage](https://github.com/Healome/openage) | 42 | **AGPL-3.0** 🚩 | process | 开放权重血液年龄模型；网络传染性，只能跨进程 |
| [Gladyshev-Lab/tAge](https://github.com/Gladyshev-Lab/tAge) | 25 | **MGB 自定义** 🚩 | 需法务 | 转录组年龄（这才是真正的 tAge） |
| [MorganLevineLab/PC-Clocks](https://github.com/MorganLevineLab/PC-Clocks) | 61 | **无许可** 🚩 | cite | 权威 PC 时钟，但无许可＝保留所有权利 |
| [199-mcp/mcp-phenoage-clock](https://github.com/199-mcp/mcp-phenoage-clock) | 5 | MIT | 对齐接口 | 已有 PhenoAge MCP server，**接口应与其保持一致** |

### 3.2 信号层（可穿戴 / 生理信号）— 全是宽松许可，最高性价比

| 项目 | ★ | 许可 | 用途 |
|---|---|---|---|
| [the-momentum/open-wearables](https://github.com/the-momentum/open-wearables) | 2,514 | MIT | **可穿戴统一 API**：Apple Health / Google Fit / Garmin 一处接入 |
| [neuropsychology/NeuroKit](https://github.com/neuropsychology/NeuroKit) | 2,359 | MIT | HRV / ECG / PPG / 睡眠信号事实标准 |
| [tdda/applehealthdata](https://github.com/tdda/applehealthdata) | 108 | MIT | 最快拿到 Apple Health XML 的路 |
| [sandseb123/Leo-Health-Core](https://github.com/sandseb123/Leo-Health-Core) | 93 | MIT | Apple Health + Whoop → 本地 SQLite，零依赖 |
| [HypnosPy/HypnosPy](https://github.com/HypnosPy/HypnosPy) | 35 | MIT（人工核对） | 设备无关的昼夜节律分析 |
| [openmhealth/schemas](https://github.com/openmhealth/schemas) | 79 | Apache-2.0 | Open mHealth / IEEE 1752 标准，**输出应对齐它** |

### 3.3 基因组 / 多基因 / 药物基因组

| 项目 | ★ | 许可 | 用途 |
|---|---|---|---|
| [Ensembl/ensembl-vep](https://github.com/Ensembl/ensembl-vep) | 572 | Apache-2.0 | 变异效应注释主干 |
| [brentp/slivar](https://github.com/brentp/slivar) | 275 | MIT | 快速变异过滤/注释 |
| [getian107/PRScs](https://github.com/getian107/PRScs) | 216 | MIT | **MIT 许可的多基因打分**（避开 GPL 的 LDpred2） |
| [PharmGKB/PharmCAT](https://github.com/PharmGKB/PharmCAT) | 191 | MPL-2.0 | 药物基因组 star-allele + CPIC。⚠️ 与「不改药」守则冲突，需专门设计 |
| [PGScatalog/pgsc_calc](https://github.com/PGScatalog/pgsc_calc) | 177 | Apache-2.0 | PGS Catalog 打分流程 |
| **PGS Catalog**（PGS000906 / PGS002795） | — | 开放 | **现成的长寿多基因分数**，可把 12 位点面板升级成真正 PRS |
| [privefl/bigsnpr](https://github.com/privefl/bigsnpr) | 226 | **GPL-3.0** 🚩 | LDpred2 所在地，只能子进程 |
| [open-genes/open-genes-api](https://github.com/open-genes/open-genes-api) | 9 | MPL-2.0 | 长寿基因数据库，**有真 HTTP API**，星数低易吸收 |

### 3.4 长寿证据数据（无 GitHub 仓库，只有数据）

| 资源 | 接法 | 说明 |
|---|---|---|
| **HAGR**（GenAge / DrugAge / CellAge / LongevityMap / GenDR / AnAge） | 打包 CSV | 下载点已核实：`genomics.senescence.info/download.html`（`/drugs/dataset.zip`、`/genes/human_genes.zip`、`/cells/cellAge.zip`、`/longevity/longevity_genes.zip`）。⚠️ 条款写「在若干条件下可自由使用」，**完整法律条款未逐条确认** |
| Geroprotectors.org | cite | **未找到 GitHub 仓库**，`/about` 两次抓取失败，仓库状态未证实 |
| ITP（NIA 干预测试计划） | cite | 无仓库；`nia.nih.gov` 返回 405 挡爬虫；数据在 Mouse Phenome Database，**确切下载地址未证实** |

### 3.5 明确的空白（没人做 = 机会）

- **视网膜年龄 / 眼底衰老**：最强结果 0–1 ★，无可整合目标。
- **VO₂max / 心肺适能估计**：最强 1 ★。
- **化验单解读**：无可信的高星项目。
- **无 TACO 仓库**：GitHub 搜索零结果，**多半不存在**（tAge 存在，见上）。
- **长寿专用 PRS 代码**：分数在 PGS Catalog，代码没有专门项目。

### 3.6 明确不做

- 不内联任何 GPL/AGPL 代码，不搬运「无许可」项目的系数（`PC-Clocks`、`FaceAge`、`spatial_aging_clocks` 等）。
- 不内置 KDM 系数（需要 NHANES 拟合参数，我不拥有）。
- 不接 `PharmCAT` 的药物基因组结论直到有专门设计（与「不改药」守则直接冲突）。
- 不爬 GitHub 抗衰仓库当证据。

### 3.7 许可地雷（必须在 README 里明说）

| 类型 | 项目 | 后果 |
|---|---|---|
| AGPL-3.0（网络传染） | wger 6926、open-health 3949、cgm-remote-monitor 2823、openage 42、longevity-skills | 只能 HTTP/子进程，**绝不能 import** |
| GPL-3.0 | BioAge 191、bigsnpr 226（LDpred2）、PRSice 209、Bismark 466、fasten-onprem 2794 | 同上；import 会让本包变 GPL |
| LGPL-3.0 | brainageR 116 | 动态链接可，静态链接传染 |
| CC-BY-NC / NC-ND | pyment-public 53、mammalian-methyl-clocks 8、AlphaMissense 数据 | **非商用**，商用产品致命，只能 cite |
| CC-BY-SA-4.0 | ComputAge 37 | 传染，衍生作品必须同许可 |
| 自定义机构许可 | Gladyshev-Lab/tAge（MGB） | 需法务审查 |
| **无许可文件**（＝保留所有权利） | PC-Clocks 61、FaceAge 110、spatial_aging_clocks 52、Epigenetic-Clock 27、plink-ng 518、clinvar 84 等 | 不得搬代码或系数 |

---

## 4. star 路径

star 只来自四件事，按性价比排序。

### P0 — 让数字真实（本轮已完成 ✅）

装完就能自己验，这是信任的最低门槛，也是唯一能被写进 README 的硬声明。

### P0 — 进入 awesome 列表（未做，最高优先）

调研发现 **LongPi 根本不在目录里**（`data/plugins/` 无 `zwbao__*` 条目）。现状是「一个没人看得见的零 star 仓库」。

收录要求（已核对 `contributing.md`）：
- `package.json` 声明 `dsh.bundle` ✅（已有）
- 仓库根有 `cordis.patch.yml` ✅（已有）
- GitHub topic `dsh-plugin` ✅（已有）
- 提一个 PR，**只加一个文件** `data/plugins/zwbao__dsh-plugin-longpi.yml`
- 分类建议 `tools`；`description.en` 必填且含 `: ` 时要加引号

这是**投入最小、收益最大**的一步。

### P1 — 30 秒可验证的演示

现在 README 有一行安装和一张 hero SVG，缺的是「30 秒内看到数字真实」的动线：

```sh
npm test          # 一行命令，输出黄金向量
```

再补一个无依赖的 `npm run bioage -- 45 albumin=41 ...` 之类的 CLI，让不进 GUI 的人也能复算。**这比再写 10 个工具更能换 star。**

### P1 — 把「没实现什么」变成可点的路线图

`read_bioage_model` 已经列了 3 个未实现时钟。把每一项变成一个 GitHub issue + `help wanted`，是低成本的社区入口。

### P2 — 覆盖三个空位

一旦数字真实 + 能被发现，独占「生物年龄 / 长寿证据 / N-of-1 自我实验」。3,727 个 DSH 插件里这三个维度**都是空的**；而在整个数字健康开源界，竞品都停在「引擎/工具」层，没有人做「会员界面 + 出处可审计 + 守则」。

### P2 — Tycho 联动叙事

「LongPi 说候选，Tycho 说这个人」——如果这条边界能跑通并写清楚，它本身就是一篇值得被 star 的文章（agent 之间如何分工而不互相污染结论）。

---

## 5. 路线图

| 阶段 | 内容 | 状态 |
|---|---|---|
| R1 | PhenoAge 引擎 + 黄金测试 + 拒绝语义 + 综合年龄 + 4 工具 + 面板 9 项 + GUI 出处行 + Tycho 接线文档 | ✅ 本轮完成 |
| R2 | 提 awesome PR；加 `npm run bioage` 复算 CLI；README hero 换成真实截图/GIF | 下一步 |
| R3 | pyaging / BioLearn 子进程桥（`import` 许可已确认可用；缺失时降级为「只跑了 PhenoAge」）；甲基化时钟结果以 `measured` 层回填 | 待排 |
| R4 | HAGR 数据打包（DrugAge / GenAge / CellAge / LongevityMap CSV + 署名 + 校验和）。⚠️ 先解决条款：其许可页只写「在若干条件下可自由使用」，完整法律条款未逐条确认 | 待排（有前置） |
| R4b | 对齐既有接口惯例：`199-mcp/mcp-phenoage-clock` 的 MCP 形状、`gangchen/epiage-skill` 的 skill 打包方式 | 待排 |
| R4c | 把 12 位点面板升级为真正 PRS：接 PGS Catalog 的 PGS000906 / PGS002795（必须声明人群适用性） | 待排 |
| R5 | Tycho 深度联动：LongPi 的候选自动变成 `forecast_append` 预测，窗口到期由 Tycho 结算并回读校准 | 待排 |
| R6 | s2f 收据回读：`s2f batch` 的结果与复现收据进 LongPi 报告，形成「主张 → 运行 → 收据」闭环 | 待排 |

---

## 6. 本轮改了什么

**新增**

- `src/bioage.ts` —— 生物年龄引擎
  - PhenoAge（Levine 2018）：9 项标志物 + Gompertz 回投影，常数独立转录自论文
  - `homeostaticDysregulation()`：马氏距离机制已实现，**无参考队列时返回 `NO_REFERENCE`，不编数**
  - `compositeAge()`：加权综合 + 每维贡献 + `module_source`（engine/demo）
  - 每个结果带 `Provenance`：模型、引用、必需单位、claim ceiling
- `src/bioage-tools.ts` —— 4 个新工具：`compute_biological_age` / `read_bioage_model` / `read_demo_lab_panel` / `compute_composite_age`
- 测试：黄金向量、缺项、单位错、坏年龄、HD 无参考、权重和为 1、工具注册数 = 23

**修改**

- `src/fixture.ts` —— 新增 9 项标志物演示面板；`composite_age` 由 41.2（字面量）改为**引擎计算出的 45.1**；新增 `iage` 由 PhenoAge 派生；FAQ 改为可复算的算术
- `src/routes.ts` —— dashboard API 增加 `bioage` 出处字段
- `src/client/dashboard.ts` + `styles.ts` —— 出处行 + 模块来源角标 + 数值格式化（原来会渲染 15 位小数）
- `cordis.patch.yml` —— Tycho MCP 接线块（默认注释）+ 职责边界说明
- `README.md` / `README.zh.md` —— 工具数 19 → 23；新增「一个能站得住的声明」审审计表；新增三段系统边界表；修正 41.2 → 45.1

**未做（诚实清单）**

- 版本号仍是 1.0.1，但功能已超出——`package.json` 与 `src/s2f/report.ts` 的 `PRODUCT_VERSION` 是两处独立来源，**应该改成单一来源**再发版
- 甲基化/KDM 时钟未实现（原因见模型卡）
- 未提 awesome PR
- 未做真实截图/GIF
- 吸收清单的 slug / 星数 / 许可已全部核对（2026-09-17）；但 HAGR 的完整法律条款、ITP 的确切数据地址、Geroprotectors.org 是否有仓库，仍是**未证实**项，文档里已逐条标注
- `src/s2f/evidence.ts` 里的死链与重定向已修（BioLearn 404、pyaging 301、Open Targets 旧域名），并给每条加了 `license` / `integration` / `warning_zh`
- 环境注意：本机构建必须用 Node 22（`/opt/homebrew/opt/node@22/bin/node`）；系统默认 Node 20 会让 `rolldown` 的 arm64 原生绑定加载失败。这不是代码问题，但会拦住第一次 clone 的人，值得在 README 里写一句。
