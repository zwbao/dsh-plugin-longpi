---
name: longpi-dispatch
description: Dispatch longevity-skills for one person. Start from the onboarding stage, detect what they are asking, match on their question and Mirobody record, read the skill, then run it with measurements the tools returned; evidence questions go to query_longevity_evidence.
---

# 调度

先 `read_personal_situation`。它给出档案、记录里的检查（名字、数值、单位）、自测记录、用药计划、以前算过的读出、记录现在就能跑的方法，以及 `onboarding`：走到哪一步、下一步、还没回答的档案问题、第一个结果或卡在哪里、下次体检该加测什么。

## 按阶段

- **consent / profile**：先帮对方建档。一条短消息里问年龄和性别，再问六个是否项（现在吸烟、糖尿病、两周内用过降压药、住南方还是北方、城市还是农村、父母或兄弟姐妹有心梗或脑卒中），一句话说明各自解锁什么。“不确定”“不知道”就是未知，不存成“否”。用 `save_personal_profile` 保存，对方说了最关心什么就一并存 `focus`。同意只能本人在健康页点「开始」，没同意时提一次即可。
- **records**：说明怎么连接 Mirobody：在 Mirobody 上传体检报告（PDF 或照片）或连接手环，生成个人 MCP 地址，重新运行安装命令时加上 `--mcp-url`。不要编造记录。
- **first_result 及以后**：不等对方问，先给出表型年龄（有多次体检就说趋势）和 China-PAR 风险，都说“模型估计”并带上正常波动；算不出就说卡在哪里，列出 `addons`。然后问“想先改善哪一项？”，见 `longpi-interventions`。

对方报出自己量的腰围、家庭血压或体重时，用 `save_self_measurement`，单位照对方说的传（斤、尺、寸、英寸会换算），不要替对方估一个值。

## 三类问题

- **我的身体怎么样**（生物年龄、甲基化年龄、器官年龄、睡眠节律、端粒）：跑 A 类技能。`read_longevity_skill` 说 `structured_measurements` 时，用 `measurements` 传值，数值和单位照记录原样抄，不要自己换算。
- **某个东西有没有用**（NMN、二甲双胍、雷帕霉素、断食、某个基因）：用 `query_longevity_evidence`，按人群、动物、细胞分开说。
- **我的方案有没有用、怎么调整**：见 `longpi-interventions`。

问题笼统时先 `list_longevity_intents`，再把意图 id 传给 `match_longevity_skills`。只打开名单里的技能，读完再决定要不要跑。

## 不做的事

技能没要的输入就停在缺项。不要用出生年估算值代替已经保存的实足年龄，除非这个人确认过。插件或脚本拒收一个值时，照原因说出来，不要改值重试。C 类技能是动物或细胞研究，只在问题点名该生物时进入名单。跑完脚本后引用读出，并保留其中的边界句。脚本没写出的数字不要补。
