// 0.6.2 integration fixes (INT062): two people's labs never make one body age; one body-age number on the page,
// in the fact list and in the chat's tool text; one draw has no gap; a statin owns the lipid drop; a medicine that
// moves weight takes the kilogram figure out of the plan. Uses the fake Mirobody record and the real
// longevity-skills checkout; skips without it. Every value is made up.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import * as mod from '../lib/index.js'
import { alignBodyAge, bodyAgeFactText, measuresBodyAge, PHENO_SKILL, versusCalendarAge } from '../src/core/method-view.ts'
import { rankTopFacts } from '../src/core/topfacts.ts'
import { notOnePersonReason } from '../src/subject.ts'
import { coveredByCare, isCovered } from '../src/client/overview-facts.ts'
import { loadRecord, startFakeMirobody } from './fake-mirobody.mjs'
import { skillsHome } from './lib/skills-home.mjs'

const home = skillsHome('data/effects.jsonl')
if (!home) {
  console.log('int-062 skipped (no longevity-skills checkout with data/)')
  process.exit(0)
}

const TODAY = '2026-09-24'
const NOW = new Date(`${TODAY}T12:00:00Z`)
const FACTS = { smoker: false, diabetes: false, bp_treated: false, north: true, urban: true, family_history: false }
const MOUNT = { mounted: true, peer: false, error: '', pluginHome: '' }
const BODY_AGE_NUMBER = /身体年龄[^。]{0,12}\d+(?:\.\d+)?\s*岁/
const KG = /1\.7\d?\s*kg/
const catalog = mod.loadCatalog(home)
const temp = []
const servers = []

function tempDir(name) {
  const dir = mkdtempSync(join(tmpdir(), `longpi-int062-${name}-`))
  temp.push(dir)
  return dir
}

function configFor(dataDir, mcpUrl = '') {
  return {
    mcpUrl, mcpToken: '', member: '', timeoutMs: 10000, pythonBin: '/nonexistent/python', mirobodyHome: '', mirobodyPluginHome: '',
    dataDir, skillPython: 'python3', skillTimeoutMs: 60000, skillRuntimes: {}, skillsHome: home, maxSkillMatches: 6, skillsVersion: '',
  }
}

function profileIn(dataDir, extra = {}) {
  mod.writeProfile(dataDir, { age: 53, sex: 'male', risk: FACTS, focus: ['bioage', 'weight'], consent: { version: mod.CONSENT_VERSION, accepted_at: NOW.toISOString() }, ...extra })
}

async function serve(record) {
  const server = await startFakeMirobody({ record })
  servers.push(server)
  return server
}

async function contextOf(config, patch = (records) => records) {
  mod.invalidateRecords()
  mod.invalidateTracking()
  const records = patch(await mod.loadRecords(config, config.dataDir, '/nonexistent/plugin'))
  return { config, dataDir: config.dataDir, skillsHome: home, catalog, records, today: TODAY, mount: MOUNT }
}

function fakeHost() {
  const tools = new Map()
  const ctx = {
    tools: { register: (tool) => { tools.set(tool.name, tool); return () => {} } },
    skills: { register: () => () => {} },
    systemPrompt: { section: () => {} },
    webServer: { register: () => () => {} },
    connection: { requestRejection: () => undefined },
    commands: { register: () => {} },
    inject: (_names, callback) => callback(ctx),
    on: () => () => {},
    effect: (execute) => execute(),
  }
  return { ctx, tools }
}

/** A PSA row on the latest checkup day, the way record.json holds a lab. */
function withPsa(record) {
  const day = [...new Set(record.observations.filter((row) => row.system === 'loinc').map((row) => row.date))].sort().at(-1)
  return {
    ...record,
    observations: [...record.observations, { indicator: 'Total Prostate Specific Antigen-TPSA', name: '总前列腺特异性抗原', system: 'loinc', code: '2857-1', unit: 'ng/mL', date: day, time: `${day} 08:30:00`, value: '2.4', file: `${day} 体检报告.pdf` }],
  }
}

/** Only the latest checkup's labs: one body-age draw. */
function oneDraw(record) {
  const days = [...new Set(record.observations.filter((row) => row.system === 'loinc').map((row) => row.date))].sort()
  const last = days.at(-1)
  return { ...record, observations: record.observations.filter((row) => row.system !== 'loinc' || row.date === last) }
}

function methodRow(skill, outputs, label = 'verified') {
  return { skill, label, outputs, inputs_used: [], catalog_version: '2026.39.0', ran_at: `${TODAY}T08:00:00Z`, limits_zh: '模型估计。' }
}

try {
  // --- 1. two people's labs: no body age ----------------------------------------------------------
  const female = { age: 38, sex: 'female', subject: null }
  assert.match(notOnePersonReason(female, [{ name: '总前列腺特异性抗原' }]) ?? '', /和档案里的性别对不上/)
  assert.equal(notOnePersonReason({ ...female, subject: { relationship_zh: '父亲', age: 76, sex: 'male' } }, [{ name: '总前列腺特异性抗原' }]), null, 'the father, with his age on file, is one person')
  assert.match(notOnePersonReason({ ...female, subject: { relationship_zh: '父亲', age: null, sex: 'male' } }, [{ name: '游离/总PSA' }]) ?? '', /对不上/, 'a relative with no age is not enough: the holder\'s age would be used')
  assert.equal(notOnePersonReason({ age: 41, sex: 'male', subject: null }, [{ name: '总前列腺特异性抗原' }]), null)
  assert.equal(notOnePersonReason({ age: 33, sex: 'female', subject: null }, [{ name: '宫颈液基细胞学' }]), null)
  assert.match(notOnePersonReason({ age: 50, sex: 'male', subject: null }, [{ name: '宫颈TCT' }]) ?? '', /女性/)

  const mixed = await serve(withPsa(loadRecord()))
  const mixedDir = tempDir('mixed')
  profileIn(mixedDir, { age: 38, sex: 'female' })
  const mixedConfig = configFor(mixedDir, mixed.url)
  const mixedJourney = await mod.buildJourney(await contextOf(mixedConfig))
  assert.notEqual(mixedJourney.results.bioage.status, 'ok', 'one body age from two people\'s labs is blocked')
  assert.equal(mixedJourney.results.bioage.phenoage, null)
  assert.equal(mixedJourney.results.bioage.advance, null)
  assert.match(mixedJourney.results.bioage.blocker_zh, /两个人/)
  const host = fakeHost()
  await mod.apply(host.ctx, mixedConfig)
  const situation = await host.tools.get('read_personal_situation').execute({})
  assert.doesNotMatch(JSON.stringify(situation), BODY_AGE_NUMBER, 'the tool text has no body-age number to quote')
  assert.equal(Object.keys(situation.earlier_readouts).some((key) => /phenoage/.test(key)), false, 'no earlier body-age readout either')
  const refused = await host.tools.get('run_longevity_skill').execute({ name: PHENO_SKILL })
  assert.equal(refused.refused, true)
  assert.match(refused.reason_zh, /两个人/)
  // The same record under his own name and sex computes as before.
  const selfDir = tempDir('self')
  profileIn(selfDir)
  const selfJourney = await mod.buildJourney(await contextOf(configFor(selfDir, mixed.url)))
  assert.equal(selfJourney.results.bioage.status, 'ok')

  // --- 2. one body-age number -----------------------------------------------------------------------
  const plain = await serve(loadRecord())
  const plainDir = tempDir('plain')
  profileIn(plainDir)
  mod.setMethodResults([
    methodRow(PHENO_SKILL, [{ key: 'phenoage', value: 19.95, unit: 'a' }, { key: 'phenoage_advance', value: -33.1, unit: 'a' }, { key: 'mortality_10y_pct', value: 1.2, unit: '%' }]),
    methodRow('aging-biomarker-framework', [{ key: 'blood_phenoage_age_deviation', value: -8.89, unit: 'a' }]),
    methodRow('biological-aging-generational-shifts', [{ key: 'phenoage_gap', value: -8.89, unit: 'a' }]),
  ])
  const plainConfig = configFor(plainDir, plain.url)
  const journey = await mod.buildJourney(await contextOf(plainConfig))
  const bio = journey.results.bioage
  assert.equal(bio.status, 'ok')
  assert.ok(journey.records.full_checkups >= 2)
  const pheno = journey.method_results.find((row) => row.skill === PHENO_SKILL)
  assert.equal(pheno.outputs.find((row) => row.key === 'phenoage').value, bio.phenoage, 'the method row carries the page\'s number')
  assert.equal(pheno.outputs.find((row) => row.key === 'phenoage_advance').value, bio.advance)
  assert.equal(typeof pheno.outputs.find((row) => row.key === 'mortality_10y_pct')?.value, 'number', 'the mortality output is not a body age and stays')
  for (const [skill, key] of [['aging-biomarker-framework', 'blood_phenoage_age_deviation'], ['biological-aging-generational-shifts', 'phenoage_gap']]) {
    const row = journey.method_results.find((item) => item.skill === skill)
    if (row) assert.equal(row.outputs.find((item) => item.key === key)?.value, bio.advance, `${skill} gap is the page's gap`)
  }
  const shown = String(Number(bio.phenoage.toFixed(1)))
  const facts = journey.triage.top_facts.filter((row) => row.id.startsWith('method-result'))
  const bodyFacts = facts.filter((row) => /身体年龄|周岁/.test(row.text_zh))
  assert.equal(bodyFacts.length, 1, `one body-age fact: ${facts.map((row) => row.text_zh).join(' | ')}`)
  assert.ok(bodyFacts[0].text_zh.includes(`身体年龄 ${shown} 岁`), bodyFacts[0].text_zh)
  assert.doesNotMatch(bodyFacts[0].text_zh, /19\.95|-8\.89/)
  const tool = fakeHost()
  await mod.apply(tool.ctx, plainConfig)
  const told = await tool.tools.get('read_personal_situation').execute({})
  const text = JSON.stringify(told)
  assert.doesNotMatch(text, /19\.95|8\.89/, 'no second figure reaches the model')
  for (const [key, want] of [['phenoage', bio.phenoage], ['phenoage_advance', bio.advance], ['blood_phenoage_age_deviation', bio.advance], ['phenoage_gap', bio.advance]]) {
    if (told.earlier_readouts[key]) assert.equal(told.earlier_readouts[key].value, want, `earlier_readouts.${key} is the page's figure`)
  }
  const toldPheno = told.method_results.find((row) => row.skill === PHENO_SKILL)
  assert.equal(toldPheno.outputs.find((row) => row.key === 'phenoage').value, bio.phenoage, 'the digit the tool gives the model is the page\'s')
  mod.setMethodResults([])

  assert.equal(versusCalendarAge(-8.89), '比周岁小 8.9 岁')
  assert.equal(versusCalendarAge(2.04), '比周岁大 2 岁')
  assert.equal(versusCalendarAge(0.2), '和周岁差不多')
  assert.equal(measuresBodyAge(methodRow('aging-biomarker-framework', [{ key: 'horvath_skin_blood_age_deviation', value: -1.4, unit: 'a' }])), false, 'a methylation clock is not the blood body age')
  // A skill run that disagrees with the page (another age, another day) is set to the page's figure.
  const aligned = alignBodyAge([
    methodRow(PHENO_SKILL, [{ key: 'phenoage', value: 19.95, unit: 'a' }, { key: 'phenoage_advance', value: -13.05, unit: 'a' }, { key: 'mortality_10y_pct', value: 1.2, unit: '%' }]),
    methodRow('aging-biomarker-framework', [{ key: 'horvath_skin_blood_age_deviation', value: null, unit: 'a' }, { key: 'blood_phenoage_age_deviation', value: -13.05, unit: 'a' }]),
  ], { status: 'ok', phenoage: 19.7, advance: -13.3 })
  assert.deepEqual(aligned[0].outputs.map((row) => row.value), [19.7, -13.3, 1.2])
  assert.deepEqual(aligned[1].outputs.map((row) => row.value), [null, -13.3])
  const oneDrawAligned = alignBodyAge([methodRow('biological-aging-generational-shifts', [{ key: 'phenoage_gap', value: -13.3, unit: 'a' }])], { status: 'ok', phenoage: 19.7, advance: null })
  assert.deepEqual(oneDrawAligned[0].outputs, [], 'one draw: no gap from a method either')
  const blocked = alignBodyAge([methodRow(PHENO_SKILL, [{ key: 'phenoage', value: 45.3, unit: 'a' }])], { status: 'blocked', phenoage: null, advance: null })
  assert.deepEqual(blocked[0].outputs, [], 'a blocked page leaves no body-age number on the method row')
  assert.match(bodyAgeFactText({ status: 'ok', phenoage: 31.93, advance: -8.89, headline_zh: '身体年龄算出来小了 5.9 岁（模型估计），主要来自平均红细胞体积变小。这一项变小不一定是好事，下次看医生时问一下。' }, 'verified'), /^身体年龄 31\.9 岁（模型估计，已核对），比周岁小 8\.9 岁。身体年龄算出来小了 5\.9 岁.*不一定是好事/)

  // --- 3. one draw: advance is null ---------------------------------------------------------------
  const single = await serve(oneDraw(loadRecord()))
  const singleDir = tempDir('single')
  profileIn(singleDir)
  const once = await mod.buildJourney(await contextOf(configFor(singleDir, single.url)))
  assert.equal(once.results.bioage.status, 'ok')
  assert.equal(once.results.bioage.checkups, 1)
  assert.equal(once.results.bioage.advance, null, 'one draw has no gap to print')
  assert.equal(once.results.bioage.allows_younger, false)
  assert.match(once.results.bioage.headline_zh, /一次|不能说|还不能/)

  // --- 4. the statin owns the lipid drop -------------------------------------------------------------
  const care = { stop: { stop: false, title_zh: '', sentence_zh: '', hits: [] }, findings: [], seen: [] }
  const ranked = rankTopFacts({
    care, hits: [], conditions: [], changes: [], goals: [],
    meds: [{ name: '阿托伐他汀钙片', classes: ['statin'] }, { name: '利伐沙班片', classes: ['anticoagulant'] }],
    methods: [methodRow('retinal-aging-biomarkers-longitudinal', [{ key: 'gap_years', value: 7.8, unit: '岁' }])],
  })
  const statin = ranked.find((row) => /他汀/.test(row.text_zh))
  assert.ok(statin, 'a statin fact')
  assert.equal(statin.priority, 'must_surface')
  assert.match(statin.text_zh, /阿托伐他汀钙片/)
  assert.match(statin.text_zh, /不算走路或方案的效果/)
  assert.ok(ranked.indexOf(statin) < ranked.findIndex((row) => row.rule === 'method.verified'), 'above a verified method result')
  assert.ok(ranked.findIndex((row) => row.id === 'safety-anticoagulant') < ranked.indexOf(statin), 'an anticoagulant stays above the statin line')

  // --- 5. a medicine that moves weight takes the kilogram figure out of the plan --------------------------
  const planDir = tempDir('plan')
  profileIn(planDir, { age: 41, focus: ['weight', 'cardio'] })
  const planConfig = configFor(planDir, plain.url)
  const noDrug = await mod.buildPlanBrief(await contextOf(planConfig, (records) => ({ ...records, medications: [] })), { focus: ['weight', 'cardio'] })
  const kgRows = noDrug.candidates.filter((row) => row.marker_key === 'weight' && /\d\s*kg/.test(row.expected_zh))
  assert.ok(kgRows.length > 0, 'a person on no such medicine keeps the trial kilograms')
  const withKg = mod.draftPlan(noDrug, { today: TODAY })
  assert.ok(withKg.items.some((item) => /\d\s*kg/.test(`${item.detail} ${item.evidence.expected_zh}`)) || withKg.goals.some((goal) => goal.unit === 'kg'), 'and a kilogram projection in the draft')
  assert.equal(noDrug.safety.weight_med, undefined)

  const startsSoon = (records) => ({
    ...records,
    medications: [{ name: '司美格鲁肽注射液', status: 'active', recorded_dose: '0.25mg', schedule: '每周一次', since: '2026-10-01' }],
  })
  const glp = await mod.buildPlanBrief(await contextOf(planConfig, startsSoon), { focus: ['weight', 'cardio'] })
  assert.equal(glp.safety.weight_med, '司美格鲁肽注射液', 'a prescription that starts inside the window counts')
  assert.ok(glp.safety.notes_zh.some((line) => /体重的变化主要会来自司美格鲁肽注射液/.test(line)), 'the attribution sentence')
  for (const row of glp.candidates.filter((item) => item.marker_key === 'weight')) {
    assert.doesNotMatch(row.expected_zh, KG, row.id)
    assert.match(row.expected_zh, /体重的变化主要会来自司美格鲁肽注射液/, row.id)
  }
  const glpDraft = mod.draftPlan(glp, { today: TODAY })
  for (const item of glpDraft.items) assert.doesNotMatch(JSON.stringify(item), KG, item.title)
  assert.equal(glpDraft.goals.some((goal) => goal.unit === 'kg' || /体重/.test(goal.marker)), false, 'no weight goal')
  const tre = glp.candidates.filter((row) => /限时进食|16:8/.test(row.intervention_zh))
  assert.ok(tre.length > 0, 'time-restricted eating is not blocked for a GLP-1 (concrete advice, not a blanket refusal)')
  for (const row of tre) {
    assert.ok(row.cautions_zh.some((line) => line.startsWith('先告诉开药的医生') && /恶心/.test(line) && /吃得少/.test(line)), row.id)
  }
  const later = await mod.buildPlanBrief(await contextOf(planConfig, (records) => ({
    ...records, medications: [{ name: '司美格鲁肽注射液', status: 'active', recorded_dose: '0.25mg', since: '2027-06-01' }],
  })), { focus: ['weight', 'cardio'] })
  assert.equal(later.safety.weight_med, undefined, 'a start date past the window is not this plan\'s')

  // SGLT2 is unchanged: no fasting or time-restricted eating at all.
  const sglt2 = await mod.buildPlanBrief(await contextOf(planConfig, (records) => ({
    ...records, medications: [{ name: '达格列净片', status: 'active', recorded_dose: '10mg', since: '2023-08-14' }],
  })), { focus: ['weight', 'cardio'] })
  assert.equal(sglt2.candidates.some((row) => /限时进食|time-restricted|16:8|断食/i.test(`${row.intervention_zh} ${row.id}`)), false)
  for (const row of sglt2.candidates.filter((item) => item.marker_key === 'weight')) assert.doesNotMatch(row.expected_zh, KG, row.id)

  // --- 6. iron deficiency names the gastroenterologist and a time frame; a falling haemoglobin alone does not --
  const pt = (name, value, unit, date) => ({ name, label: name, value, unit, date })
  const ironStop = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: [pt('血红蛋白', 150, 'g/L', '2024-01-01'), pt('血红蛋白', 114, 'g/L', '2026-05-18'), pt('平均红细胞体积', 72.4, 'fL', '2026-05-18'), pt('铁蛋白', 8, 'ng/mL', '2026-05-18')] })
  assert.match(ironStop.sentence_zh, /全科或血液科，缺铁的原因常要消化科一起查，尽量在 1 到 2 周内去/)
  const hbOnly = mod.clinicalStop({ sex: 'male', diabetesKnown: false, points: [pt('血红蛋白', 152, 'g/L', '2023-01-01'), pt('血红蛋白', 144, 'g/L', '2024-01-01'), pt('血红蛋白', 135, 'g/L', '2025-01-01')] })
  assert.match(hbOnly.sentence_zh, /全科或血液科，尽量在 1 到 2 周内去/)
  assert.doesNotMatch(hbOnly.sentence_zh, /消化科/)

  // --- 7. 总览: each fact once, the top fact first, one body-age card ------------------------------------
  const doctorJourney = {
    next: { action: 'doctor', title_zh: '请先去看医生：血红蛋白 114 g/L 偏低，平均红细胞体积 72.4 fL 偏低，铁蛋白 8 ng/mL 偏低', detail_zh: '' },
    doctor_first: { stop: true, hits: [{ key: 'hgb', short_zh: '血红蛋白 114 g/L 偏低' }, { key: 'mcv', short_zh: '平均红细胞体积 72.4 fL 偏低' }, { key: 'ferritin', short_zh: '铁蛋白 8 ng/mL 偏低' }] },
  }
  const covered = coveredByCare(doctorJourney)
  for (const row of [{ key: 'mch', label_zh: '平均红细胞血红蛋白含量' }, { key: 'hb', label_zh: '血红蛋白' }, { key: 'mchc', label_zh: '平均红细胞血红蛋白浓度' }]) assert.equal(isCovered(covered, row), true, row.label_zh)
  assert.equal(isCovered(covered, { key: 'hba1c', label_zh: '糖化血红蛋白' }), false, 'HbA1c is not a red-cell value')
  assert.equal(isCovered(coveredByCare({ ...doctorJourney, next: { action: 'plan', title_zh: '', detail_zh: '' } }), { key: 'hb', label_zh: '血红蛋白' }), false, 'no doctor card, nothing hidden')
  const client = (name) => readFileSync(new URL(`../src/client/${name}`, import.meta.url), 'utf8')
  const overview = client('overview.ts')
  assert.ok(overview.indexOf('h(CareCard') < overview.indexOf('h(InsightCard') && overview.indexOf('h(CareCard') < overview.indexOf('h(ScienceIntro'), '最重要的一步 is first on 总览')
  const changesSrc = client('changes.ts')
  assert.doesNotMatch(changesSrc, /caveat_zh|引用尚未逐字核对/, '判断依据 keeps one plain sentence and the source link')
  const resultsSrc = client('results.ts')
  assert.match(resultsSrc, /measuresBodyAge\(row\)/, 'body-age method results fold into the body-age card')
  assert.doesNotMatch(resultsSrc, /riskBindingNote/, 'the risk card shows no unmatched alternative next to its own number')

  console.log('int-062 ok (two people blocked; one body-age number; one draw has no gap; statin fact; weight medicine without kilograms; iron names 消化科; 总览 each fact once)')
} finally {
  mod.setMethodResults([])
  for (const server of servers) await server.close?.()
  for (const dir of temp) rmSync(dir, { recursive: true, force: true })
}
