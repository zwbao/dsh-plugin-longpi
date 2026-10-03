// Codex v2 pack and draw rules (docs/codex-v2.md §3, §5). Run after scripts/codex-v2/build.mjs.

import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const pack = JSON.parse(readFileSync(join(repo, 'data', 'codex', 'v2', 'cards.json'), 'utf8'))
const content = JSON.parse(readFileSync(join(repo, 'data', 'codex', 'v2', 'content.zh.json'), 'utf8'))
const context = vm.createContext({})
vm.runInContext(readFileSync(join(repo, 'preview', 'codex', 'rules.js'), 'utf8'), context)
const R = context.CodexRules

// ---- pack ------------------------------------------------------------------
const ids = [...pack.studies, ...pack.species, ...pack.tools, ...pack.milestones].map((card) => card.id)
assert.equal(new Set(ids).size, ids.length, 'card ids are unique')
assert.equal(new Set(pack.studies.map((card) => card.no)).size, pack.studies.length, 'plate numbers are unique')
for (const chapter of pack.chapters) assert.ok(chapter.size > 0, `chapter ${chapter.id} has cards`)
assert.equal(pack.chapters.reduce((sum, row) => sum + row.size, 0), pack.studies.length, 'every study card is in one chapter')
for (const species of pack.species) assert.ok(species.studies.length > 0, `${species.id} is met by a study card`)
for (const card of pack.studies) {
  assert.ok(['cell', 'animal', 'human', 'trial'].includes(card.tier), `${card.id} tier`)
  assert.ok(card.about_zh, `${card.id} has a back`)
  for (const word of content.rules.forbidden) assert.ok(!`${card.headline_zh}${card.hook_zh}`.includes(word), `${card.id} avoids「${word}」`)
  if (card.tier === 'animal') assert.match(card.caveat_zh, /不等于在人身上成立/, `${card.id} names the species limit`)
}
assert.ok(pack.studies.filter((card) => card.tier === 'trial').every((card) => /rct|随机/i.test(`${card.about_zh}${card.source.title}`)), '金 cards are randomised trials')

// ---- rules -----------------------------------------------------------------
function fresh(collecting = 'clock') {
  return R.createState(pack, 7, collecting)
}

{
  const s = fresh()
  R.earn(s, 'daily', 't')
  R.earn(s, 'daily', 't')
  R.earn(s, 'daily', 't')
  R.earn(s, 'daily', 't')
  for (let i = 0; i < R.RULES.dailyCap; i += 1) assert.equal(R.draw(s, pack, 0).ok, true)
  const capped = R.draw(s, pack, 0)
  assert.equal(capped.ok, false)
  assert.equal(capped.reason, 'daily_cap')
  assert.equal(s.bags.length, 1, 'a capped draw keeps the bag')
}

{
  const s = fresh()
  let bags = 0
  for (let day = 0; day < 7; day += 1) { if (R.record(s)) bags += 1; R.nextDay(s) }
  assert.equal(bags, R.RULES.dailyBagsPerWeek, 'daily bags stop at the weekly cap')
  assert.ok(R.record(s), 'the cap resets the next week')
}

{
  const s = fresh('immune')
  const chapterSize = pack.chapters.find((row) => row.id === 'immune').size
  for (let i = 0; i < chapterSize; i += 1) {
    R.earn(s, 'daily', 't')
    const out = R.draw(s, pack, 0)
    assert.equal(out.card.chapter, 'immune', 'a daily bag draws from the chapter being collected')
    assert.equal(out.fallback, false)
    if (i === chapterSize - 1) assert.equal(out.chapterDone, 'immune', 'the last card completes the chapter')
    R.nextDay(s)
  }
  assert.equal(s.freezes, 2, 'a finished chapter adds one freeze')
  R.earn(s, 'daily', 't')
  const after = R.draw(s, pack, 0)
  assert.equal(after.fallback, true, 'a finished chapter falls back to every unowned card')
  assert.notEqual(after.card.chapter, 'immune')
}

{
  const s = fresh()
  const strong = pack.studies.filter((card) => card.tier === 'human' || card.tier === 'trial').length
  for (let i = 0; i < strong; i += 1) {
    R.earn(s, 'care', 't')
    const out = R.draw(s, pack, 0)
    assert.ok(out.card.tier === 'human' || out.card.tier === 'trial', 'a care bag gives 人群 or 金')
    R.nextDay(s)
  }
  assert.equal(R.odds(s, pack, { kind: 'care' }).fallback, true)
}

{
  const s = fresh()
  R.earn(s, 'pick', 't')
  const out = R.draw(s, pack, 0)
  assert.equal(out.pick, true)
  assert.equal(new Set(out.options.map((card) => card.id)).size, R.RULES.pickSize, 'three different cards')
  assert.equal(R.choose(s, pack, 0, 's-not-offered').ok, false, 'only an offered card can be kept')
  const kept = R.choose(s, pack, 0, out.options[1].id)
  assert.equal(kept.ok, true)
  assert.equal(s.owned.length, 1)
  assert.ok(!s.ownedSet.has(out.options[0].id) && !s.ownedSet.has(out.options[2].id), 'the other two go back')
}

{
  const s = fresh()
  const seen = new Set()
  let draws = 0
  while (true) {
    R.earn(s, ['daily', 'care', 'pick'][draws % 3], 't')
    let out = R.draw(s, pack, 0)
    if (!out.ok && out.reason === 'daily_cap') { R.nextDay(s); out = R.draw(s, pack, 0) }
    if (!out.ok) break
    const res = out.pick ? R.choose(s, pack, 0, out.options[0].id) : out
    assert.ok(!seen.has(res.card.id), 'no duplicate before the codex is complete')
    seen.add(res.card.id)
    draws += 1
    if (res.chapterDone) s.collecting = R.suggestChapter(s, pack) ?? s.collecting
  }
  assert.equal(draws, pack.studies.length, 'N study cards take exactly N bags')
  assert.equal(s.chaptersDone.size, pack.chapters.length)
}

{
  const s = fresh()
  const odds = R.odds(s, pack, { kind: 'pick' })
  const n = odds.total
  const k = odds.byTier.trial
  const exact = 1 - ((n - k) / n) * ((n - k - 1) / (n - 1)) * ((n - k - 2) / (n - 2))
  assert.ok(Math.abs(odds.pTrial - exact) < 1e-12, 'pick odds are the at-least-one probability')
  for (const kind of ['daily', 'care', 'pick']) {
    const o = R.odds(s, pack, { kind })
    assert.equal(Object.values(o.byTier).reduce((a, b) => a + b, 0), o.total)
  }
}

console.log(`codex v2 ok: ${pack.studies.length} study cards, ${pack.chapters.length} chapters, ${pack.species.length} species`)
