import type { IncomingMessage, ServerResponse } from 'node:http'
import type { Context } from '@deepseek-ai/cordis'
import { buildBoard } from './board.ts'
import { loadCatalog } from './catalog.ts'
import type { Config } from './config.ts'
import { matchSkills } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveSkillsHome } from './paths.ts'
import { mergeProfile, normalizeProfile, readProfile, setConsent, writeProfile } from './profile.ts'
import { loadRecords } from './records.ts'
import { readReceipts } from './runner.ts'
import { latestOutputs } from './history.ts'
import { loadEvidenceLexicon } from './intents.ts'
import { buildStats } from './stats.ts'
import { PRODUCT_NAME, PRODUCT_VERSION } from './version.ts'
import { addCheckIns, currentPlan, isoDay, normalizePlan, savePlan } from './interventions.ts'
import { acceptedPlan, buildPlanBrief, draftPlan } from './planner.ts'
import { buildReport, readiness, runReady } from './overview.ts'
import { invalidateRecords } from './records.ts'
import { buildTracking, invalidateTracking } from './tracking.ts'
import { buildJourney, buildJourneyFull, followupStateOf, within } from './journey.ts'
import { followupResponse, sendNow, writeFollowup, FOLLOWUP_TEST_TEXT } from './followup.ts'
import { buildCalendar } from './calendar.ts'
import { addSelf, deleteSelf, readSelf } from './selfmeasure.ts'

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
  return paramOf(url, 'q')
}

function paramOf(url: string | undefined, name: string): string {
  if (!url) return ''
  return new URL(url, 'http://127.0.0.1').searchParams.get(name)?.trim() ?? ''
}

async function readJson(req: IncomingMessage, limit?: number): Promise<{ ok: true; value: unknown } | { ok: false }> {
  const raw = await readBody(req, limit)
  try {
    return { ok: true, value: JSON.parse(raw) as unknown }
  } catch {
    return { ok: false }
  }
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

    const journeyContext = async () => {
      const { current, dataDir, skillsHome, catalog, records } = await context()
      return { config: current, dataDir, skillsHome, catalog, records, today: isoDay(), mount }
    }

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/journey',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          if (paramOf(req.url, 'refresh')) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, 200, await buildJourney(await journeyContext()))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'journey failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/plan-draft',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const input = await journeyContext()
          const brief = await buildPlanBrief(input)
          sendJson(res, 200, { brief, draft: draftPlan(brief, { today: input.today }) })
        })().catch(() => sendJson(res, 500, { ok: false, error: 'plan draft failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/plan-draft/accept',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const body = await readJson(req, 64_000)
          const posted = body.ok && body.value && typeof body.value === 'object' ? (body.value as Record<string, unknown>).draft : undefined
          if (!posted || typeof posted !== 'object') {
            sendJson(res, 400, { ok: false, error: 'body must be {"draft": {...}}' })
            return
          }
          const input = await journeyContext()
          // The items are rebuilt from the evidence by id, then saved exactly like a confirmed plan.
          const accepted = acceptedPlan(await buildPlanBrief(input), posted, input.today)
          if (!accepted.ok) {
            sendJson(res, 400, { ok: false, error: accepted.error, problems: accepted.problems })
            return
          }
          const normalized = normalizePlan(accepted.plan, {
            today: input.today,
            medications: input.records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
            previous: currentPlan(input.dataDir),
          })
          if (normalized.errors.length > 0) {
            sendJson(res, 400, { ok: false, error: normalized.errors[0], problems: normalized.errors })
            return
          }
          const saved = savePlan(input.dataDir, normalized.plan)
          invalidateTracking()
          sendJson(res, 200, { ok: true, plan: { version: saved.version, title: saved.title, items: saved.items.length } })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? error.message : 'accept failed'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    // Retest dates and open check-ins for the next planned follow-up; null when the journey is slow or fails.
    const followupStateNow = async () => {
      const built = await within(buildJourneyFull(await journeyContext()), 20_000).catch(() => null)
      return built && 'value' in built ? followupStateOf(built.value.journey, built.value.tracking) : null
    }

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/followup',
      handler: (req, res) => {
        const dataDir = resolveDataDir(config().dataDir)
        if (req.method === 'GET') {
          void (async () => {
            sendJson(res, 200, followupResponse(dataDir, await followupStateNow()))
          })().catch(() => sendJson(res, 500, { ok: false, error: 'follow-up failed' }))
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'GET or POST' })
          return
        }
        void (async () => {
          const body = await readJson(req, 8000)
          if (!body.ok) {
            sendJson(res, 400, { ok: false, error: 'settings must be JSON' })
            return
          }
          const written = writeFollowup(dataDir, body.value)
          if (!written.ok) {
            sendJson(res, 400, { ok: false, error: written.error })
            return
          }
          sendJson(res, 200, { ok: true, ...followupResponse(dataDir, await followupStateNow()) })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? error.message : 'follow-up failed'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/followup/test',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          // A test goes out even while follow-up is off (it is how the person checks a channel before turning it on);
          // it is logged and counts toward the daily limit, but never stands in for a scheduled reminder.
          const result = await sendNow(resolveDataDir(config().dataDir), FOLLOWUP_TEST_TEXT, 'test')
          sendJson(res, 200, result)
        })().catch(() => sendJson(res, 500, { ok: false, channels: {}, error: 'test failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/consent',
      handler: (req, res) => {
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'POST only' })
          return
        }
        void (async () => {
          const body = await readJson(req)
          const accept = body.ok && body.value && typeof body.value === 'object' ? (body.value as Record<string, unknown>).accept : undefined
          if (typeof accept !== 'boolean') {
            sendJson(res, 400, { ok: false, error: 'body must be {"accept": true|false}' })
            return
          }
          const consent = setConsent(resolveDataDir(config().dataDir), accept, new Date())
          invalidateTracking()
          sendJson(res, 200, { ok: true, consent })
        })().catch(() => sendJson(res, 400, { ok: false, error: 'consent failed' }))
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/self',
      handler: (req, res) => {
        const dataDir = resolveDataDir(config().dataDir)
        if (req.method === 'GET') {
          sendJson(res, 200, { rows: readSelf(dataDir).reverse().slice(0, 200) })
          return
        }
        if (req.method === 'DELETE') {
          const removed = deleteSelf(dataDir, paramOf(req.url, 'id'))
          if (removed) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, removed ? 200 : 404, { ok: removed, ...(removed ? {} : { error: 'no such measurement' }) })
          return
        }
        if (req.method !== 'POST') {
          sendJson(res, 405, { ok: false, error: 'GET, POST or DELETE' })
          return
        }
        void (async () => {
          const body = await readJson(req, 32_000)
          if (!body.ok) {
            sendJson(res, 400, { ok: false, error: 'measurements must be JSON' })
            return
          }
          const value = body.value as Record<string, unknown> | unknown[] | null
          const entries = Array.isArray(value) ? value
            : value && typeof value === 'object' && Array.isArray((value as Record<string, unknown>).entries) ? (value as { entries: unknown[] }).entries
              : [value]
          const result = addSelf(dataDir, entries, { today: isoDay() })
          if (result.saved.length > 0) {
            invalidateRecords()
            invalidateTracking()
          }
          sendJson(res, result.saved.length > 0 ? 200 : 400, { ok: result.saved.length > 0, saved: result.saved, problems: result.problems })
        })().catch((error: unknown) => {
          const message = error instanceof Error && error.message === 'body too large' ? error.message : 'measurement failed'
          sendJson(res, 400, { ok: false, error: message })
        })
      },
    })

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/calendar.ics',
      handler: (req, res) => {
        if (req.method !== 'GET') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const journeyIn = await journeyContext()
          const tracking = await buildTracking(journeyIn)
          const text = buildCalendar(await buildJourney(journeyIn), tracking, { now: new Date() })
          res.statusCode = 200
          res.setHeader('Content-Type', 'text/calendar; charset=utf-8')
          res.setHeader('Content-Disposition', 'attachment; filename="longpi.ics"')
          res.setHeader('Cache-Control', 'no-store')
          res.end(text)
        })().catch(() => sendJson(res, 500, { ok: false, error: 'calendar failed' }))
      },
    })

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
          const dataDir = resolveDataDir(config().dataDir)
          const update = parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : null
          // mergeProfile keeps the saved consent and ignores one in the body: consent has its own route.
          const normalized = update ? normalizeProfile(mergeProfile(readProfile(dataDir), update)) : normalizeProfile(parsed)
          if (!normalized.ok) {
            sendJson(res, 400, { ok: false, error: normalized.error })
            return
          }
          writeProfile(dataDir, normalized.profile)
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
