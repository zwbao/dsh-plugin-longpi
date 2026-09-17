import {
  HUMAN_UNSAFE_SKILLS,
  S2F_PENGUIN_REPO,
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
  warnings: string[]
  penguin: string
  clarify_question?: string
  source: 's2f-penguin guards + s2f-agent registry'
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

export function looksHuman(query: string): boolean {
  if (/\b(arabidopsis|plant|zea mays|oryza)\b/i.test(query)) return false
  return /\b(hg38|grch38|human|homo sapiens|chr[0-9xy]+\b|rs[0-9]+)\b/i.test(query)
}

export function isHg19(query: string): boolean {
  return /\b(hg19|grch37)\b/i.test(query)
}

export function routeQuery(query: string, taskHint?: string): RouteResult {
  const warnings: string[] = []
  if (isHg19(query)) {
    return {
      decision: 'clarify',
      confidence: 'low',
      task: classifyTask(query, taskHint),
      primary_skill: null,
      secondary_skills: [],
      ranking: [],
      warnings: ['hg19/GRCh37 is refused. s2f-penguin does not liftover; reissue on hg38/GRCh38.'],
      penguin: S2F_PENGUIN_REPO,
      clarify_question: 'Please re-state the variant on hg38 / GRCh38. This plugin does not lift over hg19.',
      source: 's2f-penguin guards + s2f-agent registry',
    }
  }

  const task = classifyTask(query, taskHint)
  const human = looksHuman(query)
    || (task === 'variant-effect' && !/\b(arabidopsis|plant|zea mays|oryza)\b/i.test(query))
  let ranking = S2F_SKILLS
    .map((s) => ({
      id: s.id,
      score: scoreSkill(query, s, task),
      family: s.family,
      best_for: s.best_for,
    }))
    .sort((a, b) => b.score - a.score)

  if (human) {
    const dropped = ranking.filter((r) => HUMAN_UNSAFE_SKILLS.has(r.id) && r.score > 0)
    if (dropped.length) {
      warnings.push('GPN live forward pass cannot score human variants (alignment channels would be zero; s2f-penguin P0). Use gpn_msa published table, alphagenome, or evo2.')
    }
    ranking = ranking.filter((r) => !HUMAN_UNSAFE_SKILLS.has(r.id))
  }

  const top = ranking[0]
  const second = ranking[1]
  const margin = (top?.score ?? 0) - (second?.score ?? 0)
  const primary = top?.score ? top : undefined

  let confidence: RouteResult['confidence'] = 'low'
  if (primary && primary.score >= S2F_WEIGHTS.highMin && margin >= S2F_WEIGHTS.highMargin) confidence = 'high'
  else if (primary && primary.score >= S2F_WEIGHTS.medMin && margin >= S2F_WEIGHTS.medMargin) confidence = 'medium'

  const decision: RouteResult['decision'] = confidence === 'low' && !taskHint ? 'clarify' : 'route'
  const defaultSkill = task ? (TASK_DEFAULTS[task]?.[0] ?? null) : null

  return {
    decision,
    confidence,
    task,
    primary_skill: primary && primary.score > 0 ? primary.id : defaultSkill,
    secondary_skills: ranking.slice(1, 4).filter((r) => r.score > 0).map((r) => r.id),
    ranking: ranking.filter((r) => r.score > 0).slice(0, 8),
    warnings,
    clarify_question: decision === 'clarify'
      ? 'I can route this better with one detail: which task do you want (environment-setup, embedding, variant-effect, fine-tuning, track-prediction, troubleshooting)?'
      : undefined,
    source: 's2f-penguin guards + s2f-agent registry',
    penguin: S2F_PENGUIN_REPO,
  }
}
