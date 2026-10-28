// D02: a deep analysis belongs to the member whose run it was. Importing it and reading its plan back must
// read that member's store and record, never the member the page happens to show; the shown member's store is
// left byte for byte unchanged. Synthetic data only: this exercises module and tool level, not a real DSH UI.

import assert from 'node:assert/strict'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, relative } from 'node:path'
import * as mod from '../lib/index.js'

const analysesHome = mkdtempSync(join(tmpdir(), 'longpi-analysis-binding-home-'))
process.env.LONGPI_ANALYSES_HOME = analysesHome

const sha = (bytes) => createHash('sha256').update(bytes).digest('hex')
const temp = (tag) => mkdtempSync(join(tmpdir(), `longpi-analysis-binding-${tag}-`))

/** A finished run's workspace: a report and the la-export the plugin reads on import. */
function exportFor(run, planItems, planTitle = 'A 的方案') {
  mkdirSync(join(run.workspace, 'deliver'), { recursive: true })
  const html = join(run.workspace, 'deliver', 'report.html')
  writeFileSync(html, '<!doctype html><meta charset="utf-8"><h1>报告</h1>')
  const x = {
    schema: 'la-export/1', generated_at: '2026-10-20T10:00:00+08:00', generation: `g-${run.id}`,
    member: { age: 58, sex: 'male' }, workspace: run.workspace,
    report: { html, sha256: sha(readFileSync(html)) },
    readouts: [], organs: [], board: [],
    plan: { title: planTitle, note: '', items: planItems },
    retests: [], boundary_zh: '不是诊断。',
  }
  writeFileSync(join(run.workspace, 'deliver', 'la-export.json'), JSON.stringify(x))
  writeFileSync(join(run.workspace, 'state.json'), JSON.stringify({ stages: { report: 'done' } }))
  return x
}

/** Every regular file under the store, with its bytes hashed: a write to the store changes this list. */
function tree(dir) {
  const rows = []
  const walk = (at) => {
    for (const entry of readdirSync(at, { withFileTypes: true }).sort((left, right) => left.name.localeCompare(right.name))) {
      const path = join(at, entry.name)
      if (entry.isDirectory()) walk(path)
      else if (entry.isFile()) rows.push([relative(dir, path), sha(readFileSync(path))])
    }
  }
  walk(dir)
  return rows
}

/** Two family members on one install; the page shows B. */
function fixture(tag) {
  const root = temp(tag)
  const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  const b = mod.addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })
  mod.setActive(root, b.id)
  return { root, a, b, aDir: mod.personDir(root, a.id), bDir: mod.personDir(root, b.id) }
}

/** Module-level deps: the shown member is B; contextFor answers with that member's own record. */
function depsFor(root, shownDir, recordsByDir) {
  let invalidated = 0
  return {
    dataDir: () => shownDir,
    config: () => ({ dataDir: root, skillsHome: '', mcpUrl: '', member: '' }),
    context: async () => ({ today: mod.isoDay(), records: recordsByDir[shownDir] ?? { medications: [] } }),
    contextFor: async (dir) => ({ today: mod.isoDay(), records: recordsByDir[dir] ?? { medications: [] } }),
    invalidate: () => { invalidated += 1 },
    get invalidated() { return invalidated },
  }
}

// ---- importing A's run while the page shows B: A's store and record are used, B's store does not change
{
  const { root, a, b, aDir, bDir } = fixture('cross')
  // B already has an imported analysis of its own; it must stay B's
  const runB = mod.createRun(bDir, { mcpUrl: '', memberFolder: null })
  exportFor(runB, [{ category: 'diet', title: 'B 的饮食调整', detail: '', markers: [] }], 'B 的方案')
  const deps = depsFor(root, bDir, {})
  assert.equal((await mod.importLatest(deps, runB.id)).ok, true)
  assert.equal(mod.currentImport(bDir).value.plan.title, 'B 的方案')

  // A has a drug item on their record's medication plan; B's record does not link it.
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'drug', title: '阿托伐他汀', detail: '', markers: ['低密度脂蛋白胆固醇'] }])
  const ownerMeds = [{ name: '阿托伐他汀', plan_id: 'm-a-1' }]
  deps.contextFor = async (dir) => ({ today: mod.isoDay(), records: dir === aDir ? { medications: ownerMeds } : { medications: [] } })

  const bBefore = tree(bDir)
  const invalidationsBefore = deps.invalidated
  const res = await mod.importLatest(deps, runA.id)
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(res.run_id, runA.id)
  assert.equal(res.read_back.ok, true, res.read_back.errors.join('；'))
  assert.equal(res.read_back.run_id, runA.id, 'the plan read back is the analysis just imported, not the shown member\'s')
  assert.deepEqual(res.read_back.items.map((item) => item.title), ['阿托伐他汀'])
  assert.ok(!res.read_back.warnings.some((warning) => /用药计划中未找到/.test(warning)),
    `the owner's medication plan links the item: ${res.read_back.warnings.join('；')}`)
  assert.deepEqual(res.owner, { id: a.id, label_zh: 'A', is_current: false })
  assert.equal(mod.currentImport(aDir)?.meta.run_id, runA.id, 'A gets the import')
  assert.equal(mod.currentImport(bDir)?.value.plan.title, 'B 的方案', 'B keeps its own imported analysis')
  assert.deepEqual(tree(bDir), bBefore, "importing A's analysis leaves B's store byte for byte unchanged")
  assert.equal(deps.invalidated, invalidationsBefore, "the shown member's caches are not dropped for another member's import")

  // Reading A's imported plan back by store also uses A's record, not the shown member's.
  const backA = await mod.planReadBack(deps, aDir)
  assert.equal(backA.ok, true, backA.errors.join('；'))
  assert.equal(backA.run_id, runA.id)
  assert.ok(!backA.warnings.some((warning) => /用药计划中未找到/.test(warning)),
    `read-back for A uses A's medications: ${backA.warnings.join('；')}`)

  rmSync(root, { recursive: true, force: true })
}

// ---- the owner being removed while its context loads: nothing is written and no store is recreated
{
  const { root, a, aDir, bDir } = fixture('removed')
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'diet', title: 'A 的饮食调整', detail: '', markers: [] }])
  const deps = depsFor(root, bDir, {})
  deps.contextFor = async () => {
    mod.removePerson(root, a.id)
    rmSync(aDir, { recursive: true, force: true })
    return { today: mod.isoDay(), records: { medications: [] } }
  }
  const res = await mod.importLatest(deps, runA.id)
  assert.equal(res.ok, false)
  assert.match(res.error_zh, /未导入/)
  assert.equal(existsSync(aDir), false, 'a removed member\'s store is not recreated')
  rmSync(root, { recursive: true, force: true })
}

// ---- the shown member's own run: the member is removed while its context loads, nothing is written back
{
  const root = temp('same-removed')
  const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  mod.setActive(root, a.id)
  const aDir = mod.personDir(root, a.id)
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'diet', title: 'A 的饮食调整', detail: '', markers: [] }])
  const deps = depsFor(root, aDir, {})
  deps.context = async () => {
    mod.removePerson(root, a.id)
    rmSync(aDir, { recursive: true, force: true })
    return { today: mod.isoDay(), records: { medications: [] } }
  }
  const res = await mod.importLatest(deps, runA.id)
  assert.equal(res.ok, false)
  assert.match(res.error_zh, /成员已不在|未导入/)
  assert.equal(existsSync(aDir), false, 'the deleted store is not recreated by an import that was already reading')
  rmSync(root, { recursive: true, force: true })
}

// ---- the shown member's own run: abandoned while its context loads, the result is not written back
{
  const root = temp('same-abandoned')
  const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  mod.setActive(root, a.id)
  const aDir = mod.personDir(root, a.id)
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'diet', title: 'A 的饮食调整', detail: '', markers: [] }])
  const deps = depsFor(root, aDir, {})
  deps.context = async () => {
    mod.abandonAnalysis(deps, runA.id)
    return { today: mod.isoDay(), records: { medications: [] } }
  }
  const res = await mod.importLatest(deps, runA.id)
  assert.equal(res.ok, false)
  assert.match(res.error_zh, /结果已不在|未导入/)
  assert.equal(mod.currentImport(aDir), null, 'an abandoned run is not imported')
  rmSync(root, { recursive: true, force: true })
}

// ---- the page switches to another member while the owner's record is read: the result stays the owner's, the shown
// ---- member is only reported as current when it really is the owner at return time, and its store is not touched.
{
  const { root, a, aDir, bDir } = fixture('switch-while-reading')
  mod.setActive(root, a.id)
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'drug', title: '阿托伐他汀', detail: '', markers: [] }])
  const ownerMeds = [{ name: '阿托伐他汀', plan_id: 'm-a-2' }]
  const state = { page: aDir, invalidated: 0 }
  const deps = {
    dataDir: () => state.page,
    config: () => ({ dataDir: root, skillsHome: '', mcpUrl: '', member: '' }),
    // the page switches while the record is read: this context answers with the new member's record on purpose
    context: async () => { state.page = bDir; return { today: mod.isoDay(), records: { medications: [] } } },
    contextFor: async (dir) => ({ today: mod.isoDay(), records: { medications: dir === aDir ? ownerMeds : [] } }),
    invalidate: () => { state.invalidated += 1 },
  }
  const res = await mod.importLatest(deps, runA.id)
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.owner, { id: a.id, label_zh: 'A', is_current: false }, 'the member shown now is not the owner')
  assert.equal(res.read_back.run_id, runA.id)
  assert.ok(!res.read_back.warnings.some((warning) => /用药计划中未找到/.test(warning)),
    `the owner's context is read again after the switch: ${res.read_back.warnings.join('；')}`)
  assert.equal(state.invalidated, 0, 'the shown member is not the owner, so its caches are not dropped')
  assert.equal(mod.currentImport(aDir)?.meta.run_id, runA.id)
  assert.equal(mod.currentImport(bDir), null)
  rmSync(root, { recursive: true, force: true })
}

// ---- importing the shown member's own run: behaviour and attribution are unchanged
{
  const { root, b, bDir } = fixture('same')
  const runB = mod.createRun(bDir, { mcpUrl: '', memberFolder: null })
  exportFor(runB, [{ category: 'diet', title: 'B 的饮食调整', detail: '', markers: [] }], 'B 的方案')
  const deps = depsFor(root, bDir, {})
  const res = await mod.importLatest(deps, runB.id)
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.owner, { id: b.id, label_zh: 'B', is_current: true })
  assert.equal(res.read_back.ok, true)
  assert.equal(res.read_back.run_id, runB.id)
  assert.equal(deps.invalidated, 1, "the shown member's own import drops its caches")
  rmSync(root, { recursive: true, force: true })
}

// ---- the page switches while a stored plan is read back: the plan is still checked against its own store's record
{
  const { root, a, aDir, bDir } = fixture('readback-switch')
  mod.setActive(root, a.id)
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'drug', title: '阿托伐他汀', detail: '', markers: [] }])
  const ownerMeds = [{ name: '阿托伐他汀', plan_id: 'm-a-3' }]
  const stable = depsFor(root, aDir, {})
  stable.context = async () => ({ today: mod.isoDay(), records: { medications: ownerMeds } })
  stable.contextFor = async (dir) => ({ today: mod.isoDay(), records: { medications: dir === aDir ? ownerMeds : [] } })
  assert.equal((await mod.importLatest(stable, runA.id)).ok, true)
  const state = { page: aDir }
  const racing = {
    dataDir: () => state.page,
    config: () => ({ dataDir: root, skillsHome: '', mcpUrl: '', member: '' }),
    context: async () => { state.page = bDir; return { today: mod.isoDay(), records: { medications: [] } } },
    contextFor: async (dir) => ({ today: mod.isoDay(), records: { medications: dir === aDir ? ownerMeds : [] } }),
    invalidate: () => {},
  }
  const back = await mod.planReadBack(racing, aDir)
  assert.equal(back.ok, true, back.errors.join('；'))
  assert.equal(back.run_id, runA.id)
  assert.ok(!back.warnings.some((warning) => /用药计划中未找到/.test(warning)),
    `read-back uses the plan's own store record after a page switch: ${back.warnings.join('；')}`)
  rmSync(root, { recursive: true, force: true })
}

// ---- the holder's own run imported while a family member is shown: owner is the holder, the member shown is untouched
{
  const root = temp('self')
  const b = mod.addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })
  mod.setActive(root, b.id)
  const bDir = mod.personDir(root, b.id)
  const runSelf = mod.createRun(root, { mcpUrl: '', memberFolder: null })
  exportFor(runSelf, [{ category: 'diet', title: '我自己的饮食调整', detail: '', markers: [] }], '我的方案')
  const bBefore = tree(bDir)
  const res = await mod.importLatest(depsFor(root, bDir, {}), runSelf.id)
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.deepEqual(res.owner, { id: mod.SELF, label_zh: '我', is_current: false })
  assert.equal(res.read_back.run_id, runSelf.id)
  assert.equal(mod.currentImport(root)?.meta.run_id, runSelf.id)
  assert.deepEqual(tree(bDir), bBefore, "the family member's store stays untouched")
  rmSync(root, { recursive: true, force: true })
}

// ---- a store's own connection is the one read for that store (holder configured, family link saved)
{
  const root = temp('config')
  const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  mod.setActive(root, a.id)
  mod.saveConnection(mod.personDir(root, a.id), { mcp_url: 'http://127.0.0.1:18060/mcp/A-LINK' })
  const config = { dataDir: root, mcpUrl: 'http://127.0.0.1:18060/mcp/HOLDER', mcpToken: 'HOLDER-JWT', member: '' }
  const forMember = mod.effectiveConfigFor(config, mod.personDir(root, a.id))
  assert.match(forMember.mcpUrl, /A-LINK$/)
  assert.equal(forMember.mcpToken, '', "a family member never reads through the holder's token")
  const forSelf = mod.effectiveConfigFor(config, root)
  assert.equal(forSelf.mcpUrl, config.mcpUrl, 'the holder keeps the configured address when no connection is saved')
  assert.equal(forSelf.mcpToken, config.mcpToken)
  rmSync(root, { recursive: true, force: true })
}

// ---- a lookup for another member's run does not create an analysis folder in the shown member's store
{
  const root = temp('scan')
  const b = mod.addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })   // shown first in the registry
  const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  mod.setActive(root, b.id)
  const aDir = mod.personDir(root, a.id)
  const bDir = mod.personDir(root, b.id)
  const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
  exportFor(runA, [{ category: 'diet', title: 'A 的饮食调整', detail: '', markers: [] }])
  const res = await mod.importLatest(depsFor(root, bDir, {}), runA.id)
  assert.equal(res.ok, true, JSON.stringify(res))
  assert.equal(existsSync(join(bDir, 'analysis')), false, "a lookup for another member's run leaves the shown member's store untouched")
  rmSync(root, { recursive: true, force: true })
}

// ---- the registered import_analysis tool: cross-member plans are not handed over for saving, and the page's
// ---- member is told to switch; once the owner is shown, the same import is read back for saving.
{
  const root = temp('tool')
  const listeners = new Map()
  const disposers = []
  const tools = new Map()
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} }, webServer: { register: () => () => {} },
    connection: { requestRejection: () => undefined }, commands: { register: () => {} },
    inject: (_names, cb) => cb(ctx),
    get: () => undefined,
    on: (name, listener) => {
      const previous = listeners.get(name) ?? []
      listeners.set(name, [...previous, listener])
      return () => {}
    },
    effect: (fn) => { const dispose = fn(); disposers.push(dispose); return dispose },
  }
  const config = {
    dataDir: root, mcpUrl: '', mcpToken: '', member: '', timeoutMs: 100,
    pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '', skillsHome: '/nonexistent/skills',
    skillPython: '/nonexistent/python', skillTimeoutMs: 100, skillRuntimes: {}, maxSkillMatches: 6, skillsVersion: '', bootstrapWorkspace: false,
  }
  await mod.apply(ctx, config)
  try {
    const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
    const b = mod.addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })
    mod.setActive(root, b.id)
    const aDir = mod.personDir(root, a.id)
    const bDir = mod.personDir(root, b.id)
    // A's own record remembers the drug the analysis plan names; the item can only link with A's medications.
    writeFileSync(join(aDir, 'medication_statements.jsonl'),
      `${JSON.stringify({ name: '阿托伐他汀', dose_text: '20 mg', frequency_text: '每天 1 次', since: '2026-01-01', at: '2026-01-01T00:00:00.000Z' })}\n`)
    const runA = mod.createRun(aDir, { mcpUrl: '', memberFolder: null })
    exportFor(runA, [{ category: 'drug', title: '阿托伐他汀', detail: '', markers: ['低密度脂蛋白胆固醇'] }])
    const bBefore = tree(bDir)

    const imported = await tools.get('import_analysis').execute({ run_id: runA.id })
    assert.equal(imported.ok, true, JSON.stringify(imported))
    assert.equal(imported.plan_for_save, null, "another member's plan is not handed over to save_intervention_plan")
    assert.equal(imported.read_back.plan, null, 'the saveable plan is not exposed for another member either')
    assert.deepEqual(imported.owner, { id: a.id, label_zh: 'A', is_current: false })
    assert.match(imported.how_to_use, /在看/)
    assert.ok(!imported.read_back.warnings.some((warning) => /用药计划中未找到/.test(warning)),
      `the plugin reads the owner's own medication record: ${imported.read_back.warnings.join('；')}`)
    assert.deepEqual(tree(bDir), bBefore, "the shown member's store is untouched")
    assert.equal(mod.currentImport(aDir)?.meta.run_id, runA.id)

    mod.setActive(root, a.id)
    const again = await tools.get('import_analysis').execute({ run_id: runA.id })
    assert.equal(again.ok, true, JSON.stringify(again))
    assert.deepEqual(again.owner, { id: a.id, label_zh: 'A', is_current: true })
    assert.ok(again.plan_for_save, 'the plan is handed over once its owner is the member shown')
    assert.equal(again.plan_for_save.title, 'A 的方案')
    assert.ok(again.read_back.plan, 'the saveable plan is exposed again once its owner is shown')
    // D21: switching AFTER import returns must not turn A's saveable plan into B's plan.
    const save = tools.get('save_intervention_plan')
    mod.setActive(root, b.id)
    const wrongMember = await save.execute({ ...again.plan_for_save, confirm: false })
    assert.equal(wrongMember.ok, false, 'an imported plan cannot be read back for a different member')
    assert.deepEqual(tree(bDir), bBefore)
    mod.setActive(root, a.id)
    const checked = await save.execute({ ...again.plan_for_save, confirm: false })
    assert.equal(checked.ok, true)
    const saved = await save.execute({ ...again.plan_for_save, save_token: checked.save_token, confirm: true })
    assert.equal(saved.saved, true)
    assert.equal(mod.currentPlan(aDir).title, 'A 的方案')
    assert.deepEqual(tree(bDir), bBefore)
    const retry = await tools.get('import_analysis').execute({ run_id: runA.id })
    assert.equal(mod.abandonAnalysis({ dataDir: () => aDir }, runA.id), true)
    const abandoned = await save.execute({ ...retry.plan_for_save, confirm: false })
    assert.equal(abandoned.ok, false, 'a token from an abandoned analysis is invalid')
  } finally {
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    rmSync(root, { recursive: true, force: true })
  }
}

rmSync(analysesHome, { recursive: true, force: true })
console.log('analysis member binding ok')
