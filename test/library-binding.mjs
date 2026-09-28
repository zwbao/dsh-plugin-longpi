// Library-first routing and binding. The catalog is visible. Tier C is evidence.
// A methylation PhenoAge does not fill a blood phenotypic age. A bare agatston
// score does not fill abdominal aortic calcium. An optional bad unit is dropped.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { skillsHome } from './lib/skills-home.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const mod = await import('../lib/index.js')

assert.equal(mod.LIBRARY_SKILL_RANK > 250, true, 'harness skills (rank 250) win a name clash')
assert.doesNotMatch(readFileSync(join(root, '..', 'skills', 'longpi-dispatch', 'SKILL.md'), 'utf8'), /不调度/)
assert.match(readFileSync(join(root, '..', 'skills', 'longpi-dispatch', 'SKILL.md'), 'utf8'), /不是封闭名单/)
assert.match(readFileSync(join(root, '..', 'src', 'prompt.ts'), 'utf8'), /not a closed list/)
assert.doesNotMatch(readFileSync(join(root, '..', 'src', 'prompt.ts'), 'utf8'), /Use only skill names match_longevity_skills returned/)

const home = skillsHome('catalog.json')
if (!home) {
  console.log('library-binding skipped (no longevity-skills checkout)')
  process.exit(0)
}

const catalog = mod.loadCatalog(home)
assert.equal(catalog.error, '')
const index = mod.listSkillIndex()
assert.equal(index.length, catalog.cards.length, 'every catalog entry is listed')
assert.ok(index.length >= 170, `expected the whole library, got ${index.length}`)
const tierC = catalog.cards.filter((card) => card.tier === 'C')
assert.ok(tierC.length > 0)
for (const card of tierC) {
  const line = mod.catalogDescription(card)
  const species = card.species[0]
  assert.ok(line.length > 0, card.name)
  if (card.species.length === 1 && card.species[0] === 'mouse') assert.match(line, /^小鼠证据/)
  assert.equal(index.find((entry) => entry.name === card.name).tier, 'C')
}
const chars = index.reduce((sum, entry) => sum + entry.name.length + mod.catalogDescription(catalog.cards.find((card) => card.name === entry.name)).length, 0)
assert.ok(chars < 20000, `always-on index is ${chars} characters; English descriptions must stay out`)
assert.equal(index.some((entry) => /Computes one person's/.test(entry.blurb)), false)

const human = mod.matchSkills(catalog.cards, '表型年龄', [], 8, { intents: catalog.intents })
assert.equal(human.matches[0].name, 'accelerated-biological-aging-risk')
assert.doesNotMatch(human.note, /不调度/)
assert.equal(human.matches.some((item) => item.tier === 'C' && !item.evidence), false)

const mouse = catalog.cards.find((card) => card.tier === 'C' && card.species.includes('mouse') && card.script)
assert.ok(mouse, 'a tier C skill with a script')
const evidence = await mod.runSkill({
  home, dataDir: mkdtempSync(join(tmpdir(), 'longpi-tierc-')), name: mouse.name, args: [], files: [],
  python: 'python3', timeoutMs: 5000, revision: catalog.revision,
})
assert.equal(evidence.method.label, 'evidence-only')
assert.equal(evidence.method.outputs.length, 0)
assert.match(evidence.method.limits_zh, /不是这个人的数字/)
assert.equal(evidence.exit_code, null, 'tier C is not executed as a personal number')

const methylOnBlood = mod.assessBinding({
  skill: 'biological-aging-generational-shifts',
  inputs: {
    phenoage: {
      source_row_id: 'report:methylation:PhenoAge',
      value: 49.1,
      unit: '岁',
      provenance: 'methylation_clock',
      quote: '甲基化PhenoAge 49.1',
    },
    age: { source_row_id: 'profile:age', value: 42, unit: '岁', provenance: 'profile', quote: '实足年龄 42' },
  },
}, { home, profile: { age: 42, sex: 'male' } })
assert.equal(methylOnBlood.ok, false)
assert.ok(methylOnBlood.issues.some((issue) => issue.input === 'phenoage' && issue.kind === 'provenance'))

const bareCode = mod.validateBinding({
  skill: 'biological-aging-generational-shifts',
  inputs: {
    phenoage: { source_row_id: 'PhenoAge', value: 49.1, unit: '岁', provenance: 'blood_clock', quote: 'PhenoAge' },
    age: { source_row_id: 'profile:age', value: 42, unit: '岁', provenance: 'profile', quote: '实足年龄 42' },
  },
})
assert.equal(bareCode.ok, false, 'a bare PhenoAge code is not the blood formula')

const blood = mod.assessBinding({
  skill: 'biological-aging-generational-shifts',
  inputs: {
    phenoage: {
      source_row_id: 'output:accelerated-biological-aging-risk:phenoage',
      value: 41.6,
      unit: '岁',
      provenance: 'blood_clock',
      quote: '血检表型年龄 41.6',
    },
  },
}, {
  home,
  profile: { age: 42, sex: 'male' },
  outputs: { phenoage: { value: 41.6, unit: '岁', skill: 'accelerated-biological-aging-risk' } },
})
assert.equal(blood.ok, true, JSON.stringify(blood.issues))
assert.equal(blood.issues.some((issue) => issue.input === 'phenoage'), false)

const clockOnMethyl = mod.assessBinding({
  skill: 'aging-biomarker-framework',
  inputs: {
    PhenoAge: { source_row_id: 'PhenoAge', value: 49.1, unit: '岁', provenance: 'blood_clock', quote: '血检表型年龄 41.6' },
    age: { source_row_id: 'profile:age', value: 42, unit: '岁', provenance: 'profile', quote: '实足年龄 42' },
  },
}, { home, profile: { age: 42, sex: 'male' } })
assert.equal(clockOnMethyl.ok, true, 'an optional wrong clock is dropped')
assert.ok(clockOnMethyl.issues.some((issue) => issue.input === 'PhenoAge' && issue.kind === 'provenance'))
assert.equal(clockOnMethyl.measurements.some((item) => item.key === 'PhenoAge'), false)

const clocks = mod.assessBinding({
  skill: 'aging-biomarker-framework',
  inputs: {
    HorvathSkinBlood: { source_row_id: 'HorvathSkinBlood', value: 48.6, unit: '岁', provenance: 'methylation_clock', quote: 'Horvath皮肤血液时钟 48.6' },
    GrimAge: { source_row_id: 'GrimAge', value: 47.2, unit: '岁', provenance: 'methylation_clock', quote: 'GrimAge 47.2' },
    GrimAge2: { source_row_id: 'GrimAge2', value: 46.4, unit: '岁', provenance: 'methylation_clock', quote: 'GrimAge2 46.4' },
    PhenoAge: { source_row_id: 'PhenoAge', value: 49.1, unit: '岁', provenance: 'methylation_clock', quote: '甲基化PhenoAge 49.1' },
    DunedinPACE: { source_row_id: 'DunedinPACE', value: 1.08, unit: '生物年/历年', provenance: 'methylation_clock', quote: 'DunedinPACE 1.08' },
    DunedinPoAm38: { source_row_id: 'DunedinPoAm38', value: 1.05, unit: '生物年/历年', provenance: 'methylation_clock', quote: 'DunedinPoAm38 1.05' },
    age: { source_row_id: 'profile:age', value: 42, unit: '岁', provenance: 'profile', quote: '实足年龄 42' },
  },
}, { home, profile: { age: 42, sex: 'male' }, pinnedVersion: '1999.1.0' })
assert.equal(clocks.ok, true, JSON.stringify(clocks.issues))
assert.ok(clocks.issues.some((issue) => issue.input === 'DunedinPACE' && issue.kind === 'unit'))
assert.ok(clocks.issues.some((issue) => issue.input === 'DunedinPoAm38'))
assert.equal(clocks.measurements.some((item) => item.key === 'DunedinPACE'), false, 'a bad optional unit is dropped')
assert.equal(clocks.measurements.some((item) => item.key === 'HorvathSkinBlood'), true)
assert.equal(clocks.label, 'unverified-binding', 'a pin mismatch cannot be labelled verified')

const agatston = mod.assessBinding({
  skill: 'biological-age-ct-cardiometabolic',
  inputs: {
    agatston: { source_row_id: 'agatston', value: 486, unit: 'Agatston', provenance: 'coronary_ct', quote: '冠脉钙化积分 486' },
  },
}, { home, profile: { age: 55, sex: 'male' } })
assert.equal(agatston.ok, false)
assert.match(agatston.issues.map((issue) => issue.detail).join(' '), /Agatston/)
assert.equal(mod.isCoronaryName('agatston'), true)
assert.equal(mod.isCoronaryName('腹主动脉钙化'), false)

const runDir = mkdtempSync(join(tmpdir(), 'longpi-agatston-'))
try {
  const refused = await mod.runSkill({
    home, dataDir: runDir, name: 'biological-age-ct-cardiometabolic', args: [], python: 'python3', timeoutMs: 15000, revision: catalog.revision,
    files: [{ name: 'measurements.csv', text: 'name,value\nsex,male\nagatston,486\n' }],
  })
  assert.equal(refused.ok, false)
  assert.match(refused.error, /Agatston/)
} finally {
  rmSync(runDir, { recursive: true, force: true })
}

const labs = [
  ['albumin_gL', '1751-7', '白蛋白', '46', 'g/L'],
  ['creat_umol', '2160-0', '肌酐', '80', 'umol/L'],
  ['glucose_mmol', '14771-0', '空腹血糖', '5.2', 'mmol/L'],
  ['crp_mg_dl', '30522-7', '超敏C反应蛋白', '1.2', 'mg/L'],
  ['lymph_pct', '736-9', '淋巴细胞百分比', '30', '%'],
  ['mcv_fl', '787-2', '平均红细胞体积', '90', 'fL'],
  ['rdw_pct', '788-0', '红细胞分布宽度', '13', '%'],
  ['alp_u_l', '6768-6', '碱性磷酸酶', '70', 'U/L'],
  ['wbc_10e3', '6690-2', '白细胞', '6', '10^9/L'],
]
const view = {
  home,
  pinnedVersion: catalog.version,
  profile: { age: 50, sex: 'female' },
  indicators: labs.map(([, loinc, name, value, unit]) => ({ name, value, unit, loinc })),
}
const proposal = {
  skill: 'accelerated-biological-aging-risk',
  inputs: Object.fromEntries(labs.map(([key, loinc, name, value, unit]) => [key, {
    source_row_id: loinc, value, unit, provenance: 'routine_lab', quote: `${name} ${value} ${unit}`,
  }])),
}
const verified = mod.useBindingView(view, () => mod.assessBinding(proposal, view))
assert.equal(verified.ok, true, JSON.stringify(verified.issues))
assert.equal(verified.label, 'verified')
const ranDir = mkdtempSync(join(tmpdir(), 'longpi-bind-run-'))
try {
  const ran = await mod.runSkill({
    home, dataDir: ranDir, name: proposal.skill, args: [], files: [], python: 'python3', timeoutMs: 30000, revision: catalog.revision,
    binding: proposal, bindingView: view, profile: { age: 50, sex: 'female' },
  })
  assert.equal(ran.ok, true, JSON.stringify(ran))
  assert.equal(ran.method.label, 'verified')
  assert.equal(typeof ran.method.outputs.find((item) => item.key === 'phenoage').value, 'number')
  assert.match(ran.method.limits_zh, /年轻/)
} finally {
  rmSync(ranDir, { recursive: true, force: true })
}

console.log(`library-binding ok (${index.length} methods, index ${chars} chars)`)
