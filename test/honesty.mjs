// Honesty: the same marker joined across names, 太早 and 不可比 kept apart from
// 波动内, wearable days counted without a check-in, numbers not printed raw,
// and China-PAR's age window named.
import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { bodyAgeWording, compareGate, formatNumber, judgeSeries, missedPlanChanges, modelRangeNote } from '../src/honesty/index.ts'
import { checkupMarkerFor, loadReference as loadReferenceSrc } from '../src/reference.ts'

const root = dirname(fileURLToPath(import.meta.url))
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'data', 'biological_variation.json')) ? sibling : '')
if (!home || !existsSync(join(home, 'data', 'biological_variation.json'))) {
  console.log('honesty skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const bv = mod.loadReference(home).biovar
const rowOf = (key) => bv.markers.find((marker) => marker.key === key)
const at = (date, value, unit, file = '') => ({ date, time: `${date} 08:00:00`, value, unit, ...(file ? { file } : {}) })
const itemOf = (id, title, markers, start, category = 'exercise') => ({
  id, category, title, detail: '', start, end: null, frequency: null, target: null, markers, mirobody: null,
})
const followed = { source: 'wearable', rate: 0.9, coverage: 0.9, known_days: 50, done_days: 45, window_days: 56, level: 'good', streak: 3, calendar: [], note_zh: '' }
const judge = (item, marker, series, extra = {}) => mod.evaluateMarker(item, marker, {
  plan: { items: [item] }, today: '2026-09-21', markers: {}, series, adherence: { [item.id]: followed },
  courses: [], checkins: [], biovar: bv, effects: [], ...extra,
})

// A risk the model used to copy out of the tool JSON in full.
assert.equal(formatNumber({ value: 0.0871529403318675, unit: '%' }), '0.1 %')
assert.equal(formatNumber({ value: 6.58, unit: 'mmol/L' }), '6.58 mmol/L')
assert.equal(formatNumber({ value: 40.8, unit: '岁' }), '40.8 岁')
assert.equal(formatNumber({ value: 30, unit: '岁' }), '30 岁')
assert.equal(modelRangeNote('china-par', 40), null)
assert.match(modelRangeNote('china-par', 33) ?? '', /35–74/)
assert.match(modelRangeNote('China-PAR', 80) ?? '', /范围之外/)
assert.equal(modelRangeNote('phenoage', 30), null)

const first = bodyAgeWording({ phenoage: 19.7, advance: -13.3, bandYears: 2.7, dates: ['2026-09-21'], advances: [-13.3], spanDays: 0, date: '2026-09-21' })
assert.equal(first.allows_younger, false)
assert.doesNotMatch(first.headline_zh, /你年轻了/)
assert.match(first.headline_zh, /不能据此说年轻了/)
assert.match(first.headline_zh, /一次读数/)
assert.match(first.headline_zh, /19\.7 岁/)
const within = bodyAgeWording({ phenoage: 40.2, advance: 10.2, bandYears: 2.9, dates: ['2026-05-18', '2026-09-21'], advances: [10.8, 10.2], spanDays: 0, date: '2026-09-21' })
assert.equal(within.allows_younger, false)
assert.match(within.headline_zh, /还不能说年轻了/)
assert.match(within.headline_zh, /进展/)
const younger = bodyAgeWording({ phenoage: 36, advance: 6, bandYears: 2.9, dates: ['2026-05-18', '2026-09-21'], advances: [10.8, 6], spanDays: 0, date: '2026-09-21' })
assert.equal(younger.allows_younger, true)
assert.match(younger.headline_zh, /你年轻了/)
const windowed = bodyAgeWording({ phenoage: 40.8, advance: 10.8, bandYears: 2.9, dates: ['2026-09-21'], advances: [10.8], spanDays: 12, date: '2026-09-21' })
assert.match(windowed.headline_zh, /12 天内测齐/)
assert.match(windowed.headline_zh, /不是同一天/)

const glucose = rowOf('glucose')
assert.equal(compareGate([{ date: '2026-08-01' }, { date: '2026-08-27' }], [], glucose).gate, 'too_early')
assert.match(compareGate([{ date: '2026-08-01' }, { date: '2026-08-27' }], [], glucose).reason_zh, /^太早：/)
assert.equal(compareGate([{ date: '2026-06-08' }, { date: '2026-09-21' }], [], glucose), null)
const labs = [
  { date: '2026-06-08', file: 'lp:checkup:2026-06-08:北京朝阳医院' },
  { date: '2026-09-21', file: 'lp:retest:2026-09-21:上海瑞金医院' },
]
assert.equal(compareGate([{ date: '2026-06-08' }, { date: '2026-09-21' }], labs, glucose).gate, 'not_comparable')
assert.match(compareGate([{ date: '2026-06-08' }, { date: '2026-09-21' }], labs, glucose).reason_zh, /不可比/)
assert.doesNotMatch(compareGate([{ date: '2026-06-08' }, { date: '2026-09-21' }], labs, glucose).reason_zh, /波动内/)

// p01: HbA1c 6.1 on 2026-05-18 lives under the printed name; the retest is on the coded row.
// Without the join the verdict is the false 「没有基线」. With it, the 90-day gate says 太早.
const hba = rowOf('hba1c')
const walk = itemOf('walk', '快走', ['糖化血红蛋白'], '2026-07-27')
const split = {
  HbA1c: [at('2026-09-21', 6.0, '%')],
  糖化血红蛋白: [at('2026-05-18', 6.1, '%')],
}
const codedOnly = { asked: '糖化血红蛋白', label: '糖化血红蛋白', indicator: 'HbA1c', unit: '%', biovar: hba }
const missed = judge(walk, codedOnly, split)
assert.match(missed.reason_zh, /没有基线/, 'the unjoined series is the bug')
const joined = judge(walk, { ...codedOnly, also: ['糖化血红蛋白'] }, split)
assert.equal(joined.baseline?.value, 6.1)
assert.equal(joined.verdict, '无法判断')
assert.match(joined.reason_zh, /^太早：/)
assert.doesNotMatch(joined.reason_zh, /没有基线/)
assert.doesNotMatch(joined.reason_zh, /波动内/)

// p06: LDL 3.41 → 4.36 is past the band and past 28 days, so 反向, using the baseline in the window.
const ldl = rowOf('ldl')
const lipids = itemOf('food', '少油', ['低密度脂蛋白胆固醇'], '2026-07-27', 'diet')
const worse = judge(lipids, { asked: '低密度脂蛋白胆固醇', label: '低密度脂蛋白胆固醇', indicator: 'LDL', unit: 'mmol/L', biovar: ldl }, {
  LDL: [at('2026-06-08', 3.41, 'mmol/L'), at('2026-09-21', 4.36, 'mmol/L')],
})
assert.equal(worse.verdict, '反向', worse.reason_zh)
assert.equal(worse.baseline.value, 3.41)
assert.match(worse.reason_zh, /超出正常波动/)

// Different institutions are 不可比 even when the numbers would otherwise be a verdict.
const cross = judge(lipids, { asked: '低密度脂蛋白胆固醇', label: '低密度脂蛋白胆固醇', indicator: 'LDL', unit: 'mmol/L', biovar: ldl }, {
  LDL: [at('2026-06-08', 3.41, 'mmol/L', 'lp:checkup:2026-06-08:北京朝阳医院'), at('2026-09-21', 4.36, 'mmol/L', 'lp:retest:2026-09-21:上海瑞金医院')],
})
assert.equal(cross.verdict, '无法判断')
assert.match(cross.reason_zh, /^不可比：/)
assert.match(cross.reason_zh, /北京朝阳医院/)
assert.doesNotMatch(cross.reason_zh, /反向|波动内|有效/)

// Walking 7000+ most days counts, with no check-ins and no target stored on the item.
const steps = itemOf('steps', '工作日快走', ['体重'], '2026-07-01')
const daily = []
for (let i = 0; i < 40; i += 1) {
  const date = mod.addDays('2026-07-01', i)
  daily.push(at(date, i % 9 === 0 ? 3000 : 8200, 'count'))
}
const walked = mod.adherenceFor(steps, { start: '2026-07-01', end: '2026-08-09' }, { daily, checkins: [] })
assert.equal(walked.source, 'wearable', walked.note_zh)
assert.equal(walked.level, 'good', walked.note_zh)
assert.ok(walked.rate >= 0.8, walked.note_zh)
assert.match(walked.note_zh, /手环/)
const quiet = mod.adherenceFor(steps, { start: '2026-07-01', end: '2026-08-09' }, { checkins: [] })
assert.equal(quiet.source, 'none')

// Mirobody stores LDL moles/volume as 22748-8, which the variation file does not list.
const srcLdl = loadReferenceSrc(home).biovar.markers.find((marker) => marker.key === 'ldl')
assert.ok(srcLdl.loinc.includes('22748-8'))
assert.ok(srcLdl.loinc.includes('2089-1'))
assert.equal(checkupMarkerFor(loadReferenceSrc(home).biovar, { name: 'Cholesterol in LDL [Moles/volume] in Serum or Plasma', loinc: '22748-8', label: '低密度脂蛋白胆固醇' })?.key, 'ldl')

const ldlMove = judgeSeries(ldl, [at('2026-06-08', 3.41, 'mmol/L'), at('2026-09-21', 4.36, 'mmol/L')], bv.z, false)
assert.equal(ldlMove.complete, true)
assert.equal(ldlMove.change?.verdict, 'worse')
assert.equal(ldlMove.change?.compare.from, 3.41)
assert.equal(ldlMove.change?.compare.to, 4.36)
const filled = missedPlanChanges({
  changes: [],
  unjudged: [{ label_zh: '低密度脂蛋白胆固醇', reason_zh: '历次结果读取失败：返回的不是指标表，这次没有判断它的变化。' }],
  resolved: [{ indicator: 'LDL', biovar: ldl }],
  series: { LDL: [at('2026-06-08', 3.41, 'mmol/L'), at('2026-09-21', 4.36, 'mmol/L')] },
  unread: new Set(),
  z: bv.z,
  glucoseTreated: false,
})
assert.equal(filled.changes.length, 1)
assert.match(filled.changes[0].text_zh, /反向/)
assert.equal(filled.changes[0].compare.from_date, '2026-06-08')
assert.equal(filled.unjudged.length, 0, 'a series the verdict already read is no longer 「没有判断」')
const unread = missedPlanChanges({
  changes: [],
  unjudged: [{ label_zh: '低密度脂蛋白胆固醇', reason_zh: '历次结果读取失败：返回的不是指标表，这次没有判断它的变化。' }],
  resolved: [{ indicator: 'LDL', biovar: ldl }],
  series: { LDL: [at('2026-06-08', 3.41, 'mmol/L'), at('2026-09-21', 4.36, 'mmol/L')] },
  unread: new Set(['LDL']),
  z: bv.z,
  glucoseTreated: false,
})
assert.equal(unread.changes.length, 0)
assert.equal(unread.unjudged.length, 1)
const inside = missedPlanChanges({
  changes: [],
  unjudged: [{ label_zh: ldl.label_zh, reason_zh: '历次结果读取失败：返回的不是指标表' }],
  resolved: [{ indicator: 'LDL', biovar: ldl }],
  series: { LDL: [at('2026-06-08', 3.41, 'mmol/L'), at('2026-09-21', 3.42, 'mmol/L')] },
  unread: new Set(),
  z: bv.z,
  glucoseTreated: false,
})
assert.equal(inside.changes.length, 0)
assert.equal(inside.unjudged.length, 0)
const blockedUnit = missedPlanChanges({
  changes: [],
  unjudged: [{ label_zh: ldl.label_zh, reason_zh: '有一次较新的结果单位无法换算成 mmol/L，这次没有判断它的变化。' }],
  resolved: [{ indicator: 'LDL', biovar: ldl }],
  series: { LDL: [at('2026-06-08', 3.41, 'mmol/L'), at('2026-09-21', 4.36, 'nope')] },
  unread: new Set(),
  z: bv.z,
  glucoseTreated: false,
})
assert.equal(blockedUnit.changes.length, 0)
assert.equal(blockedUnit.unjudged.length, 1)

// A range marker filled from the verdict series names a value outside the usual adult range (0.5.3).
const mcv = rowOf('mcv')
const lowMcv = judgeSeries(mcv, [at('2026-06-08', 90, mcv.unit), at('2026-09-21', 78, mcv.unit)], bv.z, false, 'female')
assert.equal(lowMcv.change?.range_flag, 'low')
assert.match(lowMcv.change?.advice_zh ?? '', /偏低/)

console.log('honesty ok')
