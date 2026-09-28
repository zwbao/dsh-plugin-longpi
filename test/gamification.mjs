// Personal seasons, Codex as a library door, the in-flow header, and the family circle.

import assert from 'node:assert/strict'
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
import { loadCodexPack } from '../src/engage/codex.ts'
import { actEngage, careMetrics, drawEngage, noteSeasonContext, prefsEngage, runCodexMethod, shareEngage, syncEngage } from '../src/engage/engine.ts'
import { offerForCard } from '../src/engage/offer.ts'
import { insightBody, resolvePersonal, seasonHeader, templateFor, validateSeasonDraft } from '../src/engage/personal.ts'
import { rarityRank } from '../src/engage/rng.ts'
import { mergeProfile, readProfile } from '../src/profile.ts'

const dirs = []
function tempDir() {
  const dir = mkdtempSync(join(tmpdir(), 'longpi-g2-'))
  dirs.push(dir)
  return dir
}
const at = (day) => new Date(`${day}T10:00:00+08:00`)
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

const anaemia = [{
  id: 'finding-red-cell',
  rule: 'triage.pattern.red_cell',
  text_zh: '血红蛋白偏低，先请医生看',
  refs: [{ key: 'hb', label_zh: '血红蛋白', value: 118, unit: 'g/L', date: '2026-07-01' }],
}]

try {
  const bad = {
    title_zh: '你变年轻了',
    focus: 'care',
    marker_keys: ['hb'],
    quests: [{ id: 'qs-book-dept', kind: 'care', title_zh: '预约血液科', event: 'care.booked', count: 1 }],
  }
  assert.equal(validateSeasonDraft(bad, anaemia).ok, false)
  const fallen = resolvePersonal(anaemia, bad)
  assert.equal(fallen?.origin, 'template')
  assert.equal(fallen?.draft.title_zh, '查清贫血')
  assert.ok(fallen.draft.quests.length >= 3 && fallen.draft.quests.length <= 5)
  assert.ok(fallen.draft.quests.some((quest) => quest.title_zh.includes('血液科')))
  assert.ok(fallen.draft.quests.some((quest) => quest.id === 'qs-iron'))
  assert.ok(fallen.draft.quests.some((quest) => quest.event === 'retest.arrived'))

  const coach = {
    title_zh: '查清原因',
    focus: 'care',
    marker_keys: ['hb'],
    quests: [
      { id: 'qs-book-dept', kind: 'care', title_zh: '预约血液科或消化科', event: 'care.booked', count: 1 },
      { id: 'qs-iron', kind: 'data', title_zh: '补上铁蛋白', event: 'selfmeasure.logged', count: 1 },
      { id: 'qs-retest', kind: 'retest', title_zh: '复查血常规', event: 'retest.arrived', count: 1 },
    ],
  }
  assert.equal(validateSeasonDraft(coach, anaemia).ok, true, validateSeasonDraft(coach, anaemia).errors.join(','))
  assert.equal(resolvePersonal(anaemia, coach)?.origin, 'coach')
  assert.equal(resolvePersonal(anaemia, coach)?.draft.title_zh, '查清原因')

  const safety = templateFor([{ id: 'safety-sglt2i', rule: 'safety.med.sglt2i', text_zh: '你在用达格列净', refs: [] }])
  assert.equal(safety?.title_zh, '先问开药的医生')
  assert.doesNotMatch(JSON.stringify(safety), /断食|限时进食|停药/)
  assert.equal(resolvePersonal([], coach), null)
  const merged = mergeProfile(readProfile(tempDir()), { age: 40, sex: 'female', subject: { relationship_zh: '父亲', age: 76, sex: 'male' } })
  assert.equal(merged.subject.relationship_zh, '父亲')
  assert.equal(merged.subject.age, 76)

  const quiet = tempDir()
  profile(quiet)
  const before = noteSeasonContext(quiet, { facts: anaemia }, at('2026-07-27'))
  assert.equal(before.invite, null, 'no invite before a result or a doctor step')
  assert.equal(before.header.show, false)
  assert.equal(before.season?.title_zh, '查清贫血')
  assert.equal(JSON.stringify(before).includes('林晓舟'), false)

  const invited = noteSeasonContext(quiet, { facts: anaemia, doctorStep: true }, at('2026-07-27'))
  assert.equal(invited.invite?.show, true)
  assert.equal(invited.invite?.title_zh, '查清贫血')
  assert.match(invited.invite?.odds_path ?? '', /codex\/odds/)
  assert.equal(invited.header.show, false)
  assert.equal(invited.pressure, false)
  const opted = prefsEngage(quiet, { pressure: true }, at('2026-07-27'))
  assert.equal(opted.invite, null)
  assert.equal(opted.header.show, true)
  assert.match(opted.header.text_zh, /本季 · 查清贫血 · 第 1 周/)
  assert.equal(seasonHeader({ pressure: false, title: '查清贫血', week: 1 }).show, false)

  const booked = actEngage(quiet, { action: 'book', department_zh: '血液科' }, at('2026-07-28'))
  assert.equal(booked.ok, true)
  assert.equal(booked.view.quests.find((quest) => quest.id === 'qs-book-dept')?.status, 'done')
  assert.equal(booked.view.care_path.booked, '2026-07-28')
  const visited = actEngage(quiet, { action: 'care_visit', with_brief: true }, at('2026-07-30'))
  assert.equal(visited.view.quests.find((quest) => quest.id === 'qs-care-visit')?.status, 'done')
  assert.equal(visited.view.care_path.visited, '2026-07-30')
  actEngage(quiet, { action: 'addon', key: 'ferritin' }, at('2026-08-02'))
  const early = actEngage(quiet, { action: 'retest', measurements: [{ key: 'hb', value: 140, date: '2026-07-28' }] }, at('2026-07-28'))
  assert.match(early.note ?? '', /复测窗口/)
  const done = actEngage(quiet, { action: 'retest', measurements: [{ key: 'hb', value: 140, date: '2026-09-21' }] }, at('2026-09-21'))
  assert.equal(done.view.quests.find((quest) => quest.id === 'qs-retest')?.status, 'done')
  assert.equal(done.view.season?.status, 'closed')
  assert.match(done.view.season?.recap_zh ?? '', /118/)
  assert.match(done.view.season?.recap_zh ?? '', /140/)
  assert.doesNotMatch(done.view.season?.recap_zh ?? '', /年轻/)
  const metrics = careMetrics(quiet, at('2026-09-21'))
  assert.equal(metrics.doctor_step, '2026-07-27')
  assert.equal(metrics.booked, '2026-07-28')
  assert.equal(metrics.visited, '2026-07-30')
  assert.equal(metrics.days_to_first_care, 1)
  assert.ok(metrics.quests_done >= 3)
  const drawn = drawEngage(quiet, at('2026-09-21'))
  assert.equal(drawn.ok, true, drawn.error)
  assert.ok(rarityRank(drawn.card.rarity) >= rarityRank('rare'))
  if (drawn.card.offer) {
    assert.match(drawn.card.offer.text_zh, /这个方法现在可以用你的记录算|再补.+就能解锁|证据/)
  }

  const home = process.env.LONGEVITY_SKILLS_HOME || ''
  const pack = loadCodexPack()
  const whale = pack.cards.find((card) => card.id === 'm-bowhead-whale-dna-repair')
  const evidence = offerForCard(whale, home, { home, indicators: [], profile: { age: 40, sex: 'female' } })
  assert.equal(evidence.kind, 'evidence')
  assert.equal(evidence.label, 'evidence-only')
  assert.match(evidence.text_zh, /证据。这不是你的数字。/)
  assert.equal(evidence.text_zh.startsWith('这个方法'), false)
  const pheno = pack.cards.find((card) => card.skill === 'accelerated-biological-aging-risk')
  const missing = offerForCard(pheno, home, { home, indicators: [], profile: { age: 40, sex: 'female' } })
  assert.equal(missing.kind, 'unlock')
  assert.match(missing.text_zh, /^再补/)
  assert.match(missing.text_zh, /就能解锁$/)
  assert.doesNotMatch(insightBody(21, ['预约血液科或消化科']), /年轻|付费/)
  assert.match(insightBody(21, ['预约血液科或消化科']), /21 天/)

  const childRecord = tempDir()
  profile(childRecord, { subject: { relationship_zh: '父亲', age: 16, sex: 'male' } })
  const childView = syncEngage(childRecord, at('2026-07-27'))
  assert.equal(childView.codex.reason, 'minor')
  assert.equal(childView.subject_zh, '父亲')
  const refused = prefsEngage(childRecord, { family: true }, at('2026-07-27'))
  assert.equal(refused.family.opted, false)
  assert.match(shareEngage(childRecord, { kind: 'recap' }, at('2026-07-27')).error ?? '', /成年人/)

  const parent = tempDir()
  profile(parent, { subject: { relationship_zh: '父亲', age: 76, sex: 'male' } })
  noteSeasonContext(parent, { facts: anaemia, firstResult: true }, at('2026-07-27'))
  prefsEngage(parent, { pressure: true, family: true }, at('2026-07-27'))
  const closed = syncEngage(parent, at('2026-10-19'))
  const shared = shareEngage(parent, { kind: 'recap' }, at('2026-10-19'))
  assert.equal(shared.ok, true, shared.error)
  assert.equal(shared.text_zh.includes('林晓舟'), false)
  assert.match(shared.text_zh, /不是诊断/)
  assert.equal(closed.family.opted, true)
  assert.equal(closed.codex.hidden, false)

  const unowned = await runCodexMethod(parent, 'm-not-a-card', at('2026-10-19'))
  assert.equal(unowned.ok, false)

  const page = readFileSync(join(root, 'src/client/page.ts'), 'utf8')
  const dock = readFileSync(join(root, 'src/client/engage/index.ts'), 'utf8')
  const pill = readFileSync(join(root, 'src/client/pill.ts'), 'utf8')
  const results = readFileSync(join(root, 'src/client/results.ts'), 'utf8')
  assert.match(page, /SeasonBar/)
  assert.doesNotMatch(dock, /position:\s*'absolute'|position:\s*'fixed'/)
  assert.equal(pill.includes('EngageDock'), false)
  assert.equal(/lp-season-dock[\s\S]{0,200}position:\s*fixed/.test(results), false)

  console.log('gamification ok')
} finally {
  for (const dir of dirs) rmSync(dir, { recursive: true, force: true })
}
