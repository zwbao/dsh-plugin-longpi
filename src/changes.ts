// Changes in the record larger than normal fluctuation. For every checkup
// marker with a biological-variation row, the latest result is set against the
// one before it and against the first of the last six, and a change counts only
// when it is larger than the reference change value (RCV): the same, sourced
// criterion the plan verdicts use. Nothing else is invented: no reference
// ranges, no thresholds of our own. A change in the wrong direction, or in
// either direction on a marker judged by its reference range (haemoglobin,
// MCV), is one to show a doctor; a marker with no good direction (weight) is
// shown neutrally. A fall in blood glucose is not called good news: for
// someone with diabetes or on a glucose-lowering medicine it goes to a doctor
// too. This module never names a cause.

import type { Config } from './config.ts'
import { addDays } from './interventions.ts'
import { loadSeries, recordReadable, type RecordSnapshot, type SeriesPoint } from './records.ts'
import { checkupMarkerFor, loadReference, rcvBand, type BiovarMarker } from './reference.ts'
import { currentMedications, GLUCOSE_LOWERING } from './situation.ts'
import { normalizeUnit } from './units.ts'

export interface RecordChange {
  /** Biological-variation key, e.g. 'mcv'. */
  key: string
  label_zh: string
  /** The biological-variation row's unit; every point is converted to it. */
  unit: string
  points: Array<{ date: string; value: number }>
  /** pct is rounded to 1 decimal. */
  compare: { from_date: string; from: number; to_date: string; to: number; pct: number }
  /** The reference change value in percent, 1 decimal, e.g. { up: 8.4, down: -8.4 }. */
  band_pct: { up: number; down: number }
  direction: 'up' | 'down'
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  text_zh: string
  advice_zh: string
  /** The row's own caveat, when it has one. */
  caveat_zh?: string
  /** Where the within-person variation comes from (the row's cvi_source). */
  source: { title: string; url: string; doi?: string }
  verified: boolean
}

/** A marker the changes could not judge: its readings did not come back whole. Unknown, never "no change". */
export interface UnjudgedChange {
  label_zh: string
  reason_zh: string
}

export interface ChangesContext {
  config: Config
  skillsHome: string
  records: RecordSnapshot
  today: string
}

export const CHANGES_NOTE_ZH = '判断依据：两次结果之差超过同一个人正常波动与检测误差合成的参考变化值（RCV，z=1.96）才算真实变化；变异数据来自 longevity-skills 的 data/biological_variation.json，每一行注明期刊出处。不同医院、不同仪器之间的差异没有算进去；如果两次不在同一家机构，请先复查确认。这不是诊断。'
const WORSE_ZH = '建议带着这几次体检报告咨询医生，看看是否需要进一步检查。'
// A 'range' marker (haemoglobin, MCV, white cells) can be fine or not either way; only the lab's reference range tells.
const RANGE_ZH = '变化超出了正常波动；是否需要处理要结合参考范围判断，建议带着这几次体检报告咨询医生。'
const BETTER_ZH = '变化超出了正常波动，方向是好的。'
// Weight and other rows without a better direction: a real change, nothing more to say.
const NEUTRAL_ZH = '变化超出了正常波动。'
// A fall in these can go too far (low blood glucose), above all on a glucose-lowering medicine.
const GLUCOSE_KEYS = ['glucose', 'hba1c']
const GLUCOSE_FALL_ZH = '变化超出了正常波动。你有糖尿病或在用降糖药，血糖类指标明显下降也需要留意，建议带着这几次体检报告咨询医生。'
/** Checkup days kept per marker, the most recent. */
const KEEP_POINTS = 6
const MAX_CHANGES = 6
/** Far enough back for any checkup history; only the most recent days are kept. */
const LOOKBACK_DAYS = 10 * 365
/** Indicators per Mirobody read. The reads run in parallel. */
const READ_CHUNK = 6

type Point = { date: string; value: number }

/** The factor that brings a point's unit to the row's unit, from the row's own convert table; null when it cannot. The plan verdicts (evaluate.ts) use it too. */
export function factorFor(marker: BiovarMarker, unit: string): number | null {
  const given = normalizeUnit(unit)
  // A point without a unit cannot be checked against the row's unit, so it is left out.
  if (!given) return null
  if (given === normalizeUnit(marker.unit)) return 1
  for (const [name, factor] of Object.entries(marker.convert ?? {})) {
    if (normalizeUnit(name) === given) return factor
  }
  return null
}

/** One point per day (the last reading of that day), oldest first, the most recent KEEP_POINTS days. */
function dailyPoints(marker: BiovarMarker, readings: readonly SeriesPoint[]): Point[] {
  const sorted = [...readings].sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time))
  const byDay = new Map<string, number>()
  for (const point of sorted) {
    const factor = factorFor(marker, point.unit)
    if (factor == null || !Number.isFinite(point.value)) continue
    byDay.set(point.date, factor === 1 ? point.value : Number((point.value * factor).toPrecision(6)))
  }
  return [...byDay.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, value]) => ({ date, value })).slice(-KEEP_POINTS)
}

function round1(value: number): number {
  return Math.round(value * 10) / 10
}

function shown(value: number): string {
  return String(Number(value.toPrecision(4)))
}

function withUnit(value: number, unit: string): string {
  return unit === '%' ? `${shown(value)}%` : `${shown(value)} ${unit}`.trim()
}

interface Candidate {
  from: Point
  to: Point
  pct: number
  /** How far past the band, as |pct| over the band on that side. */
  ratio: number
}

function compared(from: Point, to: Point, band: { up: number; down: number }): Candidate | null {
  if (from.value === 0) return null
  const pct = ((to.value - from.value) / from.value) * 100
  if (!(pct > band.up * 100 || pct < band.down * 100)) return null
  const side = Math.abs((pct > 0 ? band.up : band.down) * 100)
  return side > 0 ? { from, to, pct, ratio: Math.abs(pct) / side } : null
}

function verdictOf(better: BiovarMarker['better'], direction: RecordChange['direction']): RecordChange['verdict'] {
  if (better === 'lower') return direction === 'down' ? 'better' : 'worse'
  if (better === 'higher') return direction === 'up' ? 'better' : 'worse'
  return 'unclear'
}

function changeOf(marker: BiovarMarker, points: Point[], z: number, glucoseTreated: boolean): (RecordChange & { ratio: number }) | null {
  if (points.length < 2) return null
  const last = points.at(-1) as Point
  const band = rcvBand(marker, z)
  const options = [compared(points.at(-2) as Point, last, band)]
  if (points.length >= 3) options.push(compared(points[0] as Point, last, band))
  const pick = options.filter((row): row is Candidate => row != null).sort((a, b) => b.ratio - a.ratio)[0]
  if (!pick) return null
  const direction = pick.pct > 0 ? 'up' : 'down'
  // Fasting glucose falling is never called good news; HbA1c falling is, unless the person is treated for diabetes.
  const glucoseFall = direction === 'down' && GLUCOSE_KEYS.includes(marker.key) && (glucoseTreated || marker.key === 'glucose')
  const verdict = glucoseFall ? 'unclear' : verdictOf(marker.better, direction)
  const askDoctor = verdict === 'worse' || (verdict === 'unclear' && marker.better === 'range') || (glucoseFall && glucoseTreated)
  const up = round1(band.up * 100)
  const down = marker.log_normal ? round1(band.down * 100) : -up
  // Log-normal rows (CRP, triglycerides) have an asymmetric band: both sides are shown.
  const bandText = marker.log_normal ? `${down.toFixed(1)}% 至 +${up.toFixed(1)}%` : `±${up.toFixed(1)}%`
  return {
    key: marker.key,
    label_zh: marker.label_zh,
    unit: marker.unit,
    points,
    compare: { from_date: pick.from.date, from: pick.from.value, to_date: pick.to.date, to: pick.to.value, pct: round1(pick.pct) },
    band_pct: { up, down },
    direction,
    verdict,
    ask_doctor: askDoctor,
    text_zh: `${marker.label_zh} ${marker.unit === '%' ? `${shown(pick.from.value)}%` : shown(pick.from.value)} → ${withUnit(pick.to.value, marker.unit)}（${pick.from.date} → ${pick.to.date}），${direction === 'down' ? '下降' : '上升'} ${Math.abs(pick.pct).toFixed(1)}%，超出正常波动（${bandText}）`,
    advice_zh: verdict === 'worse' ? WORSE_ZH : verdict === 'better' ? BETTER_ZH : glucoseFall && askDoctor ? GLUCOSE_FALL_ZH : askDoctor ? RANGE_ZH : NEUTRAL_ZH,
    ...(marker.caveat_zh ? { caveat_zh: marker.caveat_zh } : {}),
    source: { title: marker.cvi_source.title, url: marker.cvi_source.url, ...(marker.cvi_source.doi ? { doi: marker.cvi_source.doi } : {}) },
    verified: marker.verified,
    ratio: pick.ratio,
  }
}

/**
 * Changes between checkups larger than the reference change value, ask_doctor
 * first, then the furthest past its band; at most six. Checkup rows only
 * (Mirobody rows with a LOINC code): wearable series and the person's own
 * measurements are left out. An unread record gives no changes. A marker whose
 * readings failed to read, or came back cut, is not judged at all: it is listed
 * in unjudged with the reason, so a failed read never reads as "no change".
 */
export async function buildChanges(context: ChangesContext): Promise<{ changes: RecordChange[]; note_zh: string; unjudged: UnjudgedChange[] }> {
  const empty = { changes: [], note_zh: CHANGES_NOTE_ZH, unjudged: [] }
  if (!recordReadable(context.records)) return empty
  const { biovar } = loadReference(context.skillsHome)
  // Rows measuring the same thing under different codes (two glucose LOINCs) are one marker.
  const byKey = new Map<string, { marker: BiovarMarker; names: string[] }>()
  for (const row of context.records.indicators) {
    if (row.source === 'self' || !row.loinc) continue
    // By LOINC: a name alone would pool urine creatinine or urine glucose into the blood marker.
    const marker = checkupMarkerFor(biovar, row)
    // A marker compared on multi-day means (home blood pressure) has no band for a single reading.
    if (!marker || marker.average_days) continue
    const entry = byKey.get(marker.key) ?? { marker, names: [] }
    if (!entry.names.includes(row.name)) entry.names.push(row.name)
    byKey.set(marker.key, entry)
  }
  const names = [...new Set([...byKey.values()].flatMap((entry) => entry.names))]
  if (names.length === 0) return empty
  const window = { start: addDays(context.today, -LOOKBACK_DAYS), end: context.today, resolution: 'raw' as const }
  const chunks: string[][] = []
  for (let start = 0; start < names.length; start += READ_CHUNK) chunks.push(names.slice(start, start + READ_CHUNK))
  const reads = await Promise.all(chunks.map((chunk) => loadSeries(context.config, chunk, window)))
  const series: Record<string, SeriesPoint[]> = {}
  const failed = new Map<string, string>()
  const cut = new Set<string>()
  for (const read of reads) {
    for (const [name, row] of Object.entries(read.series)) series[name] = row.points
    for (const name of read.failed) failed.set(name, read.error ?? '')
    for (const name of read.cut) cut.add(name)
  }
  const { profile, medications } = context.records
  const glucoseTreated = profile.risk.diabetes === true || currentMedications(medications).some((name) => GLUCOSE_LOWERING.test(name))
  const found: Array<RecordChange & { ratio: number }> = []
  const unjudged: UnjudgedChange[] = []
  for (const { marker, names: rows } of byKey.values()) {
    const broken = rows.find((name) => failed.has(name))
    if (broken != null) {
      const error = failed.get(broken)
      unjudged.push({ label_zh: marker.label_zh, reason_zh: `历次结果读取失败${error ? `：${error}` : ''}，这次没有判断它的变化。` })
      continue
    }
    if (rows.some((name) => cut.has(name))) {
      unjudged.push({ label_zh: marker.label_zh, reason_zh: '历次结果太多，读取时被截断，没有读全，这次没有判断它的变化。' })
      continue
    }
    const change = changeOf(marker, dailyPoints(marker, rows.flatMap((name) => series[name] ?? [])), biovar.z, glucoseTreated)
    if (change) found.push(change)
  }
  found.sort((a, b) => Number(b.ask_doctor) - Number(a.ask_doctor) || b.ratio - a.ratio)
  return { changes: found.slice(0, MAX_CHANGES).map(({ ratio: _ratio, ...row }) => row), note_zh: CHANGES_NOTE_ZH, unjudged }
}
