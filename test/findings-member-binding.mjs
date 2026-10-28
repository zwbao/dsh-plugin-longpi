// D16: reading a member's findings must not apply another member's record to the store the page showed first.
// The handler pins the member whose page asked; a switch (or a deletion) during the record read must not let the
// new member's indicators be written into the old store, and must not recreate a store that was removed.
// Synthetic data only: route level with a fake member switch, no real DSH or Mirobody.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { registerDatainRoutes } from '../src/datain/routes.ts'
import { listFindings, storeFindings } from '../src/datain/narrative.ts'
import { SELF, addPerson, personDir, removePerson, setActive } from '../src/people/store.ts'

const made = []
function tempRoot(tag) {
  const root = mkdtempSync(join(tmpdir(), `longpi-findings-binding-${tag}-`))
  made.push(root)
  return root
}

const A_INDICATORS = [{ name: '乳腺超声', label: 'BI-RADS 2类', value: '双乳增生', date: '2026-08-20' }]
const B_INDICATORS = [{ name: '甲状腺超声', label: 'TI-RADS 3类', value: '结节 4×3 mm', date: '2026-08-20' }]
const lines = (dir) => listFindings(dir).map((row) => row.text_zh).join(' ')

function fixture(tag, active = 'a') {
  const root = tempRoot(tag)
  const a = addPerson(root, { label_zh: 'A', name: '', sex: 'male', birth_year: null })
  const b = addPerson(root, { label_zh: 'B', name: '', sex: 'female', birth_year: null })
  setActive(root, active === 'a' ? a.id : b.id)
  return { root, a, b, aDir: personDir(root, a.id), bDir: personDir(root, b.id) }
}

/** Register the datain routes on a fake host whose page can switch while a read is in progress. */
function hostWith(root, pageDir, handlers = {}) {
  const state = { page: pageDir }
  const routes = new Map()
  const deps = {
    dataDir: () => state.page,
    config: () => ({ dataDir: root, mcpUrl: '', mcpToken: '', member: '' }),
    context: async () => handlers.context ? handlers.context(state) : { records: { indicators: [] } },
    contextFor: async (dir) => handlers.contextFor ? handlers.contextFor(state, dir) : { records: { indicators: [] } },
    bus: { emit: () => {} },
    invalidate: () => {},
    http: { route: (method, path, handler) => routes.set(`${method} ${path}`, handler) },
  }
  registerDatainRoutes(deps)
  return {
    state,
    async findings() {
      const handler = routes.get('GET /api/longpi/findings')
      assert.ok(handler, 'findings route')
      return handler({ method: 'GET', url: '/api/longpi/findings', query: new URLSearchParams(), headers: {} })
    },
  }
}

// ---- the page switches A→B while A's record is read: B's indicators never enter A's store
{
  const { root, a, b, aDir } = fixture('switch')
  const bDir = personDir(root, b.id)
  setActive(root, a.id)
  // B already has its own finding: it must stay byte for byte unchanged
  storeFindings(bDir, [{ id: 'b-find-1', kind: 'ti-rads', text_zh: 'B 自己的旧结论', date: '2026-01-01', grade: '2' }])
  const bFindingsFile = join(bDir, 'datain', 'findings.jsonl')
  const bBefore = readFileSync(bFindingsFile)
  let contextCalls = 0
  const contextForCalls = []
  const host = hostWith(root, aDir, {
    // the page switches during the read, and the page context answers with the NEW member's indicators
    context: (state) => { contextCalls += 1; state.page = bDir; setActive(root, b.id); return { dataDir: bDir, records: { indicators: B_INDICATORS } } },
    contextFor: (_state, dir) => { contextForCalls.push(dir); return { dataDir: dir, records: { indicators: dir === aDir ? A_INDICATORS : B_INDICATORS } } },
  })
  const result = await host.findings()
  assert.equal(contextCalls, 1)
  assert.deepEqual(contextForCalls, [aDir], 'after the page switch the captured member\'s own context is read, not the shown page context')
  assert.match(lines(aDir), /BI-RADS 2/, 'A keeps the findings from A\'s own record')
  assert.doesNotMatch(lines(aDir), /TI-RADS/, "B's indicators are not written into A's store")
  assert.deepEqual(readFileSync(bFindingsFile), bBefore, "the member shown now keeps its own findings byte for byte")
  assert.equal(listFindings(bDir).length, 1)
  assert.equal(result.stale, false)
  assert.deepEqual(result.member, { id: a.id, label_zh: 'A', is_current: false }, 'the response says whose findings these are')
}

// ---- no switch: the shown member's own findings are written, and the holder's read path still runs
{
  const { root, a, aDir } = fixture('same')
  setActive(root, a.id)
  let contextForCalls = 0
  const host = hostWith(root, aDir, {
    context: () => ({ records: { indicators: A_INDICATORS } }),
    contextFor: () => { contextForCalls += 1; return { records: { indicators: [] } } },
  })
  const result = await host.findings()
  assert.match(lines(aDir), /BI-RADS 2/)
  assert.equal(contextForCalls, 0, 'the member being looked at keeps the normal context read')
  assert.equal(result.stale, false)
  assert.deepEqual(result.member, { id: a.id, label_zh: 'A', is_current: true })
}

// ---- the member is removed while the record is read: nothing is written, nothing is recreated, the answer is stale
{
  const { root, a, aDir } = fixture('removed')
  setActive(root, a.id)
  const host = hostWith(root, aDir, {
    context: () => {
      removePerson(root, a.id)
      rmSync(aDir, { recursive: true, force: true })
      return { records: { indicators: A_INDICATORS } }
    },
  })
  const result = await host.findings()
  assert.equal(result.stale, true)
  assert.equal(existsSync(aDir), false, "a removed member's store is not recreated by the read")
  assert.deepEqual(result.findings, [])
  assert.equal(result.member, null)
}

// ---- the member still exists but the store is removed while the record is read: no write, no recreation
{
  const { root, a, aDir } = fixture('store-removed')
  setActive(root, a.id)
  const host = hostWith(root, aDir, {
    context: () => { rmSync(aDir, { recursive: true, force: true }); return { dataDir: aDir, records: { indicators: A_INDICATORS } } },
  })
  const result = await host.findings()
  assert.equal(result.stale, true)
  assert.equal(existsSync(aDir), false, 'a store removed during the read is not recreated')
  assert.equal(result.member?.id, a.id, 'the member is still registered, so the response can still name it')
  assert.deepEqual(result.findings, [])
}

// ---- the store is replaced at the same path while the record is read: no write into the new store
{
  const { root, a, aDir } = fixture('store-replaced')
  setActive(root, a.id)
  const host = hostWith(root, aDir, {
    context: () => {
      rmSync(aDir, { recursive: true, force: true })
      mkdirSync(aDir, { recursive: true })
      return { dataDir: aDir, records: { indicators: A_INDICATORS } }
    },
  })
  const result = await host.findings()
  assert.equal(result.stale, true)
  assert.deepEqual(listFindings(aDir), [], 'a replaced store does not receive the old request\'s findings')
  assert.equal(result.member?.id, a.id)
}

// ---- a delete tombstone appears while the record is read: no write into the deleted store
{
  const { root, a, aDir } = fixture('tombstone')
  setActive(root, a.id)
  const host = hostWith(root, aDir, {
    context: () => {
      mkdirSync(join(aDir, 'privacy'), { recursive: true })
      writeFileSync(join(aDir, 'privacy', 'deleted.json'), '{"version":1}')
      return { dataDir: aDir, records: { indicators: A_INDICATORS } }
    },
  })
  const result = await host.findings()
  assert.equal(result.stale, true)
  assert.deepEqual(listFindings(aDir), [], 'a store deleted during the read does not receive findings')
  assert.equal(result.member?.id, a.id)
}

// ---- the holder's own store still works when it is the member being looked at
{
  const root = tempRoot('self')
  setActive(root, SELF)
  const host = hostWith(root, root, { context: () => ({ records: { indicators: A_INDICATORS } }) })
  const result = await host.findings()
  assert.match(lines(root), /BI-RADS 2/)
  assert.deepEqual(result.member, { id: SELF, label_zh: '我', is_current: true })
}

for (const dir of made) rmSync(dir, { recursive: true, force: true })
console.log('findings member binding ok')
