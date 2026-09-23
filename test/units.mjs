// Unit normalization and measurement staging agree with skillkit.py in longevity-skills.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const mod = await import('../lib/index.js')

const shared = JSON.parse(readFileSync(join(root, 'fixtures', 'unit_cases.json'), 'utf8'))
for (const [raw, expected] of shared.cases) {
  assert.equal(mod.normalizeUnit(raw), expected, `normalizeUnit(${JSON.stringify(raw)})`)
}
const liveHome = mod.resolveSkillsHome('')
if (liveHome && existsSync(join(liveHome, 'schema', 'unit_cases.json'))) {
  const canonical = JSON.parse(readFileSync(join(liveHome, 'schema', 'unit_cases.json'), 'utf8'))
  assert.deepEqual(shared.cases, canonical.cases, 'test/fixtures/unit_cases.json drifted from longevity-skills/schema/unit_cases.json')
}

assert.deepEqual(mod.nameVariants('白蛋白(ALB)'), ['白蛋白(alb)', '白蛋白', 'alb'])
assert.equal(mod.foldName('RDW-CV'), 'rdwcv')
assert.equal(mod.parseNumber('1,234.5'), 1234.5)
assert.equal(mod.parseNumber('<0.5'), null)

const card = {
  name: 'demo',
  inputsStatus: 'verified',
  script: '/x.py',
  entry: { script: 'scripts/personal_report.py', measurements_flag: '--biomarkers', measurements_header: ['marker', 'value', 'unit'] },
  inputs: [
    { key: 'crp_mg_dl', label_zh: 'C反应蛋白', aliases: ['crp', '超敏c反应蛋白'], unit: 'mg/dL', accept: { 'mg/L': 0.1 }, range: [0.001, 50], unit_required: true, required: true, from: 'measurements' },
    { key: 'albumin_gL', label_zh: '白蛋白', aliases: ['ALB'], unit: 'g/L', accept: { 'g/dL': 10 }, range: [15, 65], required: true, from: 'measurements', note_zh: '' },
    { key: 'lymph_pct', label_zh: '淋巴细胞百分比', unit: '%', range: [5, 80], required: false, from: 'measurements' },
    { key: 'age', label_zh: '实足年龄', unit: 'a', range: [18, 110], required: true, from: 'profile', flag: '--age' },
  ],
}

const ok = mod.stageMeasurements(card, [
  { key: '超敏C反应蛋白', value: '1.0', unit: 'mg/L' },
  { key: '白蛋白(ALB)', value: '4.4', unit: 'g/dL' },
])
assert.deepEqual(ok.problems, [])
assert.equal(ok.values.crp_mg_dl, 0.1)
assert.equal(ok.values.albumin_gL, 44)
assert.equal(ok.csv, 'marker,value,unit\ncrp_mg_dl,0.1,mg/dL\nalbumin_gL,44,g/L\n')

const noUnit = mod.stageMeasurements(card, [{ key: 'CRP', value: '1.0' }, { key: 'albumin_gL', value: '44' }])
assert.deepEqual(noUnit.problems.map((item) => item.kind), ['unit_missing'])

const byKey = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2' }, { key: 'albumin_gL', value: '44' }])
assert.deepEqual(byKey.problems, [])

const range = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2' }, { key: '白蛋白', value: '4.5' }])
assert.equal(range.problems[0].kind, 'range')
assert.match(range.problems[0].message_zh, /g\/dL/)

const unknownUnit = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2' }, { key: '白蛋白', value: '44', unit: 'mmol/L' }])
assert.equal(unknownUnit.problems[0].kind, 'unit')

const missing = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2' }])
assert.deepEqual(missing.problems.map((item) => [item.kind, item.key]), [['missing', 'albumin_gL']])

const stranger = mod.stageMeasurements(card, [{ key: '尿酸', value: '300', unit: 'umol/L' }, { key: 'crp_mg_dl', value: '0.2' }, { key: 'albumin_gL', value: '44' }])
assert.deepEqual(stranger.problems.map((item) => item.kind), ['unknown'])

const run = mod.runnableFrom(card, [
  { name: 'C反应蛋白(CRP)', value: '1.2', unit: 'mg/L' },
  { name: '白蛋白', value: '45', unit: 'g/L' },
], { age: 50, sex: 'female' })
assert.equal(run.status, 'ready')
assert.deepEqual(run.missing, [])
const partial = mod.runnableFrom(card, [{ name: '白蛋白', value: '45', unit: 'g/L' }], { age: null, sex: 'unknown' })
assert.equal(partial.status, 'partial')
assert.deepEqual(partial.missing, ['C反应蛋白', '实足年龄'])

console.log('units ok')
