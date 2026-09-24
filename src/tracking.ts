// Put the plan next to the record: read the markers the plan aims at, how the
// plan was followed, what else changed, and the phenotypic age at every past
// checkup; then judge each item and model the goals. Every number comes from
// Mirobody, the person's check-ins, or a skill script. The harness computes
// no clinical formula here: phenotypic age and its levers come from the
// accelerated-biological-aging-risk skill, noise bands from data tables.

import { createHash } from 'node:crypto'
import type { Catalog, SkillCard } from './catalog.ts'
import type { Config } from './config.ts'
import { adherenceFor, evaluatePlan, resolveMarkers, suggestNext, type Adherence, type ItemSummary, type LeverHint, type ResolvedMarker, type Suggestion } from './evaluate.ts'
import { readHistory, seriesOf } from './history.ts'
import { addDays, CATEGORY_ZH, currentPlan, daysBetween, readCheckIns, readPlans, type CheckIn, type PlanItem, type PlanVersion } from './interventions.ts'
import { RISK_FACT_ZH, type RiskFact } from './profile.ts'
import { aliasIndex, indicatorFor, measurementInputs, resolveInput, stageMeasurements, type MeasurementIn } from './measurements.ts'
import { loadCourses, loadDoseLog, loadSeries, type CourseRow, type RecordSnapshot, type SeriesPoint } from './records.ts'
import { loadReference, markerFor, rcvBand, type Reference } from './reference.ts'
import { runSkill, type Levers } from './runner.ts'
import { readSelf, selfKeyOf, selfSeries } from './selfmeasure.ts'

export const PHENOAGE_SKILL = 'accelerated-biological-aging-risk'
export const RISK_SKILL = 'china-par-ascvd-risk'
const BIOAGE_CHECKUPS = 6
const LOOKBACK_DAYS = 3 * 365
const CACHE_TTL_MS = 60_000

export interface TrackingContext {
  config: Config
  dataDir: string
  skillsHome: string
  catalog: Catalog
  records: RecordSnapshot
  today: string
}

export interface BioAgePoint {
  date: string
  phenoage: number
  advance: number | null
  mortality_10y_pct: number | null
}

export interface BioAge {
  status: 'ok' | 'no_skill' | 'no_record' | 'missing_inputs' | 'no_age' | 'no_checkup' | 'error'
  note_zh: string
  missing: string[]
  points: BioAgePoint[]
  /** Change in years that within-person variation alone could explain (two-sided, z from the table). */
  band_years: number | null
  band_verified: boolean
  /** Inputs with no published within-person variation, left out of the band (so the band is a lower bound). */
  band_missing: string[]
  runs: number
}

export interface ModelCard {
  model: 'phenoage' | 'china-par'
  title_zh: string
  status: 'ok' | 'no_goal' | 'unavailable'
  note_zh: string
  measured_on: string | null
  now: Record<string, number | null>
  goal: Record<string, number | null> | null
  /** The skill's own risk category (低危, 中危, 高危), now and at the goals. */
  category_zh?: { now: string; goal: string | null }
  /** Everything the model still needs, by its Chinese name: missing_labs then missing_facts. */
  missing?: string[]
  /** Measurements the record (or the person's own measurements) does not hold yet. */
  missing_labs?: string[]
  /** Stated facts the profile does not hold yet (age, sex, the yes/no facts); unknown is never no. */
  missing_facts?: string[]
  levers: LeverHint[]
  sensitivity: Array<{ label: string; unit: string; years_per_step: number; step: string }>
  boundary_zh: string
}

export interface MarkerChart {
  key: string
  label: string
  indicator: string
  unit: string
  better: string
  points: Array<{ date: string; value: number }>
  band: { base: number; base_date: string; low: number; high: number; verified: boolean } | null
  goal: number | null
  items: string[]
}

export interface Tracking {
  status: 'no_plan' | 'ok'
  today: string
  plan: PlanVersion | null
  versions: Array<{ version: number; saved_at: string; title: string; items: number }>
  items: ItemSummary[]
  suggestions: Suggestion[]
  charts: MarkerChart[]
  bioage: BioAge
  models: ModelCard[]
  checkins: CheckIn[]
  reference: { biovar_markers: number; biovar_verified: number; effects: number; effects_verified: number; error?: string }
  errors: string[]
}

const memo = new Map<string, { at: number; value: Promise<Tracking> }>()

export function invalidateTracking(): void {
  memo.clear()
}

function referenceStats(reference: Reference): Tracking['reference'] {
  return {
    biovar_markers: reference.biovar.markers.length,
    biovar_verified: reference.biovar.markers.filter((row) => row.verified).length,
    effects: reference.effects.length,
    effects_verified: reference.effects.filter((row) => row.verified).length,
    ...(reference.error ? { error: reference.error } : {}),
  }
}

export async function buildTracking(context: TrackingContext): Promise<Tracking> {
  const plan = currentPlan(context.dataDir)
  const checkins = readCheckIns(context.dataDir)
  const { profile, record_status: status, indicators } = context.records
  // The record, the profile and self measurements change results too; a stale memo must not answer for them.
  const key = [
    context.dataDir, context.skillsHome, context.today, plan?.version ?? 0, checkins.length, context.catalog.revision, status,
    JSON.stringify([profile.age, profile.sex, profile.risk]),
    createHash('sha1').update(indicators.map((row) => `${row.name}=${row.value}@${row.date ?? ''}`).join('\n')).digest('hex'),
  ].join('\u0000')
  const now = Date.now()
  const hit = memo.get(key)
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value
  for (const [name, entry] of memo) if (now - entry.at >= CACHE_TTL_MS) memo.delete(name)
  const value = compute(context, plan, checkins)
  memo.set(key, { at: now, value })
  value.catch(() => memo.delete(key))
  return value
}

async function compute(context: TrackingContext, plan: PlanVersion | null, checkins: CheckIn[]): Promise<Tracking> {
  const reference = loadReference(context.skillsHome)
  const errors: string[] = []
  const versions = readPlans(context.dataDir).map((row) => ({ version: row.version, saved_at: row.saved_at, title: row.title, items: row.items.length }))
  const bioage = await ensureBioAge(context, reference)
  const goals = plan?.goals ?? []
  const models = await modelCards(context, reference, goals)
  const levers = models.find((card) => card.model === 'phenoage')?.levers ?? []
  if (!plan) {
    return {
      status: 'no_plan', today: context.today, plan: null, versions, items: [], suggestions: [], charts: [], bioage, models,
      checkins: [], reference: referenceStats(reference), errors,
    }
  }

  const names = [...new Set([...plan.items.flatMap((item) => item.markers), ...goals.map((goal) => goal.marker)])]
  const resolvedList = resolveMarkers(names, context.records.indicators, reference.biovar)
  const markers: Record<string, ResolvedMarker> = Object.fromEntries(resolvedList.map((row) => [row.asked, row]))
  const earliest = plan.items.map((item) => item.start).sort()[0] ?? context.today
  const resolvedNames = [...new Set(resolvedList.map((row) => row.indicator).filter((name): name is string => Boolean(name)))]
  // Markers resolved to the person's own measurements are read from dataDir, never asked of Mirobody.
  const indicatorNames = resolvedNames.filter((name) => !selfKeyOf(name))
  const seriesStart = addDays(earliest, -200)
  const labs = context.records.record_status === 'ok' && indicatorNames.length > 0
    ? await loadSeries(context.config, indicatorNames, { start: seriesStart, end: context.today, resolution: 'raw' })
    : { series: {}, truncated: false }
  if ('error' in labs && labs.error) errors.push(`读取检查结果：${labs.error}`)
  const series: Record<string, SeriesPoint[]> = Object.fromEntries(Object.entries(labs.series).map(([name, row]) => [name, row.points]))
  const selfRows = readSelf(context.dataDir)
  for (const name of resolvedNames) {
    const selfKey = selfKeyOf(name)
    if (selfKey) series[name] = selfSeries(selfRows, selfKey).filter((point) => point.date >= seriesStart && point.date <= context.today)
  }

  const adherence: Record<string, Adherence> = {}
  const calendarStart = addDays(context.today, -83)
  for (const item of plan.items) {
    // Adherence is read over the last 12 weeks: the stretch the calendar shows and the one a retest reflects.
    const window = { start: calendarStart, end: context.today }
    let daily: SeriesPoint[] | undefined
    let doses
    if (item.target && context.records.record_status === 'ok') {
      const read = await loadSeries(context.config, [item.target.metric], { start: item.start < calendarStart ? item.start : calendarStart, end: context.today, resolution: 'day' })
      if (read.error) errors.push(`读取${item.target.metric}：${read.error}`)
      daily = read.series[item.target.metric]?.points ?? []
    } else if (item.mirobody && context.records.record_status === 'ok') {
      const read = await loadDoseLog(context.config, item.mirobody.medication, item.start, context.today)
      if (read.error) errors.push(`读取${item.mirobody.medication}的服用记录：${read.error}`)
      doses = read.rows
    }
    adherence[item.id] = adherenceFor(item, window, { daily, doses, checkins })
  }
  const courses: CourseRow[] = context.records.record_status === 'ok' ? (await loadCourses(context.config)).rows : []

  const items = evaluatePlan({
    plan, goals, today: context.today, markers, series, adherence, courses, checkins, biovar: reference.biovar, effects: reference.effects,
  })
  const suggestions = suggestNext(items, { today: context.today, levers })
  const charts = chartsFor(plan, resolvedList, series, reference, goals)
  return {
    status: 'ok', today: context.today, plan, versions, items, suggestions, charts, bioage, models,
    checkins: checkins.slice(-30).reverse(), reference: referenceStats(reference), errors,
  }
}

function chartsFor(plan: PlanVersion, markers: ResolvedMarker[], series: Record<string, SeriesPoint[]>, reference: Reference, goals: PlanVersion['goals']): MarkerChart[] {
  const out: MarkerChart[] = []
  const seen = new Set<string>()
  for (const marker of markers) {
    if (!marker.indicator || seen.has(marker.indicator)) continue
    seen.add(marker.indicator)
    const raw = (series[marker.indicator] ?? []).map((point) => ({ date: point.date, value: point.value }))
    // Markers judged on weekly means (home blood pressure) are drawn as weekly means too.
    const points = marker.biovar?.average_days ? weeklyMeans(raw) : raw
    if (points.length === 0) continue
    const items = plan.items.filter((item) => item.markers.includes(marker.asked)).map((item) => item.id)
    const firstStart = plan.items.filter((item) => items.includes(item.id)).map((item) => item.start).sort()[0]
    const base = (firstStart ? points.filter((point) => point.date <= firstStart).at(-1) : undefined) ?? points[0]
    let band: MarkerChart['band'] = null
    if (base && marker.biovar) {
      const rcv = rcvBand(marker.biovar, reference.biovar.z)
      band = { base: base.value, base_date: base.date, low: base.value * (1 + rcv.down), high: base.value * (1 + rcv.up), verified: marker.biovar.verified }
    }
    const goal = goals.find((row) => row.marker === marker.asked || markers.find((other) => other.asked === row.marker)?.indicator === marker.indicator)
    out.push({
      key: marker.biovar?.key ?? marker.indicator,
      label: marker.label,
      indicator: marker.indicator,
      unit: marker.unit,
      better: marker.biovar?.better ?? 'none',
      points,
      band,
      goal: goal ? goal.value : null,
      items,
    })
  }
  return out
}

function weeklyMeans(points: Array<{ date: string; value: number }>): Array<{ date: string; value: number }> {
  const weeks = new Map<string, number[]>()
  for (const point of points) {
    const at = new Date(`${point.date}T00:00:00Z`)
    at.setUTCDate(at.getUTCDate() - ((at.getUTCDay() + 6) % 7))
    const key = at.toISOString().slice(0, 10)
    weeks.set(key, [...(weeks.get(key) ?? []), point.value])
  }
  return [...weeks.entries()].sort(([a], [b]) => a.localeCompare(b))
    .map(([date, values]) => ({ date, value: Math.round((values.reduce((sum, value) => sum + value, 0) / values.length) * 10) / 10 }))
}

// --- phenotypic age at every checkup ------------------------------------------

function pairsFor(card: SkillCard, records: RecordSnapshot) {
  return measurementInputs(card).filter((spec) => spec.required).map((spec) => ({ spec, indicator: indicatorFor(spec, records.indicators) }))
}

function ageOn(date: string, today: string, ageNow: number): number {
  return Math.round((ageNow - daysBetween(date, today) / 365.25) * 10) / 10
}

async function ensureBioAge(context: TrackingContext, reference: Reference): Promise<BioAge> {
  const empty = (status: BioAge['status'], note: string, missing: string[] = []): BioAge => ({
    status, note_zh: note, missing, points: pointsFromHistory(context.dataDir), band_years: null, band_verified: false, band_missing: [], runs: 0,
  })
  const card = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL)
  if (!card || !card.script) return empty('no_skill', '技能库里没有表型年龄方法。')
  if (context.records.record_status !== 'ok') return empty('no_record', '还没有接上 Mirobody 记录，无法回算历次体检的表型年龄。')
  const pairs = pairsFor(card, context.records)
  const missing = pairs.filter((pair) => !pair.indicator).map((pair) => pair.spec.label_zh)
  if (missing.length > 0) return empty('missing_inputs', `记录里还缺${missing.join('、')}，凑齐九项血检才能算表型年龄。`, missing)
  const ageNow = context.records.profile.age
  if (ageNow == null) return empty('no_age', '档案里还没有实足年龄。保存年龄后才能回算表型年龄。')

  const names = pairs.map((pair) => pair.indicator?.name as string)
  const read = await loadSeries(context.config, names, { start: addDays(context.today, -LOOKBACK_DAYS), end: context.today, resolution: 'raw' })
  if (read.error && Object.keys(read.series).length === 0) return empty('error', `读取历次血检失败：${read.error}`)
  const byDate = new Map<string, Map<string, SeriesPoint>>()
  for (const pair of pairs) {
    for (const point of read.series[pair.indicator?.name as string]?.points ?? []) {
      const day = byDate.get(point.date) ?? new Map<string, SeriesPoint>()
      day.set(pair.spec.key, point)
      byDate.set(point.date, day)
    }
  }
  // Only dates where all nine were measured the same day; a missing marker is never carried over from another date.
  const checkups = [...byDate.entries()].filter(([, day]) => pairs.every((pair) => day.has(pair.spec.key))).map(([date]) => date).sort().slice(-BIOAGE_CHECKUPS)
  if (checkups.length === 0) return empty('no_checkup', '没有一次检查同时测齐九项血检，还不能算表型年龄。')
  const done = new Set(readHistory(context.dataDir, 1000).filter((row) => row.skill === PHENOAGE_SKILL && row.measured_at).map((row) => row.measured_at as string))
  let runs = 0
  for (const date of checkups) {
    if (done.has(date)) continue
    const day = byDate.get(date) as Map<string, SeriesPoint>
    const measurements: MeasurementIn[] = pairs.map((pair) => {
      const point = day.get(pair.spec.key) as SeriesPoint
      return { key: pair.spec.key, value: point.value, unit: point.unit }
    })
    await runSkill({
      home: context.skillsHome, dataDir: context.dataDir, name: PHENOAGE_SKILL, args: [], files: [], measurements,
      profile: { age: ageOn(date, context.today, ageNow), sex: context.records.profile.sex }, useProfile: true,
      python: context.config.skillPython, runtimes: context.config.skillRuntimes, timeoutMs: context.config.skillTimeoutMs,
      revision: context.catalog.revision, measuredAt: date,
    })
    runs += 1
  }
  const points = pointsFromHistory(context.dataDir)
  const band = await bioAgeBand(context, reference, card, pairs, byDate, checkups.at(-1) as string, ageNow)
  return {
    status: points.length > 0 ? 'ok' : 'error',
    note_zh: points.length > 0 ? `按 ${points.length} 次同时测齐九项血检的检查回算。` : '表型年龄没有算出来，请查看技能的报告。',
    missing: [], points, band_years: band?.years ?? null, band_verified: band?.verified ?? false, band_missing: band?.missing ?? [], runs,
  }
}

function pointsFromHistory(dataDir: string): BioAgePoint[] {
  const pheno = seriesOf(dataDir, 'phenoage').filter((row) => row.measured_at)
  const advance = new Map(seriesOf(dataDir, 'phenoage_advance').filter((row) => row.measured_at).map((row) => [row.measured_at, row.value]))
  const mortality = new Map(seriesOf(dataDir, 'mortality_10y_pct').filter((row) => row.measured_at).map((row) => [row.measured_at, row.value]))
  return pheno.map((row) => ({
    date: row.measured_at as string,
    phenoage: Number(row.value),
    advance: advance.has(row.measured_at) ? Number(advance.get(row.measured_at)) : null,
    mortality_10y_pct: mortality.has(row.measured_at) ? Number(mortality.get(row.measured_at)) : null,
  })).filter((row) => Number.isFinite(row.phenoage)).slice(-BIOAGE_CHECKUPS)
}

async function leversAt(
  context: TrackingContext,
  card: SkillCard,
  measurements: MeasurementIn[],
  age: number,
  targets: MeasurementIn[],
  date: string,
  extraArgs: string[] = [],
): Promise<Levers | null> {
  return (await runModel(context, card, measurements, age, targets, date, extraArgs))?.levers ?? null
}

interface ModelRun {
  levers: Levers | null
  outputs: Record<string, { value: number | string | null }>
  error: string
}

const runMemo = new Map<string, ModelRun>()

async function runModel(
  context: TrackingContext,
  card: SkillCard,
  measurements: MeasurementIn[],
  age: number,
  targets: MeasurementIn[],
  date: string,
  extraArgs: string[],
): Promise<ModelRun> {
  const key = JSON.stringify([card.name, context.catalog.revision, date, measurements, age, targets, extraArgs, context.records.profile.sex])
  const hit = runMemo.get(key)
  if (hit) return hit
  const files: Array<{ name: string; text: string }> = []
  const args: string[] = [...extraArgs]
  const flag = card.entry?.targets_flag
  if (flag && targets.length > 0) {
    const staged = stageMeasurements(card, targets)
    files.push({ name: 'targets.csv', text: staged.csv })
    args.push(flag, 'targets.csv')
  }
  const result = await runSkill({
    home: context.skillsHome, dataDir: context.dataDir, name: card.name, args, files, measurements,
    profile: { age, sex: context.records.profile.sex }, useProfile: true,
    python: context.config.skillPython, runtimes: context.config.skillRuntimes, timeoutMs: context.config.skillTimeoutMs,
    revision: context.catalog.revision, measuredAt: date,
  })
  const run: ModelRun = {
    levers: result.ok ? result.levers ?? null : null,
    outputs: result.outputs ?? {},
    error: result.ok ? '' : (result.error || result.error_kind || '').slice(0, 300),
  }
  if (result.ok) runMemo.set(key, run)
  if (runMemo.size > 50) runMemo.delete(runMemo.keys().next().value as string)
  return run
}

function latestMeasurements(pairs: ReturnType<typeof pairsFor>, byDate: Map<string, Map<string, SeriesPoint>>, date: string): MeasurementIn[] {
  const day = byDate.get(date) as Map<string, SeriesPoint>
  return pairs.map((pair) => {
    const point = day.get(pair.spec.key) as SeriesPoint
    return { key: pair.spec.key, value: point.value, unit: point.unit }
  })
}

/** Years of phenotypic age that within-person variation of the nine inputs could move, from the skill's own slopes. */
async function bioAgeBand(
  context: TrackingContext,
  reference: Reference,
  card: SkillCard,
  pairs: ReturnType<typeof pairsFor>,
  byDate: Map<string, Map<string, SeriesPoint>>,
  date: string,
  ageNow: number,
): Promise<{ years: number; verified: boolean; missing: string[] } | null> {
  const levers = await leversAt(context, card, latestMeasurements(pairs, byDate, date), ageOn(date, context.today, ageNow), [], date)
  if (!levers) return null
  let variance = 0
  let verified = true
  const missing: string[] = []
  for (const row of levers.sensitivity) {
    const pair = pairs.find((item) => item.spec.key === row.key)
    const marker = pair?.indicator ? markerFor(reference.biovar, pair.indicator) : null
    if (!marker || row.years_per_unit == null) {
      missing.push(row.label_zh)
      continue
    }
    verified &&= marker.verified
    const cvi = marker.cvi_pct / 100
    const cva = (marker.cva_pct ?? marker.cvi_pct / 2) / 100
    const relative = marker.log_normal
      ? Math.sqrt(Math.log(1 + cvi * cvi) + Math.log(1 + cva * cva))
      : Math.sqrt(cvi * cvi + cva * cva)
    variance += (row.years_per_unit * row.value * relative) ** 2
  }
  if (missing.length === levers.sensitivity.length) return null
  return { years: Math.SQRT2 * reference.biovar.z * Math.sqrt(variance), verified, missing }
}

// --- models of the goals -------------------------------------------------------

function goalTargets(card: SkillCard, goals: PlanVersion['goals'], reference: Reference): MeasurementIn[] {
  const index = aliasIndex(measurementInputs(card))
  const out: MeasurementIn[] = []
  for (const goal of goals) {
    let hit = resolveInput(index, goal.marker)
    if (!hit) {
      const marker = reference.biovar.markers.find((row) => row.key === goal.marker) ?? markerFor(reference.biovar, { name: goal.marker, label: goal.marker })
      const spec = marker ? measurementInputs(card).find((item) => (item.loinc ?? []).some((code) => marker.loinc.includes(code))) : undefined
      if (spec) hit = { spec, byKey: true }
    }
    if (hit) out.push({ key: hit.spec.key, value: goal.value, unit: goal.unit })
  }
  return out
}

function numberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function fmt(value: number): string {
  return Number.isInteger(value) ? String(value) : String(Number(value.toPrecision(3)))
}

async function modelCards(context: TrackingContext, reference: Reference, goals: PlanVersion['goals']): Promise<ModelCard[]> {
  const cards: ModelCard[] = []
  const pheno = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL)
  const boundary = '模型估计，基于人群数据拟合，不是对你个人的预测，也不是寿命预测。'
  if (pheno && pheno.entry?.levers_json && context.records.record_status === 'ok' && context.records.profile.age != null) {
    const pairs = pairsFor(pheno, context.records)
    if (pairs.every((pair) => pair.indicator)) {
      const names = pairs.map((pair) => pair.indicator?.name as string)
      const read = await loadSeries(context.config, names, { start: addDays(context.today, -LOOKBACK_DAYS), end: context.today, resolution: 'raw' })
      const byDate = new Map<string, Map<string, SeriesPoint>>()
      for (const pair of pairs) {
        for (const point of read.series[pair.indicator?.name as string]?.points ?? []) {
          const day = byDate.get(point.date) ?? new Map<string, SeriesPoint>()
          day.set(pair.spec.key, point)
          byDate.set(point.date, day)
        }
      }
      const date = [...byDate.entries()].filter(([, day]) => pairs.every((pair) => day.has(pair.spec.key))).map(([day]) => day).sort().at(-1)
      if (date) {
        const targets = goalTargets(pheno, goals, reference)
        const age = ageOn(date, context.today, context.records.profile.age)
        const current = latestMeasurements(pairs, byDate, date)
        const levers = await leversAt(context, pheno, current, age, targets, date)
        // Show each lever in the units of the person's own report and goal, not the method's.
        const inTheirUnits = (key: string, fallback: { from: string; to: string }) => {
          const now = current.find((row) => row.key === key)
          const goal = targets.find((row) => row.key === key)
          return now && goal ? { from: `${fmt(Number(now.value))} ${now.unit}`.trim(), to: `${fmt(Number(goal.value))} ${goal.unit}`.trim() } : fallback
        }
        if (levers) {
          const target = levers.targets as { phenoage?: number; phenoage_delta?: number; mortality_10y_pct?: number } | undefined
          const sensitivity = levers.sensitivity.map((row) => {
            const pair = pairs.find((item) => item.spec.key === row.key)
            const marker = pair?.indicator ? markerFor(reference.biovar, pair.indicator) : null
            const relative = marker ? marker.cvi_pct / 100 : 0.1
            const stepValue = row.value * relative
            return { label: row.label_zh, unit: row.unit, years_per_step: (row.years_per_unit ?? 0) * stepValue, step: `${fmt(stepValue)} ${row.unit}` }
          }).filter((row) => Number.isFinite(row.years_per_step)).sort((a, b) => Math.abs(b.years_per_step) - Math.abs(a.years_per_step)).slice(0, 5)
          cards.push({
            model: 'phenoage',
            title_zh: '表型年龄',
            status: target ? 'ok' : 'no_goal',
            note_zh: target
              ? `按 ${date} 的血检，达到方案目标时表型年龄 ${target.phenoage_delta != null && target.phenoage_delta <= 0 ? '年轻' : '变化'} ${fmt(Math.abs(target.phenoage_delta ?? 0))} 岁。`
              : '方案里还没有和九项血检对应的目标值。设定目标（如空腹血糖、超敏 CRP）后，这里会算出达到目标时的表型年龄。',
            measured_on: date,
            now: { phenoage: numberOrNull(levers.current.phenoage), mortality_10y_pct: numberOrNull(levers.current.mortality_10y_pct), age },
            goal: target ? { phenoage: target.phenoage ?? null, mortality_10y_pct: target.mortality_10y_pct ?? null, phenoage_delta: target.phenoage_delta ?? null } : null,
            levers: levers.levers.map((row) => ({
              label: row.label_zh,
              ...inTheirUnits(row.key, { from: `${fmt(row.from)} ${row.unit}`, to: `${fmt(row.to)} ${row.unit}` }),
              years: row.phenoage_delta ?? 0,
            })),
            sensitivity,
            boundary_zh: boundary,
          })
        }
      }
    }
  }
  const risk = context.catalog.cards.find((item) => item.name === RISK_SKILL)
  cards.push(await riskCard(context, reference, risk, goals))
  return cards
}

const RISK_FLAGS: Array<{ fact: RiskFact; flag: string; men_only?: boolean }> = [
  { fact: 'bp_treated', flag: '--treated' },
  { fact: 'smoker', flag: '--smoker' },
  { fact: 'diabetes', flag: '--diabetes' },
  { fact: 'north', flag: '--north' },
  { fact: 'urban', flag: '--urban', men_only: true },
  { fact: 'family_history', flag: '--family-history', men_only: true },
]

/** The home-cuff reading a risk equation should see: the mean of the last week of readings, not one reading. */
async function weeklyBloodPressure(context: TrackingContext, indicator: string): Promise<{ value: number; unit: string } | null> {
  const read = await loadSeries(context.config, [indicator], { start: addDays(context.today, -30), end: context.today, resolution: 'raw' })
  const points = read.series[indicator]?.points ?? []
  const last = points.at(-1)
  if (!last) return null
  const week = points.filter((point) => point.date >= addDays(last.date, -6))
  return { value: Math.round((week.reduce((sum, point) => sum + point.value, 0) / week.length) * 10) / 10, unit: last.unit }
}

async function riskCard(context: TrackingContext, reference: Reference, card: SkillCard | undefined, goals: PlanVersion['goals']): Promise<ModelCard> {
  const base: ModelCard = {
    model: 'china-par', title_zh: '10 年动脉粥样硬化性心血管病风险（China-PAR）', status: 'unavailable', note_zh: '', measured_on: null,
    now: {}, goal: null, missing: [], missing_labs: [], missing_facts: [], levers: [], sensitivity: [],
    boundary_zh: '模型估计：China-PAR 按中国成人队列建立，给出的是和你条件相同的人群平均风险，不是诊断，也不决定是否用药。',
  }
  if (!card || !card.script) {
    base.note_zh = '方法库里没有 China-PAR 方法，请更新 longevity-skills。'
    return base
  }
  if (card.inputsStatus !== 'verified') {
    base.note_zh = '风险模型还没有通过系数校验，暂不显示数值。'
    return base
  }
  const profile = context.records.profile
  const missingFacts: string[] = []
  if (profile.age == null) missingFacts.push('实足年龄')
  if (profile.sex !== 'male' && profile.sex !== 'female') missingFacts.push('性别')
  const args: string[] = []
  for (const item of RISK_FLAGS) {
    if (item.men_only && profile.sex !== 'male') continue
    const value = profile.risk?.[item.fact]
    if (value == null) missingFacts.push(RISK_FACT_ZH[item.fact])
    else args.push(item.flag, value ? 'yes' : 'no')
  }
  // Labs are listed even without a record, so the person knows what a checkup (or a tape measure) must supply.
  const found: Array<{ key: string; row: NonNullable<ReturnType<typeof indicatorFor>> }> = []
  const missingLabs: string[] = []
  for (const spec of measurementInputs(card)) {
    const row = indicatorFor(spec, context.records.indicators)
    if (row) found.push({ key: spec.key, row })
    else if (spec.required) missingLabs.push(spec.label_zh)
  }
  base.missing_labs = missingLabs
  base.missing_facts = missingFacts
  base.missing = [...missingLabs, ...missingFacts]
  const factsHint = missingFacts.length > 0 ? `档案里还缺${missingFacts.join('、')}（在健康页填写，或在对话里告诉我）。` : ''
  if (context.records.record_status !== 'ok') {
    const labsHint = missingLabs.length > 0 ? `，计算还需要${missingLabs.join('、')}` : ''
    base.note_zh = `还没有连接 Mirobody 体检记录${labsHint}。${factsHint}`
    return base
  }
  if (missingLabs.length > 0 || missingFacts.length > 0) {
    base.note_zh = `${missingLabs.length > 0 ? `记录里还缺${missingLabs.join('、')}。` : ''}${factsHint}`
    return base
  }
  const measurements: MeasurementIn[] = []
  let measuredOn = ''
  for (const { key, row } of found) {
    if (key === 'sbp_mmhg' && !row.loinc) {
      const week = await weeklyBloodPressure(context, row.name)
      if (week) {
        measurements.push({ key, value: week.value, unit: week.unit })
        continue
      }
    }
    measurements.push({ key, value: row.value, unit: row.unit })
    if (row.date && row.date > measuredOn) measuredOn = row.date
  }
  const targets = goalTargets(card, goals, reference)
  const run = await runModel(context, card, measurements, profile.age as number, targets, context.today, args)
  if (!run.levers) {
    base.note_zh = run.error ? `风险模型没有算出结果：${run.error}` : '风险模型没有算出结果，请在对话里运行它查看原因。'
    return base
  }
  const target = run.levers.targets as { risk_pct?: number; risk_delta_pct?: number; category?: string } | undefined
  const category = typeof run.levers.current.category === 'string' ? run.levers.current.category
    : typeof run.outputs.risk_category?.value === 'string' ? run.outputs.risk_category.value : ''
  const inTheirUnits = (key: string, fallback: { from: string; to: string }) => {
    const now = measurements.find((row) => row.key === key)
    const goal = targets.find((row) => row.key === key)
    return now && goal ? { from: `${fmt(Number(now.value))} ${now.unit}`.trim(), to: `${fmt(Number(goal.value))} ${goal.unit}`.trim() } : fallback
  }
  return {
    ...base,
    status: target ? 'ok' : 'no_goal',
    note_zh: target
      ? '达到方案目标时的 10 年风险按同一模型计算。'
      : '方案里还没有血压、总胆固醇、HDL-C 或腰围的目标。设定后，这里会算出达到目标时的风险。',
    measured_on: measuredOn || context.today,
    now: { risk_pct: numberOrNull(run.levers.current.risk_pct) },
    goal: target ? { risk_pct: target.risk_pct ?? null, risk_delta_pct: target.risk_delta_pct ?? null } : null,
    category_zh: { now: category, goal: target?.category ?? null },
    levers: run.levers.levers.map((row) => ({
      label: row.label_zh,
      ...inTheirUnits(row.key, { from: `${fmt(row.from)} ${row.unit}`, to: `${fmt(row.to)} ${row.unit}` }),
      years: row.risk_delta_pct ?? 0,
    })),
  }
}

/** Model cards for goal values named in conversation, without saving them to the plan. */
export async function modelGoals(context: TrackingContext, goals: PlanVersion['goals']): Promise<{ models: ModelCard[]; how_to_read: string }> {
  const reference = loadReference(context.skillsHome)
  return {
    models: await modelCards(context, reference, goals),
    how_to_read: 'Model estimates at the latest complete checkup. levers[].years is the change in phenotypic age (years) or, for china-par, in 10-year risk (percentage points) from moving that one marker alone. Say 模型估计 and quote boundary_zh; never present it as a personal prediction or a lifespan.',
  }
}

export function describeItem(item: PlanItem): string {
  const parts = [`${CATEGORY_ZH[item.category]}｜${item.title}`, `${item.start} 起${item.end ? `，${item.end} 止` : ''}`]
  if (item.frequency) parts.push(`每${item.frequency.per === 'day' ? '天' : '周'} ${item.frequency.times} 次`)
  if (item.target) parts.push(`手环目标 ${item.target.metric} ${item.target.op} ${item.target.value}${item.target.unit ? ` ${item.target.unit}` : ''}`)
  if (item.markers.length > 0) parts.push(`看 ${item.markers.join('、')}`)
  if (item.mirobody) parts.push(`服用记录来自 Mirobody（${item.mirobody.medication}）`)
  return parts.join('；')
}
