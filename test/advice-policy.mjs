// M2: tiered advice stays concrete, and the reply check still catches a personal prescription.
import assert from 'node:assert/strict'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const mod = await import(join(root, '..', 'lib', 'index.js'))
const reply = (text) => mod.replyRuleCheck(text)
const labels = (extra) => ({ acute_emergency: false, self_harm: false, med_change_request: false, personal_dose_request: false, research_question: false, reason: '', ...extra })

assert.equal(reply('维生素 D 常用范围是每天 1000–2000 IU，可耐受上限 4000 IU。').personal_dose, false, 'a population range is not a personal dose')
assert.equal(reply('TAME 试验中受试者每天服用 1500 mg 二甲双胍。').personal_dose, false)
assert.equal(reply('PEARL 试验每周 5 mg 或 10 mg，这是试验方案，不是给你的剂量。').personal_dose, false)
assert.equal(reply('不建议你停掉阿司匹林。').med_change_advice, false)
assert.equal(reply('每天 25 克膳食纤维，快走 30 分钟。').personal_dose, false)
assert.equal(reply('盐每天少于 5 g。').personal_dose, false, 'the salt cap is not a medicine dose')
assert.equal(reply('你可以每天吃 2 粒鱼油。').personal_dose, true)
assert.equal(reply('每天两片二甲双胍就可以。').personal_dose, true)
assert.equal(reply('你可以先停掉阿司匹林。').med_change_advice, true)
assert.equal(reply('你每周吃 5 mg 雷帕霉素试试。').personal_dose, true)

const nmn = mod.guidanceNote(labels({ personal_dose_request: true }), { medicine: true, text: 'NMN 每天吃多少合适？我想试试' })
assert.match(nmn.text, /250/)
assert.match(nmn.text, /doctor/)
assert.doesNotMatch(nmn.text, /NMN 每天吃多少合适？我想试试/)

const chest = mod.guidanceNote(labels({ acute_emergency: true }), { text: '我58岁有高血压，胸口压着疼了20分钟，出冷汗，左胳膊发麻' })
assert.match(chest.text, /请立即拨打 120/)
assert.match(chest.text, /坐下|半卧/)

const hypo = mod.guidanceNote(labels({}), { hypoglycaemia: true, text: '我午饭前测了血糖 3.7，手在抖' })
assert.match(hypo.text, /The first sentence of the reply must be 「先吃 15 克快速吸收的糖/)

const iron = mod.guidanceNote(labels({ med_change_request: true, personal_dose_request: true }), { medicine: true, text: '我是不是自己买点铁剂吃就行？一天吃多少？' })
assert.match(iron.text, /血液科/)
assert.match(iron.text, /消化科/)
assert.doesNotMatch(iron.text, /自己买点铁剂吃就行/)

console.log('advice-policy ok')
