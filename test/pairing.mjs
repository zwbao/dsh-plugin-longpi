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
// service down: an error, nothing written
{
  const root = mkdtempSync(join(tmpdir(), 'pair-'))
  const r = await mod.ensureLocalPairing(root, { base: 'http://127.0.0.1:18060', force: true, fetchImpl: fakeMirobody({ down: true }).fetchImpl })
  assert.equal(r.status, 'error'); assert.equal(readConnection(root), null); assert.equal(mod.hasAccount(root), false)
}
console.log('pairing ok')
