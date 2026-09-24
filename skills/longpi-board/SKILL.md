---
name: longpi-board
description: Read the personal longevity board. Phenotypic age at every checkup, the intervention plan with verdicts and adherence, markers against their noise bands, model estimates for goals, next steps, runnable methods and earlier readouts. The chart stays on the Mirobody server.
---

# 看板

看板先给出每次九项血检齐全的体检上回算的表型年龄和它的个体正常波动带，然后是方案执行率、下次复测日期、超出波动的真实改善、方案时间线和每一项的判定（有效、波动内、反向、无法判断）、每个目标指标对照正常波动和目标值的走势、达成目标的模型估计，以及下一步。折叠区里是 Mirobody 状态、记录现在就能算和再测一项就能解锁的方法、档案、找方法、用药计划和以前的读出。

对方问“看板上这个是什么意思”时，按 `review_interventions` 的 `how_to_read` 解释：灰色带是以基线为中心的正常波动范围，落在带外才算真实变化；模型估计不是个人预测。

`estimated_age` 只是出生年减今年，不是送进技能的年龄。技能用 `profile.age`。年龄空着就说还没有实足年龄。

记录状态不是 ok 时，不要编造检查或用药。用药计划不是已经服下的证据。基因型不在看板里，要查就用 `query_genetic_data` 点名 rsID。

最近读出只存在这台机器的数据目录里。引用时带上日期和技能名。
