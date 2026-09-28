// Seasons, quests, unlocks and streaks (AA §3.3). Owner M6 may amend once before its first merge.

import type { Focus, Id, IsoDay, IsoTime } from './common.ts'
import type { HealthEventType } from './events.ts'
import type { Rarity } from './codex.ts'

export interface Season {
  id: Id; kind: 'personal' | 'community'; title_zh: string
  theme: { focus: Focus | 'care' | 'data'; marker_keys: string[] }
  /** 56–84 days; end aligned to the recommended retest. */
  start: IsoDay; end: IsoDay
  retest_day: IsoDay | null
  status: 'upcoming' | 'active' | 'retest_window' | 'closed'
  chapters: Array<{ week: number; title_zh: string }>
  quest_ids: Id[]; unlock_ids: Id[]; codex_set_id?: Id; study_id?: string
}
export type QuestKind = 'care' | 'data' | 'behaviour' | 'learn' | 'retest' | 'reflect' | 'science_n_of_1'
export interface Quest {
  id: Id; season_id: Id; kind: QuestKind; title_zh: string
  criteria: { event: HealthEventType; where?: Record<string, string | number | boolean>; count: number; within_days?: number }
  progress: number; status: 'open' | 'done' | 'expired' | 'waived'
  reward: { draws: number; guaranteed_min_rarity?: Rarity; unlock_id?: Id }
  /** The coach may phrase or choose among rule templates, never invent criteria. */
  origin: 'rule' | 'coach'
}
export interface Unlock {
  id: Id
  /** 'bioage' | 'cvd_risk' | 'trend_chart' | 'doctor_brief' | 'n_of_1' | a skill name … */
  key: string
  /** Replaces "还差 N 项检查". */
  title_zh: string; teaser_zh: string
  requires: Array<{ kind: 'input' | 'event' | 'quest'; key: string; label_zh: string }>
  status: 'locked' | 'unlocked'; unlocked_at?: IsoTime
}
export interface StreakState {
  current: number; best: number; freezes_available: number
  frozen: Array<{ day: IsoDay; reason: 'sick' | 'travel' | 'other'; event_id: Id }>
  last_active: IsoDay | null
}
export interface DrawGrant { id: Id; kind: 'standard' | 'care_guaranteed'; earned_by: Id; granted: IsoDay; used_by?: Id }
