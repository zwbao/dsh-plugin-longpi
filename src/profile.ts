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

export interface Profile {
  displayName: string
  birthYear: number | null
  age: number | null
  sex: Sex
  risk: Partial<Record<RiskFact, boolean>>
}

export const EMPTY_PROFILE: Profile = {
  displayName: '',
  birthYear: null,
  age: null,
  sex: 'unknown',
  risk: {},
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
    if (!['displayName', 'birthYear', 'age', 'sex', 'risk'].includes(key)) {
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
  return {
    ok: true,
    profile: { displayName, birthYear: birthYear.value, age: age.value, sex, risk },
  }
}

/** Apply a partial update: fields that are absent keep their saved value; a risk fact set to null is cleared. */
export function mergeProfile(current: Profile, update: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = { ...current, risk: { ...current.risk } }
  for (const key of ['displayName', 'birthYear', 'age', 'sex'] as const) {
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
  if (!existsSync(path)) return { ...EMPTY_PROFILE }
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
    const normalized = normalizeProfile(parsed)
    return normalized.ok ? normalized.profile : { ...EMPTY_PROFILE }
  } catch {
    return { ...EMPTY_PROFILE }
  }
}

export function writeProfile(dataDir: string, profile: Profile): void {
  mkdirSync(dirname(profilePath(dataDir)), { recursive: true, mode: 0o700 })
  writeFileSync(profilePath(dataDir), `${JSON.stringify(profile, null, 2)}\n`, { mode: 0o600 })
}
