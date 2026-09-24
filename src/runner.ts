import { spawn } from 'node:child_process'
import { mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync, existsSync, appendFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Catalog, SkillCard } from './catalog.ts'
import { loadCatalog } from './catalog.ts'
import { readResultFile, recordOutputs, type OutputValue } from './history.ts'
import { stageMeasurements, type MeasurementIn, type Problem } from './measurements.ts'

const FILE_NAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/
const OUT_PATH = /^out\/?$|^out\/[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/
const MEASUREMENTS_FILE = 'measurements.csv'
const EXIT_INPUT_PROBLEM = 3

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
  measurements?: MeasurementIn[]
  profile?: { age: number | null; sex: string }
  useProfile?: boolean
  runtimes?: Record<string, string>
  reportLimit?: number
  /** Local date the measurements were taken, when the run reads an earlier checkup. */
  measuredAt?: string
}

export interface Conversion {
  key: string
  label: string
  from: string
  to: string
  line_zh: string
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
  report_text?: string
  stdout_tail: string
  stderr_tail: string
  outputs?: Record<string, OutputValue>
  problems?: Problem[]
  autofilled?: string[]
  runtime?: string
  /** Unit conversions the harness applied before the script ran. */
  conversions?: Conversion[]
  measured_at?: string
  /** out/levers.json (schema longevity-levers/1), when the skill writes it. */
  levers?: Levers
}

export interface Levers {
  schema: 'longevity-levers/1'
  model: string
  model_zh?: string
  current: Record<string, number | null>
  sensitivity: Array<{ key: string; label_zh: string; unit: string; value: number; years_per_unit?: number; per_unit?: number }>
  levers: Array<{ key: string; label_zh: string; unit: string; from: number; to: number; phenoage_delta?: number; mortality_delta_pct?: number; risk_delta_pct?: number }>
  targets?: Record<string, unknown>
  note_zh?: string
}

function readLevers(runDir: string): Levers | null {
  const path = join(runDir, 'out', 'levers.json')
  if (!existsSync(path)) return null
  try {
    const parsed = JSON.parse(readFileSync(path, 'utf8')) as Levers
    return parsed && parsed.schema === 'longevity-levers/1' ? parsed : null
  } catch {
    return null
  }
}

export interface Receipt {
  at: string
  skill: string
  revision: string
  exit_code: number | null
  ok: boolean
  excerpt: string
  error_kind?: string
  input_keys?: string[]
  problem_kinds?: string[]
  missing?: string[]
}

function fail(skill: string, revision: string, error_kind: string, error: string, hint: string, extra: Partial<RunResult> = {}): RunResult {
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
    ...extra,
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

function formatNumber(value: number): string {
  if (Number.isInteger(value)) return String(value)
  return String(Number(value.toPrecision(4)))
}

export function reportExcerpt(text: string): string {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const picked = lines.filter((line) => /年龄|age|边界|boundary|差|未计算|没有|不在合理范围|单位/.test(line)).slice(0, 5)
  const chosen = picked.length > 0 ? picked : lines.slice(0, 3)
  return chosen.join('\n').slice(0, 600)
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
  for (const line of lines.slice(-Math.max(limit, 50))) {
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

function readProblems(runDir: string): Problem[] {
  const path = join(runDir, 'out', 'problems.json')
  if (!existsSync(path)) return []
  try {
    return ((JSON.parse(readFileSync(path, 'utf8')) as { problems?: Problem[] }).problems) ?? []
  } catch {
    return []
  }
}

/** Add profile flags and the out flag the skill declares, unless the model already passed them. */
function autofill(card: SkillCard, args: string[], request: RunRequest): { args: string[]; filled: string[]; problems: Problem[] } {
  const out = [...args]
  const filled: string[] = []
  const problems: Problem[] = []
  const has = (flag: string) => out.includes(flag)
  if (request.useProfile !== false && request.profile) {
    for (const spec of card.inputs) {
      if (spec.from !== 'profile' || !spec.flag || has(spec.flag)) continue
      if (spec.key === 'age') {
        if (request.profile.age != null) {
          out.push(spec.flag, String(request.profile.age))
          filled.push(`${spec.flag} ${request.profile.age}（档案里保存的实足年龄）`)
        } else if (spec.required) {
          problems.push({ key: 'age', label: spec.label_zh, kind: 'missing', message_zh: '档案里没有实足年龄。请这个人说出年龄后用 save_personal_profile 保存，不要用出生年估算。' })
        }
      }
      if (spec.key === 'sex' && request.profile.sex && request.profile.sex !== 'unknown' && request.profile.sex !== 'other') {
        out.push(spec.flag, request.profile.sex)
        filled.push(`${spec.flag} ${request.profile.sex}（档案里保存的性别）`)
      }
    }
  }
  const outFlag = card.entry?.out_flag ?? (card.entry ? '--out' : '')
  if (outFlag && !has(outFlag)) {
    out.push(outFlag, 'out')
    filled.push(`${outFlag} out`)
  }
  return { args: out, filled, problems }
}

export async function runSkill(request: RunRequest): Promise<RunResult> {
  const catalog: Catalog = loadCatalog(request.home)
  const card = catalog.cards.find((item) => item.name === request.name)
  if (!card) {
    return fail(request.name, request.revision, 'unknown_skill', catalog.error || `unknown skill ${request.name}`, 'Use match_longevity_skills and pass a directory name from that list.')
  }
  if (!card.script) {
    return fail(request.name, catalog.revision, 'no_script', 'this skill has no script', 'Read the skill and follow its command. Do not invent a score the script does not compute.')
  }
  let python = request.python.trim() || 'python3'
  const runtime = card.entry?.runtime ?? ''
  if (runtime) {
    const configured = request.runtimes?.[runtime]?.trim() ?? ''
    if (!configured) {
      return fail(request.name, catalog.revision, 'runtime_missing', `this skill needs the "${runtime}" runtime, which is not configured`, `Set skillRuntimes.${runtime} in the plugin config to a Python interpreter that has this skill's dependencies. Do not run it with another interpreter and do not estimate the result.`, { runtime })
    }
    python = configured
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
  const files = [...request.files]
  const seen = new Set<string>()
  for (const file of files) {
    if (!FILE_NAME.test(file.name) || file.name.includes('..')) {
      return fail(request.name, catalog.revision, 'invalid_arguments', `bad file name ${file.name}`, 'File names are a single path segment, such as biomarkers.csv.')
    }
    if (seen.has(file.name)) return fail(request.name, catalog.revision, 'invalid_arguments', `duplicate file ${file.name}`, 'Stage each file once.')
    seen.add(file.name)
    if (typeof file.text !== 'string' || file.text.length > 256_000) {
      return fail(request.name, catalog.revision, 'invalid_arguments', `${file.name} is empty or larger than 256KB`, 'Stage the measurement file the skill asked for, not a PDF or a genome.')
    }
  }

  let args = [...request.args]
  const inputKeys: string[] = []
  const conversions: Conversion[] = []
  if (request.measurements && request.measurements.length > 0) {
    if (card.inputsStatus === 'none' || !card.entry?.measurements_flag) {
      return fail(request.name, catalog.revision, 'invalid_arguments', 'this skill does not declare measurement inputs', 'Stage the file its command names with files and args instead.')
    }
    const staged = stageMeasurements(card, request.measurements)
    if (staged.problems.length > 0) {
      const kinds = [...new Set(staged.problems.map((item) => item.kind))]
      const onlyMissing = kinds.every((kind) => kind === 'missing')
      remember(request.dataDir, {
        at: new Date().toISOString(), skill: request.name, revision: catalog.revision, exit_code: null, ok: false, excerpt: '',
        error_kind: onlyMissing ? 'missing_inputs' : 'invalid_inputs', input_keys: Object.keys(staged.values),
        problem_kinds: kinds, missing: staged.problems.filter((item) => item.kind === 'missing').map((item) => item.key),
      })
      return fail(request.name, catalog.revision, onlyMissing ? 'missing_inputs' : 'invalid_inputs',
        staged.problems.map((item) => item.message_zh).join(' '),
        onlyMissing
          ? 'Say which inputs are missing. Do not fill them from another file, a reference range, or memory.'
          : 'Tell the person which value or unit did not pass and why. Ask them to check the report; do not change the value yourself.',
        { problems: staged.problems })
    }
    if (files.some((file) => file.name === MEASUREMENTS_FILE)) {
      return fail(request.name, catalog.revision, 'invalid_arguments', `${MEASUREMENTS_FILE} is staged by the harness`, 'Pass measurements or files, not both for the same table.')
    }
    files.push({ name: MEASUREMENTS_FILE, text: staged.csv })
    inputKeys.push(...Object.keys(staged.values))
    for (const item of staged.used) {
      if (item.factor === 1) continue
      const label = card.inputs.find((spec) => spec.key === item.key)?.label_zh ?? item.key
      const from = `${formatNumber(item.raw)} ${item.given_unit}`.trim()
      const to = `${formatNumber(item.value)} ${item.unit}`.trim()
      conversions.push({ key: item.key, label, from, to, line_zh: `${label} ${from} → ${to}` })
    }
    const flag = card.entry.measurements_flag
    const at = args.indexOf(flag)
    if (at >= 0) args.splice(at, 2)
    args.push(flag, MEASUREMENTS_FILE)
  }
  const filled = autofill(card, args, request)
  if (filled.problems.length > 0) {
    remember(request.dataDir, {
      at: new Date().toISOString(), skill: request.name, revision: catalog.revision, exit_code: null, ok: false, excerpt: '',
      error_kind: 'missing_inputs', input_keys: inputKeys, problem_kinds: ['missing'], missing: filled.problems.map((item) => item.key),
    })
    return fail(request.name, catalog.revision, 'missing_inputs', filled.problems.map((item) => item.message_zh).join(' '), 'Ask the person for the missing profile field.', { problems: filled.problems })
  }
  args = filled.args

  const runs = join(request.dataDir, 'runs')
  const runDir = join(runs, `${Date.now()}-${request.name}`)
  mkdirSync(runDir, { recursive: true, mode: 0o700 })
  for (const file of files) {
    writeFileSync(join(runDir, file.name), file.text, { mode: 0o600 })
  }
  mkdirSync(join(runDir, 'out'), { recursive: true, mode: 0o700 })

  const timeoutMs = Math.max(1000, Math.min(180_000, request.timeoutMs))
  const result = await new Promise<{ code: number | null; stdout: string; stderr: string; error?: string }>((resolve) => {
    const child = spawn(python, [card.script as string, ...args], {
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
  const outputs = readResultFile(join(runDir, 'out', 'result.json'))
  const problems = readProblems(runDir)
  const levers = readLevers(runDir)
  const ok = result.code === 0 && !result.error
  let errorKind = ''
  if (result.error) errorKind = 'unavailable'
  else if (result.code === EXIT_INPUT_PROBLEM) errorKind = 'input_problems'
  else if (!ok) errorKind = 'script_failed'
  const payload: RunResult = {
    ok,
    skill: request.name,
    revision: catalog.revision,
    exit_code: result.code,
    report_excerpt: excerpt,
    stdout_tail: result.stdout.slice(-2000),
    stderr_tail: result.stderr.slice(-2000),
    ...(request.reportLimit ? { report_text: report.slice(0, request.reportLimit) } : {}),
    ...(Object.keys(outputs).length > 0 ? { outputs } : {}),
    ...(problems.length > 0 ? { problems } : {}),
    ...(filled.filled.length > 0 ? { autofilled: filled.filled } : {}),
    ...(runtime ? { runtime } : {}),
    ...(conversions.length > 0 ? { conversions } : {}),
    ...(levers ? { levers } : {}),
    ...(request.measuredAt ? { measured_at: request.measuredAt } : {}),
    ...(result.error ? { error: result.error } : {}),
    ...(errorKind ? { error_kind: errorKind } : {}),
    ...(errorKind === 'script_failed' ? { error: 'the skill script did not exit 0' } : {}),
    hint: errorKind === 'input_problems'
      ? 'The script refused its inputs. Quote the reasons in report_excerpt and problems; do not correct a value or unit yourself.'
      : report
        ? 'Quote report_excerpt, including the 边界 line. Cite outputs exactly. Do not add a diagnosis or a dose.'
        : 'No out/report.md was written. Say so. Do not invent the missing readout.',
  }
  remember(request.dataDir, {
    at: new Date().toISOString(),
    skill: request.name,
    revision: catalog.revision,
    exit_code: result.code,
    ok,
    excerpt,
    ...(errorKind ? { error_kind: errorKind } : {}),
    input_keys: inputKeys,
    ...(problems.length > 0 ? { problem_kinds: [...new Set(problems.map((item) => item.kind))], missing: problems.filter((item) => item.kind === 'missing').map((item) => item.key) } : {}),
  })
  if (ok) {
    recordOutputs(request.dataDir, {
      at: new Date().toISOString(),
      skill: request.name,
      revision: catalog.revision,
      outputs,
      ...(request.measuredAt ? { measured_at: request.measuredAt } : {}),
    })
  }
  pruneRuns(runs)
  return payload
}
