// M12 deep analysis: the checks and actions the tools and the page share.

import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import { join } from 'node:path'
import type { CoreDeps } from '../contracts/index.ts'
import { currentPlan, normalizePlan, savePlan } from '../interventions.ts'
import { consentGranted, personMinor } from '../privacy/index.ts'
import { readProfile } from '../profile.ts'
import {
  createRun, currentImport, importRun, listRuns, markPlanAccepted, planInput, readExport, runStatus, type AnalysisRun, type RunStatus,
} from './store.ts'

export const SKILL_NAME = 'longevity-analyst'

export function analystSkillPath(): string {
  return process.env.LONGPI_ANALYST_SKILL || join(homedir(), '.dsh', 'skills', SKILL_NAME, 'SKILL.md')
}

export type StartResult =
  | { ok: true; run_id: string; workspace: string; data_folder: string; prompt_zh: string; mirobody: boolean }
  | { ok: false; reply_zh: string; missing: string }

/** Everything that must hold before a run is prepared. Returns the first thing missing, in the person's words. */
export function startBlockers(dataDir: string): { reply_zh: string; missing: string } | null {
  if (!existsSync(analystSkillPath())) {
    return { missing: 'skill', reply_zh: '这台电脑上还没有安装深度分析（longevity-analyst）。用 LongPi 安装器加 --with-analyst 装好后再来。' }
  }
  const minor = personMinor()
  if (minor?.minor) return { missing: 'adult', reply_zh: '深度分析只为成年人做。' }
  if (!consentGranted('pipl_sensitive')) {
    return { missing: 'pipl_sensitive', reply_zh: '深度分析会处理基因、化验等敏感健康信息。请先在健康页「我的」里同意处理敏感个人信息，再来发起。' }
  }
  if (!consentGranted('data_flow_deepseek')) {
    return { missing: 'data_flow_deepseek', reply_zh: '深度分析由对话里的 AI 完成，你的数据会交给模型服务处理。请先在健康页「我的」里同意数据交给模型服务，再来发起。' }
  }
  const profile = readProfile(dataDir)
  if (!profile.age || (profile.sex !== 'male' && profile.sex !== 'female')) {
    return { missing: 'profile', reply_zh: '深度分析要用到你的年龄和生理性别（很多公式按性别计算）。请先在健康页「我的」里填好。' }
  }
  return null
}

export async function startRun(deps: CoreDeps, opts: { dataFolder?: string | null }): Promise<StartResult> {
  const dataDir = deps.dataDir()
  const blocked = startBlockers(dataDir)
  if (blocked) return { ok: false, ...blocked }
  const folder = opts.dataFolder?.trim() || null
  if (folder && !existsSync(folder)) return { ok: false, missing: 'folder', reply_zh: `找不到文件夹 ${folder}。` }
  const config = deps.config()
  const profile = readProfile(dataDir)
  const run = createRun(dataDir, { memberId: 'member', mcpUrl: config.mcpUrl, dataFolder: folder })
  const sex = profile.sex === 'male' ? '男' : '女'
  const lines = [
    `请用 ${SKILL_NAME} 为我做一次深度分析：生物学年龄、各器官状况、以后的疾病风险，再给一份能照着做的干预方案。`,
    `我 ${profile.age} 岁，${sex}。`,
    folder ? `我的检测文件在：${run.data_dir}` : `我没有另外的检测文件，只用我在健康页里已有的数据。`,
    `工作目录用：${run.workspace}`,
    `方法库在：${config.skillsHome || '~/longpi/longevity-skills'}`,
    run.mirobody
      ? `我的体检和手表数据在 Mirobody 里：开始前先运行 la.py mirobody pull ${run.data_dir} --mcp-url-file ${run.mcp_url_file}（链接是我的密钥，不要把它写进命令或回复）。`
      : '',
    '做完后告诉我，我会在健康页「深度分析」里导入结果。',
  ].filter(Boolean)
  return { ok: true, run_id: run.id, workspace: run.workspace, data_folder: run.data_dir, prompt_zh: lines.join('\n'), mirobody: run.mirobody }
}

export function statusNow(deps: CoreDeps): { runs: RunStatus[]; current: ReturnType<typeof currentSummary> } {
  const dataDir = deps.dataDir()
  const runs = listRuns(dataDir).slice(-5).reverse().map(runStatus)
  return { runs, current: currentSummary(dataDir) }
}

export function currentSummary(dataDir: string) {
  const cur = currentImport(dataDir)
  if (!cur) return null
  const v = cur.value
  const byId = new Map(v.readouts.map((r) => [r.id, r]))
  return {
    run_id: cur.meta.run_id,
    imported_at: cur.meta.imported_at,
    plan_accepted_version: cur.meta.plan_accepted_version,
    member: v.member,
    readouts: v.readouts,
    organs: v.organs.map((o) => ({
      organ: o.organ, label_zh: o.label_zh,
      measured: o.measured.map((id) => byId.get(id)).filter(Boolean),
      indices: o.indices.map((id) => byId.get(id)).filter(Boolean),
      ai_age: o.ai_age ? byId.get(o.ai_age) ?? null : null,
      ai_risks: o.ai_risks.map((id) => byId.get(id)).filter(Boolean),
    })),
    board: v.board,
    plan: v.plan,
    retests: v.retests,
    boundary_zh: v.boundary_zh,
  }
}

function findRun(dataDir: string, runId?: string | null): AnalysisRun | null {
  const runs = listRuns(dataDir)
  if (runId) return runs.find((r) => r.id === runId) ?? null
  return [...runs].reverse().find((r) => runStatus(r).report_ready) ?? null
}

export type ImportResult =
  | { ok: true; run_id: string; readouts: number; organs: number; board: number; plan_items: number; retests: number; read_back: PlanReadBack }
  | { ok: false; error_zh: string; problems: string[] }

export async function importLatest(deps: CoreDeps, runId?: string | null): Promise<ImportResult> {
  const dataDir = deps.dataDir()
  const run = findRun(dataDir, runId)
  if (!run) return { ok: false, error_zh: '还没有做完的深度分析可以导入。', problems: [] }
  const checked = readExport(run)
  if (!checked.value) return { ok: false, error_zh: '这次分析的结果没有通过检查，没有导入。', problems: checked.problems }
  importRun(dataDir, run, checked.value)
  deps.invalidate()
  const v = checked.value
  return {
    ok: true, run_id: run.id, readouts: v.readouts.length, organs: v.organs.length, board: v.board.length,
    plan_items: v.plan.items.length, retests: v.retests.length, read_back: await planReadBack(deps),
  }
}

export interface PlanReadBack {
  ok: boolean
  title: string
  items: Array<{ id: string; category: string; title: string; detail: string; markers: string[] }>
  warnings: string[]
  errors: string[]
  plan: Record<string, unknown> | null
}

export async function planReadBack(deps: CoreDeps): Promise<PlanReadBack> {
  const dataDir = deps.dataDir()
  const cur = currentImport(dataDir)
  if (!cur) return { ok: false, title: '', items: [], warnings: [], errors: ['还没有导入深度分析。'], plan: null }
  const context = await deps.context()
  const input = planInput(cur.value, context.today)
  const normalized = normalizePlan(input, {
    today: context.today,
    medications: context.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
    previous: currentPlan(dataDir),
  })
  return {
    ok: normalized.errors.length === 0,
    title: normalized.plan.title,
    items: normalized.plan.items.map((i) => ({ id: i.id, category: i.category, title: i.title, detail: i.detail, markers: i.markers })),
    warnings: normalized.warnings,
    errors: normalized.errors,
    plan: input,
  }
}

/** The page's 接受方案: the person saw the read-back on the page and clicked. */
export async function acceptPlan(deps: CoreDeps): Promise<{ ok: true; version: number; items: number } | { ok: false; error_zh: string; problems: string[] }> {
  const back = await planReadBack(deps)
  if (!back.ok || !back.plan) return { ok: false, error_zh: back.errors[0] ?? '方案不能保存。', problems: back.errors }
  const context = await deps.context()
  const normalized = normalizePlan(back.plan, {
    today: context.today,
    medications: context.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
    previous: currentPlan(deps.dataDir()),
  })
  const saved = savePlan(deps.dataDir(), normalized.plan)
  markPlanAccepted(deps.dataDir(), saved.version)
  deps.invalidate()
  return { ok: true, version: saved.version, items: saved.items.length }
}
