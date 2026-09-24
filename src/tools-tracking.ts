// Tools for the person's own intervention plan: save it (after they confirm
// the structured read-back), record check-ins, judge each item against the
// record, and model goals. The plan is theirs; these tools never suggest a
// medicine or a dose, and never write the Mirobody chart.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { loadCatalog } from './catalog.ts'
import type { Config } from './config.ts'
import { addCheckIns, currentPlan, isoDay, normalizePlan, readCheckIns, readPlans, savePlan, CATEGORIES, CHECKIN_TAGS } from './interventions.ts'
import { asJson } from './json.ts'
import type { MountState } from './mirobody.ts'
import { resolveDataDir, resolveSkillsHome } from './paths.ts'
import { loadRecords } from './records.ts'
import { buildTracking, describeItem, invalidateTracking, modelGoals } from './tracking.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

const HOW_TO_READ = [
  '有效 = the change is larger than within-person noise (reference change value) in the good direction, the retest came late enough, and the plan was followed.',
  '波动内 = the change is inside normal within-person variation; do not call it an improvement or a failure.',
  '反向 = larger than noise in the bad direction; suggest a recheck and talking to their doctor.',
  '无法判断 = no baseline, too early to retest, too little adherence, acute inflammation, or no variation data. Say which.',
  'combined_with and confounders mean the change cannot be credited to one item. Say so.',
  'expected rows are trial averages for a population, not a prediction for this person.',
  'Model cards (phenoage, china-par) are model estimates. Say 模型估计 and quote boundary_zh. Never turn them into "you will live X more years".',
  'suggestions are the only next steps to offer. Never add a medicine, a supplement, or a dose.',
]

export function registerTrackingTools(ctx: Context, config: () => Config, mount: MountState): void {
  const where = () => {
    const current = config()
    return { current, dataDir: resolveDataDir(current.dataDir), skillsHome: resolveSkillsHome(current.skillsHome) }
  }

  async function tracking() {
    const { current, dataDir, skillsHome } = where()
    const catalog = loadCatalog(skillsHome)
    const records = await loadRecords(current, dataDir, mount.pluginHome)
    return buildTracking({ config: current, dataDir, skillsHome, catalog, records, today: isoDay() })
  }

  ctx.tools.register(defineTool({
    name: 'save_intervention_plan',
    description: 'Save the person\'s own intervention plan (from what they said, or a plan document from their doctor or longevity coach that they shared). First call with confirm=false: the tool checks it and returns the structured read-back and warnings. Read that back to the person. Only after they confirm, call again with the same plan and confirm=true. Each item needs a start date (YYYY-MM-DD) so its effect can be judged against a baseline. List the markers each item aims to move (hs-CRP, 空腹血糖, LDL-C, 血压…) and goal values if the plan has them. For a wearable-tracked item give target {metric, op, value} using a Mirobody indicator name from read_personal_situation (dailySteps, dailyTotalSleepTime). Medicines and supplements are saved by name only: their dose and dose log stay in Mirobody. Never add an item, a dose or a goal the person did not state. Saving a new plan keeps earlier versions.',
    parameters: {
      title: { type: 'string', description: 'Plan title, such as 2026 秋季方案.' },
      note: { type: 'string', description: 'Anything else the plan says, in the person\'s words.' },
      source: { type: 'string', enum: ['chat', 'file'], description: 'chat when the person described it, file when it came from a document they shared.' },
      items: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            category: { type: 'string', enum: [...CATEGORIES], required: true, description: 'diet, exercise, sleep, supplement, drug, behavior, weight, or other.' },
            title: { type: 'string', required: true, description: 'Short name, such as 地中海饮食 or 快走.' },
            detail: { type: 'string', description: 'What it involves, in the plan\'s words. No dose for a medicine or supplement.' },
            start: { type: 'string', required: true, description: 'Start date, YYYY-MM-DD.' },
            end: { type: 'string', description: 'End date, YYYY-MM-DD, when the plan gives one.' },
            frequency: {
              type: 'object',
              additionalProperties: false,
              properties: {
                times: { type: 'integer', description: 'How many times.' },
                per: { type: 'string', enum: ['day', 'week'], description: 'Per day or per week.' },
              },
            },
            target: {
              type: 'object',
              additionalProperties: false,
              properties: {
                metric: { type: 'string', description: 'Mirobody indicator measured daily, such as dailySteps.' },
                op: { type: 'string', enum: ['>=', '<='] },
                value: { type: 'number' },
                unit: { type: 'string' },
              },
              description: 'A daily wearable threshold that counts the day as done.',
            },
            markers: { type: 'array', items: { type: 'string' }, description: 'Markers this item aims to move, by name as on the report.' },
            medication: { type: 'string', description: 'For a medicine or supplement: its name as on the Mirobody medication plan.' },
          },
        },
      },
      goals: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            marker: { type: 'string', required: true },
            value: { type: 'number', required: true },
            unit: { type: 'string' },
          },
        },
        description: 'Target values the plan states, such as 空腹血糖 5.3 mmol/L.',
      },
      confirm: { type: 'boolean', description: 'false (default) checks and returns the read-back; true saves after the person confirmed it.' },
    },
    output: jsonOut,
    timeoutMs: 60000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { current, dataDir } = where()
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      const normalized = normalizePlan(args, {
        today: isoDay(),
        medications: records.medications.map((row) => ({ name: row.name, ...(row.plan_id ? { plan_id: row.plan_id } : {}) })),
        previous: currentPlan(dataDir),
      })
      const readBack = normalized.plan.items.map(describeItem)
      if (normalized.errors.length > 0) {
        return asJson({ ok: false, saved: false, errors: normalized.errors, warnings: normalized.warnings, read_back: readBack, hint: 'Ask the person for what is missing. Do not fill a date or a marker yourself.' })
      }
      if (!args.confirm) {
        return asJson({
          ok: true,
          saved: false,
          read_back: readBack,
          goals: normalized.plan.goals,
          warnings: normalized.warnings,
          next: 'Read the read_back and warnings to the person. Save only after they confirm, by calling again with confirm=true.',
        })
      }
      const saved = savePlan(dataDir, normalized.plan)
      invalidateTracking()
      return asJson({
        ok: true,
        saved: true,
        version: saved.version,
        read_back: readBack,
        warnings: normalized.warnings,
        note: 'Saved locally in this harness (interventions/plan.jsonl). Not written to Mirobody. Check-ins go through log_intervention_checkin; medicine and supplement doses are logged in Mirobody.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'log_intervention_checkin',
    description: 'Record that the person did (or did not do) an item of their saved plan on a day, when they tell you. item is the item title or id. done true/false; amount and unit when they give one (40 分钟). Tag a day that could disturb a lab result: illness, travel, lab_change (a different lab or hospital), stress. Medicine and supplement doses are logged in Mirobody, not here. Never log something the person did not say.',
    parameters: {
      entries: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            item: { type: 'string', required: true, description: 'Item title or id from the saved plan.' },
            date: { type: 'string', description: 'YYYY-MM-DD; default today.' },
            done: { type: 'boolean', description: 'Whether they did it that day.' },
            amount: { type: 'number', description: 'How much, when they said (minutes, steps, hours).' },
            unit: { type: 'string' },
            note: { type: 'string', description: 'Their words, short.' },
            tags: { type: 'array', items: { type: 'string', enum: [...CHECKIN_TAGS] } },
          },
        },
      },
    },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { dataDir } = where()
      const result = addCheckIns(dataDir, Array.isArray(args.entries) ? args.entries : [], { today: isoDay(), source: 'chat' })
      if (result.saved.length > 0) invalidateTracking()
      return asJson({ ok: result.saved.length > 0, saved: result.saved.length, entries: result.saved, problems: result.problems })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_intervention_plan',
    description: 'Read the person\'s saved intervention plan, its earlier versions, and recent check-ins. Read-only.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 10000,
    isConcurrencySafe: () => true,
    async execute() {
      const { dataDir } = where()
      const plan = currentPlan(dataDir)
      return asJson({
        plan: plan ? { ...plan, read_back: plan.items.map(describeItem) } : null,
        versions: readPlans(dataDir).map((row) => ({ version: row.version, saved_at: row.saved_at, title: row.title, items: row.items.length })),
        recent_checkins: readCheckIns(dataDir).slice(-20).reverse(),
        ...(plan ? {} : { hint: 'No plan yet. Offer to save one with save_intervention_plan when the person shares theirs.' }),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'review_interventions',
    description: 'Judge each item of the saved plan against the Mirobody record: for every marker it aims at, the baseline before it started, the latest retest, whether the change is larger than within-person noise, how well the plan was followed (wearable, Mirobody dose log, or check-ins), what else changed at the same time, and what trials saw on average. Also returns phenotypic age at every past checkup with its noise band, model cards for the goals, and next steps. Use for 方案有没有用, 哪些有效, 怎么调整. Read-only; runs skill scripts.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 180000,
    isConcurrencySafe: () => false,
    async execute() {
      const result = await tracking()
      return asJson({ how_to_read: HOW_TO_READ, ...result, items: result.items.map((item) => ({ ...item, adherence: { ...item.adherence, calendar: undefined } })) })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'model_intervention_goals',
    description: 'What-if for goal values the person names without saving them, such as 空腹血糖降到 5.0 或 CRP 降到 1: runs the phenotypic-age skill (and the China-PAR risk model when its coefficients are verified) at their latest complete checkup with those targets, and returns now vs goal and the change from each target alone. Model estimates, not predictions: say 模型估计 and quote boundary_zh.',
    parameters: {
      goals: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            marker: { type: 'string', required: true },
            value: { type: 'number', required: true },
            unit: { type: 'string' },
          },
        },
      },
    },
    output: jsonOut,
    timeoutMs: 120000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { current, dataDir, skillsHome } = where()
      const catalog = loadCatalog(skillsHome)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      const goals = (Array.isArray(args.goals) ? args.goals : []).flatMap((row) => {
        const value = Number(row?.value)
        return row && typeof row.marker === 'string' && Number.isFinite(value) ? [{ marker: row.marker, value, unit: typeof row.unit === 'string' ? row.unit : '' }] : []
      })
      return asJson(await modelGoals({ config: current, dataDir, skillsHome, catalog, records, today: isoDay() }, goals))
    },
  }))
}
