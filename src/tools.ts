import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import {
  CUSTOMER,
  DEFAULT_ITINERARY,
  INSIGHTS,
  METRICS,
  findMetric,
  metricsFor,
  type ModuleCode,
} from './fixture.ts'
import { retrieve } from './retrieve.ts'
import { addAppointment, addHandoff, getStore } from './store.ts'
import type { Config } from './config.ts'

const MODULES: ModuleCode[] = [
  'biological',
  'physiological',
  'psychological',
  'behavioral',
  'social_env',
]

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

function isModule(value: string): value is ModuleCode {
  return (MODULES as string[]).includes(value)
}

export function registerTools(ctx: Context, config: () => Config): void {
  ctx.tools.register(defineTool({
    name: 'read_dashboard',
    description: 'Read the LongPi demo dashboard: composite biological age, five module ages, alerts, latest insights. Demo data only.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    presentResult: (_args, result) => ({
      card: 'generic',
      title: 'LongPi Dashboard',
      content: result.content,
    }),
    async execute() {
      return {
        demo: true,
        customer: CUSTOMER.display_name,
        chrono_age: CUSTOMER.chrono_age,
        composite_age: CUSTOMER.composite_age,
        modules: CUSTOMER.modules,
        insights: INSIGHTS.map((i) => ({ id: i.id, title_zh: i.title_zh })),
        appointments: getStore().appointments,
        disclaimer_zh: CUSTOMER.disclaimer_zh,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'read_phenotype',
    description: 'Read one LongPi phenotype module (biological / physiological / psychological / behavioral / social_env) and its demo metrics.',
    parameters: {
      module: {
        type: 'string',
        required: true,
        enum: MODULES,
        description: 'Phenotype module code',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute(args) {
      const module = args.module
      if (!isModule(module)) {
        return { error: true, code: 'INVALID_ARGS', message_zh: '未知模块。' }
      }
      const info = CUSTOMER.modules[module]
      return {
        demo: true,
        module,
        label_zh: info.label_zh,
        module_age: info.age,
        metrics: metricsFor(module),
        disclaimer_zh: CUSTOMER.disclaimer_zh,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'explain_metric',
    description: 'Explain one demo metric by code (e.g. hs_crp, iage, vo2max). Never diagnose. Use glossary + current demo value.',
    parameters: {
      metric_code: {
        type: 'string',
        required: true,
        description: 'Metric code or alias, e.g. hs_crp',
      },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute(args) {
      const metric = findMetric(args.metric_code)
      if (!metric) {
        return { error: true, code: 'NOT_FOUND', message_zh: `暂无此指标：${args.metric_code}` }
      }
      return {
        demo: true,
        metric,
        explain_zh: `${metric.name_zh}当前演示值为 ${metric.value} ${metric.unit}（${metric.status}）。参考：${metric.ref}。上次：${metric.previous ?? '无'}。这不是诊断。`,
        disclaimer_zh: CUSTOMER.disclaimer_zh,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'list_insights',
    description: 'List latest physician-reviewed demo AI insights.',
    parameters: {
      limit: { type: 'integer', description: 'Max insights, 1–5' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute(args) {
      const limit = Math.min(5, Math.max(1, args.limit ?? 3))
      return {
        demo: true,
        insights: INSIGHTS.slice(0, limit),
        disclaimer_zh: CUSTOMER.disclaimer_zh,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'get_event_briefing',
    description: 'Return the 2026-10-24 LongPi launch-day itinerary for the longevity journey cohort.',
    parameters: {},
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute() {
      return {
        date: config().itineraryDate,
        title_zh: '长寿之旅团 · 发布会当日',
        items: DEFAULT_ITINERARY,
      }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'search_faq',
    description: 'Keyword search over LongPi demo FAQ and medical terms. Same index the host uses for retrieval.',
    parameters: {
      query: { type: 'string', required: true, description: 'User question or keyword' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute(args) {
      return { demo: true, hits: retrieve(args.query, 5) }
    },
  }))

  ctx.tools.register(defineTool({
    name: 'create_appointment_request',
    description: 'Create a concierge appointment request (demo, max 1 per process). Does not book a real clinic slot.',
    parameters: {
      type: {
        type: 'string',
        enum: ['consult', 'full_panel', 'followup'],
        description: 'Appointment type',
      },
      preferred_slots: {
        type: 'array',
        required: true,
        description: '1–3 preferred date/period slots',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            date: { type: 'string', required: true, description: 'YYYY-MM-DD' },
            period: { type: 'string', required: true, enum: ['am', 'pm'] },
          },
        },
      },
      note: { type: 'string', description: 'Optional note, max 500 chars' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute(args) {
      const slots = Array.isArray(args.preferred_slots) ? args.preferred_slots : []
      if (slots.length < 1 || slots.length > 3) {
        return { error: true, code: 'INVALID_ARGS', message_zh: '请提供 1–3 个意向时段。' }
      }
      return addAppointment({
        type: (args.type as 'consult' | 'full_panel' | 'followup' | undefined) ?? 'consult',
        preferred_slots: slots.map((s) => ({
          date: String(s.date),
          period: s.period === 'pm' ? 'pm' : 'am',
        })),
        note: args.note?.slice(0, 500),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'handoff_concierge',
    description: 'Hand the member to a human concierge. Demo cap: 1 per process. Use for medication or anything the assistant must not decide.',
    parameters: {
      reason_zh: { type: 'string', required: true, description: 'Why a human must take over' },
    },
    output: {
      schema: { type: 'json' },
      render: (_args, value) => jsonText(value),
    },
    async execute(args) {
      return addHandoff(args.reason_zh.slice(0, 300))
    },
  }))

  void METRICS
}
