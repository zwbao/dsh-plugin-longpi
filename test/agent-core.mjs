// 0.5.3 agent core (AA step 1) and M1: memory, bus, the fact-ranked floor, page–chat snapshot, persona
// scoping, the doctor brief and the visit follow-up; plus the 0.5.2 fold-ins (sex unknown, per-session
// hold, BP and alcohol suitability, the page's 去掉 saved on the server). Fake Mirobody + the real
// longevity-skills checkout; skips without it.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { Readable } from 'node:stream'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { loadRecord, startFakeMirobody } from './fake-mirobody.mjs'
import { skillsHome } from './lib/skills-home.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const home = skillsHome('data/effects.jsonl')
if (!home) {
  console.log('agent-core skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const catalog = mod.loadCatalog(home)
const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-core-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '', bootstrapWorkspace: false,
  }
}

function profileIn(dataDir, extra = {}) {
  mod.writeProfile(dataDir, { age: 30, sex: 'male', risk: FACTS, focus: ['bioage', 'cardio', 'weight'], consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() }, ...extra })
}

async function contextOf(config) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin')
  return { config, dataDir: config.dataDir, skillsHome: home, catalog, records, today: TODAY, mount: MOUNT }
}

function lab(indicator, name, code, unit, date, value) {
  return { indicator, name, system: 'loinc', code, unit, date, time: `${date} 08:30:00`, value: String(value), file: `${date} 体检报告.pdf` }
}

const DATES = ['2025-10-18', '2026-01-20', '2026-04-22', '2026-08-26']

/** The owner's course (FINDINGS 3/45) on the fixture's checkup days: HGB 152 → 116, MCV 88 → 66, RDW 18.5, ferritin 8.0. */
function ownerRecord() {
  const record = loadRecord()
  const mcv = { '2025-10-18': '88.0', '2026-01-20': '79.0', '2026-04-22': '68.0', '2026-08-26': '66.0' }
  const rdw = { '2025-10-18': '13', '2026-01-20': '15', '2026-04-22': '18', '2026-08-26': '18.5' }
  const observations = record.observations.map((row) => {
    if (row.indicator === 'Mean Corpuscular Volume-MCV' && mcv[row.date]) return { ...row, value: mcv[row.date] }
    if (row.indicator === 'Red Cell Distribution Width-RDW-CV' && rdw[row.date]) return { ...row, value: rdw[row.date] }
    return row
  })
  const hgb = [152, 138, 124, 116]
  DATES.forEach((date, index) => observations.push(lab('Hemoglobin-HGB', '血红蛋白', '718-7', 'g/L', date, hgb[index])))
  observations.push(lab('Ferritin-FER', '铁蛋白', '2276-4', 'ng/mL', '2026-08-26', '8.0'))
  return { ...record, observations }
}

/** A woman's normal record whose values sit between the women's and men's limits (p27: HGB 128, ferritin 24). */
function borderlineRecord() {
  const record = loadRecord()
  const observations = [...record.observations]
  observations.push(lab('Hemoglobin-HGB', '血红蛋白', '718-7', 'g/L', '2026-08-26', 128))
  observations.push(lab('Ferritin-FER', '铁蛋白', '2276-4', 'ng/mL', '2026-08-26', '24'))
  return { ...record, observations }
}

function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const listeners = {}
  const disposers = []
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    inject: (_names, callback) => callback(ctx),
    on: (name, listener) => { (listeners[name] ??= []).push(listener); return () => {} },
    effect: (execute) => { const dispose = execute(); disposers.push(dispose); return dispose },
  }
  return { ctx, tools, routes, listeners, dispose: () => disposers.splice(0).forEach((fn) => typeof fn === 'function' && fn()) }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolveCall) => {
    const headers = {}
    const res = {
      statusCode: 200, writableEnded: false,
      setHeader: (key, value) => { headers[key.toLowerCase()] = value },
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, text: raw, headers, json: () => JSON.parse(raw) })
      },
    }
    handler(req, res)
  })
}

function userMessage(text) {
  return Object.freeze({ id: `u-${Math.random().toString(36).slice(2)}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } })
}

try {
  // --- 1. memory: rule-table safety, digest, migration, events -------------------------------------
  const memDir = tempDir('memory')
  const bus = mod.createBus({ dataDir: () => memDir })
  mod.setBus(bus)
  const seen = []
  bus.on('*', (event) => { seen.push(event.type) }, 'test')
  const memory = mod.createMemory(() => memDir)
  const prov = { kind: 'chat', at: NOW.toISOString(), by: 'M0', quote_zh: '我在吃达格列净' }
  const added = memory.apply([
    { op: 'add', item: { kind: 'medication', name_zh: '达格列净', drug_class: [], source_rx: 'doctor', text_zh: '达格列净 10mg 每天 1 次', confirmed: true, provenance: prov } },
    { op: 'add', item: { kind: 'exclusion', scope: 'plan_item', match: { phrases_zh: ['限时进食'] }, text_zh: '不要限时进食', confirmed: true, provenance: prov } },
    { op: 'add', item: { kind: 'goal', text_zh: '体重 75 公斤，脂肪肝好转', confirmed: false, provenance: { ...prov, kind: 'model_extracted' } } },
    { op: 'add', item: { kind: 'condition', name_zh: '脂肪肝', flags: [], state: 'current', text_zh: '脂肪肝', confirmed: true, provenance: prov } },
  ], 'M0')
  assert.equal(added.applied.length, 4)
  assert.equal(added.rev, 1)
  const med = memory.active('medication')[0]
  assert.deepEqual(med.drug_class, ['sglt2i'], 'the class comes from the rule table')
  assert.equal(med.safety_relevant, true)
  assert.deepEqual(memory.active('condition')[0].flags, ['nafld'])
  assert.equal(memory.active('condition')[0].safety_relevant, false)
  assert.deepEqual(memory.safetyFlags().drug_classes, ['sglt2i'])
  const digest = memory.digest({ purpose: 'chat' })
  assert.ok(digest.indexOf('用药安全') < digest.indexOf('不要') && digest.indexOf('不要') < digest.indexOf('目标'), `digest order: ${digest}`)
  assert.match(digest, /目标：体重 75 公斤，脂肪肝好转（未确认）/)
  assert.equal(memory.apply([{ op: 'add', item: { kind: 'exclusion', scope: 'plan_item', match: { phrases_zh: ['限时进食'] }, text_zh: '不要限时进食', confirmed: true, provenance: prov } }], 'M0').rev, 1, 'the same item said again changes nothing')
  const goalId = memory.active('goal')[0].id
  memory.apply([{ op: 'confirm', id: goalId, provenance: prov }], 'M0')
  assert.equal(memory.active('goal')[0].confirmed, true)
  memory.apply([{ op: 'retract', id: goalId, provenance: prov }], 'M0')
  assert.equal(memory.active('goal').length, 0, 'retracted items leave the active set')
  assert.equal(memory.read().items.find((item) => item.id === goalId).status, 'retracted', 'nothing is deleted')
  assert.equal(readFileSync(join(memDir, 'memory_log.jsonl'), 'utf8').trim().split('\n').length, 6)
  assert.ok(seen.filter((type) => type === 'memory.changed').length >= 3, 'memory.changed on the bus')
  assert.ok(readFileSync(join(memDir, 'events.jsonl'), 'utf8').includes('"memory.changed"'), 'events are durable')
  // a durable subscriber replays what it missed
  const replayed = []
  bus.on(['memory.changed'], (event) => { replayed.push(event.id) }, 'late', { durable: true })
  assert.ok(replayed.length >= 3, 'durable replay')
  const again = []
  bus.on(['memory.changed'], (event) => { again.push(event.id) }, 'late', { durable: true })
  assert.equal(again.length, 0, 'the cursor moved past what was replayed')

  // migration from Z's plan_prefs.json and the medication statements, once
  const legacyDir = tempDir('legacy')
  mod.writeJsonAtomic(join(legacyDir, 'plan_prefs.json'), { excluded_ids: ['tre-weight'], excluded_phrases: ['低碳'], pregnant: true, ckd: null })
  mod.appendJsonl(join(legacyDir, 'medication_statements.jsonl'), { name: '二甲双胍缓释片', dose_text: '0.5g', frequency_text: '每日 3 次', since: '2025-01-01', at: '2026-09-01T10:00:00Z' })
  const legacy = mod.memoryFor(legacyDir)
  assert.deepEqual(legacy.active('exclusion').flatMap((item) => [...item.match.phrases_zh, ...(item.match.item_ids ?? [])]).sort(), ['tre-weight', '低碳'])
  assert.equal(legacy.active('condition')[0].flags[0], 'pregnancy')
  assert.equal(legacy.active('medication')[0].regimen_text, '0.5g 每日 3 次')
  assert.deepEqual(legacy.active('medication')[0].drug_class, ['metformin'])
  const rev = legacy.read().rev
  mod.memoryFor(legacyDir)
  assert.equal(mod.memoryFor(legacyDir).read().rev, rev, 'imported once')
  assert.ok(mod.readPlanPrefs(legacyDir).excluded_phrases.includes('低碳'))

  // --- 2. sex unknown: ask before a sex-specific referral; do not apply the men's limit ----------
  const point = (name, value, unit, date) => ({ name, value, unit, date })
  const hb125 = [point('血红蛋白', 125, 'g/L', '2026-08-26')]
  const unknown = mod.clinicalStop({ sex: 'unknown', diabetesKnown: false, points: hb125 })
  assert.equal(unknown.stop, false, 'HGB 125 is normal for a woman, so unknown sex asks instead of referring')
  assert.equal(unknown.needs_sex, true)
  assert.match(unknown.sentence_zh, /填写性别/)
  assert.doesNotMatch(unknown.sentence_zh, /男性下限|血液科/)
  assert.equal(mod.clinicalStop({ sex: 'female', diabetesKnown: false, points: hb125 }).stop, false, 'a woman with 125 is not stopped')
  const male = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: hb125 })
  assert.equal(male.stop, true)
  assert.equal(male.needs_sex, undefined, 'the sex is known')
  const either = mod.clinicalStop({ sex: 'unknown', diabetesKnown: false, points: [point('血红蛋白', 112, 'g/L', '2026-08-26')] })
  assert.equal(either.stop, true, 'below both limits still needs a doctor')
  assert.equal(either.needs_sex, undefined, 'low for either sex: the sex does not decide it')
  assert.doesNotMatch(either.sentence_zh, /暂按男性下限|尚无性别/)
  const ferr = mod.clinicalStop({ sex: 'unknown', diabetesKnown: false, points: [point('铁蛋白', 24, 'ng/mL', '2026-08-26')] })
  assert.equal(ferr.stop, false)
  assert.equal(ferr.needs_sex, true)

  const border = await startFakeMirobody({ record: borderlineRecord() })
  servers.push(border)
  const nosexDir = tempDir('nosex')
  profileIn(nosexDir, { sex: 'unknown' })
  const nosex = await mod.buildJourney(await contextOf(configFor(nosexDir, border.url)))
  assert.equal(nosex.stage, 'profile', 'the profile still asks for sex')
  assert.notEqual(nosex.next.action, 'doctor', 'a between-limit haemoglobin is not a haematology referral')
  assert.equal(nosex.triage.needs_sex, true)
  assert.match(`${nosex.next.title_zh}${nosex.next.detail_zh}`, /性别/)
  assert.doesNotMatch(`${nosex.next.title_zh}${nosex.next.detail_zh}`, /血液科|男性下限/)
  const femaleDir = tempDir('female')
  profileIn(femaleDir, { sex: 'female' })
  const female = await mod.buildJourney(await contextOf(configFor(femaleDir, border.url)))
  assert.notEqual(female.next.action, 'doctor', 'with the sex filled in, 128 and 24 are fine for a woman')
  assert.equal(female.doctor_first.stop, false)

  // --- 3. the fact-ranked floor, day 0: the red-cell trend and the doctor step before any plan ----------
  const owner = await startFakeMirobody({ record: ownerRecord() })
  servers.push(owner)
  const ownerDir = tempDir('owner')
  profileIn(ownerDir)
  const ownerConfig = configFor(ownerDir, owner.url)
  const journey = await mod.buildJourney(await contextOf(ownerConfig))
  const top = journey.triage.top_facts[0]
  assert.equal(top.kind, 'triage')
  assert.equal(top.priority, 'must_surface')
  assert.equal(top.id, 'finding-red-cell')
  assert.match(top.text_zh, /血红蛋白 (?:152→)?138→124→116 g\/L 偏低/, `the trend: ${top.text_zh}`)
  assert.match(top.text_zh, /铁蛋白 8 ng\/mL 偏低/)
  assert.match(top.text_zh, /请先去看医生（全科或血液科）/)
  const { surfaces } = journey
  assert.deepEqual(surfaces.status.fact_ids, ['finding-red-cell'], 'the status card carries the top fact')
  assert.equal(surfaces.status.text_zh, top.text_zh)
  assert.equal(surfaces.next.action.kind, 'see_doctor')
  assert.equal(surfaces.next.action.mandatory, true)
  assert.ok(surfaces.next.card.fact_ids.includes('finding-red-cell'), 'the next step carries it too')
  assert.equal(journey.next.action, 'doctor')
  assert.match(journey.next.title_zh, /^请先去看医生：血红蛋白 116 g\/L 偏低/)
  assert.match(journey.next.detail_zh, /铁蛋白 8 ng\/mL（(2026 年 )?8 月 26 日）偏低，低于男性常用参考下限 30/, 'ferritin is named low')
  assert.ok(!surfaces.more.some((row) => row.kind === 'draft_plan'), 'no plan step while a doctor comes first')
  assert.deepEqual(journey.suggestions.map((row) => row.id).slice(0, 2), ['doctor-first', 'prepare-brief'], 'the brief is offered beside the doctor step')
  assert.ok(!journey.suggestions.some((row) => row.id === 'draft-plan'))
  // a value below the usual range is named low on the changes card too (M1), never "cannot judge"
  assert.equal(mod.rangeFlag('hb', 116, 'male').flag, 'low')
  assert.match(mod.rangeFlag('hb', 116, 'male').text_zh, /低于男性常用参考下限 130，偏低/)
  assert.equal(mod.rangeFlag('hb', 125, 'female'), null)
  assert.equal(mod.rangeFlag('mcv', 90, 'male'), null)
  const hbRow = journey.changes.find((row) => row.key === 'hb')
  if (hbRow) {
    assert.equal(hbRow.range_flag, 'low')
    assert.match(hbRow.advice_zh, /偏低/)
  }
  assert.ok(!journey.triage.top_facts.some((row) => /红细胞压积|平均红细胞血红蛋白浓度/.test(row.text_zh) && row.id !== 'finding-red-cell'), 'red-cell indices join the red-cell fact')
  // respects top fact: status or next references top_facts[0] whenever it is must_surface
  assert.ok(surfaces.status.fact_ids.includes(top.id) || surfaces.next.card.fact_ids.includes(top.id))
  const page = mod.readPageState(ownerDir)
  assert.equal(page.next.kind, 'see_doctor')
  assert.equal(page.top_facts[0].id, 'finding-red-cell')
  const log = readFileSync(join(ownerDir, 'surfaces_log.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(log.at(-1).next.kind, 'see_doctor')
  assert.equal(log.at(-1).top_fact.id, 'finding-red-cell')
  assert.equal(JSON.parse(readFileSync(join(ownerDir, 'surfaces.json'), 'utf8')).inputs_fp, surfaces.inputs_fp)
  // the chat reads the same state: snapshot text
  const snap = mod.snapshotText({ page, memory_zh: '', care_due_zh: '' })
  assert.match(snap, /最重要的事（必须先说）：血红蛋白/)
  assert.match(snap, /下一步：请先去看医生/)
  const medSnap = mod.snapshotText({ page: { ...page, top_facts: [{ id: 'safety-sglt2i', kind: 'safety_med', priority: 'must_surface', text_zh: '你在用达格列净（SGLT2 抑制剂）：方案不安排限时进食' }] }, memory_zh: '', care_due_zh: '' })
  assert.doesNotMatch(medSnap, /必须先说/, 'a medicine fact is context, not an opener for every reply')
  assert.match(medSnap, /用药和身体状况（谈到饮食、补剂、运动、方案或这个药时必须考虑；不必每次开头都说）：你在用达格列净/)
  assert.match(mod.orchestratorPrompt(MOUNT), /Write only Chinese to the person/)

  // --- 4. through the plugin: persona scope, snapshot at step 1, tools and routes ------------------------
  const host = fakeHost()
  await mod.apply(host.ctx, ownerConfig)
  for (const name of ['read_person_memory', 'remember_for_me', 'note_page_issue', 'read_care_navigation', 'prepare_doctor_brief', 'log_care_visit']) assert.ok(host.tools.has(name), name)
  const situation = await host.tools.get('read_personal_situation').execute({})
  assert.equal(situation.top_facts[0].id, 'finding-red-cell', 'read_personal_situation carries the same top fact')
  assert.equal(situation.page.next.kind, 'see_doctor')
  assert.equal(situation.page.status_zh, top.text_zh, 'page and chat read one state')
  // persona only for agents in a health workspace; write tools hidden elsewhere
  const workspace = join(ownerDir, 'workspace')
  mod.writeJsonAtomic(join(ownerDir, 'workspace-bootstrap.json'), { path: workspace, created: true })
  const sections = []
  const restricted = []
  const healthAgent = { session: { id: 'health-1', header: { cwd: workspace } }, ctx: { systemPrompt: { section: (row) => sections.push(row) }, tools: { restrict: (filter) => restricted.push(['health', filter]) } } }
  const codingAgent = { session: { id: 'code-1', header: { cwd: '/tmp/some-project' } }, ctx: { systemPrompt: { section: (row) => sections.push(row) }, tools: { restrict: (filter) => restricted.push(['code', filter]) } } }
  for (const listener of host.listeners['agent/created'] ?? []) {
    listener({ agent: healthAgent })
    listener({ agent: codingAgent })
  }
  assert.equal(sections.length, 1, 'one section, for the health agent only')
  assert.equal(sections[0].name, 'longpi:orchestrator')
  assert.equal(sections[0].order, 20)
  assert.match(sections[0].text(), /LongPi 健康页快照/)
  assert.deepEqual(restricted.map(([who]) => who), ['code'], 'write tools are hidden only from the coding agent')
  assert.ok(restricted[0][1].deny.includes('save_intervention_plan') && restricted[0][1].deny.includes('remember_for_me'))
  assert.ok(!restricted[0][1].deny.includes('read_personal_situation'), 'read tools stay global')
  // the snapshot: step 1 of a health turn, once per fact-pack fingerprint
  const preSteps = host.listeners['agent/pre-step']
  const ownStep = async (agent, text, step = 1) => {
    let decision = { kind: 'enter', messages: [userMessage(text)] }
    for (const listener of preSteps.slice().reverse()) {
      const inner = decision
      decision = await listener({ agent, messages: inner.messages, turn: 1, step, signal: new AbortController().signal }, async () => inner)
    }
    return decision
  }
  const first = await ownStep(healthAgent, '我最近睡得不好')
  const snapshot = first.messages.find((message) => message.source?.form === 'snapshot')
  assert.ok(snapshot, 'a snapshot at step 1 in a health session')
  assert.equal(snapshot.source.plugin, 'dsh-plugin-longpi')
  assert.match(snapshot.content[0].text, /最重要的事（必须先说）：血红蛋白/)
  assert.match(snapshot.content[0].text, /就医跟进：建议看医生，还没有就医记录/)
  const second = await ownStep(healthAgent, '还有别的吗')
  assert.equal(second.messages.filter((message) => message.source?.form === 'snapshot').length, 0, 'not again while the page is the same')
  const later = await ownStep({ ...healthAgent, session: { ...healthAgent.session, id: 'health-2' } }, '你好', 2)
  assert.equal(later.messages.filter((message) => message.source?.form === 'snapshot').length, 0, 'only at step 1')
  const coding = await ownStep(codingAgent, '帮我重构这个函数')
  assert.equal(coding.messages.filter((message) => message.source?.kind === 'plugin' && message.source?.plugin === 'dsh-plugin-longpi').length, 0, 'nothing in a coding session')
  // 0.8.0 (C-08): health words in another workspace bring no LongPi rules and no page snapshot
  const codingHealth = await ownStep({ ...codingAgent, session: { ...codingAgent.session, id: 'code-2' } }, '我的血红蛋白偏低要紧吗？顺便帮我诊断一下这个 bug')
  assert.equal(codingHealth.messages.filter((message) => message.source?.kind === 'plugin' && message.source?.plugin === 'dsh-plugin-longpi').length, 0, 'health talk elsewhere gets nothing from LongPi')
  // nor does a sub-agent inside the health workspace: its task comes from its parent
  const subAgent = { ...healthAgent, session: { ...healthAgent.session, id: 'health-sub', header: { ...healthAgent.session.header, parentSession: healthAgent.session.id } } }
  const sub = await ownStep(subAgent, '我最近睡得不好')
  assert.equal(sub.messages.filter((message) => message.source?.form === 'snapshot').length, 0, 'no snapshot for a sub-agent')

  // --- 5. M1: brief, visit follow-up, the plan adapts --------------------------------------------------
  const briefTool = await host.tools.get('prepare_doctor_brief').execute({})
  assert.equal(briefTool.ok, true)
  assert.match(briefTool.markdown, /^# 给医生的一页简报/)
  assert.match(briefTool.markdown, /姓名：__________/, 'the name is left blank (D10)')
  assert.match(briefTool.markdown, /\| 血红蛋白（g\/L） \| 152 \| 138 \| 124 \| 116 \|/, 'the multi-year trend')
  assert.match(briefTool.markdown, /\| 铁蛋白（ng\/mL） \|.* 8 \|/)
  assert.match(briefTool.markdown, /## 想问医生的问题/)
  assert.match(briefTool.markdown, /铁蛋白、血清铁/)
  assert.doesNotMatch(briefTool.markdown, /\d+\s*mg/, 'no dose')
  const md = await call(host, 'GET', `/api/longpi/brief?id=${briefTool.id}&format=md&download=1`)
  assert.equal(md.status, 200)
  assert.match(md.headers['content-type'], /text\/markdown/)
  assert.match(md.headers['content-disposition'], /attachment; filename="longpi-doctor-brief-/)
  assert.equal(md.text, briefTool.markdown)
  const triage = (await call(host, 'GET', '/api/longpi/triage')).json()
  assert.equal(triage.findings[0].id, 'finding-red-cell')
  assert.equal(triage.brief.id, briefTool.id)
  // booked with a date that has passed → "看完医生了吗？"
  const booked = (await call(host, 'POST', '/api/longpi/care-visit', { status: 'booked', visit_date: '2026-09-20' })).json()
  assert.equal(booked.ok, true)
  mod.invalidateTracking()
  const afterBooking = await mod.buildJourney(await contextOf(ownerConfig))
  assert.equal(afterBooking.surfaces.next.action.kind, 'log_visit_outcome')
  assert.match(afterBooking.next.title_zh, /(2026 年 )?9 月 20 日看医生了吗？医生怎么说？/)
  assert.equal(afterBooking.next.action, 'doctor')
  // visited, in the chat, with the doctor's words
  const sessionAgent = { session: { id: 'health-1' } }
  mod.rememberPersonText('health-1', '看完了，医生说是缺铁性贫血，开了铁剂，让我 3 个月后复查，还要做个胃镜')
  const visit = await host.tools.get('log_care_visit').execute({ status: 'visited', visit_date: '2026-09-22', outcome: '缺铁性贫血，开了铁剂，3 个月后复查，还要做胃镜', quote: '医生说是缺铁性贫血' }, { agent: sessionAgent })
  assert.equal(visit.ok, true)
  assert.match(visit.saved_zh, /已看过医生 (2026 年 )?9 月 22 日/)
  mod.invalidateTracking()
  const afterVisit = await mod.buildJourney(await contextOf(ownerConfig))
  assert.equal(afterVisit.doctor_first.stop, false, 'the doctor has seen it: the plan may go ahead')
  assert.notEqual(afterVisit.next.action, 'doctor')
  assert.equal(afterVisit.triage.top_facts.find((row) => row.kind === 'care_followup')?.rule, 'care.visited')
  const brief = await mod.buildPlanBrief(await contextOf(ownerConfig))
  assert.equal(brief.safety.stop_zh, undefined)
  assert.ok(brief.candidates.length > 0, 'candidates come back')
  assert.ok(brief.notes_zh.some((text) => /医生已经看过.*缺铁性贫血.*用药、补铁或补剂遵医嘱，不纳入方案/.test(text)), 'the doctor\'s conclusion is noted')
  assert.ok(!afterVisit.triage.top_facts.some((row) => row.rule === 'changes.ask_doctor' && /血红蛋白|红细胞压积|平均红细胞/.test(row.text_zh)), 'the red-cell changes the doctor saw are not sent to a doctor again')
  assert.ok(!brief.notes_zh.some((text) => /建议先请医生看过再开始方案/.test(text)), 'no "see a doctor first" note after the visit')
  assert.ok(!brief.notes_zh.some((text) => /医生说：医生说/.test(text)))
  const careMemory = mod.memoryFor(ownerDir).active('care')
  assert.equal(careMemory.length, 1, 'one current care item; the booking is superseded')
  assert.equal(careMemory[0].care_status, 'visited')
  assert.equal(careMemory[0].confirmed, true, 'the quote is in their message')
  assert.ok(readFileSync(join(ownerDir, 'events.jsonl'), 'utf8').includes('"care.visit_logged"'))

  // a visit told without a date took place on the day that was booked
  const dateDir = tempDir('visit-date')
  const finding = [{ id: 'finding-red-cell', department_zh: '血液科', status: 'open', numbers: [], title_zh: 'x' }]
  mod.logCareVisit(dateDir, { status: 'booked', visit_date: '2026-01-05', via: 'page' }, finding)
  const inherited = mod.logCareVisit(dateDir, { status: 'visited', outcome_zh: '医生说：缺铁，开了药', via: 'chat' }, finding)
  assert.equal(inherited.item.visit_date, '2026-01-05')
  assert.equal(inherited.item.outcome_zh, '缺铁，开了药', 'a leading 医生说 is not doubled')

  // remember_for_me: a quote from their message is confirmed; one that is not stays unconfirmed
  mod.rememberPersonText('health-1', '以后别给我安排限时进食了，我试过受不了')
  const kept = await host.tools.get('remember_for_me').execute({ op: 'add', kind: 'exclusion', text: '不要限时进食', quote: '别给我安排限时进食' }, { agent: sessionAgent })
  assert.equal(kept.saved.confirmed, true)
  assert.ok(mod.readPlanPrefs(ownerDir).excluded_phrases.includes('限时进食'), 'the planner sees it')
  const guessed = await host.tools.get('remember_for_me').execute({ op: 'add', kind: 'goal', text: '减到 70 公斤', quote: '我要减到 70 公斤' }, { agent: sessionAgent })
  assert.equal(guessed.saved.confirmed, false, 'not their words: kept unconfirmed')
  const retracted = await host.tools.get('remember_for_me').execute({ op: 'retract', id: kept.saved.id }, { agent: sessionAgent })
  assert.equal(retracted.ok, true)
  assert.ok(!mod.readPlanPrefs(ownerDir).excluded_phrases.includes('限时进食'), 'retracted everywhere')
  host.dispose()

  // --- 6. fold-ins: BP items only with raised BP or hypertension; alcohol only when they drink -----------
  const plain = await startFakeMirobody()
  servers.push(plain)
  const bpDir = tempDir('normotensive')
  profileIn(bpDir, { focus: ['cardio'] })
  const bpConfig = configFor(bpDir, plain.url)
  const normo = await mod.buildPlanBrief(await contextOf(bpConfig), { focus: ['cardio'] })
  const BP_ITEM = /减盐|DASH|得舒|减少饮酒/
  assert.ok(!normo.priorities.some((row) => row.marker_key === 'sbp'), 'SBP 126 with no hypertension is not a priority')
  assert.ok(!normo.candidates.some((row) => BP_ITEM.test(row.intervention_zh)), 'no salt, DASH or alcohol item for a normotensive')
  assert.ok(normo.notes_zh.some((text) => /血压在正常范围（收缩压 126 mmHg/.test(text)), 'says why')
  const drafted = mod.draftPlan(normo, { today: TODAY })
  assert.ok(!drafted || !drafted.items.some((item) => BP_ITEM.test(item.title)))
  // hypertension on record: BP items come back, but alcohol still needs their answer
  mod.memoryFor(bpDir).apply([{ op: 'add', item: { kind: 'condition', name_zh: '高血压', flags: [], state: 'current', text_zh: '高血压', confirmed: true, provenance: { kind: 'chat', at: NOW.toISOString(), by: 'M0' } } }], 'M0')
  const hyper = await mod.buildPlanBrief(await contextOf(bpConfig), { focus: ['cardio'] })
  assert.ok(hyper.priorities.some((row) => row.marker_key === 'sbp'))
  assert.ok(hyper.candidates.some((row) => /减盐|DASH/.test(row.intervention_zh)), 'hypertension on record: salt and DASH are back')
  assert.ok(!hyper.candidates.some((row) => /减少饮酒/.test(row.intervention_zh)), 'never asked about drinking: no alcohol item')
  assert.ok(hyper.notes_zh.some((text) => /尚不清楚你是否饮酒/.test(text)))
  assert.equal(mod.drinkingFromText('我平时每周喝两次啤酒'), true)
  assert.equal(mod.drinkingFromText('红酒，大约一个月两杯'), true)
  assert.equal(mod.drinkingFromText('我不喝酒'), false)
  assert.equal(mod.drinkingFromText('我最近睡得不好'), null)
  mod.setDrinking(bpDir, true)
  const drinker = await mod.buildPlanBrief(await contextOf(bpConfig), { focus: ['cardio'] })
  assert.ok(drinker.candidates.some((row) => /减少饮酒/.test(row.intervention_zh)), 'they drink: the alcohol item may be drafted')
  mod.setDrinking(bpDir, false)
  const nonDrinker = await mod.buildPlanBrief(await contextOf(bpConfig), { focus: ['cardio'] })
  assert.ok(nonDrinker.notes_zh.includes('你已说明不饮酒，因此未列出减少饮酒。'))

  // --- 7. fold-in: the page's 去掉 is saved on the server and survives a reload ---------------------------
  const pageHost = fakeHost()
  const pageDir = tempDir('page-remove')
  profileIn(pageDir, { focus: ['bioage', 'cardio', 'weight'] })
  mod.setDrinking(pageDir, true)
  await mod.apply(pageHost.ctx, configFor(pageDir, plain.url))
  const before = (await call(pageHost, 'GET', '/api/longpi/plan-draft')).json()
  assert.ok(before.draft && before.draft.items.length > 0)
  assert.deepEqual(before.removed_items, [])
  const gone = before.draft.items[0]
  const removed = (await call(pageHost, 'POST', '/api/longpi/plan-draft/exclude', { id: gone.id, title: gone.title, excluded: true })).json()
  assert.equal(removed.ok, true)
  assert.ok(!removed.draft?.items.some((item) => item.id === gone.id), 'gone from the draft that comes back')
  assert.deepEqual(removed.removed_items, [{ id: gone.id, title: gone.title }])
  assert.ok(removed.brief, 'the brief comes back too, so the page can show the answer as is')
  const reloaded = (await call(pageHost, 'GET', '/api/longpi/plan-draft')).json()
  assert.ok(!reloaded.draft?.items.some((item) => item.id === gone.id || item.title === gone.title), 'after a reload the removed item does not come back')
  assert.deepEqual(reloaded.removed_items, [{ id: gone.id, title: gone.title }], 'and 恢复 still has it')
  assert.ok(mod.memoryFor(pageDir).active('exclusion').some((item) => item.match.phrases_zh.includes(gone.title)), 'kept in memory for the chat too')
  const chatDraft = await pageHost.tools.get('draft_intervention_plan').execute({})
  assert.ok(!chatDraft.draft?.items.some((item) => item.title === gone.title), 'a chat draft keeps it out as well')
  const restored = (await call(pageHost, 'POST', '/api/longpi/plan-draft/exclude', { id: gone.id, title: gone.title, excluded: false })).json()
  assert.deepEqual(restored.removed_items, [])
  assert.ok(restored.draft.items.some((item) => item.id === gone.id), '恢复 puts it back')
  const client = readFileSync(join(root, '..', 'lib', 'client.js'), 'utf8')
  assert.match(client, /\/api\/longpi\/plan-draft\/exclude/, 'the page calls the exclude route')
  assert.match(client, /单次检查不能说明你变年轻了/, 'a single draw is never shown as "younger" (PLAN §B5)')
  pageHost.dispose()

  // --- 8. M1 screening topics; pregnancy planning and a relative's breast cancer kept from chat by rule ------
  const young = mod.screeningTopics({ age: 33, sex: 'female', family: [], emptyRecord: true })
  assert.deepEqual(young.map((row) => row.fact.id), ['screening-cervix-age'], 'a woman of 33: cervical screening by age')
  assert.equal(young[0].fact.priority, 'must_surface', 'on an empty record the topic leads')
  assert.equal(mod.screeningTopics({ age: 33, sex: 'female', family: [], emptyRecord: false })[0].fact.priority, 'should_surface')
  const famDir = tempDir('family')
  assert.equal(mod.rememberFromWords(famDir, '我妈49岁得乳腺癌，我要不要现在做BRCA基因检测').length, 1)
  assert.equal(mod.memoryFor(famDir).active('family_history')[0].relative, 'mother')
  const withFamily = mod.screeningTopics({ age: 33, sex: 'female', family: mod.memoryFor(famDir).active('family_history').map((item) => item.text_zh), emptyRecord: false })
  assert.equal(withFamily[0].fact.id, 'screening-breast-family')
  assert.equal(withFamily[0].fact.priority, 'must_surface')
  assert.match(withFamily[0].fact.text_zh, /乳腺筛查.*遗传咨询/)
  assert.deepEqual(mod.screeningTopics({ age: 50, sex: 'male', family: [], emptyRecord: false }).map((row) => row.fact.id), ['screening-colorectal-age'])
  assert.equal(mod.rememberFromWords(famDir, '我在备孕，想调整一下饮食').length, 1)
  assert.ok(mod.memoryFor(famDir).safetyFlags().conditions.includes('pregnancy_planning'))
  assert.equal(mod.rememberFromWords(tempDir('other'), '我老婆怀孕了，我该注意什么').length, 0, 'someone else\'s pregnancy is not theirs')
  // a planned pregnancy keeps TRE and weight loss out of the draft, like a pregnancy
  const pregDir = tempDir('planning')
  profileIn(pregDir, { sex: 'female', age: 34, focus: ['weight', 'bioage'] })
  mod.rememberFromWords(pregDir, '我在备孕')
  const planning = await mod.buildPlanBrief(await contextOf(configFor(pregDir, plain.url)), { focus: ['weight'] })
  assert.ok(!planning.candidates.some((row) => row.category === 'weight' || /限时进食|断食/.test(row.intervention_zh)), 'no TRE or weight-loss item while planning a pregnancy')
  const planningJourney = await mod.buildJourney(await contextOf(configFor(pregDir, plain.url)))
  assert.ok(planningJourney.triage.top_facts.some((row) => row.rule === 'safety.condition.pregnancy_planning' && /备孕/.test(row.text_zh)))

  console.log('agent-core ok (memory, bus, fact-ranked floor, snapshot, persona scope, brief, visit follow-up, fold-ins)')
} finally {
  mod.setBus(null)
  for (const server of servers) await server.close?.()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
