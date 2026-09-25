// Every /api/longpi/* route passes DeepSeek Harness's own check before it does
// anything: the Host/Origin/Sec-Fetch-Site fence and the dsh-auth cookie of
// the connection service (claims 1a–1c). Without that service a route answers
// 503 and never falls open. Writes must be application/json (415 otherwise),
// so a page on another site cannot send one blind. Webhook addresses refuse
// this machine, link-local and metadata hosts and anything but https (1f).
//
// The fake host's connection stub mirrors dsh-client-connection's
// requestRejection. When DeepSeek Harness is installed on this machine
// (~/.dsh/profiles or DSH_MODULES), the same requests also go through the
// real WebServer and the real connection service on a loopback port.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, rmSync } from 'node:fs'
import { request } from 'node:http'
import { homedir, tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import { pathToFileURL } from 'node:url'
import * as mod from '../lib/index.js'

const restore = mod.setFollowupDeps({
  platform: 'darwin',
  run: async () => ({ ok: true }),
  fetch: async () => { throw new Error('no network in this test') },
})

const temp = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-auth-${name}-`))
  temp.push(dir)
  return dir
}

const COOKIE = 'dsh-auth-test=good'
const GOOD = { host: '127.0.0.1:3080', cookie: COOKIE }

/** dsh-client-connection's rule: loopback Host, not cross-site, Origin on the same host; then the signed cookie. */
function dshLikeRejection(req) {
  const headers = req.headers ?? {}
  if (typeof headers.host !== 'string') return 403
  let host
  try {
    host = new URL(`http://${headers.host}`)
  } catch {
    return 403
  }
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(host.hostname)) return 403
  if (headers['sec-fetch-site'] === 'cross-site') return 403
  if (typeof headers.origin === 'string') {
    try {
      if (new URL(headers.origin).host !== host.host) return 403
    } catch {
      return 403
    }
  }
  return (headers.cookie ?? '').split(';').some((part) => part.trim() === COOKIE) ? undefined : 401
}

function configFor(dataDir) {
  return {
    mcpUrl: '', mcpToken: '', member: '', timeoutMs: 5000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 20000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6, skillsVersion: '',
    bootstrapWorkspace: false,
  }
}

function fakeHost(connection) {
  const routes = new Map()
  const disposers = []
  const ctx = {
    tools: { register: () => () => {} },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    commands: { register: () => {} },
    ...(connection ? { connection } : {}),
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => {
      const dispose = execute()
      disposers.push(dispose)
      return dispose
    },
  }
  return { ctx, routes, dispose: () => disposers.splice(0).forEach((fn) => fn()) }
}

function call(host, method, url, { headers = {}, body } = {}) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(typeof body === 'string' ? body : JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]))
  return new Promise((resolveCall) => {
    const res = {
      statusCode: 200,
      writableEnded: false,
      setHeader: () => {},
      end: (text = '') => {
        res.writableEnded = true
        resolveCall({ status: res.statusCode, text: String(text) })
      },
    }
    handler(req, res)
  })
}

const LONGPI = (path) => path.startsWith('/api/longpi/')
// The methods each route answers; every one of them is tried.
const WRITES = new Set(['/api/longpi/plan-draft/accept', '/api/longpi/followup', '/api/longpi/followup/test', '/api/longpi/consent', '/api/longpi/self', '/api/longpi/checkin', '/api/longpi/run-ready', '/api/longpi/profile', '/api/longpi/connection', '/api/longpi/connection/test'])

try {
  // --- 1. no connection service: every route refuses with 503 --------------------------------
  {
    const dataDir = tempDir('none')
    const host = fakeHost(null)
    await mod.apply(host.ctx, configFor(dataDir))
    const paths = [...host.routes.keys()].filter(LONGPI)
    assert.ok(paths.length >= 18, `all LongPi routes registered (${paths.length})`)
    for (const path of paths) {
      for (const method of ['GET', 'POST', 'DELETE']) {
        const answer = await call(host, method, path, { headers: { ...GOOD, 'content-type': 'application/json' }, body: {} })
        assert.equal(answer.status, 503, `${method} ${path} without the connection service`)
        assert.equal(answer.text, mod.CONNECTION_UNAVAILABLE)
      }
    }
    assert.equal(existsSync(join(dataDir, 'profile.json')), false, 'nothing written')
    host.dispose()
  }

  // --- 2. the connection service decides; LongPi adds the JSON rule ------------------------
  const dataDir = tempDir('guarded')
  const seen = []
  const host = fakeHost({ requestRejection: (req) => { seen.push(req); return dshLikeRejection(req) } })
  await mod.apply(host.ctx, configFor(dataDir))
  const paths = [...host.routes.keys()].filter(LONGPI)
  for (const path of paths) {
    const methods = WRITES.has(path) ? ['GET', 'POST'] : ['GET']
    if (path === '/api/longpi/self' || path === '/api/longpi/connection') methods.push('DELETE')
    for (const method of methods) {
      const json = { 'content-type': 'application/json' }
      const noCookie = await call(host, method, path, { headers: { host: '127.0.0.1:3080', ...json }, body: {} })
      assert.equal(noCookie.status, 401, `${method} ${path} with no cookie`)
      const crossSite = await call(host, method, path, { headers: { ...GOOD, origin: 'https://evil.example', 'sec-fetch-site': 'cross-site', ...json }, body: {} })
      assert.equal(crossSite.status, 403, `${method} ${path} from another site`)
      const rebound = await call(host, method, path, { headers: { host: 'evil.example:3080', cookie: COOKIE, ...json }, body: {} })
      assert.equal(rebound.status, 403, `${method} ${path} with a rebound Host`)
    }
  }
  assert.ok(seen.length > 0 && seen.every((req) => typeof req.headers === 'object'), 'the request itself goes to requestRejection')

  // A good request goes through.
  const version = await call(host, 'GET', '/api/longpi/version', { headers: GOOD })
  assert.equal(version.status, 200)
  assert.equal(JSON.parse(version.text).version, mod.PRODUCT_VERSION)
  assert.equal((await call(host, 'GET', '/api/longpi/stats', { headers: GOOD })).status, 200)
  assert.equal((await call(host, 'GET', '/api/longpi/self', { headers: GOOD })).status, 200)

  // Writes must say application/json, with or without a charset; anything else is 415 and writes nothing.
  for (const type of [undefined, 'text/plain', 'text/plain;charset=UTF-8', 'application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonx']) {
    const headers = { ...GOOD, ...(type ? { 'content-type': type } : {}) }
    for (const [path, body] of [['/api/longpi/profile', { age: 99 }], ['/api/longpi/consent', { accept: true }], ['/api/longpi/self', { key: 'sbp', value: 150 }], ['/api/longpi/followup', { enabled: true }], ['/api/longpi/run-ready', {}]]) {
      const answer = await call(host, 'POST', path, { headers, body })
      assert.equal(answer.status, 415, `POST ${path} as ${type ?? 'no type'}`)
    }
    assert.equal((await call(host, 'DELETE', '/api/longpi/self?id=x', { headers })).status, 415, `DELETE as ${type ?? 'no type'}`)
  }
  for (const file of ['profile.json', 'followup.json', 'self_measurements.jsonl', 'receipts.jsonl']) assert.equal(existsSync(join(dataDir, file)), false, `${file} not written by a refused request`)
  const consent = await call(host, 'POST', '/api/longpi/consent', { headers: { ...GOOD, 'content-type': 'application/json; charset=utf-8' }, body: { accept: true } })
  assert.equal(consent.status, 200, 'application/json with a charset is accepted')
  assert.equal(JSON.parse(consent.text).ok, true)
  const profile = await call(host, 'POST', '/api/longpi/profile', { headers: { ...GOOD, 'content-type': 'Application/JSON' }, body: { age: 50 } })
  assert.equal(profile.status, 200, 'the media type is case-insensitive')
  assert.equal((await call(host, 'DELETE', '/api/longpi/self?id=nope', { headers: { ...GOOD, 'content-type': 'application/json' } })).status, 404, 'a JSON DELETE reaches the handler')
  // Body limits still apply behind the guard.
  const big = await call(host, 'POST', '/api/longpi/profile', { headers: { ...GOOD, 'content-type': 'application/json' }, body: JSON.stringify({ displayName: 'x'.repeat(9000) }) })
  assert.equal(big.status, 400)
  assert.match(big.text, /body too large/)

  // A connection service that answers something unexpected, or throws, refuses.
  const odd = fakeHost({ requestRejection: () => 500 })
  await mod.apply(odd.ctx, configFor(tempDir('odd')))
  assert.equal((await call(odd, 'GET', '/api/longpi/version', { headers: GOOD })).status, 403)
  odd.dispose()
  const throwing = fakeHost({ requestRejection: () => { throw new Error('boom') } })
  await mod.apply(throwing.ctx, configFor(tempDir('throwing')))
  assert.equal((await call(throwing, 'GET', '/api/longpi/version', { headers: GOOD })).status, 403)
  throwing.dispose()
  host.dispose()

  // --- 3. webhook addresses (1f) -------------------------------------------------------------
  const refused = [
    'http://example.com/hook', 'http://192.168.1.20:8080/longpi', 'http://localhost:9000/x', 'ftp://example.com/x',
    'https://127.0.0.1:3080/api/longpi/profile', 'https://127.1/', 'https://2130706433/', 'https://0x7f.0.0.1/', 'https://localhost/x', 'https://LOCALHOST./x',
    'https://app.localhost/x', 'https://[::1]/', 'https://[::]/', 'https://0.0.0.0/', 'https://169.254.169.254/latest/meta-data', 'https://[fe80::1]/',
    'https://[febf::1]/', 'https://[::ffff:127.0.0.1]/', 'https://[::ffff:169.254.169.254]/', 'https://metadata.google.internal/computeMetadata/v1/', 'https://metadata.google.internal./',
  ]
  for (const url of refused) {
    for (const kind of mod.WEBHOOK_KINDS) {
      const problem = mod.webhookUrlProblem(kind, url)
      assert.ok(problem, `${kind} ${url} is refused`)
      assert.match(problem, /[一-鿿]/, `${url}: the reason is in Chinese`)
    }
  }
  for (const url of ['https://open.feishu.cn/open-apis/bot/v2/hook/x', 'https://192.168.1.20:8443/longpi', 'https://10.0.0.5/hook', 'https://172.16.0.2/hook', 'https://nas.local/hook', 'https://[fd00::1]/hook', 'https://[fec0::1]/hook', 'https://169.253.1.1/']) {
    assert.equal(mod.webhookUrlProblem('generic', url), '', `${url} is allowed (a home server on the local network is fine)`)
  }
  const saveDir = tempDir('webhook')
  const refusedSave = mod.writeFollowup(saveDir, { webhook: { kind: 'generic', url: 'https://169.254.169.254/latest/meta-data' } })
  assert.equal(refusedSave.ok, false)
  assert.match(refusedSave.error, /链路本地|本机/)
  assert.equal(existsSync(join(saveDir, 'followup.json')), false)

  // --- 4. the real DeepSeek Harness, when it is installed here ----------------------------------
  const dshModules = process.env.DSH_MODULES || join(homedir(), '.dsh', 'profiles', 'node_modules', '@deepseek-ai')
  if (existsSync(join(dshModules, 'dsh-host-webserver', 'lib', 'index.js')) && existsSync(join(dshModules, 'dsh-client-connection', 'lib', 'index.js'))) {
    console.log(`auth: also checking against the installed DeepSeek Harness (${dshModules})`)
    await realHarness(dshModules)
  } else {
    console.log('auth: DeepSeek Harness not installed here; the real-service check is skipped')
  }

  console.log(`auth ok (${paths.length} routes: 503 without the connection service, 401 without the cookie, 403 cross-site or rebound, 415 for a write that is not JSON; webhook hosts)`)
} finally {
  restore()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}

/**
 * The same requests through DSH's own WebServer and connection service on 127.0.0.1 (an OS-assigned port),
 * with LongPi loaded by Cordis itself, so the connection service is injected the real way.
 */
async function realHarness(dshModules) {
  const load = (name) => import(pathToFileURL(join(dshModules, name, 'lib', 'index.js')).href)
  const { Context, Service } = await load('cordis')
  const { WebServer } = await load('dsh-host-webserver')
  const connectionPlugin = await load('dsh-client-connection')
  class Credentials extends Service {
    constructor(ctx) { super(ctx, 'credentials') }
    async modifyRecord(_key, update) { return await update(undefined) }
  }
  // The host services LongPi registers into, as no-ops.
  const stub = (name, value) => class extends Service {
    constructor(ctx) {
      super(ctx, name)
      Object.assign(this, value)
    }
  }
  const root = new Context()
  const fibers = [
    root.plugin(Credentials),
    root.plugin(stub('tools', { register: () => () => {} })),
    root.plugin(stub('skills', { register: () => () => {} })),
    root.plugin(stub('systemPrompt', { section: () => {} })),
    root.plugin(stub('commands', { register: () => {} })),
    root.plugin(WebServer, { host: '127.0.0.1', port: 0 }),
  ]
  let connectionFiber = root.plugin(connectionPlugin, {})
  const ready = async (check) => {
    for (let i = 0; i < 100 && !check(); i += 1) await new Promise((resolve) => setTimeout(resolve, 30))
    return check()
  }
  assert.ok(await ready(() => root.get('webServer')?.port && root.get('connection')), 'the real WebServer and connection service start')
  const web = root.get('webServer')
  const port = web.port
  const dataDir = tempDir('real')
  const longpi = root.plugin(mod, configFor(dataDir))
  assert.ok(await ready(() => web.match('/api/longpi/version')), 'LongPi loads under Cordis')
  const send = (method, path, headers, body) => new Promise((resolveSend, rejectSend) => {
    const req = request({ host: '127.0.0.1', port, method, path, headers, timeout: 10_000 }, (res) => {
      const chunks = []
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolveSend({ status: res.statusCode, text: Buffer.concat(chunks).toString('utf8') }))
    })
    req.on('timeout', () => req.destroy(new Error('timeout')))
    req.on('error', rejectSend)
    if (body !== undefined) req.write(body)
    req.end()
  })
  try {
    const loopback = `127.0.0.1:${port}`
    assert.equal((await send('GET', '/api/longpi/version', { Host: loopback })).status, 401, 'real: no cookie')
    assert.equal((await send('GET', '/api/longpi/version', { Host: loopback, Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site' })).status, 403, 'real: cross-site')
    assert.equal((await send('GET', '/api/longpi/version', { Host: `evil.example:${port}` })).status, 403, 'real: rebound Host')
    const post = await send('POST', '/api/longpi/profile', { Host: `evil.example:${port}`, Origin: 'https://evil.example', 'Sec-Fetch-Site': 'cross-site', 'Content-Type': 'text/plain;charset=UTF-8' }, JSON.stringify({ age: 99 }))
    assert.equal(post.status, 403, 'real: a blind cross-site write')
    assert.equal(existsSync(join(dataDir, 'profile.json')), false, 'real: nothing written')
    // A signed-in browser: the launch token on / is exchanged for the dsh-auth cookie, as the page's first load does.
    const connection = root.get('connection')
    const launch = new URL(connection.authenticatedUrl(`http://${loopback}`))
    let setCookie = ''
    connection.authorizeIndex({ method: 'GET', url: `${launch.pathname}${launch.search}`, headers: { host: loopback } }, {
      writeHead: (_status, headers) => { setCookie = String(headers?.['set-cookie'] ?? '') },
      end: () => {},
    })
    assert.match(setCookie, /^dsh-auth-/, 'real: the launch token gives a cookie')
    const cookie = setCookie.split(';')[0]
    const signed = await send('GET', '/api/longpi/version', { Host: loopback, Cookie: cookie })
    assert.equal(signed.status, 200, 'real: the dsh-auth cookie lets the page in')
    assert.equal(JSON.parse(signed.text).version, mod.PRODUCT_VERSION)
    assert.equal((await send('POST', '/api/longpi/consent', { Host: loopback, Cookie: cookie, 'Content-Type': 'text/plain' }, '{"accept":true}')).status, 415, 'real: signed in, but not JSON')
    const accepted = await send('POST', '/api/longpi/consent', { Host: loopback, Cookie: cookie, Origin: `http://${loopback}`, 'Sec-Fetch-Site': 'same-origin', 'Content-Type': 'application/json' }, '{"accept":true}')
    assert.equal(accepted.status, 200, 'real: a signed-in same-origin JSON write')
    assert.equal((await send('GET', '/api/longpi/version', { Host: `evil.example:${port}`, Cookie: cookie })).status, 403, 'real: the cookie does not help a rebound Host')
    // The connection service goes away: the routes stay registered and refuse; it comes back: they check again.
    await connectionFiber.dispose()
    const gone = await send('GET', '/api/longpi/version', { Host: loopback, Cookie: cookie })
    assert.equal(gone.status, 503, 'real: no connection service, no route')
    connectionFiber = root.plugin(connectionPlugin, {})
    assert.ok(await ready(() => root.get('connection')), 'the connection service comes back')
    assert.equal((await send('GET', '/api/longpi/version', { Host: loopback })).status, 401, 'real: checked again once it is back')
  } finally {
    await longpi.dispose()
    await connectionFiber.dispose()
    for (const fiber of fibers.reverse()) await fiber.dispose()
  }
}
