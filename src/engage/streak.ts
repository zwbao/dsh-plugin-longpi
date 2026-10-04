// Counting days with a health action. What the person sees and earns is cumulative (owner decision, 0.9: a missed day
// never takes anything away); the streak is still computed for older stored state and the sick or travel freeze.

import { addDays } from '../interventions.ts'
import type { IsoDay } from '../contracts/common.ts'

/** The cumulative counts at which a draw is earned (Pi celebrates the same ones), then every 50. */
export const MILESTONES = [1, 5, 10, 20, 50, 100] as const

export function milestonesUpTo(total: number): number[] {
  const out = MILESTONES.filter((m) => m <= total) as number[]
  for (let m = 150; m <= total; m += 50) out.push(m)
  return out
}

export function nextMilestone(total: number): number {
  return MILESTONES.find((m) => m > total) ?? (Math.floor(total / 50) + 1) * 50
}

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
