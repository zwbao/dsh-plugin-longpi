# LongPi for DeepSeek Harness

[![license](https://img.shields.io/badge/license-MIT-2D5F5A.svg)](LICENSE)
[![node](https://img.shields.io/badge/node-%E2%89%A522.19-brightgreen.svg)](package.json)
![dsh](https://img.shields.io/badge/DeepSeek%20Harness-0.1.5--rc-8A63D2)
![dsh-plugin](https://img.shields.io/badge/topic-dsh--plugin-111)

**Version 1.0.1.** Production bundle, not an MVP slice.

The **longevity concierge** for [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness): a North-Star biological-age dashboard, five phenotype modules, a medically guarded chat, and a launch-day itinerary — as one installable `dsh.bundle`.

[中文](README.zh.md) · [Intended use](docs/intended-use.md) · [Security](SECURITY.md)

<p align="center">
  <img src="assets/hero.svg" alt="LongPi dashboard: composite biological age 41.2 versus chronological 45, five phenotype modules, radar" width="920" />
</p>

There is no other DSH plugin that owns this surface. Clinical note-drafting lives in [dsh-medseek](https://github.com/Mr-Neutr0n/dsh-medseek). LongPi is the **member-facing longevity OS**: see the number, ask why, take a next step, hand off to a human. Drafts never prescribe.

It is **not a medical device**. Bundled labs belong to the synthetic member 张明远 (demo).

## Why this can be the #1 health plugin

The [awesome-dsh-plugin](https://github.com/awesome-dsh-plugin/awesome-dsh-plugin) catalog is dense in UI chrome, memory, and billing. On **longevity / biological age / phenotype**, it is empty. The one serious health bundle is MedSeek (clinician SOAP/SBAR + FDA/PubMed). LongPi does not copy that. It ships the missing product:

| | LongPi | MedSeek |
|---|---|---|
| Who | Member, concierge, launch cohort | Physician / APP / nurse |
| North Star | Composite biological age + 5 modules | Structured clinical notes |
| Network | None (demo fixture) | Allowlisted FDA / PubMed / trials |
| Guard | No diagnosis, no dose change, 120 | PHI egress + citation discipline |
| GUI | Dashboard tab, radar, suggested asks | Theme + settings + search cards |

Stars follow a category-defining README, a one-line install, a screenshot whose numbers are true, and the `dsh-plugin` topic. This repo is built to that bar.

## Install

```sh
dsh plugin --profile web add github:zwbao/dsh-plugin-longpi
dsh web
```

From a checkout:

```sh
npm install && npm test
dsh plugin --profile web add "$PWD"
dsh --profile web --dump-config   # expect "# == dsh-plugin-longpi"
```

If `dsh` is not on PATH:

```sh
npx -y --package @deepseek-ai/dsh dsh plugin --profile web add "$PWD"
```

Restart the GUI (or hard-refresh). Open a session → tab **LongPi**. Uninstall: `dsh plugin --profile web remove dsh-plugin-longpi`.

## What you get

| Surface | What you see |
|---|---|
| Conversation view **LongPi** | Composite age, Δ vs chronological, 5-module radar, status chips, insights, Oct 24 itinerary |
| Composer dock | Suggested questions (copy → paste into Chat) |
| Sidebar mark | LongPi dot |
| Persona | Health assistant, not a coding agent |
| Tools (19) | 8 concierge + 11 genome/omics/s2f — matches source |
| Skills (6) | Phenotype, panel, itinerary, genome, multi-omics, s2f routing |

### Tools (19)

| Tool | Answers | Writes |
|---|---|---|
| `read_dashboard` | Composite age, five modules, insights | no |
| `read_phenotype` | One module + metrics | no |
| `explain_metric` | One demo metric vs reference / previous | no |
| `list_insights` | Reviewed insight cards | no |
| `get_event_briefing` | 2026-10-24 itinerary | no |
| `search_faq` | Keyword FAQ + glossary | no |
| `create_appointment_request` | Concierge intent (max 1 / process) | yes |
| `handoff_concierge` | Human handoff (max 1 / process) | yes |
| `s2f_route` | Rank s2f-agent skills | no |
| `s2f_plan` | Dry-run plan + missing canonical inputs | no |
| `s2f_execute` | Optional penguin `s2f route` (off by default) | no |
| `s2f_batch_request` | De-identified JSON for `s2f batch` (gpn_msa / translate) | no |
| `read_personal_genome` | 12-locus longevity panel | no |
| `ingest_vcf` | Local VCF SNP ingest (hg38, capped) | in-process |
| `annotate_variant` | Consequence, ClinVar note, literature, s2f skills | no |
| `annotate_multiomics` | Five omics layers | no |
| `build_omics_report` | 1.0.1 combined report | no |
| `export_report` | JSON or Markdown | no |
| `lookup_longevity_evidence` | Curated index (not a GitHub crawl) | no |

### Skills (6)

- `phenotype-literacy` — composite age and module weights
- `panel-interpretation` — hs-CRP, inflammatory age, VO₂ max, HRV, sleep
- `event-day-itinerary` — launch-day path
- `genome-personalization` — demo WGS panel + s2f scoring path
- `multiomics-annotation` — layered omics, never fill missing layers
- `s2f-routing` — s2f-penguin guards + profile batch contract

## Quick start

1. Install, restart `dsh web`, new session, open the **LongPi** tab.
2. Ask in Chat: “我的 hs-CRP 高吗？” The agent should call `explain_metric` / `search_faq` and quote **4.2 mg/L** (demo).
3. Ask: “10 月 24 日怎么走？” → `get_event_briefing`.
4. Try a medication-change phrasing. The guard must refuse and point to a concierge.

Every answer that cites a number must come from a tool or the demo `customer_block`. Invented labs are a bug.

## Architecture

```mermaid
flowchart LR
  subgraph dsh["DeepSeek Harness"]
    WEB[Web GUI]
    TOOLS[Tool registry]
    SK[Skill registry]
    SP[System prompt]
  end
  subgraph bundle["dsh-plugin-longpi"]
    HOST[Host: tools + guard + persona]
    FIX[Synthetic fixture 张明远]
    UI[Client: Dashboard + dock]
    API["GET /api/longpi/dashboard"]
  end
  WEB --> UI
  UI --> API --> FIX
  HOST --> TOOLS
  HOST --> SK
  HOST --> SP
  HOST --> FIX
```

One package, one `cordis.patch.yml` row. No EHR. No wearable OAuth. No third-party Cordis plugins inside the customer process.

## Safety model

| Layer | Mechanism |
|---|---|
| Banner | Persistent 演示数据 / DEMO DATA |
| Persona | No 诊断 / 患有 / 治愈; no dose changes |
| `agent/pre-step` | Emergency → 120 script; medication intent → refuse |
| Write caps | 1 appointment, 1 handoff per process |
| Network | Dashboard API is local; tools do not `fetch` |

Details: [docs/intended-use.md](docs/intended-use.md), [SECURITY.md](SECURITY.md).

## Configuration

`cordis.patch.yml`:

```yaml
config:
  brandName: 健康助手
  demoBanner: true
  itineraryDate: '2026-10-24'
```

## Compatibility

| | |
|---|---|
| dsh | tested on `@deepseek-ai/dsh` 0.1.5-rc.1 |
| Node | `^22.19 \|\| >=24` |

## Development

```sh
npm install
npm test          # tsdown + smoke (guardrails, retrieve, fixture ages)
```

`npm test` asserts composite age **41.2**, hs-CRP alias `crp` → `hs_crp`, medication and emergency guards, and FAQ retrieve.

## Listing checklist (awesome-dsh-plugin)

- [x] `dsh.bundle` + `cordis.patch.yml`
- [x] `dsh plugin add` installable
- [x] MIT LICENSE
- [x] Tool count in README matches source
- [x] GitHub topic **`dsh-plugin`**
- [ ] One-line description on the list, category **Tools & Capabilities** or **Skills**

## License

[MIT](LICENSE). The `dsh-plugin` topic is a discovery tag, not a DeepSeek endorsement and not a medical clearance.
