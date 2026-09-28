// In-workflow nudges are off until the person opts in. The offer is once.
// The nudge itself is client-side and at most once a day. It never enters a prompt.

import type { IsoDay } from '../contracts/common.ts'

export interface NudgeState {
  choice: 'on' | 'off' | null
  dismissed: boolean
  offered: boolean
  last_shown: IsoDay | null
}

export function nudgeView(nudge: NudgeState, today: IsoDay, seasonOpen: boolean): { offer: boolean; enabled: boolean; show: boolean } {
  const enabled = nudge.choice === 'on'
  return {
    offer: seasonOpen && !enabled && !nudge.dismissed && !nudge.offered,
    enabled,
    show: enabled && nudge.last_shown !== today,
  }
}
