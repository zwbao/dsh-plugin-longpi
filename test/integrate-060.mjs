// Integrator: L2's binder reads L3's stores, L1's pin downgrades verified,
// and a labeled run is a MethodResult the page can count.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { readStored, saveReportText } from '../src/stores/index.ts'
import * as mod from '../lib/index.js'
import { skillsHome } from './lib/skills-home.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = join(here, 'fixtures', 'stores')
const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-int060-'))
  dirs.push(dir)
  return dir
}

const refused = mod.versionCheck({ version: '2026.39.0' }, '2026.39.1', 'verified')
assert.equal(refused.matches, false)
assert.equal(refused.refused_verified, true)
assert.equal(refused.label, 'unverified-binding')
assert.equal(mod.versionCheck({ version: '2026.39.0' }, '', 'verified').label, 'verified')
assert.equal(mod.versionCheck({ version: '2026.39.0' }, '2026.39.1', 'evidence-only').label, 'evidence-only')
assert.ok(mod.RESERVED_ROUTES.M7.includes('GET /api/longpi/stores'))

const home = skillsHome('skills/epigenetic-frailty-risk-score/scripts/personal_report.py')
if (!home) {
  console.log('integrate-060 library run skipped')
} else {
  const dataDir = tempDir()
  const off = mod.registerLibraryHooks({
    readStore: (kind) => readStored(dataDir, kind),
  })
  saveReportText(dataDir, readFileSync(join(fx, 'p11-betas.csv'), 'utf8'), {
    filename: 'p11-betas.csv', type: 'methylation', sample_date: '2026-04-09',
  })
  saveReportText(dataDir, 'code,display\nE55.9,维生素 D 缺乏\n', {
    filename: 'p33-codes.csv', type: 'conditions',
  })
  const catalog = mod.loadCatalog(home)
  const frailty = catalog.cards.find((card) => card.name === 'epigenetic-frailty-risk-score')
  const hfrs = catalog.cards.find((card) => card.name === 'genome-wide-proteomics-frailty')
  assert.ok(frailty && hfrs)
  const view = { home, profile: { age: 42, sex: 'male' }, indicators: [], pinnedVersion: '' }
  const open = mod.bindRecord(frailty, view)
  assert.equal(open.ok, true, open.issues.map((item) => `${item.input}:${item.detail ?? item.kind}`).join('; '))
  assert.ok(open.measurements.length >= 20)
  assert.equal(open.label, 'verified')
  const pinned = mod.bindRecord(frailty, { ...view, pinnedVersion: '2026.39.1' })
  assert.equal(pinned.ok, true)
  assert.equal(pinned.label, 'unverified-binding')

  const ran = await mod.runSkill({
    home, dataDir, name: frailty.name, args: [], files: [],
    binding: { skill: frailty.name, inputs: Object.fromEntries(open.inputs_used.map((row) => [row.input, row])) },
    bindingView: view,
    python: 'python3', timeoutMs: 20000, revision: catalog.revision,
    profile: { age: 42, sex: 'male' }, useProfile: true,
  })
  assert.equal(ran.ok, true, ran.error || ran.report_excerpt)
  assert.equal(ran.method.label, 'verified')
  const score = Object.values(ran.outputs ?? {}).map((item) => item.value).find((value) => typeof value === 'number')
  assert.ok(typeof score === 'number' && Math.abs(score - (-0.201)) < 0.02, JSON.stringify(ran.outputs))

  const codes = mod.bindRecord(hfrs, view)
  assert.equal(codes.ok, true, codes.issues.map((item) => item.detail).join('; '))
  assert.ok(codes.measurements.some((item) => item.key === 'E55'))
  const coded = await mod.runSkill({
    home, dataDir, name: hfrs.name, args: [], files: [],
    binding: { skill: hfrs.name, inputs: Object.fromEntries(codes.inputs_used.map((row) => [row.input, row])) },
    bindingView: view,
    python: 'python3', timeoutMs: 20000, revision: catalog.revision,
    profile: { age: 42, sex: 'male' }, useProfile: true,
    reportLimit: 8000,
  })
  assert.equal(coded.ok, true, coded.error || coded.stderr_tail || coded.report_excerpt)
  assert.match(coded.report_text || '', /低/)
  assert.doesNotMatch(coded.report_text || '', /没有对上诊断编码/)

  const blood = mod.assessBinding({
    skill: 'biological-aging-generational-shifts',
    inputs: {
      phenoage: { source_row_id: 'PhenoAge', value: 49.1, unit: '岁', provenance: 'methylation_clock', quote: '甲基化 PhenoAge 49.1' },
    },
  }, { home, profile: { age: 42, sex: 'male' }, indicators: [], pinnedVersion: '' })
  assert.equal(blood.ok, false)
  assert.notEqual(blood.label, 'verified')

  const calcium = mod.assessBinding({
    skill: 'biological-age-ct-cardiometabolic',
    inputs: {
      agatston: { source_row_id: 'agatston', value: 486, unit: 'Agatston', provenance: 'coronary_ct', quote: '冠状动脉钙化积分 486' },
    },
  }, { home, indicators: [], pinnedVersion: '' })
  assert.notEqual(calcium.label, 'verified')
  assert.equal(calcium.ok, false)

  mod.setMethodResults([ran.method, coded.method].filter(Boolean))
  assert.equal(mod.methodsOnPage(mod.methodResults()), 2)
  off()
  assert.throws(() => mod.readStore('methylation'), /not implemented in C1/)
}

for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
