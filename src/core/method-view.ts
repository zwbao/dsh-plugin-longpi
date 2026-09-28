// How a labeled method result is worded and which ones the overview shows.
// The plugin does not choose the method. It only labels a result the model
// already ran, and it keeps a "younger" sentence behind the M4 grade.

import type { MethodResult, ProvenanceKind, ResultLabel } from '../contracts/library.ts'

export const PHENO_SKILL = 'accelerated-biological-aging-risk'
export const RISK_SKILL = 'china-par-ascvd-risk'

/** How many personal results the overview draws, after the two named cards. */
export const OVERVIEW_VALUE_CAP = 4
/** How many evidence-only rows the overview draws under those results. */
export const OVERVIEW_EVIDENCE_CAP = 4

const LABELS = new Set<ResultLabel>(['verified', 'unverified-binding', 'evidence-only'])
const PROVENANCE = new Set<ProvenanceKind>([
  'blood_clock', 'methylation_clock', 'abdominal_ct', 'coronary_ct', 'routine_lab',
  'wearable', 'questionnaire', 'profile', 'output_of',
])

const TITLES: Record<string, string> = {
  [PHENO_SKILL]: '身体年龄',
  [RISK_SKILL]: '10 年心血管风险',
  'sleep-chart-biological-ageing': '睡眠时长',
  'retinal-aging-biomarkers-longitudinal': '视网膜年龄差',
  'aging-biomarker-framework': '甲基化时钟偏差',
  'epigenetic-frailty-risk-score': '表观衰弱分数',
  'testis-transcriptomic-atlas-lifespan': '年龄分段',
}

const RED_KEY = /^(hb|hgb|mcv|mch|rdw|rdwcv|rdw_cv)$/i
const RED_LABEL = /血红蛋白|平均红细胞体积|红细胞分布宽度|平均红细胞血红蛋白/

/** A positive "you are younger" claim. A negation such as 不能说明你变年轻了 does not match. */
const YOUNGER_CLAIM = /你确实年轻了|比实足年龄年轻|你变年轻了|更年轻了|年轻了\s*\d+(?:\.\d+)?|逆龄/g

export function facingUnit(unit: string, key = ''): string {
  const raw = unit.trim()
  if (!raw || raw === '1') return ''
  const folded = raw.toLowerCase()
  if (folded === 'a' || folded === 'yr' || folded === 'yrs' || folded === 'year' || folded === 'years' || folded === 'y') {
    return /hour|时间|时长|随访/.test(key) ? '年' : '岁'
  }
  if (folded === 'h' || folded === 'hr' || folded === 'hour' || folded === 'hours') return '小时'
  if (folded === 'd' || folded === 'day' || folded === 'days') return '天'
  if (folded === 'min' || folded === 'minute' || folded === 'minutes') return '分钟'
  return raw
}

// When one method reports several numbers, the number on the card names the card. aging-biomarker-framework
// is 甲基化时钟偏差 only when a methylation clock filled it; from a blood panel it is the blood PhenoAge gap.
const TITLE_BY_OUTPUT: Record<string, string> = {
  blood_phenoage_age_deviation: '血检身体年龄减周岁',
  phenoage_gap: '身体年龄减周岁',
}

export function titleOf(skill: string, titleZh = '', outputKey = ''): string {
  if (skill !== PHENO_SKILL && skill !== RISK_SKILL && TITLE_BY_OUTPUT[outputKey]) return TITLE_BY_OUTPUT[outputKey]
  if (TITLES[skill]) return TITLES[skill]
  const named = titleZh.trim().replace(/。$/, '')
  if (named && /[\u4e00-\u9fff]/.test(named) && !/[A-Za-z]{4,}/.test(named)) return named.length > 22 ? named.slice(0, 22) : named
  return '这项检查'
}

export function formatMeasure(value: number | string, unit: string, key = ''): string {
  const shownUnit = facingUnit(unit, key)
  if (typeof value === 'string') {
    const text = value.trim()
    if (!text) return ''
    return shownUnit && !text.includes(shownUnit) ? `${text} ${shownUnit}`.trim() : text
  }
  if (!Number.isFinite(value)) return ''
  const shown = String(Number(value.toFixed(2)))
  if (!shownUnit) return shown
  if (shownUnit === '%') return `${shown}%`
  return `${shown} ${shownUnit}`
}

export function speciesOf(row: Pick<MethodResult, 'limits_zh'>): string | null {
  const match = /物种[:：]\s*([^。；\n]+)/.exec(row.limits_zh)
  const species = match?.[1]?.trim()
  return species || null
}

export function primaryOutput(row: MethodResult): MethodResult['outputs'][number] | null {
  const numeric = row.outputs.find((item) => typeof item.value === 'number' && Number.isFinite(item.value))
  if (numeric) return numeric
  const text = row.outputs.find((item) => typeof item.value === 'string' && item.value.trim() !== '')
  return text ?? null
}

export function allowsYoungerClaim(label: ResultLabel, allowedClaims: readonly string[] | undefined): boolean {
  return label === 'verified' && (allowedClaims ?? []).includes('younger')
}

const NEGATED_BEFORE = /(?:不|别|没有|无需|不要|避免|先不|还不能|不能说明)$/

/** Replace one phrase, leaving a copy that sits in a negation. */
function replaceClaim(text: string, phrase: string, next: string): string {
  let out = ''
  let at = 0
  while (at <= text.length) {
    const found = text.indexOf(phrase, at)
    if (found < 0) return out + text.slice(at)
    const before = text.slice(Math.max(0, found - 8), found)
    out += text.slice(at, found)
    out += NEGATED_BEFORE.test(before) ? phrase : next
    at = found + phrase.length
  }
  return out
}

/** Drop a positive younger claim. Negations such as 不能说明你变年轻了 stay. */
export function stripYoungerClaim(text: string): string {
  let out = replaceClaim(text, '你确实年轻了', '有变化')
  out = replaceClaim(out, '比实足年龄年轻', '比实足年龄低')
  out = replaceClaim(out, '你变年轻了', '数字有变化')
  out = replaceClaim(out, '更年轻了', '数字更低')
  out = out.replace(/年轻了\s*(\d+(?:\.\d+)?)/g, (match, digits: string, offset: number, whole: string) => {
    const before = whole.slice(Math.max(0, offset - 8), offset)
    return NEGATED_BEFORE.test(before) ? match : `变化了 ${digits}`
  })
  return replaceClaim(out, '逆龄', '变化')
}

export function evidenceSentence(row: MethodResult): string {
  const species = speciesOf(row) ?? '未标明'
  const rest = row.limits_zh.replace(/物种[:：]\s*[^。；\n]+[。；]?/g, '').trim()
  const tail = rest ? (rest.endsWith('。') ? rest : `${rest}。`) : ''
  const personal = /不是你的/.test(rest) ? '' : '这不是你的个人数字。'
  return `仅证据（物种：${species}）。${tail}${personal}`
}

const SOURCE_ZH: Array<[RegExp, string]> = [
  [/systolic blood pressure/i, '收缩压（高压）'],
  [/diastolic blood pressure/i, '舒张压（低压）'],
  [/fasting (?:blood )?glucose|blood glucose/i, '空腹血糖'],
  [/hs-?crp|c-reactive protein/i, '超敏 C 反应蛋白'],
  [/mean corpuscular volume|\bmcv\b/i, '平均红细胞体积'],
  [/white blood cell/i, '白细胞'],
  [/haemoglobin|hemoglobin/i, '血红蛋白'],
]

/** A source line a person can read. English lab names become the Chinese name plus the number. */
export function plainSource(quote: string): string {
  const text = quote.trim()
  if (!text) return ''
  for (const [pattern, label] of SOURCE_ZH) {
    if (pattern.test(text)) {
      const num = text.match(/-?\d+(?:\.\d+)?/)
      return num ? `${label}${num[0]}` : label
    }
  }
  if (/[A-Za-z]{3,}(?:\s+[A-Za-z]{3,}){2,}/.test(text)) {
    const num = text.match(/-?\d+(?:\.\d+)?/)
    return num ? num[0] : ''
  }
  return text.replace(/\b[A-Z]\d{2}\.\d+\b/g, '').replace(/\s{2,}/g, ' ').trim()
}

/**
 * The sentence under a result. An unverified binding names the source row in
 * that same sentence. A younger claim is removed unless M4 already allowed it
 * and the label is verified.
 */
export function resultSentence(row: MethodResult, opts: { youngerAllowed: boolean }): string {
  if (row.label === 'evidence-only') return evidenceSentence(row)
  const out = primaryOutput(row)
  const shown = out && out.value != null && out.value !== '' ? formatMeasure(out.value, out.unit, out.key) : '没有个人数字'
  const title = titleOf(row.skill, row.title_zh, out?.key ?? '')
  let text: string
  if (row.label === 'unverified-binding') {
    const raw = row.inputs_used.map((item) => item.quote.trim()).find(Boolean) ?? ''
    const quote = plainSource(raw)
    text = quote ? `${title}是 ${shown}（还没对上，来源：${quote}）。` : `${title}是 ${shown}（还没对上）。`
  } else {
    const limits = row.limits_zh.trim()
    const boundary = limits ? (limits.endsWith('。') ? limits : `${limits}。`) : ''
    text = `${title}是 ${shown}（已核对）。${boundary}`
  }
  if (!opts.youngerAllowed && YOUNGER_CLAIM.test(text)) text = stripYoungerClaim(text)
  YOUNGER_CLAIM.lastIndex = 0
  return text
}

/** Short line for the fact list. Limits stay on the card, not in the ranked fact. */
export function methodFactText(row: MethodResult): string {
  if (row.label === 'verified') {
    const out = primaryOutput(row)
    const shown = out && out.value != null && out.value !== '' ? formatMeasure(out.value, out.unit, out.key) : '没有个人数字'
    return `${titleOf(row.skill, row.title_zh, out?.key ?? '')}是 ${shown}（已核对）。`
  }
  return resultSentence(row, { youngerAllowed: false })
}

export function verifiedMention(results: readonly MethodResult[]): string | null {
  const row = overviewSlice(results).value.find((item) => item.label === 'verified')
  if (!row) return null
  const out = primaryOutput(row)
  if (!out || out.value == null || out.value === '') return null
  return `已核对：${titleOf(row.skill, row.title_zh, out.key)} ${formatMeasure(out.value, out.unit, out.key)}`
}

export function redCellDriverNames(rows: readonly { key?: string; label_zh?: string }[]): string[] {
  const names: string[] = []
  for (const row of rows) {
    const label = (row.label_zh ?? '').trim()
    const key = (row.key ?? '').trim()
    if (!RED_KEY.test(key) && !RED_LABEL.test(label)) continue
    const name = label || key
    if (name && !names.includes(name)) names.push(name)
  }
  return names.slice(0, 4)
}

/**
 * Body age above chronological age: name the red-cell drivers when the record
 * has them, and say that treating the cause may bring the number down.
 * Returns null when the result is not older.
 */
export function olderThanAgeSentence(input: { phenoage: number; advance: number; drivers: readonly string[] }): string | null {
  if (!Number.isFinite(input.phenoage) || !Number.isFinite(input.advance) || input.advance <= 0) return null
  const high = `这次身体年龄 ${formatMeasure(input.phenoage, '岁')}，比实足年龄高 ${formatMeasure(input.advance, '岁')}。`
  const names = input.drivers.map((name) => name.trim()).filter(Boolean).slice(0, 4)
  const cause = names.length >= 2
    ? `${names.join('、')}这些红细胞指标把这个数抬高了。和贫血这类原因有关时，先请医生看清原因；原因处理之后，这个数可能会降下来。`
    : names.length === 1
      ? `${names[0]}把这个数抬高了。先请医生看清原因；原因处理之后，这个数可能会降下来。`
      : '是哪几项检查把这个数抬高的，要对照化验看。先请医生看清原因；原因处理之后，这个数可能会降下来。'
  return `${high}${cause}`
}

function pin(skill: string): number {
  if (skill === PHENO_SKILL) return 0
  if (skill === RISK_SKILL) return 1
  return 2
}

function byLabel(a: MethodResult, b: MethodResult): number {
  const rank: Record<ResultLabel, number> = { verified: 0, 'unverified-binding': 1, 'evidence-only': 2 }
  return rank[a.label] - rank[b.label] || pin(a.skill) - pin(b.skill) || a.skill.localeCompare(b.skill)
}

function hasPersonalOutput(row: MethodResult): boolean {
  return row.outputs.some((item) => item.value != null && item.value !== '')
}

export interface OverviewSlice {
  value: MethodResult[]
  evidence: MethodResult[]
}

/** Personal results first (PhenoAge and China-PAR stay in the slice), then evidence rows. */
export function overviewSlice(results: readonly MethodResult[]): OverviewSlice {
  const value = results.filter((row) => row.label !== 'evidence-only' && hasPersonalOutput(row)).sort(byLabel)
  const evidence = results.filter((row) => row.label === 'evidence-only').sort(byLabel)
  const pinned = value.filter((row) => row.skill === PHENO_SKILL || row.skill === RISK_SKILL)
  const rest = value.filter((row) => row.skill !== PHENO_SKILL && row.skill !== RISK_SKILL)
  const cap = Math.max(OVERVIEW_VALUE_CAP, pinned.length)
  return {
    value: [...pinned, ...rest].slice(0, cap),
    evidence: evidence.slice(0, OVERVIEW_EVIDENCE_CAP),
  }
}

/** Verified and unverified-binding results the overview actually draws. */
export function methodsOnPage(results: readonly MethodResult[]): number {
  return overviewSlice(results).value.length
}

export function parseMethodResults(value: unknown): MethodResult[] {
  if (!Array.isArray(value)) return []
  const out: MethodResult[] = []
  for (const item of value) {
    if (!item || typeof item !== 'object') continue
    const raw = item as Record<string, unknown>
    const skill = typeof raw.skill === 'string' ? raw.skill.trim() : ''
    const label = raw.label
    if (!skill || typeof label !== 'string' || !LABELS.has(label as ResultLabel)) continue
    const outputs = Array.isArray(raw.outputs) ? raw.outputs.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const cell = row as Record<string, unknown>
      const key = typeof cell.key === 'string' ? cell.key : ''
      const unit = typeof cell.unit === 'string' ? cell.unit : ''
      const rawValue = cell.value
      const parsed = typeof rawValue === 'number' && Number.isFinite(rawValue)
        ? rawValue
        : typeof rawValue === 'string'
          ? rawValue
          : rawValue === null
            ? null
            : undefined
      if (!key || parsed === undefined) return []
      return [{ key, value: parsed, unit }]
    }) : []
    const inputs_used = Array.isArray(raw.inputs_used) ? raw.inputs_used.flatMap((row) => {
      if (!row || typeof row !== 'object') return []
      const cell = row as Record<string, unknown>
      const input = typeof cell.input === 'string' ? cell.input : ''
      const source = typeof cell.source_row_id === 'string' ? cell.source_row_id : ''
      const provenance = cell.provenance
      const quote = typeof cell.quote === 'string' ? cell.quote : ''
      const rawValue = cell.value
      const parsed = typeof rawValue === 'number' && Number.isFinite(rawValue) ? rawValue : typeof rawValue === 'string' ? rawValue : undefined
      const unit = typeof cell.unit === 'string' ? cell.unit : ''
      if (!input || !source || parsed === undefined || typeof provenance !== 'string' || !PROVENANCE.has(provenance as ProvenanceKind)) return []
      return [{ input, source_row_id: source, value: parsed, unit, provenance: provenance as ProvenanceKind, quote }]
    }) : []
    const ran_at = typeof raw.ran_at === 'string' ? raw.ran_at : ''
    const catalog_version = typeof raw.catalog_version === 'string' ? raw.catalog_version : ''
    if (!ran_at || !catalog_version) continue
    out.push({
      skill,
      label: label as ResultLabel,
      outputs,
      inputs_used,
      catalog_version,
      ran_at,
      limits_zh: typeof raw.limits_zh === 'string' ? raw.limits_zh : '',
      ...(typeof raw.title_zh === 'string' && /[\u4e00-\u9fff]/.test(raw.title_zh) ? { title_zh: raw.title_zh.trim() } : {}),
    })
  }
  return out
}
