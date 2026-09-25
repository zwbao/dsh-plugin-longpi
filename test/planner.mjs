// Plan drafting: priorities from the skills' own levers and the person's focus,
// evidence rows as candidates (never a drug; supplements only with a doctor's
// confirmation and no dose), the medication screen, the deterministic draft and
// its goals, and the accept route that saves a new plan version. Uses the fake
// Mirobody record and the real longevity-skills checkout; skips without it.

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
  console.log('planner skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
// An amount taken; a concentration such as 42.6 mg/dL is a trial result, not a dose.
const DOSE = /\d+(?:\.\d+)?\s*(?:mg|mcg|µg|iu|g|ml|毫克|微克|克|粒|片|颗|滴)(?!\s*\/\s*(?:d?l|ml)\b)/i
const catalog = mod.loadCatalog(home)
const reference = mod.loadReference(home)
const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-planner-${name}-`))
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
  mod.writeProfile(dataDir, { age: 53, sex: 'male', risk: FACTS, focus: ['bioage', 'cardio'], consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() }, ...extra })
}

async function contextOf(config, patch = (records) => records) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = patch(await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin'))
  return { config, dataDir: config.dataDir, skillsHome: home, catalog, records, today: TODAY, mount: MOUNT }
}

try {
  const full = await startFakeMirobody()
  servers.push(full)

  // --- 1. the brief: priorities only from the skills' levers and the focus ----------
  const dir = tempDir('brief')
  profileIn(dir)
  const context = await contextOf(configFor(dir, full.url))
  const tracking = await mod.buildTracking(context)
  const brief = await mod.buildPlanBrief(context)
  assert.equal(brief.today, TODAY)
  assert.deepEqual(brief.focus, ['bioage', 'cardio'])
  assert.ok(brief.priorities.length > 0)
  const leverKeys = (model) => (tracking.models.find((card) => card.model === model)?.sensitivity ?? []).map((row) => row.key).filter(Boolean)
  for (const row of brief.priorities) {
    if (row.source === 'phenoage_levers') assert.ok(leverKeys('phenoage').includes(row.marker_key), `${row.marker_key} is a PhenoAge lever`)
    else if (row.source === 'china_par_levers') assert.ok(leverKeys('china-par').includes(row.marker_key), `${row.marker_key} is a China-PAR lever`)
    else assert.ok(['sbp', 'ldl', 'hdl', 'tg'].includes(row.marker_key), `${row.marker_key} comes from the cardio focus`)
    assert.ok(row.why_zh.length > 0)
    assert.doesNotMatch(row.why_zh, /偏高|过高|超标|high/i, 'no value is called high')
  }
  assert.equal(brief.priorities[0].source, 'phenoage_levers', 'the first focus (bioage) comes first')
  assert.match(brief.priorities[0].why_zh, /^你最关心身体年龄；/)
  assert.ok(leverKeys('china-par').length > 0, 'China-PAR sensitivity carries marker keys')
  assert.ok(leverKeys('china-par').includes('waist'), 'waist is keyed although it has no variation row')
  const sbp = brief.priorities.find((row) => row.marker_key === 'sbp')
  assert.deepEqual([sbp.label_zh, sbp.value, sbp.unit, sbp.date], ['收缩压', 126, 'mmHg', '2026-09-20'], 'the latest value on record')
  const waist = brief.priorities.find((row) => row.marker_key === 'waist')
  assert.deepEqual([waist.value, waist.unit, waist.date], [88, 'cm', '2026-08-26'])
  assert.ok(brief.metrics.includes('dailySteps'))

  // --- 2. candidates: evidence rows for those markers, never a drug ------------------
  assert.ok(brief.candidates.length > 0)
  const drugs = reference.effects.filter((row) => row.category === 'drug').map((row) => row.id)
  assert.ok(drugs.length > 0, 'the evidence table has drug rows to exclude')
  for (const row of brief.candidates) {
    assert.notEqual(row.category, 'drug')
    assert.ok(!drugs.includes(row.id))
    assert.ok(brief.priorities.some((p) => p.marker_key === row.marker_key || (row.marker_key === 'weight' && p.marker_key === 'waist')), `${row.id} serves a priority`)
    assert.ok(row.doi && row.population && row.expected_zh.startsWith('试验中'))
    if (row.category === 'supplement') {
      assert.equal(row.needs_doctor, true, 'a supplement always needs a doctor')
      assert.equal(row.note_zh, undefined, 'a supplement note (study doses) is left out')
      assert.doesNotMatch(row.expected_zh, DOSE)
    }
  }
  assert.ok(brief.candidates.some((row) => row.marker_key === 'weight'), 'weight rows serve the waist priority')
  assert.equal(brief.candidates.some((row) => /戒烟/.test(row.intervention_zh)), false, 'no smoking cessation for a non-smoker')
  assert.ok(brief.notes_zh.includes('你说过不吸烟，所以没有列出戒烟。'))
  const aerobic = brief.candidates.find((row) => row.id === 'aerobic-sbp')
  assert.equal(aerobic.expected_zh, '试验中平均使收缩压下降 3.5 mmHg（18 岁以上健康成人，荟萃分析）')
  // sorted by priority rank, then verified, then the size of the effect
  const sbpRows = brief.candidates.filter((row) => row.marker_key === 'sbp' && row.effect_in_record_unit != null)
  assert.deepEqual(sbpRows.map((row) => Math.abs(row.effect_in_record_unit)), sbpRows.map((row) => Math.abs(row.effect_in_record_unit)).sort((a, b) => b - a))

  // the medication screen: the fixture plan has fish oil and vitamin D
  assert.deepEqual(brief.safety.medications, ['鱼油(Omega-3)', '维生素D3'])
  assert.ok(brief.safety.notes_zh.some((line) => line.includes('并不完整')), 'the screen says it is not exhaustive')
  for (const row of brief.candidates) {
    if (row.category === 'diet' || row.category === 'supplement') assert.ok(row.cautions_zh.includes('你正在服药，开始前先与医生确认'), row.id)
    if (row.cautions_zh.length > 0) assert.equal(row.needs_doctor, true)
  }
  const fish = brief.candidates.find((row) => row.id === 'omega3-2g-tg')
  assert.ok(fish.cautions_zh.includes('你的用药计划里已经有「鱼油(Omega-3)」'))

  const screened = await mod.buildPlanBrief(await contextOf(configFor(dir, full.url), (records) => ({
    ...records,
    profile: { ...records.profile, risk: { ...records.profile.risk, diabetes: true } },
    medications: [{ name: '氨氯地平片', status: 'active', recorded_dose: '5 mg' }, { name: '阿司匹林肠溶片', status: 'active', recorded_dose: '100 mg' }],
  })), { focus: ['cardio', 'weight'] })
  const by = (id) => screened.candidates.find((row) => row.id === id)
  assert.ok(by('aerobic-sbp').cautions_zh.includes('血压用药期间，运动强度先与医生确认'))
  assert.ok(by('tre-weight').cautions_zh.includes('有低血糖风险，先与医生确认'))
  assert.ok(by('omega3-2g-tg').cautions_zh.includes('可能增加出血风险，先与医生确认'))
  assert.equal(by('aerobic-sbp').needs_doctor, true)

  // --- 3. the draft --------------------------------------------------------------
  const draft = mod.draftPlan(brief, { today: TODAY })
  assert.ok(draft, 'there is something evidence-backed to propose')
  assert.ok(draft.items.length >= 1 && draft.items.length <= 3)
  assert.ok(draft.items.filter((item) => item.category === 'supplement').length <= 1)
  assert.equal(new Set(draft.items.map((item) => item.title)).size, draft.items.length, 'one item per intervention')
  assert.equal(draft.items.some((item) => item.id === 'omega3-2g-tg'), false, 'a supplement already on the plan is not proposed again')
  for (const item of draft.items) {
    assert.ok(mod.DRAFT_CATEGORIES.includes(item.category))
    assert.equal(item.start, TODAY)
    assert.equal(item.evidence.effect_id, item.id)
    assert.ok(item.detail.endsWith('个人效果因人而异。'), 'the detail ends with the evidence line')
    assert.ok(item.detail.includes(item.evidence.doi))
    assert.ok([...item.detail].length <= 300)
    assert.ok(item.markers.length > 0)
    assert.equal(item.target, null, 'no evidence row gives a step or sleep number, so no target is made up')
    assert.ok(typeof item.category_zh === 'string' && item.category_zh)
  }
  const saltGoal = draft.goals.find((goal) => goal.marker === '收缩压')
  assert.deepEqual(saltGoal, { marker: '收缩压', value: 121.8, unit: 'mmHg', basis_zh: '按试验平均效应估算，不是个人预测（减盐：−4.18 mmHg）' }, '126 − 4.18')
  for (const goal of draft.goals) assert.ok(goal.basis_zh.startsWith('按试验平均效应估算，不是个人预测'))
  assert.ok(draft.notes_zh.includes('LongPi 不开始、不停止、也不调整任何处方药。'))
  const normalized = mod.normalizePlan({ title: draft.title, items: draft.items, goals: draft.goals }, { today: TODAY, medications: [], previous: null })
  assert.deepEqual(normalized.errors, [], 'the draft items pass normalizePlan')
  assert.equal(mod.draftPlan(brief, { today: TODAY, maxItems: 1 }).items.length, 1)
  assert.deepEqual(mod.draftPlan(brief, { today: TODAY }), draft, 'deterministic')
  assert.equal(mod.currentPlan(dir), null, 'drafting saves nothing')

  // a record with no medication plan: a supplement may be drafted, as an option with no dose
  const bare = loadRecord()
  const noMeds = await startFakeMirobody({ record: { ...bare, medications: { plans: [], log: [], history: [] } } })
  servers.push(noMeds)
  const cardioDir = tempDir('cardio')
  profileIn(cardioDir, { focus: ['cardio'] })
  const cardioBrief = await mod.buildPlanBrief(await contextOf(configFor(cardioDir, noMeds.url)))
  const cardioDraft = mod.draftPlan(cardioBrief, { today: TODAY })
  const supplement = cardioDraft.items.find((item) => item.category === 'supplement')
  assert.ok(supplement, JSON.stringify(cardioDraft.items.map((item) => item.title)))
  assert.equal(supplement.needs_doctor, true)
  assert.ok(supplement.detail.startsWith('可选：需先与医生确认；不给剂量。'))
  assert.doesNotMatch(supplement.detail, DOSE, 'no dose in a supplement item')
  assert.equal(cardioDraft.items.filter((item) => item.category === 'supplement').length, 1)
  assert.ok(cardioDraft.notes_zh.includes('补剂只是可选项：需先与医生确认，不给剂量。'))
  const tgGoal = cardioDraft.goals.find((goal) => goal.marker === '甘油三酯')
  // 1.2 mmol/L − 42.61 mg/dL × 0.01129 (the table's factor) = 0.72 mmol/L
  assert.deepEqual([tgGoal.value, tgGoal.unit], [0.72, 'mmol/L'], 'converted with the biological-variation table factor')
  const cardioSaved = mod.normalizePlan({ items: cardioDraft.items }, { today: TODAY, medications: [], previous: null })
  assert.deepEqual(cardioSaved.errors, [])
  assert.equal(cardioSaved.warnings.some((line) => line.includes('剂量没有保存')), false, 'no dose to strip')
  assert.equal(cardioSaved.plan.items.find((item) => item.category === 'supplement').detail, supplement.detail, 'the evidence line (a concentration) survives saving')
  assert.doesNotMatch(mod.normalizePlan({ items: [{ category: 'supplement', title: '鱼油', detail: '每天 2 g，饭后', start: TODAY }] }, { today: TODAY, medications: [], previous: null }).plan.items[0].detail, /2\s*g/, 'a real dose is still stripped')

  // asked markers come first; sleep has no evidence yet and says so
  const asked = await mod.buildPlanBrief(await contextOf(configFor(cardioDir, noMeds.url)), { markers: ['LDL-C', '谷丙转氨酶'], focus: ['sleep'] })
  assert.deepEqual([asked.priorities[0].marker_key, asked.priorities[0].source, asked.priorities[0].why_zh], ['ldl', 'focus', '你指定要改善的指标'])
  assert.ok(asked.notes_zh.some((line) => line.includes('谷丙转氨酶')))
  assert.ok(asked.notes_zh.some((line) => line.startsWith('睡眠：')))

  // nothing to propose: no record and no focus
  const emptyDir = tempDir('empty')
  profileIn(emptyDir, { focus: [] })
  const emptyBrief = await mod.buildPlanBrief(await contextOf(configFor(emptyDir)))
  assert.deepEqual(emptyBrief.priorities, [])
  assert.equal(mod.draftPlan(emptyBrief, { today: TODAY }), null)
  assert.match(emptyBrief.boundary_zh, /不开始、不停止、也不调整任何处方药/)

  // --- 4. tool and routes -------------------------------------------------------------
  const routeDir = tempDir('routes')
  profileIn(routeDir)
  const host = fakeHost()
  await mod.apply(host.ctx, configFor(routeDir, full.url))
  assert.ok(host.tools.has('draft_intervention_plan'))
  const tool = await host.tools.get('draft_intervention_plan').execute({ max_items: 2, constraints: '膝盖不好' })
  assert.ok(tool.brief.priorities.length > 0)
  assert.ok(tool.draft.items.length <= 2)
  assert.equal(tool.constraints, '膝盖不好')
  assert.match(tool.how_to_use, /save_intervention_plan confirm=false/)
  assert.match(tool.how_to_use, /Never start, stop or change a prescription medicine/)
  let res = await call(host, 'GET', '/api/longpi/plan-draft')
  assert.equal(res.status, 200, res.text)
  const got = res.json()
  assert.ok(got.brief && got.draft)
  assert.equal(mod.currentPlan(routeDir), null, 'GET saves nothing')

  res = await call(host, 'POST', '/api/longpi/plan-draft/accept', { draft: { ...got.draft, items: [{ ...got.draft.items[0], id: 'semaglutide-hiv-phenoage', category: 'drug', title: '司美格鲁肽' }] } })
  assert.equal(res.status, 400)
  assert.equal(res.json().ok, false)
  assert.ok(res.json().problems.some((line) => line.includes('药物')))
  res = await call(host, 'POST', '/api/longpi/plan-draft/accept', { draft: { ...got.draft, items: [{ ...got.draft.items[0], id: 'made-up' }] } })
  assert.equal(res.status, 400, 'an item that is not in the evidence is refused')
  res = await call(host, 'POST', '/api/longpi/plan-draft/accept', { nothing: true })
  assert.equal(res.status, 400)
  assert.equal(mod.currentPlan(routeDir), null)

  // the person removed one item and kept one goal; a tampered detail and goal value are replaced by the evidence's
  const kept = got.draft.items.slice(0, -1)
  const tampered = kept.map((item, index) => (index === 0 ? { ...item, detail: '每天 2 片', markers: ['白蛋白'] } : item))
  const keptGoal = got.draft.goals.filter((goal) => kept.some((item) => item.markers.includes(goal.marker))).slice(0, 1).map((goal) => ({ ...goal, value: 1 }))
  res = await call(host, 'POST', '/api/longpi/plan-draft/accept', { draft: { ...got.draft, items: tampered, goals: keptGoal } })
  assert.equal(res.status, 200, res.text)
  assert.deepEqual(res.json(), { ok: true, plan: { version: 1, title: got.draft.title, items: kept.length } })
  const saved = mod.currentPlan(routeDir)
  assert.equal(saved.version, 1)
  assert.equal(saved.source, 'board')
  assert.deepEqual(saved.items.map((item) => item.title), kept.map((item) => item.title))
  assert.equal(saved.items[0].detail, kept[0].detail, 'the detail is the evidence one')
  assert.deepEqual(saved.items[0].markers, kept[0].markers)
  assert.deepEqual(saved.goals, keptGoal.map((goal) => ({ marker: goal.marker, value: got.draft.goals.find((row) => row.marker === goal.marker).value, unit: goal.unit })))
  res = await call(host, 'GET', '/api/longpi/journey')
  assert.equal(res.json().stage, 'routine', 'tracking was invalidated')
  res = await call(host, 'POST', '/api/longpi/plan-draft/accept', { draft: got.draft })
  assert.equal(res.json().plan.version, 2, 'accepting again is a new version')
  const twice = mod.acceptedPlan(tool.brief, { items: [got.draft.items[0], { ...got.draft.items[0] }] }, TODAY)
  assert.equal(twice.ok, true)
  assert.equal(twice.plan.items.length, 1, 'one item per intervention')
  assert.deepEqual(mod.acceptedPlan(tool.brief, { items: [] }, TODAY).ok, false)

  console.log(`planner ok (${brief.priorities.length} priorities, ${brief.candidates.length} candidates, draft: ${draft.items.map((item) => item.title).join('、')})`)
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
