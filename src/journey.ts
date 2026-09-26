// Where the person is on the way from first open to a routine, as one object
// the page, the home card, the composer dock and the tools all read: consent,
// the profile questions and what each unlocks, the record, the first results
// (or the exact blocker and the add-on tests that remove it), the plan, due
// reminders, and the next step. It adds no number of its own: results come
// from buildTracking (skill scripts), everything else from what is saved.

import type { RecordChange } from './changes.ts'
import { followupSummary, readFollowup, type FollowupState } from './followup.ts'
import { recordsSummary, type RecordsSummary } from './indicators.ts'
import { addDays, checkinStatus, daysBetween, readCheckIns } from './interventions.ts'
import { measurementInputs } from './measurements.ts'
import type { MountState } from './mirobody.ts'
import { CONSENT_VERSION, FOCUS, FOCUS_ZH, RISK_FACTS, RISK_FACT_ZH, type Focus, type Profile, type RiskFact } from './profile.ts'
import { loadReference } from './reference.ts'
import { latestSelf, readSelf, SELF_KEYS, SELF_SPEC, type SelfKey } from './selfmeasure.ts'
import { buildTracking, PHENOAGE_SKILL, type BioAge, type Tracking, type TrackingContext } from './tracking.ts'
import { PRODUCT_VERSION } from './version.ts'

export type Stage = 'consent' | 'profile' | 'records' | 'first_result' | 'plan' | 'routine'
export type { RecordChange } from './changes.ts'

export interface Journey {
  version: string
  today: string
  consent: { accepted: boolean; version: string; accepted_at: string | null; current: string }
  profile: {
    displayName: string; birthYear: number | null; age: number | null
    sex: 'female' | 'male' | 'other' | 'unknown'
    risk: Partial<Record<RiskFact, boolean>>
    focus: Focus[]
    complete: boolean
    questions: Array<{ key: 'age' | 'sex' | RiskFact; label_zh: string; unlocks_zh: string; answered: boolean; men_only?: boolean }>
  }
  focus_options: Array<{ key: Focus; label_zh: string }>
  /**
   * status partial: read, but some reads failed or came back cut; read_errors says which, and missing_reads names
   * indicators not read (unknown, never "not measured"). summary: what the record holds, for onboarding (checkup days
   * and their span, the groups present, wearable days in the last year); null when the record is not connected, or a
   * read failed or timed out (a count would then be too small).
   */
  records: {
    status: 'unconfigured' | 'ok' | 'partial' | 'error'; error: string; read_errors: string[]; missing_reads: string[]
    indicator_count: number; full_checkups: number; latest_checkup: string | null; mirobody_mounted: boolean
    summary: RecordsSummary | null
  }
  results: {
    /**
     * band_verified and band_missing are additions for the model: with band_missing the band is a lower bound.
     * caveat_zh is set when a PhenoAge input changed beyond normal fluctuation in a direction to show a doctor.
     */
    bioage: { status: 'ok' | 'blocked'; phenoage: number | null; advance: number | null; date: string | null; checkups: number; band_years: number | null; band_verified: boolean; band_missing: string[]; blocker_zh: string; missing: string[]; caveat_zh?: string }
    risk: { status: 'ok' | 'blocked'; risk_pct: number | null; category_zh: string; date: string | null; blocker_zh: string; missing_labs: string[]; missing_facts: string[] }
  }
  addons: Array<{ item_zh: string; unlocks_zh: string; self_measurable: boolean; self_key?: SelfKey }>
  /** Changes between checkups larger than normal fluctuation, ask_doctor first; empty when the record cannot be read. */
  changes: RecordChange[]
  changes_note_zh: string
  /** Markers not judged because their series read failed or came back cut: unknown, never "no change". */
  changes_unjudged: Array<{ label_zh: string; reason_zh: string }>
  self: { latest: Array<{ key: SelfKey; label_zh: string; value: number; unit: string; date: string; n: number }>; keys: Array<{ key: SelfKey; label_zh: string; unit: string; units: string[] }> }
  plan: { exists: boolean; title: string; version: number | null; items: number; started: string | null; days: number | null; checkin_items: Array<{ id: string; title: string; done_today: boolean | null }>; streak: number; adherence_pct: number | null }
  reminders: Array<{ kind: 'retest' | 'checkin'; text_zh: string; date: string | null; due: boolean }>
  stage: Stage
  next: { stage: Stage; title_zh: string; detail_zh: string; action: 'consent' | 'profile' | 'records' | 'addons' | 'plan' | 'checkin' | 'review' | 'open' }
  suggestions: Array<{ id: string; text_zh: string }>
  boundary_zh: string
  /** Follow-up reminders: on or off, the channels in use, and the next planned send (local ISO). */
  followup: { enabled: boolean; channels: Array<'desktop' | 'webhook'>; next_at: string | null }
}

type Next = Journey['next']
type Body = Omit<Journey, 'stage' | 'next' | 'suggestions' | 'followup'>
/** What a journey is built from; now (default the clock) only times the next follow-up. */
export type JourneyContext = TrackingContext & { mount: MountState; now?: Date }
type Addon = Journey['addons'][number]

const BOUNDARY_ZH = '模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。'
const BOTH = '身体年龄、心血管风险'
const CARDIO = '心血管风险'
const BIOAGE = '身体年龄'
// China-PAR's women's equation does not use these two; they are still asked, of men.
const MEN_ONLY: ReadonlySet<RiskFact> = new Set(['urban', 'family_history'])
const REMIND_AHEAD_DAYS = 7
const DETAIL_MAX = 40
const JOURNEY_TTL_MS = 10 * 60_000

const BIOAGE_BLOCKER: Partial<Record<BioAge['status'], string>> = {
  no_skill: '方法库里没有身体年龄（表型年龄）方法，请更新 longevity-skills。',
  no_record: '还没有连接 Mirobody 记录。',
  no_age: '档案里还没有实足年龄。',
  no_checkup: '九项血检还没有在同一天测齐。',
}

const FOCUS_PROMPT: Record<Focus | 'none', { id: string; text_zh: string }> = {
  bioage: { id: 'focus-bioage', text_zh: '我的身体年龄怎么样？哪些指标影响最大？' },
  cardio: { id: 'focus-cardio', text_zh: '我的心血管风险怎么样？哪些因素影响最大？' },
  glucose: { id: 'focus-glucose', text_zh: '我的血糖情况怎么样？' },
  weight: { id: 'focus-weight', text_zh: '帮我记录今天的体重' },
  sleep: { id: 'focus-sleep', text_zh: '我最近的睡眠怎么样？' },
  plan: { id: 'focus-overall', text_zh: '我的检查结果整体怎么样？' },
  none: { id: 'focus-overall', text_zh: '我的检查结果整体怎么样？' },
}

let lastBuilt: { at: number; journey: Journey } | null = null

export async function buildJourney(context: JourneyContext): Promise<Journey> {
  return (await buildJourneyFull(context)).journey
}

/** The journey and the tracking it was built from (retest dates, bands, adherence calendars). */
export async function buildJourneyFull(context: JourneyContext): Promise<{ journey: Journey; tracking: Tracking }> {
  // The summary's reads run beside the skill runs and have their own deadline; a failure leaves it null.
  const [tracking, summary] = await Promise.all([buildTracking(context), recordsSummary(context).catch(() => null)])
  const journey = journeyFrom(context, tracking, summary)
  lastBuilt = { at: Date.now(), journey }
  return { journey, tracking }
}

/**
 * The value of a promise, or null when it has not settled within ms. The work
 * goes on: buildTracking memoizes the promise, so the next call picks it up.
 */
export async function within<T>(promise: Promise<T>, ms: number): Promise<{ value: T } | { timeout: true }> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const deadline = new Promise<{ timeout: true }>((resolve) => {
    timer = setTimeout(() => resolve({ timeout: true }), ms)
    timer.unref?.()
  })
  try {
    return await Promise.race([promise.then((value) => ({ value })), deadline])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** Age is set and sex is answered (female, male or other). China-PAR's own need for male or female shows in its missing_facts. */
export function profileComplete(profile: Pick<Profile, 'age' | 'sex'>): boolean {
  return profile.age != null && profile.sex !== 'unknown'
}

export function consentAccepted(profile: Pick<Profile, 'consent'>): boolean {
  return profile.consent?.version === CONSENT_VERSION
}

function clip(text: string, max = DETAIL_MAX): string {
  const chars = [...text]
  return chars.length <= max ? text : `${chars.slice(0, max - 1).join('')}…`
}

/**
 * Retest dates the plan's verdicts give, the earliest per marker. The only dates LongPi suggests a retest on.
 * date moves with today once the retest is due; first_due is the day it first became due and does not move.
 */
export function retestsOf(tracking: Tracking): Array<{ marker: string; date: string; first_due: string }> {
  const earliest = new Map<string, { date: string; first_due: string }>()
  for (const item of tracking.items) {
    for (const row of item.verdicts) {
      if (!row.indicator || !row.next_retest) continue
      const seen = earliest.get(row.marker)
      const firstDue = row.first_due ?? row.next_retest
      if (!seen || row.next_retest < seen.date || (row.next_retest === seen.date && firstDue < seen.first_due)) {
        earliest.set(row.marker, { date: row.next_retest, first_due: firstDue })
      }
    }
  }
  return [...earliest.entries()].map(([marker, row]) => ({ marker, ...row }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.marker.localeCompare(b.marker))
}

/** Labels of the profile questions not answered yet (unknown is not an answer). */
export function unansweredOf(profile: Profile): string[] {
  return questionsOf(profile).filter((row) => !row.answered).map((row) => row.label_zh)
}

function questionsOf(profile: Profile): Journey['profile']['questions'] {
  return [
    { key: 'age', label_zh: '年龄', unlocks_zh: BOTH, answered: profile.age != null },
    // PhenoAge does not use sex; China-PAR does (male or female). Same predicate as profileComplete.
    { key: 'sex', label_zh: '性别', unlocks_zh: CARDIO, answered: profile.sex !== 'unknown' },
    ...RISK_FACTS.map((fact) => ({
      key: fact, label_zh: RISK_FACT_ZH[fact], unlocks_zh: CARDIO, answered: profile.risk[fact] != null,
      ...(MEN_ONLY.has(fact) ? { men_only: true } : {}),
    })),
  ]
}

function bioageResult(bioage: BioAge): Journey['results']['bioage'] {
  const last = bioage.status === 'ok' ? bioage.points.at(-1) : undefined
  const blocker = last ? '' : bioage.status === 'missing_inputs'
    ? `记录里还缺${bioage.missing.join('、')}。`
    : BIOAGE_BLOCKER[bioage.status] ?? bioage.note_zh
  return {
    status: last ? 'ok' : 'blocked',
    phenoage: last?.phenoage ?? null,
    advance: last?.advance ?? null,
    date: last?.date ?? null,
    checkups: bioage.points.length,
    band_years: last ? bioage.band_years : null,
    band_verified: last ? bioage.band_verified : false,
    band_missing: last ? [...bioage.band_missing] : [],
    blocker_zh: blocker,
    missing: [...bioage.missing],
  }
}

/** The caveat on phenotypic age when one of its own inputs changed beyond normal fluctuation in a direction to show a doctor. */
function bioageCaveat(context: TrackingContext, changes: readonly RecordChange[]): string | null {
  const card = context.catalog.cards.find((item) => item.name === PHENOAGE_SKILL)
  if (!card) return null
  // PhenoAge's inputs by their LOINC codes, matched to the biological-variation rows the changes come from.
  const codes = new Set(measurementInputs(card).filter((spec) => spec.required).flatMap((spec) => spec.loinc ?? []))
  const markers = loadReference(context.skillsHome).biovar.markers
  const labels = changes
    .filter((row) => row.ask_doctor && (markers.find((marker) => marker.key === row.key)?.loinc ?? []).some((code) => codes.has(code)))
    .map((row) => row.label_zh)
  return labels.length > 0 ? `身体年龄用到的${labels.join('、')}近期变化明显，原因可能与衰老无关，这次的结果请谨慎看待。` : null
}

function riskResult(tracking: Tracking): Journey['results']['risk'] {
  const card = tracking.models.find((row) => row.model === 'china-par')
  const pct = card?.now.risk_pct
  const ok = typeof pct === 'number'
  return {
    status: ok ? 'ok' : 'blocked',
    risk_pct: ok ? pct : null,
    category_zh: ok ? card?.category_zh?.now ?? '' : '',
    date: ok ? card?.measured_on ?? null : null,
    blocker_zh: ok ? '' : card?.note_zh || '心血管风险模型没有给出结果。',
    missing_labs: [...(card?.missing_labs ?? [])],
    missing_facts: [...(card?.missing_facts ?? [])],
  }
}

function selfKeyForLab(label: string): SelfKey | undefined {
  // China-PAR's own inputs a tape measure or a home cuff can supply.
  return (['waist', 'sbp'] as const).find((key) => label.includes(SELF_SPEC[key].label_zh))
}

function addonsOf(bioage: BioAge, risk: Journey['results']['risk']): Addon[] {
  const list: Addon[] = []
  const add = (item: string, unlocks: string, selfKey?: SelfKey) => {
    const hit = list.find((row) => row.item_zh === item)
    if (!hit) {
      list.push({ item_zh: item, unlocks_zh: unlocks, self_measurable: Boolean(selfKey), ...(selfKey ? { self_key: selfKey } : {}) })
      return
    }
    if (!hit.unlocks_zh.split('、').includes(unlocks)) hit.unlocks_zh = `${hit.unlocks_zh}、${unlocks}`
    if (selfKey && !hit.self_key) Object.assign(hit, { self_measurable: true, self_key: selfKey })
  }
  for (const label of bioage.missing) add(label, BIOAGE)
  for (const label of risk.missing_labs) add(label, CARDIO, selfKeyForLab(label))
  if (bioage.status === 'no_checkup') add('九项血检安排在同一天', BIOAGE)
  return [...list.filter((row) => row.self_measurable), ...list.filter((row) => !row.self_measurable)]
}

function planOf(context: TrackingContext, tracking: Tracking): Journey['plan'] {
  const plan = tracking.plan
  if (!plan) return { exists: false, title: '', version: null, items: 0, started: null, days: null, checkin_items: [], streak: 0, adherence_pct: null }
  const today = context.today
  // The latest check-in of the day wins: true done, false 没做到, null not checked in (or taken back).
  const status = checkinStatus(readCheckIns(context.dataDir))
  // Wearable items count themselves and medicines are logged in Mirobody; only the rest need a tap.
  const checkinItems = plan.items
    .filter((item) => !item.target && !item.mirobody && item.start <= today && (!item.end || item.end >= today))
    .map((item) => ({ id: item.id, title: item.title, done_today: status.get(item.id)?.get(today) ?? null }))
  const started = plan.items.map((item) => item.start).sort()[0] ?? null
  const rates = tracking.items.map((item) => item.adherence.rate).filter((rate): rate is number => rate != null)
  return {
    exists: true,
    title: plan.title,
    version: plan.version,
    items: plan.items.length,
    started,
    days: started ? Math.max(0, daysBetween(started, today)) : null,
    checkin_items: checkinItems,
    streak: Math.max(0, ...tracking.items.map((item) => item.adherence.streak)),
    adherence_pct: rates.length > 0 ? Math.round((rates.reduce((sum, rate) => sum + rate, 0) / rates.length) * 100) : null,
  }
}

function remindersOf(today: string, tracking: Tracking, plan: Journey['plan']): Journey['reminders'] {
  const out: Journey['reminders'] = retestsOf(tracking)
    .filter((row) => row.date <= addDays(today, REMIND_AHEAD_DAYS))
    .map((row) => ({ kind: 'retest', text_zh: `复测${row.marker}`, date: row.date, due: row.date <= today }))
  const open = plan.checkin_items.filter((item) => item.done_today == null).length
  if (open > 0) out.push({ kind: 'checkin', text_zh: `今天还有 ${open} 项待打卡`, date: today, due: true })
  return out
}

function stageOf(journey: Pick<Journey, 'consent' | 'profile' | 'records' | 'results' | 'plan'>): Stage {
  if (!journey.consent.accepted) return 'consent'
  if (!journey.profile.complete) return 'profile'
  // A saved plan is lived day by day even while the record is unreachable or no first result can be computed yet.
  if (journey.plan.exists) return 'routine'
  // A record read in part is connected: the rows that failed say so where they are shown.
  if (journey.records.status !== 'ok' && journey.records.status !== 'partial') return 'records'
  if (journey.results.bioage.status !== 'ok' && journey.results.risk.status !== 'ok') return 'first_result'
  return 'plan'
}

function nextOf(stage: Stage, journey: Body): Next {
  const step = (title: string, detail: string, action: Next['action']): Next => ({ stage, title_zh: title, detail_zh: detail, action })
  switch (stage) {
    case 'consent':
      return step('开始使用 LongPi', '先了解 LongPi 做什么、数据放在哪里。', 'consent')
    case 'profile':
      return step('建立档案', '填写年龄和性别即可计算身体年龄；再回答 6 个问题可计算心血管风险。', 'profile')
    case 'records':
      return journey.records.status === 'error'
        ? step('连接体检记录', clip(`记录读取失败：${journey.records.error}`), 'records')
        : step('连接体检记录', '在 Mirobody 中生成个人 MCP 地址，粘贴到设置里的 LongPi 页。', 'records')
    case 'first_result': {
      const n = journey.addons.length
      if (n > 0) return step(`还差 ${n} 项检查`, `下次体检加测：${journey.addons.slice(0, 3).map((row) => row.item_zh).join('、')}`, 'addons')
      const facts = journey.results.risk.missing_facts.length
      if (facts > 0) return step('补充档案', `回答档案里的 ${facts} 个问题即可计算心血管风险。`, 'profile')
      return step('暂时算不出结果', clip(journey.results.bioage.blocker_zh || journey.results.risk.blocker_zh), 'open')
    }
    case 'plan':
      return step('制定改善方案', '让 LongPi 按你的检查结果和研究证据起草一份方案，你确认后才保存。', 'plan')
    case 'routine': {
      const open = journey.plan.checkin_items.filter((item) => item.done_today == null).length
      if (open > 0) return step('今天的打卡', `还有 ${open} 项待完成`, 'checkin')
      const due = journey.reminders.filter((row) => row.kind === 'retest' && row.due).map((row) => row.text_zh.replace(/^复测/, ''))
      if (due.length > 0) return step('该复测了', `可以复测${due.slice(0, 3).join('、')}`, 'review')
      return step('继续保持', journey.plan.days ? `方案已进行 ${journey.plan.days} 天` : '方案从今天开始', 'open')
    }
  }
}

function suggestionsOf(stage: Stage, journey: Body, followupOn: boolean): Journey['suggestions'] {
  const picks: Journey['suggestions'] = []
  if (stage === 'consent' || stage === 'profile') {
    picks.push({ id: 'what-longpi-does', text_zh: 'LongPi 能帮我做什么？' }, { id: 'build-profile', text_zh: '帮我建立健康档案' })
  } else if (stage === 'records') {
    picks.push({ id: 'import-reports', text_zh: '怎么把体检报告导入 Mirobody？' }, { id: 'before-records', text_zh: '还没有体检记录，现在可以先做什么？' })
  } else if (stage === 'first_result') {
    // A plan does not have to wait for the first result: many checkups never include CRP or waist.
    picks.push({ id: 'next-checkup', text_zh: '下次体检需要加测哪些项目？' }, { id: 'draft-plan', text_zh: '帮我制定一份改善方案' })
    if (journey.addons.some((row) => row.self_measurable)) picks.push({ id: 'log-self', text_zh: '帮我记录腰围和家庭血压' })
  } else if (stage === 'plan') {
    picks.push(FOCUS_PROMPT[journey.profile.focus[0] ?? 'none'], { id: 'draft-plan', text_zh: '帮我制定一份改善方案' }, { id: 'save-plan', text_zh: '帮我保存我的干预方案' })
  } else {
    picks.push({ id: 'checkin-all', text_zh: '今天的方案我都完成了' })
    if (journey.reminders.some((row) => row.kind === 'retest' && row.due)) picks.push({ id: 'retest-due', text_zh: '该复测什么了？' })
    if (!followupOn) picks.push({ id: 'followup-on', text_zh: '每天晚上提醒我打卡' })
    picks.push({ id: 'plan-effect', text_zh: '我的方案有没有效果？' })
  }
  // Changes for a doctor come before everything else once the person is past consent and profile.
  if (stage !== 'consent' && stage !== 'profile' && journey.changes.some((row) => row.ask_doctor)) {
    picks.unshift({ id: 'record-changes', text_zh: '我的记录里哪些变化需要注意？' })
  }
  const seen = new Set<string>()
  return picks.filter((row) => !seen.has(row.text_zh) && seen.add(row.text_zh)).slice(0, 3)
}

function journeyFrom(context: JourneyContext, tracking: Tracking, summary: RecordsSummary | null = null): Journey {
  const { records, today } = context
  const profile = records.profile
  const points = tracking.bioage.points
  const latest = latestSelf(readSelf(context.dataDir))
  const bioage = bioageResult(tracking.bioage)
  const caveat = bioage.status === 'ok' ? bioageCaveat(context, tracking.changes) : null
  if (caveat) bioage.caveat_zh = caveat
  const risk = riskResult(tracking)
  const plan = planOf(context, tracking)
  const body: Body = {
    version: PRODUCT_VERSION,
    today,
    consent: {
      accepted: consentAccepted(profile),
      version: profile.consent?.version ?? '',
      accepted_at: profile.consent?.accepted_at ?? null,
      current: CONSENT_VERSION,
    },
    profile: {
      displayName: profile.displayName,
      birthYear: profile.birthYear,
      age: profile.age,
      sex: profile.sex,
      risk: { ...profile.risk },
      focus: [...profile.focus],
      complete: profileComplete(profile),
      questions: questionsOf(profile),
    },
    focus_options: FOCUS.map((key) => ({ key, label_zh: FOCUS_ZH[key] })),
    records: {
      status: records.record_status,
      error: records.record_error,
      read_errors: [...records.read_errors],
      missing_reads: [...records.missing_reads],
      indicator_count: records.indicators.filter((row) => row.source !== 'self').length,
      full_checkups: points.length,
      latest_checkup: points.at(-1)?.date ?? null,
      mirobody_mounted: context.mount.mounted,
      summary,
    },
    results: { bioage, risk },
    addons: addonsOf(tracking.bioage, risk),
    changes: tracking.changes,
    changes_note_zh: tracking.changes_note_zh,
    changes_unjudged: tracking.changes_unjudged,
    self: {
      latest: SELF_KEYS.flatMap((key) => {
        const row = latest[key]
        return row ? [{ key, label_zh: SELF_SPEC[key].label_zh, ...row }] : []
      }),
      keys: SELF_KEYS.map((key) => ({ key, label_zh: SELF_SPEC[key].label_zh, unit: SELF_SPEC[key].unit, units: Object.keys(SELF_SPEC[key].units) })),
    },
    plan,
    reminders: remindersOf(today, tracking, plan),
    boundary_zh: BOUNDARY_ZH,
  }
  const stage = stageOf(body)
  const followupOn = readFollowup(context.dataDir).enabled
  const journey: Journey = {
    ...body, stage, next: nextOf(stage, body), suggestions: suggestionsOf(stage, body, followupOn), followup: { enabled: followupOn, channels: [], next_at: null },
  }
  journey.followup = followupSummary(context.dataDir, followupStateOf(journey, tracking), context.now ?? new Date())
  return journey
}

/** What the follow-up scheduler decides from: the stage, open check-ins, retest dates, this ISO week's adherence. */
export function followupStateOf(journey: Journey, tracking: Tracking): FollowupState {
  const weekday = (new Date(`${journey.today}T00:00:00Z`).getUTCDay() + 6) % 7
  const monday = addDays(journey.today, -weekday)
  let done = 0
  let known = 0
  for (const item of tracking.items) {
    for (const day of item.adherence.calendar) {
      if (day.date < monday || day.date > journey.today || day.status === 'unknown') continue
      known += 1
      if (day.status === 'done') done += 1
    }
  }
  const retests = retestsOf(tracking)
  const upcoming = retests.find((row) => row.date >= journey.today)
  return {
    stage: journey.stage,
    consent_at: journey.consent.accepted ? journey.consent.accepted_at : null,
    next_title_zh: journey.next.title_zh,
    next_detail_zh: journey.next.detail_zh,
    plan_exists: journey.plan.exists,
    checkin_items: journey.plan.checkin_items.length,
    checkin_open: journey.plan.checkin_items.filter((item) => item.done_today == null).map((item) => item.title),
    retests,
    week: { pct: known > 0 ? Math.round((done / known) * 100) : null, streak: journey.plan.streak, next_retest: upcoming ? { marker: upcoming.marker, date: upcoming.date } : null },
  }
}

/**
 * Stage and next step without running anything, for the synchronous /longpi
 * command: exact up to the records step, after that the journey last built in
 * this process (by the page or a tool), or null when there is none yet.
 */
export function stageNow(profile: Profile, mcpConfigured: boolean): { stage: Stage | null; title_zh: string } {
  if (!consentAccepted(profile)) return { stage: 'consent', title_zh: '开始使用 LongPi' }
  if (!profileComplete(profile)) return { stage: 'profile', title_zh: '建立档案' }
  if (!mcpConfigured) return { stage: 'records', title_zh: '连接体检记录' }
  const last = lastBuilt && Date.now() - lastBuilt.at < JOURNEY_TTL_MS ? lastBuilt.journey : null
  if (!last || last.stage === 'consent' || last.stage === 'profile') return { stage: null, title_zh: '打开健康页查看' }
  return { stage: last.stage, title_zh: last.next.title_zh }
}
