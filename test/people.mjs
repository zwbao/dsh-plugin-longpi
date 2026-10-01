// M13 people: the active person's store, a family member never read through the holder's address or token, their
// Mirobody link minted and renewed with the holder's token, an upload into their record named explicitly, and
// deleting the holder's store leaving family members' stores alone.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'

const root = mkdtempSync(join(tmpdir(), 'longpi-people-'))
const config = { dataDir: root, mcpUrl: 'http://127.0.0.1:18060/mcp/HOLDER-CONFIGURED', mcpToken: 'HOLDER-JWT-CONFIGURED' }

// the holder is the LongPi home itself
assert.equal(mod.resolveDataDir(root), root)
assert.equal(mod.readRegistry(root).active, mod.SELF)
mod.saveConnection(root, { mcp_url: 'http://127.0.0.1:18060/mcp/HOLDER', mcp_token: 'HOLDER-JWT' })

// a family member with no link: not connected, never the holder's configured address or token
const mother = mod.addPerson(root, { label_zh: '妈妈', name: '王秀英', sex: 'female', birth_year: 1960 })
assert.ok(mod.setActive(root, mother.id))
assert.equal(mod.resolveDataDir(root), join(root, 'people', mother.id))
let eff = mod.effectiveConfig({ ...config })
assert.equal(eff.mcpUrl, ''); assert.equal(eff.mcpToken, '')

// her link is minted with the holder's token and saved with no token
const calls = []
// Routes as Mirobody 1.5 serves them (H-01): managed members under /api, personal links at the root; anything else 404s.
const fakeFetch = async (url, init) => {
  calls.push({ url, auth: init.headers.authorization, body: JSON.parse(init.body) })
  const path = new URL(url).pathname
  if (path === '/api/user/virtual') return new Response(JSON.stringify({ code: 0, data: { id: '42' } }))
  if (path === '/personal/mcp') return new Response(JSON.stringify({ code: 0, data: { url: `http://127.0.0.1:18060/mcp/MEMBER-${calls.length}` } }))
  return new Response('{"detail":"Not Found"}', { status: 404 })
}
const auth = mod.holderAuth(root)
assert.equal(auth.token, 'HOLDER-JWT')
const memberId = await mod.createManagedMember(auth, { name: '王秀英', sex: 'female', birth_year: 1960 }, fakeFetch)
assert.equal(memberId, '42')
assert.deepEqual(calls[0].body, { name: '王秀英', gender: 'female', birth: '1960-01-01' })
mod.saveMemberLink(root, { ...mother, mirobody_user_id: '42' }, await mod.mintMemberLink(auth, '42', fakeFetch))
assert.deepEqual(calls[1].body, { user_id: '42' })
eff = mod.effectiveConfig({ ...config })
assert.match(eff.mcpUrl, /MEMBER-2$/); assert.equal(eff.mcpToken, '', 'the holder\'s token is never sent with the member\'s link')

// renewal: fresh link untouched, an old one re-minted
const saved = mod.readRegistry(root).people.find((p) => p.id === mother.id)
const person = { ...saved, mirobody_user_id: '42' }
assert.equal(await mod.ensureMemberLink(root, person, fakeFetch), '')
assert.equal(calls.length, 2, 'a fresh link is not re-minted')
const later = new Date(Date.now() + mod.RENEW_AFTER_MS + 60_000)
assert.equal(await mod.ensureMemberLink(root, person, fakeFetch, later), '')
assert.equal(calls.length, 3)
assert.match(mod.effectiveConfig({ ...config }).mcpUrl, /MEMBER-3$/)
const failing = async () => new Response(JSON.stringify({ code: -5, msg: 'denied' }), { status: 403 })
assert.match(await mod.ensureMemberLink(root, { ...person, link_minted_at: '2000-01-01T00:00:00Z' }, failing), /续期失败/)

// an upload for her goes into her record, named explicitly
const sent = []
const opener = (_url, handlers) => {
  const sock = { send: (text) => sent.push(JSON.parse(text)), close: () => {} }
  setTimeout(() => { handlers.onopen(); handlers.onmessage(JSON.stringify({ type: 'extraction_completed', indicators_count: 3 })) }, 5)
  return sock
}
await mod.pushToMirobody({ origin: 'http://127.0.0.1:18060', token: 'HOLDER-JWT', filename: 'a.pdf', bytes: Buffer.from('x'), contentType: 'application/pdf', open: opener, queryUserId: '42' })
assert.equal(sent.find((m) => m.type === 'upload_start').query_user_id, '42')

// the service received the file but could not read it (no model configured): flagged, never a quiet 0
const unread = (_url, handlers) => {
  setTimeout(() => { handlers.onopen(); handlers.onmessage(JSON.stringify({ type: 'extraction_completed', indicators_count: 0, failed: true })) }, 5)
  return { send: () => {}, close: () => {} }
}
const pushUnread = await mod.pushToMirobody({ origin: 'http://127.0.0.1:18060', token: 'T', filename: 'b.pdf', bytes: Buffer.from('y'), contentType: 'application/pdf', open: unread })
assert.equal(pushUnread.extraction_failed, true, 'a failed extraction is reported as such')
assert.equal(pushUnread.failed, false, 'the file itself was received')
const read3 = await mod.pushToMirobody({ origin: 'http://127.0.0.1:18060', token: 'T', filename: 'c.pdf', bytes: Buffer.from('z'), contentType: 'application/pdf', open: opener })
assert.equal(read3.extraction_failed, false)
assert.equal(read3.indicators, 3)

// switching back: the holder's own store and link
assert.ok(mod.setActive(root, mod.SELF))
assert.equal(mod.resolveDataDir(root), root)
assert.match(mod.effectiveConfig({ ...config }).mcpUrl, /HOLDER$/)
assert.equal(mod.setActive(root, 'pnotthere00'), false)

// deleting the holder's local store leaves family members and the registry alone
writeFileSync(join(root, 'profile.json'), '{}')
mod.deleteLocalStore(root)
assert.ok(!existsSync(join(root, 'profile.json')))
assert.ok(existsSync(join(root, 'people', mother.id)))
assert.equal(mod.readRegistry(root).people.length, 1)

// removing her takes her out of the registry and back to the holder
mod.setActive(root, mother.id)
assert.equal(mod.removePerson(root, mother.id).id, mother.id)
assert.equal(mod.readRegistry(root).active, mod.SELF)
// review fixes -------------------------------------------------------------------
// a member's store never holds a token, whatever is saved into it
const dad = mod.addPerson(root, { label_zh: '爸爸', name: '李建国', sex: 'male', birth_year: 1958 })
mod.saveConnection(join(root, 'people', dad.id), { mcp_url: 'http://127.0.0.1:18060/mcp/HOLDER', mcp_token: 'HOLDER-JWT' })
assert.ok(!mod.readConnection(join(root, 'people', dad.id)).mcp_token, 'the holder\'s token is never saved in a member\'s store')
mod.setActive(root, dad.id)
assert.equal(mod.effectiveConfig({ ...config }).mcpToken, '')

// a write from a page showing someone else is refused
mod.setActivePersonResolver(() => dad.id)
const answer = { code: 0, body: '' }
const res = { statusCode: 0, setHeader() {}, writeHead(code) { answer.code = code }, end(text) { answer.body = String(text ?? ''); if (!answer.code) answer.code = res.statusCode } }
let reached = false
const guarded = mod.guardRoute(() => ({ requestRejection: () => undefined }), () => { reached = true })
guarded({ method: 'POST', url: '/api/longpi/checkin', headers: { 'content-type': 'application/json', 'x-longpi-person': 'self' } }, res)
assert.equal(reached, false); assert.equal(answer.code || res.statusCode, 409)
guarded({ method: 'POST', url: '/api/longpi/checkin', headers: { 'content-type': 'application/json', 'x-longpi-person': dad.id } }, res)
assert.equal(reached, true)
mod.setActivePersonResolver(() => 'self')

// family names become their labels in anything sent to the model; the holder's becomes 你
mod.setFamilyNames(() => [['李建国', '爸爸']])
assert.equal(mod.redactText('李建国的血压和张三的血压', '张三'), '爸爸的血压和你的血压')
mod.setFamilyNames(() => [])

// a damaged registry is never overwritten; a bad id never names a folder
writeFileSync(join(root, 'people.json'), '{broken')
assert.throws(() => mod.addPerson(root, { label_zh: '姐姐', name: '李丽', sex: 'female', birth_year: 1985 }), /people.json/)
assert.throws(() => mod.personDir(root, '../../etc'), /bad person id/)
writeFileSync(join(root, 'people.json'), JSON.stringify({ active: 'self', people: [dad] }))

console.log('people ok')
