// M12 routes: GET /api/longpi/analysis, GET /api/longpi/analysis/report, POST start / import / plan-accept.

import type { CoreDeps } from '../contracts/index.ts'
import { currentReportHtml } from './store.ts'
import { acceptPlan, importLatest, planReadBack, startRun, statusNow } from './service.ts'

/** The report is written by an LLM-driven pipeline: shown in a sandboxed frame with no script and no network. */
export const REPORT_CSP = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; sandbox; frame-ancestors 'self'"

export function registerAnalysisRoutes(deps: CoreDeps): void {
  deps.http.route('GET', '/api/longpi/analysis', async () => {
    const status = statusNow(deps)
    return { ok: true, ...status, plan_read_back: status.current ? await planReadBack(deps) : null }
  })

  deps.http.route('GET', '/api/longpi/analysis/report', async () => {
    const html = currentReportHtml(deps.dataDir())
    if (!html) return { ok: false, status: 404, error: 'no imported analysis' }
    return { __raw: { type: 'text/html; charset=utf-8', body: html, headers: { 'Content-Security-Policy': REPORT_CSP, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer' } } }
  })

  deps.http.route('POST', '/api/longpi/analysis/start', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const res = await startRun(deps, { dataFolder: typeof value.data_folder === 'string' ? value.data_folder : null })
    return res.ok ? res : { ok: false, status: 409, error: res.reply_zh, missing: res.missing }
  })

  deps.http.route('POST', '/api/longpi/analysis/import', async (_req, body) => {
    const value = body && typeof body === 'object' ? body as Record<string, unknown> : {}
    const res = await importLatest(deps, typeof value.run_id === 'string' ? value.run_id : null)
    return res.ok ? res : { ok: false, status: 400, error: res.error_zh, problems: res.problems }
  })

  deps.http.route('POST', '/api/longpi/analysis/plan-accept', async () => {
    const res = await acceptPlan(deps)
    return res.ok ? res : { ok: false, status: 400, error: res.error_zh, problems: res.problems }
  })
}
