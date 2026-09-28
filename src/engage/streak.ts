// A streak counts days with a health action. A frozen sick or travel day is a bridge:
// it does not add a day, and it does not break the run.

import { addDays } from '../interventions.ts'
import type { IsoDay } from '../contracts/common.ts'

export function computeStreak(active: readonly IsoDay[], frozen: readonly IsoDay[], today: IsoDay): { current: number; lastActive: IsoDay | null } {
  const act = new Set(active)
  const ice = new Set(frozen)
  let cursor = today
  if (!act.has(cursor) && !ice.has(cursor)) cursor = addDays(cursor, -1)
  let current = 0
  let lastActive: IsoDay | null = null
  for (let guard = 0; guard < 4000; guard += 1) {
    if (act.has(cursor)) {
      current += 1
      if (!lastActive) lastActive = cursor
      cursor = addDays(cursor, -1)
      continue
    }
    if (ice.has(cursor)) {
      cursor = addDays(cursor, -1)
      continue
    }
    break
  }
  return { current, lastActive }
}

/** Inclusive civil days from `from` through `to`, ignoring anything after today. */
export function daysInRange(from: IsoDay, to: IsoDay, today: IsoDay): IsoDay[] {
  const end = to < today ? to : today
  if (end < from) return []
  const out: IsoDay[] = []
  let cursor = from
  for (let guard = 0; guard < 400 && cursor <= end; guard += 1) {
    out.push(cursor)
    cursor = addDays(cursor, 1)
  }
  return out
}
