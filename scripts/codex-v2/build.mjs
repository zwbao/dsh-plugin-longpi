// Build the v2 Codex pack (docs/codex-v2.md) from the longevity-skills checkout and
// data/codex/v2/content.zh.json. Writes data/codex/v2/cards.json and preview/codex/data.js.
// Evidence tier comes from the library's own `evidence` field; no card reads a lab value.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const candidates = [
  process.env.LONGEVITY_SKILLS_HOME,
  join(repo, '..', 'longevity-skills'),
  join(homedir(), 'longevity-skills'),
  join(homedir(), 'longpi', 'longevity-skills'),
].filter(Boolean)
const home = candidates.find((dir) => existsSync(join(dir, 'catalog.json')))
if (!home) throw new Error(`no longevity-skills checkout with catalog.json in: ${candidates.join(', ')}`)

const catalog = JSON.parse(readFileSync(join(home, 'catalog.json'), 'utf8'))
const content = JSON.parse(readFileSync(join(repo, 'data', 'codex', 'v2', 'content.zh.json'), 'utf8'))
const errors = []
/** A library skill nobody has written card copy for yet. With --allow-pending it is left out instead of failing. */
const allowPending = process.argv.includes('--allow-pending')
const pending = []

const TOOL_DOMAIN = '工具与证据库'
const SPECIES_IDS = new Set(content.species.map((row) => row.id))

function tierOf(skill) {
  if (skill.evidence === 'rct') return 'trial'
  if (skill.evidence === 'in_vitro') return 'cell'
  if (skill.evidence === 'animal') return 'animal'
  if ((skill.evidence === 'method' || skill.evidence === 'review') && !(skill.species ?? []).includes('human')) return 'animal'
  return 'human'
}

function paperOf(name) {
  const path = join(home, 'skills', name, 'skill.json')
  if (!existsSync(path)) return {}
  try {
    const paper = JSON.parse(readFileSync(path, 'utf8')).paper
    return paper && typeof paper === 'object' ? paper : {}
  } catch {
    return {}
  }
}

/** Split the library summary into "what the study did" and "what the personal report does". */
function splitSummary(text) {
  const sentences = String(text ?? '').split('。').map((part) => part.trim()).filter(Boolean)
  const cut = sentences.findIndex((part) => part.startsWith('个人报告'))
  const about = (cut < 0 ? sentences : sentences.slice(0, cut))
  const use = cut < 0 ? [] : sentences.slice(cut)
  const keep = []
  for (const part of about) {
    if (keep.length > 0 && [...keep, part].join('。').length > 150) break
    keep.push(part)
  }
  return {
    about_zh: keep.length ? `${keep.join('。')}。` : '',
    use_zh: use.length ? `${use.join('。')}。` : '',
  }
}

function seedOf(text) {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

/** Display width in CJK characters: Latin letters, digits and spaces count half. */
function widthOf(text) {
  let width = 0
  for (const char of text) width += /[\u0000-\u024f\u2000-\u206f]/.test(char) ? 0.5 : 1
  return width
}

function checkCopy(id, headline, hook) {
  const { headline_max: hmax, hook_max: kmax, forbidden } = content.rules
  if (!headline) errors.push(`${id}: no headline`)
  if (widthOf(headline) > hmax) errors.push(`${id}: headline over ${hmax}: ${headline}`)
  if (widthOf(hook) > kmax) errors.push(`${id}: hook over ${kmax}: ${hook}`)
  for (const word of forbidden) if (`${headline}${hook}`.includes(word)) errors.push(`${id}: forbidden「${word}」`)
  if (/["“”]/.test(`${headline}${hook}`)) errors.push(`${id}: use 「」 quotes`)
}

const chapterOfDomain = new Map()
for (const chapter of content.chapters) for (const domain of chapter.domains) chapterOfDomain.set(domain, chapter.id)

const studies = []
const tools = []
for (const skill of [...catalog.skills].sort((a, b) => a.name.localeCompare(b.name))) {
  const domain = (skill.domains ?? [])[0] ?? ''
  const paper = paperOf(skill.name)
  if (domain === TOOL_DOMAIN) {
    const row = content.tools[skill.name]
    if (!row) { (allowPending ? pending : errors).push(`tool ${skill.name}: no copy`); continue }
    checkCopy(skill.name, row[0], row[1])
    tools.push({ id: `t-${skill.name}`, family: 'tool', headline_zh: row[0], hook_zh: row[1], glyph: row[2], skill: skill.name, blurb_zh: skill.blurb_zh ?? '' })
    continue
  }
  const chapter = chapterOfDomain.get(domain)
  if (!chapter) { errors.push(`${skill.name}: domain「${domain}」is in no chapter`); continue }
  const copy = content.studies[skill.name]
  if (!copy) { (allowPending ? pending : errors).push(`${skill.name}: no copy`); continue }
  checkCopy(skill.name, copy[0], copy[1])
  const tier = tierOf(skill)
  const species = (skill.species ?? []).filter(Boolean)
  const nonHuman = species.find((name) => name !== 'human' && name !== 'cell_line') ?? null
  const caveat = content.tiers[tier].caveat_zh.replace('{species}', content.species_zh[nonHuman] ?? '动物')
  studies.push({
    id: `s-${skill.name}`,
    family: 'study',
    chapter,
    tier,
    headline_zh: copy[0],
    hook_zh: copy[1],
    ...splitSummary(paper.summary_zh),
    caveat_zh: caveat,
    species,
    species_zh: species.map((name) => content.species_zh[name] ?? name).filter((name, i, all) => all.indexOf(name) === i).join('、'),
    meet: species.filter((name) => SPECIES_IDS.has(name)),
    source: {
      skill: skill.name,
      ...(paper.doi ? { doi: paper.doi } : {}),
      ...(paper.title ? { title: paper.title } : {}),
      ...(paper.journal ? { journal: paper.journal } : {}),
      ...(paper.year ? { year: paper.year } : {}),
      ...(paper.authors ? { authors: paper.authors } : {}),
    },
    art: { motif: content.chapters.find((row) => row.id === chapter).motif, seed: seedOf(skill.name) },
  })
}

for (const name of Object.keys(content.studies)) {
  if (!studies.some((card) => card.source.skill === name)) console.warn(`copy for ${name}: skill not in this library checkout`)
}

const tierRank = (tier) => content.tiers[tier].rank
const chapterNo = new Map(content.chapters.map((row) => [row.id, row.no]))
studies.sort((a, b) => chapterNo.get(a.chapter) - chapterNo.get(b.chapter) || tierRank(b.tier) - tierRank(a.tier) || a.id.localeCompare(b.id))
studies.forEach((card, index) => { card.no = String(index + 1).padStart(3, '0') })
tools.forEach((card, index) => { card.no = `T${index + 1}` })

const species = content.species.map((row) => {
  const linked = studies.filter((card) => card.meet.includes(row.id)).map((card) => card.id)
  if (linked.length === 0) errors.push(`species ${row.id}: no study card meets it`)
  return { ...row, id: `sp-${row.id}`, key: row.id, family: 'species', studies: linked }
})

const milestones = content.milestones.map((row) => ({ ...row, family: 'milestone', caveat_zh: content.milestone_caveat_zh }))

if (errors.length > 0) {
  console.error(errors.join('\n'))
  process.exit(1)
}

const pack = {
  version: 2,
  library: { revision: catalog.version ?? null, skills: catalog.skills.length },
  tiers: content.tiers,
  chapters: content.chapters.map(({ domains, ...rest }) => ({ ...rest, domains, size: studies.filter((card) => card.chapter === rest.id).length })),
  studies,
  species,
  tools,
  milestones,
}

const outDir = join(repo, 'data', 'codex', 'v2')
mkdirSync(outDir, { recursive: true })
writeFileSync(join(outDir, 'cards.json'), `${JSON.stringify(pack, null, 2)}\n`)
mkdirSync(join(repo, 'preview', 'codex'), { recursive: true })
writeFileSync(join(repo, 'preview', 'codex', 'data.js'), `// Generated by scripts/codex-v2/build.mjs. Do not edit.\nwindow.CODEX = ${JSON.stringify(pack)};\n`)

const count = (key) => Object.fromEntries(Object.keys(content.tiers).map((tier) => [tier, studies.filter((card) => card.tier === tier).length]))
console.log(`library ${home} (${catalog.skills.length} skills)`)
console.log(`study ${studies.length}`, count())
console.log('chapters', Object.fromEntries(pack.chapters.map((row) => [row.title_zh, row.size])))
console.log(`species ${species.length}`, Object.fromEntries(species.map((row) => [row.name_zh, row.studies.length])))
console.log(`tools ${tools.length}, milestones ${milestones.length}`)
if (pending.length > 0) console.warn(`待上架 ${pending.length}:\n  ${pending.join('\n  ')}`)
