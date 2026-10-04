// The prompt slot's state, shared by the right pane's top row, the bottom-right bar, the page's entry line and
// the presentation-mode switch: GET /api/longpi/codex/slot, polled each minute while the window is visible.

import React from 'react'
import { getJson, postJson } from '../api.ts'

export interface SlotState {
  enabled: boolean
  slot: { standup: boolean; standups_left: number; reveal: null | { ref: string; text_zh: string }; quiet: null | 'presentation' | 'outside_my_day' | 'off' }
  pane_zh: string | null
  presentation: boolean
  ready: number
}

const EMPTY: SlotState = { enabled: false, slot: { standup: false, standups_left: 0, reveal: null, quiet: null }, pane_zh: null, presentation: false, ready: 0 }

let current: SlotState = EMPTY
let version = 0
let timer: number | null = null
let users = 0
const listeners = new Set<() => void>()

function emit(): void {
  version += 1
  for (const listener of listeners) listener()
}

export async function refreshSlot(): Promise<void> {
  try {
    const next = await getJson<SlotState & { ok?: boolean }>('/api/longpi/codex/slot')
    if (next && typeof next === 'object' && next.slot) {
      current = { enabled: next.enabled === true, slot: next.slot, pane_zh: next.pane_zh ?? null, presentation: next.presentation === true, ready: next.ready ?? 0 }
      emit()
    }
  } catch { /* the last state stays */ }
}

function start(): void {
  if (timer != null || typeof window === 'undefined') return
  void refreshSlot()
  timer = window.setInterval(() => {
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    void refreshSlot()
  }, 60_000)
}

function stop(): void {
  if (timer != null) window.clearInterval(timer)
  timer = null
}

export function useSlot(): SlotState {
  React.useEffect(() => {
    users += 1
    start()
    return () => {
      users -= 1
      if (users === 0) stop()
    }
  }, [])
  React.useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => version, () => version)
  return current
}

export function slotNow(): SlotState {
  return current
}

/** Presentation mode: everything LongPi shows outside its own page is hidden at once, then saved. */
export async function setPresentation(on: boolean): Promise<void> {
  current = { ...current, presentation: on, slot: { ...current.slot, quiet: on ? 'presentation' : null } }
  emit()
  try { await postJson('/api/longpi/codex', { action: 'prefs', presentation: on }) } catch { /* the next poll shows what the server kept */ }
  await refreshSlot()
}

export function togglePresentation(): void {
  void setPresentation(!current.presentation)
}

/** A prompt-slot event (shown, 好, 今天别提醒了, reveal shown / 稍后 / 去看). */
export function slotEvent(event: 'shown' | 'ok' | 'dismiss_today' | 'reveal_shown' | 'reveal_later' | 'reveal_open', ref?: string): void {
  void postJson('/api/longpi/codex', { action: 'nudge', event, ...(ref ? { ref } : {}) }).then(() => refreshSlot()).catch(() => undefined)
}
