// The Mirobody connection set on the settings page: the address check
// (https, or http to this machine), the masked address, the token hash for
// cache keys, dataDir/connection.json (0600) overriding the configured
// mcpUrl and mcpToken for every module (records, the routes and the mounted
// Mirobody tools), and the routes: a connection is saved only after one
// catalogue read through it succeeds, a test saves nothing, and clearing it
// brings the configured values back. Neither the token nor the secret part of
// the address is ever sent back. Two fake Mirobody servers stand in for the
// configured record and a second account that needs a token.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as mod from '../lib/index.js'
import { startFakeMirobody } from './fake-mirobody.mjs'

const restore = mod.setFollowupDeps({
  platform: 'darwin',
  run: async () => ({ ok: true }),
  fetch: async () => { throw new Error('no network in this test') },
})

const temp = []
const servers = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-connection-${name}-`))
  temp.push(dir)
  return dir
}

const GOOD = { host: '127.0.0.1:3080', cookie: 'dsh-auth-test=good' }
const JSON_HEADERS = { ...GOOD, 'content-type': 'application/json' }
const TOKEN_B = 'tok-b-4f6c2a9e1d'
const SECRET_PATH = 'personal-secret-7d1e'

function configFor(dataDir, mcpUrl = '', mcpToken = '') {
  return {
    mcpUrl, mcpToken, member: '', timeoutMs: 5000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 20000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6, skillsVersion: '',
    bootstrapWorkspace: false,
  }
}

function fakeHost() {
  const routes = new Map()
  const tools = new Map()
  const disposers = []
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    commands: { register: () => {} },
    connection: { requestRejection: (req) => (req.headers.cookie === GOOD.cookie ? undefined : 401) },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => {
      const dispose = execute()
      disposers.push(dispose)
      return dispose
    },
  }
  return { ctx, routes, tools, dispose: () => disposers.splice(0).forEach((fn) => fn()) }
}

function call(host, method, url, body, headers = JSON_HEADERS) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = headers
  return new Promise((resolveCall) => {
    const res = {
      statusCode: 200,
      writableEnded: false,
      setHeader: () => {},
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, text: raw, json: () => JSON.parse(raw) })
      },
    }
    handler(req, res)
  })
}

try {
  // --- 1. the address, the mask, the token hash -----------------------------------------------
  assert.equal(mod.connectionUrlProblem('https://mirobody.example/mcp/abc'), '')
  assert.equal(mod.connectionUrlProblem('http://127.0.0.1:18060/mcp'), '')
  assert.equal(mod.connectionUrlProblem('http://localhost:18060/mcp'), '')
  for (const url of ['', '   ', 42, null, 'not a url', 'http://192.168.1.20/mcp', 'http://mirobody.example/mcp', 'ftp://mirobody.example/mcp', 'https://user:pw@mirobody.example/mcp', `https://x.example/${'a'.repeat(2100)}`]) {
    const problem = mod.connectionUrlProblem(url)
    assert.ok(problem, `refused: ${String(url).slice(0, 40)}`)
    assert.match(problem, /[一-鿿]/, 'in Chinese')
  }
  assert.equal(mod.connectionTokenProblem(undefined), '')
  assert.equal(mod.connectionTokenProblem('eyJ.abc.def'), '')
  assert.ok(mod.connectionTokenProblem('two words'))
  assert.ok(mod.connectionTokenProblem(12))

  assert.equal(mod.maskMcpUrl(`https://mirobody.example/mcp/${SECRET_PATH}`), 'https://mirobody.example/mcp/…', 'the installer\'s rule: the path after /mcp/ is hidden')
  assert.equal(mod.maskMcpUrl(`https://mirobody.example/mcp/${SECRET_PATH}/more?x=1`), 'https://mirobody.example/mcp/…?…')
  assert.equal(mod.maskMcpUrl('http://127.0.0.1:18060/mcp'), 'http://127.0.0.1:18060/mcp')
  assert.equal(mod.maskMcpUrl('https://mirobody.example/mcp?token=abc'), 'https://mirobody.example/mcp?…')
  assert.equal(mod.maskMcpUrl('garbage'), '…')
  assert.equal(mod.maskMcpUrl(''), '')

  assert.equal(mod.connectionKey({ mcpToken: '' }), '')
  assert.match(mod.connectionKey({ mcpToken: 'abc' }), /^[0-9a-f]{16}$/)
  assert.equal(mod.connectionKey({ mcpToken: ' abc ' }), mod.connectionKey({ mcpToken: 'abc' }))
  assert.notEqual(mod.connectionKey({ mcpToken: 'abc' }), mod.connectionKey({ mcpToken: 'abd' }))

  // --- 2. connection.json and the effective configuration ----------------------------------------
  {
    const dataDir = tempDir('file')
    const config = configFor(dataDir, 'https://configured.example/mcp', 'configured-token')
    assert.equal(mod.effectiveConfig(config), config, 'nothing saved: the configuration as it is')
    assert.equal(mod.connectionSource(config), 'config')
    assert.equal(mod.connectionSource(configFor(dataDir)), 'none')
    const saved = mod.saveConnection(dataDir, { mcp_url: ' https://saved.example/mcp/x ', mcp_token: ' saved-token ' }, new Date('2026-09-24T08:00:00Z'))
    assert.deepEqual(saved, { mcp_url: 'https://saved.example/mcp/x', mcp_token: 'saved-token', saved_at: '2026-09-24T08:00:00.000Z' })
    assert.equal(statSync(join(dataDir, mod.CONNECTION_FILE)).mode & 0o777, 0o600, 'private to the person')
    const effective = mod.effectiveConfig(config)
    assert.equal(effective.mcpUrl, 'https://saved.example/mcp/x')
    assert.equal(effective.mcpToken, 'saved-token')
    assert.equal(effective.member, config.member)
    assert.equal(mod.connectionSource(config), 'saved')
    mod.saveConnection(dataDir, { mcp_url: 'https://other.example/mcp' })
    assert.equal(mod.effectiveConfig(config).mcpToken, '', 'a saved address without a token never borrows the configured one')
    assert.equal(mod.readConnection(dataDir).mcp_token, undefined)
    writeFileSync(join(dataDir, mod.CONNECTION_FILE), '{not json')
    assert.equal(mod.effectiveConfig(config).mcpUrl, 'https://configured.example/mcp', 'an unreadable file is ignored')
    mod.saveConnection(dataDir, { mcp_url: 'https://saved.example/mcp/x' })
    assert.equal(mod.clearConnection(dataDir), true)
    assert.equal(mod.clearConnection(dataDir), false)
    assert.equal(mod.effectiveConfig(config).mcpUrl, 'https://configured.example/mcp', 'cleared: the configured values again')
  }

  // --- 3. testing an address: never saves; errors in Chinese without the secrets ---------------
  const configured = await startFakeMirobody()
  servers.push(configured)
  const second = await startFakeMirobody({ token: TOKEN_B })
  servers.push(second)
  const secondUrl = `${second.url}/${SECRET_PATH}`
  {
    const ok = await mod.testConnection({ mcp_url: secondUrl, mcp_token: TOKEN_B })
    assert.equal(ok.ok, true)
    assert.equal(ok.indicators, 21, 'the fixture catalogue')
    const denied = await mod.testConnection({ mcp_url: secondUrl, mcp_token: 'wrong-token-123' })
    assert.equal(denied.ok, false)
    assert.match(denied.error, /拒绝/)
    assert.doesNotMatch(denied.error, new RegExp(`${SECRET_PATH}|wrong-token-123`), 'neither the address nor the token is repeated')
    const closed = await mod.testConnection({ mcp_url: 'http://127.0.0.1:1/mcp' })
    assert.equal(closed.ok, false)
    assert.match(closed.error, /[一-鿿]/)
    // A server that never answers: the whole test stops at the deadline.
    const silent = createServer(() => {})
    await new Promise((resolveListen) => silent.listen(0, '127.0.0.1', resolveListen))
    const started = Date.now()
    const slow = await mod.testConnection({ mcp_url: `http://127.0.0.1:${silent.address().port}/mcp` }, 400)
    assert.equal(slow.ok, false)
    assert.match(slow.error, /秒内没有回应/)
    assert.ok(Date.now() - started < 3000, 'bounded by the deadline')
    silent.closeAllConnections()
    await new Promise((resolveClose) => silent.close(resolveClose))
  }

  // --- 4. the routes ------------------------------------------------------------------------------
  const dataDir = tempDir('routes')
  const host = fakeHost()
  await mod.apply(host.ctx, configFor(dataDir, configured.url))
  const file = join(dataDir, mod.CONNECTION_FILE)

  let status = (await call(host, 'GET', '/api/longpi/connection')).json()
  assert.equal(status.source, 'config')
  assert.equal(status.status, 'ok')
  assert.equal(status.token_set, false)
  assert.equal(status.url_masked, configured.url)
  assert.equal(status.summary.checkups, 4, 'the fixture has four checkup days')
  assert.equal(status.summary.first_date, '2025-10-18')
  assert.equal(status.summary.last_date, '2026-08-26')
  assert.ok(status.summary.categories_zh.includes('血脂') && status.summary.categories_zh.includes('血常规'))
  assert.equal(typeof status.summary.wearable_days, 'number')

  // Refused addresses and a failed test save nothing and change nothing.
  for (const body of [{ mcp_url: 'http://192.168.1.20/mcp' }, { mcp_url: '' }, {}, { mcp_url: secondUrl, mcp_token: 'two words' }]) {
    const answer = await call(host, 'POST', '/api/longpi/connection', body)
    assert.equal(answer.status, 400, JSON.stringify(body))
    assert.equal(answer.json().ok, false)
    assert.match(answer.json().error, /[一-鿿]/)
  }
  const callsBefore = second.calls.length
  const denied = await call(host, 'POST', '/api/longpi/connection', { mcp_url: secondUrl })
  assert.equal(denied.status, 400)
  assert.equal(denied.json().ok, false)
  assert.match(denied.json().error, /拒绝/)
  assert.equal(denied.json().source, 'config', 'the connection in use is unchanged')
  assert.doesNotMatch(denied.text, new RegExp(SECRET_PATH))
  assert.equal(existsSync(file), false, 'nothing saved after a failed test')
  assert.equal(second.calls.length, callsBefore, 'the denied test never reached a tool call')

  // A test saves nothing.
  const tested = await call(host, 'POST', '/api/longpi/connection/test', { mcp_url: secondUrl, mcp_token: TOKEN_B })
  assert.equal(tested.status, 200)
  assert.deepEqual(tested.json(), { ok: true, indicator_count: 21, url_masked: `${second.url.replace(/\/mcp$/, '')}/mcp/…` })
  assert.equal(existsSync(file), false, 'a test saves nothing')
  const testedCurrent = (await call(host, 'POST', '/api/longpi/connection/test', {})).json()
  assert.equal(testedCurrent.ok, true, 'without an address, the connection in use is tested')
  const testedBad = await call(host, 'POST', '/api/longpi/connection/test', { mcp_url: 'http://192.168.1.20/mcp' })
  assert.equal(testedBad.status, 200)
  assert.equal(testedBad.json().ok, false)

  // Saving: tested first, then written (0600), and every module reads the new record.
  const configuredCalls = configured.calls.length
  const saved = await call(host, 'POST', '/api/longpi/connection', { mcp_url: secondUrl, mcp_token: TOKEN_B })
  assert.equal(saved.status, 200, saved.text)
  status = saved.json()
  assert.equal(status.ok, true)
  assert.equal(status.source, 'saved')
  assert.equal(status.token_set, true)
  assert.equal(status.status, 'ok')
  assert.equal(status.url_masked, `${second.url}/…`)
  assert.equal(status.summary.checkups, 4)
  assert.doesNotMatch(saved.text, new RegExp(`${TOKEN_B}|${SECRET_PATH}`), 'the token and the secret path never come back')
  assert.equal(statSync(file).mode & 0o777, 0o600)
  assert.deepEqual(Object.keys(JSON.parse(readFileSync(file, 'utf8'))), ['mcp_url', 'mcp_token', 'saved_at'])
  const indicators = (await call(host, 'GET', '/api/longpi/indicators')).json()
  assert.equal(indicators.record.status, 'ok')
  assert.equal(configured.calls.length, configuredCalls, 'the configured record is no longer read')
  // The mounted Mirobody tools follow the saved connection too.
  const secondCalls = second.calls.length
  const mirobodyTool = host.tools.get('query_health_indicators')
  assert.ok(mirobodyTool, 'the Mirobody tools are mounted')
  await mirobodyTool.execute({})
  assert.equal(second.calls.length, secondCalls + 1, 'the Mirobody tool reads the saved address with its token')
  assert.equal(configured.calls.length, configuredCalls)
  status = (await call(host, 'GET', '/api/longpi/connection')).json()
  assert.equal(status.source, 'saved')
  assert.doesNotMatch(JSON.stringify(status), new RegExp(TOKEN_B))

  // Clearing: the configured values apply again.
  const cleared = await call(host, 'DELETE', '/api/longpi/connection')
  assert.equal(cleared.status, 200)
  assert.equal(cleared.json().removed, true)
  assert.equal(cleared.json().source, 'config')
  assert.equal(existsSync(file), false)
  await mirobodyTool.execute({})
  assert.ok(configured.calls.length > configuredCalls, 'back on the configured record')
  assert.equal((await call(host, 'DELETE', '/api/longpi/connection')).json().removed, false)
  assert.equal((await call(host, 'PUT', '/api/longpi/connection', {})).status, 405)
  host.dispose()

  // No configuration and nothing saved: none.
  const bare = fakeHost()
  await mod.apply(bare.ctx, configFor(tempDir('bare')))
  assert.deepEqual((await call(bare, 'GET', '/api/longpi/connection')).json(), { source: 'none', url_masked: '', token_set: false, status: 'none' })
  // A record that cannot be read: error, in Chinese, without the address.
  const broken = fakeHost()
  await mod.apply(broken.ctx, configFor(tempDir('broken'), 'http://127.0.0.1:1/mcp'))
  const brokenStatus = (await call(broken, 'GET', '/api/longpi/connection')).json()
  assert.equal(brokenStatus.status, 'error')
  assert.match(brokenStatus.error, /记录读取失败/)
  assert.equal(brokenStatus.summary, undefined)
  bare.dispose()
  broken.dispose()

  console.log('connection ok (mask, token hash, 0600 file overriding the configuration for records and the Mirobody tools; test, save only after a read, clear)')
} finally {
  restore()
  for (const server of servers) await server.close()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
