// Science v2: threshold aggregation, privacy budget, cold start, N-of-1, lab metadata, claims export, registry.

import assert from 'node:assert/strict'
import { spawnSync } from 'node:child_process'
import { createPrivateKey } from 'node:crypto'
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { request as httpsRequest } from 'node:https'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { RELEASE_STAYS_ZH, spentEpsilon, tryRelease } from '../src/science/budget.ts'
import { claimFromRelease, claimProblems, writeClaimsExport } from '../src/science/claims-export.ts'
import { releaseLine } from '../src/science/coldstart.ts'
import { buildCommunity } from '../src/science/community.ts'
import { grantConsent, withdrawConsent } from '../src/science/consent-flow.ts'
import { pollManifestFeed, signFeed, verifyFeed } from '../src/science/feed.ts'
import { devKeyAllowed, generateEd25519, keyCertOk, publicFromB64, signKeyCert } from '../src/science/keyring.ts'
import { labIdOf, listLabMethods, parseLabMethod, primarySameLabPair, rememberLabMethod } from '../src/science/labmeta.ts'
import { loadStudies } from '../src/science/manifest.ts'
import { designNOf1, firstArm, publicNOf1, wordingProblem } from '../src/science/nof1.ts'
import { studentTCdf } from '../src/science/nof1-model.ts'
import { communityHtml } from '../src/science/page-html.ts'
import { createProdAggregator, readExampleConfig } from '../src/science/prod-aggregator.ts'
import { analysisCodeHash, buildRegistry, registryHtml } from '../src/science/registry-page.ts'
import { publishLocalRelease } from '../src/science/runner.ts'
import { shamirReconstruct, shamirSplit } from '../src/science/shamir.ts'
import { simulateCohort } from '../src/science/simulate.ts'
import { dealRound, fieldRng, finishRound, isMasked, thresholdFor } from '../src/science/threshold.ts'
import { exportTransparency } from '../src/science/translog.ts'
import { effectiveMode, startScience } from '../src/science/index.ts'
import { SIM_KEY_ID } from '../src/science/verify.ts'
import { ingestDocument } from '../src/datain/upload.ts'

const root = mkdtempSync(join(tmpdir(), 'longpi-s2-'))
function tempDir(): string {
  const dir = mkdtempSync(join(root, 'p-'))
  mkdirSync(join(dir, 'science'), { recursive: true })
  return dir
}
function fixedSum(values: readonly number[]): number {
  return values.reduce((sum, value) => sum + Math.round(value * 1_000_000), 0) / 1_000_000
}
function addDays(day: string, days: number): string {
  const date = new Date(`${day}T12:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

const secret = 42n
const shares = shamirSplit(secret, 10, 7, fieldRng(7))
assert.equal(shamirReconstruct(shares.slice(0, 7), 7), secret)
assert.equal(shamirReconstruct(shares.slice(3), 7), secret)

const rows = Array.from({ length: 20 }, (_, index) => ({ id: `n${index}`, value: index === 3 ? -1.5 : index * 0.25 }))
const round = dealRound(rows, thresholdFor(20, 0.3), fieldRng(11))
for (const rate of [0.1, 0.2, 0.3]) {
  const dropped = rows.filter((_, index) => index % Math.round(1 / rate) === 0).map((row) => row.id).slice(0, Math.round(20 * rate))
  const finished = finishRound(round, dropped)
  assert.equal(finished.ok, true, `dropout ${rate}`)
  if (!finished.ok) continue
  const kept = rows.filter((row) => !dropped.includes(row.id)).map((row) => row.value)
  assert.ok(Math.abs(finished.sum - fixedSum(kept)) < 1e-6, `sum ${rate}`)
  assert.equal(isMasked(kept[0] ?? 0, BigInt(finished.server.masked[0]?.masked ?? '0')), true)
  const again = finished.server.masked.reduce((sum, row) => sum + BigInt(row.masked), 0n)
  assert.notEqual(again, 0n)
}
const tooMany = rows.slice(0, 8).map((row) => row.id)
const closed = finishRound(round, tooMany)
assert.equal(closed.ok, false)
if (!closed.ok) assert.equal(closed.reason, 'threshold')

const budgetDir = tempDir()
const first = tryRelease(budgetDir, { study_id: 'rcv-calibration', query: 'glucose', epsilon: 2, cap: 3, at: '2026-09-28T00:00:00Z' })
assert.equal(first.ok, true)
assert.equal(first.statement_zh, RELEASE_STAYS_ZH)
const retry = tryRelease(budgetDir, { study_id: 'rcv-calibration', query: 'glucose', epsilon: 2, cap: 3 })
assert.equal(retry.ok, true)
assert.equal(spentEpsilon(budgetDir), 2)
const over = tryRelease(budgetDir, { study_id: 'walk-timing-glucose', query: 'glucose', epsilon: 2, cap: 3 })
assert.equal(over.ok, false)
const fit = tryRelease(budgetDir, { study_id: 'walk-timing-glucose', query: 'glucose', epsilon: 1, cap: 3 })
assert.equal(fit.ok, true)
assert.equal(spentEpsilon(budgetDir), 3)
const closeDir = tempDir()
assert.equal(tryRelease(closeDir, { study_id: 'rcv-calibration', query: 'hb', epsilon: 1, cap: 10 }).ok, true)
const studies = loadStudies()
const rcv = studies.find((row) => row.manifest.id === 'rcv-calibration')
assert.ok(rcv)
const consented = grantConsent({
  dataDir: closeDir, manifest: rcv.manifest, manifest_sha256: rcv.sha256, confirm: true, explained_by: 'page', mode: 'simulated',
  answers: rcv.manifest.consent.comprehension.map((row) => ({ id: row.id, choice: row.correct })),
})
assert.equal(consented.ok, true)
mkdirSync(join(closeDir, 'science', 'outbox'), { recursive: true })
writeFileSync(join(closeDir, 'science', 'outbox', 'keep.json'), JSON.stringify({ study_id: 'rcv-calibration', released: false, share: { masked_b64: 'AA==' } }))
const published = publishLocalRelease(closeDir, 'keep', { study_id: 'rcv-calibration', query: 'hb', epsilon: 1 })
assert.equal(published.ok, true)
writeFileSync(join(closeDir, 'science', 'outbox', 'drop.json'), JSON.stringify({ study_id: 'rcv-calibration', released: false }))
const left = withdrawConsent(closeDir, rcv.manifest, '2026-09-28T01:00:00Z')
assert.equal(left.ok, true)
if (left.ok) {
  assert.equal(left.released_stays, true)
  assert.match(left.statement_zh, /已发出的合计无法收回/)
  assert.equal(left.deleted, 1)
}
assert.equal(existsSync(join(closeDir, 'science', 'outbox', 'keep.json')), true)
assert.equal(JSON.parse(readFileSync(join(closeDir, 'science', 'outbox', 'keep.json'), 'utf8')).released, true)
assert.equal(existsSync(join(closeDir, 'science', 'outbox', 'drop.json')), false)
const after = tryRelease(closeDir, { study_id: 'rcv-calibration', query: 'ldl', epsilon: 1, cap: 10 })
assert.equal(after.ok, false)
if (!after.ok) assert.match(after.reason_zh, /退出/)
assert.equal(tryRelease(closeDir, { study_id: 'walk-timing-glucose', query: 'glucose', epsilon: 1, cap: 10 }).ok, true)

assert.equal(devKeyAllowed('live', true), false)
assert.equal(devKeyAllowed('simulated', true), true)
assert.equal(devKeyAllowed('off', true), false)
const rootKey = generateEd25519()
const feedA = generateEd25519()
const feedB = generateEd25519()
const certA = signKeyCert(rootKey.privateKey, { key_id: 'longpi-prod-2026a', public_b64: feedA.public_b64, not_before: '2026-01-01', not_after: '2026-12-31' })
const certB = signKeyCert(rootKey.privateKey, { key_id: 'longpi-prod-2027b', public_b64: feedB.public_b64, not_before: '2026-01-01', not_after: '2027-12-31' })
assert.equal(keyCertOk(publicFromB64(rootKey.public_b64), certA, '2026-09-28').ok, true)
assert.equal(keyCertOk(publicFromB64(rootKey.public_b64), certA, '2027-02-01').ok, false)
assert.equal(keyCertOk(publicFromB64(rootKey.public_b64), certB, '2027-02-01').ok, true)
const feed = signFeed({ issued_at: '2026-09-28T00:00:00Z', analysis_sha256: 'abc', manifests: [{ id: 'rcv-calibration' }] }, certA.key_id, feedA.privateKey)
assert.equal(verifyFeed(feed, { mode: 'simulated', acceptDevKey: false, publicKeys: { [certA.key_id]: publicFromB64(feedA.public_b64) } }).ok, true)
assert.equal(verifyFeed(feed, { mode: 'live', acceptDevKey: false, publicKeys: {} }).ok, false)
const devFeed = signFeed(
  { issued_at: feed.issued_at, analysis_sha256: feed.analysis_sha256, manifests: feed.manifests },
  SIM_KEY_ID,
  createPrivateKey(readFileSync(fileURLToPath(new URL('../tools/aggregator/dev-signing-key.pem', import.meta.url)))),
)
assert.equal(verifyFeed(devFeed, { mode: 'live', acceptDevKey: true, publicKeys: {} }).ok, false)
assert.equal(verifyFeed(devFeed, { mode: 'simulated', acceptDevKey: true, publicKeys: {} }).ok, true)

assert.equal(releaseLine(1284, 3000), '1,284 / 3,000，到达后所有人一起看到答案')
const pageDir = tempDir()
writeFileSync(join(pageDir, 'science', 'cohort.json'), JSON.stringify({ studies: { 'rcv-calibration': { enrolled: 1284, threshold: 3000 } } }))
const view = buildCommunity({ dataDir: pageDir, configured: 'simulated' })
const html = communityHtml(view)
assert.match(html, /1,284 \/ 3,000，到达后所有人一起看到答案/)
assert.match(html, /id="cold-start"/)
assert.match(html, /开始个人对照/)
assert.equal(html.includes('position:fixed'), false)
assert.match(html, /已发出的合计无法收回/)
const registry = buildRegistry({ mode: 'simulated', enrolled: { 'rcv-calibration': 1284 }, released: {} })
const registryPage = registryHtml(registry)
assert.match(registryPage, new RegExp(registry.analysis_sha256))
assert.match(registryPage, /longpi-sim-dev-1/)
assert.equal(registryPage.includes('"correct"'), false)
assert.equal(registry.live_refused, true)
assert.equal(analysisCodeHash(), registry.analysis_sha256)
startScience({ configured: () => 'live', dataDir: () => pageDir })
assert.equal(effectiveMode(), 'off')

const same = designNOf1({ today: '2026-09-28', seed: 'alpha' })
const again = designNOf1({ today: '2026-09-28', seed: 'alpha' })
assert.equal(same.schedule[0]?.arm, again.schedule[0]?.arm)
assert.equal(same.schedule.filter((row) => row.role === 'treatment').length, 4)
assert.ok(same.schedule.some((row) => row.role === 'washout'))
let flipped = false
const arm = firstArm('alpha')
for (let i = 0; i < 30; i += 1) if (firstArm(`beta-${i}`) !== arm) flipped = true
assert.equal(flipped, true)
assert.equal(JSON.stringify(publicNOf1(same)).includes(same.seed), false)
assert.equal(same.quest.rarity_from_labs, false)
assert.equal(same.quest.codex.money, 'none')
assert.equal(same.quest.codex.minors, 'off')
assert.equal(same.quest.reward.draws, 1)
assert.equal(wordingProblem(same.protocol_zh + same.result_zh + same.stopping.reason_zh), null)
assert.ok(Math.abs(studentTCdf(0, 10) - 0.5) < 1e-6)
assert.ok(Math.abs(studentTCdf(2.228, 10) - 0.975) < 0.01)

const readings: Array<{ day: string; value: number }> = []
for (const block of same.schedule) {
  if (block.role === 'washout') {
    readings.push({ day: block.from, value: 20 })
    continue
  }
  readings.push({ day: block.from, value: 20 })
  readings.push({ day: addDays(block.from, 1), value: 20 })
  const kept = block.arm === 'morning' ? 5 : 6
  readings.push({ day: addDays(block.from, 2), value: kept })
  readings.push({ day: addDays(block.from, 3), value: kept })
}
const analysed = designNOf1({ today: '2026-09-28', seed: 'alpha', readings, carryover_days: 2, mcid: 0.3 })
assert.ok(analysed.posterior)
assert.ok(Math.abs((analysed.posterior?.mean ?? 0) - (same.schedule.find((row) => row.role === 'treatment' && row.arm === 'after_dinner') ? 1 : -1)) < 0.05)
assert.equal(analysed.stopping.decision, 'stop_difference')
const flat = readings.map((row) => ({ ...row, value: row.value === 20 ? 20 : 5.5 }))
const futile = designNOf1({ today: '2026-09-28', seed: 'alpha', readings: flat, carryover_days: 2, mcid: 0.3 })
assert.equal(futile.stopping.decision, 'stop_futility')
assert.equal(wordingProblem(analysed.result_zh + futile.result_zh), null)

const labDir = tempDir()
const parsed = parseLabMethod({ lab_name: '合成检验所甲', method: '己糖激酶法', analyser: '合成分析仪' })
assert.ok(parsed)
assert.equal(parseLabMethod({ lab_name: 'a', method: '己糖激酶法' }), null)
const remembered = rememberLabMethod(labDir, { sha256: 'abc', ...parsed })
assert.equal(remembered.lab_id, labIdOf('合成检验所甲'))
assert.equal(listLabMethods(labDir).length, 1)
const pair = primarySameLabPair([
  { day: '2024-01-01', value: 5.1, lab_id: remembered.lab_id, method: '己糖激酶法' },
  { day: '2024-02-01', value: 9, lab_id: 'lab-other', method: '己糖激酶法' },
  { day: '2024-08-01', value: 5.4, lab_id: 'lab-other', method: '己糖激酶法' },
  { day: '2025-01-15', value: 5.2, lab_id: remembered.lab_id, method: '葡萄糖氧化酶法' },
  { day: '2025-03-01', value: 5.3, lab_id: remembered.lab_id, method: '己糖激酶法' },
])
assert.equal(pair?.earlier.day, '2024-01-01')
assert.equal(pair?.later.day, '2025-03-01')
assert.equal(primarySameLabPair([{ day: '2024-01-01', value: 5, lab_id: 'lab-a', method: 'm' }, { day: '2024-02-01', value: 5, lab_id: 'lab-a', method: 'm' }]), null)
await ingestDocument({
  config: () => ({ mcpUrl: '', mcpToken: '' }) as never,
  dataDir: () => labDir,
  bus: { emit() {} } as never,
  invalidate() {},
}, { filename: 'note.txt', text: '2026-01-02 空腹血糖 5.4。这是一份合成记录。', upload: false, lab_name: '合成检验所甲', method: '己糖激酶法' })
assert.ok(listLabMethods(labDir).some((row) => row.method === '己糖激酶法' && row.sha256 !== 'abc'))

const claim = claimFromRelease({ study_id: 'rcv-calibration', marker: 'glucose', marker_zh: '空腹血糖', estimate: 4.8123, n: 350, epsilon: 1, unit: '%' })
assert.deepEqual(claimProblems(claim), [])
const written = writeClaimsExport(tempDir(), [claim])
assert.equal(written.submitted, false)
const skillsHome = process.env.LONGEVITY_SKILLS_HOME
if (skillsHome && existsSync(join(skillsHome, 'schema', 'claim.schema.json'))) {
  const schema = JSON.parse(readFileSync(join(skillsHome, 'schema', 'claim.schema.json'), 'utf8')) as { required: string[]; properties: Record<string, unknown> }
  for (const key of schema.required) assert.ok(key in claim, key)
  for (const key of Object.keys(claim)) assert.ok(key in schema.properties, key)
}
const exported = exportTransparency([{ seq: 1, at: '2026-09-28T00:00:00Z', kind: 'withdraw', study_id: 'rcv-calibration', digest: 'a', prev: 'b', detail_zh: '退出。' }])
const exportedRow = JSON.parse(exported.trim()) as Record<string, unknown>
assert.deepEqual(Object.keys(exportedRow).sort(), ['at', 'detail_zh', 'digest', 'kind', 'prev', 'seq', 'study_id'])

const example = readExampleConfig(fileURLToPath(new URL('../tools/aggregator/config.example.json', import.meta.url)))
assert.equal(example.region, 'cn-mainland')
assert.equal(example.accept_dev_key, false)
assert.equal(example.tls_required, true)
assert.match(example.root_public_b64, /^REPLACE/)
const refused = spawnSync(process.execPath, ['--experimental-transform-types', '--no-warnings', fileURLToPath(new URL('../tools/aggregator/prod-server.mjs', import.meta.url)), `--config=${fileURLToPath(new URL('../tools/aggregator/config.example.json', import.meta.url))}`], { encoding: 'utf8' })
assert.equal(refused.status, 2)

function prodConfig(extra: { max?: number; acceptDev?: boolean; tls?: { required: boolean; cert_pem?: string; key_pem?: string } } = {}) {
  return {
    region: 'cn-mainland' as const,
    host: '127.0.0.1',
    port: 0,
    tls: extra.tls ?? { required: false },
    rate_limit: { window_ms: 60_000, max: extra.max ?? 10_000 },
    accept_dev_key: extra.acceptDev ?? false,
    root_public_b64: rootKey.public_b64,
    feed_key_id: certB.key_id,
    keys: [certA, certB],
    icp_note_zh: '测试骨架，不接收真实参与者。',
  }
}
const readyApp = createProdAggregator({ config: prodConfig(), feedPrivateKey: feedB.privateKey, today: '2026-09-28' })
const readyBase = await readyApp.listen(0)
const health = await (await fetch(`${readyBase}/healthz`)).json() as { ok: boolean; live: boolean; region: string }
assert.equal(health.ok, true)
assert.equal(health.live, false)
assert.equal(health.region, 'cn-mainland')
const ready = await fetch(`${readyBase}/readyz`)
assert.equal(ready.status, 200)
readyApp.setManifests([{ id: 'rcv-calibration', version: '1', title_zh: '波动', signature: { key_id: 'longpi-prod-2027b' }, analysis: { release: { min_cohort: 400 } } }])
const fed = await pollManifestFeed(`${readyBase}/v1/manifests`, {
  mode: 'live', acceptDevKey: false, publicKeys: { [certB.key_id]: publicFromB64(feedB.public_b64) },
})
assert.equal(fed.ok, true)
const devApp = createProdAggregator({
  config: { ...prodConfig(), feed_key_id: SIM_KEY_ID, accept_dev_key: false, keys: [] },
  today: '2026-09-28',
})
const devBase = await devApp.listen(0)
assert.equal((await fetch(`${devBase}/v1/manifests`)).status, 403)
assert.equal((await fetch(`${devBase}/readyz`)).status, 503)
const limited = createProdAggregator({ config: prodConfig({ max: 2 }), feedPrivateKey: feedB.privateKey, today: '2026-09-28' })
const limitedBase = await limited.listen(0)
assert.equal((await fetch(`${limitedBase}/healthz`)).status, 200)
assert.equal((await fetch(`${limitedBase}/readyz`)).status, 200)
assert.equal((await fetch(`${limitedBase}/readyz`)).status, 200)
assert.equal((await fetch(`${limitedBase}/readyz`)).status, 429)
const marker = '9876543210987'
const opened = await (await fetch(`${readyBase}/v1/rounds`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ study_id: 'rcv-calibration', stat_key: 'cv', min_cohort: 2, t: 2 }) })).json() as { round_id: string }
await fetch(`${readyBase}/v1/rounds/${opened.round_id}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'a1' }) })
const posted = await fetch(`${readyBase}/v1/rounds/${opened.round_id}/share`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: 'a1', masked: marker, glucose: [5] }) })
assert.equal((await posted.json() as { ok: boolean }).ok, false)
assert.equal(JSON.stringify(readyApp.audit).includes(marker), false)

const small = Array.from({ length: 10 }, (_, index) => ({ id: `p${index}`, value: 1 + index * 0.1 }))
const smallRound = dealRound(small, 7, fieldRng(3))
const smallDrop = small.slice(0, 3).map((row) => row.id)
const smallFin = finishRound(smallRound, smallDrop)
assert.equal(smallFin.ok, true)
if (smallFin.ok) {
  const httpRound = await (await fetch(`${readyBase}/v1/rounds`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ study_id: 'rcv-calibration', stat_key: 'cv', min_cohort: 7, t: 7, epsilon: 1 }),
  })).json() as { ok: boolean; round_id: string }
  assert.equal(httpRound.ok, true)
  for (const row of smallFin.server.masked) {
    assert.equal((await (await fetch(`${readyBase}/v1/rounds/${httpRound.round_id}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: row.client_id }) })).json() as { ok: boolean }).ok, true)
    assert.equal((await (await fetch(`${readyBase}/v1/rounds/${httpRound.round_id}/share`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: row.client_id, masked: row.masked }) })).json() as { ok: boolean }).ok, true)
  }
  for (const row of smallFin.server.summed) {
    assert.equal((await (await fetch(`${readyBase}/v1/rounds/${httpRound.round_id}/summed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) })).json() as { ok: boolean }).ok, true)
  }
  const fin = await (await fetch(`${readyBase}/v1/rounds/${httpRound.round_id}/finalize`, { method: 'POST' })).json() as { released: boolean; sum: number }
  assert.equal(fin.released, true)
  assert.ok(Math.abs(fin.sum - smallFin.sum) < 1e-6)
}
await readyApp.close()
await devApp.close()
await limited.close()

const certDir = mkdtempSync(join(root, 'tls-'))
const certPath = join(certDir, 'cert.pem')
const keyPath = join(certDir, 'key.pem')
const minted = spawnSync('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-keyout', keyPath, '-out', certPath, '-days', '1', '-nodes', '-subj', '/CN=localhost'], { encoding: 'utf8' })
assert.equal(minted.status, 0, minted.stderr)
const tlsApp = createProdAggregator({
  config: prodConfig({ tls: { required: true, cert_pem: readFileSync(certPath, 'utf8'), key_pem: readFileSync(keyPath, 'utf8') } }),
  feedPrivateKey: feedB.privateKey,
  today: '2026-09-28',
})
const tlsBase = await tlsApp.listen(0)
const tlsBody = await new Promise<string>((resolve, reject) => {
  const req = httpsRequest(tlsBase + '/healthz', { rejectUnauthorized: false }, (res) => {
    const chunks: Buffer[] = []
    res.on('data', (chunk) => chunks.push(chunk as Buffer))
    res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
  })
  req.on('error', reject)
  req.end()
})
assert.equal(JSON.parse(tlsBody).ok, true)
const tlsReady = await new Promise<number>((resolve, reject) => {
  const req = httpsRequest(tlsBase + '/readyz', { rejectUnauthorized: false }, (res) => {
    res.resume()
    res.on('end', () => resolve(res.statusCode ?? 0))
  })
  req.on('error', reject)
  req.end()
})
assert.equal(tlsReady, 200)
await tlsApp.close()

const report = simulateCohort({ n: 500, seeds: 8 })
const byKey = (dropout: number, epsilon: number) => report.rows.find((row) => row.dropout === dropout && row.epsilon === epsilon)
for (const dropout of [0.1, 0.2, 0.3]) {
  const loose = byKey(dropout, 1)
  const tight = byKey(dropout, 4)
  assert.ok(loose && tight)
  assert.ok(tight.mae_vs_truth < loose.mae_vs_truth, `${dropout} ${tight.mae_vs_truth} vs ${loose.mae_vs_truth}`)
  assert.ok(loose.max_abs_vs_noisy < 1e-4)
  assert.equal(loose.reaches_3000, false)
}
assert.equal(byKey(0.1, 1)?.reaches_400, true)
assert.equal(byKey(0.2, 1)?.reaches_400, true)
assert.equal(byKey(0.3, 1)?.reaches_400, false)
const agg = createProdAggregator({ config: prodConfig(), feedPrivateKey: feedB.privateKey, today: '2026-09-28' })
const aggBase = await agg.listen(0)
const cohortRound = await (await fetch(`${aggBase}/v1/rounds`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ study_id: 'rcv-calibration', stat_key: 'cv', min_cohort: 400, t: report.t, epsilon: report.sample.epsilon }),
})).json() as { round_id: string }
for (const row of report.sample.masked) {
  const joined = await fetch(`${aggBase}/v1/rounds/${cohortRound.round_id}/join`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ client_id: row.client_id }) })
  assert.equal((await joined.json() as { ok: boolean }).ok, true)
  const shared = await fetch(`${aggBase}/v1/rounds/${cohortRound.round_id}/share`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) })
  assert.equal((await shared.json() as { ok: boolean }).ok, true, row.client_id)
}
for (const row of report.sample.summed) {
  const summed = await fetch(`${aggBase}/v1/rounds/${cohortRound.round_id}/summed`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(row) })
  assert.equal((await summed.json() as { ok: boolean }).ok, true)
}
const cohortFin = await (await fetch(`${aggBase}/v1/rounds/${cohortRound.round_id}/finalize`, { method: 'POST' })).json() as { released: boolean; mean: number; n: number }
assert.equal(cohortFin.released, true)
assert.equal(cohortFin.n, report.sample.survivors)
assert.ok(Math.abs(cohortFin.mean - report.sample.recovered_mean) < 1e-6)
await agg.close()
const summary = {
  n: report.n,
  t: report.t,
  deal_ms: report.deal_ms,
  rows: report.rows,
  sample: { dropout: report.sample.dropout, epsilon: report.sample.epsilon, survivors: report.sample.survivors, abs_vs_noisy: report.sample.abs_vs_noisy, reaches_400: report.sample.reaches_400, reaches_3000: report.sample.reaches_3000 },
}
console.log(JSON.stringify(summary, null, 2))
if (process.env.LONGPI_S2_REPORT) writeFileSync(process.env.LONGPI_S2_REPORT, JSON.stringify(summary, null, 2))
rmSync(root, { recursive: true, force: true })
console.log('science 061 suite ok')
