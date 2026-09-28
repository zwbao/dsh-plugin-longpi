// 0.5.5: quiet home for low engagement, insulin wording after a low, inline consent for a home blood pressure.

import assert from 'node:assert/strict'
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { candidateSeeds, prefsEngage, syncEngage } from '../src/engage/engine.ts'
import { chapterList } from '../src/engage/seasons.ts'
import { DAILY_WORDING, QUIET_TITLE, quietenSurfaces, readQuiet, rememberAvoidance, statedAvoidance } from '../src/engage/quiet.ts'
import { followupTick, writeFollowup } from '../src/followup.ts'
import { guidanceNote, insulinHoldCorrection, replyRuleCheck } from '../src/guardrails.ts'
import { ensureHomeBp, replyConfirmsHomeBp, statedHomePressure, withConsentOffer } from '../src/home-bp.ts'
import { HYPO_NEXT_DOSE_ZH, holdsInsulin } from '../src/plan-safety.ts'
import { readSelf } from '../src/selfmeasure.ts'

const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-055-'))
  dirs.push(dir)
  return dir
}
const at = (day, time = '10:00') => new Date(`${day}T${time}:00+08:00`)
const labels = { acute_emergency: false, self_harm: false, med_change_request: false, personal_dose_request: false, research_question: false, reason: '' }

function profile(dir) {
  writeFileSync(join(dir, 'profile.json'), `${JSON.stringify({
    displayName: '林朔', birthYear: 1997, age: 29, sex: 'male', risk: {}, focus: [],
    consent: { version: '2026-09-24', accepted_at: '2026-07-27T01:00:00.000Z' },
  })}\n`)
}

function plan(dir) {
  mkdirSync(join(dir, 'interventions'), { recursive: true })
  writeFileSync(join(dir, 'interventions', 'plan.jsonl'), `${JSON.stringify({ schema: 'longpi-plan/1', items: [{ id: 'walk' }] })}\n`)
}

function card(id, text, extra = {}) {
  return { id, kind: 'suggestion', text_zh: text, fact_ids: [], number_keys: [], tone: 'neutral', source: 'fallback', ...extra }
}

function action(id, kind, title, detail) {
  return { id, kind, provider: 'M6', priority: 42, mandatory: false, reason_codes: ['engage'], fact_ids: [], target: { surface: 'page' }, title_zh: title, detail_zh: detail }
}

function surfaces(next, moreDetail) {
  return {
    version: 1,
    inputs_fp: 'fp',
    day: '2026-07-27',
    generated_at: '2026-07-27T02:00:00.000Z',
    valid_until: '2026-07-27T03:00:00.000Z',
    source: 'fallback',
    stale: false,
    greeting: card('greeting', '晚上好', { kind: 'greeting' }),
    status: card('status', '白细胞这次的变化，值得问问医生', { kind: 'status' }),
    next: { action: next, card: card('next', next.title_zh, { kind: 'next_step', detail_zh: next.detail_zh }) },
    more: [action('nba-season-quest', 'season_quest', '带着简报去看一次医生，回来记一笔', moreDetail)],
    suggestions: [card('followup-on', '每天晚上提醒我打卡', { prompt_zh: '每天晚上提醒我打卡' }), card('changes', '白细胞这个变化，我该问医生什么？', { prompt_zh: '白细胞这个变化，我该问医生什么？' })],
    validation: { passed: [], failed: [] },
  }
}

try {
  assert.equal(statedAvoidance('别天天提醒我'), true)
  assert.equal(statedAvoidance('真有事就用一句话告诉我'), true)
  assert.equal(statedAvoidance('告诉我一句话怎么吃'), false)
  assert.doesNotMatch(JSON.stringify(chapterList('data', 12)), DAILY_WORDING)
  assert.doesNotMatch(JSON.stringify(chapterList('care', 12)), DAILY_WORDING)
  assert.doesNotMatch(JSON.stringify(chapterList('generic', 12)), DAILY_WORDING)

  const quietDir = tempDir()
  profile(quietDir)
  const opened = syncEngage(quietDir, at('2026-07-27'))
  assert.equal(opened.pressure, false)
  assert.equal(opened.reminder_zh, null)
  const seeds = candidateSeeds(quietDir, at('2026-07-27'))
  assert.equal(seeds.some((row) => row.id === 'nba-season-quest'), false)
  assert.doesNotMatch(JSON.stringify(seeds), DAILY_WORDING)
  const pushed = quietenSurfaces(surfaces(action('nba-season-quest', 'season_quest', '带着简报去看一次医生，回来记一笔', '这一季只做几件事，不用每天打卡。'), '这一季只做几件事，不用每天打卡。'), { title_zh: '补充档案', detail_zh: '回答档案里的 6 个问题即可计算心血管风险。' }, readQuiet(quietDir))
  assert.doesNotMatch(JSON.stringify(pushed), DAILY_WORDING)
  assert.equal(pushed.more.some((row) => row.id === 'nba-season-quest'), false)
  assert.equal(pushed.suggestions.some((row) => row.text_zh === '白细胞这个变化，我该问医生什么？'), true)

  const planned = tempDir()
  profile(planned)
  plan(planned)
  syncEngage(planned, at('2026-07-27'))
  const kept = quietenSurfaces(surfaces(action('stage-checkin', 'checkin', '今天的打卡', '还有 1 项待完成'), '这一季只做几件事，不用每天打卡。'), { title_zh: '今天的打卡', detail_zh: '还有 1 项待完成' }, readQuiet(planned))
  assert.match(JSON.stringify(kept.next), /今天的打卡/)
  assert.equal(kept.more.some((row) => row.kind === 'season_quest'), false)
  assert.equal(kept.suggestions.some((row) => row.text_zh === '每天晚上提醒我打卡'), true)

  assert.equal(rememberAvoidance(planned, '别天天提醒我，只要一句话'), true)
  const avoided = readQuiet(planned)
  assert.equal(avoided.avoidance, true)
  assert.equal(avoided.optedIn, false)
  const stripped = quietenSurfaces(surfaces(action('stage-checkin', 'checkin', '今天的打卡', '还有 1 项待完成'), '不用每天打卡'), { title_zh: '今天的打卡', detail_zh: '还有 1 项待完成' }, avoided)
  assert.doesNotMatch(JSON.stringify(stripped), DAILY_WORDING)
  assert.match(JSON.stringify(stripped.next), new RegExp(QUIET_TITLE))

  prefsEngage(quietDir, { pressure: true }, at('2026-07-27'))
  const opted = syncEngage(quietDir, at('2026-07-27'))
  assert.equal(opted.pressure, true)
  const optedSeeds = candidateSeeds(quietDir, at('2026-07-27'))
  assert.equal(optedSeeds.some((row) => row.id === 'nba-season-quest'), true)
  assert.doesNotMatch(optedSeeds.find((row) => row.id === 'nba-season-quest').detail_zh, DAILY_WORDING)

  const held = tempDir()
  profile(held)
  writeFollowup(held, { enabled: true, desktop: true })
  rememberAvoidance(held, '别天天提醒我')
  const rows = await followupTick({
    dataDir: held,
    now: at('2026-09-24', '23:30'),
    getState: async () => ({
      stage: 'routine', consent_at: '2026-09-01T09:00:00.000Z', next_title_zh: '今天的打卡', next_detail_zh: '还有 1 项',
      plan_exists: true, checkin_items: 1, checkin_open: ['走路'], retests: [], week: { pct: null, streak: 0, next_retest: null },
    }),
  })
  assert.deepEqual(rows, [])

  const said = '我今天在试断食，打了胰岛素，现在心慌手抖，血糖3.3'
  const note = guidanceNote(labels, { hypoglycaemia: true, text: said })
  assert.match(note.text, /先吃 15 克快速吸收的糖/)
  assert.match(note.text, /下一次胰岛素或磺脲类的剂量，联系开药的医生/)
  assert.match(note.text, /120/)
  assert.doesNotMatch(note.text, /不要再注射/)
  assert.doesNotMatch(note.text, /停掉胰岛素/)
  assert.equal(holdsInsulin('也不要再注射胰岛素，补打的事交给开药的医生。'), true)
  assert.equal(holdsInsulin('今天不要再注射胰岛素'), true)
  assert.equal(holdsInsulin('把胰岛素停了'), true)
  assert.equal(holdsInsulin('不要自行停用胰岛素，请遵医嘱'), false)
  assert.equal(holdsInsulin(`先处理。${HYPO_NEXT_DOSE_ZH}`), false)
  const correction = insulinHoldCorrection()
  assert.match(correction.text, /15 克/)
  assert.match(correction.text, /开药的医生/)
  assert.match(correction.text, /120/)
  assert.doesNotMatch(correction.text, /不要再注射/)
  const safe = replyRuleCheck(`先吃 15 克快速吸收的糖（葡萄糖片或一小杯含糖果汁），15 分钟后复测。${HYPO_NEXT_DOSE_ZH}`)
  assert.equal(safe.med_change_advice, false)
  assert.equal(safe.personal_dose, false)

  const bp = statedHomePressure('帮我记录：今天早上血压 128/82')
  assert.deepEqual(bp, { sbp: 128, dbp: 82 })
  assert.equal(statedHomePressure('血压 128/82 正常吗'), null)
  assert.equal(replyConfirmsHomeBp('没能存下来：还没有单独同意。128/82', bp), false)
  assert.equal(replyConfirmsHomeBp('已记下收缩压 128 mmHg、舒张压 82 mmHg。', bp), true)
  const offered = withConsentOffer({ ok: true, saved: [{ key: 'sbp', value: 128, unit: 'mmHg' }, { key: 'dbp', value: 82, unit: 'mmHg' }], problems: [] })
  const parsed = JSON.parse(offered[0].text)
  assert.equal(parsed.saved[0].value, 128)
  assert.match(parsed.consent_offer_zh, /我单独同意处理我的健康信息/)
  assert.match(parsed.note, /不要说没存下来/)
  const bpDir = tempDir()
  assert.equal(ensureHomeBp(bpDir, bp, '2026-09-22'), true)
  assert.equal(ensureHomeBp(bpDir, bp, '2026-09-22'), false)
  const saved = readSelf(bpDir)
  assert.deepEqual(saved.map((row) => [row.key, row.value, row.date]), [['sbp', 128, '2026-09-22'], ['dbp', 82, '2026-09-22']])

  console.log('fix-055 ok')
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
