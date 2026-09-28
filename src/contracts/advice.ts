// 4-tier advice (AA §3.3). Owner M2 may amend once before its first merge.

import type { Id, NumberRef } from './common.ts'

export type AdviceTier = 1 | 2 | 3 | 4
export interface AdviceTierResult {
  tier: AdviceTier
  /** The table wins; the model only for unknown subjects, never lowering a table tier. */
  tier_source: 'table' | 'model' | 'rule_emergency'
  subject: { name_zh: string; kind: 'supplement' | 'otc' | 'diagnosis_first' | 'prescription' | 'symptom' | 'unknown'; table_id?: string }
  tier1?: {
    usual_range_zh: string
    upper_limit?: { value: number; unit: string; source: string }
    trial_doses: Array<{ text_zh: string; source: string }>
    who_should_not_zh: string[]
    interactions: Array<{ with_memory_id: Id; text_zh: string }>
    test_first_zh: string[]
  }
  tier2?: {
    tests_zh: string[]; department_zh: string; what_doctor_does_zh: string
    why_not_self_start_zh: string; person_values: NumberRef[]; urgency: 'now' | 'days' | 'weeks'
  }
  tier3?: {
    evidence_zh: string; strength: 'strong' | 'moderate' | 'weak' | 'none'
    trial_regimens: Array<{ text_zh: string; trial: string; source: string; as_information: true }>
    who_might_benefit_zh: string; specialist_zh: string; questions_to_ask_zh: string[]
  }
  /** first_aid from data/advice/emergencies.json, shown first. */
  tier4?: { first_aid_zh: string[]; call_zh: string; go_to_zh: string }
  person: { meds_considered: Id[]; conditions_considered: Id[]; contraindicated: boolean; notes_zh: string[] }
  /** A refusal-only answer is not representable. */
  refusal_only: false
}
