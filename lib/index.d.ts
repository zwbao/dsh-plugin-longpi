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
declare const PRODUCT_VERSION = "5.0.0";
declare const TOOL_NAMES: readonly ["read_personal_situation", "list_longevity_intents", "match_longevity_skills", "read_longevity_skill", "run_longevity_skill", "query_longevity_evidence", "list_longevity_domains", "save_personal_profile", "longpi_status", "save_intervention_plan", "draft_intervention_plan", "log_intervention_checkin", "save_self_measurement", "read_intervention_plan", "review_interventions", "model_intervention_goals", "set_followup", "send_followup_message"];
declare const HARNESS_SKILLS: readonly ["longpi-dispatch", "longpi-board", "longpi-boundary", "longpi-interventions"];
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
  /** Flag for a CSV of target values; the script then writes out/levers.json. */
  targets_flag?: string;
  levers_json?: boolean;
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
  /** Each accepted value: which input it filled, and the unit conversion applied. */
  used: Array<{
    key: string;
    from: string;
    unit: string;
    factor: number;
    given_unit: string;
    raw: number;
    value: number;
  }>;
}
interface RecordIndicator {
  name: string;
  value: string;
  unit: string;
  loinc?: string;
  label?: string;
  date?: string;
  source?: 'self';
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
  /** Local date of the measurements the run read, when it read an earlier checkup. */
  measured_at?: string;
}
interface LatestOutput extends OutputValue {
  at: string;
  skill: string;
  measured_at?: string;
}
declare function readResultFile(path: string): Record<string, OutputValue>;
declare function recordOutputs(dataDir: string, row: HistoryRow): void;
declare function readHistory(dataDir: string, limit?: number): HistoryRow[];
/** The value of each output key read from the most recent measurements (not the most recent run). */
declare function latestOutputs(dataDir: string): Record<string, LatestOutput>;
/**
 * Every recorded value of one output key, oldest measurement first, one per
 * measurement date (a rerun on the same checkup replaces the earlier run).
 */
declare function seriesOf(dataDir: string, key: string): Array<{
  at: string;
  value: number | string;
  skill: string;
  measured_at?: string;
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
/**
 * Yes/no facts a risk equation needs and a record does not hold (China-PAR).
 * The person states them; absent means not stated, never "no".
 */
declare const RISK_FACTS: readonly ["smoker", "diabetes", "bp_treated", "north", "urban", "family_history"];
type RiskFact = (typeof RISK_FACTS)[number];
declare const RISK_FACT_ZH: Record<RiskFact, string>;
/** Bump when the first-run notice changes, so the person reads the new one before it counts as accepted. */
declare const CONSENT_VERSION = "2026-09-24";
/** What the person cares about most, in their order: used to order results and suggestions. */
declare const FOCUS: readonly ["bioage", "cardio", "glucose", "weight", "sleep", "plan"];
type Focus = (typeof FOCUS)[number];
declare const FOCUS_ZH: Record<Focus, string>;
interface Consent {
  version: string;
  accepted_at: string;
}
interface Profile {
  displayName: string;
  birthYear: number | null;
  age: number | null;
  sex: Sex;
  risk: Partial<Record<RiskFact, boolean>>;
  focus: Focus[];
  consent: Consent | null;
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
/**
 * Apply a partial update: fields that are absent keep their saved value; a risk fact set to null is cleared.
 * consent in the update is ignored: only the person accepts the notice, through setConsent.
 */
declare function mergeProfile(current: Profile, update: Record<string, unknown>): Record<string, unknown>;
declare function estimatedAge(birthYear: number | null, nowYear: number): number | null;
declare function readProfile(dataDir: string): Profile;
declare function writeProfile(dataDir: string, profile: Profile): void;
/** Record that the person accepted (or withdrew from) the current first-run notice. Never called on the model's word. */
declare function setConsent(dataDir: string, accept: boolean, now?: Date): Consent | null;
//#endregion
//#region src/compact.d.ts
interface CompactMeta {
  window: string;
  tz: string;
  resolution: string;
  aggregate: string;
  rows: number | null;
  total: number | null;
  truncated: boolean;
}
interface CompactTable {
  rows: Array<Record<string, string>>;
  meta: CompactMeta;
  notes: string[];
  error?: {
    kind: string;
    message: string;
  };
}
declare function parseCompact(text: string): CompactTable;
/**
 * The table inside one MCP tool payload. Mirobody wraps it as {result: "<table>",
 * status, row_count, truncated}; a transport may hand over the bare text. Returns
 * null when the payload is not a compact table (an older JSON shape).
 */
declare function tableOf(payload: unknown): CompactTable | null;
/** A cell as a number, or null for an empty or non-numeric cell ("Positive", "<0.5"). */
declare function cellNumber(value: string | undefined): number | null;
//#endregion
//#region src/situation.d.ts
interface IndicatorRow {
  /** Mirobody's indicator name: the handle a later query must pass back verbatim. */
  name: string;
  value: string;
  unit: string;
  loinc?: string;
  /** The name as printed on the source report (白蛋白), when Mirobody kept it. */
  label?: string;
  /** Local date of the value. */
  date?: string;
  count?: number;
  first_date?: string;
  last_date?: string;
  /** A measurement the person took and entered themselves (selfmeasure.ts), not a Mirobody row. */
  source?: 'self';
}
interface MedicationRow {
  name: string;
  status: string;
  recorded_dose: string;
  schedule?: string;
  since?: string;
  until?: string;
  plan_id?: string;
}
/** Rows of a Mirobody catalogue or latest table as indicator rows. */
declare function indicatorsFromTable(table: CompactTable): IndicatorRow[];
declare function summarizeIndicators(payload: unknown, max?: number): IndicatorRow[];
declare function summarizeMedications(payload: unknown): MedicationRow[];
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
//#region src/selfmeasure.d.ts
declare const SELF_KEYS: readonly ["waist", "sbp", "dbp", "weight"];
type SelfKey = (typeof SELF_KEYS)[number];
declare const SELF_SPEC: Record<SelfKey, {
  label_zh: string;
  unit: string;
  loinc: string;
  min: number;
  max: number;
  units: Record<string, number>;
}>;
/**
 * Other ways a record names the same measure: a checkup row with no LOINC code
 * (腰围), a different LOINC code for it (3141-9 is a measured body weight), or
 * an English report name. mergeSelf counts all of them as the same thing.
 */
declare const SELF_ALIASES: Record<SelfKey, {
  names: string[];
  loinc: string[];
}>;
interface SelfRow {
  id: string;
  key: SelfKey;
  value: number;
  unit: string;
  date: string;
  saved_at: string;
  given?: {
    value: number;
    unit: string;
  };
}
declare function readSelf(dataDir: string): SelfRow[];
/** Check each entry the person stated, convert it to the canonical unit, and append the ones that pass. */
declare function addSelf(dataDir: string, entries: unknown[], opts: {
  today: string;
  now?: Date;
}): {
  saved: SelfRow[];
  problems: string[];
};
declare function deleteSelf(dataDir: string, id: string): boolean;
type SelfLatest = Partial<Record<SelfKey, {
  value: number;
  unit: string;
  date: string;
  n: number;
}>>;
declare function latestSelf(rows: readonly SelfRow[]): SelfLatest;
/** The latest self measurements as record rows, so the skills and markers can read them like any other. */
declare function selfIndicators(rows: readonly SelfRow[]): IndicatorRow[];
/** One point per date (the mean of that day's readings), oldest first, for charts and verdicts. */
declare function selfSeries(rows: readonly SelfRow[], key: SelfKey): SeriesPoint[];
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
/** Forget cached record reads, after a change the next read must see. */
declare function invalidateRecords(): void;
declare function loadRecords(config: Config, dataDir: string, pluginHome: string): Promise<RecordSnapshot>;
/**
 * Add the person's own measurements to the record rows. A self row joins only
 * when it is newer than every record row measuring the same thing (same LOINC,
 * the wearable's blood-pressure and weight rows, or a row named or labelled
 * like it: 腰围, waist, 体重…), so a newer checkup always wins. It goes last:
 * indicatorFor keeps the last row per LOINC code.
 */
declare function mergeSelf(remote: IndicatorRow[], self: readonly IndicatorRow[]): IndicatorRow[];
/** Whether a record row measures the same thing as a self key, by LOINC, device name, or report name. */
declare function sameMeasure(key: SelfKey, row: Pick<IndicatorRow, 'name' | 'label' | 'loinc'>): boolean;
interface SeriesPoint {
  date: string;
  time: string;
  value: number;
  unit: string;
  file?: string;
}
interface Series {
  indicator: string;
  label?: string;
  loinc?: string;
  unit: string;
  points: SeriesPoint[];
}
interface SeriesResult {
  series: Record<string, Series>;
  error?: string;
  truncated: boolean;
}
/**
 * Dated values of named indicators, oldest first. resolution raw returns every
 * reading (labs); day returns one daily mean per indicator (wearables). Values
 * that are not numbers ("Positive", "<0.5") are left out, never guessed.
 */
declare function loadSeries(config: Config, names: readonly string[], options: {
  start: string;
  end: string;
  resolution: 'raw' | 'day';
}): Promise<SeriesResult>;
interface DoseRow {
  date: string;
  medication: string;
  status: string;
  plan_id: string;
}
interface CourseRow {
  medication: string;
  start: string;
  end: string;
  closed_by: string;
  plan_id: string;
}
/** Doses recorded taken or skipped for one medication, read in windows under Mirobody's row cap. */
declare function loadDoseLog(config: Config, medication: string, start: string, end: string): Promise<{
  rows: DoseRow[];
  error?: string;
}>;
/** Medication courses with their start and end dates: the dates a change could confound a lab. */
declare function loadCourses(config: Config): Promise<{
  rows: CourseRow[];
  error?: string;
}>;
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
  /** Local date the measurements were taken, when the run reads an earlier checkup. */
  measuredAt?: string;
}
interface Conversion {
  key: string;
  label: string;
  from: string;
  to: string;
  line_zh: string;
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
  /** Unit conversions the harness applied before the script ran. */
  conversions?: Conversion[];
  measured_at?: string;
  /** out/levers.json (schema longevity-levers/1), when the skill writes it. */
  levers?: Levers;
}
interface Levers {
  schema: 'longevity-levers/1';
  model: string;
  model_zh?: string;
  current: Record<string, number | string | null>;
  sensitivity: Array<{
    key: string;
    label_zh: string;
    unit: string;
    value: number;
    years_per_unit?: number;
    per_unit?: number;
  }>;
  levers: Array<{
    key: string;
    label_zh: string;
    unit: string;
    from: number;
    to: number;
    phenoage_delta?: number;
    mortality_delta_pct?: number;
    risk_delta_pct?: number;
  }>;
  targets?: Record<string, unknown>;
  note_zh?: string;
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
    measured_at?: string;
    value: number | string | null;
    unit: string;
    label_zh: string;
    key: string;
  }[];
  receipts: Receipt[];
  boundary: string;
};
//#endregion
//#region src/interventions.d.ts
declare const CATEGORIES: readonly ["diet", "exercise", "sleep", "supplement", "drug", "behavior", "weight", "other"];
type Category = typeof CATEGORIES[number];
interface Target {
  /** A Mirobody indicator measured daily, such as dailySteps or dailyTotalSleepTime. */
  metric: string;
  op: '>=' | '<=';
  value: number;
  unit: string;
}
interface PlanItem {
  id: string;
  category: Category;
  title: string;
  detail: string;
  start: string;
  end: string | null;
  frequency: {
    times: number;
    per: 'day' | 'week';
  } | null;
  target: Target | null;
  markers: string[];
  mirobody: {
    medication: string;
    plan_id?: string;
  } | null;
}
interface PlanGoal {
  marker: string;
  value: number;
  unit: string;
}
interface PlanVersion {
  schema: 'longpi-plan/1';
  version: number;
  saved_at: string;
  title: string;
  source: 'chat' | 'file' | 'board';
  note: string;
  items: PlanItem[];
  goals: PlanGoal[];
}
interface CheckIn {
  at: string;
  date: string;
  item: string;
  done: boolean | null;
  amount: number | null;
  unit: string;
  note: string;
  tags: string[];
  source: 'chat' | 'board';
}
declare function readPlans(dataDir: string): PlanVersion[];
declare function currentPlan(dataDir: string): PlanVersion | null;
declare function readCheckIns(dataDir: string): CheckIn[];
declare function isoDay(at?: Date): string;
declare function addDays(iso: string, days: number): string;
declare function daysBetween(from: string, to: string): number;
interface NormalizeContext {
  today: string;
  /** Names on the person's Mirobody medication plan, with plan ids. */
  medications: Array<{
    name: string;
    plan_id?: string;
  }>;
  previous: PlanVersion | null;
}
interface Normalized {
  plan: Omit<PlanVersion, 'version' | 'saved_at'>;
  warnings: string[];
  errors: string[];
}
/**
 * Check a plan the person described or uploaded and put it in the stored shape.
 * Returns errors that stop saving and warnings to read back before confirming.
 */
declare function normalizePlan(raw: unknown, context: NormalizeContext): Normalized;
declare function savePlan(dataDir: string, plan: Normalized['plan']): PlanVersion;
interface CheckInResult {
  saved: CheckIn[];
  problems: string[];
}
/** Record check-ins against items of the current plan. `item` may be an id or a title. */
declare function addCheckIns(dataDir: string, entries: unknown[], context: {
  today: string;
  source: 'chat' | 'board';
}): CheckInResult;
//#endregion
//#region src/reference.d.ts
interface BiovarMarker {
  key: string;
  label_zh: string;
  loinc: string[];
  device_codes?: string[];
  aliases?: string[];
  unit: string;
  cvi_pct: number;
  cvi_ci_pct?: [number, number];
  cva_pct?: number | null;
  log_normal: boolean;
  better: 'lower' | 'higher' | 'range' | 'none';
  min_retest_days?: number | null;
  retest_note_zh?: string;
  cvi_source: {
    title: string;
    url: string;
    doi?: string;
    note?: string;
  };
  retest_source?: {
    title: string;
    url: string;
    doi?: string;
  };
  /** Factors that convert another unit into this row's unit (mg/dL → mmol/L for triglycerides). */
  convert?: Record<string, number>;
  /** Compare means over this many days, because the CVI was measured on such means (home blood pressure). */
  average_days?: number;
  population?: string;
  verified: boolean;
}
interface Biovar {
  z: number;
  default_cva_rule_zh: string;
  markers: BiovarMarker[];
}
interface EffectRow {
  id: string;
  intervention: string;
  intervention_zh: string;
  keywords?: string[];
  category: string;
  marker: string;
  marker_zh: string;
  marker_key?: string;
  loinc?: string[];
  effect: {
    kind: 'mean_difference' | 'percent_change' | 'per_unit' | 'standardized' | 'rate';
    value: number;
    unit: string;
    ci?: [number, number];
    per?: string;
  };
  duration_weeks?: number | null;
  population: string;
  design: string;
  trials?: number | null;
  participants?: number | null;
  doi: string;
  quote: string;
  note_zh?: string;
  verified: boolean;
  /** person, or quote_match: a script matched the quote against the source text and found every number in it. */
  verified_by?: 'person' | 'quote_match';
}
interface Reference {
  biovar: Biovar;
  effects: EffectRow[];
  error?: string;
}
declare function loadReference(skillsHome: string): Reference;
/** The biological-variation row for one indicator, by LOINC code, device code, or name. */
declare function markerFor(biovar: Biovar, indicator: {
  name?: string;
  loinc?: string;
  label?: string;
}): BiovarMarker | null;
/**
 * Reference change value as fractions of the first result: a later result
 * outside [down, up] is unlikely (at z) to be noise alone. Symmetric for
 * normally distributed markers; asymmetric (log-normal) for right-skewed ones
 * such as CRP and triglycerides.
 */
declare function rcvBand(marker: BiovarMarker, z: number): {
  up: number;
  down: number;
  cva_pct: number;
  cva_default: boolean;
};
/** Trial effects on one marker for an intervention described in a person's plan. */
declare function effectsFor(effects: readonly EffectRow[], item: {
  category: string;
  title: string;
  detail?: string;
}, marker: BiovarMarker | null, loinc?: string): EffectRow[];
//#endregion
//#region src/evaluate.d.ts
type Verdict = '有效' | '波动内' | '反向' | '无法判断';
interface ResolvedMarker {
  /** The marker as the plan named it. */
  asked: string;
  label: string;
  /** Mirobody indicator name holding its values, when the record has it. */
  indicator: string | null;
  loinc?: string;
  unit: string;
  biovar: BiovarMarker | null;
}
interface Adherence {
  source: 'wearable' | 'dose_log' | 'check_in' | 'none';
  rate: number | null;
  coverage: number;
  known_days: number;
  done_days: number;
  window_days: number;
  level: 'good' | 'partial' | 'low' | 'unknown';
  streak: number;
  calendar: Array<{
    date: string;
    status: 'done' | 'missed' | 'unknown';
  }>;
  note_zh: string;
}
interface Expectation {
  id: string;
  text_zh: string;
  doi: string;
  verified: boolean;
  comparison: 'consistent' | 'smaller' | 'larger' | 'opposite' | 'not_comparable';
}
interface MarkerVerdict {
  item: string;
  item_title: string;
  marker: string;
  indicator: string | null;
  unit: string;
  verdict: Verdict;
  reason_zh: string;
  baseline: {
    date: string;
    value: number;
  } | null;
  followup: {
    date: string;
    value: number;
  } | null;
  change: {
    abs: number;
    pct: number;
  } | null;
  band: {
    up_pct: number;
    down_pct: number;
    verified: boolean;
    cva_default: boolean;
  } | null;
  direction: 'improved' | 'worse' | 'within' | 'unknown';
  confounders: string[];
  combined_with: string[];
  expected: Expectation[];
  next_retest: string | null;
  /** The first date a retest means anything (start + the marker's minimum interval), when a retest is suggested. Stable while next_retest moves with today. */
  first_due: string | null;
}
interface ItemSummary {
  id: string;
  title: string;
  category: string;
  category_zh: string;
  start: string;
  end: string | null;
  days: number;
  adherence: Adherence;
  verdicts: MarkerVerdict[];
  headline: Verdict;
}
interface Suggestion {
  kind: 'adherence' | 'retest' | 'missing_marker' | 'one_change' | 'review' | 'worse' | 'acute' | 'lever' | 'record';
  priority: number;
  text_zh: string;
  item?: string;
  marker?: string;
  date?: string;
}
declare function resolveMarkers(names: readonly string[], indicators: ReadonlyArray<{
  name: string;
  loinc?: string;
  label?: string;
  unit?: string;
  source?: 'self';
}>, biovar: Biovar): ResolvedMarker[];
/**
 * How well one item was followed over [start, end]. Missing data is unknown,
 * never a miss: a dose absent from the log is not evidence it was skipped.
 */
declare function adherenceFor(item: PlanItem, window: {
  start: string;
  end: string;
}, data: {
  daily?: SeriesPoint[];
  doses?: DoseRow[];
  checkins: CheckIn[];
}, calendarDays?: number): Adherence;
interface EvaluateInput {
  goals?: PlanVersion['goals'];
  plan: PlanVersion;
  today: string;
  markers: Record<string, ResolvedMarker>;
  series: Record<string, SeriesPoint[]>;
  adherence: Record<string, Adherence>;
  courses: CourseRow[];
  checkins: CheckIn[];
  biovar: Biovar;
  effects: EffectRow[];
}
declare function evaluateMarker(item: PlanItem, marker: ResolvedMarker, input: EvaluateInput): MarkerVerdict;
declare function evaluatePlan(input: EvaluateInput): ItemSummary[];
interface LeverHint {
  label: string;
  from: string;
  to: string;
  years: number;
}
/**
 * Concrete next steps within the harness's boundary: follow the plan, retest on
 * time, measure what is missing, change one thing at a time, and discuss a
 * plan that is not working with the doctor or coach. Never a dose.
 */
declare function suggestNext(summaries: readonly ItemSummary[], context: {
  today: string;
  levers?: LeverHint[];
}): Suggestion[];
//#endregion
//#region src/tracking.d.ts
declare const PHENOAGE_SKILL = "accelerated-biological-aging-risk";
declare const RISK_SKILL = "china-par-ascvd-risk";
interface TrackingContext {
  config: Config;
  dataDir: string;
  skillsHome: string;
  catalog: Catalog;
  records: RecordSnapshot;
  today: string;
}
interface BioAgePoint {
  date: string;
  phenoage: number;
  advance: number | null;
  mortality_10y_pct: number | null;
}
interface BioAge {
  status: 'ok' | 'no_skill' | 'no_record' | 'missing_inputs' | 'no_age' | 'no_checkup' | 'error';
  note_zh: string;
  missing: string[];
  points: BioAgePoint[];
  /** Change in years that within-person variation alone could explain (two-sided, z from the table). */
  band_years: number | null;
  band_verified: boolean;
  /** Inputs with no published within-person variation, left out of the band (so the band is a lower bound). */
  band_missing: string[];
  runs: number;
}
interface ModelCard {
  model: 'phenoage' | 'china-par';
  title_zh: string;
  status: 'ok' | 'no_goal' | 'unavailable';
  note_zh: string;
  measured_on: string | null;
  now: Record<string, number | null>;
  goal: Record<string, number | null> | null;
  /** The skill's own risk category (低危, 中危, 高危), now and at the goals. */
  category_zh?: {
    now: string;
    goal: string | null;
  };
  /** Everything the model still needs, by its Chinese name: missing_labs then missing_facts. */
  missing?: string[];
  /** Measurements the record (or the person's own measurements) does not hold yet. */
  missing_labs?: string[];
  /** Stated facts the profile does not hold yet (age, sex, the yes/no facts); unknown is never no. */
  missing_facts?: string[];
  levers: LeverHint[];
  /**
   * How far one within-person step of each input moves the model, largest first: years of phenotypic age,
   * or for china-par percentage points of 10-year risk. key is the biological-variation key (or waist).
   */
  sensitivity: Array<{
    label: string;
    unit: string;
    years_per_step: number;
    step: string;
    key?: string;
  }>;
  boundary_zh: string;
}
interface MarkerChart {
  key: string;
  label: string;
  indicator: string;
  unit: string;
  better: string;
  points: Array<{
    date: string;
    value: number;
  }>;
  band: {
    base: number;
    base_date: string;
    low: number;
    high: number;
    verified: boolean;
  } | null;
  goal: number | null;
  items: string[];
}
interface Tracking {
  status: 'no_plan' | 'ok';
  today: string;
  plan: PlanVersion | null;
  versions: Array<{
    version: number;
    saved_at: string;
    title: string;
    items: number;
  }>;
  items: ItemSummary[];
  suggestions: Suggestion[];
  charts: MarkerChart[];
  bioage: BioAge;
  models: ModelCard[];
  checkins: CheckIn[];
  reference: {
    biovar_markers: number;
    biovar_verified: number;
    effects: number;
    effects_verified: number;
    error?: string;
  };
  errors: string[];
}
declare function invalidateTracking(): void;
declare function buildTracking(context: TrackingContext): Promise<Tracking>;
/** The blocker when Mirobody is configured but the read failed. */
declare function readFailed(records: Pick<RecordSnapshot, 'record_error'>): string;
/**
 * The home blood pressure a risk equation should see: the mean of every home
 * reading, the wearable cuff's and the ones the person typed, in the 7 days
 * ending at the latest of them (days −6 to 0, the same window latestSelf uses).
 * A typed reading joins the cuff's week; it never displaces it.
 */
declare function homeBloodPressure(context: TrackingContext): Promise<{
  value: number;
  unit: string;
  date: string;
  n: number;
} | null>;
/** Model cards for goal values named in conversation, without saving them to the plan. */
declare function modelGoals(context: TrackingContext, goals: PlanVersion['goals']): Promise<{
  models: ModelCard[];
  how_to_read: string;
}>;
//#endregion
//#region src/overview.d.ts
interface Readiness {
  ready: Array<{
    name: string;
    blurb: string;
    domain: string;
  }>;
  near: Array<{
    name: string;
    blurb: string;
    missing: string[];
  }>;
  /** A missing measurement, and the methods it alone would complete. */
  unlock: Array<{
    item: string;
    skills: string[];
  }>;
  declared: number;
}
declare function readiness(catalog: Catalog, records: RecordSnapshot, outputs: Record<string, unknown>): Readiness;
interface ReadyRun {
  skill: string;
  ok: boolean;
  excerpt: string;
  outputs: Record<string, {
    value: number | string | null;
    unit: string;
    label_zh: string;
  }>;
  error?: string;
}
/** Run every method the record already supplies (at most `limit`), with values exactly as recorded. */
declare function runReady(context: {
  config: Config;
  dataDir: string;
  skillsHome: string;
  catalog: Catalog;
  records: RecordSnapshot;
  outputs: Record<string, unknown>;
}, limit?: number): Promise<ReadyRun[]>;
/** A plain Markdown summary for a doctor or coach: data, not advice. */
declare function buildReport(input: {
  name: string;
  today: string;
  records: RecordSnapshot;
  tracking: Tracking | null;
}): string;
//#endregion
//#region src/journey.d.ts
type Stage = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine';
interface Journey {
  version: string;
  today: string;
  consent: {
    accepted: boolean;
    version: string;
    accepted_at: string | null;
    current: string;
  };
  profile: {
    displayName: string;
    birthYear: number | null;
    age: number | null;
    sex: 'female' | 'male' | 'other' | 'unknown';
    risk: Partial<Record<RiskFact, boolean>>;
    focus: Focus[];
    complete: boolean;
    questions: Array<{
      key: 'age' | 'sex' | RiskFact;
      label_zh: string;
      unlocks_zh: string;
      answered: boolean;
      men_only?: boolean;
    }>;
  };
  focus_options: Array<{
    key: Focus;
    label_zh: string;
  }>;
  records: {
    status: 'unconfigured' | 'ok' | 'error';
    error: string;
    indicator_count: number;
    full_checkups: number;
    latest_checkup: string | null;
    mirobody_mounted: boolean;
  };
  results: {
    /** band_verified and band_missing are additions for the model: with band_missing the band is a lower bound. */
    bioage: {
      status: 'ok' | 'blocked';
      phenoage: number | null;
      advance: number | null;
      date: string | null;
      checkups: number;
      band_years: number | null;
      band_verified: boolean;
      band_missing: string[];
      blocker_zh: string;
      missing: string[];
    };
    risk: {
      status: 'ok' | 'blocked';
      risk_pct: number | null;
      category_zh: string;
      date: string | null;
      blocker_zh: string;
      missing_labs: string[];
      missing_facts: string[];
    };
  };
  addons: Array<{
    item_zh: string;
    unlocks_zh: string;
    self_measurable: boolean;
    self_key?: SelfKey;
  }>;
  self: {
    latest: Array<{
      key: SelfKey;
      label_zh: string;
      value: number;
      unit: string;
      date: string;
      n: number;
    }>;
    keys: Array<{
      key: SelfKey;
      label_zh: string;
      unit: string;
      units: string[];
    }>;
  };
  plan: {
    exists: boolean;
    title: string;
    version: number | null;
    items: number;
    started: string | null;
    days: number | null;
    checkin_items: Array<{
      id: string;
      title: string;
      done_today: boolean;
    }>;
    streak: number;
    adherence_pct: number | null;
  };
  reminders: Array<{
    kind: 'retest' | 'checkin';
    text_zh: string;
    date: string | null;
    due: boolean;
  }>;
  stage: Stage;
  next: {
    stage: Stage;
    title_zh: string;
    detail_zh: string;
    action: 'consent' | 'profile' | 'records' | 'addons' | 'plan' | 'checkin' | 'review' | 'open';
  };
  suggestions: Array<{
    id: string;
    text_zh: string;
  }>;
  boundary_zh: string;
}
declare function buildJourney(context: TrackingContext & {
  mount: MountState;
}): Promise<Journey>;
/** The journey and the tracking it was built from (retest dates, bands, adherence calendars). */
declare function buildJourneyFull(context: TrackingContext & {
  mount: MountState;
}): Promise<{
  journey: Journey;
  tracking: Tracking;
}>;
/**
 * The value of a promise, or null when it has not settled within ms. The work
 * goes on: buildTracking memoizes the promise, so the next call picks it up.
 */
declare function within<T>(promise: Promise<T>, ms: number): Promise<{
  value: T;
} | {
  timeout: true;
}>;
/** Age is set and sex is answered (female, male or other). China-PAR's own need for male or female shows in its missing_facts. */
declare function profileComplete(profile: Pick<Profile, 'age' | 'sex'>): boolean;
/**
 * Retest dates the plan's verdicts give, the earliest per marker. The only dates LongPi suggests a retest on.
 * date moves with today once the retest is due; first_due is the day it first became due and does not move.
 */
declare function retestsOf(tracking: Tracking): Array<{
  marker: string;
  date: string;
  first_due: string;
}>;
/** Labels of the profile questions not answered yet (unknown is not an answer). */
declare function unansweredOf(profile: Profile): string[];
/**
 * Stage and next step without running anything, for the synchronous /longpi
 * command: exact up to the records step, after that the journey last built in
 * this process (by the page or a tool), or null when there is none yet.
 */
declare function stageNow(profile: Profile, mcpConfigured: boolean): {
  stage: Stage | null;
  title_zh: string;
};
//#endregion
//#region src/calendar.d.ts
declare function escapeText(value: string): string;
/** Split a content line into 75-octet pieces without cutting a UTF-8 character; continuations start with a space. */
declare function foldLine(line: string): string;
/**
 * The day a retest event sits on: its date while that is still ahead or due
 * today for the first time; once it is overdue, tomorrow, so the 09:00 alarm
 * can still fire. The UID stays the same, so a re-import moves the one event.
 */
declare function retestDay(retest: {
  date: string;
  first_due: string;
}, today: string): {
  date: string;
  sequence: number;
};
declare function buildCalendar(journey: Journey, tracking: Tracking, opts: {
  now: Date;
}): string;
//#endregion
//#region src/planner.d.ts
declare const DRAFT_CATEGORIES: readonly ["diet", "exercise", "sleep", "weight", "behavior", "supplement"];
type DraftCategory = (typeof DRAFT_CATEGORIES)[number];
interface PlanBrief {
  today: string;
  focus: Focus[];
  /** What is worth improving, most important first. */
  priorities: Array<{
    marker_key: string;
    label_zh: string;
    value: number | null;
    unit: string;
    date: string | null;
    why_zh: string;
    source: 'phenoage_levers' | 'china_par_levers' | 'focus';
  }>;
  /** Evidence-backed options for those priorities, from data/effects.jsonl; never a drug. */
  candidates: Array<{
    id: string;
    intervention_zh: string;
    category: string;
    marker_key: string;
    label_zh: string;
    effect: {
      value: number;
      unit: string;
      kind?: string;
    };
    duration_weeks: number | null;
    population: string;
    design: string;
    doi: string;
    verified: boolean;
    expected_zh: string;
    needs_doctor: boolean;
    cautions_zh: string[];
    /** The trial average in the unit of this person's latest value, when it converts exactly; else null. Used for goals. */
    effect_in_record_unit: number | null;
    /** The evidence row's own note (left out for supplements, whose notes name study doses). */
    note_zh?: string;
    /** Forms the evidence row lists (快走、骑车…), for exercise items. */
    examples_zh: string[];
  }>;
  safety: {
    medications: string[];
    notes_zh: string[];
  };
  past_items: Array<{
    title: string;
    category: string;
    verdicts: string[];
    adherence_pct: number | null;
  }>;
  /** Daily wearable metrics on record (dailySteps, dailyTotalSleepTime): a target is only offered for these. */
  metrics: string[];
  /** Why a focus or a priority got no item (no evidence rows yet, no value on record). */
  notes_zh: string[];
  boundary_zh: string;
}
interface DraftItem {
  /** The evidence row the item came from. */
  id: string;
  category: DraftCategory;
  category_zh: string;
  title: string;
  detail: string;
  start: string;
  markers: string[];
  target: {
    metric: string;
    op: '>=' | '<=';
    value: number;
    unit: string;
  } | null;
  evidence: {
    effect_id: string;
    expected_zh: string;
    doi: string;
    verified: boolean;
    population: string;
  };
  needs_doctor: boolean;
  cautions_zh: string[];
}
interface PlanDraft {
  title: string;
  items: DraftItem[];
  goals: Array<{
    marker: string;
    value: number;
    unit: string;
    basis_zh: string;
  }>;
  notes_zh: string[];
}
interface BriefOptions {
  /** Focus for this draft only (the saved profile is not changed). */
  focus?: readonly Focus[];
  /** Markers the person asked to improve, by name or key; they come first. */
  markers?: readonly string[];
}
declare function buildPlanBrief(context: TrackingContext & {
  mount?: MountState;
}, options?: BriefOptions): Promise<PlanBrief>;
declare function expectedText(row: EffectRow): string;
/**
 * Up to maxItems (default 3) items that cover the most important priorities with the largest verified
 * effects: one item per intervention, at most one supplement, different categories first. Deterministic;
 * saves nothing. Null when there is nothing evidence-backed to propose.
 */
declare function draftPlan(brief: PlanBrief, opts: {
  today: string;
  maxItems?: number;
}): PlanDraft | null;
/**
 * The plan to save when the person accepts a draft on the page. Each item is rebuilt from the evidence
 * by its id (so nothing but what the evidence says is saved, and never a drug), goals are recomputed for
 * the items kept and filtered to the ones they kept. The caller normalizes and saves it like any plan.
 */
declare function acceptedPlan(brief: PlanBrief, posted: unknown, today: string): {
  ok: true;
  plan: Record<string, unknown>;
} | {
  ok: false;
  error: string;
  problems: string[];
};
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-longpi";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { CONSENT_VERSION, Config, type Consent, DRAFT_CATEGORIES, type DraftItem, EMPTY_PROFILE, FOCUS, FOCUS_ZH, type Focus, HARNESS_SKILLS, type Journey, PHENOAGE_SKILL, PRODUCT_VERSION, type PlanBrief, type PlanDraft, type Profile, RISK_FACTS, RISK_FACT_ZH, RISK_SKILL, type RiskFact, SELF_ALIASES, SELF_KEYS, SELF_SPEC, type SelfKey, type SelfRow, type Stage, TOOL_NAMES, acceptedPlan, addCheckIns, addDays, addSelf, adherenceFor, apply, buildBoard, buildCalendar, buildJourney, buildJourneyFull, buildPlanBrief, buildReport, buildStats, buildTracking, cellNumber, commandExcerpt, currentPlan, daysBetween, deleteSelf, detectIntents, domainSummary, draftPlan, effectsFor, escapeText, estimatedAge, evaluateMarker, evaluatePlan, expectedText, foldLine, foldName, homeBloodPressure, indicatorsFromTable, inject, invalidateRecords, invalidateTracking, isoDay, latestOutputs, latestSelf, loadCatalog, loadCourses, loadDoseLog, loadEvidenceLexicon, loadRecords, loadReference, loadSeries, manifestSummary, markerFor, matchSkills, mentionedEntities, mergeProfile, mergeSelf, modelGoals, name, nameVariants, normalizePlan, normalizeProfile, normalizeUnit, organismOf, organismsAsked, parseCompact, parseFrontmatter, parseNumber, parseReadme, preGuard, profileComplete, rcvBand, readCheckIns, readFailed, readHistory, readPlans, readProfile, readReceipts, readResultFile, readSelf, readiness, recordOutputs, rememberMedications, reportExcerpt, resolveDataDir, resolveMarkers, resolveMirobodyPlugin, resolveSkillsHome, retestDay, retestsOf, runReady, runSkill, runnableFrom, sameMeasure, savePlan, selfIndicators, selfSeries, seriesOf, setConsent, stageMeasurements, stageNow, suggestNext, summarizeIndicators, summarizeMedications, tableOf, unansweredOf, unitFactor, versionCheck, within, wrapGuardMessage, writeProfile, writeStats };