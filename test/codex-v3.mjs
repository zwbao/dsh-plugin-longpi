// 长寿图鉴 1.2 (docs/codex-design.md §7 tests): the three-pick only shows eligible experiments, effective days and
// the extension, verdicts by the person's own variation or the reference change value, the stand-up reminder's
// triggers and suppression, 「做了」 not counted without the wristband, copy checks, family events give footprints only,
// and the v1 migration.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCatalog } from '../src/engage/data.ts'
import { blockedBy, eligible, pickThree, randomSchedule } from '../src/engage/eligibility.ts'
import { actCodex, bindRuntime, candidateSeeds, engagementSummary, logLifeCodex, noteCodexContext, syncCodex } from '../src/engage/engine.ts'
import { inMyDay, laterReveal, markRevealShown, settleAcks, slotView, standupDays, standupLine, EMPTY_NUDGE } from '../src/engage/nudge.ts'
import { writeSeriesCache, toMetricUnit } from '../src/engage/series.ts'
import { judgeMetric, praiseZh, thresholdZh } from '../src/engage/verdict.ts'
import { addDays } from '../src/interventions.ts'
import { loadReference } from '../src/reference.ts'
import { copyProblems } from '../scripts/build-codex.mjs'
import { skillsHome } from './lib/skills-home.mjs'

const home = skillsHome('data/biological_variation.json')
const biovar = home ? loadReference(home).biovar : null
const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-codex-'))
  dirs.push(dir)
  return dir
}
const at = (day, time = '10:00') => new Date(`${day}T${time}:00+08:00`)
function profile(dir, extra = {}) {
  writeFileSync(join(dir, 'profile.json'), `${JSON.stringify({
    displayName: '林晓舟', birthYear: 1988, age: 38, sex: 'female', risk: {}, focus: ['sleep'],
    consent: { version: '2026-09-24', accepted_at: '2026-07-27T01:00:00.000Z' }, ...extra,
  })}\n`)
}
/** Daily values for the 120 days before `today`, with a deterministic wobble. */
function daily(today, value, wobble, from = -60, to = -1, shift = () => 0) {
  const out = {}
  for (let i = from; i <= to; i += 1) {
    const day = addDays(today, i)
    out[day] = value + wobble * Math.sin(i * 1.7) + shift(i)
  }
  return out
}
function context(extra = {}) {
  return {
    age: 38, drug_classes: [], conditions: [], pregnant: false, open_findings: [], personal_text: '', focus: ['sleep'],
    ldl: null, retests: [], latest_checkup: '2026-09-01', results: { bioage: null, risk: null, changes: [] },
    labs: { hscrp: false, waist: false }, method_results: [], care_visits: [], ...extra,
  }
}
const metrics = loadCatalog().metrics

try {
  // ---- verdicts: the person's own variation, or the reference change value -------------------------------
  const flat = Array.from({ length: 14 }, (_, i) => 64 + (i % 2 ? 0.6 : -0.6))
  const lower = Array.from({ length: 12 }, (_, i) => 60.5 + (i % 2 ? 0.6 : -0.6))
  const rhr = judgeMetric(metrics.rhr, flat, lower, biovar, { role: 'primary', minFirst: 7, minSecond: 10 })
  assert.equal(rhr.outcome, 'outside', 'a 3.5/min drop beyond the person\'s own spread and the 2/min threshold')
  assert.equal(rhr.direction, 'better')
  assert.match(rhr.text_zh, /^主要结果 · 静息心率：64 → 61 次\/分，超出你的平时波动。$/)
  assert.match(rhr.how_zh, /按你自己的浮动/)
  assert.match(praiseZh(rhr), /比平时低，超出了平时波动——这是实打实的进步/)
  const small = judgeMetric(metrics.rhr, flat, flat.map((v) => v - 1), biovar, { role: 'primary', minFirst: 7, minSecond: 10 })
  assert.equal(small.outcome, 'inside', 'a 1/min move is under the pre-set 2/min even when it is consistent')
  assert.equal(praiseZh(small), null, 'no praise and no consolation inside the usual variation')
  const few = judgeMetric(metrics.rhr, flat, lower.slice(0, 6), biovar, { role: 'primary', minFirst: 7, minSecond: 10 })
  assert.equal(few.outcome, 'insufficient')
  assert.match(few.text_zh, /数据不够/)
  if (biovar) {
    const bpFlat = Array.from({ length: 10 }, () => 132)
    const bpInside = judgeMetric(metrics.sbp, bpFlat, Array.from({ length: 10 }, () => 125), biovar, { role: 'primary', minFirst: 3, minSecond: 10 })
    assert.equal(bpInside.outcome, 'inside', 'home BP is judged by the reference change value (≈ ±12%), not the person\'s spread')
    assert.match(bpInside.how_zh, /±12%/)
    const bpOutside = judgeMetric(metrics.sbp, bpFlat, Array.from({ length: 10 }, () => 114), biovar, { role: 'primary', minFirst: 3, minSecond: 10 })
    assert.equal(bpOutside.outcome, 'outside')
    assert.match(thresholdZh(metrics.sbp, biovar), /约 ±12%/)
  }
  assert.match(thresholdZh(metrics.rhr, biovar), /至少 2 次\/分/)
  for (const judged of [rhr, small, few]) {
    assert.doesNotMatch(`${judged.text_zh}${judged.how_zh}`, /真实变化|有效|带来的|因为/, 'only the three verdict words; never cause')
  }
  // Units come from the series: Mirobody's sleep total is ms; sleep onset wraps at midnight.
  assert.equal(toMetricUnit('sleep', 7 * 3_600_000, 'ms'), 7)
  assert.equal(toMetricUnit('sleep', 7, 'hours'), 7)
  assert.equal(toMetricUnit('onset', Date.parse('2026-09-30T00:30:00+08:00'), 'ms'), 390, '00:30 is 6.5 h after 18:00, not 0.5 h')
  assert.equal(toMetricUnit('onset', Date.parse('2026-09-29T23:30:00+08:00'), 'ms'), 330)

  // ---- eligibility: safety, data, relevance; three distinct ------------------------------------------------
  const today = '2026-10-04'
  const cache = (extra = {}) => ({ at: null, sources: {}, device_latest: addDays(today, -1), days: {
    rhr: daily(today, 63, 1.2), sleep: daily(today, 6.8, 0.4), hrv: daily(today, 42, 4), steps: daily(today, 7000, 900),
    onset: daily(today, 300, 25), wakings: daily(today, 1.6, 0.5), ...extra,
  } })
  const ctx = (extra = {}) => ({
    today, drugClasses: new Set(), conditions: new Set(), pregnant: false, openFindings: new Set(), series: cache(),
    ldlOnFile: false, retestIn8to12Weeks: false, personalText: '', focus: new Set(), standupOn: false, recent: new Set(), running: new Set(), ...extra,
  })
  const ids = (c) => eligible(c).map((row) => row.spec.id)
  const base = ids(ctx())
  assert.ok(base.includes('walk-after-meal') && base.includes('sleep-plus-30') && base.includes('early-dinner'))
  assert.equal(base.includes('home-bp'), false, 'no blood-pressure readings: no BP experiment')
  assert.equal(base.includes('stand-90'), false, 'the stand-up experiment needs the stand-up reminder on')
  assert.equal(base.includes('lipid-diet-8w'), false, 'the 8-week lipid diet needs an LDL and a retest 8–12 weeks out')
  assert.equal(ids(ctx({ drugClasses: new Set(['insulin']) })).includes('early-dinner'), false, 'insulin: no meal-timing experiment')
  assert.ok(ids(ctx({ drugClasses: new Set(['antihypertensive']), series: cache({ sbp: daily(today, 138, 4, -20) }) })).includes('home-bp'), 'blood-pressure tablets do not block measuring blood pressure')
  assert.equal(ids(ctx({ series: cache({ sbp: daily(today, 168, 4, -20) }), openFindings: new Set(['finding-sbp-very-high']) })).includes('home-bp'), false, 'a 先看医生 finding hides its related experiment')
  assert.ok(ids(ctx({ openFindings: new Set(['finding-sbp-very-high']) })).includes('sleep-plus-30'), 'and only that one')
  assert.deepEqual(ids(ctx({ pregnant: true })), [], 'pregnancy: no experiments')
  const noBand = ctx({ series: { at: null, sources: {}, device_latest: null, days: { sbp: daily(today, 130, 3, -20), weight: daily(today, 61, 0.3, -30) } } })
  assert.deepEqual(ids(noBand).sort(), ['home-bp', 'no-sugary-drinks'], 'no wristband: only experiments a cuff or scale can measure')
  assert.equal(blockedBy(loadCatalog().experiments.find((row) => row.id === 'fixed-wake'), ctx({ series: cache({ onset: {} }) })), 'no_data', 'no sleep-onset data: the regularity experiment is not offered')
  const relevant = ctx({ personalText: '方案：晚饭后散步 20 分钟' })
  assert.equal(eligible(relevant)[0].spec.id, 'walk-after-meal', 'related to the plan first')
  const three = pickThree(eligible(ctx()), 'seed-a')
  assert.equal(three.length, 3)
  assert.equal(new Set(three).size, 3, 'without replacement')
  assert.deepEqual(pickThree(eligible(ctx()), 'seed-a'), three, 'deterministic per pack')
  assert.equal(pickThree(eligible(ctx()), 'seed-a', new Set(three)).some((id) => three.includes(id)), false, '待选 are not dealt again')
  const sched = randomSchedule(today, 14, 'x')
  assert.equal(Object.values(sched).filter(Boolean).length, 7, 'randomized version: 7 do-days, 7 off-days')

  // ---- stand-up reminder: rules, suppression, confirmation ---------------------------------------------------
  const nudge = () => JSON.parse(JSON.stringify({ ...EMPTY_NUDGE, standup: 'on' }))
  const slot = (extra = {}) => slotView({ now: at(today, '15:00'), enabled: true, wristband: true, presentation: false, myDay: { start: '09:00', end: '22:00', asked: true }, nudge: nudge(), ready: [], ...extra })
  assert.equal(slot().standup, true)
  assert.equal(slot({ presentation: true }).standup, false, 'presentation mode hides everything')
  assert.equal(slot({ presentation: true }).quiet, 'presentation')
  assert.equal(slot({ now: at(today, '23:30') }).standup, false, 'outside 我的白天')
  assert.equal(inMyDay({ start: '13:00', end: '02:00' }, at(today, '01:10')), true, '我的白天 may cross midnight')
  assert.equal(inMyDay({ start: '13:00', end: '02:00' }, at(today, '10:00')), false)
  assert.equal(slot({ wristband: false }).standup, false, 'no wristband: no stand-up reminder (decision 13)')
  assert.equal(slot({ nudge: { ...nudge(), standup: null } }).standup, false, 'opt-in: off until the person turns it on')
  const two = nudge(); two.shown = [{ at: at(today, '10:00').toISOString(), kind: 'standup' }, { at: at(today, '12:30').toISOString(), kind: 'standup' }]
  assert.equal(slot({ nudge: two }).standup, false, 'at most 2 a day')
  const gap = nudge(); gap.shown = [{ at: at(today, '14:00').toISOString(), kind: 'standup' }]
  assert.equal(slot({ nudge: gap }).standup, false, 'two hours apart')
  const off = nudge(); off.dismissed_day = today
  assert.equal(slot({ nudge: off }).standup, false, '今天别提醒了')
  assert.equal(standupLine(100), '已经坐了 1 小时 40 分。起来走两分钟？')
  assert.doesNotMatch(standupLine(100), /正好|跑完|心率|血压|步/, 'no time promise and no health number')
  const acks = nudge()
  acks.acks = [{ at: at(today, '15:00').toISOString(), status: 'pending' }, { at: at(today, '17:20').toISOString(), status: 'pending' }]
  settleAcks(acks, [{ at: at(today, '15:04').getTime(), value: 180 }, { at: at(today, '17:50').getTime(), value: 40 }], at(today, '18:00'), today)
  assert.equal(acks.acks[0].status, 'confirmed', '好 then steps within 10 minutes: counted')
  assert.equal(acks.acks[1].status, 'unconfirmed', '好 without steps in 10 minutes: not counted')
  assert.deepEqual([...standupDays(acks)], [today])
  const unsynced = nudge(); unsynced.acks = [{ at: at(today, '15:00').toISOString(), status: 'pending' }]
  settleAcks(unsynced, [], at(today, '15:30'), today)
  assert.equal(unsynced.acks[0].status, 'pending', 'the wristband has not synced yet: wait')
  assert.equal(standupDays(unsynced).size, 0, '「做了」 without the wristband does not count')
  // Reveal notice: once on the day, 稍后 → once the next day, then never; not one of the stand-up two.
  const rev = nudge()
  const revSlot = (n, day) => slotView({ now: at(day, '15:00'), enabled: true, wristband: true, presentation: false, myDay: { start: '09:00', end: '22:00', asked: true }, nudge: n, ready: [{ ref: 'rn1', since: today }] })
  assert.equal(revSlot(rev, today).reveal?.text_zh, '有一张实验卡可以翻了。')
  markRevealShown(rev, 'rn1', at(today, '15:00'))
  assert.equal(revSlot(rev, today).reveal, null, 'once a day')
  assert.equal(revSlot(rev, today).standup, true, 'the reveal notice does not use up a stand-up')
  laterReveal(rev, 'rn1', today)
  assert.ok(revSlot(rev, addDays(today, 1)).reveal, '稍后 → once more the next day')
  markRevealShown(rev, 'rn1', at(addDays(today, 1), '15:00'))
  assert.equal(revSlot(rev, addDays(today, 2)).reveal, null, 'then no more')

  // ---- the loop end to end ---------------------------------------------------------------------------------
  const root = tempDir()
  profile(root)
  bindRuntime({ dataDir: () => root, rootDir: () => root, skillsHome: () => home, codexOn: () => true, bus: null })
  const start = '2026-09-01'
  writeSeriesCache(root, { at: null, sources: {}, device_latest: null, days: { rhr: daily(start, 64, 0.6, -40, -1), sleep: daily(start, 6.8, 0.3, -40, -1), steps: daily(start, 7000, 600, -40, -1) } })
  noteCodexContext(root, context(), at('2026-08-31'))
  let view = syncCodex(at(start))
  assert.equal(view.started, false, 'nothing starts by itself')
  assert.equal(view.packs.length, 0)
  const begun = actCodex({ action: 'start', my_day: { start: '13:00', end: '02:00' }, season_mode: '8w', standup: true }, at(start))
  assert.equal(begun.ok, true)
  view = begun.view
  assert.equal(view.season?.weeks, 8)
  assert.deepEqual(view.prefs.my_day, { start: '13:00', end: '02:00' })
  assert.equal(view.packs.length, 1, 'a season begins with one experiment pack')
  assert.equal(view.packs[0].source_zh, '赛季开始')
  const opened = actCodex({ action: 'open_pack', pack_id: view.packs[0].id }, at(start))
  const options = opened.view.packs[0].options
  assert.equal(options.length, 3, 'three to choose from')
  assert.ok(options.every((row) => row.id !== 'home-bp'), 'eligible ones only')
  const walk = options.find((row) => row.id === 'walk-after-meal') ?? options[0]
  const run = actCodex({ action: 'begin', pack_id: view.packs[0].id, experiment_id: walk.id }, at(start))
  assert.equal(run.ok, true, run.error)
  assert.equal(run.view.running.length, 1)
  assert.equal(run.view.reserve.length, 2, 'the other two wait in 待选')
  assert.match(run.view.running[0].threshold_zh, /超出平时波动/, 'the threshold is public before the start')
  assert.match(run.view.pane_zh, /· 第 1\/14 天$/, 'the pane line shows days only')
  assert.doesNotMatch(run.view.pane_zh, /\d+\s*(次\/分|mmHg|公斤)/)
  const runId = run.view.running[0].id
  // Days 1–14 with 9 days of resting heart rate: not enough at the end → extended, not a failure.
  const trialDays = (n, value) => Object.fromEntries(Array.from({ length: n }, (_, i) => [addDays(start, i), value + (i % 2 ? 0.5 : -0.5)]))
  writeSeriesCache(root, { at: null, sources: {}, device_latest: null, days: { rhr: { ...daily(start, 64, 0.6, -40, -1), ...trialDays(9, 61) } } })
  view = syncCodex(at('2026-09-16'))
  assert.equal(view.running[0]?.status, 'running', 'fewer than 10 days with data: runs on')
  assert.equal(view.running[0]?.extended_to, '2026-09-21', 'extended by up to 7 days')
  writeSeriesCache(root, { at: null, sources: {}, device_latest: null, days: { rhr: { ...daily(start, 64, 0.6, -40, -1), ...trialDays(11, 61) } } })
  view = syncCodex(at('2026-09-17', '15:00'))
  assert.equal(view.ready.length, 1, '10 days with data: ready to turn')
  assert.equal(view.running.length, 0)
  assert.equal(view.ready[0].result, null, 'the result stays face down until turned')
  assert.equal(view.slot.reveal?.text_zh, '有一张实验卡可以翻了。', 'inside 我的白天 (13:00–02:00 at 10:00 is outside, so ask at 15:00)')
  assert.ok(candidateSeeds(at('2026-09-17')).some((row) => row.kind === 'codex_reveal'))
  const revealed = actCodex({ action: 'reveal', run_id: runId }, at('2026-09-17'))
  assert.equal(revealed.ok, true)
  const result = revealed.view.deck[0].result
  assert.equal(result.outcome, 'outside')
  assert.match(result.primary.text_zh, /静息心率：64 → 61 次\/分，超出你的平时波动/)
  assert.ok(result.praise_zh, 'a good result outside the usual variation is said plainly')
  assert.ok(revealed.view.footprints.some((row) => row.kind === 'first_experiment'))
  assert.equal(revealed.view.packs.filter((pack) => pack.kind === 'experiment' && !pack.opened).length, 1, 'a finished experiment brings the next pack')
  const summary = engagementSummary()
  assert.equal(summary.reveal_ready, false)
  assert.equal(JSON.stringify(summary).match(/\d+\.\d|次\/分/), null, 'the fact pack carries no values')
  // A stand-in: sick days are never experiment days and never a failure.
  assert.equal(logLifeCodex({ event: 'sick', from: '2026-09-18', to: '2026-09-19' }, at('2026-09-19')).days.length, 2)

  // A retest of the holder: a retest pack (worse results flip plainly) and a footprint.
  noteCodexContext(root, context({
    latest_checkup: '2026-09-25',
    results: { bioage: { now: 36.2, date: '2026-09-25', prev: 37.9, prev_date: '2026-03-01', band: 1.4 }, risk: null, changes: [
      { key: 'ldl', label_zh: 'LDL 胆固醇', unit: 'mmol/L', from: 3.1, to: 3.4, from_date: '2026-03-01', to_date: '2026-09-25', beyond: false, verdict: 'worse', ask_doctor: false },
      { key: 'hb', label_zh: '血红蛋白', unit: 'g/L', from: 128, to: 101, from_date: '2026-03-01', to_date: '2026-09-25', beyond: true, verdict: 'worse', ask_doctor: true },
    ] },
  }), at('2026-09-26'))
  view = syncCodex(at('2026-09-26'))
  const retest = view.packs.find((pack) => pack.kind === 'retest')
  assert.ok(retest, 'a new checkup of the holder brings a retest pack')
  const turned = actCodex({ action: 'open_pack', pack_id: retest.id }, at('2026-09-26'))
  const cards = turned.pack?.results ?? []
  assert.deepEqual(cards.map((card) => card.key), ['bioage', 'ldl'], 'body age and the LDL change; a 先看医生 result is never in a retest pack')
  assert.match(cards[0].compare_zh, /37\.9 → 36\.2 岁，超出平时波动/)
  assert.equal(cards[1].plain, true, 'a worse result flips plainly, without celebration')
  assert.ok(view.footprints.some((row) => row.kind === 'retest'))

  // China-PAR outside 35–74 gives no number.
  const old = tempDir()
  profile(old, { age: 80, birthYear: 1946 })
  bindRuntime({ dataDir: () => old, rootDir: () => old })
  noteCodexContext(old, context({ age: 80 }), at('2026-08-31'))
  actCodex({ action: 'start' }, at('2026-09-01'))
  noteCodexContext(old, context({ age: 80, latest_checkup: '2026-09-20', results: { bioage: null, changes: [], risk: { pct: null, date: '2026-09-20', category_zh: '', applicable: false, reason_zh: '这个公式不适用：超出了建模年龄（35–74 岁）。' } } }), at('2026-09-21'))
  const oldPack = syncCodex(at('2026-09-21')).packs.find((pack) => pack.kind === 'retest')
  const riskCard = actCodex({ action: 'open_pack', pack_id: oldPack.id }, at('2026-09-21')).pack?.results.find((card) => card.key === 'risk')
  assert.ok(riskCard, 'the risk card is there')
  assert.equal(riskCard.value_zh, null, 'no percentage when the model does not apply')
  assert.match(riskCard.compare_zh, /不适用/)

  // ---- family: footprints only, never a pack ---------------------------------------------------------------
  const fam = tempDir()
  profile(fam)
  mkdirSync(join(fam, 'people', 'pmother01'), { recursive: true })
  writeFileSync(join(fam, 'people.json'), JSON.stringify({ active: 'pmother01', people: [{ id: 'pmother01', label_zh: '妈妈', name: '', sex: 'female', birth_year: 1950 }] }))
  const member = join(fam, 'people', 'pmother01')
  bindRuntime({ dataDir: () => member, rootDir: () => fam })
  noteCodexContext(fam, context(), at('2026-08-31'))
  actCodex({ action: 'start' }, at('2026-09-01'))
  const packsBefore = syncCodex(at('2026-09-02')).packs.length
  noteCodexContext(member, context({ latest_checkup: '2026-08-01', care_visits: [] }), at('2026-09-02'))
  noteCodexContext(member, context({ latest_checkup: '2026-09-10', care_visits: [{ id: 'care1', date: '2026-09-10', with_brief: true }] }), at('2026-09-11'))
  view = syncCodex(at('2026-09-11'))
  assert.equal(view.packs.length, packsBefore, 'a family member\'s visit or checkup gives no pack')
  assert.ok(view.footprints.some((row) => row.kind === 'family' && row.title_zh === '陪妈妈复查'))
  assert.equal(view.member?.label_zh, '妈妈')
  assert.equal(readFileSync(join(fam, 'engage', 'state.json'), 'utf8').includes('pmother01:care:care1'), true, 'kept in the holder\'s home')

  // ---- minors, closing, consent --------------------------------------------------------------------------
  const minor = tempDir()
  profile(minor, { age: 16, birthYear: 2010 })
  bindRuntime({ dataDir: () => minor, rootDir: () => minor })
  const minorStart = actCodex({ action: 'start' }, at('2026-09-01'))
  assert.equal(minorStart.ok, false)
  assert.equal(minorStart.view.enabled, false)
  assert.match(minorStart.view.reason_zh, /成年人/)
  bindRuntime({ dataDir: () => root, rootDir: () => root })
  const closed = actCodex({ action: 'prefs', codex: false }, at('2026-09-27'))
  assert.equal(closed.view.enabled, false, 'can be closed at any time')
  assert.equal(closed.view.slot.standup, false)
  assert.equal(actCodex({ action: 'prefs', codex: true }, at('2026-09-27')).view.enabled, true, 'and opened again')

  // ---- v1 migration ----------------------------------------------------------------------------------------
  const legacy = tempDir()
  profile(legacy)
  mkdirSync(join(legacy, 'engage'), { recursive: true })
  writeFileSync(join(legacy, 'engage', 'state.json'), JSON.stringify({
    version: 1, season: { id: 'sn1', start: '2026-08-01' }, pressure: 'on', streak: { current: 3, freezes_available: 1, frozen: [] },
    codex: { seed_hex: 'ab'.repeat(32), owned: ['m-calerie-methylation-clocks', 'sp-mouse'], grants: [{ id: 'g1' }, { id: 'g2', used_by: 'd1' }], choice: null },
  }))
  writeFileSync(join(legacy, 'engage', 'draws.jsonl'), '{"id":"d1"}\n')
  bindRuntime({ dataDir: () => legacy, rootDir: () => legacy })
  const migrated = syncCodex(at('2026-10-04'))
  const stored = JSON.parse(readFileSync(join(legacy, 'engage', 'state.json'), 'utf8'))
  assert.equal(stored.version, 2)
  assert.equal(stored.read['s-calerie-methylation-clocks'], '2026-10-04', 'owned method cards become 已读')
  assert.equal(stored.seed_hex, 'ab'.repeat(32), 'the seed is kept for audit')
  assert.ok(readFileSync(join(legacy, 'engage', 'draws.jsonl'), 'utf8').includes('d1'), 'draws.jsonl is kept')
  assert.ok(readFileSync(join(legacy, 'engage', 'state.v1.json'), 'utf8').includes('"version":1'))
  assert.equal(migrated.packs.filter((pack) => pack.kind === 'experiment').length, 1, 'unused draws become one opening experiment pack')
  assert.equal(JSON.stringify(stored).includes('streak'), false, 'the streak and its freeze are gone')

  // ---- copy checks (build gate) ----------------------------------------------------------------------------
  const rules = JSON.parse(readFileSync(new URL('../data/codex/v3/content.zh.json', import.meta.url), 'utf8')).rules
  const good = { title_zh: '同一管血，测出两个岁数', line_zh: '同一份血样测两次，几种常用的甲基化时钟能差出好几岁。', about_zh: '差异来自测量本身的技术噪声。', tier: 'human', tier_reason_zh: '方法学研究' }
  assert.deepEqual(copyProblems(good, rules), [])
  assert.ok(copyProblems({ ...good, about_zh: '在小鼠身上看到的结果，不等于在人身上成立。' }, rules).some((row) => row.includes('negation')))
  assert.ok(copyProblems({ ...good, line_zh: '个人报告只把你交来的数值记下来' }, rules).some((row) => row.includes('internal')))
  assert.ok(copyProblems({ ...good, title_zh: '少吃两年，你确实年轻了很多很多岁' }, rules).some((row) => row.includes('title')))

  console.log('codex v3 ok (pick-3 eligibility, effective days + extension, personal and RCV verdicts, stand-up and reveal slot, wristband confirmation, family footprints, minors, v1 migration, copy gate)')
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
