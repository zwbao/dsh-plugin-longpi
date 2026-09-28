// FIX062: visible scrub, unreadable dates, diagnoses, method wording, body-age drivers.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { gradeBioAge } from '../src/feedback/grade.ts'
import { formatMeasure, plainSource, resultSentence, titleOf } from '../src/core/method-view.ts'
import { chineseDate } from '../src/client/format.ts'
import { isDiagnosisName, scrubVisible } from '../src/ux/plain.ts'
import { attributeDrivers, bodyAgeLines, bodyAgeStory, phenotypicAge } from '../src/ux/body-age.ts'
import { PRODUCT_VERSION } from '../src/version.ts'
import { narrateBioAge } from '../src/tracking.ts'
import { feedbackFor } from '../src/feedback/index.ts'

const root = dirname(fileURLToPath(import.meta.url))
const pkg = JSON.parse(readFileSync(join(root, '../package.json'), 'utf8'))
assert.equal(PRODUCT_VERSION, pkg.version)
assert.equal(PRODUCT_VERSION, '0.6.2')

const echoed = scrubVisible('已接入 Mirobody。Systolic blood pressure 148 mmHg。ChiCTR live 签署密钥 参考变化值 E78.5 http://127.0.0.1:18060/mcp/abc NaN undefined null')
assert.equal(echoed.includes('Mirobody'), false)
assert.equal(echoed.includes('ChiCTR'), false)
assert.equal(echoed.includes('签署密钥'), false)
assert.equal(echoed.includes('参考变化值'), false)
assert.equal(echoed.includes('127.0.0.1'), false)
assert.equal(echoed.includes('E78.5'), false)
assert.equal(/\blive\b/.test(echoed), false)
assert.equal(/\bNaN\b/.test(echoed), false)
assert.equal(/\bundefined\b/.test(echoed), false)
assert.equal(/\bnull\b/.test(echoed), false)
assert.equal(/[A-Za-z]+(?:\s+[A-Za-z]+){2,}/.test(echoed), false)
assert.match(scrubVisible('LongPi 用 DeepSeek'), /LongPi/)
assert.match(scrubVisible('LongPi 用 DeepSeek'), /DeepSeek/)

assert.equal(chineseDate(''), '')
assert.equal(chineseDate('not-a-date'), '')
assert.equal(chineseDate('2026-07'), '')
assert.equal(chineseDate('2026-07-27'), '7 月 27 日')

assert.equal(isDiagnosisName('血脂异常 E78.5'), true)
assert.equal(isDiagnosisName('脂肪肝 K76.0'), true)
assert.equal(isDiagnosisName('血红蛋白'), false)
assert.equal(isDiagnosisName('高血压 I10'), true)
assert.equal(isDiagnosisName('维生素B12'), false, 'a vitamin is a lab, not a diagnosis')
assert.equal(isDiagnosisName('维生素 B12'), false)
assert.equal(isDiagnosisName('CA125'), false)
assert.equal(isDiagnosisName('FT3'), false)

assert.equal(plainSource('Systolic blood pressure 148 mmHg'), '收缩压（高压）148')
assert.equal(formatMeasure(47.2, 'a', 'wearable_age').includes('a'), false)
assert.match(formatMeasure(47.2, 'a', 'wearable_age'), /岁/)
assert.equal(titleOf('unknown-skill', '可穿戴时钟'), '可穿戴时钟')
const unbound = resultSentence({
  skill: 'china-par-ascvd-risk',
  label: 'unverified-binding',
  outputs: [{ key: 'risk', value: 8.2, unit: '%' }],
  inputs_used: [{ input: 'sbp', source_row_id: 'row', value: 148, unit: 'mmHg', provenance: 'routine_lab', quote: 'Systolic blood pressure 148 mmHg' }],
  catalog_version: '2026.39.0',
  ran_at: '2026-09-28T00:00:00Z',
  limits_zh: '',
}, { youngerAllowed: false })
assert.match(unbound, /还没对上/)
assert.match(unbound, /收缩压（高压）148/)
assert.equal(unbound.includes('绑定未核对'), false)
assert.equal(/Systolic blood pressure/.test(unbound), false)

const base = {
  albumin_gL: 45, creat_umol: 70, glucose_mmol: 5.4, crp_mg_dl: 0.2,
  lymph_pct: 30, mcv_fl: 90, rdw_pct: 13, alp_u_l: 70, wbc_10e3: 6, age: 53,
}
const mcvDown = { ...base, mcv_fl: 78 }
const crpDown = { ...base, crp_mg_dl: 0.08, glucose_mmol: 4.8 }
assert.ok(phenotypicAge(base) != null)
const mcvDrivers = attributeDrivers(base, mcvDown, { cautions: ['mcv'] })
assert.equal(mcvDrivers[0]?.key, 'mcv_fl')
const concern = bodyAgeStory({
  deltaYears: -6.8, bandYears: 2.5, draws: 2, before: base, after: mcvDown, cautions: ['mcv'],
})
assert.ok(concern)
assert.equal(concern.allows_younger, false)
assert.match(concern.headline_zh, /算出来小了 6\.8 岁/)
assert.match(concern.headline_zh, /平均红细胞体积变小/)
assert.match(concern.headline_zh, /不一定是好事/)
assert.equal(concern.headline_zh.includes('你确实年轻了'), false)
assert.equal(bodyAgeLines(concern).page, bodyAgeLines(concern).chat)

const healthyDrivers = attributeDrivers(base, crpDown)
assert.ok(healthyDrivers.some((row) => row.key === 'crp_mg_dl' || row.key === 'glucose_mmol'))
const healthy = bodyAgeStory({
  deltaYears: -3.4, bandYears: 2.5, draws: 2, before: base, after: crpDown,
})
assert.ok(healthy)
assert.equal(healthy.allows_younger, true)
assert.match(healthy.headline_zh, /你确实年轻了 3\.4 岁/)
assert.equal(healthy.headline_zh.includes('不一定是好事'), false)
assert.equal(bodyAgeLines(healthy).page, healthy.chat_zh)

const gradedConcern = gradeBioAge({
  points: [{ date: '2026-01-01', phenoage: 60, advance: 7 }, { date: '2026-07-01', phenoage: 53.2, advance: 0.2 }],
  band_years: 2.5, band_verified: true, age: 53, phenoage: 53.2, advance: 0.2, date: '2026-07-01',
  draws: 2, same_lab: true, story_zh: concern.headline_zh, story_younger: false,
}, '2026-07-27')
assert.equal(gradedConcern.headline_zh, concern.headline_zh)
assert.equal(gradedConcern.allowed_claims.includes('younger'), false)

const gradedHealthy = gradeBioAge({
  points: [{ date: '2026-01-01', phenoage: 60, advance: 7 }, { date: '2026-07-01', phenoage: 56.6, advance: 3.6 }],
  band_years: 2.5, band_verified: true, age: 53, phenoage: 56.6, advance: 3.6, date: '2026-07-01',
  draws: 2, same_lab: true, story_zh: healthy.headline_zh, story_younger: true,
}, '2026-07-27')
assert.equal(gradedHealthy.headline_zh, healthy.headline_zh)
assert.equal(gradedHealthy.allowed_claims.includes('younger'), true)
assert.equal(bodyAgeStory({ deltaYears: -6.8, bandYears: 2.5, draws: 1, before: base, after: mcvDown }), null)

// narrateBioAge: the tracking step that writes the page sentence, and the chat reads the same sentence.
const drawPoints = (from, to) => [
  { date: '2021-05-11', phenoage: 36 + from, advance: from, mortality_10y_pct: 1 },
  { date: '2026-05-18', phenoage: 41 + to, advance: to, mortality_10y_pct: 1 },
]
const bioBase = {
  status: 'ok', note_zh: '身体年龄 36 岁（模型估计）。', missing: [], band_years: 3.1, band_verified: true, band_missing: [], runs: 0,
  headline_zh: '身体年龄 36 岁（模型估计）。按 2026-05-18 同一天的九项血检。你年轻了 4.8 岁，超出正常波动。', allows_younger: true, panel_span_days: 0,
}
const noDoctor = { stop: false, sentence_zh: '', title_zh: '', hits: [] }
const mcvChange = { key: 'mcv', label_zh: '平均红细胞体积', ask_doctor: true, caveat_zh: 'MCV 的个体内变异非常小' }
const told = narrateBioAge({ ...bioBase, points: drawPoints(-1, -5.8), pheno_compare: { before: { ...base, age: 37 }, after: { ...mcvDown, age: 41 } } }, [mcvChange], noDoctor, false)
assert.match(told.headline_zh, /^身体年龄算出来小了 \d+(\.\d)? 岁（模型估计），主要来自平均红细胞体积变小。这一项变小不一定是好事，下次看医生时问一下。/)
assert.equal(told.allows_younger, false)
assert.equal(told.headline_zh.includes('你确实年轻了'), false)
// A doctor-first hit on haemoglobin is enough, even without a change row.
const byHit = narrateBioAge({ ...bioBase, points: drawPoints(-1, -5.8), pheno_compare: { before: { ...base, age: 37 }, after: { ...mcvDown, age: 41 } } }, [], { ...noDoctor, hits: [{ key: 'hgb' }] }, false)
assert.match(byHit.headline_zh, /不一定是好事/)
// CRP carries a method note (caveat_zh) in the variation data; that note is not a health concern.
const crpChange = { key: 'crp', label_zh: '超敏C反应蛋白', ask_doctor: false, verdict: 'better', caveat_zh: '这个变异是在剔除轻微炎症期之后算的' }
const glucoseChange = { key: 'glucose', label_zh: '空腹血糖', ask_doctor: false, verdict: 'unclear' }
const cheered = narrateBioAge({ ...bioBase, points: drawPoints(-1, -5.8), pheno_compare: { before: { ...base, age: 37 }, after: { ...crpDown, age: 41 } } }, [crpChange, glucoseChange], noDoctor, false)
assert.match(cheered.headline_zh, /^你确实年轻了 4\.8 岁（模型估计，超出了测量波动，是真实的变化）。主要来自/)
assert.match(cheered.headline_zh, /超敏 C 反应蛋白变小|空腹血糖变小/)
assert.equal(cheered.allows_younger, true)
// Without a verified band the celebration waits; the wording already on the page stays.
const unverified = narrateBioAge({ ...bioBase, band_verified: false, points: drawPoints(-1, -5.8), pheno_compare: { before: { ...base, age: 37 }, after: { ...crpDown, age: 41 } } }, [], noDoctor, false)
assert.equal(unverified.headline_zh, bioBase.headline_zh)
// One draw: nothing to narrate.
assert.equal(narrateBioAge({ ...bioBase, points: drawPoints(-1, -5.8).slice(1), pheno_compare: null }, [mcvChange], noDoctor, false).headline_zh, bioBase.headline_zh)

// Page = chat: the chat's fact pack carries the graded body-age message, and it is the page sentence.
const trackingOf = (bioage) => ({ status: 'no_plan', today: '2026-07-27', plan: null, versions: [], items: [], suggestions: [], charts: [], bioage, models: [], checkins: [], reference: {}, errors: [], changes: [], changes_note_zh: '', changes_unjudged: [], doctor_first: noDoctor })
const chatConcern = feedbackFor(trackingOf(told), null).find((row) => row.id === 'fb-bioage')
assert.equal(chatConcern.headline_zh, told.headline_zh, 'the chat reads the page sentence')
assert.equal(chatConcern.allowed_claims.includes('younger'), false)
assert.equal(chatConcern.allowed_claims.includes('celebrate'), false)
const chatCheer = feedbackFor(trackingOf(cheered), null).find((row) => row.id === 'fb-bioage')
assert.equal(chatCheer.headline_zh, cheered.headline_zh)
assert.equal(chatCheer.allowed_claims.includes('younger'), true)

console.log('fix-062 ok')
