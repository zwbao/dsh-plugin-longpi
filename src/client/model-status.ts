// Whether the person has a model to talk to, for onboarding step 1. DSH keeps
// this in its Models page and exposes no plugin API for it, so LongPi asks the
// same Remote services that page reads, only when they are there (ctx.inject
// runs the probe once 'remote.llm' and 'remote.credentials' exist, never
// otherwise), and answers only what it can tell for sure:
//   ready    the official DeepSeek key is configured;
//   missing  DeepSeek is the only provider and its key is not configured;
//   unknown  anything else (another provider, a custom key reference, a failed
//            read, an older DSH). Unknown shows nothing.

import React from 'react'

export type ModelStatus = 'ready' | 'missing' | 'unknown'

type RemoteAnswer<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } }

interface ProbeRemote {
  llm?: { listProviders?: () => Promise<RemoteAnswer<Array<{ id?: string }>>> }
  credentials?: { describe?: (refs: string[]) => Promise<RemoteAnswer<Record<string, { configured?: boolean }>>> }
}

/** The official DeepSeek route and the key reference its settings default to (dsh-llm-deepseek). */
const DEEPSEEK_ROUTE = 'deepseek-official'
const DEEPSEEK_KEY = 'DEEPSEEK_API_KEY'

let probe: (() => Promise<ModelStatus>) | null = null
let status: ModelStatus = 'unknown'
const listeners = new Set<() => void>()

function set(next: ModelStatus): void {
  if (next === status) return
  status = next
  for (const listener of listeners) listener()
}

export async function readModelStatus(remote: ProbeRemote): Promise<ModelStatus> {
  try {
    const providers = await remote.llm?.listProviders?.()
    if (!providers?.ok) return 'unknown'
    const ids = providers.value.map((row) => String(row.id ?? ''))
    if (!ids.includes(DEEPSEEK_ROUTE) || ids.some((id) => id !== DEEPSEEK_ROUTE)) return 'unknown'
    const described = await remote.credentials?.describe?.([DEEPSEEK_KEY])
    if (!described?.ok) return 'unknown'
    const key = described.value[DEEPSEEK_KEY]
    if (!key) return 'unknown'
    return key.configured === true ? 'ready' : 'missing'
  } catch {
    return 'unknown'
  }
}

/** Called from apply() inside ctx.inject: the probe lives as long as those services do. */
export function setModelProbe(remote: ProbeRemote | null): void {
  probe = remote ? () => readModelStatus(remote) : null
  if (!remote) set('unknown')
}

export function recheckModel(): void {
  if (!probe) return
  void probe().then(set)
}

/** The status, checked again each time a surface that shows it mounts. */
export function useModelStatus(): ModelStatus {
  React.useEffect(() => { recheckModel() }, [])
  return React.useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => status, () => status)
}
