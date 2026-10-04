// 0.6.2 UX: plain copy, movement lines, three-part replies, science on by default.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Config } from '../src/config.ts'
import { declineInvite, inviteVisible, isMinorProfile, mayTransmit, resolveRunningMode, writeSciencePref } from '../src/science/choice.ts'
import { effectiveMode, startScience } from '../src/science/index.ts'
import { buildCommunity } from '../src/science/community.ts'
import { movementOf, pickKeyTrends, readerObstacles, FACING_SAMPLES, concreteNext, insightSentence, suggestedQuestions, buildTimeline, judgementText, scrubVisible, SCIENCE_INTRO, OUTBOX_ZH } from '../src/ux/plain.ts'
import { replyHasThreeParts, shapeReply } from '../src/ux/reply.ts'
import { calendarEvents, confirmEvent, saveEvent, suggestEvent } from '../src/ux/schedule.ts'
import { personaLines } from '../src/prompt.ts'
import { writeProfile } from '../src/profile.ts'

const root = fileURLToPath(new URL('..', import.meta.url))
const temp = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-ux062-'))
  temp.push(dir)
  return dir
}

try {
  assert.equal(Config({}).scienceMode, 'local')
  assert.equal(Config({}).scienceModeSet, false)
  assert.equal(Config({ scienceMode: 'simulated' }).scienceMode, 'simulated')

  const fresh = tempDir()
  assert.equal(resolveRunningMode('off', false, fresh), 'local', 'old default off moves to local')
  assert.equal(resolveRunningMode('off', true, fresh), 'off', 'an explicit config off stays off')
  writeSciencePref(fresh, 'off', '2026-09-01T00:00:00.000Z')
  assert.equal(resolveRunningMode('local', false, fresh), 'off', 'a person who turned it off stays off')
  writeSciencePref(fresh, 'local', '2026-09-02T00:00:00.000Z')
  assert.equal(resolveRunningMode('off', false, fresh), 'local')

  const minor = tempDir()
  writeProfile(minor, { age: 16, sex: 'female' })
  assert.equal(isMinorProfile(minor), true)
  assert.equal(resolveRunningMode('local', false, minor), 'off')
  writeSciencePref(minor, 'local')
  assert.equal(resolveRunningMode('local', true, minor), 'off', 'a minor stays off even if the file says on')

  const adult = tempDir()
  writeProfile(adult, { age: 45, sex: 'female' })
  assert.equal(inviteVisible({ dataDir: adult, mode: 'local', today: '2026-09-29' }), true)
  declineInvite(adult, '2026-09-20T00:00:00.000Z')
  assert.equal(inviteVisible({ dataDir: adult, mode: 'local', today: '2026-09-29' }), false, '30-day cooldown')
  assert.equal(inviteVisible({ dataDir: adult, mode: 'local', today: '2026-10-21' }), true)
  assert.equal(inviteVisible({ dataDir: minor, mode: 'local', today: '2026-09-29' }), false)

  const dev = mayTransmit({ published: true, keyId: 'longpi-sim-dev-1' })
  assert.equal(dev.ok, false)
  assert.match(dev.reason_zh, /只保存在你的设备上/)
  assert.equal(mayTransmit({ published: false, keyId: 'longpi-prod-1' }).ok, false)
  let sent = 0
  const gate = mayTransmit({ published: false, keyId: 'longpi-sim-dev-1' })
  if (gate.ok) sent += 1
  assert.equal(sent, 0, 'no network send before a production-feed study')
  assert.equal(mayTransmit({ published: true, keyId: 'longpi-prod-1' }).ok, true)

  startScience({ configured: () => 'local', dataDir: () => adult })
  assert.equal(effectiveMode(), 'local')
  const community = buildCommunity({ dataDir: adult, configured: 'local' })
  assert.equal(community.mode, 'local')
  assert.match(community.reason_zh, /只保存在你的设备上/)
  for (const row of community.thresholds) {
    assert.match(row.line_zh, /目标 \d+ 人 · 招募中/)
    assert.doesNotMatch(row.line_zh, /\d+\s*\/\s*\d+/)
  }
  assert.equal(community.pulse, null)
  for (const study of community.studies) assert.ok(study.questions.length <= 2, study.id)

  const move = movementOf([
    { date: '2023-11-14', value: 152 },
    { date: '2024-09-18', value: 138 },
    { date: '2026-02-11', value: 116 },
  ], 'g/L')
  assert.ok(move)
  assert.match(move.lead, /152 → 116/)
  assert.match(move.lead, /3 次/)
  assert.match(move.lead, /2023 年 11 月 14 日–(2026 年 )?2 月 11 日/)
  assert.ok((move.pct ?? 0) < 0)

  const trends = pickKeyTrends([
    { label_zh: '空腹血糖', text_zh: '没怎么变', ask_doctor: false },
    { label_zh: '血红蛋白', text_zh: '152 → 116', ask_doctor: true },
    { label_zh: '总胆固醇', text_zh: '略高', ask_doctor: false },
    { label_zh: '甘油三酯', text_zh: '略高', ask_doctor: false },
    { label_zh: '尿酸', text_zh: '略高', ask_doctor: false },
  ], true)
  assert.equal(trends[0]?.label_zh, '血红蛋白')
  assert.ok(trends.length >= 2 && trends.length <= 4)

  assert.equal(insightSentence({ sleepHours: null, steps: null, labNote: null }), null)
  assert.match(insightSentence({ sleepHours: 5.5, steps: 3200, labNote: '血红蛋白最近在往下走。' }) ?? '', /昨晚睡眠/)
  assert.match(suggestedQuestions({ changes: ['血红蛋白'], visit: '2026-12-20' })[1], /^下次 (2026 年 )?12 月 20 日就诊时，我应该询问哪些问题？$/)
  assert.equal(concreteNext([{ item_zh: '腰围', unlocks_zh: '心血管风险', self_measurable: true, self_key: 'waist' }]).title_zh, '量一次腰围')
  assert.match(judgementText('within', true), /尚不能视为真实变化/)
  assert.match(judgementText('beyond', true), /建议咨询医生/)

  const timeline = buildTimeline({
    checkups: [{ date: '2026-02-11', note: 'C反应蛋白' }],
    wearables: [{ date: '2026-02-10', label_zh: '每晚睡眠', value_zh: '5 小时' }],
    life: [{ date: '2026-02-09', kind: 'sick', note: '感冒' }],
  })
  assert.deepEqual(timeline.map((row) => row.date), ['2026-02-09', '2026-02-10', '2026-02-11'])
  assert.equal(timeline[0]?.title_zh, '今天生病')

  const short = shapeReply({
    question: '血红蛋白怎么了？',
    seen: '从 152 到 116 g/L，比平常的起伏更大。',
    unknown: '这几次数值说明不了是什么病，也说明不了是哪件事造成的。',
    next: '下次看医生时把这几份报告带上。',
    offerBrief: true,
  })
  assert.equal(replyHasThreeParts(short), true)
  assert.match(short, /就诊简报/)
  assert.ok(short.split('\n').filter((line) => line && !line.startsWith('我看到') && !line.startsWith('数据') && !line.startsWith('下一步')).every((line) => line.length < 90))
  const emergency = shapeReply({
    question: '我胸口疼',
    seen: '你说现在胸口疼。',
    unknown: '这里不能判断是不是心脏的问题。',
    next: '先按急救来。',
    emergency: '请立即拨打 120。',
  })
  assert.ok(emergency.startsWith('请立即拨打 120'))
  assert.equal(scrubVisible('Mirobody MCP record_status ~/.dsh/longpi tok/s User says: hi').includes('Mirobody'), false)

  const lines = personaLines({ mounted: true, peer: false, error: '', pluginHome: '' })
  // Pi's voice (owner decision, 0.9): Pi speaks first; status replies have no headings and end with the one thing this week
  assert.match(lines[0], /^You are Pi, the longevity coach of LongPi/)
  assert.ok(lines.some((line) => /Counts are cumulative: a missed day never resets anything/.test(line)))
  assert.ok(lines.some((line) => /has no headings/.test(line) && line.includes('这周就这一件事')))
  assert.ok(!lines.some((line) => line.includes('数据尚不能说明的')), 'the three headings are gone from the persona')
  assert.ok(lines.some((line) => /Every number you cite comes from a tool result/.test(line)), 'LongPi\'s rules still bound the facts')

  const scheduleDir = tempDir()
  const suggested = suggestEvent({ date: '2026-12-20', kind: 'retest', title_zh: '复查血红蛋白', brief_zh: '带上简报', questions_zh: ['这次和上次差多少？'] })
  assert.equal(suggested.confirmed, false)
  saveEvent(scheduleDir, suggested)
  assert.equal(calendarEvents(scheduleDir).length, 0, 'a suggestion is not a date')
  saveEvent(scheduleDir, confirmEvent(suggested))
  assert.equal(calendarEvents(scheduleDir).length, 1)

  for (const sample of FACING_SAMPLES) {
    const hits = readerObstacles(sample)
    assert.deepEqual(hits, [], sample)
  }
  assert.equal(readerObstacles('病历保存在你自己的 Mirobody 中').includes('Mirobody'), true)
  assert.match(SCIENCE_INTRO, /个人小试验/)
  assert.match(OUTBOX_ZH, /只保存在你的设备上/)

  const client = readFileSync(join(root, 'src/client/page.ts'), 'utf8')
  for (const label of ['总览', '化验', '睡眠', '运动', '日程', '问 LongPi']) assert.match(client, new RegExp(label))
  assert.match(readFileSync(join(root, 'src/client/engage/season-tab.ts'), 'utf8'), /本赛季 · 第/)
  assert.match(readFileSync(join(root, 'src/client/engage/codex.ts'), 'utf8'), /概率说明/)
  assert.doesNotMatch(readFileSync(join(root, 'src/client/page.ts'), 'utf8'), /Mirobody/)
  assert.doesNotMatch(readFileSync(join(root, 'src/client/constants.ts'), 'utf8'), /Mirobody/)

  console.log('ux-062 ok')
} finally {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
