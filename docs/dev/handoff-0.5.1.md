# Handoff: LongPi 0.5.1

Status of branch `release-0.5.1` when this was written (2026-09-25), and what is left. Read this before continuing.

## What 0.5.1 contains

- **An external review, checked claim by claim.**
  - Every claim was checked twice. Claim 1a, unauthenticated routes, was also reproduced against a running DSH. None was refuted.
  - Fixed in this release:
    - routes pass DSH's own login and Host/Origin check (`guardRoute` → `ctx.connection.requestRejection`);
    - writes must be JSON;
    - webhook hosts are checked;
    - failed and partial reads are never shown as "not measured";
    - each input takes its newest value across codes;
    - phenotypic-age history is recomputed when its inputs change;
    - plan verdicts convert units first, and no zero baseline, single reading or adherence-less "有效" gets through;
    - doses are stripped in every plan category, Chinese numerals included;
    - check-ins can be true, false or null;
    - receipts are slimmed down;
    - skill processes get a minimal environment;
    - installer backups are 0600.
- **Safety judgement.**
  - `src/guard-llm.ts` has the host model label each user message, and LongPi appends one note; it never replaces the message.
  - `src/guardrails.ts` holds the fallback rules, used when the model call fails.
  - An output check runs at `agent/turn-stopping`: the judge decides, and the rules decide alone only when the judge fails.
  - Saving a plan asks for approval (`src/tools-approval.ts`).
  - Live evaluation on 266 cases with deepseek-v4-flash: emergencies 36/36, medicine requests 66/66, median 1.2 s.
- **UI.**
  - The health page has four tabs: 概览, 指标 (new: every indicator), 方案 and 档案.
  - A LongPi page in DSH settings (`settings.section`) holds reminders, the Mirobody connection and privacy.
  - Onboarding is one flow.
  - Chat cards come through `tool.call.toolview`.
  - Check-ins have three states.
- **Tool results are lossless JSON (`src/json.ts` `asJson`).**
  - DSH refuses a whole tool call with an undefined property, -0 or NaN.
  - `test/lossless.mjs` checks the results with DSH's own `isJsonValue`.
- **Vendored dsh-plugin-mirobody 0.1.1** (tag `v0.1.1`, PR zwbao/dsh-plugin-mirobody#2):
  - its guard appends a note and never rewrites the message;
  - its routes are authenticated;
  - its bridge gets a minimal environment.
  - When the model has labelled a message, LongPi drops Mirobody's rule notice.
- **Versions stay below 1.0** until the owner explicitly says otherwise (5.1.0 → 0.5.1; old tags were renumbered).

Checks done here:
- `npm run typecheck` and the full `npm test` (17 suites) pass on the final commit.
- **End to end in DeepSeek Harness 0.1.5-rc.3 with a real key, on the build before the last round of review fixes:**
  - no cookie → 401;
  - onboarding;
  - the four tabs and the LongPi settings page;
  - the draft card in chat;
  - an emergency → 120;
  - a negation or family-history message → a normal answer;
  - "stop fish oil / vitamin D dose" → refused;
  - saving a plan → read-back, question, DSH approval, 第 1 版.

## Second round (2026-09-26)

Done on this branch, each in its own commit:

- **Regression in DeepSeek Harness 0.1.5-rc.3.** `api.deepseek.com` was not in the cloud session's network allowlist, so the chat checks ran against a local scripted model (see How to test); no-key onboarding and the 401s ran as they are.
  - Fixed: a plan item aimed at 血压 got no verdict and a draft asked for 血压 said it had no evidence marker (血压 now means 收缩压 and 舒张压); draft items repeated their category and showed 证据：，DOI; an adopted draft's card still said 还没有保存.
  - Passed: focused draft adopted from the card; food advice gets no correction when the rules decide (and a supplement amount gets one); a 710-reading twice-daily series gets a verdict for each pressure; 撤销 on the check-in card says 已撤销 and survives a reload; step 1 without a key shows the hint and 去设置 opens 模型; every `/api/longpi/*` and `/api/mirobody/*` route answers 401 without the cookie.
- **README screenshots** of the home and the 概览 and 指标 tabs (1280 px, demo record).
- **`scripts/eval-guard.mjs`** leaves the 10 `reply` cases out of the input scores.
- **Guard scope** (`guardScope`, default `health`): the model labels every message in LongPi's workspace, and elsewhere messages that touch health and the rest of their session.
- **UI:** the 健康 tab in DSH's right column, quick actions under a turn, plain names with ⓘ.

## Left to do, in order

1. **Checks with the real model**, which the cloud session could not reach:
   - the focused-draft adoption, food advice judged by the real model (no correction), and check-in 撤销, in a real chat;
   - `scripts/eval-guard.mjs` live, per-label precision and recall into the PR.
2. **The new UI in real DSH**, not yet opened there: the 健康 tab (open it from the right column's guide page), the quick actions under a turn (draft, read-back, saved plan, check-in), and the ⓘ on the 方案 tab's model cards.
3. **Needs DeepSeek Harness support** (recorded, not worked around):
   - the composer's placeholder 「描述你想要构建的内容, / 调用指令, @ 文件或对话」 has no plugin seat;
   - 「工作区内修改」 (the access mode) cannot be hidden per workspace, so the health workspace shows it too.
4. **Release**, when the owner confirms after checking locally:
   - merge zwbao/longevity-skills#5, then zwbao/dsh-plugin-mirobody#2, then this branch's PR;
   - tag `v0.5.1` and write the GitHub release notes from CHANGELOG.

## How to test

- **Unit and integration.** `npm ci && npm test` needs a longevity-skills checkout next to this repo (`../longevity-skills`) or `LONGEVITY_SKILLS_HOME`.
- **Guard, live.** Build first, then run `DEEPSEEK_API_KEY=… node scripts/eval-guard.mjs --verbose --dsh <DSH's @deepseek-ai folder>`. It costs one short model call per case.
- **Preview without DSH.** `npm run build && node preview/dev.mjs --serve 4173`, or `--shots <dir> --only a,b` for headless screenshots.
- **Real DSH end to end.** Never touch the owner's own `~/.dsh`.
  - Setup:
    - `npm install --prefix <scratch> @deepseek-ai/dsh@0.1.5-rc.3 pnpm@10`;
    - `DSH_HOME=<scratch>/dshhome HOME=<scratch>/home dsh plugin --profile web add <npm pack tgz>`;
    - in `<DSH_HOME>/profiles/web/cordis.patch.yml`, add `- id: session-log-deepseek` with `config: {enabled: false}`, and a `dsh-plugin-longpi` config block (skillsHome, `mcpUrl: http://127.0.0.1:18765/mcp`, …);
    - `node test/fake-mirobody.mjs 18765` serves the synthetic demo record;
    - `DEEPSEEK_API_KEY=… dsh web --no-open --port 3181`.
  - The printed `/?token=` URL logs in once and sets a cookie; API calls need that cookie.
  - Drive the UI with headless Chrome over CDP: click by text, type with `Input.insertText`, press Enter.
  - Never type a key into DSH's API-key dialog; pass it through the environment.
  - Without network access to the model, the chat plumbing (cards, quick actions, approvals, the guard's hooks) can still be driven by a local scripted model: in a scratch profile only, add `- id: llm-deepseek` with `config: {baseURL: 'http://127.0.0.1:<port>'}` to its patch, give DSH a dummy `DEEPSEEK_API_KEY`, and serve OpenAI-style SSE on `/chat/completions`. This checks the plumbing, not the model's judgement.

## Rules that hold

- **Boundary.** No diagnosis. Never start, stop or change a prescription drug. No dose of any drug or supplement. Supplements appear only as 需先与医生确认, without a dose. Emergencies go to 120.
- **Sourcing.** No medical constant without a quoted source (longevity-skills `data/`). No real personal health data in the repositories, fixtures or screenshots; use the synthetic demo record.
- **Versions** stay below 1.0 until the owner explicitly confirms.
- **Git.**
  - Commit as `zwbao <zwbao@users.noreply.github.com>`, messages ending with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`.
  - Work through PRs, never push to `main`.
  - Merge only when the owner asks.
