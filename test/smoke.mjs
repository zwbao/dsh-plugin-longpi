import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(fileURLToPath(import.meta.url))
const pkg = require('../package.json')
assert.equal(pkg.name, 'dsh-plugin-longpi')
assert.equal(pkg.version, '1.1.0')
assert.ok(pkg.dsh.bundle.patch)

const mod = await import('../lib/index.js')
assert.equal(mod.name, 'dsh-plugin-longpi')
assert.equal(mod.PRODUCT_VERSION, '1.1.0')
// The release version lives in package.json and the code version in PRODUCT_VERSION.
// They are two sources by necessity, so pin them together: a bump that updates only
// one of them fails here instead of shipping a mislabelled report.
assert.equal(
  pkg.version,
  mod.PRODUCT_VERSION,
  `package.json says ${pkg.version} but PRODUCT_VERSION says ${mod.PRODUCT_VERSION}`,
)
assert.equal(mod.preGuard('我想把药减到 1mg').code, 'no_medication')
assert.equal(mod.preGuard('我胸痛喘不上气').code, 'emergency')
assert.equal(mod.findMetric('crp')?.code, 'hs_crp')
assert.equal(mod.findMetric('phenoage')?.code, 'iage')

// ---- biological age: the golden PhenoAge vector ----
// Recompute the published Levine 2018 mortality model by hand from the demo panel and
// assert the engine lands on the same number. This is the reproducibility contract:
// if the coefficients or the Gompertz back-projection drift, this test fails.
const GOLDEN_PHENOAGE = 52.529205263138692
assert.ok(
  Math.abs(mod.DEMO_PHENOAGE.phenoage - GOLDEN_PHENOAGE) < 1e-9,
  `PhenoAge drifted: ${mod.DEMO_PHENOAGE.phenoage} != ${GOLDEN_PHENOAGE}`,
)
assert.ok(Math.abs(mod.DEMO_PHENOAGE.phenoage_advance - 7.529205263138692) < 1e-9)
assert.equal(mod.DEMO_PHENOAGE.chronological_age, 45)
assert.equal(Object.keys(mod.DEMO_PHENOAGE.inputs_used).length, 9)
assert.equal(mod.DEMO_PHENOAGE.mortality_10y > 0 && mod.DEMO_PHENOAGE.mortality_10y < 1, true)
assert.ok(mod.DEMO_PHENOAGE.provenance.citation.includes('Levine'))
assert.ok(mod.DEMO_PHENOAGE.provenance.claim_ceiling.length >= 2)
assert.ok(mod.DEMO_PHENOAGE.unit_notes.some((n) => n.includes('合成演示值')))

// The engine refuses rather than guesses.
const short = mod.phenoAge([{ key: 'albumin_gL', value: 41, layer: 'measured', source_ref: 'x' }], 45)
assert.equal(short.ok, false)
assert.equal(short.code, 'MISSING_INPUT')
assert.equal(short.missing.length, 8)
const badUnit = mod.DEMO_LAB_PANEL.map((b) => (b.key === 'glucose_mmolL' ? { ...b, value: 100 } : b))
const unitFail = mod.phenoAge(badUnit, 45)
assert.equal(unitFail.ok, false)
assert.equal(unitFail.code, 'OUT_OF_RANGE')
assert.equal(unitFail.out_of_range[0].key, 'glucose_mmolL')
assert.equal(mod.phenoAge(mod.DEMO_LAB_PANEL, 0).code, 'BAD_AGE')

// HD needs a real reference cohort; without one it reports not_run, never a made-up number.
const hd = mod.homeostaticDysregulation(mod.DEMO_LAB_PANEL, null)
assert.equal(hd.ok, false)
assert.equal(hd.code, 'NO_REFERENCE')
const hdRef = {
  biomarkers: mod.PHENOAGE_MARKER_KEYS,
  means: mod.PHENOAGE_MARKER_KEYS.map(() => 0),
  inverse_covariance: mod.PHENOAGE_MARKER_KEYS.map((_, i) =>
    mod.PHENOAGE_MARKER_KEYS.map((__, j) => (i === j ? 1 : 0))),
  cohort: 'unit-test identity reference',
  source_ref: 'test fixture, not a real cohort',
}
const hdOk = mod.homeostaticDysregulation(
  mod.DEMO_LAB_PANEL.map((b) => ({ ...b, value: 3 })),
  hdRef,
)
assert.equal(hdOk.ok, true)
assert.ok(Math.abs(hdOk.hd - 9) < 1e-9, `identity-reference HD should be 3*sqrt(9)=9, got ${hdOk.hd}`)

// Composite is the weighted sum, and the arithmetic is auditable.
assert.ok(Math.abs(mod.CUSTOMER.composite_age - mod.DEMO_COMPOSITE.composite_age) < 1e-12)
const contributions = Object.values(mod.DEMO_COMPOSITE.contributions).reduce((a, b) => a + b, 0)
assert.ok(Math.abs(contributions - mod.DEMO_COMPOSITE.composite_age) < 1e-12)
assert.ok(Math.abs(Object.values(mod.MODULE_WEIGHTS_FOR_AGE).reduce((a, b) => a + b, 0) - 1) < 1e-12)
assert.equal(mod.DEMO_COMPOSITE.module_source.biological, 'engine')
assert.equal(mod.DEMO_COMPOSITE.module_source.physiological, 'demo')
const badWeights = mod.compositeAge(
  { biological: 50, physiological: 40, psychological: 42, behavioral: 42, social_env: 42 },
  45,
)
assert.equal(badWeights.ok, true)

// The nine clock inputs are visible as dashboard metrics.
assert.equal(mod.PHENOAGE_LAB_METRICS.length, 9)
assert.ok(mod.METRICS.some((m) => m.code === 'rdw_pct'))
assert.equal(mod.PHENOAGE_MARKER_KEYS.length, 9)

// ---- evidence index: the dead links must not come back ----
const ev = mod.lookupEvidence('')
assert.ok(ev.matches.length >= 12)
// These three were broken/stale before 1.1.0; a regression here is a published dead link.
const allUrls = ev.matches.map((m) => m.url).concat(
  mod.lookupEvidence('biolearn').matches.map((m) => m.url),
  mod.lookupEvidence('pyaging').matches.map((m) => m.url),
  mod.lookupEvidence('opentargets').matches.map((m) => m.url),
)
assert.ok(!allUrls.some((u) => u.includes('BioAgeLab/biolearn')), 'BioLearn 404 slug is back')
assert.ok(!allUrls.some((u) => u.includes('rsinghlab/pyaging')), 'pyaging redirect slug is back')
assert.ok(!allUrls.some((u) => u.includes('targetvalidation.org')), 'dead Open Targets domain is back')
assert.ok(allUrls.some((u) => u === 'https://github.com/bio-learn/biolearn'))
assert.ok(allUrls.some((u) => u === 'https://github.com/lucascamillomd/pyaging'))
// Every row must declare how it may be used, and copyleft must not claim `import`.
for (const item of mod.lookupEvidence('').matches) {
  assert.ok(['import', 'process', 'cite', 'unknown'].includes(item.integration), `bad integration: ${item.id}`)
  assert.ok(typeof item.license === 'string' && item.license.length > 0, `missing license: ${item.id}`)
  if (/GPL/i.test(item.license)) {
    assert.notEqual(item.integration, 'import', `${item.id} is copyleft but claims import`)
  }
}
assert.ok(ev.license_summary.import >= 0 && ev.license_summary.cite >= 1)
assert.ok(ev.coverage_note_zh.includes(String(ev.matches.length)) || ev.coverage_note_zh.includes('人工精选'))
assert.ok(ev.usage_note_zh.includes('process'))

// ---- plugin wiring: every declared tool actually registers ----
const registered = new Map()
const stubCtx = {
  tools: { register: (t) => registered.set(t.name, t) },
  on: () => {},
  // Skills, prompt, routes and commands register through injected scopes, not through
  // ctx.tools; this smoke test only inventories tools, so the callbacks are not invoked.
  inject: () => {},
}
mod.apply(stubCtx, {
  brandName: '健康助手',
  demoBanner: true,
  itineraryDate: '2026-10-24',
  s2fHome: '',
  maxVcfVariants: 5000,
  allowS2fExecute: false,
})
for (const name of [
  'compute_biological_age',
  'read_bioage_model',
  'read_demo_lab_panel',
  'compute_composite_age',
]) {
  assert.ok(registered.has(name), `tool not registered: ${name}`)
}
assert.equal(registered.size, 23, `expected 23 tools total, got ${registered.size}: ${[...registered.keys()]}`)

// The tool refuses unit errors rather than emitting a confident wrong age.
const compute = registered.get('compute_biological_age')
const demoRows = mod.DEMO_LAB_PANEL.map((b) => ({ ...b }))
const toolOk = await compute.execute({ chronological_age: 45, biomarkers: demoRows })
assert.equal(toolOk.demo_data_present, true)
assert.equal(toolOk.phenoage.ok, true)
assert.ok(toolOk.banner_zh.includes('演示数据'))
const toolBadUnit = await compute.execute({
  chronological_age: 45,
  biomarkers: demoRows.map((r) => (r.key === 'creatinine_umolL' ? { ...r, value: 1.2 } : r)),
})
assert.equal(toolBadUnit.phenoage.ok, false)
assert.equal(toolBadUnit.phenoage.code, 'OUT_OF_RANGE')
const toolRejected = await compute.execute({
  chronological_age: 45,
  biomarkers: [...demoRows, { key: 'not_a_marker', value: 1, layer: 'measured', source_ref: 'x' }],
})
assert.equal(toolRejected.rejected_inputs.length, 1)

// The model card must state units and claim ceilings, and must not overclaim coverage.
const card = await registered.get('read_bioage_model').execute({})
assert.equal(card.implemented_now.length, 2)
assert.ok(card.implemented_now[1].status === 'implemented_needs_reference')
assert.equal(card.not_implemented_v1.length, 3)
assert.ok(Object.keys(card.implemented_now[0].required_units).length === 9)

const routed = mod.routeQuery('Use $dnabert2 for CSV embeddings')
assert.equal(routed.primary_skill, 'dnabert2')
const humanGpn = mod.routeQuery('Use $gpn-models variant-effect on hg38 chr1 REF A ALT G')
assert.notEqual(humanGpn.primary_skill, 'gpn-models')
const foxoRoute = mod.routeQuery('variant-effect FOXO3')
assert.notEqual(foxoRoute.primary_skill, 'gpn-models')
assert.ok(humanGpn.warnings.some((w) => /GPN/i.test(w)))
const hg19 = mod.routeQuery('score this on hg19 chr1:1 A>T')
assert.equal(hg19.decision, 'clarify')
const batch = mod.buildBatchRequest({ gene: 'FOXO3', rsid: 'rs2802292', assembly: 'hg38' })
assert.equal(batch.assembly, 'hg38')
assert.ok(batch.allowed_axes.includes('constraint'))
assert.equal(mod.annotateVariant('FOXO3').variant.rsid, 'rs2802292')
const apoe = mod.annotateVariant('APOE')
assert.equal(apoe.found, true)
assert.ok(Array.isArray(apoe.also) && apoe.also.some((x) => x.rsid === 'rs7412'))
assert.equal(mod.annotateVariant('rs999999999').found, false)
assert.equal(mod.DEMO_VARIANTS.find((v) => v.rsid === 'rs10757278')?.position, 22124478)
assert.ok(mod.DEMO_VARIANTS.every((v) => !v.s2f_skills.includes('gpn-models')))

const vcfText = readFileSync(join(root, 'fixtures/demo.vcf'), 'utf8')
const parsed = mod.parseVcf(vcfText)
assert.equal(parsed.ok, true)
assert.equal(parsed.n_kept, 7)
assert.ok(parsed.variants.some((v) => v.rsid === 'rs2802292' && v.genotype === 'GT'))

const report = mod.buildOmicsReport()
assert.equal(report.version, '1.1.0')
assert.equal(report.omics.length, 5)
assert.ok(report.genome.panel_hits.length >= 4)

console.log('smoke ok', {
  version: pkg.version,
  vcfKept: parsed.n_kept,
  panelHits: report.genome.panel_hits.length,
  s2f: routed.primary_skill,
})
