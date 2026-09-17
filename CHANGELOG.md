# Changelog

## 1.0.0 — 2026-09-17

First production release of **dsh-plugin-longpi**.

- Longevity concierge: phenotype dashboard, five modules, medical guardrails, launch itinerary
- Personal genome 1.0: 12-locus longevity panel, VCF SNP ingest (hg38), panel matching
- Multi-omics report: genome / epigenome / transcriptome / proteome / metabolome status + Markdown export
- s2f-agent integration: in-process router/planner (17 skills) + optional `route_query.sh` dry-run when `s2fHome` is set
- Curated evidence index (clocks, HAGR, ClinVar, gnomAD) — not a GitHub crawl
- Hash-chained tool audit receipts
- HTTP: `/api/longpi/dashboard`, `/api/longpi/report`, `/api/longpi/version`
- Slash commands: `/longpi`, `/longpi-report`, `/longpi-version`

Not included (explicit non-goals of 1.0.0): GPU model inference, methylation clock computation, EHR write, medication advice.
