// Outcomes of one tool call that the chat card and the turn's quick actions share: the plan version a draft
// was adopted as, and a check-in taken back. Kept per call id in the browser, so the card, the quick actions
// and a reload all say the same thing.

import React from 'react'
import { readPref, writePref } from './ui.ts'

const ADOPTED_KEY = 'dsh-plugin-longpi.adopted.'
const UNDONE_KEY = 'dsh-plugin-longpi.undone.'

let version = 0
const listeners = new Set<() => void>()

function changed(): void {
  version += 1
  for (const listener of listeners) listener()
}

/** The plan version this call's draft was adopted as, or null. */
export function adoptedVersion(callId: string): number | null {
  const value = Number(readPref(`${ADOPTED_KEY}${callId}`))
  return Number.isFinite(value) && value > 0 ? value : null
}

export function setAdopted(callId: string, plan: number): void {
  writePref(`${ADOPTED_KEY}${callId}`, String(plan))
  changed()
}

/** Whether this call's check-ins for today were taken back. */
export function isUndone(callId: string): boolean {
  return readPref(`${UNDONE_KEY}${callId}`) === '1'
}

export function setUndone(callId: string): void {
  writePref(`${UNDONE_KEY}${callId}`, '1')
  changed()
}

/** Re-render when any call's outcome changes. */
export function useCallState(): number {
  return React.useSyncExternalStore((listener) => {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  }, () => version, () => version)
}
