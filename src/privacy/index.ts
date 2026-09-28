// M11 seams (AA §3.6). consentGranted stays false until the person records a grant.
// One dsh process is one person; register() binds the data directory.

import type { ConsentRecord, ScienceMode } from '../contracts/science.ts'
import { readProfile } from '../profile.ts'
import { isGranted, minorView, type MinorView } from './consents.ts'

export const LIVE_BLOCKERS_ZH = [
  '还没有境内主体作为个人信息处理者',
  '还没有生命科学和医学研究伦理审查批件',
  '还没有 ChiCTR 注册号',
  '人类遗传资源：研究排除基因、基因组和分型数据，书面说明尚未由负责人确认',
  '本版本不打开 scienceMode: live',
] as const

/** Research statistics never include genetics. M8's manifests must keep this exclusion. */
export const GENETICS_IN_RESEARCH = false

interface Bound {
  dataDir: () => string
  scienceMode: () => ScienceMode
  codexEnabled: () => boolean
}

const bound: Bound = {
  dataDir: () => '',
  scienceMode: () => 'off',
  codexEnabled: () => true,
}

export function bindPrivacy(next: Bound): void {
  bound.dataDir = next.dataDir
  bound.scienceMode = next.scienceMode
  bound.codexEnabled = next.codexEnabled
}

export function consentGranted(scope: ConsentRecord['scope']): boolean {
  const dir = bound.dataDir()
  if (!dir) return false
  return isGranted(dir, scope)
}

export function personMinor(): MinorView | null {
  const dir = bound.dataDir()
  if (!dir) return null
  try {
    return minorView(readProfile(dir))
  } catch {
    return null
  }
}

/** D11: on for a known adult when the product switch is on; off for minors and when age is unknown. */
export function codexAllowed(): boolean {
  if (!bound.codexEnabled()) return false
  const view = personMinor()
  return view?.codex === true
}

/** D6: live collection stays off in this build. Simulated mode does not use this. */
export function liveScienceAllowed(): boolean {
  return false
}

export function liveBlockers(): string[] {
  const rows: string[] = [...LIVE_BLOCKERS_ZH]
  if (!consentGranted('pipl_sensitive')) rows.unshift('还没有敏感个人信息的单独同意')
  if (bound.scienceMode() === 'live') rows.push('配置里写了 live，本模块仍拒绝把它当作已经获准')
  return rows
}
