import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(fileURLToPath(import.meta.url))
const pkg = require('../package.json')
const mod = await import('../lib/index.js')

assert.equal(pkg.name, 'dsh-plugin-longpi')
assert.equal(pkg.version, '4.2.0')
assert.equal(pkg.license, 'MIT')
assert.equal(pkg.dsh.bundle.patch, './cordis.patch.yml')
assert.ok(pkg.dsh.client.inject.includes('slots'))
assert.equal(mod.name, 'dsh-plugin-longpi')
assert.equal(mod.PRODUCT_VERSION, '4.2.0')
assert.equal(mod.TOOL_NAMES.length, 14)
assert.deepEqual(mod.HARNESS_SKILLS, ['longpi-dispatch', 'longpi-board', 'longpi-boundary', 'longpi-interventions'])

assert.equal(mod.preGuard('我胸痛喘不上气').code, 'emergency')
assert.equal(mod.preGuard('我想把药停了').code, 'no_medication_change')
assert.equal(mod.preGuard('我现在在吃什么药'), null)
assert.match(mod.wrapGuardMessage('胸痛', mod.preGuard('胸痛')), /120/)

const folded = mod.parseFrontmatter(`---\nname: accelerated-biological-aging-risk\ndescription: >-\n  Computes phenotypic age.\n  Use when PhenoAge.\n---\n\n# Title\n`)
assert.match(folded.description, /PhenoAge/)
assert.equal(folded.name, 'accelerated-biological-aging-risk')

const home = join(root, 'fixtures', 'skills-home')
const catalog = mod.loadCatalog(home)
assert.equal(catalog.error, '')
assert.equal(catalog.cards.length, 3)
const pheno = catalog.cards.find((card) => card.name === 'accelerated-biological-aging-risk')
assert.equal(pheno.domain, '临床年龄')
assert.match(pheno.description, /PhenoAge/)
assert.ok(pheno.script.endsWith('personal_report.py'))
assert.equal(catalog.cards.find((card) => card.name === 'aging-mouse-brain-atlas').script, null)

const asked = mod.matchSkills(catalog.cards, '帮我算表型年龄', [], 8)
assert.equal(asked.matches[0].name, 'accelerated-biological-aging-risk')
assert.equal(asked.matches.some((item) => item.name === 'aging-mouse-brain-atlas'), false)

const mouse = mod.matchSkills(catalog.cards, '小鼠脑区白质', [], 8)
assert.equal(mouse.matches[0].name, 'aging-mouse-brain-atlas')

const fromLabs = mod.matchSkills(catalog.cards, '', ['白蛋白', '肌酐', '空腹血糖', '白细胞'], 8)
assert.equal(fromLabs.matches[0].name, 'accelerated-biological-aging-risk')
assert.equal(mod.matchSkills(catalog.cards, '', [], 8).matches.length, 0)

const badAge = mod.normalizeProfile({ age: 200, sex: 'female' })
assert.equal(badAge.ok, false)
const badField = mod.normalizeProfile({ nickname: 'x' })
assert.equal(badField.ok, false)
const saved = mod.normalizeProfile({ displayName: '甲', birthYear: 1981, age: 45, sex: 'female' })
assert.equal(saved.ok, true)
assert.deepEqual(saved.profile.risk, {})
assert.equal(mod.normalizeProfile({ risk: { smoker: 'yes' } }).ok, false, 'risk facts are true or false')
assert.equal(mod.normalizeProfile({ risk: { cholesterol: true } }).ok, false, 'unknown risk facts are refused')
assert.deepEqual(mod.normalizeProfile({ sex: 'male', risk: { smoker: false, north: true } }).profile.risk, { smoker: false, north: true })
assert.equal(mod.estimatedAge(1981, 2026), 45)

const dataDir = mkdtempSync(join(tmpdir(), 'longpi-'))
try {
  mod.writeProfile(dataDir, saved.profile)
  assert.deepEqual(mod.readProfile(dataDir), saved.profile)

  const indicators = mod.summarizeIndicators({
    indicators: ['白蛋白', { name: '血糖', value: 5.1, unit: 'mmol/L' }],
  })
  assert.equal(indicators[0].name, '白蛋白')
  assert.equal(indicators.find((row) => row.name === '血糖').value, '5.1')
  const meds = mod.summarizeMedications({ plan: [{ name: '二甲双胍', dose: '500 mg', status: 'active' }] })
  assert.equal(meds[0].name, '二甲双胍')
  assert.equal(meds[0].recorded_dose, '500 mg')

  const ran = await mod.runSkill({
    home,
    dataDir,
    name: 'accelerated-biological-aging-risk',
    args: ['--age', '45', '--biomarkers', 'biomarkers.csv', '--out', 'out'],
    files: [{ name: 'biomarkers.csv', text: 'marker,value\nalbumin_gL,42\n' }],
    python: 'python3',
    timeoutMs: 15000,
    revision: 'fixture',
  })
  assert.equal(ran.ok, true, JSON.stringify(ran))
  assert.match(ran.report_excerpt, /边界/)
  assert.equal(mod.readReceipts(dataDir, 1)[0].skill, 'accelerated-biological-aging-risk')

  const escaped = await mod.runSkill({
    home,
    dataDir,
    name: 'accelerated-biological-aging-risk',
    args: ['--biomarkers', '../secrets.csv'],
    files: [],
    python: 'python3',
    timeoutMs: 15000,
    revision: 'fixture',
  })
  assert.equal(escaped.ok, false)
  assert.equal(escaped.error_kind, 'invalid_arguments')

  const noScript = await mod.runSkill({
    home,
    dataDir,
    name: 'aging-mouse-brain-atlas',
    args: [],
    files: [],
    python: 'python3',
    timeoutMs: 15000,
    revision: 'fixture',
  })
  assert.equal(noScript.error_kind, 'no_script')
} finally {
  rmSync(dataDir, { recursive: true, force: true })
}

for (const name of mod.HARNESS_SKILLS) {
  const raw = readFileSync(join(root, '..', 'skills', name, 'SKILL.md'), 'utf8')
  assert.match(raw, new RegExp(`^---\\nname: ${name}\\n`))
}

const liveHome = mod.resolveSkillsHome('')
if (liveHome) {
  const live = mod.loadCatalog(liveHome)
  assert.equal(live.error, '')
  assert.ok(live.cards.length >= 100, `expected the skill library, got ${live.cards.length}`)
  const liveMatch = mod.matchSkills(live.cards, '表型年龄 PhenoAge', [], 8)
  assert.equal(liveMatch.matches[0].name, 'accelerated-biological-aging-risk', JSON.stringify(liveMatch.matches.slice(0, 3)))
  const organism = mod.matchSkills(live.cards, '表型年龄', [], 8)
  assert.equal(organism.matches.some((item) => item.name === 'aging-mouse-brain-atlas'), false)
  const liveDir = mkdtempSync(join(tmpdir(), 'longpi-live-'))
  try {
    const liveRun = await mod.runSkill({
      home: liveHome,
      dataDir: liveDir,
      name: 'accelerated-biological-aging-risk',
      args: ['--age', '45', '--sex', 'female', '--biomarkers', 'biomarkers.csv', '--out', 'out'],
      files: [{
        name: 'biomarkers.csv',
        text: [
          'marker,value',
          'albumin_gL,42',
          'creat_umol,80',
          'glucose_mmol,5',
          'crp_mg_dl,0.1',
          'lymph_pct,30',
          'mcv_fl,90',
          'rdw_pct,13',
          'alp_u_l,70',
          'wbc_10e3,6',
        ].join('\n'),
      }],
      python: 'python3',
      timeoutMs: 30000,
      revision: live.revision,
    })
    assert.equal(liveRun.ok, true, JSON.stringify(liveRun))
    assert.match(liveRun.report_excerpt, /边界|表型/)
  } finally {
    rmSync(liveDir, { recursive: true, force: true })
  }
}

assert.match(readFileSync(join(root, '..', 'tsdown.config.ts'), 'utf8'), /id: "dsh-plugin-longpi"/)
assert.match(readFileSync(join(root, '..', 'src', 'client', 'panel.ts'), 'utf8'), /健康看板/)
console.log('smoke ok')
