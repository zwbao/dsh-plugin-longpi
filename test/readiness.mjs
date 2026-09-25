// Which methods the record itself can run. A method is ready from the record
// only when every required input is there and at least one input a checkup or a
// device records (a LOINC or device code) came from the record; near and unlock
// name only such inputs. Methods that need only age, an answer or another
// method's output are never ready or near from the record, and stay matchable
// in chat. Synthetic cards first, then the real catalog if it is checked out.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { loadRecord, startFakeMirobody } from './fake-mirobody.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const AGE = { key: 'age', label_zh: '实足年龄', unit: 'a', required: true, from: 'profile', flag: '--age' }
const CRP = { key: 'crp_mg_l', label_zh: 'C反应蛋白', loinc: ['30522-7'], unit: 'mg/L', required: true, from: 'measurements' }
const ALB = { key: 'albumin_gL', label_zh: '白蛋白', loinc: ['1751-7'], unit: 'g/L', required: true, from: 'measurements' }

function card(name, inputs, blurb = `${name} 的说明。`) {
  return { name, tier: 'A', inputsStatus: 'verified', script: '/x.py', entry: { script: 'scripts/x.py', measurements_flag: '--in' }, inputs, blurb, domain: '临床年龄', description: blurb, lead: '', intents: [], species: ['human'], kind: 'paper' }
}

const cards = [
  card('labs', [CRP, ALB, AGE]),
  card('age-only', [AGE, { key: 'note', label_zh: '备注分', required: false, from: 'measurements' }], '只要年龄的稳定度方法。'),
  card('nothing-required', [{ key: 'score', label_zh: '已经算好的分', required: false, from: 'measurements' }], '已经算好的生物年龄的稳定度。'),
  card('optional-lab', [AGE, { ...ALB, required: false }]),
  card('question', [{ key: 'memory', label_zh: '情景记忆比较', required: true, from: 'argument' }, AGE]),
  card('earlier-output', [{ key: 'baseline', label_zh: '前一次（基线）临床生物年龄', required: true, from: 'measurements', output_of: ['phenoage'] }, AGE]),
  card('no-code', [{ key: 'age_estimate', label_zh: '年龄估计', required: true, from: 'measurements' }, AGE]),
  card('one-lab-short', [CRP, ALB, AGE]),
  card('lab-and-question', [CRP, ALB, { key: 'memory', label_zh: '情景记忆比较', required: true, from: 'argument' }]),
  card('sleep', [{ key: 'sleep_hours', label_zh: '睡眠时长', device_codes: ['dailyTotalSleepTime'], unit: 'h', required: true, from: 'measurements' }, AGE]),
]
const catalog = { cards, intents: [], home: '/x', revision: 'r', version: '', error: '' }
const profile = { age: 50, sex: 'female' }
const both = [
  { name: 'hs-CRP', value: '1.2', unit: 'mg/L', loinc: '30522-7' },
  { name: 'Albumin-ALB', value: '45', unit: 'g/L', loinc: '1751-7' },
  { name: 'dailyTotalSleepTime', value: '7.1', unit: 'hours' },
]

// --- 1. runnableFrom: status for any source, record for the record alone ------------------
const run = (name, indicators, outputs = {}) => mod.runnableFrom(cards.find((row) => row.name === name), indicators, profile, outputs)
assert.deepEqual([run('labs', both).status, run('labs', both).record], ['ready', 'ready'])
assert.deepEqual([run('age-only', both).status, run('age-only', both).record], ['ready', 'none'], 'age alone is not the record')
assert.deepEqual([run('nothing-required', both).status, run('nothing-required', both).record], ['ready', 'none'], 'nothing required is not the record either')
assert.equal(run('optional-lab', both).record, 'ready', 'an optional lab the record holds makes it ready from the record')
assert.equal(run('optional-lab', []).record, 'none')
assert.deepEqual([run('question', both).status, run('question', both).record, run('question', both).missing_from_record], ['partial', 'none', []], 'an answer is not a test')
assert.equal(run('earlier-output', both).record, 'none')
assert.equal(run('earlier-output', both, { phenoage: { value: 40 } }).record, 'none', 'another method\'s output is not the record')
assert.equal(run('no-code', both).record, 'none', 'an input with no LOINC or device code is not a test')
const short = run('one-lab-short', [both[1]])
assert.deepEqual([short.status, short.record, short.missing, short.missing_from_record], ['partial', 'near', ['C反应蛋白'], ['C反应蛋白']])
assert.equal(run('lab-and-question', [both[1]]).record, 'none', 'missing a test and an answer is not near')
assert.equal(run('sleep', both).record, 'ready', 'a device code counts as a test the record holds')
assert.deepEqual(run('sleep', both).from_record, [{ key: 'sleep_hours', value: '7.1', unit: 'hours' }])
assert.equal(run('sleep', []).record, 'near')

// --- 2. readiness, the page's lists ---------------------------------------------------------
const records = { profile: { ...mod.EMPTY_PROFILE, ...profile }, indicators: [both[1], both[2]] }
const ready = mod.readiness(catalog, records, {})
assert.deepEqual(ready.ready.map((row) => row.name).sort(), ['optional-lab', 'sleep'])
assert.deepEqual(ready.near.map((row) => [row.name, row.missing]), [['labs', ['C反应蛋白']], ['one-lab-short', ['C反应蛋白']]])
assert.deepEqual(ready.unlock, [{ item: 'C反应蛋白', skills: ['labs', 'one-lab-short'] }], 'only tests unlock')
for (const item of ['情景记忆比较', '前一次（基线）临床生物年龄', '年龄估计']) assert.ok(!ready.unlock.some((row) => row.item === item), `${item} is not a test`)

// --- 3. the matcher: lists without a question follow the record, a question still finds the rest ----
const proactive = mod.matchSkills(cards, '', both, 8, { profile })
assert.deepEqual(proactive.matches.map((row) => row.name).sort(), ['labs', 'one-lab-short', 'optional-lab', 'sleep'])
assert.ok(proactive.matches.every((row) => row.why.includes('记录里的输入已经齐了') && row.runnable.record === 'ready'))
const thin = mod.matchSkills(cards, '', [both[1]], 8, { profile })
assert.deepEqual(thin.near.map((row) => row.name).sort(), ['labs', 'one-lab-short', 'sleep'], 'a missing device series is a test too')
const asked = mod.matchSkills(cards, '已经算好的生物年龄的稳定度', both, 8, { profile })
const stability = asked.matches.find((row) => row.name === 'nothing-required')
assert.ok(stability, 'a method with no record-backed input stays matchable in chat')
assert.ok(!stability.why.includes('记录里的输入已经齐了'))
assert.equal(stability.runnable.status, 'ready')
assert.equal(stability.runnable.record, 'none')

// --- 4. the real catalog against the fixture record ------------------------------------------
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'skills')) ? sibling : '')
if (home && existsSync(join(home, 'catalog.json'))) {
  const real = mod.loadCatalog(home)
  const dataDir = mkdtempSync(join(tmpdir(), 'longpi-readiness-'))
  const servers = []
  try {
    mod.writeProfile(dataDir, { age: 53, sex: 'male', risk: {}, focus: [] })
    const config = {
      mcpUrl: '', mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
      dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 8, skillsVersion: '',
    }
    const readinessOf = async (record) => {
      const server = await startFakeMirobody({ record })
      servers.push(server)
      mod.invalidateRecords()
      return mod.readiness(real, await mod.loadRecords({ ...config, mcpUrl: server.url }, dataDir, '/nonexistent/plugin'), {})
    }
    const full = await readinessOf(loadRecord())
    const names = full.ready.map((row) => row.name)
    assert.ok(names.includes('accelerated-biological-aging-risk'))
    for (const name of ['ageing-clocks-digital-twins', 'hospital-infection-epilepsy-risk', 'testis-transcriptomic-atlas-lifespan', 'aging-biomarker-framework', 'genome-wide-proteomics-frailty', 'principal-component-clinical-aging']) {
      assert.ok(!names.includes(name), `${name} is not ready from the record`)
    }
    for (const item of ['年龄估计', '前一次（基线）临床生物年龄', 'z 标准化对数端粒', '情景记忆比较（相对 50–59 岁）', '表型年龄']) {
      assert.ok(!full.unlock.some((row) => row.item === item), `${item} does not unlock anything`)
    }
    const record = loadRecord()
    const noCrp = await readinessOf({ ...record, observations: record.observations.filter((row) => row.indicator !== 'hs-CRP') })
    assert.ok(noCrp.near.some((row) => row.name === 'accelerated-biological-aging-risk' && row.missing.length === 1), 'one test short')
    assert.ok(noCrp.unlock.some((row) => row.skills.includes('accelerated-biological-aging-risk')))
    console.log(`readiness ok (real catalog: ready ${names.join('、')}; near ${full.near.length}; unlock ${full.unlock.length})`)
  } finally {
    for (const server of servers) await server.close()
    rmSync(dataDir, { recursive: true, force: true })
  }
} else {
  console.log('readiness ok (synthetic cards; no longevity-skills checkout for the real catalog)')
}
