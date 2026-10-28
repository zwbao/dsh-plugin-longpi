// Capture before the first await: page switches cannot redirect background memory extraction.
import type { Context } from '@deepseek-ai/cordis'
import { readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import type { LlmCall } from '../contracts/agents.ts'
import type { Bus } from '../contracts/events.ts'
import type { FactPack } from '../contracts/factpack.ts'
import { createBus } from '../core/bus.ts'
import { createMemory } from '../core/memory.ts'
import { isoDay } from '../interventions.ts'
import { PERSON_ID, SELF, personDir } from '../people/store.ts'
import { sessionKey } from '../plan-hold.ts'
import { currentSurfaces } from '../surfaces/service.ts'
import { DISTILL_PREFILTER, distillerProfile } from './memory_distiller.ts'
import { latestPersonText } from './orchestrator.ts'

function registry(root: string): { active: string; people: { id: string; created_at: string }[] } {
  let text: string
  try { text = readFileSync(join(root, 'people.json'), 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return { active: SELF, people: [] }
    throw error
  }
  const raw = JSON.parse(text)
  if (!raw || !Array.isArray(raw.people) || typeof raw.active !== 'string'
    || (raw.active !== SELF && (!PERSON_ID.test(raw.active) || !raw.people.some((p: { id?: string } | null) => p?.id === raw.active)))) {
    throw new Error('cannot identify the memory owner')
  }
  return raw
}

function deletionStamp(dataDir: string): string {
  try { return readFileSync(join(dataDir, 'privacy', 'deleted.json'), 'utf8') } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return ''
    throw error
  }
}

function captureTarget(root: string) {
  const reg = registry(root)
  const id = reg.active
  const created = reg.people.find(p => p?.id === id)?.created_at
  if (id !== SELF && typeof created !== 'string') throw new Error('missing member identity')
  const dataDir = personDir(root, id)
  const stat = statSync(dataDir)
  if (!stat.isDirectory()) throw new Error('missing member directory')
  const stamp = deletionStamp(dataDir)
  return { dataDir, valid: () => {
    try {
      const current = registry(root)
      const now = statSync(dataDir)
      return now.isDirectory() && now.dev === stat.dev && now.ino === stat.ino
        && deletionStamp(dataDir) === stamp
        && (id === SELF || current.people.some(p => p?.id === id && p.created_at === created))
    } catch { return false }
  } }
}

interface Turn {
  turn: number
  text: string
  root: string
  target: ReturnType<typeof captureTarget>
  pack: FactPack | null
}

export function registerMemoryDistillation(ctx: Context, options: {
  isHealth: (agent: unknown) => boolean
  rootDir: () => string
  llm: LlmCall
  bus: Bus
  log: (message: string) => void
}): void {
  const turns = new Map<string, Turn>()
  ctx.on('agent/pre-step', async (raw, next) => {
    const payload = raw as unknown as { agent?: unknown; turn?: number; step?: number; messages: unknown[]; signal?: AbortSignal }
    const session = sessionKey(payload.agent)
    let captured: Turn | undefined
    if (payload.step === 1 && session) {
      turns.delete(session)
      try {
        if (options.isHealth(payload.agent) && !payload.signal?.aborted && Number.isInteger(payload.turn)) {
          const root = options.rootDir()
          const target = captureTarget(root)
          captured = { turn: payload.turn!, text: latestPersonText(payload.messages), root, target,
            pack: currentSurfaces(target.dataDir)?.pack ?? null }
          turns.set(session, captured)
          if (turns.size > 500) turns.delete(turns.keys().next().value as string)
        }
      } catch { options.log('memory extraction skipped: member identity unavailable') }
    }
    try {
      const decision = await next()
      if (captured && (decision.kind !== 'enter' || payload.signal?.aborted) && turns.get(session) === captured) turns.delete(session)
      return decision
    } catch (error) {
      if (captured && turns.get(session) === captured) turns.delete(session)
      throw error
    }
  }, { prepend: true })

  ctx.on('agent/turn-stopping', (raw) => {
    try {
      const payload = raw as unknown as { agent?: unknown; turn?: number }
      const session = sessionKey(payload.agent)
      const captured = turns.get(session)
      if (!captured || captured.turn !== payload.turn) return
      turns.delete(session)
      const valid = () => options.rootDir() === captured.root && captured.target.valid()
      if (!options.isHealth(payload.agent) || !valid()) return
      // Inactive members get their own durable events, without notifying the active page.
      const bus = () => personDir(captured.root, registry(captured.root).active) === captured.target.dataDir
        ? options.bus : createBus({ dataDir: () => captured.target.dataDir })
      const hit = DISTILL_PREFILTER.test(captured.text)
      bus().emit('chat.turn_ended', { session_id: session, turn: captured.turn, health: true, prefilter_hit: hit }, { module: 'M0', via: 'hook', session_id: session })
      if (!hit) return
      const pack = captured.pack ?? currentSurfaces(captured.target.dataDir)?.pack
      if (!pack) return
      void options.llm.structured({ profile: distillerProfile, pack,
        extra: { message: captured.text, session_id: session, today: isoDay() },
      }).then(({ value }) => {
        if (!valid()) { options.log('memory extraction discarded: member removed or store replaced'); return }
        if (value.length > 0) createMemory(() => captured.target.dataDir, bus).apply(value, 'M0')
      }).catch(() => options.log('memory extraction failed'))
    } catch { options.log('memory extraction skipped: turn context unavailable') }
  })
}
