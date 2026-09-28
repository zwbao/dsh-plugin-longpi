import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import type { AgentProfile } from '../contracts/agents.ts'
import type { AdviceTierResult } from '../contracts/advice.ts'
import type { FactPack } from '../contracts/factpack.ts'
import { adviceFor } from '../advice/index.ts'

export interface ExplainerInput { subject: string }

function emptyAdvice(subject: string): AdviceTierResult {
  const say = '可以按公开资料说明常用范围或该做的检查，处方药只转述试验方案，不给个人剂量。'
  return {
    tier: 1,
    tier_source: 'table',
    subject: { name_zh: subject.slice(0, 40) || '未命名', kind: 'unknown' },
    tier1: { usual_range_zh: say, trial_doses: [], who_should_not_zh: [], interactions: [], test_first_zh: [] },
    person: { meds_considered: [], conditions_considered: [], contraindicated: false, notes_zh: [say] },
    refusal_only: false,
  }
}

let promptText = ''
function prompt(): string {
  if (promptText) return promptText
  try {
    promptText = readFileSync(join(dirname(fileURLToPath(import.meta.url)), 'prompts', 'evidence_explainer.md'), 'utf8')
  } catch {
    promptText = '按四层政策说明，不要只拒绝。'
  }
  return promptText
}

export const evidenceExplainer: AgentProfile<ExplainerInput, AdviceTierResult> = {
  id: 'evidence_explainer',
  owner: 'M2',
  modes: ['in_turn'],
  prompt: ['evidence_explainer.md'],
  tools: ['advise_on_substance', 'query_longevity_evidence', 'read_longevity_skill'],
  output_schema: {
    type: 'object',
    additionalProperties: true,
    properties: { tier: { type: 'number' }, refusal_only: { type: 'boolean' } },
    required: ['tier'],
  },
  route: { reasoningEffort: 'high', maxTokens: 2000 },
  deadline_ms: 45_000,
  input(_pack: FactPack, extra: ExplainerInput) {
    return { subject: extra?.subject ?? '', prompt: prompt() }
  },
  validate(out: unknown) {
    if (!out || typeof out !== 'object') return { ok: false, errors: ['not an object'] }
    const value = out as AdviceTierResult
    if (value.refusal_only !== false) return { ok: false, errors: ['a refusal-only answer is not allowed'] }
    if (value.tier !== 1 && value.tier !== 2 && value.tier !== 3 && value.tier !== 4) return { ok: false, errors: ['tier'] }
    return { ok: true, value }
  },
  fallback(_pack: FactPack, extra: ExplainerInput) {
    return adviceFor(extra?.subject ?? '', null) ?? emptyAdvice(extra?.subject ?? '')
  },
}
