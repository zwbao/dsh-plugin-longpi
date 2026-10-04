// M12 deep analysis: start gates (skill version, member, adult, consents, age and sex), run folders and ids,
// stage progress and stopped runs, the la-export/1 checks (own workspace, regular files, element shapes), the
// sanitized report, import that swaps whole, plan read-back and the accept that must match what was read,
// consent withdrawal, deleting the local store with its run folders.

import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, symlinkSync, utimesSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'

const tmp = (p) => mkdtempSync(join(tmpdir(), `longpi-analysis-${p}-`))
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
process.env.LONGPI_ANALYSES_HOME = tmp('home')

// A stand-in for the analyst's harness: the two subcommands the version check looks for, and `twin compare`
// answering like the real one (rows by marker, an error on stderr for two members).
const FAKE_LA = `# s = sub.add_parser("export")
# s = sub.add_parser("mirobody")
import json, sys
a = sys.argv[1:]
if a[:2] == ["twin", "compare"]:
    prev = json.load(open(a[a.index("--prev") + 1])); cur = json.load(open(a[a.index("--cur") + 1]))
    if prev["member"]["id"] != cur["member"]["id"]:
        print("error: the two twin snapshots belong to different members", file=sys.stderr); sys.exit(3)
    p = {o["marker"]: o["value"] for o in prev["observations"]}
    rows = []
    for o in cur["observations"]:
        if o["marker"] not in p: continue
        ch = round(100 * (o["value"] - p[o["marker"]]) / p[o["marker"]], 1)
        v = "not_judged" if o["marker"] == "X" else "decrease_beyond_noise" if ch < -20 else "increase_beyond_noise" if ch > 20 else "within_noise"
        rows.append({"marker": o["marker"], "prev": p[o["marker"]], "cur": o["value"], "unit": "mmol/L", "change_pct": ch, "verdict": v})
    print(json.dumps({"alerts": [], "rows": rows}))
`

function skill(version, withBridge = true) {
  const dir = tmp('skill')
  mkdirSync(join(dir, 'scripts'))
  writeFileSync(join(dir, 'SKILL.md'), `---\nname: longevity-analyst\nmetadata:\n  version: "${version}"\n---\n`)
  writeFileSync(join(dir, 'scripts', 'la.py'), withBridge ? FAKE_LA : 'pass\n')
  return join(dir, 'SKILL.md')
}
const GOOD_SKILL = skill('0.7.0')

function depsFor(dataDir, config = {}) {
  mod.bindPrivacy({ dataDir: () => dataDir, scienceMode: () => 'off', codexEnabled: () => true })
  let invalidated = 0
  return {
    dataDir: () => dataDir,
    config: () => ({ mcpUrl: '', member: '', skillsHome: '/lib/longevity-skills', dataDir, ...config }),
    context: async () => ({ today: '2026-09-30', records: { medications: [] } }),
    invalidate: () => { invalidated += 1 },
    get invalidated() { return invalidated },
  }
}
const grant = (dataDir, scope, decision = 'granted') => mod.recordConsent(dataDir, { scope, decision, mode: 'off', textVersion: 't1' })

function readyMember(tag, config = {}) {
  const dataDir = tmp(tag)
  grant(dataDir, 'pipl_sensitive'); grant(dataDir, 'data_flow_deepseek')
  mod.writeProfile(dataDir, { ...mod.EMPTY_PROFILE, age: 58, birthYear: 1968, sex: 'male' })
  return { dataDir, deps: depsFor(dataDir, config) }
}

function twinFor(run, memberId, values) {
  mkdirSync(join(run.workspace, 'work', 'twin'), { recursive: true })
  const path = join(run.workspace, 'work', 'twin', 'twin.json')
  writeFileSync(path, JSON.stringify({ schema: 'la-twin/1', member: { id: memberId }, observations: Object.entries(values).map(([marker, value]) => ({ t: '2026-09-10', marker, value })), readouts: [] }))
  return { path, sha256: sha(readFileSync(path)) }
}

function exportFor(run, over = {}) {
  mkdirSync(join(run.workspace, 'deliver'), { recursive: true })
  const html = join(run.workspace, 'deliver', 'report.html')
  writeFileSync(html, '<!doctype html><meta charset="utf-8"><h1>报告</h1><a href="https://evil.example/?ldl=4.9">点我</a><a href="#s1">目录</a><img src="https://x/y.png" onerror="alert(1)"><script>fetch("/api/longpi/profile")</script>')
  const x = {
    schema: 'la-export/1', generated_at: '2026-09-30T10:00:00+08:00', generation: 'g1',
    member: { age: 58, sex: 'male' }, workspace: run.workspace,
    report: { html, sha256: sha(readFileSync(html)) },
    readouts: [{ id: 'organ.kidney.risk.1', label_zh: '慢性肾病', value: 0.08, unit: '概率', kind: 'llm_estimate', low: 0.04, high: 0.16, horizon_years: 10, group: 'organ_ai_estimate' },
               { id: 'native.egfr', label_zh: 'eGFR', value: 88, unit: 'mL/min/1.73m²', kind: 'computed', group: 'method' }],
    organs: [{ organ: 'kidney', label_zh: '肾脏', measured: [], indices: ['native.egfr'], ai_age: null, ai_risks: ['organ.kidney.risk.1'], overrides: [] },
             { organ: 'metabolic', label_zh: '代谢', measured: [], indices: [], ai_age: null, ai_risks: [], overrides: [{ disease: '2 型糖尿病', message_zh: '单次空腹血糖已达糖尿病诊断阈值；需另日复查' }] }],
    board: [{ id: 'Q1', title_zh: 'LDL 高是遗传的吗', hypothesis_zh: '', verdict: 'supported', verdict_zh: '证据支持', confidence: 'moderate', summary_zh: 'LDLR 致病变异。', next_step_zh: '遗传咨询。', limitations_zh: '单次测量。' }],
    plan: { title: '深度分析干预方案', note: '营养师审核后生效', items: [
      { id: 'la-i1', category: 'diet', title: '减少饱和脂肪', detail: '以鱼和豆类替代红肉', markers: ['低密度脂蛋白胆固醇'], executor: 'nutritionist', kind: 'diet', evidence_grade: 'A' },
      { id: 'la-i2', category: 'other', title: '到心内科做家族性高胆固醇血症评估', detail: '', markers: [], executor: 'physician', kind: 'referral', evidence_grade: 'B' },
      { id: 'la-i3', category: 'supplement', title: '与医生讨论是否补充维生素 D', detail: '25(OH)D 偏低', markers: [], executor: 'nutritionist', kind: 'supplement', evidence_grade: 'B' }] },
    retests: [{ what: '低密度脂蛋白胆固醇', after_weeks: 12, due: '2026-12-23' }],
    boundary_zh: '不是诊断。',
    ...over,
  }
  writeFileSync(join(run.workspace, 'deliver', 'la-export.json'), JSON.stringify(x))
  writeFileSync(join(run.workspace, 'state.json'), JSON.stringify({ stages: Object.fromEntries(['intake', 'preflight', 'pipelines', 'methods', 'integrate', 'organs', 'insights', 'intervene', 'twin', 'review', 'report'].map((k) => [k, 'done'])) }))
  return x
}

// ---- start gates, in order
{
  const dataDir = tmp('gates')
  const deps = depsFor(dataDir)
  process.env.LONGPI_ANALYST_SKILL = join(tmp('none'), 'SKILL.md')
  assert.equal(mod.startBlockers(dataDir)?.missing, 'skill')
  process.env.LONGPI_ANALYST_SKILL = skill('0.5.0')
  assert.equal(mod.startBlockers(dataDir)?.missing, 'skill_version')
  process.env.LONGPI_ANALYST_SKILL = skill('0.7.1', false)
  assert.equal(mod.startBlockers(dataDir)?.missing, 'skill_version', 'a harness without export/mirobody is too old')
  process.env.LONGPI_ANALYST_SKILL = GOOD_SKILL
  assert.equal(mod.startBlockers(dataDir, { member: 'family-2' })?.missing, 'member', 'a care-circle member is never analysed from the holder\'s data')
  // no consent is asked for a deep analysis (owner decision): the profile is the next thing missing
  assert.equal(mod.startBlockers(dataDir)?.missing, 'profile')
  mod.writeProfile(dataDir, { ...mod.EMPTY_PROFILE, age: 40, birthYear: 1986, sex: 'other' })
  assert.match(mod.startBlockers(dataDir)?.reply_zh ?? '', /生理性别/)
  mod.writeProfile(dataDir, { ...mod.EMPTY_PROFILE, age: 58, birthYear: 1968, sex: 'male' })
  assert.equal(mod.startBlockers(dataDir), null)
  assert.equal((await mod.startRun(deps, { dataFolder: 'relative/folder', trigger: 'member', reasonZh: '用户要求' })).missing, 'folder')
  const res = await mod.startRun(deps, { trigger: 'member', reasonZh: '用户要求做一次深度分析' })
  assert.equal(res.ok, true)
  assert.match(res.prompt_zh, /58 岁，男/)
  assert.ok(!/mirobody pull/.test(res.prompt_zh), 'no Mirobody, no pull step')
  assert.ok((await mod.statusNow(deps)).blockers === null)
}

// ---- run ids never collide; the member's folder is linked, never written to
{
  const { dataDir, deps } = readyMember('ids')
  const at = new Date('2026-09-30T08:00:00Z')
  const a = mod.createRun(dataDir, { mcpUrl: '', memberFolder: null, now: at })
  const b = mod.createRun(dataDir, { mcpUrl: '', memberFolder: null, now: at })
  assert.notEqual(a.id, b.id)
  mod.abandonAnalysis(deps, a.id); mod.abandonAnalysis(deps, b.id)
  const folder = tmp('member-folder'); writeFileSync(join(folder, 'labs.pdf'), 'x')
  const res = await mod.startRun(deps, { dataFolder: folder, trigger: 'member', reasonZh: '用户要求' })
  const run = mod.listRuns(dataDir).at(-1)
  assert.ok(res.prompt_zh.includes(run.data_dir) && !res.prompt_zh.includes(folder), 'the skill works in the run\'s data folder')
  assert.equal(readFileSync(join(run.data_dir, 'labs.pdf'), 'utf8'), 'x')
  writeFileSync(join(run.data_dir, 'mirobody_labs_2026-09-10.csv'), 'pulled')
  assert.ok(!existsSync(join(folder, 'mirobody_labs_2026-09-10.csv')))
}

// ---- a run with Mirobody: the URL goes to a 0600 file, never into the request text
{
  const { dataDir, deps } = readyMember('run', { mcpUrl: 'http://127.0.0.1:18060/mcp/SECRET-XYZ' })
  const res = await mod.startRun(deps, { trigger: 'member', reasonZh: '用户要求做一次深度分析' })
  assert.ok(!res.prompt_zh.includes('SECRET-XYZ'))
  assert.match(res.prompt_zh, /mirobody pull .* --mcp-url-file /)
  const run = mod.listRuns(dataDir).at(-1)
  const urlFile = join(run.root, 'mirobody_mcp_url')
  assert.equal(statSync(urlFile).mode & 0o777, 0o600)

  // progress, and a run that stopped does not lock the page
  mkdirSync(run.workspace, { recursive: true })
  writeFileSync(join(run.workspace, 'state.json'), JSON.stringify({ stages: { intake: 'done', preflight: 'done' } }))
  let st = mod.runStatus(run)
  assert.equal(st.done, 2); assert.equal(st.active, true)
  const old = new Date(Date.now() - mod.STALE_MS - 60_000)
  utimesSync(join(run.workspace, 'state.json'), old, old)
  assert.equal(mod.runStatus({ ...run, started_at: old.toISOString() }).active, false, 'no progress for hours: stopped, not running')
  assert.equal((await mod.importLatest(deps)).ok, false, 'nothing finished to import')

  // the export is checked like an outside file
  const good = exportFor(run)
  assert.equal(mod.runStatus(run).report_ready, true)
  const check = (over) => mod.checkExport({ ...good, ...over }, run).problems.join(' | ')
  assert.match(check({ schema: 'x' }), /schema/)
  assert.match(check({ readouts: [null] }), /readouts\[0\]/)
  assert.match(check({ organs: [{ ...good.organs[0], measured: 'x' }] }), /organs\[0\]/)
  assert.match(check({ plan: { items: [null] } }), /plan.items\[0\]/)
  assert.match(check({ board: Array(11).fill(good.board[0]) }), /at most 10/)
  const outside = join(tmp('outside'), 'r.html'); writeFileSync(outside, 'x')
  assert.match(check({ report: { html: outside, sha256: sha(readFileSync(outside)) } }), /deliver\/report.html/)
  assert.match(check({ report: { ...good.report, sha256: 'bad' } }), /changed after/)
  const cleaned = mod.checkExport({ ...good, board: [{ ...good.board[0], confidence: '__proto__', extra: { x: 1 } }] }, run).value
  assert.equal(cleaned.board[0].confidence, '__proto__')
  assert.ok(!('extra' in cleaned.board[0]), 'unknown fields are dropped')
  assert.equal(cleaned.plan.items[1].executor, 'physician', 'the executor survives the rebuild')
  assert.match(check({ plan: { items: [{ ...good.plan.items[0], executor: 'robot' }] } }), /executor must be one of/)
  assert.equal(mod.checkExport({ ...good, plan: { items: [{ title: 'x', markers: [] }] } }, run).value.plan.items[0].executor, null, 'an older export without executors still imports')
  assert.match(check({ twin: { path: join(tmp('elsewhere'), 'twin.json'), sha256: 'x' } }), /work\/twin\/twin.json/)
  // routing: the physician's items and the doctor-only kinds go to the doctor, whoever carries them out
  assert.equal(mod.itemRoute({ executor: 'member', kind: 'exercise' }), 'plan')
  assert.equal(mod.itemRoute({ executor: 'nutritionist', kind: 'diet' }), 'plan')
  assert.equal(mod.itemRoute({ executor: 'physician', kind: 'lifestyle' }), 'doctor')
  assert.equal(mod.itemRoute({ executor: 'nutritionist', kind: 'test' }), 'doctor')
  assert.equal(mod.itemRoute({ executor: null, kind: '' }), 'plan')

  // import, read-back, accept (only what was read back)
  const imp = await mod.importLatest(deps)
  assert.equal(imp.ok, true, JSON.stringify(imp))
  assert.equal(readFileSync(urlFile, 'utf8'), '', 'the MCP URL copy is cleared after import')
  const report = readFileSync(join(dataDir, 'analysis', 'current', 'report.html'), 'utf8')
  assert.ok(!/evil\.example|<script|onerror|https:\/\/x\/|fetch\(/.test(report), 'links, scripts (with their code) and loads are stripped')
  assert.match(report, /href="#s1"/)
  const back = imp.read_back
  assert.equal(back.ok, true, back.errors.join())
  assert.deepEqual(back.items.map((i) => i.title), ['减少饱和脂肪'], 'the nutritionist\'s diet item is the person\'s to do; the referral and the supplement are not')
  assert.deepEqual(back.doctor_items.map((i) => i.kind_zh), ['转诊', '补剂'])
  assert.equal(imp.plan_items, 1); assert.equal(imp.doctor_items, 2)
  assert.ok(back.items.every((i) => !i.id.startsWith('la-')), 'items get LongPi ids, never the analysis\'s')
  const status = await mod.statusNow(deps)
  assert.equal(status.current.organs[1].overrides[0].disease, '2 型糖尿病')
  assert.equal((await mod.acceptPlan(deps, {})).stale, true, 'an accept without what was read is refused')
  // another import lands between the read-back and the click
  exportFor(run, { plan: { title: 'B', note: '', items: [{ category: 'drug', title: 'STOP STATIN', detail: '', markers: [] }] } })
  assert.equal((await mod.importLatest(deps)).ok, true)
  const late = await mod.acceptPlan(deps, { run_id: back.run_id, plan_key: back.plan_key })
  assert.equal(late.ok, false); assert.equal(late.stale, true)
  const fresh = await mod.planReadBack(deps)
  const acc = await mod.acceptPlan(deps, { run_id: fresh.run_id, plan_key: fresh.plan_key })
  assert.equal(acc.ok, true, JSON.stringify(acc))
  const plan = readFileSync(join(dataDir, 'interventions', 'plan.jsonl'), 'utf8').trim().split('\n').map((l) => JSON.parse(l)).at(-1)
  assert.equal(plan.source, 'analysis'); assert.equal(plan.items[0].title, 'STOP STATIN')
  // importing the same result again keeps it accepted (no second save offered)
  assert.equal((await mod.importLatest(deps)).ok, true)
  assert.equal(mod.currentImport(dataDir).meta.plan_accepted_version, plan.version)
  assert.equal((await mod.acceptPlan(deps, { run_id: fresh.run_id, plan_key: fresh.plan_key })).ok, false)

  // abandon hides a run
  assert.equal(mod.abandonAnalysis(deps, run.id), true)
  assert.ok(!mod.listRuns(dataDir).some((r) => r.id === run.id))

  // deleting the local store removes the run folders too
  assert.ok(existsSync(run.root))
  mod.deleteLocalStore(dataDir)
  assert.ok(!existsSync(run.root), 'run folders go with the local store')
}

// ---- two analyses: a fixed member id, the twin kept with each import, the earlier one compared by la.py; the doctor brief
{
  const { dataDir, deps } = readyMember('twins')
  assert.equal(mod.memberIdFor('self'), 'lp-me'); assert.equal(mod.memberIdFor('p01ab'), 'lp-p01ab')
  const start = await mod.startRun(deps, { trigger: 'member', reasonZh: '用户要求' })
  assert.match(start.prompt_zh, /--member-id）用：lp-me/)
  const first = mod.listRuns(dataDir).at(-1)
  exportFor(first, { twin: twinFor(first, 'lp-me', { LDL: 4.2, HDL: 1.1, X: 3 }) })
  const one = await mod.importLatest(deps, first.id)
  assert.equal(one.ok, true, JSON.stringify(one)); assert.equal(one.compare, null, 'nothing to compare with yet')
  assert.ok(existsSync(join(dataDir, 'analysis', 'current', 'twin.json')))

  // with no triage finding, the analysis's items for a doctor still make a brief
  const made = await mod.buildBrief({ config: {}, dataDir, records: { indicators: [], medications: [], profile: { age: 58, sex: 'male' } }, today: '2026-09-30', care: { findings: [], seen: [] } })
  assert.ok(made, 'a brief is made from the analysis alone')
  assert.deepEqual(made.brief.analysis_zh, ['到心内科做家族性高胆固醇血症评估', '与医生讨论是否补充维生素 D：25(OH)D 偏低'])
  assert.match(made.markdown, /## 深度分析建议由医生评估的事项[\s\S]*家族性高胆固醇血症/)
  assert.ok(!/减少饱和脂肪/.test(made.markdown), 'the person\'s own items are not in the brief')

  mod.abandonAnalysis(deps, first.id)
  await mod.startRun(deps, { trigger: 'member', reasonZh: '复测后再分析' })
  const second = mod.listRuns(dataDir).at(-1)
  exportFor(second, { twin: twinFor(second, 'lp-me', { LDL: 3.1, HDL: 1.15, X: 2 }) })
  const two = await mod.importLatest(deps, second.id)
  assert.equal(two.ok, true, JSON.stringify(two))
  assert.equal(two.compare.ok, true, JSON.stringify(two.compare))
  assert.equal(two.compare.prev_run_id, first.id)
  assert.deepEqual(two.compare.rows.map((r) => [r.marker, r.verdict]), [['LDL', 'decrease_beyond_noise'], ['HDL', 'within_noise']])
  assert.equal(two.compare.not_judged, 1, 'a value with no noise model is counted, not judged')
  assert.equal(mod.currentSummary(dataDir).compare.rows.length, 2)
  // importing the same run again keeps the pair and the comparison
  assert.equal((await mod.importLatest(deps, second.id)).compare.prev_run_id, first.id)
  assert.ok(existsSync(join(dataDir, 'analysis', 'current', 'prev-twin.json')))

  // an older analysis with another member id cannot be compared: said plainly, the import still goes in
  mod.abandonAnalysis(deps, second.id)
  await mod.startRun(deps, { trigger: 'member', reasonZh: '再分析一次' })
  const third = mod.listRuns(dataDir).at(-1)
  exportFor(third, { twin: twinFor(third, 'member-7f3a', { LDL: 3.0 }) })
  const three = await mod.importLatest(deps, third.id)
  assert.equal(three.ok, true)
  assert.equal(three.compare.ok, false); assert.match(three.compare.error_zh, /会员编号不同/)
}

// ---- a workspace that is a link out of the analyses root, or a report that is not a regular file, is refused
{
  const { dataDir } = readyMember('link')
  const run = mod.createRun(dataDir, { mcpUrl: '', memberFolder: null })
  const victim = tmp('victim')
  symlinkSync(victim, run.workspace)
  exportFor(run)
  assert.match(mod.readExport(run).problems.join(), /own folder/)
  const run2 = mod.createRun(dataDir, { mcpUrl: '', memberFolder: null })
  const x = exportFor(run2)
  rmSync(x.report.html)
  execFileSync('mkfifo', [x.report.html])
  assert.match(mod.checkExport(x, run2).problems.join(), /regular file/, 'a FIFO is never read (it would block the server)')
}

// ---- who decides: the AI starts only on new data and at most every 30 days; the member may always ask
{
  const { dataDir, deps: base } = readyMember('auto')
  let records = { indicators: [{ name: 'LDL', value: '3.8', unit: 'mmol/L', date: '2026-09-10' }] }
  const deps = { ...base, context: async () => ({ today: '2026-09-30', records: { ...records, medications: [] } }) }
  assert.equal((await mod.startRun(deps, { trigger: 'ai', reasonZh: '' })).missing, 'reason', 'a start without a reason is refused')
  // the switch is off by default: the AI may only ask, and says what it costs
  let ready = mod.analysisReadiness(dataDir, { dataDir }, records, '2026-09-30')
  assert.equal(ready.auto_on, false); assert.equal(ready.auto_allowed, false); assert.equal(ready.new_data, true)
  assert.match(mod.analysisReadinessLine(ready), /自动深度分析没有打开.*问他要不要做.*token/)
  assert.equal((await mod.startRun(deps, { trigger: 'ai', reasonZh: '有新数据' })).missing, 'auto_off')
  // asked once per batch of new data
  mod.markAsked(dataDir, ready.newest)
  assert.match(mod.analysisReadinessLine(mod.analysisReadiness(dataDir, { dataDir }, records, '2026-09-30')), /已经问过用户，不要再问/)
  mod.setAutoEnabled(dataDir, true)
  ready = mod.analysisReadiness(dataDir, { dataDir }, records, '2026-09-30')
  assert.equal(ready.auto_allowed, true, ready.why_zh)
  assert.match(mod.analysisReadinessLine(ready), /可以由你决定现在开始/)
  const first = await mod.startRun(deps, { trigger: 'ai', reasonZh: '有 9 月体检的新化验，还没做过深度分析' })
  assert.equal(first.ok, true, JSON.stringify(first))
  assert.equal(mod.listRuns(dataDir).at(-1).trigger, 'ai')
  // a run is going: the AI may not start another; neither may the member
  assert.equal((await mod.startRun(deps, { trigger: 'ai', reasonZh: 'x' })).missing, 'not_now')
  assert.equal((await mod.startRun(deps, { trigger: 'member', reasonZh: 'x' })).missing, 'running')
  // it finished: nothing new since, so no automatic run
  const run = mod.listRuns(dataDir).at(-1)
  exportFor(run)
  ready = mod.analysisReadiness(dataDir, { dataDir }, records, '2026-09-30')
  assert.equal(ready.new_data, false); assert.equal(ready.auto_allowed, false)
  assert.equal((await mod.startRun(deps, { trigger: 'ai', reasonZh: 'x' })).missing, 'not_now')
  // new data, but within 30 days of the last automatic start: still no; the member asking is allowed
  records = { indicators: [{ name: 'LDL', value: '3.4', unit: 'mmol/L', date: '2026-10-05' }] }
  ready = mod.analysisReadiness(dataDir, { dataDir }, records, '2026-10-06')
  assert.equal(ready.new_data, true); assert.equal(ready.auto_allowed, false)
  assert.match(ready.why_zh, /不足 30 天/)
  const asked = await mod.startRun({ ...deps, context: async () => ({ today: '2026-10-06', records: { ...records, medications: [] } }) }, { trigger: 'member', reasonZh: '用户要求复查后再分析' })
  assert.equal(asked.ok, true, JSON.stringify(asked))
  // after 30 days and with new data, the AI may start again
  mod.abandonAnalysis(deps, mod.listRuns(dataDir).at(-1).id)
  records = { indicators: [{ name: 'LDL', value: '3.1', unit: 'mmol/L', date: '2026-11-20' }] }
  ready = mod.analysisReadiness(dataDir, { dataDir }, records, '2026-11-21')
  assert.equal(ready.auto_allowed, true, ready.why_zh)
}

// ---- the report is served with a CSP that forbids scripts and network
assert.match(mod.REPORT_CSP, /default-src 'none'/)
assert.match(mod.REPORT_CSP, /sandbox/)
assert.ok(!/script-src/.test(mod.REPORT_CSP))
assert.equal(mod.sanitizeReport('<a href="javascript:x">a</a><a href=\'#t\'>b</a><form action="https://e"><input></form>'), '<a>a</a><a href=\'#t\'>b</a>')
console.log('analysis ok')
