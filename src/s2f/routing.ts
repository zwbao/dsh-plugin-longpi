import {
  S2F_SKILLS,
  S2F_WEIGHTS,
  TASK_ALIASES,
  TASK_DEFAULTS,
  type S2fSkill,
} from './catalog.ts'

export interface RankedSkill {
  id: string
  score: number
  family: string
  best_for: string
}

export interface RouteResult {
  decision: 'route' | 'clarify'
  confidence: 'high' | 'medium' | 'low'
  task: string | null
  primary_skill: string | null
  secondary_skills: string[]
  ranking: RankedSkill[]
  clarify_question?: string
  source: 's2f-agent registry port'
}

function classifyTask(query: string, hint?: string): string | null {
  if (hint && hint.trim()) return hint.trim()
  for (const [re, task] of TASK_ALIASES) {
    if (re.test(query)) return task
  }
  return null
}

function scoreSkill(query: string, skill: S2fSkill, task: string | null): number {
  const q = query.toLowerCase()
  let score = 0
  if (new RegExp(`\\$${skill.id}\\b`, 'i').test(query)) score += S2F_WEIGHTS.explicit
  if (q.includes(skill.id.toLowerCase())) score += S2F_WEIGHTS.skillId
  let triggerHits = 0
  for (const t of skill.triggers) {
    if (q.includes(t.toLowerCase())) triggerHits += 1
  }
  score += Math.min(3, triggerHits) * S2F_WEIGHTS.trigger
  if (task && skill.tasks.includes(task)) score += S2F_WEIGHTS.taskAlign
  if (task && (TASK_DEFAULTS[task] ?? []).includes(skill.id)) score += 12
  return score
}

export function routeQuery(query: string, taskHint?: string): RouteResult {
  const task = classifyTask(query, taskHint)
  const ranking = S2F_SKILLS
    .map((s) => ({
      id: s.id,
      score: scoreSkill(query, s, task),
      family: s.family,
      best_for: s.best_for,
    }))
    .sort((a, b) => b.score - a.score)

  const top = ranking[0]
  const second = ranking[1]
  const margin = (top?.score ?? 0) - (second?.score ?? 0)
  const primary = top?.score ? top : undefined

  let confidence: RouteResult['confidence'] = 'low'
  if (primary && primary.score >= S2F_WEIGHTS.highMin && margin >= S2F_WEIGHTS.highMargin) confidence = 'high'
  else if (primary && primary.score >= S2F_WEIGHTS.medMin && margin >= S2F_WEIGHTS.medMargin) confidence = 'medium'

  const decision: RouteResult['decision'] = confidence === 'low' && !taskHint ? 'clarify' : 'route'

  return {
    decision,
    confidence,
    task,
    primary_skill: primary && primary.score > 0 ? primary.id : (task ? (TASK_DEFAULTS[task]?.[0] ?? null) : null),
    secondary_skills: ranking.slice(1, 4).filter((r) => r.score > 0).map((r) => r.id),
    ranking: ranking.filter((r) => r.score > 0).slice(0, 8),
    clarify_question: decision === 'clarify'
      ? 'I can route this better with one detail: which task do you want (environment-setup, embedding, variant-effect, fine-tuning, track-prediction, troubleshooting)?'
      : undefined,
    source: 's2f-agent registry port',
  }
}
