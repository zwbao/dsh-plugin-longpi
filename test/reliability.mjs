// Flaky indicator reads, printed flags, and the same marker under two names.
// Fixtures are recorded shapes (test/fixtures/mirobody/recorded/reliability.json).
// The join uses the longevity-skills biological-variation table.

import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'
import { skillsHome as libraryHome } from './lib/skills-home.mjs'

const recorded = JSON.parse(readFileSync(new URL('./fixtures/mirobody/recorded/reliability.json', import.meta.url), 'utf8'))
const skillsHome = libraryHome('data/biological_variation.json')

function listen(handler) {
  const calls = []
  const server = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      if (req.method === 'GET' && req.url === '/api/health') {
        calls.push({ method: 'GET', url: req.url })
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify(recorded.health))
        return
      }
      const body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}')
      res.setHeader('mcp-session-id', 'reliability-session')
      res.setHeader('content-type', 'application/json')
      if (body.method === 'initialize') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: {}, serverInfo: { name: 'reliability-mirobody', version: '1.5.0' } } }))
        return
      }
      if (body.method !== 'tools/call') {
        res.statusCode = 202
        res.end()
        return
      }
      const args = body.params?.arguments ?? {}
      calls.push({ name: body.params?.name, args })
      const outcome = handler(body.params?.name, args, calls)
      if (outcome === 'text') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: 'service warming up' }] } }))
        return
      }
      if (outcome === 'db') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: recorded.db_error }], isError: true } }))
        return
      }
      if (outcome === 'auth') {
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify({ success: true, authorization_url: 'http://127.0.0.1/oauth', message: 'OAuth authentication URL generated' }) }] } }))
        return
      }
      const send = (result) => res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { content: [{ type: 'text', text: JSON.stringify(result) }], structuredContent: result } }))
      send(outcome)
    })
  })
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const { port } = server.address()
      resolve({
        url: `http://127.0.0.1:${port}/mcp`,
        origin: `http://127.0.0.1:${port}`,
        calls,
        close: () => new Promise((done) => server.close(done)),
      })
    })
  })
}

const configOf = (url, extra = {}) => ({
  mcpUrl: url, mcpToken: '', member: '', timeoutMs: 5000,
  pythonBin: '/nonexistent/python', mirobodyHome: '', dataDir: '', skillsHome: '',
  ...extra,
})

const table = (result) => ({ result, status: 'ok', row_count: 1, truncated: false })
const emptyMeds = table('(no rows)\n\n(rows=0)')

// 1. Printed flags become a number plus a flag. Inequalities and 阴性 are not plotted as the bound.
{
  const server = await listen((name) => {
    if (name === 'query_medications') return emptyMeds
    return table(recorded.flagged_latest)
  })
  try {
    mod.invalidateRecords()
    const read = await mod.loadSeries(configOf(server.url), ['空腹血糖', '收缩压', '尿蛋白', '促甲状腺激素'], { start: '2020-01-01', end: '2026-09-28', resolution: 'raw' })
    assert.deepEqual(read.failed, [])
    const glucose = read.series['空腹血糖'].points[0]
    assert.equal(glucose.value, 5.48)
    assert.equal(glucose.flag, 'high')
    assert.equal(glucose.printed, '5.48 ↑')
    assert.equal(glucose.provenance.lab, '某体检中心')
    assert.equal(glucose.provenance.file, 'lp:checkup:2024-08-20:某体检中心')
    const sbp = read.series['收缩压'].points[0]
    assert.equal(sbp.value, 120)
    assert.equal(sbp.flag, 'low')
    assert.equal(read.series['尿蛋白'].points.length, 0, '阴性 is not a number')
    assert.equal(read.series['尿蛋白'].other[0].text, '阴性(-)')
    assert.equal(read.series['尿蛋白'].other[0].flag, 'negative')
    assert.equal(read.series['促甲状腺激素'].points.length, 0, '<0.5 is not plotted as 0.5')
    assert.equal(read.series['促甲状腺激素'].other[0].flag, 'below')
    assert.equal(read.series['促甲状腺激素'].other[0].text, '<0.5')
  } finally {
    await server.close()
  }
}

// 2. The same value uploaded twice is one point, with both files.
{
  const server = await listen(() => table(recorded.duplicate_files))
  try {
    mod.invalidateRecords()
    const read = await mod.loadSeries(configOf(server.url), ['肌酐'], { start: '2024-08-20', end: '2024-08-20', resolution: 'raw' })
    assert.equal(read.series['肌酐'].points.length, 1)
    assert.equal(read.series['肌酐'].points[0].value, 90)
    assert.deepEqual(read.series['肌酐'].points[0].provenance.files, ['lp:checkup:2024-08-20:某体检中心', 'lp:checkup:2024-08-20:某体检中心-再拍'])
  } finally {
    await server.close()
  }
}

// 3. A REST row object (no compact string) is still an indicator table.
{
  const server = await listen(() => recorded.rest_rows)
  try {
    mod.invalidateRecords()
    const read = await mod.loadSeries(configOf(server.url), ['血红蛋白'], { start: '2026-01-01', end: '2026-09-28', resolution: 'raw' })
    assert.deepEqual(read.failed, [])
    assert.equal(read.series['血红蛋白'].points[0].value, 124)
    assert.equal(read.series['血红蛋白'].points[0].flag, 'low')
    assert.equal(read.series['血红蛋白'].points[0].provenance.lab, '某体检中心')
  } finally {
    await server.close()
  }
}

// 4. A warmup sentence is retried; the third answer is kept. Counts do not depend on the first failure.
{
  let indicatorCalls = 0
  const server = await listen((name) => {
    if (name !== 'query_health_indicators') return emptyMeds
    indicatorCalls += 1
    if (indicatorCalls < 3) return 'text'
    return table('indicator|time|value|unit\n血红蛋白|2026-02-11 12:00:00|116|g/L\n\n(window=2026-02-11..2026-02-11, tz=Asia/Shanghai, dates=tz_exact, resolution=raw, rows=1)')
  })
  try {
    mod.invalidateRecords()
    const read = await mod.loadSeries(configOf(server.url), ['血红蛋白'], { start: '2026-02-11', end: '2026-02-11', resolution: 'raw' })
    assert.equal(indicatorCalls, 3)
    assert.deepEqual(read.failed, [])
    assert.equal(read.series['血红蛋白'].points[0].value, 116)
    mod.invalidateRecords()
    const again = await mod.loadSeries(configOf(server.url), ['血红蛋白'], { start: '2026-02-11', end: '2026-02-11', resolution: 'raw' })
    assert.equal(again.series['血红蛋白'].points[0].value, 116)
  } finally {
    await server.close()
  }
}

// 5. Database down, while /api/health still answers, is said in one sentence. Later batches are not asked.
{
  const server = await listen((name, args) => {
    if (name === 'query_health_indicators' && (args.aggregate === 'none' || ['raw', 'minute', 'hour', 'day', 'week', 'month'].includes(args.view))) return 'db'
    return emptyMeds
  })
  try {
    mod.invalidateRecords()
    const names = Array.from({ length: 13 }, (_, i) => `marker-${i}`)
    const read = await mod.loadSeries(configOf(server.url), names, { start: '2020-01-01', end: '2026-09-28', resolution: 'raw' })
    assert.equal(read.failed.length, 13)
    assert.match(read.error, /服务显示正常/)
    assert.match(read.error, /数据库没有连上/)
    const seriesCalls = server.calls.filter((call) => call.name === 'query_health_indicators')
    assert.equal(seriesCalls.length, 3, 'the failing batch is retried, and the next batch is not started')
    assert.ok(seriesCalls.every((call) => !(call.args.indicators ?? []).includes('marker-12')))
    assert.ok(server.calls.some((call) => call.method === 'GET'))
  } finally {
    await server.close()
  }
}

// 6. An OAuth blob is not reported as a broken indicator table.
{
  const server = await listen(() => 'auth')
  try {
    mod.invalidateRecords()
    const read = await mod.loadSeries(configOf(server.url), ['血红蛋白'], { start: '2026-01-01', end: '2026-09-28', resolution: 'raw' })
    assert.match(read.error, /没有认出这次登录/)
    assert.doesNotMatch(read.error, /不是指标表/)
  } finally {
    await server.close()
  }
}

// 7. The same analyte under two names, codes and units is one series. CRP assays stay apart.
//    An implausible mg/dL creatinine is not converted. Urine creatinine is not serum.
{
  const catalogue = [
    'indicator|system|code|count|first_date|last_date',
    '肌酐|loinc|14682-9|1|2024-08-20|2024-08-20',
    '肌酐(Cr)|loinc|2160-0|1|2024-08-20|2024-08-20',
    '可疑肌酐|loinc|2160-0|1|2023-11-02|2023-11-02',
    '尿肌酐||2161-8|1|2024-08-20|2024-08-20',
    '超敏C反应蛋白|loinc|30522-7|1|2024-08-20|2024-08-20',
    'C反应蛋白|loinc|1988-5|1|2026-05-11|2026-05-11',
    '红细胞分布宽度-变异系数|||1|2022-09-14|2022-09-14',
    '红细胞分布宽度|loinc|30385-9|1|2024-08-20|2024-08-20',
    '腰围|||1|2024-08-20|2024-08-20',
    '腹围|||1|2024-08-20|2024-08-20',
    '空腹血糖|loinc|14771-0|1|2024-08-20|2024-08-20',
    '',
    '(window=all recorded data, tz=Asia/Shanghai, dates=tz_exact, rows=10)',
  ].join('\n')
  const latest = [
    'indicator|name|date|time|value|unit|system|code|file',
    '肌酐|血清肌酐|2024-08-20|2024-08-20 12:00:00|90|μmol/L|loinc|14682-9|lp:checkup:2024-08-20:某体检中心',
    '肌酐(Cr)|肌酐|2024-08-20|2024-08-20 12:00:00|1.02|mg/dL|loinc|2160-0|lp:outpatient:2023-11-02:某市医院',
    '可疑肌酐|肌酐|2023-11-02|2023-11-02 12:00:00|86|mg/dL|loinc|2160-0|lp:outpatient:2023-11-02:手写',
    '尿肌酐|尿肌酐|2024-08-20|2024-08-20 12:00:00|80|mg/dL||2161-8|',
    '超敏C反应蛋白|hs-CRP|2024-08-20|2024-08-20 12:00:00|2.40|mg/L|loinc|30522-7|lp:checkup:2024-08-20:某体检中心',
    'C反应蛋白|CRP|2026-05-11|2026-05-11 12:00:00|26.4|mg/L|loinc|1988-5|lp:outpatient:2026-05-11:社区',
    '红细胞分布宽度-变异系数|RDW-CV|2022-09-14|2022-09-14 12:00:00|13.4|%|||',
    '红细胞分布宽度|RDW-CV|2024-08-20|2024-08-20 12:00:00|13.2|%|loinc|30385-9|',
    '腰围||2024-08-20|2024-08-20 12:00:00|100|cm|||',
    '腹围||2024-08-20|2024-08-20 12:00:00|101|cm|||',
    '空腹血糖|GLU|2024-08-20|2024-08-20 12:00:00|5.48 ↑|mmol/L|loinc|14771-0|lp:checkup:2024-08-20:某体检中心',
    '',
    '(window=all recorded data, tz=Asia/Shanghai, dates=tz_exact, aggregate=latest/readings, rows=10)',
  ].join('\n')
  const server = await listen((name, args) => {
    if (name === 'query_medications') return emptyMeds
    if ((args.aggregate === 'latest' || args.view === 'latest')) return table(latest)
    return table(catalogue)
  })
  const dataDir = mkdtempSync(join(tmpdir(), 'longpi-reliability-'))
  try {
    mod.invalidateRecords()
    const snap = await mod.loadRecords(configOf(server.url, { skillsHome }), dataDir, '/nonexistent/plugin')
    assert.equal(snap.record_status, 'ok', snap.record_error)
    const byName = (name) => snap.indicators.find((row) => row.name === name)
    const umol = byName('肌酐')
    const mg = byName('肌酐(Cr)')
    assert.equal(umol.loinc, '14682-9')
    assert.equal(mg.loinc, '14682-9')
    assert.equal(mg.unit, 'umol/L')
    assert.equal(Number(mg.value), 90.168)
    assert.equal(mg.unit_original, 'mg/dL')
    assert.equal(mg.value_original, '1.02')
    assert.equal(mg.loinc_original, '2160-0')
    assert.equal(umol.series_key, 'creatinine')
    assert.equal(mg.series_key, 'creatinine')
    assert.equal(mg.name, '肌酐(Cr)', 'the Mirobody handle is what a later query must send')
    const absurd = byName('可疑肌酐')
    assert.equal(absurd.unit_suspect, true)
    assert.equal(absurd.value, '86')
    assert.equal(absurd.unit, 'mg/dL')
    assert.equal(absurd.loinc, '2160-0')
    const urine = byName('尿肌酐')
    assert.equal(urine.series_key, undefined)
    assert.notEqual(urine.loinc, '14682-9')
    assert.equal(byName('超敏C反应蛋白').loinc, '30522-7')
    assert.equal(byName('C反应蛋白').loinc, '1988-5')
    assert.equal(byName('超敏C反应蛋白').series_key, 'hscrp')
    assert.equal(byName('C反应蛋白').series_key, 'crp')
    const rdw = byName('红细胞分布宽度-变异系数')
    assert.equal(rdw.loinc, '788-0')
    assert.equal(rdw.label, '红细胞分布宽度')
    const rdwCoded = byName('红细胞分布宽度')
    assert.equal(rdwCoded.loinc, '788-0')
    assert.equal(rdwCoded.loinc_original, '30385-9')
    assert.equal(byName('腰围').label, '腰围')
    assert.equal(byName('腹围').label, '腰围')
    assert.equal(byName('腰围').loinc, undefined)
    assert.equal(byName('腹围').series_key, 'waist')
    const glu = byName('空腹血糖')
    assert.equal(glu.value, '5.48')
    assert.equal(glu.flag, 'high')
    assert.equal(glu.printed, '5.48 ↑')
    assert.equal(glu.unit, 'mmol/L')
  } finally {
    await server.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
}

console.log('reliability: flags, retries, database-down wording, and joined markers')
