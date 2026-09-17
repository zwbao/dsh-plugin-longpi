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
declare const CUSTOMER: DemoCustomer;
declare const METRICS: Metric[];
declare function findMetric(code: string): Metric | undefined;
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
//#region src/s2f/genome.d.ts
type OmicsLayer = 'genome' | 'epigenome' | 'transcriptome' | 'proteome' | 'metabolome';
//#endregion
//#region src/s2f/annotate.d.ts
declare function annotateVariant(query: string): Record<string, unknown>;
//#endregion
//#region src/s2f/evidence.d.ts
/**
 * Curated longevity / aging index — NOT a crawl of GitHub.
 * Each row is a named project or resource we actually looked at.
 */
interface EvidenceItem {
  id: string;
  name: string;
  kind: 'code' | 'database' | 'review';
  url: string;
  use: string;
}
declare function lookupEvidence(query: string): {
  demo: true;
  matches: EvidenceItem[];
  coverage_note_zh: string;
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
declare const PRODUCT_VERSION = "1.0.1";
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
export { CUSTOMER, Config, METRICS, PRODUCT_VERSION, annotateVariant, apply, buildBatchRequest, buildOmicsReport, findMetric, inject, lookupEvidence, name, parseVcf, preGuard, retrieve, routeQuery };