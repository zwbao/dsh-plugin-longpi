// Plan safety (0.5.2): the doctor-first stop (critical values and a falling
// red-cell count), medicines that rule plan items out (SGLT2 inhibitors,
// insulin and sulfonylureas), the hypoglycaemia first step, and exclusions
// the person states that every later draft keeps. Uses the fake Mirobody
// record and the real longevity-skills checkout; skips without it.

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
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'data', 'effects.jsonl')) ? sibling : '')
if (!home || !existsSync(join(home, 'data', 'effects.jsonl'))) {
  console.log('plan-safety skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const TRE = /限时进食|time-restricted|16:8|轻断食|断食/i
const LOW_CARB = /生酮|极低碳|低碳/i
const catalog = mod.loadCatalog(home)
const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-safety-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
  }
}

function profileIn(dataDir, extra = {}) {
  mod.writeProfile(dataDir, { age: 36, sex: 'male', risk: FACTS, focus: ['bioage', 'cardio', 'weight'], consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() }, ...extra })
}

async function contextOf(config, patch = (records) => records) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = patch(await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin'))
  return { config, dataDir: config.dataDir, skillsHome: home, catalog, records, today: TODAY, mount: MOUNT }
}

function lab(indicator, name, code, unit, date, value) {
  return { indicator, name, system: 'loinc', code, unit, date, time: `${date} 08:30:00`, value: String(value), file: `${date} 体检报告.pdf` }
}

const DATES = ['2025-10-18', '2026-01-20', '2026-04-22', '2026-08-26']

/** The fixture record with the owner's red-cell course on its four checkup days, and one ferritin. */
function anaemiaRecord() {
  const record = loadRecord()
  const mcv = { '2025-10-18': '88.0', '2026-01-20': '80.1', '2026-04-22': '72.4', '2026-08-26': '68.0' }
  const rdw = { '2025-10-18': '13', '2026-01-20': '14', '2026-04-22': '16', '2026-08-26': '18' }
  const observations = record.observations.map((row) => {
    if (row.indicator === 'Mean Corpuscular Volume-MCV' && mcv[row.date]) return { ...row, value: mcv[row.date] }
    if (row.indicator === 'Red Cell Distribution Width-RDW-CV' && rdw[row.date]) return { ...row, value: rdw[row.date] }
    return row
  })
  const hgb = [152, 143, 135, 124]
  DATES.forEach((date, index) => observations.push(lab('Hemoglobin-HGB', '血红蛋白', '718-7', 'g/L', date, hgb[index])))
  // 血小板分布宽度 17 fL must not read as a red-cell width.
  DATES.forEach((date) => observations.push(lab('Platelet Distribution Width-PDW', '血小板分布宽度', '32207-3', 'fL', date, '17.0')))
  observations.push(lab('Ferritin-FER', '铁蛋白', '2276-4', 'ng/mL', '2026-08-26', '8.0'))
  return { ...record, observations }
}

function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const disposers = []
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => {
      const dispose = execute()
      disposers.push(dispose)
      return dispose
    },
  }
  return { ctx, tools, routes, dispose: () => disposers.splice(0).forEach((fn) => fn()) }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
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

function userMessage(text) {
  return Object.freeze({ id: `u-${Math.random().toString(36).slice(2)}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } })
}

function fakeAgent() {
  return { options: { provider: 'p', model: 'm' }, session: { id: 's', requestHeader: () => undefined }, steer: () => {} }
}

/** An agent whose session holds one turn: the person's message and the reply. */
function turnAgent(turn, userText, reply) {
  const steered = []
  const events = [
    { type: 'turn/start', data: { turn } },
    { type: 'user/message', data: userMessage(userText) },
    { type: 'assistant/message', data: { turn, step: 1, message: { role: 'assistant', content: [{ type: 'text', text: reply }] }, stream: [] } },
  ]
  const session = { id: `s-${turn}-${reply.length}`, get seq() { return events.length }, eventAt: (seq) => ({ ...events[seq], seq }), requestHeader: () => undefined }
  return { agent: { ...fakeAgent(), session, steer: (message) => { steered.push(message) } }, steered }
}

const point = (name, value, unit, date, loinc) => ({ name, value, unit, date, ...(loinc ? { loinc } : {}) })

try {
  // --- 1. the stop itself --------------------------------------------------------------
  const owner = [
    point('血红蛋白', 152, 'g/L', '2023-11-14'), point('血红蛋白', 138, 'g/L', '2024-09-18'), point('血红蛋白', 124, 'g/L', '2026-02-11'),
    point('平均红细胞体积', 88, 'fL', '2023-11-14'), point('平均红细胞体积', 79, 'fL', '2024-09-18'), point('平均红细胞体积', 68, 'fL', '2026-02-11'),
    point('红细胞分布宽度-变异系数', 18, '%', '2026-02-11'),
    point('血小板分布宽度', 17, 'fL', '2026-02-11'),
    point('红细胞分布宽度-标准差', 44, 'fL', '2026-02-11'),
    point('铁蛋白', 8.0, 'ng/mL', '2026-09-21'),
    point('低密度脂蛋白胆固醇', 1.76, 'mmol/L', '2026-02-11'),
  ]
  const stop = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: owner })
  assert.equal(stop.stop, true)
  assert.deepEqual(stop.hits.map((hit) => hit.key), ['hgb', 'mcv', 'rdw', 'ferritin'])
  assert.match(stop.sentence_zh, /^请先去看医生：血红蛋白 124 g\/L（2026-02-11）偏低，低于男性参考下限 130，3 次体检 152 → 138 → 124（2023-11-14 到 2026-02-11）一路下降/)
  assert.match(stop.sentence_zh, /平均红细胞体积（MCV）68 fL（2026-02-11）偏低，低于 80，3 次体检 88 → 79 → 68/)
  assert.match(stop.sentence_zh, /红细胞分布宽度（RDW-CV）18%（2026-02-11）偏高/)
  assert.match(stop.sentence_zh, /铁蛋白 8 ng\/mL（2026-09-21）偏低/)
  assert.match(stop.sentence_zh, /带着这几次体检报告去看医生/)
  assert.match(stop.sentence_zh, /不要自己买铁剂/)
  assert.doesNotMatch(stop.sentence_zh, /不能评|17%|44%/, 'PDW and RDW-SD are not RDW-CV')
  assert.equal(stop.title_zh, '请先去看医生：血红蛋白 124 g/L 偏低，平均红细胞体积 68 fL 偏低，红细胞分布宽度 18% 偏高')

  // a fall across checkups stops a plan even while every value is still inside the range
  const falling = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: [point('血红蛋白', 152, 'g/L', '2023-01-01'), point('血红蛋白', 144, 'g/L', '2024-01-01'), point('血红蛋白', 135, 'g/L', '2025-01-01')] })
  assert.equal(falling.stop, true)
  assert.match(falling.sentence_zh, /血红蛋白 135 g\/L（2025-01-01），3 次体检 152 → 144 → 135/)
  assert.equal(falling.hits[0].short_zh, '血红蛋白 135 g/L 在下降')
  for (const steady of [[152, 145, 146], [150, 146, 141]]) {
    const pts = steady.map((value, index) => point('血红蛋白', value, 'g/L', `202${index}-01-01`))
    assert.equal(mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: pts }).stop, false, steady.join('→'))
  }
  // women: the lower limit is 115; p30's HGB 124 and her treated diabetes do not stop a plan
  const p30 = [point('血红蛋白', 124, 'g/L', '2026-04-16', '718-7'), point('平均红细胞体积', 88.5, 'fL', '2026-04-16', '787-2'), point('红细胞分布宽度', 13.1, '%', '2026-04-16', '788-0'),
    point('空腹血糖', 7.66, 'mmol/L', '2026-04-16', '1558-6'), point('糖化血红蛋白', 7.5, '%', '2026-04-16', '4548-4'), point('低密度脂蛋白胆固醇', 2.95, 'mmol/L', '2026-04-16', '13457-7'), point('收缩压', 128, 'mmHg', '2026-04-16', '8480-6')]
  assert.equal(mod.clinicalStop({ sex: 'female', diabetesKnown: true, points: p30 }).stop, false)
  const unknownDm = mod.clinicalStop({ sex: 'female', diabetesKnown: false, points: p30 })
  assert.deepEqual(unknownDm.hits.map((hit) => hit.key), ['glucose', 'hba1c'])
  assert.match(unknownDm.sentence_zh, /空腹血糖 7\.66 mmol\/L（2026-04-16）偏高，达到糖尿病诊断范围（≥7\.0），记录里还没有医生已经知道这件事/)
  const ldl = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: [point('低密度脂蛋白胆固醇', 5.1, 'mmol/L', '2026-01-01')] })
  assert.match(ldl.sentence_zh, /低密度脂蛋白胆固醇 5\.1 mmol\/L（2026-01-01）很高（≥4\.9）/)
  const sbp = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: [point('收缩压', 182, 'mmHg', '2026-01-01')] })
  assert.match(sbp.sentence_zh, /收缩压 182 mmHg（2026-01-01）很高（≥180）。血压这么高请尽快就医；如果同时有胸痛.*立即拨打 120/)
  assert.equal(mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: [point('低密度脂蛋白胆固醇', 4.8, 'mmol/L', '2026-01-01'), point('收缩压', 179, 'mmHg', '2026-01-01')] }).stop, false)

  // --- 2. through the plugin: journey, draft tool, draft route, situation -----------------------
  const anaemic = await startFakeMirobody({ record: anaemiaRecord() })
  servers.push(anaemic)
  const stopDir = tempDir('stop')
  profileIn(stopDir)
  const stopConfig = configFor(stopDir, anaemic.url)
  const journey = await mod.buildJourney(await contextOf(stopConfig))
  assert.equal(journey.doctor_first.stop, true)
  assert.equal(journey.next.action, 'doctor', 'the overview\'s next step is the doctor, not 制定改善方案')
  assert.match(journey.next.title_zh, /^请先去看医生：血红蛋白 124 g\/L 偏低，平均红细胞体积 68 fL 偏低，红细胞分布宽度 18% 偏高$/)
  assert.match(journey.next.detail_zh, /4 次体检|3 次体检/)
  assert.match(journey.next.detail_zh, /143 → 135 → 124/)
  assert.match(journey.next.detail_zh, /铁蛋白 8 ng\/mL（2026-08-26）偏低/)
  assert.doesNotMatch(journey.next.detail_zh, /血小板|不能评/)
  assert.equal(journey.suggestions[0].id, 'doctor-first')

  const host = fakeHost()
  await mod.apply(host.ctx, stopConfig)
  const drafted = await host.tools.get('draft_intervention_plan').execute({})
  assert.equal(drafted.draft, null, 'no draft')
  assert.equal(drafted.brief.candidates.length, 0)
  assert.equal(drafted.reply_zh, journey.doctor_first.sentence_zh, 'the reply is the doctor sentence, the same as the overview')
  assert.equal(drafted.brief.safety.stop_zh, drafted.reply_zh)
  assert.equal(drafted.brief.notes_zh[0], drafted.reply_zh)
  assert.match(drafted.how_to_use, /stop_zh is set, that sentence is the whole reply/)
  const route = (await call(host, 'GET', '/api/longpi/plan-draft')).json()
  assert.equal(route.draft, null)
  assert.equal(route.brief.safety.stop_zh, drafted.reply_zh)
  const situation = await host.tools.get('read_personal_situation').execute({})
  assert.equal(situation.doctor_first_zh, drafted.reply_zh)
  assert.match(situation.doctor_first_how_to_read, /never answer 不能评/)
  host.dispose()

  // the same record without the anaemia drafts as before
  const plain = await startFakeMirobody()
  servers.push(plain)
  const plainDir = tempDir('plain')
  profileIn(plainDir)
  const plainJourney = await mod.buildJourney(await contextOf(configFor(plainDir, plain.url)))
  assert.equal(plainJourney.doctor_first.stop, false)
  assert.notEqual(plainJourney.next.action, 'doctor')

  // --- 3. medicines that rule items out ------------------------------------------------------
  const sglt2Dir = tempDir('sglt2')
  profileIn(sglt2Dir, { sex: 'female', age: 52, risk: { ...FACTS, diabetes: true }, focus: ['glucose', 'weight', 'cardio'] })
  const onSglt2 = (records) => ({
    ...records,
    medications: [
      { name: '二甲双胍缓释片', status: 'active', recorded_dose: '0.5g', schedule: '每日3次', since: '2020-04-08' },
      { name: '达格列净片', status: 'active', recorded_dose: '10mg', schedule: '每日1次 早晨', since: '2023-08-14' },
      { name: '消渴丸', status: 'stopped', recorded_dose: '', since: '2022-11-14', until: '2022-11-16' },
    ],
  })
  const sglt2Brief = await mod.buildPlanBrief(await contextOf(configFor(sglt2Dir, plain.url), onSglt2), { focus: ['weight', 'glucose', 'cardio'] })
  assert.equal(sglt2Brief.safety.stop_zh, undefined, 'treated diabetes is known to a doctor: no stop')
  assert.ok(sglt2Brief.candidates.length > 0, 'still something to draft')
  assert.equal(sglt2Brief.candidates.some((row) => TRE.test(`${row.intervention_zh} ${row.id}`) || LOW_CARB.test(row.intervention_zh)), false, 'no time-restricted eating, fasting or very-low-carb on an SGLT2 inhibitor')
  const ketoNote = sglt2Brief.safety.notes_zh.find((line) => line.includes('SGLT2'))
  assert.match(ketoNote, /正常血糖性酮症酸中毒（euglycaemic ketoacidosis）/)
  assert.match(ketoNote, /不安排限时进食、断食或极低碳/)
  assert.ok(!sglt2Brief.safety.notes_zh.some((line) => /胰岛素或磺脲类/.test(line)), 'the stopped 消渴丸 is not a current sulfonylurea')
  assert.ok(!sglt2Brief.safety.notes_zh.some((line) => /限时进食这类|限时进食、少吃/.test(line)), 'no caution about an item that cannot be drafted')
  const sglt2Draft = mod.draftPlan(sglt2Brief, { today: TODAY })
  assert.ok(sglt2Draft && sglt2Draft.items.length > 0)
  for (const item of sglt2Draft.items) assert.doesNotMatch(`${item.title} ${item.detail}`, TRE, item.title)

  const insulinBrief = await mod.buildPlanBrief(await contextOf(configFor(sglt2Dir, plain.url), (records) => ({
    ...records, medications: [{ name: '门冬胰岛素注射液', status: 'active', recorded_dose: '' }, { name: '格列美脲片', status: 'active', recorded_dose: '2mg' }],
  })), { focus: ['weight', 'cardio'] })
  const moving = insulinBrief.candidates.filter((row) => row.category === 'exercise' || row.category === 'weight' || TRE.test(row.intervention_zh))
  assert.ok(moving.length > 0)
  for (const row of moving) assert.ok(row.cautions_zh.includes('你在用胰岛素或磺脲类，这项有低血糖风险，先与医生确认'), row.id)
  assert.ok(insulinBrief.safety.notes_zh.includes('你在用胰岛素或磺脲类：运动、少吃和减重都有低血糖风险，先与医生确认。'))

  // pregnancy (stated) and kidney disease (stated, or an eGFR under 60) take items out, and are remembered
  const pregDir = tempDir('pregnant')
  profileIn(pregDir, { sex: 'female', age: 31, focus: ['weight', 'cardio'] })
  const pregnant = await mod.buildPlanBrief(await contextOf(configFor(pregDir, plain.url)), { focus: ['weight', 'cardio'], constraints: '我怀孕了' })
  assert.ok(pregnant.candidates.length > 0)
  for (const row of pregnant.candidates) {
    assert.ok(row.category !== 'weight' && !TRE.test(row.intervention_zh) && !LOW_CARB.test(row.intervention_zh) && !/饮酒|酒精|减重|热量限制/.test(row.intervention_zh) && !/鱼油|omega|EPA|DHA/i.test(row.intervention_zh), row.id)
  }
  assert.ok(pregnant.safety.notes_zh.includes('怀孕时不安排限时进食、减重、饮酒和鱼油。'))
  const pregLater = await mod.buildPlanBrief(await contextOf(configFor(pregDir, plain.url)), { focus: ['weight', 'cardio'] })
  assert.ok(pregLater.safety.notes_zh.includes('怀孕时不安排限时进食、减重、饮酒和鱼油。'), 'remembered for the next draft')
  const ckdDir = tempDir('ckd')
  profileIn(ckdDir, { focus: ['cardio'] })
  const cardioBefore = await mod.buildPlanBrief(await contextOf(configFor(ckdDir, plain.url)), { focus: ['cardio'] })
  assert.ok(cardioBefore.candidates.some((row) => /DASH|得舒/i.test(row.intervention_zh)), 'the evidence has a DASH row to withhold')
  const ckd = await mod.buildPlanBrief(await contextOf(configFor(ckdDir, plain.url)), { focus: ['cardio'], constraints: '我有慢性肾病' })
  assert.equal(ckd.candidates.some((row) => /DASH|得舒/i.test(row.intervention_zh)), false)
  assert.ok(ckd.safety.notes_zh.some((line) => line.startsWith('肾功能不全时不安排未经调整的 DASH 饮食')))
  const egfrDir = tempDir('egfr')
  profileIn(egfrDir, { focus: ['cardio'] })
  const lowEgfr = await mod.buildPlanBrief(await contextOf(configFor(egfrDir, plain.url), (records) => ({
    ...records, indicators: [...records.indicators, { name: 'eGFR', label: '估算肾小球滤过率', value: '45', unit: 'mL/min/1.73m2', date: '2026-08-26' }],
  })), { focus: ['cardio'] })
  assert.equal(lowEgfr.candidates.some((row) => /DASH|得舒/i.test(row.intervention_zh)), false, 'an eGFR under 60 withholds DASH too')

  // --- 4. hypoglycaemia: detected, first step first, no plan in that turn --------------------------
  for (const text of ['我午饭前测了血糖 3.7，手在抖', '刚测指尖血糖3.2', '现在手抖出冷汗，血糖 3.5 mmol/L', '又低血糖了，手抖心慌']) {
    assert.equal(mod.hypoglycaemiaNow(text).now, true, text)
  }
  for (const text of ['去年血糖 2.9 住过一次院', '血糖 3.9', '空腹血糖 5.4', '低血糖怎么预防？', '我的糖化血红蛋白 7.3']) {
    assert.equal(mod.hypoglycaemiaNow(text).now, false, text)
  }
  assert.equal(mod.hypoglycaemiaNow('我妈低血糖昏迷叫不醒，血糖 2.1').unconscious, true)
  const firstAid = mod.HYPO_AWAKE_ZH
  assert.equal(firstAid, '先吃 15 克快速吸收的糖（葡萄糖片或一小杯含糖果汁），15 分钟后复测；仍低于 3.9 mmol/L 就再吃 15 克。')
  assert.equal(mod.leadsWithHypoFirstStep(`${firstAid}\n昏迷时拨打 120。`), true)
  assert.equal(mod.leadsWithHypoFirstStep('**先吃 15g 糖**（3–4 片葡萄糖片），15 分钟后复测。'), true)
  assert.equal(mod.leadsWithHypoFirstStep('这个读数偏低，建议联系医生调整用药。\n如果需要可以吃点糖，15 克左右。'.padEnd(200, '。')), false, 'a doctor line first is not the first step')
  assert.equal(mod.replyRuleCheck(`${firstAid}昏迷时不要喂东西，立即拨打 120。`).personal_dose, false, 'the 15 g step is not a dose')

  const guardDir = tempDir('guard')
  const guard = mod.createGuard({}, { dataDir: () => guardDir, timeoutMs: 50 })
  const out = await guard.preStep({ agent: fakeAgent(), messages: [userMessage('我午饭前测了血糖 3.7，手在抖')], signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [] }))
  assert.equal(out.messages.length, 1)
  assert.match(out.messages[0].content[0].text, new RegExp(`The first sentence of the reply must be 「${firstAid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}」`))
  assert.match(out.messages[0].content[0].text, /Do not draft a plan/)
  assert.match(out.messages[0].content[0].text, /eat the next meal or a snack/)
  assert.equal(mod.planDraftHeld(), true)
  const heldHost = fakeHost()
  await mod.apply(heldHost.ctx, configFor(tempDir('held'), plain.url))
  const held = await heldHost.tools.get('draft_intervention_plan').execute({})
  assert.equal(held.draft, null)
  assert.ok(held.reply_zh.startsWith(firstAid), 'a draft asked for in that turn answers with the first step')
  heldHost.dispose()
  await guard.preStep({ agent: fakeAgent(), messages: [userMessage('好了，谢谢')], signal: new AbortController().signal }, async () => ({ kind: 'enter', messages: [] }))
  assert.equal(mod.planDraftHeld(), false, 'the next message releases the hold')

  // the reply check: a reply that does not open with the step gets it sent first
  const signal = new AbortController().signal
  let run = turnAgent(1, '我午饭前测了血糖 3.7，手在抖', '血糖 3.7 偏低，建议你联系开药的医生，看看达格列净要不要调整。也可以先吃点东西。')
  await guard.turnStopping({ agent: run.agent, turn: 1, signal })
  assert.equal(run.steered.length, 1)
  assert.match(run.steered[0].content[0].text, /whose first sentence is exactly 「先吃 15 克快速吸收的糖/)
  run = turnAgent(2, '我午饭前测了血糖 3.7，手在抖', `${firstAid}\n昏迷、叫不醒或无法吞咽时不要喂东西，请立即拨打 120。\n缓过来后正常吃午饭，并把这次读数告诉开药的医生。`)
  await guard.turnStopping({ agent: run.agent, turn: 2, signal })
  assert.equal(run.steered.length, 0, 'a reply that leads with the step passes')

  // --- 5. exclusions the person states hold for every later draft ----------------------------------
  const exDir = tempDir('exclusions')
  profileIn(exDir, { focus: ['weight', 'cardio'] })
  const exHost = fakeHost()
  await mod.apply(exHost.ctx, configFor(exDir, plain.url))
  const before = await exHost.tools.get('draft_intervention_plan').execute({ focus: ['weight', 'cardio'], max_items: 5 })
  assert.ok(before.brief.candidates.some((row) => TRE.test(row.intervention_zh)), 'the evidence has a time-restricted eating row to exclude')
  const first = await exHost.tools.get('draft_intervention_plan').execute({ focus: ['weight', 'cardio'], max_items: 5, constraints: '我不要限时进食' })
  assert.equal(first.brief.candidates.some((row) => TRE.test(row.intervention_zh)), false)
  assert.ok(first.draft.items.every((item) => !TRE.test(`${item.title} ${item.detail}`)))
  assert.deepEqual(first.brief.excluded_phrases, ['限时进食'])
  const later = await exHost.tools.get('draft_intervention_plan').execute({ focus: ['weight', 'cardio'], max_items: 5 })
  assert.equal(later.brief.candidates.some((row) => TRE.test(row.intervention_zh)), false, 'a later draft without the constraint keeps it out')
  const page = (await call(exHost, 'GET', '/api/longpi/plan-draft')).json()
  assert.ok(page.draft.items.every((item) => !TRE.test(`${item.title} ${item.detail}`)), 'the page draft too')
  exHost.dispose()
  // said in chat without the model passing it on: the guard remembers it
  const chatDir = tempDir('chat-exclusion')
  await mod.createGuard({}, { dataDir: () => chatDir, timeoutMs: 50 }).preStep({ agent: fakeAgent(), messages: [userMessage('说过很多次了，不要限时进食')], signal }, async () => ({ kind: 'enter', messages: [] }))
  assert.deepEqual(mod.readPlanPrefs(chatDir).excluded_phrases, ['限时进食'])
  // the draft keeps its date on a new day while the record is the same
  const draftedOn = later.draft.title.match(/\d{4}-\d{2}-\d{2}/)[0]
  const dated = mod.settleDraft(exDir, later.brief, '2099-01-01', { maxItems: 5 })
  assert.ok(dated.title.includes(draftedOn), 'a new day alone does not retitle the draft')

  // --- 6. medicines the person states, and the summary ------------------------------------------------
  assert.equal(mod.fixScheduleText('10 mg 0x/day'), '10 mg，每天 1 次')
  assert.equal(mod.fixScheduleText('0.5 g 3x/day'), '0.5 g 每天 3 次')
  const presented = mod.presentMedications([
    { name: '二甲双胍片', status: 'stopped', recorded_dose: '0.5g', schedule: '0.5g 2x/day', since: '2019-05-20', until: '2020-04-08' },
    { name: '二甲双胍缓释片', status: 'active', recorded_dose: '0.5g', schedule: '0.5g 3x/day', since: '2020-04-08' },
    { name: '达格列净片', status: 'active', recorded_dose: '10mg', schedule: '10 mg 0x/day', since: '2023-08-14' },
  ])
  assert.deepEqual(presented.lines, ['当前：二甲双胍缓释片 0.5g 每天 3 次，2020-04-08 起', '较早：二甲双胍片 0.5g 每天 2 次，2019-05-20 起至 2020-04-08', '当前：达格列净片 10 mg，每天 1 次，2023-08-14 起'])
  assert.ok(presented.lines.every((line) => !/0x\/day/.test(line)))
  assert.equal(mod.isMedicationRecordRequest('请记一下：医生把达格列净改成每天早上 10 mg'), true)
  assert.equal(mod.isMedicationRecordRequest('帮我记录今天的打卡：鱼油吃了，快走40分钟'), false)
  const medDir = tempDir('meds')
  const medHost = fakeHost()
  await mod.apply(medHost.ctx, configFor(medDir, plain.url))
  const recorded = await medHost.tools.get('record_medication_statement').execute({ name: '达格列净片', dose_text: '10 mg', frequency_text: '每天早上一次', since: '2026-07-20' })
  assert.equal(recorded.read_back, '你记下的：达格列净片 10 mg 每天早上一次，2026-07-20 起')
  assert.equal(mod.readStatements(medDir)[0].name, '达格列净片')
  medHost.dispose()

  console.log(`plan-safety ok (doctor-first: ${stop.hits.map((hit) => hit.key).join('/')}; SGLT2 ${sglt2Brief.candidates.length} candidates without TRE; hypo first step enforced; exclusions persist)`)
} finally {
  for (const server of servers) await server.close?.()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
