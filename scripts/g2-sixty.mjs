// Sixty civil days of the season engine for six synthetic personas.
// No model calls. Personas are read from LONGPI_PERSONAS_DIR. The report is written to G2_RUNS.
// Display names are not copied into the report.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { actEngage, careMetrics, drawEngage, noteSeasonContext, prefsEngage } from '../src/engage/engine.ts'
import { addDays } from '../src/interventions.ts'

const personasDir = process.env.LONGPI_PERSONAS_DIR
const outDir = process.env.G2_RUNS
if (!personasDir || !outDir) {
  console.error('Set LONGPI_PERSONAS_DIR and G2_RUNS')
  process.exit(2)
}

const ids = (process.env.G2_PERSONAS || 'p01,p03,p11,p22,p26,p30').split(',').map((id) => id.trim()).filter(Boolean)
const start = '2026-07-27'
const anaemia = [{
  id: 'finding-red-cell',
  rule: 'triage.pattern.red_cell',
  text_zh: '血红蛋白偏低，先请医生看',
  refs: [{ key: 'hb', label_zh: '血红蛋白', value: 118, unit: 'g/L', date: '2026-07-01' }],
}]
const safety = [{
  id: 'safety-sglt2i',
  rule: 'safety.med.sglt2i',
  text_zh: '正在使用 SGLT2 抑制剂，方案不安排断食',
  refs: [],
}]

function ageOn(birth, day) {
  const [y, m, d] = birth.split('-').map(Number)
  const [yy, mm, dd] = day.split('-').map(Number)
  let age = yy - y
  if (mm < m || (mm === m && dd < d)) age -= 1
  return age
}

function sexOf(value) {
  const raw = String(value ?? '').toLowerCase()
  if (raw === 'm' || raw === 'male') return 'male'
  if (raw === 'f' || raw === 'female') return 'female'
  return 'unknown'
}

function loadPersona(id) {
  const file = JSON.parse(readFileSync(join(personasDir, `${id}.json`), 'utf8'))
  const birth = String(file.birth_date ?? '1980-01-01').slice(0, 10)
  const engagement = String(file.segment?.engagement ?? 'weekly')
  return { id, birth, sex: sexOf(file.sex), engagement, age: ageOn(birth, start) }
}

function play(person) {
  const dir = join(outDir, 'homes', person.id)
  mkdirSync(dir, { recursive: true })
  writeFileSync(join(dir, 'profile.json'), `${JSON.stringify({
    displayName: '示例',
    birthYear: Number(person.birth.slice(0, 4)),
    age: person.age,
    sex: person.sex,
    risk: {},
    focus: [],
    consent: { version: '2026-09-24', accepted_at: '2026-07-26T16:00:00.000Z' },
  })}\n`)
  const quiet = person.engagement === 'rare'
  const facts = person.id === 'p11' ? anaemia : person.id === 'p30' ? safety : []
  const draws = []
  for (let day = 0; day <= 59; day += 1) {
    const today = addDays(start, day)
    const now = new Date(`${today}T10:00:00+08:00`)
    if (day === 0) {
      noteSeasonContext(dir, { facts, doctorStep: true, firstResult: true }, now)
      if (!quiet) prefsEngage(dir, { pressure: true }, now)
    } else if (!quiet && day === 2) {
      actEngage(dir, { action: 'book', department_zh: '全科' }, now)
    } else if (!quiet && day === 5) {
      actEngage(dir, { action: 'care_visit', with_brief: true }, now)
    } else if (!quiet && day === 10 && person.id === 'p11') {
      actEngage(dir, { action: 'addon', key: 'ferritin' }, now)
    } else if (!quiet && day === 56) {
      actEngage(dir, { action: 'retest', measurements: [{ key: 'hb', value: 132, date: today }] }, now)
    } else {
      noteSeasonContext(dir, { facts }, now)
    }
    if (!quiet && day % 7 === 0) {
      for (let n = 0; n < 3; n += 1) {
        const drawn = drawEngage(dir, now)
        if (!drawn.ok) break
        draws.push({ day: today, rarity: drawn.card?.rarity ?? '', family: drawn.card?.family ?? '' })
      }
    }
  }
  const metrics = careMetrics(dir, new Date(`${addDays(start, 59)}T10:00:00+08:00`))
  return {
    id: person.id,
    engagement: person.engagement,
    age: person.age,
    sex: person.sex,
    opted_in: !quiet,
    ...metrics,
    draw_rows: draws.length,
    draw_rare_or_better: draws.filter((row) => row.rarity === 'rare' || row.rarity === 'epic' || row.rarity === 'legendary').length,
  }
}

const rows = ids.map((id) => play(loadPersona(id)))
const withDoctor = rows.filter((row) => row.doctor_step)
const completed = withDoctor.filter((row) => row.booked && row.visited)
const acted = rows.filter((row) => row.days_to_first_care != null)
const questDone = rows.reduce((sum, row) => sum + row.quests_done, 0)
const questTotal = rows.reduce((sum, row) => sum + row.quests_total, 0)
const report = {
  start,
  days: 60,
  personas: rows.map(({ id, engagement, opted_in, origin, title, doctor_step, booked, visited, days_to_first_care, quests_done, quests_total, draws, draw_rows }) => ({
    id, engagement, opted_in, origin, title, doctor_step, booked, visited, days_to_first_care, quests_done, quests_total, draws, draw_rows,
  })),
  care_completion: `${completed.length}/${withDoctor.length}`,
  quest_completion: questTotal === 0 ? null : Number((questDone / questTotal).toFixed(3)),
  draws: rows.reduce((sum, row) => sum + row.draws, 0),
  days_to_first_care: acted.map((row) => row.days_to_first_care).sort((a, b) => a - b),
}
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'sixty.json'), `${JSON.stringify(report, null, 2)}\n`)
const lines = [
  `# 60-day season measurement`,
  ``,
  `Care path doctor → booked → visited: ${report.care_completion}.`,
  `Quest completion: ${questDone} / ${questTotal} (${report.quest_completion}).`,
  `Draws consumed: ${report.draws}.`,
  `Days from the doctor step to the first care action: ${report.days_to_first_care.join(', ') || 'none'}.`,
  ``,
  `| Persona | Engagement | Opted in | Season | Quests | Draws | Days to care |`,
  `| --- | --- | --- | --- | --- | --- | --- |`,
  ...report.personas.map((row) => `| ${row.id} | ${row.engagement} | ${row.opted_in ? 'yes' : 'no'} | ${row.title ?? ''} | ${row.quests_done}/${row.quests_total} | ${row.draws} | ${row.days_to_first_care ?? ''} |`),
  ``,
]
writeFileSync(join(outDir, 'sixty.md'), lines.join('\n'))
console.log(lines.join('\n'))
