import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
//#region src/host-shims.d.ts
declare module '@deepseek-ai/cordis' {
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
    };
    webServer: {
      register(route: {
        kind: 'exact' | 'prefix';
        path: string;
        handler: (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse) => void;
      }): () => void;
    };
    commands: {
      register(definition: {
        name: string;
        description: string;
        handler: (invocation: {
          rawInput: string;
        }) => {
          kind: 'success' | 'error';
          text?: string;
        };
      }): unknown;
    };
  }
}
//#endregion
//#region src/config.d.ts
interface Config {
  skillsHome: string;
  mirobodyPluginHome: string;
  pythonBin: string;
  mirobodyHome: string;
  mcpUrl: string;
  mcpToken: string;
  member: string;
  timeoutMs: number;
  skillPython: string;
  skillTimeoutMs: number;
  dataDir: string;
  maxSkillMatches: number;
}
declare const Config: Schema<Config>;
//#endregion
//#region src/guardrails.d.ts
type GuardHit = {
  code: 'emergency';
  reply_zh: string;
} | {
  code: 'no_medication_change';
  reply_zh: string;
};
declare function preGuard(text: string): GuardHit | null;
declare function wrapGuardMessage(text: string, hit: GuardHit): string;
//#endregion
//#region src/version.d.ts
declare const PRODUCT_VERSION = "2.0.0";
declare const TOOL_NAMES: readonly ["read_personal_situation", "match_longevity_skills", "read_longevity_skill", "run_longevity_skill", "list_longevity_domains", "save_personal_profile", "longpi_status"];
declare const HARNESS_SKILLS: readonly ["longpi-dispatch", "longpi-board", "longpi-boundary"];
//#endregion
//#region src/catalog.d.ts
interface SkillCard {
  name: string;
  description: string;
  domain: string;
  blurb: string;
  lead: string;
  script: string | null;
}
interface Catalog {
  home: string;
  revision: string;
  cards: SkillCard[];
  error: string;
}
declare function parseFrontmatter(raw: string): {
  name: string;
  description: string;
  body: string;
};
declare function parseReadme(raw: string): Map<string, {
  domain: string;
  blurb: string;
}>;
declare function loadCatalog(home: string): Catalog;
declare function commandExcerpt(body: string): string;
//#endregion
//#region src/match.d.ts
interface MatchHit {
  name: string;
  domain: string;
  blurb: string;
  score: number;
  why: string[];
  has_script: boolean;
}
interface DomainRow {
  domain: string;
  count: number;
  names: string[];
}
declare function domainSummary(cards: readonly SkillCard[]): DomainRow[];
declare function matchSkills(cards: readonly SkillCard[], query: string, indicatorNames: readonly string[], limit: number): {
  matches: MatchHit[];
  note: string;
};
//#endregion
//#region src/profile.d.ts
declare const SEXES: readonly ["female", "male", "other", "unknown"];
type Sex = (typeof SEXES)[number];
interface Profile {
  displayName: string;
  birthYear: number | null;
  age: number | null;
  sex: Sex;
}
declare const EMPTY_PROFILE: Profile;
type Failure = {
  ok: false;
  error: string;
};
declare function normalizeProfile(input: unknown): {
  ok: true;
  profile: Profile;
} | Failure;
declare function estimatedAge(birthYear: number | null, nowYear: number): number | null;
declare function readProfile(dataDir: string): Profile;
declare function writeProfile(dataDir: string, profile: Profile): void;
//#endregion
//#region src/situation.d.ts
interface IndicatorRow {
  name: string;
  value: string;
  unit: string;
}
interface MedicationRow {
  name: string;
  status: string;
  recorded_dose: string;
}
declare function summarizeIndicators(payload: unknown): IndicatorRow[];
declare function summarizeMedications(payload: unknown): MedicationRow[];
//#endregion
//#region src/runner.d.ts
interface StagedFile {
  name: string;
  text: string;
}
interface RunRequest {
  home: string;
  dataDir: string;
  name: string;
  args: string[];
  files: StagedFile[];
  python: string;
  timeoutMs: number;
  revision: string;
}
interface RunResult {
  ok: boolean;
  error_kind?: string;
  error?: string;
  hint?: string;
  skill: string;
  revision: string;
  exit_code: number | null;
  report_excerpt: string;
  stdout_tail: string;
  stderr_tail: string;
}
interface Receipt {
  at: string;
  skill: string;
  revision: string;
  exit_code: number | null;
  ok: boolean;
  excerpt: string;
}
declare function reportExcerpt(text: string): string;
declare function readReceipts(dataDir: string, limit?: number): Receipt[];
declare function runSkill(request: RunRequest): Promise<RunResult>;
//#endregion
//#region src/paths.d.ts
declare function resolveSkillsHome(configured: string): string;
declare function resolveMirobodyPlugin(configured: string): string;
declare function resolveDataDir(configured: string): string;
//#endregion
//#region src/bridge.d.ts
interface BridgeStatus {
  ok: boolean;
  version?: string;
  bundle?: string;
  python?: string;
  error?: string;
}
//#endregion
//#region src/mirobody.d.ts
interface MountState {
  mounted: boolean;
  peer: boolean;
  error: string;
  pluginHome: string;
}
//#endregion
//#region src/records.d.ts
interface RecordSnapshot {
  profile: Profile;
  estimated_age: number | null;
  engine: BridgeStatus;
  mcp: {
    configured: boolean;
    host: string;
    token_set: boolean;
  };
  indicators: IndicatorRow[];
  medications: MedicationRow[];
  record_status: 'unconfigured' | 'ok' | 'error';
  record_error: string;
}
//#endregion
//#region src/board.d.ts
declare function buildBoard(input: {
  catalog: Catalog;
  records: RecordSnapshot;
  mount: MountState;
  receipts: Receipt[];
  limit: number;
}): {
  product: string;
  version: string;
  profile: Profile;
  estimated_age: number | null;
  skills: {
    home_set: boolean;
    revision: string;
    count: number;
    error: string;
    domains: {
      domain: string;
      count: number;
    }[];
  };
  mirobody: {
    mounted: boolean;
    peer: boolean;
    error: string;
    engine: BridgeStatus;
    mcp: {
      configured: boolean;
      host: string;
      token_set: boolean;
    };
  };
  records: {
    status: "unconfigured" | "ok" | "error";
    error: string;
    indicators: IndicatorRow[];
    medications: MedicationRow[];
  };
  dispatch: {
    matches: MatchHit[];
    note: string;
  };
  receipts: Receipt[];
  boundary: string;
};
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-longpi";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { Config, EMPTY_PROFILE, HARNESS_SKILLS, PRODUCT_VERSION, TOOL_NAMES, apply, buildBoard, commandExcerpt, domainSummary, estimatedAge, inject, loadCatalog, matchSkills, name, normalizeProfile, parseFrontmatter, parseReadme, preGuard, readProfile, readReceipts, reportExcerpt, resolveDataDir, resolveMirobodyPlugin, resolveSkillsHome, runSkill, summarizeIndicators, summarizeMedications, wrapGuardMessage, writeProfile };