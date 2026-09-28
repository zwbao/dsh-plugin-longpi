// Longevity Codex cards (AA §3.3). Owner M6 may amend once before its first merge.

import type { Id, IsoTime } from './common.ts'

export type Rarity = 'common' | 'rare' | 'epic' | 'legendary'
export interface CodexCard {
  id: Id; family: 'method' | 'species' | 'insight' | 'utility'
  title_zh: string; body_zh: string; rarity: Rarity
  /** Method cards: from skill.json tier. */
  evidence_tier?: 'human_rct' | 'human_obs' | 'animal' | 'cell'
  skill?: string; species?: string; utility?: 'streak_freeze' | 'deep_dive' | 'doctor_questions'
  /** Generated per person by the coach, never rarity-by-biomarker. */
  insight?: { min_days_of_data: number }
  hidden: boolean; set_id: Id; source: { doi?: string; skill?: string }
}
export interface DropTable {
  id: Id; version: number; season_id: Id | null
  /** Sums to 1; shown verbatim on the page. */
  odds: Record<Rarity, number>
  pity: { after_draws: number; min_rarity: Rarity }
  daily_cap: number
  /** Care actions guarantee at least this (rare). */
  care_guarantee: Rarity
  pools: Record<Rarity, Id[]>
  money: 'none'; trading: 'none'; biomarker_linked_rarity: false
}
export interface DrawResult {
  id: Id; grant_id: Id; card_id: Id; rarity: Rarity; duplicate: boolean
  pity_before: number; rng: { algo: 'sha256-counter'; seed_commitment: string; counter: number }; at: IsoTime
}
export function oddsSumToOne(table: Pick<DropTable, 'odds'>): boolean {
  const sum = Object.values(table.odds).reduce((total, value) => total + value, 0)
  return Math.abs(sum - 1) < 1e-9
}
