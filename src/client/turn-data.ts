// What LongPi did in one turn, for the quick actions under it (turn-tail.ts). DSH folds a finished turn's tool
// calls, cards included, behind "N 次工具调用"; the actions a card offers (adopt a draft, confirm a read-back,
// take back a check-in) would be hidden with it. A conversation Definition collects this turn's LongPi calls
// from the session log and publishes them as the turn's `longpi` data; the chain selector claims the tail only
// for a turn that left something to do. Plain data and pure functions: no React, testable in Node.

/** The LongPi tools whose outcome can leave something to do after the turn. */
export const TAIL_TOOLS = ['draft_intervention_plan', 'save_intervention_plan', 'log_intervention_checkin'] as const
export type TailTool = typeof TAIL_TOOLS[number]

export const LONGPI_TURN_KEY = 'longpi'
export const LONGPI_TURN_KIND = 'dsh-plugin-longpi.turn'

type Raw = Record<string, unknown>

/** One settled LongPi call in the turn: its arguments and its JSON result (null when it failed or was not JSON). */
export interface TailCall {
  callId: string
  name: TailTool
  seq: number
  args: Raw
  result: Raw | null
  isError: boolean
}

export interface LongPiTurnData {
  turn: number
  calls: TailCall[]
}

interface State {
  turn: number
  pending: Map<string, { name: TailTool; args: Raw }>
  calls: TailCall[]
}

/** The parts of DSH's session events the Definition reads. */
interface EventLike {
  type: string
  seq?: number
  surfaceOp?: string
  data?: unknown
}

function objectOf(value: unknown): Raw {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : {}
}

function parsed(text: unknown): Raw | null {
  if (typeof text !== 'string' || !text.trim()) return null
  try {
    const value = JSON.parse(text) as unknown
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Raw : null
  } catch {
    return null
  }
}

function isTailTool(name: unknown): name is TailTool {
  return typeof name === 'string' && (TAIL_TOOLS as readonly string[]).includes(name)
}

/** A tool result as it entered the transcript, not a replacement copy (DSH's append-origin surface events). */
function appended(event: EventLike): boolean {
  return event.surfaceOp === undefined || event.surfaceOp === 'append'
}

function turnOf(event: EventLike): number | null {
  const turn = objectOf(event.data).turn
  return typeof turn === 'number' && Number.isInteger(turn) ? turn : null
}

/** The result block of a tool/result event: its call id, error flag and text. */
function resultOf(event: EventLike): { callId: string; isError: boolean; text: string } | null {
  const message = objectOf(objectOf(event.data).message)
  const block = objectOf(Array.isArray(message.content) ? message.content[0] : undefined)
  const callId = String(objectOf(message.source).callId ?? block.toolCallId ?? '')
  if (!callId) return null
  const parts = Array.isArray(block.content) ? block.content : []
  const text = parts.map((part) => objectOf(part)).filter((part) => part.type === 'text' && typeof part.text === 'string').map((part) => part.text as string).join('\n')
  return { callId, isError: block.isError === true, text }
}

/** DSH's ConversationNodeDefinition, restated with only what this one uses (the package is not a dependency). */
export const longPiTurnDefinition = {
  kind: LONGPI_TURN_KIND,
  match(event: EventLike): { id: string; role: 'start' | 'update' } | null {
    const turn = turnOf(event)
    if (turn == null) return null
    if (event.type === 'turn/start') return { id: String(turn), role: 'start' }
    if (event.type === 'tool/call' && isTailTool(objectOf(event.data).name)) return { id: String(turn), role: 'update' }
    if (event.type === 'tool/result' && appended(event)) return { id: String(turn), role: 'update' }
    return null
  },
  start(_context: unknown, match: { event: EventLike }): State {
    return { turn: turnOf(match.event) ?? 0, pending: new Map(), calls: [] }
  },
  update(context: { state: State }, match: { event: EventLike }): State {
    const { event } = match
    const state = context.state
    if (event.type === 'tool/call') {
      const data = objectOf(event.data)
      if (!isTailTool(data.name) || typeof data.callId !== 'string') return state
      const pending = new Map(state.pending)
      pending.set(data.callId, { name: data.name, args: parsed(data.arguments) ?? {} })
      return { ...state, pending }
    }
    if (event.type !== 'tool/result') return state
    const result = resultOf(event)
    const call = result ? state.pending.get(result.callId) : undefined
    if (!result || !call) return state
    const pending = new Map(state.pending)
    pending.delete(result.callId)
    const settled: TailCall = { callId: result.callId, name: call.name, seq: event.seq ?? 0, args: call.args, result: result.isError ? null : parsed(result.text), isError: result.isError }
    return { ...state, pending, calls: [...state.calls, settled] }
  },
  buildLocationData(context: { state?: State }, scope: string, previous: { kind?: string; key?: string; value?: unknown } | null) {
    const state = context.state
    if (scope !== 'turn' || !state || state.calls.length === 0) return null
    const value = previous?.kind === 'turn' && previous.key === LONGPI_TURN_KEY ? previous.value as LongPiTurnData | undefined : undefined
    if (value && value.turn === state.turn && value.calls === state.calls) return previous
    return { kind: 'turn' as const, turn: state.turn, key: LONGPI_TURN_KEY, value: { turn: state.turn, calls: state.calls } satisfies LongPiTurnData }
  },
}

/** What the tail offers for one turn: the latest draft, a read-back waiting for a yes, and today's check-ins. */
export interface TailMatch {
  draft: TailCall | null
  readBack: TailCall | null
  saved: TailCall | null
  checkin: TailCall | null
}

/** A read-back is waiting when the turn's last save call was confirm=false and came back readable, unsaved. */
function waitingReadBack(calls: readonly TailCall[]): TailCall | null {
  const last = [...calls].reverse().find((call) => call.name === 'save_intervention_plan')
  if (!last || last.isError || !last.result) return null
  if (last.args.confirm === true || last.result.saved !== false) return null
  const errors = Array.isArray(last.result.errors) ? last.result.errors : []
  return errors.length === 0 ? last : null
}

/** The turn's actions, or null when it left nothing to do (the chain then falls through to other tails). */
export function tailMatchOf(data: LongPiTurnData | undefined | null): TailMatch | null {
  const calls = data?.calls ?? []
  if (calls.length === 0) return null
  const draft = [...calls].reverse().find((call) => call.name === 'draft_intervention_plan' && !call.isError && objectOf(call.result).draft != null) ?? null
  const readBack = waitingReadBack(calls)
  const saved = [...calls].reverse().find((call) => call.name === 'save_intervention_plan' && call.args.confirm === true && objectOf(call.result).saved === true) ?? null
  const checkin = [...calls].reverse().find((call) => call.name === 'log_intervention_checkin' && !call.isError && Array.isArray(objectOf(call.result).entries) && (objectOf(call.result).entries as unknown[]).length > 0) ?? null
  if (!draft && !readBack && !saved && !checkin) return null
  return { draft, readBack, saved, checkin }
}

/** The turn-tail chain selector: DSH's owner carries the turn, whose data store holds LongPi's value. */
export function selectLongPiTail(owner: { turn?: { data?: { get?: (key: string) => unknown } } }): TailMatch | null {
  try {
    return tailMatchOf(owner.turn?.data?.get?.(LONGPI_TURN_KEY) as LongPiTurnData | undefined)
  } catch {
    return null
  }
}
