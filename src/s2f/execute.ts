import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface S2fExecResult {
  ran: boolean
  dry_run: boolean
  kind?: 'penguin-cli' | 'legacy-bash'
  code?: number
  stdout?: string
  stderr?: string
  error?: string
  cmd: string[]
}

function penguinBin(home: string): string | null {
  const candidates = [
    join(home, 'bin', 's2f'),
    join(home, '.venv', 'bin', 's2f'),
    join(home, 'shared_env', 's2f-core', 'bin', 's2f'),
    join(home, 's2f'),
  ]
  return candidates.find((p) => existsSync(p)) ?? null
}

export function s2fAvailable(home: string | undefined): boolean {
  if (!home) return false
  return penguinBin(home) !== null || existsSync(join(home, 'scripts', 'route_query.sh'))
}

export function executeS2fRoute(options: {
  home: string
  query: string
  task?: string
  timeoutMs?: number
}): Promise<S2fExecResult> {
  const bin = penguinBin(options.home)
  if (bin) {
    const args = ['route', options.query]
    return spawnCapture({
      cmd: [bin, ...args],
      cwd: options.home,
      timeoutMs: options.timeoutMs,
      kind: 'penguin-cli',
    })
  }
  const script = join(options.home, 'scripts', 'route_query.sh')
  if (!existsSync(script)) {
    return Promise.resolve({
      ran: false,
      dry_run: true,
      error: 's2fHome is neither an s2f-penguin checkout (bin/s2f) nor legacy s2f-agent (scripts/route_query.sh)',
      cmd: [],
    })
  }
  const args = [script, '--query', options.query, '--format', 'json']
  if (options.task) args.push('--task', options.task)
  return spawnCapture({
    cmd: ['bash', ...args],
    cwd: options.home,
    timeoutMs: options.timeoutMs,
    kind: 'legacy-bash',
  })
}

function spawnCapture(opts: {
  cmd: string[]
  cwd: string
  timeoutMs?: number
  kind: 'penguin-cli' | 'legacy-bash'
}): Promise<S2fExecResult> {
  const [file, ...args] = opts.cmd
  return new Promise((resolve) => {
    const child = spawn(file!, args, {
      cwd: opts.cwd,
      env: { ...process.env, ALPHAGENOME_API_KEY: '', HF_TOKEN: '', NVCF_RUN_KEY: '' },
      signal: AbortSignal.timeout(opts.timeoutMs ?? 30_000),
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8') })
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8') })
    child.on('error', (err) => {
      resolve({ ran: false, dry_run: true, kind: opts.kind, error: err.message, cmd: opts.cmd, stdout, stderr })
    })
    child.on('close', (code) => {
      resolve({
        ran: true,
        dry_run: true,
        kind: opts.kind,
        code: code ?? -1,
        stdout: stdout.slice(0, 8000),
        stderr: stderr.slice(0, 2000),
        cmd: opts.cmd,
      })
    })
  })
}
