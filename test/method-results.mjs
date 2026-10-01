// L4: any labeled method result is in the fact pack and on the page, under triage and safety.
// A "younger" sentence needs a verified label and the M4 grade. An older body age names its drivers.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { packFrom } from '../src/core/factpack.ts'
import { clearMethodResults, setMethodResults } from '../src/core/method-results.ts'
import {
  allowsYoungerClaim, evidenceSentence, methodFactText, methodsOnPage, olderThanAgeSentence,
  overviewSlice, parseMethodResults, PHENO_SKILL, resultSentence, RISK_SKILL, stripYoungerClaim,
} from '../src/core/method-view.ts'
import { rankTopFacts } from '../src/core/topfacts.ts'
import { fallbackSurfaces } from '../src/surfaces/fallback.ts'

const root = dirname(fileURLToPath(import.meta.url))
const repo = dirname(root)
const fixtures = parseMethodResults(JSON.parse(readFileSync(join(root, 'fixtures/method-results.json'), 'utf8')))
assert.equal(fixtures.length, 4)

const YOUNGER = /你确实年轻了|比实足年龄年轻|你变年轻了|更年轻了|年轻了\s*\d|逆龄/

function finding(id, priority) {
  return {
    id, rule: 'test.rule', priority, kind: 'critical_value', title_zh: id,
    numbers: [], department_zh: '急诊科', tests_to_request_zh: [], questions_zh: [],
    status: 'open', opened: '2026-09-01', text_zh: id,
  }
}

const careBase = { stop: { stop: false, title_zh: '', sentence_zh: '', hits: [] }, findings: [], seen: [] }

const ranked = rankTopFacts({
  care: { ...careBase, findings: [finding('finding-pattern', 'must_surface'), finding('finding-emerg', 'emergency')] },
  hits: [],
  meds: [{ name: '达格列净', classes: ['sglt2i'] }],
  conditions: [],
  changes: [],
  goals: [{ id: 'g1', text_zh: '每天走路' }],
  methods: fixtures,
})
const ids = ranked.map((row) => row.id)
assert.equal(ids[0], 'finding-emerg', 'an emergency stays first')
const safetyAt = ids.indexOf('safety-sglt2i')
const methodAt = ids.findIndex((id) => id.startsWith('method-result'))
const goalAt = ids.indexOf('goal-g1')
assert.ok(safetyAt > 0 && safetyAt < methodAt, `safety medicines stay above method results: ${ids.join(',')}`)
assert.ok(ids.indexOf('finding-pattern') < methodAt, 'a critical pattern stays above method results')
assert.ok(methodAt < goalAt, 'method results are still facts, ahead of a context goal')
assert.ok(ranked.filter((row) => row.id.startsWith('method-result')).every((row) => row.priority === 'should_surface'))
assert.equal(ranked.find((row) => row.id === 'method-result-1').rule, 'method.verified')
for (const row of ranked.filter((item) => item.id.startsWith('method-result'))) {
  assert.doesNotMatch(row.text_zh, YOUNGER)
  assert.doesNotMatch(row.text_zh, /[a-z]+(?:-[a-z]+){2,}/, row.text_zh)
}

const sleep = fixtures.find((row) => row.skill === 'sleep-chart-biological-ageing')
const sleepSentence = resultSentence(sleep, { youngerAllowed: false })
assert.equal(sleepSentence.split('。').filter(Boolean).length, 1, sleepSentence)
assert.match(sleepSentence, /6\.4/)
assert.match(sleepSentence, /近 120 夜睡眠中位数 6\.4 小时/)
assert.match(sleepSentence, /还没对上/)

const clock = fixtures.find((row) => row.skill === 'aging-biomarker-framework')
const clockSentence = resultSentence(clock, { youngerAllowed: false })
assert.match(clockSentence, /−1\.4/)
assert.match(clockSentence, /甲基化报告上的时钟年龄 46\.6 岁/)
assert.equal(clockSentence.split('。').filter(Boolean).length, 1, clockSentence)
assert.doesNotMatch(clockSentence, YOUNGER)

const mouse = fixtures.find((row) => row.label === 'evidence-only')
const mouseSentence = evidenceSentence(mouse)
assert.match(mouseSentence, /物种：小鼠/)
assert.match(mouseSentence, /不是你的/)
assert.doesNotMatch(mouseSentence, /\d/)
assert.equal(methodFactText(mouse).includes('小鼠'), true)

assert.equal(allowsYoungerClaim('verified', ['younger']), true)
assert.equal(allowsYoungerClaim('unverified-binding', ['younger']), false)
assert.equal(allowsYoungerClaim('evidence-only', ['younger']), false)
assert.equal(allowsYoungerClaim('verified', ['progress_story']), false)
assert.equal(stripYoungerClaim('你确实年轻了 3 岁'), '有变化 3 岁')
assert.match(stripYoungerClaim('不能说明你变年轻了'), /不能说明你变年轻了/)

const poisoned = {
  ...fixtures[0],
  outputs: [{ key: 'note', value: '比实足年龄年轻 3 岁', unit: '' }],
}
assert.doesNotMatch(resultSentence(poisoned, { youngerAllowed: false }), YOUNGER)
assert.match(resultSentence(poisoned, { youngerAllowed: true }), /比实足年龄年轻/)

const older = olderThanAgeSentence({
  phenoage: 58.6,
  advance: 11.6,
  drivers: ['血红蛋白', '平均红细胞体积', '红细胞分布宽度'],
})
assert.match(older, /58\.6/)
assert.match(older, /11\.6/)
assert.match(older, /血红蛋白/)
assert.match(older, /平均红细胞体积/)
assert.match(older, /红细胞分布宽度/)
assert.match(older, /贫血/)
assert.match(older, /可能会降下来/)
assert.doesNotMatch(older, YOUNGER)
assert.equal(olderThanAgeSentence({ phenoage: 40, advance: -2, drivers: ['血红蛋白'] }), null)
const plainOlder = olderThanAgeSentence({ phenoage: 58.6, advance: 3, drivers: [] })
assert.match(plainOlder, /可能会降下来/)
assert.doesNotMatch(plainOlder, /贫血/)

assert.equal(methodsOnPage(fixtures), 3)
const crowd = [
  { skill: PHENO_SKILL, label: 'verified', outputs: [{ key: 'age', value: 58.6, unit: '岁' }], inputs_used: [], catalog_version: '2026.39.0', ran_at: '2026-09-28T00:00:00Z', limits_zh: '' },
  { skill: RISK_SKILL, label: 'verified', outputs: [{ key: 'risk', value: 4.2, unit: '%' }], inputs_used: [], catalog_version: '2026.39.0', ran_at: '2026-09-28T00:00:00Z', limits_zh: '' },
  ...[1, 2, 3, 4, 5].map((n) => ({
    skill: `sample${n}`, label: 'verified', outputs: [{ key: 'n', value: n, unit: '岁' }], inputs_used: [], catalog_version: '2026.39.0', ran_at: '2026-09-28T00:00:00Z', limits_zh: '',
  })),
]
const slice = overviewSlice(parseMethodResults(crowd))
assert.equal(slice.value.length, 4)
assert.equal(slice.value[0].skill, PHENO_SKILL)
assert.equal(slice.value[1].skill, RISK_SKILL)
assert.equal(overviewSlice(fixtures).evidence.length, 1)
assert.equal(overviewSlice([...fixtures, ...fixtures.map((row) => ({ ...row, skill: `${row.skill}-copy`, label: 'evidence-only' })), ...[1, 2, 3, 4].map((n) => ({ ...mouse, skill: `paper${n}` }))]).evidence.length, 4)

const dir = mkdtempSync(join(tmpdir(), 'longpi-l4-'))
try {
  setMethodResults(fixtures)
  const urgent = packFrom({
    dataDir: dir,
    today: '2026-09-28',
    stage: 'routine',
    person: { display_name: '', age: 52, sex: 'male' },
    care: { ...careBase, findings: [finding('finding-red-cell', 'must_surface')] },
    hits: [],
    needsSex: false,
    medications: ['达格列净'],
    changes: [],
    results: { bioage: { phenoage: 58.6, advance: 11.6, date: '2026-09-01' }, risk: { risk_pct: 4.2, date: '2026-09-01' } },
    plan: { exists: false, version: null, days: null, open_checkins: 0, adherence_pct: null },
    self: [],
    stageNext: { title_zh: '打开健康页看看', detail_zh: '', action: 'open' },
    emptyRecord: false,
    trackingGeneration: 1,
  })
  assert.equal(urgent.method_results.length, 4)
  assert.equal(urgent.top_facts[0].id, 'finding-red-cell')
  assert.ok(urgent.top_facts.some((row) => row.rule === 'method.verified'))
  assert.ok(urgent.top_facts.findIndex((row) => row.id === 'finding-red-cell') < urgent.top_facts.findIndex((row) => row.rule === 'method.verified'))
  assert.ok(urgent.top_facts.findIndex((row) => row.id === 'safety-sglt2i') < urgent.top_facts.findIndex((row) => row.rule === 'method.verified'))
  assert.ok(urgent.numbers.some((row) => row.value === 7.8 && row.source === 'skill'))
  const floor = fallbackSurfaces(urgent, { suggestions: [], status_zh: '可以看看结果' })
  assert.equal(floor.status.text_zh, urgent.top_facts[0].text_zh)
  assert.match(floor.status.detail_zh ?? '', /已核对/)
  assert.match(floor.status.detail_zh ?? '', /7\.8/)
  assert.doesNotMatch(floor.status.text_zh, /7\.8/)
  assert.doesNotMatch(`${floor.status.text_zh}${floor.status.detail_zh}`, YOUNGER)

  clearMethodResults()
  setMethodResults(fixtures)
  const quiet = packFrom({
    dataDir: dir,
    today: '2026-09-28',
    stage: 'routine',
    person: { display_name: '', age: 52, sex: 'male' },
    care: careBase,
    hits: [],
    needsSex: false,
    medications: [],
    changes: [],
    results: { bioage: { phenoage: null, advance: null, date: null }, risk: { risk_pct: null, date: null } },
    plan: { exists: false, version: null, days: null, open_checkins: 0, adherence_pct: null },
    self: [],
    stageNext: null,
    emptyRecord: false,
    trackingGeneration: 1,
  })
  const quietFloor = fallbackSurfaces(quiet, { suggestions: [], status_zh: '可以看看结果' })
  assert.match(quietFloor.status.text_zh, /可以看看结果/)
  assert.match(quietFloor.status.text_zh, /已核对/)
  assert.match(quietFloor.status.text_zh, /7\.8/)
  assert.doesNotMatch(quietFloor.status.text_zh, YOUNGER)
  assert.notEqual(quietFloor.status.text_zh, quiet.top_facts[0]?.text_zh)
} finally {
  clearMethodResults()
  rmSync(dir, { recursive: true, force: true })
}

const page = readFileSync(join(repo, 'src/client/results.ts'), 'utf8')
assert.equal(page.includes('比实足年龄年轻'), false)
assert.match(page, /olderThanAgeSentence/)
assert.match(page, /resultSentence/)
assert.match(page, /overviewSlice/)
assert.match(page, /数据对得上/)
assert.match(page, /还没对上，先别当成你的结果/)
assert.match(page, /这是研究里的说法，不是用你的体检算的/)
assert.match(page, /物种：/)

console.log('method-results ok')
