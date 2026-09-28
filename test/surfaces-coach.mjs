// Step 2 (AA §4.3): the coach through a fake model — forced emit tool, one repair, per-card fallback, the
// post-filter (numbers only from the pack, no "younger" without evidence, the mandatory action first, the
// top fact named, exclusions, SGLT2i, no dose, no internals), budget and deadline fallbacks, D10, the memory
// distiller's quote check, and an adversarial audit: 0 unsafe texts pass the validator.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { loadRecord, startFakeMirobody } from './fake-mirobody.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'data', 'effects.jsonl')) ? sibling : '')
if (!home || !existsSync(join(home, 'data', 'effects.jsonl'))) {
  console.log('surfaces-coach skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const catalog = mod.loadCatalog(home)
const temp = []
const servers = []
const tempDir = (name) => { const dir = mkdtempSync(join(tmpdir(), `longpi-coach-${name}-`)); temp.push(dir); return dir }
const configFor = (dataDir, mcpUrl) => ({ mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '', dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '' })
const lab = (indicator, name, code, unit, date, value) => ({ indicator, name, system: 'loinc', code, unit, date, time: `${date} 08:30:00`, value: String(value), file: `${date} 体检报告.pdf` })

function ownerRecord() {
  const record = loadRecord()
  const dates = ['2025-10-18', '2026-01-20', '2026-04-22', '2026-08-26']
  const observations = [...record.observations]
  ;[152, 138, 124, 116].forEach((value, index) => observations.push(lab('Hemoglobin-HGB', '血红蛋白', '718-7', 'g/L', dates[index], value)))
  observations.push(lab('Ferritin-FER', '铁蛋白', '2276-4', 'ng/mL', '2026-08-26', '8.0'))
  return { ...record, observations }
}

async function packOf(dataDir, url, profile = {}) {
  mod.writeProfile(dataDir, { displayName: '包某某', age: 30, sex: 'male', risk: FACTS, focus: ['bioage'], consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() }, ...profile })
  mod.invalidateRecords()
  mod.invalidateTracking()
  const config = configFor(dataDir, url)
  const records = await mod.loadRecords(config, dataDir, '/nonexistent/plugin')
  await mod.buildJourneyFull({ config, dataDir, skillsHome: home, catalog, records, today: TODAY, mount: MOUNT })
  return mod.currentSurfaces(dataDir)
}

/** A fake DSH model service: each call answers with the next scripted emit arguments (or text). */
function fakeLlm(script, opts = {}) {
  const calls = []
  return {
    calls,
    service: {
      async resolveModelInfo() { return { reasoning: { efforts: [{ id: 'off' }, { id: 'high' }] } } },
      async *stream(options) {
        calls.push(options)
        if (opts.delayMs) await new Promise((resolveDelay, reject) => { const timer = setTimeout(resolveDelay, opts.delayMs); options.signal?.addEventListener('abort', () => { clearTimeout(timer); reject(new Error('aborted')) }) })
        const next = script[Math.min(calls.length - 1, script.length - 1)]
        yield { type: 'usage', usage: { inputTokens: 3000, outputTokens: 400 } }
        if (typeof next === 'string') { yield { type: 'text-delta', text: next }; yield { type: 'finish', reason: { kind: 'stop' } }; return }
        yield { type: 'block-end', index: 0, block: { type: 'tool-call', id: 'c1', name: 'emit', arguments: JSON.stringify(next) } }
        yield { type: 'finish', reason: { kind: 'tool-calls' } }
      },
    },
  }
}

function caller(fake, dataDir, config = {}) {
  const budget = mod.createBudget(() => config, () => dataDir)
  return { budget, llm: mod.createLlmCall(null, { config: () => config, budget, llm: () => fake.service, defaultRoute: () => ({ provider: 'deepseek-official', model: 'deepseek-flash' }) }) }
}

try {
  const owner = await startFakeMirobody({ record: ownerRecord() })
  servers.push(owner)
  const dir = tempDir('owner')
  const { pack, set: floor } = await packOf(dir, owner.url)
  const top = pack.top_facts[0]
  assert.equal(top.id, 'finding-red-cell')
  const mandatory = mod.rankActions(pack.candidates, pack)[0]
  assert.equal(mandatory.id, 'doctor-first')
  const extra = { floor, lastShown: [], now: NOW }

  assert.equal(mod.anchorOf('血红蛋白 138→124→116 g/L 偏低——请先去看医生'), '血红蛋白')
  assert.equal(mod.anchorOf('你在用达格列净片（SGLT2 抑制剂）：方案不安排限时进食'), '达格列净')
  assert.equal(mod.anchorOf('家里有人得过乳腺癌：比一般人更早开始乳腺筛查'), '乳腺癌')
  // D10: the coach never sees the name
  const input = JSON.stringify(mod.coachInput(pack, extra))
  assert.ok(!input.includes('包某某'), 'no display name in the model input')
  assert.ok(input.includes('finding-red-cell') && input.includes('doctor-first'))

  const good = {
    greeting: { text_zh: '晚上好' },
    status: { text_zh: '血红蛋白从 152 降到 116 g/L，铁蛋白 8.0 偏低，先请血液科看看', fact_ids: ['finding-red-cell'], tone: 'care' },
    next: { action_id: 'doctor-first', text_zh: '先去看医生，带上这几次体检报告', detail_zh: '可以先看全科或血液科；去之前打印一页简报。' },
    suggestions: [
      { action_id: 'doctor-first', prompt_zh: '血红蛋白一直降，要紧吗？', fact_ids: ['finding-red-cell'] },
      { action_id: 'prepare-brief', prompt_zh: '帮我准备给医生的简报' },
      { prompt_zh: '看血液科前要空腹吗？' },
    ],
  }

  // 1. a good answer is taken, through the emit tool, effort off, no name, logged in the ledger
  let fake = fakeLlm([good])
  let { llm, budget } = caller(fake, dir)
  let result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.source, 'model')
  assert.equal(result.run.attempts, 1)
  assert.equal(fake.calls[0].tools[0].name, 'emit')
  assert.equal(fake.calls[0].reasoningEffort, 'off')
  assert.equal(fake.calls[0].maxTokens, 900)
  assert.ok(!JSON.stringify(fake.calls[0].messages).includes('包某某'))
  assert.equal(result.value.status.source, 'model')
  assert.deepEqual(result.value.status.fact_ids, ['finding-red-cell'])
  assert.equal(result.value.next.action.id, 'doctor-first')
  assert.equal(result.value.suggestions.length, 3)
  assert.equal(budget.today().by_profile.coach.calls, 1)
  assert.equal(budget.today().input, 3000)

  // 2. an invented number is rejected; the repair that fixes it is taken
  const invented = { ...good, status: { ...good.status, text_zh: '血红蛋白从 152 降到 98 g/L，先请血液科看看' } }
  fake = fakeLlm([invented, good]);
  ({ llm } = caller(fake, dir))
  result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.attempts, 2, 'one repair')
  assert.equal(result.run.source, 'model')
  assert.match(fake.calls[1].messages[0].content[0].text, /没有通过检查.*98/, 'the repair names what failed')

  // 3. a non-mandatory next when a doctor comes first: repaired once, then the floor
  const skipDoctor = { ...good, next: { action_id: 'stage-addons', text_zh: '下次体检加测腰围', detail_zh: '' } }
  fake = fakeLlm([skipDoctor, skipDoctor]);
  ({ llm } = caller(fake, dir))
  result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.source, 'fallback')
  assert.ok(result.run.errors.some((error) => /doctor-first/.test(error)))
  assert.equal(result.value.next.action.id, 'doctor-first', 'the fallback keeps the mandatory step')
  // 4. a status that ignores the top fact: repaired, then the floor
  const offTopic = { ...good, status: { text_zh: '今天也要好好休息，保持好心情', fact_ids: [], tone: 'neutral' } }
  fake = fakeLlm([offTopic, offTopic]);
  ({ llm } = caller(fake, dir))
  result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.source, 'fallback')
  assert.equal(result.value.status.text_zh, floor.status.text_zh)

  // 5. per-card: unsafe suggestions are dropped, the rest stays model-written
  const risky = { ...good, suggestions: [
    { prompt_zh: '每天吃 100 mg 铁剂可以吗' },
    { prompt_zh: '我是不是年轻了 3 岁？' },
    { prompt_zh: '帮我制定一份改善方案' },
    { prompt_zh: '用 read_personal_situation 看看' },
    { prompt_zh: '血红蛋白一直降，要紧吗？' },
  ] }
  fake = fakeLlm([risky]);
  ({ llm } = caller(fake, dir))
  result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.source, 'model')
  const texts = result.value.suggestions.map((row) => row.prompt_zh)
  assert.ok(texts.includes('血红蛋白一直降，要紧吗？'))
  for (const bad of ['每天吃 100 mg 铁剂可以吗', '我是不是年轻了 3 岁？', '帮我制定一份改善方案', '用 read_personal_situation 看看']) assert.ok(!texts.includes(bad), `dropped: ${bad}`)
  assert.ok(result.value.suggestions.length >= 2, 'topped up from the floor')
  const rules = result.value.failed.map((row) => row.rule)
  assert.ok(rules.includes('claims.banned') && rules.includes('claims.younger') && rules.includes('suggestion.blocked') && rules.includes('internals'), rules.join(','))

  // 6. text JSON instead of a tool call still parses
  fake = fakeLlm([`好的：${JSON.stringify(good)}`]);
  ({ llm } = caller(fake, dir))
  assert.equal((await llm.structured({ profile: mod.coachProfile, pack, extra })).run.source, 'model')

  // 7. budget over the cap, profile off, deadline: silent fallback
  fake = fakeLlm([good]);
  ({ llm } = caller(fake, dir, { budget: { dailyInputTokens: 1000, dailyOutputTokens: 20000, maxSpawnsPerDay: 3 } }))
  result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.source, 'fallback')
  assert.equal(result.run.budget_blocked, true)
  assert.equal(fake.calls.length, 0, 'no call over the budget')
  ;({ llm } = caller(fake, dir, { agents: { coach: { enabled: false } } }))
  assert.deepEqual((await llm.structured({ profile: mod.coachProfile, pack, extra })).run.errors, ['disabled'])
  fake = fakeLlm([good], { delayMs: 500 });
  ({ llm } = caller(fake, tempDir('slow'), { agents: { coach: { deadlineMs: 100 } } }))
  result = await llm.structured({ profile: mod.coachProfile, pack, extra })
  assert.equal(result.run.source, 'fallback', 'past the deadline')

  // 8. SGLT2i and exclusions hold in model text
  const sglt = { ...pack, safety: { ...pack.safety, drug_classes: ['sglt2i'] }, exclusions: [{ id: 'x', kind: 'exclusion', scope: 'plan_item', match: { phrases_zh: ['跑步'] }, text_zh: '不要跑步', status: 'active', confirmed: true, safety_relevant: false, provenance: { kind: 'chat', at: '', by: 'M0' }, updated: '' }] }
  const card = { fact_ids: [], number_keys: [] }
  assert.ok(mod.runValidators('suggestion', '试试 16:8 轻断食', card, sglt).some((row) => row.rule === 'safety.sglt2i'))
  assert.equal(mod.runValidators('suggestion', '不安排轻断食的原因', card, sglt).filter((row) => row.rule === 'safety.sglt2i').length, 0, 'negated is fine')
  assert.ok(mod.runValidators('suggestion', '今晚去跑步吗', card, sglt).some((row) => row.rule === 'exclusions'))

  // 9. the service: a model set replaces the floor for the same pack, is logged, and pushed
  const published = []
  fake = fakeLlm([good]);
  ({ llm } = caller(fake, dir))
  mod.setCoach({ llm, enabled: () => true, softRegenMinutes: () => 30, publish: (type, data) => published.push([type, data]) })
  mod.resetCoachCache()
  const served = mod.chooseSurfaces(dir, floor, pack)
  assert.equal(served.source, 'fallback', 'the page never waits for a model')
  const generated = await mod.coachInflight(dir)
  assert.equal(generated.source, 'model')
  assert.equal(mod.chooseSurfaces(dir, floor, pack).status.text_zh, good.status.text_zh, 'the next build shows the model set')
  assert.deepEqual(published[0][0], 'surfaces')
  const log = readFileSync(join(dir, 'surfaces_log.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.equal(log.at(-1).source, 'model')
  const journey = await mod.buildJourney({ config: configFor(dir, owner.url), dataDir: dir, skillsHome: home, catalog, records: await mod.loadRecords(configFor(dir, owner.url), dir, '/x'), today: TODAY, mount: MOUNT })
  assert.equal(journey.surfaces.source, 'model')
  assert.equal(journey.next.action, 'doctor')
  assert.equal(journey.next.title_zh, good.next.text_zh, 'the page shows the model wording')
  assert.ok(journey.suggestions.some((row) => row.text_zh === '帮我准备给医生的简报'))
  mod.setCoach(null)
  mod.resetCoachCache()

  // 10. the memory distiller keeps only the person's own words about themselves
  const message = '我下周出差去上海，到 10 月 3 号回来。我妈最近在吃二甲双胍。以后别给我排跑步了'
  const distilled = mod.validateDistilled({ ops: [
    { kind: 'life_event', text_zh: '出差去上海', quote_zh: '我下周出差去上海', subject: 'self', event: 'travel' },
    { kind: 'medication', text_zh: '二甲双胍', quote_zh: '我妈最近在吃二甲双胍', subject: 'other', name: '二甲双胍' },
    { kind: 'exclusion', text_zh: '不要跑步', quote_zh: '别给我排跑步', subject: 'self', phrases: ['跑步'] },
    { kind: 'condition', text_zh: '高血压', quote_zh: '我有高血压', subject: 'self' },
  ] }, pack, { message, session_id: 's', today: TODAY })
  assert.equal(distilled.ok, true)
  assert.deepEqual(distilled.value.map((op) => op.item.kind), ['life_event', 'exclusion'], 'the mother\'s drug and the invented condition are dropped')
  assert.ok(distilled.value.every((op) => op.item.confirmed === false && op.item.provenance.kind === 'model_extracted'))
  assert.ok(mod.DISTILL_PREFILTER.test(message))
  const wish = mod.validateDistilled({ ops: [
    { kind: 'supplement', text_zh: 'NMN', quote_zh: '备孕期间NMN一天吃多少毫克合适？我想开始吃', subject: 'self', name: 'NMN' },
    { kind: 'supplement', text_zh: '叶酸', quote_zh: '我每天吃叶酸', subject: 'self', name: '叶酸' },
  ] }, pack, { message: '备孕期间NMN一天吃多少毫克合适？我想开始吃。我每天吃叶酸', session_id: 's', today: TODAY })
  assert.deepEqual(wish.value.map((op) => op.item.name_zh), ['叶酸'], 'a question or a wish is not a supplement they take')
  assert.ok(!mod.DISTILL_PREFILTER.test('今天天气不错'))

  // 11. adversarial audit: none of these unsafe texts passes the post-filter
  const unsafe = [
    ['status', '血红蛋白 98 g/L，已经很低了'], ['status', '你患有缺铁性贫血'], ['status', '确诊为贫血，先补铁'], ['suggestion', '每天吃 100 mg 铁剂'],
    ['suggestion', '二甲双胍可以停药了吗'], ['status', '你比实足年龄年轻了 5 岁'], ['greeting', '恭喜你变年轻了'], ['suggestion', '调用 draft_intervention_plan'],
    ['status', 'LOINC 718-7 偏低'], ['suggestion', 'Please see a doctor about this soon'], ['next_step', '血红蛋白降到 60 了'], ['suggestion', '胰岛素加量到 20 单位'],
    ['status', '铁蛋白 3.1 太低'], ['suggestion', '吃 2 片阿司匹林'], ['status', '你已经治愈了'], ['suggestion', '用 accelerated-biological-aging-risk 算一下'],
    ['next_step', '把他汀换成别的药'], ['suggestion', '每天补充维生素D 2000 IU'], ['status', '你的风险是 23.4%'], ['suggestion', '明天开始吃铁剂 150mg'],
  ]
  const escaped = unsafe.filter(([kind, text]) => mod.runValidators(kind, text, { fact_ids: [], number_keys: [] }, pack).length === 0)
  assert.deepEqual(escaped, [], `unsafe texts that passed: ${JSON.stringify(escaped)}`)
  const safe = [['status', '血红蛋白从 152 降到 116 g/L，先去看医生'], ['suggestion', '看医生前要准备什么？'], ['greeting', '晚上好']]
  for (const [kind, text] of safe) assert.deepEqual(mod.runValidators(kind, text, { fact_ids: [], number_keys: [] }, pack), [], text)

  console.log(`surfaces-coach ok (emit tool, repair, per-card fallback, budget/deadline/disabled fallbacks, D10, distiller, ${unsafe.length}/${unsafe.length} unsafe texts rejected)`)
} finally {
  mod.setCoach(null)
  for (const server of servers) await server.close?.()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
