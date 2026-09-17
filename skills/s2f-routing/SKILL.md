---
name: s2f-routing
description: Route computational genomics work to s2f-agent skills (AlphaGenome, DNABERT-2, Borzoi, Evo 2, SpliceAI, Pangolin, GPN, ChromBPNet). Use when the user names those models or asks for embeddings / track prediction / variant-effect scoring.
---

# s2f routing

Routing follows **zwbao/s2f-penguin** scientific guards, not the raw s2f-agent bash defaults.

- Human / hg38 variants: **never** `gpn-models` live forward (alignment channels would be zero). Use `gpn_msa` published table, `alphagenome-api`, or `evo2-inference`.
- hg19 / GRCh37: refuse; no liftover.
- Execution is `s2f` CLI (penguin), not family scripts from DSH. Prefer `s2f_batch_request` for the profile-agent JSON, then `s2f batch` outside DSH.
- Orthogonal axes (constraint / molecular / cellular / evidence) combine by logic, never by averaging scores.
- Missing inputs → one focused question. Never invent a delta-score. Never print API keys.
