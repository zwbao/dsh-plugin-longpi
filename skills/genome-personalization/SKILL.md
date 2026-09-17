---
name: genome-personalization
description: Personal-genome interpretation for the LongPi demo member using s2f-agent routing. Use when the user asks about FOXO3, APOE, rsIDs, variant effect, or "我的基因组".
---

# Genome personalization

1. If the user has a VCF, call `ingest_vcf` (path or vcf_text). Then `build_omics_report`.
2. Otherwise `read_personal_genome` then `annotate_variant` for the named gene/rsID.
3. Model scoring: `s2f_route` + `s2f_plan`. `s2f_execute` only if the operator enabled it — still routing dry-run, never GPU.
4. Always state assembly (default hg38, 1-based as written).
5. Never turn a common GWAS hit into a diagnosis or a drug change.
6. Cite the tool's `citation` field; do not invent PMIDs.
7. Finish with `export_report` when they ask for a deliverable.
