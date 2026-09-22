import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export const SEXES = ['female', 'male', 'other', 'unknown'] as const
export type Sex = (typeof SEXES)[number]

export interface Profile {
  displayName: string
  birthYear: number | null
  age: number | null
  sex: Sex
}

export const EMPTY_PROFILE: Profile = {
  displayName: '',
  birthYear: null,
  age: null,
  sex: 'unknown',
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
    if (!['displayName', 'birthYear', 'age', 'sex'].includes(key)) {
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
  return {
    ok: true,
    profile: { displayName, birthYear: birthYear.value, age: age.value, sex },
  }
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
