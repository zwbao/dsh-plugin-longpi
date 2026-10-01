// 0.5.4 integrator checks: subject age, the safe-while-you-wait draft, and gate fields on the page.
import assert from 'node:assert/strict'
import { normalizeIndicators } from '../src/client/normalize.ts'
import { softHoldDraft } from '../src/planner.ts'
import { minorView } from '../src/privacy/consents.ts'
import { stripWeightLoss } from '../src/privacy/disclosure.ts'
import { calculatorIdentity, subjectFromText } from '../src/subject.ts'
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { rememberFromWords } from '../src/core/remember-rules.ts'
import { readProfile, writeProfile } from '../src/profile.ts'

const father = subjectFromText('这是我爸的体检，他今年68岁')
assert.equal(father?.relationship_zh, '父亲')
assert.equal(father?.age, 68)
assert.equal(father?.sex, 'male')
assert.equal(subjectFromText('我想减重'), null)
const id = calculatorIdentity({ age: 33, sex: 'female', subject: father, displayName: '', birthYear: null, risk: {}, focus: [], consent: null, consents: { pipl_sensitive: null, data_flow_deepseek: null, session_log_upload: null } })
assert.equal(id.age, 68)
assert.equal(id.sex, 'male')
assert.equal(id.subject, true)
const self = calculatorIdentity({ age: 33, sex: 'female', displayName: '', birthYear: null, risk: {}, focus: [], consent: null, consents: { pipl_sensitive: null, data_flow_deepseek: null, session_log_upload: null } })
assert.equal(self.age, 33)
assert.equal(self.subject, false)

// 0.8.0 (H-03): mentioning 我妈 / 我爸 never changes whose record this is
{
  const dir = mkdtempSync(join(tmpdir(), 'longpi-054-subject-'))
  try {
    writeProfile(dir, { ...readProfile(dir), age: 35, sex: 'male' })
    rememberFromWords(dir, '我妈的血压怎么样？这是我妈的体检，她今年62岁')
    const after = readProfile(dir)
    assert.equal(after.subject ?? null, null, 'no record subject written from words')
    assert.equal(after.sex, 'male')
    assert.equal(calculatorIdentity(after).sex, 'male', 'the calculators keep the holder')
  } finally {
    rmSync(dir, { recursive: true, force: true })
  }
}

const draft = softHoldDraft('2026-09-22')
assert.ok(draft.items.some((item) => item.title.includes('走路')))
assert.equal(JSON.stringify(draft).includes('限时进食'), false)
assert.equal(JSON.stringify(draft).includes('补铁'), false)
assert.doesNotMatch(JSON.stringify(draft), /16:8|铁剂|大幅/)

const teen = minorView({ age: 16, sex: 'female', displayName: '', birthYear: null, risk: {}, focus: [], consent: null, consents: { pipl_sensitive: null, data_flow_deepseek: null, session_log_upload: null } })
assert.equal(teen.minor, true)
assert.equal(teen.weight_loss, false)
const stripped = stripWeightLoss({ draft: { items: [{ category: 'weight', title: '减重到 60' }, { category: 'exercise', title: '每天走路' }] } })
assert.equal(stripped.draft.items.length, 1)
assert.match(stripped.draft.items[0].title, /走路/)


const rows = normalizeIndicators({
  record: { status: 'ok' },
  groups: [{
    key: 'blood', label_zh: '血',
    indicators: [{ id: 'hba1c', label_zh: '糖化', unit: '%', source: 'checkup', latest: { date: '2026-09-21', value: 6.3 }, points: [], judged: 'unjudged', gate: 'too_early', reason_zh: '太早：隔 90 天' }],
  }],
})
assert.equal(rows.groups[0].indicators[0].gate, 'too_early')
assert.match(rows.groups[0].indicators[0].reason_zh, /太早/)
console.log('integrate-054 ok')
