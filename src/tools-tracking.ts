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
import { invalidateRecords, loadRecords } from './records.ts'
import { addSelf, SELF_KEYS, SELF_SPEC } from './selfmeasure.ts'
import { buildTracking, describeItem, describePlan, goalProblems, invalidateTracking, modelGoals } from './tracking.ts'
import { briefOptionsOf, buildPlanBrief, draftPlan } from './planner.ts'
import { FOCUS } from './profile.ts'

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = {
  schema: { type: 'json' as const },
  render: (_args: unknown, value: unknown) => jsonText(value),
}

const HOW_TO_READ = [
  '有效 = the marker moved beyond within-person noise (reference change value) in the direction the plan aims (toward its goal when it has one), both results in one unit, the retest came late enough, and adherence is on record at 50% or more. It says the marker moved that way, not that the item caused it: never call it proof the item worked.',
  '波动内 = the change is inside normal within-person variation; do not call it an improvement or a failure.',
  '反向 = beyond noise, away from the aim (偏离目标); suggest a recheck and talking to their doctor.',
  '无法判断 = no baseline, too early to retest, no or too few check-ins (没有执行记录), too little adherence, units that do not convert, a zero baseline, too few days of home blood pressure, a failed read, acute inflammation, or no variation data. Say which, from reason_zh.',
  'For markers judged by a reference range (haemoglobin, MCV…), reason_zh says 是否合适要结合参考范围: say it too.',
  'combined_with means other items ran on the same marker at the same time; their separate effects cannot be told apart. confounders are other changes in the window. Never credit a change to one item or to the combination.',
  'goal_problems_zh on a model card: those goals could not be modelled (unit or range); no goal value is shown. Tell the person what to fix.',
  'expected rows are trial averages for a population, not a prediction for this person.',
  'Model cards (phenoage, china-par) are model estimates. Say 模型估计 and quote boundary_zh. Never turn them into "you will live X more years".',
  'suggestions are the next steps to offer for the saved plan. A change to the plan is a new draft (draft_intervention_plan), read back and confirmed like any plan. Never add a medicine or a dose.',
]

const DRAFT_HOW_TO_USE = 'If brief.notes_zh says the record has changes beyond normal fluctuation (超出正常波动), say that first: suggest they have a doctor look at those changes before starting the plan, name no cause, and suggest no supplement or dose for them. Tailor the draft with the person (their preferences, constraints, what they already do). State each item\'s evidence (trial average, population, DOI) and that individual results vary. Supplements are options to confirm with a doctor, without a dose. Never start, stop or change a prescription medicine or any dose. Read the plan back with save_intervention_plan confirm=false (pass each item\'s category, title, detail, start, markers and target, and the goals\' marker, value and unit, not the evidence fields) and save only after they agree.'

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
    description: 'Save the person\'s intervention plan: their own (from what they said, or a plan document from their doctor or longevity coach that they shared), or a draft from draft_intervention_plan tailored with them. First call with confirm=false: the tool checks it and returns the structured read-back and warnings. Read that back to the person. Only after they confirm, call again with the same plan and confirm=true. Each item needs a start date (YYYY-MM-DD) so its effect can be judged against a baseline. List the markers each item aims to move (hs-CRP, 空腹血糖, LDL-C, 血压…) and goal values if the plan or the draft has them. For a wearable-tracked item give target {metric, op, value} using a Mirobody indicator name from read_personal_situation (dailySteps, dailyTotalSleepTime). Medicines and supplements are saved by name only: their dose and dose log stay in Mirobody. Never add a dose, a medicine, or a goal number that neither the person, their plan document nor the draft gave. Saving a new plan keeps earlier versions.',
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
      // What is stored, as stored: the plan's title and note, and each item with its details (after dose stripping).
      const readBack = [describePlan(normalized.plan), ...normalized.plan.items.map(describeItem)]
      const goalIssues = goalProblems(loadCatalog(where().skillsHome), normalized.plan.goals, where().skillsHome)
      if (normalized.errors.length > 0) {
        return asJson({ ok: false, saved: false, errors: normalized.errors, warnings: normalized.warnings, read_back: readBack, hint: 'Ask the person for what is missing. Do not fill a date or a marker yourself.' })
      }
      if (!args.confirm) {
        return asJson({
          ok: true,
          saved: false,
          title: normalized.plan.title,
          note: normalized.plan.note,
          read_back: readBack,
          goals: normalized.plan.goals,
          warnings: normalized.warnings,
          ...(goalIssues.length > 0 ? { goal_problems: goalIssues } : {}),
          next: 'Read all of read_back (the plan line and every item with its 说明), the warnings and any goal_problems to the person. Save only after they confirm, by calling again with confirm=true.',
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
        ...(goalIssues.length > 0 ? { goal_problems: goalIssues } : {}),
        note: 'Saved locally in this harness (interventions/plan.jsonl). Not written to Mirobody. Check-ins go through log_intervention_checkin; medicine and supplement doses are logged in Mirobody.',
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'draft_intervention_plan',
    description: 'Draft an intervention plan with the person, from their own results and the collected trial evidence. Returns brief (what is worth improving and why: the markers that move their phenotypic age or China-PAR risk most, and what they care about; evidence-backed lifestyle options with the trial average, population, DOI and cautions from a simple medication screen; their current plan\'s results) and draft (up to 3 items with a start date, target markers and goals computed as their latest value plus the trial average). Lifestyle items only (diet pattern, exercise, sleep, weight, alcohol, smoking, salt); a supplement only as an option marked 需先与医生确认, never with a dose; never a drug. Saves nothing. draft is null when no evidence fits; brief says why.',
    parameters: {
      focus: {
        type: 'array',
        items: { type: 'string', enum: [...FOCUS] },
        description: 'What to improve first for this draft, when the person says so now (bioage, cardio, glucose, weight, sleep, plan). Default: their saved focus.',
      },
      markers: { type: 'array', items: { type: 'string' }, description: 'Markers the person wants to improve, by name as they said it (收缩压, LDL-C, 腰围…). They come first.' },
      constraints: { type: 'string', description: 'What limits them, in their words (膝盖不好、夜班、素食…). Echoed back for you to tailor the draft; it does not change the evidence.' },
      max_items: { type: 'integer', description: 'At most this many items, 1–5. Default 3; fewer is easier to keep and to judge.' },
    },
    output: jsonOut,
    timeoutMs: 180000,
    isConcurrencySafe: () => true,
    async execute(args) {
      const { current, dataDir, skillsHome } = where()
      const catalog = loadCatalog(skillsHome)
      const records = await loadRecords(current, dataDir, mount.pluginHome)
      const today = isoDay()
      const brief = await buildPlanBrief({ config: current, dataDir, skillsHome, catalog, records, today, mount }, briefOptionsOf(args.focus, args.markers))
      const constraints = typeof args.constraints === 'string' ? args.constraints.trim().slice(0, 500) : ''
      return asJson({
        brief,
        draft: draftPlan(brief, { today, ...(Number.isFinite(Number(args.max_items)) && args.max_items != null ? { maxItems: Number(args.max_items) } : {}) }),
        ...(constraints ? { constraints } : {}),
        how_to_use: DRAFT_HOW_TO_USE,
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'log_intervention_checkin',
    description: 'Record that the person did (or did not do) an item of their saved plan on a day, when they tell you. item is the item title or id. done true (做到了), false (没做到), or null to take back that day\'s check-in when they say it was a mistake (the day is unknown again); the latest entry for an item and day counts. amount and unit when they give one (40 分钟). Tag a day that could disturb a lab result: illness, travel, lab_change (a different lab or hospital), stress. Medicine and supplement doses are logged in Mirobody, not here. Never log something the person did not say.',
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
            done: {
              oneOf: [{ type: 'boolean' }, { type: 'null' }],
              description: 'true: they did it that day; false: they did not; null: take back that day\'s check-in.',
            },
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
      // Each entry with its item's title, so the chat card never shows an id.
      const items = currentPlan(dataDir)?.items ?? []
      const entries = result.saved.map((row) => ({ ...row, title: items.find((item) => item.id === row.item)?.title ?? row.item }))
      return asJson({ ok: result.saved.length > 0, saved: result.saved.length, entries, problems: result.problems })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'save_self_measurement',
    description: 'Save measurements the person took themselves and just stated: waist (腰围), home blood pressure (收缩压 sbp, 舒张压 dbp), weight (体重). Pass each value with the unit as they said it (斤, 公斤, 尺/寸, inch, lb are converted; mmHg for pressure) and the date if they gave one (default today, never in the future). Never infer, estimate or copy a value from elsewhere, and never save a reading they did not state. Home blood pressure is judged as the mean of the last 7 days of readings, so several readings over a week count more than one. Self measurements stay on this computer; they are used for a result only when newer than the Mirobody record (a waist or home blood pressure can unlock China-PAR before the next checkup). Returns what was saved (converted) and problems to read back.',
    parameters: {
      entries: {
        type: 'array',
        required: true,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            key: { type: 'string', enum: [...SELF_KEYS], required: true, description: 'waist, sbp (systolic), dbp (diastolic), or weight.' },
            value: { type: 'number', required: true, description: 'The number they said.' },
            unit: { type: 'string', description: 'The unit they said: cm, 厘米, 尺, 寸, inch for waist; mmHg for pressure; kg, 公斤, 斤, lb for weight. Omit to use cm, mmHg or kg.' },
            date: { type: 'string', description: 'YYYY-MM-DD when they measured; default today.' },
          },
        },
      },
    },
    output: jsonOut,
    timeoutMs: 20000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const { dataDir } = where()
      const result = addSelf(dataDir, Array.isArray(args.entries) ? args.entries : [], { today: isoDay() })
      if (result.saved.length > 0) {
        invalidateRecords()
        invalidateTracking()
      }
      return asJson({
        ok: result.saved.length > 0,
        saved: result.saved.map((row) => ({ ...row, label_zh: SELF_SPEC[row.key].label_zh })),
        problems: result.problems,
        note: 'Saved locally (self_measurements.jsonl), not written to Mirobody. Read back each saved value with its unit and date. Home blood pressure counts as the mean of the last 7 days of readings.',
      })
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
        plan: plan ? { ...plan, read_back: [describePlan(plan), ...plan.items.map(describeItem)] } : null,
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
