// Build the bundled demo profile (示例档案): a fictional member, 李明华 (male, 58, Hangzhou), whose data are synthetic
// or rewritten public data and match no real person. Writes two assets the plugin ships:
//   src/demo/assets/record.json  — what the demo Mirobody serves: checkup labs (2025 and 2026) and 90 watch days
//   src/demo/assets/store.json   — the LongPi store as it is after onboarding, a deep analysis and an accepted plan
// Usage: node scripts/build-demo.mjs <member_dir> <labs2026.csv> <store_dir>
// Dates stay as recorded; the plugin shifts them to today when the demo is opened (src/demo/index.ts).

import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs'
import { join, relative } from 'node:path'

const [memberDir, labs26Path, storeDir] = process.argv.slice(2)
if (!memberDir || !labs26Path || !storeDir) {
  console.error('usage: node scripts/build-demo.mjs <member_dir> <labs2026.csv> <store_dir>')
  process.exit(2)
}
const out = new URL('../src/demo/assets/', import.meta.url).pathname
mkdirSync(out, { recursive: true })

function csv(path) {
  const [head, ...lines] = readFileSync(path, 'utf8').trim().split(/\r?\n/)
  const keys = head.split(',')
  return lines.map((line) => Object.fromEntries(line.split(',').map((value, i) => [keys[i], value])))
}

const observations = []
const add = (indicator, value, date, time, unit, file) => {
  if (value === undefined || value === '') return
  observations.push({ indicator, name: indicator, system: '', code: '', unit, date, time: `${date} ${time}`, value: String(value), file })
}
const DAY26 = '2026-09-10'
for (const row of csv(labs26Path)) add(row.marker, row.value, DAY26, '08:00:00', row.unit, '2026年度健康体检报告_检验与体格检查.pdf')
for (const name of readdirSync(memberDir).filter((f) => f.includes('化验') && f.endsWith('.csv'))) {
  for (const row of csv(join(memberDir, name))) add(row['项目'], row['结果'], row['采样日期'], '08:00:00', row['单位'], name)
}
const WATCH = { 步数: ['dailySteps', 'count'], 静息心率: ['restingHeartRate', 'bpm'], HRV_RMSSD_ms: ['hrvRmssd', 'ms'], 睡眠时长_小时: ['sleepDuration', 'h'], 血氧_最低: ['spo2Min', '%'] }
for (const name of readdirSync(memberDir).filter((f) => f.includes('手表') && f.endsWith('.csv'))) {
  for (const row of csv(join(memberDir, name))) {
    for (const [col, [indicator, unit]] of Object.entries(WATCH)) add(indicator, row[col], row['日期'], '23:59:00', unit, name)
  }
}
const record = { tz: 'Asia/Shanghai', today: '2026-09-30', observations, medications: { plans: [], log: [], history: [] } }
writeFileSync(join(out, 'record.json'), `${JSON.stringify(record)}\n`)

// The store: only what a person's LongPi holds after onboarding, a deep analysis and an accepted plan. No logs, no
// in-flight analysis run, no local paths.
const KEEP = [/^profile\.json$/, /^privacy\/consents\.jsonl$/, /^interventions\/plan\.jsonl$/, /^analysis\/current\/(meta\.json|la-export\.json|report\.html)$/, /^runs\/[^/]+\/out\//, /^memory\.json$/]
function walk(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    return statSync(path).isDirectory() ? walk(path) : [path]
  })
}
const files = {}
// Only the newest run per method (the method library keeps every run).
const runs = readdirSync(join(storeDir, 'runs')).sort()
const newestRun = new Map()
for (const run of runs) newestRun.set(run.replace(/^\d+-/, ''), run)
for (const path of walk(storeDir)) {
  const rel = relative(storeDir, path)
  if (!KEEP.some((re) => re.test(rel))) continue
  if (rel.startsWith('runs/') && !newestRun.has(rel.split('/')[1].replace(/^\d+-/, '')) ) continue
  if (rel.startsWith('runs/') && newestRun.get(rel.split('/')[1].replace(/^\d+-/, '')) !== rel.split('/')[1]) continue
  let text = readFileSync(path, 'utf8')
  // No machine paths in a shipped asset.
  text = text.replace(/\/(?:private\/)?(?:tmp|var|Users)\/[^"'\s<>]*/g, '')
  files[rel] = text
}
// A complete profile: product notice accepted, the six China-PAR facts from the questionnaire, a name and a focus.
const profile = JSON.parse(files['profile.json'])
Object.assign(profile, {
  displayName: '李明华',
  risk: { smoker: false, diabetes: false, bp_treated: false, north: false, urban: true, family_history: true },
  focus: ['bioage', 'cardio', 'sleep'],
  consent: { version: '2026-09-24', accepted_at: '2026-09-30T10:00:00.000Z' },
})
files['profile.json'] = `${JSON.stringify(profile, null, 2)}\n`
writeFileSync(join(out, 'store.json'), `${JSON.stringify({ anchor: '2026-09-30', files })}\n`)
console.log(JSON.stringify({ observations: observations.length, files: Object.keys(files).length, bytes: JSON.stringify(files).length }))
