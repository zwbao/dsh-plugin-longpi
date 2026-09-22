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
import { PRODUCT_NAME, PRODUCT_VERSION } from './version.ts'

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

    scoped.webServer.register({
      kind: 'exact',
      path: '/api/longpi/board',
      handler: (req, res) => {
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          sendJson(res, 405, { ok: false, error: 'GET only' })
          return
        }
        void (async () => {
          const current = config()
          const dataDir = resolveDataDir(current.dataDir)
          const catalog = loadCatalog(resolveSkillsHome(current.skillsHome))
          const records = await loadRecords(current, dataDir, mount.pluginHome)
          sendJson(res, 200, buildBoard({
            catalog,
            records,
            mount,
            receipts: readReceipts(dataDir, 5),
            limit: clampMatches(current.maxSkillMatches),
          }))
        })().catch(() => sendJson(res, 500, { ok: false, error: 'board failed' }))
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
          const catalog = loadCatalog(resolveSkillsHome(current.skillsHome))
          const records = await loadRecords(current, dataDir, mount.pluginHome)
          const matched = matchSkills(
            catalog.cards,
            questionOf(req.url),
            records.indicators.map((item) => item.name),
            clampMatches(current.maxSkillMatches),
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
          sendJson(res, 200, { ok: true, profile: normalized.profile })
        })().catch((error: unknown) => {
          const message = error instanceof Error ? error.message : 'profile failed'
          sendJson(res, 400, { ok: false, error: message === 'body too large' ? message : 'profile failed' })
        })
      },
    })
  })
}
