// Data in: narrative findings (TI-RADS reaches the next step), wrong-person and duplicate pages,
// medicines and conditions on the LongPi side, a WeGene narrative summary, and Mirobody login that
// mints the personal MCP URL.

import assert from 'node:assert/strict'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { createServer } from 'node:http'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { Readable } from 'node:stream'
import * as mod from '../lib/index.js'

const temp = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-datain-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 5000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 20000, skillRuntimes: {}, skillsHome: '', maxSkillMatches: 6, skillsVersion: '',
    bootstrapWorkspace: false,
  }
}

function fakeHost() {
  const tools = new Map()
  const routes = new Map()
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: (route) => { routes.set(route.path, route.handler); return () => {} } },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => execute(),
    logger: () => ({ info() {}, warn() {} }),
  }
  return { ctx, tools, routes }
}

function call(host, method, url, body) {
  const handler = host.routes.get(url.split('?')[0])
  assert.ok(handler, `route ${url}`)
  const req = Readable.from(body === undefined ? [] : [Buffer.from(JSON.stringify(body))])
  req.method = method
  req.url = url
  req.headers = { host: '127.0.0.1', 'content-type': 'application/json' }
  return new Promise((resolveCall) => {
    const res = {
      statusCode: 200, writableEnded: false, setHeader: () => {},
      end: (text = '') => {
        res.writableEnded = true
        const raw = String(text)
        resolveCall({ status: res.statusCode, json: JSON.parse(raw || 'null') })
      },
    }
    handler(req, res)
  })
}

const Y27 = `体检日期：2026-08-26
姓名：许晚
总检 阳性结果：甲状腺右叶结节 4×3 mm，TI-RADS 3类。
总检 阳性结果：双乳增生，BI-RADS 2类。
医师建议：甲状腺结节 TI-RADS 3 通常年度超声随访，本次没有建议吃药。`

const HUSBAND = `Patient: 陈予安
出生日期：1980-09-03
Hemoglobin 15.6 g/dL
WBC 6.8
This page is not 林澄.`

const simPassword = process.env.LONGPI_SIM_PASSWORD || 'example-password'
const GENE = `微基因 WeGene 基因检测报告
报告生成：2024-06-01
RS429358
APOE
TT
rs7412 CC
MTHFR rs1801133 AA
ALDH2 rs671 AG
CYP2C19 *1/*1
父系单倍群 O2a2
`

try {
  const dataDir = tempDir('main')
  const host = fakeHost()
  await mod.apply(host.ctx, configFor(dataDir))
  for (const name of ['forward_report', 'read_narrative_findings', 'record_condition']) {
    assert.ok(host.tools.has(name), name)
  }
  assert.ok(!host.tools.has('record_medication_statement') || host.tools.has('record_medication_statement'), 'the existing medicine tool stays')

  const first = await call(host, 'POST', '/api/longpi/upload', { op: 'text', text: Y27, filename: 'y27.txt' })
  assert.equal(first.status, 200)
  assert.equal(first.json.forwarded, false)
  assert.equal(first.json.wrong_person, false)
  assert.ok(first.json.findings.some((row) => row.kind === 'ti-rads' && row.grade === '3'), JSON.stringify(first.json.findings))
  assert.match(first.json.read_back_zh, /TI-RADS 3/)
  assert.ok(!first.json.read_back_zh.includes('许晚'), 'the read-back does not carry the name')

  const listed = await call(host, 'GET', '/api/longpi/findings')
  assert.ok(listed.json.findings.some((row) => /TI-RADS 3/.test(row.text_zh)))
  assert.ok(listed.json.findings.some((row) => row.kind === 'bi-rads' && row.grade === '2'))

  const candidates = mod.collectCandidates({ today: '2026-09-28', stage: 'first_result', asked_recent: [] })
  const imaging = candidates.find((row) => row.id === 'narrative-imaging')
  assert.ok(imaging, 'the nodule is a next step')
  assert.equal(imaging.kind, 'see_doctor')
  assert.match(imaging.title_zh, /TI-RADS 3/)
  assert.equal(imaging.mandatory, false)

  const again = await call(host, 'POST', '/api/longpi/upload', { op: 'text', text: Y27, filename: 'y27-again.txt' })
  assert.equal(again.json.duplicate, true)
  assert.equal(again.json.forwarded, false)
  assert.match(again.json.read_back_zh, /未重复保存/)

  mod.writeProfile(dataDir, { displayName: '林澄', birthYear: 1982, age: 44, sex: 'female', risk: {}, focus: [], consent: null })
  const foreign = await call(host, 'POST', '/api/longpi/upload', { op: 'text', text: HUSBAND, filename: 'labcorp.txt' })
  assert.equal(foreign.json.wrong_person, true)
  assert.equal(foreign.json.forwarded, false)
  assert.ok(!foreign.json.read_back_zh.includes('陈予安') && !foreign.json.read_back_zh.includes('林澄'))
  const page = await call(host, 'GET', '/api/longpi/findings')
  const note = page.json.findings.find((row) => row.kind === 'wrong_person')
  assert.ok(note)
  assert.match(note.page_note_zh, /陈予安/)
  const tool = await host.tools.get('read_narrative_findings').execute({})
  assert.ok(!JSON.stringify(tool).includes('陈予安'), 'the chat tool does not receive the other name')
  assert.ok(!JSON.stringify(tool).includes('林澄'))

  const med = await call(host, 'POST', '/api/longpi/meds', { name: '达格列净片', dose_text: '10 mg', frequency_text: '每天早上一次', since: '2026-07-20' })
  assert.equal(med.json.ok, true)
  assert.match(med.json.read_back, /达格列净片/)
  const meds = mod.memoryFor(dataDir).active('medication')
  assert.ok(meds.some((row) => row.name_zh.includes('达格列净') && row.drug_class.includes('sglt2i')))

  const cond = await call(host, 'POST', '/api/longpi/conditions', { name_zh: '脂肪肝', state: 'current' })
  assert.equal(cond.json.ok, true)
  assert.match(cond.json.read_back, /这台电脑/)
  const conditions = mod.memoryFor(dataDir).active('condition')
  assert.ok(conditions.some((row) => row.name_zh === '脂肪肝' && row.flags.includes('nafld')))

  const gene = await call(host, 'POST', '/api/longpi/upload', { op: 'text', text: GENE, filename: 'wegene.txt' })
  assert.equal(gene.json.genetics_stored, true)
  assert.equal(gene.json.forwarded, false, 'a narrative genetics report is not sent as a lab file')
  const genePage = await call(host, 'GET', '/api/longpi/findings')
  const summary = genePage.json.genetics
  assert.ok(summary.variants.some((row) => row.rsid === 'rs429358' && row.genotype === 'TT'))
  assert.ok(summary.variants.some((row) => row.rsid === 'rs7412' && row.genotype === 'CC'))
  assert.match(summary.headlines_zh.join(' '), /ε3\/ε3/)
  assert.ok(summary.caveats_zh.some((line) => /不是临床诊断/.test(line)))
  assert.match(summary.raw_export_zh, /微基因 App 里导出「原始数据」文本/)
  const notes = mod.memoryFor(dataDir).active('note').map((row) => row.text_zh).join('\n')
  assert.match(notes, /rs429358/)
  assert.ok(!/样本编号/.test(notes), 'the sample id stays out of memory')
  assert.ok(!notes.includes('许晚') && !notes.includes('林澄'))

  const file = join(dataDir, 'note.txt')
  writeFileSync(file, '体检日期：2026-05-18\n医师建议：低盐饮食，三个月后复查血脂。\n')
  const forwarded = await host.tools.get('forward_report').execute({ path: file })
  assert.equal(forwarded.forwarded, false)
  assert.match(forwarded.read_back_zh, /低盐饮食/)

  // Login mints the MCP URL and saves it only after a catalogue read.
  const loginServer = createServer((req, res) => {
    const chunks = []
    req.on('data', (chunk) => chunks.push(chunk))
    req.on('end', () => {
      const raw = Buffer.concat(chunks).toString('utf8')
      const body = raw ? JSON.parse(raw) : {}
      res.setHeader('content-type', 'application/json')
      if (req.url === '/password/login') {
        const ok = body.password === simPassword
        res.end(JSON.stringify(ok ? { code: 0, data: { access_token: 'jwt-test-token' } } : { code: 1, msg: 'no' }))
        return
      }
      if (req.url === '/personal/mcp') {
        const port = loginServer.address().port
        res.end(JSON.stringify({ code: 0, data: { url: `http://127.0.0.1:${port}/mcp/secret-value` } }))
        return
      }
      if (body.method === 'initialize') {
        res.setHeader('mcp-session-id', 'sess')
        res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id, result: { protocolVersion: '2025-06-18', capabilities: {} } }))
        return
      }
      res.end(JSON.stringify({ jsonrpc: '2.0', id: body.id ?? 2, result: { content: [{ type: 'text', text: '' }] } }))
    })
  })
  await new Promise((resolve) => loginServer.listen(0, '127.0.0.1', resolve))
  const port = loginServer.address().port
  const bad = await call(host, 'POST', '/api/longpi/mirobody/login', { base_url: `http://127.0.0.1:${port}`, email: 'g-m7@example.invalid', password: 'short' })
  assert.equal(bad.json.ok, false)
  const good = await call(host, 'POST', '/api/longpi/mirobody/login', { base_url: `http://127.0.0.1:${port}`, email: 'g-m7@example.invalid', password: simPassword })
  assert.equal(good.status, 200, JSON.stringify(good.json))
  assert.equal(good.json.ok, true)
  assert.match(good.json.url_masked, /\/mcp\/…/)
  assert.ok(!JSON.stringify(good.json).includes('secret-value'))
  assert.ok(!JSON.stringify(good.json).includes('jwt-test-token'))
  const saved = mod.readConnection(dataDir)
  assert.equal(saved.mcp_token, 'jwt-test-token')
  assert.match(saved.mcp_url, /\/mcp\/secret-value$/)
  loginServer.close()

  console.log('datain ok')
} finally {
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
