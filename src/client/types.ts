// The server's JSON, as the client reads it. Journey is the contract of
// /api/longpi/journey field for field; Board and Tracking keep every field
// optional because older servers and the preview omit some of them.

export type Stage = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine'
export type Focus = 'bioage' | 'cardio' | 'glucose' | 'weight' | 'sleep' | 'plan'
export type SelfKey = 'waist' | 'sbp' | 'dbp' | 'weight'
export type RiskFact = 'smoker' | 'diabetes' | 'bp_treated' | 'north' | 'urban' | 'family_history'
export type Sex = 'female' | 'male' | 'other' | 'unknown'
export type NextAction = 'consent' | 'profile' | 'records' | 'addons' | 'plan' | 'checkin' | 'review' | 'open'

export interface JourneyQuestion {
  key: 'age' | 'sex' | RiskFact
  label_zh: string
  unlocks_zh: string
  answered: boolean
  men_only?: boolean
}

export interface Addon {
  item_zh: string
  unlocks_zh: string
  self_measurable: boolean
  self_key?: SelfKey
}

export interface SelfLatest {
  key: SelfKey
  label_zh: string
  value: number
  unit: string
  date: string
  n: number
}

export interface SelfKeySpec {
  key: SelfKey
  label_zh: string
  unit: string
  units: string[]
}

export interface Reminder {
  kind: 'retest' | 'checkin'
  text_zh: string
  date: string | null
  due: boolean
}

/**
 * Round 4: a record value that moved further than its reference change value
 * (RCV) from the biological-variation table. The server's src/changes.ts shape,
 * field for field.
 */
export interface RecordChange {
  key: string
  label_zh: string
  unit: string
  points: Array<{ date: string; value: number }>
  compare: { from_date: string; from: number; to_date: string; to: number; pct: number }
  band_pct: { up: number; down: number }
  direction: 'up' | 'down'
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  text_zh: string
  advice_zh: string
  caveat_zh?: string
  source: { title: string; url: string; doi?: string }
  verified: boolean
}

export interface Journey {
  version: string
  today: string
  consent: { accepted: boolean; version: string; accepted_at: string | null; current: string }
  profile: {
    displayName: string
    birthYear: number | null
    age: number | null
    sex: Sex
    risk: Partial<Record<RiskFact, boolean>>
    focus: Focus[]
    complete: boolean
    questions: JourneyQuestion[]
  }
  focus_options: Array<{ key: Focus; label_zh: string }>
  records: { status: 'unconfigured' | 'ok' | 'error'; error: string; indicator_count: number; full_checkups: number; latest_checkup: string | null; mirobody_mounted: boolean }
  results: {
    /** caveat_zh (round 4): set when a PhenoAge input changed beyond its normal fluctuation and a doctor should look first. */
    bioage: { status: 'ok' | 'blocked'; phenoage: number | null; advance: number | null; date: string | null; checkups: number; band_years: number | null; blocker_zh: string; missing: string[]; caveat_zh?: string }
    risk: { status: 'ok' | 'blocked'; risk_pct: number | null; category_zh: string; date: string | null; blocker_zh: string; missing_labs: string[]; missing_facts: string[] }
  }
  addons: Addon[]
  self: { latest: SelfLatest[]; keys: SelfKeySpec[] }
  plan: {
    exists: boolean
    title: string
    version: number | null
    items: number
    started: string | null
    days: number | null
    checkin_items: Array<{ id: string; title: string; done_today: boolean }>
    streak: number
    adherence_pct: number | null
  }
  reminders: Reminder[]
  stage: Stage
  next: { stage: Stage; title_zh: string; detail_zh: string; action: NextAction }
  suggestions: Array<{ id: string; text_zh: string }>
  boundary_zh: string
  /** Round 3: proactive follow-up. Older servers leave it out; normalizeJourney fills in "off". */
  followup: { enabled: boolean; channels: Array<'desktop' | 'webhook'>; next_at: string | null }
  /** Round 4: changes beyond normal fluctuation, ask_doctor rows first. Older servers leave it out: []. */
  changes: RecordChange[]
  /** How a change is judged (RCV, source, limits); shown under the changes card. */
  changes_note_zh: string
}

// --- plan draft (GET /api/longpi/plan-draft) ----------------------------------------------

export type DraftCategory = 'diet' | 'exercise' | 'sleep' | 'weight' | 'behavior' | 'supplement'

export interface PlanBrief {
  today: string
  focus: Focus[]
  priorities: Array<{
    marker_key: string
    label_zh: string
    value: number | null
    unit: string
    date: string | null
    why_zh: string
    source: 'phenoage_levers' | 'china_par_levers' | 'focus'
  }>
  candidates: Array<{
    id: string
    intervention_zh: string
    category: string
    marker_key: string
    label_zh: string
    effect: { value: number; unit: string; kind?: string }
    duration_weeks: number | null
    population: string
    design: string
    doi: string
    verified: boolean
    expected_zh: string
    needs_doctor: boolean
    cautions_zh: string[]
  }>
  safety: { medications: string[]; notes_zh: string[] }
  past_items: Array<{ title: string; category: string; verdicts: string[]; adherence_pct: number | null }>
  boundary_zh: string
}

export interface DraftItem {
  id: string
  category: DraftCategory
  category_zh: string
  title: string
  detail: string
  start: string
  markers: string[]
  target?: { metric: string; op: '>=' | '<='; value: number; unit: string } | null
  evidence: { effect_id: string; expected_zh: string; doi: string; verified: boolean; population: string }
  needs_doctor: boolean
  cautions_zh: string[]
}

export interface DraftGoal { marker: string; value: number; unit: string; basis_zh: string }

export interface PlanDraft {
  title: string
  items: DraftItem[]
  goals: DraftGoal[]
  notes_zh: string[]
}

export interface PlanDraftResponse {
  brief: PlanBrief
  draft: PlanDraft | null
}

export type AcceptResponse =
  | { ok: true; plan: { version: number; title: string; items: number } }
  | { ok: false; error: string; problems?: string[] }

// --- follow-up (GET /api/longpi/followup) -------------------------------------------------

export type WebhookKind = 'feishu' | 'wecom' | 'dingtalk' | 'bark' | 'generic'
export type Weekday = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type FollowupKind = 'checkin' | 'retest' | 'weekly' | 'nudge' | 'custom' | 'test'

export interface FollowupSettings {
  enabled: boolean
  checkin_time: string
  retest_time: string
  weekly: { day: Weekday; time: string } | null
  desktop: boolean
  webhook: { kind: WebhookKind; url_masked: string; secret_set: boolean } | null
  detail: 'minimal' | 'full'
  quiet: { start: string; end: string } | null
}

export interface FollowupLogRow {
  at: string
  kind: FollowupKind
  key: string
  ok: boolean
  channels: { desktop?: boolean; webhook?: boolean }
  error?: string
}

export interface FollowupResponse {
  settings: FollowupSettings
  next: { checkin: string | null; retest: string | null; weekly: string | null }
  log: FollowupLogRow[]
  platform_desktop: boolean
}

/** POST /api/longpi/followup body: any subset. url/secret omitted keep the stored ones; secret '' clears it. */
export interface FollowupUpdate {
  enabled?: boolean
  checkin_time?: string
  retest_time?: string
  weekly?: { day: Weekday; time: string } | null
  desktop?: boolean
  detail?: 'minimal' | 'full'
  quiet?: { start: string; end: string } | null
  webhook?: { kind: WebhookKind; url?: string; secret?: string } | null
}

export interface FollowupTestResponse {
  ok: boolean
  channels: { desktop?: { ok: boolean; error?: string }; webhook?: { ok: boolean; error?: string } }
}

export interface SelfRow {
  id: string
  key: SelfKey
  value: number
  unit: string
  date: string
  saved_at: string
  given?: { value: number; unit: string }
}

// --- board -------------------------------------------------------------------------------

export interface IndicatorRow { name?: string; value?: string; unit?: string; label?: string; date?: string; source?: 'self' }
export interface MedicationRow { name?: string; status?: string }
export interface MatchHit { name: string; blurb?: string; why?: string[]; has_script?: boolean; runnable?: { status?: string; missing?: string[] } }
export interface Readout { key: string; label_zh?: string; value?: number | string | null; unit?: string; at?: string; measured_at?: string; skill?: string }

export interface Readiness {
  ready?: Array<{ name: string; blurb?: string; domain?: string }>
  near?: Array<{ name: string; blurb?: string; missing?: string[] }>
  unlock?: Array<{ item: string; skills: string[] }>
  declared?: number
}

export interface Board {
  version?: string
  today?: string
  profile?: { displayName?: string; birthYear?: number | null; age?: number | null; sex?: string; risk?: Record<string, boolean> }
  estimated_age?: number | null
  skills?: { count?: number; personal?: number; version?: string; revision?: string; error?: string; domains?: Array<{ domain: string; count: number }> }
  mirobody?: { mounted?: boolean; error?: string; engine?: { ok?: boolean; version?: string; error?: string }; mcp?: { configured?: boolean; host?: string } }
  records?: { status?: string; error?: string; indicator_count?: number; indicators?: IndicatorRow[]; medications?: MedicationRow[] }
  dispatch?: { matches?: MatchHit[]; note?: string }
  near?: MatchHit[]
  readouts?: Readout[]
  receipts?: Array<{ at?: string; skill?: string; ok?: boolean; error_kind?: string }>
  readiness?: Readiness
  boundary?: string
}

// --- tracking ----------------------------------------------------------------------------

export interface Adherence {
  source?: string
  rate?: number | null
  coverage?: number
  level?: string
  streak?: number
  note_zh?: string
  calendar?: Array<{ date: string; status: string }>
}

export interface Verdict {
  item?: string
  marker: string
  indicator?: string | null
  unit?: string
  verdict: string
  reason_zh?: string
  baseline?: { date: string; value: number } | null
  followup?: { date: string; value: number } | null
  change?: { abs: number; pct: number } | null
  band?: { up_pct: number; down_pct: number; verified?: boolean } | null
  combined_with?: string[]
  confounders?: string[]
  next_retest?: string | null
  expected?: Array<{ id: string; text_zh: string; doi: string; verified?: boolean; comparison?: string }>
}

export interface Item {
  id: string
  title: string
  category?: string
  category_zh?: string
  start: string
  end?: string | null
  days?: number
  adherence?: Adherence
  verdicts?: Verdict[]
  headline?: string
}

export interface PlanItemRaw { id: string; mirobody?: { medication: string } | null; target?: { metric: string } | null }

export interface Chart {
  key: string
  label: string
  indicator: string
  unit: string
  better?: string
  points: Array<{ date: string; value: number }>
  band?: { base: number; base_date: string; low: number; high: number; verified?: boolean } | null
  goal?: number | null
  items?: string[]
}

export interface ModelCard {
  model: string
  title_zh?: string
  status?: string
  note_zh?: string
  measured_on?: string | null
  now?: Record<string, number | null>
  goal?: Record<string, number | null> | null
  category_zh?: { now: string; goal: string | null }
  missing?: string[]
  missing_labs?: string[]
  missing_facts?: string[]
  levers?: Array<{ label: string; from: string; to: string; years: number }>
  sensitivity?: Array<{ label: string; unit: string; years_per_step: number; step: string }>
  boundary_zh?: string
}

export interface BioAgePoint { date: string; phenoage: number; advance: number | null; mortality_10y_pct: number | null }

export interface Suggestion { kind: string; text_zh: string; date?: string; marker?: string }

export interface Tracking {
  status?: string
  today?: string
  plan?: { version: number; saved_at: string; title: string; items: PlanItemRaw[]; goals?: Array<{ marker: string; value: number; unit: string }> } | null
  items?: Item[]
  suggestions?: Suggestion[]
  charts?: Chart[]
  bioage?: { status?: string; note_zh?: string; points?: BioAgePoint[]; band_years?: number | null; band_missing?: string[] }
  models?: ModelCard[]
  reference?: { biovar_markers?: number; effects?: number }
  errors?: string[]
}

/** What LongPi's slot registrations inject into their components. */
export interface Face {
  openPage: () => void
  openChat: () => void
}
