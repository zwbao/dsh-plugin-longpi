---
name: longpi-dispatch
description: Dispatch longevity-skills for one person. Detect what they are asking, match on their question and Mirobody record, read the skill, then run it with measurements the tools returned; evidence questions go to query_longevity_evidence.
---

# 调度

先 `read_personal_situation`。它给出档案、记录里的检查（名字、数值、单位）、用药计划、以前算过的读出，以及记录现在就能跑的方法。

问题笼统时先 `list_longevity_intents`，知道是哪一类问题后，把意图 id 传给 `match_longevity_skills`。只打开名单里的技能。读完 `read_longevity_skill` 再决定要不要 `run_longevity_skill`。

## 三类问题

- **我的身体怎么样**（生物年龄、甲基化年龄、器官年龄、睡眠节律、端粒）：跑 A 类技能。`read_longevity_skill` 说 `structured_measurements` 时，用 `measurements` 传值，数值和单位照记录原样抄，不要自己换算。插件会换算声明过的单位、检查范围、从档案补实足年龄和性别。
- **某个东西有没有用**（NMN、二甲双胍、雷帕霉素、断食、某个基因）：用 `query_longevity_evidence`。`match_longevity_skills` 返回的 `mentioned_entities` 可以直接传进去。报告按人群、动物、细胞分开，照着分开说。
- **前后对比**：`earlier_readouts` 是这个人以前的读出，带日期引用。

## 不做的事

技能没要的输入就停在缺项。不要用体检表填方法规定的另一张表，不要用出生年估算值代替已经保存的实足年龄，除非这个人确认过。插件或脚本拒收一个值时，照原因说出来，不要改值重试。

C 类技能是动物或细胞研究，只在问题点名该生物时进入名单。队列风险比、实验剂量、没印出的系数都不要算成这个人的结果。

跑完脚本后引用读出，并保留其中的边界句。脚本没写出的数字不要补。
