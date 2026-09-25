// Whether the person has a model to talk to, for onboarding step 1. DSH keeps
// this in its Models page and exposes no plugin API for it, so LongPi asks the
// same Remote services that page reads, only when they are there (ctx.inject
// runs the probe once 'remote.llm' and 'remote.credentials' exist, never
// otherwise), and answers only what it can tell for sure:
//   ready    the official DeepSeek key is configured;
//   missing  DeepSeek is the only provider and the key its settings name
//            (llm-deepseek.apiKeyEnv, DEEPSEEK_API_KEY by default) is not
//            configured. Without a readable settings view the reference could
//            be a custom one, so an unset default is unknown, not missing;
//   unknown  anything else (another provider, a failed read, an older DSH).
//            Unknown shows nothing.

import React from 'react'

export type ModelStatus = 'ready' | 'missing' | 'unknown'

type RemoteAnswer<T> = { ok: true; value: T } | { ok: false; error?: { message?: string } }

interface ProbeRemote {
  llm?: { listProviders?: () => Promise<RemoteAnswer<Array<{ id?: string }>>> }
  credentials?: { describe?: (refs: string[]) => Promise<RemoteAnswer<Record<string, { configured?: boolean }>>> }
}

/** DSH's settings mirror as its Models page reads it (settingsScope.describe()). */
export interface SettingsFace {
  ensure?: () => Promise<unknown>
  getSnapshot?: () => { view?: { namespaces?: Array<{ ns?: string; value?: unknown }> } } | undefined
}

/** The official DeepSeek route, its settings namespace and the key reference it defaults to (dsh-llm-deepseek). */
const DEEPSEEK_ROUTE = 'deepseek-official'
const DEEPSEEK_NS = 'llm-deepseek'
const DEEPSEEK_KEY = 'DEEPSEEK_API_KEY'

let probe: (() => Promise<ModelStatus>) | null = null
let settings: SettingsFace | null = null
let status: ModelStatus = 'unknown'
const listeners = new Set<() => void>()

function set(next: ModelStatus): void {
  if (next === status) return
  status = next
  for (const listener of listeners) listener()
}

/** The key reference the DeepSeek route reads, as its settings say; null when they cannot be read. */
async function keyRefOf(face: SettingsFace | null): Promise<string | null> {
  if (!face) return null
  try {
    await face.ensure?.()
    const namespace = face.getSnapshot?.()?.view?.namespaces?.find((row) => row.ns === DEEPSEEK_NS)
    if (!namespace) return null
    const ref = namespace.value && typeof namespace.value === 'object' ? (namespace.value as Record<string, unknown>).apiKeyEnv : undefined
    return typeof ref === 'string' && ref ? ref : DEEPSEEK_KEY
  } catch {
    return null
  }
}

export async function readModelStatus(remote: ProbeRemote, face: SettingsFace | null = null): Promise<ModelStatus> {
  try {
    const providers = await remote.llm?.listProviders?.()
    if (!providers?.ok) return 'unknown'
    const ids = providers.value.map((row) => String(row.id ?? ''))
    if (!ids.includes(DEEPSEEK_ROUTE) || ids.some((id) => id !== DEEPSEEK_ROUTE)) return 'unknown'
    const ref = await keyRefOf(face)
    const name = ref ?? DEEPSEEK_KEY
    const described = await remote.credentials?.describe?.([name])
    if (!described?.ok) return 'unknown'
    const key = described.value[name]
    if (!key) return 'unknown'
    if (key.configured === true) return 'ready'
    return ref ? 'missing' : 'unknown'
  } catch {
    return 'unknown'
  }
}

/** Called from apply() inside ctx.inject: the probe lives as long as those services do. */
export function setModelProbe(remote: ProbeRemote | null): void {
  probe = remote ? () => readModelStatus(remote, settings) : null
  if (!remote) set('unknown')
}

/** The settings mirror, when DSH has one: it names the key reference the route really reads. */
export function setModelSettings(face: SettingsFace | null): void {
  settings = face
  recheckModel()
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
