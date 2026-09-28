// M2 seam. A refusal-only answer is not representable: every hit carries the table text.

import type { AdviceTierResult } from '../contracts/advice.ts'
import type { Id } from '../contracts/common.ts'
import type { MemoryApi } from '../contracts/memory.ts'
import { matchCards, renderSay, type AdviceCard } from './playbook.ts'

function remembered(memory: MemoryApi | null): Array<{ id: Id; text: string }> {
  if (!memory) return []
  try {
    return memory.read().items
      .filter((item) => item.kind === 'medication' || item.kind === 'supplement')
      .map((item) => ({ id: item.id, text: item.text_zh }))
  } catch {
    return []
  }
}

function resultFor(card: AdviceCard, subject: string, memory: MemoryApi | null): AdviceTierResult {
  const say = renderSay(card, subject)
  const meds = remembered(memory).filter((item) => subject.includes(item.text.slice(0, 2)) || say.includes(item.text.slice(0, 2)))
  const base = {
    tier: card.tier,
    tier_source: 'table' as const,
    subject: {
      name_zh: card.id,
      kind: card.kind === 'supplement' || card.kind === 'benign' ? 'supplement' as const
        : card.kind === 'diagnosis_first' || card.kind === 'lab' ? 'diagnosis_first' as const
          : card.kind === 'prescription' || card.kind === 'plan' ? 'prescription' as const
            : 'symptom' as const,
      table_id: card.id,
    },
    person: {
      meds_considered: meds.map((item) => item.id),
      conditions_considered: [] as Id[],
      contraindicated: card.critical === true && card.tier === 2,
      notes_zh: [say],
    },
    refusal_only: false as const,
  }
  if (card.tier === 1) {
    return {
      ...base,
      tier1: {
        usual_range_zh: say,
        trial_doses: [{ text_zh: say, source: card.source }],
        who_should_not_zh: [],
        interactions: meds.map((item) => ({ with_memory_id: item.id, text_zh: say })),
        test_first_zh: [],
      },
    }
  }
  if (card.tier === 2) {
    return {
      ...base,
      tier2: {
        tests_zh: [say],
        department_zh: say,
        what_doctor_does_zh: say,
        why_not_self_start_zh: say,
        person_values: [],
        urgency: card.critical ? 'days' : 'weeks',
      },
    }
  }
  if (card.tier === 3) {
    return {
      ...base,
      tier3: {
        evidence_zh: say,
        strength: 'moderate',
        trial_regimens: [{ text_zh: say, trial: card.id, source: card.source, as_information: true }],
        who_might_benefit_zh: say,
        specialist_zh: say,
        questions_to_ask_zh: [say],
      },
    }
  }
  return {
    ...base,
    tier_source: 'rule_emergency',
    tier4: { first_aid_zh: [say], call_zh: '请立即拨打 120', go_to_zh: '急诊' },
  }
}

/** The table row for a subject, or null when nothing matches. Never a refusal. */
export function adviceFor(subject: string, memory: MemoryApi | null): AdviceTierResult | null {
  const card = matchCards(subject, 1)[0]
  if (!card) return null
  return resultFor(card, subject, memory)
}
