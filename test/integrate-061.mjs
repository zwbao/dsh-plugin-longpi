// Cross-lane wiring for 0.6.1: the simulated n-of-1 quest joins the season,
// the season title stays in the page flow, and a live feed refuses the dev key.

import assert from 'node:assert/strict'
import { createPrivateKey } from 'node:crypto'
import { readdirSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { EVENT_OWNERS } from '../src/contracts/events.ts'
import { signFeed, pollReleaseManifests } from '../src/science/feed.ts'
import { effectiveMode, liveRefused, startScience } from '../src/science/index.ts'
import { nOf1SeasonQuest } from '../src/science/nof1-model.ts'
import { SIM_KEY_ID } from '../src/science/verify.ts'
import { PRODUCT_VERSION, RESERVED_ROUTES } from '../src/version.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-061-'))
  dirs.push(dir)
  return dir
}
const at = (day) => new Date(`${day}T10:00:00+08:00`)
function profile(dir) {
  writeFileSync(join(dir, 'profile.json'), `${JSON.stringify({
    displayName: '林晓舟',
    birthYear: 1990,
    age: 36,
    sex: 'female',
    risk: {},
    focus: ['cardio'],
    consent: { version: '2026-09-24', accepted_at: '2026-07-27T01:00:00.000Z' },
  })}\n`)
}
const anaemia = [{
  id: 'finding-red-cell',
  rule: 'triage.pattern.red_cell',
  text_zh: '血红蛋白偏低，先请医生看',
  refs: [{ key: 'hb', label_zh: '血红蛋白', value: 118, unit: 'g/L', date: '2026-07-01' }],
}]

try {
  assert.equal(PRODUCT_VERSION, '0.8.0')
  assert.equal(EVENT_OWNERS['study.n_of_1_completed'], 'M8')
  assert.equal(EVENT_OWNERS['care.booked'], 'M6')
  assert.ok(RESERVED_ROUTES.M6.includes('GET /api/longpi/codex'))
  assert.ok(RESERVED_ROUTES.M6.includes('GET /api/longpi/codex/slot'))
  assert.equal(RESERVED_ROUTES.M6.some((row) => /draw|odds|streak/.test(row)), false, 'no draw, odds or streak routes')
  assert.equal(EVENT_OWNERS['codex.pack_granted'], 'M6')
  assert.equal('codex.drawn' in EVENT_OWNERS, false)
  assert.ok(RESERVED_ROUTES.M8.includes('GET /api/longpi/science/registry'))
  assert.ok(RESERVED_ROUTES.M8.includes('GET /api/longpi/science/transparency'))
  assert.ok(RESERVED_ROUTES.M8.includes('POST /api/longpi/science/n-of-1'))

  const quest = nOf1SeasonQuest('sn-test')
  assert.equal(quest.id, 'qs-n-of-1')
  assert.equal(quest.criteria.event, 'study.n_of_1_completed')
  assert.equal(quest.reward.footprint, true, 'a finished personal trial is a footprint, not a draw')
  assert.equal(quest.rarity_from_labs, false)
  assert.equal(quest.codex.money, 'none')
  assert.equal(quest.codex.trading, 'none')
  assert.equal(quest.codex.minors, 'off')

  const liveDir = tempDir()
  profile(liveDir)
  startScience({ configured: () => 'live', dataDir: () => liveDir })
  assert.equal(configuredLive(), true)
  assert.equal(effectiveMode(), 'off')
  assert.equal(liveRefused().refused, true)

  const page = readFileSync(join(root, 'src/client/page.ts'), 'utf8')
  const styles = readdirSync(join(root, 'src/client/styles')).map((f) => readFileSync(join(root, 'src/client/styles', f), 'utf8')).join('\n')
  const results = readFileSync(join(root, 'src/client/results.ts'), 'utf8')
  const html = readFileSync(join(root, 'src/science/page-html.ts'), 'utf8')
  assert.match(page, /SeasonBar/)
  assert.doesNotMatch(page, /shell\.overlay/)
  assert.match(styles, /\.lp-season-bar \{/)
  assert.equal(/\.lp-season-bar \{[^}]*position:\s*fixed/.test(styles), false)
  assert.equal(/lp-season-dock[\s\S]{0,200}position:\s*fixed/.test(results), false)
  assert.equal(html.includes('position:fixed'), false)
  assert.equal(html.includes('position: fixed'), false)

  const devFeed = signFeed(
    { issued_at: '2026-09-28T00:00:00Z', analysis_sha256: 'abc', manifests: [{ id: 'rcv-calibration' }] },
    SIM_KEY_ID,
    createPrivateKey(readFileSync(join(root, 'tools/aggregator/dev-signing-key.pem'))),
  )
  const fetchImpl = async () => new Response(JSON.stringify(devFeed), { status: 200 })
  const refusedFeed = await pollReleaseManifests('http://127.0.0.1/v1/manifests', { mode: 'live', publicKeys: {}, fetchImpl })
  assert.equal(refusedFeed.ok, false)
  const accepted = await pollReleaseManifests('http://127.0.0.1/v1/manifests', { mode: 'simulated', publicKeys: {}, fetchImpl })
  assert.equal(accepted.ok, true)

  console.log('integrate-061 ok')
} finally {
  startScience({ configured: () => 'off', dataDir: () => '' })
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}

function configuredLive() {
  return liveRefused().refused === true && effectiveMode() === 'off'
}
