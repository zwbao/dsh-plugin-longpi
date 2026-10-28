// Exercise the registered hooks, real registry and memory store; only the host/model are simulated.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { setImmediate as nextTick } from 'node:timers/promises'
import { test } from 'node:test'
import * as mod from '../lib/index.js'

const TEXT = '我想减到70公斤'
const deferred = () => Promise.withResolvers()

async function fixture() {
  const root = mkdtempSync(join(tmpdir(), 'longpi-memory-binding-'))
  const listeners = new Map()
  const disposers = []
  const started = deferred()
  const release = deferred()
  const calls = []
  const llm = { async *stream(request) {
    const input = JSON.parse(request.messages[0].content[0].text)
    if (typeof input.message !== 'string') return
    calls.push(input)
    started.resolve()
    await release.promise
    yield { type: 'text-delta', text: JSON.stringify({ ops: [{ kind: 'goal', subject: 'self', text_zh: input.message, quote_zh: input.message }] }) }
  } }
  const ctx = {
    tools: { register: () => () => {} }, skills: { register: () => () => {} },
    systemPrompt: { section: () => {} }, webServer: { register: () => () => {} },
    connection: { requestRejection: () => undefined }, commands: { register: () => {} },
    inject: (_names, cb) => cb(ctx),
    get: name => name === 'llm' ? llm : name === 'agentDefaultModel' ? { currentSelection: () => ({ provider: 'test', model: 'test' }) } : undefined,
    on: (name, listener, options) => {
      const previous = listeners.get(name) ?? []
      listeners.set(name, options?.prepend ? [listener, ...previous] : [...previous, listener])
      return () => {}
    },
    effect: fn => { const dispose = fn(); disposers.push(dispose); return dispose },
  }
  const config = { dataDir: root, mcpUrl: '', mcpToken: '', member: '', timeoutMs: 100,
    pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '', skillsHome: '/nonexistent/skills',
    skillPython: '/nonexistent/python', skillTimeoutMs: 100, skillRuntimes: {}, maxSkillMatches: 6, skillsVersion: '', bootstrapWorkspace: false }
  await mod.apply(ctx, config)
  const a = mod.addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  const b = mod.addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })
  const aDir = mod.personDir(root, a.id)
  const bDir = mod.personDir(root, b.id)
  for (const [dir, marker] of [[aDir, 'A context'], [bDir, 'B context']]) {
    mod.writeJsonAtomic(join(dir, 'memory.json'), { version: 1, rev: 1, updated: new Date().toISOString(), migrated: [], items: [
      { id: `goal-${marker}`, status: 'active', kind: 'goal', text_zh: marker, confirmed: true,
        provenance: { kind: 'chat', at: new Date().toISOString(), by: 'M0', quote_zh: marker } },
    ] })
  }
  const workspace = join(root, 'workspace')
  mod.writeJsonAtomic(join(root, 'workspace-bootstrap.json'), { path: workspace, created: true })
  const agent = { session: { id: root, header: { cwd: workspace } } }
  const seed = (dir, marker) => mod.recordSurfaces(dir,
    { inputs_fp: marker, status: { text_zh: marker }, next: { action: { kind: 'wait' }, card: { text_zh: marker } }, suggestions: [] },
    { fp: marker, memory_digest_zh: marker, top_facts: [], feedback: [] })
  seed(aDir, 'A context')
  seed(bDir, 'B context')
  mod.setActive(root, a.id)
  async function step({ currentAgent = agent, turn = 1, step = 1, text = TEXT, beforeNext = () => {}, kind = 'enter', signal = new AbortController().signal } = {}) {
    const messages = [{ role: 'user', content: [{ type: 'text', text }], source: { kind: 'user' } }]
    const payload = { agent: currentAgent, messages, turn, step, signal }
    const hooks = listeners.get('agent/pre-step') ?? []
    const run = i => i === hooks.length ? (beforeNext(), Promise.resolve({ kind, messages })) : hooks[i](payload, () => run(i + 1))
    return run(0)
  }
  function stop(currentAgent = agent, turn = 1) {
    for (const listener of listeners.get('agent/turn-stopping') ?? []) listener({ agent: currentAgent, turn })
  }
  async function finish() { release.resolve(); await nextTick() }
  function close() {
    release.resolve()
    for (const dispose of disposers.reverse()) if (typeof dispose === 'function') dispose()
    rmSync(root, { recursive: true, force: true })
  }
  return { root, a, b, aDir, bDir, agent, calls, started, step, stop, finish, close, seed }
}

for (const timing of ['none', 'before-stop', 'during-model', 'during-pre-step']) {
  test(`memory remains with A: switch ${timing}`, async () => {
    const f = await fixture()
    try {
      await f.step({ beforeNext: () => { if (timing === 'during-pre-step') mod.setActive(f.root, f.b.id) } })
      if (timing === 'before-stop') mod.setActive(f.root, f.b.id)
      f.stop()
      await Promise.race([f.started.promise, nextTick().then(() => assert.fail('distiller did not start'))])
      if (timing === 'during-model') mod.setActive(f.root, f.b.id)
      await f.finish()
      assert.equal(mod.memoryFor(f.aDir).active('goal').filter(row => row.text_zh === TEXT).length, 1, 'A receives the memory')
      assert.equal(mod.memoryFor(f.bDir).active('goal').filter(row => row.text_zh === TEXT).length, 0, 'B receives no memory')
      assert.match(f.calls[0].memory_digest, /A context/, 'the model must receive A context')
      const bEvents = existsSync(join(f.bDir, 'events.jsonl')) ? readFileSync(join(f.bDir, 'events.jsonl'), 'utf8').trim().split('\n').map(JSON.parse) : []
      assert.equal(bEvents.filter(event => event.type === 'memory.changed' || event.type === 'chat.turn_ended').length, 0, 'A events do not enter B event history')
    } finally { f.close() }
  })
}

test('deleting A while the model runs does not recreate its directory or write to self', async () => {
  const f = await fixture()
  try {
    await f.step()
    f.stop()
    await f.started.promise
    mod.removePerson(f.root, f.a.id)
    rmSync(f.aDir, { recursive: true, force: true })
    await f.finish()
    assert.equal(existsSync(f.aDir), false)
    assert.equal(mod.memoryFor(f.root).active('goal').length, 0)
  } finally { f.close() }
})

test('non-health conversations do not trigger extraction', async () => {
  const f = await fixture()
  try {
    const agent = { session: { id: `${f.root}-code`, header: { cwd: '/non-health-workspace' } } }
    await f.step({ currentAgent: agent })
    f.stop(agent)
    await f.finish()
    assert.equal(f.calls.length, 0)
  } finally { f.close() }
})

for (const scenario of ['deleted-before-stop', 'broken-registry', 'unknown-member', 'missing-session', 'subagent', 'aborted', 'not-entered', 'no-prefilter', 'missing-start']) {
  test(`no extraction when ${scenario}`, async () => {
    const f = await fixture()
    try {
      const agent = scenario === 'missing-session' ? { session: { header: f.agent.session.header } }
        : scenario === 'subagent' ? { session: { ...f.agent.session, header: { ...f.agent.session.header, origin: 'subagent', delegationDepth: 1 } } } : f.agent
      if (scenario === 'broken-registry') writeFileSync(join(f.root, 'people.json'), '{broken')
      if (scenario === 'unknown-member') mod.writeJsonAtomic(join(f.root, 'people.json'), { active: 'p1234567', people: [] })
      if (scenario !== 'missing-start') await f.step({ currentAgent: agent,
        kind: scenario === 'not-entered' ? 'stop' : 'enter',
        text: scenario === 'no-prefilter' ? '你好' : TEXT,
        signal: scenario === 'aborted' ? AbortSignal.abort() : new AbortController().signal })
      if (scenario === 'deleted-before-stop') mod.removePerson(f.root, f.a.id)
      f.stop(agent)
      await f.finish()
      assert.equal(f.calls.length, 0)
      assert.equal(mod.memoryFor(f.root).active('goal').length, 0)
    } finally { f.close() }
  })
}

test('later steps and duplicate stop events cannot rebind or re-extract a turn', async () => {
  const f = await fixture()
  try {
    await f.step()
    mod.setActive(f.root, f.b.id)
    await f.step({ step: 2, text: '我不喝酒' })
    f.stop(f.agent, 0) // a stale stop cannot consume the newer turn
    f.stop()
    f.stop()
    await f.finish()
    assert.equal(f.calls.length, 1)
    assert.equal(f.calls[0].message, TEXT)
    assert.ok(mod.memoryFor(f.aDir).active('goal').some(row => row.text_zh === TEXT))
    assert.equal(mod.memoryFor(f.bDir).active('goal').length, 1)
    await f.step({ turn: 2, text: '我想减到65公斤' })
    f.stop(f.agent, 2)
    await f.finish()
    assert.ok(mod.memoryFor(f.bDir).active('goal').some(row => row.text_zh === '我想减到65公斤'))
  } finally { f.close() }
})

test('clearing the store while extraction runs discards its result', async () => {
  const f = await fixture()
  try {
    await f.step()
    f.stop()
    await f.started.promise
    mod.deleteLocalStore(f.aDir)
    await f.finish()
    assert.equal(existsSync(join(f.aDir, 'memory.json')), false)
  } finally { f.close() }
})

test('self remains a valid target when no family member is selected', async () => {
  const f = await fixture()
  try {
    mod.setActive(f.root, 'self')
    f.seed(f.root, 'self context')
    await f.step()
    mod.setActive(f.root, f.b.id)
    f.stop()
    await f.finish()
    assert.ok(mod.memoryFor(f.root).active('goal').some(row => row.text_zh === TEXT))
    assert.match(f.calls[0].memory_digest, /self context/)
  } finally { f.close() }
})
