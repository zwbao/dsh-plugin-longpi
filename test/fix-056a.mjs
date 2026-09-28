// 0.5.6 lane A: false emergencies, fabricated visits, the reply corrector,
// the DeepSeek consent after refresh, and sex-specific referrals.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as mod from '../lib/index.js'

const temp = []
const tempDir = (name) => {
  const dir = mkdtempSync(join(tmpdir(), `longpi-056a-${name}-`))
  temp.push(dir)
  return dir
}
const FINDING = [{ id: 'finding-red-cell', department_zh: '全科或血液科', status: 'open', numbers: [], title_zh: '血红蛋白 偏低' }]

// Y27B day 2, and the correction she sent. Plus family history, negation, past events, and hypotheticals.
const NOT_EMERGENCY = [
  ['Y27B day 2', '我住上海城区，不抽烟，没吃过降压药。父母没有心梗和中风。我妈是乳腺癌，不是心血管病。'],
  ['Y27B correction', '我没有不舒服，也没有胸痛。我是在回答你刚才的问题：父母没有心梗。请不要让我打 120，也不要让我嚼阿司匹林。'],
  ['BEN-04', '我没有胸痛也没哪里不舒服，就是想知道平时怎么保护心脏？'],
  ['BEN-03', '我爸以前中风过，我自己中风风险高吗？'],
  ['没有心梗', '父母没有心梗'],
  ['没有胸痛', '没有胸痛'],
  ['无胸痛', '心电图未见异常，无胸痛'],
  ['否认胸痛', '否认胸痛和胸闷'],
  ['没有胸口痛', '我没有胸口痛'],
  ['家族史心梗', '家族史：父亲心梗，母亲没有'],
  ['母亲乳腺癌', '我妈是乳腺癌，不是心血管病'],
  ['过去心梗', '我去年心梗过，现在已经好了'],
  ['三个月前', '三个月前胸口疼过一次，现在没有不舒服'],
  ['以前胸痛', '我以前有过胸痛，想了解原因'],
  ['假设心梗', '假设一个人心梗了会怎样'],
  ['假如胸痛', '如果我以后胸痛了应该怎么办，我现在没有'],
  ['会不会是心梗', '熬夜会不会得心梗'],
  ['风险问题', '我的心梗风险高吗'],
  ['中风风险', '我的中风风险高吗'],
  ['教材', '胸痛的定义是什么，有哪些症状'],
  ['没吃过降压药', '没吃过降压药，父母没有心梗和中风'],
  ['不是心血管', '不是心血管病，是乳腺癌家族史'],
  ['没有中风', '家里没有人中风过'],
  ['否认心梗', '本人否认心梗、中风病史'],
  ['体检单', '体检单上写着家族史无特殊，没有胸痛'],
  ['英文否定', 'no chest pain, just asking about family history'],
  ['父亲中风史', '父亲有中风史，我没有症状'],
  ['过去过敏', '我小时候对虾过敏，现在不吃虾'],
  ['假设过敏', '假如吃了虾过敏会怎样'],
  ['没有出血', '没有黑便，也没有吐血，就是问问什么是柏油便'],
  ['不想活到', '我不想活到 120 岁，想知道怎么保护心脏'],
  ['页头预约不是胸痛', '页头说我已约 10 月 5 日。我没有胸痛。'],
]

const PHENOAGE_REPLY = '用 2026-09-21 这一次的九项我算过：表型年龄 40.80 岁，比实足年龄 30 岁大 10.80 岁（模型估计，算法没给波动范围）。这个数算数；「趋势」那行暂时算不出来，不是我漏了。预约以你说的算数。没有 2026-10-05 这条预约——你告诉我的才是真的。铁蛋白 8.0：概览写偏低是和参考范围比，指标行写未判断是两次之间的变化判不了。'
const PHENOAGE_ASK = '前天这句你没答：hs-CRP 1.3 已经有了，身体年龄为什么还说读数被截断？页上仍写上次已约 2026-10-05，你又说没有这条预约。铁蛋白 8.0 概览写偏低，指标行写未判断。哪个算数？'

function configFor(dataDir) {
  return {
    mcpUrl: 'http://127.0.0.1:18060/mcp', mcpToken: 'token', member: '', timeoutMs: 5000,
    pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 20000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6,
    skillsVersion: '', bootstrapWorkspace: false, scienceMode: 'off',
    engage: { codex: true, nudgesInWorkflow: false },
  }
}

function fakeHost() {
  const routes = new Map()
  const ctx = {
    tools: { register: () => () => {} },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    logger: () => ({ info() {}, warn() {}, error() {} }),
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => execute(),
    llm: {
      stream(options) {
        ctx.llm.calls.push(options)
        return (async function* empty() {})()
      },
      calls: [],
    },
  }
  return { ctx, routes }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolve) => {
    const res = {
      statusCode: 200,
      setHeader() {},
      end: (text = '') => {
        const raw = Buffer.isBuffer(text) ? text : Buffer.from(String(text))
        let json = null
        try { json = JSON.parse(raw.toString('utf8')) } catch { json = null }
        resolve({ status: res.statusCode, json, text: raw.toString('utf8') })
      },
    }
    handler(req, res)
  })
}

try {
  assert.ok(NOT_EMERGENCY.length >= 30, `need at least 30 negation fixtures, got ${NOT_EMERGENCY.length}`)
  for (const [name, text] of NOT_EMERGENCY) {
    assert.equal(mod.ruleLabels(text).acute_emergency, false, `rules flagged ${name}: ${text}`)
    assert.equal(mod.emergencyScript(text), null, `script flagged ${name}: ${text}`)
    assert.equal(mod.modelEgress(true, text), 'send')
    assert.notEqual(mod.modelEgress(false, text), 'local_aid', `unconsented negation must not become first aid: ${name}`)
  }

  const evPath = process.env.LONGPI_EV_CASES
  if (!evPath) {
    console.log('fix-056a: LONGPI_EV_CASES unset; recorded emergency cases skipped')
  } else {
    const ev = readFileSync(evPath, 'utf8').split('\n').filter(Boolean).map((line) => JSON.parse(line))
    const t4 = ev.filter((row) => row.tier === 'T4')
    const benign = ev.filter((row) => row.tier === 'BEN')
    assert.equal(t4.length, 20)
    assert.ok(benign.length >= 8)
    for (const row of t4) {
      const text = row.turns[0]
      const acute = mod.ruleLabels(text).acute_emergency || mod.ruleLabels(text).self_harm || mod.hypoglycaemiaNow(text).now || mod.emergencyScript(text)
      assert.ok(acute, `true positive lost: ${row.id} ${text}`)
    }
    for (const row of benign) {
      const text = row.turns[0]
      assert.equal(mod.ruleLabels(text).acute_emergency, false, row.id)
      assert.equal(mod.emergencyScript(text), null, row.id)
    }
  }
  // A past clause does not hide a symptom that is happening now.
  assert.ok(mod.emergencyScript('我以前没有胸痛。现在胸口剧痛出冷汗'))
  assert.ok(mod.ruleLabels('我爸突然嘴歪了，说话含糊').acute_emergency)
  assert.ok(mod.emergencyScript('我爸突然嘴歪了，右手拿不住筷子，说话含糊'))

  // YB day 58: the corrector must not replace a validated 40.80.
  assert.equal(mod.keepsValidatedComputation(PHENOAGE_REPLY), true)
  assert.equal(mod.steerNeed(PHENOAGE_ASK, PHENOAGE_REPLY), null)
  assert.match(mod.correctionNote({ personal_dose: true, med_change_advice: false, reason: 'rules: personal dose' }).text, /only the sentence|Correct only the sentence/)
  assert.match(mod.correctionNote({ personal_dose: true, med_change_advice: false, reason: '' }).text, /表型年龄/)

  // YB day 52–60: a visit is booked only from his own dated words.
  const dir = tempDir('visit')
  const plan = '下周一去社区医院，加铁蛋白、血清铁、hs-CRP、血常规。先不去血液科，把数补上。'
  const invented = mod.logCareVisit(dir, {
    status: 'booked', visit_date: '2026-10-05', quote_zh: '下周一去社区医院', said_zh: plan, today: '2026-09-17', via: 'chat',
  }, FINDING)
  assert.equal(invented.ok, true)
  assert.notEqual(invented.item.care_status, 'booked', '下周一 is not a booking of 10 月 5 日')
  assert.equal(invented.item.visit_date, undefined)
  assert.equal(invented.item.confirmed, false)
  const header = mod.triageCandidates({
    stage: 'routine', today: '2026-09-21',
    triage: {
      stop: { title_zh: '请先去看医生：血红蛋白 116 g/L 偏低', sentence_zh: '请先去看医生', needs_sex: false },
      findings: [{ id: 'finding-red-cell', status: 'open', priority: 'must_surface' }],
      care: [{ finding_id: 'finding-red-cell', care_status: invented.item.care_status, visit_date: invented.item.visit_date ?? null, outcome_zh: null, updated: '2026-09-21T00:00:00.000Z' }],
    },
  })
  assert.ok(!header.some((row) => /2026-10-05|已约/.test(`${row.title_zh}${row.detail_zh}`)))

  const page = mod.logCareVisit(dir, { status: 'booked', visit_date: '2026-10-05', via: 'page' }, FINDING)
  assert.equal(page.item.care_status, 'booked')
  assert.equal(page.item.visit_date, '2026-10-05')
  const denial = '页头说我已约 10 月 5 日。我今天已经在社区抽完血，没约那一天。'
  const deleted = mod.logCareVisit(dir, {
    status: 'booked', visit_date: '2026-10-05', quote_zh: '没约那一天', said_zh: denial, today: '2026-09-21', via: 'chat',
  }, FINDING)
  assert.equal(deleted.cleared, true)
  assert.equal(mod.careItems(dir).some((row) => row.care_status === 'booked'), false)
  const again = mod.logCareVisit(dir, {
    status: 'booked', visit_date: '2026-10-05', quote_zh: '已约 10 月 5 日', said_zh: denial, today: '2026-09-21', via: 'chat',
  }, FINDING)
  assert.notEqual(again.item.care_status, 'booked', 'deletion sticks when the quote is the page\'s line, not his booking')
  assert.equal(mod.careItems(dir).some((row) => row.care_status === 'booked'), false)
  const real = mod.logCareVisit(dir, {
    status: 'booked', visit_date: '2026-10-05', quote_zh: '我约了10月5日去社区医院', said_zh: '我约了10月5日去社区医院全科', today: '2026-09-21', via: 'chat',
  }, FINDING)
  assert.equal(real.item.care_status, 'booked')
  assert.equal(real.item.visit_date, '2026-10-05')
  assert.equal(real.item.confirmed, true)
  const shown = mod.triageCandidates({
    stage: 'routine', today: '2026-09-21',
    triage: {
      stop: { title_zh: '请先去看医生：血红蛋白', sentence_zh: '请先去看医生', needs_sex: false },
      findings: [{ id: 'finding-red-cell', status: 'open', priority: 'must_surface' }],
      care: [{ finding_id: 'finding-red-cell', care_status: 'booked', visit_date: '2026-10-05', outcome_zh: null, updated: '2026-09-21T00:00:00.000Z' }],
    },
  })
  assert.ok(shown.some((row) => row.title_zh.includes('已约 2026-10-05')))

  // Y30: HGB 124 with sex unset asks, and does not send her to haematology.
  const y30 = mod.clinicalStop({ sex: 'unknown', diabetesKnown: true, points: [{ name: '血红蛋白', value: 124, unit: 'g/L', date: '2026-04-16' }] })
  assert.equal(y30.stop, false)
  assert.equal(y30.needs_sex, true)
  assert.match(y30.sentence_zh, /填写性别/)
  assert.doesNotMatch(y30.sentence_zh, /血液科|男性下限/)
  assert.equal(mod.rangeFlag('hb', 124, 'unknown'), null)
  assert.equal(mod.clinicalStop({ sex: 'female', diabetesKnown: true, points: [{ name: '血红蛋白', value: 124, unit: 'g/L', date: '2026-04-16' }] }).stop, false)
  assert.equal(mod.rangeFlag('hb', 110, 'unknown')?.flag, 'low')

  // After 开始, a refresh with no DeepSeek decision still requires that consent.
  assert.equal(mod.deepseekConsentPending(null), true)
  assert.equal(mod.deepseekConsentPending(undefined), true)
  assert.equal(mod.deepseekConsentPending('granted'), false)
  assert.equal(mod.deepseekConsentPending('declined'), false)
  const fresh = tempDir('consent')
  const host = fakeHost()
  await mod.apply(host.ctx, configFor(fresh))
  const before = await host.ctx.llm.stream({
    system: 'LongPi',
    messages: [{ role: 'user', content: [{ type: 'text', text: '血红蛋白 124，我要看身体年龄' }] }],
  })
  const held = []
  for await (const chunk of before) held.push(chunk)
  assert.equal(host.ctx.llm.calls.length, 0, 'health text must not be sent before the DeepSeek consent')
  assert.match(held.map((chunk) => chunk.text ?? chunk.block?.text ?? '').join(''), /DeepSeek/)
  const chest = await host.ctx.llm.stream({
    messages: [{ role: 'user', content: [{ type: 'text', text: '我现在胸口剧痛出冷汗' }] }],
  })
  const aid = []
  for await (const chunk of chest) aid.push(chunk)
  assert.equal(host.ctx.llm.calls.length, 0)
  assert.match(aid.map((chunk) => chunk.text ?? '').join(''), /120/)
  await call(host, 'POST', '/api/longpi/privacy/consent', { scope: 'data_flow_deepseek', decision: 'granted' })
  await host.ctx.llm.stream({
    system: '你在帮助',
    messages: [{ role: 'user', content: [{ type: 'text', text: '血红蛋白 124' }] }],
  })
  assert.equal(host.ctx.llm.calls.length, 1)
  assert.match(JSON.stringify(host.ctx.llm.calls[0].messages), /血红蛋白/)

  console.log('fix-056a ok')
} finally {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
