// Rule quests. The coach may phrase them later; the criteria stay here.

import type { Id } from '../contracts/common.ts'
import type { Quest } from '../contracts/engagement.ts'

export interface QuestFacts {
  careWithBrief: boolean
  waist: boolean
  hscrp: boolean
  activeDays: number
  retestInWindow: boolean
}

export function makeQuests(seasonId: Id, need: { waist: boolean; hscrp: boolean }): Quest[] {
  const quests: Quest[] = [{
    id: 'qs-care-visit',
    season_id: seasonId,
    kind: 'care',
    title_zh: '带着简报去看一次医生，回来记一笔',
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
      title_zh: '这一季里有 4 天留下记录',
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

export function questProgress(quest: Quest, facts: QuestFacts): number {
  if (quest.id === 'qs-care-visit') return facts.careWithBrief ? 1 : 0
  if (quest.id === 'qs-waist') return facts.waist ? 1 : 0
  if (quest.id === 'qs-hscrp') return facts.hscrp ? 1 : 0
  if (quest.id === 'qs-show-up') return Math.min(quest.criteria.count, facts.activeDays)
  if (quest.id === 'qs-retest') return facts.retestInWindow ? 1 : 0
  return quest.progress
}
