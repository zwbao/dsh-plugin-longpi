// Reference aggregator for simulated studies. It sums masked shares and never stores a raw lab value.
// Bind it to 127.0.0.1. This build's manifests refuse any other host.

import { createHash } from 'node:crypto'
import { createServer } from 'node:http'
import { fileURLToPath } from 'node:url'

const FIELD = 1n << 64n
const SCALE = 1_000_000
const ALLOWED = new Set(['study_id', 'stat_key', 'min_cohort', 'scale', 'client_id', 'public_b64', 'masked_b64', 'commitment', 'epsilon', 'mechanism'])

function mod(value) {
  const rest = value % FIELD
  return rest >= 0n ? rest : rest + FIELD
}

function toSigned(value) {
  const wrapped = mod(value)
  return wrapped >= (1n << 63n) ? wrapped - FIELD : wrapped
}

function badKeys(body) {
  return Object.keys(body).filter((key) => !ALLOWED.has(key))
}

export function createAggregator() {
  /** @type {Map<string, { study_id: string, stat_key: string, min_cohort: number, joins: Map<string, string>, shares: Map<string, { masked_b64: string, commitment: string }> }>} */
  const rounds = new Map()
  let seq = 0

  function round(id) {
    return rounds.get(id) ?? null
  }

  const routes = {
    health() {
      return { ok: true, rounds: rounds.size }
    },
    open(body) {
      const extra = badKeys(body)
      if (extra.length > 0) return { ok: false, error: `unexpected field ${extra[0]}` }
      if (typeof body.study_id !== 'string' || typeof body.stat_key !== 'string') return { ok: false, error: 'study_id and stat_key are required' }
      const min = Number(body.min_cohort ?? 20)
      if (!(min >= 2)) return { ok: false, error: 'min_cohort must be at least 2' }
      const id = `r${(seq += 1).toString(36)}`
      rounds.set(id, { study_id: body.study_id, stat_key: body.stat_key, min_cohort: min, joins: new Map(), shares: new Map() })
      return { ok: true, round_id: id, min_cohort: min }
    },
    state(id) {
      const row = round(id)
      if (!row) return { ok: false, error: 'no such round' }
      return {
        ok: true,
        round_id: id,
        study_id: row.study_id,
        stat_key: row.stat_key,
        min_cohort: row.min_cohort,
        n: row.joins.size,
        participants: [...row.joins.entries()].map(([client_id, public_b64]) => ({ client_id, public_b64 })),
      }
    },
    join(id, body) {
      const extra = badKeys(body)
      if (extra.length > 0) return { ok: false, error: `unexpected field ${extra[0]}` }
      const row = round(id)
      if (!row) return { ok: false, error: 'no such round' }
      if (typeof body.client_id !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(body.client_id)) return { ok: false, error: 'bad client_id' }
      if (typeof body.public_b64 !== 'string' || Buffer.from(body.public_b64, 'base64').length !== 32) return { ok: false, error: 'public key must be 32 bytes' }
      row.joins.set(body.client_id, body.public_b64)
      return { ok: true, n: row.joins.size }
    },
    share(id, body) {
      const extra = badKeys(body)
      if (extra.length > 0) return { ok: false, error: `unexpected field ${extra[0]}` }
      const row = round(id)
      if (!row) return { ok: false, error: 'no such round' }
      if (!row.joins.has(body.client_id)) return { ok: false, error: 'join before sending a share' }
      const bytes = Buffer.from(String(body.masked_b64 ?? ''), 'base64')
      if (bytes.length !== 8) return { ok: false, error: 'share must be 8 bytes' }
      const commitment = createHash('sha256').update(bytes).digest('hex')
      if (commitment !== body.commitment) return { ok: false, error: 'commitment does not match the share' }
      row.shares.set(body.client_id, { masked_b64: body.masked_b64, commitment })
      return { ok: true, n: row.shares.size }
    },
    finalize(id) {
      const row = round(id)
      if (!row) return { ok: false, error: 'no such round' }
      if (row.shares.size < row.min_cohort) return { ok: true, released: false, reason: 'min_cohort', n: row.shares.size, min_cohort: row.min_cohort }
      if (row.shares.size !== row.joins.size) return { ok: true, released: false, reason: 'missing share', n: row.shares.size }
      let sum = 0n
      for (const share of row.shares.values()) sum += Buffer.from(share.masked_b64, 'base64').readBigUInt64BE(0)
      const total = toSigned(mod(sum))
      const mean = Number(total) / SCALE / row.shares.size
      return { ok: true, released: true, n: row.shares.size, sum: Number(total) / SCALE, mean, stat_key: row.stat_key, study_id: row.study_id }
    },
  }

  function handle(req, res) {
    const url = new URL(req.url ?? '/', 'http://127.0.0.1')
    const send = (status, body) => {
      res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
      res.end(JSON.stringify(body))
    }
    const finish = (body) => send(body.ok === false ? 400 : 200, body)
    if (req.method === 'GET' && url.pathname === '/v1/health') return finish(routes.health())
    const parts = url.pathname.split('/').filter(Boolean)
    if (req.method === 'POST' && url.pathname === '/v1/rounds') return read(req).then((body) => finish(routes.open(body))).catch((error) => send(400, { ok: false, error: error.message }))
    if (parts[0] === 'v1' && parts[1] === 'rounds' && parts[2]) {
      const id = parts[2]
      if (req.method === 'GET' && parts.length === 3) return finish(routes.state(id))
      if (req.method === 'POST' && parts[3] === 'join') return read(req).then((body) => finish(routes.join(id, body))).catch((error) => send(400, { ok: false, error: error.message }))
      if (req.method === 'POST' && parts[3] === 'share') return read(req).then((body) => finish(routes.share(id, body))).catch((error) => send(400, { ok: false, error: error.message }))
      if (req.method === 'POST' && parts[3] === 'finalize') return finish(routes.finalize(id))
    }
    send(404, { ok: false, error: 'not found' })
  }

  const server = createServer(handle)
  return {
    routes,
    listen(port = 0) {
      return new Promise((resolve) => {
        server.listen(port, '127.0.0.1', () => {
          const address = server.address()
          const actual = address && typeof address === 'object' ? address.port : port
          resolve(`http://127.0.0.1:${actual}`)
        })
      })
    },
    close() {
      return new Promise((resolve) => server.close(() => resolve()))
    },
  }
}

function read(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    let size = 0
    req.on('data', (chunk) => {
      size += chunk.length
      if (size > 8192) {
        reject(new Error('body too large'))
        req.destroy()
        return
      }
      chunks.push(chunk)
    })
    req.on('end', () => {
      try {
        const text = Buffer.concat(chunks).toString('utf8')
        const body = text ? JSON.parse(text) : {}
        if (!body || typeof body !== 'object' || Array.isArray(body)) reject(new Error('body must be an object'))
        else resolve(body)
      } catch (error) {
        reject(error instanceof Error ? error : new Error('bad json'))
      }
    })
    req.on('error', reject)
  })
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]
if (isMain) {
  const port = Number(process.argv.find((arg) => arg.startsWith('--port='))?.slice(7) ?? 18184)
  const app = createAggregator()
  await app.listen(port)
  console.log(`longpi aggregator listening on http://127.0.0.1:${port}`)
}
