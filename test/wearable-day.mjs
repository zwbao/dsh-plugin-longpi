// Mirobody 1.5.0 and 1.5.1 day buckets of an uncoded series (dailySteps,
// dailyTotalSleepTime) omit the indicator name. loadSeries used to drop those
// rows, so wearable adherence saw no days. The fixture is a recorded answer
// from the local 1.5.0 server; 1.5.1's bucket SQL selects display and not the
// printed name, so the same table has no indicator column there either.

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFileSync } from 'node:fs'
import * as mod from '../lib/index.js'
import { startFakeMirobody } from './fake-mirobody.mjs'

const recorded = JSON.parse(readFileSync(new URL('./fixtures/mirobody/recorded/day-unnamed-1.5.0.json', import.meta.url), 'utf8'))
const window = { start: recorded.window.start, end: recorded.window.end, resolution: 'day' }

const both = mod.parseCompact(recorded.day.both.result)
assert.equal(both.rows.length, 8)
assert.ok(both.rows.every((row) => !row.indicator), 'the recorded two-series day table has no indicator to match on')
assert.deepEqual(both.rows.map((row) => row.unit), ['{#}', '{#}', '{#}', '{#}', 'h', 'h', 'h', 'h'])
assert.equal(both.meta.tz, 'Asia/Shanghai')
assert.equal(both.meta.resolution, 'day')

const stepsOnly = mod.parseCompact(recorded.day.dailySteps.result)
assert.equal(stepsOnly.rows.length, 4)
assert.ok(stepsOnly.rows.every((row) => !row.indicator && row.unit === '{#}'))
assert.deepEqual(stepsOnly.rows.map((row) => row.period), ['2026-07-26', '2026-07-27', '2026-07-28', '2026-07-30'])

function payloadFor(args) {
  const names = args.indicators ?? []
  if (names.length === 1 && recorded.day[names[0]]) {
    const item = recorded.day[names[0]]
    return { result: item.result, status: item.status, row_count: item.row_count, truncated: item.truncated }
  }
  // A two-name day call is the ambiguous table. The fix must not make one.
  return { result: recorded.day.both.result, status: 'ok', row_count: 8, truncated: false }
}

function listen(handler) {
  const calls = []
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8'))
      res.setHeader('mcp-session-id', 'recorded-session')
      res.setHeader('content-type', 'application/json')
      if (body.method === 'initialize') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'recorded-mirobody', version: '1.5.0' } } }))
        return
      }
      if (body.method !== 'tools/call') {
        res.statusCode = 202
        res.end()
        return
      }
      const args = body.params?.arguments ?? {}
      calls.push({ name: body.params?.name, args })
      const result = handler(args)
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } }))
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}/mcp`,
        calls,
        close: () => new Promise((done) => server.close(done)),
      })
    })
  })
}

const configOf = (url) => ({
  mcpUrl: url, mcpToken: '', member: '', timeoutMs: 5000,
  pythonBin: '/nonexistent/python', mirobodyHome: '', dataDir: '',
})

function byDate(series) {
  return Object.fromEntries(series.points.map((point) => [point.date, point.value]))
}

const item = (id, metric, value) => ({
  id, category: metric === 'dailySteps' ? 'exercise' : 'sleep', title: id, detail: '',
  start: '2026-07-26', end: null, frequency: null,
  target: { metric, op: '>=', value, unit: metric === 'dailySteps' ? 'count' : 'hours' },
  markers: [], mirobody: null,
})

const recordedServer = await listen(payloadFor)
try {
  mod.invalidateRecords()
  const read = await mod.loadSeries(configOf(recordedServer.url), ['dailySteps', 'dailyTotalSleepTime'], window)
  assert.deepEqual(read.failed, [])
  assert.equal(read.error, undefined)
  assert.deepEqual(byDate(read.series.dailySteps), recorded.persona.dailySteps)
  assert.deepEqual(byDate(read.series.dailyTotalSleepTime), recorded.persona.dailyTotalSleepTime)
  assert.equal(read.series.dailySteps.points[0].date, '2026-07-26', 'oldest first, the Shanghai civil day')
  assert.ok(!read.series.dailySteps.points.some((point) => point.date === '2026-07-29'), 'a day with no row stays absent')
  const dayCalls = recordedServer.calls.filter((call) => (call.args.resolution === 'day' || call.args.view === 'day'))
  assert.equal(dayCalls.length, 2)
  assert.ok(dayCalls.every((call) => call.args.indicators.length === 1), 'each day read is one indicator, so a nameless bucket has an owner')

  const steps = mod.adherenceFor(item('steps', 'dailySteps', 8000), { start: '2026-07-26', end: '2026-07-30' }, { daily: read.series.dailySteps.points, checkins: [] })
  const sleep = mod.adherenceFor(item('sleep', 'dailyTotalSleepTime', 7), { start: '2026-07-26', end: '2026-07-30' }, { daily: read.series.dailyTotalSleepTime.points, checkins: [] })
  const status = (adherence) => Object.fromEntries(adherence.calendar.filter((day) => day.date >= '2026-07-26' && day.date <= '2026-07-30').map((day) => [day.date, day.status]))
  assert.equal(steps.source, 'wearable')
  assert.deepEqual(status(steps), { '2026-07-26': 'missed', '2026-07-27': 'done', '2026-07-28': 'done', '2026-07-29': 'unknown', '2026-07-30': 'done' })
  assert.equal(steps.done_days, 3)
  assert.equal(steps.known_days, 4)
  assert.equal(sleep.source, 'wearable')
  assert.deepEqual(status(sleep), { '2026-07-26': 'missed', '2026-07-27': 'missed', '2026-07-28': 'missed', '2026-07-29': 'unknown', '2026-07-30': 'done' })
  assert.equal(sleep.done_days, 1)
} finally {
  await recordedServer.close()
}

// A day row whose indicator is the LOINC display, with the asked name in code, still counts as that name.
const displayServer = await listen((args) => {
  assert.deepEqual(args.indicators, ['dailySteps'])
  return {
    result: [
      'indicator|period|avg|min|max|unit|code',
      'Number of steps in 24 hour|2026-07-26|4281.0|4281.0|4281.0|{#}|dailySteps',
      '',
      '(window=2026-07-26..2026-07-26, tz=Asia/Shanghai, dates=tz_exact, resolution=day, rows=1)',
    ].join('\n'),
    status: 'ok', row_count: 1, truncated: false,
  }
})
try {
  mod.invalidateRecords()
  const read = await mod.loadSeries(configOf(displayServer.url), ['dailySteps'], { start: '2026-07-26', end: '2026-07-26', resolution: 'day' })
  assert.equal(read.series.dailySteps.points[0].value, 4281)
  assert.equal(read.series.dailySteps.points[0].date, '2026-07-26')
  assert.equal(read.series.dailySteps.label, 'Number of steps in 24 hour')
  assert.equal(read.series['Number of steps in 24 hour'], undefined)
} finally {
  await displayServer.close()
}

// Named day buckets (the fixture record, one name per row) still split one call per indicator.
const named = await startFakeMirobody({ token: '' })
try {
  mod.invalidateRecords()
  const read = await mod.loadSeries(configOf(named.url), ['dailySteps', 'dailyTotalSleepTime'], { start: '2026-06-01', end: '2026-06-30', resolution: 'day' })
  assert.equal(read.series.dailySteps.points.length, 30)
  assert.equal(read.series.dailyTotalSleepTime.points.length, 30)
  const dayCalls = named.calls.filter((call) => (call.args.resolution === 'day' || call.args.view === 'day'))
  assert.equal(dayCalls.length, 2)
  assert.deepEqual(dayCalls.map((call) => call.args.indicators), [['dailySteps'], ['dailyTotalSleepTime']])
} finally {
  await named.close()
}

console.log('wearable day: nameless Mirobody 1.5.0 buckets count as steps and sleep on the Shanghai day')
