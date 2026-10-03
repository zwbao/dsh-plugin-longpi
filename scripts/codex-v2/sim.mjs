// Monte Carlo of the v2 bag economy (docs/codex-v2.md §8). Runs preview/codex/rules.js unchanged.
// node scripts/codex-v2/sim.mjs [runs]

import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const context = vm.createContext({})
vm.runInContext(readFileSync(join(repo, 'preview', 'codex', 'rules.js'), 'utf8'), context)
const R = context.CodexRules
const pack = JSON.parse(readFileSync(join(repo, 'data', 'codex', 'v2', 'cards.json'), 'utf8'))
const runs = Number(process.argv[2] ?? 1000)
const byId = new Map(pack.studies.map((card) => [card.id, card]))
const rank = { cell: 0, animal: 1, human: 2, trial: 3 }

// Weekly behaviour. A season is 12 weeks; quests and care actions are spread across it.
const PEOPLE = {
  engaged: { recordDaysPerWeek: 4, questsPerSeason: 5, carePerSeason: 3 },
  casual: { recordDaysPerWeek: 1.5, questsPerSeason: 2, carePerSeason: 1 },
}

/** Pick-bag policy used in the model: a 金 card if offered, else one from the chapter being collected, else the strongest evidence. */
function choosePick(state, options) {
  return options.find((card) => card.tier === 'trial')
    ?? options.find((card) => card.chapter === state.collecting)
    ?? [...options].sort((a, b) => rank[b.tier] - rank[a.tier])[0]
}

function simulate(person, seed, weeks) {
  const behave = R.rng(seed ^ 0x9e3779b9)
  const state = R.createState(pack, seed, 'organ')
  const curve = []
  const firsts = { trial: null, allTrial: null, whale: null }
  const chapterWeeks = []
  const open = () => {
    while (state.bags.length > 0) {
      const out = R.draw(state, pack, 0)
      if (!out.ok) return
      const done = out.pick ? R.choose(state, pack, 0, choosePick(state, out.options).id) : out
      if (done.card.tier === 'trial' && firsts.trial == null) firsts.trial = weekNow
      if (done.met.includes('bowhead_whale')) firsts.whale = weekNow
      if (done.chapterDone) {
        chapterWeeks.push(weekNow)
        const next = R.suggestChapter(state, pack)
        if (next) state.collecting = next
      }
    }
  }
  let weekNow = 0
  for (let week = 0; week < weeks; week += 1) {
    weekNow = week
    if (week % 12 === 0) R.earn(state, 'pick', '赛季开始')
    const questDay = behave() < person.questsPerSeason / 12 ? Math.floor(behave() * 7) : -1
    const careDay = behave() < person.carePerSeason / 12 ? Math.floor(behave() * 7) : -1
    for (let day = 0; day < 7; day += 1) {
      if (behave() < person.recordDaysPerWeek / 7) R.record(state)
      if (day === questDay) R.earn(state, 'pick', '小目标')
      if (day === careDay) R.earn(state, 'care', '就诊')
      if (state.recordedToday || day === questDay || day === careDay) open()
      R.nextDay(state)
    }
    const trials = state.owned.filter((id) => byId.get(id).tier === 'trial').length
    if (trials === 4 && firsts.allTrial == null) firsts.allTrial = week
    curve.push(state.owned.length)
  }
  const kinds = { daily: 0, care: 0, pick: 0 }
  for (const row of state.log) kinds[row.bag] += 1
  return { curve, firsts, chapterWeeks, kinds, fallback: state.log.filter((row) => row.fallback).length }
}

const quantile = (values, q) => {
  const sorted = values.filter((value) => value != null).sort((a, b) => a - b)
  if (sorted.length === 0) return null
  return sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))]
}
const share = (values, total) => `${Math.round((values.filter((value) => value != null).length / total) * 100)}%`
const total = pack.studies.length
const weeks = 104

console.log(`${total} study cards, ${runs} runs per person, ${weeks} weeks`)
for (const [name, person] of Object.entries(PEOPLE)) {
  const results = Array.from({ length: runs }, (_, index) => simulate(person, index + 1, weeks))
  console.log(`\n== ${name}`)
  for (const week of [4, 12, 26, 52, 78, 104]) {
    const values = results.map((row) => row.curve[week - 1])
    const median = quantile(values, 0.5)
    console.log(`  week ${String(week).padStart(3)}: cards ${median} of ${total} (${Math.round((median / total) * 100)}%)`)
  }
  const firstTrial = results.map((row) => row.firsts.trial)
  const allTrial = results.map((row) => row.firsts.allTrial)
  const whale = results.map((row) => row.firsts.whale)
  console.log(`first 金: median week ${quantile(firstTrial, 0.5)}, p90 week ${quantile(firstTrial, 0.9)}; in year 1 ${share(firstTrial.map((w) => (w != null && w < 52 ? w : null)), runs)}`)
  console.log(`all four 金: median week ${quantile(allTrial, 0.5)}; within 2 years ${share(allTrial, runs)}`)
  console.log(`bowhead whale met: median week ${quantile(whale, 0.5)}; within 2 years ${share(whale, runs)}`)
  const nth = (n) => results.map((row) => row.chapterWeeks[n - 1] ?? null)
  console.log(`chapters done (median week): ${[1, 2, 3, 4, 5, 6, 7, 8].map((n) => `#${n} ${quantile(nth(n), 0.5) ?? '—'}`).join(', ')}`)
  const kinds = results.reduce((sum, row) => ({ daily: sum.daily + row.kinds.daily, care: sum.care + row.kinds.care, pick: sum.pick + row.kinds.pick }), { daily: 0, care: 0, pick: 0 })
  const all = kinds.daily + kinds.care + kinds.pick
  console.log(`bag mix: daily ${Math.round((kinds.daily / all) * 100)}%, care ${Math.round((kinds.care / all) * 100)}%, pick ${Math.round((kinds.pick / all) * 100)}%; fell back ${(results.reduce((sum, row) => sum + row.fallback, 0) / runs).toFixed(1)} per person`)
}

const fresh = R.createState(pack, 1, 'clock')
for (const kind of ['care', 'pick']) {
  const odds = R.odds(fresh, pack, { kind })
  console.log(`\nfirst ${kind} bag: ${odds.total} cards, P(金) ${(odds.pTrial * 100).toFixed(1)}%`, odds.byTier)
}
for (const chapter of pack.chapters) {
  fresh.collecting = chapter.id
  const odds = R.odds(fresh, pack, { kind: 'daily' })
  console.log(`first daily bag collecting ${chapter.title_zh}: ${odds.total} cards, P(金) ${(odds.pTrial * 100).toFixed(1)}%`, JSON.stringify(odds.byTier))
}
