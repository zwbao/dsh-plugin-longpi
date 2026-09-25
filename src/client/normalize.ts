// The journey as the components read it. The server may leave a field out
// (an older build) or add read-only ones (a newer build); every block here
// exists and every list is a list, so no surface breaks on a missing field.
// Nothing is invented: a missing number stays null, a missing flag is false.

import { BOUNDARY_FALLBACK } from './constants.ts'
import { localToday } from './format.ts'
import type {
  Addon, DraftCategory, DraftGoal, DraftItem, Focus, FollowupKind, FollowupLogRow, FollowupResponse, FollowupSettings, Journey, JourneyQuestion,
  NextAction, PlanBrief, PlanDraftResponse, RecordChange, Reminder, RiskFact, SelfKey, SelfKeySpec, SelfLatest, Sex, Stage, WebhookKind, Weekday,
} from './types.ts'

type Raw = Record<string, unknown>

const STAGES: readonly Stage[] = ['consent', 'profile', 'records', 'first_result', 'plan', 'routine']
const ACTIONS: readonly NextAction[] = ['consent', 'profile', 'records', 'addons', 'plan', 'checkin', 'review', 'open']
const SEXES: readonly Sex[] = ['female', 'male', 'other', 'unknown']
const SELF_KEYS: readonly SelfKey[] = ['waist', 'sbp', 'dbp', 'weight']
const FOCUS: readonly Focus[] = ['bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan']
const VERDICTS: readonly RecordChange['verdict'][] = ['better', 'worse', 'unclear']

function obj(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {}
}

function objects(value: unknown): Raw[] {
  return Array.isArray(value) ? value.filter((row): row is Raw => !!row && typeof row === 'object' && !Array.isArray(row)) : []
}

function str(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function strOrNull(value: unknown): string | null {
  return typeof value === 'string' && value ? value : null
}

function num(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((row): row is string => typeof row === 'string' && row.length > 0) : []
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? value as T : fallback
}

function profileOf(raw: Raw): Journey['profile'] {
  const risk: Partial<Record<RiskFact, boolean>> = {}
  for (const [key, value] of Object.entries(obj(raw.risk))) if (typeof value === 'boolean') risk[key as RiskFact] = value
  const age = num(raw.age)
  const sex = oneOf(raw.sex, SEXES, 'unknown')
  const questions: JourneyQuestion[] = objects(raw.questions)
    .filter((row) => typeof row.key === 'string')
    .map((row) => ({
      key: row.key as JourneyQuestion['key'],
      label_zh: str(row.label_zh),
      unlocks_zh: str(row.unlocks_zh),
      answered: row.answered === true,
      ...(row.men_only === true ? { men_only: true } : {}),
    }))
  return {
    displayName: str(raw.displayName),
    birthYear: num(raw.birthYear),
    age,
    sex,
    risk,
    focus: strings(raw.focus).filter((key): key is Focus => FOCUS.includes(key as Focus)),
    complete: typeof raw.complete === 'boolean' ? raw.complete : age != null && (sex === 'male' || sex === 'female'),
    questions,
  }
}

function resultsOf(raw: Raw): Journey['results'] {
  const bio = obj(raw.bioage)
  const risk = obj(raw.risk)
  const phenoage = num(bio.phenoage)
  const riskPct = num(risk.risk_pct)
  return {
    bioage: {
      status: bio.status === 'ok' && phenoage != null ? 'ok' : 'blocked',
      phenoage,
      advance: num(bio.advance),
      date: strOrNull(bio.date),
      checkups: num(bio.checkups) ?? 0,
      band_years: num(bio.band_years),
      blocker_zh: str(bio.blocker_zh),
      missing: strings(bio.missing),
      ...(str(bio.caveat_zh) ? { caveat_zh: str(bio.caveat_zh) } : {}),
    },
    risk: {
      status: risk.status === 'ok' && riskPct != null ? 'ok' : 'blocked',
      risk_pct: riskPct,
      category_zh: str(risk.category_zh),
      date: strOrNull(risk.date),
      blocker_zh: str(risk.blocker_zh),
      missing_labs: strings(risk.missing_labs),
      missing_facts: strings(risk.missing_facts),
    },
  }
}

/** Numeric points only, oldest first (the server already keeps one per day). */
function pointsOf(value: unknown): RecordChange['points'] {
  return objects(value)
    .filter((row) => str(row.date) && num(row.value) != null)
    .map((row) => ({ date: str(row.date), value: num(row.value) as number }))
    .sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * A change row is shown only with its comparison and its band: without them
 * the sentence has nothing behind it. A row the server did not mark as good
 * news is treated as one for the doctor, whatever its flag says.
 */
function changeOf(row: Raw): RecordChange | null {
  const compare = obj(row.compare)
  const band = obj(row.band_pct)
  const from = num(compare.from)
  const to = num(compare.to)
  const pct = num(compare.pct)
  const up = num(band.up)
  const down = num(band.down)
  const key = str(row.key)
  const label = str(row.label_zh)
  const text = str(row.text_zh)
  if (!key || !label || !text || from == null || to == null || pct == null || up == null || down == null) return null
  const verdict = oneOf(row.verdict, VERDICTS, 'unclear')
  const source = obj(row.source)
  return {
    key,
    label_zh: label,
    unit: str(row.unit),
    points: pointsOf(row.points),
    compare: { from_date: str(compare.from_date), from, to_date: str(compare.to_date), to, pct },
    band_pct: { up, down },
    direction: oneOf(row.direction, ['up', 'down'] as const, pct < 0 ? 'down' : 'up'),
    verdict,
    ask_doctor: row.ask_doctor === true || verdict !== 'better',
    text_zh: text,
    advice_zh: str(row.advice_zh),
    ...(str(row.caveat_zh) ? { caveat_zh: str(row.caveat_zh) } : {}),
    source: { title: str(source.title), url: str(source.url), ...(str(source.doi) ? { doi: str(source.doi) } : {}) },
    verified: row.verified === true,
  }
}

function changesOf(value: unknown): RecordChange[] {
  const rows = objects(value).map(changeOf).filter((row): row is RecordChange => row != null)
  // The server sorts them already; keep its order, but never let good news sit above a row for the doctor.
  return [...rows.filter((row) => row.ask_doctor), ...rows.filter((row) => !row.ask_doctor)]
}

function addonsOf(value: unknown): Addon[] {
  return objects(value).filter((row) => str(row.item_zh)).map((row) => {
    const key = SELF_KEYS.includes(row.self_key as SelfKey) ? row.self_key as SelfKey : undefined
    return { item_zh: str(row.item_zh), unlocks_zh: str(row.unlocks_zh), self_measurable: row.self_measurable === true && key != null, ...(key ? { self_key: key } : {}) }
  })
}

function selfOf(raw: Raw): Journey['self'] {
  const latest: SelfLatest[] = objects(raw.latest)
    .filter((row) => SELF_KEYS.includes(row.key as SelfKey) && num(row.value) != null)
    .map((row) => ({ key: row.key as SelfKey, label_zh: str(row.label_zh), value: num(row.value) as number, unit: str(row.unit), date: str(row.date), n: num(row.n) ?? 1 }))
  const keys: SelfKeySpec[] = objects(raw.keys)
    .filter((row) => SELF_KEYS.includes(row.key as SelfKey))
    .map((row) => ({ key: row.key as SelfKey, label_zh: str(row.label_zh), unit: str(row.unit), units: strings(row.units) }))
  return { latest, keys }
}

function planOf(raw: Raw): Journey['plan'] {
  return {
    exists: raw.exists === true,
    title: str(raw.title),
    version: num(raw.version),
    items: num(raw.items) ?? 0,
    started: strOrNull(raw.started),
    days: num(raw.days),
    checkin_items: objects(raw.checkin_items)
      .filter((row) => typeof row.id === 'string')
      .map((row) => ({ id: row.id as string, title: str(row.title, row.id as string), done_today: row.done_today === true })),
    streak: num(raw.streak) ?? 0,
    adherence_pct: num(raw.adherence_pct),
  }
}

function remindersOf(value: unknown): Reminder[] {
  return objects(value).filter((row) => str(row.text_zh)).map((row) => ({
    kind: row.kind === 'retest' ? 'retest' : 'checkin',
    text_zh: str(row.text_zh),
    date: strOrNull(row.date),
    due: row.due === true,
  }))
}

/** The same order the server uses, for a journey that arrives without a stage. */
function stageOf(journey: Pick<Journey, 'consent' | 'profile' | 'records' | 'results' | 'plan'>): Stage {
  if (!journey.consent.accepted) return 'consent'
  if (!journey.profile.complete) return 'profile'
  if (journey.records.status !== 'ok') return 'records'
  if (journey.results.bioage.status !== 'ok' && journey.results.risk.status !== 'ok') return 'first_result'
  return journey.plan.exists ? 'routine' : 'plan'
}

export function normalizeJourney(input: unknown): Journey {
  const raw = obj(input)
  if (!('stage' in raw) && !('consent' in raw) && !('profile' in raw)) throw new Error('返回的不是 LongPi 的进度数据')
  const consent = obj(raw.consent)
  const records = obj(raw.records)
  const body = {
    version: str(raw.version),
    today: str(raw.today) || localToday(),
    consent: {
      accepted: consent.accepted === true,
      version: str(consent.version),
      accepted_at: strOrNull(consent.accepted_at),
      current: str(consent.current, str(consent.version)),
    },
    profile: profileOf(obj(raw.profile)),
    focus_options: objects(raw.focus_options)
      .filter((row) => FOCUS.includes(row.key as Focus))
      .map((row) => ({ key: row.key as Focus, label_zh: str(row.label_zh, row.key as string) })),
    records: {
      status: oneOf(records.status, ['unconfigured', 'ok', 'error'] as const, 'unconfigured'),
      error: str(records.error),
      indicator_count: num(records.indicator_count) ?? 0,
      full_checkups: num(records.full_checkups) ?? 0,
      latest_checkup: strOrNull(records.latest_checkup),
      // Only a server that says so is taken to mean the Mirobody plugin is missing.
      mirobody_mounted: records.mirobody_mounted !== false,
    },
    results: resultsOf(obj(raw.results)),
    addons: addonsOf(raw.addons),
    self: selfOf(obj(raw.self)),
    plan: planOf(obj(raw.plan)),
    reminders: remindersOf(raw.reminders),
    boundary_zh: str(raw.boundary_zh) || BOUNDARY_FALLBACK,
  }
  const stage = oneOf(raw.stage, STAGES, stageOf(body))
  const next = obj(raw.next)
  return {
    ...body,
    stage,
    next: {
      stage: oneOf(next.stage, STAGES, stage),
      title_zh: str(next.title_zh),
      detail_zh: str(next.detail_zh),
      action: oneOf(next.action, ACTIONS, 'open'),
    },
    suggestions: objects(raw.suggestions)
      .filter((row) => str(row.text_zh))
      .map((row, index) => ({ id: str(row.id) || `s${index}`, text_zh: str(row.text_zh) })),
    followup: journeyFollowupOf(obj(raw.followup)),
    changes: changesOf(raw.changes),
    changes_note_zh: str(raw.changes_note_zh),
  }
}

function journeyFollowupOf(raw: Raw): Journey['followup'] {
  return {
    enabled: raw.enabled === true,
    channels: strings(raw.channels).filter((row): row is 'desktop' | 'webhook' => row === 'desktop' || row === 'webhook'),
    next_at: strOrNull(raw.next_at),
  }
}

// --- plan draft ---------------------------------------------------------------------------

const CATEGORIES: readonly DraftCategory[] = ['diet', 'exercise', 'sleep', 'weight', 'behavior', 'supplement']
const SOURCES = ['phenoage_levers', 'china_par_levers', 'focus'] as const

function draftItemOf(row: Raw, index: number): DraftItem | null {
  const title = str(row.title)
  const category = row.category
  // A drug never reaches a draft; anything outside the lifestyle categories is dropped, not shown.
  if (!title || !CATEGORIES.includes(category as DraftCategory)) return null
  const evidence = obj(row.evidence)
  const target = obj(row.target)
  const value = num(target.value)
  return {
    id: str(row.id) || `item${index}`,
    category: category as DraftCategory,
    category_zh: str(row.category_zh),
    title,
    detail: str(row.detail),
    start: str(row.start),
    markers: strings(row.markers),
    target: str(target.metric) && value != null && (target.op === '>=' || target.op === '<=')
      ? { metric: str(target.metric), op: target.op, value, unit: str(target.unit) }
      : null,
    evidence: {
      effect_id: str(evidence.effect_id, str(row.id)),
      expected_zh: str(evidence.expected_zh),
      doi: str(evidence.doi),
      verified: evidence.verified === true,
      population: str(evidence.population),
    },
    // Supplements always need a doctor's word first, whatever the server says.
    needs_doctor: row.needs_doctor === true || category === 'supplement',
    cautions_zh: strings(row.cautions_zh),
  }
}

function briefOf(raw: Raw): PlanBrief {
  const safety = obj(raw.safety)
  return {
    today: str(raw.today) || localToday(),
    focus: strings(raw.focus).filter((key): key is Focus => FOCUS.includes(key as Focus)),
    priorities: objects(raw.priorities).filter((row) => str(row.label_zh)).map((row) => ({
      marker_key: str(row.marker_key),
      label_zh: str(row.label_zh),
      value: num(row.value),
      unit: str(row.unit),
      date: strOrNull(row.date),
      why_zh: str(row.why_zh),
      source: oneOf(row.source, SOURCES, 'focus'),
    })),
    candidates: objects(raw.candidates).filter((row) => str(row.intervention_zh) && row.category !== 'drug').map((row) => {
      const effect = obj(row.effect)
      return {
        id: str(row.id),
        intervention_zh: str(row.intervention_zh),
        category: str(row.category),
        marker_key: str(row.marker_key),
        label_zh: str(row.label_zh),
        effect: { value: num(effect.value) ?? 0, unit: str(effect.unit), ...(typeof effect.kind === 'string' ? { kind: effect.kind } : {}) },
        duration_weeks: num(row.duration_weeks),
        population: str(row.population),
        design: str(row.design),
        doi: str(row.doi),
        verified: row.verified === true,
        expected_zh: str(row.expected_zh),
        needs_doctor: row.needs_doctor === true || row.category === 'supplement',
        cautions_zh: strings(row.cautions_zh),
      }
    }),
    safety: { medications: strings(safety.medications), notes_zh: strings(safety.notes_zh) },
    past_items: objects(raw.past_items).filter((row) => str(row.title)).map((row) => ({
      title: str(row.title),
      category: str(row.category),
      verdicts: strings(row.verdicts),
      adherence_pct: num(row.adherence_pct),
    })),
    boundary_zh: str(raw.boundary_zh),
  }
}

export function normalizePlanDraft(input: unknown): PlanDraftResponse {
  const raw = obj(input)
  if (!('brief' in raw) && !('draft' in raw)) throw new Error('返回的不是方案草稿')
  const draft = raw.draft == null ? null : obj(raw.draft)
  const items = draft ? objects(draft.items).map(draftItemOf).filter((row): row is DraftItem => row != null) : []
  const goals: DraftGoal[] = draft
    ? objects(draft.goals)
      .filter((row) => str(row.marker) && num(row.value) != null)
      .map((row) => ({ marker: str(row.marker), value: num(row.value) as number, unit: str(row.unit), basis_zh: str(row.basis_zh) }))
    : []
  return {
    brief: briefOf(obj(raw.brief)),
    // A draft with no usable item is no draft: the card then explains why instead.
    draft: draft && items.length > 0 ? { title: str(draft.title), items, goals, notes_zh: strings(draft.notes_zh) } : null,
  }
}

// --- follow-up ----------------------------------------------------------------------------

const KINDS: readonly WebhookKind[] = ['feishu', 'wecom', 'dingtalk', 'bark', 'generic']
const LOG_KINDS: readonly FollowupKind[] = ['checkin', 'retest', 'weekly', 'nudge', 'custom', 'test']
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

function time(value: unknown, fallback: string): string {
  return typeof value === 'string' && HHMM.test(value) ? value : fallback
}

function settingsOf(raw: Raw): FollowupSettings {
  const weekly = raw.weekly == null ? null : obj(raw.weekly)
  const webhook = raw.webhook == null ? null : obj(raw.webhook)
  const quiet = raw.quiet == null ? null : obj(raw.quiet)
  const day = num(weekly?.day)
  return {
    enabled: raw.enabled === true,
    checkin_time: time(raw.checkin_time, '21:00'),
    retest_time: time(raw.retest_time, '09:00'),
    weekly: weekly && day != null && day >= 1 && day <= 7 ? { day: day as Weekday, time: time(weekly.time, '20:00') } : null,
    desktop: raw.desktop !== false,
    webhook: webhook && KINDS.includes(webhook.kind as WebhookKind)
      ? { kind: webhook.kind as WebhookKind, url_masked: str(webhook.url_masked), secret_set: webhook.secret_set === true }
      : null,
    detail: raw.detail === 'full' ? 'full' : 'minimal',
    quiet: quiet && HHMM.test(str(quiet.start)) && HHMM.test(str(quiet.end)) ? { start: str(quiet.start), end: str(quiet.end) } : null,
  }
}

export function normalizeFollowup(input: unknown): FollowupResponse {
  const raw = obj(input)
  if (!('settings' in raw)) throw new Error('返回的不是随访设置')
  const next = obj(raw.next)
  const log: FollowupLogRow[] = objects(raw.log).filter((row) => str(row.at)).map((row) => {
    const channels = obj(row.channels)
    return {
      at: str(row.at),
      kind: oneOf(row.kind, LOG_KINDS, 'custom'),
      key: str(row.key),
      ok: row.ok === true,
      channels: {
        ...(typeof channels.desktop === 'boolean' ? { desktop: channels.desktop } : {}),
        ...(typeof channels.webhook === 'boolean' ? { webhook: channels.webhook } : {}),
      },
      ...(str(row.error) ? { error: str(row.error) } : {}),
    }
  })
  return {
    settings: settingsOf(obj(raw.settings)),
    next: { checkin: strOrNull(next.checkin), retest: strOrNull(next.retest), weekly: strOrNull(next.weekly) },
    log,
    platform_desktop: raw.platform_desktop === true,
  }
}
