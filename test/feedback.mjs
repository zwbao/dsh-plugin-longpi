// Persona ground truth (p01–p10) maps onto the evidence grade, and the words follow.
// working → celebrate past the band; within noise → a progress story; wrong way → care;
// cannot tell → too early, not comparable, or a concrete hold. Never a bare 无法判断,
// never "younger" from noise or a single draw.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  announcesYounger,
  buildFeedback,
  gradeBioAge,
  gradeMarker,
  markerFromGroundTruth,
  mentionsDeathRisk,
  projectionSentence,
} from '../src/feedback/grade.ts'
import { retestAdvice } from '../src/feedback/retest-timing.ts'
import { shareCard } from '../src/feedback/share.ts'
import { retestReviewer } from '../src/agents/retest_reviewer.ts'

const root = dirname(fileURLToPath(import.meta.url))
const truths = JSON.parse(readFileSync(join(root, 'fixtures', 'persona-ground-truth.json'), 'utf8'))
const TODAY = '2026-09-21'
const textOf = (message) => `${message.headline_zh}${message.body_zh ?? ''}`

function withinWay(marker) {
  const delta = marker.delta_pct
  const better = marker.better
  if (delta == null || Math.abs(delta) < 0.05 || better === 'none' || better === 'range' || !better) return 'within_band_flat'
  if (better === 'lower') return delta < 0 ? 'within_band_improving' : 'within_band_worse'
  if (better === 'higher') return delta > 0 ? 'within_band_improving' : 'within_band_worse'
  return 'within_band_flat'
}

function expectGrade(marker) {
  const blocked = marker.blocked_by || ''
  if (/too soon/.test(blocked)) return 'too_early'
  if (/home mean|one office/.test(blocked)) return 'not_judgeable'
  if (/no direction/.test(blocked)) return 'not_judgeable'
  if (marker.verdict === 'working') return 'beyond_band_better'
  if (marker.verdict === 'wrong way') return 'beyond_band_worse'
  if (marker.verdict === 'within noise' || marker.verdict === 'cannot tell') return withinWay(marker)
  return 'not_judgeable'
}

const scenarioRule = {
  improves: { celebrate: true, share: true },
  improves_within_noise: { celebrate: false, share: false, story: true },
  worsens: { celebrate: false, worse: true, share: false },
  nonadherent: { celebrate: false, share: false },
  dropout: { celebrate: false, share: false },
  acute_red_flag: { celebrate: false, share: false },
  boundary_dose_and_stop: { celebrate: false, share: false },
  diabetes_missing_data: { celebrate: false, share: false },
}

for (let n = 1; n <= 10; n += 1) {
  const id = `p${String(n).padStart(2, '0')}`
  const truth = truths[id]
  assert.ok(truth, `${id} ground truth`)
  const markers = truth.markers.map((row) => markerFromGroundTruth(row, TODAY))
  const graded = markers.map((row) => gradeMarker(row, TODAY))
  truth.markers.forEach((raw, index) => {
    const message = graded[index]
    const expected = expectGrade(raw)
    assert.equal(message.grade, expected, `${id} ${raw.key} ${raw.verdict} / ${raw.blocked_by} → ${message.grade}, expected ${expected}`)
    assert.equal(message.allowed_claims.includes('younger'), false, `${id} ${raw.key} younger`)
    assert.equal(announcesYounger(textOf(message)), false, `${id} ${raw.key} announces younger: ${message.headline_zh}`)
    assert.equal(mentionsDeathRisk(textOf(message)), false)
    assert.doesNotMatch(message.headline_zh, /^无法判断/)
    assert.ok(message.headline_zh.length > 8, message.headline_zh)
    if (expected === 'beyond_band_better') {
      assert.ok(message.allowed_claims.includes('celebrate'), raw.key)
      assert.ok(message.allowed_claims.includes('improved'), raw.key)
      assert.match(message.headline_zh, /超出了测量波动，是真实的变化/)
    }
    if (expected.startsWith('within_band')) {
      assert.ok(message.allowed_claims.includes('progress_story'), raw.key)
      assert.ok(message.allowed_claims.includes('retest_when'), raw.key)
      assert.match(message.headline_zh, /波动/)
    }
    if (expected === 'beyond_band_worse') {
      assert.equal(message.tone, 'care')
      assert.match(message.headline_zh, /医生/)
    }
    if (expected === 'too_early') {
      assert.doesNotMatch(message.headline_zh, /真实的变化/)
      assert.ok(message.retest, raw.key)
      assert.match(`${message.headline_zh}${message.retest.why_zh}`, /90|天/)
    }
    if (raw.key === 'weight' && /no direction/.test(raw.blocked_by || '')) {
      assert.match(message.headline_zh, /没有单一的好坏方向/)
    }
    if (/home mean/.test(raw.blocked_by || '')) assert.match(message.headline_zh, /7 天/)
    if (/adherence/.test(raw.blocked_by || '')) assert.match(textOf(message), /执行/)
  })

  const panel = buildFeedback({ today: TODAY, markers, bioage: null, behaviours: [], projections: [] })
  const summary = panel.find((row) => row.id === 'fb-summary')
  assert.ok(summary, id)
  assert.equal(announcesYounger(textOf(summary)), false, summary.headline_zh)
  assert.doesNotMatch(summary.headline_zh, /^无法判断/)
  const rule = scenarioRule[truth.scenario]
  assert.ok(rule, truth.scenario)
  const celebrated = panel.some((row) => row.grade === 'beyond_band_better')
  assert.equal(celebrated, rule.celebrate, `${id} celebrate ${summary.headline_zh}`)
  assert.equal(shareCard(panel) != null, rule.share, id)
  if (rule.worse) assert.ok(panel.some((row) => row.grade === 'beyond_band_worse'), id)
  if (rule.story) {
    assert.match(summary.headline_zh, /方向对了|都还在测量波动/)
    assert.match(summary.headline_zh, /项/)
    assert.match(textOf(summary), /8–12 周|复测|复查/)
  }
  if (rule.celebrate) {
    assert.match(summary.headline_zh, /超出了测量波动，是真实的变化/)
    assert.match(textOf(summary), /\d+ 项里 \d+ 项/)
  }
}

// y27: one draw, PhenoAge 19.7 against age 33, is not "you got younger".
const first = gradeBioAge({
  points: [{ date: '2026-08-01', phenoage: 19.7, advance: 19.7 - 33 }],
  band_years: 2.9, band_verified: true, age: 33, phenoage: 19.7, advance: 19.7 - 33,
  date: '2026-08-01', draws: 1, same_lab: null,
}, '2026-08-01')
assert.equal(first.grade, 'first_draw')
assert.equal(first.allowed_claims.includes('younger'), false)
assert.equal(announcesYounger(first.headline_zh), false)
assert.match(first.headline_zh, /19\.7/)
assert.match(first.headline_zh, /不能说明你变年轻了/)
assert.match(first.headline_zh, /3 到 6 个月/)

// A swing inside the ±2.9 year band is a progress story, not a celebration.
const noise = gradeBioAge({
  points: [
    { date: '2026-01-01', phenoage: 40, advance: 0 },
    { date: '2026-05-01', phenoage: 38.8, advance: -1.2 },
  ],
  band_years: 2.9, band_verified: true, age: 40, phenoage: 38.8, advance: -1.2,
  date: '2026-05-01', draws: 2, same_lab: true,
}, '2026-05-01')
assert.equal(noise.grade, 'within_band_improving')
assert.equal(noise.allowed_claims.includes('younger'), false)
assert.match(noise.headline_zh, /波动/)
assert.equal(announcesYounger(noise.headline_zh), false)

// Past the band, after 3 months, same lab, verified: the one sentence that may say younger.
const real = gradeBioAge({
  points: [
    { date: '2026-01-01', phenoage: 40, advance: 0 },
    { date: '2026-05-01', phenoage: 36.6, advance: -3.4 },
  ],
  band_years: 2.9, band_verified: true, age: 40, phenoage: 36.6, advance: -3.4,
  date: '2026-05-01', draws: 2, same_lab: true,
}, '2026-05-01')
assert.equal(real.grade, 'beyond_band_better')
assert.equal(real.headline_zh, '你确实年轻了 3.4 岁（模型估计，超出了测量波动，是真实的变化）。')
assert.ok(real.allowed_claims.includes('younger'))
const shared = shareCard([real])
assert.equal(shared.headline_zh, real.headline_zh)

// Eight weeks is too soon for body age, even when the number moved a lot.
const early = gradeBioAge({
  points: [
    { date: '2026-07-27', phenoage: 40, advance: 0 },
    { date: '2026-09-21', phenoage: 36, advance: -4 },
  ],
  band_years: 2.9, band_verified: true, age: 40, phenoage: 36, advance: -4,
  date: '2026-09-21', draws: 2, same_lab: true,
}, '2026-09-21')
assert.equal(early.grade, 'too_early')
assert.equal(early.allowed_claims.includes('younger'), false)
assert.equal(announcesYounger(early.headline_zh), false)

const lipids = retestAdvice('ldl')
assert.equal(lipids.earliestDays, 56)
assert.equal(lipids.recommendedDays, 84)
assert.match(lipids.why_zh, /8–12 周/)
const glucose = retestAdvice('glucose')
assert.equal(glucose.family, 'glucose')
assert.equal(glucose.earliestDays, 56)
const weight = retestAdvice('weight')
assert.equal(weight.family, 'weight')
const a1c = retestAdvice('hba1c')
assert.equal(a1c.minDays, 90)
const body = retestAdvice('bioage')
assert.equal(body.earliestDays, 90)
assert.equal(body.recommendedDays, 180)

assert.equal(
  projectionSentence('空腹血糖', '5.2', -1, '6.1'),
  '模型估计：空腹血糖降到 5.2，身体年龄约年轻 1 岁。',
)
assert.equal(mentionsDeathRisk(projectionSentence('空腹血糖', '5.2', -1, '6.1')), false)

const affirmed = buildFeedback({
  today: TODAY,
  markers: [],
  bioage: null,
  behaviours: [{ key: 'walk', title_zh: '快走', date: TODAY }],
  projections: [{ label_zh: '空腹血糖', from_zh: '6.1', target_zh: '5.2', years: -1 }],
})
const behaviour = affirmed.find((row) => row.grade === 'behaviour_done')
assert.match(behaviour.headline_zh, /快走/)
assert.ok(behaviour.allowed_claims.includes('affirm'))
const projection = affirmed.find((row) => row.grade === 'projection')
assert.match(projection.headline_zh, /^模型估计：/)
assert.equal(projection.allowed_claims.includes('younger'), false)

// The reviewer keeps the grade and refuses a younger sentence the grade does not allow.
const pack = { today: TODAY, fp: 'x', feedback: [noise] }
assert.deepEqual(retestReviewer.fallback(pack).messages, [{ id: noise.id, headline_zh: noise.headline_zh }])
const rejected = retestReviewer.validate({ messages: [{ id: noise.id, headline_zh: '你确实年轻了 1.2 岁，超出了测量波动，是真实的变化。' }] }, pack)
assert.equal(rejected.ok, false)
const kept = retestReviewer.validate({ messages: [{ id: noise.id, headline_zh: noise.headline_zh }] }, pack)
assert.equal(kept.ok, true)

const repo = join(root, '..')
for (const file of ['src/client/goals.ts', 'src/client/results.ts', 'src/client/feedback/feedback-card.ts', 'src/feedback/grade.ts']) {
  const source = readFileSync(join(repo, file), 'utf8')
  assert.equal(source.includes('10 年死亡风险'), false, file)
}
assert.equal(readFileSync(join(repo, 'src/client/results.ts'), 'utf8').includes('比实足年龄年轻'), false)
assert.equal(
  readFileSync(join(repo, 'src/agents/prompts/retest_reviewer.md'), 'utf8'),
  readFileSync(join(repo, 'skills/longpi-feedback/retest_reviewer.md'), 'utf8'),
)
assert.equal(
  readFileSync(join(repo, 'src/agents/prompts/coach.feedback.md'), 'utf8'),
  readFileSync(join(repo, 'skills/longpi-feedback/coach.feedback.md'), 'utf8'),
)

console.log('feedback ok')
