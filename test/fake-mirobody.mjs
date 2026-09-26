// A stand-in Mirobody MCP server for tests and the board preview. It serves
// test/fixtures/mirobody/record.json and renders every answer the way Mirobody
// 1.5 does (mirobody/agent/tools/_render.py). test/mirobody-format.mjs checks
// the rendering against fixtures produced by Mirobody's own code.

import { readFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const here = dirname(fileURLToPath(import.meta.url))
export const RECORD_PATH = join(here, 'fixtures', 'mirobody', 'record.json')

const COLUMNS = {
  catalog: ['indicator', 'system', 'code', 'count', 'first_date', 'last_date', 'reason'],
  readings: ['indicator', 'name', 'time', 'value', 'unit', 'system', 'code', 'file'],
  buckets: ['indicator', 'period', 'avg', 'min', 'max', 'n', 'unit', 'system', 'code'],
  stats: ['indicator', 'count', 'min', 'max', 'avg', 'first', 'first_date', 'last', 'last_date', 'change', 'unit', 'mixed_units', 'system', 'code'],
  latest: ['indicator', 'name', 'date', 'time', 'value', 'unit', 'system', 'code'],
}
const VIEW_COLUMNS = {
  plan: ['medication', 'status', 'schedule', 'today', 'since', 'until', 'source', 'plan_id'],
  log: ['date', 'time', 'medication', 'status', 'slot', 'dose', 'recorded_by', 'plan_id'],
  history: ['medication', 'start', 'end', 'closed_by', 'plan_id'],
}
const PLAN_NOTE = 'a plan is what the person intends to take; it is not a record of doses taken'
const LOG_NOTE = 'a dose missing from the log is not evidence it was not taken'

/** A Python float, printed the way str() prints it. */
export class PyFloat {
  constructor(value) { this.value = value }
  toString() {
    const v = this.value
    if (Number.isInteger(v)) return v.toFixed(1)
    return String(v)
  }
}

function pyRound(value, digits) {
  return Number(`${Math.round(Number(`${value}e${digits}`))}e-${digits}`)
}

function hasValue(value) {
  return value !== null && value !== undefined && !(typeof value === 'string' && !value.trim())
}

function cell(value) {
  if (value === null || value === undefined) return ''
  if (typeof value === 'boolean') return value ? 'True' : 'False'
  return String(value)
}

export function compact(rows, columns) {
  if (rows.length === 0) return ''
  const present = columns.filter((column) => rows.some((row) => hasValue(row[column])))
  if (present.length === 0) return ''
  const rendered = Object.fromEntries(present.map((column) => [column, rows.map((row) => cell(row[column]))]))
  const constants = present.filter((column) => new Set(rendered[column]).size === 1)
  const varying = present.filter((column) => !constants.includes(column))
  const out = []
  if (constants.length > 0) out.push(`(constants: ${constants.map((column) => `${column}=${rendered[column][0]}`).join(', ')})`)
  if (varying.length === 0) return out.join('\n')
  out.push(varying.join('|'))
  for (let i = 0; i < rows.length; i += 1) out.push(varying.map((column) => rendered[column][i]).join('|'))
  return out.join('\n')
}

function methodColumns(rows) {
  if (rows.length === 0) return []
  const first = rows[0]
  if ('period' in first) return COLUMNS.buckets
  if ('avg' in first && 'count' in first) return COLUMNS.stats
  if ('first_date' in first) return COLUMNS.catalog
  if ('time' in first && 'total' in first) return COLUMNS.readings
  if ('value' in first) return COLUMNS.latest
  return Object.keys(first)
}

function metaLine(meta) {
  const bits = []
  if (meta.tz || meta.window[0] || meta.window[1]) {
    const span = meta.window[0] || meta.window[1] ? `${meta.window[0]}..${meta.window[1]}` : 'all recorded data'
    bits.push(`window=${span}`, `tz=${meta.tz}`, `dates=${meta.semantics ?? 'tz_exact'}`)
  }
  if (meta.resolution) bits.push(`resolution=${meta.resolution}`)
  if (meta.aggregate && meta.aggregate !== 'none') bits.push(`aggregate=${meta.aggregate}/${meta.basis}`)
  bits.push(`rows=${meta.rows}`)
  if (meta.catalogTotal) bits.push(`of ${meta.catalogTotal}`)
  if (meta.truncated) bits.push('truncated')
  return `(${bits.join(', ')})`
}

export function renderCompact(envelope, columns) {
  if (envelope.status === 'error') {
    const reason = envelope.assumptions?.join('; ') || 'this lookup could not complete'
    return `error (${envelope.errorKind}): ${reason}. Fix the arguments and try once more.`
  }
  const rows = envelope.rows ?? []
  const table = rows.length ? compact(rows, columns ?? methodColumns(rows)) : ''
  const lines = [table || '(no rows)', '', metaLine(envelope.meta)]
  if (envelope.assumptions?.length) lines.push(`notes: ${envelope.assumptions.join('; ')}`)
  return lines.join('\n')
}

function payload(envelope, columns) {
  return {
    result: renderCompact(envelope, columns),
    status: envelope.status,
    row_count: envelope.meta?.rows ?? 0,
    truncated: Boolean(envelope.meta?.truncated),
    ...(envelope.errorKind ? { error_kind: envelope.errorKind } : {}),
  }
}

function meta(record, extra = {}) {
  return { window: ['', ''], tz: record.tz, resolution: '', aggregate: '', basis: '', rows: 0, truncated: false, catalogTotal: 0, ...extra }
}

function byIndicator(record) {
  const out = new Map()
  for (const row of record.observations) {
    if (!out.has(row.indicator)) out.set(row.indicator, [])
    out.get(row.indicator).push(row)
  }
  for (const rows of out.values()) rows.sort((a, b) => byCodePoint(a.time, b.time))
  return out
}

function pickNames(record, args) {
  const groups = byIndicator(record)
  if (Array.isArray(args.indicators) && args.indicators.length > 0) return args.indicators
  if (Array.isArray(args.keywords) && args.keywords.length > 0) {
    const words = args.keywords.map((word) => String(word).toLowerCase())
    return [...groups.keys()].filter((name) => words.some((word) => name.toLowerCase().includes(word)))
  }
  return null
}

export function queryIndicators(record, args = {}) {
  const groups = byIndicator(record)
  const names = pickNames(record, args)
  if (names === null) {
    const rows = [...groups.keys()].sort(byCodePoint).map((name) => {
      const items = groups.get(name)
      return {
        indicator: name, series: name, system: items[0].system, code: items[0].code, standard: true, name, kind: '',
        count: items.length, unit: items[0].unit, latest_value: items.at(-1).value, first_date: items[0].date,
        last_date: items.at(-1).date, total: groups.size, reason: '', day_known: true,
      }
    })
    return payload({ status: 'ok', rows, meta: meta(record, { rows: rows.length, catalogTotal: rows.length }) })
  }
  const unknown = names.filter((name) => !groups.has(name))
  if (unknown.length === names.length) {
    return payload({ status: 'error', errorKind: 'invalid_arguments', assumptions: [`indicator '${unknown[0]}' is not in this record`], meta: meta(record) })
  }
  const start = args.start || '0000-01-01'
  const end = args.end || '9999-12-31'
  const aggregate = args.aggregate || 'none'
  const resolution = args.resolution || 'raw'
  const window = args.start || args.end ? [args.start || '', args.end || ''] : ['', '']
  if (aggregate === 'latest') {
    const rows = names.filter((name) => groups.has(name)).map((name) => {
      const r = groups.get(name).filter((item) => item.date >= start && item.date <= end).at(-1)
      if (!r) return null
      return {
        indicator: name, series: name, system: r.system, code: r.code, name: r.name, time: r.time, date: r.date,
        value: r.value, unit: r.unit, value_canonical: null, unit_canonical: '', modality: '', basis: 'readings',
        day_known: true, provenance: 'measured',
      }
    }).filter(Boolean)
    return payload({ status: 'ok', rows, meta: meta(record, { window, aggregate: 'latest', basis: 'readings', rows: rows.length }) })
  }
  if (aggregate === 'stats') {
    const rows = []
    for (const name of names) {
      const items = (groups.get(name) ?? []).filter((item) => item.date >= start && item.date <= end)
      if (items.length === 0) continue
      const nums = items.map((item) => Number(item.value))
      rows.push({
        indicator: name, series: name, system: items[0].system, code: items[0].code, count: items.length,
        numeric_count: nums.length, min: new PyFloat(Math.min(...nums)), max: new PyFloat(Math.max(...nums)),
        avg: new PyFloat(pyRound(nums.reduce((a, b) => a + b, 0) / nums.length, 4)), first: items[0].value,
        first_date: items[0].date, last: items.at(-1).value, last_date: items.at(-1).date, unit: items[0].unit,
        mixed_units: false, basis: 'readings', day_known: true, provenance: 'computed',
        change: new PyFloat(pyRound(nums.at(-1) - nums[0], 4)),
      })
    }
    return payload({ status: 'ok', rows, meta: meta(record, { window, aggregate: 'stats', basis: 'readings', rows: rows.length }) })
  }
  if (resolution === 'raw') {
    const limit = Number(args.limit) || 50
    const rows = []
    let truncated = false
    for (const name of names) {
      const items = (groups.get(name) ?? []).filter((item) => item.date >= start && item.date <= end).sort((a, b) => byCodePoint(b.time, a.time))
      if (items.length > limit) truncated = true
      for (const r of items.slice(0, limit)) {
        rows.push({
          indicator: name, series: name, system: r.system, code: r.code, name: r.name, time: r.time, date: r.date,
          value: r.value, unit: r.unit, value_canonical: null, unit_canonical: '', file: r.file, file_key: '',
          row_id: null, modality: '', total: items.length, day_known: true, provenance: 'measured',
        })
      }
    }
    return payload({ status: 'ok', rows, meta: meta(record, { window, resolution: 'raw', aggregate: 'none', rows: rows.length, truncated }) })
  }
  const rows = []
  for (const name of names) {
    const perPeriod = new Map()
    let last = null
    for (const r of groups.get(name) ?? []) {
      if (r.date < start || r.date > end) continue
      const period = bucketOf(r.date, resolution)
      if (!perPeriod.has(period)) perPeriod.set(period, [])
      perPeriod.get(period).push(Number(r.value))
      last = r
    }
    for (const period of [...perPeriod.keys()].sort()) {
      const values = perPeriod.get(period)
      rows.push({
        indicator: name, series: name, system: last.system, code: last.code, period,
        avg: new PyFloat(pyRound(values.reduce((a, b) => a + b, 0) / values.length, 4)),
        min: new PyFloat(Math.min(...values)), max: new PyFloat(Math.max(...values)), n: values.length,
        unit: last.unit, day_known: true, provenance: 'measured',
      })
    }
  }
  return payload({ status: 'ok', rows, meta: meta(record, { window, resolution, aggregate: 'none', basis: 'buckets', rows: rows.length }) })
}

function bucketOf(date, resolution) {
  if (resolution === 'month') return date.slice(0, 7)
  if (resolution === 'week') {
    const at = new Date(`${date}T00:00:00Z`)
    const day = (at.getUTCDay() + 6) % 7
    at.setUTCDate(at.getUTCDate() - day)
    return at.toISOString().slice(0, 10)
  }
  return date
}

export function queryMedications(record, args = {}) {
  const view = args.view || 'plan'
  const meds = record.medications
  const words = (args.keywords ?? []).map((word) => String(word).toLowerCase())
  const matches = (name) => words.length === 0 || words.some((word) => name.toLowerCase().includes(word))
  if (view === 'log') {
    const end = args.end || record.today
    const start = args.start || shiftDays(end, -29)
    const rows = meds.log.filter((row) => row.date >= start && row.date <= end && matches(row.medication))
      .sort((a, b) => byCodePoint(b.date + b.medication, a.date + a.medication)).slice(0, 200)
    return payload({ status: 'ok', rows, assumptions: [LOG_NOTE], meta: meta(record, { window: [start, end], rows: rows.length }) }, VIEW_COLUMNS.log)
  }
  if (view === 'history') {
    const rows = meds.history.filter((row) => matches(row.medication))
    return payload({ status: 'ok', rows, meta: meta(record, { rows: rows.length }) }, VIEW_COLUMNS.history)
  }
  const rows = meds.plans.filter((row) => matches(row.medication))
  return payload({ status: 'ok', rows, assumptions: [PLAN_NOTE], meta: meta(record, { rows: rows.length }) }, VIEW_COLUMNS.plan)
}

function byCodePoint(a, b) {
  return a < b ? -1 : a > b ? 1 : 0
}

function shiftDays(iso, days) {
  const at = new Date(`${iso}T00:00:00Z`)
  at.setUTCDate(at.getUTCDate() + days)
  return at.toISOString().slice(0, 10)
}

export function loadRecord(path = RECORD_PATH) {
  return JSON.parse(readFileSync(path, 'utf8'))
}

/**
 * Start the fake server. Returns {url, calls, close}. calls counts tools/call
 * requests by tool name, so a test can check the harness reads the record once.
 * Options: record (instead of the fixture), token (Bearer required), sse,
 * port, failSeries (indicator names whose series reads fail).
 */
export async function startFakeMirobody(options = {}) {
  const record = options.record ?? loadRecord()
  const calls = []
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (options.token && req.headers.authorization !== `Bearer ${options.token}`) {
        res.statusCode = 401
        res.end('unauthorized')
        return
      }
      let body
      try {
        body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      } catch {
        res.statusCode = 400
        res.end('bad json')
        return
      }
      res.setHeader('mcp-session-id', 'fake-session')
      if (body.method === 'initialize') {
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'fake-mirobody', version: '1.5.0' } } }))
        return
      }
      if (body.method === 'notifications/initialized') {
        res.statusCode = 202
        res.end()
        return
      }
      if (body.method === 'tools/call') {
        const name = body.params?.name
        const args = body.params?.arguments ?? {}
        calls.push({ name, args })
        let result
        // options.failSeries: a series read (not the catalogue, latest or stats) that names one of these fails.
        const failing = Array.isArray(options.failSeries) && name === 'query_health_indicators' && !['latest', 'stats'].includes(args.aggregate)
          && (args.indicators ?? []).some((indicator) => options.failSeries.includes(indicator))
        if (failing) result = payload({ status: 'error', errorKind: 'unavailable', assumptions: ['upstream store did not answer'], meta: meta(record) })
        else if (name === 'query_health_indicators') result = queryIndicators(record, args)
        else if (name === 'query_medications') result = queryMedications(record, args)
        else {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, error: { code: -32601, message: `unknown tool ${name}` } }))
          return
        }
        const text = JSON.stringify(result)
        const message = { jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text }], structuredContent: result } }
        if (options.sse) {
          res.setHeader('content-type', 'text/event-stream')
          res.end(`event: message\ndata: ${JSON.stringify(message)}\n\n`)
        } else {
          res.setHeader('content-type', 'application/json')
          res.end(JSON.stringify(message))
        }
        return
      }
      res.statusCode = 404
      res.end()
    })
  })
  await new Promise((resolve) => server.listen(options.port ?? 0, '127.0.0.1', resolve))
  const { port } = server.address()
  return {
    url: `http://127.0.0.1:${port}/mcp`,
    calls,
    close: () => new Promise((resolve) => server.close(resolve)),
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.argv[2] ?? 8765)
  const started = await startFakeMirobody({ port })
  console.log(`fake Mirobody MCP on ${started.url}`)
}
