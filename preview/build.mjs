// Page preview with demo data: the real plugin code (records, self
// measurements, tracking, journey, skills) against the fake Mirobody record,
// rendered by the built lib/client.js in a plain page. No DeepSeek Harness needed.
//
//   npm run build && node preview/build.mjs && python3 -m http.server 4173 -d preview/out
//
// Needs a longevity-skills checkout next to this repo (or LONGEVITY_SKILLS_HOME).

import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { startFakeMirobody } from '../test/fake-mirobody.mjs'

const here = dirname(fileURLToPath(import.meta.url))
const out = join(here, 'out')
const home = mod.resolveSkillsHome(process.env.LONGEVITY_SKILLS_HOME || resolve(here, '..', '..', 'longevity-skills'))
if (!home) throw new Error('no longevity-skills checkout found')
const TODAY = '2026-09-24'

const dataDir = mkdtempSync(join(tmpdir(), 'longpi-preview-'))
const server = await startFakeMirobody()
try {
  const config = {
    mcpUrl: server.url, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6,
  }
  mod.writeProfile(dataDir, {
    displayName: '陈明', birthYear: 1972, age: 53, sex: 'male',
    risk: { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false },
    focus: ['bioage', 'cardio'], consent: null,
  })
  mod.setConsent(dataDir, true, new Date(`${TODAY}T09:00:00+08:00`))
  // A tape-measure waist and a week of home blood pressure, entered by the person.
  const selfEntries = [{ key: 'waist', value: 88, unit: 'cm', date: mod.addDays(TODAY, -2) }]
  const cuff = [[128, 82], [124, 80], [131, 84], [126, 81], [122, 79], [127, 83], [125, 80]]
  cuff.forEach(([sbp, dbp], index) => {
    const date = mod.addDays(TODAY, index - 6)
    selfEntries.push({ key: 'sbp', value: sbp, date }, { key: 'dbp', value: dbp, date })
  })
  const self = mod.addSelf(dataDir, selfEntries, { today: TODAY, now: new Date(`${TODAY}T09:00:00+08:00`) })
  if (self.problems.length > 0) throw new Error(self.problems.join('; '))
  mod.invalidateRecords()
  const records = await mod.loadRecords(config, dataDir, '/nonexistent/plugin')
  const plan = mod.normalizePlan({
    title: '2025 秋季方案',
    items: [
      { category: 'diet', title: '地中海饮食', detail: '橄榄油、深海鱼、坚果和全谷物，少红肉', start: '2025-10-20', markers: ['hs-CRP', '甘油三酯', '空腹血糖'] },
      { category: 'exercise', title: '每天快走 8000 步', start: '2026-01-05', target: { metric: 'dailySteps', op: '>=', value: 8000, unit: 'count' }, markers: ['糖化血红蛋白', '收缩压'] },
      { category: 'supplement', title: '鱼油', start: '2026-03-01', medication: '鱼油', markers: ['甘油三酯'] },
      { category: 'sleep', title: '23 点前睡、睡够 7 小时', start: '2026-09-18', target: { metric: 'dailyTotalSleepTime', op: '>=', value: 7, unit: 'hours' }, markers: ['超敏C反应蛋白'] },
    ],
    goals: [{ marker: '空腹血糖', value: 5.0, unit: 'mmol/L' }, { marker: 'hs-CRP', value: 1.0, unit: 'mg/L' }, { marker: '收缩压', value: 120, unit: 'mmHg' }],
  }, { today: TODAY, medications: records.medications.map((row) => ({ name: row.name, plan_id: row.plan_id })), previous: null })
  mod.savePlan(dataDir, plan.plan)
  const entries = []
  for (let back = 83; back >= 1; back -= 1) {
    const date = mod.addDays(TODAY, -back)
    const roll = (back * 37) % 10
    if (roll < 7) entries.push({ item: '地中海饮食', date, done: true })
    else if (roll < 8) entries.push({ item: '地中海饮食', date, done: false, note: '外食' })
  }
  mod.addCheckIns(dataDir, entries, { today: TODAY, source: 'chat' })

  const catalog = mod.loadCatalog(home)
  const mount = { mounted: true, pluginHome: '', peer: false, error: '' }
  const tracking = await mod.buildTracking({ config, dataDir, skillsHome: home, catalog, records, today: TODAY })
  const journey = await mod.buildJourney({ config, dataDir, skillsHome: home, catalog, records, today: TODAY, mount })
  const selfRows = { rows: mod.readSelf(dataDir).reverse() }
  const outputs = mod.latestOutputs(dataDir)
  const board = {
    ...mod.buildBoard({ catalog, records, mount, receipts: mod.readReceipts(dataDir, 5), limit: 6, outputs }),
    readiness: mod.readiness(catalog, records, outputs),
    today: TODAY,
  }
  mkdirSync(out, { recursive: true })
  const client = join(here, '..', 'lib', 'client.js')
  copyFileSync(client, join(out, 'client.js'))
  const template = readFileSync(join(here, 'index.html'), 'utf8')
  const payload = JSON.stringify({ board, tracking, journey, self: selfRows }).replace(/</g, '\\u003c')
  writeFileSync(join(out, 'index.html'), template.replace('/*__DATA__*/null', payload))
  writeFileSync(join(out, 'board.json'), `${JSON.stringify(board, null, 1)}\n`)
  writeFileSync(join(out, 'tracking.json'), `${JSON.stringify(tracking, null, 1)}\n`)
  writeFileSync(join(out, 'journey.json'), `${JSON.stringify(journey, null, 1)}\n`)
  writeFileSync(join(out, 'self.json'), `${JSON.stringify(selfRows, null, 1)}\n`)
  console.log(`preview written to ${out} (${tracking.items.length} items, phenotypic age at ${tracking.bioage.points.length} checkups, stage ${journey.stage})`)
} finally {
  await server.close()
  rmSync(dataDir, { recursive: true, force: true })
}
