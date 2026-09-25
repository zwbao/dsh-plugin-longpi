// Intervention tracking end to end: a plan saved after a read-back, check-ins,
// the fake Mirobody record (four checkups, wearables, a dose log), and the real
// longevity-skills checkout for phenotypic age, noise bands and trial effects.
// Needs ../../longevity-skills (or LONGEVITY_SKILLS_HOME); skips without it.

import assert from 'node:assert/strict'
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as mod from '../lib/index.js'
import { startFakeMirobody } from './fake-mirobody.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const sibling = resolve(root, '..', '..', 'longevity-skills')
const home = mod.resolveSkillsHome(existsSync(join(sibling, 'data', 'biological_variation.json')) ? sibling : '')
if (!home || !existsSync(join(home, 'data', 'biological_variation.json'))) {
  console.log('interventions skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const dataDir = mkdtempSync(join(tmpdir(), 'longpi-interventions-'))
const server = await startFakeMirobody()
try {
  const config = {
    mcpUrl: server.url, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home,
  }
  const facts = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
  mod.writeProfile(dataDir, { displayName: '陈明', birthYear: 1972, age: 53, sex: 'male', risk: facts })
  mod.invalidateRecords()
  const records = await mod.loadRecords(config, dataDir, '/nonexistent/plugin')
  assert.equal(records.record_status, 'ok', records.record_error)

  // 1. a plan is checked and read back; nothing is written until it is saved
  const raw = {
    title: '2025 秋季方案',
    items: [
      { category: 'diet', title: '地中海饮食', detail: '橄榄油、鱼、坚果', start: '2025-10-20', markers: ['hs-CRP', '甘油三酯', '空腹血糖'] },
      { category: 'exercise', title: '快走', start: '2026-01-05', target: { metric: 'dailySteps', op: '>=', value: 8000, unit: 'count' }, markers: ['糖化血红蛋白', '收缩压'] },
      { category: 'supplement', title: '鱼油', detail: '每天 2 粒，早餐后', start: '2026-03-01', medication: '鱼油', markers: ['甘油三酯'] },
      { category: 'sleep', title: '早睡', start: '2026-09-18', target: { metric: 'dailyTotalSleepTime', op: '>=', value: 7, unit: 'hours' }, markers: ['超敏C反应蛋白'] },
      { category: 'behavior', title: '减少久坐', start: '2026-02-01', markers: ['腰围'] },
    ],
    goals: [{ marker: '空腹血糖', value: 5.0, unit: 'mmol/L' }, { marker: 'hs-CRP', value: 1.0, unit: 'mg/L' }, { marker: '收缩压', value: 120, unit: 'mmHg' }],
  }
  const normalized = mod.normalizePlan(raw, {
    today: TODAY,
    medications: records.medications.map((row) => ({ name: row.name, plan_id: row.plan_id })),
    previous: null,
  })
  assert.deepEqual(normalized.errors, [])
  const fish = normalized.plan.items.find((item) => item.title === '鱼油')
  assert.equal(fish.mirobody.medication, '鱼油(Omega-3)', 'a supplement is linked to the Mirobody plan by name')
  assert.equal(fish.mirobody.plan_id, 'p-fishoil')
  assert.doesNotMatch(fish.detail, /2\s*粒/, 'the dose is not stored')
  assert.ok(normalized.warnings.some((line) => line.includes('剂量没有保存')))
  assert.equal(mod.currentPlan(dataDir), null, 'checking a plan writes nothing')
  const missingDate = mod.normalizePlan({ items: [{ category: 'diet', title: '少糖' }] }, { today: TODAY, medications: [], previous: null })
  assert.ok(missingDate.errors.some((line) => line.includes('开始日期')))
  const saved = mod.savePlan(dataDir, normalized.plan)
  assert.equal(saved.version, 1)

  // 2. check-ins; a supplement is logged in Mirobody, not here
  const checkin = mod.addCheckIns(dataDir, [
    { item: '地中海饮食', date: '2026-09-20', done: true },
    { item: '地中海饮食', date: '2026-09-21', done: true, tags: ['travel'], note: '出差' },
    { item: '鱼油', date: '2026-09-21', done: true },
    { item: '不存在的项目', done: true },
  ], { today: TODAY, source: 'chat' })
  assert.equal(checkin.saved.length, 2)
  assert.ok(checkin.problems.some((line) => line.includes('Mirobody')))
  assert.ok(checkin.problems.some((line) => line.includes('不存在的项目')))
  assert.equal(mod.preGuard('帮我记录今天快走40分钟，鱼油也吃了'), null, 'a check-in is not a medication question')

  // 3. judge the plan against the record
  const catalog = mod.loadCatalog(home)
  const tracking = await mod.buildTracking({ config, dataDir, skillsHome: home, catalog, records, today: TODAY })
  assert.equal(tracking.status, 'ok', tracking.errors.join('; '))
  const byItem = Object.fromEntries(tracking.items.map((item) => [item.title, item]))
  const verdict = (title, marker) => byItem[title].verdicts.find((row) => row.marker === marker || row.marker.includes(marker))

  const crp = verdict('地中海饮食', 'C反应蛋白')
  assert.equal(crp.baseline.value, 4.2)
  assert.equal(crp.followup.value, 1.2)
  // Beyond the band toward the goal, but two check-ins in twelve weeks say nothing about the plan (7a).
  assert.equal(crp.verdict, '无法判断', crp.reason_zh)
  assert.equal(crp.direction, 'improved')
  assert.match(crp.reason_zh, /^执行记录太少/)
  assert.match(crp.reason_zh, /朝目标变化，超出正常波动/)
  assert.doesNotMatch(crp.reason_zh, /真实的改善/)
  // Log-normal band from the table's own CRP row (CVA defaults to half of CVI).
  const crpRow = JSON.parse(readFileSync(join(home, 'data', 'biological_variation.json'), 'utf8')).markers.find((row) => row.key === 'crp')
  const cvi = crpRow.cvi_pct / 100
  const cva = (crpRow.cva_pct ?? crpRow.cvi_pct * 0.5) / 100
  const expectedDown = 100 * (Math.exp(-1.96 * Math.SQRT2 * Math.sqrt(Math.log(1 + cvi * cvi) + Math.log(1 + cva * cva))) - 1)
  assert.ok(Math.abs(crp.band.down_pct - expectedDown) < 0.5, `CRP band ${crp.band.down_pct} vs ${expectedDown.toFixed(1)}`)
  assert.ok(crp.band.down_pct < -50 && crp.band.down_pct > -70, `CRP band ${crp.band.down_pct}`)
  assert.ok(crp.expected.some((row) => row.id === 'mediterranean-hscrp'), 'the trial average for this diet and marker is shown')

  const glucose = verdict('地中海饮食', '空腹血糖')
  assert.equal(glucose.verdict, '波动内', `6.1 → 5.4 is inside the ~15% band: ${glucose.reason_zh}`)

  const tg = verdict('鱼油', '甘油三酯')
  assert.ok(tg.combined_with.includes('地中海饮食'), 'two items aimed at triglycerides at once')

  const hba1c = verdict('快走', '糖化血红蛋白')
  assert.equal(hba1c.verdict, '有效', hba1c.reason_zh)
  assert.equal(hba1c.baseline.date, '2025-10-18')
  assert.ok(hba1c.followup.date >= '2026-04-05', 'HbA1c is retested at least 90 days after the start')

  // Home BP is judged only on means over seven days at each end (6d); the cuff here reads every third day.
  const sbp = verdict('快走', '收缩压')
  assert.equal(sbp.verdict, '无法判断', sbp.reason_zh)
  assert.match(sbp.reason_zh, /需要连续 7 天的家庭血压/)
  assert.equal(sbp.followup, null, 'no follow-up mean from three days of readings')

  const early = verdict('早睡', 'C反应蛋白')
  assert.equal(early.verdict, '无法判断')
  assert.equal(early.next_retest, '2026-10-02')

  const waist = byItem['减少久坐'].verdicts[0]
  assert.equal(waist.verdict, '无法判断')
  assert.equal(waist.indicator, null)

  assert.equal(byItem['快走'].adherence.source, 'wearable')
  assert.ok(byItem['快走'].adherence.rate > 0.3 && byItem['快走'].adherence.rate < 1)
  assert.equal(byItem['鱼油'].adherence.source, 'dose_log')
  assert.equal(byItem['鱼油'].adherence.level, 'good')
  assert.equal(byItem['地中海饮食'].adherence.source, 'check_in')

  assert.ok(tracking.suggestions.some((row) => row.kind === 'missing_marker'), 'the missing waist measurement is a next step')
  assert.ok(tracking.suggestions.some((row) => row.kind === 'retest'))
  for (const row of tracking.suggestions) assert.doesNotMatch(row.text_zh, /\d+\s*(mg|毫克|粒|片)/, 'no dose in a suggestion')

  // 4. phenotypic age at every checkup, with a noise band from the skill's own slopes
  assert.equal(tracking.bioage.status, 'ok', tracking.bioage.note_zh)
  assert.equal(tracking.bioage.points.length, 4)
  assert.deepEqual(tracking.bioage.points.map((row) => row.date), ['2025-10-18', '2026-01-20', '2026-04-22', '2026-08-26'])
  assert.ok(tracking.bioage.points.every((row) => row.mortality_10y_pct > 0 && row.mortality_10y_pct < 100))
  assert.ok(tracking.bioage.band_years > 0.3 && tracking.bioage.band_years < 10, `band ${tracking.bioage.band_years}`)
  assert.ok(tracking.bioage.band_missing.length >= 1, 'inputs with no published variation are named')
  const first = tracking.bioage.points[0]
  const last = tracking.bioage.points.at(-1)
  assert.ok(last.advance < first.advance, 'phenotypic age advance falls as the labs improve')

  // 5. model cards: the phenotypic-age goal is computed by the skill; China-PAR waits for verified coefficients
  const pheno = tracking.models.find((card) => card.model === 'phenoage')
  assert.equal(pheno.status, 'ok')
  assert.ok(pheno.goal.phenoage < pheno.now.phenoage)
  assert.ok(pheno.levers.length === 2 && pheno.levers.every((row) => row.years < 0))
  assert.match(pheno.boundary_zh, /模型估计/)
  const risk = tracking.models.find((card) => card.model === 'china-par')
  assert.equal(risk.status, 'ok', risk.note_zh)
  assert.ok(risk.now.risk_pct > 0 && risk.now.risk_pct < 30, `risk ${risk.now.risk_pct}`)
  assert.ok(risk.goal.risk_pct < risk.now.risk_pct, 'a lower blood-pressure goal lowers the modelled risk')
  assert.ok(['低危', '中危', '高危'].includes(risk.category_zh.now))
  assert.equal(risk.levers.length, 1)
  assert.match(risk.levers[0].from, /mmHg/, 'the lever is shown in the units of the record')
  assert.match(risk.boundary_zh, /模型估计/)

  // 6. a marker that got worse beyond noise
  const reverse = mod.evaluateMarker(
    { id: 'x', category: 'diet', title: '生酮饮食', detail: '', start: '2026-01-01', end: null, frequency: null, target: null, markers: ['LDL-C'], mirobody: null },
    { asked: 'LDL-C', label: '低密度脂蛋白胆固醇', indicator: 'LDL', unit: 'mmol/L', biovar: mod.loadReference(home).biovar.markers.find((row) => row.key === 'ldl') },
    {
      plan: { items: [] }, today: TODAY, markers: {}, series: { LDL: [{ date: '2025-12-20', time: '', value: 3.0, unit: 'mmol/L' }, { date: '2026-03-01', time: '', value: 3.9, unit: 'mmol/L' }] },
      adherence: {}, courses: [], checkins: [], biovar: mod.loadReference(home).biovar, effects: [],
    },
  )
  assert.equal(reverse.verdict, '反向', reverse.reason_zh)

  // 7. what-if goals without saving them
  const whatIf = await mod.modelGoals({ config, dataDir, skillsHome: home, catalog, records, today: TODAY }, [{ marker: '超敏C反应蛋白', value: 0.5, unit: 'mg/L' }])
  const card = whatIf.models.find((row) => row.model === 'phenoage')
  assert.equal(card.levers.length, 1)
  assert.equal(mod.readPlans(dataDir).length, 1, 'a what-if does not change the saved plan')

  // without the stated yes/no facts the risk card says what is missing instead of guessing
  mod.writeProfile(dataDir, { displayName: '陈明', birthYear: 1972, age: 53, sex: 'male', risk: { north: true } })
  mod.invalidateRecords()
  const unstated = await mod.modelGoals({ config, dataDir, skillsHome: home, catalog, records: await mod.loadRecords(config, dataDir, '/nonexistent/plugin'), today: TODAY }, [])
  const blank = unstated.models.find((row) => row.model === 'china-par')
  assert.equal(blank.status, 'unavailable')
  assert.ok(blank.missing.includes('现在吸烟') && !blank.missing.includes('住在北方（长江以北）'))
  const merged = mod.mergeProfile(mod.readProfile(dataDir), { risk: { smoker: true, north: null } })
  assert.deepEqual(mod.normalizeProfile(merged).profile.risk, { smoker: true }, 'a partial update keeps other fields and clears a null')

  // the history keeps one phenotypic age per checkup date
  const history = readFileSync(join(dataDir, 'history.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line))
  assert.ok(history.every((row) => row.skill !== 'accelerated-biological-aging-risk' || row.measured_at))
  console.log(`interventions ok (${tracking.items.length} items, ${tracking.items.flatMap((item) => item.verdicts).length} verdicts, phenotypic age at ${tracking.bioage.points.length} checkups, band ±${tracking.bioage.band_years.toFixed(1)} y)`)
} finally {
  await server.close()
  rmSync(dataDir, { recursive: true, force: true })
}
