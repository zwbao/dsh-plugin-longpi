// Personal seasons from the fact pack. The coach may propose a theme and 3–5 quests.
// A deterministic validator accepts that proposal or the template replaces it.
// Celebration uses M4's grade: a verified move past the noise band, never a first draw.

import type { Id, IsoDay } from '../contracts/common.ts'
import type { HealthEventType } from '../contracts/events.ts'
import type { Quest, QuestKind, Season } from '../contracts/engagement.ts'
import { gradeMarker, type LabMarkerInput } from '../feedback/grade.ts'
import { loadReference, markerFor, rcvBand } from '../reference.ts'
import { resolveSkillsHome } from '../paths.ts'

export interface SeasonFactRef {
  key: string
  label_zh: string
  value: number
  unit: string
  date: string | null
}

export interface SeasonFact {
  id: string
  rule: string
  text_zh: string
  refs: SeasonFactRef[]
}

export interface DraftQuest {
  id: string
  kind: QuestKind
  title_zh: string
  event: HealthEventType
  where?: Record<string, string | number | boolean>
  count: number
}

export interface SeasonDraft {
  title_zh: string
  focus: Season['theme']['focus']
  marker_keys: string[]
  quests: DraftQuest[]
}

export interface SeasonPair {
  key: string
  label_zh: string
  unit: string
  from: number
  from_date: string
  to: number | null
  to_date: string | null
  better: 'lower' | 'higher' | 'range' | 'none'
  band_down_pct: number | null
  band_up_pct: number | null
  band_verified: boolean
}

const ALLOWED_EVENTS = new Set<HealthEventType>(['care.booked', 'care.visit_logged', 'selfmeasure.logged', 'retest.arrived', 'checkin.logged'])
const FORBIDDEN = /年轻|付费|交易|保底跟|稀有度随|剂量|毫克|停药|断食|限时进食|生酮/
const ID_OK = /^qs-[a-z0-9-]{2,40}$/

export function isAnaemiaFact(fact: SeasonFact): boolean {
  return /red[-_ ]?cell|anaemia|anemia|铁蛋白|血红蛋白|贫血/i.test(`${fact.id} ${fact.rule} ${fact.text_zh}`)
}

export function isSafetyFact(fact: SeasonFact): boolean {
  return /safety\.med\.|sglt2|glp1|anticoagulant|insulin|sulfonylurea/i.test(`${fact.id} ${fact.rule} ${fact.text_zh}`)
}

function kindFor(event: HealthEventType): QuestKind | null {
  if (event === 'care.booked' || event === 'care.visit_logged') return 'care'
  if (event === 'retest.arrived') return 'retest'
  if (event === 'selfmeasure.logged') return 'data'
  if (event === 'checkin.logged') return 'behaviour'
  return null
}

export function validateSeasonDraft(draft: SeasonDraft, facts: readonly SeasonFact[]): { ok: boolean; errors: string[] } {
  const errors: string[] = []
  const title = draft.title_zh?.trim() ?? ''
  if (title.length < 2 || title.length > 20) errors.push('title')
  if (FORBIDDEN.test(title)) errors.push('title wording')
  if (!Array.isArray(draft.quests) || draft.quests.length < 3 || draft.quests.length > 5) errors.push('quest count')
  const ids = new Set<string>()
  const events = new Set<HealthEventType>()
  for (const quest of draft.quests ?? []) {
    if (!quest || !ID_OK.test(quest.id ?? '')) errors.push('quest id')
    if (ids.has(quest.id)) errors.push('duplicate id')
    ids.add(quest.id)
    const titleOk = typeof quest.title_zh === 'string' && quest.title_zh.trim().length >= 2 && quest.title_zh.trim().length <= 40
    if (!titleOk || FORBIDDEN.test(quest.title_zh ?? '')) errors.push('quest title')
    if (!ALLOWED_EVENTS.has(quest.event)) errors.push('event')
    const expect = kindFor(quest.event)
    if (!expect || quest.kind !== expect) errors.push('kind')
    if (!Number.isInteger(quest.count) || quest.count < 1 || quest.count > 8) errors.push('count')
    events.add(quest.event)
  }
  if (facts.some(isAnaemiaFact)) {
    if (!events.has('care.booked') && !events.has('care.visit_logged')) errors.push('anaemia needs a doctor quest')
    if (!events.has('retest.arrived')) errors.push('anaemia needs a retest')
    if (![...ids].some((id) => id.includes('iron') || id.includes('ferritin') || id === 'qs-iron')) errors.push('anaemia needs iron studies')
  }
  if (facts.some(isSafetyFact)) {
    const blob = `${title} ${(draft.quests ?? []).map((quest) => quest.title_zh).join(' ')}`
    if (/断食|限时进食|生酮|停药|减半/.test(blob)) errors.push('safety quest')
  }
  const known = new Set(facts.flatMap((fact) => fact.refs.map((ref) => ref.key.split('@')[0] ?? ref.key)))
  for (const key of draft.marker_keys ?? []) {
    if (known.size > 0 && !known.has(key) && !/^(hb|hgb|mcv|rdw|ferritin|iron|glucose|ldl|hba1c)$/.test(key)) errors.push('marker')
  }
  return { ok: errors.length === 0, errors }
}

function quest(partial: DraftQuest): DraftQuest {
  return partial
}

export function templateFor(facts: readonly SeasonFact[]): SeasonDraft | null {
  if (facts.some(isAnaemiaFact)) {
    return {
      title_zh: '查清贫血',
      focus: 'care',
      marker_keys: ['hb', 'mcv', 'ferritin'],
      quests: [
        quest({ id: 'qs-book-dept', kind: 'care', title_zh: '预约血液科或消化科', event: 'care.booked', count: 1 }),
        quest({ id: 'qs-care-visit', kind: 'care', title_zh: '带着简报去看医生', event: 'care.visit_logged', where: { with_brief: true }, count: 1 }),
        quest({ id: 'qs-iron', kind: 'data', title_zh: '补上铁蛋白和铁代谢', event: 'selfmeasure.logged', where: { key: 'ferritin' }, count: 1 }),
        quest({ id: 'qs-retest', kind: 'retest', title_zh: '8 到 12 周后复查血常规', event: 'retest.arrived', count: 1 }),
      ],
    }
  }
  if (facts.some(isSafetyFact)) {
    return {
      title_zh: '先问开药的医生',
      focus: 'care',
      marker_keys: [],
      quests: [
        quest({ id: 'qs-book-dept', kind: 'care', title_zh: '预约开药的科室', event: 'care.booked', count: 1 }),
        quest({ id: 'qs-care-visit', kind: 'care', title_zh: '带着简报问医生能不能改', event: 'care.visit_logged', where: { with_brief: true }, count: 1 }),
        quest({ id: 'qs-retest', kind: 'retest', title_zh: '在复测窗口里复查相关指标', event: 'retest.arrived', count: 1 }),
      ],
    }
  }
  return null
}

export interface BuiltSeason {
  origin: 'coach' | 'template'
  draft: SeasonDraft
}

/** Coach draft when it validates. Otherwise the template. Null keeps the standing rule quests. */
export function resolvePersonal(facts: readonly SeasonFact[], draft: SeasonDraft | null): BuiltSeason | null {
  if (facts.length === 0) return null
  if (draft && validateSeasonDraft(draft, facts).ok) return { origin: 'coach', draft }
  const template = templateFor(facts)
  if (!template || !validateSeasonDraft(template, facts).ok) return null
  return { origin: 'template', draft: template }
}

export function materializeQuests(seasonId: Id, draft: SeasonDraft, origin: 'coach' | 'rule'): Quest[] {
  return draft.quests.map((item) => ({
    id: item.id,
    season_id: seasonId,
    kind: item.kind,
    title_zh: item.title_zh.trim(),
    criteria: { event: item.event, ...(item.where ? { where: item.where } : {}), count: item.count },
    progress: 0,
    status: 'open' as const,
    reward: item.kind === 'care' || item.kind === 'retest' || item.kind === 'data'
      ? { draws: 1, guaranteed_min_rarity: 'rare' as const }
      : { draws: 1 },
    origin,
  }))
}

function bandFor(key: string, label: string): { down: number; up: number; verified: boolean; better: SeasonPair['better'] } | null {
  try {
    const home = resolveSkillsHome('')
    if (!home) return null
    const ref = loadReference(home)
    const marker = ref.biovar.markers.find((row) => row.key === key) ?? markerFor(ref.biovar, { name: label, label })
    if (!marker) return null
    const band = rcvBand(marker, ref.biovar.z)
    const up = Math.round(band.up * 1000) / 10
    const down = marker.log_normal ? Math.round(band.down * 1000) / 10 : -up
    return { down, up, verified: marker.verified === true, better: marker.better }
  } catch {
    return null
  }
}

export function pairsFromFacts(facts: readonly SeasonFact[]): SeasonPair[] {
  const out: SeasonPair[] = []
  const seen = new Set<string>()
  for (const fact of facts) {
    for (const ref of fact.refs) {
      const key = (ref.key.split('@')[0] ?? ref.key).trim()
      if (!key || seen.has(key) || !Number.isFinite(ref.value)) continue
      seen.add(key)
      const band = bandFor(key, ref.label_zh)
      out.push({
        key,
        label_zh: ref.label_zh || key,
        unit: ref.unit,
        from: ref.value,
        from_date: ref.date && /^\d{4}-\d{2}-\d{2}/.test(ref.date) ? ref.date.slice(0, 10) : '',
        to: null,
        to_date: null,
        better: band?.better ?? 'none',
        band_down_pct: band?.down ?? null,
        band_up_pct: band?.up ?? null,
        band_verified: band?.verified ?? false,
      })
    }
  }
  return out.slice(0, 6)
}

export function applyRetestValues(pairs: SeasonPair[], rows: readonly { key: string; value: number; date?: string }[], today: IsoDay): SeasonPair[] {
  return pairs.map((pair) => {
    const hit = rows.find((row) => row.key === pair.key && Number.isFinite(row.value))
    if (!hit) return pair
    const date = hit.date && /^\d{4}-\d{2}-\d{2}/.test(hit.date) ? hit.date.slice(0, 10) : today
    return { ...pair, to: hit.value, to_date: date }
  })
}

export function chapterGrade(pairs: readonly SeasonPair[], today: IsoDay): { text_zh: string; celebrate: boolean } {
  const lines: string[] = []
  let celebrate = false
  for (const pair of pairs) {
    if (pair.to == null || !pair.from_date || !pair.to_date) continue
    const delta = pair.from === 0 ? null : ((pair.to - pair.from) / Math.abs(pair.from)) * 100
    const marker: LabMarkerInput = {
      key: pair.key,
      label_zh: pair.label_zh,
      unit: pair.unit,
      from: pair.from,
      to: pair.to,
      from_date: pair.from_date,
      to_date: pair.to_date,
      delta_pct: delta,
      band_down_pct: pair.band_down_pct,
      band_up_pct: pair.band_up_pct,
      band_verified: pair.band_verified,
      better: pair.better,
      verdict: null,
      blocked_by: pair.band_verified ? null : 'band not verified',
      same_lab: true,
    }
    const graded = gradeMarker(marker, today)
    const verifiedWin = pair.band_verified && graded.grade === 'beyond_band_better' && graded.tone === 'celebrate'
    if (verifiedWin) celebrate = true
    const headline = !pair.band_verified
      ? '波动范围还没核对，先不庆祝。'
      : graded.headline_zh.replace(/你确实年轻了|比实足年龄年轻/g, '变化了')
    lines.push(`${pair.label_zh} ${pair.from} → ${pair.to} ${pair.unit}。${headline}`)
  }
  if (lines.length === 0) return { text_zh: '', celebrate: false }
  const close = celebrate ? '这一季可以记下这次真实的变化。' : '先不把这次说成变好到可以庆祝。'
  return { text_zh: `${lines.join('')}${close}`, celebrate }
}

export function insightBody(days: number, doneTitles: readonly string[]): string {
  const done = doneTitles.map((title) => title.trim()).filter(Boolean).slice(0, 3)
  const tail = done.length > 0 ? `已经做完的有：${done.join('、')}。` : '还没有做完的任务。'
  return `你自己的记录有 ${days} 天。${tail}这张卡只说明这些记录是你留下的，不说明指标变好。`
}

export function seasonHeader(input: { pressure: boolean; title: string | null; week: number | null }): { show: boolean; text_zh: string } {
  if (!input.pressure || !input.title || input.week == null) return { show: false, text_zh: '' }
  return { show: true, text_zh: `本季 · ${input.title} · 第 ${input.week} 周` }
}

export function shareCardText(card: { rarity_zh: string; title_zh: string; body_zh: string }, displayName: string): string {
  const text = [`${card.rarity_zh} · ${card.title_zh}`, card.body_zh, '概率公开，没有付费，不能交易。稀有度不由指标决定。'].join('\n')
  return displayName ? text.split(displayName).join('') : text
}

export function shareRecapText(recap: string, displayName: string): string {
  const text = [recap.trim(), '这不是诊断。'].filter(Boolean).join('\n')
  return displayName ? text.split(displayName).join('') : text
}
