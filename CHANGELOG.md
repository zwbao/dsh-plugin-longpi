# Changelog

## Unreleased — biological-age engine

The headline number is now computed instead of authored. `composite_age` moves from the
literal `41.2` to `45.1`, derived from a PhenoAge result of `52.52920526313869` and the
five published module weights.

- New `src/bioage.ts`: PhenoAge (Levine 2018) with constants transcribed from the paper,
  homeostatic-dysregulation machinery, and the composite-age arithmetic. Every result carries
  model, citation, required units and a claim ceiling.
- Refusal semantics: missing marker → `MISSING_INPUT`; implausible unit → `OUT_OF_RANGE`
  (with the expected unit); non-physiological age → `BAD_AGE`; HD without a reference cohort →
  `NO_REFERENCE`. The engine never fills missing inputs with means or invents a reference.
- Four new tools (19 → 23): `compute_biological_age`, `read_bioage_model`,
  `read_demo_lab_panel`, `compute_composite_age`.
- Demo panel now carries the nine PhenoAge markers; `iage` is derived from the engine.
- Dashboard API exposes a `bioage` provenance block; the GUI marks each module as
  engine-computed or demo input instead of presenting all five as computed.
- `cordis.patch.yml`: annotated, commented-out Tycho Engine MCP wiring (44 `mcp__tycho__*`
  tools) plus the boundary rule — LongPi proposes candidates with a claim ceiling, Tycho
  decides what is true about the individual.
- `test/smoke.mjs` pins the PhenoAge golden vector, the refusal paths, the HD no-reference
  path, and asserts all 23 tools register.
- Plan and absorption list: [docs/longpi-2.0-plan.md](docs/longpi-2.0-plan.md).

Not included: KDM, methylation clocks (Horvath / GrimAge / DunedinPACE) and ATAC clocks.
`read_bioage_model` lists each with the reason rather than omitting them silently.

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
