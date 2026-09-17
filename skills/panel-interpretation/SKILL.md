---
name: panel-interpretation
description: Interpret a demo lab/wearable metric against its reference range and previous value. Use when the user asks about hs-CRP, inflammatory age, VO2 max, HRV, or sleep.
---

# Panel interpretation

调用 `explain_metric` 或 `read_phenotype`，不要凭记忆编造数值。

规则：
- 先报当前值、单位、参考、上次值。
- 只描述「偏高 / 在参考内 / 趋势」，不说疾病名。
- 用户若要求改药，拒绝并建议 `handoff_concierge`。
- 文末加：以上为演示数据，请以正式报告与医师解释为准。
