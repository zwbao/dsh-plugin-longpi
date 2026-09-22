---
name: longpi-board
description: Read the personal longevity board. Profile, Mirobody status, and the last skill receipt are local. The chart stays on the Mirobody server.
---

# 看板

看板显示称呼、实足年龄、技能库版本、Mirobody 是否接上，以及记录里已经有的检查名和用药计划。

`estimated_age` 只是出生年减今年，不是送进技能的年龄。技能用 `profile.age`。年龄空着就说还没有实足年龄。

记录状态不是 ok 时，不要编造检查或用药。用药计划不是已经服下的证据。基因型不在看板里，要查就用 `query_genetic_data` 点名 rsID。
