// 0.5.5: pregnancy planning and breastfeeding use the pregnancy plan rules.
// Chat ("今年开始备孕", 准备怀孕, 计划要孩子, 哺乳) and memory (including an unconfirmed goal)
// both keep 限时进食 out of the draft the page serves.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as mod from '../lib/index.js'
import { skillsHome } from './lib/skills-home.mjs'

const home = skillsHome('data/effects.jsonl')
if (!home) {
  console.log('fix-055-planning skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const { startFakeMirobody } = await import('./fake-mirobody.mjs')
const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const TRE = /限时进食|time-restricted|16:8|轻断食|断食/i
const WEIGHT_LOSS = /减重|减肥|热量限制|热量缺口|减少饮酒/
const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-055b-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl) {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
  }
}

function profileIn(dataDir) {
  mod.writeProfile(dataDir, {
    age: 34, sex: 'female',
    risk: { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false },
    focus: ['weight', 'cardio'],
    consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() },
  })
  mod.setDrinking(dataDir, true)
}

function clearPregnant(dataDir) {
  const prefs = mod.readPlanPrefs(dataDir)
  writeFileSync(join(dataDir, 'plan_prefs.json'), `${JSON.stringify({ ...prefs, pregnant: false })}\n`)
}

async function contextOf(config, patch = (records) => records) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = patch(await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin'))
  return { config, dataDir: config.dataDir, skillsHome: home, catalog: mod.loadCatalog(home), records, today: TODAY, mount: MOUNT }
}

function bmi21(records, medications) {
  return {
    ...records,
    ...(medications ? { medications } : {}),
    indicators: [
      ...records.indicators,
      { name: '身高', label: '身高', loinc: '8302-2', value: '166', unit: 'cm', date: '2026-12-31' },
      { name: '体重', label: '体重', loinc: '29463-7', value: '58', unit: 'kg', date: '2026-12-31' },
    ],
  }
}

const FOLIC = { name: '叶酸片', status: 'active', recorded_dose: '', schedule: '0.4 mg，每天 1 次', since: '2026-04-02' }

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

function call(host, method, url) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from([])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolveCall) => {
    const res = {
      statusCode: 200, writableEnded: false, setHeader: () => {},
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, json: () => JSON.parse(raw) })
      },
    }
    handler(req, res)
  })
}

function assertSafe(brief, draft, label) {
  const items = [...brief.candidates, ...(draft?.items ?? [])]
  for (const row of items) {
    const text = `${row.intervention_zh ?? ''} ${row.title ?? ''} ${row.detail ?? ''} ${row.id ?? ''}`
    assert.doesNotMatch(text, TRE, `${label} tre ${row.id || row.title}`)
    assert.doesNotMatch(text, WEIGHT_LOSS, `${label} loss ${row.id || row.title}`)
  }
  assert.ok(brief.candidates.length > 0, `${label} still drafts something`)
  const blob = [...brief.notes_zh, ...brief.safety.notes_zh, ...(draft?.notes_zh ?? [])].join('\n')
  assert.match(blob, /避免饮酒/)
  assert.match(blob, /0\.4\s*mg/)
  assert.match(blob, /中国备孕的常规人群指导/)
  assert.equal(draft?.goals?.some((goal) => goal.marker === '体重' && goal.value < 58), false)
}

try {
  const phraseDir = tempDir('phrases')
  const day0 = '我最关心的是：今年开始备孕，想知道抗衰老补剂会不会碰到怀孕。先按我的检查结果起草一份方案。'
  assert.equal(mod.rememberFromWords(phraseDir, day0).length, 1)
  assert.ok(mod.memoryFor(phraseDir).safetyFlags().conditions.includes('pregnancy_planning'))
  assert.equal(mod.memoryFor(phraseDir).safetyFlags().conditions.includes('pregnancy'), false, '碰到怀孕 is not a pregnancy')
  for (const line of ['准备怀孕', '计划要孩子', '我在备孕']) {
    const dir = tempDir('plan')
    mod.rememberFromWords(dir, line)
    assert.ok(mod.memoryFor(dir).safetyFlags().conditions.includes('pregnancy_planning'), line)
    assert.equal(mod.memoryFor(dir).safetyFlags().conditions.includes('pregnancy'), false, line)
  }
  const feed = tempDir('feed')
  mod.rememberFromWords(feed, '我在哺乳')
  assert.ok(mod.memoryFor(feed).safetyFlags().conditions.includes('breastfeeding'))
  const during = tempDir('during')
  mod.rememberFromWords(during, '备孕期间NMN一天吃多少毫克合适？我想开始吃。')
  assert.ok(mod.memoryFor(during).safetyFlags().conditions.includes('pregnancy_planning'))
  assert.equal(mod.memoryFor(during).safetyFlags().conditions.includes('pregnancy'), false, '备孕期间 is not a current pregnancy')
  assert.equal(mod.rememberFromWords(tempDir('other'), '我老婆在备孕，我该注意什么').length, 0)
  assert.equal(mod.rememberFromWords(tempDir('wife'), '我老婆怀孕了').length, 0)

  const plain = await startFakeMirobody()
  servers.push(plain)

  const openDir = tempDir('open')
  profileIn(openDir)
  const open = await mod.buildPlanBrief(await contextOf(configFor(openDir, plain.url), (records) => bmi21(records)), { focus: ['weight', 'cardio'] })
  assert.ok(open.candidates.some((row) => TRE.test(row.intervention_zh)), 'BMI 21 without planning still may draft TRE')

  const folicDir = tempDir('folic')
  profileIn(folicDir)
  clearPregnant(folicDir)
  const folicBrief = await mod.buildPlanBrief(await contextOf(configFor(folicDir, plain.url), (records) => bmi21(records, [FOLIC])), { focus: ['weight', 'cardio'] })
  const folicDraft = mod.draftPlan(folicBrief, { today: TODAY })
  assertSafe(folicBrief, folicDraft, 'folic acid on the plan, pregnant flag false')

  const goalDir = tempDir('goal')
  profileIn(goalDir)
  mod.memoryFor(goalDir).apply([{
    op: 'add',
    item: {
      kind: 'goal', text_zh: '今年开始备孕', confirmed: false, focus: 'weight',
      provenance: { kind: 'model_extracted', at: NOW.toISOString(), by: 'M0', quote_zh: '今年开始备孕' },
    },
  }], 'M0')
  clearPregnant(goalDir)
  const goalBrief = await mod.buildPlanBrief(await contextOf(configFor(goalDir, plain.url), (records) => bmi21(records)), { focus: ['weight', 'cardio'] })
  const goalDraft = mod.draftPlan(goalBrief, { today: TODAY })
  assertSafe(goalBrief, goalDraft, 'unconfirmed goal')
  assert.match(goalBrief.notes_zh.join('\n'), /你在备孕/)

  const chatDir = tempDir('chat')
  profileIn(chatDir)
  const chatBrief = await mod.buildPlanBrief(await contextOf(configFor(chatDir, plain.url), (records) => bmi21(records)), { focus: ['weight', 'cardio'], constraints: '计划要孩子' })
  assertSafe(chatBrief, mod.draftPlan(chatBrief, { today: TODAY }), 'constraints')
  clearPregnant(chatDir)
  const again = await mod.buildPlanBrief(await contextOf(configFor(chatDir, plain.url), (records) => bmi21(records)), { focus: ['weight', 'cardio'] })
  assertSafe(again, mod.draftPlan(again, { today: TODAY }), 'pregnant false does not clear 计划要孩子')

  const heavyDir = tempDir('heavy')
  profileIn(heavyDir)
  mod.rememberFromWords(heavyDir, '我在备孕')
  const heavy = await mod.buildPlanBrief(await contextOf(configFor(heavyDir, plain.url), (records) => ({
    ...records,
    indicators: [
      ...records.indicators,
      { name: '身高', loinc: '8302-2', value: '160', unit: 'cm', date: '2026-12-31' },
      { name: '体重', loinc: '29463-7', value: '70', unit: 'kg', date: '2026-12-31' },
    ],
  })), { focus: ['weight'] })
  assert.ok(!heavy.candidates.some((row) => TRE.test(row.intervention_zh)), 'TRE stays out at BMI 27')
  assert.equal(heavy.safety.no_weight_loss, undefined)

  const feedDir = tempDir('feeding-plan')
  profileIn(feedDir)
  mod.rememberFromWords(feedDir, '正在母乳喂养')
  const feeding = await mod.buildPlanBrief(await contextOf(configFor(feedDir, plain.url), (records) => bmi21(records)), { focus: ['weight', 'cardio'] })
  const feedingDraft = mod.draftPlan(feeding, { today: TODAY })
  for (const row of feeding.candidates) assert.doesNotMatch(`${row.intervention_zh} ${row.id}`, TRE)
  assert.match([...feeding.notes_zh, ...feeding.safety.notes_zh].join('\n'), /你在哺乳/)
  assert.match([...feeding.notes_zh, ...feeding.safety.notes_zh].join('\n'), /避免饮酒/)
  assert.doesNotMatch(feedingDraft.items.map((item) => `${item.title} ${item.detail}`).join('\n'), WEIGHT_LOSS)

  const host = fakeHost()
  const pageDir = tempDir('page')
  profileIn(pageDir)
  mod.rememberFromWords(pageDir, '今年开始备孕')
  clearPregnant(pageDir)
  await mod.apply(host.ctx, configFor(pageDir, plain.url))
  const route = (await call(host, 'GET', '/api/longpi/plan-draft')).json()
  assertSafe(route.brief, route.draft, 'GET /api/longpi/plan-draft')
  host.dispose()

  console.log('fix-055-planning ok')
} finally {
  for (const server of servers) await server.close?.()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
