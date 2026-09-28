// M8 seams (AA §3.6). scienceSummary() stays callable with no arguments. Nothing is written while the mode is off.

import type { FactPack } from '../contracts/factpack.ts'
import type { ScienceMode } from '../contracts/science.ts'
import { readCards, scienceCandidates } from './community.ts'
import { activeStudyIds } from './consent-flow.ts'
import { LIVE_REFUSED_ZH } from './verify.ts'

export interface ScienceState {
  configured: () => ScienceMode
  dataDir: () => string
}

const state: ScienceState = {
  configured: () => 'off',
  dataDir: () => '',
}

export function startScience(next: ScienceState): void {
  state.configured = next.configured
  state.dataDir = next.dataDir
}

export function configuredMode(): ScienceMode {
  try {
    const mode = state.configured()
    return mode === 'live' || mode === 'simulated' || mode === 'off' ? mode : 'off'
  } catch {
    return 'off'
  }
}

/** Live is refused in this build (D6). The fact pack then says off, so no study is described as live. */
export function effectiveMode(): 'off' | 'simulated' {
  return configuredMode() === 'simulated' ? 'simulated' : 'off'
}

export function scienceSummary(): FactPack['science'] {
  const mode = effectiveMode()
  if (mode === 'off') return { mode: 'off', active_studies: 0 }
  const dir = state.dataDir()
  if (!dir) return { mode, active_studies: 0 }
  try {
    return { mode, active_studies: activeStudyIds(dir).length }
  } catch {
    return { mode, active_studies: 0 }
  }
}

export function liveRefused(): { refused: boolean; reason_zh: string } {
  return configuredMode() === 'live' ? { refused: true, reason_zh: LIVE_REFUSED_ZH } : { refused: false, reason_zh: '' }
}

export { scienceCandidates }

/** Cards M6 can show. They name a study, never a biomarker rarity. */
export function contributionCards(): Array<{ id: string; title_zh: string; body_zh: string }> {
  if (effectiveMode() !== 'simulated') return []
  const dir = state.dataDir()
  if (!dir) return []
  try {
    return readCards(dir).map(({ id, title_zh, body_zh }) => ({ id, title_zh, body_zh }))
  } catch {
    return []
  }
}
