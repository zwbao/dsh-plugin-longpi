# Changelog

## 0.7.0

给使用者

健康页多了「深度分析」：用你的全基因组、甲基化、肠道菌、蛋白组和体检数据，算生物学年龄、各器官状况和以后的疾病风险，针对你提出问题并逐一查证，最后给一份能照着做的方案。点「发起深度分析」会把请求放进对话输入框，发送后在对话里进行，需要你确认的步骤会在对话里问你；页面显示做到了哪一步。做完点「导入结果」，报告、器官体检表和问题看板就出现在这一页；方案先读给你看，你点「接受方案」才保存，方案里要复测的指标会进复测提醒。发起前需要你已同意处理敏感个人信息和数据交给模型服务，并在档案里填好年龄和性别。

English

- M12 deep analysis: run_deep_analysis / import_analysis / read_deep_analysis, /api/longpi/analysis routes and the
  深度分析 tab, over the longevity-analyst skill's la-export/1. Starting needs the skill installed, an adult, the
  pipl_sensitive and data_flow_deepseek consents and age/sex; the member's MCP URL goes to a 0600 file, never into the
  request text. The export is checked like an outside file (schema, size, the report inside the run workspace, its
  hash). The plan is saved with source "analysis" only after the person accepts the read-back. The report is served
  with a CSP that allows no script or network, in a sandboxed iframe.
- Mirobody 1.5.3 schema: query_health_indicators takes keywords/indicators/start/end/view and refuses anything else, so
  every latest and series read was refused. Reads now speak `view`, fall back once for an older server, and a
  care-circle `member` is refused by the server instead of being answered with the account holder's record.
- Installer: LOINC bundle under mirobody/res/loinc/ (Mirobody >= 1.5.1); `--mirobody-native`; `--with-analyst`
  [`--analyst-repo`]; the home cordis patch keeps session-log-deepseek off unless the person wrote a row for it.

Fixed after an independent review (2 P0, 10 P1, 12 P2):
- Start needs longevity-analyst >= 0.7.0 with `la.py export` and `mirobody pull`; the installer clones the release
  tag (`LONGPI_ANALYST_REF`, default v0.7.1). A run that stopped (no progress for 6 h) no longer locks the tab; it can
  be abandoned. A care-circle member is never analysed from the account holder's data.
- 接受方案 carries the run id and the plan's key the person read; a plan that changed since is refused (409).
- Import: the run's own real workspace only (no link out of the analyses root), regular files only (a FIFO would
  block the server), the report read once and hashed from the same bytes, every element's shape checked and unknown
  fields dropped, the result swapped in whole; the stored report has every link, script, form and external load
  removed; items get LongPi ids (check-ins never cross analyses); re-importing keeps an accepted plan accepted.
- Consent: the three tools are held by the consent gate; nothing of the analysis is shown, read or imported while
  pipl_sensitive or data_flow_deepseek is not granted. Deleting the local store removes the run folders.
- The tab shows every error and why starting is blocked; the report frame reloads on a new import.
- Mirobody schema: the old/new choice is kept per server address and switches both ways; raw series page at
  Mirobody 1.5.3's 50-row cap; windows longer than 1800 days are read in pieces (1.5.3 clamps at 43920 h), and a
  clamped window is reported as cut.
- Installer: openssl required and empty secrets replaced; the pid file holds Mirobody's own pid; the address must
  carry a port; git never prompts; a quoted session-log row counts as the person's own.
- The skill's pulls land in the run folder, never in the person's own folder (its files are linked read-only).

## 0.6.3

给使用者

问吃药、补剂、饮食、检查，问身体不舒服，问某个化验结果是什么意思，或者问「我的方案有没有效果」，回答不再压成三小段短话：先直接回答，再把分层的具体建议说全。只有你说「简单说」「一句话」，或者随口问一句闲话时，才会短答。问记录里变了什么、现在进度怎么样、方案的日常安排，仍然分三小段：我看到的、数据说明不了的、下一步。遇到急症，仍然先说急救怎么做。

不管回答多长，下面几件事该有的一定会有：方案效果还在正常波动里、或者复查得太早时，会告诉你最早哪天再复查、离上次隔几周；让你去看医生的，会说清该挂哪个科、多久内去（比如缺铁要消化科一起查、尽量 1 到 2 周内去），并问一句要不要整理一份给医生看的简报；替家里老人问一大堆药能不能停时，会建议带上全部药盒去老年科或药师门诊做用药评估，提醒防跌倒，并把容易引起头晕、跌倒或低血糖的那几种药点名说清楚。

方案读给你听过以后，你说「可以，就按这份方案保存吧」，这一句就算确认：当场保存，DeepSeek Harness 只请你点一次同意，不会再读一遍、也不会再让你打「保存」两个字。

English

Advice questions (a medicine, a supplement, a diet, a test), a symptom, what a result means, and "did my plan work" are answered directly first and then in full, with the tiered specifics; the three short parts and their length budget are gone for these. Only "keep it short" or a one-line small-talk question gets a short reply. Questions about what changed in the record, about progress, and plan chatter keep the three parts (我看到的 / 数据说明不了的 / 下一步). Emergencies still start with first aid.

Whatever the length, three things are there when they apply, and the plugin adds them when a reply leaves them out: the earliest retest date and how many weeks away it is, when a plan result is within normal fluctuation or it is too early to tell; when the reply sends the person to a doctor about a finding in their record, the specialists and the time the doctor line names (the gastroenterologist for iron deficiency, within one to two weeks) and the offer to prepare a one-page doctor brief; and for an older person's list of medicines, a medication review by a pharmacist or the geriatrics clinic with every medicine box, falls prevention, and each named drug that can cause dizziness, falls or low blood sugar.

After a plan has been read to the person, 「可以，就按这份方案保存吧」 is the confirmation: the plan is saved in that turn with one approval in DeepSeek Harness, without a second read-back or a request to type 「保存」.

## 0.6.2

Life-area navigation (总览、化验、睡眠、运动、日程、问 LongPi), movement-first lab cards, a quieter season, and plain Chinese on the screens a person reads. On-device research is the default. Joining a group study is a separate tap, and nothing leaves the device until a production-signed study is published.

给使用者（集成修订）

身体年龄只有一个数：页面、要点和对话说的是同一个数字。只抽过一次血，不写「比周岁小多少」；有两次以上，才用「比周岁小/大 X 岁」这样的说法。记录里如果混着两个人的体检（比如女儿的账号里有父亲的前列腺检查），就不算身体年龄，并说明原因；在档案里写明是哪位家人、今年几岁之后再算。

在吃他汀的人，血脂降下来会写明主要是他汀的作用，不算走路或方案的效果。在用司美格鲁肽这类药（或这段时间就要开始用），方案里不写试验的减重公斤数，也不设体重目标，并说清这段时间体重的变化主要来自药；限时进食照样可以做，但先告诉开药的医生，吃得太少、恶心时先停。没有这类药的人，照常给出试验里的公斤数作为目标参考。

回答先直接回答问的那件事：能不能、吃什么、多少、怎么做，并尽量对上你自己的数字；短不是把这些具体内容删掉的理由。运动时胸口闷痛、歇一会儿好了，也不会说「不用打 120」：当天去看，别自己开车，再发作或几分钟不缓解就立刻打 120。要先看医生时，回答最后会问一句要不要整理一页给医生看的简报。问二甲双胍抗衰老时，回答会对照你自己的化验：血糖正常就没有糖尿病这个用药理由；已经贫血时，它导致的 B12 缺乏会让贫血更复杂。贫血加上铁蛋白低或红细胞偏小时，看医生那句话会写上「缺铁的原因常要消化科一起查，尽量在 1 到 2 周内去」。

总览每件事只说一次：要先去看医生的那一步放在最上面，其余卡片不再重复那几项；身体年龄的几种算法合成一张卡；「判断依据」只留一句大白话和来源；心血管风险卡只显示自己的一个数；窄屏上「值得注意的变化」一行一行排开。

English, integration fixes

Body age is one number: the page, the fact list and the chat quote the same figure. One draw has no gap; two or more draws get 「比周岁小/大 X 岁」. A record that holds two people's checkups (a father's prostate test in a daughter's account) gets no body age, with the reason; naming the relative and their age in the profile lets it be computed.

For someone on a statin, the lipid drop is credited to the statin, not to walking or the plan. While a medicine that moves weight by itself (a GLP-1, SGLT2 or insulin) is current or about to start, the plan gives no trial kilogram figure and no weight goal, and says the weight change will mostly come from the medicine. Time-restricted eating stays possible on a GLP-1, with 「先告诉开药的医生」 and a note on low intake and nausea. People on no such medicine keep the kilogram projection.

A reply answers the question itself first, with the specific foods, amounts, ranges or steps, tied to the person's own numbers; a short reply never drops them. Exertional chest pain that eased is never told 「不用打 120」: be seen today, do not drive there, and call 120 at once if it returns or does not ease within minutes. A doctor-first reply ends by offering the one-page doctor brief. Asked about metformin for ageing, the answer checks the person's own labs: a normal glucose means no diabetes indication, and an existing anaemia is made worse by the B12 deficiency it can cause. With a low haemoglobin plus low ferritin or small red cells, the doctor line adds that the cause of iron deficiency is often looked for by a gastroenterologist too, within one to two weeks.

总览 says each fact once: the doctor step comes first and the other cards leave its values out; the body-age methods fold into one card; 判断依据 is one plain sentence and its source; the risk card shows its own number only; 值得注意的变化 stacks on narrow screens.

## 0.6.1

给使用者

这一季从你自己的重要事实里长出来。贫血相关的记录会变成「查清贫血」：预约血液科或消化科，带上简报，补铁蛋白和铁代谢，8 到 12 周后复查。写得不合法的任务会退回这个模板。复测之后的回看用前后数字，并且按证据分级；只有核对过、而且超出测量波动的变化才庆祝。一次检查不会说你变年轻了。

抽到的方法卡可以立刻用你的记录算，缺什么就写「再补什么才能解锁」。动物和细胞证据先说物种，不当作你的数字。图鉴仍然没有付费，概率公开（铜 52%、银 28%、紫 16%、金 4%），未满 18 岁不开放，稀有度不跟指标走。带着简报去看医生、补检查、复测，仍然至少是一张银卡。

第一季在第一次结果出来之后，或医生这一步已经明确之后，单独一屏邀请你开始，并链到公开概率。没点开始之前，页面上不放浮动的「本季」芯片。标题是健康页里的一枚普通按钮，不盖住内容。成年人可以打开家人圈，分享一张卡或这一季的回看。帮父母看记录时，这一季用的是那位家人的年龄和性别。

模拟研究可以在有人掉线时仍把合计算完。隐私预算用完就拒绝再发。已经发布的合计不能撤回。人数没到发布线时，页面写明还差多少，并请你先做个人对照。个人对照按随机顺序安排，洗脱日照常生活，种子留在这台电脑上。live 仍然关闭。

English, same release

A season grows from the facts that already matter. An anaemia record becomes 「查清贫血」: book haematology or gastroenterology, take the brief, add ferritin and iron studies, and repeat the blood count in 8 to 12 weeks. A draft that fails the checks falls back to that template. The recap after a retest prints the before and after numbers and the grade. A celebration is added only when the noise band is verified and the move is past it. One draw is not "you got younger".

A drawn method card can be run from the record, or it says what is still missing. Animal and cell evidence names the species and is not this person's number. Codex still has no payment. The public odds are 52/28/16/4. Under 18 it stays off. Rarity does not follow a lab. A briefed visit, an added test, or a retest still draws at least a rare card.

The first season invites you once, after a first result or when the doctor step is current, and links to the odds page. Until you opt in, the home has no floating season chip. The title is an ordinary button in the health page and does not cover the content. Adults can open a family circle and share one card or the recap. A parent's record uses that parent's age and sex.

A simulated study can still total the sum when some people drop out. A query past the privacy budget is refused. A result that was already released cannot be withdrawn. Until a study reaches its line, the page shows the count and asks for a personal trial first. That trial is ordered at random, washout days stay ordinary, and the seed stays on this computer. Live stays off.

## 0.6.0

给使用者

安装这一版会装上 dsh、完整的 longevity-skills 方法库，以及 Python 3.12 环境。对话里能打开方法库里的每一个方法。插件不替你挑选、不把方法藏起来、也不用关键词把门关上。它核对单位、范围和来源，把结果标成已核对、绑定未核对或仅证据。甲基化报告里的 PhenoAge 不会被当成血检表型年龄。冠脉钙化积分不会被当成腹主动脉钙化。看医生、急症和用药安全仍然排在方法结果前面。一次检查，或变化还在正常波动里，不会说你变年轻了。

甲基化位点、菌群、蛋白和诊断编码可以留在这台电脑上。确认之后才写入，不送进体检记录，也不把整张表放进对话。

English, same release

Installing this version installs dsh, the whole longevity-skills library, and a Python 3.12 environment. Every method in the library can be opened in chat. The plugin does not pick, hide, or keyword-gate a method. It checks units, ranges, and provenance, and labels a result verified, unverified-binding, or evidence-only. A methylation PhenoAge is not a blood phenotypic age. A coronary calcium score is not abdominal aortic calcium. A doctor step, an emergency, and medicine safety still rank above method results. One draw, or a move inside the noise band, is not "you got younger".

Methylation probes, taxa, protein panels, and diagnosis codes can stay on this computer. They are written only after confirmation, are not sent to the checkup record, and the table is not pasted into the chat.

What landed

- Packaging: `longpi install`, `longpi update`, and `longpi status`. The plugin depends on exact `longevity-skills@2026.39.1`. There is no postinstall. dsh and pnpm stay global CLIs.
- The skill provider lists the whole catalog. Tier C is evidence, with the species in the first line, and is not run as this person's number.
- A binding is checked before a script runs. A pin that does not match the running catalog cannot be labelled verified.
- Methylation, taxa, proteins, and conditions have local stores. A run fed from a store writes only the manifest's keys.
- The fact pack and the page show labeled method results under the existing safety facts. Phenotypic age and China-PAR stay when the record has them.

## 0.5.6

Owner-facing / 给使用者

否定、家族史、过去的事和假设不再被当成正在发生的急症。「父母没有心梗」「没有胸痛」不会叫你打 120；现在胸口剧痛，或身边的人突然嘴歪，仍然先给急救。只有你自己说出已经约了、约好或挂号，并且这句话里有那一天，才会记成已预约。下周一去医院是建议，页头不写日期；说没约那一天，这条就撤掉，之后只重复页上的日期也不会再写回来。已经算对的表型年龄留在回答里，不会被改成铁剂说明。点了开始再刷新，DeepSeek 的同意页还在；没同意之前，健康内容不会发给模型，急症用本机的急救说明回答。性别还没填时，血红蛋白或铁蛋白落在男女下限之间，先问性别，不转血液科；两边都偏低仍然请看医生。

一批指标读到一半被截断时，改成一项一项再读。九项血检齐了，身体年龄可以出现在页上。铁蛋白 8.0 ng/mL 在指标行标为偏低。变化已经超出正常波动时，不再写「多半是测量和生理波动」，「太早」只出现一次，已经做完的复测留在它自己的日期上。档案里已经有 hs-CRP 或腰围，就不再反复要求补这项。没送到 Mirobody 的上传不算看过，同一份可以再发。已经在记录里的 TI-RADS、BI-RADS、超声和总检会出现在档案。有糖尿病时，尿白蛋白/肌酐达到 30 mg/g、尿蛋白、eGFR 低于 60、眼底的微动脉瘤，算值得注意。指尖血糖、瞬感血糖和静脉空腹血糖分开，不混成一条。在对话里记下的药会出现在档案里。记得的体重或脂肪肝目标会写进等就诊期间的草稿。保存方案时核对用药最多等 8 秒。「我没有在备孕」不算怀孕或备孕。明确说不确定的，记成不确定，不记成否。年龄不在 35 到 74 岁时，风险卡写明 China-PAR 是由这个年龄段推导的。

English, same release

A negation, a family history, a past episode, or a hypothetical is not treated as an emergency happening now. 「父母没有心梗」 and 「没有胸痛」 do not call 120. Chest pain now, or a person with them who suddenly cannot speak clearly, still gets first aid. A visit is stored as booked only when your own message says you booked it (约了, 约好, 挂号) and names that day. A proposal such as going to the clinic next Monday stays unconfirmed, with no date on the header. Saying you did not book that day removes it, and a later message that only repeats the date on the page does not put it back. A reply that already states a phenotypic age with a number keeps that sentence. After 开始, a refresh still shows the DeepSeek consent until you grant or decline it. Until then, health text is not sent to the model; an emergency is answered from the local first-aid script. When sex is unknown, haemoglobin or ferritin between the women's and men's lower limits asks for sex and does not refer you to haematology. A value below both limits is still a doctor step.

A history batch that comes back cut is read again, one indicator at a time, so body age can finish once the nine inputs are on file. Ferritin 8.0 ng/mL is marked low on its indicator row. A change past the noise band no longer says it is mostly measurement noise, 「太早」 is printed once, and a completed retest stays on its own date. An hs-CRP or waist already on the record is not asked for again. An upload that did not reach Mirobody is not marked seen, so the same file can be sent again. TI-RADS, BI-RADS, ultrasound text, and the summary already stored in Mirobody show on the record list. For someone with diabetes, urine albumin/creatinine at or above 30 mg/g, urine protein, an eGFR under 60, and a retinal note are flagged. Finger-stick, sensor, and venous fasting glucose stay separate series. A medicine stated in chat shows on the record list. A remembered weight or fatty-liver goal is copied into the while-you-wait draft. Saving a plan waits at most 8 seconds for the medicine list. 「我没有在备孕」 does not set pregnancy or planning. An explicit 不确定 stays unknown and is not stored as no. Outside ages 35–74, the risk card says China-PAR was derived from that age range.

## 0.5.5

Owner-facing / 给使用者

低参与、或说过「别天天提醒我」的人，首页不再出现打卡、每天、每晚、提醒我，这一季的任务也不推，除非自己点「开始这一季」。低血糖时先按 15 克处理；下一次胰岛素或磺脲类的剂量，联系开药的医生，人叫不醒或无法吞咽时拨打 120。不会说「不要再打胰岛素」或「把胰岛素停了」。还没同意处理健康信息时，如果要记一次家庭血压，同一条回复里先给出单独同意，然后把数字记下。备孕（包括准备怀孕、计划要孩子）和哺乳与怀孕一样：方案不安排限时进食或断食，体重指数低于 24 时不设减重目标，酒写避免而不是减少。备孕另有一句中国常规人群指导：叶酸每天 0.4 mg。用药计划里已经是这个剂量时，健康页的草稿同样这么处理。

English, same release

A low-engagement person, or someone who asked not to be reminded every day, does not see daily check-in wording or a season push on the home until they opt in. Hypoglycaemia still starts with the 15 g step. The next insulin or sulfonylurea dose is for the prescribing doctor, or 120 if they will not wake. The reply does not say to stop or skip insulin. A home blood pressure they ask to record before the health-data consent is stored in that turn, and the consent is offered in the same reply. Planning a pregnancy (备孕, 准备怀孕, 计划要孩子) and breastfeeding are treated like pregnancy: no time-restricted eating or fasting, no weight-loss target when BMI is under 24, and alcohol is avoided rather than reduced. Pregnancy planning also states the China population guidance, folic acid 0.4 mg a day. A medication plan that is already that dose gets the same page draft.

## 0.5.4

Owner-facing / 给使用者

这一版把各条功能线合到一起。打开健康页，最重要的事仍然排在最前面。看医生仍然是第一步；等就诊的这几天，可以先走路、把每餐的蔬菜和蛋白质备好、把睡眠稳住，烟酒能少就少。不安排断食、大幅减重、补剂或补铁。身体年龄一句话说明这次能不能叫「年轻了」：一次检查、或变化还在正常波动里，不会说你年轻了。图鉴抽卡的概率写在页面上（铜 52%、银 28%、紫 16%、金 4%），十次没有银或以上，下一次至少是银；看病、加测、复测保证从银起抽。未满 18 岁不抽卡。研究页默认关着，模拟模式可以在本机试。安装时，下载的插件和方法库压缩包要先对上公布的 sha256，才安装。

English, same release

The module lanes are one plugin. The doctor step stays first. While that finding is open, LongPi still offers a short plan you can do while you wait: walking, meal quality, sleep, and less smoking or alcohol. It does not add fasting, a large weight-loss target, a supplement, or iron. The body-age sentence is the graded one: one draw, or a move inside the noise band, is not "you got younger". Codex odds on the page are 52/28/16/4, pity 10 to at least rare, daily cap 3, and a care action redraws from rare up. The doctor brief and a sick-day freeze are not cards you have to draw. Under 18, Codex stays off. The research tab is off unless simulated mode is turned on; live mode still refuses. A downloaded plugin or skills tarball is installed only after its sha256 matches the published checksum.

What landed from each lane

- M2 advice: four tiers, first aid first, a usual range is not a personal dose, a bare refusal is filled in from the table.
- M9 honesty: one series when the same marker was stored under two names; 太早 and 不可比 stay out of 波动内; wearable steps count; China-PAR names the 35–74 range.
- M10a reliability: flaky indicator reads retry, printed flags parse, the same analyte joins, RDW-CV maps onto the code the body-age method lists.
- M10b installer: mainland mirrors, and sha256 before a downloaded tarball is unpacked.
- M7 data in: a report dropped in chat reaches Mirobody; ultrasound grades stay on this computer; login mints the connection; a WeGene PDF is read locally.
- M4 feedback: the grade is fixed in code; the chip and the chat use that sentence; 年轻了 only past the noise band, and the sentence says 模型估计.
- M6 engagement: a season tied to a retest, unlocks named as the one missing test, streak freeze for sick or travel days, Codex with the odds above.
- M11 privacy: two separate unticked consents, the name is not sent, export and delete, Codex off for minors.
- M8 science: simulated studies, a comprehension check, local statistics with noise, nothing raw leaves the computer. Live stays off.

## 0.5.3

The agent core (AA steps 0–2) and triage with a doctor brief (M1): one fact pack under the page and the chat, the most important fact first on both, model-written surfaces held to deterministic checks, per-person memory, and the follow-up after "see a doctor". Plus four 0.5.2 open items. Tests: `test/agent-core.mjs`, `test/surfaces-coach.mjs`, `test/contracts.mjs` (new); `npm test` now runs every test file.

**First screen: the most important fact first (fact pack, step 1)**
- One `FactPack` per person ranks top facts by rule: a doctor-first finding, then medicines and conditions that change what is safe (SGLT2 inhibitor, insulin, sulfonylurea, GLP-1, anticoagulant, pregnancy or planning one, kidney disease), then screening topics and care follow-up.
- The home status, the next step and the suggestions come from it, at any stage after consent (a doctor step no longer waits for the profile to be finished). The owner's record opens with 「血红蛋白 152→138→124 g/L 偏低 … ——请先去看医生（全科或血液科）」; plan prompts are held back while a doctor comes first.
- The chat reads the same state: `read_personal_situation` returns `page`, `top_facts`, `care` and `memory_zh`, and at the first step of each health turn a snapshot of the page (最重要的事（必须先说）…) is added when it changed.
- LongPi's persona and orchestrator rules are added only to agents in the 健康对话 workspace; other sessions get neither the persona nor the write tools (D5). The dead `schedule_create` instruction is gone.

**Model-written surfaces, checked (step 2)**
- A coach (deepseek-flash, effort off) writes the greeting, status, next-step wording and 2–4 suggestions from the fact pack only; the page never waits for it and shows the fact-ranked floor meanwhile. The person's name is never sent (D10); the page adds it.
- Every model card passes a deterministic post-filter: numbers only from the fact pack, no diagnosis, cure, dose or medicine change, no 年轻 without graded evidence, the mandatory step first, the top fact named, exclusions and SGLT2 rules kept, no tool names or English. One repair, then a per-card fallback.
- Daily token caps (200k in / 20k out) fall back silently; `/api/longpi/usage` shows the ledger. The page listens on `/api/longpi/events` and refreshes when the chat changes something.

**Memory**
- `memory.json` keeps goals, exclusions, conditions, medicines, family history, life events and doctor visits across sessions, with who said it. Plan exclusions and medication statements from 0.5.2 are imported. `remember_for_me` (confirmed when the quote is really in the person's message), `read_person_memory`; after a health turn a distiller proposes items from the person's own words, kept unconfirmed (they only add caution) and announced with 我记下了 … 说"撤销"即可取消.

**Doctor first, then the visit (M1)**
- Findings for a doctor (red cells and iron, undiagnosed diabetes-range glucose, very high LDL-C or systolic) say which department, what to ask and what to request. Values below the usual range are called 偏低 on the changes card too.
- A one-page doctor brief: multi-year trend table, medicines and conditions, questions, tests; printable and saved as markdown, the name line left blank (`prepare_doctor_brief`, 医生简报 on the page).
- "约了吗？医生怎么说？": a booking, a visit (with what the doctor said) or a decision not to go is kept (`log_care_visit`, the page's 已预约 / 看完了 / 暂时不去). After the visit date the next step asks how it went; after a visit the plan may go ahead with the doctor's conclusion noted, and treatment (iron, medicines) stays out of the plan.
- Screening topics by age and sex, earlier breast screening and genetic counselling when a mother or sister had breast cancer.

**0.5.2 open items**
- The page's 去掉 is saved on the server (`/api/longpi/plan-draft/exclude`, also in memory), so a removed item stays out after a reload and in chat drafts; 恢复 puts it back.
- With no sex on file, haemoglobin and ferritin use the men's limits (130 g/L, 30 ng/mL), say so, and ask for the sex, so a man with HGB 121–129 is not missed.
- The hypoglycaemia draft hold is per session, not process-wide.
- No salt, DASH or other BP-lowering item for SBP < 130 with no hypertension on record; no alcohol item unless the person said they drink (and why, in the notes).
- Body age from a single blood draw is shown as a model estimate (「单次血检的模型估计，低于实足年龄 X 岁，只作参考」), never as 「比实足年龄年轻」.

## 0.5.2

Safety fixes from a 60-day field test with real-browser diaries (the owner's own checkups, and a woman with type 2 diabetes on metformin and dapagliflozin), plus the data-path fixes found on the way. Every fix has a regression test (`test/plan-safety.mjs` is new); verified live in DeepSeek Harness 0.1.5-rc.3 against Mirobody.

**See a doctor first**
- **No plan while the record needs a doctor.** The plan is not drafted when the record shows one of these: haemoglobin below the lower limit (men 130, women 115 g/L); MCV below 80 fL; haemoglobin or MCV falling across checkups; RDW-CV above 15 %; ferritin below the common lower limit; fasting glucose ≥ 7.0 mmol/L or HbA1c ≥ 6.5 % with no diagnosis or glucose-lowering medicine on record; LDL-C ≥ 4.9 mmol/L; systolic ≥ 180 mmHg.
  - The overview's next step becomes 「请先去看医生：…」 with the person's numbers, dates and the fall across checkups (for example 152 → 138 → 124). The same sentence is the chat reply to 「帮我制定一份改善方案」, and `read_personal_situation` returns it as `doctor_first_zh`.
  - A value below the range is called 偏低 and one above it 偏高. The model is told never to answer 不能评 or 只报数 about it, and still names no cause and suggests no iron, supplement or dose.
  - Mirobody keeps no reference ranges, so these fixed limits are used. 血小板分布宽度 (PDW) and RDW-SD no longer count as RDW-CV.
- A white-cell count that stays within 3.5–9.5 is no longer sent to a doctor just for crossing its tight band.

**Medicines that rule plan items out**
- **SGLT2 inhibitors** (达格列净, 恩格列净 …): no time-restricted eating, fasting or very-low-carb items. The caution names euglycaemic ketoacidosis (正常血糖性酮症酸中毒), what it feels like, and says to ask the prescriber about pausing when eating much less.
- **Insulin or sulfonylureas** (including 消渴丸): exercise, weight, fasting and calorie-restriction items carry a hypoglycaemia caution. A stopped medicine does not count.
- Pregnancy (when stated) removes time-restricted eating, weight loss, alcohol items and fish oil. Stated kidney disease, or an eGFR below 60, removes unmodified DASH. The fish-oil caution (bleeding, atrial fibrillation) is kept, with no amount in it.

**Low blood sugar**
- A reading under 3.9 mmol/L, or tremor or cold sweat with a low reading, is answered first with the standard step: 15 g of fast sugar, recheck in 15 minutes, repeat if still low, and call 120 without feeding anyone who cannot be woken or swallow. If a reply does not open with this step, the guard sends a correction. No plan is drafted in that turn. The 15 g step is not treated as a dose.

**Plan drafts**
- What the person rules out (不要限时进食, 不要低碳) is saved, whether it was passed to the draft tool or only said in chat, and stays out of every later draft and the page draft.
- The draft keeps its date while the record and medicines stay the same. A new day alone no longer re-dates it.
- `draft_intervention_plan` gives a ready `reply_zh`, answers within 60 s even on a cold start, and tells the model to call no other tool in that turn, so the turn no longer hangs. It honours `max_items`.
- A prescription the person asks to remember (请记一下) is saved with `record_medication_statement` and read back. The medication summary shows one current line per drug and never shows `0x/day`.

**Data path (since 0.5.1)**
- A complete catalogue that Mirobody 1.5.0 marks truncated is read as complete. Owner-style names (空腹血葡萄糖, 红细胞分布宽度-变异系数) bind to their inputs. A CRP with no unit is refused.
- Check-ins and reminders use the China civil day. A failed reminder is retried. A damaged profile.json is never replaced with an empty one.
- Home blood pressure is judged on the mean of the daily means. An older lab change is not shown when a newer result's unit cannot be converted. 4 个单位 counts as a medicine amount.
- The guard still catches emergencies and bad replies when the safety model is down. Wearable day buckets with no name count toward adherence.

## 0.5.1

Fixes from an external review of 0.5.0, checked claim by claim against the code, plus a safety judgement made by the model and a reorganised health page. Tested end to end in DeepSeek Harness 0.1.5-rc.3 with real chats.

**Security**
- **Login check on every route.** Every `/api/longpi/*` route now runs DeepSeek Harness's own Host/Origin and login-cookie check (`ctx.connection.requestRejection`). Until now any local program or web page could read and change the profile, plans and follow-up settings without logging in.
  - A route answers 503 when that service is missing; it never falls open.
  - Writes must be `application/json` (415 otherwise).
  - Webhook addresses must be `https` and may not point at this machine, a link-local or metadata address.
- **Mirobody 0.1.1.** The bundled plugin gets the same route check. Its Python bridge now receives a minimal environment instead of every variable, API keys included.

**Safety judgement**
- **Input side.**
  - For each message the person types, the configured model labels it: a current emergency, self-harm, a request to start or stop a medicine, a request for their own dose, or a question about research findings.
  - LongPi appends one note for the model. It never replaces the person's words: the old keyword match turned 无胸痛, 父亲有中风史 or "stroke risk" into "only answer 120".
  - A narrow, negation-aware rule layer is used only when the model call fails.
  - Only where it matters: in LongPi's workspace (健康对话) every message is labelled; in other workspaces only a message that touches health, and the rest of that conversation, so a coding chat pays no extra model call or delay. A recall-first word list decides, holding every word the rule layer acts on: all 124 emergency, self-harm, medicine and dose test sentences pass it, and 20 everyday coding requests do not. `guardScope: all` labels every message, as before.
  - Live results on 266 test sentences with deepseek-v4-flash: emergencies 36/36 with no false alarm, medicine requests 66/66; median 1.2 s.
- **Output side.** Before a turn ends, a reply that gave a dose or told the person to change a prescription gets one correction. The model judge decides; the rules decide alone only when the judge fails. Food amounts (一颗鸡蛋, 两片面包) are not doses unless a medicine is named in the same sentence.
- **Saving a plan.**
  - The person approves the save in DeepSeek Harness.
  - The save only goes through after the plan was read back to them.

**Numbers and records**
- **Failed reads stay visible.** A failed or cut record read is reported as such, never as "not measured" or "no change".
- **Newest value across codes.** Each input takes its newest value across all its LOINC codes. On the same day, the skill's order decides, so fasting glucose and hs-CRP now come first in longevity-skills.
- **China-PAR blood pressure.** Systolic pressure uses the newer of the clinic reading and the home 7-day mean.
- **Phenotypic-age history.** Stored points are recomputed when their inputs change.
- **Plan verdicts.**
  - Values are converted to one unit before comparing.
  - An item aimed at 血压 is judged on systolic and diastolic pressure; before, it had no verdict at all. A draft asked for 血压 aims at both.
  - A zero baseline, a single home reading, or no adherence data at all gives 无法判断.
  - The wording no longer credits a change to a plan item.
- **Doses.** Removed from plan items of every category, including amounts written in Chinese numerals.
- **Check-ins.** A check-in can be ✓, 没做到 or undone.
- **Dense series.** A home blood-pressure or wearable series that fills Mirobody's 500-row page is read again for its older readings, so twice-daily readings get a verdict.
- **Tool results DeepSeek Harness accepts.** A wearable indicator without a LOINC code made `read_personal_situation` fail in real chats; the bug was there since 0.4. Every tool result is now lossless JSON, checked with DSH's own function.

**Health page and chat**
- **Four tabs.** The health page has 概览, 指标, 方案 and 档案.
  - 指标 is new: every checkup and wearable value by group, with its trend and whether it moved beyond normal fluctuation.
- **A LongPi page in DSH settings.** It holds follow-up reminders (one switch, the rest under 更多设置), the Mirobody connection (paste an address, test, save) and privacy.
- **One onboarding.**
  - Step 3 shows what the record holds.
  - Step 4 offers what can be done now.
  - The reminder question moves to plan adoption.
- **Chat cards.** The chat shows cards for a plan draft (adopt or remove items), a plan read-back, a check-in (with 撤销) and a result.
  - A draft item shows what to do once: its category, title and evidence are no longer repeated in the text (no more 证据：，DOI).
  - An adopted draft's card says 已采用 in its head.
- **While chatting.**
  - DSH's right column has a 健康 tab (offered on its guide page): today's check-ins, the two results, the next step and what changed, next to the chat.
  - DSH folds a finished turn's tool cards. A turn that drafted a plan, read one back, saved it or recorded a check-in gets one row of quick actions under it: 采用这份方案, 确认保存 or 还要调整, 撤销, and links to the 健康 tab and the page.
- **Plain names.** The two results are called 身体年龄 and 10 年心血管风险 on every surface: the 方案 tab's model cards, the chat cards and the notes. The model names (表型年龄, Levine 2018; China-PAR) are behind ⓘ; the export for a doctor keeps them.
- **Workspace name.** A new workspace is named 健康对话.

**Versions** stay below 1.0 until declared stable:
- releases 2.0.0–5.0.0 are listed below as 0.2.0–0.5.0;
- the old tags v1.1.0 and v4.2.0 are now v0.1.1 and v0.4.2;
- dsh-plugin-mirobody 1.0.0 is now 0.1.0.

## 0.5.0 (published as 5.0.0)

LongPi becomes a guided journey in the DeepSeek Harness web UI, drafts plans, follows up by itself, and points out real changes in the record.

- **Onboarding** (`settings.onboarding`): four steps — what LongPi does and where data lives (consent, versioned), a profile where every question can be skipped and a skipped answer means unknown, the Mirobody connection with what the first results still need, and the first results with an optional evening check-in reminder.
- **Home** (`conversation.hero.brand.mark`): a greeting replaces DeepSeek Harness's default title, with one sentence on where things stand and a second line when the record has changes beyond normal fluctuation. Under the composer card sits one quiet row: today's check-ins (a tap records them) and the nearest retest while a plan runs, otherwise two suggested questions that go into the composer. The row is placed right under DSH's composer (DSH does not render `conversation.composer.dock` on the blank-session home); text insertion goes through an invisible `conversation.input.dock` bridge.
- **Health page** (sidebar 健康): progress, record changes, phenotypic age and China-PAR, the plan with check-ins and verdicts, profile and self-measurements, follow-up settings and the method library.
- **Journey** (`GET /api/longpi/journey`): stage (consent → profile → records → first_result → plan → routine), the next step, unanswered questions, first results or what blocks them, the add-on tests for the next checkup, reminders and suggestions. A plan saved before any first result moves straight to the routine.
- **Self-measurements**: waist, home blood pressure (judged as a 7-day mean) and weight, typed on the page or told in chat (`save_self_measurement`), with 斤, 尺 and 寸 converted. A tape-measure waist unlocks China-PAR before the next checkup.
- **Record changes**: every checkup marker with a sourced row in the biological-variation table is compared latest-to-previous and latest-to-first; only a change beyond the reference change value is listed, with the numbers, the band and the source. Wrong-direction changes and range markers (haemoglobin, MCV, white cells) come with the advice to take the reports to a doctor; weight stays neutral. Only rows whose LOINC code the table lists are compared, so urine creatinine or urine glucose never pool into the blood markers. The model is told to raise these first, without naming a cause or suggesting a supplement.
- **Plan drafting** (`draft_intervention_plan`, `GET /api/longpi/plan-draft`, `POST /api/longpi/plan-draft/accept`): up to three lifestyle items from the trial-effects table, chosen by the models' sensitivities and the person's focus, each with its evidence; no prescription drug ever, supplements only as 需先与医生确认 without a dose, a simple medication screen, and goals only where the evidence gives a number (never negative, never more than half of today's value). Adoption rebuilds every item from its evidence id.
- **Proactive follow-up** (`set_followup`, `send_followup_message`, `/api/longpi/followup`): check-in and retest reminders, a weekly summary and one nudge when the first steps stall, by desktop notification or a Feishu, WeCom, DingTalk (signed), Bark or generic webhook. Off by default; quiet hours, a daily cap and no back-fills. The brief mode refuses any health value, dose or plan item name; the model's changes that turn follow-up on, switch to full detail or set a webhook need the person's approval.
- **Relevant methods only**: a method counts as ready from the record only when at least one of its LOINC- or device-coded inputs comes from the record; methods that need only age, a precomputed score or answers stay matchable in chat but no longer fill 你的记录现在就能算.
- **A workspace on a fresh DSH**: when DeepSeek Harness has no workspace at all, LongPi creates one named 健康 (once; `bootstrapWorkspace`), so the composer works on first open.
- Calendar export of retests (`GET /api/longpi/calendar.ics`), `/longpi` shows the stage and follow-up state, 18 tools.

- **One-line installer.** `install.sh` installs the DeepSeek Harness CLI and pnpm when missing, clones longevity-skills, creates `~/longpi/.venv` with the Mirobody engine, adds the plugin to the `web` profile and writes its configuration between markers in the profile patch (keeping values set earlier and other rows). `--mcp-url` connects an existing Mirobody; `--with-mirobody` deploys one with Docker and connects its demo account. Runs again to update. Written for macOS bash 3.2 and `curl | bash`.
- **README** rewritten: an introduction, the one-line installation, usage, how it works, privacy (including DeepSeek Harness's session-log upload and how to turn it off). The step-by-step installation moved to `docs/install.md`, and configuration, tools, routes and review rules to `docs/reference.md` (both with Chinese versions).

## 0.4.2 (published as 4.2.0)

- **One install.** A tagged release of [dsh-plugin-mirobody](https://github.com/zwbao/dsh-plugin-mirobody) (now public) ships in `vendor/dsh-plugin-mirobody`, so `dsh plugin --profile web add github:zwbao/dsh-plugin-longpi` installs both. The copy sits inside the DSH profile, where the host's `@deepseek-ai` packages resolve for it; a checkout outside the profile could not load them (`Cannot find package '@deepseek-ai/schemastery'`), which a real DSH 0.1.5-rc.3 install showed. `npm run vendor:mirobody` refreshes it from a release tag. `mirobodyPluginHome` now defaults to the bundled copy; the `~/Projects/dsh-plugin-mirobody` fallback is gone.
- **Install guide.** README and README.zh rewritten as a from-scratch install: Mirobody server, the personal MCP address, the Python environment, the skill library, `dsh plugin add`, the profile patch, first start, and checks from the command line, the web page and the chat, with a troubleshooting table.
- **longevity-skills is public.** CI checks it out without a token. Its `data/biological_variation.json` now takes every lab value from a journal article (EuBIVAS and the EFLM working group's published meta-analyses) with the quoted line; the report footer says so.
- Test: the CRP noise-band check derives its expectation from the table's own CRP row.

## 0.4.1 (published as 4.1.0)

- **China-PAR for men and women on the board.** With longevity-skills' verified China-PAR (constants derived from the paper's own printed numbers, Table 2 reproduced within 1%), the model card shows the 10-year ASCVD risk now and at the plan's blood-pressure, cholesterol or waist goals, with the guideline category and each goal's contribution in percentage points. Home blood pressure enters as the mean of the last week of readings.
- **Stated yes/no facts in the profile.** China-PAR needs six facts no record holds: current smoking, diabetes, blood-pressure medicine in the last two weeks, northern China, urban, and (men) family history of heart attack or stroke. The person states them in conversation (`save_personal_profile`) or in the board's profile form; absent means not stated, never "no", and the card names what is still missing. Profile saves from the board now update only the fields sent.

## 0.4.0 (published as 4.0.0)

Track the person's own intervention plan against their record, and a board built around progress.

- **Reads real Mirobody records.** Mirobody 1.5 answers MCP calls with a compact pipe table (constant columns hoisted into a `(constants: …)` line, a single row as that line alone), not JSON rows, so 3.0 read zero indicators from a real server. The parser is tested against fixtures rendered by Mirobody's own code, and a fake MCP server checked byte for byte against them.
- **Interventions.** `save_intervention_plan` checks a plan the person described or shared and returns a structured read-back; it saves only when called again with `confirm: true`. Medicines and supplements are saved by name and linked to the Mirobody medication plan; a dose in the plan text is not stored. `log_intervention_checkin` records check-ins with tags for days that disturb a lab (illness, travel, a different lab). Plans keep every version in `dataDir/interventions/`.
- **Judging an item.** `review_interventions` compares, for every marker an item aims at, the result before it started with the retest after the marker's minimum interval, against the reference change value from within-person biological variation (EFLM and peer-reviewed sources in longevity-skills `data/biological_variation.json`; home blood pressure as 7-day means). It weighs adherence over the last 12 weeks (wearable threshold, Mirobody dose log, or check-ins; missing days are unknown, never misses), items aimed at the same marker, medication courses running at the retest, and tagged days, and sets the trial average from `data/effects.jsonl` beside the change. Verdicts: 有效, 波动内, 反向, 无法判断. Next steps never include a medicine or a dose.
- **Phenotypic age over time.** Every checkup where the nine labs were measured on the same day is back-computed by the skill, with the date the labs were taken; the board draws the trend against a noise band derived from the skill's own slopes and the variation table (a lower bound where an input has no published variation).
- **Model estimates for goals.** `model_intervention_goals` and the board run the phenotypic-age skill with `--targets` (`levers.json`): phenotypic age and the model's 10-year mortality risk now and at the goals, and each goal alone. The China-PAR card stays "待系数校验" until that skill's coefficients are verified. No personal "years of life" figure.
- **The board** leads with phenotypic age, adherence and the next retest; then what really improved, the plan timeline with adherence strips and verdicts, each marker against its band and goal, the model cards, and next steps. Inline SVG, hover and keyboard read-outs, a table for every chart, light and dark palettes. `npm run preview` renders it with demo data and no host.
- **Faster turns.** Record reads are cached for a minute, so one turn no longer repeats 2–10 MCP calls per tool.
- Runs report the unit conversions the harness applied (`conversions`), and `POST /api/longpi/run-ready` runs every method the record already supplies. `GET /api/longpi/report` exports a Markdown summary for a doctor or coach.
- The medication intercept lets plain records through (an uploaded plan that lists a supplement dose, "鱼油停了两天") and still blocks advice-seeking and change intents.

## 0.3.0 (published as 3.0.0)

Dispatch by intent and by what the record can run, instead of word overlap.

- Reads the longevity-skills v2 layout: `catalog.json`, `intents.json`, and one `skill.json` per skill (tier, species, intents, inputs with LOINC, units and ranges, outputs, entry script, runtime). The README list still works as a fallback.
- `match_longevity_skills` detects intents (or takes one from the model), ranks the intent's skills, prefers skills whose inputs the record already holds, lists what the near ones miss, and keeps animal and cell skills out of questions that do not name the organism. On 50 everyday questions the right skill is in the top 3 for all 50; on 15 held-out questions, 14.
- `run_longevity_skill` takes `measurements` as recorded. The harness converts declared units, checks ranges, refuses a missing unit where a wrong one would stay in range (CRP mg/L vs mg/dL), fills the saved age and sex, and adds `--out`. Script refusals (exit 3) come back as `problems`.
- New tools `list_longevity_intents` and `query_longevity_evidence` (human, animal and cell evidence from the collected papers, cited, no doses).
- The medication intercept now catches named drugs and supplements and names on the person's plan ("要不要把阿司匹林停了", "二甲双胍一天吃几片") and leaves evidence questions alone.
- Skills that need a heavier interpreter declare a runtime; `skillRuntimes` maps it. A missing runtime is refused, not run with another interpreter.
- Earlier readouts (`history.jsonl`) feed before-and-after skills and the board. `/longpi-stats` and `GET /api/longpi/stats` give weekly counts with no values.
- `skillsVersion` pins a longevity-skills release; `longpi_status` reports the match.
- Record reading keeps LOINC codes and all indicators (not the first 40) and fetches latest values in chunks.

## 0.2.0 (published as 2.0.0)

Personal longevity harness. Longevity skills stay in their checkout and are dispatched from one person's question and Mirobody record. The health board reads that same snapshot. Phenotypic age and the other formulas stay inside the skill scripts.
