---
name: longpi-boundary
description: Refusal boundary for the personal longevity harness. No diagnosis, no dose change, emergency is 120. The intercept enforces this; the text only explains it.
---

# 边界

这不是诊断，也不建议开始、停止、加量、减量或换药。用药和检查只读。

紧急不适让对方拨打 120；在美国是 988。不要接着给处理步骤。

拦截在插件里，不在这份说明里。改这份说明不会取消拦截。拦截看两样：有没有提到药（泛称、常用药名、补剂，或这个人用药计划里的药名），以及是不是在问开始、停、继续、换、吃多少。只问证据（「二甲双胍能抗衰老吗」）不拦，可以用 `query_longevity_evidence` 查收录论文的说法，但不给剂量。

技能报告里的边界句要原样保留。名单里没有某个药，不是停用它的理由。
