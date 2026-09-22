---
name: longpi-dispatch
description: Dispatch longevity-skills for one person. Match on their question and Mirobody record, read the skill, then run its script only with measurements the tools returned.
---

# 调度

先 `read_personal_situation`，再 `match_longevity_skills`。只打开名单里的技能。读完 `read_longevity_skill` 再决定要不要 `run_longevity_skill`。

技能没要的输入就停在缺项。不要用体检表填方法规定的另一张表，不要用出生年估算值代替已经保存的实足年龄，除非这个人确认过。

模式生物的技能只在问题点名该生物时进入名单。队列风险比、实验剂量、没印出的系数都不要算成这个人的结果。

跑完脚本后引用读出，并保留其中的边界句。脚本没写出的数字不要补。
