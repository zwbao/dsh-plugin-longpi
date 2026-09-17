import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const require = createRequire(import.meta.url)
const root = dirname(fileURLToPath(import.meta.url))
const pkg = require('../package.json')
assert.equal(pkg.name, 'dsh-plugin-longpi')
assert.equal(pkg.version, '1.0.1')
assert.ok(pkg.dsh.bundle.patch)

const mod = await import('../lib/index.js')
assert.equal(mod.name, 'dsh-plugin-longpi')
assert.equal(mod.PRODUCT_VERSION, '1.0.1')
assert.equal(mod.preGuard('我想把药减到 1mg').code, 'no_medication')
assert.equal(mod.preGuard('我胸痛喘不上气').code, 'emergency')
assert.equal(mod.findMetric('crp')?.code, 'hs_crp')
assert.equal(mod.CUSTOMER.composite_age, 41.2)

const routed = mod.routeQuery('Use $dnabert2 for CSV embeddings')
assert.equal(routed.primary_skill, 'dnabert2')
const humanGpn = mod.routeQuery('Use $gpn-models variant-effect on hg38 chr1 REF A ALT G')
assert.notEqual(humanGpn.primary_skill, 'gpn-models')
assert.ok(humanGpn.warnings.some((w) => /GPN/i.test(w)))
const hg19 = mod.routeQuery('score this on hg19 chr1:1 A>T')
assert.equal(hg19.decision, 'clarify')
const batch = mod.buildBatchRequest({ gene: 'FOXO3', rsid: 'rs2802292', assembly: 'hg38' })
assert.equal(batch.assembly, 'hg38')
assert.ok(batch.allowed_axes.includes('constraint'))
assert.equal(mod.annotateVariant('FOXO3').variant.rsid, 'rs2802292')
assert.equal(mod.annotateVariant('rs999999999').found, false)

const vcfText = readFileSync(join(root, 'fixtures/demo.vcf'), 'utf8')
const parsed = mod.parseVcf(vcfText)
assert.equal(parsed.ok, true)
assert.equal(parsed.n_kept, 7)
assert.ok(parsed.variants.some((v) => v.rsid === 'rs2802292' && v.genotype === 'GT'))

const report = mod.buildOmicsReport()
assert.equal(report.version, '1.0.1')
assert.equal(report.omics.length, 5)
assert.ok(report.genome.panel_hits.length >= 4)

console.log('smoke ok', {
  version: pkg.version,
  vcfKept: parsed.n_kept,
  panelHits: report.genome.panel_hits.length,
  s2f: routed.primary_skill,
})
