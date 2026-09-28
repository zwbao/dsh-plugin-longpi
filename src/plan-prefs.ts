// What the person has already ruled out of a plan, and the draft date. The
// clock moving to the next day does not by itself rewrite the title.

import { createHash, randomBytes } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

export interface PlanPrefs {
  excluded_ids: string[]
  excluded_phrases: string[]
  pregnant: boolean | null
  ckd: boolean | null
  drafted_on: string
  clinical_fp: string
  content_fp: string
  draft: unknown
}

const EMPTY: PlanPrefs = {
  excluded_ids: [],
  excluded_phrases: [],
  pregnant: null,
  ckd: null,
  drafted_on: '',
  clinical_fp: '',
  content_fp: '',
  draft: null,
}

function pathOf(dataDir: string): string {
  return join(dataDir, 'plan_prefs.json')
}

function list(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return [...new Set(value.filter((item): item is string => typeof item === 'string' && item.trim() !== '').map((item) => item.trim()))].slice(0, 40)
}

export function readPlanPrefs(dataDir: string): PlanPrefs {
  const path = pathOf(dataDir)
  if (!existsSync(path)) return { ...EMPTY, excluded_ids: [], excluded_phrases: [] }
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>
    return {
      excluded_ids: list(raw.excluded_ids),
      excluded_phrases: list(raw.excluded_phrases),
      pregnant: typeof raw.pregnant === 'boolean' ? raw.pregnant : null,
      ckd: typeof raw.ckd === 'boolean' ? raw.ckd : null,
      drafted_on: typeof raw.drafted_on === 'string' ? raw.drafted_on : '',
      clinical_fp: typeof raw.clinical_fp === 'string' ? raw.clinical_fp : '',
      content_fp: typeof raw.content_fp === 'string' ? raw.content_fp : '',
      draft: raw.draft ?? null,
    }
  } catch {
    return { ...EMPTY, excluded_ids: [], excluded_phrases: [] }
  }
}

export function writePlanPrefs(dataDir: string, prefs: PlanPrefs): void {
  const path = pathOf(dataDir)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(4).toString('hex')}.tmp`
  writeFileSync(tmp, `${JSON.stringify(prefs, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}

export function fingerprint(value: unknown): string {
  return createHash('sha1').update(JSON.stringify(value)).digest('hex').slice(0, 16)
}

/** Drop or restore one drafted item. The title is stored as a phrase so the same intervention cannot regrow under another evidence id. */
export function setPlanExclusion(dataDir: string, item: { id?: string; title?: string; excluded: boolean }): PlanPrefs {
  const prefs = readPlanPrefs(dataDir)
  const id = (item.id ?? '').trim()
  const title = (item.title ?? '').trim()
  const drop = (list: string[], value: string) => list.filter((row) => row !== value)
  if (item.excluded) {
    if (id && !prefs.excluded_ids.includes(id)) prefs.excluded_ids.push(id)
    if (title && !prefs.excluded_phrases.includes(title)) prefs.excluded_phrases.push(title)
  } else {
    prefs.excluded_ids = drop(prefs.excluded_ids, id)
    prefs.excluded_phrases = drop(prefs.excluded_phrases, title)
  }
  prefs.content_fp = ''
  writePlanPrefs(dataDir, prefs)
  return prefs
}

export function rememberExclusions(dataDir: string, phrases: readonly string[]): PlanPrefs {
  const prefs = readPlanPrefs(dataDir)
  let changed = false
  for (const phrase of phrases) {
    if (!phrase || prefs.excluded_phrases.includes(phrase)) continue
    prefs.excluded_phrases.push(phrase)
    changed = true
  }
  if (changed) {
    prefs.content_fp = ''
    writePlanPrefs(dataDir, prefs)
  }
  return prefs
}

export function setClinicalFlags(dataDir: string, flags: { pregnant?: boolean | null; ckd?: boolean | null }): PlanPrefs {
  const prefs = readPlanPrefs(dataDir)
  if (flags.pregnant !== undefined) prefs.pregnant = flags.pregnant
  if (flags.ckd !== undefined) prefs.ckd = flags.ckd
  writePlanPrefs(dataDir, prefs)
  return prefs
}
