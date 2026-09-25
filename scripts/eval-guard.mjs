// Evaluate the guard's input classifier on test/guard-cases.json: precision and recall per label.
// Not part of `npm test`; it runs only when you run it. Cases tagged reply are replies for the output check
// (test/guard.mjs), not messages a person sends, so neither the rules nor the classifier are scored on them.
//
//   npm run build
//   node scripts/eval-guard.mjs --rules-only          # the rule layer alone (what runs when the model fails); no network
//   DEEPSEEK_API_KEY=… node scripts/eval-guard.mjs     # the classifier on your own DeepSeek model
//
// The live run boots DeepSeek Harness's own LLM runtime in this process (Cordis + @deepseek-ai/dsh-llm +
// @deepseek-ai/dsh-llm-deepseek, from your DSH install) and sends each case through the same call the plugin
// makes in a chat: the same system prompt, temperature 0, reasoning off, the 4 s deadline, and the rules when
// a call fails. Options:
//   --provider deepseek-official   provider route (default: agent-default-model in $DSH_HOME/settings.yaml, else deepseek-official)
//   --model deepseek-v4-flash      model id (default: from settings.yaml, else deepseek-v4-flash)
//   --dsh <dir>                    the @deepseek-ai folder of your DSH install (default: $DSH_HOME/profiles/node_modules/@deepseek-ai)
//   --timeout 4000                 per-call deadline in ms
//   --limit N                      only the first N cases
//   --verbose                      print every case the classifier got wrong
// Each case costs one short model call. Message texts are the synthetic cases in the repository, nothing personal.

import { existsSync, readFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const flag = (name) => args.includes(`--${name}`)
const option = (name, fallback) => {
  const index = args.indexOf(`--${name}`)
  return index >= 0 && args[index + 1] ? args[index + 1] : fallback
}

const mod = await import(pathToFileURL(join(root, 'lib', 'index.js')).href)
const { cases: allCases } = JSON.parse(readFileSync(join(root, 'test', 'guard-cases.json'), 'utf8'))
const inputCases = allCases.filter((item) => !(item.tags ?? []).includes('reply'))
const cases = inputCases.slice(0, Number(option('limit', inputCases.length)))
const skipped = allCases.length - inputCases.length
const KEYS = mod.LABEL_KEYS

function score(results) {
  const rows = []
  for (const key of KEYS) {
    let tp = 0
    let fp = 0
    let fn = 0
    for (const { item, labels } of results) {
      const want = item.labels.includes(key)
      if (labels[key] && want) tp += 1
      else if (labels[key]) fp += 1
      else if (want) fn += 1
    }
    const precision = tp + fp > 0 ? tp / (tp + fp) : null
    const recall = tp + fn > 0 ? tp / (tp + fn) : null
    rows.push({ label: key, positives: tp + fn, tp, fp, fn, precision, recall })
  }
  return rows
}

function printScores(title, rows) {
  const pct = (value) => (value === null ? '   —' : `${(value * 100).toFixed(1).padStart(5)}%`)
  console.log(`\n${title}`)
  console.log('label                   positives   tp   fp   fn  precision  recall')
  for (const row of rows) {
    console.log(`${row.label.padEnd(24)}${String(row.positives).padStart(9)}${String(row.tp).padStart(5)}${String(row.fp).padStart(5)}${String(row.fn).padStart(5)}  ${pct(row.precision).padStart(9)}  ${pct(row.recall).padStart(6)}`)
  }
}

function printMisses(results) {
  for (const { item, labels, source } of results) {
    const wrong = KEYS.filter((key) => labels[key] !== item.labels.includes(key))
    if (wrong.length > 0) console.log(`  [${source}] ${wrong.map((key) => `${labels[key] ? '+' : '-'}${key}`).join(' ')}  ${item.text}`)
  }
}

const rulesResults = cases.map((item) => ({ item, labels: mod.ruleLabels(item.text), source: 'rules' }))
printScores(`Rule layer alone (${cases.length} cases${skipped ? `; ${skipped} replies for the output check left out` : ''})`, score(rulesResults))
if (flag('rules-only')) {
  if (flag('verbose')) printMisses(rulesResults)
  process.exit(0)
}

// --- the live classifier through DSH's own runtime -------------------------------------------------
const dshHome = process.env.DSH_HOME || join(homedir(), '.dsh')
const modules = option('dsh', join(dshHome, 'profiles', 'node_modules', '@deepseek-ai'))
for (const pkg of ['cordis', 'dsh-llm', 'dsh-llm-deepseek']) {
  if (!existsSync(join(modules, pkg, 'package.json'))) {
    console.error(`\nCannot find ${pkg} under ${modules}. Pass --dsh <the @deepseek-ai folder of your DeepSeek Harness install>.`)
    process.exit(2)
  }
}
const load = async (pkg) => {
  const manifest = JSON.parse(readFileSync(join(modules, pkg, 'package.json'), 'utf8'))
  const entry = typeof manifest.exports?.['.'] === 'object' ? manifest.exports['.'].default ?? manifest.exports['.'].import : manifest.main
  return import(pathToFileURL(join(modules, pkg, entry ?? 'lib/index.js')).href)
}

function settingsRoute() {
  const path = join(dshHome, 'settings.yaml')
  if (!existsSync(path)) return {}
  const lines = readFileSync(path, 'utf8').split(/\r?\n/)
  const start = lines.findIndex((line) => /^agent-default-model:\s*$/.test(line))
  if (start < 0) return {}
  const route = {}
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line)) break
    const match = line.match(/^\s+(provider|model):\s*["']?([^"'#\s]+)["']?/)
    if (match) route[match[1]] = match[2]
  }
  return route
}

if (!process.env.DEEPSEEK_API_KEY) {
  console.error('\nDEEPSEEK_API_KEY is not set: the live run needs your DeepSeek API key in the environment (the key DSH uses; the Models page stores it for DSH only).')
  process.exit(2)
}

const saved = settingsRoute()
const route = { provider: option('provider', saved.provider ?? 'deepseek-official'), model: option('model', saved.model ?? 'deepseek-v4-flash') }
const timeoutMs = Number(option('timeout', mod.GUARD_TIMEOUT_MS))
const { Context } = await load('cordis')
const { LlmRuntime } = await load('dsh-llm')
const deepseek = await load('dsh-llm-deepseek')
const app = new Context()
await app.plugin(LlmRuntime)
await app.plugin(deepseek, {})
const llm = app.get('llm')
if (!llm) {
  console.error('\nThe DSH LLM runtime did not start.')
  process.exit(2)
}
console.log(`\nClassifier on ${route.provider}/${route.model}, ${timeoutMs} ms deadline, ${cases.length} cases…`)
const call = mod.runtimeCall(llm, route)
const liveResults = []
const times = []
let fallbacks = 0
let lastError = ''
for (const item of cases) {
  const started = Date.now()
  const result = await mod.classifyMessage(item.text, { call, timeoutMs })
  times.push(Date.now() - started)
  if (result.source !== 'llm') {
    fallbacks += 1
    lastError = result.error ?? lastError
  }
  liveResults.push({ item, labels: result.labels, source: result.source })
  process.stdout.write(result.source === 'llm' ? '.' : 'r')
}
process.stdout.write('\n')
times.sort((a, b) => a - b)
const quantile = (q) => times[Math.min(times.length - 1, Math.floor(q * times.length))] ?? 0
printScores(`Classifier, with the rules when a call failed (${fallbacks} of ${cases.length} fell back${lastError ? `; last error: ${lastError.slice(0, 160)}` : ''})`, score(liveResults))
const answered = liveResults.filter((row) => row.source === 'llm')
if (answered.length > 0 && answered.length < liveResults.length) printScores(`Classifier answers only (${answered.length} cases)`, score(answered))
console.log(`\nlatency p50 ${quantile(0.5)} ms, p95 ${quantile(0.95)} ms`)
if (flag('verbose')) printMisses(liveResults)
await app.dispose?.()
process.exit(0)
