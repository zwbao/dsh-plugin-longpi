// Season, quest, unlock, streak and Codex state. One file is the source of truth
// (engage/state.json). Draws are earned by health actions. Rarity never reads a lab.

import { randomBytes } from 'node:crypto'
import { appendFileSync, chmodSync, existsSync, mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import type { Id, IsoDay, IsoTime } from '../contracts/common.ts'
import type { DrawGrant } from '../contracts/engagement.ts'
import type { Season, Quest, StreakState, Unlock } from '../contracts/engagement.ts'
import type { Bus, HealthEventPayloads, HealthEventType } from '../contracts/events.ts'
import type { FactPack } from '../contracts/factpack.ts'
import type { ActionKind } from '../contracts/surfaces.ts'
import type { CodexCard, DrawResult, Rarity } from '../contracts/codex.ts'
import { addDays, checkinStatus, daysBetween, isoDay, readCheckIns } from '../interventions.ts'
import { personMinor } from '../privacy/index.ts'
import { estimatedAge, FOCUS, readProfile } from '../profile.ts'
import { readSelf } from '../selfmeasure.ts'
import { calculatorIdentity } from '../subject.ts'
import { bindRecord } from '../bind.ts'
import { loadCatalog } from '../catalog.ts'
import { runSkill } from '../runner.ts'
import { libraryHome } from '../skills-provider.ts'
import { cardById, codexBlock, codexBlockZh, loadCodexPack, type CodexBlock } from './codex.ts'
import { drawOnce, oddsDisclosure, rarityZh } from './droptable.ts'
import { nudgeView, type NudgeState } from './nudges.ts'
import { offerForCard, viewFromStored, type MethodOffer, type StoredRecord } from './offer.ts'
import {
  applyRetestValues, chapterGrade, insightBody, materializeQuests, pairsFromFacts, resolvePersonal, seasonHeader, shareCardText, shareRecapText,
  type SeasonDraft, type SeasonFact, type SeasonPair,
} from './personal.ts'
import { readQuiet, seasonPressureOn } from './quiet.ts'
import { makeQuests, questProgress, type QuestFacts } from './quests.ts'
import { effectiveMode } from '../science/index.ts'
import { nOf1SeasonQuest } from '../science/nof1-model.ts'
import { commitmentOf } from './rng.ts'
import { chapterList, MIN_SEASON_DAYS, recapText, seasonSpan, seasonStatus, weekOf } from './seasons.ts'
import { computeStreak, daysInRange, milestonesUpTo, nextMilestone } from './streak.ts'
import { makeUnlocks, openUnlock, REMINDER_ZH } from './unlocks.ts'
import { weeklyText } from './weekly.ts'

/** 「9 月 10 日」, with the year when it is not this year. */
function dayZhE(iso: string | null | undefined): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '')
  if (!m) return iso ?? ''
  const md = `${Number(m[2])} 月 ${Number(m[3])} 日`
  return Number(m[1]) === new Date().getFullYear() ? md : `${m[1]} 年 ${md}`
}

const TITLES: Record<string, string> = {
  care: '先向医生问清需要咨询的事项',
  data: '补做缺失的检查',
  bioage: '本季关注身体年龄',
  cardio: '本季关注心血管',
  glucose: '本季关注血糖',
  weight: '本季关注体重',
  sleep: '本季关注睡眠',
  plan: '本季完成一件事',
}

interface StoredAction { key: string; day: IsoDay; kind: 'care' | 'hscrp' | 'waist' | 'retest' | 'life' | 'booked' | 'ferritin' | 'iron' }

interface CodexState {
  seed_hex: string
  commitment: string
  counter: number
  pity: number
  grants: DrawGrant[]
  owned: string[]
  choice: 'on' | 'off' | null
  draw_days: Record<string, number>
  utility_used: string[]
  notes: Record<string, string>
  offers: Record<string, MethodOffer>
}

interface CareFunnel { doctor_step: IsoDay | null; booked: IsoDay | null; visited: IsoDay | null }
interface InviteState { ready: boolean; reason: 'first_result' | 'doctor_step' | null; declined: boolean }
interface FamilyState { opted: boolean; shares: Array<{ id: string; kind: 'card' | 'recap'; at: string; text_zh: string }> }

interface State {
  version: 1
  season: Season | null
  recap_zh: string | null
  quests: Quest[]
  unlocks: Unlock[]
  streak: StreakState
  codex: CodexState
  actions: StoredAction[]
  rewarded: string[]
  nudge: NudgeState
  /** Season and daily wording on the home. Null until they opt in. */
  pressure: 'on' | 'off' | null
  weekly_zh: string | null
  facts: SeasonFact[]
  facts_fp: string
  coach_draft: SeasonDraft | null
  personal_origin: 'coach' | 'template' | 'rule' | null
  pairs: SeasonPair[]
  care: CareFunnel
  invite: InviteState
  family: FamilyState
  ended_by_retest: boolean
  record_fp: string
  applied_signature: string
}

interface Runtime {
  dataDir: () => string
  codexOn: () => boolean
  bus: Bus | null
}

let runtime: Runtime = { dataDir: () => '', codexOn: () => true, bus: null }

export function bindRuntime(next: Partial<Runtime>): void {
  runtime = { ...runtime, ...next }
}

export function boundDataDir(): string {
  return runtime.dataDir()
}

function emptyState(): State {
  return {
    version: 1,
    season: null,
    recap_zh: null,
    quests: [],
    unlocks: [],
    streak: { current: 0, best: 0, freezes_available: 0, frozen: [], last_active: null },
    codex: { seed_hex: '', commitment: '', counter: 0, pity: 0, grants: [], owned: [], choice: null, draw_days: {}, utility_used: [], notes: {}, offers: {} },
    actions: [],
    rewarded: [],
    nudge: { choice: null, dismissed: false, offered: false, last_shown: null },
    pressure: null,
    weekly_zh: null,
    facts: [],
    facts_fp: '',
    coach_draft: null,
    personal_origin: null,
    pairs: [],
    care: { doctor_step: null, booked: null, visited: null },
    invite: { ready: false, reason: null, declined: false },
    family: { opted: false, shares: [] },
    ended_by_retest: false,
    record_fp: '',
    applied_signature: '',
  }
}

function hydrate(raw: State): State {
  const base = emptyState()
  const codex = raw.codex ?? base.codex
  return {
    ...base,
    ...raw,
    quests: Array.isArray(raw.quests) ? raw.quests : [],
    unlocks: Array.isArray(raw.unlocks) ? raw.unlocks : [],
    actions: Array.isArray(raw.actions) ? raw.actions : [],
    rewarded: Array.isArray(raw.rewarded) ? raw.rewarded : [],
    facts: Array.isArray(raw.facts) ? raw.facts : [],
    pairs: Array.isArray(raw.pairs) ? raw.pairs : [],
    care: { ...base.care, ...(raw.care ?? {}) },
    invite: { ...base.invite, ...(raw.invite ?? {}) },
    family: {
      opted: raw.family?.opted === true,
      shares: Array.isArray(raw.family?.shares) ? raw.family.shares.slice(-20) : [],
    },
    applied_signature: typeof raw.applied_signature === 'string' ? raw.applied_signature : '',
    ended_by_retest: raw.ended_by_retest === true,
    personal_origin: raw.personal_origin === 'coach' || raw.personal_origin === 'template' || raw.personal_origin === 'rule' ? raw.personal_origin : null,
    codex: {
      ...base.codex,
      ...codex,
      grants: Array.isArray(codex.grants) ? codex.grants : [],
      owned: Array.isArray(codex.owned) ? codex.owned : [],
      draw_days: codex.draw_days ?? {},
      utility_used: Array.isArray(codex.utility_used) ? codex.utility_used : [],
      notes: codex.notes ?? {},
      offers: codex.offers ?? {},
    },
  }
}

function engageDir(dataDir: string): string {
  return join(dataDir, 'engage')
}

function readState(dataDir: string): State {
  const path = join(engageDir(dataDir), 'state.json')
  if (!existsSync(path)) return emptyState()
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as State
    if (!raw || raw.version !== 1 || !raw.codex || !raw.streak) throw new Error('version')
    if (raw.pressure !== 'on' && raw.pressure !== 'off') raw.pressure = null
    return hydrate(raw)
  } catch {
    try { renameSync(path, `${path}.damaged-${Date.now()}`) } catch { /* leave the damaged file if rename fails */ }
    return emptyState()
  }
}

function writeJson(path: string, value: unknown): void {
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.${randomBytes(3).toString('hex')}.tmp`
  writeFileSync(tmp, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}

function saveState(dataDir: string, state: State): void {
  const root = engageDir(dataDir)
  mkdirSync(root, { recursive: true, mode: 0o700 })
  writeJson(join(root, 'state.json'), state)
  writeJson(join(root, 'season.json'), { version: 1, season: state.season, recap_zh: state.recap_zh })
  writeJson(join(root, 'quests.json'), { version: 1, quests: state.quests })
  writeJson(join(root, 'unlocks.json'), { version: 1, unlocks: state.unlocks })
  writeJson(join(root, 'streak.json'), { version: 1, streak: state.streak })
  writeJson(join(root, 'codex.json'), {
    version: 1,
    commitment: state.codex.commitment,
    counter: state.codex.counter,
    pity: state.codex.pity,
    grants: state.codex.grants,
    owned: state.codex.owned,
    choice: state.codex.choice,
  })
}

function emit<T extends HealthEventType>(type: T, payload: HealthEventPayloads[T]): void {
  try { runtime.bus?.emit(type, payload, { module: 'M6', via: 'route' }) } catch { /* the bus is optional until M0 is wired */ }
}

interface World {
  today: IsoDay
  age: number | null
  accountAge: number | null
  sex: string
  subject: boolean
  subject_zh: string | null
  consent: boolean
  focus: string | null
  minorFlag: boolean
  memoryOptOut: boolean
  memoryNudge: boolean
  waist: boolean
  hscrp: boolean
  selfDays: IsoDay[]
  checkinDays: IsoDay[]
  doctorFirst: boolean
  displayName: string
  nOf1Done: boolean
}

function memoryFlags(dataDir: string): { minor: boolean; optOut: boolean; nudge: boolean } {
  const out = { minor: false, optOut: false, nudge: false }
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'memory.json'), 'utf8')) as { items?: unknown[] }
    for (const item of raw.items ?? []) {
      if (!item || typeof item !== 'object') continue
      const row = item as Record<string, unknown>
      if (row.status && row.status !== 'active') continue
      if (row.kind === 'condition' && Array.isArray(row.flags) && row.flags.includes('minor')) out.minor = true
      if (row.kind === 'preference' && row.key === 'codex_enabled' && row.value === false) out.optOut = true
      if (row.kind === 'preference' && row.key === 'nudge_in_workflow' && row.value === true) out.nudge = true
    }
  } catch { /* memory is M0's file; missing is normal */ }
  return out
}

function labsPath(dataDir: string): string {
  return join(dataDir, 'engage', 'labs.json')
}

/** Written when a journey sees hs-CRP or waist on the record, so the season stops asking for a test already on file. */
export function noteLabsOnFile(dataDir: string, labs: { hscrp: boolean; waist: boolean }): void {
  if (!dataDir) return
  const path = labsPath(dataDir)
  mkdirSync(dirname(path), { recursive: true, mode: 0o700 })
  const tmp = `${path}.${process.pid}.tmp`
  writeFileSync(tmp, `${JSON.stringify({ hscrp: labs.hscrp === true, waist: labs.waist === true })}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
}

function readLabsOnFile(dataDir: string): { hscrp: boolean; waist: boolean } {
  if (!dataDir) return { hscrp: false, waist: false }
  try {
    const raw = JSON.parse(readFileSync(labsPath(dataDir), 'utf8')) as { hscrp?: unknown; waist?: unknown }
    return { hscrp: raw?.hscrp === true, waist: raw?.waist === true }
  } catch {
    return { hscrp: false, waist: false }
  }
}

function readWorld(dataDir: string, now: Date): World {
  const today = isoDay(now)
  const profile = readProfile(dataDir)
  const year = Number(today.slice(0, 4))
  const accountAge = profile.age ?? estimatedAge(profile.birthYear, year)
  const identity = calculatorIdentity(profile)
  const memory = memoryFlags(dataDir)
  const self = readSelf(dataDir)
  const labs = readLabsOnFile(dataDir)
  let checkins: IsoDay[] = []
  try {
    const status = checkinStatus(readCheckIns(dataDir))
    const days = new Set<IsoDay>()
    for (const byDay of status.values()) for (const [day, done] of byDay) if (done) days.add(day)
    checkins = [...days]
  } catch { checkins = [] }
  return {
    today,
    age: identity.age,
    accountAge,
    sex: identity.sex,
    subject: identity.subject,
    subject_zh: profile.subject?.relationship_zh ?? null,
    consent: Boolean(profile.consent?.accepted_at),
    focus: profile.focus[0] ?? null,
    minorFlag: memory.minor || (identity.subject && identity.age != null && identity.age < 18),
    displayName: profile.displayName ?? '',
    memoryOptOut: memory.optOut,
    memoryNudge: memory.nudge,
    waist: self.some((row) => row.key === 'waist') || labs.waist,
    hscrp: labs.hscrp,
    selfDays: [...new Set(self.map((row) => row.date))],
    checkinDays: checkins,
    doctorFirst: false,
    nOf1Done: nOf1Finished(dataDir),
  }
}

function nOf1Finished(dataDir: string): boolean {
  if (!dataDir) return false
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'science', 'n-of-1.json'), 'utf8')) as { stopping?: { decision?: string } }
    const decision = raw.stopping?.decision
    return decision === 'stop_difference' || decision === 'stop_futility' || decision === 'stop_cap'
  } catch {
    return false
  }
}

function activeDays(state: State, world: World): IsoDay[] {
  const days = new Set<IsoDay>([...world.selfDays, ...world.checkinDays])
  for (const action of state.actions) if (action.kind !== 'life') days.add(action.day)
  return [...days]
}

function factsOf(state: State, world: World): QuestFacts & { allActive: IsoDay[]; waist: boolean; hscrp: boolean } {
  const season = state.season
  const waist = world.waist || state.actions.some((action) => action.kind === 'waist')
  const hscrp = world.hscrp || state.actions.some((action) => action.kind === 'hscrp')
  const careWithBrief = state.actions.some((action) => action.kind === 'care')
  const booked = state.actions.some((action) => action.kind === 'booked')
  const keys: Record<string, boolean> = {}
  for (const action of state.actions) {
    if (action.kind === 'iron' || action.kind === 'ferritin') keys.ferritin = true
    if (action.kind !== 'life' && action.kind !== 'care' && action.kind !== 'retest' && action.kind !== 'booked') keys[action.kind] = true
  }
  const allActive = activeDays(state, world)
  const inSeason = (day: IsoDay) => Boolean(season) && day >= season!.start && day <= (state.ended_by_retest ? world.today : season!.end)
  const windowStart = season ? addDays(season.start, MIN_SEASON_DAYS - 1) : world.today
  const retestInWindow = state.actions.some((action) => action.kind === 'retest' && action.day >= windowStart && action.day <= world.today)
  return {
    careWithBrief,
    booked,
    keys,
    waist,
    hscrp,
    activeDays: allActive.filter(inSeason).length,
    retestInWindow,
    nOf1Done: world.nOf1Done,
    allActive,
  }
}

/** On-device and simulated studies add one ordinary Codex quest. Off and live add nothing. */
function attachSimulatedTrial(state: State, season: Season): void {
  if (effectiveMode() === 'off') return
  if (state.quests.some((quest) => quest.id === 'qs-n-of-1')) return
  const raw = nOf1SeasonQuest(season.id)
  state.quests.push({
    id: raw.id,
    season_id: season.id,
    kind: raw.kind,
    title_zh: raw.title_zh,
    criteria: { event: raw.criteria.event, count: raw.criteria.count },
    progress: 0,
    status: 'open',
    reward: { draws: raw.reward.draws },
    origin: raw.origin,
  })
  season.quest_ids = state.quests.map((quest) => quest.id)
}

function blockOf(state: State, world: World): CodexBlock {
  const optedOut = state.codex.choice === 'off' || (state.codex.choice == null && world.memoryOptOut)
  if (world.subject) return codexBlock({ age: world.age, minorFlag: world.minorFlag, optOut: optedOut, configOn: runtime.codexOn() })
  const privacy = personMinor()
  if (privacy && !privacy.codex) return privacy.minor ? 'minor' : 'age_unknown'
  return codexBlock({ age: world.age, minorFlag: world.minorFlag, optOut: optedOut, configOn: runtime.codexOn() })
}

function personalize(state: State, season: Season): void {
  const built = resolvePersonal(state.facts, state.coach_draft)
  if (!built) {
    if (state.facts.length > 0 && !state.personal_origin) state.personal_origin = 'rule'
    return
  }
  const signature = `${built.origin}:${built.draft.title_zh}:${built.draft.quests.map((quest) => quest.id).join(',')}`
  if (state.applied_signature === signature) return
  if (state.quests.some((quest) => quest.status === 'done')) return
  season.title_zh = built.draft.title_zh
  season.theme = { focus: built.draft.focus, marker_keys: [...built.draft.marker_keys] }
  season.chapters = chapterList(built.draft.focus === 'care' || built.draft.focus === 'data' ? built.draft.focus : 'generic', season.chapters.length)
  state.quests = materializeQuests(season.id, built.draft, built.origin === 'coach' ? 'coach' : 'rule')
  season.quest_ids = state.quests.map((quest) => quest.id)
  state.personal_origin = built.origin
  state.applied_signature = signature
  if (state.pairs.length === 0) state.pairs = pairsFromFacts(state.facts)
}

function grant(state: State, world: World, kind: DrawGrant['kind'], day: IsoDay, earnedBy: Id): void {
  if (blockOf(state, world)) return
  state.codex.grants.push({ id: `gr${randomBytes(8).toString('hex')}`, kind, earned_by: earnedBy, granted: day })
  const last = state.codex.grants.at(-1)
  if (last) emit('codex.draw_earned', { grant_id: last.id, kind: last.kind, by_event: earnedBy })
}

function ensureSeed(state: State): void {
  if (state.codex.seed_hex) return
  const seed = randomBytes(32)
  state.codex.seed_hex = seed.toString('hex')
  state.codex.commitment = commitmentOf(seed)
}

function startSeason(state: State, world: World): void {
  const span = seasonSpan(world.today, null)
  const focus = world.doctorFirst ? 'care'
    : !world.waist || !world.hscrp ? 'data'
      : world.focus && (FOCUS as readonly string[]).includes(world.focus) ? world.focus
        : 'plan'
  const season: Season = {
    id: `sn${randomBytes(8).toString('hex')}`,
    kind: 'personal',
    title_zh: TITLES[focus] ?? TITLES.plan,
    theme: { focus: focus as Season['theme']['focus'], marker_keys: [!world.waist ? 'waist' : '', !world.hscrp ? 'hscrp' : ''].filter(Boolean) },
    start: span.start,
    end: span.end,
    retest_day: span.retest_day,
    status: 'active',
    chapters: chapterList(focus === 'care' || focus === 'data' ? focus : 'generic', span.weeks),
    quest_ids: [],
    unlock_ids: [],
    codex_set_id: 'set-library',
  }
  state.season = season
  state.recap_zh = null
  state.quests = makeQuests(season.id, { waist: !world.waist && !state.actions.some((action) => action.kind === 'waist'), hscrp: !world.hscrp && !state.actions.some((action) => action.kind === 'hscrp') })
  state.unlocks = makeUnlocks()
  season.quest_ids = state.quests.map((quest) => quest.id)
  season.unlock_ids = state.unlocks.map((unlock) => unlock.id)
  state.rewarded = state.rewarded.filter((id) => id.startsWith('presence:'))
  state.ended_by_retest = false
  state.applied_signature = ''
  if (state.streak.freezes_available < 1) state.streak.freezes_available = 1
  ensureSeed(state)
  personalize(state, season)
  emit('season.started', { season_id: season.id })
}

function reduce(state: State, world: World, now: Date): void {
  if (!world.consent) return
  if (!state.season) startSeason(state, world)
  else if (state.season) personalize(state, state.season)
  const season = state.season
  if (!season) return
  attachSimulatedTrial(state, season)
  const at = now.toISOString() as IsoTime
  const facts = factsOf(state, world)
  for (const unlock of state.unlocks) {
    const have = unlock.key === 'cvd_risk' ? facts.waist : unlock.key === 'bioage' ? facts.hscrp : false
    const next = openUnlock(unlock, have, at)
    if (next.status === 'unlocked' && unlock.status !== 'unlocked') emit('unlock.granted', { unlock_id: unlock.id, key: unlock.key })
    Object.assign(unlock, next)
  }
  let grantedToday = state.codex.grants.some((row) => row.granted === world.today)
  for (const quest of state.quests) {
    if (quest.status === 'done' || quest.status === 'waived') continue
    quest.progress = questProgress(quest, facts)
    if (quest.progress < quest.criteria.count) continue
    quest.status = 'done'
    emit('quest.completed', { quest_id: quest.id, season_id: quest.season_id, kind: quest.kind })
    if (!state.rewarded.includes(quest.id)) {
      state.rewarded.push(quest.id)
      grant(state, world, quest.reward.guaranteed_min_rarity ? 'care_guaranteed' : 'standard', world.today, quest.id)
      grantedToday = true
    }
  }
  // A draw at each cumulative milestone of days with a health action. State from before (one draw per active day)
  // has its milestones up to today counted as given, so an upgrade does not pour out back-dated draws.
  const total = facts.allActive.length
  if (!state.rewarded.includes('milestones:v1')) {
    if (state.rewarded.some((key) => key.startsWith('presence:'))) for (const m of milestonesUpTo(total)) state.rewarded.push(`milestone:${m}`)
    state.rewarded.push('milestones:v1')
  }
  for (const m of milestonesUpTo(total)) {
    if (state.rewarded.includes(`milestone:${m}`)) continue
    state.rewarded.push(`milestone:${m}`)
    grant(state, world, 'standard', world.today, `ms${m}`)
  }
  void grantedToday
  const computed = computeStreak(facts.allActive, state.streak.frozen.map((row) => row.day), world.today)
  state.streak.current = computed.current
  state.streak.best = Math.max(state.streak.best, computed.current)
  state.streak.last_active = computed.lastActive
  if (state.quests.some((quest) => quest.kind === 'retest' && quest.status === 'done')) state.ended_by_retest = true
  const status = state.ended_by_retest ? 'closed' : seasonStatus(season, world.today)
  season.status = status
  if (status === 'closed' && !state.recap_zh) {
    const graded = chapterGrade(state.pairs, world.today)
    const base = recapText({
      title: season.title_zh,
      start: season.start,
      end: season.end,
      weeks: season.chapters.length,
      done: state.quests.filter((quest) => quest.status === 'done').length,
      total: state.quests.length,
      days: facts.activeDays,
      draws: state.codex.counter,
      retest: facts.retestInWindow || state.ended_by_retest,
    })
    state.recap_zh = graded.text_zh ? `${base}${graded.text_zh}` : base
    emit('season.ended', { season_id: season.id, completed_quests: state.quests.filter((quest) => quest.status === 'done').length })
  }
  const open = state.quests.filter((quest) => quest.status === 'open').map((quest) => quest.title_zh)
  const locked = state.unlocks.find((unlock) => unlock.status === 'locked')
  state.weekly_zh = weeklyText({
    title: season.title_zh,
    week: weekOf(season, world.today),
    weeks: season.chapters.length,
    status,
    days_total: total,
    days_season: facts.activeDays,
    next_milestone: nextMilestone(total),
    done: state.quests.filter((quest) => quest.status === 'done').length,
    total: state.quests.length,
    open,
    reminder: locked ? (REMINDER_ZH[locked.key] ?? null) : null,
    retestDay: season.retest_day,
  })
}

export interface EngageView {
  ok: true
  needs_consent: boolean
  season: null | {
    id: string
    title_zh: string
    focus: string
    start: IsoDay
    end: IsoDay
    retest_day: IsoDay | null
    status: Season['status']
    week: number
    weeks: number
    chapters: Season['chapters']
    recap_zh: string | null
  }
  quests: Array<{ id: string; title_zh: string; kind: string; status: string; progress: number; count: number; reward_zh: string }>
  unlocks: Array<{ id: string; key: string; title_zh: string; teaser_zh: string; status: string; reminder_zh: string }>
  streak: { current: number; best: number; freezes_available: number; frozen: StreakState['frozen'] }
  /** What the person sees: days with a health action, cumulative; a draw at each milestone. */
  count: { total: number; season: number; next_milestone: number }
  codex: {
    enabled: boolean
    hidden: boolean
    reason: CodexBlock
    reason_zh: string
    odds_zh: string | null
    draws_available: number
    draws_today: number
    daily_cap: number
    commitment: string | null
    owned: Array<{ id: string; title_zh: string; body_zh: string; rarity: Rarity; rarity_zh: string; family: string; offer?: MethodOffer }>
  }
  weekly_zh: string | null
  reminder_zh: string | null
  nudge: { offer: boolean; enabled: boolean; show: boolean }
  /** False until they opt into the season. The quest list stays in the payload; the panel does not push it. */
  pressure: boolean
  personal_origin: 'coach' | 'template' | 'rule' | null
  invite: null | { show: true; title_zh: string; body_zh: string; odds_path: string }
  header: { show: boolean; text_zh: string }
  care_path: { doctor_step: IsoDay | null; booked: IsoDay | null; visited: IsoDay | null }
  family: { available: boolean; opted: boolean; subject_zh: string | null }
  subject_zh: string | null
}

function viewOf(state: State, world: World, dataDir = ''): EngageView {
  const season = state.season
  const block = season ? blockOf(state, world) : null
  const pack = season ? safePack() : null
  const shown = state.codex.owned.map((id) => pack ? cardById(pack, id) : null).filter((card): card is CodexCard => Boolean(card))
  const pressure = dataDir ? seasonPressureOn(readQuiet(dataDir)) : state.pressure === 'on'
  const nudge = nudgeView(
    { ...state.nudge, choice: state.nudge.choice ?? (world.memoryNudge ? 'on' : null) },
    world.today,
    pressure && Boolean(season) && season?.status !== 'closed',
  )
  const locked = state.unlocks.find((unlock) => unlock.status === 'locked')
  return {
    ok: true,
    needs_consent: !world.consent,
    season: season ? {
      id: season.id,
      title_zh: season.title_zh,
      focus: season.theme.focus,
      start: season.start,
      end: season.end,
      retest_day: season.retest_day,
      status: season.status,
      week: weekOf(season, world.today),
      weeks: season.chapters.length,
      chapters: season.chapters,
      recap_zh: state.recap_zh,
    } : null,
    quests: state.quests.map((quest) => ({
      id: quest.id,
      title_zh: quest.title_zh,
      kind: quest.kind,
      status: quest.status,
      progress: quest.progress,
      count: quest.criteria.count,
      reward_zh: quest.reward.guaranteed_min_rarity ? '完成后获得一张银卡或更高等级的卡' : '完成后获得一张卡',
    })),
    unlocks: state.unlocks.map((unlock) => ({
      id: unlock.id,
      key: unlock.key,
      title_zh: unlock.title_zh,
      teaser_zh: unlock.status === 'unlocked' ? '已解锁' : unlock.teaser_zh,
      status: unlock.status,
      reminder_zh: unlock.status === 'unlocked' ? '' : (REMINDER_ZH[unlock.key] ?? unlock.teaser_zh),
    })),
    streak: {
      current: state.streak.current,
      best: state.streak.best,
      freezes_available: state.streak.freezes_available,
      frozen: state.streak.frozen,
    },
    count: (() => {
      const facts = factsOf(state, world)
      return { total: facts.allActive.length, season: season ? facts.activeDays : 0, next_milestone: nextMilestone(facts.allActive.length) }
    })(),
    codex: {
      enabled: !block && Boolean(season),
      hidden: Boolean(block) || !season,
      reason: season ? block : (world.age == null && world.consent ? 'age_unknown' : block),
      reason_zh: !world.consent ? '请先完成知情同意。' : codexBlockZh(block),
      odds_zh: !block && pack ? oddsDisclosure(pack.table, pack.cards) : null,
      draws_available: block ? 0 : state.codex.grants.filter((row) => !row.used_by).length,
      draws_today: state.codex.draw_days[world.today] ?? 0,
      daily_cap: pack?.table.daily_cap ?? 3,
      commitment: block ? null : (state.codex.commitment || null),
      owned: (block ? [] : shown).map((card) => ({
        id: card.id,
        title_zh: card.title_zh,
        body_zh: state.codex.notes[card.id] || card.body_zh,
        rarity: card.rarity,
        rarity_zh: rarityZh(card.rarity),
        family: card.family,
        ...(state.codex.offers[card.id] ? { offer: state.codex.offers[card.id] } : {}),
      })),
    },
    weekly_zh: state.weekly_zh,
    reminder_zh: !pressure ? null : locked && season && season.status !== 'closed' ? (REMINDER_ZH[locked.key] ?? null) : (season && season.status !== 'closed' && state.quests.some((quest) => quest.status === 'open') ? '本季还有未完成的任务，请打开健康页查看' : null),
    nudge,
    pressure,
    personal_origin: state.personal_origin,
    invite: world.consent && state.invite.ready && !state.invite.declined && !pressure && season ? {
      show: true,
      title_zh: season.title_zh,
      body_zh: '一个赛季约 8–12 周，从现在到你下次复查。期间设有几个小目标，复查当天一起回顾完成情况，然后开始下一个赛季。长寿图鉴免费，每位成年人抽到各类卡的概率相同。未满 18 岁不开放图鉴。',
      odds_path: '/api/longpi/codex/odds',
    } : null,
    header: seasonHeader({ pressure, title: season?.title_zh ?? null, week: season ? weekOf(season, world.today) : null }),
    care_path: { ...state.care },
    family: {
      available: (world.accountAge ?? -1) >= 18 && (world.age ?? -1) >= 18,
      opted: state.family.opted,
      subject_zh: world.subject_zh,
    },
    subject_zh: world.subject ? world.subject_zh : null,
  }
}

function safePack() {
  try { return loadCodexPack() } catch { return null }
}

export function syncEngage(dataDir: string, now: Date = new Date()): EngageView {
  if (!dataDir) {
    const blank = emptyState()
    return viewOf(blank, { today: isoDay(now), age: null, accountAge: null, sex: 'unknown', subject: false, subject_zh: null, consent: false, focus: null, minorFlag: false, memoryOptOut: false, memoryNudge: false, waist: false, hscrp: false, selfDays: [], checkinDays: [], doctorFirst: false, displayName: '', nOf1Done: false }, dataDir)
  }
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (!world.consent) return viewOf(state, world, dataDir)
  reduce(state, world, now)
  saveState(dataDir, state)
  return viewOf(state, world, dataDir)
}

export function plainReminderOf(dataDir: string): string | null {
  if (!dataDir || !seasonPressureOn(readQuiet(dataDir))) return null
  const state = readState(dataDir)
  if (!state.season || state.season.status === 'closed') return null
  const locked = state.unlocks.find((unlock) => unlock.status === 'locked')
  if (locked) return REMINDER_ZH[locked.key] ?? null
  if (state.quests.some((quest) => quest.status === 'open')) return '本季还有未完成的任务，请打开健康页查看'
  return null
}

function addAction(state: State, kind: StoredAction['kind'], day: IsoDay): boolean {
  const key = `${kind}:${day}`
  if (state.actions.some((action) => action.key === key)) return false
  state.actions.push({ key, day, kind })
  return true
}

export type EngageAction =
  | { action: 'care_visit'; with_brief?: boolean }
  | { action: 'book'; department_zh?: string }
  | { action: 'addon'; key: string }
  | { action: 'retest'; measurements?: Array<{ key: string; value: number; date?: string }> }
  | { action: 'next_season' }

export function actEngage(dataDir: string, action: EngageAction, now: Date = new Date()): { ok: boolean; error?: string; note?: string; view: EngageView } {
  const world = readWorld(dataDir, now)
  if (!world.consent) return { ok: false, error: '请先完成知情同意，再开始本季。', view: syncEngage(dataDir, now) }
  const state = readState(dataDir)
  if (action.action === 'next_season') {
    if (!state.season || seasonStatus(state.season, world.today) !== 'closed') {
      reduce(state, world, now)
      saveState(dataDir, state)
      return { ok: false, error: '本季尚未结束。', view: viewOf(state, world, dataDir) }
    }
    state.season = null
    state.quests = []
    state.unlocks = []
    state.recap_zh = null
    state.weekly_zh = null
    state.ended_by_retest = false
    state.applied_signature = ''
    state.pairs = state.pairs.map((pair) => pair.to == null ? pair : { ...pair, from: pair.to, from_date: pair.to_date ?? pair.from_date, to: null, to_date: null })
    state.rewarded = state.rewarded.filter((id) => id.startsWith('presence:'))
  } else if (action.action === 'book') {
    addAction(state, 'booked', world.today)
    if (!state.care.booked) state.care.booked = world.today
    emit('care.booked', { department_zh: action.department_zh?.slice(0, 40) || '医生', day: world.today })
  } else if (action.action === 'care_visit') {
    if (!action.with_brief) return { ok: false, error: '需携带简报就诊才算完成。简报可在健康页准备。', view: syncEngage(dataDir, now) }
    addAction(state, 'care', world.today)
    if (!state.care.visited) state.care.visited = world.today
  } else if (action.action === 'addon') {
    if (action.key !== 'hscrp' && action.key !== 'waist' && action.key !== 'ferritin' && action.key !== 'iron') return { ok: false, error: '仅可记录腰围、hs-CRP 或铁蛋白。', view: syncEngage(dataDir, now) }
    addAction(state, action.key === 'iron' ? 'ferritin' : action.key, world.today)
  } else if (action.action === 'retest') {
    addAction(state, 'retest', world.today)
    if (action.measurements && action.measurements.length > 0) state.pairs = applyRetestValues(state.pairs, action.measurements, world.today)
    if (!state.season) reduce(state, world, now)
    const season = state.season
    const windowStart = season ? addDays(season.start, MIN_SEASON_DAYS - 1) : world.today
    if (season && world.today < windowStart) {
      reduce(state, world, now)
      saveState(dataDir, state)
      return { ok: true, note: `已记录。复测窗口自 ${dayZhE(windowStart)}开始，届时复测才算完成此任务。`, view: viewOf(state, world, dataDir) }
    }
  }
  reduce(state, world, now)
  saveState(dataDir, state)
  return { ok: true, view: viewOf(state, world, dataDir) }
}

export function freezeEngage(dataDir: string, input: { reason: 'sick' | 'travel' | 'other'; from: IsoDay; to: IsoDay }, now: Date = new Date()): { ok: boolean; error?: string; view: EngageView } {
  const synced = syncEngage(dataDir, now)
  if (synced.needs_consent || !synced.season) return { ok: false, error: '请先完成知情同意，再开始本季。', view: synced }
  const state = readState(dataDir)
  const world = readWorld(dataDir, now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.to < input.from) {
    return { ok: false, error: '日期格式须为 YYYY-MM-DD，且结束日期不早于开始日期。', view: synced }
  }
  if (daysBetween(input.from, input.to) > 13) return { ok: false, error: '一次最多记 14 天。', view: synced }
  const active = new Set(activeDays(state, world))
  const days = daysInRange(input.from, input.to, world.today).filter((day) => !active.has(day) && !state.streak.frozen.some((row) => row.day === day))
  if (days.length === 0) return { ok: false, error: '这些日期已有记录或尚未到来。', view: synced }
  // Counts are cumulative, so a sick or travel day costs nothing and is never rationed; it only quiets reminders.
  for (const day of days) {
    state.streak.frozen.push({ day, reason: input.reason, event_id: `fr${randomBytes(6).toString('hex')}` })
    emit('streak.frozen', { day, reason: input.reason })
  }
  reduce(state, world, now)
  saveState(dataDir, state)
  return { ok: true, view: viewOf(state, world, dataDir) }
}

export function prefsEngage(dataDir: string, input: { codex?: boolean; nudge?: boolean; dismiss?: boolean; offerSeen?: boolean; shown?: boolean; pressure?: boolean; family?: boolean; declineInvite?: boolean }, now: Date = new Date()): EngageView {
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (input.codex === true) state.codex.choice = 'on'
  if (input.codex === false) state.codex.choice = 'off'
  if (input.nudge === true) state.nudge.choice = 'on'
  if (input.nudge === false) { state.nudge.choice = 'off'; state.nudge.dismissed = true }
  if (input.pressure === true) state.pressure = 'on'
  if (input.pressure === false) state.pressure = 'off'
  if (input.declineInvite) state.invite.declined = true
  if (input.family === false) state.family.opted = false
  if (input.family === true && (world.accountAge ?? -1) >= 18 && (world.age ?? -1) >= 18) state.family.opted = true
  if (input.dismiss) state.nudge.dismissed = true
  if (input.offerSeen) state.nudge.offered = true
  if (input.shown) {
    state.nudge.last_shown = world.today
    emit('nudge.shown', { nudge_id: `ng${randomBytes(6).toString('hex')}`, where: 'overlay' })
  }
  if (world.consent) reduce(state, world, now)
  if (world.consent || input.codex != null || input.nudge != null || input.pressure != null || input.family != null || input.declineInvite) saveState(dataDir, state)
  return viewOf(state, world, dataDir)
}

export interface DrawResponse {
  ok: boolean
  error?: string
  reason?: string
  view: EngageView
  card?: { id: string; title_zh: string; body_zh: string; rarity: Rarity; rarity_zh: string; family: string; duplicate: boolean; offer?: MethodOffer }
  questions_zh?: string[]
  deep_dive_zh?: string
  pity_before?: number
  commitment?: string
}

export function drawEngage(dataDir: string, now: Date = new Date()): DrawResponse {
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (!world.consent) return { ok: false, reason: 'consent', error: '请先完成知情同意。', view: viewOf(state, world, dataDir) }
  reduce(state, world, now)
  const block = blockOf(state, world)
  if (block) {
    saveState(dataDir, state)
    return { ok: false, reason: block, error: codexBlockZh(block), view: viewOf(state, world, dataDir) }
  }
  const pack = safePack()
  if (!pack) {
    saveState(dataDir, state)
    return { ok: false, reason: 'pack', error: '安装包中尚未包含图鉴卡组。', view: viewOf(state, world, dataDir) }
  }
  const grantRow = state.codex.grants.find((row) => !row.used_by)
  if (!grantRow) {
    saveState(dataDir, state)
    return { ok: false, reason: 'no_grant', error: '暂无抽卡次数。完成一项健康行动（测量、记录、带着简报就诊或复测）后即可获得。', view: viewOf(state, world, dataDir) }
  }
  const usedToday = state.codex.draw_days[world.today] ?? 0
  if (usedToday >= pack.table.daily_cap) {
    saveState(dataDir, state)
    return { ok: false, reason: 'daily_cap', error: `今日 ${pack.table.daily_cap} 次抽取已用完，请明天再抽；剩余次数会保留。`, view: viewOf(state, world, dataDir) }
  }
  ensureSeed(state)
  const seed = Buffer.from(state.codex.seed_hex, 'hex')
  const days = new Set(activeDays(state, world)).size
  const extra = pack.cards.filter((card) => card.insight && days >= card.insight.min_days_of_data).map((card) => card.id)
  const drawn = drawOnce({
    table: pack.table,
    cards: pack.cards,
    seed,
    counter: state.codex.counter,
    pityBefore: state.codex.pity,
    guarantee: grantRow.kind === 'care_guaranteed' ? pack.table.care_guarantee : null,
    owned: new Set(state.codex.owned),
    extraIds: extra,
    at: now.toISOString(),
    grantId: grantRow.id,
  })
  grantRow.used_by = drawn.result.id
  state.codex.counter += 1
  state.codex.pity = drawn.pityAfter
  state.codex.draw_days[world.today] = usedToday + 1
  const first = !state.codex.owned.includes(drawn.card.id)
  if (first) state.codex.owned.push(drawn.card.id)
  if (drawn.card.family === 'insight') {
    const done = state.quests.filter((quest) => quest.status === 'done').map((quest) => quest.title_zh)
    state.codex.notes[drawn.card.id] = insightBody(days, done)
  }
  if (drawn.card.family === 'method' || drawn.card.family === 'species' || drawn.card.evidence_tier === 'animal' || drawn.card.evidence_tier === 'cell') {
    state.codex.offers[drawn.card.id] = offerForCard(drawn.card, libraryHome(), viewFromStored(libraryHome(), readRecord(dataDir)))
  }
  let questions: string[] | undefined
  let deep: string | undefined
  if (first && drawn.card.utility === 'streak_freeze') {
    state.streak.freezes_available += 1
    state.codex.utility_used.push(drawn.card.id)
  } else if (drawn.card.utility === 'doctor_questions') {
    const locked = state.unlocks.filter((unlock) => unlock.status === 'locked').map((unlock) => `是否补做「${unlock.title_zh}」？`)
    questions = ['这次最该先看的一项是什么？', '有没有需要复查或加测的项目？', ...locked].slice(0, 3)
  } else if (drawn.card.utility === 'deep_dive') {
    const method = state.codex.owned.map((id) => cardById(pack, id)).find((card) => card?.family === 'method')
    deep = method ? `可以阅读「${method.title_zh}」。它讲的是研究方法，不是你的检查结论。` : '尚无方法卡。完成一项健康行动后即可抽取。'
  }
  appendDraw(dataDir, drawn.result)
  emit('codex.drawn', { draw_id: drawn.result.id, card_id: drawn.card.id, rarity: drawn.card.rarity })
  saveState(dataDir, state)
  return {
    ok: true,
    view: viewOf(state, world, dataDir),
    card: {
      id: drawn.card.id,
      title_zh: drawn.card.title_zh,
      body_zh: state.codex.notes[drawn.card.id] || drawn.card.body_zh,
      rarity: drawn.card.rarity,
      rarity_zh: rarityZh(drawn.card.rarity),
      family: drawn.card.family,
      duplicate: drawn.result.duplicate,
      ...(state.codex.offers[drawn.card.id] ? { offer: state.codex.offers[drawn.card.id] } : {}),
    },
    ...(questions ? { questions_zh: questions } : {}),
    ...(deep ? { deep_dive_zh: deep } : {}),
    pity_before: drawn.result.pity_before,
    commitment: state.codex.commitment,
  }
}

function appendDraw(dataDir: string, result: DrawResult): void {
  const path = join(engageDir(dataDir), 'draws.jsonl')
  mkdirSync(engageDir(dataDir), { recursive: true, mode: 0o700 })
  appendFileSync(path, `${JSON.stringify(result)}\n`, { mode: 0o600 })
  try { chmodSync(path, 0o600) } catch { /* the file is already private if it existed */ }
}

export function logLifeEngage(dataDir: string, input: { event: 'sick' | 'travel' | 'injury' | 'surgery' | 'pregnancy' | 'bereavement' | 'shift_work' | 'other'; from: IsoDay; to: IsoDay | null; note?: string }, now: Date = new Date()): { ok: boolean; error?: string; froze: IsoDay[]; view: EngageView } {
  const reason = input.event === 'sick' ? 'sick' : input.event === 'travel' ? 'travel' : input.event === 'injury' ? 'other' : null
  const from = input.from
  const to = input.to ?? input.from
  emit('life_event.logged', { memory_id: `lf${randomBytes(6).toString('hex')}`, event: input.event, from, to: input.to })
  if (!reason) {
    const view = syncEngage(dataDir, now)
    return { ok: true, froze: [], view }
  }
  const frozen = freezeEngage(dataDir, { reason, from, to }, now)
  return { ok: frozen.ok, error: frozen.error, froze: frozen.ok ? frozen.view.streak.frozen.map((row) => row.day).filter((day) => day >= from && day <= to) : [], view: frozen.view }
}

function readRecord(dataDir: string): StoredRecord | null {
  try {
    const raw = JSON.parse(readFileSync(join(engageDir(dataDir), 'record.json'), 'utf8')) as StoredRecord
    if (!raw || !Array.isArray(raw.indicators)) return null
    return {
      age: typeof raw.age === 'number' ? raw.age : null,
      sex: typeof raw.sex === 'string' ? raw.sex : 'unknown',
      indicators: raw.indicators.slice(0, 80),
    }
  } catch {
    return null
  }
}

function writeRecord(dataDir: string, record: StoredRecord): void {
  writeJson(join(engageDir(dataDir), 'record.json'), {
    age: record.age,
    sex: record.sex,
    indicators: record.indicators.slice(0, 80).map((row) => ({
      name: String(row.name ?? '').slice(0, 80),
      value: String(row.value ?? '').slice(0, 40),
      unit: String(row.unit ?? '').slice(0, 20),
      ...(row.loinc ? { loinc: String(row.loinc).slice(0, 20) } : {}),
      ...(row.date ? { date: String(row.date).slice(0, 10) } : {}),
    })),
  })
}

export function noteSeasonContext(dataDir: string, input: {
  facts: SeasonFact[]
  doctorStep?: boolean
  firstResult?: boolean
  draft?: SeasonDraft | null
  record?: StoredRecord | null
}, now: Date = new Date()): EngageView {
  if (!dataDir) return syncEngage(dataDir, now)
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  const fp = input.facts.map((fact) => `${fact.id}:${fact.rule}`).join('|')
  let changed = false
  if (fp !== state.facts_fp) {
    state.facts = input.facts.slice(0, 12).map((fact) => ({
      id: String(fact.id).slice(0, 80),
      rule: String(fact.rule).slice(0, 80),
      text_zh: String(fact.text_zh).slice(0, 240),
      refs: (fact.refs ?? []).filter((ref) => Number.isFinite(ref.value)).slice(0, 4).map((ref) => ({
        key: String(ref.key).slice(0, 40),
        label_zh: String(ref.label_zh).slice(0, 40),
        value: ref.value,
        unit: String(ref.unit ?? '').slice(0, 20),
        date: ref.date ? String(ref.date).slice(0, 10) : null,
      })),
    }))
    state.facts_fp = fp
    changed = true
  }
  if (input.draft) {
    state.coach_draft = input.draft
    changed = true
  }
  if (input.doctorStep && !state.care.doctor_step) {
    state.care.doctor_step = world.today
    changed = true
  }
  if ((input.firstResult || input.doctorStep) && !state.invite.declined && !state.invite.ready) {
    state.invite.ready = true
    state.invite.reason = input.doctorStep ? 'doctor_step' : 'first_result'
    changed = true
  }
  if (input.record) {
    const stamp = `${input.record.age ?? ''}:${input.record.sex}:${input.record.indicators.length}`
    if (stamp !== state.record_fp) {
      state.record_fp = stamp
      writeRecord(dataDir, input.record)
      changed = true
    }
  }
  if (!changed && state.season) return viewOf(state, world, dataDir)
  if (world.consent) reduce(state, world, now)
  if (world.consent || changed) saveState(dataDir, state)
  return viewOf(state, world, dataDir)
}

export function shareEngage(dataDir: string, input: { kind: 'card' | 'recap'; card_id?: string }, now: Date = new Date()): { ok: boolean; error?: string; text_zh?: string; view: EngageView } {
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  const view = () => viewOf(state, world, dataDir)
  if ((world.accountAge ?? -1) < 18 || (world.age ?? -1) < 18) return { ok: false, error: '家人圈只对成年人开放。', view: view() }
  if (!state.family.opted) return { ok: false, error: '请先开启家人圈。', view: view() }
  let text = ''
  if (input.kind === 'recap') {
    if (!state.recap_zh) return { ok: false, error: '本季尚无回顾。', view: view() }
    text = shareRecapText(state.recap_zh, world.displayName)
  } else {
    const pack = safePack()
    const card = pack && input.card_id ? cardById(pack, input.card_id) : null
    if (!card || !state.codex.owned.includes(card.id)) return { ok: false, error: '只能分享已经抽到的卡。', view: view() }
    if (blockOf(state, world)) return { ok: false, error: '图鉴未开启，无法分享卡片。', view: view() }
    text = shareCardText({
      rarity_zh: rarityZh(card.rarity),
      title_zh: card.title_zh,
      body_zh: state.codex.notes[card.id] || card.body_zh,
    }, world.displayName)
  }
  state.family.shares.push({ id: `sh${randomBytes(4).toString('hex')}`, kind: input.kind, at: now.toISOString(), text_zh: text })
  state.family.shares = state.family.shares.slice(-20)
  saveState(dataDir, state)
  return { ok: true, text_zh: text, view: viewOf(state, world, dataDir) }
}

export async function runCodexMethod(dataDir: string, cardId: string, now: Date = new Date()): Promise<{ ok: boolean; error?: string; text_zh: string; label: string | null; ran: boolean; view: EngageView }> {
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (world.consent) reduce(state, world, now)
  const denied = (error: string, text = error) => {
    saveState(dataDir, state)
    return { ok: false, error, text_zh: text, label: null, ran: false, view: viewOf(state, world, dataDir) }
  }
  if (blockOf(state, world)) return denied(codexBlockZh(blockOf(state, world)))
  const pack = safePack()
  const card = pack ? cardById(pack, cardId) : null
  if (!card || !state.codex.owned.includes(card.id)) return denied('只能计算已经抽到的方法卡。')
  const home = libraryHome()
  const offer = state.codex.offers[card.id] ?? offerForCard(card, home, viewFromStored(home, readRecord(dataDir)))
  state.codex.offers[card.id] = offer
  if (offer.kind === 'evidence') {
    saveState(dataDir, state)
    return { ok: true, text_zh: offer.text_zh, label: 'evidence-only', ran: false, view: viewOf(state, world, dataDir) }
  }
  if (offer.kind !== 'run' || !offer.skill) {
    saveState(dataDir, state)
    return { ok: false, error: offer.text_zh, text_zh: offer.text_zh, label: offer.label, ran: false, view: viewOf(state, world, dataDir) }
  }
  const catalog = loadCatalog(home)
  const skill = catalog.cards.find((item) => item.name === offer.skill)
  const stored = viewFromStored(home, readRecord(dataDir))
  if (!skill || !stored) return denied(offer.text_zh)
  const report = bindRecord(skill, stored)
  if (!report.ok) {
    saveState(dataDir, state)
    return { ok: false, error: offer.text_zh, text_zh: offer.text_zh, label: report.label, ran: false, view: viewOf(state, world, dataDir) }
  }
  const ran = await runSkill({
    home,
    dataDir,
    name: skill.name,
    args: [],
    files: [],
    binding: {
      skill: skill.name,
      inputs: Object.fromEntries(report.inputs_used.map((row) => [row.input, {
        source_row_id: row.source_row_id,
        value: row.value,
        unit: row.unit,
        provenance: row.provenance,
        quote: row.quote,
      }])),
    },
    bindingView: stored,
    python: 'python3',
    timeoutMs: 8000,
    revision: catalog.revision,
    profile: { age: stored.profile?.age ?? null, sex: stored.profile?.sex ?? 'unknown' },
    useProfile: true,
  })
  saveState(dataDir, state)
  const label = ran.method?.label ?? offer.label
  return {
    ok: ran.ok,
    text_zh: offer.text_zh,
    label,
    ran: true,
    ...(ran.ok ? {} : { error: ran.error || '本次未能计算出结果。' }),
    view: viewOf(state, world, dataDir),
  }
}

export function careMetrics(dataDir: string, now: Date = new Date()): {
  origin: State['personal_origin']
  title: string | null
  pressure: boolean
  doctor_step: IsoDay | null
  booked: IsoDay | null
  visited: IsoDay | null
  days_to_first_care: number | null
  quests_done: number
  quests_total: number
  draws: number
} {
  const view = syncEngage(dataDir, now)
  const state = readState(dataDir)
  const first = [state.care.booked, state.care.visited].filter((day): day is IsoDay => Boolean(day)).sort()[0] ?? null
  return {
    origin: state.personal_origin,
    title: view.season?.title_zh ?? null,
    pressure: view.pressure,
    doctor_step: state.care.doctor_step,
    booked: state.care.booked,
    visited: state.care.visited,
    days_to_first_care: state.care.doctor_step && first ? daysBetween(state.care.doctor_step, first) : null,
    quests_done: view.quests.filter((quest) => quest.status === 'done').length,
    quests_total: view.quests.length,
    draws: state.codex.counter,
  }
}

export function engagementSummary(): FactPack['engagement'] {
  const dataDir = runtime.dataDir()
  if (!dataDir) return null
  try {
    const view = syncEngage(dataDir, new Date())
    if (!view.season) return null
    return {
      season_title_zh: view.season.title_zh,
      week: view.season.week,
      days_total: view.count.total,
      next_milestone: view.count.next_milestone,
      streak: view.streak.current,
      freezes_left: view.streak.freezes_available,
      open_quests: view.quests.filter((quest) => quest.status === 'open').length,
      draws_available: view.codex.enabled ? view.codex.draws_available : 0,
    }
  } catch {
    return null
  }
}

export function candidateSeeds(dataDir: string, now: Date = new Date()): Array<{ id: string; kind: ActionKind; priority: number; title_zh: string; detail_zh: string; prompt_zh: string }> {
  let view: EngageView
  try { view = syncEngage(dataDir, now) } catch { return [] }
  if (!view.season || view.needs_consent) return []
  const out: Array<{ id: string; kind: ActionKind; priority: number; title_zh: string; detail_zh: string; prompt_zh: string }> = []
  for (const unlock of view.unlocks) {
    if (unlock.status !== 'locked') continue
    out.push({
      id: unlock.key === 'cvd_risk' ? 'nba-cvd-risk' : 'nba-bioage-hs',
      kind: unlock.key === 'cvd_risk' ? 'self_measure' : 'book_addon_test',
      priority: 46,
      title_zh: unlock.teaser_zh,
      detail_zh: unlock.reminder_zh,
      prompt_zh: unlock.key === 'cvd_risk' ? '帮我记下今天的腰围' : '下次体检我想加测超敏 C 反应蛋白，帮我写进要问医生的问题',
    })
  }
  const quest = view.quests.find((row) => row.status === 'open')
  if (quest && view.pressure) out.push({ id: 'nba-season-quest', kind: 'season_quest', priority: 42, title_zh: quest.title_zh, detail_zh: '本赛季只需完成几件事，其余时间无需打开。', prompt_zh: '这个赛季我现在该做什么？' })
  if (view.codex.enabled && view.codex.draws_available > 0) out.push({ id: 'nba-claim-draw', kind: 'claim_draw', priority: 38, title_zh: '有一次图鉴抽取机会', detail_zh: '抽取次数来自健康行动，无需付费。', prompt_zh: '我想抽一张长寿图鉴' })
  return out
}

