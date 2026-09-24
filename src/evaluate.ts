// Did an intervention move a marker? Pure functions over data already read:
// the plan, dated marker values, adherence, medication courses and check-ins.
// A change counts only when it is larger than within-person biological plus
// analytical noise (the reference change value), the retest came late enough,
// the plan was actually followed, and nothing else changed at the same time.
// Trial effects are an average for a population, shown for comparison only.

import type { CheckIn, PlanItem, PlanVersion } from './interventions.ts'
import { addDays, CATEGORY_ZH, daysBetween, TAG_ZH } from './interventions.ts'
import type { CourseRow, DoseRow, SeriesPoint } from './records.ts'
import { preferSelf } from './measurements.ts'
import { effectsFor, markerFor, rcvBand, type Biovar, type BiovarMarker, type EffectRow } from './reference.ts'

export type Verdict = '有效' | '波动内' | '反向' | '无法判断'

/** Days to wait after starting before a retest means anything, when the table has no row for the marker. */
const DEFAULT_RETEST_DAYS = 28
const BASELINE_LOOKBACK_DAYS = 180
const ADHERENCE_GOOD = 0.8
const ADHERENCE_LOW = 0.5
const COVERAGE_MIN = 0.3
const CRP_ACUTE_MG_L = 10

export interface ResolvedMarker {
  /** The marker as the plan named it. */
  asked: string
  label: string
  /** Mirobody indicator name holding its values, when the record has it. */
  indicator: string | null
  loinc?: string
  unit: string
  biovar: BiovarMarker | null
}

export interface Adherence {
  source: 'wearable' | 'dose_log' | 'check_in' | 'none'
  rate: number | null
  coverage: number
  known_days: number
  done_days: number
  window_days: number
  level: 'good' | 'partial' | 'low' | 'unknown'
  streak: number
  calendar: Array<{ date: string; status: 'done' | 'missed' | 'unknown' }>
  note_zh: string
}

export interface Expectation {
  id: string
  text_zh: string
  doi: string
  verified: boolean
  comparison: 'consistent' | 'smaller' | 'larger' | 'opposite' | 'not_comparable'
}

export interface MarkerVerdict {
  item: string
  item_title: string
  marker: string
  indicator: string | null
  unit: string
  verdict: Verdict
  reason_zh: string
  baseline: { date: string; value: number } | null
  followup: { date: string; value: number } | null
  change: { abs: number; pct: number } | null
  band: { up_pct: number; down_pct: number; verified: boolean; cva_default: boolean } | null
  direction: 'improved' | 'worse' | 'within' | 'unknown'
  confounders: string[]
  combined_with: string[]
  expected: Expectation[]
  next_retest: string | null
}

export interface ItemSummary {
  id: string
  title: string
  category: string
  category_zh: string
  start: string
  end: string | null
  days: number
  adherence: Adherence
  verdicts: MarkerVerdict[]
  headline: Verdict
}

export interface Suggestion {
  kind: 'adherence' | 'retest' | 'missing_marker' | 'one_change' | 'review' | 'worse' | 'acute' | 'lever' | 'record'
  priority: number
  text_zh: string
  item?: string
  marker?: string
  date?: string
}

// --- markers ---------------------------------------------------------------

export function resolveMarkers(
  names: readonly string[],
  indicators: ReadonlyArray<{ name: string; loinc?: string; label?: string; unit?: string; source?: 'self' }>,
  biovar: Biovar,
): ResolvedMarker[] {
  // A self measurement is in the list only when it is the newest of its kind, so it wins.
  const rows = preferSelf(indicators)
  return names.map((asked) => {
    const direct = biovar.markers.find((row) => row.key === asked) ?? markerFor(biovar, { name: asked, label: asked })
    const record = rows.find((row) => row.name === asked || (row.source === 'self' && row.label === asked))
      ?? (direct ? rows.find((row) => (row.loinc && direct.loinc.includes(row.loinc)) || (direct.device_codes ?? []).includes(row.name)) : undefined)
      ?? rows.find((row) => markerFor(biovar, row) === direct && direct != null)
    const row = direct ?? (record ? markerFor(biovar, record) : null)
    return {
      asked,
      label: row?.label_zh ?? record?.label ?? asked,
      indicator: record?.name ?? null,
      ...(record?.loinc ? { loinc: record.loinc } : {}),
      unit: record?.unit || row?.unit || '',
      biovar: row,
    }
  })
}

// --- adherence -------------------------------------------------------------

function meets(value: number, op: '>=' | '<=', threshold: number): boolean {
  return op === '<=' ? value <= threshold : value >= threshold
}

/**
 * How well one item was followed over [start, end]. Missing data is unknown,
 * never a miss: a dose absent from the log is not evidence it was skipped.
 */
export function adherenceFor(
  item: PlanItem,
  window: { start: string; end: string },
  data: { daily?: SeriesPoint[]; doses?: DoseRow[]; checkins: CheckIn[] },
  calendarDays = 84,
): Adherence {
  const start = item.start > window.start ? item.start : window.start
  const endCap = item.end && item.end < window.end ? item.end : window.end
  const days = Math.max(0, daysBetween(start, endCap) + 1)
  const status = new Map<string, 'done' | 'missed'>()
  let source: Adherence['source'] = 'none'
  if (item.target && data.daily) {
    source = 'wearable'
    for (const point of data.daily) {
      if (point.date < start || point.date > endCap) continue
      status.set(point.date, meets(point.value, item.target.op, item.target.value) ? 'done' : 'missed')
    }
  } else if (item.mirobody && data.doses) {
    source = 'dose_log'
    const byDay = new Map<string, { taken: number; skipped: number }>()
    for (const dose of data.doses) {
      if (dose.date < start || dose.date > endCap) continue
      const day = byDay.get(dose.date) ?? { taken: 0, skipped: 0 }
      if (/taken|done|已服|服用/i.test(dose.status)) day.taken += 1
      else if (/skip|missed|漏|未服/i.test(dose.status)) day.skipped += 1
      byDay.set(dose.date, day)
    }
    for (const [date, day] of byDay) {
      if (day.taken + day.skipped > 0) status.set(date, day.skipped === 0 ? 'done' : 'missed')
    }
  } else {
    source = 'check_in'
    for (const row of data.checkins) {
      if (row.item !== item.id || row.date < start || row.date > endCap || row.done == null) continue
      if (row.done) status.set(row.date, 'done')
      else if (!status.has(row.date)) status.set(row.date, 'missed')
    }
    if (status.size === 0) source = data.checkins.some((row) => row.item === item.id) ? 'check_in' : 'none'
  }

  let rate: number | null
  let knownDays = status.size
  let doneDays = [...status.values()].filter((value) => value === 'done').length
  if (source === 'check_in' && item.frequency?.per === 'week' && days >= 7) {
    // "3 times a week": count sessions per week against the target
    const weeks = new Map<number, number>()
    for (const [date, value] of status) {
      if (value !== 'done') continue
      const week = Math.floor(daysBetween(start, date) / 7)
      weeks.set(week, (weeks.get(week) ?? 0) + 1)
    }
    const reported = new Set([...status.keys()].map((date) => Math.floor(daysBetween(start, date) / 7)))
    const perWeek = [...reported].map((week) => Math.min(1, (weeks.get(week) ?? 0) / (item.frequency?.times ?? 1)))
    rate = perWeek.length > 0 ? perWeek.reduce((a, b) => a + b, 0) / perWeek.length : null
    knownDays = reported.size * 7
    doneDays = Math.round((rate ?? 0) * knownDays)
  } else {
    rate = knownDays > 0 ? doneDays / knownDays : null
  }
  const coverage = days > 0 ? Math.min(1, knownDays / days) : 0
  let level: Adherence['level'] = 'unknown'
  if (rate != null && coverage >= COVERAGE_MIN) level = rate >= ADHERENCE_GOOD ? 'good' : rate >= ADHERENCE_LOW ? 'partial' : 'low'

  let streak = 0
  for (let day = endCap; day >= start; day = addDays(day, -1)) {
    const value = status.get(day)
    if (value === 'done') streak += 1
    else if (value === 'missed' || day < endCap) break
  }
  const calendar: Adherence['calendar'] = []
  for (let i = calendarDays - 1; i >= 0; i -= 1) {
    const date = addDays(window.end, -i)
    calendar.push({ date, status: date < item.start || (item.end != null && date > item.end) ? 'unknown' : (status.get(date) ?? 'unknown') })
  }
  const sourceZh = { wearable: '手环数据', dose_log: 'Mirobody 服用记录', check_in: '打卡', none: '没有记录' }[source]
  let note = ''
  if (source === 'none') note = item.mirobody ? '在 Mirobody 里打卡服用后才有执行记录。' : '还没有打卡记录。'
  else if (level === 'unknown') note = `${sourceZh}覆盖 ${Math.round(coverage * 100)}% 的天数，太少，执行率不作数。`
  else note = `${sourceZh}：执行率 ${Math.round((rate ?? 0) * 100)}%（覆盖 ${Math.round(coverage * 100)}% 的天数）。`
  return { source, rate, coverage, known_days: knownDays, done_days: doneDays, window_days: days, level, streak, calendar, note_zh: note }
}

// --- effects ---------------------------------------------------------------

function crpInMgL(value: number, unit: string): number {
  return /mg\/dl/i.test(unit) ? value * 10 : value
}

function isCrp(marker: ResolvedMarker): boolean {
  return marker.biovar?.key === 'crp' || /crp|c反应蛋白|c-反应蛋白/i.test(`${marker.asked} ${marker.label}`)
}

function expectationText(row: EffectRow): string {
  const effect = row.effect
  const sign = effect.value > 0 ? '+' : ''
  let amount: string
  if (effect.kind === 'percent_change') amount = `${sign}${effect.value}%`
  else if (effect.kind === 'standardized') amount = `标准化效应 ${effect.value}（${effect.unit}）`
  else if (effect.kind === 'rate') amount = `${sign}${effect.value} ${effect.unit}（年化）`
  else amount = `${sign}${effect.value} ${effect.unit}`
  const ci = effect.ci ? `（95% 区间 ${effect.ci[0]} 至 ${effect.ci[1]}）` : ''
  const per = effect.kind === 'per_unit' && effect.per ? `，按每${effect.per}` : ''
  const weeks = row.duration_weeks ? `，约 ${row.duration_weeks} 周` : ''
  const design = row.design === 'meta-analysis' ? '荟萃分析' : row.design === 'rct' ? '随机对照试验' : row.design
  const checked = row.verified_by === 'person' ? '' : '（数字已由脚本对照原文引文核对，尚未人工复核）'
  return `${row.intervention_zh}对${row.marker_zh}：试验组比对照组平均 ${amount}${ci}${per}${weeks}；${row.population}；${design}。${checked}`
}

/** The published effect in the marker's unit, or null when it cannot be put there. */
function effectInUnit(row: EffectRow, unit: string, marker: BiovarMarker | null): { value: number; ci: [number, number] | null } | null {
  const norm = (text: string) => text.replace(/\s/g, '').toLowerCase()
  const effect = row.effect
  if (norm(effect.unit) === norm(unit)) return { value: effect.value, ci: effect.ci ?? null }
  const factor = marker?.convert ? Object.entries(marker.convert).find(([from]) => norm(from) === norm(effect.unit))?.[1] : undefined
  if (factor == null || norm(marker?.unit ?? '') !== norm(unit)) return null
  return { value: effect.value * factor, ci: effect.ci ? [effect.ci[0] * factor, effect.ci[1] * factor] : null }
}

function compare(row: EffectRow, change: { abs: number; pct: number } | null, unit: string, marker: BiovarMarker | null, years: number): Expectation['comparison'] {
  if (!change) return 'not_comparable'
  const effect = row.effect
  let observed: number
  let expected: { value: number; ci: [number, number] | null } | null
  if (effect.kind === 'standardized' || effect.kind === 'per_unit') return 'not_comparable'
  if (effect.kind === 'percent_change') {
    observed = change.pct * 100
    expected = { value: effect.value, ci: effect.ci ?? null }
  } else {
    observed = change.abs
    expected = effectInUnit(row, unit, marker)
    if (expected && effect.kind === 'rate') {
      expected = { value: expected.value * years, ci: expected.ci ? [expected.ci[0] * years, expected.ci[1] * years] : null }
    }
  }
  if (!expected) return 'not_comparable'
  if (expected.value !== 0 && observed !== 0 && Math.sign(observed) !== Math.sign(expected.value)) return 'opposite'
  const [low, high] = expected.ci ? [Math.min(...expected.ci), Math.max(...expected.ci)] : [expected.value, expected.value]
  if (observed >= low && observed <= high) return 'consistent'
  return Math.abs(observed) < Math.min(Math.abs(low), Math.abs(high)) ? 'smaller' : 'larger'
}

/** Mean of the readings in the last `days` days of a run of readings, dated at its last day. */
function meanOver(points: readonly SeriesPoint[], days: number): SeriesPoint | undefined {
  const last = points.at(-1)
  if (!last) return undefined
  const from = addDays(last.date, -(days - 1))
  const used = points.filter((point) => point.date >= from && point.date <= last.date)
  const value = used.reduce((sum, point) => sum + point.value, 0) / used.length
  return { ...last, value: Math.round(value * 100) / 100 }
}

export interface EvaluateInput {
  goals?: PlanVersion['goals']
  plan: PlanVersion
  today: string
  markers: Record<string, ResolvedMarker>
  series: Record<string, SeriesPoint[]>
  adherence: Record<string, Adherence>
  courses: CourseRow[]
  checkins: CheckIn[]
  biovar: Biovar
  effects: EffectRow[]
}

export function evaluateMarker(item: PlanItem, marker: ResolvedMarker, input: EvaluateInput): MarkerVerdict {
  const base: MarkerVerdict = {
    item: item.id, item_title: item.title, marker: marker.label, indicator: marker.indicator, unit: marker.unit,
    verdict: '无法判断', reason_zh: '', baseline: null, followup: null, change: null, band: null, direction: 'unknown',
    confounders: [], combined_with: [], expected: [], next_retest: null,
  }
  const retestDays = marker.biovar?.min_retest_days ?? DEFAULT_RETEST_DAYS
  if (!marker.indicator) {
    base.reason_zh = `记录里还没有${marker.label}。下次检查时加测，才能看这项干预对它的影响。`
    return base
  }
  const points = (input.series[marker.indicator] ?? []).slice().sort((a, b) => a.date.localeCompare(b.date))
  const before = points.filter((point) => point.date <= item.start && point.date >= addDays(item.start, -BASELINE_LOOKBACK_DAYS))
  const earliest = addDays(item.start, retestDays)
  const lastDay = item.end ? addDays(item.end, 30) : input.today
  const after = points.filter((point) => point.date >= earliest && point.date <= lastDay)
  const window = marker.biovar?.average_days ?? 0
  const baseline = window > 0 ? meanOver(before, window) : before.at(-1)
  const followup = window > 0 ? meanOver(after, window) : after.at(-1)
  if (!baseline) {
    base.reason_zh = `开始前 ${BASELINE_LOOKBACK_DAYS} 天内没有${marker.label}的结果，没有基线可比。`
    base.next_retest = earliest > input.today ? earliest : null
    return base
  }
  base.baseline = { date: baseline.date, value: baseline.value }
  if (!followup) {
    base.next_retest = earliest > input.today ? earliest : input.today
    base.reason_zh = earliest > input.today
      ? `开始才 ${Math.max(0, daysBetween(item.start, input.today))} 天。${marker.label}至少要隔 ${retestDays} 天复测才有意义，${earliest} 之后复测。`
      : `开始后还没有复测${marker.label}。现在可以复测了。`
    return base
  }
  base.followup = { date: followup.date, value: followup.value }
  const abs = followup.value - baseline.value
  const pct = baseline.value !== 0 ? abs / baseline.value : 0
  base.change = { abs, pct }

  // what else changed between the two results
  const windowFrom = baseline.date
  const windowTo = followup.date
  const within = (date: string | null | undefined) => Boolean(date) && (date as string) > windowFrom && (date as string) <= windowTo
  for (const other of input.plan.items) {
    if (other.id === item.id) continue
    const sameMarker = other.markers.some((name) => {
      const resolved = input.markers[name]
      return resolved ? resolved.indicator === marker.indicator : name === marker.asked
    })
    if (sameMarker && (within(other.start) || within(other.end) || (other.start <= windowFrom && (!other.end || other.end > windowFrom)))) {
      base.combined_with.push(other.title)
    }
  }
  const combinedMeds = new Set(input.plan.items.filter((other) => other.mirobody && base.combined_with.includes(other.title)).map((other) => other.mirobody?.medication))
  for (const course of input.courses) {
    if (item.mirobody && course.medication === item.mirobody.medication) continue
    // Already named as a plan item acting on the same marker.
    if (combinedMeds.has(course.medication)) continue
    // A course matters when it is still running at the retest, or stopped shortly before it.
    const runningAtRetest = within(course.start) && (!course.end || course.end >= addDays(windowTo, -14))
    const stoppedJustBefore = within(course.end) && daysBetween(course.end, windowTo) <= 30
    if (runningAtRetest) base.confounders.push(`${course.start} 开始用${course.medication}（Mirobody 用药记录）`)
    else if (stoppedJustBefore) base.confounders.push(`${course.end} 停用${course.medication}，距复测不到一个月（Mirobody 用药记录）`)
  }
  for (const row of input.checkins) {
    if (!within(row.date) || row.tags.length === 0) continue
    const recent = row.tags.includes('illness') ? daysBetween(row.date, windowTo) <= 21 : true
    if (recent) base.confounders.push(`${row.date} ${row.tags.map((tag) => TAG_ZH[tag] ?? tag).join('、')}${row.note ? `：${row.note}` : ''}`)
  }
  base.confounders = [...new Set(base.confounders)].slice(0, 6)

  // trial averages for this intervention and marker
  const years = Math.max(0, daysBetween(baseline.date, followup.date)) / 365.25
  // Only rows a person checked against the paper are set beside a change.
  base.expected = effectsFor(input.effects, item, marker.biovar, marker.loinc).filter((row) => row.verified).slice(0, 4).map((row) => ({
    id: row.id, text_zh: expectationText(row), doi: row.doi, verified: row.verified,
    comparison: compare(row, base.change, marker.unit, marker.biovar, years),
  }))

  const adherence = input.adherence[item.id]
  if (isCrp(marker) && (crpInMgL(baseline.value, marker.unit) > CRP_ACUTE_MG_L || crpInMgL(followup.value, marker.unit) > CRP_ACUTE_MG_L)) {
    base.reason_zh = 'CRP 高于 10 mg/L，多半是急性炎症（感冒、感染、受伤），这次比较不作数。建议恢复两周后复测。'
    return base
  }
  if (!marker.biovar) {
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%。缺少${marker.label}的个体内变异数据，分不清是真实变化还是波动。`
    return base
  }
  const band = rcvBand(marker.biovar, input.biovar.z)
  base.band = { up_pct: band.up * 100, down_pct: band.down * 100, verified: marker.biovar.verified, cva_default: band.cva_default }
  const beyondUp = pct > band.up
  const beyondDown = pct < band.down
  let better = marker.biovar.better
  const goal = (input.goals ?? []).find((row) => row.marker === marker.asked || row.marker === marker.biovar?.key || row.marker === marker.label)
  if ((better === 'none' || better === 'range') && goal && goal.value !== baseline.value) better = goal.value < baseline.value ? 'lower' : 'higher'
  if (!beyondUp && !beyondDown) {
    base.direction = 'within'
    base.verdict = '波动内'
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，在正常波动范围（${(band.down * 100).toFixed(0)}% 至 +${(band.up * 100).toFixed(0)}%）内，还不能算真实变化。`
  } else if (better === 'lower' || better === 'higher') {
    const improved = (better === 'lower' && beyondDown) || (better === 'higher' && beyondUp)
    base.direction = improved ? 'improved' : 'worse'
    base.verdict = improved ? '有效' : '反向'
    base.reason_zh = improved
      ? `变化 ${(pct * 100).toFixed(0)}%，超出正常波动，是真实的改善。`
      : `变化 ${(pct * 100).toFixed(0)}%，超出正常波动，朝不好的方向走了。`
  } else {
    base.direction = 'unknown'
    base.reason_zh = `变化 ${(pct * 100).toFixed(0)}%，超出正常波动；这一项没有“越低越好”或“越高越好”的方向，请结合参考范围看。`
  }
  if (base.verdict === '有效' && base.combined_with.length > 0) {
    base.reason_zh += `同期还有${base.combined_with.join('、')}，只能说明组合有效，分不出是哪一项。`
  }
  if ((base.verdict === '有效' || base.verdict === '反向') && base.confounders.length > 0) {
    base.reason_zh += `期间还有其他变化（${base.confounders.slice(0, 2).join('；')}），结论要打折扣。`
  }
  if (adherence?.level === 'low') {
    base.verdict = '无法判断'
    base.reason_zh = `执行率只有 ${Math.round((adherence.rate ?? 0) * 100)}%，${marker.label}的变化评价不了这项方案本身。${base.reason_zh}`
  }
  if (!marker.biovar.verified) base.reason_zh += '（波动范围所用的变异数据尚未核对来源。）'
  return base
}

function headline(verdicts: readonly MarkerVerdict[]): Verdict {
  if (verdicts.some((row) => row.verdict === '有效')) return '有效'
  if (verdicts.some((row) => row.verdict === '反向')) return '反向'
  if (verdicts.some((row) => row.verdict === '波动内')) return '波动内'
  return '无法判断'
}

export function evaluatePlan(input: EvaluateInput): ItemSummary[] {
  return input.plan.items.map((item) => {
    const adherence = input.adherence[item.id] ?? adherenceFor(item, { start: item.start, end: input.today }, { checkins: [] })
    const verdicts = item.markers.map((name) => evaluateMarker(item, input.markers[name] ?? {
      asked: name, label: name, indicator: null, unit: '', biovar: null,
    }, { ...input, adherence: { ...input.adherence, [item.id]: adherence } }))
    return {
      id: item.id,
      title: item.title,
      category: item.category,
      category_zh: CATEGORY_ZH[item.category],
      start: item.start,
      end: item.end,
      days: Math.max(0, daysBetween(item.start, item.end && item.end < input.today ? item.end : input.today)),
      adherence,
      verdicts,
      headline: headline(verdicts),
    }
  })
}

// --- what to do next ---------------------------------------------------------

export interface LeverHint {
  label: string
  from: string
  to: string
  years: number
}

/**
 * Concrete next steps within the harness's boundary: follow the plan, retest on
 * time, measure what is missing, change one thing at a time, and discuss a
 * plan that is not working with the doctor or coach. Never a dose.
 */
export function suggestNext(summaries: readonly ItemSummary[], context: { today: string; levers?: LeverHint[] }): Suggestion[] {
  const out: Suggestion[] = []
  const seenRetest = new Set<string>()
  for (const item of summaries) {
    if ((item.adherence.level === 'low' || item.adherence.level === 'partial') && item.days >= 14) {
      out.push({
        kind: 'adherence', priority: item.adherence.level === 'low' ? 1 : 3, item: item.id,
        text_zh: `「${item.title}」执行率 ${Math.round((item.adherence.rate ?? 0) * 100)}%。先把执行稳定在八成以上，再判断它有没有用。`,
      })
    }
    if (item.adherence.source === 'none' && item.days >= 7) {
      out.push({
        kind: 'record', priority: 4, item: item.id,
        text_zh: item.adherence.note_zh.startsWith('在 Mirobody')
          ? `「${item.title}」没有服用记录。${item.adherence.note_zh}`
          : `「${item.title}」还没有执行记录。每天在对话里说一句“今天${item.title}完成了”就能记下。`,
      })
    }
    for (const row of item.verdicts) {
      if (!row.indicator) {
        out.push({ kind: 'missing_marker', priority: 3, item: item.id, marker: row.marker, text_zh: `「${item.title}」针对${row.marker}，但记录里没有这一项。下次检查加测。` })
      } else if (row.next_retest && !seenRetest.has(`${row.marker}:${row.next_retest}`)) {
        seenRetest.add(`${row.marker}:${row.next_retest}`)
        out.push({
          kind: 'retest', priority: row.next_retest <= context.today ? 2 : 5, marker: row.marker, date: row.next_retest,
          text_zh: row.next_retest <= context.today ? `现在可以复测${row.marker}了。` : `${row.next_retest} 之后复测${row.marker}。`,
        })
      }
      if (row.verdict === '反向') {
        out.push({ kind: 'worse', priority: 1, item: item.id, marker: row.marker, text_zh: `${row.marker}在「${item.title}」期间变差且超出波动。建议复查确认，并和医生讨论。` })
      }
      if (row.reason_zh.startsWith('CRP 高于 10')) {
        out.push({ kind: 'acute', priority: 2, marker: row.marker, text_zh: 'CRP 超过 10 mg/L。身体恢复两周后再测一次 CRP，再做比较。' })
      }
      if (row.verdict === '有效' && row.combined_with.length > 0) {
        out.push({ kind: 'one_change', priority: 4, item: item.id, text_zh: `${row.marker}的改善来自「${item.title}」和${row.combined_with.join('、')}的组合。下次调整一次只改一项，才分得清谁起作用。` })
      }
      if (row.verdict === '波动内' && item.adherence.level === 'good' && item.days >= 90) {
        out.push({
          kind: 'review', priority: 3, item: item.id, marker: row.marker,
          text_zh: `「${item.title}」执行得很好，但${row.marker}的变化还在波动范围内。可以再复测一次确认，或和医生、长寿师讨论是否调整这一项。`,
        })
      }
    }
  }
  for (const lever of (context.levers ?? []).slice(0, 2)) {
    if (lever.years >= -0.2) continue
    out.push({
      kind: 'lever', priority: 4,
      text_zh: `按表型年龄模型，${lever.label}从 ${lever.from} 到 ${lever.to}，表型年龄约 ${lever.years.toFixed(1)} 岁（模型估计）。它是你当前最大的杠杆。`,
    })
  }
  const unique = new Map<string, Suggestion>()
  for (const row of out) if (!unique.has(row.text_zh)) unique.set(row.text_zh, row)
  return [...unique.values()].sort((a, b) => a.priority - b.priority).slice(0, 10)
}
