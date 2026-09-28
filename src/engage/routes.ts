// HTTP for the season, the streak freeze, the Codex and the weekly note.
// guardRoute is applied by boot, so these handlers assume the request is already allowed.

import type { IncomingMessage, ServerResponse } from 'node:http'
import { oddsDisclosure } from './droptable.ts'
import { loadCodexPack } from './codex.ts'
import { calendarEvents, confirmEvent, listEvents, saveEvent, suggestEvent } from '../ux/schedule.ts'
import { actEngage, drawEngage, freezeEngage, prefsEngage, runCodexMethod, shareEngage, syncEngage } from './engine.ts'

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
      if (action === 'opt_in' || action === 'opt_out') {
        sendJson(res, 200, prefsEngage(dataDir(), { pressure: action === 'opt_in' }))
        return
      }
      if (action === 'decline_invite') {
        sendJson(res, 200, prefsEngage(dataDir(), { declineInvite: true }))
        return
      }
      if (action === 'family_on' || action === 'family_off') {
        sendJson(res, 200, prefsEngage(dataDir(), { family: action === 'family_on' }))
        return
      }
      if (action === 'share_card' || action === 'share_recap') {
        const shared = shareEngage(dataDir(), { kind: action === 'share_card' ? 'card' : 'recap', card_id: typeof row.card_id === 'string' ? row.card_id : undefined })
        sendJson(res, shared.ok ? 200 : 400, shared)
        return
      }
      if (action !== 'care_visit' && action !== 'addon' && action !== 'retest' && action !== 'next_season' && action !== 'book') {
        sendJson(res, 400, { ok: false, error: 'action 不能识别。' })
        return
      }
      const measurements = Array.isArray(row.measurements)
        ? row.measurements.flatMap((item) => {
          if (!item || typeof item !== 'object') return []
          const record = item as Record<string, unknown>
          const key = typeof record.key === 'string' ? record.key : ''
          const value = typeof record.value === 'number' ? record.value : Number.NaN
          if (!key || !Number.isFinite(value)) return []
          return [{ key, value, ...(typeof record.date === 'string' ? { date: record.date } : {}) }]
        })
        : undefined
      const result = action === 'care_visit'
        ? actEngage(dataDir(), { action, with_brief: row.with_brief === true })
        : action === 'addon'
          ? actEngage(dataDir(), { action, key: typeof row.key === 'string' ? row.key : '' })
          : action === 'book'
            ? actEngage(dataDir(), { action, department_zh: typeof row.department_zh === 'string' ? row.department_zh : undefined })
            : action === 'retest'
              ? actEngage(dataDir(), { action, ...(measurements ? { measurements } : {}) })
              : actEngage(dataDir(), { action: 'next_season' })
      sendJson(res, result.ok ? 200 : 400, result)
    }).catch((error) => fail(res, error))
  })

  register('/api/longpi/schedule', (req, res) => {
    const method = (req.method ?? 'GET').toUpperCase()
    if (method === 'GET') {
      try {
        const rows = listEvents(dataDir())
        sendJson(res, 200, { ok: true, suggestions: rows.filter((row) => !row.confirmed), events: rows.filter((row) => row.confirmed) })
      } catch (error) { fail(res, error) }
      return
    }
    if (method !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 GET 或 POST。' }); return }
    void readBody(req).then((body) => {
      const row = isRecord(body) ? body : {}
      const kind = row.kind === 'visit' || row.kind === 'retest' || row.kind === 'followup' ? row.kind : 'visit'
      const date = typeof row.date === 'string' ? row.date.slice(0, 10) : ''
      const title = typeof row.title_zh === 'string' ? row.title_zh : ''
      if (!date || !title) { sendJson(res, 400, { ok: false, error: '需要日期和标题。' }); return }
      const draft = suggestEvent({
        date,
        kind,
        title_zh: title,
        brief_zh: typeof row.brief_zh === 'string' ? row.brief_zh : '',
        questions_zh: Array.isArray(row.questions_zh) ? row.questions_zh.filter((item) => typeof item === 'string') : [],
        ...(typeof row.id === 'string' ? { id: row.id } : {}),
      })
      const saved = row.confirm === true ? saveEvent(dataDir(), confirmEvent(draft)) : saveEvent(dataDir(), draft)
      sendJson(res, 200, { ok: true, event: saved, events: calendarEvents(dataDir()) })
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

  register('/api/longpi/codex/odds', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'GET') { sendJson(res, 405, { ok: false, error: '只接受 GET。' }); return }
    try {
      const pack = loadCodexPack()
      const text = oddsDisclosure(pack.table, pack.cards)
      const html = `<!doctype html><html lang="zh"><meta charset="utf-8"><title>长寿图鉴概率</title><body style="font:16px/1.6 sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem"><h1>长寿图鉴概率</h1><p>${text.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</p><p>每个成年人的概率都一样。未满 18 岁不开放图鉴。没有付费，不能交易。稀有度不由指标决定。</p></body></html>`
      res.statusCode = 200
      res.setHeader('Content-Type', 'text/html; charset=utf-8')
      res.setHeader('Cache-Control', 'no-store')
      res.end(html)
    } catch (error) { fail(res, error) }
  })

  register('/api/longpi/codex/run', (req, res) => {
    if ((req.method ?? '').toUpperCase() !== 'POST') { sendJson(res, 405, { ok: false, error: '只接受 POST。' }); return }
    void readBody(req).then(async (body) => {
      const row = isRecord(body) ? body : {}
      const cardId = typeof row.card_id === 'string' ? row.card_id : ''
      if (!cardId) { sendJson(res, 400, { ok: false, error: '需要 card_id。' }); return }
      const result = await runCodexMethod(dataDir(), cardId)
      sendJson(res, result.ok ? 200 : 400, result)
    }).catch((error) => fail(res, error))
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
