// Engagement: drop-table maths, pity, daily cap, minors, seasons, streak freeze, no-plan reminders.

import assert from 'node:assert/strict'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { buildCalendar } from '../src/calendar.ts'
import { loadCodexPack } from '../src/engage/codex.ts'
import { auditCodex, drawOnce, oddsDisclosure, pickRarity } from '../src/engage/droptable.ts'
import { actEngage, bindRuntime, drawEngage, freezeEngage, prefsEngage, syncEngage } from '../src/engage/engine.ts'
import { commitmentOf, rarityRank, rollUnit } from '../src/engage/rng.ts'
import { seasonSpan } from '../src/engage/seasons.ts'
import { computeStreak } from '../src/engage/streak.ts'
import { decideFollowup, DEFAULT_FOLLOWUP, desktopCommand, followupSilence } from '../src/followup.ts'
import { addSelf } from '../src/selfmeasure.ts'

const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-engage-'))
  dirs.push(dir)
  return dir
}
const at = (day, time = '10:00') => new Date(`${day}T${time}:00+08:00`)
function profile(dir, extra = {}) {
  writeFileSync(join(dir, 'profile.json'), `${JSON.stringify({
    displayName: '林晓舟',
    birthYear: 1990,
    age: 36,
    sex: 'female',
    risk: {},
    focus: ['cardio'],
    consent: { version: '2026-09-24', accepted_at: '2026-07-27T01:00:00.000Z' },
    ...extra,
  })}\n`)
}

try {
  const pack = loadCodexPack()
  assert.deepEqual(auditCodex(pack.table, pack.cards), [], 'the published table matches the cards')
  assert.equal(pack.table.money, 'none')
  assert.equal(pack.table.trading, 'none')
  assert.equal(pack.table.biomarker_linked_rarity, false)
  assert.equal(pack.table.care_guarantee, 'rare')
  assert.equal(pack.table.daily_cap, 3)
  assert.equal(pack.cards.filter((card) => card.family === 'method').length, 171)
  const text = oddsDisclosure(pack.table, pack.cards)
  assert.match(text, /没有付费/)
  assert.match(text, /不能交易/)
  assert.match(text, /不由指标好坏决定/)
  assert.match(text, /铜 52%/)
  assert.match(text, /银 28%/)
  assert.match(text, /紫 16%/)
  assert.match(text, /金 4%/)
  assert.equal(JSON.stringify(pack.cards).includes('格陵兰'), false, 'no invented Greenland shark card')
  const whale = pack.cards.find((card) => card.id === 'h-bowhead-whale-dna-repair')
  assert.equal(whale?.hidden, true)
  assert.equal(whale?.rarity, 'legendary')
  assert.equal(whale?.title_zh, '弓头鲸')
  const mole = pack.cards.find((card) => card.title_zh === '裸鼹鼠')
  assert.equal(mole?.family, 'species')
  assert.equal(mole?.hidden, true)
  const methodWhale = pack.cards.find((card) => card.id === 'm-bowhead-whale-dna-repair')
  assert.equal(methodWhale?.evidence_tier, 'cell')
  assert.equal(methodWhale?.rarity, 'common')
  const rct = pack.cards.find((card) => card.id === 'm-calerie-methylation-clocks')
  assert.equal(rct?.evidence_tier, 'human_rct')
  assert.equal(rct?.rarity, 'legendary')
  const animal = pack.cards.find((card) => card.family === 'method' && card.evidence_tier === 'animal')
  assert.equal(animal?.rarity, 'rare')

  assert.equal(pickRarity(0, pack.table.odds), 'common')
  assert.equal(pickRarity(0.52, pack.table.odds), 'rare')
  assert.equal(pickRarity(0.8, pack.table.odds), 'epic')
  assert.equal(pickRarity(0.96, pack.table.odds), 'legendary')
  const seed = Buffer.alloc(32, 7)
  assert.equal(rollUnit(seed, 3, 'rarity'), rollUnit(seed, 3, 'rarity'))
  assert.equal(commitmentOf(seed), commitmentOf(seed))
  const once = drawOnce({ table: pack.table, cards: pack.cards, seed, counter: 4, pityBefore: 0, guarantee: null, owned: new Set(), at: '2026-07-27T02:00:00.000Z', grantId: 'granttest0001' })
  const again = drawOnce({ table: pack.table, cards: pack.cards, seed, counter: 4, pityBefore: 0, guarantee: null, owned: new Set(), at: '2026-07-27T02:00:00.000Z', grantId: 'granttest0001' })
  assert.equal(again.card.id, once.card.id, 'same seed and counter, same card, labs are not an input')
  assert.equal(once.result.rng.algo, 'sha256-counter')
  assert.equal(once.result.rng.seed_commitment, commitmentOf(seed))

  let pity = 0
  for (let i = 0; i < 10; i += 1) {
    const drawn = drawOnce({ table: pack.table, cards: pack.cards, seed, counter: i, pityBefore: pity, guarantee: null, owned: new Set(), at: '2026-07-27T02:00:00.000Z', grantId: 'grpitytest0001', units: { rarity: 0, card: 0 } })
    assert.equal(drawn.card.rarity, 'common', `draw ${i} stays common before pity`)
    pity = drawn.pityAfter
  }
  assert.equal(pity, 10)
  const forced = drawOnce({ table: pack.table, cards: pack.cards, seed, counter: 10, pityBefore: 10, guarantee: null, owned: new Set(), at: '2026-07-27T02:00:00.000Z', grantId: 'grpitytest0001', units: { rarity: 0, card: 0 } })
  assert.ok(rarityRank(forced.card.rarity) >= rarityRank('rare'), 'the draw after 10 commons is at least silver')
  assert.equal(forced.pityAfter, 0)
  const cared = drawOnce({ table: pack.table, cards: pack.cards, seed, counter: 1, pityBefore: 0, guarantee: 'rare', owned: new Set(), at: '2026-07-27T02:00:00.000Z', grantId: 'grcaretest0001', units: { rarity: 0, card: 0 } })
  assert.ok(rarityRank(cared.card.rarity) >= rarityRank('rare'), 'a care grant is at least silver even when the roll is bronze')
  const dup = drawOnce({ table: pack.table, cards: pack.cards, seed, counter: 2, pityBefore: 0, guarantee: null, owned: new Set([cared.card.id]), at: '2026-07-27T02:00:00.000Z', grantId: 'grduptest00001', units: { rarity: 0.5, card: 0 } })
  if (dup.card.id === cared.card.id) assert.equal(dup.result.duplicate, true)

  const span = seasonSpan('2026-07-27', null)
  assert.equal(span.days, 84)
  assert.equal(span.weeks, 12)
  assert.equal(span.end, '2026-10-18')
  const aligned = seasonSpan('2026-07-27', '2026-09-24')
  assert.equal(aligned.end, '2026-09-24', 'a retest inside 8–12 weeks ends the season')
  assert.equal(computeStreak(['2026-07-27', '2026-07-28', '2026-07-30'], [], '2026-07-30').current, 1)
  assert.equal(computeStreak(['2026-07-27', '2026-07-28', '2026-07-30'], ['2026-07-29'], '2026-07-30').current, 3)

  const none = tempDir()
  assert.equal(syncEngage(none, at('2026-07-27')).needs_consent, true)
  assert.equal(syncEngage(none, at('2026-07-27')).season, null)

  const adult = tempDir()
  profile(adult)
  const opened = syncEngage(adult, at('2026-07-27'))
  assert.equal(opened.needs_consent, false)
  assert.equal(opened.season?.title_zh.length > 0, true)
  assert.equal(opened.season?.start, '2026-07-27')
  assert.equal(opened.season?.end, '2026-10-18')
  assert.equal(opened.season?.status, 'active')
  assert.ok(opened.quests.length >= 3 && opened.quests.length <= 5)
  assert.equal(opened.unlocks.find((row) => row.key === 'cvd_risk')?.status, 'locked')
  assert.match(opened.unlocks.find((row) => row.key === 'cvd_risk')?.teaser_zh ?? '', /腰围/)
  assert.match(opened.unlocks.find((row) => row.key === 'bioage')?.teaser_zh ?? '', /40–80/)
  assert.equal(JSON.stringify(opened).includes('林晓舟'), false, 'the season payload does not carry the name')
  assert.equal(opened.codex.enabled, true)
  assert.match(opened.codex.odds_zh ?? '', /没有付费/)
  assert.doesNotMatch(opened.weekly_zh ?? '', /年轻/)
  for (const day of ['2026-07-27', '2026-07-28', '2026-07-29', '2026-07-30']) {
    const saved = addSelf(adult, [{ key: day === '2026-07-27' ? 'waist' : 'weight', value: day === '2026-07-27' ? 80 : 60, unit: day === '2026-07-27' ? 'cm' : 'kg', date: day }], { today: '2026-07-30' })
    assert.equal(saved.problems.length, 0, saved.problems.join(' '))
  }
  const moved = syncEngage(adult, at('2026-07-30'))
  assert.equal(moved.unlocks.find((row) => row.key === 'cvd_risk')?.status, 'unlocked')
  assert.equal(moved.quests.find((row) => row.id === 'qs-waist')?.status, 'done')
  assert.equal(moved.quests.find((row) => row.id === 'qs-show-up')?.status, 'done')
  const caredVisit = actEngage(adult, { action: 'care_visit', with_brief: true }, at('2026-07-30'))
  assert.equal(caredVisit.ok, true)
  assert.equal(caredVisit.view.quests.find((row) => row.id === 'qs-care-visit')?.status, 'done')
  const addon = actEngage(adult, { action: 'addon', key: 'hscrp' }, at('2026-07-30'))
  assert.equal(addon.view.quests.find((row) => row.id === 'qs-hscrp')?.status, 'done')
  assert.ok(addon.view.codex.draws_available >= 4, `grants ${addon.view.codex.draws_available}`)
  const first = drawEngage(adult, at('2026-07-30'))
  assert.equal(first.ok, true, first.error)
  assert.ok(rarityRank(first.card.rarity) >= rarityRank('rare'), 'the care grant is at least silver')
  assert.equal(drawEngage(adult, at('2026-07-30')).ok, true)
  assert.equal(drawEngage(adult, at('2026-07-30')).ok, true)
  const capped = drawEngage(adult, at('2026-07-30'))
  assert.equal(capped.ok, false)
  assert.equal(capped.reason, 'daily_cap')
  assert.ok(capped.view.codex.draws_available >= 1, 'a capped draw does not spend the grant')
  const state = JSON.parse(readFileSync(join(adult, 'engage', 'state.json'), 'utf8'))
  assert.equal(JSON.stringify(first).includes(state.codex.seed_hex), false, 'the draw answer does not reveal the seed')
  const ledger = readFileSync(join(adult, 'engage', 'draws.jsonl'), 'utf8').trim().split('\n')
  assert.equal(ledger.length, 3)
  assert.match(ledger[0], /sha256-counter/)

  const seasonDir = tempDir()
  profile(seasonDir)
  syncEngage(seasonDir, at('2026-07-27'))
  const tooSoon = actEngage(seasonDir, { action: 'retest' }, at('2026-07-27'))
  assert.match(tooSoon.note ?? '', /复测窗口/)
  assert.equal(tooSoon.view.quests.find((row) => row.id === 'qs-retest')?.status, 'open')

  const minor = tempDir()
  profile(minor, { age: 12, birthYear: 2014 })
  const minorView = syncEngage(minor, at('2026-07-27'))
  assert.equal(minorView.codex.hidden, true)
  assert.equal(minorView.codex.reason, 'minor')
  assert.equal(minorView.season == null, false, 'a minor still gets a season')
  addSelf(minor, [{ key: 'waist', value: 70, unit: 'cm', date: '2026-07-27' }], { today: '2026-07-27' })
  const minorAfter = syncEngage(minor, at('2026-07-27'))
  assert.equal(minorAfter.codex.draws_available, 0, 'a minor does not earn draws')
  const minorDraw = drawEngage(minor, at('2026-07-27'))
  assert.equal(minorDraw.reason, 'minor')
  assert.equal(minorDraw.ok, false)

  const unknown = tempDir()
  profile(unknown, { age: null, birthYear: null })
  assert.equal(syncEngage(unknown, at('2026-07-27')).codex.reason, 'age_unknown')

  const opted = tempDir()
  profile(opted)
  syncEngage(opted, at('2026-07-27'))
  addSelf(opted, [{ key: 'waist', value: 80, unit: 'cm', date: '2026-07-27' }], { today: '2026-07-27' })
  syncEngage(opted, at('2026-07-27'))
  const off = prefsEngage(opted, { codex: false }, at('2026-07-27'))
  assert.equal(off.codex.hidden, true)
  assert.equal(drawEngage(opted, at('2026-07-27')).reason, 'opt_out')
  prefsEngage(opted, { codex: true }, at('2026-07-27'))
  assert.equal(drawEngage(opted, at('2026-07-27')).ok, true)

  bindRuntime({ codexOn: () => false })
  const switched = tempDir()
  profile(switched)
  assert.equal(syncEngage(switched, at('2026-07-27')).codex.reason, 'config')
  bindRuntime({ codexOn: () => true })

  const frozen = tempDir()
  profile(frozen)
  syncEngage(frozen, at('2026-07-27'))
  for (const day of ['2026-07-27', '2026-07-28', '2026-07-30']) {
    addSelf(frozen, [{ key: 'weight', value: 60, unit: 'kg', date: day }], { today: '2026-07-30' })
  }
  assert.equal(syncEngage(frozen, at('2026-07-30')).streak.current, 1)
  const iced = freezeEngage(frozen, { reason: 'sick', from: '2026-07-29', to: '2026-07-29' }, at('2026-07-30'))
  assert.equal(iced.ok, true, iced.error)
  assert.equal(iced.view.streak.current, 3)
  assert.equal(iced.view.streak.freezes_available, 0)
  const life = freezeEngage(frozen, { reason: 'travel', from: '2026-07-31', to: '2026-07-31' }, at('2026-07-31'))
  assert.equal(life.ok, false)

  const closed = tempDir()
  profile(closed)
  syncEngage(closed, at('2026-07-27'))
  const recap = syncEngage(closed, at('2026-10-19'))
  assert.equal(recap.season?.status, 'closed')
  assert.match(recap.season?.recap_zh ?? '', /完成了/)
  assert.doesNotMatch(recap.season?.recap_zh ?? '', /年轻/)
  assert.doesNotMatch(recap.weekly_zh ?? '', /年轻/)

  const nudge = prefsEngage(closed, { nudge: true, offerSeen: true }, at('2026-10-19'))
  assert.equal(nudge.nudge.enabled, true)
  const quiet = prefsEngage(adult, {}, at('2026-07-30'))
  assert.equal(quiet.nudge.enabled, false, 'in-workflow nudges stay off until opted in')

  assert.match(followupSilence({ now: at('2026-07-27', '12:00'), settings: DEFAULT_FOLLOWUP, state: null, log: [] }), /关着的/)
  const plain = {
    stage: 'first_result', consent_at: '2026-07-01T00:00:00.000Z', next_title_zh: '补一项', next_detail_zh: '',
    plan_exists: false, checkin_items: 0, checkin_open: [], retests: [], week: { pct: null, streak: 0, next_retest: null },
    plain_reminder_zh: '量一次腰围，就能解锁心血管风险',
  }
  const sunday = decideFollowup({ now: at('2026-08-02', '20:00'), settings: { ...DEFAULT_FOLLOWUP, enabled: true }, state: plain, log: [] })
  assert.ok(sunday.some((row) => row.key.startsWith('plain:')))
  assert.equal(sunday.some((row) => row.kind === 'weekly'), false)
  const ics = buildCalendar({
    today: '2026-07-27',
    plan: { exists: false, checkin_items: [] },
    addons: [{ item_zh: '腰围', unlocks_zh: '心血管风险', self_measurable: true }],
  }, { items: [] }, { now: at('2026-07-27') })
  assert.match(ics, /腰围 → 解锁心血管风险/)
  const app = tempDir()
  const binDir = join(app, 'LongPi.app', 'Contents', 'MacOS')
  mkdirSync(binDir, { recursive: true })
  writeFileSync(join(binDir, 'applet'), '')
  const command = desktopCommand('darwin', 'hello', join(app, 'LongPi.app'))
  assert.equal(command.command, join(binDir, 'applet'))
  assert.deepEqual(command.args, ['hello'])
  assert.equal(desktopCommand('darwin', 'hello', null).command, 'osascript')

  console.log('engage ok')
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
