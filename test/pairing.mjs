import assert from 'node:assert/strict'
import { mkdtempSync, statSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../src/mirobody-account.ts'
import { readConnection, saveConnection } from '../src/connection.ts'

const jwt = (expSec) => `h.${Buffer.from(JSON.stringify({ exp: expSec })).toString('base64url')}.s`
function fakeMirobody(opts = {}) {
  const calls = []
  const users = new Map()
  const fetchImpl = async (url, init) => {
    const path = new URL(url).pathname
    const body = JSON.parse(init.body || '{}')
    calls.push(path)
    const ok = (data) => new Response(JSON.stringify({ code: 0, data }), { status: 200 })
    if (opts.down) throw new Error('ECONNREFUSED')
    if (path === '/password/register') { if (users.has(body.email)) return new Response(JSON.stringify({ code: -4 })); users.set(body.email, body.password); return ok({ access_token: jwt(opts.exp ?? Date.now() / 1000 + 30 * 86400) }) }
    if (path === '/password/login') return users.get(body.email) === body.password ? ok({ access_token: jwt(Date.now() / 1000 + 30 * 86400) }) : new Response(JSON.stringify({ code: -1 }))
    if (path === '/personal/mcp') return ok({ url: `http://127.0.0.1:18060/mcp/${Math.random().toString(36).slice(2)}` })
    return new Response('{}', { status: 404 })
  }
  return { fetchImpl, calls, users }
}

// first use: registers, saves 0600 credentials, saves a connection with token
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const m = fakeMirobody()
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: m.fetchImpl })
  assert.equal(r.status, 'paired')
  assert.deepEqual(m.calls, ['/password/register', '/personal/mcp'])
  const c = readConnection(root); assert.ok(c.mcp_url.startsWith('http://127.0.0.1:18060/mcp/')); assert.ok(c.mcp_token)
  assert.equal(statSync(join(root, mod.ACCOUNT_FILE)).mode & 0o777, 0o600)
  // again: nothing to do (and throttled without force)
  const again = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: m.fetchImpl })
  assert.equal(again.status, 'ok'); assert.equal(m.calls.length, 2)
  // token near expiry: signs in again with the stored credentials, never registers twice
  saveConnection(root, { mcp_url: c.mcp_url, mcp_token: jwt(Date.now() / 1000 + 86400) })
  const renewed = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: m.fetchImpl })
  assert.equal(renewed.status, 'renewed'); assert.deepEqual(m.calls.slice(2), ['/password/login', '/personal/mcp']); assert.equal(m.users.size, 1)
}
// a remote address is never given an account
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const m = fakeMirobody()
  const r = await mod.ensureLocalPairing(root, { base: 'https://mirobody.example.com', force: true, fetchImpl: m.fetchImpl })
  assert.deepEqual(r, { status: 'skipped', why: 'not_local' }); assert.equal(m.calls.length, 0)
}
// a link set up by hand (no account behind it) is left alone
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  saveConnection(root, { mcp_url: 'http://127.0.0.1:18060/mcp/HANDMADE', mcp_token: '' })
  const m = fakeMirobody()
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: m.fetchImpl })
  assert.equal(r.status, 'skipped'); assert.equal(m.calls.length, 0)
  const r2 = await mod.ensureLocalPairing(mkdtempSync(join(tmpdir(), 'pair-')), { base: 'http://127.0.0.1:18060', configuredUrl: 'http://127.0.0.1:18060/mcp/INSTALLER', force: true, fetchImpl: m.fetchImpl })
  assert.equal(r2.status, 'skipped')
}
// 重新连接 (reclaim, 0.8.0): the person asks; LongPi pairs its own account and its link replaces one set by hand
// (an installer's demo account, an expired link). Nothing to fill in.
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  saveConnection(root, { mcp_url: 'http://127.0.0.1:18060/mcp/DEMOACCOUNT', mcp_token: '' })
  const m = fakeMirobody()
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', configuredUrl: 'http://127.0.0.1:18060/mcp/DEMOACCOUNT', force: true, reclaim: true, fetchImpl: m.fetchImpl })
  assert.equal(r.status, 'paired')
  const c = readConnection(root)
  assert.ok(c.mcp_token, 'the new link has a token (uploads and family members work)')
  assert.ok(!c.mcp_url.endsWith('DEMOACCOUNT'), 'the hand-set link is replaced')
  // a working own link is minted again on request (an expired or replaced link is repaired)
  const before = readConnection(root).mcp_url
  const again = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, reclaim: true, fetchImpl: m.fetchImpl })
  assert.equal(again.status, 'paired'); assert.notEqual(readConnection(root).mcp_url, before); assert.equal(m.users.size, 1, 'never a second account')
  assert.equal(mod.pairingProblem(root), '')
}
// reclaim never replaces a remote link (an installer's real account elsewhere): nothing changes
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  saveConnection(root, { mcp_url: 'https://mirobody.example.com/mcp/REMOTE', mcp_token: jwt(Date.now() / 1000 - 10) })
  const m = fakeMirobody()
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, reclaim: true, fetchImpl: m.fetchImpl })
  assert.deepEqual(r, { status: 'skipped', why: 'remote_connection' }); assert.equal(m.calls.length, 0)
  assert.equal(readConnection(root).mcp_url, 'https://mirobody.example.com/mcp/REMOTE')
}
// the service no longer knows LongPi's account (its database was reset): reclaim pairs a new one
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const first = fakeMirobody()
  await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: first.fetchImpl })
  const reset = fakeMirobody()                       // a fresh service: login is refused
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, reclaim: true, fetchImpl: reset.fetchImpl })
  assert.equal(r.status, 'paired'); assert.deepEqual(reset.calls, ['/password/login', '/password/register', '/personal/mcp'])
}
// two clicks at once: one pairing, one account
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const m = fakeMirobody()
  const both = await Promise.all([1, 2].map(() => mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, reclaim: true, fetchImpl: m.fetchImpl })))
  assert.deepEqual(both.map((row) => row.status), ['paired', 'paired']); assert.equal(m.users.size, 1)
}
// why pairing failed is kept for the page (also through throttled calls), and cleared once it works
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const down = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: fakeMirobody({ down: true }).fetchImpl })
  assert.equal(down.status, 'error')
  assert.match(mod.pairingProblem(root), /健康数据服务/)
  await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', fetchImpl: fakeMirobody().fetchImpl })
  assert.match(mod.pairingProblem(root), /健康数据服务/, 'a throttled call does not clear the reason')
  await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: fakeMirobody().fetchImpl })
  assert.equal(mod.pairingProblem(root), '')
}
// service down: an error, nothing written
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: fakeMirobody({ down: true }).fetchImpl })
  assert.equal(r.status, 'error'); assert.equal(readConnection(root), null); assert.equal(mod.hasAccount(root), false)
}
console.log('pairing ok')
