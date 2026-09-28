// The HealthEvent bus (AA §2.6, §3.3). Frozen at C0. Payloads carry ids and keys, never copies of health values.

import type { Id, IsoDay, IsoTime, ModuleId } from './common.ts'
import type { MemoryKind, LifeEventItem } from './memory.ts'
import type { EvidenceGrade } from './feedback.ts'
import type { DrawGrant, QuestKind } from './engagement.ts'
import type { Rarity } from './codex.ts'
import type { ConsentRecord } from './science.ts'
import type { SurfaceSet } from './surfaces.ts'

export interface HealthEventPayloads {
  'report.arrived': { checkup_day: IsoDay; indicators: number; narrative_findings: number; source: 'upload' | 'record_poll' }
  'record.changed': { catalogue_fp: string; generation: number }
  'memory.changed': { rev: number; kinds: MemoryKind[]; safety_relevant: boolean; item_ids: Id[] }
  'triage.opened': { finding_id: Id; priority: 'emergency' | 'must_surface' | 'should_surface'; rule: string }
  'triage.resolved': { finding_id: Id; how: 'visited' | 'normalised' | 'dismissed_by_person' | 'superseded' }
  'care.advised': { finding_id: Id; department_zh: string }
  'care.booked': { department_zh: string; day: IsoDay }
  'care.visit_logged': { care_item_id: Id; finding_id?: Id; with_brief: boolean }
  'brief.generated': { brief_id: Id; finding_ids: Id[]; source: 'model' | 'template' }
  'plan.drafted': { draft_id: Id; items: number; source: 'rules' | 'co_designer'; hold: boolean }
  'plan.saved': { version: number; items: number }
  'plan.item_excluded': { item_id: string; exclusion_id: Id }
  'checkin.logged': { day: IsoDay; item_ids: string[]; done: boolean | null }
  'selfmeasure.logged': { key: string; day: IsoDay }
  'life_event.logged': { memory_id: Id; event: LifeEventItem['event']; from: IsoDay; to: IsoDay | null }
  'streak.frozen': { day: IsoDay; reason: 'sick' | 'travel' | 'other' }
  'retest.due': { marker_key: string; day: IsoDay }
  'retest.arrived': { marker_keys: string[]; day: IsoDay }
  'verdict.changed': { item_id: string; marker_key: string; from: string; to: string }
  'feedback.issued': { feedback_id: Id; grade: EvidenceGrade; subject_key: string }
  'season.started': { season_id: Id }
  'season.ended': { season_id: Id; completed_quests: number }
  'quest.completed': { quest_id: Id; season_id: Id; kind: QuestKind }
  'unlock.granted': { unlock_id: Id; key: string }
  'codex.draw_earned': { grant_id: Id; kind: DrawGrant['kind']; by_event: Id }
  'codex.drawn': { draw_id: Id; card_id: Id; rarity: Rarity }
  'study.consented': { study_id: string; consent_id: Id }
  'study.withdrawn': { study_id: string; consent_id: Id }
  'study.run_completed': { study_id: string; run_id: Id; released: boolean }
  'study.n_of_1_completed': { study_id: string; season_id: Id }
  'consent.changed': { scope: ConsentRecord['scope']; decision: ConsentRecord['decision'] }
  'day.rolled': { day: IsoDay }
  /** save_personal_profile, POST /profile. */
  'profile.changed': { fields: string[] }
  'surface.generated': { inputs_fp: string; source: SurfaceSet['source']; latency_ms: number }
  'chat.turn_ended': { session_id: string; turn: number; health: boolean; prefilter_hit: boolean }
  'nudge.shown': { nudge_id: Id; where: 'overlay' | 'dock' | 'notification' }
}
export type HealthEventType = keyof HealthEventPayloads
export interface HealthEventSource {
  module: ModuleId
  via: 'tool' | 'route' | 'timer' | 'hook' | 'record_poll' | 'migration'
  tool?: string
  session_id?: string
}
export type HealthEvent = { [K in HealthEventType]: {
  id: Id; type: K; at: IsoTime; day: IsoDay; source: HealthEventSource; payload: HealthEventPayloads[K]; causation_id?: Id
} }[HealthEventType]

declare module '@deepseek-ai/cordis' {
  interface Events { 'longpi/event'(event: HealthEvent): void }
}

export interface Bus {
  emit<T extends HealthEventType>(type: T, payload: HealthEventPayloads[T], source: HealthEventSource, causation_id?: Id): HealthEvent
  on(types: HealthEventType[] | '*', fn: (e: HealthEvent) => void | Promise<void>, label: string, opts?: { durable?: boolean }): () => void
  since(cursor: Id | null, types?: HealthEventType[]): HealthEvent[]
}

/** Only the owning module emits a given type (AA §3.4). */
export const EVENT_OWNERS: Readonly<Record<HealthEventType, ModuleId>> = {
  'report.arrived': 'M7', 'record.changed': 'M10', 'memory.changed': 'M0', 'triage.opened': 'M1', 'triage.resolved': 'M1',
  'care.advised': 'M1', 'care.booked': 'M6', 'care.visit_logged': 'M1', 'brief.generated': 'M1', 'plan.drafted': 'M3', 'plan.saved': 'M3',
  'plan.item_excluded': 'M3', 'checkin.logged': 'M3', 'selfmeasure.logged': 'M7', 'life_event.logged': 'M6', 'streak.frozen': 'M6',
  'retest.due': 'M9', 'retest.arrived': 'M9', 'verdict.changed': 'M9', 'feedback.issued': 'M4', 'season.started': 'M6',
  'season.ended': 'M6', 'quest.completed': 'M6', 'unlock.granted': 'M6', 'codex.draw_earned': 'M6', 'codex.drawn': 'M6',
  'study.consented': 'M8', 'study.withdrawn': 'M8', 'study.run_completed': 'M8', 'study.n_of_1_completed': 'M8', 'consent.changed': 'M11', 'day.rolled': 'M0',
  'profile.changed': 'M0', 'surface.generated': 'M5', 'chat.turn_ended': 'M0', 'nudge.shown': 'M6',
}
