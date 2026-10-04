// Chat tools. read_season is read-only. log_life_event records sick and travel days,
// which quiets reminders for those days. Neither tool sends the person's name anywhere.

import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import { defineTool } from '@deepseek-ai/dsh-tools'
import { asJson } from '../json.ts'
import { noteSeasonContext, runCodexMethod, syncEngage, logLifeEngage } from './engine.ts'
import { validateSeasonDraft, type SeasonDraft, type SeasonFact } from './personal.ts'

const EVENTS = ['sick', 'travel', 'injury', 'surgery', 'pregnancy', 'bereavement', 'shift_work', 'other'] as const

function jsonText(value: unknown): [{ type: 'text'; text: string }] {
  return [{ type: 'text', text: JSON.stringify(value, null, 2) }]
}

const jsonOut = { schema: { type: 'json' as const }, render: (_args: unknown, value: unknown) => jsonText(value) }

export function registerEngageTools(ctx: Context, dataDir: () => string): void {
  ctx.tools.register(defineTool({
    name: 'read_season',
    description: 'Read this person\'s current 8–12 week season: theme, quests, unlocks (the one check that opens a result, instead of "N tests still missing"), count (days with a health action, cumulative, and the day of the next draw), Codex draws waiting, and the weekly note. Say counts as cumulative (累计 N 天); never speak of a streak or of breaking one. No name is included. Codex is omitted for anyone under 18. Call this when they ask what to do this season, about a draw, or about a sick or travel day.',
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
    description: 'Log a sick day, a trip, or another life event the person just stated, in their words, so reminders and plans go easy on those dates. Counts are cumulative, so nothing is lost on such a day; say so if they worry. from and to are YYYY-MM-DD; to may be omitted for a single day. Do not invent dates. One call covers at most 14 days.',
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
      return asJson({ ok: result.ok, error: result.error, froze: result.froze, count: result.view.count, season_title_zh: result.view.season?.title_zh ?? null })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'propose_personal_season',
    description: 'Propose this season\'s theme and 3 to 5 quests from the fact pack already on file. You choose the wording. The validator keeps the quest events. An invalid proposal is replaced by the template (for example an anaemia pattern becomes 查清贫血: book haematology or gastroenterology, bring the brief, add ferritin and iron studies, recheck the blood count at 8–12 weeks). Do not invent a younger claim, a price, or a quest whose completion depends on a flattering lab.',
    parameters: {
      title_zh: { type: 'string', required: true, description: 'Season title, 2–20 characters, no claim that the person got younger.' },
      focus: { type: 'string', required: true, description: 'care, data, bioage, cardio, glucose, weight, sleep, or plan.' },
      marker_keys_json: { type: 'string', description: 'JSON array of marker keys named by the facts, such as ["hb","ferritin"].' },
      quests_json: { type: 'string', required: true, description: 'JSON array of {id, kind, title_zh, event, count, where?}. Events: care.booked, care.visit_logged, selfmeasure.logged, retest.arrived, checkin.logged. 3 to 5 items.' },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const parsed = parseDraft(args)
      if (!parsed) return asJson({ ok: false, error: 'quests_json 不是可用的任务列表。' })
      const current = syncEngage(dataDir())
      const facts = readFacts(dataDir())
      const check = validateSeasonDraft(parsed, facts)
      const view = noteSeasonContext(dataDir(), { facts, draft: parsed })
      return asJson({
        ok: check.ok,
        errors: check.errors,
        origin: view.personal_origin,
        title_zh: view.season?.title_zh ?? current.season?.title_zh ?? null,
        quests: view.quests.map((quest) => quest.title_zh),
      })
    },
  }))

  ctx.tools.register(defineTool({
    name: 'run_drawn_method',
    description: 'Run a method the person already drew, through the same input check as chat. If the card is animal or cell evidence, return that evidence and do not compute a personal number. If inputs are missing, say what to add. This does not hide any other method.',
    parameters: {
      card_id: { type: 'string', required: true, description: 'The drawn card id.' },
    },
    output: jsonOut,
    timeoutMs: 30000,
    isConcurrencySafe: () => false,
    async execute(args) {
      const cardId = typeof args.card_id === 'string' ? args.card_id : ''
      if (!cardId) return asJson({ ok: false, error: '需要 card_id。' })
      const result = await runCodexMethod(dataDir(), cardId)
      return asJson({ ok: result.ok, error: result.error, text_zh: result.text_zh, label: result.label, ran: result.ran })
    },
  }))
}

function readFacts(dataDir: string): SeasonFact[] {
  try {
    const raw = JSON.parse(readFileSync(join(dataDir, 'engage', 'state.json'), 'utf8')) as { facts?: SeasonFact[] }
    return Array.isArray(raw.facts) ? raw.facts : []
  } catch {
    return []
  }
}

function parseDraft(args: Record<string, unknown>): SeasonDraft | null {
  const title = typeof args.title_zh === 'string' ? args.title_zh.trim() : ''
  const focus = typeof args.focus === 'string' ? args.focus : 'care'
  let quests: unknown = []
  let keys: unknown = []
  try { quests = JSON.parse(typeof args.quests_json === 'string' ? args.quests_json : '[]') } catch { return null }
  try { keys = JSON.parse(typeof args.marker_keys_json === 'string' ? args.marker_keys_json : '[]') } catch { keys = [] }
  if (!Array.isArray(quests)) return null
  const allowed = new Set(['care', 'data', 'bioage', 'cardio', 'glucose', 'weight', 'sleep', 'plan'])
  return {
    title_zh: title,
    focus: (allowed.has(focus) ? focus : 'care') as SeasonDraft['focus'],
    marker_keys: Array.isArray(keys) ? keys.filter((item): item is string => typeof item === 'string').slice(0, 8) : [],
    quests: quests.slice(0, 5).flatMap((item) => {
      if (!item || typeof item !== 'object') return []
      const row = item as Record<string, unknown>
      if (typeof row.id !== 'string' || typeof row.title_zh !== 'string' || typeof row.event !== 'string' || typeof row.kind !== 'string') return []
      const count = typeof row.count === 'number' ? row.count : 1
      return [{ id: row.id, kind: row.kind as SeasonDraft['quests'][number]['kind'], title_zh: row.title_zh, event: row.event as SeasonDraft['quests'][number]['event'], count }]
    }),
  }
}
