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
      /** dsh-skill registry. Lower rank wins a duplicate name. list is the index; get loads the body. */
      registerProvider(create: (control: {
        signal: AbortSignal;
        invalidate: () => void;
      }) => {
        name: string;
        list: (options: {
          cwd?: string;
          signal?: AbortSignal;
        }) => Promise<readonly {
          name: string;
          description: string;
          whenToUse?: string;
          invocation: {
            modelInvocable: boolean;
            userInvocable: boolean;
          };
          source: string;
          provider: string;
          rank: number;
          locator: unknown;
          path?: string;
          resourceBase?: {
            kind: 'directory';
            path: string;
          };
          metadata?: Readonly<Record<string, unknown>>;
        }[]>;
        get: (candidate: {
          name: string;
          locator?: unknown;
        }, options: {
          cwd?: string;
          signal?: AbortSignal;
        }) => Promise<{
          name: string;
          description: string;
          whenToUse?: string;
          invocation: {
            modelInvocable: boolean;
            userInvocable: boolean;
          };
          source: string;
          provider: string;
          content: string;
          path?: string;
          resourceBase?: {
            kind: 'directory';
            path: string;
          };
          metadata?: Readonly<Record<string, unknown>>;
        } | undefined>;
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
//#region src/guard-scope.d.ts
declare const GUARD_SCOPES: readonly ["health", "all"];
type GuardScope = typeof GUARD_SCOPES[number];
/**
 * Whether a message touches health: a word from the lists, a medicine, or anything the rule layer acts on
 * (an emergency, self-harm, a medicine change or a dose). Recall first; it decides only whether the model
 * is asked, never what the note says.
 */
declare function touchesHealth(text: string): boolean;
interface WorkspaceLike {
  path: string;
  title?: string;
}
/** LongPi's workspaces: the one it created (its marker in dataDir), and any titled 健康对话 or 健康. */
declare function healthWorkspacePaths(dataDir: string, workspaces: readonly WorkspaceLike[]): string[];
/** Whether a session's working directory is the workspace or inside it. */
declare function insideWorkspace(cwd: string, root: string): boolean;
/** Sessions known to be about health, and those already scanned once for earlier health talk. Bounded. */
declare class HealthSessions {
  private readonly max;
  private readonly health;
  private readonly scanned;
  constructor(max?: number);
  has(id: string): boolean;
  mark(id: string): void;
  /** True the first time for a session, so its earlier messages are read once per process. */
  firstSight(id: string): boolean;
  private add;
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
  /** Where the safety classifier asks the model: LongPi's workspace and health talk ('health'), or every message ('all'). */
  guardScope: GuardScope;
  /** Per agent profile (AA §2.3): enabled (false = always the deterministic fallback), route and deadline. */
  agents: Record<string, AgentConfig>;
  /** Daily caps on LongPi's own model calls (D8); over a cap every profile falls back silently. */
  budget: {
    dailyInputTokens: number;
    dailyOutputTokens: number;
    maxSpawnsPerDay: number;
  };
  surfaces: {
    enabled: boolean;
    softRegenMinutes: number;
    chapterTokens: number;
    sse: boolean;
  };
  engage: {
    codex: boolean;
    nudgesInWorkflow: boolean;
  };
  /** 'local' is on-device research. 'live' still needs a production feed before anything leaves (D6). */
  scienceMode: 'off' | 'local' | 'simulated' | 'live';
  /** True only after the person uses the settings switch. The old implicit default is not this. */
  scienceModeSet: boolean;
}
interface AgentConfig {
  enabled: boolean;
  provider: string;
  model: string;
  reasoningEffort: 'off' | 'low' | 'high' | 'max';
  maxTokens: number;
  deadlineMs: number;
}
/** AA §3.4 defaults. A profile left out of a user's patch keeps these. */
declare const AGENT_DEFAULTS: Readonly<Record<string, AgentConfig>>;
/** The settings for one profile: the user's patch over the defaults. */
declare function agentConfig(config: Partial<Pick<Config, 'agents'>> | undefined, id: string): AgentConfig;
declare const BUDGET_DEFAULTS: {
  readonly dailyInputTokens: 200000;
  readonly dailyOutputTokens: 20000;
  readonly maxSpawnsPerDay: 3;
};
declare const SURFACES_DEFAULTS: {
  readonly enabled: true;
  readonly softRegenMinutes: 30;
  readonly chapterTokens: 150000;
  readonly sse: true;
};
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
//#region src/plan-safety.d.ts
declare const FISH_OIL_CAUTION = "试验用的是处方级的较高用量 EPA+DHA，鱼油可能增加出血和房颤（心房颤动）风险；这不是给你的用量，先与医生确认";
declare const HYPO_AWAKE_ZH = "先吃 15 克快速吸收的糖（葡萄糖片或一小杯含糖果汁），15 分钟后复测；仍低于 3.9 mmol/L 就再吃 15 克。";
declare const HYPO_UNCONSCIOUS_ZH = "昏迷、叫不醒或无法吞咽时不要喂东西，请立即拨打 120。";
interface PanelPoint {
  name: string;
  label?: string;
  loinc?: string;
  value: number;
  unit: string;
  date: string;
}
interface SafetyClasses {
  sglt2: boolean;
  sglt2Name: string;
  hypoDrugs: boolean;
  pregnant: boolean;
  /** Planning a pregnancy (备孕 / 准备怀孕 / 计划要孩子), or the standard 0.4 mg folic acid plan. */
  planning: boolean;
  breastfeeding: boolean;
  /** Latest BMI when height and weight, or a BMI row, are on the record. */
  bmi: number | null;
  ckd: boolean;
  diabetesKnown: boolean;
}
interface StopHit {
  key: 'hgb' | 'mcv' | 'rdw' | 'ferritin' | 'glucose' | 'hba1c' | 'ldl' | 'sbp';
  /** Short, for the overview title: 血红蛋白 120 g/L 偏低. */
  short_zh: string;
  /** The full clause with the date and, when the checkups show it, the fall across them. */
  text_zh: string;
  /** The latest value in the unit named, its date, and the fall when there is one (for the brief and the fact pack). */
  value?: number;
  unit?: string;
  date?: string;
  label_zh?: string;
  low?: boolean;
  fall?: Array<{
    date: string;
    value: number;
  }>;
}
interface StopResult {
  stop: boolean;
  /**
   * The profile has no sex and a value sits between the women's and the men's limits.
   * That is not a referral. The page asks for sex first.
   */
  needs_sex?: boolean;
  /** 请先去看医生：… — the whole reply when a plan is asked for. */
  sentence_zh: string;
  /** The overview's next step title. */
  title_zh: string;
  hits: StopHit[];
}
declare function medicationClasses(names: readonly string[], flags?: {
  pregnant?: boolean | null;
  planning?: boolean | null;
  breastfeeding?: boolean | null;
  bmi?: number | null;
  ckd?: boolean | null;
  diabetes?: boolean | null;
}): SafetyClasses;
/** Phrases the person has ruled out, kept so the next draft does not grow them back. */
declare function exclusionsFromText(text: string): string[];
/**
 * Critical values and a red-cell pattern that need a doctor before any
 * lifestyle plan. points holds the latest value of every indicator and, for
 * haemoglobin and MCV, their earlier checkups. One plain sentence names each
 * value with its number, calls a low value 偏低, and sends the person to a doctor.
 */
declare function clinicalStop(input: {
  sex: string;
  diabetesKnown: boolean;
  points: readonly PanelPoint[];
}): StopResult;
interface HypoRead {
  now: boolean;
  unconscious: boolean;
}
/** A low reading or hypo symptoms happening now, not a past number told as history. */
declare function hypoglycaemiaNow(text: string): HypoRead;
declare function leadsWithHypoFirstStep(reply: string, unconscious?: boolean): boolean;
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
/** "请记一下" is a request to store a prescription, not a request to start or stop it. */
declare function isMedicationRecordRequest(text: string): boolean;
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
  hypoglycaemia?: boolean;
  unconscious?: boolean;
  record?: boolean;
  text?: string;
}): GuidanceNote | null;
/** The correction steered into a turn whose reply gave a dose or advised a medicine change. */
declare function correctionNote(verdict: ReplyVerdict): GuidanceNote;
/** The reply to a hypoglycaemia message did not open with the first step: send it now, first. */
declare function hypoCorrectionNote(unconscious?: boolean, insulinOrSu?: boolean): GuidanceNote;
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
  /** Creation metadata: the working directory the session was created in. */
  header?: {
    cwd?: string;
  };
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
declare const GUARD_COUNTERS: readonly ["input_checked", "input_llm_ok", "input_llm_failed", "input_llm_unavailable", "input_skipped", "flag_emergency", "flag_self_harm", "flag_med_change", "flag_dose", "flag_research", "note_appended", "output_checked", "output_llm_ok", "output_llm_failed", "output_llm_unavailable", "output_flag_rules", "output_flag_llm", "output_steered", "approval_asked", "approval_no_readback", "skill_blocked"];
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
  /**
   * Where the model labels a message: 'health' (the default) in LongPi's own workspace and, elsewhere, for
   * messages that touch health and the rest of their session; 'all' for every message. Outside the scope
   * the rules decide.
   */
  scope?: () => GuardScope;
  /** Paths of the workspaces whose sessions are always labelled by the model (LongPi's own). */
  healthWorkspaces?: () => readonly string[];
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
  /** A LongPi tool ran in this agent's session: the model labels the rest of it. */
  markHealth(agent: unknown): void;
  /** This turn asked about a supplement, a drug, or a study dose: skip the evidence-library tool. */
  inAdvice(agent: unknown): boolean;
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
declare function registerApprovals(ctx: Context, guard: Pick<Guard, 'inEmergency' | 'count'> & Partial<Pick<Guard, 'markHealth' | 'inAdvice'>>): void;
//#endregion
//#region src/guard-dose.d.ts
/** Any amount that could be a dose. */
declare function hasDoseAmount(text: string): boolean;
//#endregion
//#region src/version.d.ts
declare const PRODUCT_VERSION: string;
declare const TOOL_NAMES: readonly ["read_personal_situation", "list_longevity_intents", "match_longevity_skills", "read_longevity_skill", "run_longevity_skill", "query_longevity_evidence", "list_longevity_domains", "save_personal_profile", "longpi_status", "save_intervention_plan", "draft_intervention_plan", "log_intervention_checkin", "save_self_measurement", "record_medication_statement", "read_intervention_plan", "review_interventions", "model_intervention_goals", "set_followup", "send_followup_message", "read_person_memory", "remember_for_me", "note_page_issue", "read_care_navigation", "prepare_doctor_brief", "log_care_visit"];
declare const HARNESS_SKILLS: readonly ["longpi-dispatch", "longpi-board", "longpi-boundary", "longpi-interventions"];
/**
 * Model-facing tool names reserved at C0 (AA §3.4), by owning module. A name moves into TOOL_NAMES
 * only when its tool is registered.
 */
declare const RESERVED_TOOL_NAMES: {
  readonly M0: readonly ["read_person_memory", "remember_for_me", "note_page_issue", "consult_longpi_specialist"];
  readonly M1: readonly ["read_care_navigation", "prepare_doctor_brief", "log_care_visit"];
  readonly M2: readonly ["advise_on_substance"];
  readonly M4: readonly ["read_progress_feedback"];
  readonly M6: readonly ["log_life_event", "read_season", "propose_personal_season", "run_drawn_method"];
  readonly M7: readonly ["forward_report", "record_condition", "read_narrative_findings"];
  readonly M8: readonly ["list_studies", "explain_study", "design_n_of_1", "log_n_of_1_outcome", "record_study_consent", "withdraw_from_study"];
};
/** HTTP routes reserved at C0 (AA §3.4), by owning module. */
declare const RESERVED_ROUTES: {
  readonly M0: readonly ["GET /api/longpi/memory", "POST /api/longpi/memory", "GET /api/longpi/events", "GET /api/longpi/usage"];
  readonly M1: readonly ["GET /api/longpi/triage", "GET /api/longpi/brief", "POST /api/longpi/brief", "POST /api/longpi/care-visit"];
  readonly M2: readonly ["GET /api/longpi/advice"];
  readonly M4: readonly ["GET /api/longpi/feedback"];
  readonly M5: readonly ["GET /api/longpi/surfaces"];
  readonly M6: readonly ["GET /api/longpi/season", "POST /api/longpi/season", "POST /api/longpi/streak-freeze", "GET /api/longpi/schedule", "POST /api/longpi/schedule", "GET /api/longpi/codex", "GET /api/longpi/codex/odds", "POST /api/longpi/codex/draw", "POST /api/longpi/codex/run", "GET /api/longpi/weekly", "POST /api/longpi/nudges"];
  readonly M7: readonly ["POST /api/longpi/upload", "GET /api/longpi/findings", "GET /api/longpi/meds", "POST /api/longpi/meds", "GET /api/longpi/conditions", "POST /api/longpi/conditions", "GET /api/longpi/stores"];
  readonly M8: readonly ["GET /api/longpi/science/studies", "POST /api/longpi/science/consent", "POST /api/longpi/science/withdraw", "POST /api/longpi/science/run", "GET /api/longpi/science/translog", "GET /api/longpi/science/community", "GET /api/longpi/science/registry", "GET /api/longpi/science/transparency", "POST /api/longpi/science/n-of-1", "POST /api/longpi/science/export", "GET /api/longpi/science/invite", "POST /api/longpi/science/invite", "POST /api/longpi/science/preference"];
  readonly M11: readonly ["GET /api/longpi/privacy", "POST /api/longpi/privacy/consent", "GET /api/longpi/privacy/export", "POST /api/longpi/privacy/delete"];
};
/** Harness skills reserved for later modules (AA §3.4); HARNESS_SKILLS lists the ones registered. */
declare const RESERVED_SKILLS: readonly ["longpi-care", "longpi-feedback", "longpi-seasons", "longpi-data-in", "longpi-science"];
/** Always-on prompt sections (agent-scoped). Orders 22–29 need the integrator. */
declare const PROMPT_SECTIONS: {
  readonly orchestrator: {
    readonly name: "longpi:orchestrator";
    readonly order: 20;
  };
  readonly safety: {
    readonly name: "longpi:safety";
    readonly order: 21;
  };
};
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
/** Add the field-test binds onto one card. A manifest that already lists them is left unchanged. */
declare function supplementFieldInputs<T extends {
  name: string;
  inputs: InputSpec[];
}>(card: T): T;
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
  probed?: readonly string[];
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
 * Whether a report or series name is this input. Exact folded names, the same name with 血 inserted
 * (空腹血葡萄糖 and 空腹葡萄糖), or the label plus a CV/percent qualifier.
 */
declare function matchesInputName(spec: InputSpec, text: string | undefined): boolean;
/**
 * The record indicator that holds one declared input: of the rows with a number, the newest across all of the
 * input's codes; on the same date a unit that converts beats a missing or wrong label, then the earlier code
 * in skill.json order. Rows matched only by name are the fallback when no row carries a code.
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
  /** Tier C is evidence. The species is in the first line of the skill. It is not this person's number. */
  evidence?: boolean;
  species?: string;
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
    probed?: readonly string[];
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
type LibraryResultLabel = 'verified' | 'unverified-binding' | 'evidence-only';
interface VersionCheck {
  pinned: string;
  catalog: string;
  /** Null when no pin is set. */
  matches: boolean | null;
  /** False only when a pin is set and the running catalog is a different version. */
  verified_allowed: boolean;
  /** The proposed label after the pin is applied. Null when the caller did not propose one. */
  label: LibraryResultLabel | null;
  refused_verified: boolean;
  mismatch: string;
  mismatch_zh: string;
}
declare function versionCheck(catalog: Catalog, pinned: string, proposed?: LibraryResultLabel): VersionCheck;
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
/** One separate act (PIPL sensitive information, DeepSeek data flow, or session-log upload). */
interface PrivacyAct {
  version: string;
  decision: 'granted' | 'declined' | 'withdrawn';
  at: string;
}
/** Mirrors of privacy/consents.jsonl. The log is the source of truth; this is what a profile read shows. */
interface ProfileConsents {
  pipl_sensitive: PrivacyAct | null;
  data_flow_deepseek: PrivacyAct | null;
  session_log_upload: PrivacyAct | null;
}
interface Profile {
  displayName: string;
  birthYear: number | null;
  age: number | null;
  sex: Sex;
  risk: Partial<Record<RiskFact, boolean>>;
  /** Facts they explicitly called 不确定. Missing means never asked, and is not stored as false. */
  riskUnknown?: RiskFact[];
  focus: Focus[];
  /** The first-run product notice. Not the PIPL sensitive-information act. */
  consent: Consent | null;
  /** Separate acts. Absent on a file written before 0.5.x privacy means none of them is decided. */
  consents: ProfileConsents;
  /** Set when the labs belong to someone else (a parent). Calculators use this age and sex. */
  subject?: {
    relationship_zh: string;
    age: number | null;
    sex: Sex;
  } | null;
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
declare const PROFILE_DAMAGED = "profile.json is damaged and was not overwritten";
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
 * status, row_count, truncated}; a transport may hand over the bare text, or the
 * REST shape {rows, count, total, truncated}. Returns null when the payload is
 * neither (an OAuth blob, a warmup sentence, a JSON object with no rows).
 */
declare function tableOf(payload: unknown): CompactTable | null;
/** A cell as a number, or null for an empty or non-numeric cell ("Positive", "<0.5", "5.48 ↑"). */
declare function cellNumber(value: string | undefined): number | null;
type PrintedFlag = 'high' | 'low' | 'positive' | 'negative' | 'abnormal' | 'below' | 'above';
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
 * What the Mirobody terminology bridge gets for the status check: the same list the mounted Mirobody plugin gives
 * it for every tool call (path, home, language, TMPDIR, MIROBODY_HOME; no user site-packages, no PYTHONPATH), so
 * the status says what the tools will find. Never the rest of the harness's environment (API keys, tokens). Not a
 * sandbox either.
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
/**
 * How the record read went. A named type, so the declarations print it by name: an inlined union is printed in
 * the checker's order, which differs between builds and made lib/ look stale in CI.
 */
type RecordStatus = 'unconfigured' | 'ok' | 'partial' | 'error';
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
  /** Current regimen first, older plans labelled 较早. Empty until a medication read succeeds. */
  medication_summary_zh: string[];
  /** partial: the record was read, but some reads failed or came back cut (read_errors says which). */
  record_status: RecordStatus;
  record_error: string;
  /** Each read that failed or was cut, in Chinese; empty when every read succeeded. */
  read_errors: string[];
  /** Catalogue names whose latest value was not read because the read failed: unknown, never "not measured". */
  missing_reads: string[];
  /** The catalogue itself was cut, so an indicator missing from it may simply not have been read. */
  catalog_truncated: boolean;
  /**
   * Input keys asked for by LOINC and name after a cut catalogue, where the server answered.
   * Absence then means not on file. A failed ask is not listed here.
   */
  probed_inputs: string[];
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
/** Where one plotted point came from. The point's value is the number; this keeps the printed cell and the lab. */
interface ReadingProvenance {
  indicator: string;
  label?: string;
  loinc?: string;
  unit: string;
  value: number;
  printed?: string;
  flag?: PrintedFlag;
  file?: string;
  /** Hospital or source named in the file handle (lp:checkup:date:lab). */
  lab?: string;
  /** Other files that carried the same value at the same time (a page uploaded twice). */
  files?: string[];
}
interface SeriesPoint {
  date: string;
  time: string;
  value: number;
  unit: string;
  file?: string;
  flag?: PrintedFlag;
  printed?: string;
  provenance?: ReadingProvenance;
}
/** A result that is not a measurement: "<0.5", "阴性(-)". Kept, never plotted as the bound. */
interface OtherReading {
  date: string;
  time: string;
  text: string;
  flag: PrintedFlag | null;
  unit: string;
  file?: string;
  lab?: string;
}
interface Series {
  indicator: string;
  label?: string;
  loinc?: string;
  unit: string;
  points: SeriesPoint[];
  other?: OtherReading[];
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
 * reading (labs); day returns one daily value per indicator (wearables; Mirobody's
 * elected day, or the newest reading of that civil day). "5.48 ↑" and "120↓"
 * are the number plus a flag. "<0.5" and "阴性(-)" are kept on `other` and are
 * not plotted as the bound. A batch that fails is tried again, then named;
 * a database or login failure stops the remaining batches.
 *
 * A day read asks for one indicator at a time. Mirobody 1.5.0 and 1.5.1 select
 * `display` for a day bucket and not the printed name, and an uncoded series
 * (dailySteps, dailyTotalSleepTime) has no display, so the compact table has
 * the day's avg and no indicator. Two such series in one table cannot be told
 * apart. The bucket's `period` is already the account's civil day (Asia/Shanghai
 * once that zone is set).
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
//#region src/contracts/common.d.ts
type IsoDay = string;
type IsoTime = string;
type Id = string;
type ModuleId = 'M0' | 'M1' | 'M2' | 'M3' | 'M4' | 'M5' | 'M6' | 'M7' | 'M8' | 'M9' | 'M10' | 'M11' | 'M12' | 'M13';
type Focus$1 = 'bioage' | 'cardio' | 'glucose' | 'weight' | 'sleep' | 'plan';
interface Provenance {
  kind: 'chat' | 'page' | 'record' | 'import' | 'model_extracted' | 'rule' | 'migration';
  at: IsoTime;
  session_id?: string;
  turn?: number;
  /** The person's own words, at most 200 characters. */
  quote_zh?: string;
  by: ModuleId;
}
/** Every number any generator may put in text. Formatting belongs to M9 (honesty/format.ts). */
interface NumberRef {
  /** Stable: 'hgb@2026-09-21', 'phenoage.advance', 'ferritin.latest'. */
  key: string;
  label_zh: string;
  value: number;
  unit: string;
  date: IsoDay | null;
  source: 'record' | 'self' | 'skill' | 'rcv' | 'memory' | 'derived';
  /** Canonical formatted form the validator accepts, e.g. '8.0 ng/mL'. */
  text: string;
}
interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  reasoningTokens?: number;
}
//#endregion
//#region src/contracts/library.d.ts
interface SkillIndexEntry {
  name: string;
  blurb: string;
  tier: string;
  species: string;
  whenToUse: string;
  /** Directory of the skill. Full SKILL.md loads only when the model opens it. */
  locator: string;
}
type ResultLabel = 'verified' | 'unverified-binding' | 'evidence-only';
/** What kind of row an input accepts. Alias text is not a kind. */
type ProvenanceKind = 'blood_clock' | 'methylation_clock' | 'abdominal_ct' | 'coronary_ct' | 'routine_lab' | 'wearable' | 'questionnaire' | 'profile' | 'output_of';
interface BindingInput {
  source_row_id: string;
  value: number | string;
  unit: string;
  provenance: ProvenanceKind;
  /** The row text the model pointed at, unchanged. */
  quote: string;
}
interface BindingProposal {
  skill: string;
  /** Manifest input key → the row the model named. The model does not convert units. */
  inputs: Record<string, BindingInput>;
}
type BindingIssueKind = 'unit' | 'range' | 'provenance' | 'missing';
interface BindingIssue {
  input: string;
  kind: BindingIssueKind;
  detail?: string;
}
/**
 * ok is false when a required input failed. A dropped optional is an issue
 * and leaves ok true.
 */
interface BindingValidation {
  ok: boolean;
  issues: BindingIssue[];
}
interface MethodOutput {
  key: string;
  value: number | string | null;
  unit: string;
}
interface MethodInputUsed {
  input: string;
  source_row_id: string;
  value: number | string;
  unit: string;
  provenance: ProvenanceKind;
  quote: string;
}
interface MethodResult {
  skill: string;
  label: ResultLabel;
  outputs: MethodOutput[];
  inputs_used: MethodInputUsed[];
  catalog_version: string;
  ran_at: IsoTime;
  limits_zh: string;
  /** Chinese name for the card. Absent on older rows. */
  title_zh?: string;
}
type StoreKind = 'methylation' | 'taxa' | 'proteins' | 'conditions';
interface MethylationRow {
  sample_date: string;
  probe_id: string;
  beta: number;
  source_file: string;
}
interface TaxaRow {
  sample_date: string;
  site: 'gut' | 'oral';
  genus: string;
  relative_abundance: number;
  source_file: string;
}
interface ProteinRow {
  sample_date: string;
  panel: string;
  id: string;
  symbol: string;
  value: number;
  unit_or_z: string;
  source_file: string;
}
interface ConditionRow {
  code: string;
  system: 'ICD-10';
  display: string;
  onset: string | null;
  source: string;
}
interface StoreRows {
  methylation: MethylationRow;
  taxa: TaxaRow;
  proteins: ProteinRow;
  conditions: ConditionRow;
}
interface LibraryHooks {
  /** L2. Every catalog entry. Does not drop a tier or a name. */
  listSkillIndex?: () => SkillIndexEntry[];
  /** L2. Unit, range, and provenance only. */
  validateBinding?: (proposal: BindingProposal) => BindingValidation;
  /** L3. */
  readStore?: (kind: StoreKind) => StoreRows[StoreKind][];
  /** L4. Labeled results for this generation. */
  methodResults?: () => MethodResult[];
}
/** A lane registers the functions it owns. Other lanes' hooks stay. */
declare function registerLibraryHooks(next: LibraryHooks): () => void;
/** Called from the lane module with the host context, once apply() runs. */
declare function registerLibraryMount(mount: (ctx: unknown) => void): () => void;
declare function mountLibraryLanes(ctx: unknown): void;
declare function listSkillIndex(): SkillIndexEntry[];
declare function validateBinding(proposal: BindingProposal): BindingValidation;
declare function readStore<K extends StoreKind>(kind: K): StoreRows[K][];
declare function methodResults(): MethodResult[];
/** What the fact pack stores. Empty until L4 registers methodResults. */
declare function registeredMethodResults(): MethodResult[];
//#endregion
//#region src/bind.d.ts
/** Abdominal CT calcium. A bare Agatston score is coronary and is refused. */
declare const ABDOMINAL_CT_SKILL = "biological-age-ct-cardiometabolic";
interface BindingRow extends RecordIndicator {
  kind?: ProvenanceKind;
  code?: string;
  report_type?: string;
}
interface BindingProfile {
  age: number | null;
  sex: string;
  risk?: Partial<Record<string, boolean | null>>;
  waist_cm?: number | null;
}
interface BindingOutput {
  value: number | string | null;
  unit?: string;
  skill?: string;
}
/** What the server can see. Omit it and a proposal is checked against the manifest only. */
interface RecordView {
  home?: string;
  indicators?: readonly BindingRow[];
  profile?: BindingProfile;
  outputs?: Record<string, BindingOutput>;
  /** Empty means no pin is configured. A non-empty pin must equal the catalog version to label verified. */
  pinnedVersion?: string;
}
interface BindingReport {
  ok: boolean;
  issues: BindingIssue[];
  label: ResultLabel;
  measurements: MeasurementIn[];
  args: string[];
  inputs_used: MethodInputUsed[];
  limits_zh: string;
  catalog_version: string;
  /** Set when this must not be shown as a personal number. */
  blockReason: string | null;
}
declare function useBindingView<T>(view: RecordView | null, fn: () => T): T;
/** Same refusal as the library branch: a bare Agatston score is coronary calcium. */
declare function isCoronaryName(name: string): boolean;
/** What kind of row this input accepts. Alias text is not enough. */
declare function specKind(spec: InputSpec): ProvenanceKind | 'probe' | 'any';
/** The row the model pointed at, from its quote and provenance, not from an alias list. */
declare function proposedRowKind(input: BindingInput, key?: string): ProvenanceKind | 'any';
/** A proposal the record itself supports. Incompatible rows (methylation PhenoAge, bare Agatston) are left out. */
declare function proposeFromRecord(card: SkillCard, view: RecordView): BindingProposal;
declare function bindRecord(card: SkillCard, view: RecordView): BindingReport;
declare function assessBinding(proposal: BindingProposal, view?: RecordView | null): BindingReport;
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
  /** The model's row-to-input proposal. Checked before the script runs. */
  binding?: BindingProposal;
  /** Record rows the server can see. Omit it and the binding is checked against the manifest only. */
  bindingView?: RecordView | null;
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
  /** Labelled result. Tier C and a failed binding do not invent a personal number. */
  method?: MethodResult;
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
    status: RecordStatus;
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
/** The marker keys a word for several markers names (血压 → sbp, dbp); empty for one marker or anything else. */
declare function markerGroupKeys(biovar: Biovar, name: string): string[];
/** The names with each word for several markers replaced by those markers' names, in order and once each. */
declare function expandMarkerNames(biovar: Biovar, names: readonly string[]): string[];
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
  /** 0.5.3 (M1): the latest value is outside the usual adult range: named low or high, never "cannot judge". */
  range_flag?: 'low' | 'high';
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
declare const CHANGES_NOTE_ZH = "判断依据：两次结果之差，要比同一个人平常的起伏更大，才算值得注意的变化。不同医院、不同仪器之间的差异没有算进去；如果两次不在同一家机构，请先复查确认。这不是诊断。";
/** Low or high against the usual range, with the words for it; null inside it or for other markers. */
declare function rangeFlag(key: string, value: number, sex: string): {
  flag: 'low' | 'high';
  text_zh: string;
} | null;
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
/** Civil clock for check-ins, streaks and reminders. The person is in China; the process zone is not. */
declare const CIVIL_TZ = "Asia/Shanghai";
/** YYYY-MM-DD in Asia/Shanghai, not UTC and not the process zone. */
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
  /**
   * Other catalogue names of the same marker (a printed Chinese name and a LOINC row).
   * Their series are read with `indicator`; a baseline that lives on only one of them still counts.
   */
  also?: string[];
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
  /** Not found because the record was not read whole (never a sign the test is missing). */
  unread?: boolean;
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
  /** The record failed to read, or its catalogue came back cut: a marker not found may be in the part not read. */
  record_unread?: 'failed' | 'cut';
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
//#region src/ux/body-age.d.ts
interface PhenoPanel {
  albumin_gL: number;
  creat_umol: number;
  glucose_mmol: number;
  crp_mg_dl: number;
  lymph_pct: number;
  mcv_fl: number;
  rdw_pct: number;
  alp_u_l: number;
  wbc_10e3: number;
  age: number;
}
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
  /** The sentence the page chip and the chat both use. Empty until a panel is computed. */
  headline_zh: string;
  /** True only when the move is past the noise band toward a lower phenotypic age, with the gates met. */
  allows_younger?: boolean;
  /** Days from the earliest to the latest input of the latest panel. 0 is one draw day. */
  panel_span_days: number | null;
  /** The first and latest complete panels, in the method's units, when both exist. */
  pheno_compare?: {
    before: PhenoPanel;
    after: PhenoPanel;
  } | null;
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
  /** A critical value or red-cell pattern: see a doctor before any plan (plan-safety.ts). */
  doctor_first: StopResult;
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
  /** A weekly line when there is no plan but an unlock or a season task is waiting. */
  plain_reminder_zh?: string | null;
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
declare const FOLLOWUP_DAMAGED = "followup.json is damaged and was not overwritten";
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
/** ISO weekday of the Asia/Shanghai clock: Monday = 1 … Sunday = 7. */
declare function isoWeekday(now: Date): Weekday;
/** ISO week of the Asia/Shanghai date, as 2026-W39. */
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
declare function desktopCommand(platform: string, text: string, appPath?: string | null): {
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
 * Tick every 60 s on the Asia/Shanghai clock, as a Cordis effect: the interval is cleared when the
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
  silence_zh: string;
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
  /** Set when the last two draws are too close, or from different institutions. Not 波动内. */
  gate?: 'too_early' | 'not_comparable';
  /** The 太早 or 不可比 sentence. The indicators page shows it next to the chip. */
  reason_zh?: string;
  /** A single value outside the usual adult range. Shown even when the change itself is unjudged. */
  range_flag?: 'low' | 'high';
  range_zh?: string;
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
//#region src/contracts/memory.d.ts
declare const MEMORY_VERSION = 1;
type MemoryKind = 'goal' | 'exclusion' | 'condition' | 'medication' | 'supplement' | 'family_history' | 'life_event' | 'care' | 'preference' | 'asked_topic' | 'note';
type ConditionFlag = 'diabetes' | 'prediabetes' | 'ckd' | 'pregnancy' | 'pregnancy_planning' | 'breastfeeding' | 'cancer_followup' | 'cvd' | 'stent' | 'hypertension' | 'nafld' | 'anaemia' | 'thyroid' | 'minor' | 'caregiver_subject';
type DrugClass = 'sglt2i' | 'insulin' | 'sulfonylurea' | 'metformin' | 'glp1ra' | 'statin' | 'anticoagulant' | 'antiplatelet' | 'antihypertensive' | 'thyroid_hormone' | 'iron' | 'steroid' | 'other';
/** Rule tables (not the model) decide safety relevance. */
declare const SAFETY_DRUG_CLASSES: readonly DrugClass[];
declare const SAFETY_CONDITION_FLAGS: readonly ConditionFlag[];
interface MemoryItemBase {
  id: Id;
  kind: MemoryKind;
  /** One line the person would recognise ("不要限时进食"). */
  text_zh: string;
  status: 'active' | 'retracted' | 'superseded' | 'expired';
  /** Unconfirmed items may only add caution (principle 5). */
  confirmed: boolean;
  /** Computed from the rule tables above, never from the model. */
  safety_relevant: boolean;
  provenance: Provenance;
  updated: IsoTime;
  supersedes?: Id;
  valid_from?: IsoDay;
  valid_to?: IsoDay | null;
}
interface GoalItem extends MemoryItemBase {
  kind: 'goal';
  focus?: Focus$1;
  target?: {
    marker_key?: string;
    value?: number;
    unit?: string;
    by?: IsoDay;
  };
}
interface ExclusionItem extends MemoryItemBase {
  kind: 'exclusion';
  scope: 'plan_item' | 'topic' | 'reminder' | 'suggestion';
  /** plan_prefs excluded_ids / excluded_phrases land here. */
  match: {
    item_ids?: string[];
    categories?: string[];
    phrases_zh: string[];
  };
  reason_zh?: string;
}
interface ConditionItem extends MemoryItemBase {
  kind: 'condition';
  name_zh: string;
  flags: ConditionFlag[];
  state: 'current' | 'past' | 'suspected' | 'ruled_out';
  since?: IsoDay;
  code?: {
    system: 'icd10' | 'local';
    value: string;
  };
}
interface MedicationItem extends MemoryItemBase {
  kind: 'medication' | 'supplement';
  name_zh: string;
  drug_class: DrugClass[];
  /** Verbatim as prescribed or stated; never generated. */
  regimen_text?: string;
  source_rx: 'doctor' | 'self' | 'unknown';
  started?: IsoDay;
  stopped?: IsoDay | null;
  /** Link to the datain/meds (medication_statements.jsonl) row. */
  statement_id?: string;
}
interface FamilyHistoryItem extends MemoryItemBase {
  kind: 'family_history';
  relative: 'mother' | 'father' | 'sister' | 'brother' | 'child' | 'grandparent' | 'other';
  condition_zh: string;
  age_at_dx?: number;
  flags: ConditionFlag[];
}
interface LifeEventItem extends MemoryItemBase {
  kind: 'life_event';
  event: 'sick' | 'travel' | 'injury' | 'surgery' | 'pregnancy' | 'bereavement' | 'shift_work' | 'other';
  from: IsoDay;
  to: IsoDay | null;
  freezes_streak: boolean;
}
interface CareItem extends MemoryItemBase {
  kind: 'care';
  finding_id?: Id;
  department_zh?: string;
  /** AA §3.3 called this `status`, which clashes with the item's own status; renamed at C0. */
  care_status: 'advised' | 'booked' | 'visited' | 'declined' | 'unknown';
  visit_date?: IsoDay;
  outcome_zh?: string;
  next_date?: IsoDay;
  brief_id?: Id;
}
type PreferenceKey = 'tone' | 'cadence' | 'detail' | 'nudge_in_workflow' | 'quiet_hours' | 'codex_enabled' | 'celebrate' | 'units';
interface PreferenceItem extends MemoryItemBase {
  kind: 'preference';
  key: PreferenceKey;
  value: string | number | boolean;
}
interface AskedTopicItem extends MemoryItemBase {
  kind: 'asked_topic';
  topic_key: string;
  last_asked: IsoDay;
  count: number;
}
interface NoteItem extends MemoryItemBase {
  kind: 'note';
}
type MemoryItem = GoalItem | ExclusionItem | ConditionItem | MedicationItem | FamilyHistoryItem | LifeEventItem | CareItem | PreferenceItem | AskedTopicItem | NoteItem;
interface PersonMemory {
  version: typeof MEMORY_VERSION;
  rev: number;
  updated: IsoTime;
  items: MemoryItem[];
  migrated?: string[];
}
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;
type NewMemoryItem = DistributiveOmit<MemoryItem, 'id' | 'updated' | 'status' | 'safety_relevant'>;
type MemoryOp = {
  op: 'add';
  item: NewMemoryItem;
} | {
  op: 'retract';
  id: Id;
  provenance: Provenance;
} | {
  op: 'supersede';
  id: Id;
  item: NewMemoryItem;
} | {
  op: 'confirm';
  id: Id;
  provenance: Provenance;
} | {
  op: 'touch_topic';
  topic_key: string;
  day: IsoDay;
  provenance: Provenance;
};
interface MemoryApplyResult {
  rev: number;
  applied: Id[];
  rejected: Array<{
    op: MemoryOp;
    reason: string;
  }>;
}
interface MemoryApi {
  read(): PersonMemory;
  active<K extends MemoryKind>(kind: K): Array<Extract<MemoryItem, {
    kind: K;
  }>>;
  /** Atomic write + memory_log line + bus 'memory.changed'. */
  apply(ops: MemoryOp[], by: ModuleId): MemoryApplyResult;
  digest(opts: {
    purpose: 'chat' | 'surface' | 'plan' | 'triage' | 'advice';
    maxChars?: number;
  }): string;
  /** Includes unconfirmed items (caution only). */
  safetyFlags(): {
    drug_classes: DrugClass[];
    conditions: ConditionFlag[];
  };
}
//#endregion
//#region src/contracts/feedback.d.ts
type EvidenceGrade = 'beyond_band_better' | 'beyond_band_worse' | 'within_band_improving' | 'within_band_flat' | 'within_band_worse' | 'too_early' | 'not_comparable' | 'first_draw' | 'not_judgeable' | 'behaviour_done' | 'projection';
type Claim = 'younger' | 'improved' | 'celebrate' | 'progress_story' | 'retest_when' | 'affirm' | 'target' | 'see_doctor';
interface FeedbackMessage {
  id: Id;
  subject: {
    kind: 'bioage' | 'risk' | 'marker' | 'behaviour' | 'plan_item' | 'goal' | 'season';
    key: string;
    label_zh: string;
  };
  /** Deterministic (feedback/grade.ts over M9 verdicts). */
  grade: EvidenceGrade;
  /** 'younger' iff kind==='bioage' && grade==='beyond_band_better' && band_verified && interval≥min && same_lab!==false. */
  allowed_claims: Claim[];
  numbers: NumberRef[];
  delta?: {
    value: number;
    unit: string;
    band: [number, number] | null;
    band_verified: boolean;
    interval_days: number;
    min_interval_days: number;
    same_lab: boolean | null;
  };
  retest?: {
    earliest: IsoDay;
    recommended: IsoDay;
    why_zh: string;
  };
  /** The chip and the chat use this exact text. */
  headline_zh: string;
  body_zh?: string;
  tone: 'celebrate' | 'encourage' | 'neutral' | 'care';
  source: 'model' | 'template';
}
/** The rule behind allowed_claims 'younger' (contract invariant). */
declare function youngerAllowed(message: Pick<FeedbackMessage, 'subject' | 'grade' | 'delta'>): boolean;
//#endregion
//#region src/contracts/science.d.ts
type ScienceMode = 'off' | 'local' | 'simulated' | 'live';
interface StudyManifest {
  schema: 'longpi.study/1';
  id: string;
  version: string;
  title_zh: string;
  summary_zh: string;
  kind: 'n_of_1' | 'observational' | 'community_season';
  sponsor: {
    name: string;
    contact: string;
  };
  ethics: {
    committee: string | null;
    approval_id: string | null;
    registry: {
      name: 'ChiCTR' | 'none';
      id: string | null;
    };
  };
  eligibility: {
    age: [number, number];
    sex?: Array<'female' | 'male'>;
    require?: ConditionFlag[];
    exclude_conditions?: ConditionFlag[];
    exclude_drug_classes?: DrugClass[];
    minors: false;
  };
  data: {
    inputs: Array<{
      key: string;
      source: 'record' | 'self' | 'wearable' | 'checkin' | 'chat_outcome';
      loinc?: string;
      window_days: number;
    }>;
    /** Must include 'genetics'. */
    excluded: Array<'genetics' | 'free_text' | 'identifiers' | 'images'>;
  };
  protocol?: {
    arms?: Array<{
      id: string;
      label_zh: string;
    }>;
    weeks: number;
    block_days?: number;
    crossover?: boolean;
    outcome: {
      key: string;
      unit: string;
      better: 'lower' | 'higher';
    };
  };
  analysis: {
    local: Array<{
      stat: 'count' | 'mean' | 'var' | 'mean_diff' | 'hist' | 'paired_t' | 'rcv_calibration';
      key: string;
      params?: Record<string, number | string>;
    }>;
    release: {
      dp: {
        mechanism: 'gaussian' | 'laplace';
        epsilon: number;
        delta: number;
        clip: [number, number];
      };
      aggregation: 'secure_sum';
      min_cohort: number;
    };
  };
  consent: {
    text_version: string;
    text_zh_sha256: string;
    withdraw: 'any_time';
    after_withdraw: 'delete_unreleased';
    comprehension: Array<{
      id: string;
      question_zh: string;
      options_zh: string[];
      correct: number;
    }>;
  };
  give_back: {
    participant_zh: string;
    community: boolean;
  };
  /** Simulated mode: must be http://127.0.0.1:* or localhost. */
  endpoints: {
    aggregator: string;
  };
  /** Over the canonical JSON without `signature`. */
  signature: {
    alg: 'ed25519';
    key_id: string;
    sig: string;
  };
}
interface ConsentRecord {
  id: Id;
  scope: 'study' | 'pipl_sensitive' | 'data_flow_deepseek' | 'session_log_upload';
  study_id?: string;
  manifest_version?: string;
  manifest_sha256?: string;
  decision: 'granted' | 'declined' | 'withdrawn';
  at: IsoTime;
  mode: ScienceMode;
  text_version: string;
  explained_by: 'agent' | 'page';
  session_id?: string;
  comprehension?: {
    asked: number;
    correct: number;
    passed: boolean;
    attempts: number;
  };
  withdrawal?: {
    at: IsoTime;
    deleted_unreleased: boolean;
  };
  translog_seq: number;
}
interface LocalStatResult {
  id: Id;
  study_id: string;
  manifest_version: string;
  run_id: Id;
  at: IsoTime;
  mode: ScienceMode;
  n_local: number;
  stats: Array<{
    stat: string;
    key: string;
    value: number[];
    clipped: boolean;
  }>;
  dp: {
    mechanism: string;
    epsilon_spent: number;
    delta: number;
    noise_commitment: string;
  };
  share: {
    round: string;
    masked_b64: string;
    commitment: string;
  } | null;
  released: boolean;
  translog_seq: number;
  raw_values_left_device: false;
}
interface TransparencyLogEntry {
  seq: number;
  at: IsoTime;
  kind: 'manifest_verified' | 'manifest_rejected' | 'consent' | 'withdraw' | 'run' | 'release' | 'result_received' | 'mode_changed';
  /** sha256 chain. */
  study_id?: string;
  digest: string;
  prev: string;
  detail_zh: string;
}
//#endregion
//#region src/contracts/triage.d.ts
interface TriageFinding {
  id: Id;
  rule: string;
  priority: 'emergency' | 'must_surface' | 'should_surface';
  kind: 'critical_value' | 'progressive_pattern' | 'below_range' | 'screening' | 'treatment_signal';
  title_zh: string;
  numbers: NumberRef[];
  department_zh: string;
  tests_to_request_zh: string[];
  questions_zh: string[];
  status: 'open' | 'advised' | 'visited' | 'resolved' | 'dismissed';
  opened: IsoDay;
  care_item_id?: Id;
  /** The full sentence the chat and the brief use (deterministic). */
  text_zh: string;
}
interface DoctorBrief {
  id: Id;
  finding_ids: Id[];
  created: IsoDay;
  /** Deterministic. */
  trend: Array<{
    label_zh: string;
    points: NumberRef[];
  }>;
  meds_zh: string[];
  conditions_zh: string[];
  questions_zh: string[];
  tests_zh: string[];
  /** Model prose around refs, validated; the template otherwise. */
  summary_zh: string;
  /** dataDir/briefs/<id>.md, printable. */
  source: 'model' | 'template';
  file?: string;
}
//#endregion
//#region src/contracts/factpack.d.ts
type FactPriority = 'emergency' | 'must_surface' | 'should_surface' | 'context';
interface TopFact {
  id: Id;
  kind: 'triage' | 'safety_med' | 'safety_condition' | 'screening' | 'care_followup' | 'milestone' | 'goal';
  priority: FactPriority;
  /** Deterministic wording; the fallback shows it verbatim. */
  text_zh: string;
  refs: NumberRef[];
  /** TriageFinding / MemoryItem / FeedbackMessage ids. */
  source_ids: Id[];
  /** e.g. 'triage.pattern.microcytic_progressive'. */
  rule: string;
}
type Stage$1 = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine';
interface FactPack {
  version: 1;
  /** sha256 of the canonical generator-visible fields. */
  fp: string;
  today: IsoDay;
  stage: Stage$1;
  /** display_name stays on this machine: it is never part of a model input (D10). */
  person: {
    display_name: string;
    age: number | null;
    sex: 'female' | 'male' | 'other' | 'unknown';
  };
  /** Ranked (§2.4). */
  top_facts: TopFact[];
  numbers: NumberRef[];
  /** From the nba-registry providers, unranked. */
  candidates: NextBestAction[];
  /** Graded (M4); bioage and risk chips render these. */
  feedback: FeedbackMessage[];
  plan: {
    exists: boolean;
    version: number | null;
    days: number | null;
    open_checkins: number;
    adherence_pct: number | null;
    draft_hold: boolean;
  };
  exclusions: ExclusionItem[];
  safety: {
    drug_classes: DrugClass[];
    conditions: ConditionFlag[];
  };
  memory_digest_zh: string;
  /** Topic keys asked in the last 7 days. */
  asked_recent: string[];
  engagement: {
    season_title_zh: string | null;
    week: number | null;
    streak: number;
    freezes_left: number;
    open_quests: number;
    draws_available: number;
  } | null;
  science: {
    mode: ScienceMode;
    active_studies: number;
  };
  generations: {
    records: number;
    tracking: number;
    memory_rev: number;
    plan: number | null;
    triage_rev: number;
    season_rev: number;
  };
  /** M1: the findings after visits, the care answers, and the doctor-first stop still open (null when none). */
  triage: {
    findings: TriageFinding[];
    care: Array<{
      finding_id: string;
      care_status: string;
      visit_date: string | null;
      outcome_zh: string | null;
      updated: string;
    }>;
    stop: {
      title_zh: string;
      sentence_zh: string;
      needs_sex: boolean;
    } | null;
  };
  /** M5: the stage's own next step (the journey's rule), which the fact-ranked floor ranks among the others. */
  stage_next: {
    title_zh: string;
    detail_zh: string;
    action: string;
  } | null;
  /** Labeled library results for this generation. Empty until L4 records them. */
  method_results: MethodResult[];
}
declare const FACT_PRIORITY_RANK: Readonly<Record<FactPriority, number>>;
//#endregion
//#region src/contracts/agents.d.ts
type AgentProfileId = 'coach' | 'triage' | 'report_reader' | 'plan_codesigner' | 'evidence_explainer' | 'retest_reviewer' | 'research_coordinator' | 'memory_distiller';
declare const AGENT_PROFILE_IDS: readonly AgentProfileId[];
interface ObjectJsonSchema {
  type: 'object';
  properties: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
}
interface AgentRoute {
  provider?: string;
  model?: string;
  reasoningEffort: 'off' | 'low' | 'high' | 'max';
  maxTokens: number;
}
interface AgentProfile<I, O> {
  id: AgentProfileId;
  owner: ModuleId;
  modes: Array<'one_shot' | 'in_turn'>;
  /** The system prompt, assembled from files under src/agents/prompts/ (sections owned by their modules). */
  prompt: string[];
  /** In-turn toolFilter.allow. */
  tools: string[];
  /** One-shot `emit` tool parameters = the sub-agent outputSchema. */
  output_schema: ObjectJsonSchema;
  /** Overridden by config agents.<id>. */
  route: AgentRoute;
  deadline_ms: number;
  /** The slice sent (JSON); no raw record dumps and no display name (D10). */
  input(pack: FactPack, extra: I): unknown;
  validate(out: unknown, pack: FactPack, extra: I): {
    ok: true;
    value: O;
  } | {
    ok: false;
    errors: string[];
  };
  fallback(pack: FactPack, extra: I): O;
}
interface AgentRunRecord {
  profile: AgentProfileId;
  mode: 'one_shot' | 'in_turn';
  at: IsoTime;
  inputs_fp: string;
  source: 'model' | 'fallback';
  attempts: number;
  latency_ms: number;
  route: {
    provider: string;
    model: string;
    effort: string | null;
  };
  usage: TokenUsage;
  errors?: string[];
  budget_blocked?: boolean;
}
interface LlmCall {
  /** Never throws: returns the fallback with run.source='fallback'. */
  structured<I, O>(req: {
    profile: AgentProfile<I, O>;
    pack: FactPack;
    extra: I;
    signal?: AbortSignal;
  }): Promise<{
    value: O;
    run: AgentRunRecord;
  }>;
  /** The guard keeps this. */
  text(req: {
    system: string;
    user: string;
    route: AgentRoute;
    deadlineMs: number;
    signal?: AbortSignal;
  }): Promise<string>;
}
interface Specialists {
  consult<O>(profile: AgentProfileId, task_zh: string, exec: {
    agent: unknown;
    signal: AbortSignal;
  }): Promise<{
    value: O;
    run: AgentRunRecord;
  }>;
}
interface ValidatorRule {
  id: string;
  owner: ModuleId;
  applies: Array<SurfaceKind | 'feedback' | 'brief' | 'plan' | 'advice'>;
  /** null = pass. */
  check(text: string, card: {
    fact_ids: Id[];
    number_keys: string[];
  }, pack: FactPack): string | null;
}
//#endregion
//#region src/contracts/surfaces.d.ts
type ActionKind = 'emergency' | 'see_doctor' | 'prepare_brief' | 'log_visit_outcome' | 'screening_topic' | 'book_addon_test' | 'self_measure' | 'answer_profile' | 'connect_records' | 'upload_report' | 'checkin' | 'retest' | 'review_verdict' | 'draft_plan' | 'adjust_plan' | 'read_result' | 'learn' | 'season_quest' | 'claim_draw' | 'study_consent' | 'rest';
interface NextBestAction {
  id: Id;
  kind: ActionKind;
  /** Who proposed it (nba-registry). */
  provider: ModuleId;
  /** 0–100, deterministic. */
  priority: number;
  /** Only M1 (triage) and M2 (emergency) may set true. */
  mandatory: boolean;
  /** e.g. see_doctor(anaemia) blocks draft_plan for bioage levers. */
  blocks?: ActionKind[];
  reason_codes: string[];
  fact_ids: Id[];
  target: {
    surface: 'page' | 'chat' | 'pane' | 'settings';
    tab?: string;
    section?: string;
    prompt_zh?: string;
    tool?: string;
  };
  due?: IsoDay;
  expires?: IsoDay;
  /** Deterministic fallback wording. */
  title_zh: string;
  detail_zh: string;
}
type SurfaceKind = 'greeting' | 'status' | 'next_step' | 'suggestion' | 'weekly_narrative' | 'nudge' | 'care' | 'season';
interface SurfaceCard {
  id: Id;
  kind: SurfaceKind;
  text_zh: string;
  detail_zh?: string;
  /** NextBestAction.id this card performs. */
  action_id?: Id;
  /** Suggestion chips: exactly what goes into the composer. */
  prompt_zh?: string;
  /** TopFact ids referenced. */
  fact_ids: Id[];
  /** Every number in text ∈ FactPack.numbers[].key. */
  number_keys: string[];
  tone: 'neutral' | 'encourage' | 'celebrate' | 'care' | 'urgent';
  source: 'model' | 'fallback' | 'rule';
  /** Set by the post-filter; the renderer trusts it. */
  override?: {
    rule: string;
    reason: string;
  };
}
interface SurfaceSet {
  version: 1;
  /** = FactPack.fp used. */
  inputs_fp: string;
  day: IsoDay;
  generated_at: IsoTime;
  valid_until: IsoTime;
  source: 'model' | 'fallback' | 'mixed';
  stale: boolean;
  greeting: SurfaceCard;
  status: SurfaceCard;
  next: {
    action: NextBestAction;
    card: SurfaceCard;
  };
  /** Ranked rest (page 概览). */
  more: NextBestAction[];
  /** 2–4. */
  suggestions: SurfaceCard[];
  weekly?: SurfaceCard;
  nudge?: SurfaceCard;
  run?: AgentRunRecord;
  validation: {
    passed: string[];
    failed: Array<{
      rule: string;
      card_id: Id;
      detail: string;
    }>;
  };
}
/** What chat and page both read (read_personal_situation.page, /journey.surfaces, pre-step snapshot). */
interface PageState {
  inputs_fp: string;
  status_zh: string;
  next: {
    kind: ActionKind;
    title_zh: string;
    detail_zh: string;
    mandatory: boolean;
  };
  top_facts: Array<Pick<TopFact, 'id' | 'kind' | 'priority' | 'text_zh'>>;
  feedback: Array<Pick<FeedbackMessage, 'id' | 'subject' | 'grade' | 'headline_zh' | 'allowed_claims'>>;
  suggestions_zh: string[];
}
type CandidateProvider = (pack: Omit<FactPack, 'candidates' | 'fp'>) => NextBestAction[];
/** Providers registered as these modules may propose a mandatory action. */
declare const MANDATORY_PROVIDERS: readonly ModuleId[];
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
    riskUnknown?: RiskFact[];
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
    status: RecordStatus;
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
      headline_zh?: string;
      allows_younger?: boolean;
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
  /**
   * A critical value or red-cell pattern (plan-safety.ts): see a doctor before any plan. When stop is true the
   * next step is this, whatever the stage after the profile, and no plan is drafted.
   */
  doctor_first: {
    stop: boolean;
    title_zh: string;
    sentence_zh: string;
    hits: Array<{
      key: string;
      short_zh: string;
      text_zh: string;
    }>;
  };
  next: {
    stage: Stage;
    title_zh: string;
    detail_zh: string;
    action: 'consent' | 'profile' | 'records' | 'addons' | 'plan' | 'checkin' | 'review' | 'open' | 'doctor';
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
  /**
   * 0.5.3: the fact-ranked surfaces (status, next step, suggestions) the page, the home and the chat all read.
   * next and suggestions above are this set in the older shape.
   */
  surfaces: SurfaceSet;
  /** 0.5.3 (M1): the findings for a doctor, what the person answered about going, and whether sex is needed. */
  triage: {
    findings: TriageFinding[];
    care: FactPack['triage']['care'];
    needs_sex: boolean;
    top_facts: FactPack['top_facts'];
  };
  /** Labeled library results for this generation. Empty until one is recorded. */
  method_results: MethodResult[];
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
type DraftCategory$1 = (typeof DRAFT_CATEGORIES)[number];
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
    stop_zh?: string;
    no_weight_loss?: boolean;
  };
  /** Evidence ids and titles the person already refused. */
  excluded_ids?: string[];
  excluded_phrases?: string[];
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
  category: DraftCategory$1;
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
  /** Limits they just stated (不要限时进食, 怀孕). Saved, and applied to this draft. */
  constraints?: string;
}
/**
 * A draft's focus and markers as the tool and the accept route both read them: unknown focus values are
 * dropped (none left, the saved focus), markers trimmed, at most 8 of 40 characters or fewer.
 */
declare function briefOptionsOf(focus: unknown, markers: unknown): BriefOptions;
declare function buildPlanBrief(context: TrackingContext & {
  mount?: MountState;
}, options?: BriefOptions): Promise<PlanBrief>;
declare function expectedText(row: EffectRow): string;
/**
 * Up to maxItems (default 3) items that cover the most important priorities with the largest verified
 * effects: one item per intervention, at most one supplement, different categories first. Deterministic;
 * saves nothing. Null when there is nothing evidence-backed to propose.
 */
/** The Chinese reply for this draft. The model sends it and does not call another tool first. */
/** Walking, meal quality, sleep, and smoking or alcohol. No fast, no large weight target, no supplement, no iron. */
declare function softHoldDraft(today: string, notes?: readonly string[]): PlanDraft;
declare function replyForDraft(brief: PlanBrief, draft: PlanDraft | null): string;
/**
 * Keep the draft's date while the labs and medicines are the same. A new day,
 * by itself, does not retitle the draft. A new exclusion regenerates the items
 * and keeps the date.
 */
declare function settleDraft(dataDir: string, brief: PlanBrief, today: string, opts?: {
  maxItems?: number;
}): PlanDraft | null;
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
//#region src/advice/playbook.d.ts
type AdviceKind = 'supplement' | 'diagnosis_first' | 'prescription' | 'symptom' | 'plan' | 'lab' | 'benign';
interface AdviceExtra {
  when: RegExp;
  say: string;
  anchors?: string[];
  /** When this extra matches, the card's base paragraph is left out. */
  replaces?: boolean;
}
interface AdviceCard {
  id: string;
  tier: 1 | 2 | 3 | 4;
  kind: AdviceKind;
  /** Substring aliases, already lower-case. Longer wins. Ignored when `pattern` is set. */
  aliases: string[];
  pattern?: RegExp;
  /** When `pattern` matches, this must match too. */
  require?: RegExp;
  exclude?: RegExp;
  source: string;
  say: string;
  anchors: string[];
  /** Emergency: each inner list is OR; every group must show up in the first sentences. */
  lead?: string[][];
  extras?: AdviceExtra[];
  /** Missing anchors are corrected even when the reply is not a bare refusal. */
  critical?: boolean;
  ownerHint?: boolean;
}
/** The first matching emergency script, more specific rows first. A negated, historical, family-history, or hypothetical mention does not match. */
declare function emergencyScript(text: string): AdviceCard | null;
/**
 * A computed phenotypic age the tools already validated, with the honest framing
 * (模型估计 / 不是变慢 / 波动). The corrector must not throw this sentence away.
 */
declare function keepsValidatedComputation(reply: string): boolean;
interface SteerNeed {
  kind: 'emergency' | 'concrete' | 'fasting';
  say: string;
  summary: string;
}
declare function steerNeed(userText: string, reply: string): SteerNeed | null;
//#endregion
//#region src/triage/care.d.ts
type CareStatus = CareItem['care_status'];
declare function careItems(dataDir: string): CareItem[];
declare function careFor(dataDir: string, findingId: string): CareItem | null;
interface VisitInput {
  finding_id?: string;
  status: CareStatus;
  visit_date?: string;
  department_zh?: string;
  outcome_zh?: string;
  quote_zh?: string;
  /** The person's own message this turn, for the verbatim check. */
  said_zh?: string;
  /** Civil day used to resolve 下周一. */
  today?: string;
  via: 'chat' | 'page';
  session_id?: string;
  confirmed?: boolean;
}
/** Whether their words name this calendar day (2026-10-05, 10月5日, or 下周一 when that is the day). */
declare function dateSaid(quote: string, visitDate: string, today?: string): boolean;
/** They are denying a booking (没约那一天, 页头说我已约). */
declare function deniesBooking(quote: string): boolean;
/**
 * A booking is theirs only when the quote is their words, says they booked, and names the date.
 * 「下周一去社区医院」 is a plan, not a booking. 「页头说我已约 10 月 5 日」 is a denial.
 */
declare function affirmsBooking(quote: string, said: string, visitDate: string, today?: string): boolean;
/**
 * Record a booking, a visit or a decision not to go. Without a finding id it applies to the first open
 * finding. Supersedes the finding's previous care item, so the history stays in memory_log.
 */
declare function logCareVisit(dataDir: string, input: VisitInput, findings: readonly TriageFinding[]): {
  ok: true;
  item: CareItem;
  cleared?: boolean;
  kept?: boolean;
} | {
  ok: false;
  error: string;
};
interface CareState {
  /** The stop after visits: findings a doctor has seen since their values are taken out. */
  stop: StopResult;
  findings: TriageFinding[];
  /** Findings a doctor has seen, with what they said. */
  seen: Array<{
    finding: TriageFinding;
    care: CareItem;
  }>;
}
/**
 * The record's stop with the person's visits applied. A finding counts as seen when a visit is logged on
 * or after the date of its newest value; a checkup after the visit that still shows it opens it again.
 */
declare function careState(dataDir: string, stop: StopResult, today: string): CareState;
/** What the doctor said, for the plan's notes: one line per finding seen. */
declare function seenNotes(state: CareState): string[];
//#endregion
//#region src/privacy/pending.d.ts
/** True until the person has granted or declined sending health chat to DeepSeek. A missing decision is still required. */
declare function deepseekConsentPending(decision: string | null | undefined): boolean;
//#endregion
//#region src/privacy/egress.d.ts
declare const CONSENT_HOLD_ZH = "还没有同意把健康对话发给 DeepSeek，所以这次不把健康信息发出去。请在开始页或档案里选择「我知道了，同意把健康对话发给 DeepSeek」。";
/**
 * `blob` is the whole call (system prompt included). `personText` is only what the person typed.
 * A symptom in the persona or a safety note does not count as their emergency.
 */
declare function modelEgress(granted: boolean, blob: string, personText?: string): 'send' | 'hold' | 'local_aid';
/** First aid from the local scripts. Nothing in `text` is sent to the model. */
declare function localAidText(text: string): string;
//#endregion
//#region src/doctor-first.d.ts
declare function buildDoctorFirst(context: {
  config: Config;
  records: RecordSnapshot;
  today: string;
}): Promise<StopResult>;
//#endregion
//#region src/plan-hold.d.ts
declare function holdPlanDraft(session?: string, ms?: number, now?: number): void;
declare function releasePlanDraft(session?: string): void;
declare function planDraftHeld(session?: string, now?: number): boolean;
/** The session id of the agent a tool or hook runs for; '' when there is none. */
declare function sessionKey(agent: unknown): string;
//#endregion
//#region src/contracts/plan.d.ts
type DraftCategory = 'diet' | 'exercise' | 'sleep' | 'weight' | 'behavior' | 'supplement';
/** Z's shape, kept as a view: excluded_* also come from ExclusionItems; draft state stays in plan_prefs.json. */
interface PlanPrefs {
  excluded_ids: string[];
  excluded_phrases: string[];
  /** Items taken out on the page, so 恢复 can put them back after a reload. */
  removed_items: Array<{
    id: string;
    title: string;
  }>;
  pregnant: boolean | null;
  ckd: boolean | null;
  /** Whether they drink alcohol, from their own answer; null = never asked, so no alcohol item. */
  drinks: boolean | null;
  drafted_on: IsoDay | '';
  clinical_fp: string;
  content_fp: string;
  draft: unknown;
}
interface PlanDraftItem {
  id: string;
  category: DraftCategory;
  title_zh: string;
  /** A behavioural target only when evidence, data or a skill gives the number. */
  behaviour_zh: string;
  target?: {
    marker_key: string;
    label_zh: string;
  };
  evidence: {
    effect_zh: string;
    population_zh: string;
    doi: string | null;
    design: 'meta' | 'rct' | 'cohort' | 'guideline' | 'mechanistic';
  };
  needs_doctor: boolean;
  /** From plan-safety.ts rules only (e.g. the SGLT2i note, the fish-oil note). */
  cautions_zh: string[];
  start: IsoDay;
}
interface PlanDraftV2 {
  id: Id;
  version: 2;
  drafted_on: IsoDay;
  basis: {
    fact_fp: string;
    memory_rev: number;
    triage: 'clear' | 'doctor_first';
  };
  /** Doctor-first: the draft is limited or paused, never silently produced. */
  hold?: {
    reason_zh: string;
    finding_ids: Id[];
  };
  items: PlanDraftItem[];
  goals: Array<{
    marker_key: string;
    value: number;
    unit: string;
    label_zh: string;
    kind: 'trial_average_projection';
  }>;
  removed: Array<{
    item_id: string;
    why: 'exclusion' | 'safety' | 'unsuitable' | 'duplicate';
    rule_or_memory_id: string;
  }>;
  /** The co-designer's own words; validated. */
  rationale_zh?: string;
  source: 'rules' | 'co_designer';
}
//#endregion
//#region src/plan-prefs.d.ts
declare function readPlanPrefs(dataDir: string): PlanPrefs;
/** Take an exclusion back everywhere (memory retract through the chat or the page). */
declare function forgetExclusion(dataDir: string, keys: string[]): PlanPrefs;
/** Drop or restore one drafted item. The title is stored as a phrase so the same intervention cannot regrow under another evidence id. */
declare function setPlanExclusion(dataDir: string, item: {
  id?: string;
  title?: string;
  excluded: boolean;
}): PlanPrefs;
declare function rememberExclusions(dataDir: string, phrases: readonly string[]): PlanPrefs;
/** Whether they drink, from their own words: 不喝酒 → false; 喝酒, 一个月两杯红酒 → true. null leaves it as it was. */
declare function drinkingFromText(text: string): boolean | null;
declare function setDrinking(dataDir: string, drinks: boolean): PlanPrefs;
//#endregion
//#region src/meds-stated.d.ts
interface StatedMedication {
  name: string;
  dose_text: string;
  frequency_text: string;
  since: string;
  at: string;
}
declare function readStatements(dataDir: string): StatedMedication[];
/** Mirobody prints a once-daily plan as "0x/day" (period of 1 day, count left at 0). */
declare function fixScheduleText(text: string): string;
/**
 * One current line per drug. A statement the person just asked to remember
 * wins. An older or ended plan stays on a second line so it is not read as today's dose.
 */
declare function presentMedications(rows: readonly MedicationRow[], stated?: readonly StatedMedication[]): {
  rows: MedicationRow[];
  lines: string[];
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
//#region src/core/nba-registry.d.ts
declare function registerCandidates(module: ModuleId, provider: CandidateProvider): () => void;
/**
 * Every provider's candidates for this pack. A provider that throws adds nothing; a mandatory flag from a
 * provider not registered as M1 or M2 is cleared, and each candidate carries the module it came from.
 */
declare function collectCandidates(pack: Omit<FactPack, 'candidates' | 'fp'>): NextBestAction[];
declare function candidateProviders(): number;
//#endregion
//#region src/core/validate.d.ts
type ValidatedKind = SurfaceKind | 'feedback' | 'brief' | 'plan' | 'advice';
declare function registerValidator(rule: ValidatorRule): () => void;
/** Every number a card may quote: the pack's numbers (and their roundings), dates, and the deterministic texts. */
declare function allowedNumbers(pack: FactPack): Set<string>;
declare const BASE_RULES: ValidatorRule[];
declare function validatorRules(): readonly ValidatorRule[];
/** The failures of every rule that applies to this kind of output; empty when it passes. */
declare function runValidators(kind: ValidatedKind, text: string, card: {
  fact_ids: Id[];
  number_keys: string[];
}, pack: FactPack): Array<{
  rule: string;
  detail: string;
}>;
/** Only the module-registered rules (C0 behaviour, for the registry test). */
declare function runRegistered(kind: ValidatedKind, text: string, card: {
  fact_ids: Id[];
  number_keys: string[];
}, pack: FactPack): Array<{
  rule: string;
  detail: string;
}>;
//#endregion
//#region src/core/files.d.ts
declare const DATA_FILES: {
  readonly profile: {
    readonly path: "profile.json";
    readonly writer: "M11/M7";
  };
  readonly connection: {
    readonly path: "connection.json";
    readonly writer: "M7";
  };
  readonly planPrefs: {
    readonly path: "plan_prefs.json";
    readonly writer: "M3";
  };
  readonly medicationStatements: {
    readonly path: "medication_statements.jsonl";
    readonly writer: "M7";
  };
  readonly followup: {
    readonly path: "followup.json";
    readonly writer: "M6";
  };
  readonly guardStats: {
    readonly path: "guard-stats.json";
    readonly writer: "M2";
  };
  readonly memory: {
    readonly path: "memory.json";
    readonly writer: "M0";
  };
  readonly memoryLog: {
    readonly path: "memory_log.jsonl";
    readonly writer: "M0";
  };
  readonly events: {
    readonly path: "events.jsonl";
    readonly writer: "M0";
  };
  readonly eventsCursor: {
    readonly path: "events_cursor.json";
    readonly writer: "M0";
  };
  readonly usage: {
    readonly path: "usage.jsonl";
    readonly writer: "M0";
  };
  readonly surfaces: {
    readonly path: "surfaces.json";
    readonly writer: "M5";
  };
  readonly surfacesLog: {
    readonly path: "surfaces_log.jsonl";
    readonly writer: "M5";
  };
  readonly triage: {
    readonly path: "triage.json";
    readonly writer: "M1";
  };
  readonly briefs: {
    readonly path: "briefs";
    readonly writer: "M1";
  };
  readonly feedback: {
    readonly path: "feedback.jsonl";
    readonly writer: "M4";
  };
  readonly engage: {
    readonly path: "engage";
    readonly writer: "M6";
  };
  readonly datain: {
    readonly path: "datain";
    readonly writer: "M7";
  };
  readonly science: {
    readonly path: "science";
    readonly writer: "M8";
  };
  readonly privacy: {
    readonly path: "privacy";
    readonly writer: "M11";
  };
};
//#endregion
//#region src/contracts/codex.d.ts
type Rarity = 'common' | 'rare' | 'epic' | 'legendary';
interface CodexCard {
  id: Id;
  family: 'method' | 'species' | 'insight' | 'utility';
  title_zh: string;
  body_zh: string;
  rarity: Rarity;
  /** Method cards: from skill.json tier. */
  evidence_tier?: 'human_rct' | 'human_obs' | 'animal' | 'cell';
  skill?: string;
  species?: string;
  utility?: 'streak_freeze' | 'deep_dive' | 'doctor_questions';
  /** Generated per person by the coach, never rarity-by-biomarker. */
  insight?: {
    min_days_of_data: number;
  };
  hidden: boolean;
  set_id: Id;
  source: {
    doi?: string;
    skill?: string;
  };
}
interface DropTable {
  id: Id;
  version: number;
  season_id: Id | null;
  /** Sums to 1; shown verbatim on the page. */
  odds: Record<Rarity, number>;
  pity: {
    after_draws: number;
    min_rarity: Rarity;
  };
  daily_cap: number;
  /** Care actions guarantee at least this (rare). */
  care_guarantee: Rarity;
  pools: Record<Rarity, Id[]>;
  money: 'none';
  trading: 'none';
  biomarker_linked_rarity: false;
}
interface DrawResult {
  id: Id;
  grant_id: Id;
  card_id: Id;
  rarity: Rarity;
  duplicate: boolean;
  pity_before: number;
  rng: {
    algo: 'sha256-counter';
    seed_commitment: string;
    counter: number;
  };
  at: IsoTime;
}
declare function oddsSumToOne(table: Pick<DropTable, 'odds'>): boolean;
//#endregion
//#region src/contracts/engagement.d.ts
interface Season {
  id: Id;
  kind: 'personal' | 'community';
  title_zh: string;
  theme: {
    focus: Focus$1 | 'care' | 'data';
    marker_keys: string[];
  };
  /** 56–84 days; end aligned to the recommended retest. */
  start: IsoDay;
  end: IsoDay;
  retest_day: IsoDay | null;
  status: 'upcoming' | 'active' | 'retest_window' | 'closed';
  chapters: Array<{
    week: number;
    title_zh: string;
  }>;
  quest_ids: Id[];
  unlock_ids: Id[];
  codex_set_id?: Id;
  study_id?: string;
}
type QuestKind = 'care' | 'data' | 'behaviour' | 'learn' | 'retest' | 'reflect' | 'science_n_of_1';
interface Quest {
  id: Id;
  season_id: Id;
  kind: QuestKind;
  title_zh: string;
  criteria: {
    event: HealthEventType;
    where?: Record<string, string | number | boolean>;
    count: number;
    within_days?: number;
  };
  progress: number;
  status: 'open' | 'done' | 'expired' | 'waived';
  reward: {
    draws: number;
    guaranteed_min_rarity?: Rarity;
    unlock_id?: Id;
  };
  /** The coach may phrase or choose among rule templates, never invent criteria. */
  origin: 'rule' | 'coach';
}
interface Unlock {
  id: Id;
  /** 'bioage' | 'cvd_risk' | 'trend_chart' | 'doctor_brief' | 'n_of_1' | a skill name … */
  key: string;
  /** Replaces "还差 N 项检查". */
  title_zh: string;
  teaser_zh: string;
  requires: Array<{
    kind: 'input' | 'event' | 'quest';
    key: string;
    label_zh: string;
  }>;
  status: 'locked' | 'unlocked';
  unlocked_at?: IsoTime;
}
interface StreakState {
  current: number;
  best: number;
  freezes_available: number;
  frozen: Array<{
    day: IsoDay;
    reason: 'sick' | 'travel' | 'other';
    event_id: Id;
  }>;
  last_active: IsoDay | null;
}
interface DrawGrant {
  id: Id;
  kind: 'standard' | 'care_guaranteed';
  earned_by: Id;
  granted: IsoDay;
  used_by?: Id;
}
//#endregion
//#region src/contracts/events.d.ts
interface HealthEventPayloads {
  'report.arrived': {
    checkup_day: IsoDay;
    indicators: number;
    narrative_findings: number;
    source: 'upload' | 'record_poll';
  };
  'record.changed': {
    catalogue_fp: string;
    generation: number;
  };
  'memory.changed': {
    rev: number;
    kinds: MemoryKind[];
    safety_relevant: boolean;
    item_ids: Id[];
  };
  'triage.opened': {
    finding_id: Id;
    priority: 'emergency' | 'must_surface' | 'should_surface';
    rule: string;
  };
  'triage.resolved': {
    finding_id: Id;
    how: 'visited' | 'normalised' | 'dismissed_by_person' | 'superseded';
  };
  'care.advised': {
    finding_id: Id;
    department_zh: string;
  };
  'care.booked': {
    department_zh: string;
    day: IsoDay;
  };
  'care.visit_logged': {
    care_item_id: Id;
    finding_id?: Id;
    with_brief: boolean;
  };
  'brief.generated': {
    brief_id: Id;
    finding_ids: Id[];
    source: 'model' | 'template';
  };
  'plan.drafted': {
    draft_id: Id;
    items: number;
    source: 'rules' | 'co_designer';
    hold: boolean;
  };
  'plan.saved': {
    version: number;
    items: number;
  };
  'plan.item_excluded': {
    item_id: string;
    exclusion_id: Id;
  };
  'checkin.logged': {
    day: IsoDay;
    item_ids: string[];
    done: boolean | null;
  };
  'selfmeasure.logged': {
    key: string;
    day: IsoDay;
  };
  'life_event.logged': {
    memory_id: Id;
    event: LifeEventItem['event'];
    from: IsoDay;
    to: IsoDay | null;
  };
  'streak.frozen': {
    day: IsoDay;
    reason: 'sick' | 'travel' | 'other';
  };
  'retest.due': {
    marker_key: string;
    day: IsoDay;
  };
  'retest.arrived': {
    marker_keys: string[];
    day: IsoDay;
  };
  'verdict.changed': {
    item_id: string;
    marker_key: string;
    from: string;
    to: string;
  };
  'feedback.issued': {
    feedback_id: Id;
    grade: EvidenceGrade;
    subject_key: string;
  };
  'season.started': {
    season_id: Id;
  };
  'season.ended': {
    season_id: Id;
    completed_quests: number;
  };
  'quest.completed': {
    quest_id: Id;
    season_id: Id;
    kind: QuestKind;
  };
  'unlock.granted': {
    unlock_id: Id;
    key: string;
  };
  'codex.draw_earned': {
    grant_id: Id;
    kind: DrawGrant['kind'];
    by_event: Id;
  };
  'codex.drawn': {
    draw_id: Id;
    card_id: Id;
    rarity: Rarity;
  };
  'study.consented': {
    study_id: string;
    consent_id: Id;
  };
  'study.withdrawn': {
    study_id: string;
    consent_id: Id;
  };
  'study.run_completed': {
    study_id: string;
    run_id: Id;
    released: boolean;
  };
  'study.n_of_1_completed': {
    study_id: string;
    season_id: Id;
  };
  'consent.changed': {
    scope: ConsentRecord['scope'];
    decision: ConsentRecord['decision'];
  };
  'day.rolled': {
    day: IsoDay;
  };
  /** save_personal_profile, POST /profile. */
  'profile.changed': {
    fields: string[];
  };
  'surface.generated': {
    inputs_fp: string;
    source: SurfaceSet['source'];
    latency_ms: number;
  };
  'chat.turn_ended': {
    session_id: string;
    turn: number;
    health: boolean;
    prefilter_hit: boolean;
  };
  'nudge.shown': {
    nudge_id: Id;
    where: 'overlay' | 'dock' | 'notification';
  };
}
type HealthEventType = keyof HealthEventPayloads;
interface HealthEventSource {
  module: ModuleId;
  via: 'tool' | 'route' | 'timer' | 'hook' | 'record_poll' | 'migration';
  tool?: string;
  session_id?: string;
}
type HealthEvent = { [K in HealthEventType]: {
  id: Id;
  type: K;
  at: IsoTime;
  day: IsoDay;
  source: HealthEventSource;
  payload: HealthEventPayloads[K];
  causation_id?: Id;
}; }[HealthEventType];
declare module '@deepseek-ai/cordis' {
  interface Events {
    'longpi/event'(event: HealthEvent): void;
  }
}
interface Bus {
  emit<T extends HealthEventType>(type: T, payload: HealthEventPayloads[T], source: HealthEventSource, causation_id?: Id): HealthEvent;
  on(types: HealthEventType[] | '*', fn: (e: HealthEvent) => void | Promise<void>, label: string, opts?: {
    durable?: boolean;
  }): () => void;
  since(cursor: Id | null, types?: HealthEventType[]): HealthEvent[];
}
/** Only the owning module emits a given type (AA §3.4). */
declare const EVENT_OWNERS: Readonly<Record<HealthEventType, ModuleId>>;
//#endregion
//#region src/skills-provider.d.ts
/** Worse than the four LongPi harness skills, so a shared name cannot hide them. */
declare const LIBRARY_SKILL_RANK = 800;
declare const LIBRARY_PROVIDER = "longpi-library";
/** One line the model can route on. Tier C starts with the species. */
declare function whenToUseOf(card: SkillCard): string;
/** Always-on catalog line. English descriptions stay out. */
declare function catalogDescription(card: SkillCard): string;
/** Every catalog card. Nothing is dropped for tier or species. */
declare function listEntries(home?: string): SkillIndexEntry[];
//#endregion
//#region src/method-collect.d.ts
interface CollectInput {
  home: string;
  dataDir: string;
  pinnedVersion?: string;
  profile: BindingProfile;
  indicators: readonly RecordIndicator[];
  python: string;
  timeoutMs: number;
  runtimes?: Record<string, string>;
  budgetMs?: number;
}
/** Exit-0 runs, including scripts that then have no personal number. */
declare function collectMethodResults(input: CollectInput): Promise<MethodResult[]>;
/** What the overview draws: personal numbers only. Evidence rows stay in the full run list. */
declare function pageMethodResults(rows: readonly MethodResult[]): MethodResult[];
declare function publishMethodResults(rows: readonly MethodResult[]): MethodResult[];
/** Unit tests keep the journey on the 0.5.6 path unless this is set. dsh collects. */
declare function collectOnJourney(): boolean;
//#endregion
//#region src/core/method-results.d.ts
declare function setMethodResults(rows: readonly MethodResult[]): void;
/** Keep one row per skill. A later run of the same skill replaces the earlier label. */
declare function recordMethodResult(row: MethodResult): void;
declare function currentMethodResults(): MethodResult[];
//#endregion
//#region src/core/method-view.d.ts
interface OverviewSlice {
  value: MethodResult[];
  evidence: MethodResult[];
}
/** Personal results first (PhenoAge and China-PAR stay in the slice), then evidence rows. */
declare function overviewSlice(results: readonly MethodResult[]): OverviewSlice;
/** Verified and unverified-binding results the overview actually draws. */
declare function methodsOnPage(results: readonly MethodResult[]): number;
//#endregion
//#region src/contracts/advice.d.ts
type AdviceTier = 1 | 2 | 3 | 4;
interface AdviceTierResult {
  tier: AdviceTier;
  /** The table wins; the model only for unknown subjects, never lowering a table tier. */
  tier_source: 'table' | 'model' | 'rule_emergency';
  subject: {
    name_zh: string;
    kind: 'supplement' | 'otc' | 'diagnosis_first' | 'prescription' | 'symptom' | 'unknown';
    table_id?: string;
  };
  tier1?: {
    usual_range_zh: string;
    upper_limit?: {
      value: number;
      unit: string;
      source: string;
    };
    trial_doses: Array<{
      text_zh: string;
      source: string;
    }>;
    who_should_not_zh: string[];
    interactions: Array<{
      with_memory_id: Id;
      text_zh: string;
    }>;
    test_first_zh: string[];
  };
  tier2?: {
    tests_zh: string[];
    department_zh: string;
    what_doctor_does_zh: string;
    why_not_self_start_zh: string;
    person_values: NumberRef[];
    urgency: 'now' | 'days' | 'weeks';
  };
  tier3?: {
    evidence_zh: string;
    strength: 'strong' | 'moderate' | 'weak' | 'none';
    trial_regimens: Array<{
      text_zh: string;
      trial: string;
      source: string;
      as_information: true;
    }>;
    who_might_benefit_zh: string;
    specialist_zh: string;
    questions_to_ask_zh: string[];
  };
  /** first_aid from data/advice/emergencies.json, shown first. */
  tier4?: {
    first_aid_zh: string[];
    call_zh: string;
    go_to_zh: string;
  };
  person: {
    meds_considered: Id[];
    conditions_considered: Id[];
    contraindicated: boolean;
    notes_zh: string[];
  };
  /** A refusal-only answer is not representable. */
  refusal_only: false;
}
//#endregion
//#region src/contracts/index.d.ts
type RouteHandler = (req: {
  method: string;
  url: string;
  query: URLSearchParams;
  headers: Record<string, unknown>;
}, body: unknown) => Promise<unknown>;
interface CoreDeps {
  config: () => Config;
  bus: Bus;
  memory: MemoryApi;
  factpack: {
    build(opts?: {
      refresh?: boolean;
    }): Promise<FactPack>;
    cached(): FactPack | null;
  };
  llm: LlmCall;
  specialists: Specialists;
  budget: {
    remaining(): {
      input: number;
      output: number;
      spawns: number;
    };
    record(run: AgentRunRecord): void;
  };
  http: {
    route(method: 'GET' | 'POST' | 'DELETE', path: `/api/longpi/${string}`, handler: RouteHandler): void;
  };
  nba: {
    register(module: ModuleId, provider: CandidateProvider): () => void;
  };
  validators: {
    register(rule: ValidatorRule): () => void;
  };
  mount: MountState;
  /** Everything a journey is built from, read now (config, dataDir, records, catalog, today). */
  context: () => Promise<JourneyContext>;
  /** The dataDir now (config may change on reload). */
  dataDir: () => string;
  /** Drop the cached records and tracking so the next build reads again. */
  invalidate: () => void;
}
//#endregion
//#region src/triage/register.d.ts
declare function register$9(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/advice/register.d.ts
declare function register$8(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/plan/register.d.ts
declare function register$7(_ctx: Context, _deps: CoreDeps): void;
//#endregion
//#region src/feedback/register.d.ts
declare function register$6(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/surfaces/register.d.ts
declare function register$5(_ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/engage/register.d.ts
declare function register$4(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/datain/register.d.ts
declare function register$3(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/honesty/register.d.ts
declare function register$2(_ctx: Context, _deps: CoreDeps): void;
//#endregion
//#region src/science/register.d.ts
declare function register$1(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/privacy/register.d.ts
declare function register(ctx: Context, deps: CoreDeps): void;
//#endregion
//#region src/modules.d.ts
declare const MODULES: readonly [readonly ["M9", typeof register$2], readonly ["M2", typeof register$8], readonly ["M1", typeof register$9], readonly ["M3", typeof register$7], readonly ["M7", typeof register$3], readonly ["M4", typeof register$6], readonly ["M5", typeof register$5], readonly ["M6", typeof register$4], readonly ["M11", typeof register], readonly ["M8", typeof register$1]];
declare function registerModules(ctx: Context, deps: CoreDeps, log?: (message: string) => void): void;
//#endregion
//#region src/core/bus.d.ts
interface LocalBus extends Bus {
  /** Subscribers, for tests and the dispatcher. */
  listeners(): number;
}
declare function createBus(opts: {
  dataDir: () => string;
  ctx?: Context | null;
  log?: (message: string) => void;
}): LocalBus;
declare function setBus(bus: LocalBus | null): void;
declare function currentBus(): LocalBus | null;
//#endregion
//#region src/core/memory.d.ts
declare function drugClassesOf(name: string): DrugClass[];
declare function conditionFlagsOf(text: string): ConditionFlag[];
declare function computeSafety(item: Pick<MemoryItem, 'kind'> & Partial<{
  drug_class: DrugClass[];
  flags: ConditionFlag[];
}>): boolean;
interface MemoryStore extends MemoryApi {
  /** The ids of the active exclusion items whose phrase is this one. */
  exclusionIds(phrase: string): Id[];
  latestCare(): CareItem | null;
}
declare function createMemory(dataDir: () => string): MemoryStore;
/** The memory of the person whose data lives in dataDir (one profile = one person). Legacy files are imported on first use. */
declare function memoryFor(dataDir: string): MemoryStore;
/**
 * Z's plan_prefs.json (excluded phrases and ids, pregnant, ckd) once, and every medication statement not yet
 * mirrored (by statement id), as memory items with provenance 'migration' (statements: 'import').
 */
declare function migrateLegacy(store: MemoryStore, dataDir: string): void;
//#endregion
//#region src/core/store.d.ts
/** The file's value, or empty() when it does not exist. A damaged file is copied aside once and empty() returned. */
declare function readJson<T>(path: string, parse: (raw: unknown) => T, empty: () => T): T;
declare function writeJsonAtomic(path: string, value: unknown): void;
/** One JSON line, appended whole (a single write call). */
declare function appendJsonl(path: string, row: unknown): void;
/** Every parseable line; a torn line is skipped. */
declare function readJsonl<T>(path: string, keep?: (raw: unknown) => T | null): T[];
//#endregion
//#region src/core/topfacts.d.ts
interface TopFactInput {
  care: CareState;
  hits: readonly StopHit[];
  /** Current medicines by name with their classes (record and memory). */
  meds: Array<{
    name: string;
    classes: DrugClass[];
  }>;
  conditions: ConditionFlag[];
  changes: readonly RecordChange[];
  goals: Array<{
    id: string;
    text_zh: string;
  }>;
  /** Screening topics (M1, triage/screening.ts), already ranked. */
  screening?: TopFact[];
  /** The stop used the men's limits because no sex is on file. */
  needsSex?: boolean;
  /**
   * Labeled method results for this generation. Omitted means the registered
   * hook, which is empty until a run is recorded. They rank under triage and
   * safety: an emergency, a critical pattern, and a safety medicine stay first.
   */
  methods?: readonly MethodResult[];
}
declare function rankTopFacts(input: TopFactInput): TopFact[];
//#endregion
//#region src/core/factpack.d.ts
interface PackInput {
  dataDir: string;
  today: string;
  stage: Stage$1;
  person: FactPack['person'];
  care: CareState;
  /** Every hit of the record's stop, before visits (the status line quotes their values). */
  hits: readonly StopHit[];
  needsSex: boolean;
  medications: string[];
  changes: readonly RecordChange[];
  results: {
    bioage: {
      phenoage: number | null;
      advance: number | null;
      date: string | null;
    };
    risk: {
      risk_pct: number | null;
      date: string | null;
    };
  };
  plan: {
    exists: boolean;
    version: number | null;
    days: number | null;
    open_checkins: number;
    adherence_pct: number | null;
  };
  self: Array<{
    key: string;
    label_zh: string;
    value: number;
    unit: string;
    date: string;
  }>;
  stageNext: FactPack['stage_next'];
  /** No checkup in the record yet (the empty state). */
  emptyRecord: boolean;
  tracking?: Tracking;
  trackingGeneration: number;
}
/** sha256 over the fields generators read (not the display name, not timestamps). */
declare function packFp(pack: Omit<FactPack, 'fp'>): string;
declare function packFrom(input: PackInput): FactPack;
//#endregion
//#region src/surfaces/fallback.d.ts
interface StageHints {
  /** The stage's own suggestions (journey.ts), in order. */
  suggestions: Array<{
    id: string;
    text_zh: string;
  }>;
  /** The stage's status sentence, used when no fact must surface. */
  status_zh: string;
}
declare function greetingZh(now?: Date): string;
/** Number keys whose canonical text appears in the text. */
declare function numberKeysIn(text: string, pack: Pick<FactPack, 'numbers'>): string[];
declare function fallbackSurfaces(pack: FactPack, hints?: StageHints, now?: Date): SurfaceSet;
//#endregion
//#region src/surfaces/nba.d.ts
declare function rankActions(candidates: readonly NextBestAction[], pack: Pick<FactPack, 'asked_recent' | 'today'>): NextBestAction[];
//#endregion
//#region src/surfaces/providers.d.ts
/** The stage's next step leads the non-mandatory ones (+30), so nothing changes when no fact outranks it. */
declare const journeyCandidates: CandidateProvider;
//#endregion
//#region src/surfaces/service.d.ts
declare function pageStateOf(set: SurfaceSet, pack: FactPack): PageState;
/** Keep this set as the one shown; write surfaces.json and a log line when it differs from the last one. */
declare function recordSurfaces(dataDir: string, set: SurfaceSet, pack: FactPack): PageState;
/** What the page shows now: this person's, or the last one built in this process. Null before any build. */
declare function readPageState(dataDir?: string): PageState | null;
declare function currentSurfaces(dataDir?: string): {
  set: SurfaceSet;
  pack: FactPack;
} | null;
//#endregion
//#region src/triage/index.d.ts
declare function triageFindings(pack: Pick<FactPack, 'triage'>): TriageFinding[];
declare const DOCTOR_PROMPT_ZH = "这些偏低的指标意味着什么？看医生前要准备什么？";
declare const BRIEF_PROMPT_ZH = "帮我准备一份给医生看的简报";
declare const VISIT_PROMPT_ZH = "我看完医生了，医生说……";
/**
 * Doctor first (M1): one mandatory action for every finding still open, which blocks drafting a plan; the
 * printable brief beside it; and, once a visit date has passed (or two weeks went by), "看完医生了吗？".
 */
declare const triageCandidates: CandidateProvider;
//#endregion
//#region src/triage/rules.d.ts
interface Pattern {
  id: string;
  rule: string;
  keys: Array<StopHit['key']>;
  priority: TriageFinding['priority'];
  label_zh: string;
  department_zh: string;
  tests_zh: string[];
  questions_zh: string[];
  trend_markers: string[];
}
/** The pattern table: data/triage/patterns.json beside the package (lib/ or src/triage/), else the built-in copy. */
declare function patterns(): Pattern[];
declare function hitRefs(hit: StopHit): NumberRef[];
/** One finding per pattern that has at least one hit, in the table's order. */
declare function findingsFrom(stop: StopResult, today: string, careOf?: (findingId: string) => CareItem | null): TriageFinding[];
/** A short line for the status card: the values with their fall, then who to see. */
declare function statusLine(finding: TriageFinding, hits: readonly StopHit[]): string;
//#endregion
//#region src/agents/orchestrator.d.ts
/** Write tools a non-health agent does not see (D5). Read tools stay global. */
declare const WRITE_TOOLS: readonly ["save_personal_profile", "save_intervention_plan", "log_intervention_checkin", "save_self_measurement", "record_medication_statement", "set_followup", "send_followup_message", "remember_for_me", "log_care_visit", "note_page_issue", "forward_report", "record_condition", "log_life_event"];
declare const ORCHESTRATOR_RULES: string[];
declare function orchestratorPrompt(mount: MountState): string;
declare function pluginMessage(text: string, form: 'snapshot' | 'instructions', name: string): never;
interface SnapshotInput {
  page: PageState;
  memory_zh: string;
  care_due_zh: string;
  /** Items the distiller noted from the chat, not yet confirmed. */
  noted_zh?: string;
}
/** The snapshot text (Chinese), at most about 1.5k tokens. */
declare function snapshotText(input: SnapshotInput): string;
interface OrchestratorOptions {
  mount: MountState;
  healthWorkspaces: () => string[];
  /** The page state and what goes with it, built within the deadline; null when it is not ready. */
  snapshot: (deadlineMs: number) => Promise<SnapshotInput | null>;
  log?: (message: string) => void;
}
interface Orchestrator {
  isHealth(agent: unknown): boolean;
  /** Sessions that got the snapshot, with the fp they got (for tests). */
  injected: Map<string, string>;
}
declare function registerOrchestrator(ctx: Context, options: OrchestratorOptions): Orchestrator;
//#endregion
//#region src/prompt.d.ts
/**
 * LongPi's persona lines (0.5.3: no longer a global section; agents/orchestrator.ts adds them, with the
 * orchestrator rules, only to agents in a health session).
 */
declare function personaLines(mount: MountState): string[];
//#endregion
//#region src/triage/brief.d.ts
interface BriefInput {
  config: Config;
  dataDir: string;
  records: RecordSnapshot;
  today: string;
  care: CareState;
}
interface BriefResult {
  brief: DoctorBrief;
  markdown: string;
}
declare function buildBrief(input: BriefInput): Promise<BriefResult | null>;
/** A saved brief by id, or the newest when id is empty. */
declare function readBrief(dataDir: string, id?: string): BriefResult | null;
//#endregion
//#region src/core/http.d.ts
type Method = 'GET' | 'POST' | 'DELETE';
interface Http {
  route(method: Method, path: `/api/longpi/${string}`, handler: RouteHandler): void;
  /** For tests and SSE: the raw node handler of a path (after the fence). */
  rawRoute(path: `/api/longpi/${string}`, handler: (req: IncomingMessage, res: ServerResponse) => void): void;
}
declare function createHttp(ctx: Context): Http;
//#endregion
//#region src/core/turn-text.d.ts
declare function rememberPersonText(session: string, text: string): void;
declare function lastPersonText(session: string): string;
/** Whether quote is a contiguous part of what the person said (spacing and punctuation ignored). */
declare function quoteIn(quote: string, said: string): boolean;
//#endregion
//#region src/core/memory-tools.d.ts
/** One memory item from what the model passed, typed by kind; null when it cannot be stored. */
declare function itemFrom(args: Record<string, unknown>, provenance: Provenance, confirmed: boolean, today: string): NewMemoryItem | null;
//#endregion
//#region src/core/tick.d.ts
declare function checkDay(bus: Bus, dataDir: string, now?: Date): boolean;
//#endregion
//#region src/core/budget.d.ts
interface Budget {
  remaining(): {
    input: number;
    output: number;
    spawns: number;
  };
  record(run: AgentRunRecord): void;
  /** Why a call may not run now, or null. */
  blocked(): string | null;
  today(): {
    input: number;
    output: number;
    calls: number;
    spawns: number;
    by_profile: Record<string, {
      calls: number;
      input: number;
      output: number;
      fallback: number;
    }>;
  };
}
declare function createBudget(config: () => Partial<Config>, dataDir: () => string): Budget;
//#endregion
//#region src/core/llm-call.d.ts
interface Chunk {
  type: string;
  text?: unknown;
  block?: {
    type?: string;
    name?: string;
    arguments?: string;
    text?: string;
  };
  usage?: Partial<TokenUsage>;
  reason?: {
    kind?: string;
    failure?: {
      message?: string;
    };
  };
}
interface LlmService {
  stream(options: Record<string, unknown>): AsyncIterable<Chunk>;
  resolveModelInfo?: (provider: string, model: string, signal?: AbortSignal) => Promise<{
    reasoning?: {
      efforts?: Array<{
        id: string;
      }>;
    };
  } | undefined>;
}
/** The first balanced {...} in a text answer, parsed; null when there is none. */
declare function firstJsonObject(text: string): unknown;
interface LlmCallOptions {
  config: () => Partial<Config>;
  budget: Budget | null;
  /** The model service; the host's by default. Tests pass a fake. */
  llm?: () => LlmService | undefined;
  /** The route when a profile names none: DSH's default model. */
  defaultRoute?: () => {
    provider: string;
    model: string;
  } | null;
  log?: (message: string) => void;
}
declare function createLlmCall(ctx: Context | null, options: LlmCallOptions): LlmCall;
//#endregion
//#region src/agents/coach.d.ts
interface CoachExtra {
  /** The deterministic floor for this pack; failing cards fall back to it. */
  floor: SurfaceSet;
  /** Suggestions shown in the last 3 days (surfaces_log). */
  lastShown: string[];
  now: Date;
}
interface CoachDraft {
  greeting: SurfaceCard;
  status: SurfaceCard;
  next: SurfaceSet['next'];
  suggestions: SurfaceCard[];
  failed: Array<{
    rule: string;
    card_id: string;
    detail: string;
  }>;
  passed: string[];
}
declare const COACH_SCHEMA: {
  type: "object";
  properties: {
    greeting: {
      type: string;
      properties: {
        text_zh: {
          type: string;
        };
      };
      required: string[];
    };
    status: {
      type: string;
      properties: {
        text_zh: {
          type: string;
        };
        fact_ids: {
          type: string;
          items: {
            type: string;
          };
        };
        tone: {
          type: string;
          enum: string[];
        };
      };
      required: string[];
    };
    next: {
      type: string;
      properties: {
        action_id: {
          type: string;
        };
        text_zh: {
          type: string;
        };
        detail_zh: {
          type: string;
        };
      };
      required: string[];
    };
    suggestions: {
      type: string;
      minItems: number;
      maxItems: number;
      items: {
        type: string;
        properties: {
          action_id: {
            type: string;
          };
          text_zh: {
            type: string;
          };
          prompt_zh: {
            type: string;
          };
          fact_ids: {
            type: string;
            items: {
              type: string;
            };
          };
        };
        required: string[];
      };
    };
  };
  required: string[];
  additionalProperties: boolean;
};
/** The slice the coach sees: no display name (D10), no raw record. */
declare function coachInput(pack: FactPack, extra: CoachExtra): unknown;
/** The label a status must name for the top fact (血红蛋白, 达格列净 …): the first word of its text. */
declare function anchorOf(text: string): string;
declare function validateCoach(out: unknown, pack: FactPack, extra: CoachExtra): {
  ok: true;
  value: CoachDraft;
} | {
  ok: false;
  errors: string[];
};
declare function coachFallback(_pack: FactPack, extra: CoachExtra): CoachDraft;
declare const coachProfile: AgentProfile<CoachExtra, CoachDraft>;
//#endregion
//#region src/agents/prompts/coach.d.ts
declare const COACH_PROMPT = "你是 LongPi 的健康教练，为【这一个人】写今天打开 LongPi 时看到的几句话。你只写措辞，不决定事实。\n输入是 JSON：top_facts（已排好序的重要事实）、candidates（系统允许的下一步，含 id，第一个若 mandatory 为 true 就必须用它）、\nfeedback（每条结果能说什么 allowed_claims）、memory_digest（此人说过的目标、不要的事、身体状况）、\nasked_recent 和 last_shown_suggestions（最近问过和看过的）、numbers（唯一可以引用的数字，用它们的 text 原样写）。\n写作规则：\n1. 如果 top_facts[0].priority 是 emergency 或 must_surface：status 必须围绕它，写清楚是哪项、变化多少（只用 numbers 或 top_facts 里的数字）、下一步找谁；\n   语气是关心而不是吓人，不下诊断，不说\"患有\"。偏低就说偏低。status.fact_ids 填这个事实的 id。next.action_id 必须是 mandatory 的那个。\n2. 否则按此人的目标和今天的状态写：做到的行为先肯定；有真实进步（allowed_claims 含 celebrate）就直接庆祝；在波动内就讲具体进展和何时复测。\n   只有 allowed_claims 含 younger 时才能说\"年轻了\"。\n3. suggestions 2–4 条：每条是此人今天真会点的一句话（写成他会发给 LongPi 的原话，放在 prompt_zh），彼此不同、不重复 last_shown_suggestions、\n   不碰 memory_digest 里\"不要\"的事；优先对应 candidates（填 action_id）。\n4. 数字只能来自 numbers 或 top_facts；不写剂量；不建议开始、停止或调整处方药，也不建议补铁或任何补剂；不出现工具名、英文或技能 id；不写人名，称呼用\"你\"。\n5. 长度：greeting ≤ 30 字，status ≤ 60 字，next.text_zh ≤ 40 字，next.detail_zh ≤ 80 字，每条建议 ≤ 24 字。\n调用 emit 一次返回，不要输出别的文字。";
//#endregion
//#region src/agents/memory_distiller.d.ts
declare const DISTILL_PREFILTER: RegExp;
interface DistillExtra {
  message: string;
  session_id: string;
  today: string;
}
declare function validateDistilled(out: unknown, _pack: FactPack, extra: DistillExtra): {
  ok: true;
  value: MemoryOp[];
} | {
  ok: false;
  errors: string[];
};
declare const distillerProfile: AgentProfile<DistillExtra, MemoryOp[]>;
//#endregion
//#region src/surfaces/coach-service.d.ts
interface CoachRunner {
  llm: LlmCall;
  enabled: () => boolean;
  softRegenMinutes: () => number;
  publish?: (type: string, data: unknown) => void;
  log?: (message: string) => void;
}
declare function setCoach(next: CoachRunner | null): void;
/** What must not change for a model set to be reused: stage, the top facts, the mandatory actions, safety. */
declare function hardKeyOf(pack: FactPack): string;
/** The set to show for this pack: a valid model set, or the floor (and the coach is asked). */
declare function chooseSurfaces(dataDir: string, floor: SurfaceSet, pack: FactPack): SurfaceSet;
/** Ask the coach for this pack now (single-flight per person). Resolves to the set shown, or null. */
declare function regenerate(dataDir: string, pack: FactPack, floor: SurfaceSet): Promise<SurfaceSet | null>;
/** For tests: forget cached model sets. */
declare function resetCoachCache(): void;
declare function coachInflight(dataDir: string): Promise<SurfaceSet | null> | null;
//#endregion
//#region src/core/sse.d.ts
interface Sse {
  publish(type: string, data: unknown): void;
  clients(): number;
}
declare function createSse(http: Http, bus: Bus | null): Sse;
//#endregion
//#region src/core/remember-rules.d.ts
declare function rememberFromWords(dataDir: string, text: string, session?: string): string[];
//#endregion
//#region src/triage/screening.d.ts
interface ScreeningInput {
  age: number | null;
  sex: string;
  /** Family history lines from memory (their words). */
  family: string[];
  /** No checkup in the record yet. */
  emptyRecord: boolean;
}
/** The topics that apply, strongest first; each is a top fact and a non-mandatory action. */
declare function screeningTopics(input: ScreeningInput): Array<{
  fact: TopFact;
  action: NextBestAction;
}>;
//#endregion
//#region src/index.d.ts
declare const name = "dsh-plugin-longpi";
declare const inject: string[];
declare function apply(ctx: Context, config: Config): Promise<void>;
//#endregion
export { ABDOMINAL_CT_SKILL, AGENT_DEFAULTS, AGENT_PROFILE_IDS, type ActionKind, type AdviceTier, type AdviceTierResult, type AgentConfig, type AgentProfile, type AgentProfileId, type AgentRoute, type AgentRunRecord, type AskedTopicItem, BASE_RULES, BRIEF_PROMPT_ZH, BUDGET_DEFAULTS, type BindingInput, type BindingIssue, type BindingIssueKind, type BindingProposal, type BindingValidation, type BootstrapResult, type Bus, CHANGES_NOTE_ZH, CIVIL_TZ, CLASSIFIER_SYSTEM, COACH_PROMPT, COACH_SCHEMA, CONNECTION_FILE, CONNECTION_TEST_MS, CONNECTION_UNAVAILABLE, CONSENT_HOLD_ZH, CONSENT_VERSION, type CandidateProvider, type CareItem, type Claim, type CodexCard, type ConditionFlag, type ConditionItem, type ConditionRow, Config, type ConnectionGuard, type ConnectionSource, type ConnectionStatus, type ConnectionTest, type Consent, type ConsentRecord, type CoreDeps, DATA_FILES, DEFAULT_FOLLOWUP, DISTILL_PREFILTER, DOCTOR_PROMPT_ZH, DRAFT_CATEGORIES, type DistributiveOmit, type DoctorBrief, type DraftCategory, type DraftItem, type DrawGrant, type DrawResult, type DropTable, type DrugClass, EMERGENCY_LINE_ZH, EMPTY_PROFILE, EVENT_OWNERS, type EvidenceGrade, type ExclusionItem, FACT_PRIORITY_RANK, FISH_OIL_CAUTION, FOCUS, FOCUS_ZH, FOLLOWUP_DAMAGED, FOLLOWUP_MAX_PER_DAY, FOLLOWUP_TEST_TEXT, type FactPack, type FactPriority, type FamilyHistoryItem, type FeedbackMessage, type Focus, type FollowupDeps, type FollowupLogRow, type FollowupSettings, type FollowupState, GROUP_KEYS, GROUP_ZH, GUARD_COUNTERS, GUARD_SCOPES, GUARD_TIMEOUT_MS, type GoalItem, type GroupKey, type Guard, type GuardCall, type GuardHit, type GuardLabels, type GuardScope, HARNESS_SKILLS, HYPO_AWAKE_ZH, HYPO_UNCONSCIOUS_ZH, type HealthEvent, type HealthEventPayloads, type HealthEventSource, type HealthEventType, HealthSessions, type Id, type IndicatorChange, type IndicatorDetail, type IndicatorEntry, type IndicatorSource, type IndicatorsResponse, type IsoDay, type IsoTime, JUDGE_SYSTEM, type Journey, LABEL_KEYS, LIBRARY_PROVIDER, LIBRARY_SKILL_RANK, type LibraryHooks, type LifeEventItem, type LlmCall, type LlmLike, type LocalStatResult, MANDATORY_PROVIDERS, MEMORY_VERSION, MODULES, type MedicationItem, type MemoryApi, type MemoryApplyResult, type MemoryItem, type MemoryKind, type MemoryOp, type MethodInputUsed, type MethodOutput, type MethodResult, type MethylationRow, type ModuleId, NO_READ_BACK, type NewMemoryItem, type NextBestAction, type NoteItem, type NumberRef, ORCHESTRATOR_RULES, type ObjectJsonSchema, PHENOAGE_SKILL, PRODUCT_VERSION, PROFILE_DAMAGED, PROMPT_SECTIONS, type PageState, type PersonMemory, type PlanBrief, type PlanDraft, type PlanDraftItem, type PlanDraftV2, type PlanPrefs, type PreferenceItem, type PreferenceKey, type Profile, type ProteinRow, type Provenance, type ProvenanceKind, type Quest, type QuestKind, READ_BACK_MS, RESERVED_ROUTES, RESERVED_SKILLS, RESERVED_TOOL_NAMES, RISK_FACTS, RISK_FACT_ZH, RISK_SKILL, type Rarity, type RecordChange, type RecordSnapshot, type RecordStatus, type RecordsSummary, type ReplyVerdict, type ResultLabel, type RiskFact, type RouteHandler, SAFETY_CONDITION_FLAGS, SAFETY_DRUG_CLASSES, SELF_ALIASES, SELF_HARM_LINE_ZH, SELF_KEYS, SELF_SPEC, SURFACES_DEFAULTS, type SavedConnection, type ScienceMode, type Season, type SelfKey, type SelfRow, type SendResult, type SkillIndexEntry, type Specialists, type Stage, type StopHit, type StopResult, type StoreKind, type StoreRows, type StreakState, type StudyManifest, type SurfaceCard, type SurfaceKind, type SurfaceSet, TOOL_NAMES, type TaxaRow, type TokenUsage, type TopFact, type TransparencyLogEntry, type TriageFinding, type UnjudgedChange, type Unlock, VISIT_PROMPT_ZH, type ValidatorRule, WEBHOOK_KINDS, WORKSPACE_DIR, WORKSPACE_MARKER, WORKSPACE_TITLE, WRITE_TOOLS, type WorkspaceLike, type WorkspaceRegistryLike, acceptedPlan, addCheckIns, addDays, addSelf, adherenceFor, affirmsBooking, agentConfig, allowedNumbers, anchorOf, appendFollowupLog, appendJsonl, apply, asJson, assessBinding, bindRecord, bootstrapWorkspace, bridgeEnv, briefOptionsOf, buildBoard, buildBrief, buildCalendar, buildChanges, buildDoctorFirst, buildIndicators, buildJourney, buildJourneyFull, buildPlanBrief, buildReport, buildStats, buildTracking, candidateProviders, candidatesFor, careFor, careItems, careState, catalogDescription, cellNumber, checkDay, checkReply, checkinStatus, checkupMarkerFor, chooseSurfaces, classifyMessage, clearConnection, clinicalStop, coachFallback, coachInflight, coachInput, coachProfile, collectCandidates, collectMethodResults, collectOnJourney, commandExcerpt, computeSafety, conditionFlagsOf, connectionKey, connectionSource, connectionTokenProblem, connectionUrlProblem, correctionNote, countGuard, createBudget, createBus, createGuard, createHttp, createLlmCall, createMemory, createSse, currentBus, currentMethodResults, currentPlan, currentSurfaces, dateSaid, daysBetween, decideFollowup, deepseekConsentPending, deleteSelf, deniesBooking, describeItem, describePlan, desktopCommand, desktopSupported, detectIntents, distillerProfile, domainSummary, dosePattern, draftPlan, drinkingFromText, drugClassesOf, effectiveConfig, effectsFor, emergencyScript, escapeText, estimatedAge, evaluateMarker, evaluatePlan, exclusionsFromText, expandMarkerNames, expectedText, factorFor, fallbackSurfaces, findingsFrom, firstJsonObject, fixScheduleText, foldLine, foldName, followupApprovalReason, followupArmed, followupResponse, followupStateOf, followupSummary, followupTextProblem, followupTick, forgetExclusion, goalProblems, greetingZh, groupOf, guardRoute, guidanceNote, hardKeyOf, hasDose, hasDoseAmount, healthWorkspacePaths, heldUntil, hitRefs, holdPlanDraft, homeBloodPressure, hypoCorrectionNote, hypoglycaemiaNow, inQuiet, indicatorDetail, indicatorFor, indicatorsFromTable, inject, insideWorkspace, invalidateIndicators, invalidateRecords, invalidateTracking, isCoronaryName, isJsonRequest, isMedicationRecordRequest, isoDay, isoWeek, isoWeekday, itemFrom, journeyCandidates, keepsValidatedComputation, lastPersonText, latestOutputs, latestSelf, leadsWithHypoFirstStep, listEntries, listSkillIndex, loadCatalog, loadCourses, loadDoseLog, loadEvidenceLexicon, loadRecords, loadReference, loadSeries, localAidText, logCareVisit, manifestSummary, markerFor, markerGroupKeys, maskMcpUrl, maskUrl, matchSkills, matchesInputName, medicationClasses, memoryFor, mentionedEntities, mentionsMedicine, mergeProfile, mergeSelf, methodResults, methodsOnPage, migrateLegacy, modelEgress, modelGoals, mountLibraryLanes, name, nameVariants, nextTimes, normalizePlan, normalizeProfile, normalizeUnit, numberKeysIn, oddsSumToOne, orchestratorPrompt, organismOf, organismsAsked, overviewSlice, packFp, packFrom, pageMethodResults, pageStateOf, parseCompact, parseFrontmatter, parseLabels, parseNumber, parseReadme, parseVerdict, patterns, personText, personaLines, planApprovalReason, planDraftHeld, planKey, pluginMessage, preGuard, presentMedications, profileComplete, proposeFromRecord, proposedRowKind, publicFollowup, publishMethodResults, quoteIn, rangeFlag, rankActions, rankTopFacts, rcvBand, readBrief, readCheckIns, readConnection, readFailed, readFollowup, readFollowupLog, readGuardStats, readHistory, readJson, readJsonl, readPageState, readPlanPrefs, readPlans, readProfile, readReceipts, readResultFile, readSelf, readStatements, readStore, readiness, recordMethodResult, recordOutputs, recordReadable, recordSurfaces, recordsSummary, regenerate, registerApprovals, registerCandidates, registerLibraryHooks, registerLibraryMount, registerModules, registerOrchestrator, registerValidator, registeredMethodResults, releasePlanDraft, rememberExclusions, rememberFromWords, rememberMedications, rememberPersonText, rememberedMedications, replyForDraft, replyRuleCheck, reportExcerpt, resetCoachCache, resetReadBacks, resolveDataDir, resolveMarkers, resolveMirobodyPlugin, resolveSkillsHome, retestDay, retestsOf, routeFor, ruleLabels, runReady, runRegistered, runSkill, runValidators, runnableFrom, runtimeCall, sameMeasure, saveConnection, savePlan, screeningTopics, seenNotes, selfIndicators, selfSeries, sendFollowup, sendNow, sentToday, seriesOf, sessionKey, setBus, setCoach, setConsent, setDrinking, setFollowupDeps, setMethodResults, setPlanExclusion, settleDraft, skillEnv, snapshotText, softHoldDraft, specKind, stageMeasurements, stageNow, startFollowup, statusLine, steerNeed, stripDoses, suggestNext, summarizeIndicators, summarizeMedications, supplementFieldInputs, tableOf, testConnection, togetherZh, tokenKey, touchesHealth, trackingGeneration, triageCandidates, triageFindings, turnText, unansweredOf, unitFactor, useBindingView, validateBinding, validateCoach, validateDistilled, validatorRules, versionCheck, webhookAnswer, webhookRequest, webhookUrlProblem, whenToUseOf, within, wrapGuardMessage, writeFollowup, writeJsonAtomic, writeProfile, writeStats, youngerAllowed };