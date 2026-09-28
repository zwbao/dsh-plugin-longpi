// Unlocks replace "还差 N 项检查" with the one check that opens a result.

import type { IsoTime } from '../contracts/common.ts'
import type { Unlock } from '../contracts/engagement.ts'

export const REMINDER_ZH: Record<string, string> = {
  cvd_risk: '量一次腰围，就能解锁心血管风险',
  bioage: '下次体检加测超敏 C 反应蛋白，就能解锁身体年龄',
}

export function makeUnlocks(): Unlock[] {
  return [
    {
      id: 'un-cvd-risk',
      key: 'cvd_risk',
      title_zh: '心血管风险',
      teaser_zh: '量一次腰围 → 解锁心血管风险',
      requires: [{ kind: 'input', key: 'waist', label_zh: '腰围' }],
      status: 'locked',
    },
    {
      id: 'un-bioage',
      key: 'bioage',
      title_zh: '身体年龄',
      teaser_zh: '加测 hs-CRP（约 40–80 元）→ 解锁身体年龄',
      requires: [{ kind: 'input', key: 'hscrp', label_zh: '超敏 C 反应蛋白' }],
      status: 'locked',
    },
  ]
}

export function openUnlock(unlock: Unlock, have: boolean, at: IsoTime): Unlock {
  if (!have || unlock.status === 'unlocked') return unlock
  return { ...unlock, status: 'unlocked', unlocked_at: at }
}
