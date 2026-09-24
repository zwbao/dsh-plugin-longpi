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
    bioage: { status: 'ok' | 'blocked'; phenoage: number | null; advance: number | null; date: string | null; checkups: number; band_years: number | null; blocker_zh: string; missing: string[] }
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
