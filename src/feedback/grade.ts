// Evidence grades and the words that go with them. Numbers and grades are fixed here;
// a model may only rephrase a headline that already passed these rules.
// 'younger' is never granted for a first draw, for a move inside the noise band,
// or for anything that is not body age.

import type { IsoDay, NumberRef } from '../contracts/common.ts'
import { youngerAllowed, type Claim, type EvidenceGrade, type FeedbackMessage } from '../contracts/feedback.ts'
import { daysBetween, retestAdvice, retestDates, type RetestAdvice } from './retest-timing.ts'

export type MarkerVerdict = 'working' | 'within noise' | 'wrong way' | 'cannot tell'

export interface LabMarkerInput {
  key: string
  label_zh: string
  unit: string
  from: number | null
  to: number | null
  from_date: string | null
  to_date: string | null
  /** Signed percent, e.g. -28.3 means down 28.3%. */
  delta_pct: number | null
  band_down_pct: number | null
  band_up_pct: number | null
  band_verified: boolean
  better: 'lower' | 'higher' | 'range' | 'none' | null
  verdict: MarkerVerdict | null
  blocked_by: string | null
  ask_doctor?: boolean
  confounders?: string[]
  same_lab?: boolean | null
  /** Days already waited, when the plan clock differs from the gap between draws. */
  waited_days?: number | null
}

export interface BioAgeInput {
  points: Array<{ date: string; phenoage: number; advance: number | null }>
  band_years: number | null
  band_verified: boolean
  age: number | null
  phenoage: number | null
  advance: number | null
  date: string | null
  /** How many complete draws exist, when the series itself was not loaded. */
  draws: number
  same_lab: boolean | null
}

export interface BehaviourInput {
  key: string
  title_zh: string
  date: string
}

export interface ProjectionInput {
  label_zh: string
  from_zh?: string
  target_zh: string
  years: number | null
}

export interface FeedbackInput {
  today: string
  markers: LabMarkerInput[]
  bioage: BioAgeInput | null
  behaviours: BehaviourInput[]
  projections: ProjectionInput[]
}

const DEATH_RISK = /10\s*年死亡风险/
const BARE = /^无法判断[。.!！]?$/

export function mentionsDeathRisk(text: string): boolean {
  return DEATH_RISK.test(text)
}

/** A positive "you got younger" claim. A sentence that says we cannot call it that does not count. */
export function announcesYounger(text: string): boolean {
  return text.split(/[。！？]/).some((sentence) =>
    /你确实年轻了|比实足年龄年轻|你变年轻了|年轻了\s*\d/.test(sentence) && !/不能|不是|先不|不要|别/.test(sentence))
}

export function showNum(value: number): string {
  if (!Number.isFinite(value)) return '—'
  const abs = Math.abs(value)
  const digits = abs >= 100 ? 0 : abs >= 10 ? 1 : 2
  return String(Number(value.toFixed(digits)))
}

export function showYears(value: number): string {
  if (!Number.isFinite(value)) return '—'
  return String(Math.round(value * 10) / 10)
}

export function projectionSentence(label: string, target: string, years: number | null, from?: string | null): string {
  const targetNum = Number.parseFloat(target)
  const fromNum = from == null ? Number.NaN : Number.parseFloat(from)
  const verb = Number.isFinite(targetNum) && Number.isFinite(fromNum) && targetNum < fromNum ? '降到' : '到'
  const yearsText = years == null || !Number.isFinite(years)
    ? ''
    : years < -0.05
      ? `，身体年龄约年轻 ${showYears(-years)} 岁`
      : years > 0.05
        ? `，身体年龄约增加 ${showYears(years)} 岁`
        : '，身体年龄几乎不动'
  return `模型估计：${label}${verb} ${target}${yearsText}。`
}

function refOf(key: string, label: string, value: number, unit: string, date: string | null, source: NumberRef['source']): NumberRef {
  const text = unit === '%' ? `${showNum(value)}%` : unit === '岁' ? `${showNum(value)} 岁` : `${showNum(value)} ${unit}`.trim()
  return { key, label_zh: label, value, unit, date, source, text }
}

function slug(prefix: string, key: string): string {
  const clean = key.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'x'
  const id = `${prefix}-${clean}`
  return id.length >= 6 ? id.slice(0, 64) : `${prefix}-item-${clean}`.slice(0, 64)
}

function listZh(names: string[], max = 4): string {
  const shown = names.filter(Boolean).slice(0, max)
  if (shown.length === 0) return ''
  const more = names.length > shown.length ? '等' : ''
  if (shown.length === 1) return `${shown[0]}${more}`
  if (shown.length === 2) return `${shown[0]}和${shown[1]}${more}`
  return `${shown.slice(0, -1).join('、')}和${shown[shown.length - 1]}${more}`
}

/** Direction the literature gives a common marker, when the plan row does not. */
export function knownBetter(key: string, label: string): LabMarkerInput['better'] {
  const text = `${key} ${label}`.toLowerCase()
  if (/hdl|高密度/.test(text) && !/非高密度|non-?hdl/.test(text)) return 'higher'
  if (/体重|腰围|bmi|\bweight\b/.test(text)) return 'none'
  if (/ldl|低密度|总胆固醇|甘油三酯|空腹血糖|血糖|糖化|hba1c|crp|反应蛋白|收缩压|舒张压|\btc\b|\btg\b|\bsbp\b|\bdbp\b|glucose/.test(text)) return 'lower'
  return null
}

function towardBetter(better: LabMarkerInput['better'], deltaPct: number | null): 'improving' | 'worse' | 'flat' {
  if (deltaPct == null || !Number.isFinite(deltaPct) || Math.abs(deltaPct) < 0.05) return 'flat'
  if (better === 'lower') return deltaPct < 0 ? 'improving' : 'worse'
  if (better === 'higher') return deltaPct > 0 ? 'improving' : 'worse'
  return 'flat'
}

function isBeyond(marker: LabMarkerInput): boolean {
  if (marker.delta_pct == null || marker.band_down_pct == null || marker.band_up_pct == null) return false
  return marker.delta_pct > marker.band_up_pct || marker.delta_pct < marker.band_down_pct
}

function waitedOf(marker: LabMarkerInput): number | null {
  if (marker.waited_days != null && Number.isFinite(marker.waited_days)) return marker.waited_days
  if (marker.from_date && marker.to_date) return daysBetween(marker.from_date, marker.to_date)
  return null
}

export function classifyMarker(marker: LabMarkerInput): EvidenceGrade {
  const blocked = marker.blocked_by ?? ''
  if (/too soon|太早|还不到/.test(blocked)) return 'too_early'
  if (/home mean|one office|诊室|家庭血压/.test(blocked)) return 'not_judgeable'
  if (/no direction|没有方向|没有单一/.test(blocked)) return 'not_judgeable'
  if (/not comparable|无法换算|不同实验室|不可比/.test(blocked)) return 'not_comparable'
  if (/glucose fall/.test(blocked)) return 'not_judgeable'
  if (marker.verdict === 'working') return 'beyond_band_better'
  if (marker.verdict === 'wrong way') return 'beyond_band_worse'
  if (marker.verdict === 'within noise') return withinGrade(marker)
  if (marker.verdict === 'cannot tell') {
    if (/beyond band|超出/.test(blocked) && !/within noise|正常波动/.test(blocked)) {
      return towardBetter(marker.better, marker.delta_pct) === 'worse' ? 'beyond_band_worse' : 'beyond_band_better'
    }
    if (/within noise|正常波动|adherence|执行/.test(blocked) || !isBeyond(marker)) return withinGrade(marker)
    return 'not_judgeable'
  }
  const advice = retestAdvice(marker.key)
  const waited = waitedOf(marker)
  if (waited != null && waited < advice.minDays && marker.from != null && marker.to != null) return 'too_early'
  if (marker.same_lab === false) return 'not_comparable'
  if (marker.better === 'none' && isBeyond(marker)) return 'not_judgeable'
  if (isBeyond(marker)) return towardBetter(marker.better, marker.delta_pct) === 'worse' ? 'beyond_band_worse' : 'beyond_band_better'
  if (marker.from == null || marker.to == null) return 'not_judgeable'
  return withinGrade(marker)
}

function withinGrade(marker: LabMarkerInput): EvidenceGrade {
  const way = towardBetter(marker.better, marker.delta_pct)
  if (way === 'improving') return 'within_band_improving'
  if (way === 'worse') return 'within_band_worse'
  return 'within_band_flat'
}

function movePhrase(marker: LabMarkerInput): string {
  if (marker.from == null || marker.to == null) return marker.label_zh
  const from = refOf(`${marker.key}@from`, marker.label_zh, marker.from, marker.unit, marker.from_date, 'record')
  const to = refOf(`${marker.key}@to`, marker.label_zh, marker.to, marker.unit, marker.to_date, 'record')
  const verb = marker.to < marker.from ? '降到' : marker.to > marker.from ? '升到' : '仍是'
  return `${marker.label_zh}从 ${from.text} ${verb} ${to.text}`
}

function claimsFor(grade: EvidenceGrade, kind: FeedbackMessage['subject']['kind'], askDoctor: boolean): Claim[] {
  if (grade === 'behaviour_done') return ['affirm']
  if (grade === 'projection') return ['target']
  if (grade === 'first_draw') return ['progress_story', 'retest_when']
  if (grade === 'too_early' || grade === 'not_comparable' || grade === 'not_judgeable') return ['retest_when', 'progress_story']
  if (grade === 'beyond_band_worse') return askDoctor ? ['see_doctor', 'retest_when'] : ['see_doctor', 'retest_when']
  if (grade === 'beyond_band_better') {
    const claims: Claim[] = ['celebrate', 'improved', 'retest_when']
    if (askDoctor) return ['see_doctor', 'improved', 'retest_when']
    if (kind === 'bioage') claims.push('younger')
    return claims
  }
  return ['progress_story', 'retest_when']
}

function toneFor(grade: EvidenceGrade, askDoctor: boolean): FeedbackMessage['tone'] {
  if (askDoctor || grade === 'beyond_band_worse') return 'care'
  if (grade === 'beyond_band_better' || grade === 'behaviour_done') return 'celebrate'
  if (grade === 'within_band_improving' || grade === 'projection') return 'encourage'
  return 'neutral'
}

function numbersOf(marker: LabMarkerInput): NumberRef[] {
  const out: NumberRef[] = []
  if (marker.from != null) out.push(refOf(`${marker.key}@${marker.from_date ?? 'base'}`, marker.label_zh, marker.from, marker.unit, marker.from_date, 'record'))
  if (marker.to != null) out.push(refOf(`${marker.key}@${marker.to_date ?? 'now'}`, marker.label_zh, marker.to, marker.unit, marker.to_date, 'record'))
  if (marker.delta_pct != null) out.push(refOf(`${marker.key}.delta_pct`, `${marker.label_zh}变化`, marker.delta_pct, '%', marker.to_date, 'derived'))
  return out
}

function deltaOf(marker: LabMarkerInput, advice: RetestAdvice): FeedbackMessage['delta'] {
  const interval = waitedOf(marker) ?? 0
  return {
    value: marker.delta_pct ?? 0,
    unit: '%',
    band: marker.band_down_pct != null && marker.band_up_pct != null ? [marker.band_down_pct, marker.band_up_pct] : null,
    band_verified: marker.band_verified,
    interval_days: interval,
    min_interval_days: advice.minDays,
    same_lab: marker.same_lab ?? null,
  }
}

function caveat(marker: LabMarkerInput, grade: EvidenceGrade): string {
  const blocked = marker.blocked_by ?? ''
  const parts: string[] = []
  if (/adherence|执行/.test(blocked)) {
    parts.push(grade === 'beyond_band_better' || grade === 'beyond_band_worse'
      ? '执行记录还不够，这次不能把变化算成方案的效果。'
      : '执行记录还不够，这次不评价方案本身。')
  }
  if (marker.confounders && marker.confounders.length > 0) {
    parts.push(`同期还有其他变化（${marker.confounders.slice(0, 2).join('；')}），不能把变化算成某一项单独的效果。`)
  }
  if (marker.ask_doctor) parts.push('这项要先给医生看，不要自己当成进步。')
  return parts.join('')
}

function schedule(marker: LabMarkerInput, advice: RetestAdvice, today: string, grade: EvidenceGrade): FeedbackMessage['retest'] {
  const waited = waitedOf(marker)
  const comparable = grade === 'within_band_improving' || grade === 'within_band_flat' || grade === 'within_band_worse' || grade === 'beyond_band_better' || grade === 'beyond_band_worse'
  const anchor = comparable ? marker.to_date ?? today : today
  // A draw that already happened is the retest. Too-early stays a wait, and the window is not walked forward to today.
  const completed = comparable ? marker.to_date ?? null : null
  const dates = retestDates(today, advice, grade === 'too_early' ? waited : (waited != null && waited >= advice.minDays ? advice.minDays : waited), anchor, completed)
  return { earliest: dates.earliest, recommended: dates.recommended, why_zh: dates.why_zh }
}

export function gradeMarker(marker: LabMarkerInput, today: string): FeedbackMessage {
  const grade = classifyMarker(marker)
  const advice = retestAdvice(marker.key)
  const ask = marker.ask_doctor === true
  const extra = caveat(marker, grade)
  let headline = ''
  let body = ''
  if (/home mean|one office|诊室/.test(marker.blocked_by ?? '')) {
    headline = `${marker.label_zh}只有一次诊室读数，还不能比较。请连续 7 天在家测量后再看方向。`
    body = '一次诊室血压落在波动里或外面，都不能下结论。'
  } else if (/no direction|没有方向/.test(marker.blocked_by ?? '')) {
    headline = marker.from != null && marker.to != null
      ? `${movePhrase(marker)}，变化${isBeyond(marker) ? '超出了波动' : '还不大'}，但${marker.label_zh}没有单一的好坏方向，所以先不说变好或变差。`
      : `${marker.label_zh}没有单一的好坏方向，所以先不说变好或变差。`
  } else if (/glucose fall/.test(marker.blocked_by ?? '')) {
    headline = `${movePhrase(marker)}。血糖下降不一定是好事，先对照参考范围，不把它说成进步。`
  } else if (grade === 'too_early') {
    const dates = schedule(marker, advice, today, grade)
    headline = `${marker.label_zh}还不到能下结论的时间。${advice.why_zh}最早 ${dates?.earliest} 再测。`
    body = '这次先不下结论。'
  } else if (grade === 'not_comparable') {
    headline = `${marker.label_zh}这两次不能直接比（单位或实验室对不上）。先复查一次再下结论。`
  } else if (grade === 'beyond_band_better') {
    headline = `${movePhrase(marker)}，超出了测量波动，是真实的变化。`
    body = extra
  } else if (grade === 'beyond_band_worse') {
    headline = `${movePhrase(marker)}，超出了测量波动，方向不好。建议复查，并和医生讨论。`
    body = extra
  } else if (grade === 'within_band_improving') {
    const dates = schedule(marker, advice, today, grade)
    headline = `${movePhrase(marker)}，方向是对的，但还在测量波动里。${dates?.why_zh ?? ''}最早 ${dates?.earliest} 再测，才能确定是不是真实变化。`
    body = extra
  } else if (grade === 'within_band_worse') {
    const dates = schedule(marker, advice, today, grade)
    headline = `${movePhrase(marker)}，在波动里略偏反方向，还没有超出测量波动。先不下结论。${dates?.why_zh ?? ''}`
    body = extra
  } else if (grade === 'within_band_flat') {
    const dates = schedule(marker, advice, today, grade)
    headline = `${marker.label_zh}几乎没动，还在测量波动里。${dates?.why_zh ?? ''}最早 ${dates?.earliest} 再测。`
    body = extra
  } else {
    headline = marker.from == null
      ? `${marker.label_zh}还没有可以对比的基线。补上一次结果之后再看，不是没有变化。`
      : `${marker.label_zh}这次先不下结论：${marker.blocked_by || '还缺一个能对比的结果'}。`
    body = '缺的是可比的复测或记录，不是“没有变化”。'
  }
  headline = headline.replace(/。。+/g, '。')
  if (BARE.test(headline) || headline.length < 8) headline = `${marker.label_zh}这次先不下结论，补上可比的结果后再看。`
  const claims = claimsFor(grade, 'marker', ask).filter((claim) => claim !== 'younger')
  const message: FeedbackMessage = {
    id: slug('fb-m', marker.key),
    subject: { kind: 'marker', key: marker.key, label_zh: marker.label_zh },
    grade,
    allowed_claims: claims,
    numbers: numbersOf(marker),
    delta: deltaOf(marker, advice),
    retest: schedule(marker, advice, today, grade),
    headline_zh: headline,
    ...(body ? { body_zh: body } : {}),
    tone: toneFor(grade, ask),
    source: 'template',
  }
  return message
}

export function gradeBioAge(input: BioAgeInput, today: string): FeedbackMessage {
  const advice = retestAdvice('bioage')
  const points = [...input.points].filter((row) => Number.isFinite(row.phenoage)).sort((a, b) => a.date.localeCompare(b.date))
  const draws = Math.max(points.length, input.draws)
  const latest = points.at(-1)
  const first = points[0]
  const pheno = latest?.phenoage ?? input.phenoage
  const advance = latest?.advance ?? input.advance
  const date = latest?.date ?? input.date
  const numbers: NumberRef[] = []
  if (pheno != null) numbers.push(refOf('phenoage.latest', '身体年龄', pheno, '岁', date, 'skill'))
  if (advance != null) numbers.push(refOf('phenoage.advance', '身体年龄与实足年龄之差', advance, '岁', date, 'skill'))
  if (input.age != null) numbers.push(refOf('age', '实足年龄', input.age, '岁', today, 'derived'))

  const base = {
    id: 'fb-bioage',
    subject: { kind: 'bioage' as const, key: 'phenoage', label_zh: '身体年龄' },
    numbers,
    source: 'template' as const,
  }

  if (points.length < 2) {
    if (draws > 1) {
      const dates = retestDates(today, advice, 0, today)
      return {
        ...base,
        grade: 'not_judgeable',
        allowed_claims: ['progress_story', 'retest_when'],
        retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: advice.why_zh },
        headline_zh: '几次身体年龄还没有对齐，先不说变年轻。对上同一天的九项血检后再比。',
        tone: 'neutral',
      }
    }
    const low = advance != null && pheno != null
      ? (advance < -0.05
        ? `这次算出 ${showNum(pheno)} 岁，比实足年龄低 ${showNum(-advance)} 岁。`
        : advance > 0.05
          ? `这次算出 ${showNum(pheno)} 岁，比实足年龄高 ${showNum(advance)} 岁。`
          : `这次算出 ${showNum(pheno)} 岁，和实足年龄相当。`)
      : pheno != null ? `这次算出 ${showNum(pheno)} 岁。` : ''
    const dates = retestDates(today, advice, 0, today)
    const headline = `${low}这是第一次身体年龄，一次检查不能说明你变年轻了。${advice.why_zh}最早 ${dates.earliest} 再测。`
    return {
      ...base,
      grade: 'first_draw',
      allowed_claims: ['progress_story', 'retest_when'],
      retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: advice.why_zh },
      headline_zh: headline,
      tone: 'neutral',
    }
  }

  const span = daysBetween(first?.date ?? today, latest?.date ?? today)
  const deltaYears = first?.advance != null && latest?.advance != null
    ? latest.advance - first.advance
    : (latest && first ? latest.phenoage - first.phenoage : null)
  if (deltaYears != null) numbers.push(refOf('phenoage.delta', '身体年龄变化', deltaYears, '岁', date, 'derived'))
  const band = input.band_years
  const delta = {
    value: deltaYears ?? 0,
    unit: '岁',
    band: band != null ? [-Math.abs(band), Math.abs(band)] as [number, number] : null,
    band_verified: input.band_verified,
    interval_days: span,
    min_interval_days: advice.minDays,
    same_lab: input.same_lab,
  }
  const dates = retestDates(today, advice, span, latest?.date ?? today)

  if (input.same_lab === false) {
    return {
      ...base, numbers, grade: 'not_comparable', allowed_claims: ['retest_when', 'progress_story'], delta,
      retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: '两次不是同一家实验室，身体年龄不能直接比。' },
      headline_zh: '两次身体年龄不是同一家实验室，数字不能直接比，先不说变年轻。用同一家实验室再测一次。',
      tone: 'neutral',
    }
  }
  if (span < advice.minDays) {
    const early = retestDates(today, advice, span, today)
    const moved = deltaYears != null ? `两次相差 ${showYears(Math.abs(deltaYears))} 岁，` : ''
    return {
      ...base, numbers, grade: 'too_early', allowed_claims: ['retest_when', 'progress_story'], delta,
      retest: { earliest: early.earliest, recommended: early.recommended, why_zh: advice.why_zh },
      headline_zh: `${moved}但只隔了 ${span} 天，不到 3 个月，还不能说变年轻。最早 ${early.earliest} 再测。`,
      tone: 'neutral',
    }
  }
  const beyond = band != null && deltaYears != null && Math.abs(deltaYears) > Math.abs(band)
  const younger = beyond && deltaYears != null && deltaYears < 0 && input.band_verified
  if (younger && deltaYears != null) {
    const headline = `你确实年轻了 ${showYears(Math.abs(deltaYears))} 岁（模型估计，超出了测量波动，是真实的变化）。`
    const message: FeedbackMessage = {
      ...base, numbers, grade: 'beyond_band_better',
      allowed_claims: ['younger', 'celebrate', 'improved', 'retest_when'],
      delta, retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: advice.why_zh },
      headline_zh: headline, tone: 'celebrate',
    }
    if (!youngerAllowed(message)) message.allowed_claims = message.allowed_claims.filter((claim) => claim !== 'younger')
    return message
  }
  if (beyond && deltaYears != null && deltaYears > 0) {
    return {
      ...base, numbers, grade: 'beyond_band_worse', allowed_claims: ['see_doctor', 'retest_when'], delta,
      retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: advice.why_zh },
      headline_zh: `身体年龄高了 ${showYears(deltaYears)} 岁，超出了测量波动。这不是“变年轻”。建议和医生看一看是哪项指标带上去的。`,
      tone: 'care',
    }
  }
  if (beyond && !input.band_verified && deltaYears != null && deltaYears < 0) {
    return {
      ...base, numbers, grade: 'beyond_band_better', allowed_claims: ['celebrate', 'improved', 'retest_when'], delta,
      retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: advice.why_zh },
      headline_zh: `身体年龄低了 ${showYears(Math.abs(deltaYears))} 岁，超出了给出的波动范围。波动数据的来源还没核对，所以先不说你变年轻了。`,
      body_zh: advice.why_zh, tone: 'encourage',
    }
  }
  const way = deltaYears == null ? 'flat' : deltaYears < -0.05 ? 'improving' : deltaYears > 0.05 ? 'worse' : 'flat'
  const grade: EvidenceGrade = way === 'improving' ? 'within_band_improving' : way === 'worse' ? 'within_band_worse' : 'within_band_flat'
  const bandText = band != null ? `测量波动大约 ±${showYears(band)} 岁。` : ''
  const moved = deltaYears != null && Math.abs(deltaYears) >= 0.05
    ? `身体年龄变化 ${showYears(Math.abs(deltaYears))} 岁，还在波动里。`
    : '身体年龄几乎没动，还在测量波动里。'
  return {
    ...base, numbers, grade, allowed_claims: ['progress_story', 'retest_when'], delta,
    retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: advice.why_zh },
    headline_zh: `${moved}${bandText}还不能说变年轻。${advice.why_zh}`,
    tone: way === 'improving' ? 'encourage' : 'neutral',
  }
}

function judged(grade: EvidenceGrade): boolean {
  return grade === 'beyond_band_better' || grade === 'beyond_band_worse' || grade.startsWith('within_band')
}

/** A change the row already called past the band, including one with no good/bad direction. */
function movedPastBand(row: FeedbackMessage): boolean {
  if (/超出了(测量)?波动|超出正常波动/.test(row.headline_zh)) return true
  const band = row.delta?.band
  const value = row.delta?.value
  if (!band || value == null) return false
  return value > band[1] || value < band[0]
}

export function progressStory(markers: FeedbackMessage[], today: string): FeedbackMessage {
  const comparable = markers.filter((row) => judged(row.grade))
  const better = markers.filter((row) => row.grade === 'beyond_band_better' && row.tone !== 'care')
  const worse = markers.filter((row) => row.grade === 'beyond_band_worse')
  const improving = markers.filter((row) => row.grade === 'within_band_improving' || (row.grade === 'beyond_band_better' && row.tone !== 'care'))
  const withinNames = listZh(markers.filter((row) => row.grade === 'within_band_improving').map((row) => row.subject.label_zh))
  const n = comparable.length
  const k = improving.length
  const advice = retestAdvice('ldl')
  const drawn = [...new Set(markers.flatMap((row) => row.numbers.map((item) => item.date ?? '')).filter((day) => /^\d{4}-\d{2}-\d{2}/.test(day)))].sort()
  const latestDraw = drawn.at(-1) ?? null
  const completedDraw = drawn.length >= 2 ? latestDraw : null
  let grade: EvidenceGrade = 'not_judgeable'
  let headline = '这次先不下结论：还没有可以对比的结果。补上复测后再看，不是没有变化。'
  let tone: FeedbackMessage['tone'] = 'neutral'
  if (better.length > 0) {
    grade = 'beyond_band_better'
    tone = 'celebrate'
    const lead = listZh(better.map((row) => row.subject.label_zh))
    headline = `${lead}超出了测量波动，是真实的变化。`
    if (n > better.length) headline += `${n} 项里 ${k} 项在变好${withinNames ? `，波动里往好走的有${withinNames}` : ''}。再隔 8–12 周复查，才能给其余项一个确切答案。`
  } else if (worse.length > 0 && k === 0) {
    grade = 'beyond_band_worse'
    tone = 'care'
    headline = `${listZh(worse.map((row) => row.subject.label_zh))}超出了测量波动，方向不好。建议复查，并和医生讨论。`
  } else if (k > 0) {
    grade = 'within_band_improving'
    tone = 'encourage'
    headline = `方向对了：${n} 项里 ${k} 项在变好${withinNames ? `（${withinNames}）` : ''}。还在测量波动里，再隔 8–12 周复查，才看得出是不是确切变化。`
  } else if (markers.some((row) => row.grade === 'within_band_worse')) {
    grade = 'within_band_worse'
    tone = 'neutral'
    headline = `${n} 项都还在测量波动里，有的略偏反方向。先不下结论。再隔 8–12 周复查。`
  } else if (markers.some((row) => row.grade === 'within_band_flat')) {
    grade = 'within_band_flat'
    tone = 'neutral'
    headline = `这 ${n} 项都还在测量波动里，没有一项已经超出。再隔 8–12 周复查，才能确定有没有确切变化。`
  } else if (markers.some((row) => movedPastBand(row))) {
    tone = 'care'
    headline = `${listZh(markers.filter((row) => movedPastBand(row)).map((row) => row.subject.label_zh))}的变化超出了正常波动。先不说变好或变差。`
  } else if (markers.some((row) => row.grade === 'too_early')) {
    grade = 'too_early'
    headline = '这几项还不到能下结论的时间。按每项自己的间隔再测，糖化血红蛋白至少要满 90 天。'
  }
  const dates = retestDates(today, advice, advice.minDays, latestDraw, grade === 'too_early' ? null : completedDraw)
  const claims = claimsFor(grade, 'marker', false).filter((claim) => claim !== 'younger')
  return {
    id: 'fb-summary',
    subject: { kind: 'marker', key: 'panel', label_zh: '这次的变化' },
    grade,
    allowed_claims: claims,
    numbers: markers.flatMap((row) => row.numbers).slice(0, 12),
    retest: { earliest: dates.earliest, recommended: dates.recommended, why_zh: dates.why_zh },
    headline_zh: headline,
    body_zh: bodyOf(markers),
    tone,
    source: 'template',
  }
}

function bodyOf(markers: FeedbackMessage[]): string {
  const wait = markers.filter((row) => row.grade === 'too_early').map((row) => row.subject.label_zh)
  const hold = markers.filter((row) => row.grade === 'not_judgeable' || row.grade === 'not_comparable')
  const parts: string[] = []
  if (wait.length > 0) parts.push(`${listZh(wait)}还要等到间隔够了再测，糖化血红蛋白和维生素 D 至少 90 天。`)
  if (hold.length > 0) parts.push(hold.slice(0, 3).map((row) => row.headline_zh).join(''))
  return parts.join('')
}

export function gradeBehaviours(rows: BehaviourInput[], today: string): FeedbackMessage | null {
  const done = rows.filter((row) => row.date === today && row.title_zh.trim())
  if (done.length === 0) return null
  const names = listZh(done.map((row) => row.title_zh))
  return {
    id: 'fb-behaviour',
    subject: { kind: 'behaviour', key: 'checkin', label_zh: '今天做到的' },
    grade: 'behaviour_done',
    allowed_claims: ['affirm'],
    numbers: [],
    headline_zh: done.length === 1 ? `今天的「${done[0]?.title_zh}」完成了，先把这一步记下来。` : `今天完成了${names}，这些都算数。`,
    tone: 'celebrate',
    source: 'template',
  }
}

export function gradeProjection(rows: ProjectionInput[]): FeedbackMessage | null {
  const usable = rows.filter((row) => row.label_zh && row.target_zh)
  if (usable.length === 0) return null
  const lines = usable.map((row) => projectionSentence(row.label_zh, row.target_zh, row.years, row.from_zh))
  return {
    id: 'fb-projection',
    subject: { kind: 'goal', key: 'projection', label_zh: '如果达到目标' },
    grade: 'projection',
    allowed_claims: ['target'],
    numbers: usable.flatMap((row) => {
      const years = row.years
      return years == null ? [] : [refOf(`goal.${row.label_zh}`, row.label_zh, years, '岁', null, 'skill')]
    }),
    headline_zh: lines[0] ?? '',
    ...(lines.length > 1 ? { body_zh: lines.slice(1).join('') } : {}),
    tone: 'encourage',
    source: 'template',
  }
}

export function buildFeedback(input: FeedbackInput): FeedbackMessage[] {
  const markerMessages = input.markers.map((marker) => gradeMarker(marker, input.today))
  const summary = markerMessages.length > 0 ? progressStory(markerMessages, input.today) : null
  const notable = markerMessages.filter((row) => row.grade === 'beyond_band_better' || row.grade === 'beyond_band_worse' || row.grade === 'too_early')
  const bio = input.bioage ? gradeBioAge(input.bioage, input.today) : null
  const behaviour = gradeBehaviours(input.behaviours, input.today)
  const projection = gradeProjection(input.projections)
  const out = [summary, bio, ...notable, behaviour, projection].filter((row): row is FeedbackMessage => row != null)
  for (const message of out) {
    if (mentionsDeathRisk(message.headline_zh) || mentionsDeathRisk(message.body_zh ?? '')) {
      message.headline_zh = message.headline_zh.replace(DEATH_RISK, '模型估计')
      if (message.body_zh) message.body_zh = message.body_zh.replace(DEATH_RISK, '模型估计')
    }
    if (message.allowed_claims.includes('younger') && !youngerAllowed(message)) {
      message.allowed_claims = message.allowed_claims.filter((claim) => claim !== 'younger')
    }
    if (!message.allowed_claims.includes('younger') && announcesYounger(message.headline_zh)) {
      message.headline_zh = message.headline_zh.replace(/你确实年轻了/g, '变化了').replace(/比实足年龄年轻/g, '比实足年龄低')
    }
  }
  return out
}

export function markerFromChange(row: {
  key: string
  label_zh: string
  unit: string
  compare: { from_date: string; from: number; to_date: string; to: number; pct: number }
  band_pct: { up: number; down: number }
  direction: 'up' | 'down'
  verdict: 'better' | 'worse' | 'unclear'
  ask_doctor: boolean
  verified: boolean
}): LabMarkerInput {
  const glucoseFall = (row.key === 'glucose' || row.key === 'hba1c') && row.direction === 'down' && row.verdict === 'unclear'
  let verdict: MarkerVerdict | null = row.verdict === 'better' ? 'working' : row.verdict === 'worse' ? 'wrong way' : 'cannot tell'
  let blocked: string | null = null
  if (glucoseFall) blocked = 'glucose fall not called improvement'
  else if (row.verdict === 'unclear') blocked = 'no direction (none)'
  if (row.ask_doctor && row.verdict === 'worse') verdict = 'wrong way'
  return {
    key: row.key,
    label_zh: row.label_zh,
    unit: row.unit,
    from: row.compare.from,
    to: row.compare.to,
    from_date: row.compare.from_date,
    to_date: row.compare.to_date,
    delta_pct: row.compare.pct,
    band_down_pct: row.band_pct.down,
    band_up_pct: row.band_pct.up,
    band_verified: row.verified,
    better: row.verdict === 'better' ? (row.direction === 'down' ? 'lower' : 'higher') : row.verdict === 'worse' ? (row.direction === 'down' ? 'higher' : 'lower') : 'none',
    verdict,
    blocked_by: blocked,
    ask_doctor: row.ask_doctor,
    same_lab: null,
  }
}

export function blockedFromReason(reason: string): string | null {
  if (/至少要隔|太早|复测才有意义/.test(reason)) {
    const need = reason.match(/(\d+)\s*天/)
    const waited = reason.match(/开始才\s*(\d+)\s*天/)
    if (need) return `too soon (${waited?.[1] ?? '0'}d < ${need[1]}d)`
    return 'too soon'
  }
  if (/家庭血压|连续\s*\d+\s*天/.test(reason)) return 'needs 7-day home mean; one office reading'
  if (/无法换算|单位是/.test(reason)) return 'not comparable'
  if (/没有执行|执行率|执行记录/.test(reason)) {
    return /超出正常波动/.test(reason) ? 'adherence low; marker itself beyond band' : 'adherence low; marker itself within noise'
  }
  if (/没有基线|还没有/.test(reason)) return reason.slice(0, 80)
  return null
}

/** A plan-engine verdict row (evaluate.ts) into the grader's input. `change.pct` is a fraction, not a percent. */
export function markerFromEngine(row: {
  marker: string
  unit?: string
  verdict: string
  reason_zh?: string
  direction?: string
  baseline?: { date: string; value: number } | null
  followup?: { date: string; value: number } | null
  change?: { abs: number; pct: number } | null
  band?: { up_pct: number; down_pct: number; verified?: boolean } | null
  confounders?: string[]
  indicator?: string | null
}, key: string): LabMarkerInput {
  const reason = row.reason_zh ?? ''
  let blocked = blockedFromReason(reason)
  let verdict = normalizeVerdict(row.verdict)
  if (blocked?.includes('beyond band')) {
    verdict = row.direction === 'worse' ? 'wrong way' : 'working'
  }
  const looked = knownBetter(key, row.marker)
  const pct = row.change?.pct
  const better: LabMarkerInput['better'] = row.direction === 'improved'
    ? (pct != null && pct > 0 ? 'higher' : 'lower')
    : row.direction === 'worse'
      ? (pct != null && pct > 0 ? 'lower' : 'higher')
      : looked
  return {
    key: key || row.indicator || row.marker,
    label_zh: row.marker,
    unit: row.unit ?? '',
    from: row.baseline?.value ?? null,
    to: row.followup?.value ?? null,
    from_date: row.baseline?.date ?? null,
    to_date: row.followup?.date ?? null,
    delta_pct: row.change ? row.change.pct * 100 : null,
    band_down_pct: row.band?.down_pct ?? null,
    band_up_pct: row.band?.up_pct ?? null,
    band_verified: row.band?.verified ?? false,
    better,
    verdict,
    blocked_by: blocked,
    confounders: row.confounders,
    same_lab: null,
  }
}

export function normalizeVerdict(raw: string | null | undefined): MarkerVerdict | null {
  if (raw === '有效' || raw === 'working') return 'working'
  if (raw === '波动内' || raw === 'within noise') return 'within noise'
  if (raw === '反向' || raw === 'wrong way') return 'wrong way'
  if (raw === '无法判断' || raw === 'cannot tell') return 'cannot tell'
  return null
}

export function markerFromGroundTruth(row: {
  key: string
  name_zh: string
  unit: string
  baseline_date?: string
  baseline?: number
  retest?: number
  delta_pct?: number
  band_down_pct?: number
  band_up_pct?: number
  better?: string
  vs_band?: string
  verdict?: string
  blocked_by?: string | null
}, retestDate: string): LabMarkerInput {
  const blocked = row.blocked_by ?? null
  const waited = blocked?.match(/(\d+)\s*d\s*</)
  const better = row.better === 'lower' || row.better === 'higher' || row.better === 'range' || row.better === 'none' ? row.better : null
  return {
    key: row.key,
    label_zh: row.name_zh,
    unit: row.unit,
    from: row.baseline ?? null,
    to: row.retest ?? null,
    from_date: row.baseline_date ?? null,
    to_date: retestDate,
    delta_pct: row.delta_pct ?? null,
    band_down_pct: row.band_down_pct ?? null,
    band_up_pct: row.band_up_pct ?? null,
    band_verified: true,
    better,
    verdict: normalizeVerdict(row.verdict ?? null),
    blocked_by: blocked,
    waited_days: waited ? Number(waited[1]) : null,
    same_lab: null,
  }
}

export type { RetestAdvice, IsoDay }
