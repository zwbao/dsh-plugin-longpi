// Dispatch regression against a real longevity-skills checkout.
// Set LONGEVITY_SKILLS_HOME, or keep the checkout at ~/longevity-skills,
// ~/Projects/longevity-skills or ../longevity-skills. Skips when none is found.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = dirname(fileURLToPath(import.meta.url))
const mod = await import('../lib/index.js')
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'skills')) ? sibling : '')
if (!home) {
  console.log('dispatch skipped (no longevity-skills checkout)')
  process.exit(0)
}

const spec = JSON.parse(readFileSync(join(root, 'dispatch-cases.json'), 'utf8'))
const catalog = mod.loadCatalog(home)
assert.equal(catalog.error, '')
const lexicon = mod.loadEvidenceLexicon(home)
const tierOf = new Map(catalog.cards.map((card) => [card.name, card.tier]))
const profile = { age: 50, sex: 'female' }
const verbose = process.argv.includes('--verbose')

let hit = 0
const misses = []
const leaks = []
for (const item of spec.cases) {
  const labs = item.labs === 'labs9' ? spec.labs9 : []
  const result = mod.matchSkills(catalog.cards, item.q, labs, 8, { intents: catalog.intents, profile, lexicon })
  const names = result.matches.map((match) => match.name)
  const ok = names.slice(0, 3).some((name) => item.expect.includes(name))
  if (ok) hit += 1
  else misses.push(`${item.q} → ${names.slice(0, 3).join(', ') || '(empty)'} | intents ${result.intents.map((intent) => intent.id).join(',')}`)
  if (!item.organism) {
    const leaked = names.filter((name) => tierOf.get(name) === 'C')
    if (leaked.length > 0) leaks.push(`${item.q} → ${leaked.join(', ')}`)
  }
  if (verbose) console.log(`${ok ? 'HIT ' : 'MISS'} ${item.q} → ${names.slice(0, 3).join(', ')}`)
}

const heldout = JSON.parse(readFileSync(join(root, 'dispatch-heldout.json'), 'utf8'))
let heldHit = 0
for (const item of heldout.cases) {
  const labs = item.labs === 'labs9' ? spec.labs9 : []
  const names = mod.matchSkills(catalog.cards, item.q, labs, 8, { intents: catalog.intents, profile, lexicon }).matches.map((match) => match.name)
  if (names.slice(0, 3).some((name) => item.expect.includes(name))) heldHit += 1
  else console.log(`  held-out miss: ${item.q} → ${names.slice(0, 3).join(', ') || '(empty)'}`)
  if (!item.organism) {
    const leaked = names.filter((name) => tierOf.get(name) === 'C')
    if (leaked.length > 0) leaks.push(`${item.q} → ${leaked.join(', ')}`)
  }
}
const heldRate = heldHit / heldout.cases.length
console.log(`held-out: top-3 hit ${heldHit}/${heldout.cases.length} (${(heldRate * 100).toFixed(0)}%)`)
assert.ok(heldRate >= 0.8, `held-out top-3 hit rate ${heldRate.toFixed(2)} is below 0.80`)

const proactive = mod.matchSkills(catalog.cards, '', spec.labs9, 8, { intents: catalog.intents, profile, lexicon })
assert.ok(proactive.matches.some((match) => match.name === 'accelerated-biological-aging-risk'), 'the nine labs on file should make phenotypic age ready to run')

// The real phenotypic-age skill, fed the nine labs as a Chinese lab report records them (CRP in mg/L).
const { mkdtempSync, rmSync } = await import('node:fs')
const { tmpdir } = await import('node:os')
const runDir = mkdtempSync(join(tmpdir(), 'longpi-dispatch-'))
try {
  const measurements = spec.labs9.map((row) => ({ key: row.name, value: row.value, unit: row.unit }))
  const ran = await mod.runSkill({
    home, dataDir: runDir, name: 'accelerated-biological-aging-risk', args: [], files: [], measurements,
    profile, python: 'python3', timeoutMs: 30000, revision: catalog.revision,
  })
  assert.equal(ran.ok, true, JSON.stringify(ran))
  const age = ran.outputs.phenoage.value
  assert.ok(age > 20 && age < 90, `phenoage ${age}`)
  assert.ok(ran.autofilled.some((item) => item.startsWith('--age 50')))
  const wrong = await mod.runSkill({
    home, dataDir: runDir, name: 'accelerated-biological-aging-risk', args: [], files: [], profile, python: 'python3', timeoutMs: 30000, revision: catalog.revision,
    measurements: measurements.map((row) => (row.key === '超敏C反应蛋白' ? { ...row, unit: '' } : row)),
  })
  assert.equal(wrong.error_kind, 'invalid_inputs')
  console.log(`live phenotypic age from a Chinese lab report: ${age.toFixed(2)} (CRP without a unit refused)`)
} finally {
  rmSync(runDir, { recursive: true, force: true })
}

const rate = hit / spec.cases.length
for (const line of misses) console.log(`  miss: ${line}`)
for (const line of leaks) console.log(`  tier C leak: ${line}`)
console.log(`dispatch: top-3 hit ${hit}/${spec.cases.length} (${(rate * 100).toFixed(0)}%), tier C leaks ${leaks.length}, catalog ${catalog.source} ${catalog.version || ''}`)
assert.equal(leaks.length, 0, 'tier C skills leaked into questions that name no organism')
assert.ok(rate >= 0.9, `top-3 hit rate ${rate.toFixed(2)} is below 0.90`)
console.log('dispatch ok')
