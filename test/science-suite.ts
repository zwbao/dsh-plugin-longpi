// M8: manifests, consent, local stats, differential privacy, secure aggregation, and the 37-person simulated cohort.

import assert from 'node:assert/strict'
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createAggregator } from '../tools/aggregator/server.mjs'
import { promptMatchesFile, researchInput } from '../src/agents/research_coordinator.ts'
import type { FactPack } from '../src/contracts/factpack.ts'
import { grantConsent, eligibility, withdrawConsent, readConsents } from '../src/science/consent-flow.ts'
import { addNoise, gaussianSigma, laplaceScale, seedFor } from '../src/science/dp.ts'
import { loadStudies } from '../src/science/manifest.ts'
import { designNOf1, wordingProblem } from '../src/science/nof1.ts'
import { extractOutcome } from '../src/science/outcomes.ts'
import { effectiveMode, scienceSummary, startScience } from '../src/science/index.ts'
import { encodeShare, fromFixed, generateMaskKey, maskFor, maskValue, toFixed } from '../src/science/secagg.ts'
import { nodeFromPersona, scheduleArms } from '../src/science/series.ts'
import { cvPercent, mean, pairedT } from '../src/science/stats.ts'
import { appendLog, readLog, verifyChain } from '../src/science/translog.ts'
import { blocksLive, isLocalAggregator, verifyManifest } from '../src/science/verify.ts'
import { peersFromPublic, recoverSum, runLocal } from '../src/science/runner.ts'

const root = mkdtempSync(join(tmpdir(), 'longpi-m8-'))
const personasDir = process.env.LONGPI_PERSONAS_DIR ?? ''

function tempDir(): string {
  const dir = mkdtempSync(join(root, 'p-'))
  mkdirSync(join(dir, 'science'), { recursive: true })
  return dir
}

const studies = loadStudies()
assert.equal(studies.length, 2)
for (const study of studies) {
  assert.equal(study.verify.ok, true, study.verify.ok ? '' : study.verify.reason)
  assert.equal(study.consent_hash_ok, true, study.manifest.id)
  assert.ok(study.manifest.data.excluded.includes('genetics'))
  assert.equal(study.manifest.eligibility.minors, false)
}
const rcv = studies.find((row) => row.manifest.id === 'rcv-calibration')
const walk = studies.find((row) => row.manifest.id === 'walk-timing-glucose')
assert.ok(rcv && walk)
assert.equal(blocksLive(walk.manifest), '还没有伦理委员会批件')
assert.equal(blocksLive({ ethics: { committee: '某医院', approval_id: 'EC-1', registry: { name: 'ChiCTR', id: null } } }), '还没有 ChiCTR 注册号')

const tampered = structuredClone(rcv.manifest)
tampered.title_zh = '被改过的标题'
assert.equal(verifyManifest(tampered).ok, false)
const noGenes = structuredClone(rcv.manifest)
noGenes.data = { ...noGenes.data, excluded: ['free_text', 'identifiers', 'images'] }
assert.match(verifyManifest(noGenes).ok ? '' : verifyManifest(noGenes).reason, /基因/)
const remote = structuredClone(rcv.manifest)
remote.endpoints = { aggregator: 'https://example.com/agg' }
assert.equal(isLocalAggregator(remote.endpoints.aggregator), false)
assert.match(verifyManifest(remote).ok ? '' : verifyManifest(remote).reason, /本机/)

startScience({ configured: () => 'off', dataDir: () => tempDir() })
assert.deepEqual(scienceSummary(), { mode: 'off', active_studies: 0 })
assert.equal(effectiveMode(), 'off')
startScience({ configured: () => 'live', dataDir: () => tempDir() })
assert.equal(effectiveMode(), 'off')
assert.equal(scienceSummary().mode, 'off')
startScience({ configured: () => 'simulated', dataDir: () => tempDir() })
assert.equal(effectiveMode(), 'simulated')

const dir = tempDir()
const wrong = grantConsent({
  dataDir: dir, manifest: rcv.manifest, manifest_sha256: rcv.sha256, confirm: true, explained_by: 'page', mode: 'simulated',
  answers: rcv.manifest.consent.comprehension.map((row) => ({ id: row.id, choice: 0 })),
})
assert.equal(wrong.ok, false)
if (!wrong.ok) assert.equal(wrong.comprehension.passed, false)
assert.equal(readConsents(dir).length, 0)
const right = grantConsent({
  dataDir: dir, manifest: rcv.manifest, manifest_sha256: rcv.sha256, confirm: true, explained_by: 'page', mode: 'simulated',
  answers: rcv.manifest.consent.comprehension.map((row) => ({ id: row.id, choice: row.correct })),
})
assert.equal(right.ok, true)
if (right.ok) {
  assert.equal(right.consent.comprehension?.passed, true)
  assert.match(right.consent.id, /^[a-z0-9][a-z0-9-]{5,63}$/)
}
assert.equal(verifyChain(readLog(dir)).ok, true)
const chain = readLog(dir)
chain[0]!.detail_zh = '篡改'
assert.equal(verifyChain(chain).ok, false)

assert.equal(eligibility(rcv.manifest, { age: 16, sex: 'male', conditions: [], drug_classes: [] }).ok, false)
assert.equal(eligibility(rcv.manifest, { age: null, sex: 'female', conditions: [], drug_classes: [] }).ok, false)
assert.equal(eligibility(walk.manifest, { age: 40, sex: 'female', conditions: [], drug_classes: ['insulin'] }).ok, false)
assert.equal(eligibility(walk.manifest, { age: 40, sex: 'male', conditions: ['pregnancy'], drug_classes: [] }).ok, false)
assert.equal(eligibility(rcv.manifest, { age: 41, sex: 'male', conditions: [], drug_classes: [] }).ok, true)

const ran = runLocal({
  dataDir: dir,
  manifest: rcv.manifest,
  clientId: 'local',
  series: { markers: { glucose: [{ day: '2024-01-01', value: 5.6 }, { day: '2025-01-01', value: 5.4 }, { day: '2026-01-01', value: 5.5 }] } },
})
assert.equal(ran.ok, true)
if (ran.ok) {
  assert.equal(ran.result.raw_values_left_device, false)
  assert.equal(ran.result.released, false)
  assert.ok(ran.local_only.some((row) => row.key === 'glucose'))
  assert.equal(wordingProblem(ran.give_back_zh), null)
}
mkdirSync(join(dir, 'science', 'outbox'), { recursive: true })
writeFileSync(join(dir, 'science', 'outbox', 'pending.json'), JSON.stringify({ study_id: 'rcv-calibration', released: false }))
const left = withdrawConsent(dir, rcv.manifest)
assert.equal(left.ok, true)
if (left.ok) assert.equal(left.deleted, 1)
assert.equal(existsSync(join(dir, 'science', 'outbox', 'pending.json')), false)

const seed = seedFor(['fixed'])
const once = addNoise(8, { mechanism: 'laplace', epsilon: 1, delta: 0, clip: [0, 40], seed })
const twice = addNoise(8, { mechanism: 'laplace', epsilon: 1, delta: 0, clip: [0, 40], seed })
assert.equal(once.value, twice.value)
assert.notEqual(once.value, addNoise(8, { mechanism: 'laplace', epsilon: 1, delta: 0, clip: [0, 40], seed: seedFor(['other']) }).value)
assert.equal(addNoise(80, { mechanism: 'laplace', epsilon: 1, delta: 0, clip: [0, 40], seed }).clipped, true)
assert.equal(laplaceScale(40, 2), 20)
assert.ok(gaussianSigma(10, 1, 1e-6) > laplaceScale(10, 1))

const values = [1.25, -0.5, 3, 0.25, -2]
const keys = values.map(() => generateMaskKey())
const ids = values.map((_, index) => `p${String(index + 1).padStart(2, '0')}`)
const peers = peersFromPublic(ids.map((id, index) => ({ id, public_b64: keys[index]!.publicRaw.toString('base64') })))
const masked = values.map((value, index) => maskValue(value, maskFor(keys[index]!.secret, ids[index]!, peers, 'round-a', 'cv')))
assert.ok(Math.abs(recoverSum(masked.map((row) => encodeShare(row).masked_b64)) - values.reduce((sum, value) => sum + fromFixed(toFixed(value)), 0)) < 1e-6)

const said = extractOutcome('晚饭后走了20分钟，血糖 6.4', '2026-09-28')
assert.equal(said?.arm, 'after_dinner')
assert.equal(said?.value, 6.4)
assert.equal(said?.minutes, 20)
assert.equal(extractOutcome('今天有点累', '2026-09-28'), null)
const designed = designNOf1({
  today: '2026-09-28',
  glucose: { morning: [5.1, 5.2, 5.0, 5.3], after_dinner: [5.8, 6.0, 5.9, 6.1] },
})
assert.equal(designed.design, 'abab')
assert.equal(wordingProblem(designed.protocol_zh + designed.result_zh), null)
assert.match(designed.result_zh, /早晨走/)
assert.equal(designed.schedule.filter((row) => row.role === 'treatment').length, 4)
assert.ok(designed.schedule.some((row) => row.role === 'washout'))
const t = pairedT([5.1, 5.2, 5.0, 5.3], [5.8, 6.0, 5.9, 6.1])
assert.ok(t && t[0] > 0)

const named = researchInput({ person: { display_name: '周衡', age: 41, sex: 'male' }, today: '2026-09-28', science: { mode: 'simulated', active_studies: 0 } } as FactPack, {
  kind: 'give_back', study_id: 'rcv-calibration', text_zh: rcv.text_zh, numbers: [{ key: 'glucose.cv', text: '6.2' }], passed: false,
})
assert.equal(JSON.stringify(named).includes('周衡'), false)
assert.equal(promptMatchesFile(), true)

if (!personasDir || !existsSync(personasDir)) {
  console.log('science suite ok (persona cohort skipped; LONGPI_PERSONAS_DIR is unset)')
  rmSync(root, { recursive: true, force: true })
} else {
const files = readdirSync(personasDir).filter((name) => /^p\d\d\.json$/.test(name)).sort()
assert.equal(files.length, 37)
const nodes = files.map((name) => nodeFromPersona(JSON.parse(readFileSync(join(personasDir, name), 'utf8')) as Record<string, unknown>))
assert.equal(nodes.length, 37)
assert.ok(nodes.every((node) => (node.age ?? 0) >= 18))

function cvOf(node: { markers: Record<string, Array<{ value: number }>> }, key: string): number | null {
  return cvPercent((node.markers[key] ?? []).map((point) => point.value))?.cv_pct ?? null
}

function mae(errors: number[]): number {
  return errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length
}

const markerKeys = ['glucose', 'hb', 'hba1c', 'tc', 'ldl', 'hdl', 'tg', 'creatinine', 'sbp', 'albumin']
const epsilons = [1, 2, 4]
const seeds = 30
const report: Record<string, unknown> = { people: 37, mechanism: {}, walk: {} }
const byMarker: Record<string, { n: number; true_mean: number; mae: Record<string, number> }> = {}
for (const key of markerKeys) {
  const truth = nodes.map((node) => cvOf(node, key)).filter((value): value is number => value != null)
  if (truth.length < 8) continue
  const trueMean = mean(truth) ?? 0
  const row: { n: number; true_mean: number; mae: Record<string, number> } = { n: truth.length, true_mean: trueMean, mae: {} }
  for (const epsilon of epsilons) {
    const errors: number[] = []
    for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
      const noisy: number[] = []
      nodes.forEach((node) => {
        const value = cvOf(node, key)
        if (value == null) return
        noisy.push(addNoise(value, { mechanism: 'laplace', epsilon, delta: 0, clip: [0, 40], seed: seedFor([node.id, key, String(epsilon), String(seedIndex)]) }).value)
      })
      errors.push((mean(noisy) ?? 0) - trueMean)
    }
    row.mae[String(epsilon)] = mae(errors)
  }
  byMarker[key] = row
  assert.ok(row.mae['4']! < row.mae['1']!, `${key} ε=4 should lose less accuracy than ε=1 (${row.mae['4']} vs ${row.mae['1']})`)
}
report.markers = byMarker

const walkRows = nodes.flatMap((node) => {
  if (!eligibility(walk.manifest, node).ok) return []
  const arms = scheduleArms(node.markers.glucose ?? [])
  if (arms.morning.length < 2 || arms.after_dinner.length < 2) return []
  const diff = (mean(arms.after_dinner) ?? 0) - (mean(arms.morning) ?? 0)
  return [{ id: node.id, diff }]
})
const walkTruth = mean(walkRows.map((row) => row.diff)) ?? 0
const walkMae: Record<string, number> = {}
for (const epsilon of epsilons) {
  const errors: number[] = []
  for (let seedIndex = 0; seedIndex < seeds; seedIndex += 1) {
    const noisy = walkRows.map((row) => addNoise(row.diff, { mechanism: 'gaussian', epsilon, delta: 1e-6, clip: [-5, 5], seed: seedFor([row.id, 'walk', String(epsilon), String(seedIndex)]) }).value)
    errors.push((mean(noisy) ?? 0) - walkTruth)
  }
  walkMae[String(epsilon)] = mae(errors)
}
assert.ok(walkRows.length >= 20, `walk contributors ${walkRows.length}`)
assert.ok(walkMae['4']! < walkMae['1']!, `walk ε ${JSON.stringify(walkMae)}`)
report.walk = {
  contributors: walkRows.length,
  excluded_note: 'Arms are alternating checkups, a simulation schedule so the noise can be measured. The files have no timed walks. Insulin, sulfonylurea and pregnancy are excluded.',
  true_mean_diff: walkTruth,
  mae: walkMae,
  clip: [-5, 5],
  mechanism: 'gaussian',
  delta: 1e-6,
}

const app = createAggregator()
const base = await app.listen(0)
const glucoseTruth = nodes.map((node) => ({ id: node.id, value: cvOf(node, 'glucose') })).filter((row): row is { id: string; value: number } => row.value != null)
assert.ok(glucoseTruth.length >= 20)
const httpEpsilons: Record<string, { n: number; recovered_mean: number; noisy_mean: number; true_mean: number; abs_error: number }> = {}
for (const epsilon of epsilons) {
  const opened = await fetch(`${base}/v1/rounds`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ study_id: 'rcv-calibration', stat_key: 'rcv_calibration:glucose', min_cohort: 20, epsilon }) })
  const round = await opened.json() as { round_id: string }
  const localKeys = glucoseTruth.map(() => generateMaskKey())
  for (let index = 0; index < glucoseTruth.length; index += 1) {
    const joined = await fetch(`${base}/v1/rounds/${round.round_id}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: glucoseTruth[index]!.id, public_b64: localKeys[index]!.publicRaw.toString('base64') }) })
    assert.equal((await joined.json() as { ok: boolean }).ok, true)
  }
  const refused = await fetch(`${base}/v1/rounds/${round.round_id}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'p99', public_b64: localKeys[0]!.publicRaw.toString('base64'), glucose: [5.1, 5.2] }) })
  assert.equal((await refused.json() as { ok: boolean }).ok, false)
  const state = await (await fetch(`${base}/v1/rounds/${round.round_id}`)).json() as { participants: Array<{ client_id: string; public_b64: string }> }
  const peers = peersFromPublic(state.participants)
  const noised = glucoseTruth.map((row) => addNoise(row.value, { mechanism: 'laplace', epsilon, delta: 0, clip: [0, 40], seed: seedFor([row.id, 'http', String(epsilon)]) }).value)
  for (let index = 0; index < glucoseTruth.length; index += 1) {
    const mask = maskFor(localKeys[index]!.secret, glucoseTruth[index]!.id, peers, round.round_id, 'rcv_calibration:glucose')
    const encoded = encodeShare(maskValue(noised[index]!, mask))
    const posted = await fetch(`${base}/v1/rounds/${round.round_id}/share`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ client_id: glucoseTruth[index]!.id, masked_b64: encoded.masked_b64, commitment: encoded.commitment }),
    })
    assert.equal((await posted.json() as { ok: boolean }).ok, true, glucoseTruth[index]!.id)
  }
  const fin = await (await fetch(`${base}/v1/rounds/${round.round_id}/finalize`, { method: 'POST' })).json() as { released: boolean; mean: number; n: number; sum: number }
  assert.equal(fin.released, true)
  const noisyMean = mean(noised) ?? 0
  assert.ok(Math.abs(fin.mean - noisyMean) < 1e-4, `secagg ${fin.mean} vs ${noisyMean}`)
  const trueMean = mean(glucoseTruth.map((row) => row.value)) ?? 0
  httpEpsilons[String(epsilon)] = { n: fin.n, recovered_mean: fin.mean, noisy_mean: noisyMean, true_mean: trueMean, abs_error: Math.abs(fin.mean - trueMean) }
}
await app.close()
report.http_glucose_cv = { mechanism: 'laplace', clip: [0, 40], seeds: 'one seeded round per epsilon through the local aggregator', epsilons: httpEpsilons }
report.reading = 'mae is the mean absolute error of the cohort-mean statistic across 30 seeds, in the same unit as the statistic (CV percent points, or mmol/L for the walk difference). Secure aggregation matched the noisy sum; the error is the differential-privacy noise.'
if (process.env.LONGPI_DP_REPORT) writeFileSync(process.env.LONGPI_DP_REPORT, JSON.stringify(report, null, 2))
console.log(JSON.stringify({ markers: Object.fromEntries(Object.entries(byMarker).map(([key, row]) => [key, row.mae])), walk: walkMae, http: httpEpsilons }, null, 2))
rmSync(root, { recursive: true, force: true })
console.log('science suite ok')
}
