// The Mirobody connection the person sets on the settings page. Saved in
// dataDir/connection.json (0600) as { mcp_url, mcp_token?, saved_at }, it
// overrides the mcpUrl and mcpToken of the plugin's configuration: index.ts
// hands every module the effective values through its config getter, so the
// records, the tools and the mounted Mirobody tools all read the same address.
// A connection is saved only after one catalogue read through it succeeded;
// clearing it brings the configured values back. The token never leaves this
// module except toward the Mirobody address it belongs to.

import { createHash } from 'node:crypto'
import { chmodSync, existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { tableOf } from './compact.ts'
import type { Config } from './config.ts'
import { within } from './journey.ts'
import { callMcpTool, redact, type McpCallResult } from './mcp.ts'
import { resolveDataDir } from './paths.ts'
import { summarizeIndicators } from './situation.ts'

export const CONNECTION_FILE = 'connection.json'
/** One catalogue read, all round trips included. */
export const CONNECTION_TEST_MS = 10_000
const URL_MAX = 2000
const TOKEN_MAX = 8000

export interface SavedConnection {
  mcp_url: string
  mcp_token?: string
  saved_at: string
}

export type ConnectionSource = 'saved' | 'config' | 'none'

function pathOf(dataDir: string): string {
  return join(dataDir, CONNECTION_FILE)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

/** The saved connection, or null when there is none or the file is unreadable. */
export function readConnection(dataDir: string): SavedConnection | null {
  const path = pathOf(dataDir)
  if (!existsSync(path)) return null
  try {
    const raw = JSON.parse(readFileSync(path, 'utf8')) as unknown
    if (!isRecord(raw) || typeof raw.mcp_url !== 'string' || !raw.mcp_url.trim()) return null
    const token = typeof raw.mcp_token === 'string' && raw.mcp_token.trim() ? raw.mcp_token.trim() : ''
    return { mcp_url: raw.mcp_url.trim(), ...(token ? { mcp_token: token } : {}), saved_at: typeof raw.saved_at === 'string' ? raw.saved_at : '' }
  } catch {
    return null
  }
}

/** Write the connection, private to the person (0600), replacing the file in one step. */
export function saveConnection(dataDir: string, input: { mcp_url: string; mcp_token?: string }, now = new Date()): SavedConnection {
  const token = (input.mcp_token ?? '').trim()
  const row: SavedConnection = { mcp_url: input.mcp_url.trim(), ...(token ? { mcp_token: token } : {}), saved_at: now.toISOString() }
  mkdirSync(dataDir, { recursive: true, mode: 0o700 })
  const path = pathOf(dataDir)
  const tmp = `${path}.tmp-${process.pid}`
  writeFileSync(tmp, `${JSON.stringify(row, null, 2)}\n`, { mode: 0o600 })
  chmodSync(tmp, 0o600)
  renameSync(tmp, path)
  memo = null
  return row
}

/** Remove the saved connection; the configured values apply again. True when there was one. */
export function clearConnection(dataDir: string): boolean {
  const path = pathOf(dataDir)
  memo = null
  if (!existsSync(path)) return false
  rmSync(path, { force: true })
  return true
}

let memo: { config: Config; stamp: string; value: Config } | null = null

/**
 * The configuration every module reads: the plugin's own, with mcpUrl and mcpToken taken from the saved
 * connection when there is one. A saved connection without a token means none, never the configured one:
 * a token belongs to its address.
 */
export function effectiveConfig(config: Config): Config {
  const path = pathOf(resolveDataDir(config.dataDir))
  let stamp = '-'
  try {
    const stat = statSync(path)
    stamp = `${stat.ino}:${stat.size}:${stat.mtimeMs}`
  } catch {
    stamp = '-'
  }
  if (memo && memo.config === config && memo.stamp === stamp) return memo.value
  const saved = stamp === '-' ? null : readConnection(resolveDataDir(config.dataDir))
  const value = saved ? { ...config, mcpUrl: saved.mcp_url, mcpToken: saved.mcp_token ?? '' } : config
  memo = { config, stamp, value }
  return value
}

/** Where the effective address comes from. */
export function connectionSource(config: Config): ConnectionSource {
  if (readConnection(resolveDataDir(config.dataDir))) return 'saved'
  return config.mcpUrl.trim() ? 'config' : 'none'
}

/**
 * A short hash of the MCP token, for cache keys: two accounts behind one address never share a cached
 * record. sha256 of the trimmed token, first 16 hex characters; '' when there is no token.
 */
export function connectionKey(config: Pick<Config, 'mcpToken'>): string {
  const token = (config.mcpToken ?? '').trim()
  return token ? createHash('sha256').update(token).digest('hex').slice(0, 16) : ''
}

/**
 * The address as the page may show it. The installer's rule: everything after /mcp/ is the personal
 * secret and is hidden. A query or fragment is hidden too, and so is anything that does not parse.
 */
export function maskMcpUrl(url: string): string {
  const trimmed = url.trim()
  if (!trimmed) return ''
  try {
    const parsed = new URL(trimmed)
    const at = parsed.pathname.indexOf('/mcp/')
    const path = at >= 0 && parsed.pathname.length > at + 5 ? `${parsed.pathname.slice(0, at + 5)}…` : parsed.pathname
    return `${parsed.protocol}//${parsed.host}${path}${parsed.search || parsed.hash ? '?…' : ''}`
  } catch {
    return '…'
  }
}

/** Why an address cannot be used, in Chinese; '' when it can. https, or http to this machine only. */
export function connectionUrlProblem(url: unknown): string {
  if (typeof url !== 'string' || !url.trim()) return '请填写 Mirobody 地址。'
  if (url.trim().length > URL_MAX) return `地址太长（最多 ${URL_MAX} 个字符）。`
  let parsed: URL
  try {
    parsed = new URL(url.trim())
  } catch {
    return '这不是一个有效的网址，请粘贴以 https:// 开头的完整地址。'
  }
  if (parsed.username || parsed.password) return '地址里不能包含用户名或密码。'
  if (parsed.protocol === 'https:') return ''
  if (parsed.protocol === 'http:' && (parsed.hostname === '127.0.0.1' || parsed.hostname === 'localhost')) return ''
  return '只接受 https:// 地址；本机运行的 Mirobody 可以用 http://127.0.0.1 或 http://localhost。'
}

/** Why a token cannot be used, in Chinese; '' when it can (or when there is none). */
export function connectionTokenProblem(token: unknown): string {
  if (token === undefined || token === null) return ''
  if (typeof token !== 'string') return '令牌必须是文字。'
  if (token.trim().length > TOKEN_MAX) return `令牌太长（最多 ${TOKEN_MAX} 个字符）。`
  if (/\s/.test(token.trim())) return '令牌里不能有空格或换行。'
  return ''
}

export type ConnectionTest = { ok: true; indicators: number } | { ok: false; error: string }

function timeoutText(timeoutMs: number): string {
  return `${Math.round(timeoutMs / 1000)} 秒内没有回应。请确认 Mirobody 正在运行、地址无误。`
}

function refusedText(result: McpCallResult, secrets: string[], timeoutMs: number): string {
  const detail = redact(result.error || '', secrets)
  if (result.error_kind === 'unavailable' && /time(?:d)? ?out/i.test(result.error ?? '')) return timeoutText(timeoutMs)
  if (result.error_kind === 'denied') return `Mirobody 拒绝了这个地址或令牌${detail ? `（${detail}）` : ''}。请检查个人 MCP 地址，或重新登录后复制令牌。`
  if (result.error_kind === 'unavailable') return `连不上这个地址${detail ? `（${detail}）` : ''}。请确认 Mirobody 正在运行、地址无误。`
  return `读取记录目录失败${detail ? `（${detail}）` : ''}。`
}

/**
 * Read the record catalogue once through an address and token, within CONNECTION_TEST_MS in all.
 * Never saves anything. Errors are in Chinese, with the address and token taken out.
 */
export async function testConnection(
  input: { mcp_url: string; mcp_token?: string; member?: string },
  timeoutMs = CONNECTION_TEST_MS,
): Promise<ConnectionTest> {
  const url = input.mcp_url.trim()
  const token = (input.mcp_token ?? '').trim()
  const secrets = [url, token]
  const member = (input.member ?? '').trim()
  const call = callMcpTool({ url, token, name: 'query_health_indicators', args: member ? { member } : {}, timeoutMs })
  const settled = await within(call, timeoutMs)
  if (!('value' in settled)) return { ok: false, error: timeoutText(timeoutMs) }
  const result = settled.value
  if (result.success === false) return { ok: false, error: refusedText(result, secrets, timeoutMs) }
  const payload = result.result ?? result.text ?? null
  const refused = tableOf(payload)?.error
  if (refused) return { ok: false, error: `Mirobody 没有给出记录目录（${redact(`${refused.kind}: ${refused.message}`, secrets)}）。` }
  return { ok: true, indicators: summarizeIndicators(payload, 10_000).length }
}
