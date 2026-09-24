// The 5.0 journey end to end: consent and profile, self measurements and how
// they merge with the record, the stage the person is at, first results or
// their blockers and add-on tests, reminders, suggestions, the calendar file,
// and the routes and tools that change them. Uses the fake Mirobody record and
// the real longevity-skills checkout (../../longevity-skills or
// LONGEVITY_SKILLS_HOME); skips without it, like interventions.mjs.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
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
  console.log('journey skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const catalog = mod.loadCatalog(home)
const temp = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-journey-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
  }
}

async function journeyOf(config) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin')
  const context = { config, dataDir: config.dataDir, skillsHome: home, catalog, records, today: TODAY }
  const journey = await mod.buildJourney({ ...context, mount: MOUNT })
  return { journey, records, tracking: await mod.buildTracking(context) }
}

function assertSuggestions(journey, texts) {
  assert.ok(journey.suggestions.length >= 2 && journey.suggestions.length <= 3, `2–3 suggestions, got ${journey.suggestions.length}`)
  assert.equal(new Set(journey.suggestions.map((row) => row.text_zh)).size, journey.suggestions.length, 'no duplicate suggestion')
  assert.equal(new Set(journey.suggestions.map((row) => row.id)).size, journey.suggestions.length, 'suggestion ids are unique')
  for (const text of texts) assert.ok(journey.suggestions.some((row) => row.text_zh === text), `${journey.stage} suggests ${text}`)
}

function withoutIndicators(names) {
  const record = loadRecord()
  return { ...record, observations: record.observations.filter((row) => !names.includes(row.indicator)) }
}

const servers = []
try {
  // --- 1. profile: focus and consent -------------------------------------------
  assert.deepEqual(mod.FOCUS, ['bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan'])
  assert.equal(mod.FOCUS_ZH.plan, '看方案有没有用')
  assert.equal(mod.CONSENT_VERSION, '2026-09-24')
  assert.deepEqual(mod.EMPTY_PROFILE.focus, [])
  assert.equal(mod.EMPTY_PROFILE.consent, null)
  const focused = mod.normalizeProfile({ sex: 'female', focus: ['cardio', 'bioage', 'cardio'] })
  assert.deepEqual(focused.profile.focus, ['cardio', 'bioage'], 'focus keeps order and drops duplicates')
  assert.equal(mod.normalizeProfile({ focus: ['longevity'] }).ok, false, 'an unknown focus is refused')
  assert.equal(mod.normalizeProfile({ focus: 'cardio' }).ok, false, 'focus is a list')
  assert.equal(mod.normalizeProfile({ consent: { version: '', accepted_at: NOW.toISOString() } }).ok, false)
  assert.equal(mod.normalizeProfile({ consent: { version: 'v', accepted_at: 'yesterday' } }).ok, false)
  assert.deepEqual(mod.normalizeProfile({ consent: { version: 'v', accepted_at: NOW.toISOString() } }).profile.consent, { version: 'v', accepted_at: NOW.toISOString() })
  const legacyDir = tempDir('legacy')
  writeFileSync(join(legacyDir, 'profile.json'), JSON.stringify({ displayName: '甲', birthYear: 1970, age: 56, sex: 'male', risk: { smoker: false } }))
  const legacy = mod.readProfile(legacyDir)
  assert.equal(legacy.age, 56, 'a 4.x profile file still loads')
  assert.deepEqual(legacy.focus, [])
  assert.equal(legacy.consent, null)
  const merged = mod.mergeProfile({ ...legacy, consent: { version: 'v', accepted_at: NOW.toISOString() } }, { focus: ['sleep'], consent: null })
  assert.deepEqual(merged.focus, ['sleep'], 'mergeProfile replaces focus')
  assert.equal(merged.consent.version, 'v', 'mergeProfile never changes consent')
  const given = mod.setConsent(legacyDir, true, NOW)
  assert.deepEqual(given, { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() })
  assert.deepEqual(mod.readProfile(legacyDir).consent, given)
  assert.equal(mod.readProfile(legacyDir).age, 56, 'consent keeps the rest of the profile')
  assert.equal(mod.setConsent(legacyDir, false, NOW), null)
  assert.equal(mod.readProfile(legacyDir).consent, null)

  // --- 2. self measurements ----------------------------------------------------
  const selfDir = tempDir('self')
  const added = mod.addSelf(selfDir, [
    { key: 'weight', value: 150, unit: '斤', date: '2026-09-20' },
    { key: 'waist', value: 2.6, unit: '尺', date: '2026-09-20' },
    { key: 'waist', value: '34', unit: 'INCH', date: '2026-09-21' },
    { key: 'waist', value: 88 },
    { key: 'sbp', value: 300, unit: 'mmHg' },
    { key: 'dbp', value: 80, date: '2026-09-25' },
    { key: 'weight', value: 70, date: '1989-12-31' },
    { key: 'weight', value: 70, unit: 'stone' },
    { key: 'glucose', value: 5.4 },
    { key: 'sbp', value: 'high' },
  ], { today: TODAY, now: NOW })
  assert.equal(added.saved.length, 4, added.problems.join('\n'))
  const [weight, waistChi, waistInch, waistPlain] = added.saved
  assert.deepEqual([weight.value, weight.unit, weight.given], [75, 'kg', { value: 150, unit: '斤' }], '斤 → kg')
  assert.deepEqual([waistChi.value, waistChi.unit, waistChi.given], [86.7, 'cm', { value: 2.6, unit: '尺' }], '尺 → cm, rounded to 0.1')
  assert.deepEqual([waistInch.value, waistInch.given], [86.4, { value: 34, unit: 'inch' }], 'latin units ignore case')
  assert.equal(waistPlain.date, TODAY, 'the date defaults to today')
  assert.equal(waistPlain.given, undefined, 'no conversion, no given')
  assert.match(waistPlain.id, /^[0-9a-f]{8,}$/)
  assert.ok(added.problems.some((line) => line.includes('300') && line.includes('70–260')), 'out of range names the value and the range')
  assert.ok(added.problems.some((line) => line.includes('2026-09-25') && line.includes('未来')), 'a future date is refused')
  assert.ok(added.problems.some((line) => line.includes('1990')), 'a date before 1990 is refused')
  assert.ok(added.problems.some((line) => line.includes('stone')), 'an unknown unit is refused')
  assert.ok(added.problems.some((line) => line.includes('glucose')), 'only waist, blood pressure and weight')
  assert.ok(added.problems.some((line) => line.includes('high')), 'a value must be a number')
  assert.equal(statSync(join(selfDir, 'self_measurements.jsonl')).mode & 0o777, 0o600)
  assert.equal(mod.addSelf(selfDir, Array.from({ length: 51 }, () => ({ key: 'weight', value: 70 })), { today: TODAY }).saved.length, 50, 'at most 50 per call')
  assert.equal(mod.readSelf(selfDir).length, 54)
  assert.equal(mod.deleteSelf(selfDir, waistChi.id), true)
  assert.equal(mod.deleteSelf(selfDir, waistChi.id), false)
  assert.equal(mod.readSelf(selfDir).some((row) => row.id === waistChi.id), false)
  assert.equal(statSync(join(selfDir, 'self_measurements.jsonl')).mode & 0o777, 0o600, 'the rewritten file stays private')

  // home blood pressure: the mean of the 7 days ending at the latest reading
  const bpDir = tempDir('bp')
  const cuff = [['2026-09-10', 150, 95], ['2026-09-17', 130, 85], ['2026-09-18', 128, 84], ['2026-09-20', 126, 82], ['2026-09-20', 124, 80], ['2026-09-23', 122, 78]]
  mod.addSelf(bpDir, cuff.flatMap(([date, sbp, dbp]) => [{ key: 'sbp', value: sbp, date }, { key: 'dbp', value: dbp, date }]), { today: TODAY })
  const latest = mod.latestSelf(mod.readSelf(bpDir))
  assert.deepEqual(latest.sbp, { value: 126, unit: 'mmHg', date: '2026-09-23', n: 5 }, '2026-09-17..23: (130+128+126+124+122)/5')
  assert.deepEqual(latest.dbp, { value: 81.8, unit: 'mmHg', date: '2026-09-23', n: 5 })
  const bpRows = mod.selfIndicators(mod.readSelf(bpDir))
  assert.deepEqual(bpRows.find((row) => row.label === '收缩压'), {
    name: '收缩压（自测）', label: '收缩压', value: '126', unit: 'mmHg', loinc: '8480-6', date: '2026-09-23', count: 5, source: 'self',
  })
  assert.deepEqual(mod.selfSeries(mod.readSelf(bpDir), 'sbp').map((point) => [point.date, point.value]), [
    ['2026-09-10', 150], ['2026-09-17', 130], ['2026-09-18', 128], ['2026-09-20', 125], ['2026-09-23', 122],
  ], 'one daily mean per date')

  // merge precedence against record rows
  const remote = [
    { name: 'Waist Circumference-WC', label: '腰围', value: '88', unit: 'cm', loinc: '8280-0', date: '2026-08-26' },
    { name: 'systolicPressures', value: '126', unit: 'mmHg', date: '2026-09-20' },
  ]
  const selfWaist = (date) => ({ name: '腰围（自测）', label: '腰围', value: '90', unit: 'cm', loinc: '8280-0', date, source: 'self' })
  const selfSbp = (date) => ({ name: '收缩压（自测）', label: '收缩压', value: '124', unit: 'mmHg', loinc: '8480-6', date, source: 'self' })
  assert.equal(mod.mergeSelf(remote, [selfWaist('2026-08-01')]).length, 2, 'an older self waist does not override the checkup')
  assert.equal(mod.mergeSelf(remote, [selfWaist('2026-08-26')]).length, 2, 'the same day is not newer')
  assert.equal(mod.mergeSelf(remote, [selfWaist('2026-09-20')]).at(-1).name, '腰围（自测）', 'a newer self waist joins, last')
  assert.equal(mod.mergeSelf(remote, [selfSbp('2026-09-19')]).length, 2, 'the wearable cuff row counts as the same thing')
  assert.equal(mod.mergeSelf(remote, [selfSbp('2026-09-22')]).at(-1).name, '收缩压（自测）')

  // --- 3. stage progression ----------------------------------------------------
  const dataDir = tempDir('stages')
  const offline = configFor(dataDir)
  let step = await journeyOf(offline)
  let journey = step.journey
  assert.equal(journey.version, mod.PRODUCT_VERSION)
  assert.equal(journey.today, TODAY)
  assert.equal(journey.stage, 'consent')
  assert.deepEqual(journey.consent, { accepted: false, version: '', accepted_at: null, current: mod.CONSENT_VERSION })
  assert.deepEqual(journey.next, { stage: 'consent', title_zh: '开始使用 LongPi', detail_zh: '先了解 LongPi 做什么、数据放在哪里。', action: 'consent' })
  assertSuggestions(journey, ['LongPi 能帮我做什么？', '帮我建立健康档案'])
  assert.equal(journey.boundary_zh, '模型估计，不是诊断，也不是用药建议。紧急情况请拨打 120。')
  assert.deepEqual(journey.focus_options.map((row) => row.key), mod.FOCUS)
  assert.deepEqual(journey.self.keys.map((row) => row.key), ['waist', 'sbp', 'dbp', 'weight'])
  assert.ok(journey.self.keys.find((row) => row.key === 'weight').units.includes('斤'))

  // questions: what each unlocks; urban and family history are asked of men
  const questions = journey.profile.questions
  assert.deepEqual(questions.map((row) => row.key), ['age', 'sex', 'smoker', 'diabetes', 'bp_treated', 'north', 'urban', 'family_history'])
  assert.equal(questions[0].unlocks_zh, '身体年龄、心血管风险')
  assert.equal(questions[1].unlocks_zh, '身体年龄、心血管风险')
  assert.ok(questions.slice(2).every((row) => row.unlocks_zh === '心血管风险'))
  assert.deepEqual(questions.filter((row) => row.men_only).map((row) => row.key), ['urban', 'family_history'])
  assert.equal(questions[2].label_zh, mod.RISK_FACT_ZH.smoker)
  assert.ok(questions.every((row) => row.answered === false))

  // an older notice version is not consent to the current one
  mod.writeProfile(dataDir, { ...mod.readProfile(dataDir), consent: { version: '2025-01-01', accepted_at: NOW.toISOString() } })
  journey = (await journeyOf(offline)).journey
  assert.equal(journey.stage, 'consent')
  assert.equal(journey.consent.accepted, false)
  assert.equal(journey.consent.version, '2025-01-01')

  mod.setConsent(dataDir, true, NOW)
  journey = (await journeyOf(offline)).journey
  assert.equal(journey.stage, 'profile')
  assert.equal(journey.consent.accepted, true)
  assert.equal(journey.consent.accepted_at, NOW.toISOString())
  assert.equal(journey.next.action, 'profile')
  assertSuggestions(journey, ['LongPi 能帮我做什么？', '帮我建立健康档案'])

  // only age and sex are needed to leave the profile step; skipped facts stay unknown
  mod.writeProfile(dataDir, { ...mod.readProfile(dataDir), age: 53, sex: 'male', risk: { north: true } })
  step = await journeyOf(offline)
  journey = step.journey
  assert.equal(journey.profile.complete, true)
  assert.equal(journey.stage, 'records', 'no mcpUrl')
  assert.deepEqual(journey.profile.risk, { north: true })
  assert.deepEqual(questions.map((row) => row.key).filter((key) => journey.profile.questions.find((row) => row.key === key).answered), ['age', 'sex', 'north'])
  assert.equal(journey.records.status, 'unconfigured')
  assert.equal(journey.next.action, 'records')
  assert.equal(journey.next.detail_zh, '在 Mirobody 中生成个人 MCP 地址，重新运行安装命令时加上 --mcp-url。')
  assertSuggestions(journey, ['怎么把体检报告导入 Mirobody？', '还没有体检记录，现在可以先做什么？'])
  assert.equal(journey.results.bioage.status, 'blocked')
  assert.equal(journey.results.bioage.blocker_zh, '还没有连接 Mirobody 记录。')
  // without a record the risk card still lists the labs it needs and the facts still unanswered
  const offlineRisk = journey.results.risk
  assert.equal(offlineRisk.status, 'blocked')
  for (const lab of ['收缩压', '总胆固醇', '高密度脂蛋白胆固醇', '腰围']) assert.ok(offlineRisk.missing_labs.includes(lab), `needs ${lab}`)
  assert.ok(offlineRisk.missing_facts.includes(mod.RISK_FACT_ZH.smoker))
  assert.ok(!offlineRisk.missing_facts.includes(mod.RISK_FACT_ZH.north), 'an answered fact is not missing')
  assert.match(offlineRisk.blocker_zh, /Mirobody/)
  const offlineCard = step.tracking.models.find((card) => card.model === 'china-par')
  assert.deepEqual(offlineCard.missing, [...offlineCard.missing_labs, ...offlineCard.missing_facts], 'missing stays their concatenation')
  const waistAddon = journey.addons.find((row) => row.item_zh === '腰围')
  assert.deepEqual(waistAddon, { item_zh: '腰围', unlocks_zh: '心血管风险', self_measurable: true, self_key: 'waist' })
  assert.equal(journey.addons.find((row) => row.item_zh === '收缩压').self_key, 'sbp')
  assert.equal(journey.addons.find((row) => row.item_zh === '总胆固醇').self_measurable, false)
  const firstLab = journey.addons.findIndex((row) => !row.self_measurable)
  assert.ok(journey.addons.slice(firstLab).every((row) => !row.self_measurable), 'self-measurable add-ons come first')

  // connected, but the record has neither hs-CRP nor a waist: both results are blocked
  mod.writeProfile(dataDir, { ...mod.readProfile(dataDir), risk: FACTS, focus: ['cardio', 'bioage'] })
  const thin = await startFakeMirobody({ record: withoutIndicators(['hs-CRP', 'Waist Circumference-WC']) })
  servers.push(thin)
  const thinConfig = configFor(dataDir, thin.url)
  journey = (await journeyOf(thinConfig)).journey
  assert.equal(journey.records.status, 'ok')
  assert.equal(journey.stage, 'first_result')
  assert.equal(journey.results.bioage.status, 'blocked')
  assert.deepEqual(journey.results.bioage.missing, ['C反应蛋白'])
  assert.equal(journey.results.bioage.blocker_zh, '记录里还缺C反应蛋白。')
  assert.equal(journey.results.risk.status, 'blocked')
  assert.deepEqual(journey.results.risk.missing_labs, ['腰围'])
  assert.deepEqual(journey.results.risk.missing_facts, [])
  assert.deepEqual(journey.addons, [
    { item_zh: '腰围', unlocks_zh: '心血管风险', self_measurable: true, self_key: 'waist' },
    { item_zh: 'C反应蛋白', unlocks_zh: '身体年龄', self_measurable: false },
  ])
  assert.deepEqual(journey.next, { stage: 'first_result', title_zh: '还差 2 项检查', detail_zh: '下次体检加测：腰围、C反应蛋白', action: 'addons' })
  assertSuggestions(journey, ['下次体检需要加测哪些项目？', '用我现有的记录能算出什么？', '帮我记录腰围和家庭血压'])

  // a tape-measure waist lets China-PAR compute before the next checkup
  const tape = mod.addSelf(dataDir, [{ key: 'waist', value: 88, unit: 'cm', date: '2026-09-20' }], { today: TODAY })
  assert.equal(tape.saved.length, 1)
  step = await journeyOf(thinConfig)
  journey = step.journey
  assert.equal(journey.results.risk.status, 'ok', journey.results.risk.blocker_zh)
  assert.ok(journey.results.risk.risk_pct > 0 && journey.results.risk.risk_pct < 30)
  assert.ok(['低危', '中危', '高危'].includes(journey.results.risk.category_zh))
  assert.equal(journey.results.risk.blocker_zh, '')
  assert.equal(journey.addons.some((row) => row.item_zh === '腰围'), false)
  assert.equal(journey.stage, 'plan', 'one first result is enough to move on')
  assert.deepEqual(journey.self.latest.map((row) => [row.key, row.value, row.n]), [['waist', 88, 1]])
  assert.equal(journey.records.indicator_count, step.records.indicators.filter((row) => row.source !== 'self').length, 'self rows are not Mirobody indicators')
  assertSuggestions(journey, ['我的心血管风险怎么样？哪些因素影响最大？', '帮我保存我的干预方案', '有哪些经过研究验证的改善方法？'])
  assert.equal(journey.suggestions[0].text_zh, '我的心血管风险怎么样？哪些因素影响最大？', 'the first suggestion follows the first focus')

  // the full fixture record: both results, several checkups
  const full = await startFakeMirobody()
  servers.push(full)
  const fullConfig = configFor(dataDir, full.url)
  step = await journeyOf(fullConfig)
  journey = step.journey
  assert.equal(journey.stage, 'plan')
  assert.equal(journey.results.bioage.status, 'ok', journey.results.bioage.blocker_zh)
  assert.equal(journey.results.bioage.checkups, 4)
  assert.equal(journey.records.full_checkups, 4)
  assert.equal(journey.records.latest_checkup, '2026-08-26')
  assert.equal(journey.results.bioage.date, '2026-08-26')
  assert.equal(journey.results.bioage.phenoage, step.tracking.bioage.points.at(-1).phenoage, 'the number is the skill output')
  assert.ok(journey.results.bioage.band_years > 0)
  assert.equal(journey.results.risk.status, 'ok')
  assert.deepEqual(journey.addons, [])
  assert.equal(journey.plan.exists, false)
  assert.deepEqual(journey.reminders, [])
  // the older self waist (2026-09-20) is newer than the checkup's (2026-08-26), so it joins; an older one would not
  assert.equal(step.records.indicators.at(-1).name, '腰围（自测）')

  // merge precedence as the skills see it
  const par = catalog.cards.find((card) => card.name === mod.RISK_SKILL)
  const waistFor = (records) => mod.runnableFrom(par, records.indicators, records.profile).from_record.find((row) => row.key === 'waist_cm')
  const precedence = tempDir('precedence')
  const precedenceConfig = configFor(precedence, full.url)
  mod.writeProfile(precedence, { age: 53, sex: 'male', risk: FACTS })
  mod.addSelf(precedence, [{ key: 'waist', value: 95, date: '2026-08-01' }], { today: TODAY })
  mod.invalidateRecords()
  let records = await mod.loadRecords(precedenceConfig, precedence, '/nonexistent/plugin')
  assert.equal(waistFor(records).value, '88', 'an older self waist does not override a newer checkup')
  mod.addSelf(precedence, [{ key: 'waist', value: 91, date: '2026-09-21' }], { today: TODAY })
  records = await mod.loadRecords(precedenceConfig, precedence, '/nonexistent/plugin')
  assert.equal(waistFor(records).value, '91', 'a newer self waist does')
  mod.addSelf(precedence, cuff.flatMap(([date, sbp]) => [{ key: 'sbp', value: sbp, date }]), { today: TODAY })
  records = await mod.loadRecords(precedenceConfig, precedence, '/nonexistent/plugin')
  const sbpIn = mod.runnableFrom(par, records.indicators, records.profile).from_record.find((row) => row.key === 'sbp_mmhg')
  assert.equal(sbpIn.value, '126', 'home blood pressure enters China-PAR as its 7-day mean')

  // a plan aimed at home blood pressure is charted from the self series, never asked of Mirobody
  mod.savePlan(precedence, mod.normalizePlan({
    title: '控压', items: [{ category: 'diet', title: '少盐', start: '2026-09-12', markers: ['收缩压'] }],
  }, { today: TODAY, medications: [], previous: null }).plan)
  mod.invalidateTracking()
  const bpTracking = await mod.buildTracking({ config: precedenceConfig, dataDir: precedence, skillsHome: home, catalog, records, today: TODAY })
  const bpChart = bpTracking.charts.find((chart) => chart.indicator === '收缩压（自测）')
  assert.ok(bpChart, 'the marker resolves to the self row')
  assert.ok(bpChart.points.length > 0)
  assert.ok(bpTracking.items[0].verdicts[0].baseline, 'the self series gives the verdict a baseline')
  for (const server of servers) {
    for (const call of server.calls) {
      for (const name of call.args.indicators ?? []) assert.ok(!String(name).endsWith('（自测）'), `self row ${name} sent to Mirobody`)
    }
  }

  // save a plan: routine, check-in items, reminders
  const plan = mod.normalizePlan({
    title: '秋季方案, 第二版; 试行',
    items: [
      { category: 'diet', title: '地中海饮食', start: '2026-08-27', markers: ['甘油三酯'] },
      { category: 'sleep', title: '早睡', start: '2026-09-15', target: { metric: 'dailyTotalSleepTime', op: '>=', value: 7, unit: 'hours' }, markers: ['hs-CRP'] },
      { category: 'supplement', title: '鱼油', start: '2026-03-01', medication: '鱼油' },
      { category: 'exercise', title: '游泳', start: '2026-10-10' },
    ],
  }, { today: TODAY, medications: [{ name: '鱼油(Omega-3)', plan_id: 'p-fishoil' }], previous: null })
  assert.deepEqual(plan.errors, [])
  mod.savePlan(dataDir, plan.plan)
  step = await journeyOf(fullConfig)
  journey = step.journey
  assert.equal(journey.stage, 'routine')
  assert.equal(journey.plan.exists, true)
  assert.equal(journey.plan.version, 1)
  assert.equal(journey.plan.items, 4)
  assert.equal(journey.plan.started, '2026-03-01')
  assert.equal(journey.plan.days, 207)
  const diet = step.tracking.plan.items.find((item) => item.title === '地中海饮食')
  assert.deepEqual(journey.plan.checkin_items, [{ id: diet.id, title: '地中海饮食', done_today: false }], 'wearable, Mirobody and not-yet-started items need no tap')
  assert.deepEqual(journey.reminders, [
    { kind: 'retest', text_zh: '复测甘油三酯', date: TODAY, due: true },
    { kind: 'retest', text_zh: '复测超敏C反应蛋白', date: '2026-09-29', due: false },
    { kind: 'checkin', text_zh: '今天还有 1 项待打卡', date: TODAY, due: true },
  ])
  assert.deepEqual(journey.next, { stage: 'routine', title_zh: '今天的打卡', detail_zh: '还有 1 项待完成', action: 'checkin' })
  assertSuggestions(journey, ['今天的方案我都完成了', '我的方案有没有效果？', '该复测什么了？'])

  mod.addCheckIns(dataDir, [{ item: '地中海饮食', date: TODAY, done: true }, { item: '地中海饮食', date: '2026-09-23', done: true }], { today: TODAY, source: 'board' })
  step = await journeyOf(fullConfig)
  journey = step.journey
  assert.equal(journey.plan.checkin_items[0].done_today, true)
  assert.equal(journey.reminders.some((row) => row.kind === 'checkin'), false)
  assert.deepEqual(journey.next, { stage: 'routine', title_zh: '该复测了', detail_zh: '可以复测甘油三酯', action: 'review' })
  assert.ok(journey.plan.streak >= 2)
  assert.ok(journey.plan.adherence_pct >= 0 && journey.plan.adherence_pct <= 100)

  // --- 4. calendar -------------------------------------------------------------
  const ics = mod.buildCalendar(journey, step.tracking, { now: NOW })
  assert.ok(ics.endsWith('\r\n'))
  assert.equal(ics.split('\r\n').join('').includes('\n'), false, 'CRLF only')
  const physical = ics.split('\r\n').slice(0, -1)
  for (const line of physical) assert.ok(Buffer.byteLength(line, 'utf8') <= 75, `line over 75 octets: ${line}`)
  assert.ok(physical.some((line) => line.startsWith(' ')), 'long lines are folded')
  const unfolded = ics.replace(/\r\n /g, '').split('\r\n').slice(0, -1)
  for (const block of ['VCALENDAR', 'VEVENT', 'VALARM']) {
    assert.equal(unfolded.filter((line) => line === `BEGIN:${block}`).length, unfolded.filter((line) => line === `END:${block}`).length, `${block} pairs`)
  }
  assert.equal(unfolded[0], 'BEGIN:VCALENDAR')
  assert.equal(unfolded.at(-1), 'END:VCALENDAR')
  assert.ok(unfolded.includes('PRODID:-//dsh-plugin-longpi//LongPi//ZH'))
  assert.equal(unfolded.filter((line) => line === 'BEGIN:VEVENT').length, 3, 'two retests and one daily check-in')
  const uids = unfolded.filter((line) => line.startsWith('UID:'))
  assert.equal(new Set(uids).size, uids.length)
  assert.ok(uids.every((uid) => /^UID:longpi-(retest-[a-z0-9-]+-\d{4}-\d{2}-\d{2}|checkin)@dsh-plugin-longpi$/.test(uid)), uids.join(' '))
  assert.ok(unfolded.includes('DTSTART;VALUE=DATE:20260924'))
  assert.ok(unfolded.includes('SUMMARY:LongPi 复测：甘油三酯'))
  assert.ok(unfolded.includes('TRIGGER:PT9H'))
  assert.ok(unfolded.includes('DTSTART:20260924T210000'))
  assert.ok(unfolded.includes('DURATION:PT10M'))
  assert.ok(unfolded.includes('RRULE:FREQ=DAILY;UNTIL=20261223T235959'), 'no end date: today + 90 days')
  assert.ok(unfolded.includes('TRIGGER:PT0M'))
  assert.ok(unfolded.includes('DTSTAMP:20260924T120000Z'))
  assert.ok(unfolded.includes('SUMMARY:LongPi 打卡：秋季方案\\, 第二版\\; 试行'), 'commas and semicolons are escaped')
  assert.equal(mod.escapeText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne')
  const long = `SUMMARY:${'长'.repeat(40)}`
  const folded = mod.foldLine(long)
  assert.ok(folded.split('\r\n').every((line) => Buffer.byteLength(line) <= 75), 'a multibyte line folds within 75 octets')
  assert.equal(folded.replace(/\r\n /g, ''), long, 'folding never cuts a character')

  // --- 5. routes and tools, through the plugin's own apply -----------------------
  const routeDir = tempDir('routes')
  const host = fakeHost()
  await mod.apply(host.ctx, configFor(routeDir))
  for (const name of mod.TOOL_NAMES) assert.ok(host.tools.has(name), `tool ${name} is registered`)
  assert.equal(mod.TOOL_NAMES.length, 15)
  const prompt = host.prompts.map((row) => (typeof row.text === 'function' ? row.text() : row.text)).join('\n')
  assert.match(prompt, /save_self_measurement/)
  assert.match(prompt, /onboarding/)
  assert.match(prompt, /never store it as no/)

  let res = await call(host, 'GET', '/api/longpi/journey')
  assert.equal(res.status, 200)
  assert.equal(res.json().stage, 'consent')
  res = await call(host, 'POST', '/api/longpi/consent', { accept: 'yes' })
  assert.equal(res.status, 400, 'accept must be a boolean')
  res = await call(host, 'POST', '/api/longpi/consent', { accept: true })
  assert.equal(res.status, 200)
  assert.equal(res.json().consent.version, mod.CONSENT_VERSION)
  const accepted = mod.readProfile(routeDir).consent
  assert.equal(accepted.version, mod.CONSENT_VERSION)

  res = await call(host, 'POST', '/api/longpi/profile', { age: 50, sex: 'female', focus: ['glucose', 'weight'], consent: null })
  assert.equal(res.status, 200, res.text)
  assert.deepEqual(mod.readProfile(routeDir).consent, accepted, 'the profile route cannot withdraw consent')
  assert.deepEqual(mod.readProfile(routeDir).focus, ['glucose', 'weight'])
  mod.setConsent(routeDir, false, NOW)
  res = await call(host, 'POST', '/api/longpi/profile', { age: 51, consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() } })
  assert.equal(res.status, 200)
  assert.equal(mod.readProfile(routeDir).consent, null, 'nor give it')
  assert.equal(mod.readProfile(routeDir).age, 51)
  res = await call(host, 'POST', '/api/longpi/profile', { focus: ['wealth'] })
  assert.equal(res.status, 400)
  res = await call(host, 'POST', '/api/longpi/consent', { accept: true })
  assert.equal(res.status, 200)

  const saveProfile = host.tools.get('save_personal_profile')
  const refused = await saveProfile.execute({ consent: true }).catch((error) => ({ ok: false, error: String(error) }))
  assert.equal(refused.ok, false, 'the tool never sets consent')
  const toolSaved = await saveProfile.execute({ age: 52, focus: ['sleep'] })
  assert.equal(toolSaved.ok, true)
  assert.equal(mod.readProfile(routeDir).consent.version, mod.CONSENT_VERSION, 'saving the profile in chat keeps consent')
  assert.deepEqual(mod.readProfile(routeDir).focus, ['sleep'])
  assert.equal(mod.readProfile(routeDir).age, 52)

  res = await call(host, 'POST', '/api/longpi/self', { entries: [{ key: 'waist', value: 2.6, unit: '尺' }, { key: 'weight', value: 150, unit: '斤' }] })
  assert.equal(res.status, 200, res.text)
  assert.equal(res.json().saved.length, 2)
  res = await call(host, 'POST', '/api/longpi/self', { key: 'sbp', value: 128 })
  assert.equal(res.status, 200, 'a single entry works too')
  res = await call(host, 'POST', '/api/longpi/self', { entries: [{ key: 'sbp', value: 999 }] })
  assert.equal(res.status, 400)
  assert.ok(res.json().problems[0].includes('999'))
  res = await call(host, 'GET', '/api/longpi/self')
  const rows = res.json().rows
  assert.equal(rows.length, 3)
  res = await call(host, 'DELETE', `/api/longpi/self?id=${rows[0].id}`)
  assert.equal(res.status, 200)
  assert.equal(res.json().ok, true)
  res = await call(host, 'DELETE', `/api/longpi/self?id=${rows[0].id}`)
  assert.equal(res.json().ok, false)

  const selfTool = await host.tools.get('save_self_measurement').execute({ entries: [{ key: 'weight', value: 165, unit: 'lb', date: '2026-09-01' }] })
  assert.equal(selfTool.ok, true)
  assert.equal(selfTool.saved[0].value, 74.8)
  assert.equal(selfTool.saved[0].label_zh, '体重')

  const situation = await host.tools.get('read_personal_situation').execute({})
  assert.equal(situation.onboarding.stage, 'records')
  assert.equal(situation.onboarding.consent_accepted, true)
  assert.ok(situation.onboarding.questions_unanswered.includes(mod.RISK_FACT_ZH.smoker))
  assert.equal(situation.onboarding.results.risk.status, 'blocked')
  assert.ok(situation.onboarding.addons.some((row) => row.item_zh === '总胆固醇'))
  assert.deepEqual(situation.self_measurements.map((row) => row.key), ['waist', 'weight'])
  const status = await host.tools.get('longpi_status').execute({})
  assert.equal(status.stage, 'records')
  const command = host.commands.get('longpi').handler({ rawInput: '/longpi' })
  assert.match(command.text, /^stage records · next 连接体检记录$/m)
  assert.doesNotMatch(command.text, /mmHg|cm|kg/, 'no health values in the command')

  res = await call(host, 'GET', '/api/longpi/calendar.ics')
  assert.equal(res.status, 200)
  assert.equal(res.headers['content-type'], 'text/calendar; charset=utf-8')
  assert.equal(res.headers['content-disposition'], 'attachment; filename="longpi.ics"')
  assert.match(res.text, /^BEGIN:VCALENDAR\r\n/)
  res = await call(host, 'GET', '/api/longpi/journey?refresh=1')
  assert.equal(res.json().self.latest.find((row) => row.key === 'weight').value, 75, 'the newest weight wins')

  console.log(`journey ok (stages consent → profile → records → first_result → plan → routine; China-PAR ${journey.results.risk.risk_pct}% ${journey.results.risk.category_zh}, phenotypic age at ${journey.results.bioage.checkups} checkups)`)
} finally {
  for (const server of servers) await server.close()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}

function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const commands = new Map()
  const prompts = []
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: (section) => { prompts.push(section) } },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    commands: { register: (command) => { commands.set(command.name, command) } },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
  }
  return { ctx, tools, routes, commands, prompts }
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
