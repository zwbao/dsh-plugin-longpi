import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { buildBoard } from './board.ts'
import { loadCatalog } from './catalog.ts'
import type { Config } from './config.ts'
import { matchSkills } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveSkillsHome } from './paths.ts'
import { normalizeProfile, writeProfile } from './profile.ts'
import { loadRecords } from './records.ts'
import { readReceipts } from './runner.ts'
import { latestOutputs } from './history.ts'
import { loadEvidenceLexicon } from './intents.ts'
import { buildStats } from './stats.ts'
import { PRODUCT_NAME, PRODUCT_VERSION } from './version.ts'
import { addCheckIns, isoDay } from './interventions.ts'
import { buildReport, readiness, runReady } from './overview.ts'
import { invalidateRecords } from './records.ts'
import { buildTracking, invalidateTracking } from './tracking.ts'

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  if (res.writableEnded) return
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  res.end(JSON.stringify(body))
}

function readBody(req: IncomingMessage, limit = 8000): Promise<string> {
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
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
    req.on('error', reject)
  })
}

function questionOf(url: string | undefined): string {
  if (!url) return ''
  return new URL(url, 'http://127.0.0.1').searchParams.get('q')?.trim() ?? ''
}

export function registerRoutes(ctx: Context, config: () => Config, mount: MountState): void {
  ctx.inject(['webServer'], (scoped) => {
    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/version',
      handler: (_req, res) => sendJson(res, 200, { product: PRODUCT_NAME, version: PRODUCT_VERSION }),
    })

    const context = async () => {
      const current = config()
      const dataDir = resolveDataDir(current.dataDir)
      const skillsHome = resolveSkillsHome(current.skillsHome)
      const catalog = loadCatalog(skillsHome)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      return { current, dataDir, skillsHome, catalog, records }
    }

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/board',
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          if (new URL(req.url ?? '/', 'http://127.0.0.1').searchParams.get('refresh')) {
            invalidateRecords()
            invalidateTracking()
          }
          const { current, dataDir, catalog, records } = await context()
          const outputs = latestOutputs(dataDir)
          sendJson(res, 200, {
            ...buildBoard({
              catalog,
              records,
              mount,
              receipts: readReceipts(dataDir, 5),
              limit: clampMatches(current.maxSkillMatches),
              outputs,
            }),
            readiness: readiness(catalog, records, outputs),
            today: isoDay(),
          })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'board failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/tracking',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const { current, dataDir, skillsHome, catalog, records } = await context()
          sendJson(res, 200, await buildTracking({ config: current, dataDir, skillsHome, catalog, records, today: isoDay() }))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'tracking failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/checkin',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          let parsed: unknown
          try {
            parsed = JSON.parse(await readBody(req)) as unknown
          } catch {
            sendJson(res, 400, { ok: false, error: 'check-in must be JSON' })
            return
          }
          const entries = Array.isArray(parsed) ? parsed : [parsed]
          const result = addCheckIns(resolveDataDir(config().dataDir), entries, { today: isoDay(), source: 'board' })
          if (result.saved.length > 0) invalidateTracking()
          sendJson(res, result.saved.length > 0 ? 200 : 400, { ok: result.saved.length > 0, saved: result.saved, problems: result.problems })
        })().catch(() => sendJson(res, 400, { ok: false, error: 'check-in failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/run-ready',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const { current, dataDir, skillsHome, catalog, records } = await context()
          const results = await runReady({ config: current, dataDir, skillsHome, catalog, records, outputs: latestOutputs(dataDir) })
          invalidateTracking()
          sendJson(res, 200, { ok: true, results })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'run failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/report',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const { current, dataDir, skillsHome, catalog, records } = await context()
          const today = isoDay()
          const tracking = await buildTracking({ config: current, dataDir, skillsHome, catalog, records, today }).catch(() => null)
          const text = buildReport({ name: records.profile.displayName, today, records, tracking })
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/markdown; charset=utf-8')
          res.setHeader('Content-Disposition', `attachment; filename="longpi-report-${today}.md"`)
          res.setHeader('Cache-Control', 'no-store')
          res.end(text)
        })().catch(() => sendJson(res, 500, { ok: false, error: 'report failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/match',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const current = config()
          const dataDir = resolveDataDir(current.dataDir)
          const home = resolveSkillsHome(current.skillsHome)
          const catalog = loadCatalog(home)
          const records = await loadRecords(current, dataDir, mount.pluginHome)
          const matched = matchSkills(
            catalog.cards,
            questionOf(req.url),
            records.indicators,
            clampMatches(current.maxSkillMatches),
            {
              intents: catalog.intents,
              profile: { age: records.profile.age, sex: records.profile.sex },
              outputs: latestOutputs(dataDir),
              lexicon: loadEvidenceLexicon(home),
            },
          )
          sendJson(res, 200, {
            revision: catalog.revision,
            count: catalog.cards.length,
            error: catalog.error,
            ...matched,
          })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'match failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/stats',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        sendJson(res, 200, buildStats(resolveDataDir(config().dataDir)))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/intents',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        const catalog = loadCatalog(resolveSkillsHome(config().skillsHome))
        sendJson(res, 200, { version: catalog.version, intents: catalog.intents.map((item) => ({ id: item.id, label: item.label_zh, skills: item.skills })) })
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/profile',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const raw = await readBody(req)
          let parsed: unknown
          try {
            parsed = JSON.parse(raw) as unknown
          } catch {
            sendJson(res, 400, { ok: false, error: 'profile must be JSON' })
            return
          }
          const normalized = normalizeProfile(parsed)
          if (!normalized.ok) {
            sendJson(res, 400, { ok: false, error: normalized.error })
            return
          }
          writeProfile(resolveDataDir(config().dataDir), normalized.profile)
          invalidateTracking()
          sendJson(res, 200, { ok: true, profile: normalized.profile })
        })().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'profile failed'
          sendJson(res, 400, { ok: false, error: message === 'body too large' ? message : 'profile failed' })
        })
      },
    })
  })
}
