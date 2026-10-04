# 方法库里的错误（长寿图鉴审核时发现）

写卡和审核时发现 39 处方法库（longevity-skills）的 `evidence`、`species`、`summary_zh`、年份或 claims.md 与论文不一致。图鉴按审核后的内容文件显示（docs/codex-design.md §4），这些需要回方法库修。

| 技能 | 问题 |
| --- | --- |
| `accelerated-biological-aging-risk` | 技能名和 SKILL.md 讲的是 Gao 等 2023（抑郁焦虑与生物年龄），paper 块却是 Levine 等 2018；summary_zh 只写了九项化验的表型年龄，没提这篇的主结果是据此训练的甲基化指标，还夹带面向用户的免责句和内部用语。 |
| `ageing-inflammatory-marker` | skill.json 的 species 只写 human、evidence 写 cross_sectional，但主结论（吸钙随年龄下降、吸钙变弱放大炎症）来自小鼠巨噬细胞实验，应为 animal，species 应加 mouse。 |
| `ampk-gamma1-refeeding-longevity` | skill.json 的 evidence 写 cross_sectional，但主结论来自绿松石鳉实验，应为动物；summary_zh 和 claims.md 写「青鳉鱼」，论文用的是绿松石鳉（Nothobranchius furzeri）。 |
| `blood-metabolome-brain-health` | skill.json 的 evidence 写 cohort，但论文的主分析是在鹿特丹队列里做的横断面比较（摘要写 cross-sectionally）。 |
| `butterfly-longevity-slowed-ageing` | skill.json summary_zh 写「补充花粉并不能单独解释全部差异」，claims.md 里的实验是剥夺花粉（H. hecale 的 α 变为 1.98 倍、β 不变），不是补充花粉。 |
| `calerie-methylation-clocks` | evidence 写的是 rct，但甲基化时钟的结果是随机试验血样的事后分析（论文摘要原文 post hoc analysis），应按紫色人群研究处理。 |
| `cd38-ovarian-aging` | 年份不一致：skill.json 写 2023（网络首发 2023-12-21），claims.md 写 Nature Aging 4:110–128（2024）；summary_zh 第一句没写明器官比较是在小鼠里做的。 |
| `cell-type-polygenic-regulome` | 年份不一致：skill.json 写 2025（网络首发 2025-12-17），claims.md 和 SKILL.md 写 Nature Aging 2026（2026 年 1 月卷期）。 |
| `centenarian-longevity-genes` | claims.md 只写「LGP 对照 147 人」，论文表 1 的对照还包括 LonGenity 队列的 273 人（共 420 人），对照人数不完整。 |
| `china-par-ascvd-risk` | summary_zh 写「用中国四个队列的 2 万多名成人建立」，但 contract.md 记录推导队列只有 InterASIA 和 China MUCA 1998 两个，另两个队列用于验证；这项技能也没有 references/claims.md。 |
| `circadian-nad-meibomian-aging` | claims.md 没有记录利益冲突：论文声明三位作者就 NMN、NR 新用途申请专利（WO2020262497），两位是 Senju 制药员工，三位获该公司资助；而本文的干预正是 NMN、NR 滴眼。 |
| `cpic-pharmacogenomics` | skill.json 的 evidence 写作 database，这篇论文本身是用德尔菲法做的专家共识（PubMed 类型为 Consensus Statement）。 |
| `dissecting-genetic-proteomic-risk` | SKILL.md 写 Raptis et al. 2026，论文 2025 年 11 月在线发表，skill.json 的 2025 是对的。 |
| `elastin-fragments-innate-aging` | skill.json 的 evidence 写成 cohort，但缩短寿命、激活免疫和抑制剂延长寿命这些主结论来自小鼠实验，1068 人的队列只提供碎片随年龄升高的关联。 |
| `fasting-mimicking-diet` | evidence 写的是 rct，但生物年龄结果是两项试验血样的二次分析（试验前后比较、只算完成者），应为紫色人群研究；summary_zh 里的「一种临床生物年龄指标」应写明是七项指标的 Klemera-Doubal 生物年龄。 |
| `foxo-oser1-oxidative-lifespan` | skill.json 的 evidence 写作 case_control，但主结论（寿命延长）来自家蚕、线虫和果蝇实验，人群部分只是 OSER1 变异与长寿的关联，应按动物实验归类。 |
| `gompertz-celegans-decrepitude` | skill.json paper.authors 写「Zhang 等」，这篇只有两位作者（claims.md 写「Zhang 与 Gems」，Crossref 同）。 |
| `hsc-inflammatory-memory` | skill.json 的 species 只写 human、evidence 写 cross_sectional，但主结论来自把人造血干细胞移植到小鼠后做的炎症—恢复实验（论文摘要：xenograft inflammation–recovery models），应为 animal，species 应加 mouse。 |
| `human-longevity-progress-review` | skill.json 的 evidence 写作 review，summary_zh 也称它为「综述」，但这是用西欧 450 个地区死亡数据做的原创研究（PubMed 类型为 research-article）。 |
| `human-ovarian-aging-multiomics` | 年份不一致：skill.json 写 2024（网络首发 2024-11-22），claims.md 写 Nature Aging 5:275–290（2025）。 |
| `imaging-organ-aging-clock` | summary_zh 只写了仓库克隆不到和截距没印出，没有概括研究发现（器官年龄差与相应器官的疾病和死亡有关）。 |
| `immune-aging-clock-runx1` | skill.json 的 evidence 写 cohort，论文是 230 人血样建时钟的横断面建模研究，宜为 cross_sectional（颜色同为紫）。 |
| `mammal-cancer-risk-lifespan` | claims.md 写「黑斑羚 196 只…没有癌症」，论文原文是 blackbuck（Antilope cervicapra，印度黑羚）；黑斑羚是 impala，另一个物种。 |
| `mitophagy-inducers-alzheimers` | skill.json 的 evidence 写 in_vitro，但论文标题和摘要的主结论（改善记忆、减轻病变）来自阿尔茨海默病模型线虫和小鼠；claims.md 只记了线虫的记忆结果，小鼠的记忆改善见论文摘要（nematode and rodent models）和 summary_zh。 |
| `mtdna-copy-number-heteroplasmy` | 核基因位点的个数前后说法不一：摘要写 92 个核位点，正文和 claims.md 写 92 个独立信号、分布在 46 个位点；卡片只写「许多」，claims.md 宜注明这一差别。 |
| `naked-mole-queen-methylation-clock` | 技能元数据的年份写 2021，但论文属 Nature Aging 2022 年第 2 卷（2021 年 12 月 23 日在线发表），SKILL.md 和 claims.md 也写 2022；出处年份应统一。 |
| `neurogenic-aging-clocks` | skill.json 的 year 写 2022（2022 年 12 月在线发表），claims.md 和 SKILL.md 写 2023（卷期年份），两处不一致。 |
| `paracrine-senescence-inflammation` | skill.json 的 species 没有 mouse，但论文里清除衰老细胞药物见效的动物实验是在感染的小鼠里做的（仓鼠里没有见效）。 |
| `plasma-protein-risk-score` | claims.md 没有记录利益冲突：论文声明作者 J.A.K. 是维护和开发 FRAX 的 Osteoporosis Research 的董事，而 FRAX 是本文的对照工具。 |
| `plasma-proteome-future-dementia` | summary_zh 写这四种蛋白与痴呆「关联最强」，claims.md 依据正文写的是「关联最一致」。 |
| `ras-titration-senescent-state` | skill.json 的 evidence 写 in_vitro，但一句话里的主结论（被免疫清除还是长出肿瘤）来自小鼠肝脏实验，应为 animal。 |
| `selective-senolytic-platform` | skill.json 的 evidence 写 in_vitro，但论文主结论包括小鼠体内的选择性清除，应为动物；另外 skill.json 年份写 2024（2024 年 12 月在线发表），SKILL.md 和 claims.md 写 2025（2025 年 1 月刊）。 |
| `semaglutide-epigenetic-aging-trial` | evidence 写的是 rct，但表观遗传年龄不是预设终点（claims.md 原话），结果属随机试验的事后探索分析，应为紫色人群研究。 |
| `sex-specific-immune-aging` | skill.json 的 evidence 写 cohort，论文实为汇总多个公开数据集的横断面比较（cross_sectional），颜色同为紫。 |
| `spatial-mapping-senolytic-targeting` | claims.md 写「尤其是穹窿」，论文摘要写的是 fimbria（海马伞）；清除衰老细胞后的减少主要在雌性小鼠里报告（正文：雄鼠的转录变化更不一致），claims.md 没有记下这一限定。 |
| `testis-transcriptomic-atlas-lifespan` | 技能输出把「年龄大于 45 岁并且体质指数至少 30」合成一个切点，但论文图 6c 是年龄（尤其 45 岁以上）和体质指数（30 以上）分别建模，各自是生育力下降的潜在风险因素。 |
| `time-seq-dna-methylation` | summary_zh 只写了计算步骤，没写研究发现；evidence 写 cohort、species 只写 human，但这篇方法论文的大部分实验在小鼠里做，人血时钟只是其中一部分。 |
| `trigonelline-nad-precursor-muscle` | skill.json 的 evidence 写 case_control、species 只列人和细胞系，但补充效果来自线虫和小鼠实验；按补充效果这一主结论应为动物。 |
| `ulk1-autophagy-alzheimers` | skill.json 的 species 只写 human 和 cell_line，论文还用了阿尔茨海默病模型小鼠和线虫。 |
