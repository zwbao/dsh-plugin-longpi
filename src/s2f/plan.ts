import { S2F_REPO, TASK_CONTRACTS } from './catalog.ts'
import { routeQuery, type RouteResult } from './routing.ts'

export interface ExtractedInputs {
  assembly?: string
  chrom?: string
  position?: string
  ref?: string
  alt?: string
  species?: string
}

export interface S2fPlan {
  route: RouteResult
  provided: Record<string, string>
  missing_inputs: string[]
  plan: {
    task: string
    primary_skill: string | null
    runnable_steps: string[]
    expected_outputs: string[]
    execute: 'dry-run-only-in-dsh'
  }
  disclaimer_zh: string
}

export function extractInputs(query: string): ExtractedInputs {
  const assembly = query.match(/\b(hg38|hg19|GRCh38|GRCh37)\b/i)?.[1]
  const chrom = query.match(/\b(?:chr)?([0-9]{1,2}|X|Y|MT)\b/i)?.[0]
  const position = query.match(/\b(?:pos(?:ition)?|at)\s*[: ]\s*(\d{3,})\b/i)?.[1]
    ?? query.match(/\bchr(?:[0-9]{1,2}|X|Y)[:\-:](\d{4,})\b/i)?.[1]
  const ref = query.match(/\bREF[:\s]+([ACGT]+)\b/i)?.[1]
  const alt = query.match(/\bALT[:\s]+([ACGT]+)\b/i)?.[1]
  const species = query.match(/\b(human|mouse|hg38|homo sapiens)\b/i)?.[1]
  return {
    assembly: assembly?.replace(/GRCh38/i, 'hg38').replace(/GRCh37/i, 'hg19'),
    chrom,
    position,
    ref: ref?.toUpperCase(),
    alt: alt?.toUpperCase(),
    species: species ? 'human' : undefined,
  }
}

export function buildPlan(query: string, taskHint?: string): S2fPlan {
  const route = routeQuery(query, taskHint)
  const task = route.task ?? taskHint ?? 'variant-effect'
  const extracted = extractInputs(query)
  const provided: Record<string, string> = {}
  if (extracted.assembly) provided.assembly = extracted.assembly
  if (extracted.chrom || extracted.position) {
    provided['coordinate-or-interval'] = [extracted.chrom, extracted.position].filter(Boolean).join(':')
  }
  if (extracted.ref && extracted.alt) provided['ref-alt-or-variant-spec'] = `${extracted.ref}/${extracted.alt}`
  if (extracted.species) provided.species = extracted.species

  const required = TASK_CONTRACTS[task] ?? []
  const missing = required.filter((key) => {
    if (key === 'assembly') return !provided.assembly
    if (key === 'coordinate-or-interval') return !provided['coordinate-or-interval']
    if (key === 'ref-alt-or-variant-spec') return !provided['ref-alt-or-variant-spec']
    if (key === 'species') return !provided.species
    if (key === 'sequence-or-interval') return !provided['coordinate-or-interval']
    return true
  })

  const skill = route.primary_skill ?? 'alphagenome-api'
  const q = query.replace(/'/g, '')
  const runnable = [
    `git clone ${S2F_REPO} && cd s2f-agent && ./scripts/bootstrap.sh`,
    `./scripts/route_query.sh --query '${q}' --format json`,
    `./scripts/run_agent.sh --task ${task} --query '${q}' --format json`,
    `./scripts/execute_plan.sh --task ${task} --query '${q}' --format text`,
  ]

  return {
    route,
    provided,
    missing_inputs: missing,
    plan: {
      task,
      primary_skill: skill,
      runnable_steps: runnable,
      expected_outputs: [
        'decision + primary_skill + confidence',
        'plan.runnable_steps (s2f contract)',
        'dry-run verification (failed=0) — GPU execution is NOT started from DSH',
      ],
      execute: 'dry-run-only-in-dsh',
    },
    disclaimer_zh: 'DSH 内只做路由与计划，不在本机拉起 AlphaGenome/Evo2 GPU。执行请在 s2f-agent 仓库按 dry-run 审阅后再 --run。坐标必须写明 assembly（hg38/hg19）。模型输出不是临床诊断。',
  }
}
