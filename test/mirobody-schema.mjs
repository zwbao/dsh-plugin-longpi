// Mirobody 1.5.3 publishes one query schema (view) and refuses unknown arguments; older servers
// know only resolution × aggregate. Reads work against both, and a care-circle member is never
// answered with the account holder's record.

import assert from 'node:assert/strict'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'
import { startFakeMirobody } from './fake-mirobody.mjs'

const configOf = (url, member = '') => ({
  mcpUrl: url, mcpToken: '', member, timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
  dataDir: mkdtempSync(join(tmpdir(), 'longpi-schema-')), skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {},
  skillsHome: '', maxSkillMatches: 6, skillsVersion: '', bootstrapWorkspace: false,
})

// translation
assert.deepEqual(mod.queryArgsForView({ indicators: ['a'], aggregate: 'latest' }), { indicators: ['a'], view: 'latest' })
assert.deepEqual(mod.queryArgsForView({ indicators: ['a'], resolution: 'day', aggregate: 'none', start: 's', end: 'e' }), { indicators: ['a'], view: 'day', start: 's', end: 'e' })
assert.deepEqual(mod.queryArgsForView({ indicators: ['a'], resolution: 'raw', aggregate: 'none', limit: 50 }), { indicators: ['a'], view: 'raw' })
assert.deepEqual(mod.queryArgsForView({}), {})
assert.deepEqual(mod.queryArgsForView({ indicators: ['a'], aggregate: 'latest', member: 'm1' }), { indicators: ['a'], view: 'latest', member: 'm1' })

for (const schema of ['view', 'legacy']) {
  mod.resetQuerySchema()
  const server = await startFakeMirobody({ schema })
  try {
    const config = configOf(server.url)
    mod.invalidateRecords()
    const snap = await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin')
    assert.equal(snap.record_status, 'ok', `${schema}: ${snap.record_error}`)
    assert.ok(snap.indicators.length > 5, `${schema}: latest values read`)
    const name = snap.indicators[0].name
    const series = await mod.loadSeries(config, [name], { start: '2000-01-01', end: '2100-01-01', resolution: 'raw' })
    assert.deepEqual(series.failed, [], `${schema}: series read`)
    const sent = server.calls.filter((call) => call.name === 'query_health_indicators').map((call) => call.args)
    if (schema === 'view') assert.ok(sent.every((a) => !('aggregate' in a) && !('resolution' in a) && !('limit' in a)), 'only view words go to a 1.5.3 server')
    else assert.ok(sent.some((a) => a.aggregate === 'latest'), 'an older server is asked in its own words')
  } finally {
    await server.close()
  }
}

// a care-circle member on a server that cannot read one: a refusal, never the holder's record
mod.resetQuerySchema()
{
  const server = await startFakeMirobody({ schema: 'view' })
  try {
    const config = configOf(server.url, 'member-2')
    mod.invalidateRecords()
    const snap = await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin')
    assert.notEqual(snap.record_status, 'ok')
    assert.equal(snap.indicators.length, 0)
  } finally {
    await server.close()
  }
}
mod.resetQuerySchema()
console.log('mirobody-schema ok')
