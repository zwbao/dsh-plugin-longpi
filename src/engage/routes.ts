// HTTP for the season, the streak freeze, the Codex and the weekly note.
// guardRoute is applied by boot, so these handlers assume the request is already allowed.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { actEngage, drawEngage, freezeEngage, prefsEngage, syncEngage } from './engine.ts'

type Handler = (req: IncomingMessage, res: ServerResponse) => void

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, limit = 8000): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > limit) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      if (!raw.trim()) { resolve({}); return }
      try { resolve(JSON.parse(raw) as unknown) } catch { reject(new Error('json')) }
    })
    req.on('error', reject)
  })
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
}

function day(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function mountEngageRoutes(register: (path: string, handler: Handler) => void, dataDir: () => string): void {
  const fail = (res: ServerResponse, error: unknown) => {
    const message = error instanceof Error && error.message === 'json' ? '请求不是 JSON。' : '这一季暂时没有读出来，请再试一次。'
    sendJson(res, error instanceof Error && error.message === 'json' ? 400 : 500, { ok: false, error: message })
  }

  register('/api/longpi/season', (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      try { sendJson(res, 200, syncEngage(dataDir())) } catch (error) { fail(res, error) }
      return
    }
    if (method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 GET 或 POST。' }); return }
    void readBody(req).then((body) => {
      const row = isRecord(body) ? body : {}
      const action = row.action
      if (action !== 'care_visit' && action !== 'addon' && action !== 'retest' && action !== 'next_season') {
        sendJson(res, 400, { ok: false, error: 'action 只能是 care_visit、addon、retest 或 next_season。' })
        return
      }
      const result = action === 'care_visit'
        ? actEngage(dataDir(), { action, with_brief: row.with_brief === true })
        : action === 'addon'
          ? actEngage(dataDir(), { action, key: typeof row.key === 'string' ? row.key : '' })
          : actEngage(dataDir(), { action })
      sendJson(res, result.ok ? 200 : 400, result)
    }).catch((error) => fail(res, error))
  })

  register('/api/longpi/streak-freeze', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST。' }); return }
    void readBody(req).then((body) => {
      const row = isRecord(body) ? body : {}
      const reason = row.reason === 'sick' || row.reason === 'travel' || row.reason === 'other' ? row.reason
        : row.event === 'sick' || row.event === 'travel' ? row.event : row.event === 'injury' ? 'other' : null
      if (!reason) { sendJson(res, 400, { ok: false, error: 'reason 只能是 sick、travel 或 other。' }); return }
      const from = day(row.from)
      const to = day(row.to) || from
      sendJson(res, 200, freezeEngage(dataDir(), { reason, from, to }))
    }).catch((error) => fail(res, error))
  })

  register('/api/longpi/codex', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET。抽卡用 POST /api/longpi/codex/draw。' }); return }
    try {
      const view = syncEngage(dataDir())
      sendJson(res, 200, { ok: true, codex: view.codex, season_title_zh: view.season?.title_zh ?? null })
    } catch (error) { fail(res, error) }
  })

  register('/api/longpi/codex/draw', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST。' }); return }
    void readBody(req).then(() => {
      const result = drawEngage(dataDir())
      sendJson(res, 200, result)
    }).catch((error) => fail(res, error))
  })

  register('/api/longpi/weekly', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET。' }); return }
    try {
      const view = syncEngage(dataDir())
      sendJson(res, 200, { ok: true, text_zh: view.weekly_zh, week: view.season?.week ?? null, title_zh: view.season?.title_zh ?? null, recap_zh: view.season?.recap_zh ?? null })
    } catch (error) { fail(res, error) }
  })

  register('/api/longpi/nudges', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST。' }); return }
    void readBody(req).then((body) => {
      const row = isRecord(body) ? body : {}
      const view = prefsEngage(dataDir(), {
        ...(typeof row.codex_enabled === 'boolean' ? { codex: row.codex_enabled } : {}),
        ...(typeof row.nudge_in_workflow === 'boolean' ? { nudge: row.nudge_in_workflow } : {}),
        ...(row.dismiss === true ? { dismiss: true } : {}),
        ...(row.offer_seen === true ? { offerSeen: true } : {}),
        ...(row.shown === true ? { shown: true } : {}),
      })
      sendJson(res, 200, { ok: true, nudge: view.nudge, codex: { enabled: view.codex.enabled, hidden: view.codex.hidden, reason_zh: view.codex.reason_zh } })
    }).catch((error) => fail(res, error))
  })
}
