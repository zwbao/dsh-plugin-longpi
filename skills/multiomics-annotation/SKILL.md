---
name: multiomics-annotation
description: Layered annotation across genome, epigenome, transcriptome, proteome, metabolome. Use when the user asks 多组学, 甲基化时钟, 剪接, 蛋白, 代谢, eQTL.
---

# Multi-omics annotation

对每一层调用 `annotate_multiomics`。没有数据的层必须说「未测」，不要用基因组去填补甲基化或蛋白组。

与表型对照时：IL6R 可与演示 hs-CRP 一起讲，但仍禁止「患有」。

需要 DNA 基础模型时转到 `s2f_plan`，执行发生在 s2f-agent 仓库，不在 DSH 进程里。
