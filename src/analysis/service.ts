// M12 deep analysis: the checks and actions the tools and the page share.

import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { activePerson, personDir, readRegistry, rootDir, type Person } from '../people/store.ts'
import { holderAuth, mintMemberLink, saveMemberLink } from '../people/mirobody.ts'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import type { CoreDeps } from '../contracts/index.ts'
import { currentPlan, normalizePlan, savePlan } from '../interventions.ts'
import { personMinor } from '../privacy/index.ts'
import { readProfile } from '../profile.ts'
import { planKey } from '../tools-approval.ts'
import {
  abandonRun, createRun, currentImport, importRun, listRuns, markPlanAccepted, newestFileDate, planInput, readExport,
  registerFolder, registeredFolder, runStatus, type AnalysisRun, type RunStatus,
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
  const profile = readProfile(dataDir)
  if (!profile.age) return { missing: 'profile', reply_zh: '深度分析要用到你的年龄。请先在健康页「档案」里填好。' }
  if (profile.sex !== 'male' && profile.sex !== 'female') {
    return { missing: 'profile', reply_zh: '深度分析里很多公式按生理性别分别计算，目前只支持男或女。请在健康页「档案」里填写生理性别。' }
  }
  return null
}

/** Days between two automatic starts. A member's own request is not held by it. */
export const AUTO_MIN_DAYS = 30
/** Measured on the test runs: one deep analysis used about 0.5–0.6 M model tokens and 1.5–3 hours. Shown on the page. */
export const COST_ZH = '每次深度分析实测约消耗 50–60 万 token，耗时 1.5–3 小时'

/** The install-wide switch: off (default) means the AI only offers a deep analysis at key moments and the person decides. */
export function autoEnabled(root: string): boolean {
  try {
    return (JSON.parse(readFileSync(join(root, 'analysis-settings.json'), 'utf8')) as { auto?: unknown }).auto === true
  } catch {
    return false
  }
}

export function setAutoEnabled(root: string, on: boolean): void {
  mkdirSync(root, { recursive: true })
  writeFileSync(join(root, 'analysis-settings.json'), JSON.stringify({ auto: on, at: new Date().toISOString() }), { mode: 0o600 })
}

export interface Readiness {
  blockers: { reply_zh: string; missing: string } | null
  running: string | null
  last_analysis: string | null
  last_auto_start: string | null
  newest_record: string | null
  newest_file: string | null
  folder: string | null
  new_data: boolean
  /** The newest data date, and whether the AI was already told to ask about it (ask once per batch of new data). */
  newest: string | null
  asked: boolean
  /** The switch on the page: when off the AI may only offer a run and start it when the person says yes. */
  auto_on: boolean
  /** The harness's gate for an AI-started run: switch on, new data since the last analysis, no run going, 30 days since the last automatic start. */
  auto_allowed: boolean
  why_zh: string
}

function day(iso: string | null | undefined): string | null {
  return iso && /^\d{4}-\d{2}-\d{2}/.test(iso) ? iso.slice(0, 10) : null
}

function daysFrom(a: string, b: string): number {
  return Math.round((Date.parse(`${b}T00:00:00Z`) - Date.parse(`${a}T00:00:00Z`)) / 86_400_000)
}

/**
 * The facts the AI decides on; no judgment here. `records` is the member's Mirobody record as LongPi read it.
 */
export function readiness(dataDir: string, config: { member?: string; dataDir?: string }, records: { indicators?: Array<{ date?: string; last_date?: string }> } | null, today: string): Readiness {
  const autoOn = autoEnabled(rootDir(config.dataDir ?? ''))
  const blockers = startBlockers(dataDir, config)
  const runs = listRuns(dataDir).map((run) => ({ run, status: runStatus(run) }))
  const running = runs.find((r) => r.status.active)?.run.id ?? null
  const cur = currentImport(dataDir)
  const done = runs.filter((r) => r.status.report_ready).map((r) => day(r.run.started_at)).filter((d): d is string => Boolean(d))
  const lastAnalysis = [...done, ...(cur ? [day(cur.meta.imported_at)] : [])].filter((d): d is string => Boolean(d)).sort().at(-1) ?? null
  const lastAuto = runs.filter((r) => r.run.trigger === 'ai').map((r) => day(r.run.started_at)).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null
  const newestRecord = (records?.indicators ?? []).map((row) => day(row.last_date) ?? day(row.date)).filter((d): d is string => Boolean(d)).sort().at(-1) ?? null
  const folder = registeredFolder(dataDir)
  const newestFile = newestFileDate(folder)
  const newest = [newestRecord, newestFile].filter((d): d is string => Boolean(d)).sort().at(-1) ?? null
  const newData = Boolean(newest) && (!lastAnalysis || (newest as string) > lastAnalysis)
  const spaced = !lastAuto || daysFrom(lastAuto, today) >= AUTO_MIN_DAYS
  const autoAllowed = autoOn && !blockers && !running && newData && spaced
  const why = blockers ? `不能开始：${blockers.reply_zh}`
    : running ? '有一次深度分析正在进行。'
      : !newest ? '还没有可分析的数据。'
        : !newData ? `上次分析（${lastAnalysis}）之后没有新数据。`
          : !spaced ? `上次自动分析在 ${lastAuto}，距今不足 ${AUTO_MIN_DAYS} 天；会员主动要求时可以做。`
            : lastAnalysis ? `上次分析（${lastAnalysis}）之后有新数据（最新 ${newest}）。` : `有数据（最新 ${newest}），还没有做过深度分析。`
  const asked = Boolean(newest) && readAsked(dataDir) === newest
  return { blockers, running, last_analysis: lastAnalysis, last_auto_start: lastAuto, newest_record: newestRecord, newest_file: newestFile,
    folder, new_data: newData, newest, asked, auto_on: autoOn, auto_allowed: autoAllowed, why_zh: why }
}

/** One line for the health snapshot: the facts and what the AI may do with them. */
export function readinessLine(r: Readiness): string {
  if (r.blockers?.missing === 'skill' || r.blockers?.missing === 'skill_version') return ''
  let act = ''
  if (r.running) act = '做完后用 import_analysis 导入'
  else if (r.auto_allowed) act = '自动深度分析已打开，可以由你决定现在开始（run_deep_analysis，trigger ai，写明理由），开始后告诉用户为什么做、大约要多久'
  else if (!r.auto_on && r.new_data && !r.blockers && !r.asked) act = `自动深度分析没有打开。这是一个关键节点：在回答完用户的问题后，用一句话问他要不要做一次深度分析，并说明${COST_ZH}；他说要，才用 trigger member 开始（会弹出确认）。这批新数据只问这一次`
  else if (!r.auto_on && r.new_data && r.asked) act = '这批新数据已经问过用户，不要再问；他主动要求时再做（trigger member）'
  else act = '现在不开始；用户要求时可以做（trigger member）'
  return `深度分析：${r.why_zh}——${act}`
}

function readAsked(dataDir: string): string | null {
  try {
    const v = JSON.parse(readFileSync(join(dataDir, 'analysis', 'asked.json'), 'utf8')) as { newest?: unknown }
    return typeof v.newest === 'string' ? v.newest : null
  } catch {
    return null
  }
}

/** The ask for this batch of new data was put in front of the AI: it is not put there again. */
export function markAsked(dataDir: string, newest: string): void {
  mkdirSync(join(dataDir, 'analysis'), { recursive: true })
  writeFileSync(join(dataDir, 'analysis', 'asked.json'), JSON.stringify({ newest, at: new Date().toISOString() }), { mode: 0o600 })
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

export async function startRun(deps: CoreDeps, opts: { dataFolder?: string | null; trigger: 'ai' | 'member'; reasonZh: string }): Promise<StartResult> {
  const dataDir = deps.dataDir()
  const config = deps.config()
  const blocked = startBlockers(dataDir, config)
  if (blocked) return { ok: false, ...blocked }
  if (!opts.reasonZh.trim()) return { ok: false, missing: 'reason', reply_zh: '说明为什么现在做这次深度分析（reason_zh）。' }
  const folder = memberFolder(opts.dataFolder ?? registeredFolder(dataDir))
  if (folder.error) return { ok: false, missing: 'folder', reply_zh: folder.error }
  if (opts.trigger === 'ai') {
    if (!autoEnabled(rootDir(config.dataDir))) {
      return { ok: false, missing: 'auto_off', reply_zh: `自动深度分析没有打开（健康页「深度分析」里的开关）。可以问用户要不要做，并说明${COST_ZH}；他同意后用 trigger member。` }
    }
    const context = await deps.context()
    const ready = readiness(dataDir, config, context.records, context.today)
    if (!ready.auto_allowed) return { ok: false, missing: 'not_now', reply_zh: ready.why_zh }
  } else if (listRuns(dataDir).some((run) => runStatus(run).active)) {
    return { ok: false, missing: 'running', reply_zh: '有一次深度分析正在进行；等它做完，或者先放弃它。' }
  }
  if (folder.path) registerFolder(dataDir, folder.path)
  const profile = readProfile(dataDir)
  const root = rootDir(config.dataDir)
  const who = activePerson(root)
  // The run reads Mirobody through a link, not the page's token: give it a fresh one (ten days) for this person.
  const link = await freshLinkFor(root, who.person).catch(() => '')
  const run = createRun(dataDir, { mcpUrl: link || deps.config().mcpUrl, memberFolder: folder.path, trigger: opts.trigger, reasonZh: opts.reasonZh })
  const sex = profile.sex === 'male' ? '男' : '女'
  const them = who.person ? `我的${who.label_zh}` : '我'
  const lines = [
    `请用 ${SKILL_NAME} 为${them}做一次深度分析：生物学年龄、各器官状况、以后的疾病风险，再给一份能照着做的干预方案。`,
    who.person ? `${who.label_zh} ${profile.age} 岁，${sex}。这份分析是${who.label_zh}的，不是我自己的。` : `我 ${profile.age} 岁，${sex}。`,
    folder.path ? `检测文件在：${run.data_dir}` : `没有另外的检测文件，只用健康页里已有的数据。数据文件夹用：${run.data_dir}`,
    `工作目录用：${run.workspace}`,
    `方法库在：${config.skillsHome || '~/longpi/longevity-skills'}`,
    run.mirobody
      ? `体检和手表数据在 Mirobody 里：开始前先运行 la.py mirobody pull ${run.data_dir} --mcp-url-file ${run.mcp_url_file}（链接是密钥，不要把它写进命令或回复）。`
      : '',
    '做完后告诉我，我会在健康页「深度分析」里导入结果。',
  ].filter(Boolean)
  return { ok: true, run_id: run.id, workspace: run.workspace, data_folder: run.data_dir, prompt_zh: lines.join('\n'), mirobody: run.mirobody }
}

/** A fresh personal link for the run: the holder's own (minted with their account) or the family member's. */
async function freshLinkFor(root: string, person: Person | null): Promise<string> {
  const auth = holderAuth(root)
  if ('error_zh' in auth) return ''
  if (person) {
    if (!person.mirobody_user_id) return ''
    const url = await mintMemberLink(auth, person.mirobody_user_id)
    saveMemberLink(root, person, url)
    return url
  }
  const res = await fetch(`${auth.base}/personal/mcp`, { method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${auth.token}` }, body: '{}' })
  const json = await res.json().catch(() => ({})) as { code?: number; data?: { url?: string } }
  return res.ok && json.code === 0 && typeof json.data?.url === 'string' ? json.data.url : ''
}

export function abandon(deps: CoreDeps, runId: string): boolean {
  return abandonRun(deps.dataDir(), runId)
}

export async function statusNow(deps: CoreDeps) {
  const dataDir = deps.dataDir()
  const listed = listRuns(dataDir).slice(-5).reverse()
  const runs = listed.map((run) => ({ ...runStatus(run), trigger: run.trigger ?? 'member', reason_zh: run.reason_zh ?? '' }))
  const context = await deps.context().catch(() => null)
  const ready = readiness(dataDir, deps.config(), context?.records ?? null, context?.today ?? new Date().toISOString().slice(0, 10))
  return { runs, current: currentSummary(dataDir), blockers: ready.blockers, readiness: ready }
}

export function currentSummary(dataDir: string) {
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

function findRun(dataDir: string, runId?: string | null, root?: string): { dir: string; run: AnalysisRun } | null {
  if (runId && root) {
    // A run belongs to the person it was started for, whoever the page shows when it finishes.
    for (const dir of [root, ...readRegistry(root).people.map((p) => personDir(root, p.id))]) {
      const run = listRuns(dir).find((r) => r.id === runId)
      if (run) return { dir, run }
    }
    return null
  }
  const runs = listRuns(dataDir)
  const run = runId ? runs.find((r) => r.id === runId) : [...runs].reverse().find((r) => runStatus(r).report_ready)
  return run ? { dir: dataDir, run } : null
}

export type ImportResult =
  | { ok: true; run_id: string; readouts: number; organs: number; board: number; plan_items: number; retests: number; read_back: PlanReadBack }
  | { ok: false; error_zh: string; problems: string[] }

export async function importLatest(deps: CoreDeps, runId?: string | null): Promise<ImportResult> {
  const dataDir = deps.dataDir()
  const found = findRun(dataDir, runId, rootDir(deps.config().dataDir))
  if (!found) return { ok: false, error_zh: '还没有做完的深度分析可以导入。', problems: [] }
  const { run } = found
  const checked = readExport(run)
  if (!checked.value || !checked.html) return { ok: false, error_zh: '这次分析的结果没有通过检查，没有导入。', problems: checked.problems }
  const v = checked.value
  // Everything the page and the plan need is built before anything is written.
  const context = await deps.context()
  const trial = normalizePlan(planInput(v, context.today), { today: context.today, medications: [], previous: null })
  if (trial.plan.items.length === 0 && v.plan.items.length > 0) return { ok: false, error_zh: '这次分析的方案读不出来，没有导入。', problems: trial.errors }
  importRun(found.dir, run, v, checked.html)
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

export async function planReadBack(deps: CoreDeps, fixedDir?: string): Promise<PlanReadBack> {
  const dataDir = fixedDir ?? deps.dataDir()
  const cur = currentImport(dataDir)
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
  const dir = deps.dataDir()                         // read once: a switch mid-way never saves into another person
  const back = await planReadBack(deps, dir)
  if (!back.ok || !back.plan) return { ok: false, error_zh: back.errors[0] ?? '方案不能保存。', problems: back.errors }
  if (seen.run_id !== back.run_id || seen.plan_key !== back.plan_key) {
    return { ok: false, stale: true, error_zh: '方案已经更新，请重新阅读后再接受。', problems: ['plan changed since it was read back'] }
  }
  const cur = currentImport(dir)
  if (cur?.meta.plan_accepted_version) return { ok: false, error_zh: `这份方案已经保存过（第 ${cur.meta.plan_accepted_version} 版）。`, problems: [] }
  const context = await deps.context()
  const normalized = normalizePlan(back.plan, {
    today: context.today,
    medications: context.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
    previous: currentPlan(dir),
  })
  if (normalized.errors.length) return { ok: false, error_zh: normalized.errors[0] ?? '方案不能保存。', problems: normalized.errors }
  if (deps.dataDir() !== dir) return { ok: false, stale: true, error_zh: '页面切换了人，方案没有保存；请重新阅读后再接受。', problems: ['person changed'] }
  const saved = savePlan(dir, normalized.plan)
  markPlanAccepted(dir, saved.version)
  deps.invalidate()
  return { ok: true, version: saved.version, items: saved.items.length }
}
