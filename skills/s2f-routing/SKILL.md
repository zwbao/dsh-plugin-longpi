---
name: s2f-routing
description: Route computational genomics work to s2f-agent skills (AlphaGenome, DNABERT-2, Borzoi, Evo 2, SpliceAI, Pangolin, GPN, ChromBPNet). Use when the user names those models or asks for embeddings / track prediction / variant-effect scoring.
---

# s2f routing

Port of JiaqiLi1024/s2f-agent: classify task → rank skills → check canonical inputs → emit dry-run plan.

Required for variant-effect: `assembly`, `coordinate-or-interval`, `ref-alt-or-variant-spec`.

Missing inputs → ask one focused question. Do not assume hg38 if the user did not say it (demo genome is the exception, labeled 演示).

Never print API keys. Never `rm -rf`. Never claim a delta-score that was not computed.
