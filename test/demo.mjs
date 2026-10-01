// 示例档案: opens a complete, dated-to-today store with check-ins and a live local record; never removable.
import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'

const today = new Date().toISOString().slice(0, 10)
const addDays = (iso, d) => { const at = new Date(`${iso}T00:00:00Z`); at.setUTCDate(at.getUTCDate() + d); return at.toISOString().slice(0, 10) }

// the record: watch days end yesterday, the 2026 checkup sits before the plan
const record = mod.demoRecord(today)
const watch = record.observations.filter((row) => row.indicator === 'dailySteps').map((row) => row.date).sort()
assert.equal(watch.at(-1), addDays(today, -1), 'watch days end yesterday')
const labs = record.observations.filter((row) => !/^[a-z]/.test(row.indicator)).map((row) => row.date).sort()
assert.ok(labs.at(-1) < addDays(today, -21), 'the latest checkup is before the plan started')
assert.ok(new Set(labs).size >= 2, 'two checkups')

const root = mkdtempSync(join(tmpdir(), 'demo-'))
mod.ensureDemoPerson(root)
assert.ok(mod.readRegistry(root).people.some((p) => p.id === mod.DEMO_ID && p.demo), 'the demo is in the registry')
await mod.openDemo(root, today)
const dir = join(root, 'people', mod.DEMO_ID)
for (const rel of ['profile.json', 'interventions/plan.jsonl', 'analysis/current/report.html', 'connection.json']) assert.ok(existsSync(join(dir, rel)), rel)
const profile = JSON.parse(readFileSync(join(dir, 'profile.json'), 'utf8'))
assert.equal(profile.displayName, '李明华')
assert.ok(profile.consent?.accepted_at, 'onboarding done')
assert.equal(profile.consent.version, '2026-09-24', 'a version is not a date to shift')
for (const act of Object.values(profile.consents ?? {})) if (act) assert.equal(act.version, '2026-09-28', 'privacy act versions stay')
const plan = readFileSync(join(dir, 'interventions/plan.jsonl'), 'utf8')
assert.ok(plan.includes(addDays(today, -21)), 'the plan started three weeks ago')
assert.ok(!/\/Users\/|\/private\/tmp/.test(readFileSync(join(dir, 'analysis/current/la-export.json'), 'utf8')), 'no machine paths')
const checkins = readFileSync(join(dir, 'interventions/adherence.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
assert.ok(checkins.length > 50, `check-ins written (${checkins.length})`)
assert.ok(checkins.every((row) => row.date < today), 'no check-in in the future')

// the local record answers like Mirobody
const url = JSON.parse(readFileSync(join(dir, 'connection.json'), 'utf8')).mcp_url
assert.match(url, /^http:\/\/127\.0\.0\.1:\d+\/mcp$/)
const call = async (method, params, id) => (await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id, method, params }) })).json()
await call('initialize', {}, 1)
const catalog = await call('tools/call', { name: 'query_health_indicators', arguments: {} }, 2)
assert.match(catalog.result.content[0].text, /白细胞计数 WBC|dailySteps/)

// reopening resets: a file written into the demo is gone
const { writeFileSync } = await import('node:fs')
writeFileSync(join(dir, 'scribble.txt'), 'x')
await mod.openDemo(root, today)
assert.equal(existsSync(join(dir, 'scribble.txt')), false, 'every open is a clean copy')
console.log(`demo ok (${record.observations.length} observations, ${checkins.length} check-ins, record at ${url.replace(/\d+\/mcp/, 'PORT/mcp')})`)
process.exit(0)
