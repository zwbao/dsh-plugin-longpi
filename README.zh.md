# LongPi · DeepSeek Harness 长寿管家

[![license](https://img.shields.io/badge/license-MIT-2D5F5A.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522.19-brightgreen.svg)](package.json)
![dsh](https://img.shields.io/badge/DeepSeek%20Harness-0.1.5--rc-8A63D2)
![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-111)

**1.1.0 正式版**，不是 MVP 切片。

[DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness) 上的 **长寿管家**：综合生物年龄 Dashboard、五维表型、带医学守则的对话、发布会当日行程 —— 一个可 `dsh plugin add` 的 bundle。

[English](README.md) · [用途边界](docs/intended-use.md) · [安全](SECURITY.md)

<p align="center">
  <img src="assets/hero.svg" alt="LongPi Dashboard：综合生物年龄 45.1，实际年龄 45，五维模块与雷达" width="920" />
</p>

Awesome 列表里还没有第二个插件做这件事。临床文书请用 [dsh-medseek](https://github.com/Mr-Neutr0n/dsh-medseek)。LongPi 面向 **会员 / Concierge / 长寿之旅团**：看见数字、问为什么、带走下一步、必要时交给真人。助手只解释，不开药。

**不是医疗器械。** 内置指标全部属于合成客户「张明远（演示）」。

## 一个能站得住的声明

健康类插件最容易翻车的地方是：屏幕上出现一个数字，没人说得出它从哪来。LongPi 的卖点是 **每个数字要么能从这个仓库复算出来，要么被明确标成演示输入**。

头条数字是算出来的，不是写死的：

```sh
npm test   # 输出 smoke ok { version: '1.1.0', ... }
```

`test/smoke.mjs` 用九项标志物的演示面板重算已发表的 PhenoAge 模型（Levine 2018），断言引擎落在 `52.52920526313869` 岁。任何一个系数、单位或 Gompertz 回投影被改动，测试立刻失败。这个值加上五维权重，得出综合年龄 **45.1**（实足 **45**）。

| 头条数字的组成 | 来源 | 可审计？ |
|---|---|---|
| 生物学维年龄 | PhenoAge 引擎，9 项血液指标 | ✅ 公式与常数在 `src/bioage.ts`，黄金测试锁死 |
| 其余四维年龄 | 固定演示输入 | ⚠️ 每个 payload 标 `demo`，GUI 上单独标出 |
| 综合年龄 | 公开权重，返回每项贡献 | ✅ `compositeAge()` 返回每维贡献值 |
| 稳态失调（HD） | 到年轻健康参考队列的马氏距离 | ⚠️ **没有真实参考队列就不算**，引擎拒绝而非编一个 |
| KDM / Horvath / GrimAge / DunedinPACE | 未实现 | ⚠️ 在 `read_bioage_model` 里列明原因，不静默省略 |

引擎宁可拒绝也不猜：缺一项标志物、把 `mg/dL` 的值填进 `mmol/L` 的槽、或年龄不合生理，都会返回带期望单位的类型化失败。

## 为什么能做成大健康方向 star 第一

[awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) 里 UI、记忆、计费极密，**长寿 / 生物年龄 / 表型** 是空的。严肃的健康向 bundle 目前是 MedSeek（SOAP/SBAR + FDA/PubMed）。LongPi 不跟它抢临床文书，而是补上缺失的会员产品：

| | LongPi | MedSeek |
|---|---|---|
| 给谁 | 会员、顾问、发布会团员 | 医师 / 护师 |
| North Star | 综合生物年龄 + 五模块 | 结构化病历草稿 |
| 网络 | 可选 Tycho 孪生 + s2f 路由 | 白名单 FDA / PubMed |
| 守则 | 不诊断、不改药、紧急 120 | PHI 出境筛查 + 引用 |
| GUI | Dashboard 页、雷达、出处行、建议提问 | 主题 + 设置 + 检索卡 |

Star 来自：品类空位、一行安装、数字真实的截图、`dsh-plugin` topic。本仓库按这个门槛写。

## 安装

```sh
dsh plugin --profile web add github:zwbao/dsh-plugin-longpi
dsh web
```

本地 checkout：

```sh
npm install && npm test
dsh plugin --profile web add "$PWD"
dsh --profile web --dump-config   # 应出现 "# == dsh-plugin-longpi"
```

重启 GUI。新开会话，顶栏切到 **LongPi**。卸载：`dsh plugin --profile web remove dsh-plugin-longpi`。

## 你会看到什么

| 表面 | 内容 |
|---|---|
| 会话页 **LongPi** | 综合年龄、相对实际年龄的 Δ、五维雷达、指标芯片、洞察、10/24 行程 |
| 输入区上方 | 建议提问（复制后粘贴进 Chat） |
| 侧栏 | LongPi 圆点 |
| 人设 | 健康助手，不是编程 agent |
| 工具 23 个 | 与源码一致（8 个 concierge + 4 个生物年龄 + 11 个基因组/组学/s2f） |
| Skill 6 个 | 表型 / 指标 / 行程 / 基因组 / 多组学 / s2f 路由 |

### 工具（23）

| 工具 | 做什么 | 写入 |
|---|---|---|
| `read_dashboard` | 综合年龄与五模块 | 否 |
| `read_phenotype` | 单个表型模块 | 否 |
| `explain_metric` | 单个演示指标 | 否 |
| `list_insights` | 已审核洞察 | 否 |
| `get_event_briefing` | 2026-10-24 行程 | 否 |
| `search_faq` | FAQ / 术语 | 否 |
| `create_appointment_request` | 预约意向（每进程最多 1） | 是 |
| `handoff_concierge` | 转真人（每进程最多 1） | 是 |
| `compute_biological_age` | 由 9 项标志物算 PhenoAge；缺项或单位错就拒绝 | 否 |
| `read_bioage_model` | 模型卡：引用、必需单位、claim ceiling、以及**没有**实现什么 | 否 |
| `read_demo_lab_panel` | 合成九项面板及它算出的年龄 | 否 |
| `compute_composite_age` | 加权综合年龄 + 每维贡献 | 否 |
| `s2f_route` | 把基因组问题路由到 s2f-agent skill | 否 |
| `s2f_plan` | 生成 dry-run 执行计划（不跑 GPU） | 否 |
| `s2f_execute` | 可选：优先调 s2f-penguin `s2f route` | 否 |
| `s2f_batch_request` | 生成去标识的 `s2f batch` JSON | 否 |
| `read_personal_genome` | 12 位点长寿面板 | 否 |
| `ingest_vcf` | 摄入本地 VCF SNP（hg38，上限可配） | 是（进程内） |
| `annotate_variant` | 变异注释 + 文献 + s2f 推荐 | 否 |
| `annotate_multiomics` | 五层组学 | 否 |
| `build_omics_report` | 1.1.0 表型+基因组+组学正式报告 | 否 |
| `export_report` | JSON / Markdown 导出 | 否 |
| `lookup_longevity_evidence` | 精选抗衰索引，每行带已核对的许可与使用方式 | 否 |

斜杠命令：`/longpi` 打印摘要。

## 30 秒体验

1. 安装并重启，打开 LongPi 页，应看到 **45.1**，下方出处行写明哪一维是引擎算的、哪几维是演示输入。
2. Chat 问「我的 hs-CRP 高吗？」——应引用演示值 **4.2 mg/L**。
3. 问「10 月 24 日怎么走？」——走 `get_event_briefing`。
4. 说「帮我把药减掉」——守则拒绝，引导 Concierge。

数字必须来自工具或演示 `customer_block`。编造化验值算 bug。

### 基因组 / s2f

问「我的 FOXO3？」应调用 `annotate_variant`。问「用 AlphaGenome 打分」应调用 `s2f_route` / `s2f_plan`，并说明 **DSH 不跑 GPU**。`lookup_longevity_evidence` 是人工精选索引（BioAge、pyaging、BioLearn、HAGR、ClinVar、gnomAD 等），**不是** GitHub 抗衰仓库全量；每行都标注 `license` 与 `integration`（import / process / cite / unknown），copyleft 项目永远不会被标成可直接依赖——这条由 smoke 测试断言。

## 安全模型

| 层 | 机制 |
|---|---|
| 横幅 | 常驻「演示数据 · 非个人病历」 |
| 人设 | 禁止诊断 / 患有 / 治愈；禁止改剂量 |
| `agent/pre-step` | 紧急 → 120；改药意图 → 拒绝 |
| 写入上限 | 预约 1、转接 1 |
| 网络 | 仅本机 Dashboard API；工具不 `fetch` |
| 宁拒绝不猜 | 缺项 → `MISSING_INPUT`；单位不合理 → `OUT_OF_RANGE`；无参考队列 → `NO_REFERENCE` |
| 出处 | 每个引擎结果带模型、引用、单位、claim ceiling；GUI 区分「引擎计算」与「演示输入」 |
| 许可诚实 | `lookup_longevity_evidence` 逐行标注 import / process / cite / unknown；copyleft 不得标为可直接依赖（有测试锁住） |

## 边界：LongPi 在哪里停，把什么交出去

LongPi 是三段系统里刻意做薄的那一段。它持有会员界面与**最前沿**证据，不重实现那些已经存在、且比本仓写得更好的数据库与纵向统计。

| 层 | 归属 | 持有什么 | LongPi 怎么对接 |
|---|---|---|---|
| 会员界面 + 前沿证据 | **LongPi**（本仓） | 生物年龄计算、九项面板、基因组/组学注释、s2f 路由、守则、GUI | — |
| 序列到功能的断言 | [s2f-penguin](https://github.com/zwbao/s2f-penguin) / [s2f-agent](https://github.com/JiaqiLi1024/s2f-agent) | 变异效应模型适配器、claim ceiling、运行收据 | `s2f_route` / `s2f_plan` / `s2f_batch_request` 产出去标识契约；执行留在那个仓库。DSH 不跑 GPU 推理。 |
| 这个人的长期数据 | **Tycho Engine**（本机，MCP） | 哈希链账本、孪生化验/基因型、预测结算与校准、N-of-1 序贯分析、安全门、筛查闭环 | `cordis.patch.yml` 里一行 `@deepseek-ai/dsh-mcp-client`（随包提供，默认注释）。工具以 `mcp__tycho__*` 出现。 |

边界规则：**LongPi 提出带 claim ceiling 的候选；Tycho 判定关于这个个体的事情是否为真。** 表型年龄永远不变成治疗指令，预测在窗口结算前永远不变成结论。

开启孪生：按 `cordis.patch.yml` 末尾注释块的步骤（`tycho paths` → `tycho list-tools` → `tycho serve`）。

## 配置

```yaml
config:
  brandName: 健康助手
  demoBanner: true
  itineraryDate: '2026-10-24'
  s2fHome: ''            # 指向 s2f-penguin checkout，s2f_execute 才会真的调 CLI
  maxVcfVariants: 5000   # VCF 摄入上限
  allowS2fExecute: false # 默认关；打开前确认 s2fHome 已设置
```

## 收录清单（awesome-dsh-plugin）

- [x] `dsh.bundle` + `cordis.patch.yml`
- [x] 可用 `dsh plugin add` 安装
- [x] MIT LICENSE
- [x] README 工具数与源码一致（23，由 smoke 测试断言）
- [x] 仓库打上 GitHub topic **`dsh-plugin`**
- [ ] 向 awesome 列表提 PR，分类建议 **工具与能力** 或 **技能包**

## 许可证

[MIT](LICENSE)。`dsh-plugin` 话题只用于发现，不是 DeepSeek 背书，也不是医疗准入。
