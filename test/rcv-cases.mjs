// The shared RCV cases (longevity-analyst-skill/tests/fixtures/rcv_cases.json, or LONGEVITY_RCV_CASES) through
// LongPi's own code: compareGate says 太早 first, then rcvBand decides inside or outside the band. The analyst's twin
// compare and the coach's noise.py run the same file with their own implementations.
import assert from 'node:assert/strict'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { compareGate } from '../src/honesty/index.ts'
import { loadReference, markerFor, rcvBand } from '../src/reference.ts'
import { skillsHome } from './lib/skills-home.mjs'

const casesPath = (process.env.LONGEVITY_RCV_CASES || '').trim()
  || resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', 'longevity-analyst-skill', 'tests', 'fixtures', 'rcv_cases.json')
const home = skillsHome('data/biological_variation.json')
if (!home || !existsSync(casesPath)) {
  console.log(`rcv-cases skipped (${!home ? 'no longevity-skills checkout with data/' : `no ${casesPath}; set LONGEVITY_RCV_CASES`})`)
  process.exit(0)
}

const { biovar } = loadReference(home)
const { cases } = JSON.parse(readFileSync(casesPath, 'utf8'))
const round1 = (x) => Math.round(x * 10) / 10
let judged = 0
for (const c of cases) {
  const want = c.expect.longpi
  if (want === 'not_applicable') continue
  const marker = markerFor(biovar, { name: c.marker, label: c.marker })
  if (want === 'no_noise_model') {
    assert.equal(marker, null, c.id)
    continue
  }
  assert.equal(marker?.key, c.key, c.id)
  const gate = compareGate([{ date: c.prev_date }, { date: c.cur_date }], [], marker)
  if (gate) {
    assert.equal(gate.gate, want, c.id)
    continue
  }
  const band = rcvBand(marker, biovar.z)
  const pct = ((c.after[0] - c.before[0]) / c.before[0]) * 100
  const verdict = pct > band.up * 100 ? 'up_beyond_noise' : pct < band.down * 100 ? 'down_beyond_noise' : 'within_noise'
  assert.equal(verdict, want, c.id)
  assert.deepEqual([round1(band.down * 100), round1(band.up * 100)], c.band_pct, c.id)
  assert.equal(round1(pct), c.change_pct, c.id)
  judged += 1
}
assert.ok(judged >= 3, 'the within and beyond cases were judged')
console.log('rcv-cases ok')
