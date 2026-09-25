// The 指标 tab: every indicator on record, filed by group (groups.ts), with
// its latest value, a short trend, and whether its last change is beyond
// normal fluctuation (the rows changes.ts gives), plan markers first. A
// series whose read failed says so on its row and makes the record partial,
// never "no data". The detail carries every reading with its report file and
// the biological-variation row with its source. The same reads give the
// record summary for onboarding (journey records.summary, GET /connection).
// Uses the fake Mirobody record and the real longevity-skills checkout
// (../../longevity-skills or LONGEVITY_SKILLS_HOME); skips without it.

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
  console.log('indicators skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const GOOD = { host: '127.0.0.1:3080', cookie: 'dsh-auth-test=good' }
const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-indicators-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
    bootstrapWorkspace: false,
  }
}

async function contextFor(config) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  mod.invalidateIndicators()
  const records = await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin')
  return { config, dataDir: config.dataDir, skillsHome: home, records, today: TODAY }
}

const rowsOf = (response) => response.groups.flatMap((group) => group.indicators)
const rowOf = (response, id) => rowsOf(response).find((row) => row.id === id)
const seriesCalls = (server) => server.calls.filter((call) => call.name === 'query_health_indicators' && Array.isArray(call.args.indicators) && call.args.aggregate === 'none').length

function fakeHost() {
  const routes = new Map()
  const disposers = []
  const ctx = {
    tools: { register: () => () => {} },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    commands: { register: () => {} },
    connection: { requestRejection: (req) => (req.headers.cookie === GOOD.cookie ? undefined : 401) },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => {
      const dispose = execute()
      disposers.push(dispose)
      return dispose
    },
  }
  return { ctx, routes, dispose: () => disposers.splice(0).forEach((fn) => fn()) }
}

function call(host, method, url, headers = GOOD) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from([])
  req.method = method
  req.url = url
  req.headers = headers
  return new Promise((resolveCall) => {
    const res = {
      statusCode: 200,
      writableEnded: false,
      setHeader: () => {},
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, text: raw, json: () => JSON.parse(raw) })
      },
    }
    handler(req, res)
  })
}

try {
  // --- 1. groups: by LOINC code, then by words in the name, then 其他 ------------------------
  assert.deepEqual([...mod.GROUP_KEYS], ['lipids', 'glucose', 'inflammation', 'blood', 'liver', 'kidney', 'thyroid', 'body', 'wearable', 'other'])
  assert.equal(mod.GROUP_ZH.lipids, '血脂')
  assert.equal(mod.GROUP_ZH.other, '其他')
  const byCode = {
    '2093-3': 'lipids', '13457-7': 'lipids', '2085-9': 'lipids', '2571-8': 'lipids', '1884-6': 'lipids', '10835-7': 'lipids',
    '14771-0': 'glucose', '4548-4': 'glucose', '20448-7': 'glucose',
    '30522-7': 'inflammation', '1988-5': 'inflammation',
    '6690-2': 'blood', '718-7': 'blood', '787-2': 'blood', '788-0': 'blood', '777-3': 'blood', '736-9': 'blood', '751-8': 'blood',
    '1742-6': 'liver', '1920-8': 'liver', '2324-2': 'liver', '6768-6': 'liver', '1975-2': 'liver', '1751-7': 'liver', '2885-2': 'liver',
    '2160-0': 'kidney', '3094-0': 'kidney', '3084-1': 'kidney', '33914-3': 'kidney',
    '3016-3': 'thyroid', '3024-7': 'thyroid', '3051-0': 'thyroid',
    '29463-7': 'body', '8302-2': 'body', '39156-5': 'body', '8280-0': 'body', '8480-6': 'body', '8462-4': 'body', '8867-4': 'body',
  }
  for (const [loinc, group] of Object.entries(byCode)) assert.equal(mod.groupOf({ loinc, name: 'x' }), group, loinc)
  const byName = [
    [{ name: '尿酸' }, 'kidney'], [{ name: '尿素氮' }, 'kidney'], [{ name: '尿蛋白' }, 'other'], [{ name: 'Urine protein' }, 'other'],
    [{ name: '低密度脂蛋白' }, 'lipids'], [{ name: '餐后2小时血糖' }, 'glucose'], [{ label: '超敏C反应蛋白', name: 'hsCRP-x' }, 'inflammation'],
    [{ name: '游离T4' }, 'thyroid'], [{ name: 'TSH' }, 'thyroid'], [{ label: '谷丙转氨酶', name: 'ALT-x' }, 'liver'], [{ name: '总胆红素' }, 'liver'],
    [{ name: '血小板计数' }, 'blood'], [{ name: 'Platelet count' }, 'blood'], [{ name: '舒张压' }, 'body'], [{ name: '体质指数' }, 'body'],
    [{ name: '乙肝表面抗原' }, 'other'], [{ name: '' }, 'other'], [{}, 'other'],
  ]
  for (const [row, group] of byName) assert.equal(mod.groupOf(row), group, JSON.stringify(row))
  assert.equal(mod.groupOf({ loinc: '99999-9', name: '甘油三酯' }), 'lipids', 'an unknown code falls back to the name')
  assert.equal(mod.groupOf({ loinc: '2093-3', name: '尿蛋白' }), 'lipids', 'a known code wins over the name')

  // --- 2. the full fixture record, a plan, self measurements -----------------------------------
  const full = await startFakeMirobody()
  servers.push(full)
  const dataDir = tempDir('full')
  const config = configFor(dataDir, full.url)
  mod.addSelf(dataDir, [
    { key: 'waist', value: 90, date: '2026-09-18' }, { key: 'waist', value: 88, date: '2026-09-20' },
    ...Array.from({ length: 35 }, (_, i) => ({ key: 'weight', value: 75 + (i % 3) / 10, date: mod.addDays(TODAY, -34 + i) })),
  ], { today: TODAY })
  const plan = mod.normalizePlan({
    title: '秋季方案',
    items: [
      { category: 'diet', title: '少吃精制碳水', start: '2026-08-27', markers: ['总胆固醇'] },
      { category: 'sleep', title: '早睡', start: '2026-09-15', target: { metric: 'dailyTotalSleepTime', op: '>=', value: 7, unit: 'hours' } },
    ],
  }, { today: TODAY, medications: [], previous: null })
  assert.deepEqual(plan.errors, [])
  mod.savePlan(dataDir, plan.plan)
  let context = await contextFor(config)
  const response = await mod.buildIndicators(context)
  assert.equal(response.record.status, 'ok')
  assert.equal(response.record.error, undefined)
  assert.ok(!Number.isNaN(Date.parse(response.updated_at)))
  assert.deepEqual(response.groups.map((group) => group.key), ['lipids', 'glucose', 'inflammation', 'blood', 'liver', 'kidney', 'body', 'wearable'], 'groups in their order, empty ones left out')
  for (const group of response.groups) assert.equal(group.label_zh, mod.GROUP_ZH[group.key])
  const rows = rowsOf(response)
  assert.equal(new Set(rows.map((row) => row.id)).size, rows.length, 'ids are unique')
  for (const row of rows) {
    assert.match(row.id, /^(loinc:[0-9]+-[0-9]|device:[A-Za-z]+$|self:(waist|sbp|dbp|weight)$|name:)/, row.id)
    assert.ok(['checkup', 'device', 'self'].includes(row.source))
    assert.ok(['changed', 'within', 'unjudged'].includes(row.judged))
    assert.equal(row.read_error, undefined, `${row.id} read`)
    for (let i = 1; i < row.points.length; i += 1) assert.ok(row.points[i - 1].date < row.points[i].date, `${row.id} points oldest first, one per date`)
    if (row.judged === 'changed') assert.ok(row.change, `${row.id} changed carries its change`)
    else assert.equal(row.change, null)
    if (row.judged === 'within') assert.ok(row.source === 'checkup' && row.points.length >= 2, `${row.id} within needs two checkup days`)
  }
  const idsOf = (key) => response.groups.find((group) => group.key === key).indicators.map((row) => row.id)
  assert.deepEqual(idsOf('lipids'), ['loinc:2093-3', 'loinc:2571-8', 'loinc:13457-7', 'loinc:2085-9'], 'the plan marker first, then the change, then by label')
  assert.deepEqual(idsOf('inflammation'), ['loinc:30522-7'])
  assert.deepEqual(idsOf('kidney'), ['loinc:2160-0'])
  assert.deepEqual(idsOf('body').sort(), ['loinc:8280-0', 'self:waist', 'self:weight'])
  assert.equal(idsOf('wearable')[0], 'device:dailyTotalSleepTime', 'the wearable target of the plan comes first')
  assert.deepEqual(idsOf('wearable').slice(1).sort(), ['device:bodyMasss', 'device:dailyRestingHeartRates', 'device:dailySteps', 'device:diastolicPressures', 'device:systolicPressures'])

  // a checkup row: its checkup days, the latest value, within the band
  const tc = rowOf(response, 'loinc:2093-3')
  assert.deepEqual({ label: tc.label_zh, unit: tc.unit, source: tc.source, plan: tc.plan_marker }, { label: '总胆固醇', unit: 'mmol/L', source: 'checkup', plan: true })
  assert.deepEqual(tc.latest, { date: '2026-08-26', value: 4.9 })
  const tcRows = loadRecord().observations.filter((row) => row.code === '2093-3').sort((a, b) => a.date.localeCompare(b.date))
  assert.deepEqual(tc.points, tcRows.map((row) => ({ date: row.date, value: Number(row.value) })), 'every checkup day, oldest first')
  assert.equal(tc.points.length, 4)
  assert.equal(tc.judged, 'within')
  // the rows changes.ts gives: the fixture's three improvements
  for (const id of ['loinc:4548-4', 'loinc:30522-7', 'loinc:2571-8']) {
    const row = rowOf(response, id)
    assert.equal(row.judged, 'changed', id)
    assert.equal(row.change.verdict, 'better')
    assert.equal(row.change.ask_doctor, false)
    assert.equal(typeof row.change.pct, 'number')
    assert.ok(row.change.band_pct.up > 0 && row.change.band_pct.down < 0)
    assert.match(row.change.text_zh, /[一-鿿]/)
  }
  assert.equal(rowOf(response, 'loinc:2571-8').plan_marker, false)
  // no biological-variation row: not judged
  assert.equal(rowOf(response, 'loinc:788-0').judged, 'unjudged')

  // a wearable row: weekly means (Monday dates) over 26 weeks at most, the latest day as it is
  const sleep = rowOf(response, 'device:dailyTotalSleepTime')
  assert.deepEqual({ label: sleep.label_zh, unit: sleep.unit, source: sleep.source, plan: sleep.plan_marker, judged: sleep.judged }, { label: '每晚睡眠', unit: '小时', source: 'device', plan: true, judged: 'unjudged' })
  assert.deepEqual(sleep.latest, { date: '2026-09-20', value: 7.7 })
  assert.ok(sleep.points.length > 20 && sleep.points.length <= 26, `${sleep.points.length} weeks`)
  for (const point of sleep.points) assert.equal(new Date(`${point.date}T00:00:00Z`).getUTCDay(), 1, 'a week is dated by its Monday')
  const lastWeek = loadRecord().observations.filter((row) => row.indicator === 'dailyTotalSleepTime' && row.date >= '2026-09-14' && row.date <= '2026-09-20').map((row) => Number(row.value))
  assert.equal(sleep.points.at(-1).date, '2026-09-14')
  assert.equal(sleep.points.at(-1).value, Math.round((lastWeek.reduce((a, b) => a + b, 0) / lastWeek.length) * 100) / 100, 'the mean of that week\'s days')
  assert.equal(rowOf(response, 'device:dailySteps').label_zh, '每日步数')

  // self rows: daily, 30 at most
  const weight = rowOf(response, 'self:weight')
  assert.deepEqual({ source: weight.source, unit: weight.unit, label: weight.label_zh }, { source: 'self', unit: 'kg', label: '体重' })
  assert.equal(weight.points.length, 30, 'the 30 most recent days')
  assert.equal(weight.points.at(-1).date, TODAY)
  assert.deepEqual(rowOf(response, 'self:waist').points, [{ date: '2026-09-18', value: 90 }, { date: '2026-09-20', value: 88 }])

  // the detail: every reading with its report, the band and its source
  const detail = await mod.indicatorDetail(context, 'loinc:2093-3')
  assert.deepEqual(detail.row, tc)
  assert.equal(detail.all_points.length, 4)
  for (const point of detail.all_points) {
    assert.equal(point.unit, 'mmol/L')
    assert.match(point.file, /\.pdf$/, 'each reading names its report')
  }
  assert.ok(detail.biovar.cvi_pct > 0)
  assert.ok(detail.biovar.band_pct.up > 0)
  assert.match(detail.biovar.source.url, /^https:\/\//)
  assert.ok(detail.biovar.source.title)
  const sleepDetail = await mod.indicatorDetail(context, 'device:dailyTotalSleepTime')
  assert.equal(sleepDetail.all_points.length, 200, 'daily values, the 200 most recent of 355')
  assert.equal(sleepDetail.all_points.at(-1).date, '2026-09-20')
  assert.equal(sleepDetail.all_points.at(-1).unit, '小时')
  assert.equal(sleepDetail.biovar, undefined)
  assert.equal(await mod.indicatorDetail(context, 'loinc:0000-0'), null)

  // the record summary: checkup days, their span, the groups present, wearable days in the last year
  const wearableDays = new Set(loadRecord().observations.filter((row) => row.system !== 'loinc' && row.date > mod.addDays(TODAY, -365) && row.date <= TODAY).map((row) => row.date)).size
  assert.deepEqual(await mod.recordsSummary(context), {
    checkups: 4, first_date: '2025-10-18', last_date: '2026-08-26',
    categories_zh: ['血脂', '血常规', '血糖', '肝功能', '炎症', '肾功能', '体格与血压'],
    wearable_days: wearableDays,
  })
  assert.ok(wearableDays > 300)

  // --- 3. a series that cannot be read: its row says so; the record is partial; no summary ------
  const failing = await startFakeMirobody({ failSeries: ['hs-CRP'] })
  servers.push(failing)
  context = await contextFor(configFor(tempDir('failing'), failing.url))
  const partial = await mod.buildIndicators(context)
  assert.equal(partial.record.status, 'partial')
  assert.match(partial.record.error, /项指标的历史没有读到/)
  const crp = rowOf(partial, 'loinc:30522-7')
  assert.match(crp.read_error, /^读取失败：/)
  assert.deepEqual(crp.points, [])
  assert.equal(crp.judged, 'unjudged', 'a failed read is never judged')
  assert.equal(crp.change, null)
  assert.deepEqual(crp.latest, { date: '2026-08-26', value: 1.2 }, 'the latest value, read apart, still shows')
  assert.ok(rowsOf(partial).some((row) => !row.read_error && row.points.length > 0), 'the other reads still show')
  assert.equal(rowsOf(partial).find((row) => row.read_error && row.judged !== 'unjudged'), undefined)
  assert.equal((await mod.indicatorDetail(context, 'loinc:30522-7')).biovar, undefined)
  assert.equal(await mod.recordsSummary(context), null, 'a count from a failed read would be too small')

  // --- 4. results that are not numbers, names without a code -----------------------------------
  const base = loadRecord()
  const extra = [
    { indicator: 'Urine Protein', name: '尿蛋白', system: '', code: '', unit: '', date: '2026-08-26', time: '2026-08-26 08:30:00', value: '阴性', file: '2026-08 体检.pdf' },
    { indicator: 'Serum Ferritin', name: '铁蛋白', system: '', code: '', unit: 'ng/mL', date: '2026-08-26', time: '2026-08-26 08:30:00', value: '<3.0', file: '2026-08 体检.pdf' },
  ]
  const textual = await startFakeMirobody({ record: { ...base, observations: [...base.observations, ...extra] } })
  servers.push(textual)
  context = await contextFor(configFor(tempDir('text'), textual.url))
  const withText = await mod.buildIndicators(context)
  assert.equal(withText.record.status, 'ok')
  const other = withText.groups.find((group) => group.key === 'other')
  assert.ok(other, 'names no group claims are filed under 其他')
  const protein = other.indicators.find((row) => row.label_zh === '尿蛋白')
  assert.ok(protein, JSON.stringify(other.indicators.map((row) => row.label_zh)))
  assert.match(protein.id, /^name:/)
  assert.deepEqual(protein.latest, { date: '2026-08-26', value: null, text: '阴性' })
  assert.deepEqual(protein.points, [])
  assert.equal(protein.judged, 'unjudged')
  assert.equal(protein.read_error, undefined, 'no numbers is not a failed read')
  const ferritin = rowsOf(withText).find((row) => row.label_zh === '铁蛋白')
  assert.deepEqual(ferritin.latest, { date: '2026-08-26', value: null, text: '<3.0' })
  assert.equal(ferritin.unit, 'ng/mL')
  const proteinDetail = await mod.indicatorDetail(context, protein.id)
  assert.deepEqual(proteinDetail.all_points, [{ date: '2026-08-26', value: null, text: '阴性', unit: '' }])

  // --- 5. no record: none; a record that cannot be read: error --------------------------------
  context = await contextFor(configFor(tempDir('none')))
  const none = await mod.buildIndicators(context)
  assert.deepEqual(none.record, { status: 'none' })
  assert.deepEqual(none.groups, [])
  assert.equal(await mod.recordsSummary(context), null)
  context = await contextFor(configFor(tempDir('down'), 'http://127.0.0.1:1/mcp'))
  const down = await mod.buildIndicators(context)
  assert.equal(down.record.status, 'error')
  assert.ok(down.record.error)
  assert.equal(await mod.recordsSummary(context), null)

  // --- 6. the routes: memoised with tracking, refreshed on demand, detail by id ----------------
  const routesDir = tempDir('routes')
  const host = fakeHost()
  await mod.apply(host.ctx, configFor(routesDir, full.url))
  let answer = await call(host, 'GET', '/api/longpi/indicators')
  assert.equal(answer.status, 200, answer.text)
  assert.equal(answer.json().record.status, 'ok')
  assert.ok(rowsOf(answer.json()).length >= 20)
  const reads = seriesCalls(full)
  answer = await call(host, 'GET', '/api/longpi/indicators')
  assert.equal(seriesCalls(full), reads, 'a second request answers from the memo')
  assert.equal((await call(host, 'GET', '/api/longpi/indicators/detail?id=loinc%3A2093-3')).json().row.id, 'loinc:2093-3', 'the detail reuses the same reads')
  assert.equal(seriesCalls(full), reads)
  answer = await call(host, 'GET', '/api/longpi/indicators?refresh=1')
  assert.equal(answer.status, 200)
  assert.ok(seriesCalls(full) > reads, 'refresh reads again')
  const detailAnswer = await call(host, 'GET', `/api/longpi/indicators/detail?id=${encodeURIComponent('device:dailySteps')}`)
  assert.equal(detailAnswer.status, 200)
  assert.equal(detailAnswer.json().row.source, 'device')
  assert.equal((await call(host, 'GET', '/api/longpi/indicators/detail')).status, 400)
  const unknown = await call(host, 'GET', '/api/longpi/indicators/detail?id=loinc%3A0000-0')
  assert.equal(unknown.status, 404)
  assert.match(unknown.json().error, /[一-鿿]/)
  assert.equal((await call(host, 'POST', '/api/longpi/indicators', { ...GOOD, 'content-type': 'application/json' })).status, 405)
  assert.equal((await call(host, 'GET', '/api/longpi/indicators', { host: GOOD.host })).status, 401, 'DSH\'s check comes first')
  host.dispose()

  console.log(`indicators ok (${rows.length} rows in ${response.groups.length} groups; plan markers first; 3 changes; a failed read shown on its row; summary ${wearableDays} wearable days)`)
} finally {
  for (const server of servers) await server.close()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
