import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { commandExcerpt, loadCatalog, readSkillFile } from './catalog.ts'
import type { Config } from './config.ts'
import { matchSkills, domainSummary } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveSkillsHome } from './paths.ts'
import { normalizeProfile, readProfile, writeProfile, estimatedAge } from './profile.ts'
import { loadRecords } from './records.ts'
import { readReceipts, runSkill } from './runner.ts'
import { PRODUCT_VERSION } from './version.ts'
import { discoverPython, runBridgeStatus } from './bridge.ts'
import { asJson } from './json.ts'
import { mcpHost } from './mcp.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

export function registerTools(ctx: Context, config: () => Config, mount: MountState): void {
  const where = () => {
    const current = config()
    return {
      skillsHome: resolveSkillsHome(current.skillsHome),
      dataDir: resolveDataDir(current.dataDir),
      current,
    }
  }

  ctx.tools.register(defineTool({
    name: 'read_personal_situation',
    description: 'Read this person\'s saved profile and a summary of their Mirobody record: latest indicator names and values, and the medication plan. Read-only. Use this before choosing a longevity skill. Absence means not on file. Do not invent a lab, a dose, or a genotype. Genetics are not listed here; name rsIDs with query_genetic_data. An estimated age from birth year is not the age to pass to a skill unless the saved age field is set.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const current = config()
      const dataDir = resolveDataDir(current.dataDir)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      return asJson({
        profile: records.profile,
        estimated_age_from_birth_year: records.estimated_age,
        use_saved_age: records.profile.age,
        indicators: records.indicators,
        medications: records.medications,
        record_status: records.record_status,
        record_error: records.record_error,
        mcp: records.mcp,
        note: 'Medication doses are what the record says. They are not an instruction to change a dose. A missing indicator was not on file.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'match_longevity_skills',
    description: 'Choose which longevity-skills apply to this person and this question. Returns a short ranked list. Dispatch only those names. An empty list means nothing matched: say so and look at list_longevity_domains. Model-organism skills drop unless the question names that organism. The score is a sort key, not a biological age.',
    parameters: {
      question: {
        type: 'string',
        description: 'What the person asked, in their words. Empty ranks only skills whose known inputs appear in the record.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const catalog = loadCatalog(skillsHome)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      const limit = clampMatches(current.maxSkillMatches)
      const matched = matchSkills(
        catalog.cards,
        args.question ?? '',
        records.indicators.map((item) => item.name),
        limit,
      )
      return asJson({
        question: args.question ?? '',
        revision: catalog.revision,
        catalog_count: catalog.cards.length,
        catalog_error: catalog.error,
        saved_age: records.profile.age,
        sex: records.profile.sex,
        indicator_count: records.indicators.length,
        ...matched,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_longevity_skill',
    description: 'Read one longevity skill by its directory name, after match_longevity_skills. Follow that file. Do not run a skill you have not read. The command block is the only way to build arguments. Missing inputs stay missing. Cohort hazard ratios and experimental doses are not personal instructions.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Skill directory name, such as accelerated-biological-aging-risk.',
      },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { skillsHome } = where()
      const found = readSkillFile(skillsHome, args.name)
      if ('error' in found) return asJson({ ok: false, error: found.error })
      return asJson({
        ok: true,
        name: found.card.name,
        domain: found.card.domain,
        blurb: found.card.blurb,
        has_script: Boolean(found.card.script),
        command: commandExcerpt(found.raw),
        content: found.raw.slice(0, 30_000),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'run_longevity_skill',
    description: 'Run one skill\'s personal_report.py with files you stage and arguments copied from the skill command. The script computes the readout. Do not calculate the formula yourself, and do not fill a missing marker from another file or from memory. Paths stay inside the run directory: pass biomarkers.csv, not an absolute path. Quote the returned excerpt, including 边界. A non-zero exit is the answer; do not replace it with a guess.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Skill directory name returned by match_longevity_skills.',
      },
      args: {
        type: 'array',
        items: { type: 'string' },
        description: 'Argument vector after the script, such as ["--age","45","--biomarkers","biomarkers.csv","--out","out"].',
      },
      files: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            name: { type: 'string', required: true, description: 'File name, one segment, such as biomarkers.csv.' },
            text: { type: 'string', required: true, description: 'UTF-8 contents built from tool results.' },
          },
        },
        description: 'Measurement files the skill command names. At most 12, each at most 256KB.',
      },
    },
    output: jsonOut,
    timeoutMs: 180000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const catalog = loadCatalog(skillsHome)
      return asJson(await runSkill({
        home: skillsHome,
        dataDir,
        name: args.name,
        args: args.args ?? [],
        files: (args.files ?? []).flatMap((file) => {
          if (!file || typeof file.name !== 'string' || typeof file.text !== 'string') return []
          return [{ name: file.name, text: file.text }]
        }),
        python: current.skillPython,
        timeoutMs: current.skillTimeoutMs,
        revision: catalog.revision,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_longevity_domains',
    description: 'List longevity-skill domains and the directory names in each. Use this when a question matches nothing, or when the person wants to see what the harness can read. Names are methods, not advice to start a method.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute() {
      const catalog = loadCatalog(where().skillsHome)
      return asJson({
        revision: catalog.revision,
        count: catalog.cards.length,
        error: catalog.error,
        domains: domainSummary(catalog.cards),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_personal_profile',
    description: 'Save the display name, birth year, chronological age, and sex this person stated. This is the profile the skills may use. It does not write the Mirobody chart. Pass only fields the person just gave. Age must be the age they stated; do not store an age you computed unless they confirmed it. Sex is female, male, other, or unknown.',
    parameters: {
      displayName: { type: 'string', description: 'Name they want on the board, at most 40 characters. Omit to leave blank.' },
      birthYear: { type: 'integer', description: 'Four-digit birth year, if they gave one.' },
      age: { type: 'integer', description: 'Chronological age they stated, 0–130.' },
      sex: { type: 'string', enum: ['female', 'male', 'other', 'unknown'], description: 'Sex they stated.' },
    },
    output: jsonOut,
    timeoutMs: 10000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const dataDir = resolveDataDir(config().dataDir)
      const current = readProfile(dataDir)
      const next = {
        displayName: args.displayName ?? current.displayName,
        birthYear: args.birthYear ?? current.birthYear,
        age: args.age ?? current.age,
        sex: args.sex ?? current.sex,
      }
      const normalized = normalizeProfile(next)
      if (!normalized.ok) return asJson({ ok: false, error: normalized.error })
      writeProfile(dataDir, normalized.profile)
      return asJson({
        ok: true,
        profile: normalized.profile,
        estimated_age_from_birth_year: estimatedAge(normalized.profile.birthYear, new Date().getFullYear()),
        note: 'Saved locally for this harness. Not written to Mirobody. Use profile.age for a skill, not the estimate, unless the person confirmed the estimate.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'longpi_status',
    description: 'Report whether the longevity-skills checkout and the Mirobody engine are available. Use this when a skill or a record tool failed. Does not return the chart or any token.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const current = config()
      const { skillsHome, dataDir } = where()
      const catalog = loadCatalog(skillsHome)
      const python = discoverPython(current.pythonBin, mount.pluginHome)
      return asJson({
        version: PRODUCT_VERSION,
        skills: {
          found: Boolean(skillsHome),
          revision: catalog.revision,
          count: catalog.cards.length,
          error: catalog.error,
        },
        mirobody: {
          mounted: mount.mounted,
          peer: mount.peer,
          error: mount.error,
          engine: runBridgeStatus(mount.pluginHome, python, current.mirobodyHome, current.timeoutMs),
          mcp: {
            configured: Boolean(current.mcpUrl.trim()),
            host: mcpHost(current.mcpUrl),
            token_set: Boolean(current.mcpToken.trim()),
          },
        },
        receipts: readReceipts(dataDir, 5).map((item) => ({
          at: item.at,
          skill: item.skill,
          ok: item.ok,
          exit_code: item.exit_code,
        })),
      })
    },
  }))
}
