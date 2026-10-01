// Typed stores: shape checks, upload type, narrow CSV under the 256KB cap.
// Fixtures are slices of the synthetic personas p11–p19, not a real record.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Readable } from 'node:stream'
import { proposeStoreRows } from '../src/agents/report_reader.ts'
import { IMPORT_CAP_BYTES, MODEL_FILE_CAP, FRAILTY_PROBE_IDS, readStored, saveReportText, storeIsOn, writeNarrowCsv } from '../src/stores/index.ts'
import * as mod from '../lib/index.js'
import { skillsHome } from './lib/skills-home.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const fx = join(here, 'fixtures', 'stores')
const temp = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-stores-${name}-`))
  temp.push(dir)
  return dir
}
function text(name) {
  return readFileSync(join(fx, name), 'utf8')
}
function rowsOf(dir, kind) {
  return readStored(dir, kind)
}

assert.throws(() => mod.readStore('methylation'), /not implemented in C1/)

const fresh = tempDir('off')
for (const kind of ['methylation', 'taxa', 'proteins', 'conditions']) {
  assert.equal(storeIsOn(fresh, kind), false)
  assert.deepEqual(rowsOf(fresh, kind), [])
}

const betas = tempDir('betas')
const chip = saveReportText(betas, text('p11-betas.csv'), { filename: 'p11-betas.csv', type: 'methylation' })
assert.equal(chip.summaries[0].stored, 274)
assert.equal(chip.summaries[0].created, true)
assert.match(chip.summaries[0].coverage_zh, /20 个位点中，覆盖 20 个/)
assert.equal(storeIsOn(betas, 'methylation'), true)
assert.equal((statSync(join(betas, 'methylation.json')).mode & 0o777), 0o600)
const storedBetas = rowsOf(betas, 'methylation')
assert.equal(storedBetas.length, 274)
assert.ok(storedBetas.every((row) => row.beta >= 0 && row.beta <= 1))
assert.equal(storedBetas.find((row) => row.probe_id === 'cg00921350').beta, 0.28)
for (const id of FRAILTY_PROBE_IDS) assert.ok(storedBetas.some((row) => row.probe_id === id), id)
const again = saveReportText(betas, text('p11-betas.csv'), { filename: 'p11-betas.csv', type: 'methylation' })
assert.equal(again.summaries[0].stored, 274)
assert.equal(rowsOf(betas, 'methylation').length, 274, 'the same source file replaces its rows')
saveReportText(betas, text('p11-betas-retest.csv'), { filename: 'p11-betas-retest.csv', type: 'methylation' })
assert.equal(rowsOf(betas, 'methylation').length, 548)

const narrow = writeNarrowCsv(betas, { kind: 'methylation', keys: [...FRAILTY_PROBE_IDS], sample_date: '2026-04-09' })
assert.equal(narrow.ok, true)
assert.equal(narrow.rows, 20)
assert.ok(narrow.text.length < MODEL_FILE_CAP)
assert.match(narrow.text, /^marker,value,unit\n/)
assert.match(narrow.text, /cg00921350,0\.28,1/)
assert.ok(!narrow.text.includes('cg06846752'))
const wide = writeNarrowCsv(betas, { kind: 'methylation', keys: storedBetas.map((row) => row.probe_id) })
assert.equal(wide.rows, 274)
assert.ok(wide.text.length < MODEL_FILE_CAP)

const badDir = tempDir('bad')
const bad = saveReportText(badDir, text('p11-betas-bad.csv'), { filename: 'p11-betas-bad.csv', type: 'methylation' })
const badRows = rowsOf(badDir, 'methylation')
assert.ok(badRows.some((row) => row.probe_id === 'cg00921350' && Math.abs(row.beta - 0.28) < 1e-9))
assert.ok(badRows.some((row) => row.probe_id === 'ch00000001'))
assert.ok(!badRows.some((row) => row.probe_id.startsWith('chr')))
assert.ok(!badRows.some((row) => row.probe_id === 'cg01234420'))
assert.ok(bad.summaries[0].rejected >= 3)
assert.ok(bad.summaries[0].reasons.probe_id >= 1)
assert.ok(bad.summaries[0].reasons.beta >= 1)

const percentDir = tempDir('percent')
const percentSaved = saveReportText(percentDir, text('p13-percent-loci.csv'), { filename: 'p13-percent-loci.csv' })
assert.equal(percentSaved.summaries[0].stored, 0)
assert.equal(storeIsOn(percentDir, 'methylation'), false, 'a rejected matrix does not create the store')

const clocks = proposeStoreRows(text('p12-clocks.txt'), { filename: 'p12-clocks.txt' })
assert.equal(clocks.methylation.length, 0)
assert.ok(!clocks.detected.includes('methylation'))

const report = proposeStoreRows(text('p16-report.txt'), { filename: 'p16-report.txt' })
assert.ok(Math.abs(report.taxa.find((row) => row.genus === 'Faecalibacterium').relative_abundance - 0.041) < 1e-9)
assert.equal(report.taxa.find((row) => row.genus === 'Bacteroides').relative_abundance, 0.27)
assert.equal(report.taxa.find((row) => row.genus === 'Streptococcus').site, 'gut')
assert.ok(!report.taxa.some((row) => row.genus === 'Shannon'))

const gutDir = tempDir('gut')
saveReportText(gutDir, text('p16-gut.tsv'), { filename: 'p16-gut.tsv', type: 'taxa' })
saveReportText(gutDir, text('p19-oral.tsv'), { filename: 'p19-oral.tsv', type: 'taxa' })
const taxa = rowsOf(gutDir, 'taxa')
assert.ok(taxa.some((row) => row.genus === 'Escherichia-Shigella' && row.site === 'gut' && row.relative_abundance === 0.01))
assert.ok(taxa.some((row) => row.genus === 'Akkermansia' && row.relative_abundance === 0))
assert.ok(taxa.some((row) => row.genus === 'Streptococcus' && row.site === 'oral' && row.relative_abundance === 0.184))
const taxaCsv = writeNarrowCsv(gutDir, { kind: 'taxa', keys: ['Faecalibacterium', 'g__Streptococcus'], site: 'gut' })
assert.match(taxaCsv.text, /Faecalibacterium,0\.04,1/)
assert.ok(!taxaCsv.text.includes('Streptococcus'))

const proteinDir = tempDir('proteins')
const proteins = saveReportText(proteinDir, text('p13-proteins.csv'), { filename: 'p13-proteins.csv', type: 'proteins' })
const proteinRows = rowsOf(proteinDir, 'proteins')
assert.ok(proteinRows.some((row) => row.id === 'ntprobnp' && row.unit_or_z === 'z' && row.value === 1.6))
assert.ok(proteinRows.some((row) => row.id === 'umod' && row.value === -0.6))
assert.ok(proteinRows.some((row) => row.id === 'GDF15' && row.unit_or_z === 'NPX'))
assert.ok(!proteinRows.some((row) => /岁|brain|ProtAge/i.test(`${row.id} ${row.symbol} ${row.unit_or_z}`)))
assert.ok(proteins.summaries[0].rejected >= 5)
saveReportText(proteinDir, text('p15-aptamers.csv'), { filename: 'p15-aptamers.csv', type: 'proteins' })
saveReportText(proteinDir, text('uniprot.csv'), { filename: 'uniprot.csv', type: 'proteins' })
const panel = rowsOf(proteinDir, 'proteins')
assert.ok(panel.some((row) => row.id === 'IL37.2723.9' && row.symbol === 'IL37'))
assert.ok(panel.some((row) => row.id === 'P16860' && row.symbol === 'NPPB'))
const proteinCsv = writeNarrowCsv(proteinDir, { kind: 'proteins', keys: ['GDF15', 'P16860'], panel: 'npx' })
assert.match(proteinCsv.text, /GDF15,1\.2,NPX/)
assert.ok(!proteinCsv.text.includes('P16860'))

const condDir = tempDir('conditions')
const conditions = saveReportText(condDir, text('p11-p19-conditions.tsv'), { filename: 'p11-p19-conditions.tsv', type: 'conditions' })
const codes = rowsOf(condDir, 'conditions')
assert.ok(codes.some((row) => row.code === 'E55.9' && row.system === 'ICD-10' && row.onset === '2025'))
assert.ok(codes.some((row) => row.code === 'Z87.891'))
assert.ok(codes.some((row) => row.code === 'M85.80'))
assert.equal(codes.filter((row) => row.code === 'I70.8').length, 1)
assert.ok(!codes.some((row) => row.code === 'E11.9'))
assert.ok(conditions.summaries[0].reasons.icd >= 1)
assert.ok(conditions.summaries[0].reasons.system >= 1)
const hfrs = writeNarrowCsv(condDir, { kind: 'conditions', keys: ['E55', 'J18', 'Z87', 'B96'] })
assert.match(hfrs.text, /E55\.9,1,score/)
assert.match(hfrs.text, /J18\.9,1,score/)
assert.ok(!hfrs.text.includes('E66.3'))

const envDir = tempDir('env')
saveReportText(envDir, JSON.stringify({
  type: 'methylation', date: '2026-04-09',
  raw: { cpg_beta: { cg00921350: 0.28, nope: 0.4 }, organ_z: { brain: 1.7 } },
  items: [{ name_en: 'PhenoAge', value: 49.1, unit: '岁' }],
}), { filename: 'chip.json' })
assert.deepEqual(rowsOf(envDir, 'methylation').map((row) => row.probe_id), ['cg00921350'])
assert.equal(storeIsOn(envDir, 'proteins'), false)

const capped = saveReportText(tempDir('cap'), 'x'.repeat(IMPORT_CAP_BYTES + 1), { filename: 'big.csv', type: 'methylation' })
assert.equal(capped.parsed.capped, true)
assert.equal(capped.summaries[0].stored, 0)

const many = tempDir('many')
const probes = ['probe_id,beta,sample_date']
const keys = []
for (let i = 0; i < 12000; i += 1) {
  const id = `cg${String(i).padStart(8, '0')}`
  keys.push(id)
  probes.push(`${id},0.12345678,2026-04-09`)
}
const bulk = saveReportText(many, probes.join('\n'), { filename: 'bulk.csv', type: 'methylation' })
assert.equal(bulk.summaries[0].stored, 12000)
const tooWide = writeNarrowCsv(many, { kind: 'methylation', keys })
assert.equal(tooWide.ok, false)
assert.equal(tooWide.text, '')
assert.match(tooWide.error, /256KB/)
assert.equal(rowsOf(many, 'methylation').length, 12000, 'the store keeps the matrix the model file cannot hold')

const damaged = tempDir('damaged')
writeFileSync(join(damaged, 'methylation.json'), '{', { mode: 0o600 })
assert.throws(() => rowsOf(damaged, 'methylation'), /methylation store is damaged/)
const refused = saveReportText(damaged, 'probe_id,beta,sample_date\ncg00921350,0.2,2026-04-09\n', { filename: 'a.csv', type: 'methylation' })
assert.equal(refused.summaries[0].ok, false)
assert.match(refused.summaries[0].error, /damaged/)
assert.equal(readFileSync(join(damaged, 'methylation.json'), 'utf8'), '{')

const clash = tempDir('clash')
saveReportText(clash, 'probe_id,beta,sample_date\ncg00921350,0.2,2026-04-09\n', { filename: 'a.csv', type: 'methylation' })
saveReportText(clash, 'probe_id,beta,sample_date\ncg00921350,0.4,2026-04-09\n', { filename: 'b.csv', type: 'methylation' })
const conflict = writeNarrowCsv(clash, { kind: 'methylation', keys: ['cg00921350'] })
assert.deepEqual(conflict.conflicts, ['cg00921350'])
assert.ok(!conflict.text.includes('0.2'))
assert.ok(!conflict.text.includes('0.4'))

const home = skillsHome('skills/epigenetic-frailty-risk-score/scripts/personal_report.py')
if (!home) console.log('skill scripts skipped')
else {
  const out = tempDir('efrs')
  const file = join(out, 'measurements.csv')
  writeFileSync(file, narrow.text)
  const script = join(home, 'skills/epigenetic-frailty-risk-score/scripts/personal_report.py')
  const ran = spawnSync('python3', [script, '--measurements', file, '--out', join(out, 'out')], { encoding: 'utf8', timeout: 30000 })
  assert.equal(ran.status, 0, ran.stderr || ran.stdout)
  const result = JSON.parse(readFileSync(join(out, 'out', 'result.json'), 'utf8'))
  const efrs = result.outputs?.efrs?.value ?? result.outputs?.efrs ?? result.efrs
  assert.ok(Math.abs(efrs - -0.20106) < 1e-4, JSON.stringify(result))
  const condOut = tempDir('hfrs')
  const condFile = join(condOut, 'measurements.csv')
  writeFileSync(condFile, hfrs.text)
  const hfrsScript = join(home, 'skills/genome-wide-proteomics-frailty/scripts/personal_report.py')
  const scored = spawnSync('python3', [hfrsScript, '--measurements', condFile, '--out', join(condOut, 'out')], { encoding: 'utf8', timeout: 30000 })
  assert.equal(scored.status, 0, scored.stderr || scored.stdout)
  const body = readFileSync(join(condOut, 'out', 'report.md'), 'utf8')
  assert.match(body, /1\.0/)
  assert.match(body, /低/)
}

function configFor(dataDir) {
  return {
    mcpUrl: '', mcpToken: '', member: '', timeoutMs: 5000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 20000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6, skillsVersion: '',
    bootstrapWorkspace: false,
  }
}
function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => execute(),
    logger: () => ({ info() {}, warn() {} }),
  }
  return { ctx, tools, routes }
}
function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, url)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolve) => {
    const res = {
      statusCode: 200, writableEnded: false, setHeader: () => {},
      end: (payload = '') => {
        res.writableEnded = true
        resolve({ status: res.statusCode, json: JSON.parse(String(payload) || 'null') })
      },
    }
    handler(req, res)
  })
}

const dataDir = tempDir('http')
const host = fakeHost()
await mod.apply(host.ctx, configFor(dataDir))
assert.equal(mod.readStore('taxa').length, 0)

const held = await call(host, 'POST', '/api/longpi/upload', { op: 'text', filename: 'p11-betas.csv', type: 'methylation', text: text('p11-betas.csv') })
assert.equal(held.status, 400)
assert.match(held.json.error, /确认/)
assert.equal(storeIsOn(dataDir, 'methylation'), false)

const posted = await call(host, 'POST', '/api/longpi/upload', { op: 'text', filename: 'p11-betas.csv', type: 'methylation', confirm: true, text: text('p11-betas.csv') })
assert.equal(posted.status, 200, JSON.stringify(posted.json))
assert.equal(posted.json.ok, true)
assert.equal(posted.json.forwarded, false)
assert.equal(posted.json.stores[0].stored, 274)
assert.match(posted.json.read_back_zh, /甲基化已记录 274 行/)
assert.doesNotMatch(posted.json.read_back_zh, /年轻|确诊|毫克/)
assert.equal(mod.readStore('methylation').length, 274)
assert.equal(mod.readStore('methylation')[0].source_file, 'p11-betas.csv')

const listed = await call(host, 'GET', '/api/longpi/stores?kind=methylation')
assert.equal(listed.json.count, 274)
assert.equal(listed.json.rows.length, 274)
const summary = await call(host, 'GET', '/api/longpi/stores')
assert.equal(summary.json.stores.methylation.on, true)
assert.equal(summary.json.stores.taxa.on, false)

const duplicate = await call(host, 'POST', '/api/longpi/upload', { op: 'text', filename: 'p11-betas.csv', type: 'methylation', confirm: true, text: text('p11-betas.csv') })
assert.equal(duplicate.json.duplicate, true)
assert.equal(mod.readStore('methylation').length, 274)

const checkup = await call(host, 'POST', '/api/longpi/upload', { op: 'text', filename: 'note.txt', text: '体检日期：2026-08-26\n总检 阳性结果：甲状腺右叶结节 4×3 mm，TI-RADS 3类。' })
assert.equal(checkup.json.needs_confirm, undefined)
assert.ok(checkup.json.findings.some((row) => row.kind === 'ti-rads'))
assert.equal(storeIsOn(dataDir, 'taxa'), false)

const micro = text('p16-gut.tsv')
const raw = Buffer.from(micro)
const started = await call(host, 'POST', '/api/longpi/upload', { op: 'start', filename: 'p16-gut.tsv', type: 'taxa', confirm: true, size: raw.length, content_type: 'text/tab-separated-values' })
assert.equal(started.json.ok, true)
await call(host, 'POST', '/api/longpi/upload', { op: 'chunk', id: started.json.id, index: 0, b64: raw.toString('base64') })
const finished = await call(host, 'POST', '/api/longpi/upload', { op: 'finish', id: started.json.id })
assert.equal(finished.json.stores[0].kind, 'taxa')
assert.ok(finished.json.stores[0].stored >= 8)
assert.ok(mod.readStore('taxa').some((row) => row.genus === 'Bacteroides' && row.site === 'gut'))

const toolFile = join(dataDir, 'p19-oral.tsv')
writeFileSync(toolFile, text('p19-oral.tsv'))
const tool = await host.tools.get('forward_report').execute({ path: toolFile, type: 'taxa', site: 'oral' })
assert.equal(tool.ok, true)
assert.ok(mod.readStore('taxa').some((row) => row.genus === 'Rothia' && row.site === 'oral'))
assert.ok(!JSON.stringify(tool).includes(text('p19-oral.tsv').slice(80, 140)))

for (const dir of temp) rmSync(dir, { recursive: true, force: true })
console.log('stores ok')
