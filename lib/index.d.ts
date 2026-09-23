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
  skillRuntimes: Record<string, string>;
  skillsVersion: string;
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
/** Names from this person's medication plan, so "停掉<药名>" is caught too. */
declare function rememberMedications(names: readonly string[]): void;
declare function preGuard(text: string): GuardHit | null;
declare function wrapGuardMessage(text: string, hit: GuardHit): string;
//#endregion
//#region src/version.d.ts
declare const PRODUCT_VERSION = "3.0.0";
declare const TOOL_NAMES: readonly ["read_personal_situation", "list_longevity_intents", "match_longevity_skills", "read_longevity_skill", "run_longevity_skill", "query_longevity_evidence", "list_longevity_domains", "save_personal_profile", "longpi_status"];
declare const HARNESS_SKILLS: readonly ["longpi-dispatch", "longpi-board", "longpi-boundary"];
//#endregion
//#region src/catalog.d.ts
type Tier = 'A' | 'B' | 'C' | 'tool' | '';
interface InputSpec {
  key: string;
  label_zh: string;
  aliases?: string[];
  loinc?: string[];
  unit?: string;
  accept?: Record<string, number>;
  range?: [number, number];
  unit_required?: boolean;
  required: boolean;
  from: 'measurements' | 'profile' | 'argument' | 'output';
  flag?: string;
  output_of?: string[];
  group?: string;
  note_zh?: string;
}
interface OutputSpec {
  key: string;
  label_zh: string;
  unit?: string;
}
interface EntrySpec {
  script: string;
  runtime?: string;
  measurements_flag?: string;
  measurements_header?: string[];
  age_flag?: string;
  sex_flag?: string;
  medications_flag?: string;
  labs_flag?: string;
  out_flag?: string;
  result_json?: boolean;
}
interface IntentSpec {
  id: string;
  label_zh: string;
  description_zh: string;
  data: string[];
  triggers: string[];
  entities?: string[];
  skills: string[];
  priority?: number;
}
interface SkillCard {
  name: string;
  description: string;
  domain: string;
  domains: string[];
  blurb: string;
  lead: string;
  script: string | null;
  kind: string;
  tier: Tier;
  species: string[];
  intents: string[];
  inputsStatus: 'none' | 'draft' | 'verified';
  inputs: InputSpec[];
  outputs: OutputSpec[];
  entry: EntrySpec | null;
  paper: {
    doi?: string;
    title_zh?: string;
    journal?: string;
    year?: number;
  } | null;
}
interface Catalog {
  home: string;
  revision: string;
  version: string;
  source: 'catalog.json' | 'skill.json' | 'readme' | '';
  cards: SkillCard[];
  intents: IntentSpec[];
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
//#region src/intents.d.ts
interface IntentHit {
  id: string;
  label_zh: string;
  score: number;
  hits: string[];
}
interface EvidenceLexicon {
  interventions: string[];
  genes: string[];
}
declare function detectIntents(question: string, intents: readonly IntentSpec[], lexicon?: EvidenceLexicon): IntentHit[];
/** Drugs, supplements and genes the question names, for the evidence lookup. */
declare function mentionedEntities(question: string, intents: readonly IntentSpec[], lexicon: EvidenceLexicon): string[];
declare function loadEvidenceLexicon(home: string): EvidenceLexicon;
//#endregion
//#region src/measurements.d.ts
interface MeasurementIn {
  key: string;
  value: number | string;
  unit?: string;
}
interface Problem {
  key: string;
  label: string;
  kind: 'missing' | 'unit' | 'unit_missing' | 'range' | 'parse' | 'duplicate' | 'unknown';
  message_zh: string;
}
interface Staged {
  values: Record<string, number>;
  csv: string;
  problems: Problem[];
  used: Array<{
    key: string;
    from: string;
    unit: string;
    factor: number;
  }>;
}
interface RecordIndicator {
  name: string;
  value: string;
  unit: string;
  loinc?: string;
}
declare function unitFactor(spec: InputSpec, unit: string): number | null;
/** Validate and convert measurements; build the CSV in the input's own units. */
declare function stageMeasurements(card: SkillCard, items: readonly MeasurementIn[]): Staged;
interface Runnable {
  status: 'ready' | 'partial' | 'none' | 'unknown';
  have: string[];
  missing: string[];
  from_record: MeasurementIn[];
}
/** Which of this skill's required inputs the record, the profile and past outputs already supply. */
declare function runnableFrom(card: SkillCard, indicators: readonly RecordIndicator[], profile: {
  age: number | null;
  sex: string;
}, outputs?: Record<string, unknown>): Runnable;
//#endregion
//#region src/match.d.ts
interface MatchHit {
  name: string;
  domain: string;
  blurb: string;
  score: number;
  why: string[];
  has_script: boolean;
  tier: string;
  runnable: {
    status: Runnable['status'];
    missing: string[];
  };
}
interface DomainRow {
  domain: string;
  count: number;
  names: string[];
}
interface MatchOptions {
  intents?: readonly IntentSpec[];
  explicitIntents?: readonly string[];
  profile?: {
    age: number | null;
    sex: string;
  };
  outputs?: Record<string, unknown>;
  lexicon?: EvidenceLexicon;
}
interface MatchResult {
  matches: MatchHit[];
  near: MatchHit[];
  intents: IntentHit[];
  note: string;
}
declare function domainSummary(cards: readonly SkillCard[]): DomainRow[];
declare function organismsAsked(question: string): Set<string>;
declare function organismOf(card: SkillCard): string | null;
declare function matchSkills(cards: readonly SkillCard[], query: string, indicators: readonly (string | RecordIndicator)[], limit: number, options?: MatchOptions): MatchResult;
//#endregion
//#region src/units.d.ts
declare function normalizeUnit(text: string | null | undefined): string;
declare function foldName(text: string): string;
declare function nameVariants(text: string): string[];
declare function parseNumber(raw: unknown): number | null;
//#endregion
//#region src/history.d.ts
interface OutputValue {
  value: number | string | null;
  unit: string;
  label_zh: string;
}
interface HistoryRow {
  at: string;
  skill: string;
  revision: string;
  outputs: Record<string, OutputValue>;
}
interface LatestOutput extends OutputValue {
  at: string;
  skill: string;
}
declare function readResultFile(path: string): Record<string, OutputValue>;
declare function recordOutputs(dataDir: string, row: HistoryRow): void;
declare function readHistory(dataDir: string, limit?: number): HistoryRow[];
/** The most recent non-null value of each output key. */
declare function latestOutputs(dataDir: string): Record<string, LatestOutput>;
/** Every recorded value of one output key, oldest first, for before-and-after readings. */
declare function seriesOf(dataDir: string, key: string): Array<{
  at: string;
  value: number | string;
  skill: string;
}>;
//#endregion
//#region src/stats.d.ts
interface SkillStats {
  skill: string;
  runs: number;
  ok: number;
  error_kinds: Record<string, number>;
  problem_kinds: Record<string, number>;
  missing_inputs: Record<string, number>;
}
interface Stats {
  schema: 'longpi-stats/1';
  week: string;
  since: string;
  until: string;
  runs: number;
  skills: SkillStats[];
}
declare function buildStats(dataDir: string, days?: number, now?: Date): Stats;
declare function writeStats(dataDir: string, now?: Date): string;
//#endregion
//#region src/mirobody.d.ts
interface MountState {
  mounted: boolean;
  peer: boolean;
  error: string;
  pluginHome: string;
}
//#endregion
//#region src/tools.d.ts
declare function manifestSummary(card: SkillCard): {
  tier: Tier;
  kind: string;
  species: string[];
  intents: string[];
  inputs_status: "none" | "draft" | "verified";
  structured_measurements: boolean;
  inputs: {
    note?: string | undefined;
    output_of?: string[] | undefined;
    key: string;
    label: string;
    unit: string;
    also_accepts: string[];
    unit_required: boolean;
    range: [number, number] | null;
    required: boolean;
    from: "measurements" | "profile" | "argument" | "output";
  }[];
  outputs: OutputSpec[];
  runtime: string;
};
declare function versionCheck(catalog: Catalog, pinned: string): {
  pinned: string;
  catalog: string;
  matches: boolean | null;
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
  loinc?: string;
}
interface MedicationRow {
  name: string;
  status: string;
  recorded_dose: string;
}
declare function summarizeIndicators(payload: unknown, max?: number): IndicatorRow[];
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
  measurements?: MeasurementIn[];
  profile?: {
    age: number | null;
    sex: string;
  };
  useProfile?: boolean;
  runtimes?: Record<string, string>;
  reportLimit?: number;
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
  report_text?: string;
  stdout_tail: string;
  stderr_tail: string;
  outputs?: Record<string, OutputValue>;
  problems?: Problem[];
  autofilled?: string[];
  runtime?: string;
}
interface Receipt {
  at: string;
  skill: string;
  revision: string;
  exit_code: number | null;
  ok: boolean;
  excerpt: string;
  error_kind?: string;
  input_keys?: string[];
  problem_kinds?: string[];
  missing?: string[];
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
  outputs?: Record<string, LatestOutput>;
}): {
  product: string;
  version: string;
  profile: Profile;
  estimated_age: number | null;
  skills: {
    home_set: boolean;
    revision: string;
    version: string;
    count: number;
    personal: number;
    error: string;
    domains: {
      domain: string;
      count: number;
    }[];
    intents: {
      id: string;
      label: string;
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
    indicator_count: number;
    indicators: IndicatorRow[];
    medications: MedicationRow[];
  };
  dispatch: {
    matches: MatchHit[];
    note: string;
  };
  near: MatchHit[];
  readouts: {
    at: string;
    skill: string;
    value: number | string | null;
    unit: string;
    label_zh: string;
    key: string;
  }[];
  receipts: Receipt[];
  boundary: string;
};
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-longpi";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { Config, EMPTY_PROFILE, HARNESS_SKILLS, PRODUCT_VERSION, TOOL_NAMES, apply, buildBoard, buildStats, commandExcerpt, detectIntents, domainSummary, estimatedAge, foldName, inject, latestOutputs, loadCatalog, loadEvidenceLexicon, manifestSummary, matchSkills, mentionedEntities, name, nameVariants, normalizeProfile, normalizeUnit, organismOf, organismsAsked, parseFrontmatter, parseNumber, parseReadme, preGuard, readHistory, readProfile, readReceipts, readResultFile, recordOutputs, rememberMedications, reportExcerpt, resolveDataDir, resolveMirobodyPlugin, resolveSkillsHome, runSkill, runnableFrom, seriesOf, stageMeasurements, summarizeIndicators, summarizeMedications, unitFactor, versionCheck, wrapGuardMessage, writeProfile, writeStats };