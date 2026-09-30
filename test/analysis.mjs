// M12 deep analysis: run folders, stage progress, the la-export/1 checks, import, plan read-back and
// acceptance, the start gates (skill installed, adult, both consents, age and sex), the report's CSP.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'

const tmp = (p) => mkdtempSync(join(tmpdir(), `longpi-analysis-${p}-`))
const sha = (path) => createHash('sha256').update(readFileSync(path)).digest('hex')
process.env.LONGPI_ANALYSES_HOME = tmp('home')
const skillDir = tmp('skill')
writeFileSync(join(skillDir, 'SKILL.md'), '---\nname: longevity-analyst\n---\n')

function depsFor(dataDir, config = {}) {
  mod.bindPrivacy({ dataDir: () => dataDir, scienceMode: () => 'off', codexEnabled: () => true })
  let invalidated = 0
  return {
    dataDir: () => dataDir,
    config: () => ({ mcpUrl: '', skillsHome: '/lib/longevity-skills', ...config }),
    context: async () => ({ today: '2026-09-30', records: { medications: [] } }),
    invalidate: () => { invalidated += 1 },
    get invalidated() { return invalidated },
  }
}

function grant(dataDir, scope) {
  mod.recordConsent(dataDir, { scope, decision: 'granted', mode: 'off', textVersion: 't1' })
}

function exportFor(run, over = {}) {
  mkdirSync(join(run.workspace, 'deliver'), { recursive: true })
  const html = join(run.workspace, 'deliver', 'report.html')
  writeFileSync(html, '<!doctype html><h1>报告</h1><script>fetch("/api/longpi/profile")</script>')
  const x = {
    schema: 'la-export/1', generated_at: '2026-09-30T10:00:00+08:00', generation: 'g1',
    member: { id: 'm', age: 58, sex: 'male' }, workspace: run.workspace,
    report: { html, sha256: sha(html) },
    readouts: [{ id: 'organ.kidney.risk.1', label_zh: '慢性肾病', value: 0.08, unit: '概率', kind: 'llm_estimate', low: 0.04, high: 0.16, horizon_years: 10, group: 'organ_ai_estimate' },
               { id: 'native.egfr', label_zh: 'eGFR', value: 88, unit: 'mL/min/1.73m²', kind: 'computed', group: 'method' }],
    organs: [{ organ: 'kidney', label_zh: '肾脏', measured: [], indices: ['native.egfr'], ai_age: null, ai_risks: ['organ.kidney.risk.1'] }],
    board: [{ id: 'Q1', title_zh: 'LDL 高是遗传的吗', verdict: 'supported', verdict_zh: '证据支持', confidence: 'moderate', summary_zh: 'LDLR 致病变异。', next_step_zh: '遗传咨询。' }],
    plan: { title: '深度分析干预方案', source: 'analysis', note: '营养师审核后生效', items: [
      { id: 'la-i1', category: 'diet', title: '减少饱和脂肪', detail: '以鱼和豆类替代红肉', markers: ['低密度脂蛋白胆固醇'] },
      { id: 'la-i2', category: 'other', title: '到心内科做家族性高胆固醇血症评估', detail: '', markers: [] }] },
    retests: [{ item: 'I1', what: '低密度脂蛋白胆固醇', after_weeks: 12, due: '2026-12-23' }],
    boundary_zh: '不是诊断。',
    ...over,
  }
  writeFileSync(join(run.workspace, 'deliver', 'la-export.json'), JSON.stringify(x))
  return x
}

// ---- start gates, in order
{
  const dataDir = tmp('gates')
  const deps = depsFor(dataDir)
  process.env.LONGPI_ANALYST_SKILL = join(skillDir, 'missing.md')
  assert.equal(mod.startBlockers(dataDir)?.missing, 'skill')
  process.env.LONGPI_ANALYST_SKILL = join(skillDir, 'SKILL.md')
  assert.equal(mod.startBlockers(dataDir)?.missing, 'pipl_sensitive')
  grant(dataDir, 'pipl_sensitive')
  assert.equal(mod.startBlockers(dataDir)?.missing, 'data_flow_deepseek')
  grant(dataDir, 'data_flow_deepseek')
  assert.equal(mod.startBlockers(dataDir)?.missing, 'profile')
  mod.writeProfile(dataDir, { ...mod.EMPTY_PROFILE, age: 58, birthYear: 1968, sex: 'male' })
  assert.equal(mod.startBlockers(dataDir), null)
  const res = await mod.startRun(deps, {})
  assert.equal(res.ok, true)
  assert.match(res.prompt_zh, /longevity-analyst/)
  assert.match(res.prompt_zh, /58 岁，男/)
  assert.ok(!/mirobody pull/.test(res.prompt_zh), 'no Mirobody, no pull step')
}

// ---- a run with Mirobody: the URL goes to a 0600 file, never into the request text
{
  const dataDir = tmp('run')
  grant(dataDir, 'pipl_sensitive'); grant(dataDir, 'data_flow_deepseek')
  mod.writeProfile(dataDir, { ...mod.EMPTY_PROFILE, age: 45, birthYear: 1981, sex: 'female' })
  const deps = depsFor(dataDir, { mcpUrl: 'http://127.0.0.1:18060/mcp/SECRET-XYZ' })
  const res = await mod.startRun(deps, {})
  assert.equal(res.ok, true)
  assert.ok(!res.prompt_zh.includes('SECRET-XYZ'), 'the secret never enters the request')
  assert.match(res.prompt_zh, /mirobody pull .* --mcp-url-file /)
  const run = mod.listRuns(dataDir).at(-1)
  const urlFile = join(run.root, 'mirobody_mcp_url')
  assert.equal(statSync(urlFile).mode & 0o777, 0o600)

  // progress from the workspace's state.json
  mkdirSync(run.workspace, { recursive: true })
  writeFileSync(join(run.workspace, 'state.json'), JSON.stringify({ stages: { intake: 'done', preflight: 'done' } }))
  let st = mod.runStatus(run)
  assert.equal(st.done, 2); assert.equal(st.report_ready, false)
  assert.equal((await mod.importLatest(deps)).ok, false, 'nothing finished to import')

  // the export is checked like an outside file
  const good = exportFor(run)
  writeFileSync(join(run.workspace, 'state.json'), JSON.stringify({ stages: Object.fromEntries(['intake', 'preflight', 'pipelines', 'methods', 'integrate', 'organs', 'insights', 'intervene', 'twin', 'review', 'report'].map((k) => [k, 'done'])) }))
  assert.equal(mod.runStatus(run).report_ready, true)
  assert.deepEqual(mod.checkExport({ ...good, schema: 'x' }, run).problems, ['schema must be la-export/1'])
  const outside = join(tmp('outside'), 'r.html'); writeFileSync(outside, 'x')
  assert.match(mod.checkExport({ ...good, report: { html: outside, sha256: sha(outside) } }, run).problems.join(), /outside the run workspace/)
  assert.match(mod.checkExport({ ...good, report: { ...good.report, sha256: 'bad' } }, run).problems.join(), /changed after/)
  assert.match(mod.checkExport({ ...good, board: Array(11).fill(good.board[0]) }, run).problems.join(), /more than 10/)
  assert.match(mod.checkExport({ ...good, plan: { items: Array(31).fill(good.plan.items[0]) } }, run).problems.join(), /more than 30/)

  // import, read-back, accept
  const imp = await mod.importLatest(deps)
  assert.equal(imp.ok, true, JSON.stringify(imp))
  assert.equal(deps.invalidated > 0, true)
  assert.equal(readFileSync(urlFile, 'utf8'), '', 'the MCP URL copy is cleared after import')
  assert.equal(imp.read_back.ok, true, imp.read_back.errors.join())
  assert.deepEqual(imp.read_back.items.map((i) => i.category), ['diet', 'other'])
  assert.deepEqual(imp.read_back.items[0].markers, ['低密度脂蛋白胆固醇'])
  const status = mod.statusNow(deps)
  assert.equal(status.current.organs[0].ai_risks[0].kind, 'llm_estimate')
  assert.equal(status.current.board[0].verdict_zh, '证据支持')
  const acc = await mod.acceptPlan(deps)
  assert.equal(acc.ok, true)
  assert.equal(acc.items, 2)
  const plan = readFileSync(join(dataDir, 'interventions', 'plan.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1)
  assert.equal(plan.source, 'analysis')
  assert.equal(plan.items[0].start, '2026-09-30')
  assert.equal(mod.currentImport(dataDir).meta.plan_accepted_version, plan.version)
}

// ---- the report is served with a CSP that forbids scripts and network
assert.match(mod.REPORT_CSP, /default-src 'none'/)
assert.match(mod.REPORT_CSP, /sandbox/)
assert.ok(!/script-src/.test(mod.REPORT_CSP))
console.log('analysis ok')
