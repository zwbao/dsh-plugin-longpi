// Production aggregator skeleton. Simulated rounds can run here.
// Mainland hosting is a config: bind address, TLS, rate limit, audit log, health.
// The dev signing key is rejected unless accept_dev_key is explicitly on, and a ready
// production process keeps that flag off. scienceMode live is not turned on by this process.

import { createServer as createHttp, type IncomingMessage, type ServerResponse } from 'node:http'
import { createServer as createHttps } from 'node:https'
import { appendFileSync, mkdirSync, readFileSync } from 'node:fs'
import { dirname } from 'node:path'
import type { KeyObject } from 'node:crypto'
import { signFeed, type FeedBody, type SignedFeed } from './feed.ts'
import { generateEd25519, keyCertOk, publicFromB64, signingKeyAllowed, type KeyCert } from './keyring.ts'
import { recoverServerSum } from './threshold.ts'
import { SIM_KEY_ID } from './verify.ts'

export interface ProdConfig {
  region: 'cn-mainland'
  host: string
  port: number
  tls: { required: boolean; cert_pem?: string; key_pem?: string }
  rate_limit: { window_ms: number; max: number }
  audit_log?: string
  accept_dev_key: boolean
  root_public_b64: string
  feed_key_id: string
  keys: KeyCert[]
  icp_note_zh: string
}

interface RoundState {
  study_id: string
  stat_key: string
  min_cohort: number
  t: number
  epsilon: number
  joins: Set<string>
  masked: Map<string, string>
  summed: Map<string, { x: number; y: string }>
}

export interface ProdApp {
  config: ProdConfig
  audit: Array<Record<string, string | number>>
  setManifests(manifests: unknown[]): void
  feedPrivate: KeyObject
  listen(port?: number): Promise<string>
  close(): Promise<void>
}

const OPEN_KEYS = new Set(['study_id', 'stat_key', 'min_cohort', 't', 'epsilon'])
const JOIN_KEYS = new Set(['client_id'])
const SHARE_KEYS = new Set(['client_id', 'masked'])
const SUM_KEYS = new Set(['client_id', 'x', 'y'])

export function createProdAggregator(opts: {
  config: ProdConfig
  feedPrivateKey?: KeyObject
  today?: string
}): ProdApp {
  const config = opts.config
  const generated = opts.feedPrivateKey ? null : generateEd25519()
  const feedPrivate = opts.feedPrivateKey ?? generated!.privateKey
  const rounds = new Map<string, RoundState>()
  let seq = 0
  let manifests: unknown[] = []
  const audit: Array<Record<string, string | number>> = []
  const buckets = new Map<string, number[]>()
  const tlsOn = Boolean(config.tls.cert_pem && config.tls.key_pem)

  function record(row: Record<string, string | number>): void {
    audit.push(row)
    if (!config.audit_log) return
    mkdirSync(dirname(config.audit_log), { recursive: true })
    appendFileSync(config.audit_log, `${JSON.stringify(row)}\n`)
  }

  function limited(ip: string): boolean {
    const now = Date.now()
    const rows = (buckets.get(ip) ?? []).filter((at) => now - at < config.rate_limit.window_ms)
    if (rows.length >= config.rate_limit.max) {
      buckets.set(ip, rows)
      return true
    }
    rows.push(now)
    buckets.set(ip, rows)
    return false
  }

  function ready(): { ok: boolean; reason?: string } {
    if (config.tls.required && !tlsOn) return { ok: false, reason: '正式部署需要 TLS' }
    if (config.accept_dev_key) return { ok: false, reason: '开发签名不能在正式进程里接受' }
    if (config.root_public_b64.startsWith('REPLACE') || config.root_public_b64.length < 40) return { ok: false, reason: '还没有离线根公钥' }
    let root: ReturnType<typeof publicFromB64>
    try {
      root = publicFromB64(config.root_public_b64)
    } catch {
      return { ok: false, reason: '根公钥无法解析' }
    }
    const cert = config.keys.find((row) => row.key_id === config.feed_key_id)
    if (!cert) return { ok: false, reason: 'feed 密钥不在密钥环里' }
    const checked = keyCertOk(root, cert, opts.today ?? new Date().toISOString().slice(0, 10))
    if (!checked.ok) return checked
    return { ok: true }
  }

  function send(res: ServerResponse, status: number, body: unknown, meta: { ip: string; method: string; path: string }): void {
    record({ at: new Date().toISOString(), ip: meta.ip, method: meta.method, path: meta.path, status })
    const raw = JSON.stringify(body)
    res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
    res.end(raw)
  }

  function handle(req: IncomingMessage, res: ServerResponse): void {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const ip = req.socket.remoteAddress ?? 'unknown'
    const method = req.method ?? 'GET'
    const meta = { ip, method, path: url.pathname }
    if (method === 'GET' && (url.pathname === '/healthz' || url.pathname === '/v1/health')) {
      send(res, 200, { ok: true, region: config.region, live: false, service: 'longpi-aggregator', icp_note_zh: config.icp_note_zh }, meta)
      return
    }
    if (limited(ip)) {
      send(res, 429, { ok: false, error: '请求太密' }, meta)
      return
    }
    if (method === 'GET' && url.pathname === '/readyz') {
      const row = ready()
      send(res, row.ok ? 200 : 503, row, meta)
      return
    }
    if (method === 'GET' && url.pathname === '/v1/manifests') {
      const allowed = signingKeyAllowed(config.feed_key_id, { mode: config.accept_dev_key ? 'simulated' : 'live', acceptDevKey: config.accept_dev_key })
      if (!allowed.ok) {
        send(res, 403, { ok: false, error: allowed.reason }, meta)
        return
      }
      const body: FeedBody = { issued_at: new Date().toISOString(), analysis_sha256: url.searchParams.get('analysis') ?? '', manifests }
      const feed: SignedFeed = signFeed(body, config.feed_key_id, feedPrivate)
      send(res, 200, feed, meta)
      return
    }
    if (method === 'GET' && url.pathname === '/v1/registry') {
      send(res, 200, { ok: true, live: false, region: config.region, manifests: manifests.map(publicManifest) }, meta)
      return
    }
    const finish = (status: number, body: unknown) => send(res, status, body, meta)
    const parts = url.pathname.split('/').filter(Boolean)
    if (method === 'POST' && url.pathname === '/v1/rounds') {
      readBody(req).then((body) => finish(body.ok === false ? 400 : 200, openRound(body))).catch((error: Error) => finish(400, { ok: false, error: error.message }))
      return
    }
    if (parts[0] === 'v1' && parts[1] === 'rounds' && parts[2]) {
      const id = parts[2]
      if (method === 'GET' && parts.length === 3) {
        finish(200, stateOf(id))
        return
      }
      if (method === 'POST' && parts[3] === 'join') {
        readBody(req).then((body) => finish(body.ok === false ? 400 : 200, joinRound(id, body))).catch((error: Error) => finish(400, { ok: false, error: error.message }))
        return
      }
      if (method === 'POST' && parts[3] === 'share') {
        readBody(req).then((body) => finish(body.ok === false ? 400 : 200, shareRound(id, body))).catch((error: Error) => finish(400, { ok: false, error: error.message }))
        return
      }
      if (method === 'POST' && parts[3] === 'summed') {
        readBody(req).then((body) => finish(body.ok === false ? 400 : 200, sumRound(id, body))).catch((error: Error) => finish(400, { ok: false, error: error.message }))
        return
      }
      if (method === 'POST' && parts[3] === 'finalize') {
        finish(200, finalizeRound(id))
        return
      }
    }
    finish(404, { ok: false, error: 'not found' })
  }

  function openRound(body: Record<string, unknown>): Record<string, unknown> {
    const extra = unexpected(body, OPEN_KEYS)
    if (extra) return { ok: false, error: `unexpected field ${extra}` }
    if (typeof body.study_id !== 'string' || typeof body.stat_key !== 'string') return { ok: false, error: 'study_id and stat_key are required' }
    const min = Number(body.min_cohort ?? 20)
    const t = Number(body.t ?? min)
    if (!(min >= 2) || !(t >= 2)) return { ok: false, error: 'min_cohort and t must be at least 2' }
    const id = `t${(seq += 1).toString(36)}`
    rounds.set(id, {
      study_id: body.study_id,
      stat_key: body.stat_key,
      min_cohort: min,
      t,
      epsilon: Number(body.epsilon ?? 0),
      joins: new Set(),
      masked: new Map(),
      summed: new Map(),
    })
    return { ok: true, round_id: id, min_cohort: min, t, protocol: 'shamir-threshold' }
  }

  function stateOf(id: string): Record<string, unknown> {
    const row = rounds.get(id)
    if (!row) return { ok: false, error: 'no such round' }
    return { ok: true, round_id: id, study_id: row.study_id, stat_key: row.stat_key, min_cohort: row.min_cohort, t: row.t, joined: row.joins.size, submitted: row.masked.size }
  }

  function joinRound(id: string, body: Record<string, unknown>): Record<string, unknown> {
    const extra = unexpected(body, JOIN_KEYS)
    if (extra) return { ok: false, error: `unexpected field ${extra}` }
    const row = rounds.get(id)
    if (!row) return { ok: false, error: 'no such round' }
    if (typeof body.client_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(body.client_id)) return { ok: false, error: 'bad client_id' }
    row.joins.add(body.client_id)
    return { ok: true, n: row.joins.size }
  }

  function shareRound(id: string, body: Record<string, unknown>): Record<string, unknown> {
    const extra = unexpected(body, SHARE_KEYS)
    if (extra) return { ok: false, error: `unexpected field ${extra}` }
    const row = rounds.get(id)
    if (!row) return { ok: false, error: 'no such round' }
    if (typeof body.client_id !== 'string' || !row.joins.has(body.client_id)) return { ok: false, error: 'join before sending a share' }
    if (typeof body.masked !== 'string' || !/^\d+$/.test(body.masked)) return { ok: false, error: 'masked share must be a decimal field element' }
    row.masked.set(body.client_id, body.masked)
    return { ok: true, n: row.masked.size }
  }

  function sumRound(id: string, body: Record<string, unknown>): Record<string, unknown> {
    const extra = unexpected(body, SUM_KEYS)
    if (extra) return { ok: false, error: `unexpected field ${extra}` }
    const row = rounds.get(id)
    if (!row) return { ok: false, error: 'no such round' }
    if (typeof body.client_id !== 'string' || !row.masked.has(body.client_id)) return { ok: false, error: 'only a survivor can send a summed share' }
    if (typeof body.x !== 'number' || typeof body.y !== 'string' || !/^\d+$/.test(body.y)) return { ok: false, error: 'bad summed share' }
    row.summed.set(body.client_id, { x: body.x, y: body.y })
    return { ok: true, n: row.summed.size }
  }

  function finalizeRound(id: string): Record<string, unknown> {
    const row = rounds.get(id)
    if (!row) return { ok: false, error: 'no such round' }
    if (row.masked.size < row.min_cohort) return { ok: true, released: false, reason: 'min_cohort', n: row.masked.size, min_cohort: row.min_cohort }
    if (row.summed.size < row.t) return { ok: true, released: false, reason: 'threshold', n: row.masked.size, t: row.t, summed: row.summed.size }
    try {
      const masked = [...row.masked.entries()].map(([client_id, masked]) => ({ client_id, masked }))
      const summed = [...row.summed.values()]
      const recovered = recoverServerSum(masked, summed, row.t)
      return { ok: true, released: true, ...recovered, stat_key: row.stat_key, study_id: row.study_id, epsilon: row.epsilon, protocol: 'shamir-threshold' }
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : 'recover failed' }
    }
  }

  const server = tlsOn
    ? createHttps({ cert: config.tls.cert_pem, key: config.tls.key_pem }, handle)
    : createHttp(handle)

  return {
    config,
    audit,
    feedPrivate,
    setManifests(next) { manifests = next.slice() },
    listen(port = 0) {
      return new Promise((resolve) => {
        server.listen(port, config.host, () => {
          const address = server.address()
          const actual = address && typeof address === 'object' ? address.port : port
          const scheme = tlsOn ? 'https' : 'http'
          resolve(`${scheme}://${config.host}:${actual}`)
        })
      })
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

function unexpected(body: Record<string, unknown>, allowed: Set<string>): string | null {
  return Object.keys(body).find((key) => !allowed.has(key)) ?? null
}

function publicManifest(row: unknown): Record<string, unknown> {
  const manifest = row as { id?: string; version?: string; title_zh?: string; signature?: { key_id?: string }; analysis?: { release?: { min_cohort?: number } } }
  return {
    id: manifest.id ?? '',
    version: manifest.version ?? '',
    title_zh: manifest.title_zh ?? '',
    key_id: manifest.signature?.key_id ?? '',
    min_cohort: manifest.analysis?.release?.min_cohort ?? null,
  }
}

function readBody(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = []
    let size = 0
    req.on('data', (chunk: Buffer) => {
      size += chunk.length
      if (size > 32768) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        const body = text ? JSON.parse(text) as unknown : {}
        if (!body || typeof body !== 'object' || Array.isArray(body)) reject(new Error('body must be an object'))
        else resolve(body as Record<string, unknown>)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('bad json'))
      }
    })
    req.on('error', reject)
  })
}

export function readExampleConfig(path: string): { region: string; accept_dev_key: boolean; tls_required: boolean; root_public_b64: string; icp_note_zh: string } {
  const raw = JSON.parse(readFileSync(path, 'utf8')) as ProdConfig
  return {
    region: raw.region,
    accept_dev_key: raw.accept_dev_key,
    tls_required: raw.tls.required,
    root_public_b64: raw.root_public_b64,
    icp_note_zh: raw.icp_note_zh,
  }
}

export { SIM_KEY_ID }
