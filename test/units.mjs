// Unit normalization and measurement staging agree with skillkit.py in longevity-skills.
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { skillsHome } from './lib/skills-home.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const mod = await import('../lib/index.js')

const shared = JSON.parse(readFileSync(join(root, 'fixtures', 'unit_cases.json'), 'utf8'))
for (const [raw, expected] of shared.cases) {
  assert.equal(mod.normalizeUnit(raw), expected, `normalizeUnit(${JSON.stringify(raw)})`)
}
const liveHome = skillsHome('schema/unit_cases.json')
if (liveHome) {
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

// The record path passes the input key. A missing unit is not "already mg/dL": 2.6 would add about 2.4 years.
const byKey = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '2.6' }, { key: 'albumin_gL', value: '44' }])
assert.equal(byKey.problems[0].kind, 'unit_missing')
assert.equal(byKey.values.crp_mg_dl, undefined)
const byKeyScaled = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '2.6', unit: 'mg/L' }, { key: 'albumin_gL', value: '44' }])
assert.deepEqual(byKeyScaled.problems, [])
assert.equal(byKeyScaled.values.crp_mg_dl, 0.26)
// A unit that is not mg/dL and not an accepted factor is refused, including on the key.
const wrongLabel = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '2.6', unit: 'Nightingale unit' }, { key: 'albumin_gL', value: '44' }])
assert.equal(wrongLabel.problems[0].kind, 'unit')
assert.equal(wrongLabel.values.crp_mg_dl, undefined)

const range = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2', unit: 'mg/dL' }, { key: '白蛋白', value: '4.5' }])
assert.equal(range.problems[0].kind, 'range')
assert.match(range.problems[0].message_zh, /g\/dL/)

const unknownUnit = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2', unit: 'mg/dL' }, { key: '白蛋白', value: '44', unit: 'mmol/L' }])
assert.equal(unknownUnit.problems[0].kind, 'unit')

const missing = mod.stageMeasurements(card, [{ key: 'crp_mg_dl', value: '0.2', unit: 'mg/dL' }])
assert.deepEqual(missing.problems.map((item) => [item.kind, item.key]), [['missing', 'albumin_gL']])

const stranger = mod.stageMeasurements(card, [{ key: '尿酸', value: '300', unit: 'umol/L' }, { key: 'crp_mg_dl', value: '0.2', unit: 'mg/dL' }, { key: 'albumin_gL', value: '44' }])
assert.deepEqual(stranger.problems.map((item) => item.kind), ['unknown'])

const run = mod.runnableFrom(card, [
  { name: 'C反应蛋白(CRP)', value: '1.2', unit: 'mg/L' },
  { name: '白蛋白', value: '45', unit: 'g/L' },
], { age: 50, sex: 'female' })
assert.equal(run.status, 'ready')
assert.deepEqual(run.missing, [])
assert.equal(run.record, 'none', 'no input carries a LOINC or device code, so it is not ready from the record')
const coded = { ...card, inputs: card.inputs.map((spec) => (spec.key === 'albumin_gL' ? { ...spec, loinc: ['1751-7'] } : spec)) }
assert.equal(mod.runnableFrom(coded, [{ name: '白蛋白', value: '45', unit: 'g/L' }, { name: 'CRP', value: '1.2', unit: 'mg/L' }], { age: 50, sex: 'female' }).record, 'ready')
const partial = mod.runnableFrom(card, [{ name: '白蛋白', value: '45', unit: 'g/L' }], { age: null, sex: 'unknown' })
assert.equal(partial.status, 'partial')
assert.deepEqual(partial.missing, ['C反应蛋白', '实足年龄'])

// Same day, same LOINC: a row whose unit converts wins over a wrong label, even when the wrong label is listed first.
const crpSpec = { ...card.inputs[0], loinc: ['30522-7', '1988-5'] }
const labelled = mod.indicatorFor(crpSpec, [
  { name: 'hs-CRP', value: '2.6', unit: 'Nightingale unit', loinc: '30522-7', date: '2026-02-11' },
  { name: 'CRP', value: '2.6', unit: 'mg/L', loinc: '1988-5', date: '2026-02-11' },
])
assert.equal(labelled.loinc, '1988-5')
const albuminSpec = { key: 'albumin_gL', label_zh: '白蛋白', aliases: ['Alb'], loinc: ['1751-7'], unit: 'g/L', accept: { 'g/dL': 10 }, range: [15, 65], required: true, from: 'measurements' }
const albumin = mod.indicatorFor(albuminSpec, [
  { name: 'Alb', value: '38.42', unit: 'Nightingale unit', loinc: '1751-7', date: '2026-05-18' },
  { name: '白蛋白', value: '45.7', unit: 'g/L', loinc: '1751-7', date: '2026-05-18' },
])
assert.equal(albumin.name, '白蛋白')
// A newer reading still wins, even when its unit will not convert.
const newer = mod.indicatorFor(albuminSpec, [
  { name: '白蛋白', value: '45.7', unit: 'g/L', loinc: '1751-7', date: '2026-02-11' },
  { name: 'Alb', value: '38.42', unit: 'Nightingale unit', loinc: '1751-7', date: '2026-05-18' },
])
assert.equal(newer.date, '2026-05-18')

// The plugin adds the owner's printed names and the methodless LOINC codes even when the manifest does not.
const bare = {
  name: 'accelerated-biological-aging-risk',
  inputs: [
    { key: 'glucose_mmol', label_zh: '血糖', aliases: ['空腹葡萄糖'], loinc: ['14771-0'], unit: 'mmol/L', required: true, from: 'measurements' },
    { key: 'rdw_pct', label_zh: '红细胞分布宽度', aliases: ['rdw'], loinc: ['788-0'], unit: '%', required: true, from: 'measurements' },
    { key: 'mcv_fl', label_zh: '平均红细胞体积', aliases: ['mcv'], loinc: ['787-2'], unit: 'fL', required: true, from: 'measurements' },
  ],
}
const bound = mod.supplementFieldInputs(bare)
const again = mod.supplementFieldInputs(bound)
assert.deepEqual(again.inputs, bound.inputs, 'a second pass does not duplicate aliases or codes')
const glucose = bound.inputs.find((spec) => spec.key === 'glucose_mmol')
const rdw = bound.inputs.find((spec) => spec.key === 'rdw_pct')
const mcv = bound.inputs.find((spec) => spec.key === 'mcv_fl')
assert.ok(glucose.aliases.includes('空腹血葡萄糖') && glucose.aliases.includes('FBG'))
assert.ok(rdw.aliases.includes('红细胞分布宽度-变异系数'))
assert.ok(rdw.loinc.includes('788-0') && rdw.loinc.includes('30385-9') && !rdw.loinc.includes('115742-9'))
assert.ok(mcv.loinc.includes('787-2') && mcv.loinc.includes('30428-7'))
assert.equal(mod.indicatorFor(glucose, [{ name: '空腹血葡萄糖', value: '5.67', unit: 'mmol/L', date: '2026-02-11' }]).value, '5.67')
assert.equal(mod.indicatorFor(rdw, [{ name: '红细胞分布宽度-变异系数', value: '13.2', unit: '%', date: '2026-02-11' }]).value, '13.2')
assert.equal(mod.indicatorFor(rdw, [{ name: '红细胞分布宽度-标准差', value: '44', unit: 'fL', date: '2026-02-11' }]), null)
assert.equal(mod.indicatorFor(rdw, [{ name: 'Red cell distribution width CV', value: '13.5', unit: '%', loinc: '30385-9', date: '2026-02-11' }]).value, '13.5')
assert.equal(mod.indicatorFor(rdw, [{ name: 'RDW-SD', value: '44', unit: 'fL', loinc: '115742-9', date: '2026-02-11' }]), null)
assert.equal(mod.indicatorFor(mcv, [{ name: 'Mean corpuscular volume', value: '90', unit: 'fL', loinc: '30428-7', date: '2026-02-11' }]).value, '90')
const waist = mod.supplementFieldInputs({
  name: 'china-par-ascvd-risk',
  inputs: [{ key: 'waist_cm', label_zh: '腰围', aliases: ['waist'], unit: 'cm', required: true, from: 'measurements' }],
}).inputs[0]
assert.ok(waist.aliases.includes('腹围'))
assert.equal(mod.indicatorFor(waist, [{ name: '腹围', value: '88', unit: 'cm', date: '2026-02-11' }]).value, '88')
if (liveHome) {
  const loaded = mod.loadCatalog(liveHome)
  const pheno = loaded.cards.find((item) => item.name === 'accelerated-biological-aging-risk')
  const fromFile = pheno.inputs.find((spec) => spec.key === 'rdw_pct')
  assert.ok(fromFile.loinc.includes('30385-9'), 'the loaded manifest, patched or not, accepts 30385-9')
  assert.ok(pheno.inputs.find((spec) => spec.key === 'glucose_mmol').aliases.includes('空腹血葡萄糖'))
  assert.ok(pheno.inputs.find((spec) => spec.key === 'mcv_fl').loinc.includes('30428-7'))
}

console.log('units ok')
