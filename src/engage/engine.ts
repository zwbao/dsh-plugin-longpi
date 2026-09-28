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
import { cardById, codexBlock, codexBlockZh, loadCodexPack, type CodexBlock } from './codex.ts'
import { drawOnce, oddsDisclosure, rarityZh } from './droptable.ts'
import { nudgeView, type NudgeState } from './nudges.ts'
import { makeQuests, questProgress, type QuestFacts } from './quests.ts'
import { commitmentOf } from './rng.ts'
import { chapterList, recapText, seasonSpan, seasonStatus, weekOf } from './seasons.ts'
import { computeStreak, daysInRange } from './streak.ts'
import { makeUnlocks, openUnlock, REMINDER_ZH } from './unlocks.ts'
import { weeklyText } from './weekly.ts'

const TITLES: Record<string, string> = {
  care: '先把该问医生的事问完',
  data: '补上缺的那一项检查',
  bioage: '这一季看身体年龄',
  cardio: '这一季看心血管',
  glucose: '这一季看血糖',
  weight: '这一季看体重',
  sleep: '这一季看睡眠',
  plan: '这一季把一件事做完',
}

interface StoredAction { key: string; day: IsoDay; kind: 'care' | 'hscrp' | 'waist' | 'retest' | 'life' }

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
}

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
  weekly_zh: string | null
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
    codex: { seed_hex: '', commitment: '', counter: 0, pity: 0, grants: [], owned: [], choice: null, draw_days: {}, utility_used: [] },
    actions: [],
    rewarded: [],
    nudge: { choice: null, dismissed: false, offered: false, last_shown: null },
    weekly_zh: null,
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
    return raw
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

function readWorld(dataDir: string, now: Date): World {
  const today = isoDay(now)
  const profile = readProfile(dataDir)
  const year = Number(today.slice(0, 4))
  const age = profile.age ?? estimatedAge(profile.birthYear, year)
  const memory = memoryFlags(dataDir)
  const self = readSelf(dataDir)
  let checkins: IsoDay[] = []
  try {
    const status = checkinStatus(readCheckIns(dataDir))
    const days = new Set<IsoDay>()
    for (const byDay of status.values()) for (const [day, done] of byDay) if (done) days.add(day)
    checkins = [...days]
  } catch { checkins = [] }
  return {
    today,
    age,
    consent: Boolean(profile.consent?.accepted_at),
    focus: profile.focus[0] ?? null,
    minorFlag: memory.minor,
    memoryOptOut: memory.optOut,
    memoryNudge: memory.nudge,
    waist: self.some((row) => row.key === 'waist'),
    hscrp: false,
    selfDays: [...new Set(self.map((row) => row.date))],
    checkinDays: checkins,
    doctorFirst: false,
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
  const allActive = activeDays(state, world)
  const inSeason = (day: IsoDay) => Boolean(season) && day >= season!.start && day <= season!.end
  const windowStart = season ? addDays(season.end, -13) : world.today
  const retestInWindow = state.actions.some((action) => action.kind === 'retest' && action.day >= windowStart && action.day <= (season?.end ?? action.day))
  return {
    careWithBrief,
    waist,
    hscrp,
    activeDays: allActive.filter(inSeason).length,
    retestInWindow,
    allActive,
  }
}

function blockOf(state: State, world: World): CodexBlock {
  const privacy = personMinor()
  if (privacy && !privacy.codex) return privacy.minor ? 'minor' : 'age_unknown'
  const optedOut = state.codex.choice === 'off' || (state.codex.choice == null && world.memoryOptOut)
  return codexBlock({ age: world.age, minorFlag: world.minorFlag, optOut: optedOut, configOn: runtime.codexOn() })
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
  state.quests = makeQuests(season.id, { waist: !world.waist && !state.actions.some((action) => action.kind === 'waist'), hscrp: true })
  state.unlocks = makeUnlocks()
  season.quest_ids = state.quests.map((quest) => quest.id)
  season.unlock_ids = state.unlocks.map((unlock) => unlock.id)
  state.rewarded = state.rewarded.filter((id) => id.startsWith('presence:'))
  if (state.streak.freezes_available < 1) state.streak.freezes_available = 1
  ensureSeed(state)
  emit('season.started', { season_id: season.id })
}

function reduce(state: State, world: World, now: Date): void {
  if (!world.consent) return
  if (!state.season) startSeason(state, world)
  const season = state.season
  if (!season) return
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
  if (facts.allActive.includes(world.today) && !grantedToday && !state.rewarded.includes(`presence:${world.today}`)) {
    state.rewarded.push(`presence:${world.today}`)
    grant(state, world, 'standard', world.today, `dy${world.today.replace(/-/g, '')}`)
  }
  const computed = computeStreak(facts.allActive, state.streak.frozen.map((row) => row.day), world.today)
  state.streak.current = computed.current
  state.streak.best = Math.max(state.streak.best, computed.current)
  state.streak.last_active = computed.lastActive
  const status = seasonStatus(season, world.today)
  season.status = status
  if (status === 'closed' && !state.recap_zh) {
    state.recap_zh = recapText({
      title: season.title_zh,
      start: season.start,
      end: season.end,
      weeks: season.chapters.length,
      done: state.quests.filter((quest) => quest.status === 'done').length,
      total: state.quests.length,
      best: state.streak.best,
      frozen: state.streak.frozen.length,
      draws: state.codex.counter,
      retest: facts.retestInWindow,
    })
    emit('season.ended', { season_id: season.id, completed_quests: state.quests.filter((quest) => quest.status === 'done').length })
  }
  const open = state.quests.filter((quest) => quest.status === 'open').map((quest) => quest.title_zh)
  const locked = state.unlocks.find((unlock) => unlock.status === 'locked')
  state.weekly_zh = weeklyText({
    title: season.title_zh,
    week: weekOf(season, world.today),
    weeks: season.chapters.length,
    status,
    streak: state.streak.current,
    frozen: state.streak.frozen.length,
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
    owned: Array<{ id: string; title_zh: string; body_zh: string; rarity: Rarity; rarity_zh: string; family: string }>
  }
  weekly_zh: string | null
  reminder_zh: string | null
  nudge: { offer: boolean; enabled: boolean; show: boolean }
}

function viewOf(state: State, world: World): EngageView {
  const season = state.season
  const block = season ? blockOf(state, world) : null
  const pack = season ? safePack() : null
  const shown = state.codex.owned.map((id) => pack ? cardById(pack, id) : null).filter((card): card is CodexCard => Boolean(card))
  const nudge = nudgeView(
    { ...state.nudge, choice: state.nudge.choice ?? (world.memoryNudge ? 'on' : null) },
    world.today,
    Boolean(season) && season?.status !== 'closed',
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
      reward_zh: quest.reward.guaranteed_min_rarity ? '完成后来一张至少是银的卡' : '完成后来一张卡',
    })),
    unlocks: state.unlocks.map((unlock) => ({
      id: unlock.id,
      key: unlock.key,
      title_zh: unlock.title_zh,
      teaser_zh: unlock.teaser_zh,
      status: unlock.status,
      reminder_zh: REMINDER_ZH[unlock.key] ?? unlock.teaser_zh,
    })),
    streak: {
      current: state.streak.current,
      best: state.streak.best,
      freezes_available: state.streak.freezes_available,
      frozen: state.streak.frozen,
    },
    codex: {
      enabled: !block && Boolean(season),
      hidden: Boolean(block) || !season,
      reason: season ? block : (world.age == null && world.consent ? 'age_unknown' : block),
      reason_zh: !world.consent ? '先完成知情同意。' : codexBlockZh(block),
      odds_zh: !block && pack ? oddsDisclosure(pack.table, pack.cards) : null,
      draws_available: block ? 0 : state.codex.grants.filter((row) => !row.used_by).length,
      draws_today: state.codex.draw_days[world.today] ?? 0,
      daily_cap: pack?.table.daily_cap ?? 3,
      commitment: block ? null : (state.codex.commitment || null),
      owned: (block ? [] : shown).map((card) => ({
        id: card.id,
        title_zh: card.title_zh,
        body_zh: card.body_zh,
        rarity: card.rarity,
        rarity_zh: rarityZh(card.rarity),
        family: card.family,
      })),
    },
    weekly_zh: state.weekly_zh,
    reminder_zh: locked && season && season.status !== 'closed' ? (REMINDER_ZH[locked.key] ?? null) : (season && season.status !== 'closed' && state.quests.some((quest) => quest.status === 'open') ? '这一季还有没做完的事，打开健康页看一眼就好' : null),
    nudge,
  }
}

function safePack() {
  try { return loadCodexPack() } catch { return null }
}

export function syncEngage(dataDir: string, now: Date = new Date()): EngageView {
  if (!dataDir) {
    const blank = emptyState()
    return viewOf(blank, { today: isoDay(now), age: null, consent: false, focus: null, minorFlag: false, memoryOptOut: false, memoryNudge: false, waist: false, hscrp: false, selfDays: [], checkinDays: [], doctorFirst: false })
  }
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (!world.consent) return viewOf(state, world)
  reduce(state, world, now)
  saveState(dataDir, state)
  return viewOf(state, world)
}

export function plainReminderOf(dataDir: string): string | null {
  if (!dataDir) return null
  const state = readState(dataDir)
  if (!state.season || state.season.status === 'closed') return null
  const locked = state.unlocks.find((unlock) => unlock.status === 'locked')
  if (locked) return REMINDER_ZH[locked.key] ?? null
  if (state.quests.some((quest) => quest.status === 'open')) return '这一季还有没做完的事，打开健康页看一眼就好'
  return null
}

function addAction(state: State, kind: StoredAction['kind'], day: IsoDay): boolean {
  const key = `${kind}:${day}`
  if (state.actions.some((action) => action.key === key)) return false
  state.actions.push({ key, day, kind })
  return true
}

export function actEngage(dataDir: string, action: { action: 'care_visit'; with_brief?: boolean } | { action: 'addon'; key: string } | { action: 'retest' } | { action: 'next_season' }, now: Date = new Date()): { ok: boolean; error?: string; note?: string; view: EngageView } {
  const world = readWorld(dataDir, now)
  if (!world.consent) return { ok: false, error: '先完成知情同意，这一季再开始。', view: syncEngage(dataDir, now) }
  const state = readState(dataDir)
  if (action.action === 'next_season') {
    if (!state.season || seasonStatus(state.season, world.today) !== 'closed') {
      reduce(state, world, now)
      saveState(dataDir, state)
      return { ok: false, error: '这一季还没有结束。', view: viewOf(state, world) }
    }
    state.season = null
    state.quests = []
    state.unlocks = []
    state.recap_zh = null
    state.weekly_zh = null
    state.rewarded = state.rewarded.filter((id) => id.startsWith('presence:'))
  } else if (action.action === 'care_visit') {
    if (!action.with_brief) return { ok: false, error: '这次要算完成，需要带着简报去。简报可以在健康页准备。', view: syncEngage(dataDir, now) }
    addAction(state, 'care', world.today)
  } else if (action.action === 'addon') {
    if (action.key !== 'hscrp' && action.key !== 'waist') return { ok: false, error: '只能记下腰围或 hs-CRP。', view: syncEngage(dataDir, now) }
    addAction(state, action.key, world.today)
  } else if (action.action === 'retest') {
    addAction(state, 'retest', world.today)
    if (!state.season) reduce(state, world, now)
    const season = state.season
    const windowStart = season ? addDays(season.end, -13) : world.today
    if (season && world.today < windowStart) {
      reduce(state, world, now)
      saveState(dataDir, state)
      return { ok: true, note: `已记下。复测窗口从 ${windowStart} 开始，到那时才算完成这项任务。`, view: viewOf(state, world) }
    }
  }
  reduce(state, world, now)
  saveState(dataDir, state)
  return { ok: true, view: viewOf(state, world) }
}

export function freezeEngage(dataDir: string, input: { reason: 'sick' | 'travel' | 'other'; from: IsoDay; to: IsoDay }, now: Date = new Date()): { ok: boolean; error?: string; view: EngageView } {
  const synced = syncEngage(dataDir, now)
  if (synced.needs_consent || !synced.season) return { ok: false, error: '先完成知情同意，这一季再开始。', view: synced }
  const state = readState(dataDir)
  const world = readWorld(dataDir, now)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.from) || !/^\d{4}-\d{2}-\d{2}$/.test(input.to) || input.to < input.from) {
    return { ok: false, error: '日期要写成 YYYY-MM-DD，结束不早于开始。', view: synced }
  }
  if (daysBetween(input.from, input.to) > 13) return { ok: false, error: '一次最多冻结 14 天。', view: synced }
  const active = new Set(activeDays(state, world))
  const days = daysInRange(input.from, input.to, world.today).filter((day) => !active.has(day) && !state.streak.frozen.some((row) => row.day === day))
  if (days.length === 0) return { ok: false, error: '这些天已经有记录，或者还在未来，不用冻结。', view: synced }
  if (state.streak.freezes_available < 1) return { ok: false, error: '没有可用的冻结了。抽到「连续记录冻结」可以再加一天。', view: synced }
  const applied: IsoDay[] = []
  for (const day of days) {
    if (state.streak.freezes_available < 1) break
    state.streak.freezes_available -= 1
    state.streak.frozen.push({ day, reason: input.reason, event_id: `fr${randomBytes(6).toString('hex')}` })
    applied.push(day)
    emit('streak.frozen', { day, reason: input.reason })
  }
  reduce(state, world, now)
  saveState(dataDir, state)
  const missed = days.length - applied.length
  return {
    ok: true,
    ...(missed > 0 ? { error: `冻结了 ${applied.length} 天，其余 ${missed} 天没有冻结次数了。` } : {}),
    view: viewOf(state, world),
  }
}

export function prefsEngage(dataDir: string, input: { codex?: boolean; nudge?: boolean; dismiss?: boolean; offerSeen?: boolean; shown?: boolean }, now: Date = new Date()): EngageView {
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (input.codex === true) state.codex.choice = 'on'
  if (input.codex === false) state.codex.choice = 'off'
  if (input.nudge === true) state.nudge.choice = 'on'
  if (input.nudge === false) { state.nudge.choice = 'off'; state.nudge.dismissed = true }
  if (input.dismiss) state.nudge.dismissed = true
  if (input.offerSeen) state.nudge.offered = true
  if (input.shown) {
    state.nudge.last_shown = world.today
    emit('nudge.shown', { nudge_id: `ng${randomBytes(6).toString('hex')}`, where: 'overlay' })
  }
  if (world.consent) reduce(state, world, now)
  if (world.consent || input.codex != null || input.nudge != null) saveState(dataDir, state)
  return viewOf(state, world)
}

export interface DrawResponse {
  ok: boolean
  error?: string
  reason?: string
  view: EngageView
  card?: { id: string; title_zh: string; body_zh: string; rarity: Rarity; rarity_zh: string; family: string; duplicate: boolean }
  questions_zh?: string[]
  deep_dive_zh?: string
  pity_before?: number
  commitment?: string
}

export function drawEngage(dataDir: string, now: Date = new Date()): DrawResponse {
  const world = readWorld(dataDir, now)
  const state = readState(dataDir)
  if (!world.consent) return { ok: false, reason: 'consent', error: '先完成知情同意。', view: viewOf(state, world) }
  reduce(state, world, now)
  const block = blockOf(state, world)
  if (block) {
    saveState(dataDir, state)
    return { ok: false, reason: block, error: codexBlockZh(block), view: viewOf(state, world) }
  }
  const pack = safePack()
  if (!pack) {
    saveState(dataDir, state)
    return { ok: false, reason: 'pack', error: '图鉴卡组还没有放进安装包。', view: viewOf(state, world) }
  }
  const grantRow = state.codex.grants.find((row) => !row.used_by)
  if (!grantRow) {
    saveState(dataDir, state)
    return { ok: false, reason: 'no_grant', error: '还没有抽卡次数。完成一项健康行动（测量、打卡、带着简报就诊或复测）才会获得。', view: viewOf(state, world) }
  }
  const usedToday = state.codex.draw_days[world.today] ?? 0
  if (usedToday >= pack.table.daily_cap) {
    saveState(dataDir, state)
    return { ok: false, reason: 'daily_cap', error: `今天的 ${pack.table.daily_cap} 次已经抽完，明天再抽。次数还留着。`, view: viewOf(state, world) }
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
  let questions: string[] | undefined
  let deep: string | undefined
  if (first && drawn.card.utility === 'streak_freeze') {
    state.streak.freezes_available += 1
    state.codex.utility_used.push(drawn.card.id)
  } else if (drawn.card.utility === 'doctor_questions') {
    const locked = state.unlocks.filter((unlock) => unlock.status === 'locked').map((unlock) => `要不要补上「${unlock.title_zh}」？`)
    questions = ['这次最该先看的一项是什么？', '有没有需要复查或加测的项目？', ...locked].slice(0, 3)
  } else if (drawn.card.utility === 'deep_dive') {
    const method = state.codex.owned.map((id) => cardById(pack, id)).find((card) => card?.family === 'method')
    deep = method ? `可以把「${method.title_zh}」读完。它讲的是研究方法，不是你的检查结论。` : '还没有方法卡。完成一项健康行动后再抽。'
  }
  appendDraw(dataDir, drawn.result)
  emit('codex.drawn', { draw_id: drawn.result.id, card_id: drawn.card.id, rarity: drawn.card.rarity })
  saveState(dataDir, state)
  return {
    ok: true,
    view: viewOf(state, world),
    card: { id: drawn.card.id, title_zh: drawn.card.title_zh, body_zh: drawn.card.body_zh, rarity: drawn.card.rarity, rarity_zh: rarityZh(drawn.card.rarity), family: drawn.card.family, duplicate: drawn.result.duplicate },
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

export function engagementSummary(): FactPack['engagement'] {
  const dataDir = runtime.dataDir()
  if (!dataDir) return null
  try {
    const view = syncEngage(dataDir, new Date())
    if (!view.season) return null
    return {
      season_title_zh: view.season.title_zh,
      week: view.season.week,
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
  if (quest) out.push({ id: 'nba-season-quest', kind: 'season_quest', priority: 42, title_zh: quest.title_zh, detail_zh: '这一季只做几件事，不用每天打卡。', prompt_zh: '我这一季现在该做什么？' })
  if (view.codex.enabled && view.codex.draws_available > 0) out.push({ id: 'nba-claim-draw', kind: 'claim_draw', priority: 38, title_zh: '有一次图鉴抽取', detail_zh: '次数来自健康行动。没有付费。', prompt_zh: '我想抽一张长寿图鉴' })
  return out
}

