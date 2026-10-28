// D21: registered save tool + approval hooks, with real stores and no external service.
import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { test } from 'node:test'
import { registerTrackingTools } from '../src/tools-tracking.ts'
import * as mod from '../src/interventions.ts'
import { registerApprovals, READ_BACK_MS, resetReadBacks } from '../src/tools-approval.ts'
import { addPerson, personDir, setActive, removePerson } from '../src/people/store.ts'
import { currentPlan, isoDay } from '../src/interventions.ts'
import { deleteLocalStore } from '../src/privacy/delete.ts'

const PLAN = { title: '散步方案', source: 'chat', items: [{ category: 'exercise', title: '散步', start: isoDay(), markers: [] }] }
function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'longpi-plan-binding-'))
  const a = addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  const b = addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })
  setActive(root, a.id)
  const tools = new Map(), hooks = new Map()
  const ctx = { tools: { register: tool => tools.set(tool.name, tool) }, on: (name, fn) => hooks.set(name, fn) }
  const config = { dataDir: root, mcpUrl: '', mcpToken: '', member: '', skillsHome: '', timeoutMs: 100, pythonBin: '/nonexistent/python' }
  registerTrackingTools(ctx, () => config, { mounted: false, peer: false, pluginHome: '' })
  registerApprovals(ctx, { rootDir: () => root })
  const actor = { agent: { session: { id: root } } }
  const save = (args, exec = actor) => tools.get('save_intervention_plan').execute(args, exec)
  const approve = (args, exec = actor, next = async () => ({ kind: 'allow' })) => hooks.get('tools/pre-execute')({ ...exec, name: 'save_intervention_plan', arguments: args }, next)
  const aDir = personDir(root, a.id), bDir = personDir(root, b.id)
  return { root, a, b, aDir, bDir, save, approve, actor, close: () => { resetReadBacks(); rmSync(root, { recursive: true, force: true }) } }
}

test('ordinary chat read-back saves only to its original member; token is single-use', async () => {
  const f = fixture()
  try {
    const read = await f.save({ ...PLAN, confirm: false })
    assert.equal(read.ok, true)
    const args = { ...PLAN, save_token: read.save_token, confirm: true }
    assert.equal((await f.approve(args)).kind, 'ask')
    setActive(f.root, f.b.id)
    assert.equal((await f.approve(args)).kind, 'deny')
    assert.equal((await f.save(args)).saved, false, 'switch while approval is open must still be refused by the body')
    assert.equal(currentPlan(f.bDir), null)
    setActive(f.root, f.a.id)
    assert.equal((await f.save(args)).saved, true)
    assert.equal(currentPlan(f.aDir).title, PLAN.title)
    assert.equal((await f.save(args)).saved, false, 'a completed token cannot save twice')
  } finally { f.close() }
})

for (const scenario of ['missing-token', 'changed-plan', 'different-session', 'expired', 'deleted', 'cleared', 'switch-during-read', 'delete-during-read']) {
  test(`save is rejected: ${scenario}`, async () => {
    const f = fixture()
    const realNow = Date.now
    try {
      const read = await f.save({ ...PLAN, confirm: false })
      const args = { ...PLAN, save_token: read.save_token, confirm: true }
      if (scenario === 'missing-token') delete args.save_token
      if (scenario === 'changed-plan') args.title = '另一份方案'
      if (scenario === 'expired') Date.now = () => realNow() + READ_BACK_MS + 1
      if (scenario === 'deleted') { removePerson(f.root, f.a.id); rmSync(f.aDir, { recursive: true }) }
      if (scenario === 'cleared') deleteLocalStore(f.aDir)
      const result = f.save(args, scenario === 'different-session' ? { agent: { session: { id: 'other' } } } : f.actor)
      if (scenario === 'switch-during-read') setActive(f.root, f.b.id)
      if (scenario === 'delete-during-read') { removePerson(f.root, f.a.id); rmSync(f.aDir, { recursive: true }) }
      assert.equal((await result).saved, false)
      assert.equal(currentPlan(f.aDir), null)
      assert.equal(currentPlan(f.bDir), null)
      if (scenario.includes('deleted') || scenario === 'delete-during-read') assert.equal(existsSync(f.aDir), false)
    } finally { Date.now = realNow; f.close() }
  })
}

test('a first plan on a fresh install can be read back and saved; the save creates the store', async () => {
  const base = mkdtempSync(join(tmpdir(), 'longpi-plan-fresh-'))
  const root = join(base, 'longpi-home')            // deliberately not created yet
  const tools = new Map()
  const ctx = { tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } } }
  const config = { dataDir: root, mcpUrl: '', mcpToken: '', member: '', skillsHome: '', timeoutMs: 100, pythonBin: '/nonexistent/python' }
  registerTrackingTools(ctx, () => config, { mounted: false, peer: false, pluginHome: '' })
  const actor = { agent: { session: { id: 'fresh-session' } } }
  try {
    const read = await tools.get('save_intervention_plan').execute({ ...PLAN, confirm: false }, actor)
    assert.equal(read.ok, true, JSON.stringify(read.errors))
    assert.equal(typeof read.save_token, 'string', 'a fresh holder store still gets a read-back token')
    const saved = await tools.get('save_intervention_plan').execute({ ...PLAN, save_token: read.save_token, confirm: true }, actor)
    assert.equal(saved.saved, true)
    assert.equal(currentPlan(root).title, PLAN.title)
  } finally {
    resetReadBacks()
    rmSync(base, { recursive: true, force: true })
  }
})

test('a second read-back of the same plan cannot save a second version after the first save', async () => {
  const f = fixture()
  try {
    const first = await f.save({ ...PLAN, confirm: false })
    const second = await f.save({ ...PLAN, confirm: false })
    assert.equal((await f.save({ ...PLAN, save_token: first.save_token, confirm: true })).saved, true)
    const again = await f.save({ ...PLAN, save_token: second.save_token, confirm: true })
    assert.equal(again.saved, false, 'the read-back window closes for the whole plan after a save')
    assert.equal(mod.currentPlan(f.aDir).version, 1)
  } finally { f.close() }
})

test('approval rechecks the member after inner middleware awaits', async () => {
  const f = fixture()
  try {
    const read = await f.save({ ...PLAN, confirm: false })
    const decision = await f.approve({ ...PLAN, save_token: read.save_token, confirm: true }, f.actor,
      async () => { setActive(f.root, f.b.id); return { kind: 'allow' } })
    assert.equal(decision.kind, 'deny')
  } finally { f.close() }
})
