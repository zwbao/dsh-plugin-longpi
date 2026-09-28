// Chat tools. read_season is read-only. log_life_event records sick and travel days,
// which can freeze the streak. Neither tool sends the person's name anywhere.

import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { asJson } from '../json.ts'
import { logLifeEngage, syncEngage } from './engine.ts'

const EVENTS = ['sick', 'travel', 'injury', 'surgery', 'pregnancy', 'bereavement', 'shift_work', 'other'] as const

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => jsonText(value) }

export function registerEngageTools(ctx: Context, dataDir: () => string): void {
  ctx.tools.register(defineTool({
    name: 'read_season',
    description: 'Read this person\'s current 8–12 week season: theme, quests, unlocks (the one check that opens a result, instead of "N tests still missing"), streak, Codex draws waiting, and the weekly note. No name is included. Codex is omitted for anyone under 18. Call this when they ask what to do this season, about a draw, or about a sick or travel day.',
    parameters: {},
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => true,
    async execute() {
      return asJson(syncEngage(dataDir()))
    },
  }))

  ctx.tools.register(defineTool({
    name: 'log_life_event',
    description: 'Log a sick day, a trip, or another life event the person just stated, in their words. sick, travel and injury freeze the streak for those dates (a frozen day does not break the run and does not count as a completed day). Other events are remembered but do not freeze. from and to are YYYY-MM-DD; to may be omitted for a single day. Do not invent dates. One call freezes at most 14 days and only days that have a freeze available.',
    parameters: {
      event: { type: 'string', enum: [...EVENTS], required: true, description: 'sick, travel, injury, surgery, pregnancy, bereavement, shift_work, or other.' },
      from: { type: 'string', required: true, description: 'First civil day, YYYY-MM-DD.' },
      to: { type: 'string', description: 'Last civil day, YYYY-MM-DD. Omit for a single day.' },
      note_zh: { type: 'string', description: 'The person\'s own short note. Do not add a medical conclusion.' },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const event = EVENTS.find((item) => item === args.event)
      const from = typeof args.from === 'string' ? args.from.trim() : ''
      if (!event || !/^\d{4}-\d{2}-\d{2}$/.test(from)) return asJson({ ok: false, error: '需要 event，以及 YYYY-MM-DD 的 from。' })
      const to = typeof args.to === 'string' && args.to.trim() ? args.to.trim() : null
      const result = logLifeEngage(dataDir(), { event, from, to })
      return asJson({ ok: result.ok, error: result.error, froze: result.froze, streak: result.view.streak, season_title_zh: result.view.season?.title_zh ?? null })
    },
  }))
}
