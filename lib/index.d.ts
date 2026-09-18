import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/host-shims.d.ts
declare module '@deepseek-ai/cordis' {
  interface Events {
    'agent/pre-step'(payload: {
      messages: Array<{
        content?: unknown;
      }>;
    }, next: () => Promise<{
      kind: 'reject';
    } | {
      kind: 'enter';
      messages: Array<{
        content?: unknown;
      }>;
    }>): Promise<{
      kind: 'reject';
    } | {
      kind: 'enter';
      messages: Array<{
        content?: unknown;
      }>;
    }>;
  }
  interface Context {
    slots: {
      inject: (name: string, factory: () => unknown) => unknown;
      register: (options: Record<string, unknown>, component: unknown) => unknown;
    };
    skills: {
      register(skill: {
        name: string;
        description: string;
        content: string;
        source?: string;
        invocation?: {
          modelInvocable: boolean;
          userInvocable: boolean;
        };
      }): () => void;
    };
    systemPrompt: {
      section(section: {
        name: string;
        order: number;
        text: string | (() => string);
      }): unknown;
      context(section: {
        name: string;
        order: number;
        text: string | (() => string);
      }): unknown;
    };
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void;
      }): () => void;
    };
  }
}
//#endregion
//#region src/config.d.ts
interface Config {
  brandName: string;
  demoBanner: boolean;
  itineraryDate: string;
  s2fHome: string;
  maxVcfVariants: number;
  allowS2fExecute: boolean;
}
declare const Config: Schema<Config>;
//#endregion
//#region src/retrieve.d.ts
interface RetrieveHit {
  kind: 'faq' | 'term';
  title: string;
  body: string;
  score: number;
}
declare function retrieve(query: string, limit?: number): RetrieveHit[];
//#endregion
//#region src/guardrails.d.ts
type GuardHit = {
  code: 'emergency';
  reply_zh: string;
} | {
  code: 'no_medication';
  reply_zh: string;
};
declare function preGuard(text: string): GuardHit | null;
//#endregion
//#region src/bioage.d.ts
/**
 * Biological-age engine.
 *
 * Design rule: a number is only reported when its formula is fully specified by a
 * published, citable source and every input is either measured or explicitly
 * labelled `demo_synthetic`. When an algorithm needs fitted parameters we do not
 * own (e.g. the NHANES young-healthy reference covariance for homeostatic
 * dysregulation), we return `not_run` with the reason instead of inventing one.
 *
 * Licensing: the constants below are transcribed from the published literature,
 * not from any GPL project. `dayoonkwon/BioAge` (GPL-3) was used only to confirm
 * that the transcription matches; no BioAge code is copied, so this file stays MIT.
 */
interface Provenance {
  /** Model id, stable across releases. */
  model: string;
  /** Human-readable model name. */
  label: string;
  /** Primary citation for the formula. */
  citation: string;
  /** DOI/URL of the primary citation. */
  citation_url: string;
  /** Open implementations consulted to verify the transcription (attribution, not dependency). */
  cross_checked_with: string[];
  /** Units this model expects, per input key. Printed so the caller cannot mis-unit silently. */
  required_units: Record<string, string>;
  /** Claims this number does NOT support. Rendered next to every value. */
  claim_ceiling: string[];
}
/** One biochemical input with its value and provenance layer. */
interface BiomarkerInput {
  key: PhenoAgeMarker;
  value: number;
  /** Where the number came from. `demo_synthetic` is never a real person's result. */
  layer: 'measured' | 'user_reported' | 'demo_synthetic';
  /** e.g. 'labs.jsonl#2026-09-10' or 'raw/labs/checkup.pdf#page=2'. */
  source_ref: string;
}
type PhenoAgeMarker = 'albumin_gL' | 'creatinine_umolL' | 'glucose_mmolL' | 'ln_crp_mgL' | 'lymphocyte_pct' | 'mcv_fL' | 'rdw_pct' | 'alp_UL' | 'wbc_1000uL';
declare const PHENOAGE_PROVENANCE: Provenance;
interface PhenoAgeResult {
  ok: true;
  model: string;
  /** Linear predictor (xb) from age + nine biomarkers. */
  xb: number;
  /** 10-year all-cause mortality probability implied by the model. */
  mortality_10y: number;
  /** Phenotypic age in years. */
  phenoage: number;
  /** phenoage - chronological_age. Positive means biologically older than the calendar. */
  phenoage_advance: number;
  chronological_age: number;
  /** Echoes every input actually used, so a reviewer can recompute by hand. */
  inputs_used: Record<string, number>;
  provenance: Provenance;
  /** Any input that arrived on a unit we had to convert, with the conversion stated. */
  unit_notes: string[];
}
interface PhenoAgeFailure {
  ok: false;
  model: string;
  code: 'MISSING_INPUT' | 'OUT_OF_RANGE' | 'BAD_AGE';
  message_zh: string;
  missing: PhenoAgeMarker[];
  out_of_range: Array<{
    key: PhenoAgeMarker;
    value: number;
    expected: string;
  }>;
}
/**
 * Compute PhenoAge. Refuses (never guesses) when an input is missing or implausible.
 */
declare function phenoAge(biomarkers: BiomarkerInput[], chronologicalAge: number): PhenoAgeResult | PhenoAgeFailure;
/** Convenience: natural log of hs-CRP in mg/L, the form PhenoAge consumes. */
declare function lnCrp(hsCrpMgL: number): number;
interface HdReference {
  /** Biomarker order used by `means` and `inverse_covariance`. */
  biomarkers: PhenoAgeMarker[];
  /** Means of each biomarker in the young-healthy reference cohort. */
  means: number[];
  /**
   * Inverse of the reference covariance matrix. Held explicitly rather than as a
   * covariance so the engine does not need a matrix inverse at runtime and the
   * shipped numbers are exactly the ones that were validated.
   */
  inverse_covariance: number[][];
  /** Reference cohort definition, for the receipt. */
  cohort: string;
  /** Where these parameters came from. Must be a real, inspectable source. */
  source_ref: string;
}
declare const HD_PROVENANCE: Provenance;
/**
 * HD is a distance, so it has no value until a reference cohort's parameters are
 * supplied. Without them we return `not_run` and say why, rather than scoring
 * against an invented reference.
 */
declare function homeostaticDysregulation(biomarkers: BiomarkerInput[], reference: HdReference | null): {
  ok: true;
  hd: number;
  provenance: Provenance;
  inputs_used: Record<string, number>;
} | PhenoAgeFailure | {
  ok: false;
  model: string;
  code: 'NO_REFERENCE';
  message_zh: string;
  how_to_supply: string;
};
interface ModuleAge {
  biological: number;
  physiological: number;
  psychological: number;
  behavioral: number;
  social_env: number;
}
declare const MODULE_WEIGHTS_FOR_AGE: Record<keyof ModuleAge, number>;
interface CompositeAgeResult {
  ok: true;
  composite_age: number;
  chrono_age: number;
  delta: number;
  weights: Record<string, number>;
  /** Each module's contribution to the composite, so the arithmetic is auditable. */
  contributions: Record<string, number>;
  /** Where each module age came from. `engine` means computed, `demo` means a fixed demo input. */
  module_source: Record<string, 'engine' | 'demo'>;
  method: string;
}
declare function compositeAge(modules: ModuleAge, chronoAge: number, source?: Partial<Record<keyof ModuleAge, 'engine' | 'demo'>>): CompositeAgeResult | {
  ok: false;
  code: string;
  message_zh: string;
};
//#endregion
//#region src/fixture.d.ts
type ModuleCode = 'biological' | 'physiological' | 'psychological' | 'behavioral' | 'social_env';
type MetricStatus = 'optimal' | 'normal' | 'high' | 'low' | 'watch';
interface Metric {
  code: string;
  name_zh: string;
  name_en: string;
  value: number | string;
  unit: string;
  status: MetricStatus;
  ref: string;
  previous?: number | string;
  module: ModuleCode;
  aliases: string[];
}
interface DemoCustomer {
  id: string;
  display_name: string;
  age: number;
  sex: string;
  tier: string;
  language: string;
  months_enrolled: number;
  chrono_age: number;
  composite_age: number;
  modules: Record<ModuleCode, {
    age: number;
    label_zh: string;
  }>;
  disclaimer_zh: string;
}
/** Demo lab panel for the 9 PhenoAge markers. Synthetic — belongs to no real person. */
declare const DEMO_LAB_PANEL: BiomarkerInput[];
/** One Metric per PhenoAge input, so the panel that feeds the clock is visible in the dashboard. */
declare const PHENOAGE_LAB_METRICS: Metric[];
/** Marker keys that feed PhenoAge — exported so a caller can check coverage before scoring. */
declare const PHENOAGE_MARKER_KEYS: PhenoAgeMarker[];
/** Biological module age — computed by the engine, not authored as a constant. */
declare const DEMO_PHENOAGE: PhenoAgeResult;
declare const DEMO_COMPOSITE: CompositeAgeResult;
declare const CUSTOMER: DemoCustomer;
declare const METRICS: Metric[];
declare function findMetric(code: string): Metric | undefined;
//#endregion
//#region src/s2f/genome.d.ts
type OmicsLayer = 'genome' | 'epigenome' | 'transcriptome' | 'proteome' | 'metabolome';
interface DemoVariant {
  id: string;
  rsid: string;
  gene: string;
  assembly: 'hg38';
  chrom: string;
  position: number;
  ref: string;
  alt: string;
  genotype_demo: string;
  consequence: string;
  gnomad_af_note: string;
  clinvar: string;
  longevity_note_zh: string;
  citation: string;
  s2f_skills: string[];
  layers: OmicsLayer[];
}
/** Synthetic 张明远 genome panel. Not a real person. */
declare const DEMO_VARIANTS: DemoVariant[];
//#endregion
//#region src/s2f/routing.d.ts
interface RankedSkill {
  id: string;
  score: number;
  family: string;
  best_for: string;
}
interface RouteResult {
  decision: 'route' | 'clarify';
  confidence: 'high' | 'medium' | 'low';
  task: string | null;
  primary_skill: string | null;
  secondary_skills: string[];
  ranking: RankedSkill[];
  warnings: string[];
  penguin: string;
  clarify_question?: string;
  source: 's2f-penguin guards + s2f-agent registry';
}
declare function routeQuery(query: string, taskHint?: string): RouteResult;
//#endregion
//#region src/s2f/penguin.d.ts
declare const AXES: readonly ["constraint", "molecular", "cellular", "evidence"];
type Axis = (typeof AXES)[number];
interface S2fEntity {
  gene?: string;
  rsid?: string;
  hgvs_c?: string;
  hgvs_p?: string;
  transcript?: string | null;
  source_refs: string[];
  provenance_layer: 'demo_panel' | 'vcf' | 'user';
  verification_status: 'unverified' | 'panel' | 'translated';
}
/** De-identified profile-agent contract from s2f-penguin `s2f batch` (2026-09-14). */
interface S2fBatchRequest {
  request_id: string;
  assembly: 'hg38' | 'unknown';
  entities: S2fEntity[];
  allowed_axes: Axis[];
  claim_ceiling: 'constraint' | 'molecular' | 'cellular';
  return_to: string;
  notes_zh: string[];
}
declare function buildBatchRequest(input: {
  gene?: string;
  rsid?: string;
  hgvs_c?: string;
  hgvs_p?: string;
  assembly?: string;
  axes?: string[];
}): S2fBatchRequest | {
  error: true;
  code: string;
  message_zh: string;
};
//#endregion
//#region src/s2f/annotate.d.ts
declare function annotateVariant(query: string): Record<string, unknown>;
//#endregion
//#region src/s2f/evidence.d.ts
/**
 * Curated longevity / aging index — NOT a crawl of GitHub.
 * Each row is a named project or resource we actually looked at.
 *
 * Every row carries a verified `license` and an `integration` field, because licence
 * compatibility decides how a project may be used at all:
 *   - `import`  — safe to depend on from this MIT package (MIT / Apache-2.0 / BSD / MPL).
 *   - `process` — copyleft or non-standard: call as a CLI/subprocess or over HTTP, never link.
 *   - `cite`    — usable as evidence only; do not ship code or data from it.
 *   - `unknown` — no licence file or unread terms. Treat as all-rights-reserved until checked.
 * Slugs and star counts were verified against the GitHub REST API on 2026-09-17.
 */
interface EvidenceItem {
  id: string;
  name: string;
  kind: 'code' | 'database' | 'review';
  url: string;
  use: string;
  /** SPDX id where one was verified; `custom`/`none`/`review` otherwise. */
  license: string;
  /** How this repo may be used from an MIT package. */
  integration: 'import' | 'process' | 'cite' | 'unknown';
  /** Stargazers at verification time; omitted for non-code resources. */
  stars?: number;
  /** Set when the last check found a problem that a caller must not ignore. */
  warning_zh?: string;
}
declare function lookupEvidence(query: string): {
  demo: true;
  matches: EvidenceItem[];
  license_summary: {
    import: number;
    process: number;
    cite: number;
    unknown: number;
  };
  coverage_note_zh: string;
  usage_note_zh: string;
};
//#endregion
//#region src/s2f/vcf.d.ts
interface ParsedVariant {
  chrom: string;
  position: number;
  rsid: string;
  ref: string;
  alt: string;
  genotype?: string;
  filter: string;
}
interface VcfIngestResult {
  ok: true;
  assembly_assumed: 'hg38';
  n_header_lines: number;
  n_records: number;
  n_kept: number;
  n_dropped_nonsnp: number;
  n_truncated: boolean;
  variants: ParsedVariant[];
}
interface VcfIngestError {
  ok: false;
  code: 'EMPTY' | 'NOT_VCF' | 'TOO_LARGE' | 'NO_RECORDS';
  message_zh: string;
}
declare function parseVcf(text: string, options?: {
  maxVariants?: number;
  maxBytes?: number;
}): VcfIngestResult | VcfIngestError;
//#endregion
//#region src/s2f/report.d.ts
/**
 * The single source of truth for the product version in code.
 *
 * `package.json` carries the release version and `test/smoke.mjs` asserts the two
 * agree, so they cannot drift apart unnoticed. Do not hardcode a version string
 * anywhere else: import this constant, or reference it in prose from the README.
 */
declare const PRODUCT_VERSION = "1.1.0";
declare function buildOmicsReport(): {
  product: string;
  version: string;
  generated_at: string;
  member: {
    display_name: string;
    chrono_age: number;
    composite_age: number;
    modules: Record<ModuleCode, {
      age: number;
      label_zh: string;
    }>;
  };
  phenotype: {
    metrics: {
      code: string;
      name_zh: string;
      value: string | number;
      unit: string;
      status: MetricStatus;
    }[];
    insights: string[];
  };
  genome: {
    source: string;
    assembly: string;
    vcf_stats: {
      n_kept: number;
      n_dropped_nonsnp: number;
      truncated: boolean;
    } | null;
    panel_hits: {
      rsid: string;
      gene: string;
      genotype: string;
      hg38: string;
      note_zh: string;
      citation: string;
    }[];
  };
  omics: {
    layer: OmicsLayer;
    status: string;
  }[];
  evidence_index: {
    id: string;
    name: string;
    url: string;
  }[];
  next_steps: string[];
  disclaimer_zh: string;
};
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-longpi";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): void;
//#endregion
export { CUSTOMER, Config, DEMO_COMPOSITE, DEMO_LAB_PANEL, DEMO_PHENOAGE, DEMO_VARIANTS, HD_PROVENANCE, METRICS, MODULE_WEIGHTS_FOR_AGE, PHENOAGE_LAB_METRICS, PHENOAGE_MARKER_KEYS, PHENOAGE_PROVENANCE, PRODUCT_VERSION, annotateVariant, apply, buildBatchRequest, buildOmicsReport, compositeAge, findMetric, homeostaticDysregulation, inject, lnCrp, lookupEvidence, name, parseVcf, phenoAge, preGuard, retrieve, routeQuery };