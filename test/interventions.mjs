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
import { startFlakyMirobody } from './flaky-mirobody.mjs'

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

  // 腰围 has no variation row: it is found under its report name, compared, and not judged against a band
  const waist = byItem['减少久坐'].verdicts[0]
  assert.equal(waist.verdict, '无法判断')
  assert.equal(waist.indicator, 'Waist Circumference-WC')
  assert.match(waist.reason_zh, /缺少腰围的个体内变异数据/)

  assert.equal(byItem['快走'].adherence.source, 'wearable')
  assert.ok(byItem['快走'].adherence.rate > 0.3 && byItem['快走'].adherence.rate < 1)
  assert.equal(byItem['鱼油'].adherence.source, 'dose_log')
  assert.equal(byItem['鱼油'].adherence.level, 'good')
  assert.equal(byItem['地中海饮食'].adherence.source, 'check_in')

  assert.equal(tracking.suggestions.some((row) => row.kind === 'missing_marker'), false, 'waist is on file: no test to add')
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
  // --- 5.1: verdicts in one unit, on known adherence, never credited to an item (6a–6d, 7a–7d) ---------------
  const bv = mod.loadReference(home).biovar
  const rowOf = (key) => bv.markers.find((marker) => marker.key === key)
  const itemOf = (id, title, markers, start = '2026-01-01') => ({ id, category: 'diet', title, detail: '', start, end: null, frequency: null, target: null, markers, mirobody: null })
  const followed = { source: 'check_in', rate: 0.9, coverage: 0.9, known_days: 80, done_days: 72, window_days: 84, level: 'good', streak: 5, calendar: [], note_zh: '' }
  const at = (date, value, unit) => ({ date, time: `${date} 08:00:00`, value, unit })
  const judge = (item, marker, points, extra = {}) => mod.evaluateMarker(item, marker, {
    plan: { items: [item] }, today: TODAY, markers: {}, series: { [marker.indicator]: points }, adherence: { [item.id]: followed },
    courses: [], checkins: [], biovar: bv, effects: [], ...extra,
  })
  const glucoseMarker = { asked: '空腹血糖', label: '空腹血糖', indicator: 'FBG', unit: 'mmol/L', biovar: rowOf('glucose') }
  const diet = itemOf('d1', '地中海饮食', ['空腹血糖'])

  // 6a: 90 mg/dL is 5.0 mmol/L with the table's factor, so 5.6 mmol/L is +12%, inside the band, not −94%
  const mixed = judge(diet, glucoseMarker, [at('2025-12-20', 90, 'mg/dL'), at('2026-03-01', 5.6, 'mmol/L')])
  assert.equal(mixed.verdict, '波动内', mixed.reason_zh)
  assert.equal(mixed.unit, 'mmol/L')
  assert.equal(mixed.baseline.value, Number((90 * rowOf('glucose').convert['mg/dL']).toPrecision(6)))
  assert.ok(Math.abs(mixed.change.pct - (5.6 / mixed.baseline.value - 1)) < 1e-9)
  const alien = judge(diet, glucoseMarker, [at('2025-12-20', 5.0, 'mmol/L'), at('2026-03-01', 5.6, 'furlong')])
  assert.equal(alien.verdict, '无法判断')
  assert.match(alien.reason_zh, /单位是 furlong，无法换算成 mmol\/L/)
  // 6b: a zero baseline has no relative change
  const crpMarker = { asked: 'hs-CRP', label: '超敏C反应蛋白', indicator: 'CRP', unit: 'mg/L', biovar: rowOf('crp') }
  const zero = judge(diet, crpMarker, [at('2025-12-20', 0, 'mg/L'), at('2026-03-01', 8, 'mg/L')])
  assert.equal(zero.verdict, '无法判断')
  assert.equal(zero.reason_zh, '基线为 0，无法计算相对变化。')
  // CRP in mg/dL is converted before the acute-inflammation check: 1.5 mg/dL is 15 mg/L
  assert.match(judge(diet, crpMarker, [at('2025-12-20', 3, 'mg/L'), at('2026-03-01', 1.5, 'mg/dL')]).reason_zh, /^CRP 高于 10 mg\/L/)

  // 6c: a dose status is read negative first
  const fishOil = { ...itemOf('m1', '鱼油', ['甘油三酯']), category: 'supplement', mirobody: { medication: '鱼油' } }
  const tenDays = Array.from({ length: 10 }, (_, i) => mod.addDays('2026-09-01', i))
  const doseRate = (status) => mod.adherenceFor(fishOil, { start: '2026-09-01', end: '2026-09-10' }, { doses: tenDays.map((date) => ({ date, medication: '鱼油', status, plan_id: '' })), checkins: [] }).rate
  for (const status of ['未服用', '没服用', 'not taken', 'not_taken', 'untaken', 'missed', 'skipped', '漏服']) assert.equal(doseRate(status), 0, status)
  for (const status of ['taken', '已服用']) assert.equal(doseRate(status), 1, status)

  // 6d: home blood pressure only on seven-day means at each end
  const sbpMarker = { asked: '收缩压', label: '收缩压', indicator: 'SBP-home', unit: 'mmHg', biovar: rowOf('sbp') }
  const walk = itemOf('w1', '快走', ['收缩压'], '2026-06-01')
  const week = (end, value, days = 7) => Array.from({ length: days }, (_, i) => at(mod.addDays(end, -i), value, 'mmHg')).reverse()
  const homeWeeks = judge(walk, sbpMarker, [...week('2026-05-31', 130), ...week('2026-09-20', 112)])
  assert.equal(homeWeeks.verdict, '有效', homeWeeks.reason_zh)
  const shortWeek = judge(walk, sbpMarker, [...week('2026-05-31', 130), ...week('2026-09-20', 112, 3)])
  assert.equal(shortWeek.verdict, '无法判断')
  assert.match(shortWeek.reason_zh, /需要连续 7 天的家庭血压：复测只有 3 天的读数/)
  const clinicOnly = judge(walk, sbpMarker, [at('2026-05-20', 142, 'mmHg'), at('2026-09-01', 124, 'mmHg')])
  assert.equal(clinicOnly.verdict, '无法判断', 'one reading at each end is not a seven-day mean')
  assert.match(clinicOnly.reason_zh, /需要连续 7 天的家庭血压：开始前只有 1 天/)

  // 7a: 有效 needs adherence on record; the words say which way the marker moved, never that the item worked
  const falling = [at('2025-12-20', 6.0, 'mmol/L'), at('2026-03-01', 5.0, 'mmol/L')]
  const moved = judge(diet, glucoseMarker, falling)
  assert.equal(moved.verdict, '有效', moved.reason_zh)
  assert.match(moved.reason_zh, /指标朝目标方向变化，超出正常波动/)
  for (const adherence of [{}, { d1: { ...followed, source: 'none', level: 'unknown', rate: null, coverage: 0, known_days: 0, done_days: 0 } }]) {
    const unknown = judge(diet, glucoseMarker, falling, { adherence })
    assert.equal(unknown.verdict, '无法判断')
    assert.match(unknown.reason_zh, /^没有执行记录/)
  }
  const sparse = judge(diet, glucoseMarker, falling, { adherence: { d1: { ...followed, level: 'unknown', coverage: 0.1 } } })
  assert.equal(sparse.verdict, '无法判断')
  assert.match(sparse.reason_zh, /^执行记录太少（覆盖 10% 的天数）/)
  assert.equal(judge(diet, glucoseMarker, [at('2025-12-20', 5.0, 'mmol/L'), at('2026-03-01', 6.0, 'mmol/L')], { adherence: {} }).verdict, '反向', 'a move the wrong way is shown whatever the adherence')

  // 7b: with a goal, toward the goal decides; range and none markers say 朝目标 / 偏离目标, range ones add the reference range
  const hbMarker = { asked: '血红蛋白', label: '血红蛋白', indicator: 'HGB', unit: 'g/L', biovar: rowOf('hb') }
  const iron = itemOf('h1', '红肉', ['血红蛋白'])
  const hbGoal = (value, unit = 'g/L') => ({ goals: [{ marker: '血红蛋白', value, unit }] })
  const hbUp = [at('2025-12-20', 120, 'g/L'), at('2026-03-01', 150, 'g/L')]
  const toward = judge(iron, hbMarker, hbUp, hbGoal(140))
  assert.equal(toward.verdict, '有效')
  assert.match(toward.reason_zh, /朝目标变化，超出正常波动。已越过目标值。是否合适要结合参考范围。/)
  assert.equal(judge(iron, hbMarker, hbUp, hbGoal(14, 'g/dL')).verdict, '有效', 'a goal in g/dL is converted with the table factor')
  const away = judge(iron, hbMarker, [at('2025-12-20', 120, 'g/L'), at('2026-03-01', 100, 'g/L')], hbGoal(140))
  assert.equal(away.verdict, '反向')
  assert.match(away.reason_zh, /偏离目标，超出正常波动。是否合适要结合参考范围。/)
  const noGoal = judge(iron, hbMarker, hbUp)
  assert.equal(noGoal.verdict, '无法判断', 'a range marker without a goal has no direction')
  const oddGoal = judge(iron, hbMarker, hbUp, hbGoal(8, 'mmol/L'))
  assert.equal(oddGoal.verdict, '无法判断')
  assert.match(oddGoal.reason_zh, /目标 8 mmol\/L 无法换算成 g\/L，没有按目标判断/)
  const weightMarker = { asked: '体重', label: '体重', indicator: 'WT', unit: 'kg', biovar: rowOf('weight') }
  const lighter = judge(itemOf('k1', '减重', ['体重']), weightMarker, [at('2025-12-20', 80, 'kg'), at('2026-03-01', 72, 'kg')], { goals: [{ marker: '体重', value: 75, unit: 'kg' }] })
  assert.equal(lighter.verdict, '有效')
  assert.match(lighter.reason_zh, /朝目标变化，超出正常波动。已越过目标值。$/)
  for (const row of [mixed, moved, toward, away, lighter, homeWeeks]) assert.doesNotMatch(row.reason_zh, /真实的改善|改善来自|变差/)

  // 7c: two items on one marker: the change is not credited to either, and the next step says so once
  const walkBoth = itemOf('d2', '每天快走', ['空腹血糖'])
  const both = { items: [diet, walkBoth] }
  const summaries = mod.evaluatePlan({
    plan: both, goals: [], today: TODAY, markers: { 空腹血糖: glucoseMarker }, series: { FBG: falling },
    adherence: { d1: followed, d2: followed }, courses: [], checkins: [], biovar: bv, effects: [],
  })
  const together = mod.togetherZh(['地中海饮食', '每天快走'])
  assert.match(together, /^同期在执行「.+」和「.+」，无法区分各自的作用。$/)
  for (const summary of summaries) assert.ok(summary.verdicts[0].reason_zh.includes(together), summary.verdicts[0].reason_zh)
  const steps = mod.suggestNext(summaries, { today: TODAY }).filter((row) => row.kind === 'one_change')
  assert.equal(steps.length, 1, 'once per marker and set of items, not mirrored')
  assert.equal(steps[0].text_zh, `空腹血糖：${together}下次调整一次只改一项。`)
  for (const row of mod.suggestNext(summaries, { today: TODAY })) assert.doesNotMatch(row.text_zh, /来自|组合/)

  // A marker not found in a record that failed to read, or whose catalogue was cut, is never "add the test"
  const notFound = { asked: '超敏C反应蛋白', label: '超敏C反应蛋白', indicator: null, unit: '', biovar: null }
  const crpOnly = { items: [itemOf('c1', '地中海饮食', ['超敏C反应蛋白'])] }
  const unreadInput = (recordUnread) => ({
    plan: crpOnly, goals: [], today: TODAY, markers: { 超敏C反应蛋白: notFound }, series: {},
    adherence: { c1: followed }, courses: [], checkins: [], biovar: bv, effects: [], record_unread: recordUnread,
  })
  for (const [recordUnread, reason] of [['failed', /^记录读取失败，没有读到超敏C反应蛋白的结果，这次无法判断。$/], ['cut', /^指标目录没有读全，超敏C反应蛋白可能在没有读到的部分，这次无法判断。$/]]) {
    const rows = mod.evaluatePlan(unreadInput(recordUnread))
    assert.match(rows[0].verdicts[0].reason_zh, reason)
    assert.equal(mod.suggestNext(rows, { today: TODAY }).some((row) => row.kind === 'missing_marker'), false, recordUnread)
  }
  // A marker with no variation row is found under its report name (腰围 is Waist Circumference-WC in the record)
  assert.equal(mod.resolveMarkers(['腰围'], records.indicators, bv)[0].indicator, 'Waist Circumference-WC')
  const readWhole = mod.evaluatePlan(unreadInput(undefined))
  assert.match(readWhole[0].verdicts[0].reason_zh, /^记录里还没有超敏C反应蛋白。下次检查时加测/)
  assert.equal(mod.suggestNext(readWhole, { today: TODAY }).filter((row) => row.kind === 'missing_marker').length, 1)

  // 7d: a goal the skill cannot read is named, and no "at the goal" value is shown for it
  const badUnit = await mod.modelGoals({ config, dataDir, skillsHome: home, catalog, records, today: TODAY }, [{ marker: '空腹血糖', value: 5.0, unit: 'mmol/mol' }])
  const badCard = badUnit.models.find((row) => row.model === 'phenoage')
  assert.equal(badCard.goal, null)
  assert.equal(badCard.status, 'no_goal')
  assert.ok(badCard.goal_problems_zh.length === 1 && /mmol\/mol/.test(badCard.goal_problems_zh[0]), JSON.stringify(badCard.goal_problems_zh))
  assert.match(badCard.note_zh, /^方案目标没有用于计算：/)
  // a goal without a unit is never read as already in the method's unit (CRP 0.5 would be 5 mg/L)
  const unitless = (await mod.modelGoals({ config, dataDir, skillsHome: home, catalog, records, today: TODAY }, [{ marker: '超敏C反应蛋白', value: 0.5, unit: '' }])).models.find((row) => row.model === 'phenoage')
  assert.equal(unitless.goal, null)
  assert.match(unitless.goal_problems_zh.join(' '), /没有写单位/)
  assert.deepEqual(mod.goalProblems(catalog, [{ marker: '超敏C反应蛋白', value: 0.5, unit: 'mg/L' }], home), [], 'a good goal has no problem')
  assert.equal(mod.goalProblems(catalog, [{ marker: '空腹血糖', value: 5.0, unit: 'mmol/mol' }], home).length, 1)

  // --- 5.1: plans keep no dose, in any category (8a, 8b, 8c, 8e) -------------------------------------------
  const plan = (items, extra = {}) => mod.normalizePlan({ items, ...extra }, { today: TODAY, medications: [], previous: null })
  const dietMed = plan([{ category: 'diet', title: '二甲双胍', detail: '每天 500 mg', start: TODAY }])
  assert.equal(dietMed.plan.items[0].detail, '每天')
  assert.ok(dietMed.warnings.some((line) => line.includes('剂量没有保存')), 'every category')
  assert.equal(plan([{ category: 'other', title: '二甲双胍 500mg', start: TODAY }]).plan.items[0].title, '二甲双胍')
  const doseOnly = plan([{ category: 'drug', title: '500mg', start: TODAY }])
  assert.ok(doseOnly.errors.includes('第 1 项：标题只有剂量，请写做什么。'), JSON.stringify(doseOnly.errors))
  assert.equal(doseOnly.plan.items[0].title, '', 'the dose is never restored')
  for (const text of ['五百毫克', '两克', '一千单位', '每天五百毫克', '一千五百国际单位', '二百五十微克', '三毫升', '五百 mg', '０．５ｇ', '1,000 IU', '2 x 500mg', '500mg/天', '每次两克', '五百片', '一千粒']) {
    const saved = plan([{ category: 'supplement', title: '鱼油', detail: `饭后 ${text}`, start: TODAY }]).plan.items[0].detail
    assert.equal(mod.hasDose(saved), false, `${text} → ${saved}`)
    assert.ok(['饭后', '饭后 每天', '饭后 每次'].includes(saved), `${text} → ${saved}`)
  }
  assert.equal(plan([{ category: 'diet', title: '控糖', detail: '空腹血糖 5.6 mmol/L，甘油三酯 42.6 mg/dL', start: TODAY }]).plan.items[0].detail, '空腹血糖 5.6 mmol/L，甘油三酯 42.6 mg/dL', 'a concentration is not a dose')
  assert.equal(plan([{ category: 'weight', title: '减重', detail: '目标 70 千克', start: TODAY }]).plan.items[0].detail, '目标 70 千克', '千克 is a weight')
  // A number that is part of a product's name stays; the item links to that product, never to a neighbour
  for (const title of ['维生素B12片', '辅酶Q10胶囊', 'Omega-3 胶囊', '维生素K2 片', '维生素D3滴剂']) {
    const kept = plan([{ category: 'supplement', title, start: TODAY }])
    assert.equal(kept.plan.items[0].title, title)
    assert.equal(kept.warnings.some((line) => line.includes('剂量没有保存')), false, title)
  }
  assert.equal(plan([{ category: 'supplement', title: '维生素D2000IU', start: TODAY }]).plan.items[0].title, '维生素D', 'glued to a Latin unit it is an amount')
  const b12 = mod.normalizePlan({ items: [{ category: 'supplement', title: '维生素B12片', start: TODAY }] }, { today: TODAY, medications: [{ name: '维生素B6' }], previous: null })
  assert.equal(b12.plan.items[0].mirobody.medication, '维生素B12片', 'not linked to 维生素B6')
  const d3 = mod.normalizePlan({ items: [{ category: 'supplement', title: '维生素D3 2000IU', start: TODAY }] }, { today: TODAY, medications: [{ name: '维生素D3' }, { name: '维生素D' }], previous: null })
  assert.equal(d3.plan.items[0].title, '维生素D3')
  assert.equal(d3.plan.items[0].mirobody.medication, '维生素D3')
  const medName = plan([{ category: 'drug', title: '二甲双胍', medication: '二甲双胍 500mg 每日两次', start: TODAY }])
  assert.equal(medName.plan.items[0].mirobody.medication, '二甲双胍 每日两次')
  const titled = plan([{ category: 'exercise', title: '快走', detail: '每天 30 分钟，饭后', start: TODAY }], { title: '维生素D 2000IU 方案', note: '每天 2000 IU' })
  assert.equal(titled.plan.title, '维生素D 方案')
  assert.equal(titled.plan.note, '每天')
  assert.ok(titled.warnings.some((line) => line.startsWith('方案标题里的剂量没有保存')))
  assert.equal(mod.describeItem(titled.plan.items[0]), `运动｜快走；${TODAY} 起；说明：每天 30 分钟，饭后`, 'the read-back includes the detail')
  assert.equal(mod.describePlan(titled.plan), '方案：维生素D 方案；备注：每天')

  // --- 5.1: the newest value across an input's codes; the per-day merge; phenotypic age keyed by its inputs (4a, 5) ---
  const glucoseSpec = { key: 'glu', label_zh: '血糖', loinc: ['14771-0', '2345-7'], unit: 'mmol/L', required: true, from: 'measurements' }
  const fbg = (date, value) => ({ name: 'FBG', value: String(value), unit: 'mmol/L', loinc: '14771-0', date })
  const glu = (date, value) => ({ name: 'GLU', value: String(value), unit: 'mmol/L', loinc: '2345-7', date })
  assert.equal(mod.indicatorFor(glucoseSpec, [glu('2026-08-26', 6.8), fbg('2026-08-26', 5.4)]).name, 'FBG', 'same day: the earlier code in skill.json order')
  assert.equal(mod.indicatorFor(glucoseSpec, [fbg('2026-08-26', 5.4), glu('2026-08-26', 6.8)]).name, 'FBG', 'whatever the row order')
  assert.equal(mod.indicatorFor(glucoseSpec, [fbg('2023-03-01', 5.0), glu('2026-08-26', 6.1)]).name, 'GLU', 'an older value on the first code loses to a newer one on the second')
  const crpSpec = { key: 'crp', label_zh: 'CRP', loinc: ['30522-7', '1988-5'], unit: 'mg/L', required: true, from: 'measurements' }
  assert.equal(mod.indicatorFor(crpSpec, [{ name: 'CRP', value: '6', unit: 'mg/L', loinc: '1988-5', date: '2026-08-26' }, { name: 'hs-CRP', value: '1.2', unit: 'mg/L', loinc: '30522-7', date: '2026-08-26' }]).name, 'hs-CRP')

  const baseline = tracking.bioage.points.at(-1)
  const phenoCard = catalog.cards.find((card) => card.name === mod.PHENOAGE_SKILL)
  const glucoseCodes = phenoCard.inputs.find((spec) => spec.key === 'glucose_mmol').loinc
  const variant = async (name, change, profile = { age: 53 }) => {
    const record = JSON.parse(readFileSync(join(root, 'fixtures', 'mirobody', 'record.json'), 'utf8'))
    change(record)
    const alt = await startFakeMirobody({ record })
    const dir = mkdtempSync(join(tmpdir(), `longpi-interventions-${name}-`))
    try {
      mod.writeProfile(dir, { displayName: '陈明', birthYear: 1972, sex: 'male', risk: facts, ...profile })
      const altConfig = { ...config, mcpUrl: alt.url, dataDir: dir }
      mod.invalidateRecords()
      mod.invalidateTracking()
      const altRecords = await mod.loadRecords(altConfig, dir, '/nonexistent/plugin')
      return { dir, tracking: await mod.buildTracking({ config: altConfig, dataDir: dir, skillsHome: home, catalog, records: altRecords, today: TODAY }), records: altRecords, config: altConfig, close: () => alt.close() }
    } catch (error) {
      await alt.close()
      throw error
    }
  }
  const glucoseRow = (date, value) => ({ indicator: 'Glucose-GLU', name: '葡萄糖', system: 'loinc', code: '2345-7', unit: 'mmol/L', date, time: `${date} 08:30:00`, value: String(value), file: '' })
  // one old generic glucose off any checkup day no longer hides four complete fasting checkups
  let run = await variant('stray', (record) => record.observations.push(glucoseRow('2024-05-10', 7.8)))
  try {
    assert.equal(run.tracking.bioage.status, 'ok', run.tracking.bioage.note_zh)
    assert.equal(run.tracking.bioage.points.length, 4)
  } finally {
    await run.close()
  }
  // a generic glucose on the latest checkup day: that day uses whichever code skill.json lists first
  run = await variant('sameday', (record) => record.observations.push(glucoseRow('2026-08-26', 9.5)))
  try {
    const generic = glucoseCodes.indexOf('2345-7') < glucoseCodes.indexOf('14771-0')
    assert.equal(run.tracking.bioage.points.at(-1).phenoage !== baseline.phenoage, generic, `codes ${glucoseCodes.join(',')}`)
    // 5: every stored point carries the key of what it was computed from
    const rows = mod.readHistory(run.dir, 1000).filter((row) => row.skill === mod.PHENOAGE_SKILL && row.measured_at)
    const keyed = rows.filter((row) => row.inputs_key)
    assert.deepEqual([...new Set(keyed.map((row) => row.measured_at))].sort(), ['2025-10-18', '2026-01-20', '2026-04-22', '2026-08-26'])
    assert.ok(keyed.every((row) => /^[0-9a-f]{16}$/.test(row.inputs_key)))
    // a new age recomputes every checkup, not only the latest
    mod.writeProfile(run.dir, { age: 63 })
    mod.invalidateTracking()
    const older = await mod.buildTracking({ config: run.config, dataDir: run.dir, skillsHome: home, catalog, records: { ...run.records, profile: mod.readProfile(run.dir) }, today: TODAY })
    assert.equal(older.bioage.runs, 4, 'all four checkups are computed again')
    assert.ok(older.bioage.points.every((row, i) => row.phenoage !== run.tracking.bioage.points[i].phenoage))
    // weeks later, with the same saved age, the past checkups are not computed again at a lower age
    mod.invalidateTracking()
    const later = await mod.buildTracking({ config: run.config, dataDir: run.dir, skillsHome: home, catalog, records: { ...run.records, profile: mod.readProfile(run.dir) }, today: '2026-11-15' })
    assert.equal(later.bioage.runs, 0, 'nothing computed again as the calendar moves')
    assert.deepEqual(later.bioage.points.map((row) => row.phenoage), older.bioage.points.map((row) => row.phenoage))
  } finally {
    await run.close()
  }
  // a checkup that is no longer complete drops out of what is shown
  run = await variant('incomplete', (record) => { record.observations = record.observations.filter((row) => !(row.indicator === 'Albumin-ALB' && row.date === '2026-08-26')) })
  try {
    assert.equal(run.tracking.bioage.status, 'ok', run.tracking.bioage.note_zh)
    assert.deepEqual(run.tracking.bioage.points.map((row) => row.date), ['2025-10-18', '2026-01-20', '2026-04-22'])
  } finally {
    await run.close()
  }
  // the latest checkup failing to compute is never covered by an older point
  run = await variant('refused', (record) => { record.observations = record.observations.map((row) => (row.indicator === 'Albumin-ALB' && row.date === '2026-08-26' ? { ...row, value: '5' } : row)) })
  try {
    assert.equal(run.tracking.bioage.status, 'error')
    assert.match(run.tracking.bioage.note_zh, /^2026-08-26 这次血检的表型年龄没有算出来/)
    assert.equal(run.tracking.bioage.points.at(-1).date, '2026-04-22', 'the older checkups are still drawn')
  } finally {
    await run.close()
  }

  // 4b: China-PAR uses the newer of the latest clinic reading and the home 7-day mean, and names each input's date
  const riskOf = (tracked) => tracked.models.find((card) => card.model === 'china-par')
  const clinic = (date, value) => ({ indicator: 'Systolic Blood Pressure-SBP', name: '收缩压', system: 'loinc', code: '8480-6', unit: 'mmHg', date, time: `${date} 09:00:00`, value: String(value), file: '' })
  const plainRisk = riskOf(tracking)
  run = await variant('old-clinic', (record) => record.observations.push(clinic('2021-06-01', 150)))
  try {
    const card = riskOf(run.tracking)
    assert.equal(card.now.risk_pct, plainRisk.now.risk_pct, 'a years-old clinic reading does not replace a newer home week')
    const sbpDate = card.input_dates.find((row) => row.key === 'sbp_mmhg')
    assert.equal(sbpDate.source, 'home')
    assert.equal(card.measured_on, sbpDate.date, 'measured_on is the newest date actually used')
  } finally {
    await run.close()
  }
  run = await variant('new-clinic', (record) => record.observations.push(clinic('2026-09-23', 150)))
  try {
    const card = riskOf(run.tracking)
    assert.ok(card.now.risk_pct > plainRisk.now.risk_pct, 'a newer clinic reading is used as it is')
    assert.deepEqual(card.input_dates.find((row) => row.key === 'sbp_mmhg'), { key: 'sbp_mmhg', label_zh: phenoCard ? catalog.cards.find((c) => c.name === mod.RISK_SKILL).inputs.find((spec) => spec.key === 'sbp_mmhg').label_zh : '', date: '2026-09-23', source: 'checkup' })
  } finally {
    await run.close()
  }

  // 3a: latest values that failed to read are "not read", never "missing"; the series may still be read
  const flaky = await startFlakyMirobody({ fail: (name, args) => name === 'query_health_indicators' && args.aggregate === 'latest' ? 'http500' : null })
  const flakyDir = mkdtempSync(join(tmpdir(), 'longpi-interventions-flaky-'))
  try {
    mod.writeProfile(flakyDir, { age: 53, sex: 'male', risk: facts })
    const flakyConfig = { ...config, mcpUrl: flaky.url, dataDir: flakyDir }
    mod.invalidateRecords()
    mod.invalidateTracking()
    const partial = await mod.loadRecords(flakyConfig, flakyDir, '/nonexistent/plugin')
    assert.equal(partial.record_status, 'partial')
    const flakyTracking = await mod.buildTracking({ config: flakyConfig, dataDir: flakyDir, skillsHome: home, catalog, records: partial, today: TODAY })
    assert.equal(flakyTracking.bioage.status, 'ok', `the checkups are read from their series: ${flakyTracking.bioage.note_zh}`)
    assert.deepEqual(flakyTracking.bioage.missing, [])
    const flakyRisk = riskOf(flakyTracking)
    assert.deepEqual(flakyRisk.missing_labs, [], 'nothing on file is listed as a test to add')
    assert.match(flakyRisk.note_zh, /最新值没有读到（读取失败），不是没有测过/)
    const ready = mod.readiness(catalog, partial, {})
    assert.equal(ready.unlock.length + ready.near.length, 0, 'no add-on test for a value that failed to read')
    const matched = mod.matchSkills(catalog.cards, '', partial.indicators, 8, {
      intents: catalog.intents, profile: { age: 53, sex: 'male' }, outputs: {}, reads: { failed: partial.missing_reads, catalog_truncated: partial.catalog_truncated },
    })
    assert.ok(matched.near.every((item) => !item.runnable.missing.includes('白蛋白')), 'almost_runnable never names a value that failed to read')
    const partialBoard = mod.buildBoard({ catalog, records: partial, mount: { mounted: false, peer: false, error: '', pluginHome: '' }, receipts: [], limit: 8, outputs: {} })
    assert.ok(partialBoard.near.every((item) => !item.runnable.missing.includes('白蛋白')))
    assert.equal(partialBoard.records.status, 'partial')
    assert.equal(partialBoard.records.missing_reads.length, partial.missing_reads.length)
  } finally {
    await flaky.close()
    rmSync(flakyDir, { recursive: true, force: true })
  }
  // 3d: any series of the nine failing is a read failure, not "not measured together"
  const flakySeries = await startFlakyMirobody({ fail: (_name, args) => args.aggregate === 'none' && (args.indicators ?? []).includes('Albumin-ALB') ? 'isError' : null })
  const seriesDir = mkdtempSync(join(tmpdir(), 'longpi-interventions-series-'))
  try {
    mod.writeProfile(seriesDir, { age: 53, sex: 'male', risk: facts })
    const seriesConfig = { ...config, mcpUrl: flakySeries.url, dataDir: seriesDir }
    mod.invalidateRecords()
    mod.invalidateTracking()
    const recs = await mod.loadRecords(seriesConfig, seriesDir, '/nonexistent/plugin')
    const failedSeries = await mod.buildTracking({ config: seriesConfig, dataDir: seriesDir, skillsHome: home, catalog, records: recs, today: TODAY })
    assert.equal(failedSeries.bioage.status, 'error')
    assert.match(failedSeries.bioage.note_zh, /^读取历次血检失败：query failed: database timeout/)
  } finally {
    await flakySeries.close()
    rmSync(seriesDir, { recursive: true, force: true })
  }
  // ...and one that came back cut is not read whole either
  const cutSeries = await startFlakyMirobody({ fail: (_name, args) => args.aggregate === 'none' && (args.indicators ?? []).includes('Albumin-ALB') ? { cut: true } : null })
  const cutDir = mkdtempSync(join(tmpdir(), 'longpi-interventions-cut-'))
  try {
    mod.writeProfile(cutDir, { age: 53, sex: 'male', risk: facts })
    const cutConfig = { ...config, mcpUrl: cutSeries.url, dataDir: cutDir }
    mod.invalidateRecords()
    mod.invalidateTracking()
    const recs = await mod.loadRecords(cutConfig, cutDir, '/nonexistent/plugin')
    const cutTracking = await mod.buildTracking({ config: cutConfig, dataDir: cutDir, skillsHome: home, catalog, records: recs, today: TODAY })
    assert.equal(cutTracking.bioage.status, 'error')
    assert.match(cutTracking.bioage.note_zh, /读数太多被截断，没有读全/)
  } finally {
    await cutSeries.close()
    rmSync(cutDir, { recursive: true, force: true })
  }

  // A home cuff twice a day fills Mirobody's 500-row limit: the older readings are read again, never judged as cut
  {
    const record = JSON.parse(readFileSync(join(root, 'fixtures', 'mirobody', 'record.json'), 'utf8'))
    record.observations = record.observations.filter((row) => row.indicator !== 'systolicPressures')
    let readings = 0
    for (let day = new Date('2025-10-01T00:00:00Z'); day <= new Date('2026-09-20T00:00:00Z'); day.setUTCDate(day.getUTCDate() + 1)) {
      const date = day.toISOString().slice(0, 10)
      for (const hour of ['07', '21']) {
        record.observations.push({ indicator: 'systolicPressures', name: '', system: 'device', code: 'systolicPressures', unit: 'mmHg', date, time: `${date} ${hour}:40:00`, value: String(date >= '2026-05-01' ? 124 : 142), file: '' })
        readings += 1
      }
    }
    // One day alone past the limit cannot be split by date: that series stays cut.
    for (let i = 0; i < 520; i += 1) record.observations.push({ indicator: 'heartRates', name: '', system: 'device', code: 'heartRates', unit: 'bpm', date: '2026-09-01', time: `2026-09-01 ${String(Math.floor(i / 60)).padStart(2, '0')}:${String(i % 60).padStart(2, '0')}:00`, value: '70', file: '' })
    const dense = await startFakeMirobody({ record })
    const denseDir = mkdtempSync(join(tmpdir(), 'longpi-interventions-dense-'))
    try {
      mod.writeProfile(denseDir, { age: 53, sex: 'male', risk: facts })
      const denseConfig = { ...config, mcpUrl: dense.url, dataDir: denseDir }
      mod.invalidateRecords()
      mod.invalidateTracking()
      const read = await mod.loadSeries(denseConfig, ['systolicPressures', 'heartRates'], { start: '2025-08-01', end: TODAY, resolution: 'raw' })
      assert.equal(read.series.systolicPressures.points.length, readings, 'every reading of the dense series')
      assert.equal(new Set(read.series.systolicPressures.points.map((point) => point.time)).size, readings, 'none twice')
      assert.deepEqual(read.cut, ['heartRates'])
      assert.ok(dense.calls.length <= 6, `a few reads (${dense.calls.length})`)
      const recs = await mod.loadRecords(denseConfig, denseDir, '/nonexistent/plugin')
      const drafted = mod.normalizePlan({ title: '减盐', items: [{ category: 'diet', title: '减盐', start: '2026-03-01', markers: ['收缩压'] }] }, { today: TODAY, medications: [], previous: null })
      mod.savePlan(denseDir, drafted.plan)
      const denseTracking = await mod.buildTracking({ config: denseConfig, dataDir: denseDir, skillsHome: home, catalog, records: recs, today: TODAY })
      const verdict = denseTracking.items[0].verdicts[0]
      assert.equal(verdict.indicator, 'systolicPressures')
      assert.doesNotMatch(verdict.reason_zh, /没有读全/)
      assert.ok(verdict.baseline && verdict.followup && verdict.change, verdict.reason_zh)
      assert.match(verdict.reason_zh, /变化 -13%/)
      // An item aimed at 血压 (the word save_intervention_plan's description offers) is judged on both pressures.
      const bpPlan = mod.normalizePlan({ title: '减盐', items: [{ category: 'diet', title: '减盐', start: '2026-03-01', markers: ['血压'] }] }, { today: TODAY, medications: [], previous: mod.currentPlan(denseDir) })
      assert.deepEqual(bpPlan.plan.items[0].markers, ['血压'], 'the plan keeps the person\'s word')
      mod.savePlan(denseDir, bpPlan.plan)
      mod.invalidateTracking()
      const bpTracking = await mod.buildTracking({ config: denseConfig, dataDir: denseDir, skillsHome: home, catalog, records: recs, today: TODAY })
      assert.deepEqual(bpTracking.items[0].verdicts.map((row) => row.indicator), ['systolicPressures', 'diastolicPressures'])
      assert.match(bpTracking.items[0].verdicts[0].reason_zh, /变化 -13%/)
      assert.deepEqual(bpTracking.plan.items[0].markers, ['血压'])
      assert.ok(bpTracking.charts.some((chart) => chart.key === 'sbp') && bpTracking.charts.some((chart) => chart.key === 'dbp'), 'a chart for each pressure')
    } finally {
      await dense.close()
      rmSync(denseDir, { recursive: true, force: true })
    }
  }

  console.log(`interventions ok (${tracking.items.length} items, ${tracking.items.flatMap((item) => item.verdicts).length} verdicts, phenotypic age at ${tracking.bioage.points.length} checkups, band ±${tracking.bioage.band_years.toFixed(1)} y)`)
} finally {
  await server.close()
  rmSync(dataDir, { recursive: true, force: true })
}
