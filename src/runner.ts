import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Catalog } from './catalog.ts'
import { loadCatalog } from './catalog.ts'

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/
const OUT_PATH = /^out\/?$|^out\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/

export interface StagedFile {
  name: string
  text: string
}

export interface RunRequest {
  home: string
  dataDir: string
  name: string
  args: string[]
  files: StagedFile[]
  python: string
  timeoutMs: number
  revision: string
}

export interface RunResult {
  ok: boolean
  error_kind?: string
  error?: string
  hint?: string
  skill: string
  revision: string
  exit_code: number | null
  report_excerpt: string
  stdout_tail: string
  stderr_tail: string
}

export interface Receipt {
  at: string
  skill: string
  revision: string
  exit_code: number | null
  ok: boolean
  excerpt: string
}

function fail(skill: string, revision: string, error_kind: string, error: string, hint: string): RunResult {
  return {
    ok: false,
    error_kind,
    error,
    hint,
    skill,
    revision,
    exit_code: null,
    report_excerpt: '',
    stdout_tail: '',
    stderr_tail: '',
  }
}

function checkArg(arg: string): string | null {
  if (typeof arg !== 'string' || arg.length === 0 || arg.length > 500) return 'each argument must be 1–500 characters'
  if (arg.includes('\0') || arg.includes('..')) return 'arguments cannot contain ..'
  if (arg.startsWith('-')) {
    if (arg.includes('/') || arg.includes('\\')) return 'flags cannot contain a path'
    return null
  }
  if (arg.startsWith('/') || /^[A-Za-z]:[\\/]/.test(arg)) return 'absolute paths are not accepted'
  if (arg.includes('/') || arg.includes('\\')) {
    if (!OUT_PATH.test(arg)) return 'only staged file names and out/ are accepted as paths'
  }
  return null
}

export function reportExcerpt(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const picked = lines.filter((line) => /年龄|age|边界|boundary|差|未计算|没有/.test(line)).slice(0, 4)
  const chosen = picked.length > 0 ? picked : lines.slice(0, 3)
  return chosen.join('\n').slice(0, 400)
}

function remember(dataDir: string, receipt: Receipt): void {
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  appendFileSync(join(dataDir, 'receipts.jsonl'), `${JSON.stringify(receipt)}\n`, { mode: 0o600 })
}

export function readReceipts(dataDir: string, limit = 5): Receipt[] {
  const path = join(dataDir, 'receipts.jsonl')
  if (!existsSync(path)) return []
  const lines = readFileSync(path, 'utf8').split(/\r?\n/).filter(Boolean)
  const parsed: Receipt[] = []
  for (const line of lines.slice(-50)) {
    try {
      const item = JSON.parse(line) as Receipt
      if (item && typeof item.skill === 'string' && typeof item.at === 'string') parsed.push(item)
    } catch {
      /* skip a torn line */
    }
  }
  return parsed.slice(-limit).reverse()
}

function pruneRuns(root: string): void {
  if (!existsSync(root)) return
  const names = readdirSync(root).filter((name) => /^[0-9]+-/.test(name)).sort()
  for (const name of names.slice(0, Math.max(0, names.length - 30))) {
    rmSync(join(root, name), { recursive: true, force: true })
  }
}

export async function runSkill(request: RunRequest): Promise<RunResult> {
  const catalog: Catalog = loadCatalog(request.home)
  const card = catalog.cards.find((item) => item.name === request.name)
  if (!card) {
    return fail(request.name, request.revision, 'unknown_skill', catalog.error || `unknown skill ${request.name}`, 'Use match_longevity_skills and pass a directory name from that list.')
  }
  if (!card.script) {
    return fail(request.name, catalog.revision, 'no_script', 'this skill has no personal_report.py', 'Read the skill and follow its command. Do not invent a score the script does not compute.')
  }
  if (request.args.length > 40) {
    return fail(request.name, catalog.revision, 'invalid_arguments', 'at most 40 arguments', 'Pass only the flags the skill command lists.')
  }
  if (request.files.length > 12) {
    return fail(request.name, catalog.revision, 'invalid_arguments', 'at most 12 staged files', 'Stage the files named by the skill command.')
  }
  for (const arg of request.args) {
    const problem = checkArg(arg)
    if (problem) return fail(request.name, catalog.revision, 'invalid_arguments', problem, 'Paths stay inside the run directory. Do not point the script at the skill tree or the home directory.')
  }
  const seen = new Set<string>()
  for (const file of request.files) {
    if (!FILE_NAME.test(file.name) || file.name.includes('..')) {
      return fail(request.name, catalog.revision, 'invalid_arguments', `bad file name ${file.name}`, 'File names are a single path segment, such as biomarkers.csv.')
    }
    if (seen.has(file.name)) return fail(request.name, catalog.revision, 'invalid_arguments', `duplicate file ${file.name}`, 'Stage each file once.')
    seen.add(file.name)
    if (typeof file.text !== 'string' || file.text.length > 256_000) {
      return fail(request.name, catalog.revision, 'invalid_arguments', `${file.name} is empty or larger than 256KB`, 'Stage the measurement file the skill asked for, not a PDF or a genome.')
    }
  }

  const runs = join(request.dataDir, 'runs')
  const runDir = join(runs, `${Date.now()}-${request.name}`)
  mkdirSync(runDir, { recursive: true, mode: 0o700 })
  for (const file of request.files) {
    writeFileSync(join(runDir, file.name), file.text, { mode: 0o600 })
  }
  mkdirSync(join(runDir, 'out'), { recursive: true, mode: 0o700 })

  const python = request.python.trim() || 'python3'
  const timeoutMs = Math.max(1000, Math.min(180_000, request.timeoutMs))
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string; error?: string }>((resolve) => {
    const child = spawn(python, [card.script as string, ...request.args], {
      cwd: runDir,
      shell: false,
      env: {
        PATH: process.env.PATH ?? '',
        HOME: process.env.HOME ?? '',
        LANG: process.env.LANG ?? 'C.UTF-8',
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONNOUSERSITE: '1',
      },
    })
    const stdout: Buffer[] = []
    const stderr: Buffer[] = []
    let settled = false
    const finish = (value: { code: number | null; stdout: string; stderr: string; error?: string }) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(value)
    }
    const timer = setTimeout(() => {
      child.kill('SIGKILL')
      finish({ code: null, stdout: '', stderr: '', error: 'skill timed out' })
    }, timeoutMs)
    child.stdout.on('data', (chunk: Buffer) => stdout.push(chunk))
    child.stderr.on('data', (chunk: Buffer) => stderr.push(chunk))
    child.on('error', (error) => finish({ code: null, stdout: '', stderr: '', error: error.message }))
    child.on('close', (code) => {
      finish({
        code,
        stdout: Buffer.concat(stdout).toString('utf8').slice(-8000),
        stderr: Buffer.concat(stderr).toString('utf8').slice(-4000),
      })
    })
  })

  const reportPath = join(runDir, 'out', 'report.md')
  const report = existsSync(reportPath) ? readFileSync(reportPath, 'utf8') : ''
  const excerpt = reportExcerpt(report || result.stdout)
  const ok = result.code === 0 && !result.error
  const payload: RunResult = {
    ok,
    skill: request.name,
    revision: catalog.revision,
    exit_code: result.code,
    report_excerpt: excerpt,
    stdout_tail: result.stdout.slice(-2000),
    stderr_tail: result.stderr.slice(-2000),
    ...(result.error ? { error_kind: 'unavailable', error: result.error } : {}),
    ...(!ok && !result.error ? { error_kind: 'script_failed', error: 'the skill script did not exit 0' } : {}),
    hint: report
      ? 'Quote report_excerpt, including the 边界 line. Do not add a diagnosis or a dose.'
      : 'No out/report.md was written. Say so. Do not invent the missing readout.',
  }
  remember(request.dataDir, {
    at: new Date().toISOString(),
    skill: request.name,
    revision: catalog.revision,
    exit_code: result.code,
    ok,
    excerpt,
  })
  pruneRuns(runs)
  return payload
}
