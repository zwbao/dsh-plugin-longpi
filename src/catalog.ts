import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

export interface SkillCard {
  name: string
  description: string
  domain: string
  blurb: string
  lead: string
  script: string | null
}

export interface Catalog {
  home: string
  revision: string
  cards: SkillCard[]
  error: string
}

const NAME = /^[a-z0-9][a-z0-9-]*$/

export function parseFrontmatter(raw: string): { name: string; description: string; body: string } {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
  if (!match) throw new Error('SKILL.md missing frontmatter')
  const fm = match[1] ?? ''
  const body = match[2] ?? ''
  const name = fm.match(/^name:\s*['"]?([a-z0-9][a-z0-9-]*)['"]?\s*$/m)?.[1]
  if (!name) throw new Error('SKILL.md missing name')
  const description = readDescription(fm)
  if (!description) throw new Error(`${name}: SKILL.md missing description`)
  return { name, description, body }
}

function readDescription(fm: string): string {
  const lines = fm.split(/\r?\n/)
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? ''
    if (/^description:\s*(>-|[>|])\s*$/.test(line)) {
      const block: string[] = []
      for (let inner = index + 1; inner < lines.length; inner += 1) {
        const next = lines[inner] ?? ''
        if (next.trim() !== '' && !/^\s/.test(next)) break
        if (next.trim() === '') continue
        block.push(next.trim())
      }
      return block.join(' ').replace(/\s+/g, ' ').trim()
    }
    const inline = line.match(/^description:\s*(.+)\s*$/)
    if (inline?.[1]) return inline[1].replace(/^['"]|['"]$/g, '').trim()
  }
  return ''
}

export function parseReadme(raw: string): Map<string, { domain: string; blurb: string }> {
  const map = new Map<string, { domain: string; blurb: string }>()
  let domain = '未归类'
  for (const line of raw.split(/\r?\n/)) {
    const heading = line.match(/^##\s+(.+?)\s*$/)
    if (heading?.[1]) {
      domain = heading[1].trim()
      continue
    }
    const bullet = line.match(/^- `skills\/([a-z0-9-]+)\/`\s+[—-]\s+(.+)\s*$/)
    if (bullet?.[1] && bullet[2]) map.set(bullet[1], { domain, blurb: bullet[2].trim() })
  }
  return map
}

export function findScript(skillDir: string, body: string): string | null {
  const standard = join(skillDir, 'scripts', 'personal_report.py')
  if (existsSync(standard)) return standard
  const mentioned = body.match(/scripts\/([A-Za-z0-9._-]+\.py)/)
  if (!mentioned?.[1]) return null
  const candidate = join(skillDir, 'scripts', mentioned[1])
  return existsSync(candidate) ? candidate : null
}

function leadOf(body: string): string {
  const withoutTitle = body.replace(/^#[^\n]*\n/, '')
  const cut = withoutTitle.split(/\n## /)[0] ?? ''
  return cut.replace(/\s+/g, ' ').trim().slice(0, 400)
}

function gitRevision(home: string): string {
  const result = spawnSync('git', ['-C', home, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' })
  return result.status === 0 ? result.stdout.trim() : ''
}

export function loadCatalog(home: string): Catalog {
  if (!home) {
    return {
      home: '',
      revision: '',
      cards: [],
      error: 'longevity-skills checkout not found. Set skillsHome or LONGEVITY_SKILLS_HOME.',
    }
  }
  const skillsDir = join(home, 'skills')
  if (!existsSync(skillsDir)) {
    return { home, revision: gitRevision(home), cards: [], error: `missing ${skillsDir}` }
  }
  const readmePath = join(home, 'README.md')
  const meta = parseReadme(existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '')
  const cards: SkillCard[] = []
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !NAME.test(entry.name)) continue
    const skillMd = join(skillsDir, entry.name, 'SKILL.md')
    if (!existsSync(skillMd)) continue
    let parsed: { name: string; description: string; body: string }
    try {
      parsed = parseFrontmatter(readFileSync(skillMd, 'utf8'))
    } catch {
      continue
    }
    const info = meta.get(entry.name)
    const dir = join(skillsDir, entry.name)
    cards.push({
      name: entry.name,
      description: parsed.description,
      domain: info?.domain ?? '未归类',
      blurb: info?.blurb ?? '',
      lead: leadOf(parsed.body),
      script: findScript(dir, parsed.body),
    })
  }
  cards.sort((a, b) => a.name.localeCompare(b.name))
  return { home, revision: gitRevision(home), cards, error: '' }
}

export function readSkillFile(home: string, name: string): { raw: string; card: SkillCard } | { error: string } {
  if (!NAME.test(name)) return { error: 'skill name must be the directory name' }
  const catalog = loadCatalog(home)
  const card = catalog.cards.find((item) => item.name === name)
  if (!card) return { error: catalog.error || `unknown skill ${name}` }
  const raw = readFileSync(join(home, 'skills', name, 'SKILL.md'), 'utf8')
  return { raw, card }
}

export function commandExcerpt(body: string): string {
  const index = body.search(/^## Command\s*$/m)
  if (index < 0) return ''
  return body.slice(index, index + 1800)
}
