// Page routes for M7: upload (chunked, a server path, or pasted text), findings, meds, conditions,
// and Mirobody login that mints the personal MCP URL (no copy-paste).

import { randomBytes } from 'node:crypto'
import type { CoreDeps } from '../contracts/index.ts'
import { connectionUrlProblem, loginMirobody, maskMcpUrl, saveConnection, testConnection } from '../connection.ts'
import { listConditions, rememberCondition } from './conditions.ts'
import { readGenetics } from './genetics.ts'
import { listMedications, rememberMedication } from './meds.ts'
import { findingsFromIndicators, listFindings } from './narrative.ts'
import { ingestDocument, type SocketOpener } from './upload.ts'

const CHUNK_RAW = 24 * 1024
const MAX_FILE = 32 * 1024 * 1024

interface Pending {
  filename: string
  contentType: string
  size: number
  chunks: Map<number, Buffer>
  total: number
  at: number
}

const pending = new Map<string, Pending>()

function bodyOf(body: unknown): Record<string, unknown> {
  return body && typeof body === 'object' && !Array.isArray(body) ? body as Record<string, unknown> : {}
}

function fail(error: string, status = 400): { ok: false; status: number; error: string } {
  return { ok: false, status, error }
}

export function registerDatainRoutes(deps: CoreDeps, open?: SocketOpener): void {
  deps.http.route('GET', '/api/longpi/findings', async () => {
    const dataDir = deps.dataDir()
    try {
      const context = await deps.context()
      findingsFromIndicators(dataDir, context.records.indicators)
    } catch {
      // The list below is whatever was already stored.
    }
    const findings = listFindings(dataDir).slice().reverse()
    return {
      ok: true,
      findings: findings.map((row) => ({
        id: row.id, date: row.date, kind: row.kind, text_zh: row.text_zh, grade: row.grade ?? '',
        ...(row.page_note_zh ? { page_note_zh: row.page_note_zh } : {}),
      })),
      genetics: readGenetics(dataDir),
    }
  })

  deps.http.route('GET', '/api/longpi/meds', async () => {
    const listed = listMedications(deps.dataDir())
    return { ok: true, lines: listed.lines, medications: listed.rows }
  })

  deps.http.route('POST', '/api/longpi/meds', async (_req, body) => {
    const value = bodyOf(body)
    const name = typeof value.name === 'string' ? value.name : ''
    const saved = rememberMedication(deps.dataDir(), {
      name,
      dose_text: typeof value.dose_text === 'string' ? value.dose_text : '',
      frequency_text: typeof value.frequency_text === 'string' ? value.frequency_text : '',
      since: typeof value.since === 'string' ? value.since : '',
    })
    if (!saved.ok) return fail(saved.error)
    return { ok: true, read_back: saved.read_back, ...listMedications(deps.dataDir()) }
  })

  deps.http.route('GET', '/api/longpi/conditions', async () => ({ ok: true, conditions: listConditions(deps.dataDir()) }))

  deps.http.route('POST', '/api/longpi/conditions', async (_req, body) => {
    const value = bodyOf(body)
    const name = typeof value.name_zh === 'string' ? value.name_zh : ''
    const state = value.state === 'past' || value.state === 'suspected' || value.state === 'ruled_out' || value.state === 'current' ? value.state : 'current'
    const saved = rememberCondition(deps.dataDir(), {
      name_zh: name,
      state,
      since: typeof value.since === 'string' ? value.since : '',
      quote_zh: typeof value.quote === 'string' ? value.quote : '',
      via: 'page',
    })
    if (!saved.ok) return fail(saved.error)
    return { ok: true, read_back: saved.read_back, conditions: listConditions(deps.dataDir()) }
  })

  deps.http.route('POST', '/api/longpi/mirobody/login', async (_req, body) => {
    const value = bodyOf(body)
    const base = typeof value.base_url === 'string' ? value.base_url.trim() : ''
    const email = typeof value.email === 'string' ? value.email.trim() : ''
    const password = typeof value.password === 'string' ? value.password : ''
    const problem = connectionUrlProblem(base)
    if (problem) return fail(problem)
    if (!email.includes('@')) return fail('请填写 Mirobody 的邮箱。')
    if (password.length < 8) return fail('密码至少 8 位。')
    const minted = await loginMirobody({ base_url: base, email, password })
    if (!minted.ok) return fail(minted.error)
    const tested = await testConnection({ mcp_url: minted.mcp_url, mcp_token: minted.mcp_token, member: deps.config().member })
    if (!tested.ok) return fail(tested.error)
    saveConnection(deps.dataDir(), { mcp_url: minted.mcp_url, mcp_token: minted.mcp_token })
    try { deps.invalidate() } catch { /* the connection file is saved */ }
    return { ok: true, url_masked: maskMcpUrl(minted.mcp_url), indicators: tested.indicators }
  })

  deps.http.route('POST', '/api/longpi/upload', async (_req, body) => {
    const value = bodyOf(body)
    const op = typeof value.op === 'string' ? value.op : 'path'
    if (op === 'text') {
      const text = typeof value.text === 'string' ? value.text : ''
      if (text.trim().length < 4) return fail('没有可以读的文字。')
      if (text.length > 200_000) return fail('粘贴的文字太长。请改为上传文件。')
      return ingestDocument(deps, { filename: typeof value.filename === 'string' ? value.filename : 'pasted.txt', text, upload: false })
    }
    if (op === 'path') {
      const path = typeof value.path === 'string' ? value.path : ''
      if (!path) return fail('没有文件路径。')
      try {
        return ingestDocument(deps, { filename: path.split('/').pop() || 'report', path, open })
      } catch (error) {
        return fail(error instanceof Error ? '读不到这个文件。' : '读不到这个文件。')
      }
    }
    if (op === 'start') {
      const filename = typeof value.filename === 'string' && value.filename.trim() ? value.filename.trim() : 'report'
      const size = typeof value.size === 'number' ? value.size : 0
      if (size <= 0 || size > MAX_FILE) return fail('文件为空，或超过 32 MB。基因叙述版请发到健康对话里，不要从网页整本上传。')
      const id = `up-${Date.now().toString(36)}-${randomBytes(3).toString('hex')}`
      const total = Math.max(1, Math.ceil(size / CHUNK_RAW))
      pending.set(id, { filename, contentType: typeof value.content_type === 'string' ? value.content_type : 'application/octet-stream', size, chunks: new Map(), total, at: Date.now() })
      return { ok: true, id, total }
    }
    if (op === 'chunk') {
      const id = typeof value.id === 'string' ? value.id : ''
      const row = pending.get(id)
      if (!row) return fail('上传已经过期，请重新选择文件。')
      const index = typeof value.index === 'number' ? value.index : -1
      const b64 = typeof value.b64 === 'string' ? value.b64 : ''
      if (index < 0 || index >= row.total || !b64) return fail('这一段文件不完整。')
      const buf = Buffer.from(b64, 'base64')
      if (buf.length > CHUNK_RAW + 8) return fail('这一段太大。')
      row.chunks.set(index, buf)
      return { ok: true, received: row.chunks.size, total: row.total }
    }
    if (op === 'finish') {
      const id = typeof value.id === 'string' ? value.id : ''
      const row = pending.get(id)
      if (!row) return fail('上传已经过期，请重新选择文件。')
      if (row.chunks.size !== row.total) return fail(`还缺 ${row.total - row.chunks.size} 段。`)
      const bytes = Buffer.concat([...row.chunks.entries()].sort((a, b) => a[0] - b[0]).map(([, buf]) => buf))
      pending.delete(id)
      return ingestDocument(deps, { filename: row.filename, bytes, open })
    }
    return fail('不认识的上传步骤。')
  })
}
