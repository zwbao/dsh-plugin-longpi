// The journey as the components read it. The server may leave a field out
// (an older build) or add read-only ones (a newer build); every block here
// exists and every list is a list, so no surface breaks on a missing field.
// Nothing is invented: a missing number stays null, a missing flag is false.

import { BOUNDARY_FALLBACK } from './constants.ts'
import { localToday } from './format.ts'
import type { Addon, Focus, Journey, JourneyQuestion, NextAction, Reminder, RiskFact, SelfKey, SelfKeySpec, SelfLatest, Sex, Stage } from './types.ts'

type Raw = Record<string, unknown>

const STAGES: readonly Stage[] = ['consent', 'profile', 'records', 'first_result', 'plan', 'routine']
const ACTIONS: readonly NextAction[] = ['consent', 'profile', 'records', 'addons', 'plan', 'checkin', 'review', 'open']
const SEXES: readonly Sex[] = ['female', 'male', 'other', 'unknown']
const SELF_KEYS: readonly SelfKey[] = ['waist', 'sbp', 'dbp', 'weight']
const FOCUS: readonly Focus[] = ['bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan']

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
  }
}
