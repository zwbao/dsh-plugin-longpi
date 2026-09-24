import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

export type Tier = 'A' | 'B' | 'C' | 'tool' | ''

export interface InputSpec {
  key: string
  label_zh: string
  aliases?: string[]
  loinc?: string[]
  unit?: string
  accept?: Record<string, number>
  range?: [number, number]
  unit_required?: boolean
  required: boolean
  from: 'measurements' | 'profile' | 'argument' | 'output'
  flag?: string
  output_of?: string[]
  group?: string
  note_zh?: string
}

export interface OutputSpec {
  key: string
  label_zh: string
  unit?: string
}

export interface EntrySpec {
  script: string
  runtime?: string
  measurements_flag?: string
  measurements_header?: string[]
  age_flag?: string
  sex_flag?: string
  medications_flag?: string
  labs_flag?: string
  out_flag?: string
  result_json?: boolean
  /** Flag for a CSV of target values; the script then writes out/levers.json. */
  targets_flag?: string
  levers_json?: boolean
}

export interface IntentSpec {
  id: string
  label_zh: string
  description_zh: string
  data: string[]
  triggers: string[]
  entities?: string[]
  skills: string[]
  priority?: number
}

export interface SkillCard {
  name: string
  description: string
  domain: string
  domains: string[]
  blurb: string
  lead: string
  script: string | null
  kind: string
  tier: Tier
  species: string[]
  intents: string[]
  inputsStatus: 'none' | 'draft' | 'verified'
  inputs: InputSpec[]
  outputs: OutputSpec[]
  entry: EntrySpec | null
  paper: { doi?: string; title_zh?: string; journal?: string; year?: number } | null
}

export interface Catalog {
  home: string
  revision: string
  version: string
  source: 'catalog.json' | 'skill.json' | 'readme' | ''
  cards: SkillCard[]
  intents: IntentSpec[]
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
    if (bullet?.[1] && bullet[2] && !map.has(bullet[1])) map.set(bullet[1], { domain, blurb: bullet[2].trim() })
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

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(path, 'utf8')) as unknown
}

interface ManifestLike {
  name?: string
  kind?: string
  tier?: Tier
  species?: string[]
  domains?: string[]
  blurb_zh?: string
  description?: string
  intents?: string[]
  inputs_status?: 'none' | 'draft' | 'verified'
  inputs?: InputSpec[]
  outputs?: OutputSpec[]
  entry?: EntrySpec
  paper?: { doi?: string; title_zh?: string; journal?: string; year?: number }
}

function scriptOf(dir: string, entry: EntrySpec | undefined, body: string): string | null {
  if (entry?.script && /^scripts\/[A-Za-z0-9._-]+\.py$/.test(entry.script)) {
    const path = join(dir, entry.script)
    return existsSync(path) ? path : null
  }
  return findScript(dir, body)
}

function cardFrom(dir: string, name: string, data: ManifestLike, skillMd: string): SkillCard | null {
  let parsed: { name: string; description: string; body: string }
  try {
    parsed = parseFrontmatter(skillMd)
  } catch {
    return null
  }
  const domains = data.domains?.length ? data.domains : ['未归类']
  return {
    name,
    description: data.description || parsed.description,
    domain: domains[0] ?? '未归类',
    domains,
    blurb: data.blurb_zh ?? '',
    lead: leadOf(parsed.body),
    script: scriptOf(dir, data.entry, parsed.body),
    kind: data.kind ?? 'paper',
    tier: data.tier ?? '',
    species: data.species ?? [],
    intents: data.intents ?? [],
    inputsStatus: data.inputs_status ?? 'none',
    inputs: data.inputs ?? [],
    outputs: data.outputs ?? [],
    entry: data.entry ?? null,
    paper: data.paper ? {
      doi: data.paper.doi,
      title_zh: data.paper.title_zh,
      journal: data.paper.journal,
      year: data.paper.year,
    } : null,
  }
}

function legacyCard(dir: string, name: string, meta: { domain: string; blurb: string } | undefined, skillMd: string): SkillCard | null {
  let parsed: { name: string; description: string; body: string }
  try {
    parsed = parseFrontmatter(skillMd)
  } catch {
    return null
  }
  const domain = meta?.domain ?? '未归类'
  return {
    name,
    description: parsed.description,
    domain,
    domains: [domain],
    blurb: meta?.blurb ?? '',
    lead: leadOf(parsed.body),
    script: findScript(dir, parsed.body),
    kind: 'paper',
    tier: '',
    species: [],
    intents: [],
    inputsStatus: 'none',
    inputs: [],
    outputs: [],
    entry: null,
    paper: null,
  }
}

const cache = new Map<string, { stamp: string; catalog: Catalog }>()

function stampOf(home: string): string {
  const parts: string[] = []
  for (const file of ['catalog.json', 'intents.json', 'README.md']) {
    const path = join(home, file)
    if (existsSync(path)) parts.push(`${file}:${statSync(path).mtimeMs}`)
  }
  const skillsDir = join(home, 'skills')
  if (existsSync(skillsDir)) parts.push(`skills:${statSync(skillsDir).mtimeMs}`)
  const head = join(home, '.git', 'HEAD')
  if (existsSync(head)) parts.push(`head:${statSync(head).mtimeMs}`)
  return parts.join('|')
}

export function loadCatalog(home: string): Catalog {
  if (!home) {
    return {
      home: '',
      revision: '',
      version: '',
      source: '',
      cards: [],
      intents: [],
      error: 'longevity-skills checkout not found. Set skillsHome or LONGEVITY_SKILLS_HOME.',
    }
  }
  const stamp = stampOf(home)
  const hit = cache.get(home)
  if (hit && hit.stamp === stamp) return hit.catalog
  const catalog = buildCatalog(home)
  cache.set(home, { stamp, catalog })
  return catalog
}

function buildCatalog(home: string): Catalog {
  const skillsDir = join(home, 'skills')
  if (!existsSync(skillsDir)) {
    return { home, revision: gitRevision(home), version: '', source: '', cards: [], intents: [], error: `missing ${skillsDir}` }
  }
  const revision = gitRevision(home)
  const catalogPath = join(home, 'catalog.json')
  if (existsSync(catalogPath)) {
    try {
      const parsed = readJson(catalogPath) as { schema?: string; version?: string; skills?: ManifestLike[]; intents?: IntentSpec[] }
      if (parsed.schema === 'longevity-catalog/1' && Array.isArray(parsed.skills)) {
        const cards: SkillCard[] = []
        for (const item of parsed.skills) {
          if (!item.name || !NAME.test(item.name)) continue
          const dir = join(skillsDir, item.name)
          const skillMd = join(dir, 'SKILL.md')
          if (!existsSync(skillMd)) continue
          const card = cardFrom(dir, item.name, item, readFileSync(skillMd, 'utf8'))
          if (card) cards.push(card)
        }
        cards.sort((a, b) => a.name.localeCompare(b.name))
        return { home, revision, version: parsed.version ?? '', source: 'catalog.json', cards, intents: parsed.intents ?? [], error: '' }
      }
    } catch {
      /* fall through to per-directory manifests */
    }
  }
  const readmePath = join(home, 'README.md')
  const meta = parseReadme(existsSync(readmePath) ? readFileSync(readmePath, 'utf8') : '')
  const cards: SkillCard[] = []
  let manifests = 0
  for (const entry of readdirSync(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory() || !NAME.test(entry.name)) continue
    const dir = join(skillsDir, entry.name)
    const skillMd = join(dir, 'SKILL.md')
    if (!existsSync(skillMd)) continue
    const raw = readFileSync(skillMd, 'utf8')
    const manifestPath = join(dir, 'skill.json')
    let card: SkillCard | null = null
    if (existsSync(manifestPath)) {
      try {
        card = cardFrom(dir, entry.name, readJson(manifestPath) as ManifestLike, raw)
        manifests += 1
      } catch {
        card = null
      }
    }
    card ??= legacyCard(dir, entry.name, meta.get(entry.name), raw)
    if (card) cards.push(card)
  }
  cards.sort((a, b) => a.name.localeCompare(b.name))
  let intents: IntentSpec[] = []
  const intentsPath = join(home, 'intents.json')
  if (existsSync(intentsPath)) {
    try {
      intents = ((readJson(intentsPath) as { intents?: IntentSpec[] }).intents) ?? []
    } catch {
      intents = []
    }
  }
  return { home, revision, version: '', source: manifests > 0 ? 'skill.json' : 'readme', cards, intents, error: '' }
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
  const index = body.search(/^## (Command|命令)\s*$/m)
  if (index < 0) return ''
  return body.slice(index, index + 1800)
}
