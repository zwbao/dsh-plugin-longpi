// 0.5.4 integrator checks: subject age, the safe-while-you-wait draft, and gate fields on the page.
import assert from 'node:assert/strict'
import { normalizeIndicators } from '../src/client/normalize.ts'
import { steerNeed } from '../src/advice/playbook.ts'
import { softHoldDraft } from '../src/planner.ts'
import { minorView } from '../src/privacy/consents.ts'
import { stripWeightLoss } from '../src/privacy/disclosure.ts'
import { calculatorIdentity, subjectFromText } from '../src/subject.ts'

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

const fasting = steerNeed('45岁女，只吃二甲双胍，糖化6.9，想做16:8，给我排一下。', '这次没法给你排 16:8 的方案。血红蛋白偏低，先跟医生确认。')
assert.ok(fasting, 'echoing 16:8 next to 血红蛋白 is not a finished window')
assert.match(fasting.say, /8 点/)
assert.match(fasting.say, /低血糖风险低/)
const yam = steerNeed('吃山药能补铁吗？', '山药不是补铁的办法，先看医生。')
assert.match(yam.say, /红肉/)

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
