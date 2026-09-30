// M12 deep analysis: the checks and actions the tools and the page share.

import { existsSync, readFileSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import type { CoreDeps } from '../contracts/index.ts'
import { currentPlan, normalizePlan, savePlan } from '../interventions.ts'
import { consentGranted, personMinor } from '../privacy/index.ts'
import { readProfile } from '../profile.ts'
import { planKey } from '../tools-approval.ts'
import {
  abandonRun, createRun, currentImport, importRun, listRuns, markPlanAccepted, planInput, readExport, runStatus,
  type AnalysisRun, type RunStatus,
} from './store.ts'

export const SKILL_NAME = 'longevity-analyst'
/** The first skill version that writes la-export/1 and reads Mirobody. */
export const MIN_SKILL_VERSION = [0, 7, 0] as const

export function analystSkillPath(): string {
  return process.env.LONGPI_ANALYST_SKILL || join(homedir(), '.dsh', 'skills', SKILL_NAME, 'SKILL.md')
}

/** The installed skill's version, and whether its harness has the commands this bridge uses. */
export function analystSkillVersion(): { version: string | null; ok: boolean } {
  const skill = analystSkillPath()
  if (!existsSync(skill)) return { version: null, ok: false }
  let version: string | null = null
  try {
    version = /\n\s*version:\s*["']?(\d+\.\d+\.\d+)/.exec(readFileSync(skill, 'utf8'))?.[1] ?? null
  } catch {
    return { version: null, ok: false }
  }
  const parts = (version ?? '0.0.0').split('.').map(Number)
  let newer = true
  for (let i = 0; i < 3; i += 1) {
    if ((parts[i] ?? 0) !== MIN_SKILL_VERSION[i]) { newer = (parts[i] ?? 0) > MIN_SKILL_VERSION[i]; break }
  }
  let harness = false
  try {
    const la = readFileSync(join(skill, '..', 'scripts', 'la.py'), 'utf8')
    harness = la.includes('add_parser("export"') && la.includes('add_parser("mirobody"')
  } catch {
    harness = false
  }
  return { version, ok: newer && harness }
}

function consentsMissing(): { reply_zh: string; missing: string } | null {
  if (!consentGranted('pipl_sensitive')) {
    return { missing: 'pipl_sensitive', reply_zh: '深度分析会处理基因、化验等敏感健康信息。请先在健康页「档案」里同意处理敏感个人信息。' }
  }
  if (!consentGranted('data_flow_deepseek')) {
    return { missing: 'data_flow_deepseek', reply_zh: '深度分析由对话里的 AI 完成，你的数据会交给模型服务处理。请先在健康页「档案」里同意数据交给模型服务。' }
  }
  return null
}

/** Everything that must hold before a run is prepared. Returns the first thing missing, in the person's words. */
export function startBlockers(dataDir: string, config: { member?: string } = {}): { reply_zh: string; missing: string } | null {
  const skill = analystSkillVersion()
  if (!skill.version) {
    return { missing: 'skill', reply_zh: '这台电脑上还没有安装深度分析（longevity-analyst）。用 LongPi 安装器加 --with-analyst 装好后再来。' }
  }
  if (!skill.ok) {
    return { missing: 'skill_version', reply_zh: `这台电脑上的深度分析是 ${skill.version} 版，需要 0.7.0 或更新的版本。用 LongPi 安装器加 --with-analyst 重新安装。` }
  }
  if ((config.member ?? '').trim()) {
    return { missing: 'member', reply_zh: '现在连着的是照护圈里一位家人的记录。深度分析只为链接主人本人做；切回本人的记录后再发起。' }
  }
  const minor = personMinor()
  if (minor?.minor) return { missing: 'adult', reply_zh: '深度分析只为成年人做。' }
  const consent = consentsMissing()
  if (consent) return consent
  const profile = readProfile(dataDir)
  if (!profile.age) return { missing: 'profile', reply_zh: '深度分析要用到你的年龄。请先在健康页「档案」里填好。' }
  if (profile.sex !== 'male' && profile.sex !== 'female') {
    return { missing: 'profile', reply_zh: '深度分析里很多公式按生理性别分别计算，目前只支持男或女。请在健康页「档案」里填写生理性别。' }
  }
  return null
}

export type StartResult =
  | { ok: true; run_id: string; workspace: string; data_folder: string; prompt_zh: string; mirobody: boolean }
  | { ok: false; reply_zh: string; missing: string }

function memberFolder(input: string | null | undefined): { path: string | null; error?: string } {
  const raw = (input ?? '').trim()
  if (!raw) return { path: null }
  const expanded = raw === '~' ? homedir() : raw.startsWith('~/') ? join(homedir(), raw.slice(2)) : raw
  if (!isAbsolute(expanded)) return { path: null, error: `请给出文件夹的完整路径（以 / 或 ~/ 开头）：${raw}` }
  const path = resolve(expanded)
  try {
    if (!statSync(path).isDirectory()) return { path: null, error: `这不是一个文件夹：${raw}` }
  } catch {
    return { path: null, error: `找不到文件夹 ${raw}。` }
  }
  return { path }
}

export async function startRun(deps: CoreDeps, opts: { dataFolder?: string | null }): Promise<StartResult> {
  const dataDir = deps.dataDir()
  const config = deps.config()
  const blocked = startBlockers(dataDir, config)
  if (blocked) return { ok: false, ...blocked }
  const folder = memberFolder(opts.dataFolder)
  if (folder.error) return { ok: false, missing: 'folder', reply_zh: folder.error }
  const profile = readProfile(dataDir)
  const run = createRun(dataDir, { mcpUrl: config.mcpUrl, memberFolder: folder.path })
  const sex = profile.sex === 'male' ? '男' : '女'
  const lines = [
    `请用 ${SKILL_NAME} 为我做一次深度分析：生物学年龄、各器官状况、以后的疾病风险，再给一份能照着做的干预方案。`,
    `我 ${profile.age} 岁，${sex}。`,
    folder.path ? `我的检测文件在：${run.data_dir}` : `我没有另外的检测文件，只用我在健康页里已有的数据。数据文件夹用：${run.data_dir}`,
    `工作目录用：${run.workspace}`,
    `方法库在：${config.skillsHome || '~/longpi/longevity-skills'}`,
    run.mirobody
      ? `我的体检和手表数据在 Mirobody 里：开始前先运行 la.py mirobody pull ${run.data_dir} --mcp-url-file ${run.mcp_url_file}（链接是我的密钥，不要把它写进命令或回复）。`
      : '',
    '做完后告诉我，我会在健康页「深度分析」里导入结果。',
  ].filter(Boolean)
  return { ok: true, run_id: run.id, workspace: run.workspace, data_folder: run.data_dir, prompt_zh: lines.join('\n'), mirobody: run.mirobody }
}

export function abandon(deps: CoreDeps, runId: string): boolean {
  return abandonRun(deps.dataDir(), runId)
}

export function statusNow(deps: CoreDeps): { runs: RunStatus[]; current: ReturnType<typeof currentSummary>; blockers: { reply_zh: string; missing: string } | null } {
  const dataDir = deps.dataDir()
  const runs = listRuns(dataDir).slice(-5).reverse().map((run) => runStatus(run))
  return { runs, current: currentSummary(dataDir), blockers: startBlockers(dataDir, deps.config()) }
}

export function currentSummary(dataDir: string) {
  if (consentsMissing()) return null                // after a consent is withdrawn nothing of the analysis is shown or sent
  const cur = currentImport(dataDir)
  if (!cur) return null
  const v = cur.value
  const byId = new Map(v.readouts.map((r) => [r.id, r]))
  const pick = (ids: string[]) => ids.map((id) => byId.get(id)).filter((r): r is NonNullable<typeof r> => Boolean(r))
  return {
    run_id: cur.meta.run_id,
    imported_at: cur.meta.imported_at,
    plan_accepted_version: cur.meta.plan_accepted_version,
    member: v.member,
    readouts: v.readouts,
    organs: v.organs.map((o) => ({
      organ: o.organ, label_zh: o.label_zh, measured: pick(o.measured), indices: pick(o.indices),
      ai_age: o.ai_age ? byId.get(o.ai_age) ?? null : null, ai_risks: pick(o.ai_risks), overrides: o.overrides ?? [],
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
  const consent = consentsMissing()
  if (consent) return { ok: false, error_zh: consent.reply_zh, problems: [consent.missing] }
  const run = findRun(dataDir, runId)
  if (!run) return { ok: false, error_zh: '还没有做完的深度分析可以导入。', problems: [] }
  const checked = readExport(run)
  if (!checked.value || !checked.html) return { ok: false, error_zh: '这次分析的结果没有通过检查，没有导入。', problems: checked.problems }
  const v = checked.value
  // Everything the page and the plan need is built before anything is written.
  const context = await deps.context()
  const trial = normalizePlan(planInput(v, context.today), { today: context.today, medications: [], previous: null })
  if (trial.plan.items.length === 0 && v.plan.items.length > 0) return { ok: false, error_zh: '这次分析的方案读不出来，没有导入。', problems: trial.errors }
  importRun(dataDir, run, v, checked.html)
  deps.invalidate()
  return {
    ok: true, run_id: run.id, readouts: v.readouts.length, organs: v.organs.length, board: v.board.length,
    plan_items: v.plan.items.length, retests: v.retests.length, read_back: await planReadBack(deps),
  }
}

export interface PlanReadBack {
  ok: boolean
  run_id: string | null
  plan_key: string | null
  title: string
  items: Array<{ id: string; category: string; title: string; detail: string; markers: string[] }>
  warnings: string[]
  errors: string[]
  plan: Record<string, unknown> | null
}

export async function planReadBack(deps: CoreDeps): Promise<PlanReadBack> {
  const dataDir = deps.dataDir()
  const cur = consentsMissing() ? null : currentImport(dataDir)
  if (!cur) return { ok: false, run_id: null, plan_key: null, title: '', items: [], warnings: [], errors: ['还没有导入深度分析。'], plan: null }
  const context = await deps.context()
  const input = planInput(cur.value, context.today)
  const normalized = normalizePlan(input, {
    today: context.today,
    medications: context.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
    previous: currentPlan(dataDir),
  })
  return {
    ok: normalized.errors.length === 0,
    run_id: cur.meta.run_id,
    plan_key: planKey(input),
    title: normalized.plan.title,
    items: normalized.plan.items.map((i) => ({ id: i.id, category: i.category, title: i.title, detail: i.detail, markers: i.markers })),
    warnings: normalized.warnings,
    errors: normalized.errors,
    plan: input,
  }
}

/**
 * The page's 接受方案: the person saw the read-back on the page and clicked. The click carries what they saw
 * (run id and the plan's key); a plan that changed since is not saved.
 */
export async function acceptPlan(deps: CoreDeps, seen: { run_id?: unknown; plan_key?: unknown } = {}): Promise<{ ok: true; version: number; items: number } | { ok: false; error_zh: string; problems: string[]; stale?: boolean }> {
  const consent = consentsMissing()
  if (consent) return { ok: false, error_zh: consent.reply_zh, problems: [consent.missing] }
  const back = await planReadBack(deps)
  if (!back.ok || !back.plan) return { ok: false, error_zh: back.errors[0] ?? '方案不能保存。', problems: back.errors }
  if (seen.run_id !== back.run_id || seen.plan_key !== back.plan_key) {
    return { ok: false, stale: true, error_zh: '方案已经更新，请重新阅读后再接受。', problems: ['plan changed since it was read back'] }
  }
  const cur = currentImport(deps.dataDir())
  if (cur?.meta.plan_accepted_version) return { ok: false, error_zh: `这份方案已经保存过（第 ${cur.meta.plan_accepted_version} 版）。`, problems: [] }
  const context = await deps.context()
  const normalized = normalizePlan(back.plan, {
    today: context.today,
    medications: context.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
    previous: currentPlan(deps.dataDir()),
  })
  if (normalized.errors.length) return { ok: false, error_zh: normalized.errors[0] ?? '方案不能保存。', problems: normalized.errors }
  const saved = savePlan(deps.dataDir(), normalized.plan)
  markPlanAccepted(deps.dataDir(), saved.version)
  deps.invalidate()
  return { ok: true, version: saved.version, items: saved.items.length }
}
