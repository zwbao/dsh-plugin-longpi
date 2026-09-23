---
name: longpi-board
description: Read the personal longevity board. Profile, Mirobody status, runnable methods, earlier readouts, and the last skill receipts are local. The chart stays on the Mirobody server.
---

# 看板

看板显示称呼、实足年龄、技能库版本、Mirobody 是否接上，记录里已经有的检查名和用药计划，记录现在就能跑的方法，差一两项就能跑的方法（写明缺什么），以及以前算过的读出。

`estimated_age` 只是出生年减今年，不是送进技能的年龄。技能用 `profile.age`。年龄空着就说还没有实足年龄。

记录状态不是 ok 时，不要编造检查或用药。用药计划不是已经服下的证据。基因型不在看板里，要查就用 `query_genetic_data` 点名 rsID。

最近读出只存在这台机器的数据目录里。引用时带上日期和技能名。
