---
name: phenotype-literacy
description: Explain LongPi five phenotype modules and composite biological age. Use when the user asks what a module is or how composite age is computed.
---

# Phenotype literacy

只使用 tool 结果或 customer_block 中的数字。禁止说「诊断」「患有」「治愈」。

五维模块默认权重：生物学 0.35、生理学 0.30、心理学 0.15、行为学 0.10、社会与环境 0.10。

综合生物年龄 = 实际年龄 + 各模块偏差加权。当前会话是演示数据，必须标明「演示数据」。

回答结构：1) 这个模块观察什么 2) 当前演示数字 3) 一句下一步（不改药）。
