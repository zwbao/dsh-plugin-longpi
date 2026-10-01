// Rule quests. The coach may phrase them later; the criteria stay here.

import type { Id } from '../contracts/common.ts'
import type { Quest } from '../contracts/engagement.ts'

export interface QuestFacts {
  careWithBrief: boolean
  booked: boolean
  waist: boolean
  hscrp: boolean
  keys: Record<string, boolean>
  activeDays: number
  retestInWindow: boolean
  nOf1Done?: boolean
}

export function makeQuests(seasonId: Id, need: { waist: boolean; hscrp: boolean }): Quest[] {
  const quests: Quest[] = [{
    id: 'qs-care-visit',
    season_id: seasonId,
    kind: 'care',
    title_zh: '携带简报就诊一次，并记录就诊结果',
    criteria: { event: 'care.visit_logged', where: { with_brief: true }, count: 1 },
    progress: 0,
    status: 'open',
    reward: { draws: 1, guaranteed_min_rarity: 'rare' },
    origin: 'rule',
  }]
  if (need.waist) {
    quests.push({
      id: 'qs-waist',
      season_id: seasonId,
      kind: 'data',
      title_zh: '量一次腰围，解锁心血管风险',
      criteria: { event: 'selfmeasure.logged', where: { key: 'waist' }, count: 1 },
      progress: 0,
      status: 'open',
      reward: { draws: 1, guaranteed_min_rarity: 'rare' },
      origin: 'rule',
    })
  }
  if (need.hscrp) {
    quests.push({
      id: 'qs-hscrp',
      season_id: seasonId,
      kind: 'data',
      title_zh: '加测 hs-CRP（约 40–80 元），解锁身体年龄',
      criteria: { event: 'selfmeasure.logged', where: { key: 'hscrp' }, count: 1 },
      progress: 0,
      status: 'open',
      reward: { draws: 1, guaranteed_min_rarity: 'rare' },
      origin: 'rule',
    })
  }
  quests.push(
    {
      id: 'qs-show-up',
      season_id: seasonId,
      kind: 'behaviour',
      title_zh: '本季累计记录 4 天',
      criteria: { event: 'checkin.logged', count: 4, within_days: 84 },
      progress: 0,
      status: 'open',
      reward: { draws: 1 },
      origin: 'rule',
    },
    {
      id: 'qs-retest',
      season_id: seasonId,
      kind: 'retest',
      title_zh: '在复测窗口里做一次复测',
      criteria: { event: 'retest.arrived', count: 1 },
      progress: 0,
      status: 'open',
      reward: { draws: 1, guaranteed_min_rarity: 'rare' },
      origin: 'rule',
    },
  )
  return quests
}

function scored(quest: Quest, facts: QuestFacts): number | null {
  const event = quest.criteria.event
  const where = quest.criteria.where ?? {}
  if (event === 'care.visit_logged') return facts.careWithBrief ? 1 : 0
  if (event === 'care.booked') return facts.booked ? 1 : 0
  if (event === 'retest.arrived') return facts.retestInWindow ? 1 : 0
  if (event === 'checkin.logged') return Math.min(quest.criteria.count, facts.activeDays)
  if (event === 'study.n_of_1_completed') return facts.nOf1Done ? 1 : 0
  if (event === 'selfmeasure.logged') {
    const key = typeof where.key === 'string' ? where.key : ''
    if (key === 'waist') return facts.waist ? 1 : 0
    if (key === 'hscrp') return facts.hscrp ? 1 : 0
    if (key && facts.keys[key]) return 1
    return 0
  }
  return null
}

export function questProgress(quest: Quest, facts: QuestFacts): number {
  if (quest.id === 'qs-care-visit') return facts.careWithBrief ? 1 : 0
  if (quest.id === 'qs-waist') return facts.waist ? 1 : 0
  if (quest.id === 'qs-hscrp') return facts.hscrp ? 1 : 0
  if (quest.id === 'qs-show-up') return Math.min(quest.criteria.count, facts.activeDays)
  if (quest.id === 'qs-retest') return facts.retestInWindow ? 1 : 0
  const generic = scored(quest, facts)
  return generic == null ? quest.progress : generic
}
