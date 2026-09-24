// Turn a person's measurements into the CSV a skill script reads, with the
// same rules as skillkit.py in the skill: key names carry their unit, aliases
// are read in the input's unit unless unit_required, units convert only with
// the factors skill.json declares, and ranges are checked after conversion.
// Also decides which skills this person's record can already run.

import type { InputSpec, SkillCard } from './catalog.ts'
import { foldName, nameVariants, normalizeUnit, parseNumber } from './units.ts'

export interface MeasurementIn {
  key: string
  value: number | string
  unit?: string
}

export interface Problem {
  key: string
  label: string
  kind: 'missing' | 'unit' | 'unit_missing' | 'range' | 'parse' | 'duplicate' | 'unknown'
  message_zh: string
}

export interface Staged {
  values: Record<string, number>
  csv: string
  problems: Problem[]
  /** Each accepted value: which input it filled, and the unit conversion applied. */
  used: Array<{ key: string; from: string; unit: string; factor: number; given_unit: string; raw: number; value: number }>
}

export interface RecordIndicator {
  name: string
  value: string
  unit: string
  loinc?: string
  label?: string
  date?: string
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(12)))
}

export function measurementInputs(card: SkillCard): InputSpec[] {
  return card.inputs.filter((spec) => (spec.from ?? 'measurements') === 'measurements')
}

export function aliasIndex(specs: readonly InputSpec[]): Map<string, { spec: InputSpec; byKey: boolean }> {
  const index = new Map<string, { spec: InputSpec; byKey: boolean }>()
  for (const spec of specs) index.set(foldName(spec.key), { spec, byKey: true })
  for (const spec of specs) {
    for (const name of [spec.label_zh, ...(spec.aliases ?? [])]) {
      const folded = foldName(name ?? '')
      if (folded && !index.has(folded)) index.set(folded, { spec, byKey: false })
    }
  }
  return index
}

export function unitFactor(spec: InputSpec, unit: string): number | null {
  const canonical = normalizeUnit(spec.unit ?? '')
  const given = normalizeUnit(unit)
  if (given === canonical) return 1
  for (const [name, factor] of Object.entries(spec.accept ?? {})) {
    if (normalizeUnit(name) === given) return factor
  }
  return null
}

function unitLabel(spec: InputSpec): string {
  return spec.unit && spec.unit !== '1' ? spec.unit : ''
}

function withUnit(text: string, unit: string): string {
  return unit ? `${text} ${unit}` : text
}

function rangeProblem(spec: InputSpec, value: number, shown: string, raw: number | null): Problem | null {
  if (!spec.range) return null
  const [low, high] = spec.range
  if (value >= low && value <= high) return null
  const unit = unitLabel(spec)
  let message = `${spec.label_zh} 读成 ${withUnit(fmt(value), unit)}（${shown}），不在合理范围 ${withUnit(`${fmt(low)}–${fmt(high)}`, unit)} 内。`
  if (raw != null) {
    const hints = Object.entries(spec.accept ?? {})
      .filter(([name, factor]) => normalizeUnit(name) !== normalizeUnit(spec.unit ?? '') && raw * factor >= low && raw * factor <= high)
      .map(([name]) => name)
    if (hints.length > 0) message += `如果化验单上的单位是 ${hints.join('、')}，请写明单位。`
  }
  if (spec.note_zh) message += spec.note_zh
  return { key: spec.key, label: spec.label_zh, kind: 'range', message_zh: message }
}

export function resolveInput(index: Map<string, { spec: InputSpec; byKey: boolean }>, name: string): { spec: InputSpec; byKey: boolean } | null {
  for (const variant of nameVariants(name)) {
    const hit = index.get(variant)
    if (hit) return hit
  }
  return null
}

/** Validate and convert measurements; build the CSV in the input's own units. */
export function stageMeasurements(card: SkillCard, items: readonly MeasurementIn[]): Staged {
  const specs = measurementInputs(card)
  const index = aliasIndex(specs)
  const values: Record<string, number> = {}
  const problems: Problem[] = []
  const used: Staged['used'] = []
  for (const item of items) {
    const hit = resolveInput(index, String(item.key ?? ''))
    if (!hit) {
      problems.push({ key: String(item.key), label: String(item.key), kind: 'unknown', message_zh: `${item.key} 不是这个技能要的输入。` })
      continue
    }
    const { spec, byKey } = hit
    const number = parseNumber(item.value)
    if (number == null) {
      problems.push({ key: spec.key, label: spec.label_zh, kind: 'parse', message_zh: `${spec.label_zh} 的值「${String(item.value)}」不是一个可以计算的数。` })
      continue
    }
    const unit = String(item.unit ?? '')
    let factor: number | null = 1
    let shown = unitLabel(spec) ? `按 ${unitLabel(spec)} 读` : '没有单位'
    if (!normalizeUnit(unit)) {
      if (!byKey && spec.unit_required) {
        const accepted = [spec.unit ?? '', ...Object.keys(spec.accept ?? {}).filter((name) => normalizeUnit(name) !== normalizeUnit(spec.unit ?? ''))]
        problems.push({ key: spec.key, label: spec.label_zh, kind: 'unit_missing', message_zh: `${spec.label_zh} 没有写单位。这一项常见 ${accepted.join('、')}，请写明单位。` })
        continue
      }
    } else {
      factor = unitFactor(spec, unit)
      if (factor == null) {
        const accepted = [...new Set([spec.unit ?? '', ...Object.keys(spec.accept ?? {})])]
        problems.push({ key: spec.key, label: spec.label_zh, kind: 'unit', message_zh: `${spec.label_zh} 的单位 ${unit} 不能换算成 ${unitLabel(spec) || '无单位的数'}。可以接受：${accepted.filter(Boolean).join('、') || '无单位'}。${spec.note_zh ?? ''}` })
        continue
      }
      shown = factor === 1 ? `单位 ${unit}` : `原值 ${fmt(number)} ${unit}`
    }
    const value = number * factor
    if (spec.key in values && Math.abs((values[spec.key] ?? 0) - value) > 1e-9 * Math.max(1, Math.abs(value))) {
      problems.push({ key: spec.key, label: spec.label_zh, kind: 'duplicate', message_zh: `${spec.label_zh} 出现了两次，数值不同。请只保留一次。` })
      continue
    }
    const problem = rangeProblem(spec, value, shown, factor === 1 ? number : null)
    if (problem) {
      problems.push(problem)
      continue
    }
    values[spec.key] = value
    used.push({ key: spec.key, from: String(item.key), unit: spec.unit ?? '', factor, given_unit: unit, raw: number, value })
  }
  for (const spec of specs) {
    if (spec.required && !(spec.key in values) && !problems.some((problem) => problem.key === spec.key)) {
      problems.push({ key: spec.key, label: spec.label_zh, kind: 'missing', message_zh: `缺少${spec.label_zh}。` })
    }
  }
  const header = card.entry?.measurements_header?.length ? card.entry.measurements_header : ['marker', 'value', 'unit']
  const rows = [header.join(',')]
  for (const spec of specs) {
    if (!(spec.key in values)) continue
    const cells = [spec.key, fmt(values[spec.key] ?? 0)]
    if (header.length > 2) cells.push(spec.unit ?? '')
    rows.push(cells.join(','))
  }
  return { values, csv: `${rows.join('\n')}\n`, problems, used }
}

export interface Runnable {
  status: 'ready' | 'partial' | 'none' | 'unknown'
  have: string[]
  missing: string[]
  from_record: MeasurementIn[]
}

/** Which of this skill's required inputs the record, the profile and past outputs already supply. */
export function runnableFrom(
  card: SkillCard,
  indicators: readonly RecordIndicator[],
  profile: { age: number | null; sex: string },
  outputs: Record<string, unknown> = {},
): Runnable {
  if (card.inputsStatus === 'none' || card.inputs.length === 0 || !card.script) {
    return { status: 'unknown', have: [], missing: [], from_record: [] }
  }
  const have: string[] = []
  const missing: string[] = []
  const fromRecord: MeasurementIn[] = []
  const byLoinc = new Map<string, RecordIndicator>()
  for (const row of indicators) if (row.loinc) byLoinc.set(row.loinc, row)
  for (const spec of card.inputs) {
    if (!spec.required) continue
    const source = spec.from ?? 'measurements'
    if (source === 'profile') {
      const ok = spec.key === 'age' ? profile.age != null : (profile.sex && profile.sex !== 'unknown')
      if (ok) have.push(spec.label_zh)
      else missing.push(spec.label_zh)
      continue
    }
    if (source === 'measurements') {
      const found = matchIndicator(spec, indicators, byLoinc)
      if (found) {
        have.push(spec.label_zh)
        fromRecord.push({ key: spec.key, value: found.value, unit: found.unit })
        continue
      }
      if (spec.output_of?.some((key) => key in outputs)) {
        have.push(spec.label_zh)
        continue
      }
      missing.push(spec.label_zh)
      continue
    }
    if (source === 'output' && spec.output_of?.some((key) => key in outputs)) {
      have.push(spec.label_zh)
      continue
    }
    missing.push(spec.label_zh)
  }
  const status = missing.length === 0 ? 'ready' : (have.length > 0 && missing.length <= 2 ? 'partial' : 'none')
  return { status, have, missing, from_record: fromRecord }
}

/** The record indicator that holds one declared input, by LOINC code first, then by name. */
export function indicatorFor(spec: InputSpec, indicators: readonly RecordIndicator[]): RecordIndicator | null {
  const byLoinc = new Map<string, RecordIndicator>()
  for (const row of indicators) if (row.loinc) byLoinc.set(row.loinc, row)
  return matchIndicator(spec, indicators, byLoinc)
}

function matchIndicator(spec: InputSpec, indicators: readonly RecordIndicator[], byLoinc: Map<string, RecordIndicator>): RecordIndicator | null {
  for (const code of spec.loinc ?? []) {
    const row = byLoinc.get(code)
    if (row && parseNumber(row.value) != null) return row
  }
  const names = new Set([spec.key, spec.label_zh, ...(spec.aliases ?? [])].map((name) => foldName(name)).filter(Boolean))
  for (const row of indicators) {
    if (parseNumber(row.value) == null) continue
    if (nameVariants(row.name).some((variant) => names.has(variant))) return row
    if (row.label && nameVariants(row.label).some((variant) => names.has(variant))) return row
  }
  return null
}
