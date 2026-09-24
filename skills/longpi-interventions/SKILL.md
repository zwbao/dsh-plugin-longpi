---
name: longpi-interventions
description: Help the person pick what to improve, save their own intervention plan after they confirm a read-back, record check-ins and self measurements, judge each item against their record (noise band, retest timing, adherence, confounders), remind retests on the dates the tools give, and show model estimates for their goals. No medicine or dose advice.
---

# 干预方案

方案是这个人自己的（或医生、长寿师给的），插件只负责保存、跟踪和对照检查结果。不替对方制定方案，不加项，不给剂量。

## 从第一个结果到方案

给出第一个结果后问“想先改善哪一项？”。对方说出自己的方案或上传方案文档后：

1. 整理成条目：类别、名称、开始日期（YYYY-MM-DD，没有就问）、针对的指标、方案里写明的目标值。手环能记录的项目（步数、睡眠）给 `target`，指标名用 `read_personal_situation` 里 Mirobody 的名字。
2. 先调 `save_intervention_plan`，`confirm` 为 false，把 `read_back` 和 `warnings` 原样读给对方听。
3. 对方确认后，再用同样的内容调一次，`confirm` 为 true。以后调整一次只改一项，存成新版本。

药物和补剂只按名字保存，剂量和服用打卡在 Mirobody 的用药计划里。方案文档里的剂量不保存，也不要复述成建议。

## 每天

手环记录的项目自动计数。其他项目对方说一句（“今天快走了 40 分钟”）或在健康页点「今天完成了」，用 `log_intervention_checkin` 记下；生病、出差、换了检测机构、压力大给对应的 tag。自己量的腰围、家庭血压、体重用 `save_self_measurement`；家庭血压按最近 7 天的平均判断，多量几天比量一次可靠。

## 复测与判断

复测只按 `review_interventions` 给出的日期建议（健康页的提醒和日历用的是同一批日期）。用 `review_interventions` 判断，按它的 `how_to_read` 解读：

- **有效**：变化超出这个人自身的正常波动，方向是好的，复测时间够，方案也执行了。可以为对方高兴。
- **波动内**：还在正常波动范围内，既不算进步也不算失败，解释清楚并鼓励坚持。
- **反向**：超出波动但方向不好。建议复查确认，并和医生讨论。
- **无法判断**：没有基线、复测太早、执行率太低、CRP 超过 10 mg/L，或缺少变异数据。要说清是哪一种。

同期还有别的干预或用药变化时，只能评价组合。`expected` 是人群平均，不是对这个人的预测。下一步只从 `suggestions` 里选。

## 模型估计

`model_intervention_goals` 和 `review_interventions` 里的 `models` 是模型估计：表型年龄和 10 年死亡风险来自表型年龄技能，心血管风险来自 China-PAR。引用时说“模型估计”，照抄 `boundary_zh`。不要说“你会多活 X 年”。
