// 0.6.3 (FIX063): the reply shape keeps the three parts for record changes, status and plan chatter only, and
// drops the length budget for advice, symptoms, result reviews, "did my plan work" and emergencies. Whatever the
// shape, three things must be in the reply when they apply, and the guard adds what is missing: the earliest retest
// date, the doctor-brief offer, and an older person's medication review. A spoken yes to a plan that was already
// read to the person saves it in the same turn, with one approval. Every value here is made up.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'
import { personaLines } from '../src/prompt.ts'
import { completenessGaps, doctorLineGap, medicationReview, retestDue, saysWhenToRetest, BRIEF_SENTENCE } from '../src/advice/complete.ts'
import { isSaveConsent, pendingConfirmedSave, SAVE_NOW_NOTE } from '../src/save-consent.ts'
import { latestToolResult, turnTools } from '../src/guard-llm.ts'
import { startFakeMirobody } from './fake-mirobody.mjs'
import { skillsHome } from './lib/skills-home.mjs'

const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-int063-${name}-`))
  temp.push(dir)
  return dir
}

function userMessage(text) {
  return { id: `u-${Math.random().toString(36).slice(2)}`, role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }
}

/** A session holding one turn: the person's words, tool calls with their results, and the reply. */
function turnAgent(turn, userText, calls, reply, earlier = []) {
  const steered = []
  const events = [...earlier, { type: 'turn/start', data: { turn } }, { type: 'user/message', data: userMessage(userText) }]
  calls.forEach((call, index) => {
    const callId = `call-${turn}-${index}`
    events.push({ type: 'assistant/message', data: { turn, step: index + 1, message: { role: 'assistant', content: [{ type: 'tool-call', id: callId, name: call.name, arguments: JSON.stringify(call.args) }] } } })
    events.push({ type: 'tool/call', data: { turn, step: index + 1, callId, name: call.name, arguments: JSON.stringify(call.args) } })
    events.push({ type: 'tool/result', data: { turn, step: index + 1, message: { source: { kind: 'tool', callId }, content: [{ type: 'tool-result', toolCallId: callId, content: [{ type: 'text', text: JSON.stringify(call.result) }] }] } } })
  })
  events.push({ type: 'assistant/message', data: { turn, step: calls.length + 1, message: { role: 'assistant', content: [{ type: 'text', text: reply }] } } })
  const session = { id: `s-${turn}-${reply.length}-${Math.random()}`, get seq() { return events.length }, eventAt: (seq) => ({ ...events[seq], seq }), requestHeader: () => undefined }
  return { agent: { options: { provider: 'p', model: 'm' }, session, steer: (message) => { steered.push(message) } }, steered, events }
}

const PLAN_ARGS = { title: '秋季方案', source: 'chat', items: [{ category: 'exercise', title: '快走', start: '2026-07-28', markers: ['体重'] }] }
const READ_BACK = { ok: true, saved: false, title: '秋季方案', read_back: ['方案：秋季方案', '运动｜快走；2026-07-28 起；看 体重'], warnings: [] }
const REVIEW = {
  today: '2026-09-22',
  items: [
    { title: '限时进食', start: '2026-07-02', verdicts: [{ marker: '体重', verdict: '波动内', next_retest: null, first_due: null, followup: { date: '2026-09-21', value: 70.1 } }] },
    { title: '减盐', start: '2026-07-02', verdicts: [{ marker: '收缩压', verdict: '无法判断', next_retest: null, first_due: null, followup: null }] },
    { title: '车前子', start: '2026-09-01', verdicts: [{ marker: '低密度脂蛋白胆固醇', verdict: '无法判断', next_retest: '2026-10-27', first_due: '2026-10-27', followup: null }] },
  ],
}

try {
  // --- 1. the reply shape and the save rule in the prompt ----------------------------------------------------------
  const lines = personaLines({ mounted: true, peer: false, error: '', pluginHome: '' })
  const shape = lines.find((line) => line.startsWith('Reply shape'))
  assert.ok(shape, 'one reply-shape rule')
  assert.match(shape, /what changed in the record, about status .* or plan chatter .* three short parts/)
  assert.match(shape, /An advice question .* a symptom, a review of a result .* whether their plan worked, and an emergency have no length budget/)
  assert.match(shape, /The only length cap: when they ask for a short answer/)
  assert.match(shape, /earliest retest date/)
  assert.match(shape, /我可以根据这些结果整理一份就诊简报/)
  assert.match(shape, /带上全部药盒去老年科或药师门诊做用药评估/)
  assert.match(shape, /Length never removes the concrete answer/)
  assert.doesNotMatch(lines.join('\n'), /250 Chinese characters|about 450|about 600/, 'no character budget is left')
  const save = lines.find((line) => line.startsWith('Their plan is theirs to accept'))
  assert.match(save, /that yes is the confirmation: in the same turn call save_intervention_plan with confirm=false and then, with the same plan, confirm=true/)
  assert.match(save, /Do not read the plan back again and do not ask them to say 保存 again/)

  // --- 2. the earliest retest date ------------------------------------------------------------------------------------
  const due = retestDue(REVIEW)
  assert.deepEqual(due.map((row) => [row.marker, row.date, row.days, row.anchor]), [
    ['低密度脂蛋白胆固醇', '2026-10-27', 56, 'start'],
    ['体重', '2026-11-16', 56, 'retest'],
  ], 'a too-early verdict keeps its date; a 波动内 weight opens 8 weeks after the retest; home blood pressure has no date')
  assert.equal(saysWhenToRetest('再隔 8–12 周复查，才看得出是不是确切变化。'), true)
  assert.equal(saysWhenToRetest('体重最早 2026-11-16 再复查。'), true)
  assert.equal(saysWhenToRetest('三项里一项波动内、两项无法判断，数据还不够。'), false)
  assert.equal(saysWhenToRetest('11 月中旬复查血脂。'), true)
  let gaps = completenessGaps({ userText: '复测结果我已经放进记录了。我的方案有没有效果？', reply: '目前还不能说这份方案有效：一项波动内、两项无法判断。', tools: [{ name: 'review_interventions', args: {}, result: REVIEW }] })
  assert.deepEqual(gaps.map((gap) => gap.id), ['retest_date'])
  assert.match(gaps[0].say, /低密度脂蛋白胆固醇下次复查最早在 2026-10-27（从方案开始算满 8 周）/)
  assert.match(gaps[0].say, /体重下次复查最早在 2026-11-16（离这次复测满 8 周）/)
  gaps = completenessGaps({ userText: '我的方案有没有效果？', reply: '体重还在波动内，最早 2026-11-16 再复查。', tools: [{ name: 'review_interventions', args: {}, result: REVIEW }] })
  assert.equal(gaps.length, 0, 'a reply that says when to retest passes')
  gaps = completenessGaps({ userText: '我的方案有没有效果？', reply: '还不能判断。', tools: [] })
  assert.equal(gaps.length, 0, 'no review this turn, nothing to add')

  // --- 3. the doctor-brief offer ---------------------------------------------------------------------------------------
  const situation = { doctor_first_zh: '请先去看医生：血红蛋白 101 g/L（2026-05-02）偏低。', record_changes: [] }
  const toDoctor = '血红蛋白 101 g/L 偏低，铁蛋白 6 ng/mL 也偏低，请先去看血液科，尽量 1 到 2 周内去，带上这几次报告。'
  gaps = completenessGaps({ userText: '这次复查的铁蛋白是多少？算正常吗？我接下来该做什么？', reply: toDoctor, tools: [{ name: 'read_personal_situation', args: {}, result: situation }] })
  assert.deepEqual(gaps.map((gap) => gap.id), ['doctor_brief'])
  assert.equal(gaps[0].say, BRIEF_SENTENCE)
  gaps = completenessGaps({ userText: '这次复查的铁蛋白是多少？算正常吗？', reply: `${toDoctor}我可以按这些结果整理一份给医生看的简报。`, tools: [], situation })
  assert.equal(gaps.length, 0, 'an offered brief passes; the session\'s earlier situation counts')
  gaps = completenessGaps({ userText: 'NMN 每天吃多少合适？', reply: `血红蛋白 101 g/L 偏低，仍请先去看血液科。NMN 人体试验用过每天 250 到 1200 mg。`, tools: [], situation })
  assert.equal(gaps.length, 0, 'a supplement question with the one-line doctor opener does not repeat the offer')
  gaps = completenessGaps({ userText: '这个结果正常吗？', reply: '空腹血糖正常，处方药要找内分泌科开。', tools: [{ name: 'read_personal_situation', args: {}, result: { doctor_first_zh: '', record_changes: [] } }] })
  assert.equal(gaps.length, 0, 'no doctor-first finding, no offer needed')
  gaps = completenessGaps({ userText: '这几项变化要紧吗？', reply: '白细胞这次变化超出了正常波动，建议带着这几次报告去看医生。', tools: [{ name: 'read_personal_situation', args: {}, result: { record_changes: [{ label_zh: '白细胞计数', ask_doctor: true }] } }] })
  assert.deepEqual(gaps.map((gap) => gap.id), ['doctor_brief'], 'a change to show a doctor is a doctor step too')

  const withDepts = '请先去看医生：血红蛋白 101 g/L（2026-05-02）偏低，铁蛋白 6 ng/mL 偏低。请带着这几次体检报告去看医生（可以先看全科或血液科，缺铁的原因常要消化科一起查，尽量在 1 到 2 周内去），查清原因。'
  assert.equal(doctorLineGap(withDepts, '请先去看全科或血液科。'), '缺铁的原因常要消化科一起查，尽量在 1 到 2 周内去。', 'a dropped specialist and time come back')
  assert.equal(doctorLineGap(withDepts, '请先去看血液科和消化科，1 到 2 周内去。'), null)
  assert.equal(doctorLineGap(withDepts, '去消化科和血液科查，尽量两周内。'), null, 'two weeks in words is a time too')
  assert.equal(doctorLineGap(withDepts, '去消化科和血液科查。'), '尽量在 1 到 2 周内去。')
  gaps = completenessGaps({ userText: '帮我根据体检做一个 3 个月减脂方案', reply: '请先去看全科或血液科，尽量 1 到 2 周内去。等医生看过之前先走路。我可以按这些结果整理一份给医生看的简报。', tools: [{ name: 'read_personal_situation', args: {}, result: { doctor_first_zh: withDepts } }] })
  assert.deepEqual(gaps.map((gap) => [gap.id, gap.say]), [['doctor_line', '缺铁的原因常要消化科一起查。']])

  // --- 4. an older person's medication review ----------------------------------------------------------------------------
  const asked = '我爸82岁，每天吃6种药：氨氯地平、厄贝沙坦、格列齐特、唑吡坦、瑞舒伐他汀、阿司匹林，最近总头晕，哪个能停？'
  const meds = medicationReview(asked)
  assert.deepEqual(meds.concerns.map((row) => row.name), ['唑吡坦', '格列齐特'])
  assert.deepEqual(meds.bp, ['氨氯地平', '厄贝沙坦'])
  gaps = completenessGaps({ userText: asked, reply: '我不能替他决定停哪一种，头晕要请医生看。', tools: [] })
  assert.deepEqual(gaps.map((gap) => gap.id), ['med_review'])
  for (const want of [/全部药盒/, /老年科或医院的药师门诊做一次用药评估/, /唑吡坦是安眠药/, /格列齐特是磺脲类降糖药/, /氨氯地平和厄贝沙坦都是降压药.*体位性低血压/, /防跌倒/]) assert.match(gaps[0].say, want)
  const complete = '不能替他决定停哪一种。带上全部药盒去老年科或药师门诊做用药评估。格列齐特容易低血糖，唑吡坦夜里起身容易跌倒，氨氯地平和厄贝沙坦叠在一起可能体位性低血压，量一下躺着和站着的血压。家里先防跌倒。'
  assert.equal(completenessGaps({ userText: asked, reply: complete, tools: [] }).length, 0, 'a complete review passes')
  assert.equal(medicationReview('我 45 岁，吃氨氯地平、二甲双胍和阿托伐他汀，能停一个吗？'), null, 'not an older person')
  assert.equal(medicationReview('我妈 58 岁，每天吃 4 种药，头晕'), null, 'a stated age under 65 is not an older person')
  assert.equal(medicationReview('奶奶在吃阿司匹林，要紧吗？'), null, 'one medicine is not a list')
  assert.ok(medicationReview('奶奶每天吃好几种药，老是头晕，能不能少吃几样？'), 'an elder with several medicines is')

  // --- 5. a spoken yes saves ------------------------------------------------------------------------------------------------
  for (const yes of ['可以，就按上次读给我的那份方案保存吧。', '可以，就按这份方案保存吧。', '行，就按这个方案保存。', '确认保存', '好的，保存吧']) assert.equal(isSaveConsent(yes), true, yes)
  for (const no of ['我最关心的是减重。先按我的检查结果起草一份方案，读给我听，先别保存。', '按这个重新起草一份方案，读给我听，先别保存。', '孩子那张疫苗单你也存一下，就存在我这个人下面', '先不要保存', '保存之前我想把快走换成游泳']) assert.equal(isSaveConsent(no), false, no)
  const readBack = { name: 'save_intervention_plan', args: { ...PLAN_ARGS, confirm: false }, result: READ_BACK }
  assert.ok(pendingConfirmedSave('可以，就按这份方案保存吧。', [readBack]))
  assert.equal(pendingConfirmedSave('可以，就按这份方案保存吧。', [readBack, { name: 'save_intervention_plan', args: { ...PLAN_ARGS, confirm: true }, result: null }]), null, 'a confirm=true call already went (saved, denied or refused)')
  assert.equal(pendingConfirmedSave('可以，就按这份方案保存吧。', [{ ...readBack, result: { ok: false, saved: false, errors: ['缺开始日期'] } }]), null, 'a read-back with errors is not saved')
  assert.equal(pendingConfirmedSave('可以，就按这份方案保存吧。', []), null, 'no read-back this turn (an empty draft), nothing to save')
  assert.equal(pendingConfirmedSave('读给我听，先别保存。', [readBack]), null)

  // --- 6. the guard at the end of the turn --------------------------------------------------------------------------------------
  const guardDir = tempDir('guard')
  const guard = mod.createGuard({}, { dataDir: () => guardDir, timeoutMs: 50 })
  const signal = new AbortController().signal
  let run = turnAgent(3, '可以，就按上次读给我的那份方案保存吧。', [readBack], '要我保存的方案先读给你听：运动｜快走。你回一句「保存」，我就照这份存下。')
  assert.equal(turnTools(run.agent.session, 3).length, 1)
  assert.equal(turnTools(run.agent.session, 3)[0].result.saved, false)
  await guard.turnStopping({ agent: run.agent, turn: 3, signal })
  assert.equal(run.steered.length, 1, 'a yes that stopped at the read-back is sent back to save')
  assert.equal(run.steered[0].content[0].text, SAVE_NOW_NOTE)
  assert.match(SAVE_NOW_NOTE, /exactly the same arguments as the read-back above and confirm=true/)
  run = turnAgent(4, '先按我的检查结果起草一份方案，读给我听，先别保存。', [readBack], '方案读给你听：运动｜快走。还没有保存。')
  await guard.turnStopping({ agent: run.agent, turn: 4, signal })
  assert.equal(run.steered.length, 0, '先别保存 is respected')
  run = turnAgent(5, '我的方案有没有效果？', [{ name: 'review_interventions', args: {}, result: REVIEW }], '目前还不能说这份方案有效：一项波动内、两项无法判断，数据还不够。')
  await guard.turnStopping({ agent: run.agent, turn: 5, signal })
  assert.equal(run.steered.length, 1, 'a missing retest date is added')
  assert.match(run.steered[0].content[0].text, /体重下次复查最早在 2026-11-16/)
  const earlier = [
    { type: 'turn/start', data: { turn: 1 } },
    { type: 'tool/call', data: { turn: 1, callId: 'rps-1', name: 'read_personal_situation', arguments: '{}' } },
    { type: 'tool/result', data: { turn: 1, message: { source: { kind: 'tool', callId: 'rps-1' }, content: [{ type: 'tool-result', toolCallId: 'rps-1', content: [{ type: 'text', text: JSON.stringify(situation) }] }] } } },
    { type: 'turn/end', data: { turn: 1 } },
  ]
  run = turnAgent(6, '这次复查的铁蛋白是多少？算正常吗？我接下来该做什么？', [], toDoctor, earlier)
  assert.equal(latestToolResult(run.agent.session, 'read_personal_situation').doctor_first_zh, situation.doctor_first_zh)
  await guard.turnStopping({ agent: run.agent, turn: 6, signal })
  assert.equal(run.steered.length, 1, 'the doctor-brief offer is added from the session\'s situation')
  assert.match(run.steered[0].content[0].text, /整理一份就诊简报/)
  run = turnAgent(7, asked, [], '我不能替他决定停哪一种，头晕要请医生看。')
  await guard.turnStopping({ agent: run.agent, turn: 7, signal })
  assert.equal(run.steered.length, 1)
  assert.match(run.steered[0].content[0].text, /全部药盒[\s\S]*唑吡坦[\s\S]*格列齐特[\s\S]*体位性低血压[\s\S]*防跌倒/)
  run = turnAgent(8, asked, [], complete)
  await guard.turnStopping({ agent: run.agent, turn: 8, signal })
  assert.equal(run.steered.length, 0, 'nothing to add to a complete review')

  // --- 7. the tools say the same ------------------------------------------------------------------------------------------------
  const home = skillsHome('data/effects.jsonl')
  if (home) {
    const server = await startFakeMirobody()
    servers.push(server)
    const dataDir = tempDir('tools')
    const tools = new Map()
    const ctx = {
      tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
      skills: { register: () => () => {} },
      systemPrompt: { section: () => {} },
      webServer: { register: () => () => {} },
      connection: { requestRejection: () => undefined },
      commands: { register: () => {} },
      inject: (_names, callback) => callback(ctx),
      on: () => () => {},
      effect: (execute) => execute(),
    }
    await mod.apply(ctx, {
      mcpUrl: server.url, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
      dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
    })
    const checked = await tools.get('save_intervention_plan').execute({ ...PLAN_ARGS, confirm: false })
    assert.equal(checked.saved, false)
    assert.match(checked.next, /already agreed to save this plan .* that is the confirmation: call again now with the same plan and confirm=true/)
    const draftText = JSON.stringify(tools.get('draft_intervention_plan').description ?? '')
    assert.ok(draftText.length > 0)
  } else {
    console.log('int-063: tool texts skipped (no longevity-skills checkout with data/)')
  }
  console.log('int-063 ok')
} finally {
  for (const server of servers) await server.close?.()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
