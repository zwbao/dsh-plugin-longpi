// Build the 长寿图鉴 library (docs/codex-design.md 1.2 §6.4) from the longevity-skills checkout and
// data/codex/v3/content.zh.json. Writes data/codex/v3/library.json.
//   - Only cards whose review passed go on the shelf; the rest are listed as 待上架 (pending).
//   - Copy checks: forbidden and internal words, negation tails, lengths, colour reason present.
//   - The colour is the content file's tier (the library's `evidence` field is only a starting point).
// Usage: node scripts/build-codex.mjs [--strict]   (--strict fails when any library skill has no reviewed card)

import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { homedir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const repo = join(dirname(fileURLToPath(import.meta.url)), '..')
const candidates = [
  process.env.LONGEVITY_SKILLS_HOME,
  join(repo, '..', 'longevity-skills'),
  join(homedir(), 'longevity-skills'),
  join(homedir(), '.dsh', 'longpi', 'longevity-skills'),
].filter(Boolean)
const home = candidates.find((dir) => existsSync(join(dir, 'catalog.json')))
if (!home) throw new Error(`no longevity-skills checkout with catalog.json in: ${candidates.join(', ')}`)

const strict = process.argv.includes('--strict')
const catalog = JSON.parse(readFileSync(join(home, 'catalog.json'), 'utf8'))
const content = JSON.parse(readFileSync(join(repo, 'data', 'codex', 'v3', 'content.zh.json'), 'utf8'))
const TOOL_DOMAIN = '工具与证据库'
const TIERS = new Set(['cell', 'animal', 'human', 'trial'])
const SPECIES = new Set(content.species.map((row) => row.id))

/** Display width: Latin letters, digits and spaces count half. */
export function widthOf(text) {
  let width = 0
  for (const char of String(text ?? '')) width += /[\u0000-ɏ -⁯]/.test(char) ? 0.5 : 1
  return width
}

/** Problems with one card's copy; an empty list means it may go on the shelf. */
export function copyProblems(card, rules) {
  const out = []
  const text = `${card.title_zh ?? ''}${card.line_zh ?? ''}${card.about_zh ?? ''}`
  if (!card.title_zh) out.push('no title')
  if (!card.line_zh) out.push('no one-liner')
  if (!card.about_zh) out.push('no 这项研究')
  if (widthOf(card.title_zh) > rules.title_max) out.push(`title over ${rules.title_max}`)
  if (widthOf(card.line_zh) > rules.line_max) out.push(`one-liner over ${rules.line_max}`)
  if ([...String(card.about_zh ?? '')].length > rules.about_max + 10) out.push(`这项研究 over ${rules.about_max}`)
  if (!TIERS.has(card.tier)) out.push(`tier「${card.tier}」`)
  if (!card.tier_reason_zh) out.push('no tier reason')
  for (const word of rules.forbidden) if (text.includes(word)) out.push(`forbidden「${word}」`)
  for (const word of rules.internal) if (text.includes(word)) out.push(`internal word「${word}」`)
  for (const word of rules.tails) if (text.includes(word)) out.push(`negation tail「${word}」`)
  if (/["“”]/.test(text)) out.push('use 「」 quotes')
  return out
}

function seedOf(text) {
  let hash = 0x811c9dc5
  for (const char of text) {
    hash ^= char.codePointAt(0)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash
}

function paperOf(name) {
  try {
    return JSON.parse(readFileSync(join(home, 'skills', name, 'skill.json'), 'utf8')).paper ?? {}
  } catch {
    return {}
  }
}

export function build() {
  const chapterOfDomain = new Map()
  for (const chapter of content.chapters) for (const domain of chapter.domains) chapterOfDomain.set(domain, chapter.id)
  const studies = []
  const pending = []
  const problems = []
  const libraryIssues = []
  for (const skill of [...catalog.skills].sort((a, b) => a.name.localeCompare(b.name))) {
    const domain = (skill.domains ?? [])[0] ?? ''
    if (domain === TOOL_DOMAIN) continue
    const chapter = chapterOfDomain.get(domain)
    if (!chapter) { problems.push(`${skill.name}: domain「${domain}」is in no chapter`); continue }
    const card = content.studies[skill.name]
    if (!card) { pending.push(skill.name); continue }
    const issues = copyProblems(card, content.rules)
    if (card.review?.pass !== true || issues.length > 0) {
      pending.push(skill.name)
      if (issues.length > 0) problems.push(`${skill.name}: ${issues.join('; ')}`)
      continue
    }
    if (card.library_issue_zh) libraryIssues.push(`${skill.name}: ${card.library_issue_zh}`)
    const paper = paperOf(skill.name)
    const species = (skill.species ?? []).filter(Boolean)
    studies.push({
      id: `s-${skill.name}`,
      skill: skill.name,
      no: '',
      chapter,
      tier: card.tier,
      tier_reason_zh: card.tier_reason_zh,
      title_zh: card.title_zh,
      line_zh: card.line_zh,
      about_zh: card.about_zh,
      species,
      meet: species.filter((name) => SPECIES.has(name)),
      source: {
        first_author: card.source?.first_author ?? String(paper.authors ?? '').replace(/\s*等$/, ''),
        et_al: card.source?.et_al ?? /等/.test(String(paper.authors ?? '')),
        journal: card.source?.journal ?? paper.journal ?? '',
        year: card.source?.year ?? paper.year ?? null,
        ...(card.source?.doi ?? paper.doi ? { doi: card.source?.doi ?? paper.doi } : {}),
        preprint: card.source?.preprint === true,
        coi_zh: card.source?.coi_zh ?? null,
      },
      research_assay: card.research_assay === true,
      feature_zh: card.research_assay ? null : (card.feature_zh ?? null),
      art: { motif: content.chapters.find((row) => row.id === chapter).motif, seed: seedOf(skill.name) },
    })
  }
  const order = new Map(content.chapters.map((row) => [row.id, row.no]))
  const rank = { trial: 3, human: 2, animal: 1, cell: 0 }
  studies.sort((a, b) => order.get(a.chapter) - order.get(b.chapter) || rank[b.tier] - rank[a.tier] || a.id.localeCompare(b.id))
  studies.forEach((card, i) => { card.no = String(i + 1).padStart(3, '0') })
  const species = content.species.map((row) => ({
    ...row,
    id: `sp-${row.id}`,
    key: row.id,
    studies: studies.filter((card) => card.meet.includes(row.id)).map((card) => card.id),
  }))
  const pack = {
    version: 3,
    library: { revision: catalog.version ?? null, skills: catalog.skills.length },
    chapters: content.chapters.map(({ domains: _domains, theme_for: _theme, size: _size, ...rest }) => ({ ...rest, size: studies.filter((card) => card.chapter === rest.id).length })),
    studies,
    species,
    pending: pending.sort(),
  }
  return { pack, problems, pending, libraryIssues }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { pack, problems, pending, libraryIssues } = build()
  writeFileSync(join(repo, 'data', 'codex', 'v3', 'library.json'), `${JSON.stringify(pack, null, 1)}\n`)
  const count = Object.fromEntries(['trial', 'human', 'animal', 'cell'].map((tier) => [tier, pack.studies.filter((card) => card.tier === tier).length]))
  console.log(`library ${home} (${catalog.skills.length} skills): ${pack.studies.length} on the shelf`, count)
  console.log('chapters', Object.fromEntries(pack.chapters.map((row) => [row.title_zh, row.size])))
  if (pending.length > 0) console.warn(`待上架 ${pending.length}`)
  if (problems.length > 0) console.warn(`copy problems:\n  ${problems.join('\n  ')}`)
  if (libraryIssues.length > 0) console.warn(`library issues to file (${libraryIssues.length}):\n  ${libraryIssues.join('\n  ')}`)
  if (strict && (pending.length > 0 || problems.length > 0)) process.exit(1)
}
