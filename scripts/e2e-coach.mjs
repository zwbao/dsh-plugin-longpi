// Live end-to-end check of Pi inside LongPi. It needs a model, so it is not part of npm test.
//
// An isolated DeepSeek Harness home gets this checkout as a plugin, the longevity-coach skill and a stand-in
// longevity-analyst skill (same name and description, instructions and la.py that only leave a trace), and a LongPi
// data folder with consent given. Two conversations ask for a deep analysis: with the demo profile active (LongPi
// refuses to start one there) and with the account holder. Each passes when the model called run_deep_analysis and
// never loaded the analyst skill or ran la.py before LongPi's tool returned a start.
//
//   DEEPSEEK_API_KEY=... node scripts/e2e-coach.mjs [--keep] [--only demo|holder]
//   node scripts/e2e-coach.mjs --fake-model      the same conversations against a scripted local model: checks the
//                                                 wiring (persona, snapshot, tools, skills, tool execution) only
//
// DSH_BIN (default dsh), LONGEVITY_SKILLS_HOME and LONGPI_COACH_SKILL_DIR override where things are found; by default
// the sibling checkouts next to this one are used.

import { spawn, execFileSync } from 'node:child_process'
import { createServer } from 'node:http'
import { cpSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const parent = join(repo, '..')
const args = process.argv.slice(2)
const keep = args.includes('--keep')
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : ''
const dsh = process.env.DSH_BIN || 'dsh'
const skillsHome = process.env.LONGEVITY_SKILLS_HOME || join(parent, 'longevity-skills')
const coachDir = process.env.LONGPI_COACH_SKILL_DIR || join(parent, 'longevity-coach-skill', 'skills', 'longevity-coach')
const noKey = args.includes('--boot-only')
const fake = args.includes('--fake-model')

if (!process.env.DEEPSEEK_API_KEY && !noKey && !fake) {
  console.error('DEEPSEEK_API_KEY is not set: this check talks to the model. (--fake-model checks the wiring with a scripted model.)')
  process.exit(2)
}
for (const [what, path] of [['longevity-skills', join(skillsHome, 'catalog.json')], ['longevity-coach', join(coachDir, 'SKILL.md')], ['built lib', join(repo, 'lib', 'index.js')]]) {
  if (!existsSync(path)) { console.error(`${what} not found at ${path}`); process.exit(2) }
}

const root = mkdtempSync(join(tmpdir(), 'longpi-e2e-'))
const home = join(root, 'dsh')
const data = join(root, 'data')
const plugin = join(root, 'plugin')
mkdirSync(home, { mode: 0o700 })
const env = { ...process.env, DSH_HOME: home }
const run = (cmd, argv, opts = {}) => execFileSync(cmd, argv, { encoding: 'utf8', env, stdio: ['ignore', 'pipe', 'pipe'], ...opts })
const spawnText = (cmd, argv, opts = {}) => new Promise((resolve) => {
  const child = spawn(cmd, argv, { env, ...opts })
  let stdout = ''
  let stderr = ''
  child.stdout?.on('data', (d) => { stdout += d })
  child.stderr?.on('data', (d) => { stderr += d })
  const timer = setTimeout(() => child.kill("SIGTERM"), opts.timeout ?? (Number(process.env.E2E_TIMEOUT_MS) || 6 * 60_000))
  child.on('close', (status) => { clearTimeout(timer); resolve({ status, stdout, stderr }) })
})

// The local model endpoint DSH talks to (DEEPSEEK_BASE_URL). With --fake-model it scripts the turns: call
// run_deep_analysis once, then say what the tool returned (requests without tools, such as titles, get a short text).
// Otherwise it forwards to the real endpoint and only records. Either way every request is kept: each one carries the
// whole conversation, so the model's tool calls can be read back in order.
const requests = []
async function modelEndpoint() {
  const upstream = (process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com').replace(/\/$/, '')
  const sse = (res, chunks) => {
    res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' })
    for (const c of chunks) res.write(`data: ${JSON.stringify({ id: 'fake', object: 'chat.completion.chunk', created: 0, model: 'fake', ...c })}\n\n`)
    res.end('data: [DONE]\n\n')
  }
  const scripted = (json, res) => {
    const tools = (json.tools ?? []).map((t) => t.function?.name)
    const answered = (json.messages ?? []).filter((m) => m.role === 'tool')
    const usage = { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 }
    if (tools.includes('run_deep_analysis') && answered.length === 0) {
      sse(res, [
        { choices: [{ index: 0, delta: { role: 'assistant', tool_calls: [{ index: 0, id: 'call_e2e', type: 'function', function: { name: 'run_deep_analysis', arguments: JSON.stringify({ trigger: 'member', reason_zh: '用户主动要求做一次深度分析' }) } }] }, finish_reason: null }] },
        { choices: [{ index: 0, delta: {}, finish_reason: 'tool_calls' }], usage },
      ])
      return
    }
    const last = answered.at(-1)
    const said = last ? `（脚本模型）工具返回：${String(typeof last.content === 'string' ? last.content : JSON.stringify(last.content)).slice(0, 300)}` : '测试'
    sse(res, [{ choices: [{ index: 0, delta: { role: 'assistant', content: said }, finish_reason: null }] }, { choices: [{ index: 0, delta: {}, finish_reason: 'stop' }], usage }])
  }
  const server = createServer((req, res) => {
    const parts = []
    req.on('data', (d) => parts.push(d))
    req.on('end', async () => {
      const body = Buffer.concat(parts)
      if (/chat\/completions$/.test(req.url ?? '')) {
        try { requests.push({ ...JSON.parse(body.toString('utf8') || '{}'), __at: Date.now() }) } catch { /* not JSON */ }
      }
      if (fake) {
        if (!/chat\/completions$/.test(req.url ?? '')) { res.writeHead(404); res.end(); return }
        scripted(requests.at(-1) ?? {}, res)
        return
      }
      try {
        const headers = Object.fromEntries(Object.entries(req.headers).filter(([k]) => !['host', 'content-length', 'connection'].includes(k)))
        const up = await fetch(`${upstream}${req.url}`, { method: req.method, headers, body: ['GET', 'HEAD'].includes(req.method ?? '') ? undefined : body })
        res.writeHead(up.status, Object.fromEntries([...up.headers].filter(([k]) => !['content-encoding', 'content-length', 'transfer-encoding'].includes(k))))
        if (up.body) for await (const chunk of up.body) res.write(chunk)
        res.end()
      } catch (error) {
        res.writeHead(502); res.end(String(error))
      }
    })
  })
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  env.DEEPSEEK_BASE_URL = `http://127.0.0.1:${server.address().port}`
  if (fake) env.DEEPSEEK_API_KEY = 'fake-e2e'
  return server
}
const server = noKey ? null : await modelEndpoint()

// 1. the profile and the plugin (copied: pnpm and file: paths with spaces do not mix)
cpSync(repo, plugin, { recursive: true, filter: (src) => !/[\\/](node_modules|\.git)([\\/]|$)/.test(src.slice(repo.length)) })
await spawnText(dsh, ['--profile', 'e2e', '--from-default-profile', 'headless', '--help'])
run(dsh, ['plugin', '--profile', 'e2e', 'add', `file:${plugin}`])
const q = (s) => `'${String(s).replace(/'/g, "''")}'`
writeFileSync(join(home, 'profiles', 'e2e', 'cordis.patch.yml'), [
  '- id: dsh-plugin-longpi', '  config:',
  `    skillsHome: ${q(skillsHome)}`, `    pythonBin: ${q(process.env.LONGPI_PYTHON || 'python3')}`, `    skillPython: ${q(process.env.LONGPI_PYTHON || 'python3')}`,
  `    dataDir: ${q(data)}`, "    mcpUrl: ''", "    mirobodyUrl: ''", '    coach: true', '    bootstrapWorkspace: true', '',
].join('\n'), { mode: 0o600 })

// 2. the skills DSH discovers: Pi, and the stand-in analyst that only leaves a trace
const skills = join(home, 'skills')
mkdirSync(skills)
symlinkSync(coachDir, join(skills, 'longevity-coach'))
const trace = join(root, 'analyst-trace.log')
const stub = join(skills, 'longevity-analyst')
mkdirSync(join(stub, 'scripts'), { recursive: true })
const realHead = (() => {
  try { return readFileSync(join(parent, 'longevity-analyst-skill', 'skills', 'longevity-analyst', 'SKILL.md'), 'utf8').split('\n---')[0] } catch { return '---\nname: longevity-analyst\ndescription: Multi-omics longevity analysis.\nmetadata:\n  version: "0.7.1"' }
})()
writeFileSync(join(stub, 'SKILL.md'), `${realHead}\n---\n\n# longevity-analyst (end-to-end stand-in)\n\nThis copy is a test stand-in. Do not run any pipeline. Run \`python3 ${join(stub, 'scripts', 'la.py')} observe\` once, then tell the person: 测试桩已加载。\n`)
writeFileSync(join(stub, 'scripts', 'la.py'), `# s = sub.add_parser("export")\n# s = sub.add_parser("mirobody")\nimport sys\nopen(${JSON.stringify(trace)}, "a").write(" ".join(sys.argv[1:]) + "\\n")\nprint("stand-in")\n`)

// 3. the LongPi data folder: consent given, the health workspace, a profile, the demo person
const lib = await import(join(repo, 'lib', 'index.js'))
mkdirSync(data, { recursive: true, mode: 0o700 })
lib.writeProfile(data, { ...lib.EMPTY_PROFILE, age: 52, birthYear: 1974, sex: 'male', consent: { version: lib.CONSENT_VERSION, accepted_at: new Date().toISOString() } })
for (const scope of ['pipl_sensitive', 'data_flow_deepseek']) lib.recordConsent(data, { scope, decision: 'granted', mode: 'off', textVersion: 'e2e' })
const workspace = join(data, 'workspace')
mkdirSync(workspace, { recursive: true })
writeFileSync(join(data, lib.WORKSPACE_MARKER), JSON.stringify({ path: workspace, created: new Date().toISOString() }))
lib.ensureDemoPerson(data)
await lib.openDemo(data)
// Pi's part of the demo person's memory, so the page snapshot has a vision and a commitment to open with
lib.memoryFor(lib.personDir(data, lib.DEMO_ID)).apply([
  { op: 'add', item: { kind: 'vision', text_zh: '70 岁还能带孙子爬泰山', confirmed: true, provenance: { kind: 'import', at: new Date().toISOString(), by: 'M0' } } },
  { op: 'add', item: { kind: 'commitment', text_zh: '当工作日在家做晚饭时，我就用限盐勺', confidence: 8, started: new Date().toISOString().slice(0, 10), confirmed: true, provenance: { kind: 'import', at: new Date().toISOString(), by: 'M0' } } },
], 'M0')

/** The model's tool calls in one conversation, in order, from the longest recorded request (it holds the others). */
function toolCalls(sent) {
  const chats = sent.filter((req) => (req.tools ?? []).length > 0)
  const longest = chats.sort((x, y) => (y.messages?.length ?? 0) - (x.messages?.length ?? 0))[0]
  const out = []
  for (const m of longest?.messages ?? []) {
    for (const call of m.role === 'assistant' ? m.tool_calls ?? [] : []) out.push({ name: call.function?.name ?? '', args: String(call.function?.arguments ?? '') })
  }
  return out
}

async function converse(label, prompt) {
  rmSync(trace, { force: true })
  const before = requests.length
  const startedAt = Date.now()
  const res = await spawnText(dsh, ['--profile', 'e2e', prompt], { cwd: workspace })
  const sent = requests.slice(before)
  const calls = toolCalls(sent)
  const names = calls.map((c) => c.name)
  const started = names.indexOf('run_deep_analysis')
  const analystAt = calls.findIndex((c) => (c.name === 'skill' && /longevity-analyst/.test(c.args)) || /la\.py/.test(c.args))
  const laRan = existsSync(trace) ? readFileSync(trace, 'utf8').trim() : ''
  const lastAsk = sent.length ? Math.round((Math.max(...sent.map((q) => q.__at ?? 0)) - startedAt) / 1000) : null
  return { label, status: res.status, reply: (res.stdout || '').trim(), stderr: (res.stderr || '').slice(-2000), names, started, analystAt, laRan, sent, seconds: Math.round((Date.now() - startedAt) / 1000), lastAsk }
}

if (noKey) {
  const boot = execFileSync(dsh, ['--profile', 'e2e', '--dump-config'], { env, encoding: 'utf8' })
  console.log(/== dsh-plugin-longpi/.test(boot) ? 'boot: LongPi row composed' : `boot: LongPi row missing\n${boot.slice(-1500)}`)
  const once = await spawnText(dsh, ['--profile', 'e2e', '你好'], { cwd: workspace, timeout: 120_000 })
  console.log(`headless exit ${once.status}\n--- stderr (tail)\n${(once.stderr || '').slice(-2500)}\n--- stdout\n${(once.stdout || '').slice(-800)}`)
  console.log(`DSH_HOME kept at ${home}`)
  process.exit(0)
}

const results = []
const PROMPT = '我的全基因组和甲基化检测都做完了，帮我做一次深度分析吧，现在就开始。'
if (only !== 'holder') {
  lib.setActive(data, lib.DEMO_ID)
  results.push(await converse('demo profile (LongPi refuses to start)', PROMPT))
}
if (only !== 'demo') {
  lib.setActive(data, lib.SELF)
  results.push(await converse('account holder', PROMPT))
}

const textOf = (m) => (typeof m?.content === 'string' ? m.content : JSON.stringify(m?.content ?? ''))
let failed = 0
for (const r of results) {
  const checks = []
  const check = (ok, what) => { checks.push([ok, what]); if (!ok) failed += 1 }
  const chat = r.sent.find((req) => (req.tools ?? []).some((t) => t.function?.name === 'run_deep_analysis'))
  if (fake) {
    // what DSH sent the model: Pi's persona, the snapshot with Pi's lines, LongPi's tools, the two skills
    const system = (chat?.messages ?? []).filter((m) => m.role === 'system').map(textOf).join('\n')
    const all = (chat?.messages ?? []).map(textOf).join('\n')
    const tools = (chat?.tools ?? []).map((t) => t.function?.name)
    check(Boolean(chat), 'a chat request carried LongPi\'s tools')
    check(/You are Pi, the longevity coach of LongPi/.test(system), 'the system prompt speaks as Pi')
    check(/longevity-coach/.test(all) && /longevity-analyst/.test(all), 'both skills are listed to the model')
    check(['import_member_file', 'remember_for_me', 'read_deep_analysis'].every((n) => tools.includes(n)), 'the new and changed tools are registered')
    if (r.label.startsWith('demo')) check(/想要的画面：70 岁还能带孙子爬泰山/.test(all) && /在做的小承诺：当工作日在家做晚饭时/.test(all), 'the page snapshot opens with Pi\'s lines')
  }
  // LongPi's answer to the start: a run it began (ok true with the prompt and the member id), DSH's approval (headless has
  // no channel to ask on), or a refusal. Error JSON carries "ok" too, so only "ok": true with prompt_zh counts as a start.
  const answer = r.sent.flatMap((req) => req.messages ?? []).filter((m) => m.role === 'tool').map(textOf).join('\n')
  const startedRun = /"ok":\s*true/.test(answer) && /prompt_zh/.test(answer)
  const approval = /requires approval|approval channel|批准|审批/i.test(answer)
  check(r.started >= 0, 'the model called run_deep_analysis')
  check(!(r.analystAt >= 0 && (r.started < 0 || r.analystAt < r.started)), 'the analyst was not loaded and la.py not run before LongPi\'s tool answered')
  if (!startedRun) check(r.analystAt < 0 && !r.laRan, 'with no start from LongPi, the model did not go to the analyst and la.py did not run')
  if (r.label.startsWith('demo')) check(/示例档案/.test(answer) && !startedRun, 'LongPi refused to start on the demo profile')
  else check((startedRun && /lp-me/.test(answer)) || (!startedRun && approval), 'LongPi took the holder\'s start (a run as lp-me, or the approval DSH asks for)')
  if (fake) check(r.names.every((n) => n === 'run_deep_analysis'), 'the scripted model called only run_deep_analysis')
  const ok = checks.every(([pass]) => pass)
  console.log(`\n${ok ? 'PASS' : 'FAIL'} ${r.label}`)
  for (const [pass, what] of checks) console.log(`  ${pass ? 'ok ' : 'NO '} ${what}`)
  console.log(`  tool calls: ${r.names.join(' → ') || '(none)'}; la.py ran: ${r.laRan ? r.laRan.replace(/\n/g, ' | ') : 'no'}; last model request at ${r.lastAsk} s, exit at ${r.seconds} s (status ${r.status})`)
  console.log(`  reply: ${r.reply.replace(/\s+/g, ' ').slice(0, 400)}`)
  if (r.status !== 0) console.log(`  dsh exit ${r.status}: ${r.stderr.replace(/\s+/g, ' ').slice(-600)}`)
}
server?.close()
if (keep && fake) writeFileSync(join(root, 'requests.json'), JSON.stringify(requests, null, 1))
if (keep) console.log(`\nkept: ${root}`)
else rmSync(root, { recursive: true, force: true })
process.exit(failed ? 1 : 0)
