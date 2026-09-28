// 0.5.6: the three files both lanes edited keep both behaviours.
// changes.ts — unknown sex does not use the men's limit (lane A); a male ferritin of 8.0 is low on the row (lane B).
// plan-safety.ts — the same band asks for sex (lane A); 「我没有在备孕」 is not planning (lane B).
// journey.ts — a sex question with no doctor stop is still a stop object (lane A); 不确定 answers the question (lane B).
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { absoluteLevel, rangeFlag } from '../src/changes.ts'
import { packFrom } from '../src/core/factpack.ts'
import { unansweredOf } from '../src/journey.ts'
import { clinicalStop, reproductiveFromText } from '../src/plan-safety.ts'
import { EMPTY_PROFILE } from '../src/profile.ts'

const point = (name, value, unit, date) => ({ name, value, unit, date })

const between = rangeFlag('hb', 124, 'unknown')
assert.equal(between, null, 'HGB 124 with unknown sex is between the floors, so the change row does not apply the men\'s limit')
const eitherSex = rangeFlag('hb', 112, 'unknown')
assert.equal(eitherSex?.flag, 'low')
assert.match(eitherSex.text_zh, /男女都算偏低/)
assert.equal(rangeFlag('hb', 124, 'male')?.flag, 'low', 'a known man at 124 is still low')

const ferritin = absoluteLevel('铁蛋白', 8.0, 'ng/mL', 'male')
assert.equal(ferritin?.flag, 'low', 'YB ferritin 8.0 is low on the indicator row')
assert.match(ferritin.text_zh, /偏低/)
assert.match(ferritin.text_zh, /30/)

const y30 = clinicalStop({ sex: 'unknown', diabetesKnown: true, points: [point('血红蛋白', 124, 'g/L', '2026-04-16')] })
assert.equal(y30.stop, false, 'Y30 HGB 124 does not refer to 血液科 before sex is known')
assert.equal(y30.needs_sex, true)
assert.doesNotMatch(y30.sentence_zh, /血液科|男性下限/)
const belowBoth = clinicalStop({ sex: 'unknown', diabetesKnown: false, points: [point('血红蛋白', 112, 'g/L', '2026-04-16')] })
assert.equal(belowBoth.stop, true, 'below both floors is still a doctor step')

const denied = reproductiveFromText('我没有在备孕，也没有在怀孕')
assert.equal(denied.planning, false)
assert.equal(denied.pregnant, false)
assert.equal(reproductiveFromText('今年开始备孕').planning, true)
assert.equal(reproductiveFromText('当前概览里没有写备孕').planning, false)

const unknownSmoker = unansweredOf({ ...EMPTY_PROFILE, age: 33, sex: 'female', risk: {}, riskUnknown: ['smoker'] })
assert.equal(unknownSmoker.includes('现在吸烟'), false, '不确定 is an answer')
const missing = unansweredOf({ ...EMPTY_PROFILE, age: 33, sex: 'female', risk: {} })
assert.equal(missing.includes('现在吸烟'), true, 'an empty fact is still unanswered')
assert.equal(EMPTY_PROFILE.risk.smoker, undefined, '不确定 is not stored as false on the empty profile')

const dir = mkdtempSync(join(tmpdir(), 'longpi-056-pack-'))
try {
  const pack = packFrom({
    dataDir: dir,
    today: '2026-09-28',
    stage: 'first_result',
    person: { display_name: '', age: 52, sex: 'unknown' },
    care: { stop: y30, findings: [], seen: [] },
    hits: [],
    needsSex: y30.needs_sex === true,
    medications: [],
    changes: [],
    results: { bioage: { phenoage: null, advance: null, date: null }, risk: { risk_pct: null, date: null } },
    plan: { exists: false, version: null, days: null, open_checkins: 0, adherence_pct: null },
    self: [],
    stageNext: { title_zh: '填写性别', detail_zh: y30.sentence_zh, action: 'profile' },
    emptyRecord: false,
    trackingGeneration: 0,
  })
  assert.equal(y30.stop, false)
  assert.equal(pack.triage.stop?.needs_sex, true, 'a sex question with no doctor stop is still a stop object')
  assert.match(pack.triage.stop?.sentence_zh ?? '', /填写性别/)
} finally {
  rmSync(dir, { recursive: true, force: true })
}

console.log('integrate-056 ok')
