// Changes in the record beyond normal fluctuation: a synthetic record served by
// the fake Mirobody (a marker falling beyond its band over three checkups, one
// rising within its band, one improving beyond its band, one getting worse in
// another unit, a "<3.0" value, a reading in a unit that cannot be converted,
// device series and a home-average marker that must be left out); the cap and
// the order; then where the rows show: the journey and the phenotypic-age
// caveat, read_personal_situation, the prompt, the plan draft and the report.
// Uses the real longevity-skills checkout; skips without it. All values are
// made up.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { loadRecord, startFakeMirobody } from './fake-mirobody.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'data', 'biological_variation.json')) ? sibling : '')
if (!home || !existsSync(join(home, 'data', 'biological_variation.json'))) {
  console.log('changes skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const NOTE = '判断依据：两次结果之差超过同一个人正常波动与检测误差合成的参考变化值（RCV，z=1.96）才算真实变化；变异数据来自 longevity-skills 的 data/biological_variation.json，每一行注明期刊出处。不同医院、不同仪器之间的差异没有算进去；如果两次不在同一家机构，请先复查确认。这不是诊断。'
const ASK = '建议带着这几次体检报告咨询医生，看看是否需要进一步检查。'
const GOOD = '变化超出了正常波动，方向是好的。'
const KEYS = ['advice_zh', 'ask_doctor', 'band_pct', 'compare', 'direction', 'key', 'label_zh', 'points', 'source', 'text_zh', 'unit', 'verdict', 'verified']
const catalog = mod.loadCatalog(home)
const { biovar } = mod.loadReference(home)
const temp = []
const servers = []

const markerOf = (key) => biovar.markers.find((row) => row.key === key)
const bandOf = (key) => mod.rcvBand(markerOf(key), biovar.z)
const round1 = (value) => Math.round(value * 10) / 10
const pctOf = (from, to) => round1(((to - from) / from) * 100)

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-changes-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
  }
}

function profileIn(dataDir) {
  mod.writeProfile(dataDir, { age: 53, sex: 'male', risk: FACTS, focus: ['bioage'], consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() } })
}

/** One checkup row the way record.json holds it. */
function lab(indicator, name, code, unit, date, value, clock = '08:30:00') {
  return { indicator, name, system: 'loinc', code, unit, date, time: `${date} ${clock}`, value: String(value), file: `${date} 体检报告.pdf` }
}

function device(indicator, unit, date, value) {
  return { indicator, name: '', system: 'device', code: indicator, unit, date, time: `${date} 07:00:00`, value: String(value), file: '' }
}

async function serve(record) {
  const server = await startFakeMirobody({ record })
  servers.push(server)
  return server
}

async function contextOf(config) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin')
  return { config, dataDir: config.dataDir, skillsHome: home, catalog, records, today: TODAY }
}

/** The fixture record with one indicator's values replaced, by checkup date. */
function withValues(indicator, byDate) {
  const record = loadRecord()
  return { ...record, observations: record.observations.map((row) => (row.indicator === indicator && byDate[row.date] ? { ...row, value: byDate[row.date] } : row)) }
}

const D0 = '2023-03-10'
const D1 = '2024-03-12'
const D2 = '2025-03-18'
const D3 = '2026-03-20'
const MCV = 'Mean Corpuscular Volume-MCV'

try {
  // --- 1. the synthetic record ----------------------------------------------------
  const observations = [
    // falling beyond its band; two readings on the last day, the later one counts
    lab(MCV, '平均红细胞体积', '787-2', 'fL', D1, 91.0),
    lab(MCV, '平均红细胞体积', '787-2', 'fL', D2, 88.5),
    lab(MCV, '平均红细胞体积', '787-2', 'fL', D3, 90.0, '07:00:00'),
    lab(MCV, '平均红细胞体积', '787-2', 'fL', D3, 84.0, '09:00:00'),
    // rising within its band
    lab('Albumin-ALB', '白蛋白', '1751-7', 'g/L', D1, 44.0),
    lab('Albumin-ALB', '白蛋白', '1751-7', 'g/L', D2, 44.5),
    lab('Albumin-ALB', '白蛋白', '1751-7', 'g/L', D3, 45.0),
    // improving beyond its band
    lab('Glycated Hemoglobin-HbA1c', '糖化血红蛋白', '4548-4', '%', D1, 6.2),
    lab('Glycated Hemoglobin-HbA1c', '糖化血红蛋白', '4548-4', '%', D2, 6.0),
    lab('Glycated Hemoglobin-HbA1c', '糖化血红蛋白', '4548-4', '%', D3, 5.7),
    // "<3.0" is not a number: read as 3.0 it would make 1.1 a fall beyond the band
    lab('hs-CRP', '超敏C反应蛋白', '30522-7', 'mg/L', D1, 1.0),
    lab('hs-CRP', '超敏C反应蛋白', '30522-7', 'mg/L', D2, '<3.0'),
    lab('hs-CRP', '超敏C反应蛋白', '30522-7', 'mg/L', D3, 1.1),
    // getting worse, in mg/dL (converted with the row's own factor), and a second glucose code merged in
    lab('Fasting Blood Glucose-FBG', '空腹血糖', '14771-0', 'mmol/L', D0, 5.0),
    lab('Glucose-GLU', '葡萄糖', '2345-7', 'mg/dL', D1, 90),
    lab('Glucose-GLU', '葡萄糖', '2345-7', 'mg/dL', D2, 95),
    lab('Glucose-GLU', '葡萄糖', '2345-7', 'mg/dL', D3, 110),
    // a unit that cannot be converted: read anyway, 9.0 would be a rise beyond the band
    lab('White Blood Cell Count-WBC', '白细胞计数', '6690-2', '10^9/L', D1, 6.0),
    lab('White Blood Cell Count-WBC', '白细胞计数', '6690-2', '10^9/L', D2, 6.1),
    lab('White Blood Cell Count-WBC', '白细胞计数', '6690-2', 'xx', D3, 9.0),
    // a clinic blood pressure: its band is for 7-day home means, so single readings are not judged
    lab('Systolic Blood Pressure-SBP', '收缩压', '8480-6', 'mmHg', D1, 118),
    lab('Systolic Blood Pressure-SBP', '收缩压', '8480-6', 'mmHg', D3, 142),
    // wearable series: never a checkup change
    device('bodyMasss', 'kg', D1, 80),
    device('bodyMasss', 'kg', D3, 70),
    device('systolicPressures', 'mmHg', D1, 120),
    device('systolicPressures', 'mmHg', D3, 150),
  ]
  const synthetic = await serve({ tz: 'Asia/Shanghai', today: TODAY, observations, medications: { plans: [], log: [], history: [] } })
  const synthDir = tempDir('synthetic')
  profileIn(synthDir)
  const context = await contextOf(configFor(synthDir, synthetic.url))
  const built = await mod.buildChanges(context)
  assert.equal(built.note_zh, NOTE)
  assert.equal(mod.CHANGES_NOTE_ZH, NOTE)
  assert.deepEqual(built.changes.map((row) => row.key), ['mcv', 'glucose', 'hba1c'], 'ask_doctor first, then the furthest past its band')

  const mcv = built.changes[0]
  const mcvBand = bandOf('mcv')
  assert.deepEqual(Object.keys(mcv).sort(), [...KEYS, 'caveat_zh'].sort(), 'the field names the client mirrors')
  assert.deepEqual(mcv.points, [{ date: D1, value: 91 }, { date: D2, value: 88.5 }, { date: D3, value: 84 }], 'one point per day, the last reading')
  assert.deepEqual(mcv.compare, { from_date: D1, from: 91, to_date: D3, to: 84, pct: pctOf(91, 84) }, 'the first point is further past the band than the previous one')
  assert.deepEqual(mcv.band_pct, { up: round1(mcvBand.up * 100), down: -round1(mcvBand.up * 100) })
  assert.equal(mcv.direction, 'down')
  assert.equal(mcv.verdict, 'unclear', 'MCV has no good direction')
  assert.equal(mcv.ask_doctor, true)
  assert.equal(mcv.unit, 'fL')
  assert.equal(mcv.text_zh, `平均红细胞体积 91 → 84 fL（${D1} → ${D3}），下降 ${Math.abs(pctOf(91, 84)).toFixed(1)}%，超出正常波动（±${mcv.band_pct.up.toFixed(1)}%）`)
  assert.equal(mcv.advice_zh, ASK)
  assert.equal(mcv.caveat_zh, markerOf('mcv').caveat_zh)
  assert.deepEqual(mcv.source, { title: markerOf('mcv').cvi_source.title, url: markerOf('mcv').cvi_source.url, doi: markerOf('mcv').cvi_source.doi })
  assert.equal(mcv.verified, markerOf('mcv').verified)

  const glucose = built.changes[1]
  const factor = markerOf('glucose').convert['mg/dL']
  assert.deepEqual(Object.keys(glucose).sort(), KEYS.slice().sort(), 'no caveat_zh when the row has none')
  assert.equal(glucose.unit, 'mmol/L')
  assert.deepEqual(glucose.points.map((row) => row.date), [D0, D1, D2, D3], 'both glucose codes are one series')
  assert.equal(glucose.points[1].value, Number((90 * factor).toPrecision(6)), 'mg/dL converted with the row\'s factor')
  assert.equal(glucose.compare.from_date, D0)
  assert.equal(glucose.compare.pct, pctOf(5.0, Number((110 * factor).toPrecision(6))))
  assert.ok(glucose.compare.pct > bandOf('glucose').up * 100)
  assert.equal(glucose.verdict, 'worse', 'lower is better, and it rose')
  assert.equal(glucose.ask_doctor, true)

  const hba1c = built.changes[2]
  assert.equal(hba1c.verdict, 'better')
  assert.equal(hba1c.ask_doctor, false)
  assert.equal(hba1c.advice_zh, GOOD)
  assert.equal(hba1c.compare.from_date, D1)
  assert.match(hba1c.text_zh, /^糖化血红蛋白 6\.2% → 5\.7%（/)

  for (const key of ['albumin', 'crp', 'wbc', 'weight', 'sbp']) assert.ok(!built.changes.some((row) => row.key === key), `${key} is not listed`)
  assert.ok(Math.abs(pctOf(44, 45)) < bandOf('albumin').up * 100, 'albumin moved, within its band')

  // log-normal rows show both sides of their band
  const tgBand = bandOf('tg')
  const tgRecord = [lab('Triglycerides-TG', '甘油三酯', '2571-8', 'mmol/L', D1, 2.4), lab('Triglycerides-TG', '甘油三酯', '2571-8', 'mmol/L', D3, 1.2)]
  const tgServer = await serve({ tz: 'Asia/Shanghai', today: TODAY, observations: tgRecord, medications: { plans: [], log: [], history: [] } })
  const tg = (await mod.buildChanges(await contextOf(configFor(synthDir, tgServer.url)))).changes[0]
  assert.deepEqual(tg.band_pct, { up: round1(tgBand.up * 100), down: round1(tgBand.down * 100) })
  assert.ok(tg.text_zh.endsWith(`超出正常波动（${tg.band_pct.down.toFixed(1)}% 至 +${tg.band_pct.up.toFixed(1)}%）`), tg.text_zh)
  assert.equal(tg.points.length, 2, 'two checkup days are enough')

  // at most six, every eligible marker doubling: ask_doctor first, then the furthest past its band
  const eligible = biovar.markers.filter((row) => row.loinc.length > 0 && !row.average_days)
  const doubled = eligible.flatMap((row) => [lab(`${row.key}-test`, row.label_zh, row.loinc[0], row.unit, D1, 10), lab(`${row.key}-test`, row.label_zh, row.loinc[0], row.unit, D3, 20)])
  const manyServer = await serve({ tz: 'Asia/Shanghai', today: TODAY, observations: doubled, medications: { plans: [], log: [], history: [] } })
  const many = (await mod.buildChanges(await contextOf(configFor(synthDir, manyServer.url)))).changes
  assert.ok(eligible.length > 6)
  assert.equal(many.length, 6)
  assert.ok(many.every((row) => row.ask_doctor), 'more than six ask_doctor rows fill the list')
  const overshoot = many.map((row) => row.compare.pct / (bandOf(row.key).up * 100))
  assert.deepEqual(overshoot, overshoot.slice().sort((a, b) => b - a), 'furthest past the band first')

  // an unread record gives no changes
  const brokenDir = tempDir('broken')
  profileIn(brokenDir)
  assert.deepEqual((await mod.buildChanges(await contextOf(configFor(brokenDir, 'http://127.0.0.1:1/mcp')))).changes, [])
  assert.deepEqual((await mod.buildChanges(await contextOf(configFor(brokenDir)))).changes, [], 'nor does no record')

  // --- 2. the journey and phenotypic age --------------------------------------------
  const plain = await serve(loadRecord())
  const plainDir = tempDir('plain')
  profileIn(plainDir)
  let journey = await mod.buildJourney({ ...(await contextOf(configFor(plainDir, plain.url))), mount: MOUNT })
  assert.equal(journey.results.bioage.status, 'ok')
  assert.deepEqual(journey.changes.map((row) => [row.key, row.verdict]), [['hba1c', 'better'], ['crp', 'better'], ['tg', 'better']], 'the fixture only improves')
  assert.equal(journey.changes_note_zh, NOTE)
  assert.equal(journey.results.bioage.caveat_zh, undefined, 'no caveat when nothing is to be shown to a doctor')

  // MCV falling over four checkups: a PhenoAge input, so body age gets a caveat
  const falling = await serve(withValues(MCV, { '2025-10-18': '90.2', '2026-01-20': '88.1', '2026-04-22': '85.7', '2026-08-26': '83.0' }))
  const fallingDir = tempDir('falling')
  profileIn(fallingDir)
  const fallingConfig = configFor(fallingDir, falling.url)
  const fallingContext = await contextOf(fallingConfig)
  const step = await mod.buildJourneyFull({ ...fallingContext, mount: MOUNT })
  journey = step.journey
  assert.equal(journey.changes[0].key, 'mcv')
  assert.equal(journey.changes[0].ask_doctor, true)
  assert.equal(journey.changes[0].points.length, 4)
  assert.equal(journey.results.bioage.status, 'ok')
  assert.equal(journey.results.bioage.caveat_zh, '表型年龄用到的平均红细胞体积近期变化明显，原因可能与衰老无关，这次的身体年龄请谨慎看待。')
  assert.deepEqual(step.tracking.changes, journey.changes, 'the tracking carries the same rows')

  // HbA1c rising beyond its band is one to show a doctor, but not a PhenoAge input
  const rising = await serve(withValues('Glycated Hemoglobin-HbA1c', { '2025-10-18': '5.6', '2026-01-20': '5.7', '2026-04-22': '5.9', '2026-08-26': '6.1' }))
  const risingDir = tempDir('rising')
  profileIn(risingDir)
  journey = await mod.buildJourney({ ...(await contextOf(configFor(risingDir, rising.url))), mount: MOUNT })
  assert.equal(journey.changes[0].key, 'hba1c')
  assert.equal(journey.changes[0].verdict, 'worse')
  assert.equal(journey.results.bioage.caveat_zh, undefined)

  journey = await mod.buildJourney({ ...(await contextOf(configFor(brokenDir, 'http://127.0.0.1:1/mcp'))), mount: MOUNT })
  assert.equal(journey.records.status, 'error')
  assert.deepEqual(journey.changes, [])
  assert.equal(journey.changes_note_zh, NOTE)

  // --- 3. the plan draft and the report ------------------------------------------------
  const brief = await mod.buildPlanBrief({ ...fallingContext, mount: MOUNT })
  assert.equal(brief.notes_zh[0], '记录里有超出正常波动的变化（平均红细胞体积），建议先请医生看过再开始方案。')
  const plainBrief = await mod.buildPlanBrief({ ...(await contextOf(configFor(plainDir, plain.url))), mount: MOUNT })
  assert.ok(!plainBrief.notes_zh.some((line) => line.includes('超出正常波动')), 'better changes add no note')

  const report = mod.buildReport({ name: '', today: TODAY, records: fallingContext.records, tracking: step.tracking })
  assert.match(report, /## 记录里的明显变化/)
  assert.ok(report.includes(`- ${step.tracking.changes[0].text_zh}。${ASK}`))
  assert.ok(report.includes(`  - ${markerOf('mcv').caveat_zh}`))
  assert.ok(report.includes(NOTE))
  assert.ok(report.indexOf('## 记录里的明显变化') < report.indexOf('## 表型年龄'), 'before the results')
  assert.doesNotMatch(mod.buildReport({ name: '', today: TODAY, records: fallingContext.records, tracking: null }), /记录里的明显变化/)

  // --- 4. the tools and the prompt, through the plugin's own apply ------------------------
  const host = fakeHost()
  await mod.apply(host.ctx, fallingConfig)
  const prompt = host.prompts.map((row) => (typeof row.text === 'function' ? row.text() : row.text)).join('\n')
  assert.match(prompt, /record_changes/)
  assert.match(prompt, /ask_doctor true, say so early and plainly/)
  assert.match(prompt, /Never suggest a supplement \(iron included\), a drug or a dose/)
  const situation = await host.tools.get('read_personal_situation').execute({})
  assert.equal(situation.record_changes[0].key, 'mcv')
  assert.equal(situation.record_changes[0].n_points, 4)
  assert.equal('points' in situation.record_changes[0], false, 'the model gets the rows without their points')
  assert.deepEqual(Object.keys(situation.record_changes[0]).sort(), [...KEYS.filter((key) => key !== 'points'), 'caveat_zh', 'n_points'].sort())
  assert.equal(situation.record_changes_note_zh, NOTE)
  assert.match(situation.record_changes_how_to_read, /iron included/)
  assert.match(situation.record_changes_how_to_read, /Do not name a cause or a diagnosis/)
  assert.ok(!situation.runnable_now.some((row) => row.name === 'ageing-clocks-digital-twins'), 'a method with no record-backed input is not runnable from the record')
  const drafted = await host.tools.get('draft_intervention_plan').execute({})
  assert.equal(drafted.brief.notes_zh[0], brief.notes_zh[0])
  assert.match(drafted.how_to_use, /超出正常波动/)
  assert.match(drafted.how_to_use, /say that first/)
  const res = await call(host, 'GET', '/api/longpi/report')
  assert.equal(res.status, 200)
  assert.match(res.text, /## 记录里的明显变化/)
  host.dispose()

  console.log(`changes ok (${built.changes.map((row) => `${row.key} ${row.compare.pct}%`).join(', ')}; journey, caveat, tool, plan note and report)`)
} finally {
  for (const server of servers) await server.close()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}

function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const commands = new Map()
  const prompts = []
  const disposers = []
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: (section) => { prompts.push(section) } },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    commands: { register: (command) => { commands.set(command.name, command) } },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => {
      const dispose = execute()
      disposers.push(dispose)
      return dispose
    },
  }
  return { ctx, tools, routes, commands, prompts, dispose: () => disposers.splice(0).forEach((fn) => fn()) }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  return new Promise((resolveCall) => {
    const headers = {}
    const res = {
      statusCode: 200,
      writableEnded: false,
      setHeader: (key, value) => { headers[key.toLowerCase()] = value },
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, headers, text: raw, json: () => JSON.parse(raw) })
      },
    }
    handler(req, res)
  })
}
