import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface S2fExecResult {
  ran: boolean
  dry_run: boolean
  code?: number
  stdout?: string
  stderr?: string
  error?: string
  cmd: string[]
}

export function s2fAvailable(home: string | undefined): boolean {
  if (!home) return false
  return existsSync(join(home, 'scripts', 'route_query.sh'))
}

export function executeS2fRoute(options: {
  home: string
  query: string
  task?: string
  timeoutMs?: number
}): Promise<S2fExecResult> {
  const script = join(options.home, 'scripts', 'route_query.sh')
  const args = ['--query', options.query, '--format', 'json']
  if (options.task) args.push('--task', options.task)
  const cmd = ['bash', script, ...args]
  if (!existsSync(script)) {
    return Promise.resolve({ ran: false, dry_run: true, error: 'S2F_HOME missing scripts/route_query.sh', cmd })
  }
  return new Promise((resolve) => {
    const child = spawn('bash', [script, ...args], {
      cwd: options.home,
      env: { ...process.env, ALPHAGENOME_API_KEY: '', HF_TOKEN: '', NVCF_RUN_KEY: '' },
      signal: AbortSignal.timeout(options.timeoutMs ?? 30_000),
    })
    let stdout = ''
    let stderr = ''
    child.stdout?.on('data', (d: Buffer) => { stdout += d.toString('utf8') })
    child.stderr?.on('data', (d: Buffer) => { stderr += d.toString('utf8') })
    child.on('error', (err) => {
      resolve({ ran: false, dry_run: true, error: err.message, cmd, stdout, stderr })
    })
    child.on('close', (code) => {
      resolve({
        ran: true,
        dry_run: true,
        code: code ?? -1,
        stdout: stdout.slice(0, 8000),
        stderr: stderr.slice(0, 2000),
        cmd,
      })
    })
  })
}
