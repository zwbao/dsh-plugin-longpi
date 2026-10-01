// M11: separate PIPL consent, name redaction, session-log default off, minors, export and delete.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as mod from '../lib/index.js'

const temp = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-privacy-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir) {
  return {
    mcpUrl: 'http://127.0.0.1:18060/mcp', mcpToken: 'config-token-should-not-leak', member: '', timeoutMs: 5000,
    pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 20000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6,
    skillsVersion: '', bootstrapWorkspace: false, scienceMode: 'off',
    engage: { codex: true, nudgesInWorkflow: false },
  }
}

function fakeHost() {
  const routes = new Map()
  const listeners = {}
  const ctx = {
    tools: { register: () => () => {} },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    logger: () => ({ info() {}, warn() {}, error() {} }),
    inject: (_names, callback) => callback(ctx),
    on: (name, listener) => { (listeners[name] ??= []).push(listener); return () => {} },
    effect: (execute) => execute(),
    llm: {
      stream(options) {
        ctx.llm.calls.push(options)
        return (async function* empty() {})()
      },
      calls: [],
    },
    deepseekLlmApiExtensions: {
      accepted: false,
      async prepare() {
        return {
          fields: { dsh_session_log: { events: [{ text: '包某某的血红蛋白' }], displayName: '包某某' } },
          accept: async () => { ctx.deepseekLlmApiExtensions.accepted = true },
        }
      },
    },
  }
  return { ctx, routes, listeners }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolve) => {
    const headers = {}
    const res = {
      statusCode: 200,
      setHeader: (key, value) => { headers[key.toLowerCase()] = value },
      end: (text = '') => {
        const raw = Buffer.isBuffer(text) ? text : Buffer.from(String(text))
        let json = null
        try { json = JSON.parse(raw.toString('utf8')) } catch { json = null }
        resolve({ status: res.statusCode, headers, raw, text: raw.toString('utf8'), json })
      },
    }
    handler(req, res)
  })
}

async function postExecute(listeners, exec, result) {
  const run = [...listeners].reduceRight((next, listener) => () => listener(exec, result, next), async () => ({ kind: 'accept' }))
  return run()
}

function packWith(age, allowYounger) {
  return {
    person: { age, display_name: '包某某', sex: 'male' },
    feedback: allowYounger ? [{ id: 'bio', allowed_claims: ['younger'], numbers: [{ key: 'phenoage.advance' }] }] : [],
    numbers: [], top_facts: [], candidates: [], exclusions: [],
    safety: { drug_classes: [], conditions: [] },
    today: '2026-09-28',
  }
}

try {
  const dataDir = tempDir('main')
  const saved = mod.normalizeProfile({
    displayName: '包某某', age: 36, sex: 'male',
    consent: { version: mod.CONSENT_VERSION, accepted_at: '2026-09-28T00:00:00.000Z' },
  })
  assert.equal(saved.ok, true)
  assert.equal(saved.profile.consents.pipl_sensitive, null, 'a profile without the new block has no sensitive-information act')
  mod.writeProfile(dataDir, saved.profile)
  assert.deepEqual(mod.readProfile(dataDir).consents, saved.profile.consents)
  writeFileSync(join(dataDir, 'connection.json'), `${JSON.stringify({ mcp_url: 'http://127.0.0.1:18060/mcp', mcp_token: 'SECRETTOKENVALUE', saved_at: '2026-09-28T00:00:00.000Z' })}\n`)
  const workspace = join(dataDir, 'workspace')
  mkdirSync(workspace)
  writeFileSync(join(dataDir, 'workspace-bootstrap.json'), `${JSON.stringify({ path: workspace })}\n`)

  const host = fakeHost()
  await mod.apply(host.ctx, configFor(dataDir))

  const status = (await call(host, 'GET', '/api/longpi/privacy')).json
  assert.equal(status.ok, true)
  assert.equal(status.version, '2026-09-28')
  assert.equal(status.processing_allowed, false, 'no sensitive-information grant yet')
  assert.equal(status.consents.pipl_sensitive.granted, false)
  assert.equal(status.session_log.health_workspace_default, 'off')
  assert.equal(status.session_log.upload, false)
  assert.equal(status.minor.codex_allowed, true, 'a known adult may draw')
  assert.equal(status.science.live_allowed, false)
  assert.equal(status.science.genetics_in_research, false)
  assert.ok(status.science.blockers_zh.some((line) => line.includes('ChiCTR')))
  assert.ok(status.science.blockers_zh.some((line) => line.includes('伦理')))
  assert.ok(status.science.blockers_zh.some((line) => line.includes('基因')))
  assert.match(status.copy.pipl.paragraphs.join(''), /敏感个人信息/)
  assert.match(status.copy.data_flow.name, /名字不会/)
  assert.match(status.copy.data_flow.session_log, /默认不上传/)

  const page = await call(host, 'GET', '/api/longpi/privacy?view=page')
  assert.match(page.headers['content-type'], /text\/html/)
  assert.match(page.text, /单独同意/)
  assert.match(page.text, /id="pipl-grant"/)
  assert.match(page.text, /id="flow-grant"/)
  assert.match(page.text, /关闭（默认）/)
  assert.doesNotMatch(page.text, /id="pipl-grant"[^>]*checked/)
  assert.match(page.text, /<input type="checkbox" id="guardian">/)

  const gated = await postExecute(host.listeners['tools/post-execute'], { name: 'read_personal_situation', arguments: {} }, {
    isError: false,
    value: { profile: { displayName: '包某某' }, hgb: 116 },
    content: [{ type: 'text', text: '包某某的血红蛋白是 116' }],
  })
  assert.match(gated.content[0].text, /单独同意/)
  assert.doesNotMatch(gated.content[0].text, /包某某/)
  assert.doesNotMatch(gated.content[0].text, /116/)

  const pipl = (await call(host, 'POST', '/api/longpi/privacy/consent', { scope: 'pipl_sensitive', decision: 'granted' })).json
  assert.equal(pipl.consents.pipl_sensitive.granted, true)
  assert.equal(pipl.processing_allowed, false, 'the DeepSeek act is still separate')
  const still = await postExecute(host.listeners['tools/post-execute'], { name: 'query_health_indicators', arguments: {} }, {
    isError: false, value: { displayName: '包某某' }, content: [{ type: 'text', text: '包某某 116' }],
  })
  assert.match(still.content[0].text, /发给 DeepSeek/)
  assert.doesNotMatch(still.content[0].text, /包某某/)

  const flow = (await call(host, 'POST', '/api/longpi/privacy/consent', { scope: 'data_flow_deepseek', decision: 'granted' })).json
  assert.equal(flow.processing_allowed, true)
  const opened = await postExecute(host.listeners['tools/post-execute'], { name: 'read_personal_situation', arguments: {} }, {
    isError: false,
    value: { profile: { displayName: '包某某', hgb: 116 } },
    content: [{ type: 'text', text: '{"displayName":"包某某","note":"血红蛋白 116"}' }],
  })
  assert.doesNotMatch(JSON.stringify(opened.content), /包某某/)
  assert.match(opened.content[0].text, /116/)
  assert.match(opened.content[0].text, /"displayName":""/)

  await host.ctx.llm.stream({ system: '你在帮助包某某', messages: [{ role: 'user', content: [{ type: 'text', text: '包某某问血红蛋白' }] }] })
  const sent = host.ctx.llm.calls[0]
  assert.doesNotMatch(sent.system, /包某某/)
  assert.doesNotMatch(JSON.stringify(sent.messages), /包某某/)
  assert.match(JSON.stringify(sent.messages), /血红蛋白/)

  for (const listener of host.listeners['agent/created'] ?? []) listener({ agent: { session: { id: 'health-1', header: { cwd: workspace } } } })
  host.ctx.deepseekLlmApiExtensions.accepted = false
  const blockedLog = await host.ctx.deepseekLlmApiExtensions.prepare({ sessionId: 'health-1' })
  assert.equal(blockedLog.fields.dsh_session_log, undefined, 'health workspace does not upload the session log')
  await blockedLog.accept()
  assert.equal(host.ctx.deepseekLlmApiExtensions.accepted, false, 'a suppressed upload is not marked accepted')
  const codingLog = await host.ctx.deepseekLlmApiExtensions.prepare({ sessionId: 'code-1' })
  assert.ok(codingLog.fields.dsh_session_log, 'a non-health session keeps the host setting')
  assert.doesNotMatch(JSON.stringify(codingLog.fields), /包某某/)

  const events = readFileSync(join(dataDir, 'events.jsonl'), 'utf8')
  assert.match(events, /consent\.changed/)
  assert.match(events, /pipl_sensitive/)

  const adult = packWith(40, true)
  const card = { fact_ids: ['bio'], number_keys: ['phenoage.advance'] }
  assert.ok(mod.runValidators('status', '疗效最好，保证有效', card, adult).some((row) => row.rule === 'adlaw.wording'))
  assert.ok(mod.runValidators('status', '你更年轻了', card, adult).some((row) => row.rule === 'adlaw.wording' && row.detail.includes('估计')))
  assert.equal(mod.runValidators('status', '你更年轻了（模型估计）', card, adult).filter((row) => row.rule === 'adlaw.wording').length, 0)
  assert.ok(mod.runValidators('suggestion', '要不要减肥', card, packWith(16, false)).some((row) => row.rule === 'adlaw.wording'))
  assert.equal(mod.runValidators('suggestion', '不安排减肥', card, packWith(16, false)).filter((row) => row.rule === 'adlaw.wording').length, 0)
  assert.equal(mod.runValidators('suggestion', '要不要减肥', card, adult).filter((row) => row.rule === 'adlaw.wording').length, 0)

  const child = await call(host, 'POST', '/api/longpi/privacy/consent', { scope: 'pipl_sensitive', decision: 'granted', age: 10 })
  assert.equal(child.status, 400)
  assert.match(child.json.error, /监护人/)
  const withGuardian = (await call(host, 'POST', '/api/longpi/privacy/consent', { scope: 'pipl_sensitive', decision: 'granted', age: 10, guardian: true })).json
  assert.equal(withGuardian.consents.pipl_sensitive.granted, true)
  assert.equal(withGuardian.minor.codex_allowed, false)
  assert.equal(withGuardian.minor.weight_loss, false)
  const memory = mod.readProfile(dataDir)
  assert.equal(memory.age, 10)
  const prefs = mod.memoryFor(dataDir).active('preference')
  assert.ok(prefs.some((item) => item.key === 'codex_enabled' && item.value === false))

  const draft = await postExecute(host.listeners['tools/post-execute'], { name: 'draft_intervention_plan', arguments: {} }, {
    isError: false,
    value: {
      draft: { items: [{ category: 'weight', title_zh: '减肥' }, { category: 'sleep', title_zh: '固定起床时间' }] },
      reply_zh: '包某某可以试试减肥。睡眠也要固定。',
    },
    content: [{ type: 'text', text: 'ignored when value is replaced' }],
  })
  assert.deepEqual(draft.value.draft.items.map((item) => item.category), ['sleep'])
  assert.doesNotMatch(draft.value.reply_zh, /试试减肥/)
  assert.doesNotMatch(draft.value.reply_zh, /包某某/)
  assert.match(draft.value.reply_zh, /未满 18 岁/)

  // What a 0.7 home also holds: the paired account, a personal link, reminder channels, logs, a family member.
  writeFileSync(join(dataDir, 'connection.json'), `${JSON.stringify({ mcp_url: 'http://127.0.0.1:18060/mcp/x_PERSONALPATH', mcp_token: 'SECRETTOKENVALUE', saved_at: '2026-09-28T00:00:00.000Z' })}\n`)
  writeFileSync(join(dataDir, 'mirobody-account.json'), `${JSON.stringify({ base: 'http://127.0.0.1:18060', email: 'longpi-holder@example.invalid', password: 'PASSWORD-SHOULD-NOT-LEAK', created_at: '2026-09-28T00:00:00.000Z' })}\n`)
  writeFileSync(join(dataDir, 'followup.json'), `${JSON.stringify({ enabled: true, webhooks: [{ url: 'https://hooks.example.invalid/x' }] })}\n`)
  writeFileSync(join(dataDir, 'usage.jsonl'), '{"tokens":1}\n')
  mkdirSync(join(dataDir, 'notifier', 'LongPi.app'), { recursive: true })
  writeFileSync(join(dataDir, 'notifier', 'LongPi.app', 'x'), 'binary')
  mkdirSync(join(dataDir, 'people', 'pmom'), { recursive: true })
  writeFileSync(join(dataDir, 'people', 'pmom', 'profile.json'), '{"displayName":"妈妈"}\n')
  const exported = await call(host, 'GET', '/api/longpi/privacy/export')
  assert.equal(exported.status, 200)
  assert.match(exported.headers['content-type'], /application\/zip/)
  assert.equal(exported.raw.subarray(0, 2).toString('utf8'), 'PK')
  const zipPath = join(dataDir, 'out.zip')
  writeFileSync(zipPath, exported.raw)
  // Every file in the archive, then every byte of it: only the person's records, and none of the service's secrets.
  const dump = 'import zipfile,sys; z=zipfile.ZipFile(sys.argv[1]); print("\\n".join(z.namelist())); print("---"); [print(z.read(n).decode("utf8","replace")) for n in z.namelist()]'
  const listed = spawnSync('python3', ['-c', dump, zipPath], { encoding: 'utf8' })
  assert.equal(listed.status, 0, listed.stderr)
  const names = listed.stdout.split('---')[0]
  assert.match(names, /说明\.txt/)
  assert.match(names, /profile\.json/)
  for (const left of ['connection.json', 'mirobody-account.json', 'followup.json', 'usage.jsonl', 'notifier/', 'workspace/', 'people']) {
    assert.ok(!names.includes(left), `${left} is not in the archive`)
  }
  for (const secret of ['SECRETTOKENVALUE', 'longpi-holder@example.invalid', 'PASSWORD-SHOULD-NOT-LEAK', 'x_PERSONALPATH', 'hooks.example.invalid']) {
    assert.ok(!listed.stdout.includes(secret), `${secret} is nowhere in the archive`)
  }
  assert.doesNotMatch(listed.stdout, /~\/\.dsh|已移除连接令牌/, 'the note names no folder and makes no claim the archive does not keep')

  const refused = await call(host, 'POST', '/api/longpi/privacy/delete', { confirm: '删掉' })
  assert.equal(refused.status, 400)
  assert.equal(mod.readProfile(dataDir).displayName, '包某某')
  const removed = (await call(host, 'POST', '/api/longpi/privacy/delete', { confirm: '删除全部' })).json
  assert.equal(removed.ok, true)
  assert.equal(mod.readProfile(dataDir).displayName, '')
  assert.match(readFileSync(join(dataDir, 'privacy', 'deleted.json'), 'utf8'), /已删除/)
  assert.equal((await call(host, 'GET', '/api/longpi/privacy')).json.processing_allowed, false)

  console.log('privacy ok')
} finally {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
