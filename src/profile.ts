import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const SEXES = ['female', 'male', 'other', 'unknown'] as const
export type Sex = (typeof SEXES)[number]

/**
 * Yes/no facts a risk equation needs and a record does not hold (China-PAR).
 * The person states them; absent means not stated, never "no".
 */
export const RISK_FACTS = ['smoker', 'diabetes', 'bp_treated', 'north', 'urban', 'family_history'] as const
export type RiskFact = (typeof RISK_FACTS)[number]
export const RISK_FACT_ZH: Record<RiskFact, string> = {
  smoker: '现在吸烟',
  diabetes: '有糖尿病（空腹血糖 ≥7.0 mmol/L 或在用降糖药）',
  bp_treated: '两周内用过降压药',
  north: '住在北方（长江以北）',
  urban: '住在城市',
  family_history: '父母或兄弟姐妹有心梗或脑卒中',
}

/** Bump when the first-run notice changes, so the person reads the new one before it counts as accepted. */
export const CONSENT_VERSION = '2026-09-24'

/** What the person cares about most, in their order: used to order results and suggestions. */
export const FOCUS = ['bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan'] as const
export type Focus = (typeof FOCUS)[number]
export const FOCUS_ZH: Record<Focus, string> = {
  bioage: '身体年龄',
  cardio: '心血管',
  glucose: '血糖',
  weight: '体重',
  sleep: '睡眠',
  plan: '看方案有没有用',
}

export interface Consent {
  version: string
  accepted_at: string
}

export interface Profile {
  displayName: string
  birthYear: number | null
  age: number | null
  sex: Sex
  risk: Partial<Record<RiskFact, boolean>>
  focus: Focus[]
  consent: Consent | null
}

export const EMPTY_PROFILE: Profile = {
  displayName: '',
  birthYear: null,
  age: null,
  sex: 'unknown',
  risk: {},
  focus: [],
  consent: null,
}

function emptyProfile(): Profile {
  return { ...EMPTY_PROFILE, risk: {}, focus: [] }
}

type Failure = { ok: false; error: string }
type IntResult = { ok: true; value: number | null } | Failure

function optionalInt(value: unknown, min: number, max: number, label: string): IntResult {
  if (value == null || value === '') return { ok: true, value: null }
  const number = typeof value === 'number' ? value : (typeof value === 'string' && value.trim() ? Number(value) : Number.NaN)
  if (!Number.isInteger(number) || number < min || number > max) {
    return { ok: false, error: `${label} must be an integer from ${min} to ${max}` }
  }
  return { ok: true, value: number }
}

export function normalizeProfile(input: unknown): { ok: true; profile: Profile } | Failure {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { ok: false, error: 'profile must be an object' }
  }
  const raw = input as Record<string, unknown>
  for (const key of Object.keys(raw)) {
    if (!['displayName', 'birthYear', 'age', 'sex', 'risk', 'focus', 'consent'].includes(key)) {
      return { ok: false, error: `unknown field ${key}` }
    }
  }
  let displayName = ''
  if (raw.displayName != null && raw.displayName !== '') {
    if (typeof raw.displayName !== 'string') return { ok: false, error: 'displayName must be a string' }
    displayName = raw.displayName.trim()
    if (displayName.length > 40) return { ok: false, error: 'displayName is longer than 40 characters' }
    if (/[\u0000-\u001f]/.test(displayName)) return { ok: false, error: 'displayName has control characters' }
  }
  const birthYear = optionalInt(raw.birthYear, 1900, 2100, 'birthYear')
  if (!birthYear.ok) return birthYear
  const age = optionalInt(raw.age, 0, 130, 'age')
  if (!age.ok) return age
  let sex: Sex = 'unknown'
  if (raw.sex != null && raw.sex !== '') {
    if (typeof raw.sex !== 'string' || !SEXES.includes(raw.sex as Sex)) {
      return { ok: false, error: 'sex must be female, male, other, or unknown' }
    }
    sex = raw.sex as Sex
  }
  const risk: Profile['risk'] = {}
  if (raw.risk != null) {
    if (typeof raw.risk !== 'object' || Array.isArray(raw.risk)) return { ok: false, error: 'risk must be an object of yes/no facts' }
    for (const [key, value] of Object.entries(raw.risk as Record<string, unknown>)) {
      if (!(RISK_FACTS as readonly string[]).includes(key)) return { ok: false, error: `unknown risk fact ${key}` }
      if (value == null || value === '') continue
      if (typeof value !== 'boolean') return { ok: false, error: `${key} must be true, false, or empty` }
      risk[key as RiskFact] = value
    }
  }
  const focus = focusOf(raw.focus)
  if (!focus.ok) return focus
  const consent = consentOf(raw.consent)
  if (!consent.ok) return consent
  return {
    ok: true,
    profile: { displayName, birthYear: birthYear.value, age: age.value, sex, risk, focus: focus.value, consent: consent.value },
  }
}

function focusOf(value: unknown): { ok: true; value: Focus[] } | Failure {
  if (value == null || value === '') return { ok: true, value: [] }
  if (!Array.isArray(value)) return { ok: false, error: `focus must be a list of ${FOCUS.join(', ')}` }
  const out: Focus[] = []
  for (const item of value) {
    if (typeof item !== 'string' || !(FOCUS as readonly string[]).includes(item)) {
      return { ok: false, error: `unknown focus ${String(item)}; use ${FOCUS.join(', ')}` }
    }
    if (!out.includes(item as Focus)) out.push(item as Focus)
  }
  return { ok: true, value: out.slice(0, FOCUS.length) }
}

function consentOf(value: unknown): { ok: true; value: Consent | null } | Failure {
  if (value == null) return { ok: true, value: null }
  if (typeof value !== 'object' || Array.isArray(value)) return { ok: false, error: 'consent must be null or {version, accepted_at}' }
  const { version, accepted_at: acceptedAt } = value as Record<string, unknown>
  if (typeof version !== 'string' || !version.trim()) return { ok: false, error: 'consent.version must be a non-empty string' }
  if (typeof acceptedAt !== 'string' || !/^\d{4}-\d{2}-\d{2}T/.test(acceptedAt) || Number.isNaN(Date.parse(acceptedAt))) {
    return { ok: false, error: 'consent.accepted_at must be an ISO date-time' }
  }
  return { ok: true, value: { version: version.trim(), accepted_at: acceptedAt } }
}

/**
 * Apply a partial update: fields that are absent keep their saved value; a risk fact set to null is cleared.
 * consent in the update is ignored: only the person accepts the notice, through setConsent.
 */
export function mergeProfile(current: Profile, update: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, risk: { ...current.risk }, focus: [...current.focus] }
  for (const key of ['displayName', 'birthYear', 'age', 'sex', 'focus'] as const) {
    if (key in update) merged[key] = update[key]
  }
  if (update.risk && typeof update.risk === 'object' && !Array.isArray(update.risk)) {
    const risk = merged.risk as Record<string, unknown>
    for (const [key, value] of Object.entries(update.risk as Record<string, unknown>)) {
      if (value == null || value === '') delete risk[key]
      else risk[key] = value
    }
  }
  return merged
}

export function estimatedAge(birthYear: number | null, nowYear: number): number | null {
  if (birthYear == null) return null
  const age = nowYear - birthYear
  if (age < 0 || age > 130) return null
  return age
}

function profilePath(dataDir: string): string {
  return join(dataDir, 'profile.json')
}

export function readProfile(dataDir: string): Profile {
  const path = profilePath(dataDir)
  if (!existsSync(path)) return emptyProfile()
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const normalized = normalizeProfile(parsed)
    return normalized.ok ? normalized.profile : emptyProfile()
  } catch {
    return emptyProfile()
  }
}

export function writeProfile(dataDir: string, profile: Profile): void {
  mkdirSync(dirname(profilePath(dataDir)), { recursive: true, mode: 0o700 })
  writeFileSync(profilePath(dataDir), `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 })
}

/** Record that the person accepted (or withdrew from) the current first-run notice. Never called on the model's word. */
export function setConsent(dataDir: string, accept: boolean, now: Date = new Date()): Consent | null {
  const consent = accept ? { version: CONSENT_VERSION, accepted_at: now.toISOString() } : null
  writeProfile(dataDir, { ...readProfile(dataDir), consent })
  return consent
}
