// Put the plan next to the record: read the markers the plan aims at, how the
// plan was followed, what else changed, and the phenotypic age at every past
// checkup; then judge each item and model the goals. Every number comes from
// Mirobody, the person's check-ins, or a skill script. The harness computes
// no clinical formula here: phenotypic age and its levers come from the
// accelerated-biological-aging-risk skill, noise bands from data tables.

import type { Catalog, SkillCard } from './catalog.ts'
import type { Config } from './config.ts'
import { adherenceFor, evaluatePlan, resolveMarkers, suggestNext, type Adherence, type ItemSummary, type LeverHint, type ResolvedMarker, type Suggestion } from './evaluate.ts'
import { readHistory, seriesOf } from './history.ts'
import { addDays, CATEGORY_ZH, currentPlan, daysBetween, readCheckIns, readPlans, type CheckIn, type PlanItem, type PlanVersion } from './interventions.ts'
import { aliasIndex, indicatorFor, measurementInputs, resolveInput, stageMeasurements, type MeasurementIn } from './measurements.ts'
import { loadCourses, loadDoseLog, loadSeries, type CourseRow, type RecordSnapshot, type SeriesPoint } from './records.ts'
import { loadReference, markerFor, rcvBand, type Reference } from './reference.ts'
import { runSkill, type Levers } from './runner.ts'

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
const leverMemo = new Map<string, Levers | null>()

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
  const key = [context.dataDir, context.skillsHome, context.today, plan?.version ?? 0, checkins.length, context.catalog.revision].join('\u0000')
  const hit = memo.get(key)
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.value
  const value = compute(context, plan, checkins)
  memo.set(key, { at: Date.now(), value })
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
  const indicatorNames = [...new Set(resolvedList.map((row) => row.indicator).filter((name): name is string => Boolean(name)))]
  const seriesStart = addDays(earliest, -200)
  const labs = context.records.record_status === 'ok' && indicatorNames.length > 0
    ? await loadSeries(context.config, indicatorNames, { start: seriesStart, end: context.today, resolution: 'raw' })
    : { series: {}, truncated: false }
  if ('error' in labs && labs.error) errors.push(`读取检查结果：${labs.error}`)
  const series: Record<string, SeriesPoint[]> = Object.fromEntries(Object.entries(labs.series).map(([name, row]) => [name, row.points]))

  const adherence: Record<string, Adherence> = {}
  const calendarStart = addDays(context.today, -83)
  for (const item of plan.items) {
    const window = { start: item.start, end: context.today }
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
    const points = (series[marker.indicator] ?? []).map((point) => ({ date: point.date, value: point.value }))
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
): Promise<Levers | null> {
  const key = JSON.stringify([card.name, context.catalog.revision, date, measurements, age, targets])
  if (leverMemo.has(key)) return leverMemo.get(key) ?? null
  const files: Array<{ name: string; text: string }> = []
  const args: string[] = []
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
  const levers = result.ok ? result.levers ?? null : null
  leverMemo.set(key, levers)
  if (leverMemo.size > 50) leverMemo.delete(leverMemo.keys().next().value as string)
  return levers
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
        const levers = await leversAt(context, pheno, latestMeasurements(pairs, byDate, date), age, targets, date)
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
            now: { phenoage: levers.current.phenoage ?? null, mortality_10y_pct: levers.current.mortality_10y_pct ?? null, age },
            goal: target ? { phenoage: target.phenoage ?? null, mortality_10y_pct: target.mortality_10y_pct ?? null, phenoage_delta: target.phenoage_delta ?? null } : null,
            levers: levers.levers.map((row) => ({ label: row.label_zh, from: `${fmt(row.from)} ${row.unit}`, to: `${fmt(row.to)} ${row.unit}`, years: row.phenoage_delta ?? 0 })),
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

async function riskCard(context: TrackingContext, reference: Reference, card: SkillCard | undefined, goals: PlanVersion['goals']): Promise<ModelCard> {
  const base: ModelCard = {
    model: 'china-par', title_zh: '10 年动脉粥样硬化性心血管病风险（China-PAR）', status: 'unavailable', note_zh: '', measured_on: null,
    now: {}, goal: null, levers: [], sensitivity: [],
    boundary_zh: '模型估计：China-PAR 按中国成人队列建立，给出的是和你条件相同的人群平均风险，不是诊断。',
  }
  if (!card || !card.script || card.inputsStatus !== 'verified') {
    base.note_zh = '风险模型还没有通过系数校验，暂不显示数值。'
    return base
  }
  if (context.records.record_status !== 'ok' || context.records.profile.age == null) {
    base.note_zh = '需要 Mirobody 记录和档案里的实足年龄。'
    return base
  }
  const specs = measurementInputs(card)
  const measurements: MeasurementIn[] = []
  const missing: string[] = []
  for (const spec of specs) {
    const row = indicatorFor(spec, context.records.indicators)
    if (row) measurements.push({ key: spec.key, value: row.value, unit: row.unit })
    else if (spec.required) missing.push(spec.label_zh)
  }
  if (missing.length > 0) {
    base.note_zh = `还缺${missing.join('、')}。`
    return base
  }
  const targets = goalTargets(card, goals, reference)
  const levers = await leversAt(context, card, measurements, context.records.profile.age, targets, context.today)
  if (!levers) {
    base.note_zh = '风险模型没有算出结果，请在对话里运行它查看原因。'
    return base
  }
  const target = levers.targets as { risk_pct?: number; risk_delta_pct?: number } | undefined
  return {
    ...base,
    status: target ? 'ok' : 'no_goal',
    note_zh: target ? '达到方案目标时的 10 年风险按同一模型计算。' : '设定血压、血脂等目标后，这里会算出达到目标时的风险。',
    measured_on: context.today,
    now: { risk_pct: (levers.current.risk_pct as number | undefined) ?? null },
    goal: target ? { risk_pct: target.risk_pct ?? null, risk_delta_pct: target.risk_delta_pct ?? null } : null,
    levers: levers.levers.map((row) => ({ label: row.label_zh, from: `${fmt(row.from)} ${row.unit}`, to: `${fmt(row.to)} ${row.unit}`, years: row.risk_delta_pct ?? 0 })),
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
