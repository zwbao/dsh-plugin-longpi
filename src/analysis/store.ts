// M12 deep analysis: runs of the longevity-analyst skill and the one imported result.
//
// A run is a folder under ~/longpi/analyses (data/ + ws/). The skill runs in a dsh session (it asks for
// approvals and dispatches its own subagents there); LongPi only prepares the run, shows its stage
// progress read from the workspace, and imports deliver/la-export.json when the report is done.
// The export is written by an LLM-driven pipeline, so it is checked like any outside file: schema,
// size, the report path inside the run's workspace and its hash.

import { createHash } from 'node:crypto'
import { copyFileSync, existsSync, mkdirSync, readFileSync, readdirSync, realpathSync, statSync, writeFileSync, chmodSync } from 'node:fs'
import { homedir } from 'node:os'
import { join, resolve, sep } from 'node:path'
import { appendJsonl, readJsonl, writeJsonAtomic } from '../core/store.ts'

export const EXPORT_SCHEMA = 'la-export/1'
const EXPORT_CAP = 8 * 1024 * 1024
const REPORT_CAP = 24 * 1024 * 1024
export const STAGES = ['intake', 'preflight', 'pipelines', 'methods', 'integrate', 'organs', 'insights', 'intervene', 'twin', 'review', 'report'] as const
export const STAGE_ZH: Record<string, string> = {
  intake: '整理数据', preflight: '检查电脑', pipelines: '测序流程', methods: '计算读数', integrate: '分系统解读',
  organs: '器官体检表', insights: '洞见与问题看板', intervene: '干预方案', twin: '数字孪生', review: '独立审查', report: '生成报告',
}

export interface AnalysisRun {
  id: string
  started_at: string
  root: string
  data_dir: string
  workspace: string
  mirobody: boolean
  member_id: string
}

export interface ImportedMeta {
  run_id: string
  imported_at: string
  generation: string
  report_sha256: string
  plan_accepted_version: number | null
}

export function analysesRoot(): string {
  return process.env.LONGPI_ANALYSES_HOME || join(homedir(), 'longpi', 'analyses')
}

function dirOf(dataDir: string): string {
  const d = join(dataDir, 'analysis')
  mkdirSync(d, { recursive: true, mode: 0o700 })
  return d
}

export function listRuns(dataDir: string): AnalysisRun[] {
  return readJsonl<AnalysisRun>(join(dirOf(dataDir), 'runs.jsonl'), (raw) => {
    const r = raw as Partial<AnalysisRun>
    return r && typeof r.id === 'string' && typeof r.workspace === 'string' ? r as AnalysisRun : null
  })
}

export function createRun(dataDir: string, opts: { memberId: string; mcpUrl: string; dataFolder: string | null; now?: Date }): AnalysisRun & { mcp_url_file: string | null } {
  const at = opts.now ?? new Date()
  const id = `a${at.toISOString().replace(/[-:TZ.]/g, '').slice(0, 14)}`
  const root = join(analysesRoot(), id)
  mkdirSync(root, { recursive: true, mode: 0o700 })
  const data = opts.dataFolder ? resolve(opts.dataFolder) : join(root, 'data')
  mkdirSync(data, { recursive: true })
  let urlFile: string | null = null
  if (opts.mcpUrl.trim()) {
    // The member's MCP URL is their secret: a 0600 file the skill reads, never a command-line argument.
    urlFile = join(root, 'mirobody_mcp_url')
    writeFileSync(urlFile, opts.mcpUrl.trim() + '\n', { mode: 0o600 })
    chmodSync(urlFile, 0o600)
  }
  const run: AnalysisRun = { id, started_at: at.toISOString(), root, data_dir: data, workspace: join(root, 'ws'), mirobody: Boolean(urlFile), member_id: opts.memberId }
  appendJsonl(join(dirOf(dataDir), 'runs.jsonl'), run)
  return { ...run, mcp_url_file: urlFile }
}

export interface RunStatus {
  id: string
  started_at: string
  workspace: string
  stages: Array<{ key: string; label_zh: string; done: boolean }>
  done: number
  report_ready: boolean
  state_error: string | null
}

export function runStatus(run: AnalysisRun): RunStatus {
  let stages: Record<string, string> = {}
  let error: string | null = null
  const statePath = join(run.workspace, 'state.json')
  if (existsSync(statePath)) {
    try {
      stages = (JSON.parse(readFileSync(statePath, 'utf8')) as { stages?: Record<string, string> }).stages ?? {}
    } catch {
      error = '工作区状态文件读不了'
    }
  }
  const rows = STAGES.map((key) => ({ key, label_zh: STAGE_ZH[key] ?? key, done: stages[key] === 'done' }))
  return {
    id: run.id, started_at: run.started_at, workspace: run.workspace, stages: rows,
    done: rows.filter((row) => row.done).length,
    report_ready: stages.report === 'done' && existsSync(join(run.workspace, 'deliver', 'la-export.json')),
    state_error: error,
  }
}

function sha256(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

function inside(parent: string, child: string): boolean {
  const p = realpathSync(parent)
  const c = realpathSync(child)
  return c === p || c.startsWith(p + sep)
}

// ---------------------------------------------------------------- the export

export interface LaExport {
  schema: string
  generated_at: string
  generation: string
  member: { id?: string; age?: number; sex?: string; sample_date?: string }
  workspace: string
  report: { html: string; sha256: string }
  readouts: Array<{ id: string; label_zh: string; value: unknown; unit?: string; kind?: string; group?: string; low?: number; high?: number; horizon_years?: number }>
  organs: Array<{ organ: string; label_zh: string; measured: string[]; indices: string[]; ai_age: string | null; ai_risks: string[] }>
  board: Array<{ id: string; title_zh: string; hypothesis_zh?: string; verdict: string | null; verdict_zh: string; confidence: string | null; summary_zh: string | null; next_step_zh: string | null; skipped_reason_zh?: string | null }>
  plan: { title: string; source: string; note: string; items: Array<Record<string, unknown>> }
  retests: Array<{ item: string; what: string; after_weeks: number; due: string }>
  boundary_zh: string
}

function str(v: unknown, max: number): string {
  return typeof v === 'string' ? v.slice(0, max) : ''
}

/** Check an export like any outside file. Returns the problems; empty means usable. */
export function checkExport(raw: unknown, run: AnalysisRun): { value: LaExport | null; problems: string[] } {
  const problems: string[] = []
  const x = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>
  if (x.schema !== EXPORT_SCHEMA) problems.push(`schema must be ${EXPORT_SCHEMA}`)
  for (const key of ['readouts', 'organs', 'board', 'retests'] as const) {
    if (!Array.isArray(x[key])) problems.push(`${key} must be a list`)
  }
  const plan = x.plan as Record<string, unknown> | undefined
  if (!plan || !Array.isArray(plan.items)) problems.push('plan.items must be a list')
  else if (plan.items.length > 30) problems.push('plan has more than 30 items')
  if (Array.isArray(x.readouts) && x.readouts.length > 2000) problems.push('too many readouts')
  if (Array.isArray(x.board) && x.board.length > 10) problems.push('the board has more than 10 questions')
  const report = x.report as Record<string, unknown> | undefined
  const html = report ? str(report.html, 4096) : ''
  if (!html) problems.push('report.html path missing')
  else if (!existsSync(html)) problems.push('report.html not found')
  else if (!inside(run.workspace, html)) problems.push('report.html is outside the run workspace')
  else if (statSync(html).size > REPORT_CAP) problems.push('report.html is too large')
  else if (report && sha256(html) !== report.sha256) problems.push('report.html changed after the report was written')
  return { value: problems.length ? null : x as unknown as LaExport, problems }
}

export function readExport(run: AnalysisRun): { value: LaExport | null; problems: string[] } {
  const path = join(run.workspace, 'deliver', 'la-export.json')
  if (!existsSync(path)) return { value: null, problems: ['the report is not done yet (deliver/la-export.json is missing)'] }
  if (statSync(path).size > EXPORT_CAP) return { value: null, problems: ['la-export.json is too large'] }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, 'utf8'))
  } catch {
    return { value: null, problems: ['la-export.json is not JSON'] }
  }
  return checkExport(raw, run)
}

/** Copy the checked export and its report into LongPi's store; the run folder can go away afterwards. */
export function importRun(dataDir: string, run: AnalysisRun, value: LaExport, now: Date = new Date()): ImportedMeta {
  const dir = join(dirOf(dataDir), 'current')
  mkdirSync(dir, { recursive: true, mode: 0o700 })
  copyFileSync(value.report.html, join(dir, 'report.html'))
  writeJsonAtomic(join(dir, 'la-export.json'), value)
  const meta: ImportedMeta = { run_id: run.id, imported_at: now.toISOString(), generation: String(value.generation ?? ''), report_sha256: value.report.sha256, plan_accepted_version: null }
  writeJsonAtomic(join(dir, 'meta.json'), meta)
  appendJsonl(join(dirOf(dataDir), 'imports.jsonl'), meta)
  // The MCP URL copy is not needed once the result is in.
  const urlFile = join(run.root, 'mirobody_mcp_url')
  if (existsSync(urlFile)) writeFileSync(urlFile, '', { mode: 0o600 })
  return meta
}

export function currentImport(dataDir: string): { meta: ImportedMeta; value: LaExport } | null {
  const dir = join(dataDir, 'analysis', 'current')
  try {
    const meta = JSON.parse(readFileSync(join(dir, 'meta.json'), 'utf8')) as ImportedMeta
    const value = JSON.parse(readFileSync(join(dir, 'la-export.json'), 'utf8')) as LaExport
    return { meta, value }
  } catch {
    return null
  }
}

export function markPlanAccepted(dataDir: string, version: number): void {
  const cur = currentImport(dataDir)
  if (!cur) return
  writeJsonAtomic(join(dataDir, 'analysis', 'current', 'meta.json'), { ...cur.meta, plan_accepted_version: version })
}

export function currentReportHtml(dataDir: string): string | null {
  const path = join(dataDir, 'analysis', 'current', 'report.html')
  return existsSync(path) ? readFileSync(path, 'utf8') : null
}

/** The plan in the shape save_intervention_plan / normalizePlan take, marked as coming from the analysis. */
export function planInput(value: LaExport, today: string): Record<string, unknown> {
  return {
    title: str(value.plan.title, 60) || '深度分析干预方案',
    source: 'analysis',
    note: str(value.plan.note, 500),
    items: value.plan.items.map((item) => ({
      id: str(item.id, 40),
      category: str(item.category, 20),
      title: str(item.title, 60),
      detail: str(item.detail, 300),
      start: today,
      markers: Array.isArray(item.markers) ? item.markers.filter((m) => typeof m === 'string').slice(0, 12) : [],
    })),
    goals: [],
  }
}

export function listRunFolders(): string[] {
  const root = analysesRoot()
  return existsSync(root) ? readdirSync(root) : []
}
