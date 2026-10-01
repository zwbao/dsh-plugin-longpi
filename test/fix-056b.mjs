// 0.5.6 lane B: history read, page honesty, upload retry, Mirobody narrative,
// diabetes markers, glucose series, medicines, goals, plan save, TRE reason,
// diabetes 不确定, China-PAR age. Fixtures are lines from the 0.5.4 diaries.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { absoluteLevel, buildChanges } from '../src/changes.ts'
import { findingsFromIndicators, listFindings } from '../src/datain/narrative.ts'
import { ingestDocument } from '../src/datain/upload.ts'
import { listMedications } from '../src/datain/meds.ts'
import { logLifeEngage, noteLabsOnFile, syncEngage } from '../src/engage/engine.ts'
import { progressStory } from '../src/feedback/grade.ts'
import { retestDates } from '../src/feedback/retest-timing.ts'
import { modelRangeNote } from '../src/honesty/model-range.ts'
import { buildIndicators } from '../src/indicators.ts'
import { memoryFor } from '../src/core/memory.ts'
import { addStatement } from '../src/meds-stated.ts'
import { reproductiveFromText } from '../src/plan-safety.ts'
import { draftPlan, softHoldDraft } from '../src/planner.ts'
import { unansweredOf } from '../src/journey.ts'
import { EMPTY_PROFILE, mergeProfile, normalizeProfile, writeProfile, CONSENT_VERSION } from '../src/profile.ts'
import { invalidateRecords, loadSeries } from '../src/records.ts'
import { medicationNames } from '../src/tools-tracking.ts'

import { skillsHome } from './lib/skills-home.mjs'

const root = dirname(fileURLToPath(import.meta.url))
const home = skillsHome('data/effects.jsonl')
const dirs = []
const servers = []
function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-056b-${name}-`))
  dirs.push(dir)
  return dir
}
const NOW = '2026-09-28T02:00:00.000Z'

function profile(dir, extra = {}) {
  writeProfile(dir, {
    ...EMPTY_PROFILE,
    age: 52,
    sex: 'male',
    consent: { version: CONSENT_VERSION, accepted_at: NOW },
    ...extra,
  })
}

try {
  // --- #98 history: a batch cut is re-read per indicator; a single cut stays cut ---
  const { startFlakyMirobody } = await import('./flaky-mirobody.mjs')
  const names = ['白蛋白', '肌酐', '葡萄糖', '超敏C反应蛋白', '淋巴细胞百分比', '平均红细胞体积', '红细胞分布宽度', '碱性磷酸酶', '白细胞']
  const observations = names.flatMap((name) => ['2026-02-11', '2026-09-21'].map((date) => ({
    indicator: name, name, system: 'lab', code: name, unit: name === '超敏C反应蛋白' ? 'mg/L' : 'u', date, time: `${date} 08:00:00`, value: '1', file: 'lab:a',
  })))
  const batchCut = await startFlakyMirobody({
    record: { observations, medications: { plans: [] } },
    fail: (_name, args) => ((args.aggregate === 'none' || ['raw', 'minute', 'hour', 'day', 'week', 'month'].includes(args.view)) && (args.indicators ?? []).length > 1 ? { cut: true } : null),
  })
  servers.push(batchCut)
  const config = {
    mcpUrl: batchCut.url, mcpToken: 't', member: '', timeoutMs: 8000, pythonBin: '/nonexistent/python',
    mirobodyHome: '', mirobodyPluginHome: '', dataDir: '', skillPython: 'python3', skillTimeoutMs: 20000,
    skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '', bootstrapWorkspace: false,
  }
  invalidateRecords()
  const whole = await loadSeries(config, names, { start: '2024-01-01', end: '2026-09-21', resolution: 'raw' })
  assert.deepEqual(whole.cut, [], 'YB d56 读取历次血检失败：读数太多被截断 — a multi-name cut is re-read one LOINC at a time')
  assert.equal(whole.series['超敏C反应蛋白'].points.length, 2)
  const oneCut = await startFlakyMirobody({
    record: { observations, medications: { plans: [] } },
    fail: (_name, args) => ((args.aggregate === 'none' || ['raw', 'minute', 'hour', 'day', 'week', 'month'].includes(args.view)) && (args.indicators ?? []).includes('超敏C反应蛋白') ? { cut: true } : null),
  })
  servers.push(oneCut)
  invalidateRecords()
  const still = await loadSeries({ ...config, mcpUrl: oneCut.url }, names, { start: '2024-01-01', end: '2026-09-21', resolution: 'raw' })
  assert.ok(still.cut.includes('超敏C反应蛋白'), 'a series that is cut on its own stays cut')

  // --- #98 page honesty ---
  const ferritin = absoluteLevel('铁蛋白', 8.0, 'ng/mL', 'male')
  assert.equal(ferritin?.flag, 'low')
  assert.match(ferritin?.text_zh ?? '', /8 ng\/mL/)
  assert.match(ferritin?.text_zh ?? '', /30/)

  const beyond = progressStory([{
    id: 'fb-hgb',
    subject: { kind: 'marker', key: 'hgb', label_zh: '血红蛋白' },
    grade: 'not_judgeable',
    allowed_claims: [],
    numbers: [
      { id: 'a', label_zh: '血红蛋白', value: 152, unit: 'g/L', date: '2026-02-11', source: 'record' },
      { id: 'b', label_zh: '血红蛋白', value: 116, unit: 'g/L', date: '2026-09-21', source: 'record' },
    ],
    delta: { value: -23.7, unit: '%', band: [-8.4, 8.4], band_verified: true, interval_days: 199, min_interval_days: 28, same_lab: true },
    headline_zh: '血红蛋白 152 → 116，下降 23.7%，超出了波动。',
    tone: 'neutral',
    source: 'template',
  }], '2026-09-21')
  assert.doesNotMatch(beyond.headline_zh, /还没有可以对比的结果|尚无可对比的结果|尚缺可对比的结果/)
  assert.doesNotMatch(beyond.headline_zh, /多半是测量和生理波动|仍在测量波动范围内|未超出测量波动/)
  assert.match(beyond.headline_zh, /超出了正常波动/)
  assert.match(beyond.retest?.why_zh ?? '', /复测已在 (2026 年 )?9 月 21 日完成/)
  assert.equal(beyond.retest?.earliest, '2026-09-21')

  const early = retestDates('2026-07-27', { minDays: 28, earliestDays: 28, recommendedDays: 56, family: 'other', why_zh: '太早：至少隔 28 天。' }, 10, '2026-07-17', null)
  assert.match(early.why_zh, /太早/)
  assert.doesNotMatch(early.why_zh, /正常波动/)
  const slid = retestDates('2026-09-28', { minDays: 56, earliestDays: 56, recommendedDays: 84, family: 'lipids', why_zh: '血脂的真实变化通常要 8–12 周才看得出来。' }, 56, '2026-02-11', null)
  assert.equal(slid.earliest, '2026-04-08', 'the window stays on the draw; it does not walk forward to November')

  const planSrc = readFileSync(join(root, '..', 'src', 'client', 'plan.ts'), 'utf8')
  assert.equal(['还没有方案', '暂无方案', '尚无方案'].some((text) => planSrc.includes(text)), false, 'YB: 还没有方案 (暂无方案, 尚无方案) must not sit above 采用这份方案')

  const seasonDir = tempDir('season')
  profile(seasonDir)
  const cold = logLifeEngage(seasonDir, { event: 'sick', from: '2026-09-27', to: '2026-09-27' }, new Date('2026-09-27T10:00:00+08:00'))
  assert.equal(cold.ok, true, cold.error)
  assert.ok(cold.view.streak.frozen.some((row) => row.day === '2026-09-27'), 'a sick day logged in chat is on the season view the page reads')
  noteLabsOnFile(seasonDir, { hscrp: true, waist: false })
  const unlocked = syncEngage(seasonDir, new Date('2026-09-28T10:00:00+08:00'))
  const bio = unlocked.unlocks.find((row) => row.key === 'bioage')
  assert.equal(bio?.status, 'unlocked')
  assert.doesNotMatch(`${bio?.teaser_zh ?? ''} ${unlocked.reminder_zh ?? ''}`, /加测|超敏 C 反应蛋白/)

  // --- #97 failed upload is not a duplicate ---
  const uploadDir = tempDir('upload')
  const text = '体检日期 2023-11-02 血红蛋白 152 g/L 铁蛋白 30 ng/mL 这是同一份 2023 年的报告需要重试'
  const deps = {
    config: () => ({ mcpUrl: '', mcpToken: '', member: '', timeoutMs: 1000 }),
    dataDir: () => uploadDir,
    bus: { emit() {} },
    invalidate() {},
  }
  const failed = await ingestDocument(deps, { filename: '2023.pdf', text, upload: true })
  assert.equal(failed.duplicate, false)
  assert.equal(failed.forwarded, false)
  assert.match(failed.read_back_zh, /未上传|尚未连接/)
  const retry = await ingestDocument(deps, { filename: '2023.pdf', text, upload: true })
  assert.equal(retry.duplicate, false, 'YB: 这份和已经保存的一份相同 must not follow a failed first send')

  // --- #92 narrative already in Mirobody ---
  const findDir = tempDir('find')
  const nodule = '甲状腺右叶低回声结节 4×3 mm，边界清，TI-RADS 3类。左叶未见明显异常。乳腺 BI-RADS 2类。'
  const stored = findingsFromIndicators(findDir, [{ name: '甲状腺超声', label: '超声结论', value: nodule, date: '2026-08-26' }])
  assert.ok(stored.some((row) => row.kind === 'ti-rads' && row.grade === '3' && /4×3/.test(row.text_zh)))
  assert.ok(stored.some((row) => row.kind === 'bi-rads' && row.grade === '2'))
  assert.equal(findingsFromIndicators(findDir, [{ name: '甲状腺超声', label: '超声结论', value: nodule, date: '2026-08-26' }]).length, 0)
  assert.ok(listFindings(findDir).some((row) => row.kind === 'ti-rads'))

  // --- #92 TRE reason and 不确定 ---
  assert.equal(reproductiveFromText('我没有在备孕').planning, false)
  assert.equal(reproductiveFromText('我没有在怀孕').pregnant, false)
  assert.equal(reproductiveFromText('当前概览里没有写备孕').planning, false)
  assert.equal(reproductiveFromText('我怀孕了').pregnant, true)
  assert.equal(reproductiveFromText('今年开始备孕').planning, true)
  assert.equal(reproductiveFromText('今年开始备孕').pregnant, false)
  const merged = mergeProfile({ ...EMPTY_PROFILE, risk: { smoker: false } }, { risk: { diabetes: null } })
  assert.equal(merged.risk.diabetes, undefined)
  assert.deepEqual(merged.riskUnknown, ['diabetes'])
  const normalized = normalizeProfile(merged)
  assert.equal(normalized.ok, true)
  const open = unansweredOf({
    ...EMPTY_PROFILE,
    age: 33,
    sex: 'female',
    risk: { smoker: false, bp_treated: false, north: false, urban: false, family_history: false },
    riskUnknown: ['diabetes'],
  })
  assert.equal(open.some((label) => label.startsWith('有糖尿病')), false, 'Y27: 不确定 is an answer, not 回答 1 个问题')
  assert.match(modelRangeNote('china-par', 33) ?? '', /35–74/)
  assert.match(modelRangeNote('china-par', 30) ?? '', /30/)
  assert.equal(modelRangeNote('china-par', 52), null)

  // --- #94 urine protein, split glucose, medicines, goals, save deadline ---
  const watch = await buildChanges({
    config,
    skillsHome: home || root,
    today: '2026-09-21',
    records: {
      record_status: 'ok',
      profile: { ...EMPTY_PROFILE, age: 52, sex: 'female', risk: { diabetes: true } },
      medications: [{ name: '二甲双胍', status: 'active', recorded_dose: '0.5 g' }],
      indicators: [
        { name: '尿白蛋白/肌酐比', label: '尿白蛋白/肌酐比', value: '46', unit: 'mg/g', date: '2026-09-21' },
        { name: '眼底', label: '眼底照相', value: '可见微动脉瘤', unit: '', date: '2026-04-16' },
      ],
    },
  })
  assert.ok(watch.changes.some((row) => row.key === 'uacr' && /46/.test(row.text_zh)), 'Y30: 尿白蛋白/肌酐比 46 is 值得注意')
  assert.ok(watch.changes.some((row) => row.key === 'retina' && /微动脉瘤/.test(row.text_zh)))

  if (home) {
    const { startFakeMirobody } = await import('./fake-mirobody.mjs')
    const glucose = await startFakeMirobody({
      record: {
        medications: { plans: [] },
        observations: [
          { indicator: '铁蛋白', name: '铁蛋白', system: 'lab', code: '2276-4', unit: 'ng/mL', date: '2026-09-21', time: '2026-09-21 08:00:00', value: '8.0', file: 'lab:a' },
          { indicator: '空腹血糖', name: '空腹血糖', system: 'lab', code: '14771-0', unit: 'mmol/L', date: '2026-09-21', time: '2026-09-21 08:10:00', value: '7.34', file: 'lab:a' },
          { indicator: '葡萄糖', name: '葡萄糖', system: 'lab', code: '1558-6', unit: 'mmol/L', date: '2026-07-27', time: '2026-07-27 08:10:00', value: '7.52', file: 'lab:a' },
          { indicator: 'bloodGlucoses', name: 'bloodGlucoses', system: 'device', code: 'bloodGlucoses', unit: 'mmol/L', date: '2026-09-20', time: '2026-09-20 07:00:00', value: '6.1', file: 'lp:home:glucose:finger' },
          { indicator: 'bloodGlucoses', name: 'bloodGlucoses', system: 'device', code: 'bloodGlucoses', unit: 'mmol/L', date: '2026-09-20', time: '2026-09-20 15:00:00', value: '8.4', file: 'lp:cgm' },
          { indicator: '尿白蛋白/肌酐比', name: '尿白蛋白/肌酐比', system: 'lab', code: '尿白蛋白/肌酐比', unit: 'mg/g', date: '2026-09-21', time: '2026-09-21 08:20:00', value: '46', file: 'lab:a' },
        ],
      },
    })
    servers.push(glucose)
    const gConfig = { ...config, mcpUrl: glucose.url, timeoutMs: 8000, skillsHome: home }
    const gDir = tempDir('glucose')
    profile(gDir, { sex: 'male', age: 52, risk: { diabetes: true } })
    invalidateRecords()
    const records = await (await import('../src/records.ts')).loadRecords(gConfig, gDir, '/nonexistent/plugin')
    const page = await buildIndicators({ config: gConfig, dataDir: gDir, skillsHome: home, records, today: '2026-09-21' })
    const rows = page.groups.flatMap((group) => group.indicators)
    const labels = rows.map((row) => row.label_zh)
    assert.ok(labels.includes('指尖血糖'), labels.join(','))
    assert.ok(labels.includes('瞬感血糖'), labels.join(','))
    assert.ok(labels.includes('空腹血糖'), labels.join(','))
    assert.equal(labels.includes('bloodGlucoses'), false)
    const finger = rows.find((row) => row.label_zh === '指尖血糖')
    const cgm = rows.find((row) => row.label_zh === '瞬感血糖')
    assert.equal(finger?.latest?.value, 6.1)
    assert.equal(cgm?.latest?.value, 8.4)
    const iron = rows.find((row) => row.label_zh.includes('铁蛋白'))
    assert.equal(iron?.range_flag, 'low')
    assert.match(iron?.range_zh ?? '', /偏低/)
  }

  const medDir = tempDir('meds')
  memoryFor(medDir).apply([{
    op: 'add',
    item: {
      kind: 'medication', name_zh: '二甲双胍', drug_class: ['metformin'], source_rx: 'doctor', regimen_text: '0.5 g 每天 3 次',
      text_zh: '二甲双胍 0.5 g 每天 3 次', confirmed: true,
      provenance: { kind: 'model_extracted', at: NOW, by: 'M0', quote_zh: '请记下二甲双胍 0.5 g，一天三次' },
    },
  }, {
    op: 'add',
    item: {
      kind: 'medication', name_zh: '达格列净', drug_class: ['sglt2i'], source_rx: 'doctor', regimen_text: '10 mg 每天早上',
      text_zh: '达格列净 10 mg 每天早上', confirmed: true,
      provenance: { kind: 'model_extracted', at: NOW, by: 'M0', quote_zh: '达格列净 10 mg 每天早上' },
    },
  }], 'M0')
  const meds = listMedications(medDir)
  assert.match(meds.lines.join('\n'), /二甲双胍/)
  assert.match(meds.lines.join('\n'), /达格列净/)
  assert.doesNotMatch(meds.lines.join('\n'), /还没有你让 LongPi 记下的药|尚未记录用药/)

  const held = softHoldDraft('2026-09-21', ['你说过的目标：体重 75 公斤', '你说过的目标：脂肪肝'])
  assert.match(held.notes_zh.join('\n'), /75 公斤/)
  assert.match(held.notes_zh.join('\n'), /脂肪肝/)
  assert.equal(JSON.stringify(held.items).includes('限时进食'), false)
  assert.doesNotMatch(JSON.stringify(held), /16:8|铁剂|大幅/)
  const asked = softHoldDraft('2026-07-27', [])
  assert.match(asked.notes_zh.join('\n'), /尚未记录体重目标或脂肪肝情况/)
  const waiting = draftPlan({
    today: '2026-09-21', focus: [], priorities: [], candidates: [],
    safety: { medications: [], notes_zh: [], stop_zh: '请先去看医生。' },
    excluded_ids: [], excluded_phrases: [], past_items: [], metrics: [],
    notes_zh: ['你说过的目标：体重目标 75 公斤'], boundary_zh: '',
  }, { today: '2026-09-21' })
  assert.match(waiting?.notes_zh.join('\n') ?? '', /75 公斤/)

  addStatement(medDir, { name: '达格列净', dose_text: '10 mg', frequency_text: '每天早上', since: '2026-01-01' })
  const started = Date.now()
  const namesBack = await medicationNames(config, medDir, '/nonexistent/plugin', false, 40, () => new Promise(() => {}))
  assert.ok(Date.now() - started < 1000, 'Y30 d22 正在核对 must not wait out the catalogue')
  assert.ok(namesBack.some((row) => row.name.includes('达格列净')))

  console.log('fix-056b ok')
} finally {
  await Promise.all(servers.map((server) => server.close()))
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
