// What the research page shows: season progress, the cohort pulse, topic votes, give-back and contribution cards.

import { join } from 'node:path'
import type { NextBestAction } from '../contracts/surfaces.ts'
import { newId, readJson, writeJsonAtomic } from '../core/store.ts'
import { activeStudyIds, latestConsent } from './consent-flow.ts'
import { RELEASE_STAYS_ZH } from './budget.ts'
import { EARLY_ZH, thresholdCard, type ThresholdCard } from './coldstart.ts'
import { ethicsLine, loadStudies, publicQuestions, type LoadedStudy } from './manifest.ts'
import { readLog } from './translog.ts'
import { LIVE_REFUSED_ZH } from './verify.ts'

export const TOPICS = [
  { id: 'sleep-glucose', title_zh: '下一季：睡眠时间和空腹血糖' },
  { id: 'sit-break', title_zh: '下一季：久坐打断和餐后血糖' },
  { id: 'weekend-steps', title_zh: '下一季：周末步数和血压' },
] as const

export interface CommunityView {
  mode: 'off' | 'simulated' | 'live'
  configured: 'off' | 'simulated' | 'live'
  live_refused: boolean
  reason_zh: string
  studies: StudyCard[]
  progress: { label_zh: string; contributed: number; studies: number; min_cohort: number; week: number; weeks: number }
  pulse: { headline_zh: string; detail_zh: string } | null
  voting: { topics: Array<{ id: string; title_zh: string; votes: number }>; mine: string | null; note_zh: string }
  give_back_zh: string
  cards: Array<{ id: string; title_zh: string; body_zh: string }>
  translog: Array<{ seq: number; at: string; kind: string; detail_zh: string }>
  thresholds: ThresholdCard[]
  early_zh: string
  release_stays_zh: string
}

export interface StudyCard {
  id: string
  title_zh: string
  summary_zh: string
  kind: string
  ethics_zh: string
  consented: 'none' | 'granted' | 'withdrawn' | 'declined'
  questions: Array<{ id: string; question_zh: string; options_zh: string[] }>
  text_zh: string
}

interface VoteFile { topic_id: string | null; counts: Record<string, number> }
interface CardFile { cards: Array<{ id: string; title_zh: string; body_zh: string; study_id: string }> }
interface PulseFile { headline_zh?: string; detail_zh?: string; n?: number; mean?: number; key?: string }
interface CohortFile { studies?: Record<string, { enrolled?: number; threshold?: number }> }

function votePath(dataDir: string): string {
  return join(dataDir, 'science', 'votes.json')
}
function cardPath(dataDir: string): string {
  return join(dataDir, 'science', 'cards.json')
}
function pulsePath(dataDir: string): string {
  return join(dataDir, 'science', 'pulse.json')
}

export function readVote(dataDir: string): VoteFile {
  return readJson<VoteFile>(votePath(dataDir), (raw) => {
    const row = raw as VoteFile
    return row && typeof row === 'object' ? { topic_id: row.topic_id ?? null, counts: row.counts ?? {} } : { topic_id: null, counts: {} }
  }, () => ({ topic_id: null, counts: {} }))
}

export function castVote(dataDir: string, topicId: string): { ok: true } | { ok: false; reason_zh: string } {
  if (!TOPICS.some((topic) => topic.id === topicId)) return { ok: false, reason_zh: '没有这个题目' }
  const current = readVote(dataDir)
  const counts = { ...current.counts }
  if (current.topic_id && counts[current.topic_id]) counts[current.topic_id] = Math.max(0, (counts[current.topic_id] ?? 1) - 1)
  counts[topicId] = (counts[topicId] ?? 0) + 1
  writeJsonAtomic(votePath(dataDir), { topic_id: topicId, counts })
  return { ok: true }
}

export function rememberCard(dataDir: string, studyTitle: string, body_zh: string, studyId: string): void {
  const current = readJson<CardFile>(cardPath(dataDir), (raw) => raw as CardFile, () => ({ cards: [] }))
  const cards = current.cards ?? []
  cards.unshift({ id: newId('cardsc'), title_zh: `贡献了「${studyTitle}」`, body_zh, study_id: studyId })
  writeJsonAtomic(cardPath(dataDir), { cards: cards.slice(0, 12) })
}

export function readCards(dataDir: string): CardFile['cards'] {
  return readJson<CardFile>(cardPath(dataDir), (raw) => (raw as CardFile).cards ? raw as CardFile : { cards: [] }, () => ({ cards: [] })).cards
}

export function writePulse(dataDir: string, pulse: PulseFile): void {
  writeJsonAtomic(pulsePath(dataDir), pulse)
}

function studyCard(row: LoadedStudy, dataDir: string): StudyCard {
  const latest = dataDir ? latestConsent(dataDir, row.manifest.id) : null
  const consented = latest?.decision === 'granted' ? 'granted' : latest?.decision === 'withdrawn' ? 'withdrawn' : latest?.decision === 'declined' ? 'declined' : 'none'
  return {
    id: row.manifest.id,
    title_zh: row.manifest.title_zh,
    summary_zh: row.manifest.summary_zh,
    kind: row.manifest.kind,
    ethics_zh: ethicsLine(row.manifest),
    consented,
    questions: publicQuestions(row.manifest),
    text_zh: row.text_zh,
  }
}

export function buildCommunity(opts: { dataDir: string; configured: 'off' | 'simulated' | 'live' }): CommunityView {
  const liveRefused = opts.configured === 'live'
  const mode = liveRefused || opts.configured === 'off' ? 'off' : 'simulated'
  const loaded = mode === 'simulated' ? loadStudies().filter((row) => row.verify.ok && row.consent_hash_ok) : []
  const studies = loaded.map((row) => studyCard(row, opts.dataDir))
  const cohort = mode === 'simulated'
    ? readJson<CohortFile>(join(opts.dataDir, 'science', 'cohort.json'), (raw) => raw as CohortFile, () => ({}))
    : {}
  const thresholds = loaded.map((row) => {
    const saved = cohort.studies?.[row.manifest.id]
    const consented = latestConsent(opts.dataDir, row.manifest.id)?.decision === 'granted'
    const enrolled = typeof saved?.enrolled === 'number' ? saved.enrolled : consented ? 1 : 0
    const threshold = typeof saved?.threshold === 'number' ? saved.threshold : row.manifest.analysis.release.min_cohort
    return thresholdCard({ study_id: row.manifest.id, title_zh: row.manifest.title_zh, enrolled, threshold })
  })
  const early = thresholds.some((row) => row.early)
  const walk = studies.find((row) => row.id === 'walk-timing-glucose')
  const votes = mode === 'simulated' ? readVote(opts.dataDir) : { topic_id: null, counts: {} }
  const pulseFile = mode === 'simulated' ? readJson<PulseFile>(pulsePath(opts.dataDir), (raw) => raw as PulseFile, () => ({})) : {}
  const active = mode === 'simulated' ? activeStudyIds(opts.dataDir).length : 0
  const minCohort = 20
  return {
    mode,
    configured: opts.configured,
    live_refused: liveRefused,
    reason_zh: liveRefused ? LIVE_REFUSED_ZH : mode === 'off' ? '研究没有打开。模拟模式可以在本机试跑。' : '模拟模式：合计只发到本机的汇总程序，原始化验留在这里。',
    studies,
    progress: {
      label_zh: walk?.title_zh ?? '社区研究',
      contributed: active > 0 ? 1 : 0,
      studies: active,
      min_cohort: minCohort,
      week: 1,
      weeks: 8,
    },
    pulse: pulseFile.headline_zh ? { headline_zh: pulseFile.headline_zh, detail_zh: pulseFile.detail_zh ?? '' } : null,
    voting: {
      topics: TOPICS.map((topic) => ({ id: topic.id, title_zh: topic.title_zh, votes: votes.counts[topic.id] ?? 0 })),
      mine: votes.topic_id,
      note_zh: '你的一票记在这台电脑上。凑够人数之后，页面上的票数是加了噪声的合计，看不出是谁投的。',
    },
    give_back_zh: pulseFile.detail_zh || '还没有发回的群体结果。你自己的计算会留在本机结果里。',
    cards: mode === 'simulated' ? readCards(opts.dataDir).map(({ id, title_zh, body_zh }) => ({ id, title_zh, body_zh })) : [],
    translog: mode === 'simulated' ? readLog(opts.dataDir).slice(-30).reverse().map((row) => ({ seq: row.seq, at: row.at, kind: row.kind, detail_zh: row.detail_zh })) : [],
    thresholds,
    early_zh: early ? EARLY_ZH : '',
    release_stays_zh: RELEASE_STAYS_ZH,
  }
}

export function scienceCandidates(mode: 'off' | 'simulated' | 'live', active: number): NextBestAction[] {
  if (mode !== 'simulated') return []
  if (active > 0) {
    return [{
      id: 'm8-study-back',
      kind: 'learn',
      provider: 'M8',
      priority: 18,
      mandatory: false,
      reason_codes: ['science.give_back'],
      fact_ids: [],
      target: { surface: 'page', tab: '研究', prompt_zh: '研究的结果怎么样了？' },
      title_zh: '看看研究发回的结果',
      detail_zh: '只讲本机算的波动和加噪合计，不讲诊断。',
    }]
  }
  return [{
    id: 'm8-study-open',
    kind: 'study_consent',
    provider: 'M8',
    priority: 24,
    mandatory: false,
    reason_codes: ['science.simulated'],
    fact_ids: [],
    target: { surface: 'page', tab: '研究', prompt_zh: '有哪些研究我能参加？' },
    title_zh: '看看本季的研究',
    detail_zh: '在这台电脑上参加。原始化验、姓名和基因不会送出。',
  }]
}
