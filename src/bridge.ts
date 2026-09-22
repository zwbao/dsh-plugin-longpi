import { spawnSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { join } from 'node:path'

export interface BridgeStatus {
  ok: boolean
  version?: string
  bundle?: string
  python?: string
  error?: string
}

const PYTHON_CANDIDATES = ['python3.14', 'python3.13', 'python3.12', 'python3']

export function discoverPython(configured: string, pluginHome: string): string {
  const explicit = configured.trim() || process.env.MIROBODY_PYTHON?.trim() || ''
  if (explicit) return explicit
  const venv = pluginHome ? join(pluginHome, '.venv', 'bin', 'python') : ''
  if (venv && existsSync(venv)) return venv
  for (const bin of PYTHON_CANDIDATES) {
    const found = spawnSync('/usr/bin/which', [bin], { encoding: 'utf8' })
    const path = found.stdout.trim()
    if (found.status === 0 && path && existsSync(path)) return path
  }
  return 'python3'
}

export function runBridgeStatus(
  pluginHome: string,
  python: string,
  mirobodyHome: string,
  timeoutMs: number,
): BridgeStatus {
  if (!pluginHome) return { ok: false, error: 'mirobody plugin checkout not found' }
  const script = join(pluginHome, 'bridge', 'dsh_bridge.py')
  if (!existsSync(script)) return { ok: false, error: 'mirobody bridge script is missing' }
  const result = spawnSync(python, [script], {
    input: JSON.stringify({ op: 'status' }),
    encoding: 'utf8',
    timeout: timeoutMs,
    env: {
      ...process.env,
      MIROBODY_HOME: mirobodyHome.trim(),
      PYTHONDONTWRITEBYTECODE: '1',
    },
  })
  if (result.error) return { ok: false, python, error: result.error.message }
  const text = (result.stdout ?? '').trim()
  if (!text) return { ok: false, python, error: (result.stderr ?? 'bridge produced no JSON').slice(0, 300) }
  try {
    const parsed = JSON.parse(text) as BridgeStatus
    return { ...parsed, python: parsed.python || python }
  } catch {
    return { ok: false, python, error: 'bridge status was not JSON' }
  }
}
