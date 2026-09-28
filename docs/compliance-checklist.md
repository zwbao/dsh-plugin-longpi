# LongPi compliance checklist (M11)

This is the gate for turning `scienceMode` to `live` and for the ordinary product’s sensitive-information handling. Simulated studies can run while the live rows are open. Live collection stays off in this build (owner decision D6).

Genetics, genomes, genotypes, polygenic scores and clinical genetic reports are **excluded from research**. A checkup, a chemistry panel, HbA1c, lipids, glucose, blood pressure, weight and step counts are clinical data. They are sensitive personal information under the Personal Information Protection Law. They are not, by themselves, human genetic resource information. The study runner must still drop genetic fields before any statistic. M7 may keep a genetics file locally for the person. That file does not enter a study.

## Product (this build)

| # | Check | Done when |
|---|---|---|
| 1 | Separate PIPL consent | The privacy screen’s first act is its own button, not a pre-ticked box inside the welcome notice. `POST /api/longpi/privacy/consent` with `scope: pipl_sensitive`. |
| 2 | Data-flow disclosure | The same screen says what goes to DeepSeek, what stays in `~/.dsh/longpi`, and what stays in Mirobody. A second button records `data_flow_deepseek`. Health tool results are withheld until both grants exist. |
| 3 | Name | The saved display name is removed from model prompts, tool results and session-log payloads. The page may still show it. |
| 4 | Session log | Health-workspace upload is off until `session_log_upload` is granted. The control is a separate button, default off. |
| 5 | Minors | Unknown age: Codex off, and the screen asks for an age. Under 18: Codex off, no weight-loss items. Under 14: a guardian must tick the separate line before `pipl_sensitive` can be granted. |
| 6 | Export | `GET /api/longpi/privacy/export` is one zip of the local store, tokens removed, plus a Mirobody link in `说明.txt`. |
| 7 | Delete | `POST /api/longpi/privacy/delete` with `{"confirm":"删除全部"}` removes the local store. Mirobody is not deleted from here. |
| 8 | Wording | `data/privacy/banned_claims.json`. “年轻了” only when the feedback grade allows it, and the same text says 估计. Absolute efficacy lines are rejected. Share cards also carry the noise band. |
| 9 | `consentGranted` | Returns false until the latest act for that scope is `granted`. M8 calls this before any release. |

## Live research (owner, not this build)

Tick in order. `liveScienceAllowed()` stays false until a later build is allowed to change it. The privacy status lists the same blockers.

| # | Gate | Done when |
|---|---|---|
| 1 | Mainland sponsor | A mainland limited company is the personal-information handler. Its licence and unified social credit code are on file. |
| 2 | PIPIA | A personal-information protection impact assessment covers purpose, necessity, risk and protections, including any entrusted processor. Kept, not drafted and discarded. |
| 3 | Sensitive-information consent | The product act above is shipped, and each study has its own second act (`scope: study`) with a comprehension check. Withdrawal is available any time. |
| 4 | Human genetic resources | A short memo quotes the rule that clinical, imaging, protein and metabolite data are outside the genetic-resource information definition, lists what is excluded (genes, genomes, genotypes, scores), and describes the strip-before-statistic control. Counsel signs it. No research specimen is collected. |
| 5 | Ethics review | A committee filed with the local health commission approves both protocols. The exemption for anonymised data is not used: the studies use medical information and have a commercial sponsor. |
| 6 | ChiCTR | After ethics approval, before the first invitation. Both studies. The approval id and the ChiCTR id are in the signed manifest. |
| 7 | Signing key | The live ed25519 key is held by the sponsor, offline. A simulated test key is not trusted for live. |
| 8 | No overseas study path | The aggregator is in mainland China. Individual values are not sent to DeepSeek as part of a study. A cross-border collaboration is a new consent and a new review. |
| 9 | Device and advertising copy | Study text does not promise treatment. Recruitment strings pass the banned-claims list. “年轻了” is not a study result. |
| 10 | Owner switch | Only after every row above. This build does not offer a working live switch. |

## What M8 must call

- `consentGranted('pipl_sensitive')` and `consentGranted('study')` before a run that could leave the machine. Both false until the person grants them.
- `liveScienceAllowed()` before `scienceMode: live`. It is false here.
- Keep `data.excluded` containing `genetics`. A manifest that omits it is not eligible.
- Give-back text goes through `adlaw.wording` (no absolute efficacy, no “年轻了” without 估计).

## Wording for M4

Use these shapes. The validator `adlaw.wording` enforces the second sentence of each “younger” line and rejects the banned phrases in `data/privacy/banned_claims.json`.

- Beyond the noise band, every gate passed: `你年轻了 {n} 岁（模型估计，超出了这一项的正常波动）。`
- Within the band: a concrete progress sentence and when to retest. Do not say 年轻了.
- A single first draw: do not say 年轻了.
- A share card uses the same sentence and keeps 估计 and the band in the text that is shared.
