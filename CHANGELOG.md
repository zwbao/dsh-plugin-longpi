# Changelog

## 1.0.1 — 2026-09-17

Integrate scientific guards and the profile contract from [zwbao/s2f-penguin](https://github.com/zwbao/s2f-penguin) without embedding PenguinHarness.

- Human variant routing no longer defaults to live GPN (P0: alignment channels would be zero). Human constraint path is `gpn_msa` published table; scoring path is AlphaGenome / Evo 2.
- Refuse hg19/GRCh37 (no liftover).
- `s2f_execute` prefers penguin `s2f route` binary; legacy `route_query.sh` is fallback only.
- New `s2f_batch_request` emits the de-identified `s2f batch` JSON for LongPi as the profile agent.
- Plans point at `s2f doctor` / `s2f translate` / `s2f batch`, not GPU from DSH.
- Correct rs10757278 to GRCh38 `9:22124478`; TERT rs2736100 alleles to plus-strand C/A.
- `annotate_variant('APOE')` returns both ε SNPs. Dashboard fetch forwards the DSH `token` query param.

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
