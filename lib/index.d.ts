import Schema from "@deepseek-ai/schemastery";
import { Context } from "@deepseek-ai/cordis";
import { JsonValue } from "@deepseek-ai/dsh-util-values";
import { UserMessage } from "@deepseek-ai/dsh-llm";
import { IncomingMessage, ServerResponse } from "node:http";
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
  /** On a DSH with no workspace, register <dataDir>/workspace as 「健康对话」 once, so a session can open. */
  bootstrapWorkspace: boolean;
}
declare const Config: Schema<Config>;
//#endregion
//#region src/json.d.ts
/**
 * A tool result as DeepSeek Harness accepts it. DSH refuses a whole tool call whose value does not survive a JSON
 * round trip unchanged (dsh-util-values walkJsonValue): one undefined property, a -0, a NaN or Infinity, a hole in
 * an array or an object that is not plain is enough. JSON.stringify hides all of these, so tests never saw them; a
 * device indicator without a LOINC code (loinc: undefined) broke read_personal_situation in a real chat. Here
 * undefined properties are dropped, undefined array items and non-finite numbers become null, -0 becomes 0, and an
 * object with toJSON (a Date) becomes its JSON form.
 */
declare function asJson(value: unknown): JsonValue;
//#endregion
//#region src/guardrails.d.ts
declare const LABEL_KEYS: readonly ["acute_emergency", "self_harm", "med_change_request", "personal_dose_request", "research_question"];
type LabelKey = typeof LABEL_KEYS[number];
type GuardLabels = Record<LabelKey, boolean> & {
  reason: string;
};
/** Names from this person's medication plan (the last Mirobody read), for the rules and as context for the classifier. */
declare function rememberMedications(names: readonly string[]): void;
declare function rememberedMedications(): string[];
/** Whether the text names a medicine or supplement: a generic word (not 山药), a known name, a drug-name ending or one of the person's own. */
declare function mentionsMedicine(text: string): boolean;
/**
 * The rule layer: labels from patterns alone. Used only when the classifier fails or times out.
 * Emergencies need an acute sign that is not negated, not a family member's history, not past and not
 * a risk question; a medicine request needs a medicine (not 山药) and a change or dose question that is
 * not a record of what the person already did.
 */
declare function ruleLabels(input: string): GuardLabels;
interface ReplyVerdict {
  personal_dose: boolean;
  med_change_advice: boolean;
  reason: string;
}
/**
 * The deterministic half of the output check: a sentence that gives an amount of a medicine or supplement
 * as advice (not a study's protocol, not their recorded prescription), or advises starting, stopping or
 * changing a named medicine without sending them to their doctor.
 */
declare function replyRuleCheck(reply: string): ReplyVerdict;
/** The self-harm line. It is also in skills/longpi-boundary/SKILL.md, which is its source; the test keeps them equal. */
declare const SELF_HARM_LINE_ZH = "有伤害自己的想法时：建议马上联系心理援助热线，或身边信任的人；如果有危险，立即拨打 120。在美国可拨打或发短信至 988。";
declare const EMERGENCY_LINE_ZH = "请立即拨打 120（不在中国时拨打当地急救电话）。";
interface GuidanceNote {
  /** Model-facing text of the note. */
  text: string;
  /** One line for the transcript row. */
  summary: string;
}
/**
 * The one note appended to a step for what was flagged, or null. Emergencies and self-harm come first;
 * a medicine or dose request gets the doctor; a research question about a medicine keeps its normal
 * answer without a personal dose.
 */
declare function guidanceNote(labels: GuardLabels, options?: {
  medicine?: boolean;
}): GuidanceNote | null;
/** The correction steered into a turn whose reply gave a dose or advised a medicine change. */
declare function correctionNote(verdict: ReplyVerdict): GuidanceNote;
type GuardHit = {
  code: 'emergency';
  reply_zh: string;
} | {
  code: 'self_harm';
  reply_zh: string;
} | {
  code: 'no_medication_change';
  reply_zh: string;
};
/** The rule layer as one hit (kept for callers of 5.0): emergency, self-harm, or a medicine request. */
declare function preGuard(text: string): GuardHit | null;
/** The guidance note for a 5.0-style hit. The person's words are not repeated: the note is appended, not substituted. */
declare function wrapGuardMessage(_text: string, hit: GuardHit): string;
//#endregion
//#region src/guard-llm.d.ts
declare const GUARD_TIMEOUT_MS = 4000;
type PreStepDecision = {
  kind: 'reject';
} | {
  kind: 'enter';
  messages: UserMessage[];
  startsRequestSeries?: true;
};
/** One model call: a system prompt and a user text in, the reply text out. Throws on any failure. */
type GuardCall = (request: {
  system: string;
  user: string;
  signal: AbortSignal;
}) => Promise<string>;
declare const CLASSIFIER_SYSTEM: string;
declare const JUDGE_SYSTEM: string;
/** The classifier's labels, or null when the output is not the JSON object asked for. */
declare function parseLabels(raw: string): GuardLabels | null;
/** The judge's verdict, or null when the output is not the JSON object asked for. */
declare function parseVerdict(raw: string): ReplyVerdict | null;
type ModelState = 'ok' | 'failed' | 'unavailable' | 'skipped';
interface Classified {
  labels: GuardLabels;
  /** Who decided: the model, or the rules because the model was unavailable or failed. */
  source: 'llm' | 'rules';
  llm: ModelState;
  error?: string;
}
/** Label one message: the model within the deadline, the rules when it fails. */
declare function classifyMessage(text: string, options: {
  call: GuardCall | null;
  medications?: readonly string[];
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<Classified>;
interface ReplyCheck {
  /** Whether to steer one correction. */
  steer: boolean;
  verdict: ReplyVerdict;
  rules: ReplyVerdict;
  judge: ReplyVerdict | null;
  llm: ModelState;
}
/**
 * The output check: the deterministic rules and, when the reply names a medicine or an amount, the
 * model judge. When the judge answered, it decides (it can tell a doctor referral or a read-back of their
 * own prescription from advice); the rules decide alone only when it failed, timed out or is unavailable.
 */
declare function checkReply(reply: string, options: {
  call: GuardCall | null;
  userText?: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}): Promise<ReplyCheck>;
interface StreamChunkLike {
  type: string;
  text?: unknown;
  block?: unknown;
  reason?: unknown;
}
/** The parts of DSH's `llm` service the guard uses. */
interface LlmLike {
  stream(options: Record<string, unknown>): AsyncIterable<StreamChunkLike>;
  resolveModelInfo?(provider: string, model: string, signal?: AbortSignal): Promise<{
    reasoning?: {
      efforts?: ReadonlyArray<{
        id: string;
        name?: string;
      }>;
    };
  }>;
}
interface Route {
  provider: string;
  model: string;
}
interface AgentLike {
  options?: {
    provider?: string;
    model?: string;
  };
  session?: SessionLike;
  steer?(message: UserMessage): void;
}
interface SessionLike {
  id?: string;
  seq?: number;
  requestHeader?(): {
    config?: {
      provider?: string;
      model?: string;
    };
  } | undefined;
  eventAt?(seq: number): EventLike | undefined;
  snapshotEvents?(): readonly EventLike[];
}
interface EventLike {
  type: string;
  seq?: number;
  data?: unknown;
}
/**
 * The provider and model this agent talks with: the logged request header, then the agent's options,
 * then DSH's default model.
 */
declare function routeFor(agent: AgentLike | undefined, ctx?: Context): Route | null;
/**
 * One classifier or judge call through DSH's LLM runtime on this route: temperature 0, a short output,
 * and reasoning off when the model offers an "off" effort (thinking would not fit the deadline).
 */
declare function runtimeCall(llm: LlmLike, route: Route, efforts?: Map<string, string | null>): GuardCall;
declare const GUARD_COUNTERS: readonly ["input_checked", "input_llm_ok", "input_llm_failed", "input_llm_unavailable", "flag_emergency", "flag_self_harm", "flag_med_change", "flag_dose", "flag_research", "note_appended", "output_checked", "output_llm_ok", "output_llm_failed", "output_llm_unavailable", "output_flag_rules", "output_flag_llm", "output_steered", "approval_asked", "approval_no_readback", "skill_blocked"];
type GuardCounter = typeof GUARD_COUNTERS[number];
/** Add counts for today. Never text: only how often the guard ran, fell back, flagged, noted, steered or asked. */
declare function countGuard(dataDir: string, counts: Partial<Record<GuardCounter, number>>, now?: Date): void;
/** Guard counts over the last `days` days. */
declare function readGuardStats(dataDir: string, days?: number, now?: Date): {
  since: string;
  until: string;
  counts: Record<GuardCounter, number>;
};
interface GuardOptions {
  dataDir: () => string;
  timeoutMs?: number;
  /** Tests and the live evaluation: the model call for an agent instead of DSH's runtime. */
  call?: (agent: AgentLike | undefined) => GuardCall | null;
}
interface PreStepPayload {
  agent?: AgentLike;
  messages: readonly UserMessage[];
  turn?: number;
  step?: number;
  signal?: AbortSignal;
}
interface TurnStoppingPayload {
  agent?: AgentLike;
  turn: number;
  signal?: AbortSignal;
}
declare function personText(messages: readonly {
  source?: {
    kind?: string;
  };
  content?: unknown;
}[]): string;
/** This turn's assistant text and the person's last message in it, from the session log. */
declare function turnText(session: SessionLike, turn: number): {
  reply: string;
  userText: string;
  last: number;
};
interface Guard {
  preStep(payload: PreStepPayload, next: () => Promise<PreStepDecision>): Promise<PreStepDecision>;
  turnStopping(payload: TurnStoppingPayload): Promise<void>;
  /** Whether this agent's current turn was flagged as an emergency or self-harm (no skill runs). */
  inEmergency(agent: unknown): boolean;
  count(counts: Partial<Record<GuardCounter, number>>): void;
}
declare function createGuard(ctx: Context, options: GuardOptions): Guard;
//#endregion
//#region src/tools-approval.d.ts
declare const READ_BACK_MS: number;
declare const NO_READ_BACK = "请先复述方案给用户确认";
/** Same normalized plan, same key: title, source, note, each item's fields in order, and the goals. */
declare function planKey(args: unknown): string;
/** What the person approves in DSH: the plan's title, then each item with its category and start date. */
declare function planApprovalReason(args: unknown): string;
/** Tests: forget every read-back. */
declare function resetReadBacks(): void;
declare function registerApprovals(ctx: Context, guard: Pick<Guard, 'inEmergency' | 'count'>): void;
//#endregion
//#region src/guard-dose.d.ts
/** Any amount that could be a dose. */
declare function hasDoseAmount(text: string): boolean;
//#endregion
//#region src/version.d.ts
declare const PRODUCT_VERSION = "5.1.0";
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
  /** Mirobody device series that hold this input (a wearable metric), like BiovarMarker.device_codes. */
  device_codes?: string[];
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
  last_date?: string;
  source?: 'self';
}
declare function unitFactor(spec: InputSpec, unit: string): number | null;
/** Validate and convert measurements; build the CSV in the input's own units. */
declare function stageMeasurements(card: SkillCard, items: readonly MeasurementIn[]): Staged;
interface Runnable {
  /** Whether the required inputs are all there (ready), one or two short (partial), or not; from any source. */
  status: 'ready' | 'partial' | 'none' | 'unknown';
  have: string[];
  missing: string[];
  from_record: MeasurementIn[];
  /**
   * The same question asked of the record alone. ready: every required input is there and at least one
   * record-backed input (a LOINC or device code) came from the record. near: only record-backed inputs are
   * missing, one or two of them. A method with no record-backed input is never ready or near from the record.
   */
  record: 'ready' | 'near' | 'none';
  /** Missing required inputs a checkup or a device could supply. */
  missing_from_record: string[];
  /** Required inputs on file whose value was not read (a failed read, or a catalogue cut short): in missing, never in missing_from_record. */
  unread: string[];
}
/** Which of this skill's required inputs the record, the profile and past outputs already supply. */
declare function runnableFrom(card: SkillCard, indicators: readonly RecordIndicator[], profile: {
  age: number | null;
  sex: string;
}, outputs?: Record<string, unknown>, reads?: {
  failed?: readonly string[];
  catalog_truncated?: boolean;
}): Runnable;
/** A record row that could hold one declared input, and its place: the order of the input's codes in skill.json. */
interface Candidate {
  row: RecordIndicator;
  /** 0… for its LOINC codes in skill.json order, then its device codes; name matches come after every code. */
  rank: number;
  by: 'code' | 'name';
}
/**
 * Every record row that could hold one input, numeric or not: rows carrying one of its LOINC or device codes,
 * best code first; or, only when no row carries a code, rows named like it (its key, label or aliases, a self
 * measurement first).
 */
declare function candidatesFor(spec: InputSpec, indicators: readonly RecordIndicator[]): Candidate[];
/**
 * The record indicator that holds one declared input: of the rows with a number, the newest across all of the
 * input's codes; on the same date the earlier code in skill.json order. Rows matched only by name are the
 * fallback when no row carries a code.
 */
declare function indicatorFor(spec: InputSpec, indicators: readonly RecordIndicator[]): RecordIndicator | null;
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
  /** record is runnableFrom's answer for the record alone: ready, near (one or two tests short) or none. */
  runnable: {
    status: Runnable['status'];
    missing: string[];
    record: Runnable['record'];
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
  /** Reads that failed (records.missing_reads) or a cut catalogue: such inputs are not read, never "missing". */
  reads?: {
    failed?: readonly string[];
    catalog_truncated?: boolean;
  };
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
  /** A hash of what the run read (the inputs, the age, the skill version): a row whose hash is not today's is stale. */
  inputs_key?: string;
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
/**
 * What the Mirobody terminology bridge gets: the same short list as a skill script (path, language) plus what it
 * needs to import mirobody: the real home (a --user install lives there), the Python path if one is set, and
 * MIROBODY_HOME. Never the rest of the harness's environment (API keys, tokens). Not a sandbox either.
 */
declare function bridgeEnv(mirobodyHome: string): Record<string, string>;
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
  /** partial: the record was read, but some reads failed or came back cut (read_errors says which). */
  record_status: 'unconfigured' | 'ok' | 'partial' | 'error';
  record_error: string;
  /** Each read that failed or was cut, in Chinese; empty when every read succeeded. */
  read_errors: string[];
  /** Catalogue names whose latest value was not read because the read failed: unknown, never "not measured". */
  missing_reads: string[];
  /** The catalogue itself was cut, so an indicator missing from it may simply not have been read. */
  catalog_truncated: boolean;
}
/** Whether the record was read, whole or in part: the reads that worked are used, the failed ones named. */
declare function recordReadable(records: Pick<RecordSnapshot, 'record_status'>): boolean;
/**
 * The account a read is for, without the token itself: another token on the same address is another account.
 * connection.ts re-exports it as connectionKey.
 */
declare function tokenKey(config: Pick<Config, 'mcpToken'>): string;
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
  /** The first failure, redacted; set whenever any name was not read. */
  error?: string;
  truncated: boolean;
  /** Names whose read failed: their series is unknown, never empty. */
  failed: string[];
  /** Names whose readings came back cut (a series that filled the row limit, or a table Mirobody marked cut). */
  cut: string[];
}
/**
 * Dated values of named indicators, oldest first. resolution raw returns every
 * reading (labs); day returns one daily mean per indicator (wearables). Values
 * that are not numbers ("Positive", "<0.5") are left out, never guessed. A
 * batch that fails does not stop the others (unless Mirobody is down or refuses
 * the account); its names are listed in failed.
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
  /** Kept with the outputs in history.jsonl, so a caller can tell a result for today's inputs from a stale one. */
  inputsKey?: string;
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
/**
 * What each run leaves in receipts.jsonl: which skill ran on which revision, how it ended, and which inputs it
 * used or missed. No report text: the report stays in the run directory, the outputs in history.jsonl.
 */
interface Receipt {
  at: string;
  skill: string;
  revision: string;
  exit_code: number | null;
  ok: boolean;
  /** Written by versions before 5.1 only; never shown. */
  excerpt?: string;
  error_kind?: string;
  input_keys?: string[];
  problem_kinds?: string[];
  missing?: string[];
}
declare function reportExcerpt(text: string): string;
/**
 * The environment a skill script gets: a path, a language, and a home and temp directory inside its own run
 * directory; no user site-packages and nothing else of the harness's environment (no keys, no tokens). This keeps
 * the script's writes and caches in the run directory. It is not a sandbox: the script runs as the same user and
 * can read whatever that user can.
 */
declare function skillEnv(runDir: string): Record<string, string>;
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
    status: "unconfigured" | "ok" | "partial" | "error";
    error: string;
    read_errors: string[];
    missing_reads: string[];
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
  receipts: {
    at: string;
    skill: string;
    ok: boolean;
    exit_code: number | null;
    error_kind: string | null;
  }[];
  boundary: string;
};
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
  /** What the reader should know about this row's band (a very small CVI, results excluded from the study). */
  caveat_zh?: string;
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
 * markerFor for a row that carries a LOINC code. A code the matched row does not list is a different
 * measurement, often another specimen (urine creatinine is 2161-8, serum 2160-0; a report may print it as
 * 肌酐(尿) or 尿肌酐(Cr)), so the name match only stands for a row with no codes of its own.
 */
declare function checkupMarkerFor(biovar: Biovar, indicator: {
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
//#region src/changes.d.ts
interface RecordChange {
  /** Biological-variation key, e.g. 'mcv'. */
  key: string;
  label_zh: string;
  /** The biological-variation row's unit; every point is converted to it. */
  unit: string;
  points: Array<{
    date: string;
    value: number;
  }>;
  /** pct is rounded to 1 decimal. */
  compare: {
    from_date: string;
    from: number;
    to_date: string;
    to: number;
    pct: number;
  };
  /** The reference change value in percent, 1 decimal, e.g. { up: 8.4, down: -8.4 }. */
  band_pct: {
    up: number;
    down: number;
  };
  direction: 'up' | 'down';
  verdict: 'better' | 'worse' | 'unclear';
  ask_doctor: boolean;
  text_zh: string;
  advice_zh: string;
  /** The row's own caveat, when it has one. */
  caveat_zh?: string;
  /** Where the within-person variation comes from (the row's cvi_source). */
  source: {
    title: string;
    url: string;
    doi?: string;
  };
  verified: boolean;
}
/** A marker the changes could not judge: its readings did not come back whole. Unknown, never "no change". */
interface UnjudgedChange {
  label_zh: string;
  reason_zh: string;
}
interface ChangesContext {
  config: Config;
  skillsHome: string;
  records: RecordSnapshot;
  today: string;
}
declare const CHANGES_NOTE_ZH = "判断依据：两次结果之差超过同一个人正常波动与检测误差合成的参考变化值（RCV，z=1.96）才算真实变化；变异数据来自 longevity-skills 的 data/biological_variation.json，每一行注明期刊出处。不同医院、不同仪器之间的差异没有算进去；如果两次不在同一家机构，请先复查确认。这不是诊断。";
/** The factor that brings a point's unit to the row's unit, from the row's own convert table; null when it cannot. The plan verdicts (evaluate.ts) use it too. */
declare function factorFor(marker: BiovarMarker, unit: string): number | null;
/**
 * Changes between checkups larger than the reference change value, ask_doctor
 * first, then the furthest past its band; at most six. Checkup rows only
 * (Mirobody rows with a LOINC code): wearable series and the person's own
 * measurements are left out. An unread record gives no changes. A marker whose
 * readings failed to read, or came back cut, is not judged at all: it is listed
 * in unjudged with the reason, so a failed read never reads as "no change".
 */
declare function buildChanges(context: ChangesContext): Promise<{
  changes: RecordChange[];
  note_zh: string;
  unjudged: UnjudgedChange[];
}>;
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
  /** true done, false an explicit miss (没做到), null a note or tag alone, or an undo. */
  done: boolean | null;
  amount: number | null;
  unit: string;
  note: string;
  tags: string[];
  source: 'chat' | 'board';
  /** Set on the row that takes back that day's check-in: the day is unknown again. */
  undo?: true;
}
declare function readPlans(dataDir: string): PlanVersion[];
declare function currentPlan(dataDir: string): PlanVersion | null;
declare function readCheckIns(dataDir: string): CheckIn[];
/**
 * Whether each item was done on each day: the latest check-in that says done (true), not done (false) or
 * takes the day back (undo) wins, in the order they were recorded. A day with no such row, or whose latest
 * is an undo, is absent: unknown, never a miss. A note or tag alone says nothing about it.
 */
declare function checkinStatus(rows: readonly CheckIn[]): Map<string, Map<string, boolean>>;
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
/** One sentence for items on the same marker at the same time; the same words whichever item it is read from. */
declare function togetherZh(titles: readonly string[]): string;
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
  /** Indicator names whose readings failed to read or came back cut: judged from nothing, never from what is left. */
  unread?: readonly string[];
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
  /** Goals the model could not use (a unit it does not accept, a value out of range), with why. Then no goal value is shown. */
  goal_problems_zh?: string[];
  /** The date each input was measured on, as used: a checkup, the home blood-pressure week, a self measurement. */
  input_dates?: Array<{
    key: string;
    label_zh: string;
    date: string | null;
    source: 'checkup' | 'device' | 'self' | 'home';
  }>;
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
  /** Changes between checkups larger than normal fluctuation (changes.ts), ask_doctor first. */
  changes: RecordChange[];
  changes_note_zh: string;
  /** Markers not judged because their readings did not come back whole: unknown, never "no change". */
  changes_unjudged: UnjudgedChange[];
}
declare function invalidateTracking(): void;
/** Bumped by every invalidateTracking (a check-in, a self measurement, a plan or profile save): readers keeping their own copy refresh on a change. */
declare function trackingGeneration(): number;
declare function buildTracking(context: TrackingContext): Promise<Tracking>;
/** The blocker when Mirobody is configured but the read failed. */
declare function readFailed(records: Pick<RecordSnapshot, 'record_error'>): string;
/** What is wrong with the plan's goals for the result models, in Chinese (empty when they can all be modelled). */
declare function goalProblems(catalog: Catalog, goals: PlanVersion['goals'], skillsHome: string): string[];
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
/** One item as it is stored, to read back before saving: what it is, when, how often, what it aims at, and its details. */
declare function describeItem(item: PlanItem): string;
/** The plan's own title and note, as stored, read back with its items. */
declare function describePlan(plan: Pick<PlanVersion, 'title' | 'note'>): string;
//#endregion
//#region src/overview.d.ts
/**
 * Methods the record itself can run (runnableFrom's record field): ready needs at least one input a checkup or
 * a device records; near and unlock name only such inputs, never a question, an argument or another method's output.
 */
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
//#region src/followup.d.ts
declare const WEBHOOK_KINDS: readonly ["feishu", "wecom", "dingtalk", "bark", "generic"];
type WebhookKind = (typeof WEBHOOK_KINDS)[number];
type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7;
interface FollowupSettings {
  enabled: boolean;
  checkin_time: string;
  retest_time: string;
  weekly: {
    day: Weekday;
    time: string;
  } | null;
  desktop: boolean;
  webhook: {
    kind: WebhookKind;
    url: string;
    secret: string;
  } | null;
  detail: 'minimal' | 'full';
  quiet: {
    start: string;
    end: string;
  } | null;
}
interface PublicFollowup extends Omit<FollowupSettings, 'webhook'> {
  webhook: {
    kind: WebhookKind;
    url_masked: string;
    secret_set: boolean;
  } | null;
}
type FollowupKind = 'checkin' | 'retest' | 'weekly' | 'nudge' | 'custom' | 'test';
interface FollowupLogRow {
  at: string;
  kind: FollowupKind;
  key: string;
  channels: {
    desktop?: boolean;
    webhook?: boolean;
  };
  ok: boolean;
  error?: string;
}
interface ChannelResult {
  ok: boolean;
  error?: string;
}
interface SendResult {
  ok: boolean;
  channels: {
    desktop?: ChannelResult;
    webhook?: ChannelResult;
  };
}
/** What the decisions need from the journey and tracking (journey.ts builds it). */
interface FollowupState {
  stage: string;
  /** When the person accepted the notice (ISO), or null. */
  consent_at: string | null;
  next_title_zh: string;
  next_detail_zh: string;
  plan_exists: boolean;
  /** How many plan items are ticked by hand (check-in items), done or not. */
  checkin_items: number;
  /** Titles of check-in items not done today. */
  checkin_open: string[];
  /** Retest dates from the plan's verdicts: date moves with today once due, first_due does not. */
  retests: Array<{
    marker: string;
    date: string;
    first_due: string;
  }>;
  week: {
    pct: number | null;
    streak: number;
    next_retest: {
      marker: string;
      date: string;
    } | null;
  };
}
interface FollowupDeps {
  platform: string;
  /** Run a command without a shell; resolves, never rejects. */
  run: (command: string, args: string[], timeoutMs: number) => Promise<ChannelResult>;
  fetch: (url: string, init: {
    method: 'POST';
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
    redirect: 'manual';
  }) => Promise<{
    ok: boolean;
    status: number;
    text: () => Promise<string>;
  }>;
}
declare const DEFAULT_FOLLOWUP: FollowupSettings;
/** At most this many sends per local day, across kinds, model-written and test ones included. */
declare const FOLLOWUP_MAX_PER_DAY = 6;
declare const FOLLOWUP_TEST_TEXT = "这是一条 LongPi 测试提醒。";
/** https for every kind, to a host that is not this machine, link-local, unspecified or a metadata service. */
declare function webhookUrlProblem(_kind: WebhookKind, url: string): string;
/** The saved settings, with defaults for anything missing or unreadable. */
declare function readFollowup(dataDir: string): FollowupSettings;
/** Check and save a partial update from the page or a tool. The file is private to the person (0600). */
declare function writeFollowup(dataDir: string, update: unknown): {
  ok: true;
  settings: FollowupSettings;
} | {
  ok: false;
  error: string;
};
/** scheme://host/… only: the rest of a webhook URL is its secret token. */
declare function maskUrl(url: string): string;
/** Settings as the page and the model see them: never the full webhook URL or the secret. */
declare function publicFollowup(settings: FollowupSettings): PublicFollowup;
declare function readFollowupLog(dataDir: string): FollowupLogRow[];
declare function appendFollowupLog(dataDir: string, row: FollowupLogRow): void;
/** Sends attempted on the local day of `now` (every kind counts, failed ones too). */
declare function sentToday(log: readonly FollowupLogRow[], now: Date): number;
/** ISO weekday of a local time: Monday = 1 … Sunday = 7. */
declare function isoWeekday(now: Date): Weekday;
/** ISO week of a local date, as 2026-W39. */
declare function isoWeek(now: Date): string;
/** Inside quiet hours; a window whose start is after its end wraps midnight (22:30–08:00). */
declare function inQuiet(quiet: FollowupSettings['quiet'], now: Date): boolean;
/**
 * When a send planned at `time` goes out: inside quiet hours it waits for them to end, the same day. A
 * time in the part of a window that runs to midnight (23:00 in 22:30–08:00) never goes out: null.
 */
declare function heldUntil(time: string, quiet: FollowupSettings['quiet']): string | null;
interface FollowupSend {
  kind: FollowupKind;
  key: string;
  text: string;
}
/**
 * What is due at `now`. Keys: checkin:<date>, retest:<marker>:<first due date> (so an overdue retest is
 * reminded once, not every day), weekly:<ISO week>, nudge:<stage>:<date>. A kind is due at or after its
 * time on its day and only while not in the log, so a send missed while the host was off goes out at the
 * next tick of the same day and never for a past day. The nudge shares the check-in time. Quiet hours
 * hold everything; a time inside them is not sent that day.
 */
declare function decideFollowup(input: {
  now: Date;
  settings: FollowupSettings;
  state: FollowupState;
  log: readonly FollowupLogRow[];
}): FollowupSend[];
/** Whether anything could be due now, from the clock, the settings and the log alone: the journey is read only then. */
declare function followupArmed(settings: FollowupSettings, log: readonly FollowupLogRow[], now: Date): boolean;
/**
 * The next time each kind is planned (local ISO, no zone), or null: none while follow-up is off. A time
 * inside quiet hours is shown when they end, and a time that can never go out is not shown at all.
 */
declare function nextTimes(settings: FollowupSettings, state: FollowupState | null, now: Date, log: readonly FollowupLogRow[]): {
  checkin: string | null;
  retest: string | null;
  weekly: string | null;
};
/** The notification command for this platform, run without a shell; null where there is none. */
declare function desktopCommand(platform: string, text: string): {
  command: string;
  args: string[];
} | null;
declare function desktopSupported(platform: string): boolean;
/** The request a webhook channel sends: URL (DingTalk signs in the query) and JSON body (Feishu signs in the body). */
declare function webhookRequest(webhook: NonNullable<FollowupSettings['webhook']>, text: string, kind: FollowupKind, now: Date): {
  url: string;
  body: Record<string, unknown>;
};
/** Whether a webhook answer means delivered: HTTP 2xx, and the service's own code when it sends one. */
declare function webhookAnswer(kind: WebhookKind, status: number, text: string): ChannelResult;
/** Swap the platform, the command runner or fetch (tests); returns a function that restores the previous ones. */
declare function setFollowupDeps(partial: Partial<FollowupDeps>): () => void;
/** Send one message through every configured channel. Each has a 10 s limit; errors are recorded, never thrown. */
declare function sendFollowup(settings: FollowupSettings, message: string, options?: {
  kind?: FollowupKind;
  now?: Date;
  deps?: FollowupDeps;
}): Promise<SendResult>;
/**
 * Send a message outside the schedule (the model's own follow-up, or the page's test): never
 * deduplicated against the scheduled kinds (key custom:<time> or test:<time>), but counted in the
 * daily limit and logged.
 */
declare function sendNow(dataDir: string, text: string, kind: FollowupKind, now?: Date): Promise<SendResult & {
  error?: string;
}>;
/** One tick: read the settings and the log, and only if something may be due, the journey; then send and log. */
declare function followupTick(input: {
  dataDir: string;
  now: Date;
  getState: () => Promise<FollowupState>;
  deps?: FollowupDeps;
}): Promise<FollowupLogRow[]>;
interface FollowupContext {
  dataDir: string;
  getState: () => Promise<FollowupState>;
  /** Changes whenever something the state is built from changed (trackingGeneration); a change forces a fresh read. */
  generation?: () => number;
}
/**
 * Tick every 60 s in the host's local time zone, as a Cordis effect: the interval is cleared when the
 * plugin is disposed, is unref'd so it never keeps the process alive, and never overlaps itself. One
 * journey read is reused the same day for up to an hour, and never after a check-in, a plan or profile
 * save or a self measurement (the generation changes), so a reminder never counts items already ticked.
 */
declare function startFollowup(ctx: Context, getContext: () => FollowupContext, options?: {
  tickMs?: number;
  now?: () => Date;
}): void;
/** The GET /api/longpi/followup answer (also the POST one, after ok: true). */
declare function followupResponse(dataDir: string, state: FollowupState | null, now?: Date): {
  settings: PublicFollowup;
  next: {
    checkin: string | null;
    retest: string | null;
    weekly: string | null;
  };
  log: {
    error?: string | undefined;
    at: string;
    kind: FollowupKind;
    key: string;
    ok: boolean;
    channels: {
      desktop?: boolean;
      webhook?: boolean;
    };
  }[];
  platform_desktop: boolean;
};
/** journey.followup: whether it is on, the channels it uses, and the next planned send. */
declare function followupSummary(dataDir: string, state: FollowupState | null, now?: Date): {
  enabled: boolean;
  channels: Array<'desktop' | 'webhook'>;
  next_at: string | null;
};
//#endregion
//#region src/groups.d.ts
declare const GROUP_KEYS: readonly ["lipids", "glucose", "inflammation", "blood", "liver", "kidney", "thyroid", "body", "wearable", "other"];
type GroupKey = (typeof GROUP_KEYS)[number];
declare const GROUP_ZH: Record<GroupKey, string>;
/** The group of a checkup row, by LOINC code, then by words in its names, then 其他. */
declare function groupOf(row: {
  loinc?: string;
  name?: string;
  label?: string;
}): GroupKey;
//#endregion
//#region src/indicators.d.ts
type IndicatorSource = 'checkup' | 'device' | 'self';
interface IndicatorChange {
  verdict: 'better' | 'worse' | 'unclear';
  ask_doctor: boolean;
  pct: number;
  band_pct: {
    up: number;
    down: number;
  };
  text_zh: string;
}
/** One row of the 指标 tab (the client's IndicatorRow). */
interface IndicatorEntry {
  /** Stable: 'loinc:<code>' | 'device:<name>' | 'self:<key>' | 'name:<folded name>'. */
  id: string;
  label_zh: string;
  unit: string;
  source: IndicatorSource;
  /** text for a result that is not a number ("阴性", "<3.0"). */
  latest: {
    date: string;
    value: number | null;
    text?: string;
  } | null;
  /** Oldest first. Checkups: one per day, the 12 most recent; device: weekly means, 26 weeks; self: daily, 30. */
  points: Array<{
    date: string;
    value: number;
  }>;
  /** From changes.ts, when it lists this indicator. */
  change: IndicatorChange | null;
  /** within: two or more checkup days and the last change inside the band; unjudged: no band, too few days, or a failed read. */
  judged: 'changed' | 'within' | 'unjudged';
  plan_marker: boolean;
  /** The series read failed or timed out: show this, never "no data". */
  read_error?: string;
}
interface IndicatorsResponse {
  /** partial: some series could not be read; their rows carry read_error. */
  record: {
    status: 'ok' | 'partial' | 'error' | 'none';
    error?: string;
  };
  updated_at: string;
  groups: Array<{
    key: GroupKey;
    label_zh: string;
    indicators: IndicatorEntry[];
  }>;
}
interface IndicatorDetail {
  row: IndicatorEntry;
  /** Every reading, oldest first, the 200 most recent, each in the unit it was recorded in. */
  all_points: Array<{
    date: string;
    value: number | null;
    text?: string;
    file?: string;
    unit: string;
  }>;
  /** The biological-variation row a checkup row is judged against. */
  biovar?: {
    cvi_pct: number;
    band_pct: {
      up: number;
      down: number;
    };
    source: {
      title: string;
      url: string;
      doi?: string;
    };
    caveat_zh?: string;
  };
}
/**
 * What the record holds, for onboarding: checkup days (distinct dates of LOINC rows), their span, the checkup
 * groups present (most rows first; 其他 left out), wearable days in the last year.
 */
interface RecordsSummary {
  checkups: number;
  first_date: string | null;
  last_date: string | null;
  categories_zh: string[];
  wearable_days: number;
}
interface IndicatorsContext {
  config: Config;
  dataDir: string;
  skillsHome: string;
  records: RecordSnapshot;
  today: string;
  /** How long the reads may take before the rows not read yet say so. Default 20 s. */
  budgetMs?: number;
}
/** GET /api/longpi/indicators. */
declare function buildIndicators(context: IndicatorsContext): Promise<IndicatorsResponse>;
/** GET /api/longpi/indicators/detail: the row, every reading (200 at most) and its band; null for an unknown id. */
declare function indicatorDetail(context: IndicatorsContext, id: string): Promise<IndicatorDetail | null>;
/** The record summary for onboarding; null when the record is not connected, or a read failed or timed out. */
declare function recordsSummary(context: IndicatorsContext): Promise<RecordsSummary | null>;
/** Forget built indicators (tests; the tracking generation already covers every change the routes make). */
declare function invalidateIndicators(): void;
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
  /**
   * status partial: read, but some reads failed or came back cut; read_errors says which, and missing_reads names
   * indicators not read (unknown, never "not measured"). summary: what the record holds, for onboarding (checkup days
   * and their span, the groups present, wearable days in the last year); null when the record is not connected, or a
   * read failed or timed out (a count would then be too small).
   */
  records: {
    status: 'unconfigured' | 'ok' | 'partial' | 'error';
    error: string;
    read_errors: string[];
    missing_reads: string[];
    indicator_count: number;
    full_checkups: number;
    latest_checkup: string | null;
    mirobody_mounted: boolean;
    summary: RecordsSummary | null;
  };
  results: {
    /**
     * band_verified and band_missing are additions for the model: with band_missing the band is a lower bound.
     * caveat_zh is set when a PhenoAge input changed beyond normal fluctuation in a direction to show a doctor.
     */
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
      caveat_zh?: string;
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
  /** Changes between checkups larger than normal fluctuation, ask_doctor first; empty when the record cannot be read. */
  changes: RecordChange[];
  changes_note_zh: string;
  /** Markers not judged because their series read failed or came back cut: unknown, never "no change". */
  changes_unjudged: Array<{
    label_zh: string;
    reason_zh: string;
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
      done_today: boolean | null;
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
  /** Follow-up reminders: on or off, the channels in use, and the next planned send (local ISO). */
  followup: {
    enabled: boolean;
    channels: Array<'desktop' | 'webhook'>;
    next_at: string | null;
  };
}
/** What a journey is built from; now (default the clock) only times the next follow-up. */
type JourneyContext = TrackingContext & {
  mount: MountState;
  now?: Date;
};
declare function buildJourney(context: JourneyContext): Promise<Journey>;
/** The journey and the tracking it was built from (retest dates, bands, adherence calendars). */
declare function buildJourneyFull(context: JourneyContext): Promise<{
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
/** What the follow-up scheduler decides from: the stage, open check-ins, retest dates, this ISO week's adherence. */
declare function followupStateOf(journey: Journey, tracking: Tracking): FollowupState;
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
//#region src/tools-followup.d.ts
/**
 * The model's text is refused, with the reason, when it names a dose or, with minimal detail, a health
 * value, a number that is not a date, a time or a count, or one of `names` (the plan's item titles and
 * markers). Full-width digits and letters are read as their plain forms.
 */
declare function followupTextProblem(text: string, detail: 'minimal' | 'full', names?: readonly string[]): string;
/**
 * Why a set_followup call needs the person's own approval, or '' when it does not: turning reminders on,
 * sending item names and adherence (detail full), or any webhook address. The tool's text says "only on
 * their word"; this makes DSH ask them, so text the model read cannot switch it on alone.
 */
declare function followupApprovalReason(args: unknown): string;
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
  /** basis_item_id: the draft item whose evidence gives the goal; the goal goes when that item is removed. */
  goals: Array<{
    marker: string;
    value: number;
    unit: string;
    basis_zh: string;
    basis_item_id: string;
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
//#region src/connection.d.ts
declare const CONNECTION_FILE = "connection.json";
/** One catalogue read, all round trips included. */
declare const CONNECTION_TEST_MS = 10000;
interface SavedConnection {
  mcp_url: string;
  mcp_token?: string;
  saved_at: string;
}
type ConnectionSource = 'saved' | 'config' | 'none';
/** The saved connection, or null when there is none or the file is unreadable. */
declare function readConnection(dataDir: string): SavedConnection | null;
/** Write the connection, private to the person (0600), replacing the file in one step. */
declare function saveConnection(dataDir: string, input: {
  mcp_url: string;
  mcp_token?: string;
}, now?: Date): SavedConnection;
/** Remove the saved connection; the configured values apply again. True when there was one. */
declare function clearConnection(dataDir: string): boolean;
/**
 * The configuration every module reads: the plugin's own, with mcpUrl and mcpToken taken from the saved
 * connection when there is one. A saved connection without a token means none, never the configured one:
 * a token belongs to its address.
 */
declare function effectiveConfig(config: Config): Config;
/** Where the effective address comes from. */
declare function connectionSource(config: Config): ConnectionSource;
/**
 * A short hash of the MCP token, for cache keys: two accounts behind one address never share a cached
 * record. sha256 of the trimmed token, first 16 hex characters; '' when there is no token.
 */
declare function connectionKey(config: Pick<Config, 'mcpToken'>): string;
/**
 * The address as the page may show it. The installer's rule: everything after /mcp/ is the personal
 * secret and is hidden. A query or fragment is hidden too, and so is anything that does not parse.
 */
declare function maskMcpUrl(url: string): string;
/** Why an address cannot be used, in Chinese; '' when it can. https, or http to this machine only. */
declare function connectionUrlProblem(url: unknown): string;
/** Why a token cannot be used, in Chinese; '' when it can (or when there is none). */
declare function connectionTokenProblem(token: unknown): string;
type ConnectionTest = {
  ok: true;
  indicators: number;
} | {
  ok: false;
  error: string;
};
/**
 * Read the record catalogue once through an address and token, within CONNECTION_TEST_MS in all.
 * Never saves anything. Errors are in Chinese, with the address and token taken out.
 */
declare function testConnection(input: {
  mcp_url: string;
  mcp_token?: string;
  member?: string;
}, timeoutMs?: number): Promise<ConnectionTest>;
//#endregion
//#region src/routes.d.ts
type Handler = (req: IncomingMessage, res: ServerResponse) => void;
/**
 * The part of DSH's `connection` service (dsh-client-connection, HostConnectionHandle) the routes use:
 * the Host/Origin/Sec-Fetch-Site fence, then the signed `dsh-auth` cookie. 401 or 403 rejects.
 */
interface ConnectionGuard {
  requestRejection(request: {
    headers: IncomingMessage['headers'];
  }): 401 | 403 | undefined;
}
declare const CONNECTION_UNAVAILABLE = "longpi: DeepSeek Harness connection service unavailable";
/** application/json, with or without a charset or other parameters. */
declare function isJsonRequest(req: Pick<IncomingMessage, 'headers'>): boolean;
/**
 * DSH's exact routes skip the /api prefix route and its checks, so every LongPi handler runs them itself,
 * before anything else: no connection service, no route (503); then DSH's own rejection; then a write
 * that is not JSON (415), which a page on another site could otherwise send without a preflight.
 */
declare function guardRoute(connection: () => ConnectionGuard | null, handler: Handler): Handler;
/** GET /api/longpi/connection, and the answer of every connection write. */
interface ConnectionStatus {
  source: ConnectionSource;
  url_masked: string;
  token_set: boolean;
  status: 'ok' | 'error' | 'none';
  error?: string;
  summary?: RecordsSummary;
}
//#endregion
//#region src/workspace.d.ts
/** The part of DSH's workspaceRegistry service (@deepseek-ai/dsh-workspace) this uses. */
interface WorkspaceRegistryLike {
  list(): ReadonlyArray<{
    id: string;
    path: string;
  }>;
  create(path: string, title?: string): Promise<{
    id: string;
    path: string;
  }>;
}
declare const WORKSPACE_MARKER = "workspace-bootstrap.json";
declare const WORKSPACE_DIR = "workspace";
declare const WORKSPACE_TITLE = "健康对话";
type BootstrapResult = {
  status: 'created';
  path: string;
  workspace_id: string;
} | {
  status: 'disabled' | 'done_before' | 'not_empty' | 'no_registry';
} | {
  status: 'error';
  error: string;
};
/** Create the 健康对话 workspace when the registry is empty and it was never created before. Never throws. */
declare function bootstrapWorkspace(registry: WorkspaceRegistryLike | null | undefined, options: {
  dataDir: string;
  enabled: boolean;
  now?: Date;
}): Promise<BootstrapResult>;
//#endregion
//#region src/dose.d.ts
/** A fresh pattern: `g` for replacing, none for testing (a global pattern keeps lastIndex between tests). */
declare function dosePattern(flags?: string): RegExp;
/** Whether the text names an amount of a medicine or supplement. */
declare function hasDose(text: string): boolean;
/**
 * The text without any amount of a medicine or supplement, and whether one was taken out. What is left is
 * tidied (a separator or empty bracket the amount leaves behind goes too) but never restored: a text that was
 * only a dose comes back empty.
 */
declare function stripDoses(value: string): {
  text: string;
  stripped: boolean;
};
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-longpi";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { type BootstrapResult, CHANGES_NOTE_ZH, CLASSIFIER_SYSTEM, CONNECTION_FILE, CONNECTION_TEST_MS, CONNECTION_UNAVAILABLE, CONSENT_VERSION, Config, type ConnectionGuard, type ConnectionSource, type ConnectionStatus, type ConnectionTest, type Consent, DEFAULT_FOLLOWUP, DRAFT_CATEGORIES, type DraftItem, EMERGENCY_LINE_ZH, EMPTY_PROFILE, FOCUS, FOCUS_ZH, FOLLOWUP_MAX_PER_DAY, FOLLOWUP_TEST_TEXT, type Focus, type FollowupDeps, type FollowupLogRow, type FollowupSettings, type FollowupState, GROUP_KEYS, GROUP_ZH, GUARD_COUNTERS, GUARD_TIMEOUT_MS, type GroupKey, type Guard, type GuardCall, type GuardHit, type GuardLabels, HARNESS_SKILLS, type IndicatorChange, type IndicatorDetail, type IndicatorEntry, type IndicatorSource, type IndicatorsResponse, JUDGE_SYSTEM, type Journey, LABEL_KEYS, type LlmLike, NO_READ_BACK, PHENOAGE_SKILL, PRODUCT_VERSION, type PlanBrief, type PlanDraft, type Profile, READ_BACK_MS, RISK_FACTS, RISK_FACT_ZH, RISK_SKILL, type RecordChange, type RecordsSummary, type ReplyVerdict, type RiskFact, SELF_ALIASES, SELF_HARM_LINE_ZH, SELF_KEYS, SELF_SPEC, type SavedConnection, type SelfKey, type SelfRow, type SendResult, type Stage, TOOL_NAMES, type UnjudgedChange, WEBHOOK_KINDS, WORKSPACE_DIR, WORKSPACE_MARKER, WORKSPACE_TITLE, type WorkspaceRegistryLike, acceptedPlan, addCheckIns, addDays, addSelf, adherenceFor, appendFollowupLog, apply, asJson, bootstrapWorkspace, bridgeEnv, buildBoard, buildCalendar, buildChanges, buildIndicators, buildJourney, buildJourneyFull, buildPlanBrief, buildReport, buildStats, buildTracking, candidatesFor, cellNumber, checkReply, checkinStatus, checkupMarkerFor, classifyMessage, clearConnection, commandExcerpt, connectionKey, connectionSource, connectionTokenProblem, connectionUrlProblem, correctionNote, countGuard, createGuard, currentPlan, daysBetween, decideFollowup, deleteSelf, describeItem, describePlan, desktopCommand, desktopSupported, detectIntents, domainSummary, dosePattern, draftPlan, effectiveConfig, effectsFor, escapeText, estimatedAge, evaluateMarker, evaluatePlan, expectedText, factorFor, foldLine, foldName, followupApprovalReason, followupArmed, followupResponse, followupStateOf, followupSummary, followupTextProblem, followupTick, goalProblems, groupOf, guardRoute, guidanceNote, hasDose, hasDoseAmount, heldUntil, homeBloodPressure, inQuiet, indicatorDetail, indicatorFor, indicatorsFromTable, inject, invalidateIndicators, invalidateRecords, invalidateTracking, isJsonRequest, isoDay, isoWeek, isoWeekday, latestOutputs, latestSelf, loadCatalog, loadCourses, loadDoseLog, loadEvidenceLexicon, loadRecords, loadReference, loadSeries, manifestSummary, markerFor, maskMcpUrl, maskUrl, matchSkills, mentionedEntities, mentionsMedicine, mergeProfile, mergeSelf, modelGoals, name, nameVariants, nextTimes, normalizePlan, normalizeProfile, normalizeUnit, organismOf, organismsAsked, parseCompact, parseFrontmatter, parseLabels, parseNumber, parseReadme, parseVerdict, personText, planApprovalReason, planKey, preGuard, profileComplete, publicFollowup, rcvBand, readCheckIns, readConnection, readFailed, readFollowup, readFollowupLog, readGuardStats, readHistory, readPlans, readProfile, readReceipts, readResultFile, readSelf, readiness, recordOutputs, recordReadable, recordsSummary, registerApprovals, rememberMedications, rememberedMedications, replyRuleCheck, reportExcerpt, resetReadBacks, resolveDataDir, resolveMarkers, resolveMirobodyPlugin, resolveSkillsHome, retestDay, retestsOf, routeFor, ruleLabels, runReady, runSkill, runnableFrom, runtimeCall, sameMeasure, saveConnection, savePlan, selfIndicators, selfSeries, sendFollowup, sendNow, sentToday, seriesOf, setConsent, setFollowupDeps, skillEnv, stageMeasurements, stageNow, startFollowup, stripDoses, suggestNext, summarizeIndicators, summarizeMedications, tableOf, testConnection, togetherZh, tokenKey, trackingGeneration, turnText, unansweredOf, unitFactor, versionCheck, webhookAnswer, webhookRequest, webhookUrlProblem, within, wrapGuardMessage, writeFollowup, writeProfile, writeStats };