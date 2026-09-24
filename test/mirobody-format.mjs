// The harness must read Mirobody the way Mirobody actually answers: a compact
// pipe table. Fixtures in test/fixtures/mirobody/cases were rendered by
// Mirobody 1.5's own code (generate.py); the fake server must render the same
// text for the same call, and the parser must read every shape.

import assert from 'node:assert/strict'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import * as mod from '../lib/index.js'
import { loadRecord, queryIndicators, queryMedications, startFakeMirobody } from './fake-mirobody.mjs'

const dir = new URL('./fixtures/mirobody/cases/', import.meta.url).pathname
const record = loadRecord()
const cases = Object.fromEntries(readdirSync(dir).filter((name) => name.endsWith('.json'))
  .map((name) => [name.replace(/\.json$/, ''), JSON.parse(readFileSync(join(dir, name), 'utf8'))]))

// 1. the fake server renders byte-for-byte what Mirobody renders
for (const [name, item] of Object.entries(cases)) {
  const ours = name.startsWith('meds-') ? queryMedications(record, item.args) : queryIndicators(record, item.args)
  assert.deepEqual(ours, item.payload, `fake server differs from Mirobody on ${name}`)
}

// 2. the parser reads every shape
const catalogue = mod.parseCompact(cases.catalogue.payload.result)
assert.equal(catalogue.rows.length, 21)
assert.equal(catalogue.meta.total, 21)
assert.deepEqual(catalogue.rows[0], { indicator: 'Albumin-ALB', system: 'loinc', code: '1751-7', count: '4', first_date: '2025-10-18', last_date: '2026-08-26' })

const latest = mod.parseCompact(cases.latest.payload.result)
assert.equal(latest.rows.length, 15)
const crp = latest.rows.find((row) => row.indicator === 'hs-CRP')
assert.equal(crp.value, '1.2')
assert.equal(crp.unit, 'mg/L')
assert.equal(crp.date, '2026-08-26', 'a hoisted constant is merged back into every row')
assert.equal(crp.system, 'loinc')
assert.equal(latest.meta.aggregate, 'latest/readings')

const truncated = mod.parseCompact(cases['readings-truncated'].payload.result)
assert.equal(truncated.meta.truncated, true)
assert.equal(truncated.rows.length, 5)
assert.equal(truncated.rows[0].indicator, 'dailySteps', 'indicator hoisted to constants still reaches the row')

const stats = mod.parseCompact(cases.stats.payload.result)
assert.equal(stats.rows[0].change, '-3.0')
assert.equal(stats.rows[0].count, '4')

const plan = mod.parseCompact(cases['meds-plan'].payload.result)
assert.equal(plan.rows[0].medication, '鱼油(Omega-3)')
assert.equal(plan.rows[0].status, 'active')
assert.match(plan.notes[0], /not a record of doses taken/)

const history = mod.parseCompact(cases['meds-history'].payload.result)
assert.equal(history.rows[1].medication, '布洛芬')
assert.equal(history.rows[1].end, '2026-04-20')
assert.equal(history.rows[0].end, '')

const refusal = mod.parseCompact(cases.error.payload.result)
assert.equal(refusal.error.kind, 'invalid_arguments')
assert.equal(refusal.rows.length, 0)

// one row with every column constant has no header: the constants line is the row
const single = mod.parseCompact('(constants: indicator=hs-CRP, value=1.5, unit=mg/L)\n\n(window=all recorded data, tz=Asia/Shanghai, dates=tz_exact, rows=1)')
assert.deepEqual(single.rows, [{ indicator: 'hs-CRP', value: '1.5', unit: 'mg/L' }])
assert.deepEqual(mod.parseCompact('(no rows)\n\n(window=all recorded data, tz=UTC, dates=tz_exact, rows=0)').rows, [])
// a "|" inside the last free-text cell folds back into that cell
const ragged = mod.parseCompact('medication|reason\nA|x|y\n\n(rows=1)')
assert.equal(ragged.rows[0].reason, 'x|y')
// a constant value containing ", " is kept whole
const commas = mod.parseCompact('(constants: schedule=早, 晚各一次, source=self)\nmedication\nA\nB\n\n(rows=2)')
assert.equal(commas.rows[0].schedule, '早, 晚各一次')
assert.equal(mod.tableOf({ result: '{"not":"a table"}' }), null)
assert.equal(mod.cellNumber('<0.5'), null)
assert.equal(mod.cellNumber('12711.0'), 12711)

// 3. the harness reads a record over MCP, once per minute, from the compact tables
const server = await startFakeMirobody({ token: 'test-token' })
try {
  const config = {
    mcpUrl: server.url, mcpToken: 'test-token', member: '', timeoutMs: 5000,
    pythonBin: '/nonexistent/python', mirobodyHome: '', dataDir: '',
  }
  const dataDir = join(new URL('.', import.meta.url).pathname, '..', 'node_modules', '.cache', 'longpi-format-test')
  mod.invalidateRecords()
  const snap = await mod.loadRecords(config, dataDir, '/nonexistent/plugin')
  assert.equal(snap.record_status, 'ok', snap.record_error)
  const albumin = snap.indicators.find((row) => row.name === 'Albumin-ALB')
  assert.equal(albumin.value, '45.6')
  assert.equal(albumin.unit, 'g/L')
  assert.equal(albumin.loinc, '1751-7')
  assert.equal(albumin.label, '白蛋白')
  assert.equal(albumin.date, '2026-08-26')
  const steps = snap.indicators.find((row) => row.name === 'dailySteps')
  assert.ok(steps.value, 'device indicators get their latest value too')
  assert.equal(snap.medications.length, 2)
  assert.equal(snap.medications[0].plan_id, 'p-fishoil')
  const firstCalls = server.calls.length
  await mod.loadRecords(config, dataDir, '/nonexistent/plugin')
  assert.equal(server.calls.length, firstCalls, 'a second read inside the cache window makes no MCP call')

  const series = await mod.loadSeries(config, ['hs-CRP', 'Albumin-ALB'], { start: '2025-01-01', end: '2026-09-24', resolution: 'raw' })
  assert.deepEqual(series.series['hs-CRP'].points.map((point) => point.value), [4.2, 2.9, 1.8, 1.2], 'oldest first')
  assert.equal(series.series['hs-CRP'].loinc, '30522-7')
  assert.equal(series.series['hs-CRP'].points[0].date, '2025-10-18')
  const daily = await mod.loadSeries(config, ['dailySteps'], { start: '2026-06-01', end: '2026-06-30', resolution: 'day' })
  assert.equal(daily.series.dailySteps.points.length, 30)

  const doses = await mod.loadDoseLog(config, '鱼油', '2026-03-01', '2026-09-20')
  assert.ok(doses.rows.length > 150, `dose log read in windows under the 200-row cap, got ${doses.rows.length}`)
  assert.ok(doses.rows.every((row) => row.medication === '鱼油(Omega-3)'))
  const courses = await mod.loadCourses(config)
  assert.equal(courses.rows.find((row) => row.medication === '布洛芬').end, '2026-04-20')

  mod.invalidateRecords()
  const denied = await mod.loadRecords({ ...config, mcpToken: 'wrong' }, dataDir, '/nonexistent/plugin')
  assert.equal(denied.record_status, 'error')
} finally {
  await server.close()
}

// the SSE transport carries the same payload
const sse = await startFakeMirobody({ sse: true })
try {
  mod.invalidateRecords()
  const snap = await mod.loadRecords({ mcpUrl: sse.url, mcpToken: '', member: '', timeoutMs: 5000, pythonBin: '/nonexistent/python', mirobodyHome: '', dataDir: '' }, '/tmp/longpi-sse-test', '/nonexistent/plugin')
  assert.equal(snap.indicators.find((row) => row.name === 'hs-CRP').value, '1.2')
} finally {
  await sse.close()
}

console.log('mirobody format: fake server matches Mirobody rendering; parser and record reads pass')
