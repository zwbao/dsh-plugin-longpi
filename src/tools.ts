import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { commandExcerpt, loadCatalog, readSkillFile, type Catalog, type SkillCard } from './catalog.ts'
import type { Config } from './config.ts'
import { matchSkills, domainSummary } from './match.ts'
import type { MountState } from './mirobody.ts'
import { clampMatches, resolveDataDir, resolveSkillsHome } from './paths.ts'
import { normalizeProfile, readProfile, writeProfile, estimatedAge, RISK_FACTS } from './profile.ts'
import { loadRecords, type RecordSnapshot } from './records.ts'
import { readReceipts, runSkill } from './runner.ts'
import { PRODUCT_VERSION } from './version.ts'
import { discoverPython, runBridgeStatus } from './bridge.ts'
import { asJson } from './json.ts'
import { mcpHost } from './mcp.ts'
import { latestOutputs } from './history.ts'
import { loadEvidenceLexicon, mentionedEntities } from './intents.ts'
import { runnableFrom } from './measurements.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

const EVIDENCE_SKILL = 'longevity-evidence'

export function manifestSummary(card: SkillCard) {
  return {
    tier: card.tier,
    kind: card.kind,
    species: card.species,
    intents: card.intents,
    inputs_status: card.inputsStatus,
    structured_measurements: card.inputsStatus !== 'none' && Boolean(card.entry?.measurements_flag),
    inputs: card.inputs.map((spec) => ({
      key: spec.key,
      label: spec.label_zh,
      unit: spec.unit ?? '',
      also_accepts: Object.keys(spec.accept ?? {}),
      unit_required: Boolean(spec.unit_required),
      range: spec.range ?? null,
      required: spec.required,
      from: spec.from,
      ...(spec.output_of ? { output_of: spec.output_of } : {}),
      ...(spec.note_zh ? { note: spec.note_zh } : {}),
    })),
    outputs: card.outputs,
    runtime: card.entry?.runtime ?? '',
  }
}

export function versionCheck(catalog: Catalog, pinned: string): { pinned: string; catalog: string; matches: boolean | null } {
  const want = pinned.trim().replace(/^v/, '')
  if (!want) return { pinned: '', catalog: catalog.version, matches: null }
  return { pinned: want, catalog: catalog.version, matches: catalog.version === want }
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

  async function situation(): Promise<{ catalog: Catalog; records: RecordSnapshot; outputs: ReturnType<typeof latestOutputs>; skillsHome: string; dataDir: string; current: Config }> {
    const { skillsHome, dataDir, current } = where()
    const catalog = loadCatalog(skillsHome)
    const records = await loadRecords(current, dataDir, mount.pluginHome)
    return { catalog, records, outputs: latestOutputs(dataDir), skillsHome, dataDir, current }
  }

  ctx.tools.register(defineTool({
    name: 'read_personal_situation',
    description: 'Read this person\'s saved profile, a summary of their Mirobody record (indicator names, latest values, units, medication plan), readouts earlier skill runs produced, and which methods their record can already run. Read-only. Use this before choosing a longevity skill. Absence means not on file. Do not invent a lab, a dose, or a genotype. Genetics are not listed here; name rsIDs with query_genetic_data. An estimated age from birth year is not the age to pass to a skill unless the saved age field is set.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const { catalog, records, outputs, current } = await situation()
      const profile = { age: records.profile.age, sex: records.profile.sex }
      const dispatch = matchSkills(catalog.cards, '', records.indicators, clampMatches(current.maxSkillMatches), {
        intents: catalog.intents, profile, outputs,
      })
      return asJson({
        profile: records.profile,
        estimated_age_from_birth_year: records.estimated_age,
        use_saved_age: records.profile.age,
        indicators: records.indicators.slice(0, 120),
        indicator_count: records.indicators.length,
        medications: records.medications,
        earlier_readouts: outputs,
        runnable_now: dispatch.matches.map((item) => ({ name: item.name, blurb: item.blurb })),
        almost_runnable: dispatch.near.map((item) => ({ name: item.name, missing: item.runnable.missing })),
        record_status: records.record_status,
        record_error: records.record_error,
        mcp: records.mcp,
        note: 'Medication doses are what the record says. They are not an instruction to change a dose. A missing indicator was not on file. earlier_readouts are outputs of skills already run for this person; cite them with their date.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_longevity_intents',
    description: 'List the kinds of questions the longevity library answers (biological age, methylation age, wearable and sleep, does an intervention have evidence, genes, before-and-after, …), the data each needs, and for this person which skills of each are ready to run or missing one or two inputs. Use this when the question is broad or matched nothing.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const { catalog, records, outputs } = await situation()
      const profile = { age: records.profile.age, sex: records.profile.sex }
      const byName = new Map(catalog.cards.map((card) => [card.name, card]))
      return asJson({
        version: catalog.version,
        intents: catalog.intents.map((intent) => ({
          id: intent.id,
          label: intent.label_zh,
          description: intent.description_zh,
          data: intent.data,
          skills: intent.skills.map((name) => {
            const card = byName.get(name)
            if (!card) return { name, available: false }
            const run = runnableFrom(card, records.indicators, profile, outputs)
            return { name, tier: card.tier, blurb: card.blurb, runnable: run.status, missing: run.missing }
          }),
        })),
        note: 'Pass an intent id to match_longevity_skills to rank that intent\'s skills first. intervention_evidence questions go to query_longevity_evidence.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'match_longevity_skills',
    description: 'Choose which longevity-skills apply to this person and this question. Returns a short ranked list with the detected intents and, per skill, whether this person\'s record already has its inputs. Dispatch only those names. Model-organism and cell-only skills appear only when the question names that organism. An empty list means nothing matched: say so and look at list_longevity_intents. The score is a sort key, not a biological age.',
    parameters: {
      question: {
        type: 'string',
        description: 'What the person asked, in their words. Empty lists the skills this record can already run.',
      },
      intent: {
        type: 'string',
        description: 'Optional intent id from list_longevity_intents, when you already know what kind of question it is.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { catalog, records, outputs, skillsHome, current } = await situation()
      const lexicon = loadEvidenceLexicon(skillsHome)
      const question = args.question ?? ''
      const matched = matchSkills(catalog.cards, question, records.indicators, clampMatches(current.maxSkillMatches), {
        intents: catalog.intents,
        explicitIntents: args.intent ? [args.intent] : [],
        profile: { age: records.profile.age, sex: records.profile.sex },
        outputs,
        lexicon,
      })
      return asJson({
        question,
        revision: catalog.revision,
        version: catalog.version,
        catalog_count: catalog.cards.length,
        catalog_error: catalog.error,
        saved_age: records.profile.age,
        sex: records.profile.sex,
        indicator_count: records.indicators.length,
        mentioned_entities: mentionedEntities(question, catalog.intents, lexicon),
        ...matched,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_longevity_skill',
    description: 'Read one longevity skill by its directory name, after match_longevity_skills. Follow that file. Do not run a skill you have not read. The manifest lists each input with its unit, accepted units and plausible range; when structured_measurements is true, pass values to run_longevity_skill as measurements and the harness converts units and builds the file. Missing inputs stay missing. Cohort hazard ratios and experimental doses are not personal instructions.',
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
        manifest: manifestSummary(found.card),
        command: commandExcerpt(found.raw),
        content: found.raw.slice(0, 30_000),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'run_longevity_skill',
    description: 'Run one skill\'s script. For a skill whose manifest has structured_measurements, pass measurements as {key, value, unit} copied from read_personal_situation (key may be the input key or the indicator name on the report; unit exactly as the record gives it) — the harness converts declared units, checks ranges, refuses a missing or wrong unit, fills age and sex from the saved profile, and adds --out. Otherwise stage files and arguments copied from the skill command. The script computes the readout. Do not calculate the formula yourself and do not fill a missing marker from another file or from memory. Quote the returned excerpt, including 边界. A refusal or non-zero exit is the answer; do not replace it with a guess.',
    parameters: {
      name: {
        type: 'string',
        required: true,
        description: 'Skill directory name returned by match_longevity_skills.',
      },
      measurements: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: { type: 'string', required: true, description: 'Input key or the indicator name as the record shows it.' },
            value: { type: 'string', required: true, description: 'The value exactly as recorded.' },
            unit: { type: 'string', description: 'The unit exactly as recorded; empty only when none was recorded.' },
          },
        },
        description: 'Structured measurements for skills with structured_measurements.',
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
      use_profile: {
        type: 'boolean',
        description: 'Fill age and sex from the saved profile when the skill declares them. Default true.',
      },
    },
    output: jsonOut,
    timeoutMs: 180000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const catalog = loadCatalog(skillsHome)
      const profile = readProfile(dataDir)
      return asJson(await runSkill({
        home: skillsHome,
        dataDir,
        name: args.name,
        args: args.args ?? [],
        files: (args.files ?? []).flatMap((file) => {
          if (!file || typeof file.name !== 'string' || typeof file.text !== 'string') return []
          return [{ name: file.name, text: file.text }]
        }),
        measurements: (args.measurements ?? []).flatMap((item) => {
          if (!item || typeof item.key !== 'string') return []
          return [{ key: item.key, value: String(item.value ?? ''), unit: typeof item.unit === 'string' ? item.unit : '' }]
        }),
        profile: { age: profile.age, sex: profile.sex },
        useProfile: args.use_profile !== false,
        python: current.skillPython,
        runtimes: current.skillRuntimes,
        timeoutMs: current.skillTimeoutMs,
        revision: catalog.revision,
      }))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'query_longevity_evidence',
    description: 'Look up what the papers collected in longevity-skills state about drugs, supplements, diets, genes or proteins, grouped into human studies, animal experiments and cell experiments, each with its citation. Use for "does X work", "what does research say about gene Y", or to see what the collected papers say about a medicine on the plan. It never gives a dose. Animal and cell results are not human effects.',
    parameters: {
      entities: {
        type: 'array',
        items: { type: 'string' },
        description: 'Names to look up, in any language (NMN, 二甲双胍, rapamycin, FOXO3). match_longevity_skills returns mentioned_entities you can pass here.',
      },
      include_medications: {
        type: 'boolean',
        description: 'Also look up every medicine on this person\'s plan. Default false.',
      },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { skillsHome, dataDir, current } = where()
      const catalog = loadCatalog(skillsHome)
      if (!catalog.cards.some((card) => card.name === EVIDENCE_SKILL)) {
        return asJson({ ok: false, error: `${EVIDENCE_SKILL} is not in this checkout`, hint: 'Update longevity-skills, or use the evipedia skill.' })
      }
      const entities = (args.entities ?? []).map((item) => String(item).trim()).filter((item) => item && !item.includes('..') && item.length <= 80).slice(0, 8)
      const runArgs: string[] = []
      for (const entity of entities) runArgs.push('--entity', entity)
      const files: Array<{ name: string; text: string }> = []
      if (args.include_medications) {
        const records = await loadRecords(current, dataDir, mount.pluginHome)
        const names = records.medications.map((item) => item.name).filter(Boolean)
        if (names.length > 0) {
          files.push({ name: 'meds.txt', text: `${names.join('\n')}\n` })
          runArgs.push('--medications', 'meds.txt')
        }
      }
      if (runArgs.length === 0) return asJson({ ok: false, error: 'no entity to look up', hint: 'Pass entities, or set include_medications when the plan is on file.' })
      return asJson(await runSkill({
        home: skillsHome,
        dataDir,
        name: EVIDENCE_SKILL,
        args: runArgs,
        files,
        python: current.skillPython,
        runtimes: current.skillRuntimes,
        timeoutMs: current.skillTimeoutMs,
        revision: catalog.revision,
        reportLimit: 12_000,
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
      const personal = catalog.cards.filter((card) => card.tier !== 'C')
      return asJson({
        revision: catalog.revision,
        version: catalog.version,
        count: catalog.cards.length,
        indexed_only: catalog.cards.length - personal.length,
        error: catalog.error,
        domains: domainSummary(personal),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_personal_profile',
    description: 'Save the display name, birth year, chronological age, sex, and the yes/no facts a risk equation needs (smoker, diabetes, blood-pressure medicine in the last two weeks, northern China, urban, family history of heart attack or stroke) that this person stated. This is the profile the skills may use. It does not write the Mirobody chart. Pass only fields the person just gave; never infer a yes/no fact from a lab value or a medicine name. Age must be the age they stated; do not store an age you computed unless they confirmed it. Sex is female, male, other, or unknown.',
    parameters: {
      displayName: { type: 'string', description: 'Name they want on the board, at most 40 characters. Omit to leave blank.' },
      birthYear: { type: 'integer', description: 'Four-digit birth year, if they gave one.' },
      age: { type: 'integer', description: 'Chronological age they stated, 0–130.' },
      sex: { type: 'string', enum: ['female', 'male', 'other', 'unknown'], description: 'Sex they stated.' },
      smoker: { type: 'boolean', description: 'They smoke cigarettes now (China-PAR).' },
      diabetes: { type: 'boolean', description: 'They have diabetes: a diagnosis, fasting glucose at or above 7.0 mmol/L, or diabetes medicine (as they state it).' },
      bp_treated: { type: 'boolean', description: 'They took blood-pressure medicine in the last two weeks.' },
      north: { type: 'boolean', description: 'They live in northern China (north of the Yangtze); false for southern China.' },
      urban: { type: 'boolean', description: 'They live in a city; false for a rural area.' },
      family_history: { type: 'boolean', description: 'A parent or sibling had a heart attack or stroke.' },
    },
    output: jsonOut,
    timeoutMs: 10000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const dataDir = resolveDataDir(config().dataDir)
      const current = readProfile(dataDir)
      const risk = { ...current.risk }
      for (const key of RISK_FACTS) {
        const value = (args as Record<string, unknown>)[key]
        if (typeof value === 'boolean') risk[key] = value
      }
      const next = {
        displayName: args.displayName ?? current.displayName,
        birthYear: args.birthYear ?? current.birthYear,
        age: args.age ?? current.age,
        sex: args.sex ?? current.sex,
        risk,
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
    description: 'Report whether the longevity-skills checkout and the Mirobody engine are available, which library version is loaded, and which skill runtimes are configured. Use this when a skill or a record tool failed. Does not return the chart or any token.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => true,
    async execute() {
      const current = config()
      const { skillsHome, dataDir } = where()
      const catalog = loadCatalog(skillsHome)
      const python = discoverPython(current.pythonBin, mount.pluginHome)
      const needed = [...new Set(catalog.cards.map((card) => card.entry?.runtime).filter((item): item is string => Boolean(item)))]
      return asJson({
        version: PRODUCT_VERSION,
        skills: {
          found: Boolean(skillsHome),
          revision: catalog.revision,
          version: catalog.version,
          source: catalog.source,
          count: catalog.cards.length,
          tiers: {
            A: catalog.cards.filter((card) => card.tier === 'A').length,
            B: catalog.cards.filter((card) => card.tier === 'B').length,
            C: catalog.cards.filter((card) => card.tier === 'C').length,
            tool: catalog.cards.filter((card) => card.tier === 'tool').length,
          },
          pin: versionCheck(catalog, current.skillsVersion),
          runtimes: needed.map((name) => ({ name, configured: Boolean(current.skillRuntimes?.[name]?.trim()) })),
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
          error_kind: item.error_kind ?? '',
        })),
      })
    },
  }))
}
