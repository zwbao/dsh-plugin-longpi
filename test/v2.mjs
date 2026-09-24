// longevity-skills v2 layout: catalog.json, intents, manifests, structured
// measurements, profile autofill, runtimes, history and anonymous stats.
import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const mod = await import('../lib/index.js')
const home = mkdtempSync(join(tmpdir(), 'longpi-v2-home-'))
const fixture = join(root, 'fixtures', 'skills-home-v2')

// Copy the fixture and write catalog.json the way `python3 -m tools.lsk catalog` does.
const { cpSync } = await import('node:fs')
cpSync(fixture, home, { recursive: true })
const intents = JSON.parse(readFileSync(join(home, 'intents.json'), 'utf8')).intents
const phenoInputs = [
  { key: 'crp_mg_dl', label_zh: 'C反应蛋白', aliases: ['crp'], unit: 'mg/dL', accept: { 'mg/L': 0.1 }, range: [0.001, 50], unit_required: true, required: true, from: 'measurements' },
  { key: 'albumin_gL', label_zh: '白蛋白', unit: 'g/L', accept: { 'g/dL': 10 }, range: [15, 65], required: true, from: 'measurements' },
  { key: 'age', label_zh: '实足年龄', unit: 'a', range: [18, 110], required: true, from: 'profile', flag: '--age' },
  { key: 'sex', label_zh: '性别', required: false, from: 'profile', flag: '--sex' },
]
writeFileSync(join(home, 'catalog.json'), JSON.stringify({
  schema: 'longevity-catalog/1',
  version: '2026.39.0',
  intents,
  skills: [
    {
      name: 'demo-phenoage', kind: 'paper', tier: 'A', species: ['human'], evidence: 'cohort', domains: ['临床年龄'],
      blurb_zh: '演示表型年龄。', description: 'Fixture phenotypic age.', intents: ['biological_age'], has_script: true,
      entry: { script: 'scripts/personal_report.py', measurements_flag: '--biomarkers', measurements_header: ['marker', 'value', 'unit'], age_flag: '--age', sex_flag: '--sex', out_flag: '--out', result_json: true },
      inputs_status: 'verified', inputs: phenoInputs, outputs: [{ key: 'phenoage', label_zh: '演示年龄', unit: 'a' }],
    },
    {
      name: 'mouse-thing', kind: 'paper', tier: 'C', species: ['mouse'], evidence: 'animal', domains: ['比较生物学'],
      blurb_zh: '小鼠脑区。', description: 'Mouse brain fixture.', intents: ['model_organism'], has_script: false,
    },
    {
      name: 'special-runtime', kind: 'paper', tier: 'A', species: ['human'], evidence: 'method', domains: ['临床年龄'],
      blurb_zh: '需要专用解释器。', description: 'Needs a runtime.', intents: ['biological_age'], has_script: true,
      entry: { script: 'scripts/personal_report.py', runtime: 'special', out_flag: '--out' },
    },
    {
      name: 'longevity-evidence', kind: 'evidence', tier: 'tool', species: ['multi_species'], evidence: 'database', domains: ['工具与证据库'],
      blurb_zh: '证据查询。', description: 'Evidence store.', intents: ['intervention_evidence', 'gene_variant'], has_script: true,
      entry: { script: 'scripts/query.py', out_flag: '--out' },
    },
  ],
}, null, 2))

const dataDir = mkdtempSync(join(tmpdir(), 'longpi-v2-data-'))
try {
  const catalog = mod.loadCatalog(home)
  assert.equal(catalog.error, '')
  assert.equal(catalog.source, 'catalog.json')
  assert.equal(catalog.version, '2026.39.0')
  assert.equal(catalog.intents.length, 3)
  const pheno = catalog.cards.find((card) => card.name === 'demo-phenoage')
  assert.equal(pheno.tier, 'A')
  assert.ok(pheno.script.endsWith('personal_report.py'))
  assert.equal(catalog.cards.find((card) => card.name === 'longevity-evidence').script.endsWith('query.py'), true)
  assert.equal(mod.versionCheck(catalog, 'v2026.39.0').matches, true)
  assert.equal(mod.versionCheck(catalog, '2026.40.0').matches, false)

  const lexicon = mod.loadEvidenceLexicon(home)
  assert.ok(lexicon.interventions.includes('雷帕霉素'))
  assert.ok(lexicon.genes.includes('FOXO3'))
  const labs = [
    { name: 'C反应蛋白', value: '1.2', unit: 'mg/L' },
    { name: '白蛋白', value: '45', unit: 'g/L' },
  ]
  const profile = { age: 50, sex: 'female' }
  const options = { intents: catalog.intents, profile, lexicon }

  const bio = mod.matchSkills(catalog.cards, '我的生物年龄是多少', labs, 8, options)
  assert.equal(bio.intents[0].id, 'biological_age')
  assert.equal(bio.matches[0].name, 'demo-phenoage')
  assert.equal(bio.matches[0].runnable.status, 'ready')
  assert.equal(bio.matches.some((item) => item.name === 'mouse-thing'), false)

  const evidence = mod.matchSkills(catalog.cards, '雷帕霉素有用吗', [], 8, options)
  assert.equal(evidence.intents[0].id, 'intervention_evidence')
  assert.equal(evidence.matches[0].name, 'longevity-evidence')
  assert.deepEqual(mod.mentionedEntities('雷帕霉素和 FOXO3 有什么证据', catalog.intents, lexicon).sort(), ['FOXO3', '雷帕霉素'])

  const mouse = mod.matchSkills(catalog.cards, '小鼠脑区', [], 8, options)
  assert.equal(mouse.matches[0].name, 'mouse-thing')

  const proactive = mod.matchSkills(catalog.cards, '', labs, 8, options)
  assert.deepEqual(proactive.matches.map((item) => item.name), ['demo-phenoage'])
  const near = mod.matchSkills(catalog.cards, '', [labs[1]], 8, options)
  assert.equal(near.matches.length, 0)
  assert.deepEqual(near.near.map((item) => [item.name, item.runnable.missing]), [['demo-phenoage', ['C反应蛋白']]])

  const base = { home, dataDir, args: [], files: [], python: 'python3', timeoutMs: 15000, revision: 'fixture', profile }

  const refused = await mod.runSkill({ ...base, name: 'demo-phenoage', measurements: [{ key: 'CRP', value: '1.2', unit: '' }, { key: '白蛋白', value: '45', unit: 'g/L' }] })
  assert.equal(refused.ok, false)
  assert.equal(refused.error_kind, 'invalid_inputs')
  assert.equal(refused.problems[0].kind, 'unit_missing')

  const ran = await mod.runSkill({ ...base, name: 'demo-phenoage', measurements: [{ key: 'C反应蛋白', value: '1.2', unit: 'mg/L' }, { key: '白蛋白', value: '4.5', unit: 'g/dL' }] })
  assert.equal(ran.ok, true, JSON.stringify(ran))
  assert.equal(ran.outputs.phenoage.value, 50 + 4.5 - 4.5 + 0.12)
  assert.ok(ran.autofilled.some((item) => item.startsWith('--age 50')))
  assert.ok(ran.autofilled.some((item) => item.startsWith('--sex female')))
  assert.equal(mod.latestOutputs(dataDir).phenoage.value, 50.12)
  assert.equal(mod.seriesOf(dataDir, 'phenoage').length, 1)

  const noAge = await mod.runSkill({ ...base, profile: { age: null, sex: 'unknown' }, name: 'demo-phenoage', measurements: [{ key: 'crp_mg_dl', value: '0.1' }, { key: 'albumin_gL', value: '45' }] })
  assert.equal(noAge.error_kind, 'missing_inputs')

  const scriptRefused = await mod.runSkill({ ...base, name: 'demo-phenoage', measurements: [{ key: 'crp_mg_dl', value: '20' }, { key: 'albumin_gL', value: '45' }] })
  assert.equal(scriptRefused.ok, false)
  assert.equal(scriptRefused.error_kind, 'input_problems')
  assert.equal(scriptRefused.problems[0].kind, 'range')

  const missingRuntime = await mod.runSkill({ ...base, name: 'special-runtime' })
  assert.equal(missingRuntime.error_kind, 'runtime_missing')
  const withRuntime = await mod.runSkill({ ...base, name: 'special-runtime', runtimes: { special: 'python3' } })
  assert.equal(withRuntime.ok, true, JSON.stringify(withRuntime))
  assert.equal(withRuntime.runtime, 'special')

  const query = await mod.runSkill({ ...base, name: 'longevity-evidence', args: ['--entity', '雷帕霉素'], reportLimit: 2000 })
  assert.equal(query.ok, true, JSON.stringify(query))
  assert.match(query.report_text, /查询：雷帕霉素/)

  const stats = mod.buildStats(dataDir)
  const demo = stats.skills.find((row) => row.skill === 'demo-phenoage')
  assert.equal(demo.runs, 4)
  assert.equal(demo.ok, 1)
  assert.equal(demo.error_kinds.invalid_inputs, 1)
  assert.equal(demo.error_kinds.input_problems, 1)
  assert.equal(demo.error_kinds.missing_inputs, 1)
  assert.equal(demo.missing_inputs.age, 1)
  const text = JSON.stringify(stats)
  assert.equal(text.includes('50.12'), false, 'stats must not carry values')
  assert.equal(text.includes('C反应蛋白'), false, 'stats must not carry labels or report text')
} finally {
  rmSync(dataDir, { recursive: true, force: true })
  rmSync(home, { recursive: true, force: true })
}

console.log('v2 ok')
