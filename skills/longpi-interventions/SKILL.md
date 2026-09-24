---
name: longpi-interventions
description: Save the person's own intervention plan after they confirm a read-back, record check-ins, judge each item against their record (noise band, retest timing, adherence, confounders), and show model estimates for their goals. No medicine or dose advice.
---

# 干预方案

方案是这个人自己的（或医生、长寿师给的），插件只负责保存、跟踪和对照检查结果。不替对方制定方案，不加项，不给剂量。

## 保存方案：先读回，再确认

1. 这个人说出方案，或分享方案文档后，整理成条目：类别、名称、开始日期（YYYY-MM-DD，没有就问）、针对的指标（hs-CRP、空腹血糖、LDL-C、血压……）、方案里写明的目标值。手环能记录的项目（步数、睡眠）给 `target`，指标名用 `read_personal_situation` 里 Mirobody 的名字。
2. 先调 `save_intervention_plan`，`confirm` 为 false。把返回的 `read_back` 和 `warnings` 原样读给对方听。
3. 对方确认后，再用同样的内容调一次，`confirm` 为 true。

药物和补剂只按名字保存。剂量、服用计划和服用打卡都在 Mirobody 的用药计划里，这里只读。方案文档里写的剂量不保存，也不要复述成建议。

## 打卡

对方说“今天快走了 40 分钟”“这周晚饭都按地中海饮食”时，用 `log_intervention_checkin` 记下。生病、出差、换了检测机构、压力大，给对应的 tag，这些会影响检查结果的判断。药物和补剂的服用请对方在 Mirobody 里打卡。

## 判断效果

用 `review_interventions`。按它的 `how_to_read` 解读：

- **有效**：变化超出这个人自身的正常波动（参考变化值），方向是好的，复测时间够，方案也执行了。
- **波动内**：变化还在正常波动范围内，既不算进步也不算失败。
- **反向**：超出波动，但方向不好。建议复查并和医生讨论。
- **无法判断**：没有基线、复测太早、执行率太低、CRP 超过 10 mg/L，或缺少变异数据。要说清是哪一种。

同期还有别的干预或用药变化时，只能评价组合，要照实说。`expected` 是试验组相对对照组的平均差值，是人群平均，不是对这个人的预测。

下一步只从 `suggestions` 里选：补执行、按时复测、补测缺的指标、一次只改一项、和医生或长寿师讨论效果不好的项目。

## 模型估计

`model_intervention_goals` 和 `review_interventions` 里的 `models` 是模型估计：表型年龄（PhenoAge）和 10 年死亡风险来自表型年龄技能，心血管风险来自 China-PAR（系数校验通过后才显示数值）。引用时说“模型估计”，照抄 `boundary_zh`。不要说“你会多活 X 年”，也不要把模型里的差值说成保证。
